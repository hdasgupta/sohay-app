import { query, queryOne, withTransaction } from '../config/db.js';
import {
  COUNT_USERS_BY_EMAIL,
  INSERT_PATIENT,
  INSERT_USER,
  SELECT_DOCTOR_PROFILE_BY_ID,
  SELECT_PATIENT_PROFILE_BY_ID,
  SELECT_USER_BY_EMAIL,
  SELECT_USER_BY_ID,
  UPDATE_USER_PASSWORD,
} from '../scripts/common.sql.js';
import { badRequest, forbidden, notFound, unauthorized } from '../utils/httpError.js';
import { assertStrongPassword, hashPassword, verifyPassword } from '../utils/password.js';
import { signAuthToken } from '../utils/jwt.js';
import { issueOtp, verifyOtp } from '../utils/otp.js';
import { toAuthUser, toDoctorProfile, toPatientProfile } from '../models/userModel.js';
import { ROLES } from '../middleware/auth.js';

const ROLE_PATIENT = ROLES.PATIENT;
const NOT_DISABLED = false;

export const DEFAULT_PAGE_BY_ROLE = {
  ADMIN: '/admin/add-doctor',
  PATIENT: '/patient/book-appointment',
  DOCTOR: '/doctor/generate-prescription',
};

export const login = async ({ email, password }) => {
  const user = await queryOne(SELECT_USER_BY_EMAIL, [email]);
  if (!user) {
    console.warn(`[auth] login failed, unknown email ${email}`);
    throw unauthorized('Email or password is not correct');
  }
  if (user.is_disabled) {
    console.warn(`[auth] login blocked, disabled account ${email}`);
    throw forbidden('Your account has been disabled. Please contact the administrator.');
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    console.warn(`[auth] login failed, wrong password for ${email}`);
    throw unauthorized('Email or password is not correct');
  }

  const authUser = toAuthUser(user);
  const token = signAuthToken(user);
  console.log(`[auth] login success ${email} as ${user.role}`);
  return { token, user: authUser, defaultPage: DEFAULT_PAGE_BY_ROLE[user.role] };
};

export const emailExists = async (email) => {
  const row = await queryOne(COUNT_USERS_BY_EMAIL, [email]);
  return Number(row.total) > 0;
};

export const sendRegistrationOtp = async (email) => {
  if (await emailExists(email)) {
    throw badRequest('This email address is already registered. Please login instead.');
  }
  return issueOtp({ email, purpose: 'REGISTER' });
};

export const sendResetOtp = async (email) => {
  if (!(await emailExists(email))) {
    throw badRequest('This email address is not registered with us');
  }
  return issueOtp({ email, purpose: 'RESET_PASSWORD' });
};

export const registerPatient = async ({ name, email, password, confirmPassword, sex, dateOfBirth, contactNumber, otp }) => {
  assertStrongPassword(password, confirmPassword);
  if (await emailExists(email)) throw badRequest('This email address is already registered');
  await verifyOtp({ email, purpose: 'REGISTER', code: otp });

  const passwordHash = await hashPassword(password);
  const created = await withTransaction(async (client) => {
    const userResult = await client.query(INSERT_USER, [name, email, passwordHash, ROLE_PATIENT, NOT_DISABLED]);
    const user = userResult.rows[0];
    await client.query(INSERT_PATIENT, [user.id, sex, dateOfBirth, contactNumber]);
    return user;
  });

  console.log(`[auth] patient registered: ${email}`);
  return toAuthUser(created);
};

export const resetPassword = async ({ email, password, confirmPassword, otp }) => {
  assertStrongPassword(password, confirmPassword);
  const user = await queryOne(SELECT_USER_BY_EMAIL, [email]);
  if (!user) throw badRequest('This email address is not registered with us');
  await verifyOtp({ email, purpose: 'RESET_PASSWORD', code: otp });

  const passwordHash = await hashPassword(password);
  await query(UPDATE_USER_PASSWORD, [user.id, passwordHash]);
  console.log(`[auth] password reset for ${email}`);
  return true;
};

export const getProfile = async (user) => {
  if (user.role === ROLES.PATIENT) {
    const row = await queryOne(SELECT_PATIENT_PROFILE_BY_ID, [user.id]);
    if (!row) throw notFound('Patient profile not found');
    return toPatientProfile(row);
  }
  if (user.role === ROLES.DOCTOR) {
    const row = await queryOne(SELECT_DOCTOR_PROFILE_BY_ID, [user.id]);
    if (!row) throw notFound('Doctor profile not found');
    return toDoctorProfile(row);
  }
  const row = await queryOne(SELECT_USER_BY_ID, [user.id]);
  if (!row) throw notFound('User not found');
  return toAuthUser(row);
};
