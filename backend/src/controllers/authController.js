import { createCaptcha, assertCaptcha } from '../utils/captcha.js';
import { assertContactNumber, assertEnum, assertISODate, normalizeEmail, requireFields } from '../middleware/validate.js';
import * as authService from '../services/authService.js';
import { PASSWORD_RULES } from '../utils/password.js';

const SEX_VALUES = ['MALE', 'FEMALE', 'OTHER'];
const OTP_PURPOSES = ['REGISTER', 'RESET_PASSWORD'];

export const getCaptcha = async (req, res) => {
  const captcha = createCaptcha();
  res.json({ success: true, data: captcha });
};

export const getPasswordRules = async (req, res) => {
  res.json({ success: true, data: PASSWORD_RULES.map(({ key, label }) => ({ key, label })) });
};

export const login = async (req, res) => {
  requireFields(req.body, ['email', 'password', 'captchaToken', 'captchaAnswer']);
  assertCaptcha(req.body.captchaToken, req.body.captchaAnswer);
  const email = normalizeEmail(req.body.email);
  const result = await authService.login({ email, password: req.body.password });
  res.json({ success: true, message: `Welcome back, ${result.user.name}`, data: result });
};

export const sendOtp = async (req, res) => {
  requireFields(req.body, ['email', 'purpose']);
  const email = normalizeEmail(req.body.email);
  const purpose = assertEnum(req.body.purpose, OTP_PURPOSES, 'OTP purpose');
  const data =
    purpose === 'REGISTER' ? await authService.sendRegistrationOtp(email) : await authService.sendResetOtp(email);
  res.json({ success: true, message: `OTP sent to ${email}. It is valid for 10 minutes.`, data });
};

export const registerPatient = async (req, res) => {
  requireFields(req.body, [
    'name',
    'sex',
    'dateOfBirth',
    'email',
    'contactNumber',
    'password',
    'confirmPassword',
    'otp',
    'captchaToken',
    'captchaAnswer',
  ]);
  assertCaptcha(req.body.captchaToken, req.body.captchaAnswer);
  const data = await authService.registerPatient({
    name: String(req.body.name).trim(),
    email: normalizeEmail(req.body.email),
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    sex: assertEnum(req.body.sex, SEX_VALUES, 'Sex'),
    dateOfBirth: assertISODate(req.body.dateOfBirth, 'Date of birth'),
    contactNumber: assertContactNumber(req.body.contactNumber),
    otp: req.body.otp,
  });
  res.status(201).json({ success: true, message: 'Registration successful. You can login now.', data });
};

export const resetPassword = async (req, res) => {
  requireFields(req.body, ['email', 'password', 'confirmPassword', 'otp', 'captchaToken', 'captchaAnswer']);
  assertCaptcha(req.body.captchaToken, req.body.captchaAnswer);
  await authService.resetPassword({
    email: normalizeEmail(req.body.email),
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    otp: req.body.otp,
  });
  res.json({ success: true, message: 'Password reset successfully. Please login with the new password.' });
};

export const me = async (req, res) => {
  const data = await authService.getProfile(req.user);
  res.json({ success: true, data: { ...data, defaultPage: authService.DEFAULT_PAGE_BY_ROLE[req.user.role] } });
};
