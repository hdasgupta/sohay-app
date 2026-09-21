import crypto from 'node:crypto';
import bcryptjs from 'bcryptjs';
import { env } from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import {
  INSERT_OTP,
  SELECT_LATEST_ACTIVE_OTP,
  UPDATE_OTP_ATTEMPTS,
  UPDATE_OTP_CONSUMED,
  DELETE_STALE_OTP,
} from '../scripts/common.sql.js';
import { badRequest } from './httpError.js';
import { otpEmail, sendMail } from './mailer.js';

const MAX_ATTEMPTS = 5;
const BOOLEAN_FALSE = false;
const BOOLEAN_TRUE = true;
const ONE = 1;

const randomCode = () => {
  const max = 10 ** env.otpLength;
  return String(crypto.randomInt(0, max)).padStart(env.otpLength, '0');
};

export const issueOtp = async ({ email, purpose }) => {
  const code = randomCode();
  const codeHash = await bcryptjs.hash(code, 10);
  const row = await queryOne(INSERT_OTP, [email, purpose, codeHash, String(env.otpTtlMinutes)]);
  await query(DELETE_STALE_OTP, [String(env.otpTtlMinutes * 6)]);

  await sendMail({
    to: email,
    subject: `${env.org.name} - your one time password`,
    html: otpEmail({ code, minutes: env.otpTtlMinutes, purpose }),
  });

  console.log(`[otp] issued ${purpose} otp for ${email}, expires ${row.expires_at}`);
  return { expiresAt: row.expires_at, ttlSeconds: env.otpTtlMinutes * 60 };
};

export const verifyOtp = async ({ email, purpose, code }) => {
  if (!code) throw badRequest('OTP is required');
  const row = await queryOne(SELECT_LATEST_ACTIVE_OTP, [email, purpose, BOOLEAN_FALSE, ONE]);
  if (!row) {
    console.warn(`[otp] no active otp for ${email} / ${purpose}`);
    throw badRequest('OTP expired or not requested. Please send a new OTP.');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw badRequest('Too many wrong attempts. Please request a new OTP.');
  }
  const matches = await bcryptjs.compare(String(code), row.code_hash);
  if (!matches) {
    await query(UPDATE_OTP_ATTEMPTS, [row.id, ONE]);
    console.warn(`[otp] wrong otp supplied for ${email}`);
    throw badRequest('The OTP you entered is not correct');
  }
  await query(UPDATE_OTP_CONSUMED, [row.id, BOOLEAN_TRUE]);
  console.log(`[otp] verified ${purpose} otp for ${email}`);
  return true;
};
