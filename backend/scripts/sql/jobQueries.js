export const cancelPastAppointments =
  "UPDATE appointments SET status=$1,active_doctor_slot_key=NULL,active_patient_slot_key=NULL,updated_at=NOW() WHERE status IN ($2,$3) AND (appointment_date<CURRENT_DATE OR (appointment_date=CURRENT_DATE AND end_time<=LOCALTIME))";
