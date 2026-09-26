import { ACTIVE_APPOINTMENT_STATUSES } from "../config/constants.js";
import { isFutureSlot, normaliseTime, ageOn } from "./date.js";

export function appointmentDto(r) {
  if (!r) return null;
  const startTime = normaliseTime(r.start_time);
  const upcoming =
    ACTIVE_APPOINTMENT_STATUSES.includes(r.status) &&
    isFutureSlot(r.appointment_date, startTime);
  return {
    id: Number(r.id),
    patientId: Number(r.patient_id),
    patientName: r.patient_name,
    patientEmail: r.patient_email,
    doctorId: Number(r.doctor_id),
    doctorName: r.doctor_name,
    doctorEmail: r.doctor_email,
    doctorSpeciality: r.doctor_speciality,
    bookedById: Number(r.booked_by),
    bookedByName: r.booked_by_name,
    date: r.appointment_date,
    startTime,
    endTime: normaliseTime(r.end_time),
    status: r.status,
    roomId: r.room_id,
    rescheduleCount: r.reschedule_count,
    hasPrescription: Boolean(r.prescription_id),
    isUpcoming: upcoming,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function doctorDto(r, availability = []) {
  return {
    id: Number(r.id),
    name: r.name,
    email: r.email,
    sex: r.sex,
    speciality: r.speciality,
    isDisabled: Boolean(r.is_disabled),
    hasSignature: r.has_signature ?? Boolean(r.signature),
    createdAt: r.created_at,
    availability,
    weekdays: [...new Set(availability.map((a) => a.weekday))].sort(),
  };
}

export function patientDto(r) {
  return {
    id: Number(r.id),
    name: r.name,
    email: r.email,
    sex: r.sex,
    dateOfBirth: r.date_of_birth,
    age: r.date_of_birth ? ageOn(r.date_of_birth) : null,
    contactNumber: r.contact_number,
    isDisabled:
      r.is_disabled === undefined ? undefined : Boolean(r.is_disabled),
  };
}
