export const listDoctors = `SELECT u.id,u.name,u.email,u.is_disabled,d.sex,d.speciality,COUNT(da.id)::int availability_count
  FROM users u JOIN doctors d ON d.user_id=u.id LEFT JOIN doctor_availability da ON da.doctor_id=u.id
  GROUP BY u.id,d.sex,d.speciality ORDER BY u.name ASC`;
export const listPatients =
  "SELECT u.id,u.name,u.email FROM users u JOIN patients p ON p.user_id=u.id WHERE u.is_disabled=$1 ORDER BY u.name ASC";
export const emailConflict =
  "SELECT id FROM users WHERE email=$1 AND id<>$2 LIMIT $3";
export const createAdminRole = "INSERT INTO admins(user_id) VALUES($1)";
export const activeDoctors = `SELECT u.id,u.name,u.email,d.sex,d.speciality FROM users u JOIN doctors d ON d.user_id=u.id WHERE u.is_disabled=$1 ORDER BY u.name ASC`;
export const createUser =
  "INSERT INTO users(name,email,password_hash,is_disabled) VALUES($1,$2,$3,$4) RETURNING id";
export const createDoctorRole =
  "INSERT INTO doctors(user_id,sex,speciality) VALUES($1,$2,$3)";
export const createAvailability =
  "INSERT INTO doctor_availability(doctor_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4)";
export const deleteAvailability =
  "DELETE FROM doctor_availability WHERE doctor_id=$1";
export const getDoctor =
  "SELECT u.id,u.name,u.email,u.is_disabled,d.sex,d.speciality FROM users u JOIN doctors d ON d.user_id=u.id WHERE u.id=$1 LIMIT $2";
export const getAvailability =
  "SELECT weekday,start_time,end_time FROM doctor_availability WHERE doctor_id=$1 ORDER BY weekday,start_time";
export const updateDoctor =
  "UPDATE users SET name=$1,email=$2,password_hash=COALESCE($3,password_hash),updated_at=NOW() WHERE id=$4";
export const updateDoctorRole =
  "UPDATE doctors SET sex=$1,speciality=$2 WHERE user_id=$3";
export const setDisabled =
  "UPDATE users SET is_disabled=$1,updated_at=NOW() WHERE id=$2 AND EXISTS(SELECT $3 FROM doctors WHERE user_id=users.id)";
export const upcomingAppointment = `SELECT a.id,a.patient_id,a.beneficiary_patient_id,a.doctor_id,a.appointment_date,a.start_time,a.end_time,a.status,pu.name patient_name,pu.email patient_email,du.name doctor_name,d.speciality
  FROM appointments a JOIN users pu ON pu.id=a.patient_id JOIN users du ON du.id=a.doctor_id JOIN doctors d ON d.user_id=a.doctor_id
  WHERE a.patient_id=$1 AND a.doctor_id=$2 AND a.status IN ($3,$4) AND (a.appointment_date>CURRENT_DATE OR (a.appointment_date=CURRENT_DATE AND a.start_time>LOCALTIME))
  ORDER BY a.appointment_date,a.start_time LIMIT $5`;
export const appointmentById = `SELECT a.id,a.patient_id,a.beneficiary_patient_id,a.doctor_id,a.appointment_date,a.start_time,a.end_time,a.status,pu.name patient_name,pu.email patient_email,du.name doctor_name,d.speciality
  FROM appointments a JOIN users pu ON pu.id=a.patient_id JOIN users du ON du.id=a.doctor_id JOIN doctors d ON d.user_id=a.doctor_id WHERE a.id=$1 LIMIT $2`;
export const doctorAvailabilityForDate =
  "SELECT start_time,end_time FROM doctor_availability WHERE doctor_id=$1 AND weekday=$2 ORDER BY start_time";
export const activeDoctorSlotsForDate =
  "SELECT start_time FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND status IN ($3,$4)";
export const activePatientSlotsForDate =
  "SELECT start_time FROM appointments WHERE patient_id=$1 AND appointment_date=$2 AND status IN ($3,$4)";
export const rescheduleAppointment =
  "UPDATE appointments SET appointment_date=$1,start_time=$2,end_time=$3,active_doctor_slot_key=$4,active_patient_slot_key=$5,status=$6,updated_at=NOW() WHERE id=$7 AND status IN ($8,$9)";
