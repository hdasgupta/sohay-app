import * as doctorService from '../services/doctorService.js';
import { requireFields } from '../middleware/validate.js';

export const listAppointments = async (req, res) => {
  const data = await doctorService.listAppointmentsForDoctor(req.user.id);
  res.json({ success: true, data });
};

export const listTodayPatients = async (req, res) => {
  const data = await doctorService.listTodayPatients(req.user.id);
  res.json({
    success: true,
    message: data.length ? undefined : 'You have no appointment scheduled for today',
    data,
  });
};

export const searchMedicines = async (req, res) => {
  const data = await doctorService.searchMedicines(req.query.term);
  res.json({ success: true, data });
};

export const generatePrescription = async (req, res) => {
  requireFields(req.body, ['appointmentId', 'age']);
  const data = await doctorService.generatePrescription({
    doctorId: req.user.id,
    appointmentId: req.body.appointmentId,
    age: req.body.age,
    advice: req.body.advice,
    medicines: req.body.medicines,
  });
  res.status(201).json({ success: true, message: 'Prescription generated and stored', data });
};

export const getPrescriptionUrl = async (req, res) => {
  const data = await doctorService.getPrescriptionUrl({
    prescriptionId: req.params.prescriptionId,
    user: req.user,
  });
  res.json({ success: true, data });
};
