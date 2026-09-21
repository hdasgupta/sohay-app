import { Router } from 'express';
import * as doctorController from '../controllers/doctorController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ROLES, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole(ROLES.DOCTOR));

router.get('/appointments', asyncHandler(doctorController.listAppointments));
router.get('/today-patients', asyncHandler(doctorController.listTodayPatients));
router.get('/medicines', asyncHandler(doctorController.searchMedicines));
router.post('/prescriptions', asyncHandler(doctorController.generatePrescription));

export default router;
