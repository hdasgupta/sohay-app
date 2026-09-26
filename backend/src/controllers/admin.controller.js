/** Admin: doctors, patients, reschedule */
import env from "../config/env.js";
import { withTransaction } from "../config/db.js";
import AppError from "../utils/AppError.js";
import { ok, created } from "../utils/response.js";
import logger from "../utils/logger.js";
import { hashPassword } from "../utils/password.js";
import { validateAvailability } from "../utils/slots.js";
import {
  requireFields,
  cleanEmail,
  cleanString,
  assertEmail,
  assertPassword,
  assertSex,
  toId,
} from "../utils/validators.js";
import { doctorDto, patientDto, appointmentDto } from "../utils/serializers.js";
import {
  ROLES,
  APPOINTMENT_STATUS,
  ACTIVE_APPOINTMENT_STATUSES,
} from "../config/constants.js";
import {
  nowInKolkata,
  isValidIsoDate,
  formatDisplayDate,
  formatDisplayTime,
  normaliseTime,
  isFutureSlot,
} from "../utils/date.js";
import {
  availableSlots,
  assertSlotBookable,
  slotEnd,
  getDoctorForBooking,
} from "../services/slot.service.js";
import { sendEmail } from "../services/email.service.js";
import { appointmentRescheduledEmail } from "../templates/emailTemplates.js";
import { dataUrlToBuffer } from "../services/pdf.service.js";
import * as common from "../models/common.model.js";
import * as adminModel from "../models/admin.model.js";

const MAX_SIGNATURE_LENGTH = 700 * 1024;

function readSignature(signature) {
  if (signature === undefined || signature === null || signature === "")
    return null;
  if (
    typeof signature !== "string" ||
    signature.length > MAX_SIGNATURE_LENGTH ||
    !dataUrlToBuffer(signature)
  ) {
    throw AppError.badRequest(
      "Signature must be a PNG or JPEG image smaller than 500 KB",
    );
  }
  return signature;
}

function readDoctorBody(body, { requirePassword }) {
  requireFields(body, ["name", "sex", "speciality", "email"]);
  const name = cleanString(body.name, 120);
  const email = cleanEmail(body.email);
  const speciality = cleanString(body.speciality, 120);
  if (name.length < 2)
    throw AppError.badRequest("Doctor name must be at least 2 characters");
  if (speciality.length < 2)
    throw AppError.badRequest("Speciality is required");
  assertEmail(email);
  assertSex(body.sex);
  const hasPassword = Boolean(body.password || body.confirmPassword);
  if (requirePassword || hasPassword)
    assertPassword(body.password || "", body.confirmPassword || "");
  const availability = validateAvailability(body.availability);
  return {
    name,
    email,
    speciality,
    sex: body.sex,
    password: hasPassword ? body.password : null,
    availability,
    signature: readSignature(body.signature),
  };
}

async function loadDoctor(id) {
  const d = await common.getDoctorProfile(id);
  if (!d) throw AppError.notFound("Doctor not found");
  const map = await common.availabilityForDoctors([Number(d.id)]);
  return { ...doctorDto(d, map.get(Number(d.id))), signature: d.signature };
}

export async function createDoctor(req, res) {
  const data = readDoctorBody(req.body, { requirePassword: true });
  if (await common.findUserByEmail(data.email))
    throw AppError.conflict("This email address is already registered");
  const passwordHash = await hashPassword(data.password);
  const id = await withTransaction(async (client) => {
    const u = await common.insertUser(
      { name: data.name, email: data.email, passwordHash, role: ROLES.DOCTOR },
      client,
    );
    await adminModel.insertDoctor(client, {
      userId: u.id,
      sex: data.sex,
      speciality: data.speciality,
      signature: data.signature,
    });
    await adminModel.replaceAvailability(client, u.id, data.availability);
    return u.id;
  });
  logger.info(`Doctor created by admin ${req.user.id}: ${data.email}`);
  created(res, await loadDoctor(id), `Doctor ${data.name} added successfully`);
}

export async function updateDoctor(req, res) {
  const id = toId(req.params.id, "doctor id");
  const existing = await common.getDoctorProfile(id);
  if (!existing) throw AppError.notFound("Doctor not found");
  const data = readDoctorBody(req.body, { requirePassword: false });
  const clash = await common.findUserByEmail(data.email);
  if (clash && Number(clash.id) !== id)
    throw AppError.conflict("This email address is already registered");
  const passwordHash = data.password ? await hashPassword(data.password) : null;
  await withTransaction(async (client) => {
    await adminModel.updateUserNameEmail(client, {
      userId: id,
      name: data.name,
      email: data.email,
    });
    await adminModel.updateDoctor(client, {
      userId: id,
      sex: data.sex,
      speciality: data.speciality,
      signature: data.signature,
    });
    if (passwordHash)
      await adminModel.updateUserPassword(client, id, passwordHash);
    await adminModel.replaceAvailability(client, id, data.availability);
  });
  logger.info(`Doctor ${id} updated by admin ${req.user.id}`);
  ok(res, await loadDoctor(id), `Doctor ${data.name} updated successfully`);
}

export async function listDoctors(_req, res) {
  const rows = await adminModel.listDoctors();
  const map = await common.availabilityForDoctors(
    rows.map((r) => Number(r.id)),
  );
  ok(
    res,
    rows.map((r) => doctorDto(r, map.get(Number(r.id)))),
  );
}

export async function getDoctor(req, res) {
  ok(res, await loadDoctor(toId(req.params.id, "doctor id")));
}

export async function setDoctorStatus(req, res) {
  const id = toId(req.params.id, "doctor id");
  if (typeof req.body.disabled !== "boolean")
    throw AppError.badRequest("disabled must be true or false");
  const row = await adminModel.setUserDisabled(
    id,
    req.body.disabled,
    ROLES.DOCTOR,
  );
  if (!row) throw AppError.notFound("Doctor not found");
  logger.info(
    `Doctor ${id} ${row.is_disabled ? "disabled" : "enabled"} by admin ${req.user.id}`,
  );
  ok(
    res,
    { id: Number(row.id), isDisabled: row.is_disabled },
    `Doctor ${row.name} ${row.is_disabled ? "disabled" : "enabled"}`,
  );
}

export async function listPatients(_req, res) {
  ok(res, (await adminModel.listPatients()).map(patientDto));
}

export async function upcomingAppointments(req, res) {
  const patientId = toId(req.query.patientId, "patient id");
  const doctorId = toId(req.query.doctorId, "doctor id");
  const now = nowInKolkata();
  const rows = await adminModel.upcomingForPatientDoctor(
    patientId,
    doctorId,
    ACTIVE_APPOINTMENT_STATUSES,
    now.date,
    now.time,
  );
  ok(res, rows.map(appointmentDto));
}

export async function slotsForReschedule(req, res) {
  const appointmentId = toId(req.query.appointmentId, "appointment id");
  const { date } = req.query;
  if (!isValidIsoDate(date)) throw AppError.badRequest("Invalid date");
  const appt = await common.getAppointmentById(appointmentId);
  if (!appt) throw AppError.notFound("Appointment not found");
  const slots = await availableSlots({
    doctorId: appt.doctor_id,
    date,
    patientId: appt.patient_id,
    excludeAppointmentId: appointmentId,
  });
  ok(res, slots);
}

export async function reschedule(req, res) {
  const id = toId(req.params.id, "appointment id");
  requireFields(req.body, ["date", "startTime"]);
  const { date } = req.body;
  const startTime = normaliseTime(req.body.startTime);
  const appt = await common.getAppointmentById(id);
  if (!appt) throw AppError.notFound("Appointment not found");
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(appt.status))
    throw AppError.badRequest(
      `A ${appt.status} appointment cannot be rescheduled`,
    );
  if (!isFutureSlot(appt.appointment_date, normaliseTime(appt.start_time)))
    throw AppError.badRequest("Only upcoming appointments can be rescheduled");
  if (
    appt.appointment_date === date &&
    normaliseTime(appt.start_time) === startTime
  )
    throw AppError.badRequest("Please choose a different date or time slot");
  await getDoctorForBooking(appt.doctor_id);
  await assertSlotBookable({
    doctorId: appt.doctor_id,
    patientId: appt.patient_id,
    date,
    startTime,
    excludeAppointmentId: id,
  });
  const done = await withTransaction((client) =>
    adminModel.rescheduleAppointment(client, {
      id,
      date,
      startTime,
      endTime: slotEnd(startTime),
      status: APPOINTMENT_STATUS.RESCHEDULED,
      allowedStatuses: ACTIVE_APPOINTMENT_STATUSES,
    }),
  );
  if (!done)
    throw AppError.conflict(
      "Appointment could not be rescheduled (status changed)",
    );
  const updated = await common.getAppointmentById(id);
  const mail = appointmentRescheduledEmail({
    patientName: updated.patient_name,
    doctorName: updated.doctor_name,
    oldLabel: `${formatDisplayDate(appt.appointment_date)} ${formatDisplayTime(appt.start_time)}`,
    newDateLabel: formatDisplayDate(date),
    newTimeLabel: `${formatDisplayTime(startTime)} - ${formatDisplayTime(slotEnd(startTime))}`,
    meetingUrl: `${env.frontendUrl}/meeting/${id}`,
  });
  sendEmail({ to: updated.patient_email, ...mail });
  logger.info(
    `Appointment ${id} rescheduled to ${date} ${startTime} by admin ${req.user.id}`,
  );
  ok(res, appointmentDto(updated), "Appointment rescheduled successfully");
}
