import { query, queryOne, withTransaction } from '../config/db.js';
import {
  INSERT_MEDICINE_IF_MISSING,
  INSERT_PRESCRIPTION,
  INSERT_PRESCRIPTION_MEDICINE,
  SELECT_APPOINTMENTS_FOR_DOCTOR,
  SELECT_PRESCRIPTION_BY_APPOINTMENT,
  SELECT_PRESCRIPTION_FOR_DOWNLOAD,
  SELECT_TODAY_APPOINTMENTS_FOR_DOCTOR,
} from '../scripts/doctor.sql.js';
import { SELECT_APPOINTMENT_BY_ID, UPDATE_APPOINTMENT_STATUS } from '../scripts/appointment.sql.js';
import { SELECT_DOCTOR_PROFILE_BY_ID, SEARCH_MEDICINES_BY_NAME } from '../scripts/common.sql.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { TIME_FORMAT } from '../utils/slots.js';
import { calculateAge, prettyDate, todayISO, toISODate } from '../utils/dates.js';
import { toAppointment } from '../models/appointmentModel.js';
import { toPrescriptionMedicineRow } from '../models/prescriptionModel.js';
import { ACTIVE_STATUSES } from './slotService.js';
import { buildPrescriptionPdf } from '../utils/pdf.js';
import { buildSignedUrl, uploadPdf } from '../utils/s3.js';
import { prescriptionEmail, sendMail } from '../utils/mailer.js';
import { env } from '../config/env.js';

const FOOD_VALUES = ['BEFORE_FOOD', 'WITH_FOOD', 'AFTER_FOOD'];
const STATUS_COMPLETED = 'COMPLETED';
const MEDICINE_SEARCH_LIMIT = 20;

export const listAppointmentsForDoctor = async (doctorId) => {
  const result = await query(SELECT_APPOINTMENTS_FOR_DOCTOR, [TIME_FORMAT, doctorId]);
  return result.rows.map(toAppointment);
};

export const listTodayPatients = async (doctorId) => {
  const result = await query(SELECT_TODAY_APPOINTMENTS_FOR_DOCTOR, [
    TIME_FORMAT,
    doctorId,
    todayISO(),
    ACTIVE_STATUSES,
  ]);
  return result.rows.map((row) => ({
    appointmentId: Number(row.id),
    patientId: Number(row.patient_id),
    patientName: row.patient_name,
    startTime: row.start_time,
    status: row.status,
    dateOfBirth: toISODate(row.date_of_birth),
    age: calculateAge(row.date_of_birth),
    prescriptionId: row.prescription_id ? Number(row.prescription_id) : null,
  }));
};

export const searchMedicines = async (term) => {
  const value = String(term || '').trim();
  if (value.length < 2) return [];
  const result = await query(SEARCH_MEDICINES_BY_NAME, [`%${value}%`, MEDICINE_SEARCH_LIMIT]);
  return result.rows.map((row) => ({ id: Number(row.id), name: row.name }));
};

const validateMedicines = (medicines) => {
  if (!Array.isArray(medicines) || medicines.length === 0) {
    throw badRequest('Add at least one medicine before generating the prescription');
  }
  return medicines.map((medicine, index) => {
    if (!medicine.medicineName || !String(medicine.medicineName).trim()) {
      throw badRequest(`Medicine name is missing at row ${index + 1}`);
    }
    if (!medicine.dose || !String(medicine.dose).trim()) {
      throw badRequest(`Dose is missing for ${medicine.medicineName}`);
    }
    if (!FOOD_VALUES.includes(medicine.food)) {
      throw badRequest(`Food instruction for ${medicine.medicineName} must be one of ${FOOD_VALUES.join(', ')}`);
    }
    const anyTiming = medicine.morning || medicine.afternoon || medicine.evening || medicine.night || medicine.sos;
    if (!anyTiming) throw badRequest(`Choose at least one timing for ${medicine.medicineName}`);
    return {
      medicineName: String(medicine.medicineName).trim(),
      dose: String(medicine.dose).trim(),
      conditionNote: medicine.conditionNote ? String(medicine.conditionNote).trim() : null,
      morning: Boolean(medicine.morning),
      afternoon: Boolean(medicine.afternoon),
      evening: Boolean(medicine.evening),
      night: Boolean(medicine.night),
      sos: Boolean(medicine.sos),
      food: medicine.food,
    };
  });
};

export const generatePrescription = async ({ doctorId, appointmentId, age, advice, medicines }) => {
  const doctor = await queryOne(SELECT_DOCTOR_PROFILE_BY_ID, [doctorId]);
  if (!doctor) throw notFound('Doctor profile not found');

  const appointment = await queryOne(SELECT_APPOINTMENT_BY_ID, [TIME_FORMAT, appointmentId]);
  if (!appointment) throw notFound('Appointment not found');
  if (Number(appointment.doctor_id) !== Number(doctorId)) {
    throw forbidden('This appointment does not belong to you');
  }
  const existing = await queryOne(SELECT_PRESCRIPTION_BY_APPOINTMENT, [appointmentId]);
  if (existing) throw badRequest('A prescription has already been generated for this appointment');

  const rows = validateMedicines(medicines);
  const patientAge = Number.isFinite(Number(age)) ? Number(age) : calculateAge(appointment.date_of_birth);
  const dateISO = todayISO();

  const pdfBuffer = await buildPrescriptionPdf({
    doctor: { name: doctor.name, speciality: doctor.speciality },
    patient: { name: appointment.patient_name },
    age: patientAge,
    dateISO,
    advice: advice || null,
    medicines: rows.map((row) => ({
      medicine_name: row.medicineName,
      dose: row.dose,
      condition_note: row.conditionNote,
      take_morning: row.morning,
      take_afternoon: row.afternoon,
      take_evening: row.evening,
      take_night: row.night,
      is_sos: row.sos,
      food: row.food,
    })),
  });

  const key = `prescriptions/${dateISO}/appointment-${appointmentId}-${Date.now()}.pdf`;
  const uploaded = await uploadPdf({ key, body: pdfBuffer });

  const prescription = await withTransaction(async (client) => {
    const result = await client.query(INSERT_PRESCRIPTION, [
      appointmentId,
      doctorId,
      appointment.patient_id,
      patientAge,
      advice || null,
      uploaded.key,
      uploaded.url,
    ]);
    const created = result.rows[0];
    let position = 0;
    for (const row of rows) {
      await client.query(INSERT_MEDICINE_IF_MISSING, [row.medicineName]);
      await client.query(INSERT_PRESCRIPTION_MEDICINE, [
        created.id,
        ...toPrescriptionMedicineRow(row, position),
      ]);
      position += 1;
    }
    await client.query(UPDATE_APPOINTMENT_STATUS, [appointmentId, STATUS_COMPLETED, ACTIVE_STATUSES]);
    return created;
  });

  await sendMail({
    to: appointment.patient_email,
    subject: `${env.org.name} - prescription from Dr. ${doctor.name}`,
    html: prescriptionEmail({
      patientName: appointment.patient_name,
      doctorName: doctor.name,
      date: prettyDate(dateISO),
      pdfUrl: uploaded.url,
    }),
  });

  console.log(`[doctor] prescription ${prescription.id} generated for appointment ${appointmentId}`);
  return { id: Number(prescription.id), pdfUrl: uploaded.url };
};

/** Fresh (re-signed) download url, guarded by ownership. */
export const getPrescriptionUrl = async ({ prescriptionId, user }) => {
  const row = await queryOne(SELECT_PRESCRIPTION_FOR_DOWNLOAD, [prescriptionId]);
  if (!row) throw notFound('Prescription not found');
  const allowed =
    user.role === 'ADMIN' ||
    Number(row.doctor_id) === Number(user.id) ||
    Number(row.patient_id) === Number(user.id) ||
    Number(row.booked_by_id) === Number(user.id);
  if (!allowed) throw forbidden('You cannot download this prescription');
  const url = await buildSignedUrl(row.pdf_key);
  return { url };
};
