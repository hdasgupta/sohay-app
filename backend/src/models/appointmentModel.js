import { toISODate } from '../utils/dates.js';

export const toAppointment = (row) => ({
  id: Number(row.id),
  date: toISODate(row.appointment_date),
  startTime: row.start_time,
  endTime: row.end_time,
  status: row.status,
  roomId: row.room_id,
  doctorId: row.doctor_id ? Number(row.doctor_id) : undefined,
  doctorName: row.doctor_name,
  speciality: row.speciality,
  patientId: row.patient_id ? Number(row.patient_id) : undefined,
  patientName: row.patient_name,
  patientEmail: row.patient_email,
  dateOfBirth: row.date_of_birth ? toISODate(row.date_of_birth) : undefined,
  prescriptionId: row.prescription_id ? Number(row.prescription_id) : null,
  prescriptionUrl: row.pdf_url || null,
});
