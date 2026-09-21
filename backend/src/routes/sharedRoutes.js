import { Router } from 'express';
import * as doctorController from '../controllers/doctorController.js';
import * as videoController from '../controllers/videoController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Prescription download + consultation room are used by more than one role.
router.get('/prescriptions/:prescriptionId/url', requireAuth, asyncHandler(doctorController.getPrescriptionUrl));
router.get('/consultations/:appointmentId', requireAuth, asyncHandler(videoController.getConsultation));
router.post('/webhooks/jaas-recording', asyncHandler(videoController.recordingWebhook));

export default router;
