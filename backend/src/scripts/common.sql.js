/**
 * scripts/common.sql.js
 * SQL used by every kind of user (login, registration, password reset, otp,
 * captcha-free lookups and the medicine master bootstrap).
 *
 * RULES followed in this file:
 *  - no string / number literal is ever inlined in a WHERE clause, everything
 *    travels as a bind parameter ($1, $2 ...),
 *  - one query is declared exactly once and reused everywhere.
 */

/* ------------------------------------------------------------------ users */

export const INSERT_USER = `
  INSERT INTO users (name, email, password_hash, role, is_disabled)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id, name, email, role, is_disabled, created_at
`;

export const SELECT_USER_BY_EMAIL = `
  SELECT id, name, email, password_hash, role, is_disabled
  FROM users
  WHERE email = $1
`;

export const SELECT_USER_BY_ID = `
  SELECT id, name, email, role, is_disabled, created_at
  FROM users
  WHERE id = $1
`;

export const SELECT_USER_ID_BY_EMAIL_AND_ROLE = `
  SELECT id
  FROM users
  WHERE email = $1
    AND role = $2
`;

export const COUNT_USERS_BY_EMAIL = `
  SELECT COUNT(*)::INT AS total
  FROM users
  WHERE email = $1
`;

export const COUNT_USERS_BY_ROLE = `
  SELECT COUNT(*)::INT AS total
  FROM users
  WHERE role = $1
`;

export const UPDATE_USER_PASSWORD = `
  UPDATE users
  SET password_hash = $2,
      updated_at = NOW()
  WHERE id = $1
  RETURNING id, email
`;

export const UPDATE_USER_NAME = `
  UPDATE users
  SET name = $2,
      updated_at = NOW()
  WHERE id = $1
  RETURNING id
`;

export const UPDATE_USER_DISABLED = `
  UPDATE users
  SET is_disabled = $2,
      updated_at = NOW()
  WHERE id = $1
    AND role = $3
  RETURNING id, name, email, is_disabled
`;

/* ------------------------------------------------- role specific children */

export const INSERT_ADMIN = `
  INSERT INTO admins (user_id)
  VALUES ($1)
  RETURNING user_id
`;

export const INSERT_PATIENT = `
  INSERT INTO patients (user_id, sex, date_of_birth, contact_number)
  VALUES ($1, $2, $3, $4)
  RETURNING user_id
`;

export const SELECT_PATIENT_PROFILE_BY_ID = `
  SELECT u.id,
         u.name,
         u.email,
         u.is_disabled,
         p.sex,
         p.date_of_birth,
         p.contact_number,
         p.family_id
  FROM users u
  INNER JOIN patients p ON p.user_id = u.id
  WHERE u.id = $1
`;

export const SELECT_DOCTOR_PROFILE_BY_ID = `
  SELECT u.id,
         u.name,
         u.email,
         u.is_disabled,
         d.sex,
         d.speciality
  FROM users u
  INNER JOIN doctors d ON d.user_id = u.id
  WHERE u.id = $1
`;

/* -------------------------------------------------------------------- otp */

export const INSERT_OTP = `
  INSERT INTO otp_requests (email, purpose, code_hash, expires_at)
  VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::INTERVAL)
  RETURNING id, expires_at
`;

export const SELECT_LATEST_ACTIVE_OTP = `
  SELECT id, code_hash, attempts, expires_at
  FROM otp_requests
  WHERE email = $1
    AND purpose = $2
    AND consumed = $3
    AND expires_at > NOW()
  ORDER BY id DESC
  LIMIT $4
`;

export const UPDATE_OTP_CONSUMED = `
  UPDATE otp_requests
  SET consumed = $2
  WHERE id = $1
`;

export const UPDATE_OTP_ATTEMPTS = `
  UPDATE otp_requests
  SET attempts = attempts + $2
  WHERE id = $1
`;

export const DELETE_STALE_OTP = `
  DELETE FROM otp_requests
  WHERE expires_at < NOW() - ($1 || ' minutes')::INTERVAL
`;

/* --------------------------------------------------------------- medicine */

export const COUNT_MEDICINES = `
  SELECT COUNT(*)::INT AS total
  FROM medicines
`;

export const INSERT_MEDICINES_BULK = `
  INSERT INTO medicines (name)
  SELECT DISTINCT TRIM(candidate)
  FROM UNNEST($1::TEXT[]) AS candidate
  WHERE LENGTH(TRIM(candidate)) > $2
  ON CONFLICT (name) DO NOTHING
`;

export const SEARCH_MEDICINES_BY_NAME = `
  SELECT id, name
  FROM medicines
  WHERE name ILIKE $1
  ORDER BY LENGTH(name) ASC, name ASC
  LIMIT $2
`;
