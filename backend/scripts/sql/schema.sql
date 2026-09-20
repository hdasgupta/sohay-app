CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE TABLE IF NOT EXISTS admins (user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS patients (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sex VARCHAR(30) NOT NULL,
  date_of_birth DATE NOT NULL,
  contact_number VARCHAR(40) NOT NULL
);
CREATE TABLE IF NOT EXISTS doctors (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sex VARCHAR(30) NOT NULL,
  speciality VARCHAR(200) NOT NULL
);
CREATE TABLE IF NOT EXISTS doctor_availability (
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_day_start ON doctor_availability(doctor_id, weekday, start_time);
CREATE TABLE IF NOT EXISTS families (
  id BIGSERIAL PRIMARY KEY,
  created_by BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  family_name VARCHAR(180) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS family_memberships (
  family_id BIGINT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  patient_id BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_id, patient_id)
);
CREATE TABLE IF NOT EXISTS family_invitations (
  id BIGSERIAL PRIMARY KEY,
  family_id BIGINT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  inviter_patient_id BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  invitee_patient_id BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  beneficiary_patient_id BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE RESTRICT,
  doctor_id BIGINT NOT NULL REFERENCES doctors(user_id) ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(30) NOT NULL,
  room_id VARCHAR(220) NOT NULL UNIQUE,
  active_doctor_slot_key VARCHAR(400) UNIQUE,
  active_patient_slot_key VARCHAR(400) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date ON appointments(patient_id, appointment_date, start_time);
CREATE TABLE IF NOT EXISTS medicines (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id BIGINT NOT NULL REFERENCES doctors(user_id) ON DELETE RESTRICT,
  patient_id BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE RESTRICT,
  patient_age INTEGER NOT NULL,
  issued_on DATE NOT NULL,
  pdf_key TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS prescription_medicines (
  id BIGSERIAL PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name VARCHAR(500) NOT NULL,
  dose TEXT NOT NULL,
  instruction TEXT,
  timing TEXT[] NOT NULL,
  sos BOOLEAN NOT NULL DEFAULT FALSE,
  food_timing VARCHAR(30) NOT NULL,
  sort_order INTEGER NOT NULL
);
