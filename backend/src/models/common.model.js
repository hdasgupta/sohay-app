/** Data access shared by all user types */
import { query } from "../config/db.js";
import { COMMON_SQL } from "../scripts/common.sql.js";

const db = (client) => client || { query };

export const findUserByEmail = async (email, client) =>
  (await db(client).query(COMMON_SQL.USER_FIND_BY_EMAIL, [email])).rows[0] ||
  null;
export const findUserById = async (id, client) =>
  (await db(client).query(COMMON_SQL.USER_FIND_BY_ID, [id])).rows[0] || null;
export const insertUser = async ({ name, email, passwordHash, role }, client) =>
  (
    await db(client).query(COMMON_SQL.USER_INSERT, [
      name,
      email,
      passwordHash,
      role,
    ])
  ).rows[0];
export const updatePasswordByEmail = async (email, passwordHash, client) =>
  (
    await db(client).query(COMMON_SQL.USER_UPDATE_PASSWORD_BY_EMAIL, [
      email,
      passwordHash,
    ])
  ).rows[0] || null;
export const deleteUser = (id, client) =>
  db(client).query(COMMON_SQL.USER_DELETE_BY_ID, [id]);

export const getDoctorProfile = async (id, client) =>
  (await db(client).query(COMMON_SQL.DOCTOR_PROFILE_BY_ID, [id])).rows[0] ||
  null;
export const getPatientProfile = async (id, client) =>
  (await db(client).query(COMMON_SQL.PATIENT_PROFILE_BY_ID, [id])).rows[0] ||
  null;

/** Map<doctorId, [{weekday,startTime,endTime}]> */
export async function availabilityForDoctors(ids) {
  const map = new Map(ids.map((id) => [Number(id), []]));
  if (!ids.length) return map;
  const { rows } = await query(COMMON_SQL.AVAILABILITY_FOR_DOCTORS, [ids]);
  for (const r of rows) {
    map.get(Number(r.doctor_id))?.push({
      weekday: r.weekday,
      startTime: r.start_time.slice(0, 5),
      endTime: r.end_time.slice(0, 5),
    });
  }
  return map;
}

export const getAppointmentById = async (id, client) =>
  (await db(client).query(COMMON_SQL.APPOINTMENT_BY_ID, [id])).rows[0] || null;
export const getPrescriptionByAppointment = async (appointmentId) =>
  (await query(COMMON_SQL.PRESCRIPTION_BY_APPOINTMENT, [appointmentId]))
    .rows[0] || null;
