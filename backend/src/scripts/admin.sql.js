/**
 * scripts/admin.sql.js
 * SQL used only by admin features: doctor creation / editing / listing,
 * enable-disable and appointment rescheduling.
 */

/* ------------------------------------------------------------- doctor crud */

export const INSERT_DOCTOR = `
  INSERT INTO doctors (user_id, sex, speciality)
  VALUES ($1, $2, $3)
  RETURNING user_id
`;

export const UPDATE_DOCTOR = `
  UPDATE doctors
  SET sex = $2,
      speciality = $3
  WHERE user_id = $1
  RETURNING user_id
`;

export const DELETE_DOCTOR_AVAILABILITY = `
  DELETE FROM doctor_availability
  WHERE doctor_id = $1
`;

export const INSERT_DOCTOR_AVAILABILITY = `
  INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time)
  VALUES ($1, $2, $3, $4)
  RETURNING id
`;

export const SELECT_DOCTORS_WITH_AVAILABILITY = `
  SELECT u.id,
         u.name,
         u.email,
         u.is_disabled,
         u.created_at,
         d.sex,
         d.speciality,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'id', a.id,
               'weekday', a.weekday,
               'startTime', TO_CHAR(a.start_time, $1),
               'endTime', TO_CHAR(a.end_time, $1)
             )
             ORDER BY a.weekday, a.start_time
           ) FILTER (WHERE a.id IS NOT NULL),
           $2::JSON
         ) AS availability
  FROM users u
  INNER JOIN doctors d ON d.user_id = u.id
  LEFT JOIN doctor_availability a ON a.doctor_id = d.user_id
  WHERE u.role = $3
    AND ($4::TEXT IS NULL OR u.name ILIKE $4 OR d.speciality ILIKE $4)
  GROUP BY u.id, d.user_id
  ORDER BY u.name ASC
`;

export const SELECT_ENABLED_DOCTORS = `
  SELECT u.id,
         u.name,
         d.speciality
  FROM users u
  INNER JOIN doctors d ON d.user_id = u.id
  WHERE u.role = $1
    AND u.is_disabled = $2
  ORDER BY u.name ASC
`;

/* ------------------------------------------------------- patient selectors */

export const SELECT_ENABLED_PATIENTS = `
  SELECT u.id,
         u.name,
         u.email
  FROM users u
  INNER JOIN patients p ON p.user_id = u.id
  WHERE u.role = $1
    AND u.is_disabled = $2
  ORDER BY u.name ASC
`;

/* ------------------------------------------------------------ reschedining */

export const SELECT_UPCOMING_APPOINTMENT_FOR_PAIR = `
  SELECT a.id,
         a.appointment_date,
         TO_CHAR(a.start_time, $1) AS start_time,
         TO_CHAR(a.end_time, $1)   AS end_time,
         a.status,
         a.room_id,
         du.name AS doctor_name,
         pu.name AS patient_name
  FROM appointments a
  INNER JOIN users du ON du.id = a.doctor_id
  INNER JOIN users pu ON pu.id = a.patient_id
  WHERE a.doctor_id = $2
    AND a.patient_id = $3
    AND a.status = ANY ($4::appointment_status[])
    AND (a.appointment_date > $5::DATE
         OR (a.appointment_date = $5::DATE AND a.start_time >= $6::TIME))
  ORDER BY a.appointment_date ASC, a.start_time ASC
  LIMIT $7
`;

export const UPDATE_APPOINTMENT_SCHEDULE = `
  UPDATE appointments
  SET appointment_date = $2,
      start_time = $3,
      end_time = $4,
      status = $5,
      updated_at = NOW()
  WHERE id = $1
  RETURNING id, appointment_date, start_time, end_time, status, room_id, doctor_id, patient_id
`;
