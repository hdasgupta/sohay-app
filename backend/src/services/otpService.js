import crypto from "node:crypto";
import { env } from "../config/env.js";
import { issueOtpVerification } from "./authService.js";
import { sendOtpMail } from "./emailService.js";
const pending = new Map();
export async function requestOtp(email, purpose) {
  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = Date.now() + env.otpTtlSeconds * 1000;
  pending.set(`${purpose}:${email}`, { otp, expiresAt });
  await sendOtpMail({ to: email, otp });
  return { expiresAt };
}
export function verifyOtp(email, purpose, otp) {
  const key = `${purpose}:${email}`;
  const v = pending.get(key);
  if (!v || v.expiresAt <= Date.now()) {
    pending.delete(key);
    throw new Error("OTP expired.");
  }
  if (v.otp !== String(otp || "").trim()) throw new Error("Invalid OTP.");
  pending.delete(key);
  return issueOtpVerification(email, purpose);
}
