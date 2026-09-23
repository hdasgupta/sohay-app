/** Patient: doctors, slots, booking, appointments, family */
import env from '../config/env.js';
import { withTransaction } from '../config/db.js';
import AppError from '../utils/AppError.js';
import { ok, created } from '../utils/response.js';
import logger from '../utils/logger.js';
import { requireFields, cleanEmail, cleanString, assertEmail, toId } from '../utils/validators.js';
import { doctorDto, patientDto, appointmentDto } from '../utils/serializers.js';
import { APPOINTMENT_STATUS, ACTIVE_APPOINTMENT_STATUSES, INVITATION_STATUS } from '../config/constants.js';
import {
  isValidIsoDate, todayInKolkata, addDays, normaliseTime, formatDisplayDate, formatDisplayTime, isFutureSlot,
} from '../utils/date.js';
import { availableSlots, assertSlotBookable, slotEnd, getDoctorForBooking } from '../services/slot.service.js';
import { sendEmail } from '../services/email.service.js';
import {
  appointmentBookedEmail, appointmentCancelledEmail, familyInvitationEmail, familyResponseEmail,
} from '../templates/emailTemplates.js';
import * as common from '../models/common.model.js';
import * as patientModel from '../models/patient.model.js';

export const BOOKING_WINDOW_DAYS = 90;

/** The logged in patient + everybody in their family */
async function bookableMembers(userId) {
  const me = await common.getPatientProfile(userId);
  if (!me) throw AppError.notFound('Patient profile not found');
  if (!me.family_id) return { me, members: [patientDto(me)], family: null };
  const family = await patientModel.getFamily(me.family_id);
  const members = (await patientModel.familyMembers(me.family_id)).map(patientDto);
  return { me, members, family };
}

async function assertCanBookFor(userId, patientId) {
  const { members } = await bookableMembers(userId);
  if (!members.some((m) => m.id === Number(patientId))) throw AppError.forbidden('You can book only for yourself or your family members');
}

export async function listDoctors(_req, res) {
  const rows = await patientModel.listEnabledDoctors();
  const map = await common.availabilityForDoctors(rows.map((r) => Number(r.id)));
  ok(res, rows.map((r) => doctorDto(r, map.get(Number(r.id)))));
}

export async function members(req, res) {
  const { members: list, family } = await bookableMembers(req.user.id);
  ok(res, { family: family ? { id: Number(family.id), name: family.name } : null, members: list });
}

export async function slots(req, res) {
  const doctorId = toId(req.query.doctorId, 'doctor id');
  const patientId = req.query.patientId ? toId(req.query.patientId, 'patient id') : Number(req.user.id);
  const { date } = req.query;
  if (!isValidIsoDate(date)) throw AppError.badRequest('Invalid date');
  await assertCanBookFor(req.user.id, patientId);
  await getDoctorForBooking(doctorId);
  ok(res, await availableSlots({ doctorId, date, patientId }));
}

export async function book(req, res) {
  requireFields(req.body, ['doctorId', 'date', 'startTime']);
  const doctorId = toId(req.body.doctorId, 'doctor id');
  const patientId = req.body.patientId ? toId(req.body.patientId, 'patient id') : Number(req.user.id);
  const { date } = req.body;
  const startTime = normaliseTime(req.body.startTime);
  if (!isValidIsoDate(date)) throw AppError.badRequest('Invalid date');
  const today = todayInKolkata();
  if (date < today || date > addDays(today, BOOKING_WINDOW_DAYS)) throw AppError.badRequest(`Appointments can be booked from today up to ${BOOKING_WINDOW_DAYS} days ahead`);
  await assertCanBookFor(req.user.id, patientId);
  const doctor = await getDoctorForBooking(doctorId);
  await assertSlotBookable({ doctorId, patientId, date, startTime });
  const row = await patientModel.insertAppointment({
    patientId, doctorId, bookedBy: req.user.id, date, startTime, endTime: slotEnd(startTime), status: APPOINTMENT_STATUS.SCHEDULED,
  });
  const appt = await common.getAppointmentById(row.id);
  const meetingUrl = `${env.frontendUrl}/meeting/${row.id}`;
  const mail = appointmentBookedEmail({
    patientName: appt.patient_name,
    doctorName: doctor.name,
    speciality: doctor.speciality,
    dateLabel: formatDisplayDate(date),
    timeLabel: `${formatDisplayTime(startTime)} - ${formatDisplayTime(slotEnd(startTime))}`,
    meetingUrl,
    bookedByName: Number(req.user.id) !== patientId ? req.user.name : null,
  });
  sendEmail({ to: appt.patient_email, ...mail });
  if (Number(req.user.id) !== patientId) sendEmail({ to: req.user.email, ...mail });
  logger.info(`Appointment ${row.id} booked: patient ${patientId} doctor ${doctorId} ${date} ${startTime} by ${req.user.id}`);
  created(res, { ...appointmentDto(appt), meetingUrl }, 'Appointment booked successfully. A confirmation email has been sent');
}

export async function listAppointments(req, res) {
  ok(res, (await patientModel.appointmentsForPatient(req.user.id)).map(appointmentDto));
}

export async function cancel(req, res) {
  const id = toId(req.params.id, 'appointment id');
  const appt = await common.getAppointmentById(id);
  if (!appt) throw AppError.notFound('Appointment not found');
  const uid = Number(req.user.id);
  if (Number(appt.patient_id) !== uid && Number(appt.booked_by) !== uid) throw AppError.forbidden('You cannot cancel this appointment');
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(appt.status)) throw AppError.badRequest(`A ${appt.status} appointment cannot be cancelled`);
  if (!isFutureSlot(appt.appointment_date, normaliseTime(appt.start_time))) throw AppError.badRequest('Only upcoming appointments can be cancelled');
  const done = await patientModel.cancelAppointment({ id, status: APPOINTMENT_STATUS.CANCELLED, cancelledBy: uid, allowedStatuses: ACTIVE_APPOINTMENT_STATUSES });
  if (!done) throw AppError.conflict('Appointment could not be cancelled');
  sendEmail({
    to: appt.patient_email,
    ...appointmentCancelledEmail({ patientName: appt.patient_name, doctorName: appt.doctor_name, dateLabel: formatDisplayDate(appt.appointment_date), timeLabel: formatDisplayTime(appt.start_time) }),
  });
  logger.info(`Appointment ${id} cancelled by ${uid}`);
  ok(res, appointmentDto(await common.getAppointmentById(id)), 'Appointment cancelled');
}

// ------------------------------------------------------------------ family
export async function getFamily(req, res) {
  const me = await common.getPatientProfile(req.user.id);
  if (!me) throw AppError.notFound('Patient profile not found');
  const received = await patientModel.receivedOpenInvitations(req.user.id);
  let family = null; let memberList = []; let sent = [];
  if (me.family_id) {
    const f = await patientModel.getFamily(me.family_id);
    family = { id: Number(f.id), name: f.name, createdBy: Number(f.created_by), createdByName: f.created_by_name, createdAt: f.created_at };
    memberList = (await patientModel.familyMembers(me.family_id)).map(patientDto);
    sent = (await patientModel.sentInvitations(me.family_id)).map((i) => ({
      id: Number(i.id), status: i.status, isOpen: i.is_open, inviteeName: i.invitee_name, inviteeEmail: i.invitee_email,
      inviterName: i.inviter_name, createdAt: i.created_at, respondedAt: i.responded_at,
    }));
  }
  ok(res, {
    family,
    members: memberList,
    sentInvitations: sent,
    receivedInvitations: received.map((i) => ({
      id: Number(i.id), familyId: Number(i.family_id), familyName: i.family_name, inviterName: i.inviter_name, inviterEmail: i.inviter_email, createdAt: i.created_at,
    })),
  });
}

export async function createFamily(req, res) {
  requireFields(req.body, ['name']);
  const name = cleanString(req.body.name, 120);
  if (name.length < 2) throw AppError.badRequest('Family name must be at least 2 characters');
  const me = await common.getPatientProfile(req.user.id);
  if (me.family_id) throw AppError.conflict('You are already part of a family');
  const fam = await withTransaction(async (client) => {
    const f = await patientModel.createFamily(client, name, req.user.id);
    await patientModel.setPatientFamily(client, req.user.id, f.id);
    return f;
  });
  logger.info(`Family ${fam.id} created by ${req.user.id}`);
  created(res, { id: Number(fam.id), name: fam.name }, `Family "${name}" created`);
}

export async function invite(req, res) {
  requireFields(req.body, ['email']);
  const email = cleanEmail(req.body.email);
  assertEmail(email);
  const me = await common.getPatientProfile(req.user.id);
  if (!me.family_id) throw AppError.badRequest('Create a family before inviting members');
  const invitee = await patientModel.findPatientByEmail(email);
  if (!invitee) throw AppError.notFound('No registered patient exists with this email');
  if (Number(invitee.id) === Number(req.user.id)) throw AppError.badRequest('You cannot invite yourself');
  if (invitee.is_disabled) throw AppError.badRequest('This patient account is disabled');
  if (invitee.family_id && Number(invitee.family_id) === Number(me.family_id)) throw AppError.conflict('This patient is already a member of your family');
  if (invitee.family_id) throw AppError.conflict('This patient is already part of another family');
  const inv = await patientModel.insertInvitation({ familyId: me.family_id, inviterId: req.user.id, inviteeId: invitee.id, status: INVITATION_STATUS.PENDING });
  const family = await patientModel.getFamily(me.family_id);
  sendEmail({ to: invitee.email, ...familyInvitationEmail({ inviteeName: invitee.name, inviterName: req.user.name, familyName: family.name, appUrl: `${env.frontendUrl}/patient/family` }) });
  logger.info(`Invitation ${inv.id} sent by ${req.user.id} to ${email}`);
  created(res, { id: Number(inv.id) }, `Invitation sent to ${invitee.name}`);
}

export async function respond(req, res) {
  const id = toId(req.params.id, 'invitation id');
  const { action } = req.body || {};
  if (!['accept', 'reject'].includes(action)) throw AppError.badRequest('Action must be accept or reject');
  const inv = await patientModel.getInvitation(id);
  if (!inv || Number(inv.invitee_id) !== Number(req.user.id)) throw AppError.notFound('Invitation not found');
  if (!inv.is_open) throw AppError.badRequest('This invitation is no longer open');
  const accepted = action === 'accept';
  await withTransaction(async (client) => {
    if (accepted) {
      const me = await common.getPatientProfile(req.user.id, client);
      if (me.family_id) throw AppError.conflict('Leave your current family before joining another one');
      const closed = await patientModel.closeInvitation(client, id, INVITATION_STATUS.ACCEPTED);
      if (!closed) throw AppError.badRequest('This invitation is no longer open');
      await patientModel.setPatientFamily(client, req.user.id, inv.family_id);
      await patientModel.closeOtherInvitations(client, req.user.id, INVITATION_STATUS.CANCELLED, id);
    } else {
      const closed = await patientModel.closeInvitation(client, id, INVITATION_STATUS.REJECTED);
      if (!closed) throw AppError.badRequest('This invitation is no longer open');
    }
  });
  sendEmail({ to: inv.inviter_email, ...familyResponseEmail({ inviterName: inv.inviter_name, inviteeName: inv.invitee_name, familyName: inv.family_name, accepted }) });
  logger.info(`Invitation ${id} ${accepted ? 'accepted' : 'rejected'} by ${req.user.id}`);
  ok(res, null, accepted ? `You joined the family "${inv.family_name}"` : 'Invitation rejected');
}

export async function cancelInvitation(req, res) {
  const id = toId(req.params.id, 'invitation id');
  const inv = await patientModel.getInvitation(id);
  const me = await common.getPatientProfile(req.user.id);
  if (!inv || !me.family_id || Number(inv.family_id) !== Number(me.family_id)) throw AppError.notFound('Invitation not found');
  const closed = await patientModel.closeInvitation(null, id, INVITATION_STATUS.CANCELLED);
  if (!closed) throw AppError.badRequest('This invitation is no longer open');
  ok(res, null, 'Invitation withdrawn');
}

export async function leaveFamily(req, res) {
  const me = await common.getPatientProfile(req.user.id);
  if (!me.family_id) throw AppError.badRequest('You are not part of any family');
  await withTransaction(async (client) => {
    await patientModel.clearPatientFamily(client, req.user.id);
    if ((await patientModel.familyMemberCount(client, me.family_id)) === 0) await patientModel.deleteFamily(client, me.family_id);
  });
  logger.info(`Patient ${req.user.id} left family ${me.family_id}`);
  ok(res, null, 'You left the family');
}
