import { query, queryOne, withTransaction } from '../config/db.js';
import {
  DELETE_DOCTOR_AVAILABILITY,
  INSERT_DOCTOR,
  INSERT_DOCTOR_AVAILABILITY,
  SELECT_DOCTORS_WITH_AVAILABILITY,
  SELECT_ENABLED_DOCTORS,
  SELECT_ENABLED_PATIENTS,
  SELECT_UPCOMING_APPOINTMENT_FOR_PAIR,
  UPDATE_APPOINTMENT_SCHEDULE,
  UPDATE_DOCTOR,
} from '../scripts/admin.sql.js';
import {
  COUNT_USERS_BY_EMAIL,
  INSERT_USER,
  SELECT_DOCTOR_PROFILE_BY_ID,
  UPDATE_USER_DISABLED,
  UPDATE_USER_NAME,
  UPDATE_USER_PASSWORD,
} from '../scripts/common.sql.js';
import { SELECT_APPOINTMENT_BY_ID } from '../scripts/appointment.sql.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { assertStrongPassword, hashPassword } from '../utils/password.js';
import { TIME_FORMAT, endOfSlot, isAlignedSlot, timeToMinutes, windowsOverlap } from '../utils/slots.js';
import { toDoctorListItem, toDoctorOption } from '../models/doctorModel.js';
import { toAppointment } from '../models/appointmentModel.js';
import { ROLES } from '../middleware/auth.js';
import { assertSlotFree, ACTIVE_STATUSES } from './slotService.js';
import { appointmentRescheduledEmail, doctorAccountEmail, sendMail } from '../utils/mailer.js';
import { buildJoinUrl, buildMeetingUrl } from '../utils/jitsi.js';
import { env } from '../config/env.js';
import { nowTime, todayISO } from '../utils/dates.js';

const ROLE_DOCTOR = ROLES.DOCTOR;
const ROLE_PATIENT = ROLES.PATIENT;
const NOT_DISABLED = false;
const EMPTY_JSON_ARRAY = '[]';
const ONE = 1;
const STATUS_RESCHEDULED = 'RESCHEDULED';

/* ------------------------------------------------------------- validation */

export const validateAvailability = (availability) => {
  if (!Array.isArray(availability) || availability.length === 0) {
    throw badRequest('A doctor must have at least one time slot in a week');
  }
  const perDay = new Map();
  availability.forEach((entry) => {
    const weekday = Number(entry.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw badRequest('Weekday must be between 0 (Sunday) and 6 (Saturday)');
    }
    if (!isAlignedSlot(entry.startTime) || !isAlignedSlot(entry.endTime)) {
      throw badRequest('Availability times must be 30 minute aligned values like 09:00 or 09:30');
    }
    if (timeToMinutes(entry.endTime) <= timeToMinutes(entry.startTime)) {
      throw badRequest('Availability end time must be later than its start time');
    }
    const bucket = perDay.get(weekday) || [];
    bucket.forEach((existing) => {
      if (windowsOverlap(existing, entry)) {
        throw badRequest(
          `Time slots conflict on weekday ${weekday}: ${existing.startTime}-${existing.endTime} overlaps ${entry.startTime}-${entry.endTime}`,
        );
      }
    });
    bucket.push(entry);
    perDay.set(weekday, bucket);
  });
  console.log(`[admin] availability validated, ${availability.length} window(s)`);
  return availability.map((entry) => ({
    weekday: Number(entry.weekday),
    startTime: entry.startTime,
    endTime: entry.endTime,
  }));
};

/* ------------------------------------------------------------ doctor crud */

export const createDoctor = async ({ name, email, password, confirmPassword, sex, speciality, availability }) => {
  assertStrongPassword(password, confirmPassword);
  const windows = validateAvailability(availability);

  const existing = await queryOne(COUNT_USERS_BY_EMAIL, [email]);
  if (Number(existing.total) > 0) throw badRequest('This email address is already used by another user');

  const passwordHash = await hashPassword(password);
  const doctor = await withTransaction(async (client) => {
    const userResult = await client.query(INSERT_USER, [name, email, passwordHash, ROLE_DOCTOR, NOT_DISABLED]);
    const user = userResult.rows[0];
    await client.query(INSERT_DOCTOR, [user.id, sex, speciality]);
    for (const window of windows) {
      await client.query(INSERT_DOCTOR_AVAILABILITY, [user.id, window.weekday, window.startTime, window.endTime]);
    }
    return user;
  });

  await sendMail({
    to: email,
    subject: `${env.org.name} - your doctor account is ready`,
    html: doctorAccountEmail({ doctorName: name, email, appUrl: env.frontendUrl }),
  });

  console.log(`[admin] doctor created: ${email}`);
  return { id: Number(doctor.id), name: doctor.name, email: doctor.email };
};

export const updateDoctor = async ({ doctorId, name, password, confirmPassword, sex, speciality, availability }) => {
  const existing = await queryOne(SELECT_DOCTOR_PROFILE_BY_ID, [doctorId]);
  if (!existing) throw notFound('Doctor not found');
  const windows = validateAvailability(availability);

  // Password is optional while editing.
  let passwordHash = null;
  if (password || confirmPassword) {
    assertStrongPassword(password, confirmPassword);
    passwordHash = await hashPassword(password);
  }

  await withTransaction(async (client) => {
    await client.query(UPDATE_USER_NAME, [doctorId, name]);
    if (passwordHash) await client.query(UPDATE_USER_PASSWORD, [doctorId, passwordHash]);
    await client.query(UPDATE_DOCTOR, [doctorId, sex, speciality]);
    await client.query(DELETE_DOCTOR_AVAILABILITY, [doctorId]);
    for (const window of windows) {
      await client.query(INSERT_DOCTOR_AVAILABILITY, [doctorId, window.weekday, window.startTime, window.endTime]);
    }
  });

  console.log(`[admin] doctor ${doctorId} updated`);
  return { id: Number(doctorId) };
};

export const listDoctors = async ({ search }) => {
  const pattern = search ? `%${String(search).trim()}%` : null;
  const result = await query(SELECT_DOCTORS_WITH_AVAILABILITY, [TIME_FORMAT, EMPTY_JSON_ARRAY, ROLE_DOCTOR, pattern]);
  return result.rows.map(toDoctorListItem);
};

export const getDoctor = async (doctorId) => {
  const doctors = await listDoctors({ search: null });
  const doctor = doctors.find((item) => item.id === Number(doctorId));
  if (!doctor) throw notFound('Doctor not found');
  return doctor;
};

export const setDoctorDisabled = async ({ doctorId, disabled }) => {
  const row = await queryOne(UPDATE_USER_DISABLED, [doctorId, Boolean(disabled), ROLE_DOCTOR]);
  if (!row) throw notFound('Doctor not found');
  console.log(`[admin] doctor ${doctorId} disabled=${row.is_disabled}`);
  return { id: Number(row.id), name: row.name, email: row.email, isDisabled: row.is_disabled };
};

/* ------------------------------------------------------------- selectors */

export const listDoctorOptions = async () => {
  const result = await query(SELECT_ENABLED_DOCTORS, [ROLE_DOCTOR, NOT_DISABLED]);
  return result.rows.map(toDoctorOption);
};

export const listPatientOptions = async () => {
  const result = await query(SELECT_ENABLED_PATIENTS, [ROLE_PATIENT, NOT_DISABLED]);
  return result.rows.map((row) => ({ id: Number(row.id), name: row.name, email: row.email }));
};

/* ----------------------------------------------------------- rescheduling */

export const findUpcomingAppointment = async ({ doctorId, patientId }) => {
  const row = await queryOne(SELECT_UPCOMING_APPOINTMENT_FOR_PAIR, [
    TIME_FORMAT,
    doctorId,
    patientId,
    ACTIVE_STATUSES,
    todayISO(),
    nowTime(),
    ONE,
  ]);
  if (!row) {
    console.log(`[admin] no upcoming appointment for doctor=${doctorId} patient=${patientId}`);
    return null;
  }
  return toAppointment(row);
};

export const rescheduleAppointment = async ({ appointmentId, date, startTime }) => {
  const current = await queryOne(SELECT_APPOINTMENT_BY_ID, [TIME_FORMAT, appointmentId]);
  if (!current) throw notFound('Appointment not found');
  if (!ACTIVE_STATUSES.includes(current.status)) {
    throw badRequest('Only upcoming appointments can be rescheduled');
  }

  await assertSlotFree({
    doctorId: current.doctor_id,
    patientId: current.patient_id,
    date,
    startTime,
    ignoreAppointmentId: appointmentId,
  });

  const updated = await queryOne(UPDATE_APPOINTMENT_SCHEDULE, [
    appointmentId,
    date,
    startTime,
    endOfSlot(startTime),
    STATUS_RESCHEDULED,
  ]);

  await sendMail({
    to: current.patient_email,
    subject: `${env.org.name} - your appointment has been rescheduled`,
    html: appointmentRescheduledEmail({
      patientName: current.patient_name,
      doctorName: current.doctor_name,
      date,
      startTime,
      endTime: endOfSlot(startTime),
      joinUrl: buildJoinUrl(appointmentId),
      meetingUrl: buildMeetingUrl(current.room_id),
    }),
  });

  console.log(`[admin] appointment ${appointmentId} rescheduled to ${date} ${startTime}`);
  return { id: Number(updated.id), date, startTime, endTime: endOfSlot(startTime), status: updated.status };
};
