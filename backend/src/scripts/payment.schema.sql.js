export const PAYMENT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS payment_statuses (
  code  VARCHAR(20) PRIMARY KEY,
  label VARCHAR(50) NOT NULL
);

INSERT INTO payment_statuses (code, label)
VALUES
    ('created', 'Payment Created'),
    ('paid', 'Payment Successful'),
    ('failed', 'Payment Failed'),
    ('expired', 'Payment Expired'),
    ('refunded', 'Payment Refunded')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE user_roles (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

CREATE TABLE appointment_statuses (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

CREATE TABLE payment_statuses (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

CREATE TABLE invitation_statuses (
  code   VARCHAR(20) PRIMARY KEY,
  label  VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id         BIGINT REFERENCES appointments(id) ON DELETE SET NULL,

  patient_id             BIGINT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
  doctor_id              BIGINT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
  booked_by              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  appointment_date       DATE NOT NULL,
  start_time             TIME NOT NULL,
  end_time               TIME NOT NULL,

  amount_paise            BIGINT NOT NULL CHECK (amount_paise > 0),
  currency               VARCHAR(3) NOT NULL,

  razorpay_order_id      VARCHAR(80) UNIQUE,
  razorpay_payment_id    VARCHAR(80) UNIQUE,
  razorpay_signature     VARCHAR(128),

  status                 VARCHAR(20) NOT NULL REFERENCES payment_statuses(code),

  slot_hold_active      BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at             TIMESTAMPTZ NOT NULL,

  failure_code           VARCHAR(100),
  failure_description    TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_appointment
  ON payments (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_doctor_hold
  ON payments (doctor_id, appointment_date, start_time)
  WHERE slot_hold_active;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_patient_hold
  ON payments (patient_id, appointment_date, start_time)
  WHERE slot_hold_active;

CREATE INDEX IF NOT EXISTS ix_payments_patient
  ON payments (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_payments_doctor
  ON payments (doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_payments_status
  ON payments (status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id       VARCHAR(120) UNIQUE NOT NULL,
  event_type     VARCHAR(100) NOT NULL,
  payload        JSONB NOT NULL,
  processed      BOOLEAN NOT NULL DEFAULT FALSE,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at   TIMESTAMPTZ
);
`;
