/**
 * scripts/schema.sql.js
 * Every DDL statement used to (re)create the database.
 * Order matters: DROP statements first (children before parents), then CREATE.
 */

export const DROP_ALL = `
DROP TABLE IF EXISTS prescription_medicines CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS appointment_recordings CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS family_invitations CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS otp_requests CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS families CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_appointments_doctor_slot;
DROP INDEX IF EXISTS idx_appointments_patient_slot;
DROP INDEX IF EXISTS idx_appointments_status;
DROP INDEX IF EXISTS idx_medicines_name_trgm;
DROP INDEX IF EXISTS idx_availability_doctor_weekday;
DROP INDEX IF EXISTS idx_otp_email_purpose;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS sex_type CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;
DROP TYPE IF EXISTS invitation_status CASCADE;
DROP TYPE IF EXISTS otp_purpose CASCADE;
DROP TYPE IF EXISTS food_relation CASCADE;

DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DROP EXTENSION IF EXISTS citext CASCADE;
`;

export const CREATE_EXTENSIONS = `
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
`;

export const CREATE_TYPES = `
CREATE TYPE user_role AS ENUM ('ADMIN', 'PATIENT', 'DOCTOR');
CREATE TYPE sex_type AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE appointment_status AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE otp_purpose AS ENUM ('REGISTER', 'RESET_PASSWORD');
CREATE TYPE food_relation AS ENUM ('BEFORE_FOOD', 'WITH_FOOD', 'AFTER_FOOD');
`;

export const CREATE_TABLES = `
-- Parent table of the hierarchy: one row for every human that can log in.
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         CITEXT      NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL,
  is_disabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE families (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_by BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admins (
  user_id    BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE patients (
  user_id        BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  sex            sex_type NOT NULL,
  date_of_birth  DATE     NOT NULL,
  contact_number TEXT     NOT NULL,
  family_id      BIGINT   REFERENCES families (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctors (
  user_id    BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  sex        sex_type NOT NULL,
  speciality TEXT     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctor_availability (
  id         BIGSERIAL PRIMARY KEY,
  doctor_id  BIGINT NOT NULL REFERENCES doctors (user_id) ON DELETE CASCADE,
  weekday    SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (doctor_id, weekday, start_time, end_time)
);

CREATE TABLE family_invitations (
  id         BIGSERIAL PRIMARY KEY,
  family_id  BIGINT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  inviter_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  invitee_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status     invitation_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE appointments (
  id               BIGSERIAL PRIMARY KEY,
  doctor_id        BIGINT NOT NULL REFERENCES doctors (user_id) ON DELETE CASCADE,
  booked_by_id     BIGINT NOT NULL REFERENCES patients (user_id) ON DELETE CASCADE,
  patient_id       BIGINT NOT NULL REFERENCES patients (user_id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           appointment_status NOT NULL DEFAULT 'SCHEDULED',
  room_id          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE appointment_recordings (
  id             BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  room_id        TEXT NOT NULL,
  source_url     TEXT,
  drive_file_id  TEXT,
  drive_link     TEXT,
  status         TEXT NOT NULL,
  detail         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medicines (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE prescriptions (
  id             BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  doctor_id      BIGINT NOT NULL REFERENCES doctors (user_id) ON DELETE CASCADE,
  patient_id     BIGINT NOT NULL REFERENCES patients (user_id) ON DELETE CASCADE,
  patient_age    INTEGER NOT NULL,
  advice         TEXT,
  pdf_key        TEXT NOT NULL,
  pdf_url        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prescription_medicines (
  id              BIGSERIAL PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions (id) ON DELETE CASCADE,
  medicine_name   TEXT NOT NULL,
  dose            TEXT NOT NULL,
  condition_note  TEXT,
  take_morning    BOOLEAN NOT NULL DEFAULT FALSE,
  take_afternoon  BOOLEAN NOT NULL DEFAULT FALSE,
  take_evening    BOOLEAN NOT NULL DEFAULT FALSE,
  take_night      BOOLEAN NOT NULL DEFAULT FALSE,
  is_sos          BOOLEAN NOT NULL DEFAULT FALSE,
  food            food_relation NOT NULL,
  position        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE otp_requests (
  id         BIGSERIAL PRIMARY KEY,
  email      CITEXT NOT NULL,
  purpose    otp_purpose NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed   BOOLEAN NOT NULL DEFAULT FALSE,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const CREATE_INDEXES = `
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_appointments_doctor_slot ON appointments (doctor_id, appointment_date, start_time);
CREATE INDEX idx_appointments_patient_slot ON appointments (patient_id, appointment_date, start_time);
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_availability_doctor_weekday ON doctor_availability (doctor_id, weekday);
CREATE INDEX idx_medicines_name_trgm ON medicines USING GIN (name gin_trgm_ops);
CREATE INDEX idx_otp_email_purpose ON otp_requests (email, purpose);
`;

export const SCHEMA_STEPS = [
  { label: 'drop existing objects', sql: DROP_ALL },
  { label: 'create extensions', sql: CREATE_EXTENSIONS },
  { label: 'create types', sql: CREATE_TYPES },
  { label: 'create tables', sql: CREATE_TABLES },
  { label: 'create indexes', sql: CREATE_INDEXES },
];
