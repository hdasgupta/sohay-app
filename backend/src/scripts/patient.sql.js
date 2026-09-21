/**
 * scripts/patient.sql.js
 * SQL used only by patient features: family management, booking and
 * the patient side appointment listing.
 */

/* ----------------------------------------------------------------- family */

export const INSERT_FAMILY = `
  INSERT INTO families (name, created_by)
  VALUES ($1, $2)
  RETURNING id, name, created_by, created_at
`;

export const UPDATE_PATIENT_FAMILY = `
  UPDATE patients
  SET family_id = $2
  WHERE user_id = $1
  RETURNING user_id, family_id
`;

export const SELECT_FAMILY_BY_ID = `
  SELECT f.id,
         f.name,
         f.created_by,
         u.name AS owner_name
  FROM families f
  INNER JOIN users u ON u.id = f.created_by
  WHERE f.id = $1
`;

export const SELECT_FAMILY_MEMBERS = `
  SELECT u.id,
         u.name,
         u.email,
         p.date_of_birth,
         p.sex
  FROM patients p
  INNER JOIN users u ON u.id = p.user_id
  WHERE p.family_id = $1
    AND u.is_disabled = $2
  ORDER BY u.name ASC
`;

export const SELECT_INVITABLE_PATIENTS = `
  SELECT u.id,
         u.name,
         u.email
  FROM patients p
  INNER JOIN users u ON u.id = p.user_id
  WHERE u.is_disabled = $1
    AND p.family_id IS NULL
    AND u.id <> $2
    AND ($3::TEXT IS NULL OR u.name ILIKE $3 OR u.email ILIKE $3)
  ORDER BY u.name ASC
  LIMIT $4
`;

export const INSERT_FAMILY_INVITATION = `
  INSERT INTO family_invitations (family_id, inviter_id, invitee_id, status)
  VALUES ($1, $2, $3, $4)
  RETURNING id, created_at
`;

export const COUNT_PENDING_INVITATION = `
  SELECT COUNT(*)::INT AS total
  FROM family_invitations
  WHERE family_id = $1
    AND invitee_id = $2
    AND status = $3
`;

export const SELECT_INVITATIONS_FOR_INVITEE = `
  SELECT i.id,
         i.status,
         i.created_at,
         f.id   AS family_id,
         f.name AS family_name,
         u.name AS inviter_name,
         u.email AS inviter_email
  FROM family_invitations i
  INNER JOIN families f ON f.id = i.family_id
  INNER JOIN users u ON u.id = i.inviter_id
  WHERE i.invitee_id = $1
    AND i.status = $2
  ORDER BY i.id DESC
`;

export const SELECT_INVITATIONS_SENT_BY_FAMILY = `
  SELECT i.id,
         i.status,
         i.created_at,
         i.responded_at,
         u.name  AS invitee_name,
         u.email AS invitee_email
  FROM family_invitations i
  INNER JOIN users u ON u.id = i.invitee_id
  WHERE i.family_id = $1
  ORDER BY i.id DESC
`;

export const SELECT_INVITATION_FOR_RESPONSE = `
  SELECT i.id,
         i.family_id,
         i.inviter_id,
         i.invitee_id,
         i.status,
         f.name AS family_name,
         inviter.email AS inviter_email,
         inviter.name  AS inviter_name,
         invitee.email AS invitee_email,
         invitee.name  AS invitee_name
  FROM family_invitations i
  INNER JOIN families f ON f.id = i.family_id
  INNER JOIN users inviter ON inviter.id = i.inviter_id
  INNER JOIN users invitee ON invitee.id = i.invitee_id
  WHERE i.id = $1
    AND i.invitee_id = $2
`;

export const UPDATE_INVITATION_STATUS = `
  UPDATE family_invitations
  SET status = $2,
      responded_at = NOW()
  WHERE id = $1
    AND status = $3
  RETURNING id, family_id, invitee_id, status
`;

/* ------------------------------------------------------------ appointments */

export const INSERT_APPOINTMENT = `
  INSERT INTO appointments (doctor_id, booked_by_id, patient_id, appointment_date, start_time, end_time, status, room_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING id, appointment_date, start_time, end_time, status, room_id
`;

export const SELECT_APPOINTMENTS_FOR_PATIENT = `
  SELECT a.id,
         a.appointment_date,
         TO_CHAR(a.start_time, $1) AS start_time,
         TO_CHAR(a.end_time, $1)   AS end_time,
         a.status,
         a.room_id,
         du.name AS doctor_name,
         doc.speciality,
         pu.name AS patient_name,
         pu.id   AS patient_id,
         pr.pdf_url,
         pr.id   AS prescription_id
  FROM appointments a
  INNER JOIN users du ON du.id = a.doctor_id
  INNER JOIN doctors doc ON doc.user_id = a.doctor_id
  INNER JOIN users pu ON pu.id = a.patient_id
  LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
  WHERE (a.patient_id = $2 OR a.booked_by_id = $2)
  ORDER BY a.appointment_date DESC, a.start_time DESC
`;

export const SELECT_BOOKABLE_PATIENT_IDS = `
  SELECT u.id,
         u.name
  FROM patients p
  INNER JOIN users u ON u.id = p.user_id
  WHERE u.is_disabled = $1
    AND (u.id = $2
         OR ($3::BIGINT IS NOT NULL AND p.family_id = $3::BIGINT))
  ORDER BY (u.id = $2) DESC, u.name ASC
`;
