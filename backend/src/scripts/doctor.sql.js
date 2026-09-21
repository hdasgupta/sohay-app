/**
 * scripts/doctor.sql.js
 * SQL used only by doctor features: own appointment listing and prescriptions.
 */

export const SELECT_APPOINTMENTS_FOR_DOCTOR = `
  SELECT a.id,
         a.appointment_date,
         TO_CHAR(a.start_time, $1) AS start_time,
         TO_CHAR(a.end_time, $1)   AS end_time,
         a.status,
         a.room_id,
         pu.name  AS patient_name,
         pu.email AS patient_email,
         p.sex,
         p.date_of_birth,
         pr.pdf_url
  FROM appointments a
  INNER JOIN users pu ON pu.id = a.patient_id
  INNER JOIN patients p ON p.user_id = a.patient_id
  LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
  WHERE a.doctor_id = $2
  ORDER BY a.appointment_date DESC, a.start_time DESC
`;

export const SELECT_TODAY_APPOINTMENTS_FOR_DOCTOR = `
  SELECT a.id,
         TO_CHAR(a.start_time, $1) AS start_time,
         a.status,
         a.patient_id,
         pu.name AS patient_name,
         p.date_of_birth,
         pr.id AS prescription_id
  FROM appointments a
  INNER JOIN users pu ON pu.id = a.patient_id
  INNER JOIN patients p ON p.user_id = a.patient_id
  LEFT JOIN prescriptions pr ON pr.appointment_id = a.id
  WHERE a.doctor_id = $2
    AND a.appointment_date = $3::DATE
    AND a.status = ANY ($4::appointment_status[])
  ORDER BY a.start_time ASC
`;

export const INSERT_PRESCRIPTION = `
  INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, patient_age, advice, pdf_key, pdf_url)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id, created_at
`;

export const INSERT_PRESCRIPTION_MEDICINE = `
  INSERT INTO prescription_medicines (
    prescription_id, medicine_name, dose, condition_note,
    take_morning, take_afternoon, take_evening, take_night,
    is_sos, food, position
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  RETURNING id
`;

export const SELECT_PRESCRIPTION_BY_APPOINTMENT = `
  SELECT id, pdf_key, pdf_url, created_at
  FROM prescriptions
  WHERE appointment_id = $1
`;

export const SELECT_PRESCRIPTION_FOR_DOWNLOAD = `
  SELECT pr.id,
         pr.pdf_key,
         pr.pdf_url,
         pr.doctor_id,
         pr.patient_id,
         a.booked_by_id
  FROM prescriptions pr
  INNER JOIN appointments a ON a.id = pr.appointment_id
  WHERE pr.id = $1
`;

export const INSERT_MEDICINE_IF_MISSING = `
  INSERT INTO medicines (name)
  VALUES ($1)
  ON CONFLICT (name) DO NOTHING
  RETURNING id
`;
