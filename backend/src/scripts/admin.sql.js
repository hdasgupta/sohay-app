/** SQL used by admin controllers. */
import { APPOINTMENT_SELECT_BASE } from "./common.sql.js";

export const ADMIN_SQL = Object.freeze({
  ADMIN_INSERT: `
    INSERT INTO admins (user_id) VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING`,

  // ---------- doctors ----------
  DOCTOR_INSERT: `
    INSERT INTO doctors (user_id, sex, speciality, signature)
    VALUES ($1, $2, $3, $4)`,
  DOCTOR_UPDATE: `
    UPDATE doctors
       SET sex = $2, speciality = $3, signature = COALESCE($4, signature)
     WHERE user_id = $1`,
  USER_UPDATE_NAME_EMAIL: `
    UPDATE users
       SET name = $2, email = lower($3), updated_at = now()
     WHERE id = $1`,
  USER_UPDATE_PASSWORD_BY_ID: `
    UPDATE users
       SET password_hash = $2, updated_at = now()
     WHERE id = $1`,
  USER_SET_DISABLED: `
    UPDATE users
       SET is_disabled = $2, updated_at = now()
     WHERE id = $1 AND role = $3
    RETURNING id, name, email, is_disabled`,
  AVAILABILITY_DELETE_FOR_DOCTOR: `
    DELETE FROM doctor_availability WHERE doctor_id = $1`,
  AVAILABILITY_INSERT_MANY: `
    INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time)
    SELECT $1, t.weekday, t.start_time, t.end_time
      FROM unnest($2::smallint[], $3::time[], $4::time[]) AS t(weekday, start_time, end_time)`,
  DOCTORS_LIST_ALL: `
    SELECT u.id, u.name, u.email, u.is_disabled, u.created_at, d.sex, d.speciality,
           (d.signature IS NOT NULL) AS has_signature
      FROM users u
      JOIN doctors d ON d.user_id = u.id
     ORDER BY u.name, u.id`,

  // ---------- patients ----------
  PATIENTS_LIST_ALL: `
    SELECT u.id, u.name, u.email, u.is_disabled, p.sex, p.date_of_birth, p.contact_number
      FROM users u
      JOIN patients p ON p.user_id = u.id
     ORDER BY u.name, u.id`,

  // ---------- reschedule ----------
  UPCOMING_FOR_PATIENT_DOCTOR: `${APPOINTMENT_SELECT_BASE}
     WHERE a.patient_id = $1
       AND a.doctor_id = $2
       AND a.status = ANY($3::varchar[])
       AND (a.appointment_date > $4::date OR (a.appointment_date = $4::date AND a.start_time > $5::time))
     ORDER BY a.appointment_date, a.start_time`,
  APPOINTMENT_RESCHEDULE: `
    UPDATE appointments
       SET appointment_date = $2::date, start_time = $3::time, end_time = $4::time,
           status = $5, reschedule_count = reschedule_count + $6, updated_at = now()
     WHERE id = $1 AND status = ANY($7::varchar[])
    RETURNING id`,
});
