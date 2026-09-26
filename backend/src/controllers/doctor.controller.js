/** Doctor: appointments, medicines, signature, prescriptions */
import { withTransaction } from "../config/db.js";
import AppError from "../utils/AppError.js";
import { ok, created } from "../utils/response.js";
import logger from "../utils/logger.js";
import { cleanString, toId, escapeLike } from "../utils/validators.js";
import { appointmentDto } from "../utils/serializers.js";
import {
  APPOINTMENT_STATUS,
  ACTIVE_APPOINTMENT_STATUSES,
  FOOD_TIMING,
} from "../config/constants.js";
import { todayInKolkata, ageOn, normaliseTime } from "../utils/date.js";
import {
  buildPrescriptionPdf,
  dataUrlToBuffer,
} from "../services/pdf.service.js";
import { putPrescription } from "../services/storage.service.js";
import * as common from "../models/common.model.js";
import * as doctorModel from "../models/doctor.model.js";

const MAX_SIGNATURE_LENGTH = 700 * 1024;

export async function listAppointments(req, res) {
  ok(
    res,
    (await doctorModel.appointmentsForDoctor(req.user.id)).map(appointmentDto),
  );
}

export async function todayAppointments(req, res) {
  const today = todayInKolkata();
  const rows = await doctorModel.todayOpenAppointments(
    req.user.id,
    today,
    ACTIVE_APPOINTMENT_STATUSES,
  );
  ok(
    res,
    rows.map((r) => ({
      appointmentId: Number(r.id),
      patientId: Number(r.patient_id),
      patientName: r.patient_name,
      patientEmail: r.patient_email,
      patientSex: r.patient_sex,
      dateOfBirth: r.date_of_birth,
      age: ageOn(r.date_of_birth, today),
      date: r.appointment_date,
      startTime: normaliseTime(r.start_time),
      endTime: normaliseTime(r.end_time),
      status: r.status,
    })),
  );
}

export async function searchMedicines(req, res) {
  const q = cleanString(req.query.q, 80);
  if (q.length < 2) return ok(res, []);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const e = escapeLike(q);
  const rows = await doctorModel.searchMedicines(`%${e}%`, `${e}%`, limit);
  return ok(
    res,
    rows.map((r) => ({ id: Number(r.id), name: r.name })),
  );
}

export async function profile(req, res) {
  const d = await common.getDoctorProfile(req.user.id);
  ok(res, {
    id: Number(d.id),
    name: d.name,
    email: d.email,
    speciality: d.speciality,
    sex: d.sex,
    signature: d.signature,
  });
}

export async function saveSignature(req, res) {
  const { signature } = req.body || {};
  if (
    typeof signature !== "string" ||
    signature.length > MAX_SIGNATURE_LENGTH ||
    !dataUrlToBuffer(signature)
  ) {
    throw AppError.badRequest(
      "Signature must be a PNG or JPEG image smaller than 500 KB",
    );
  }
  await doctorModel.updateSignature(req.user.id, signature);
  ok(res, null, "Signature saved");
}

function readItems(items) {
  if (!Array.isArray(items) || items.length === 0)
    throw AppError.badRequest("Add at least one medicine");
  if (items.length > 40)
    throw AppError.badRequest(
      "A prescription can contain at most 40 medicines",
    );
  const foods = Object.values(FOOD_TIMING);
  return items.map((it, i) => {
    const medicineName = cleanString(it.medicineName, 255);
    const dose = cleanString(it.dose, 120);
    const instructions = cleanString(it.instructions, 500);
    if (!medicineName)
      throw AppError.badRequest(`Medicine #${i + 1}: name is required`);
    if (!dose)
      throw AppError.badRequest(`Medicine #${i + 1}: dose is required`);
    if (!foods.includes(it.foodTiming))
      throw AppError.badRequest(
        `Medicine #${i + 1}: choose before / with / after food`,
      );
    const t = {
      morning: !!it.morning,
      afternoon: !!it.afternoon,
      evening: !!it.evening,
      night: !!it.night,
      sos: !!it.sos,
    };
    if (!Object.values(t).some(Boolean))
      throw AppError.badRequest(
        `Medicine #${i + 1}: choose at least one time (morning / afternoon / evening / night / SOS)`,
      );
    return {
      medicineName,
      dose,
      instructions,
      foodTiming: it.foodTiming,
      ...t,
    };
  });
}

export async function createPrescription(req, res) {
  const appointmentId = toId(req.body.appointmentId, "appointment id");
  const age = Number(req.body.patientAge);
  if (!Number.isInteger(age) || age < 0 || age > 150)
    throw AppError.badRequest("Age must be a whole number between 0 and 150");
  const items = readItems(req.body.items);
  const notes = cleanString(req.body.notes, 2000) || null;
  const doctor = await common.getDoctorProfile(req.user.id);
  if (!doctor.signature)
    throw AppError.badRequest(
      "Please add your signature before generating a prescription",
    );
  const today = todayInKolkata();

  const result = await withTransaction(async (client) => {
    const appt = await doctorModel.lockAppointment(
      client,
      appointmentId,
      req.user.id,
    );
    if (!appt) throw AppError.notFound("Appointment not found");
    if (appt.status === APPOINTMENT_STATUS.COMPLETED)
      throw AppError.conflict(
        "Prescription already generated - the appointment is completed",
      );
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appt.status))
      throw AppError.badRequest(
        `A ${appt.status} appointment cannot be prescribed`,
      );
    if (appt.appointment_date !== today)
      throw AppError.badRequest(
        "Prescriptions can be generated only for today's appointments",
      );
    const patient = await common.getPatientProfile(appt.patient_id, client);
    const pres = await doctorModel.insertPrescription(client, {
      appointmentId,
      doctorId: req.user.id,
      patientId: appt.patient_id,
      patientName: patient.name,
      patientAge: age,
      prescribedOn: today,
      notes,
    });
    await doctorModel.insertPrescriptionItems(client, pres.id, items);
    const pdf = await buildPrescriptionPdf({
      prescriptionId: Number(pres.id),
      doctor: {
        name: doctor.name,
        speciality: doctor.speciality,
        signature: doctor.signature,
      },
      patient: { name: patient.name, age, sex: patient.sex },
      date: today,
      items,
      notes,
    });
    const key = `prescriptions/${today}/appointment-${appointmentId}-${Date.now()}.pdf`;
    const stored = await putPrescription(key, pdf);
    await doctorModel.setPrescriptionPdf(
      client,
      pres.id,
      stored.key,
      stored.url,
    );
    const done = await doctorModel.markCompleted(client, {
      appointmentId,
      status: APPOINTMENT_STATUS.COMPLETED,
      doctorId: req.user.id,
      allowedStatuses: ACTIVE_APPOINTMENT_STATUSES,
    });
    if (!done)
      throw AppError.conflict("Appointment status changed, please refresh");
    return {
      prescriptionId: Number(pres.id),
      pdfUrl: stored.url,
      appointmentId,
    };
  });
  logger.info(
    `Prescription ${result.prescriptionId} generated for appointment ${appointmentId}`,
  );
  created(
    res,
    result,
    "Prescription generated and appointment marked as completed",
  );
}
