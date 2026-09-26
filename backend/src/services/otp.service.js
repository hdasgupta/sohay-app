import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { COMMON_SQL } from "../scripts/common.sql.js";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";
import logger from "../utils/logger.js";
import { sendEmail } from "./email.service.js";
import { otpEmail } from "../templates/emailTemplates.js";
import { OTP_PURPOSE } from "../config/constants.js";

const RESEND_COOLDOWN_SECONDS = 45;
const MAX_ATTEMPTS = 5;
const PURPOSE_LABEL = {
  [OTP_PURPOSE.REGISTER]:
    "verify your email address and complete your registration",
  [OTP_PURPOSE.RESET]: "reset your password",
};
const hashOtp = (email, purpose, otp) =>
  crypto
    .createHmac("sha256", env.otpSecret)
    .update(`${email.toLowerCase()}|${purpose}|${otp}`)
    .digest("hex");

export async function issueOtp(email, purpose) {
  const { rows: last } = await query(COMMON_SQL.OTP_LATEST_FOR_EMAIL, [
    email,
    purpose,
    1,
  ]);
  if (last.length) {
    const elapsed =
      (Date.now() - new Date(last[0].created_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw AppError.tooMany(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)} seconds before requesting another OTP`,
      );
    }
  }
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await query(COMMON_SQL.OTP_INVALIDATE_OPEN, [email, purpose, false]);
  const { rows } = await query(COMMON_SQL.OTP_INSERT, [
    email,
    purpose,
    hashOtp(email, purpose, otp),
    env.otpValidityMinutes,
  ]);
  const mail = otpEmail({
    otp,
    purposeLabel: PURPOSE_LABEL[purpose],
    validityMinutes: env.otpValidityMinutes,
  });
  await sendEmail({ to: email, ...mail, critical: true });
  logger.info(`OTP issued for ${email} (${purpose})`);
  return {
    expiresAt: rows[0].expires_at,
    validitySeconds: env.otpValidityMinutes * 60,
  };
}

/** Verify OTP; on success returns a short lived signed verification token. */
export async function verifyOtp(email, purpose, otp) {
  const { rows } = await query(COMMON_SQL.OTP_FIND_ACTIVE, [
    email,
    purpose,
    false,
    1,
  ]);
  if (!rows.length)
    throw AppError.badRequest(
      "OTP expired or not requested. Please request a new OTP",
    );
  const rec = rows[0];
  if (rec.attempts >= MAX_ATTEMPTS)
    throw AppError.tooMany("Too many wrong attempts. Please request a new OTP");
  const expected = Buffer.from(rec.otp_hash, "hex");
  const given = Buffer.from(
    hashOtp(email, purpose, String(otp || "").trim()),
    "hex",
  );
  if (!crypto.timingSafeEqual(expected, given)) {
    await query(COMMON_SQL.OTP_ADD_ATTEMPT, [rec.id, 1]);
    throw AppError.badRequest("Invalid OTP");
  }
  await query(COMMON_SQL.OTP_CONSUME, [rec.id]);
  const verificationToken = jwt.sign(
    { email: email.toLowerCase(), purpose, typ: "email-verification" },
    env.otpSecret,
    { expiresIn: "30m" },
  );
  return { verificationToken };
}

export function assertVerificationToken(token, email, purpose) {
  try {
    const payload = jwt.verify(token, env.otpSecret);
    if (
      payload.typ !== "email-verification" ||
      payload.purpose !== purpose ||
      payload.email !== email.toLowerCase()
    )
      throw new Error("mismatch");
    return true;
  } catch {
    throw AppError.badRequest(
      "Email is not verified. Please verify your email with OTP",
    );
  }
}

/** Test helper: generate a valid token directly (tests only) */
export function signVerificationTokenForTest(email, purpose) {
  if (!env.isTest) throw new Error("test only");
  return jwt.sign(
    { email: email.toLowerCase(), purpose, typ: "email-verification" },
    env.otpSecret,
    { expiresIn: "30m" },
  );
}
