/** SQL used by patient controllers. */
import { APPOINTMENT_SELECT_BASE } from './common.sql.js';

export const PATIENT_SQL = Object.freeze({
  PATIENT_INSERT: `
    INSERT INTO patients (user_id, sex, date_of_birth, contact_number)
    VALUES ($1, $2, $3::date, $4)`,
  PATIENT_BY_EMAIL: `
    SELECT u.id, u.name, u.email, u.is_disabled, p.family_id
      FROM users u
      JOIN patients p ON p.user_id = u.id
     WHERE lower(u.email) = lower($1)`,

  // ---------- doctors visible to patients ----------
  ENABLED_DOCTORS: `
    SELECT u.id, u.name, u.email, d.sex, d.speciality
      FROM users u
      JOIN doctors d ON d.user_id = u.id
     WHERE u.is_disabled = $1
       AND EXISTS (SELECT av.id FROM doctor_availability av WHERE av.doctor_id = u.id)
     ORDER BY u.name, u.id`,

  // ---------- family ----------
  FAMILY_BY_ID: `
    SELECT f.id, f.name, f.created_by, f.created_at, u.name AS created_by_name
      FROM families f
      JOIN users u ON u.id = f.created_by
     WHERE f.id = $1`,
  FAMILY_INSERT: `
    INSERT INTO families (name, created_by) VALUES ($1, $2)
    RETURNING id, name, created_by, created_at`,
  FAMILY_DELETE: `
    DELETE FROM families WHERE id = $1`,
  FAMILY_MEMBERS: `
    SELECT u.id, u.name, u.email, p.sex, p.date_of_birth, p.contact_number
      FROM patients p
      JOIN users u ON u.id = p.user_id
     WHERE p.family_id = $1
     ORDER BY u.name, u.id`,
  FAMILY_MEMBER_COUNT: `
    SELECT count(*) AS total FROM patients WHERE family_id = $1`,
  PATIENT_SET_FAMILY: `
    UPDATE patients SET family_id = $2 WHERE user_id = $1`,
  PATIENT_CLEAR_FAMILY: `
    UPDATE patients SET family_id = NULL WHERE user_id = $1`,

  // ---------- invitations ----------
  INVITATION_INSERT: `
    INSERT INTO family_invitations (family_id, inviter_id, invitee_id, status)
    VALUES ($1, $2, $3, $4)
    RETURNING id, created_at`,
  INVITATION_BY_ID: `
    SELECT i.id, i.family_id, i.inviter_id, i.invitee_id, i.status, i.is_open,
           f.name AS family_name, iu.name AS inviter_name, iu.email AS inviter_email,
           eu.name AS invitee_name, eu.email AS invitee_email
      FROM family_invitations i
      JOIN families f ON f.id = i.family_id
      JOIN users iu ON iu.id = i.inviter_id
      JOIN users eu ON eu.id = i.invitee_id
     WHERE i.id = $1`,
  INVITATIONS_SENT: `
    SELECT i.id, i.status, i.is_open, i.created_at, i.responded_at,
           eu.name AS invitee_name, eu.email AS invitee_email, iu.name AS inviter_name
      FROM family_invitations i
      JOIN users eu ON eu.id = i.invitee_id
      JOIN users iu ON iu.id = i.inviter_id
     WHERE i.family_id = $1
     ORDER BY i.created_at DESC
     LIMIT $2`,
  INVITATIONS_RECEIVED_OPEN: `
    SELECT i.id, i.status, i.created_at, i.family_id, f.name AS family_name,
           iu.name AS inviter_name, iu.email AS inviter_email
      FROM family_invitations i
      JOIN families f ON f.id = i.family_id
      JOIN users iu ON iu.id = i.inviter_id
     WHERE i.invitee_id = $1 AND i.is_open = $2
     ORDER BY i.created_at DESC`,
  INVITATION_CLOSE: `
    UPDATE family_invitations
       SET status = $2, is_open = FALSE, responded_at = now()
     WHERE id = $1 AND is_open = $3
    RETURNING id`,
  INVITATIONS_CLOSE_OTHERS_FOR_INVITEE: `
    UPDATE family_invitations
       SET status = $2, is_open = FALSE, responded_at = now()
     WHERE invitee_id = $1 AND is_open = $3 AND id <> $4`,

  // ---------- appointments ----------
  APPOINTMENT_INSERT: `
    INSERT INTO appointments (patient_id, doctor_id, booked_by, appointment_date, start_time, end_time, status)
    VALUES ($1, $2, $3, $4::date, $5::time, $6::time, $7)
    RETURNING id, room_id`,
  APPOINTMENTS_FOR_PATIENT: `${APPOINTMENT_SELECT_BASE}
     WHERE a.patient_id = $1 OR a.booked_by = $1
     ORDER BY a.appointment_date DESC, a.start_time DESC, a.id DESC`,
  APPOINTMENT_CANCEL: `
    UPDATE appointments
       SET status = $2, slot_active = FALSE, cancelled_by = $3, updated_at = now()
     WHERE id = $1 AND status = ANY($4::varchar[])
    RETURNING id`,
});
