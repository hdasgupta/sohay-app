import { query, queryOne, withTransaction } from '../config/db.js';
import {
  COUNT_PENDING_INVITATION,
  INSERT_APPOINTMENT,
  INSERT_FAMILY,
  INSERT_FAMILY_INVITATION,
  SELECT_APPOINTMENTS_FOR_PATIENT,
  SELECT_BOOKABLE_PATIENT_IDS,
  SELECT_FAMILY_BY_ID,
  SELECT_FAMILY_MEMBERS,
  SELECT_INVITABLE_PATIENTS,
  SELECT_INVITATIONS_FOR_INVITEE,
  SELECT_INVITATIONS_SENT_BY_FAMILY,
  SELECT_INVITATION_FOR_RESPONSE,
  UPDATE_INVITATION_STATUS,
  UPDATE_PATIENT_FAMILY,
} from '../scripts/patient.sql.js';
import { SELECT_APPOINTMENT_BY_ID, UPDATE_APPOINTMENT_STATUS } from '../scripts/appointment.sql.js';
import { SELECT_PATIENT_PROFILE_BY_ID } from '../scripts/common.sql.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { TIME_FORMAT, endOfSlot } from '../utils/slots.js';
import { toAppointment } from '../models/appointmentModel.js';
import { toFamilyMember, toInvitation } from '../models/familyModel.js';
import { ACTIVE_STATUSES, assertSlotFree } from './slotService.js';
import { buildJoinUrl, buildMeetingUrl, buildRoomId } from '../utils/jitsi.js';
import {
  appointmentBookedEmail,
  appointmentCancelledEmail,
  familyInviteEmail,
  familyInviteResponseEmail,
  sendMail,
} from '../utils/mailer.js';
import { env } from '../config/env.js';
import { nowTime, prettyDate, todayISO } from '../utils/dates.js';

const NOT_DISABLED = false;
const STATUS_PENDING = 'PENDING';
const STATUS_ACCEPTED = 'ACCEPTED';
const STATUS_REJECTED = 'REJECTED';
const STATUS_SCHEDULED = 'SCHEDULED';
const STATUS_CANCELLED = 'CANCELLED';
const INVITE_SEARCH_LIMIT = 25;

const loadPatient = async (patientId) => {
  const row = await queryOne(SELECT_PATIENT_PROFILE_BY_ID, [patientId]);
  if (!row) throw notFound('Patient profile not found');
  return row;
};

/* -------------------------------------------------------------- family */

export const getFamilyOverview = async (patientId) => {
  const patient = await loadPatient(patientId);
  const pendingResult = await query(SELECT_INVITATIONS_FOR_INVITEE, [patientId, STATUS_PENDING]);
  const pendingInvitations = pendingResult.rows.map(toInvitation);

  if (!patient.family_id) {
    return { family: null, members: [], sentInvitations: [], pendingInvitations };
  }

  const family = await queryOne(SELECT_FAMILY_BY_ID, [patient.family_id]);
  const members = await query(SELECT_FAMILY_MEMBERS, [patient.family_id, NOT_DISABLED]);
  const sent = await query(SELECT_INVITATIONS_SENT_BY_FAMILY, [patient.family_id]);

  return {
    family: {
      id: Number(family.id),
      name: family.name,
      ownerName: family.owner_name,
      isOwner: Number(family.created_by) === Number(patientId),
    },
    members: members.rows.map(toFamilyMember),
    sentInvitations: sent.rows.map(toInvitation),
    pendingInvitations,
  };
};

export const createFamily = async ({ patientId, name }) => {
  const patient = await loadPatient(patientId);
  if (patient.family_id) throw badRequest('You are already part of a family');

  const family = await withTransaction(async (client) => {
    const result = await client.query(INSERT_FAMILY, [name, patientId]);
    const created = result.rows[0];
    await client.query(UPDATE_PATIENT_FAMILY, [patientId, created.id]);
    return created;
  });

  console.log(`[patient] family "${name}" created by ${patientId}`);
  return { id: Number(family.id), name: family.name };
};

export const searchInvitablePatients = async ({ patientId, search }) => {
  const pattern = search ? `%${String(search).trim()}%` : null;
  const result = await query(SELECT_INVITABLE_PATIENTS, [NOT_DISABLED, patientId, pattern, INVITE_SEARCH_LIMIT]);
  return result.rows.map((row) => ({ id: Number(row.id), name: row.name, email: row.email }));
};

export const invitePatient = async ({ patientId, inviteeId }) => {
  const patient = await loadPatient(patientId);
  if (!patient.family_id) throw badRequest('Create a family first, then invite members');
  if (Number(inviteeId) === Number(patientId)) throw badRequest('You cannot invite yourself');

  const invitee = await queryOne(SELECT_PATIENT_PROFILE_BY_ID, [inviteeId]);
  if (!invitee) throw notFound('The selected patient does not exist');
  if (invitee.family_id) throw badRequest('That patient already belongs to a family');

  const pending = await queryOne(COUNT_PENDING_INVITATION, [patient.family_id, inviteeId, STATUS_PENDING]);
  if (Number(pending.total) > 0) throw badRequest('An invitation is already pending for that patient');

  const family = await queryOne(SELECT_FAMILY_BY_ID, [patient.family_id]);
  await queryOne(INSERT_FAMILY_INVITATION, [patient.family_id, patientId, inviteeId, STATUS_PENDING]);

  await sendMail({
    to: invitee.email,
    subject: `${env.org.name} - family invitation from ${patient.name}`,
    html: familyInviteEmail({
      inviteeName: invitee.name,
      inviterName: patient.name,
      familyName: family.name,
      appUrl: `${env.frontendUrl}/patient/manage-family`,
    }),
  });

  console.log(`[patient] invitation sent ${patientId} -> ${inviteeId}`);
  return true;
};

export const respondToInvitation = async ({ patientId, invitationId, accept }) => {
  const invitation = await queryOne(SELECT_INVITATION_FOR_RESPONSE, [invitationId, patientId]);
  if (!invitation) throw notFound('Invitation not found');
  if (invitation.status !== STATUS_PENDING) throw badRequest('This invitation has already been answered');

  const nextStatus = accept ? STATUS_ACCEPTED : STATUS_REJECTED;
  await withTransaction(async (client) => {
    await client.query(UPDATE_INVITATION_STATUS, [invitationId, nextStatus, STATUS_PENDING]);
    if (accept) await client.query(UPDATE_PATIENT_FAMILY, [patientId, invitation.family_id]);
  });

  await sendMail({
    to: invitation.inviter_email,
    subject: `${env.org.name} - family invitation ${accept ? 'accepted' : 'rejected'}`,
    html: familyInviteResponseEmail({
      inviterName: invitation.inviter_name,
      inviteeName: invitation.invitee_name,
      familyName: invitation.family_name,
      accepted: Boolean(accept),
    }),
  });

  console.log(`[patient] invitation ${invitationId} ${nextStatus}`);
  return { status: nextStatus };
};

/* --------------------------------------------------------- appointments */

export const listBookablePatients = async (patientId) => {
  const patient = await loadPatient(patientId);
  const result = await query(SELECT_BOOKABLE_PATIENT_IDS, [NOT_DISABLED, patientId, patient.family_id]);
  return result.rows.map((row) => ({
    id: Number(row.id),
    name: Number(row.id) === Number(patientId) ? `${row.name} (myself)` : row.name,
  }));
};

export const bookAppointment = async ({ bookedById, forPatientId, doctorId, date, startTime }) => {
  const allowed = await listBookablePatients(bookedById);
  const target = allowed.find((item) => item.id === Number(forPatientId));
  if (!target) throw forbidden('You can only book for yourself or your family members');

  if (date < todayISO() || (date === todayISO() && startTime <= nowTime())) {
    throw badRequest('Appointments can only be booked for a future time slot');
  }

  await assertSlotFree({ doctorId, patientId: forPatientId, date, startTime });

  const roomId = buildRoomId();
  const created = await queryOne(INSERT_APPOINTMENT, [
    doctorId,
    bookedById,
    forPatientId,
    date,
    startTime,
    endOfSlot(startTime),
    STATUS_SCHEDULED,
    roomId,
  ]);

  const detail = await queryOne(SELECT_APPOINTMENT_BY_ID, [TIME_FORMAT, created.id]);
  const joinUrl = buildJoinUrl(created.id);
  const meetingUrl = buildMeetingUrl(roomId);

  await sendMail({
    to: detail.patient_email,
    subject: `${env.org.name} - appointment confirmed with Dr. ${detail.doctor_name}`,
    html: appointmentBookedEmail({
      patientName: detail.patient_name,
      doctorName: detail.doctor_name,
      speciality: detail.speciality,
      date: prettyDate(date),
      startTime,
      endTime: endOfSlot(startTime),
      joinUrl,
      meetingUrl,
      bookedByName: target.name,
    }),
  });

  console.log(`[patient] appointment ${created.id} booked (room ${roomId})`);
  return { id: Number(created.id), roomId, joinUrl, date, startTime, endTime: endOfSlot(startTime) };
};

export const listAppointmentsForPatient = async (patientId) => {
  const result = await query(SELECT_APPOINTMENTS_FOR_PATIENT, [TIME_FORMAT, patientId]);
  return result.rows.map(toAppointment);
};

export const cancelAppointment = async ({ patientId, appointmentId }) => {
  const appointment = await queryOne(SELECT_APPOINTMENT_BY_ID, [TIME_FORMAT, appointmentId]);
  if (!appointment) throw notFound('Appointment not found');
  const owns =
    Number(appointment.patient_id) === Number(patientId) || Number(appointment.booked_by_id) === Number(patientId);
  if (!owns) throw forbidden('You can only cancel your own appointments');

  const updated = await queryOne(UPDATE_APPOINTMENT_STATUS, [appointmentId, STATUS_CANCELLED, ACTIVE_STATUSES]);
  if (!updated) throw badRequest('Only upcoming appointments can be cancelled');

  await sendMail({
    to: appointment.patient_email,
    subject: `${env.org.name} - appointment cancelled`,
    html: appointmentCancelledEmail({
      patientName: appointment.patient_name,
      doctorName: appointment.doctor_name,
      date: prettyDate(String(appointment.appointment_date).slice(0, 10)),
      startTime: appointment.start_time,
    }),
  });

  console.log(`[patient] appointment ${appointmentId} cancelled by ${patientId}`);
  return { id: Number(appointmentId), status: STATUS_CANCELLED };
};
