import { Router } from 'express';
import h from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import * as c from '../controllers/admin.controller.js';

const r = Router();
r.use(authenticate, authorize(ROLES.ADMIN));
r.get('/doctors', h(c.listDoctors));
r.post('/doctors', h(c.createDoctor));
r.get('/doctors/:id', h(c.getDoctor));
r.put('/doctors/:id', h(c.updateDoctor));
r.patch('/doctors/:id/status', h(c.setDoctorStatus));
r.get('/patients', h(c.listPatients));
r.get('/appointments/upcoming', h(c.upcomingAppointments));
r.get('/slots', h(c.slotsForReschedule));
r.put('/appointments/:id/reschedule', h(c.reschedule));
export default r;
