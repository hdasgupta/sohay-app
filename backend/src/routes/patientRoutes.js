import { Router } from 'express';
import * as patientController from '../controllers/patientController.js';
import * as adminController from '../controllers/adminController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ROLES, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole(ROLES.PATIENT));

router.get('/family', asyncHandler(patientController.getFamily));
router.post('/family', asyncHandler(patientController.createFamily));
router.get('/family/invitable', asyncHandler(patientController.searchInvitable));
router.post('/family/invite', asyncHandler(patientController.invitePatient));
router.patch('/family/invitations/:invitationId', asyncHandler(patientController.respondToInvitation));

router.get('/doctors', asyncHandler(adminController.listDoctorOptions));
router.get('/bookable-members', asyncHandler(patientController.listBookableMembers));
router.get('/slots', asyncHandler(patientController.getSlots));
router.post('/appointments', asyncHandler(patientController.bookAppointment));
router.get('/appointments', asyncHandler(patientController.listAppointments));
router.patch('/appointments/:appointmentId/cancel', asyncHandler(patientController.cancelAppointment));

export default router;
