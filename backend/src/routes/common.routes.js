import { Router } from "express";
import h from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { authLimiter, otpLimiter } from "../middleware/rateLimit.js";
import * as c from "../controllers/common.controller.js";

const r = Router();
r.get("/health", h(c.health));
r.get("/captcha", h(c.getCaptcha));
r.post("/auth/login", authLimiter, h(c.login));
r.post("/auth/otp/send", otpLimiter, h(c.sendOtp));
r.post("/auth/otp/verify", authLimiter, h(c.checkOtp));
r.post("/auth/register", authLimiter, h(c.registerPatient));
r.post("/auth/reset-password", authLimiter, h(c.resetPassword));
r.get("/auth/me", authenticate, h(c.me));
r.get("/meetings/:appointmentId/token", authenticate, h(c.meetingToken));
r.get(
  "/prescriptions/:appointmentId/download",
  authenticate,
  h(c.downloadPrescription),
);
export default r;
