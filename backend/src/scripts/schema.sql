-- =====================================================================
--  West Bengal Forum for Mental Health - Appointment booking schema
--  Running this file CLEANS THE DATABASE FULLY (tables, indexes,
--  sequences, types, extensions in schema public) and recreates it.
--  No string literals are used anywhere; every lookup value is seeded
--  by the backend with parameterised INSERT statements.
-- =====================================================================

DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DROP EXTENSION IF EXISTS citext CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
SET search_path TO public;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- lookup tables ----------
CREATE TABLE app_meta (
  meta_key    VARCHAR(60) PRIMARY KEY,
  meta_value  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

CREATE TABLE appointment_statuses (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

CREATE TABLE invitation_statuses (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

CREATE TABLE food_timings (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

-- ---------- hierarchical users ----------
-- Parent table: common identity for admin / doctor / patient
CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(20)  NOT NULL REFERENCES user_roles(code),
  is_disabled    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));
CREATE INDEX ix_users_role ON users (role);

CREATE TABLE admins (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE families (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sex             VARCHAR(10) NOT NULL,
  date_of_birth   DATE NOT NULL,
  contact_number  VARCHAR(20) NOT NULL,
  family_id       BIGINT REFERENCES families(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_patients_family ON patients (family_id);

CREATE TABLE doctors (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sex         VARCHAR(10)  NOT NULL,
  speciality  VARCHAR(120) NOT NULL,
  signature   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- weekday: 0 = Sunday ... 6 = Saturday ; end_time may be 24:00
CREATE TABLE doctor_availability (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doctor_id   BIGINT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX ix_availability_doctor_weekday ON doctor_availability (doctor_id, weekday);

-- ---------- family invitations ----------
CREATE TABLE family_invitations (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id     BIGINT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  inviter_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL REFERENCES invitation_statuses(code),
  is_open       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX ux_open_invitation ON family_invitations (family_id, invitee_id) WHERE is_open;
CREATE INDEX ix_invitation_invitee ON family_invitations (invitee_id);

-- ---------- appointments ----------
-- slot_active is TRUE while the appointment occupies its slot (scheduled / rescheduled / completed)
CREATE TABLE appointments (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id        BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  doctor_id         BIGINT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
  booked_by         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_date  DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  status            VARCHAR(20) NOT NULL REFERENCES appointment_statuses(code),
  slot_active       BOOLEAN NOT NULL DEFAULT TRUE,
  room_id           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  reschedule_count  INTEGER NOT NULL DEFAULT 0,
  cancelled_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE UNIQUE INDEX ux_doctor_slot  ON appointments (doctor_id,  appointment_date, start_time) WHERE slot_active;
CREATE UNIQUE INDEX ux_patient_slot ON appointments (patient_id, appointment_date, start_time) WHERE slot_active;
CREATE INDEX ix_appointments_patient ON appointments (patient_id, appointment_date DESC, start_time DESC);
CREATE INDEX ix_appointments_doctor  ON appointments (doctor_id,  appointment_date DESC, start_time DESC);
CREATE INDEX ix_appointments_booked_by ON appointments (booked_by);
CREATE INDEX ix_appointments_status_date ON appointments (status, appointment_date);

-- ---------- medicines & prescriptions ----------
CREATE TABLE medicines (
  id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  VARCHAR(255) NOT NULL UNIQUE
);
CREATE INDEX ix_medicines_name_trgm ON medicines USING gin (name gin_trgm_ops);

CREATE TABLE prescriptions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id  BIGINT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id       BIGINT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
  patient_id      BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  patient_name    VARCHAR(120) NOT NULL,
  patient_age     INTEGER NOT NULL CHECK (patient_age BETWEEN 0 AND 150),
  prescribed_on   DATE NOT NULL,
  notes           TEXT,
  pdf_key         TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescription_items (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prescription_id  BIGINT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  medicine_name    VARCHAR(255) NOT NULL,
  dose             VARCHAR(120) NOT NULL,
  instructions     TEXT,
  morning          BOOLEAN NOT NULL DEFAULT FALSE,
  afternoon        BOOLEAN NOT NULL DEFAULT FALSE,
  evening          BOOLEAN NOT NULL DEFAULT FALSE,
  night            BOOLEAN NOT NULL DEFAULT FALSE,
  sos              BOOLEAN NOT NULL DEFAULT FALSE,
  food_timing      VARCHAR(20) NOT NULL REFERENCES food_timings(code)
);
CREATE INDEX ix_prescription_items_prescription ON prescription_items (prescription_id);

-- ---------- security helpers ----------
CREATE TABLE email_otps (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  purpose     VARCHAR(30)  NOT NULL,
  otp_hash    VARCHAR(128) NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_email_otps_lookup ON email_otps (lower(email), purpose, created_at DESC);

CREATE TABLE captchas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_hash  VARCHAR(128) NOT NULL,
  used         BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_captchas_expiry ON captchas (expires_at);

-- ---------- meeting recordings (8x8 JaaS -> Cloudflare R2) ----------
CREATE TABLE meeting_recordings (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id        BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  room_fqn              TEXT NOT NULL,
  idempotency_key       VARCHAR(80) NOT NULL UNIQUE,
  recording_session_id  VARCHAR(120),
  duration_sec          INTEGER,
  source_url            TEXT,
  storage_key           TEXT,
  storage_url           TEXT,
  upload_status         VARCHAR(20) NOT NULL,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_recordings_appointment ON meeting_recordings (appointment_id);
