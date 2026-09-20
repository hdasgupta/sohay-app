import * as adminService from '../services/adminService.js';
import { getAvailableSlots } from '../services/slotService.js';
import { assertEnum, assertISODate, assertSlot, normalizeEmail, requireFields } from '../middleware/validate.js';
import { ALL_SLOT_ENDS, ALL_SLOT_STARTS } from '../utils/slots.js';

const SEX_VALUES = ['MALE', 'FEMALE', 'OTHER'];

export const getSlotCatalog = async (req, res) => {
  res.json({ success: true, data: { starts: ALL_SLOT_STARTS, ends: ALL_SLOT_ENDS } });
};

export const createDoctor = async (req, res) => {
  requireFields(req.body, ['name', 'sex', 'speciality', 'email', 'password', 'confirmPassword']);
  const data = await adminService.createDoctor({
    name: String(req.body.name).trim(),
    email: normalizeEmail(req.body.email),
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    sex: assertEnum(req.body.sex, SEX_VALUES, 'Sex'),
    speciality: String(req.body.speciality).trim(),
    availability: req.body.availability,
  });
  res.status(201).json({ success: true, message: `Doctor ${data.name} added successfully`, data });
};

export const updateDoctor = async (req, res) => {
  requireFields(req.body, ['name', 'sex', 'speciality']);
  const data = await adminService.updateDoctor({
    doctorId: req.params.doctorId,
    name: String(req.body.name).trim(),
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    sex: assertEnum(req.body.sex, SEX_VALUES, 'Sex'),
    speciality: String(req.body.speciality).trim(),
    availability: req.body.availability,
  });
  res.json({ success: true, message: 'Doctor updated successfully', data });
};

export const listDoctors = async (req, res) => {
  const data = await adminService.listDoctors({ search: req.query.search || null });
  res.json({ success: true, data });
};

export const getDoctor = async (req, res) => {
  const data = await adminService.getDoctor(req.params.doctorId);
  res.json({ success: true, data });
};

export const setDoctorDisabled = async (req, res) => {
  const disabled = String(req.body.disabled) === 'true' || req.body.disabled === true;
  const data = await adminService.setDoctorDisabled({ doctorId: req.params.doctorId, disabled });
  res.json({
    success: true,
    message: `Doctor ${data.name} has been ${data.isDisabled ? 'disabled' : 'enabled'}`,
    data,
  });
};

export const listDoctorOptions = async (req, res) => {
  const data = await adminService.listDoctorOptions();
  res.json({ success: true, data });
};

export const listPatientOptions = async (req, res) => {
  const data = await adminService.listPatientOptions();
  res.json({ success: true, data });
};

export const findUpcomingAppointment = async (req, res) => {
  requireFields(req.query, ['doctorId', 'patientId']);
  const data = await adminService.findUpcomingAppointment({
    doctorId: req.query.doctorId,
    patientId: req.query.patientId,
  });
  res.json({
    success: true,
    message: data ? 'Upcoming appointment found' : 'No upcoming appointment is available for this selection',
    data,
  });
};

export const getSlotsForReschedule = async (req, res) => {
  requireFields(req.query, ['doctorId', 'patientId', 'date']);
  const data = await getAvailableSlots({
    doctorId: req.query.doctorId,
    patientId: req.query.patientId,
    date: assertISODate(req.query.date),
    ignoreAppointmentId: req.query.appointmentId || null,
  });
  res.json({ success: true, data });
};

export const rescheduleAppointment = async (req, res) => {
  requireFields(req.body, ['date', 'startTime']);
  const data = await adminService.rescheduleAppointment({
    appointmentId: req.params.appointmentId,
    date: assertISODate(req.body.date),
    startTime: assertSlot(req.body.startTime),
  });
  res.json({ success: true, message: 'Appointment rescheduled successfully', data });
};
