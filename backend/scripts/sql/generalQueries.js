export const healthCheck = "SELECT $1::text AS status";
export const beginTransaction = "BEGIN";
export const commitTransaction = "COMMIT";
export const rollbackTransaction = "ROLLBACK";
export const findUserByEmail = `SELECT u.id,u.name,u.email,u.password_hash,u.is_disabled,
  CASE WHEN a.user_id IS NOT NULL THEN $2 WHEN p.user_id IS NOT NULL THEN $3 WHEN d.user_id IS NOT NULL THEN $4 END AS role
  FROM users u LEFT JOIN admins a ON a.user_id=u.id LEFT JOIN patients p ON p.user_id=u.id LEFT JOIN doctors d ON d.user_id=u.id
  WHERE u.email=$1 LIMIT $5`;
export const findUserById = `SELECT u.id,u.name,u.email,u.password_hash,u.is_disabled,
  CASE WHEN a.user_id IS NOT NULL THEN $2 WHEN p.user_id IS NOT NULL THEN $3 WHEN d.user_id IS NOT NULL THEN $4 END AS role
  FROM users u LEFT JOIN admins a ON a.user_id=u.id LEFT JOIN patients p ON p.user_id=u.id LEFT JOIN doctors d ON d.user_id=u.id
  WHERE u.id=$1 LIMIT $5`;
export const updatePasswordByEmail =
  "UPDATE users SET password_hash=$1,updated_at=NOW() WHERE email=$2";
export const getAppointmentForEmail = `SELECT a.id,a.room_id,a.appointment_date,a.start_time,a.patient_id,pu.name patient_name,pu.email patient_email,
  du.name doctor_name,d.speciality FROM appointments a JOIN users pu ON pu.id=a.patient_id JOIN users du ON du.id=a.doctor_id JOIN doctors d ON d.user_id=a.doctor_id WHERE a.id=$1 LIMIT $2`;
