import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ROLES, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/slot-catalog', asyncHandler(adminController.getSlotCatalog));
router.post('/doctors', asyncHandler(adminController.createDoctor));
router.get('/doctors', asyncHandler(adminController.listDoctors));
router.get('/doctors/options', asyncHandler(adminController.listDoctorOptions));
router.get('/doctors/:doctorId', asyncHandler(adminController.getDoctor));
router.put('/doctors/:doctorId', asyncHandler(adminController.updateDoctor));
router.patch('/doctors/:doctorId/disabled', asyncHandler(adminController.setDoctorDisabled));
router.get('/patients/options', asyncHandler(adminController.listPatientOptions));
router.get('/appointments/upcoming', asyncHandler(adminController.findUpcomingAppointment));
router.get('/appointments/slots', asyncHandler(adminController.getSlotsForReschedule));
router.patch('/appointments/:appointmentId/reschedule', asyncHandler(adminController.rescheduleAppointment));

export default router;
