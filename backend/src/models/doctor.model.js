/** Data access for doctor features */
import { query } from '../config/db.js';
import { DOCTOR_SQL } from '../scripts/doctor.sql.js';

export const appointmentsForDoctor = async (doctorId) => (await query(DOCTOR_SQL.APPOINTMENTS_FOR_DOCTOR, [doctorId])).rows;
export const todayOpenAppointments = async (doctorId, today, statuses) =>
  (await query(DOCTOR_SQL.TODAY_OPEN_APPOINTMENTS, [doctorId, today, statuses])).rows;
export const lockAppointment = async (client, appointmentId, doctorId) =>
  (await client.query(DOCTOR_SQL.APPOINTMENT_LOCK_FOR_DOCTOR, [appointmentId, doctorId])).rows[0] || null;
export const markCompleted = async (client, { appointmentId, status, doctorId, allowedStatuses }) =>
  (await client.query(DOCTOR_SQL.APPOINTMENT_MARK_COMPLETED, [appointmentId, status, doctorId, allowedStatuses])).rows[0] || null;
export const searchMedicines = async (contains, prefix, limit) => (await query(DOCTOR_SQL.MEDICINE_SEARCH, [contains, prefix, limit])).rows;
export const updateSignature = (doctorId, signature) => query(DOCTOR_SQL.SIGNATURE_UPDATE, [doctorId, signature]);

export const insertPrescription = async (client, p) =>
  (await client.query(DOCTOR_SQL.PRESCRIPTION_INSERT, [p.appointmentId, p.doctorId, p.patientId, p.patientName, p.patientAge, p.prescribedOn, p.notes])).rows[0];
export const insertPrescriptionItems = (client, prescriptionId, items) => client.query(DOCTOR_SQL.PRESCRIPTION_ITEMS_INSERT, [
  prescriptionId,
  items.map((_, i) => i + 1),
  items.map((i) => i.medicineName),
  items.map((i) => i.dose),
  items.map((i) => i.instructions || null),
  items.map((i) => Boolean(i.morning)),
  items.map((i) => Boolean(i.afternoon)),
  items.map((i) => Boolean(i.evening)),
  items.map((i) => Boolean(i.night)),
  items.map((i) => Boolean(i.sos)),
  items.map((i) => i.foodTiming),
]);
export const setPrescriptionPdf = (client, id, key, url) => client.query(DOCTOR_SQL.PRESCRIPTION_SET_PDF, [id, key, url]);
