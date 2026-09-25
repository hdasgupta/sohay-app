/**
 * SQL used by every kind of user (authentication, OTP, captcha, slots, meetings, downloads).
 * Every value is a bind parameter - no string / number literals inside WHERE clauses.
 */

/** Base projection for appointment cards - composed (not duplicated) by the per-role files. */
export const APPOINTMENT_SELECT_BASE = `
  SELECT a.id, a.patient_id, a.doctor_id, a.booked_by, a.appointment_date, a.start_time, a.end_time,
         a.status, a.room_id, a.reschedule_count, a.created_at, a.updated_at,
         pu.name AS patient_name, pu.email AS patient_email,
         du.name AS doctor_name, du.email AS doctor_email, d.speciality AS doctor_speciality,
         bu.name AS booked_by_name, bu.email AS booked_by_email,
         pr.id AS prescription_id
    FROM appointments a
    JOIN users pu ON pu.id = a.patient_id
    JOIN users du ON du.id = a.doctor_id
    JOIN doctors d ON d.user_id = a.doctor_id
    JOIN users bu ON bu.id = a.booked_by
    LEFT JOIN prescriptions pr ON pr.appointment_id = a.id`;

export const COMMON_SQL = Object.freeze({
  // ---------- users ----------
  USER_FIND_BY_EMAIL: `
    SELECT id, name, email, password_hash, role, is_disabled
      FROM users
     WHERE lower(email) = lower($1)`,
  USER_FIND_BY_ID: `
    SELECT id, name, email, role, is_disabled, created_at
      FROM users
     WHERE id = $1`,
  USER_INSERT: `
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, lower($2), $3, $4)
    RETURNING id, name, email, role`,
  USER_UPDATE_PASSWORD_BY_EMAIL: `
    UPDATE users
       SET password_hash = $2, updated_at = now()
     WHERE lower(email) = lower($1)
    RETURNING id, name, email`,
  USER_DELETE_BY_ID: `
    DELETE FROM users WHERE id = $1`,

  // ---------- OTP ----------
  OTP_LATEST_FOR_EMAIL: `
    SELECT id, created_at
      FROM email_otps
     WHERE lower(email) = lower($1) AND purpose = $2
     ORDER BY created_at DESC
     LIMIT $3`,
  OTP_INVALIDATE_OPEN: `
    UPDATE email_otps
       SET consumed = TRUE
     WHERE lower(email) = lower($1) AND purpose = $2 AND consumed = $3`,
  OTP_INSERT: `
    INSERT INTO email_otps (email, purpose, otp_hash, expires_at)
    VALUES (lower($1), $2, $3, now() + make_interval(mins => $4))
    RETURNING id, expires_at`,
  OTP_FIND_ACTIVE: `
    SELECT id, otp_hash, attempts
      FROM email_otps
     WHERE lower(email) = lower($1) AND purpose = $2 AND consumed = $3 AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT $4`,
  OTP_ADD_ATTEMPT: `
    UPDATE email_otps SET attempts = attempts + $2 WHERE id = $1 RETURNING attempts`,
  OTP_CONSUME: `
    UPDATE email_otps SET consumed = TRUE WHERE id = $1`,

  // ---------- captcha ----------
  CAPTCHA_INSERT: `
    INSERT INTO captchas (answer_hash, expires_at)
    VALUES ($1, now() + make_interval(mins => $2))
    RETURNING id, expires_at`,
  CAPTCHA_CONSUME: `
    UPDATE captchas
       SET used = TRUE
     WHERE id = $1::uuid AND used = $2 AND expires_at > now()
    RETURNING answer_hash`,

  // ---------- doctors / availability (shared by admin, patient, doctor) ----------
  DOCTOR_PROFILE_BY_ID: `
    SELECT u.id, u.name, u.email, u.is_disabled, d.sex, d.speciality, d.signature
      FROM users u
      JOIN doctors d ON d.user_id = u.id
     WHERE u.id = $1`,
  AVAILABILITY_FOR_DOCTORS: `
    SELECT doctor_id, weekday, start_time, end_time
      FROM doctor_availability
     WHERE doctor_id = ANY($1::bigint[])
     ORDER BY doctor_id, weekday, start_time`,
  AVAILABILITY_FOR_DOCTOR_WEEKDAY: `
    SELECT start_time, end_time
      FROM doctor_availability
     WHERE doctor_id = $1 AND weekday = $2
     ORDER BY start_time`,
  DOCTOR_BOOKED_STARTS: `
    SELECT start_time
      FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2::date AND slot_active = $3 AND id <> $4`,
  PATIENT_BOOKED_STARTS: `
    SELECT start_time
      FROM appointments
     WHERE patient_id = $1 AND appointment_date = $2::date AND slot_active = $3 AND id <> $4`,

  // ---------- patients ----------
  PATIENT_PROFILE_BY_ID: `
    SELECT u.id, u.name, u.email, u.is_disabled, p.sex, p.date_of_birth, p.contact_number, p.family_id
      FROM users u
      JOIN patients p ON p.user_id = u.id
     WHERE u.id = $1`,

  // ---------- appointments ----------
  APPOINTMENT_BY_ID: `${APPOINTMENT_SELECT_BASE}
     WHERE a.id = $1`,

  // ---------- prescriptions ----------
  PRESCRIPTION_BY_APPOINTMENT: `
    SELECT id, appointment_id, doctor_id, patient_id, patient_name, patient_age, prescribed_on, pdf_key, pdf_url, created_at
      FROM prescriptions
     WHERE appointment_id = $1`,
});
