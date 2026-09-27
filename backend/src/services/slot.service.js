/** Available 30-min slots for a doctor on a date, excluding doctor and patient conflicts. */
import { query } from "../config/db.js";
import { COMMON_SQL } from "../scripts/common.sql.js";
import AppError from "../utils/AppError.js";
import { expandRanges } from "../utils/slots.js";
import {
  isValidIsoDate,
  weekdayOf,
  nowInKolkata,
  normaliseTime,
  isFutureSlot,
  minutesToTime,
  timeToMinutes,
} from "../utils/date.js";
import { SLOT_MINUTES } from "../config/constants.js";

export async function getDoctorForBooking(doctorId) {
  const { rows } = await query(COMMON_SQL.DOCTOR_PROFILE_BY_ID, [doctorId]);
  if (!rows.length) throw AppError.notFound("Doctor not found");
  if (rows[0].is_disabled)
    throw AppError.badRequest("This doctor is not available");
  return rows[0];
}

/**
 * @returns {Promise<string[]>} list of 'HH:MM' slot start times
 */
export async function availableSlots({
  doctorId,
  date,
  patientId = null,
  excludeAppointmentId = 0,
}) {
  if (!isValidIsoDate(date)) throw AppError.badRequest("Invalid date");
  const now = nowInKolkata();
  if (date < now.date) return [];
  const weekday = weekdayOf(date);
  const { rows: ranges } = await query(
    COMMON_SQL.AVAILABILITY_FOR_DOCTOR_WEEKDAY,
    [doctorId, weekday],
  );
  if (!ranges.length) return [];
  let slots = expandRanges(ranges);
  const excludeId = excludeAppointmentId || 0;
  const { rows: doctorBusy } = await query(COMMON_SQL.DOCTOR_BOOKED_STARTS, [
    doctorId,
    date,
    true,
    excludeId,
  ]);
  const busy = new Set(doctorBusy.map((r) => normaliseTime(r.start_time)));
  if (patientId) {
    const { rows: patientBusy } = await query(
      COMMON_SQL.PATIENT_BOOKED_STARTS,
      [patientId, date, true, excludeId],
    );
    patientBusy.forEach((r) => busy.add(normaliseTime(r.start_time)));
  }
  slots = slots.filter((s) => !busy.has(s) && isFutureSlot(date, s, now));
  return slots;
}

export const slotEnd = (start) =>
  minutesToTime(timeToMinutes(start) + SLOT_MINUTES);

/** Throws if the slot is not bookable for this doctor/patient */
export async function assertSlotBookable({
  doctorId,
  patientId,
  date,
  startTime,
  excludeAppointmentId = 0,
}) {
  const slots = await availableSlots({
    doctorId,
    date,
    patientId,
    excludeAppointmentId,
  });
  if (!slots.includes(normaliseTime(startTime))) {
    throw AppError.conflict(
      "Selected time slot is no longer available. Please choose another slot",
    );
  }
}
