import { query, queryOne } from '../config/db.js';
import {
  COUNT_SLOT_CONFLICTS,
  SELECT_BOOKED_SLOTS_FOR_DOCTOR_ON_DATE,
  SELECT_BOOKED_SLOTS_FOR_PATIENT_ON_DATE,
  SELECT_DOCTOR_AVAILABILITY_FOR_WEEKDAY,
} from '../scripts/appointment.sql.js';
import { TIME_FORMAT, endOfSlot, expandWindows, timeToMinutes } from '../utils/slots.js';
import { nowTime, todayISO, weekdayOf } from '../utils/dates.js';
import { conflict } from '../utils/httpError.js';

/** Statuses that occupy a slot. */
export const ACTIVE_STATUSES = ['SCHEDULED', 'RESCHEDULED'];
const NOT_DISABLED = false;

/**
 * Free 30 minute slots of a doctor on a date, also excluding slots where the
 * patient is already engaged with any doctor.
 */
export const getAvailableSlots = async ({ doctorId, patientId, date, ignoreAppointmentId = null }) => {
  const weekday = weekdayOf(date);
  const availability = await query(SELECT_DOCTOR_AVAILABILITY_FOR_WEEKDAY, [
    TIME_FORMAT,
    doctorId,
    weekday,
    NOT_DISABLED,
  ]);
  let slots = expandWindows(availability.rows);

  const doctorBooked = await query(SELECT_BOOKED_SLOTS_FOR_DOCTOR_ON_DATE, [
    TIME_FORMAT,
    doctorId,
    date,
    ACTIVE_STATUSES,
    ignoreAppointmentId,
  ]);
  const doctorBusy = new Set(doctorBooked.rows.map((row) => row.start_time));
  slots = slots.filter((slot) => !doctorBusy.has(slot));

  if (patientId) {
    const patientBooked = await query(SELECT_BOOKED_SLOTS_FOR_PATIENT_ON_DATE, [
      TIME_FORMAT,
      patientId,
      date,
      ACTIVE_STATUSES,
      ignoreAppointmentId,
    ]);
    const patientBusy = new Set(patientBooked.rows.map((row) => row.start_time));
    slots = slots.filter((slot) => !patientBusy.has(slot));
  }

  // Never offer a slot in the past for today.
  if (date === todayISO()) {
    const current = timeToMinutes(nowTime());
    slots = slots.filter((slot) => timeToMinutes(slot) > current);
  }

  console.log(`[slots] doctor=${doctorId} date=${date} available=${slots.length}`);
  return slots.map((slot) => ({ startTime: slot, endTime: endOfSlot(slot) }));
};

/** Hard guard executed right before insert / update. */
export const assertSlotFree = async ({ doctorId, patientId, date, startTime, ignoreAppointmentId = null }) => {
  const row = await queryOne(COUNT_SLOT_CONFLICTS, [
    date,
    startTime,
    ACTIVE_STATUSES,
    doctorId,
    patientId,
    ignoreAppointmentId,
  ]);
  if (Number(row.total) > 0) {
    console.warn(`[slots] conflict for doctor=${doctorId} patient=${patientId} ${date} ${startTime}`);
    throw conflict('That time slot is no longer free for the doctor or the patient');
  }
};
