/**
 * scripts/appointment.sql.js
 * Slot / conflict SQL that is shared by more than one kind of user
 * (patient booking + admin rescheduling + doctor listing).
 * Declared once here so the very same statement is never duplicated.
 */

export const SELECT_DOCTOR_AVAILABILITY_FOR_WEEKDAY = `
  SELECT TO_CHAR(a.start_time, $1) AS start_time,
         TO_CHAR(a.end_time, $1)   AS end_time
  FROM doctor_availability a
  INNER JOIN users u ON u.id = a.doctor_id
  WHERE a.doctor_id = $2
    AND a.weekday = $3
    AND u.is_disabled = $4
  ORDER BY a.start_time ASC
`;

export const SELECT_BOOKED_SLOTS_FOR_DOCTOR_ON_DATE = `
  SELECT TO_CHAR(start_time, $1) AS start_time
  FROM appointments
  WHERE doctor_id = $2
    AND appointment_date = $3
    AND status = ANY ($4::appointment_status[])
    AND ($5::BIGINT IS NULL OR id <> $5::BIGINT)
`;

export const SELECT_BOOKED_SLOTS_FOR_PATIENT_ON_DATE = `
  SELECT TO_CHAR(start_time, $1) AS start_time
  FROM appointments
  WHERE patient_id = $2
    AND appointment_date = $3
    AND status = ANY ($4::appointment_status[])
    AND ($5::BIGINT IS NULL OR id <> $5::BIGINT)
`;

export const COUNT_SLOT_CONFLICTS = `
  SELECT COUNT(*)::INT AS total
  FROM appointments
  WHERE appointment_date = $1
    AND start_time = $2
    AND status = ANY ($3::appointment_status[])
    AND (doctor_id = $4 OR patient_id = $5)
    AND ($6::BIGINT IS NULL OR id <> $6::BIGINT)
`;

export const SELECT_APPOINTMENT_BY_ID = `
  SELECT a.id,
         a.doctor_id,
         a.patient_id,
         a.booked_by_id,
         a.appointment_date,
         TO_CHAR(a.start_time, $1) AS start_time,
         TO_CHAR(a.end_time, $1)   AS end_time,
         a.status,
         a.room_id,
         du.name  AS doctor_name,
         du.email AS doctor_email,
         doc.speciality,
         pu.name  AS patient_name,
         pu.email AS patient_email,
         p.date_of_birth
  FROM appointments a
  INNER JOIN users u_book ON u_book.id = a.booked_by_id
  INNER JOIN users du ON du.id = a.doctor_id
  INNER JOIN doctors doc ON doc.user_id = a.doctor_id
  INNER JOIN users pu ON pu.id = a.patient_id
  INNER JOIN patients p ON p.user_id = a.patient_id
  WHERE a.id = $2
`;

export const SELECT_APPOINTMENT_BY_ROOM = `
  SELECT id, doctor_id, patient_id, room_id, appointment_date
  FROM appointments
  WHERE room_id = $1
`;

export const UPDATE_APPOINTMENT_STATUS = `
  UPDATE appointments
  SET status = $2,
      updated_at = NOW()
  WHERE id = $1
    AND status = ANY ($3::appointment_status[])
  RETURNING id, status, doctor_id, patient_id, appointment_date
`;

export const UPDATE_PAST_APPOINTMENTS_TO_CANCELLED = `
  UPDATE appointments
  SET status = $1,
      updated_at = NOW()
  WHERE status = ANY ($2::appointment_status[])
    AND (appointment_date < $3::DATE
         OR (appointment_date = $3::DATE AND end_time <= $4::TIME))
  RETURNING id
`;

export const INSERT_APPOINTMENT_RECORDING = `
  INSERT INTO appointment_recordings (appointment_id, room_id, source_url, drive_file_id, drive_link, status, detail)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id
`;
