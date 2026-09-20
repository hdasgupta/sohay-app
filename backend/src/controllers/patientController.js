import * as patientService from '../services/patientService.js';
import { getAvailableSlots } from '../services/slotService.js';
import { assertISODate, assertSlot, requireFields } from '../middleware/validate.js';

export const getFamily = async (req, res) => {
  const data = await patientService.getFamilyOverview(req.user.id);
  res.json({ success: true, data });
};

export const createFamily = async (req, res) => {
  requireFields(req.body, ['name']);
  const data = await patientService.createFamily({ patientId: req.user.id, name: String(req.body.name).trim() });
  res.status(201).json({ success: true, message: `Family "${data.name}" created`, data });
};

export const searchInvitable = async (req, res) => {
  const data = await patientService.searchInvitablePatients({
    patientId: req.user.id,
    search: req.query.search || null,
  });
  res.json({ success: true, data });
};

export const invitePatient = async (req, res) => {
  requireFields(req.body, ['inviteeId']);
  await patientService.invitePatient({ patientId: req.user.id, inviteeId: req.body.inviteeId });
  res.status(201).json({ success: true, message: 'Invitation sent and notification email triggered' });
};

export const respondToInvitation = async (req, res) => {
  const accept = String(req.body.accept) === 'true' || req.body.accept === true;
  const data = await patientService.respondToInvitation({
    patientId: req.user.id,
    invitationId: req.params.invitationId,
    accept,
  });
  res.json({ success: true, message: `Invitation ${accept ? 'accepted' : 'rejected'}`, data });
};

export const listBookableMembers = async (req, res) => {
  const data = await patientService.listBookablePatients(req.user.id);
  res.json({ success: true, data });
};

export const getSlots = async (req, res) => {
  requireFields(req.query, ['doctorId', 'date', 'forPatientId']);
  const data = await getAvailableSlots({
    doctorId: req.query.doctorId,
    patientId: req.query.forPatientId,
    date: assertISODate(req.query.date),
  });
  res.json({ success: true, data });
};

export const bookAppointment = async (req, res) => {
  requireFields(req.body, ['doctorId', 'forPatientId', 'date', 'startTime']);
  const data = await patientService.bookAppointment({
    bookedById: req.user.id,
    forPatientId: req.body.forPatientId,
    doctorId: req.body.doctorId,
    date: assertISODate(req.body.date),
    startTime: assertSlot(req.body.startTime),
  });
  res.status(201).json({
    success: true,
    message: 'Appointment booked. A confirmation email with the video link has been sent.',
    data,
  });
};

export const listAppointments = async (req, res) => {
  const data = await patientService.listAppointmentsForPatient(req.user.id);
  res.json({ success: true, data });
};

export const cancelAppointment = async (req, res) => {
  const data = await patientService.cancelAppointment({
    patientId: req.user.id,
    appointmentId: req.params.appointmentId,
  });
  res.json({ success: true, message: 'Appointment cancelled', data });
};
