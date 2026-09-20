export const doctorAppointments = `SELECT a.id,a.appointment_date,a.start_time,a.end_time,a.status,pu.name patient_name,pu.email patient_email,p.date_of_birth,a.room_id
  FROM appointments a JOIN users pu ON pu.id=a.beneficiary_patient_id JOIN patients p ON p.user_id=a.beneficiary_patient_id WHERE a.doctor_id=$1 ORDER BY a.appointment_date DESC,a.start_time DESC`;
export const todayPatients = `SELECT DISTINCT ON (pu.id) a.id appointment_id,pu.id patient_id,pu.name,pu.email,p.date_of_birth
  FROM appointments a JOIN users pu ON pu.id=a.beneficiary_patient_id JOIN patients p ON p.user_id=pu.id WHERE a.doctor_id=$1 AND a.appointment_date=CURRENT_DATE AND a.status IN ($2,$3) ORDER BY pu.id,a.start_time`;
export const todayAppointment = `SELECT a.id,a.patient_id,a.beneficiary_patient_id,a.doctor_id,a.appointment_date,a.status,pu.name beneficiary_name,p.date_of_birth,du.name doctor_name,d.speciality
  FROM appointments a JOIN users pu ON pu.id=a.beneficiary_patient_id JOIN patients p ON p.user_id=a.beneficiary_patient_id JOIN users du ON du.id=a.doctor_id JOIN doctors d ON d.user_id=a.doctor_id
  WHERE a.id=$1 AND a.doctor_id=$2 AND a.appointment_date=CURRENT_DATE AND a.status IN ($3,$4) LIMIT $5`;
export const medicineCount = 'SELECT COUNT(*)::int AS count FROM medicines';
export const medicineSearch = 'SELECT id,name FROM medicines WHERE LOWER(name) LIKE LOWER($1) ORDER BY name LIMIT $2';
export const insertMedicine = 'INSERT INTO medicines(name) VALUES($1) ON CONFLICT(name) DO NOTHING';
export const createPrescription = 'INSERT INTO prescriptions(appointment_id,doctor_id,patient_id,patient_age,issued_on,pdf_key,pdf_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id';
export const createPrescriptionMedicine = 'INSERT INTO prescription_medicines(prescription_id,medicine_name,dose,instruction,timing,sos,food_timing,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8)';
export const prescription = `SELECT pr.id,pr.appointment_id,pr.doctor_id,pr.patient_id,pr.patient_age,pr.issued_on,pr.pdf_key,pr.pdf_url,du.name doctor_name,d.speciality,pu.name patient_name
  FROM prescriptions pr JOIN users du ON du.id=pr.doctor_id JOIN doctors d ON d.user_id=pr.doctor_id JOIN users pu ON pu.id=pr.patient_id WHERE pr.id=$1 LIMIT $2`;
export const prescriptionMedicines = 'SELECT medicine_name,dose,instruction,timing,sos,food_timing,sort_order FROM prescription_medicines WHERE prescription_id=$1 ORDER BY sort_order';
export const prescriptionOwner = 'SELECT id,patient_id,doctor_id,pdf_key,pdf_url FROM prescriptions WHERE id=$1 LIMIT $2';
export const updatePrescriptionPdfUrl = 'UPDATE prescriptions SET pdf_url=$1 WHERE id=$2';
export const completeAppointment = 'UPDATE appointments SET status=$1,active_doctor_slot_key=NULL,active_patient_slot_key=NULL,updated_at=NOW() WHERE id=$2';
