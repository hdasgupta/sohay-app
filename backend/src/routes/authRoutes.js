import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests, please try again later' },
});

router.get('/captcha', asyncHandler(authController.getCaptcha));
router.get('/password-rules', asyncHandler(authController.getPasswordRules));
router.post('/login', asyncHandler(authController.login));
router.post('/otp', otpLimiter, asyncHandler(authController.sendOtp));
router.post('/register-patient', asyncHandler(authController.registerPatient));
router.post('/reset-password', asyncHandler(authController.resetPassword));
router.get('/me', requireAuth, asyncHandler(authController.me));

export default router;
