/** SQL used by bootstrap, scheduled jobs and webhooks (no end user). */
export const SYSTEM_SQL = Object.freeze({
  TABLE_EXISTS: `
    SELECT to_regclass($1) AS table_name`,
  META_GET: `
    SELECT meta_value FROM app_meta WHERE meta_key = $1`,
  META_UPSERT: `
    INSERT INTO app_meta (meta_key, meta_value) VALUES ($1, $2)
    ON CONFLICT (meta_key) DO UPDATE SET meta_value = EXCLUDED.meta_value, updated_at = now()`,
  LIST_SCHEMA_TABLES: `
    SELECT tablename FROM pg_tables WHERE schemaname = $1`,
  /** identifier must already be escaped with pg.escapeIdentifier */
  DROP_TABLE_CASCADE: (escapedIdentifier) => `DROP TABLE IF EXISTS ${escapedIdentifier} CASCADE`,
  DROP_TYPE_CASCADE: (escapedIdentifier) => `DROP TYPE IF EXISTS ${escapedIdentifier} CASCADE`,
  LIST_SCHEMA_TYPES: `
    SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = $1 AND t.typtype = ANY($2::char[])`,

  // ---------- lookup seeding ----------
  SEED_USER_ROLES: `
    INSERT INTO user_roles (code, label)
    SELECT * FROM unnest($1::varchar[], $2::varchar[])
    ON CONFLICT (code) DO NOTHING`,
  SEED_APPOINTMENT_STATUSES: `
    INSERT INTO appointment_statuses (code, label)
    SELECT * FROM unnest($1::varchar[], $2::varchar[])
    ON CONFLICT (code) DO NOTHING`,
  SEED_INVITATION_STATUSES: `
    INSERT INTO invitation_statuses (code, label)
    SELECT * FROM unnest($1::varchar[], $2::varchar[])
    ON CONFLICT (code) DO NOTHING`,
  SEED_FOOD_TIMINGS: `
    INSERT INTO food_timings (code, label)
    SELECT * FROM unnest($1::varchar[], $2::varchar[])
    ON CONFLICT (code) DO NOTHING`,

  // ---------- medicines ----------
  MEDICINE_COUNT: `
    SELECT count(*) AS total FROM medicines`,
  MEDICINE_INSERT_BATCH: `
    INSERT INTO medicines (name)
    SELECT DISTINCT t.name FROM unnest($1::varchar[]) AS t(name)
    ON CONFLICT (name) DO NOTHING`,

  // ---------- test data cleanup ----------
  TEST_PRESCRIPTION_KEYS: `
    SELECT p.pdf_key
      FROM prescriptions p
      JOIN users u ON u.id = p.patient_id OR u.id = p.doctor_id
     WHERE u.email LIKE $1 AND p.pdf_key IS NOT NULL`,
  TEST_USERS_DELETE: `
    DELETE FROM users WHERE email LIKE $1`,
  TEST_OTPS_DELETE: `
    DELETE FROM email_otps WHERE email LIKE $1`,

  // ---------- jobs ----------
  CANCEL_PAST_APPOINTMENTS: `
    UPDATE appointments
       SET status = $1, slot_active = FALSE, updated_at = now()
     WHERE status = ANY($2::varchar[]) AND appointment_date < $3::date
    RETURNING id`,
  PURGE_EXPIRED_CAPTCHAS: `
    DELETE FROM captchas WHERE expires_at < now()`,
  PURGE_OLD_OTPS: `
    DELETE FROM email_otps WHERE expires_at < now() - make_interval(days => $1)`,

  // ---------- JaaS recordings ----------
  APPOINTMENT_ID_BY_ROOM: `
    SELECT id FROM appointments WHERE room_id = $1::uuid`,
  RECORDING_INSERT: `
    INSERT INTO meeting_recordings
           (appointment_id, room_fqn, idempotency_key, recording_session_id, duration_sec, source_url, upload_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id`,
  RECORDING_UPDATE: `
    UPDATE meeting_recordings
       SET storage_key = $2, storage_url = $3, upload_status = $4, error_message = $5
     WHERE id = $1`,
});
