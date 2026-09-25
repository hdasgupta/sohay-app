/** SQL used by doctor controllers. */
import { APPOINTMENT_SELECT_BASE } from './common.sql.js';

export const DOCTOR_SQL = Object.freeze({
  APPOINTMENTS_FOR_DOCTOR: `${APPOINTMENT_SELECT_BASE}
     WHERE a.doctor_id = $1
     ORDER BY a.appointment_date DESC, a.start_time DESC, a.id DESC`,
  TODAY_OPEN_APPOINTMENTS: `
    SELECT a.id, a.patient_id, a.appointment_date, a.start_time, a.end_time, a.status,
           u.name AS patient_name, u.email AS patient_email, p.sex AS patient_sex, p.date_of_birth
      FROM appointments a
      JOIN users u ON u.id = a.patient_id
      JOIN patients p ON p.user_id = a.patient_id
     WHERE a.doctor_id = $1 AND a.appointment_date = $2::date AND a.status = ANY($3::varchar[])
     ORDER BY a.start_time`,
  APPOINTMENT_LOCK_FOR_DOCTOR: `
    SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.start_time, a.status
      FROM appointments a
     WHERE a.id = $1 AND a.doctor_id = $2
       FOR UPDATE`,
  APPOINTMENT_MARK_COMPLETED: `
    UPDATE appointments
       SET status = $2, updated_at = now()
     WHERE id = $1 AND doctor_id = $3 AND status = ANY($4::varchar[])
    RETURNING id`,
  MEDICINE_SEARCH: `
    SELECT id, name
      FROM medicines
     WHERE name ILIKE $1
     ORDER BY (name ILIKE $2) DESC, length(name), name
     LIMIT $3`,
  SIGNATURE_UPDATE: `
    UPDATE doctors SET signature = $2 WHERE user_id = $1`,
  PRESCRIPTION_INSERT: `
    INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, patient_name, patient_age, prescribed_on, notes)
    VALUES ($1, $2, $3, $4, $5, $6::date, $7)
    RETURNING id, created_at`,
  PRESCRIPTION_ITEMS_INSERT: `
    INSERT INTO prescription_items
           (prescription_id, position, medicine_name, dose, instructions, morning, afternoon, evening, night, sos, food_timing)
    SELECT $1, t.position, t.medicine_name, t.dose, t.instructions, t.morning, t.afternoon, t.evening, t.night, t.sos, t.food_timing
      FROM unnest($2::int[], $3::varchar[], $4::varchar[], $5::text[], $6::boolean[], $7::boolean[],
                  $8::boolean[], $9::boolean[], $10::boolean[], $11::varchar[])
           AS t(position, medicine_name, dose, instructions, morning, afternoon, evening, night, sos, food_timing)`,
  PRESCRIPTION_SET_PDF: `
    UPDATE prescriptions SET pdf_key = $2, pdf_url = $3 WHERE id = $1`,
});
