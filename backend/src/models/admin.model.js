/** Data access for admin features */
import { query } from '../config/db.js';
import { ADMIN_SQL } from '../scripts/admin.sql.js';

export const insertAdmin = (userId, client) => client.query(ADMIN_SQL.ADMIN_INSERT, [userId]);
export const insertDoctor = (client, { userId, sex, speciality, signature }) =>
  client.query(ADMIN_SQL.DOCTOR_INSERT, [userId, sex, speciality, signature]);
export const updateDoctor = (client, { userId, sex, speciality, signature }) =>
  client.query(ADMIN_SQL.DOCTOR_UPDATE, [userId, sex, speciality, signature]);
export const updateUserNameEmail = (client, { userId, name, email }) =>
  client.query(ADMIN_SQL.USER_UPDATE_NAME_EMAIL, [userId, name, email]);
export const updateUserPassword = (client, userId, hash) => client.query(ADMIN_SQL.USER_UPDATE_PASSWORD_BY_ID, [userId, hash]);

export async function replaceAvailability(client, doctorId, availability) {
  await client.query(ADMIN_SQL.AVAILABILITY_DELETE_FOR_DOCTOR, [doctorId]);
  await client.query(ADMIN_SQL.AVAILABILITY_INSERT_MANY, [
    doctorId,
    availability.map((a) => a.weekday),
    availability.map((a) => a.startTime),
    availability.map((a) => (a.endTime === '24:00' ? '24:00:00' : a.endTime)),
  ]);
}

export const listDoctors = async () => (await query(ADMIN_SQL.DOCTORS_LIST_ALL)).rows;
export const listPatients = async () => (await query(ADMIN_SQL.PATIENTS_LIST_ALL)).rows;
export const setUserDisabled = async (userId, disabled, role) =>
  (await query(ADMIN_SQL.USER_SET_DISABLED, [userId, disabled, role])).rows[0] || null;

export const upcomingForPatientDoctor = async (patientId, doctorId, statuses, today, nowTime) =>
  (await query(ADMIN_SQL.UPCOMING_FOR_PATIENT_DOCTOR, [patientId, doctorId, statuses, today, nowTime])).rows;
export const rescheduleAppointment = async (client, { id, date, startTime, endTime, status, allowedStatuses }) =>
  (await client.query(ADMIN_SQL.APPOINTMENT_RESCHEDULE, [id, date, startTime, endTime, status, 1, allowedStatuses])).rows[0] || null;
