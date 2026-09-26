import { rateLimit } from "express-rate-limit";
import env from "../config/env.js";

const skip = () => env.isTest;
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip,
});
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    message: "Too many attempts. Please try again after some time",
  },
});
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again later",
  },
});
