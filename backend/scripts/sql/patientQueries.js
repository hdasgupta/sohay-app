export const createPatientUser = 'INSERT INTO users(name,email,password_hash,is_disabled) VALUES($1,$2,$3,$4) RETURNING id';
export const createPatientRole = 'INSERT INTO patients(user_id,sex,date_of_birth,contact_number) VALUES($1,$2,$3,$4)';
export const familyMemberships = `SELECT f.id family_id,f.family_name,f.created_by,f.created_at,fm.patient_id,pu.name patient_name,pu.email patient_email
  FROM family_memberships fm JOIN families f ON f.id=fm.family_id JOIN users pu ON pu.id=fm.patient_id
  WHERE fm.family_id IN (SELECT family_id FROM family_memberships WHERE patient_id=$1) ORDER BY f.id,fm.patient_id`;
export const createFamily = 'INSERT INTO families(created_by,family_name) VALUES($1,$2) RETURNING id';
export const addFamilyMember = 'INSERT INTO family_memberships(family_id,patient_id) VALUES($1,$2) ON CONFLICT DO NOTHING';
export const isFamilyMember = 'SELECT $1::bigint IN (SELECT family_id FROM family_memberships WHERE patient_id=$2) AS member';
export const sameFamilyMember = 'SELECT EXISTS(SELECT $1 FROM family_memberships mine JOIN family_memberships other ON other.family_id=mine.family_id WHERE mine.patient_id=$2 AND other.patient_id=$3) AS member';
export const activeDoctorById = 'SELECT u.id,u.name,u.email,d.speciality FROM users u JOIN doctors d ON d.user_id=u.id WHERE u.id=$1 AND u.is_disabled=$2 LIMIT $3';
export const patientByEmail = 'SELECT p.user_id,u.name,u.email FROM users u JOIN patients p ON p.user_id=u.id WHERE u.email=$1 AND u.is_disabled=$2 LIMIT $3';
export const familyInvitation = 'INSERT INTO family_invitations(family_id,inviter_patient_id,invitee_patient_id,status) VALUES($1,$2,$3,$4) RETURNING id';
export const pendingInvitations = `SELECT fi.id,fi.family_id,iu.name inviter_name,iu.email inviter_email,fi.status,fi.created_at,f.family_name
  FROM family_invitations fi JOIN families f ON f.id=fi.family_id JOIN users iu ON iu.id=fi.inviter_patient_id WHERE fi.invitee_patient_id=$1 AND fi.status=$2 ORDER BY fi.created_at DESC`;
export const invitationById = `SELECT fi.id,fi.family_id,iu.email inviter_email,eu.name invitee_name,eu.email invitee_email,fi.status
  FROM family_invitations fi JOIN users iu ON iu.id=fi.inviter_patient_id JOIN users eu ON eu.id=fi.invitee_patient_id WHERE fi.id=$1 LIMIT $2`;
export const updateInvitationStatus = 'UPDATE family_invitations SET status=$1,responded_at=NOW() WHERE id=$2 AND invitee_patient_id=$3 AND status=$4';
export const doctorAvailabilityForDate = 'SELECT start_time,end_time FROM doctor_availability WHERE doctor_id=$1 AND weekday=$2 ORDER BY start_time';
export const activeDoctorSlotsForDate = 'SELECT start_time FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND status IN ($3,$4)';
export const activePatientSlotsForDate = 'SELECT start_time FROM appointments WHERE patient_id=$1 AND appointment_date=$2 AND status IN ($3,$4)';
export const createAppointment = 'INSERT INTO appointments(patient_id,beneficiary_patient_id,doctor_id,appointment_date,start_time,end_time,status,room_id,active_doctor_slot_key,active_patient_slot_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id';
export const appointmentBookingInfo = `SELECT a.id,a.room_id,pu.name patient_name,pu.email patient_email,du.name doctor_name,d.speciality
  FROM appointments a JOIN users pu ON pu.id=a.patient_id JOIN users du ON du.id=a.doctor_id JOIN doctors d ON d.user_id=a.doctor_id WHERE a.id=$1 LIMIT $2`;
export const patientAppointments = `SELECT a.id,a.appointment_date,a.start_time,a.end_time,a.status,a.room_id,du.name doctor_name,d.speciality,
  bu.name beneficiary_name,pres.id prescription_id FROM appointments a JOIN users du ON du.id=a.doctor_id JOIN doctors d ON d.user_id=a.doctor_id
  JOIN users bu ON bu.id=a.beneficiary_patient_id LEFT JOIN prescriptions pres ON pres.appointment_id=a.id WHERE a.patient_id=$1 ORDER BY a.appointment_date DESC,a.start_time DESC`;
export const cancelAppointment = 'UPDATE appointments SET status=$1,active_doctor_slot_key=NULL,active_patient_slot_key=NULL,updated_at=NOW() WHERE id=$2 AND patient_id=$3 AND status IN ($4,$5) AND (appointment_date>CURRENT_DATE OR (appointment_date=CURRENT_DATE AND start_time>LOCALTIME))';
export const prescriptionByPatient = `SELECT p.id,p.patient_id,p.doctor_id,p.pdf_key FROM prescriptions p JOIN appointments a ON a.id=p.appointment_id WHERE p.id=$1 AND (a.patient_id=$2 OR a.beneficiary_patient_id=$2) LIMIT $3`;
