import { Router } from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import patientRoutes from './patientRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import sharedRoutes from './sharedRoutes.js';
import { healthCheck } from '../config/db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const now = await healthCheck();
    res.json({ success: true, message: 'Backend is healthy', data: { databaseTime: now } });
  }),
);

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/patient', patientRoutes);
router.use('/doctor', doctorRoutes);
router.use('/', sharedRoutes);

export default router;
