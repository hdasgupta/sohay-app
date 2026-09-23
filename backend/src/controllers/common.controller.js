/** Controllers available to every user type (auth, OTP, captcha, meeting, prescription download) */
import env from '../config/env.js';
import { withTransaction } from '../config/db.js';
import AppError from '../utils/AppError.js';
import { ok, created } from '../utils/response.js';
import logger from '../utils/logger.js';
import { createCaptcha, verifyCaptcha } from '../services/captcha.service.js';
import { issueOtp, verifyOtp, assertVerificationToken } from '../services/otp.service.js';
import { createMeetingToken, roomFqn } from '../services/jitsi.service.js';
import { getPrescription } from '../services/storage.service.js';
import { signAuthToken } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  requireFields, cleanEmail, cleanString, assertEmail, assertPassword, assertSex, assertDob, assertPhone, toId,
} from '../utils/validators.js';
import { ROLES, OTP_PURPOSE, APPOINTMENT_STATUS } from '../config/constants.js';
import { nowInKolkata, timeToMinutes } from '../utils/date.js';
import { appointmentDto } from '../utils/serializers.js';
import * as common from '../models/common.model.js';
import * as patientModel from '../models/patient.model.js';

const publicUser = (u) => ({ id: Number(u.id), name: u.name, email: u.email, role: u.role });

export async function health(_req, res) {
  ok(res, { status: 'up', time: new Date().toISOString(), timezone: env.timezone });
}

export async function getCaptcha(_req, res) {
  res.set('Cache-Control', 'no-store');
  ok(res, await createCaptcha());
}

export async function login(req, res) {
  requireFields(req.body, ['email', 'password', 'captchaId', 'captchaText']);
  await verifyCaptcha(req.body.captchaId, req.body.captchaText);
  const email = cleanEmail(req.body.email);
  const user = await common.findUserByEmail(email);
  if (!user || !(await verifyPassword(String(req.body.password), user.password_hash))) {
    logger.warn(`Failed login for ${email}`);
    throw AppError.unauthorized('Invalid email or password');
  }
  if (user.is_disabled) throw AppError.forbidden('Your account has been disabled. Please contact the administrator');
  const token = signAuthToken(user);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  logger.info(`Login success: ${email} as ${user.role}`);
  ok(res, { token, expiresAt, user: publicUser(user) }, `Welcome ${user.name}`);
}

export async function me(req, res) {
  ok(res, { user: publicUser(req.user) });
}

export async function sendOtp(req, res) {
  requireFields(req.body, ['email', 'purpose']);
  const email = cleanEmail(req.body.email);
  assertEmail(email);
  const { purpose } = req.body;
  if (!Object.values(OTP_PURPOSE).includes(purpose)) throw AppError.badRequest('Invalid OTP purpose');
  const existing = await common.findUserByEmail(email);
  if (purpose === OTP_PURPOSE.REGISTER && existing) throw AppError.conflict('This email address is already registered');
  if (purpose === OTP_PURPOSE.RESET && !existing) throw AppError.notFound('No account exists with this email address');
  const out = await issueOtp(email, purpose);
  ok(res, out, `OTP sent to ${email}. It is valid for ${env.otpValidityMinutes} minutes`);
}

export async function checkOtp(req, res) {
  requireFields(req.body, ['email', 'purpose', 'otp']);
  const email = cleanEmail(req.body.email);
  if (!Object.values(OTP_PURPOSE).includes(req.body.purpose)) throw AppError.badRequest('Invalid OTP purpose');
  const out = await verifyOtp(email, req.body.purpose, req.body.otp);
  ok(res, out, 'Email verified successfully');
}

export async function registerPatient(req, res) {
  const b = req.body;
  requireFields(b, ['name', 'sex', 'dateOfBirth', 'email', 'contactNumber', 'password', 'confirmPassword', 'verificationToken', 'captchaId', 'captchaText']);
  const email = cleanEmail(b.email);
  const name = cleanString(b.name, 120);
  assertEmail(email);
  assertSex(b.sex);
  assertDob(b.dateOfBirth);
  assertPhone(b.contactNumber);
  assertPassword(b.password, b.confirmPassword);
  if (name.length < 2) throw AppError.badRequest('Name must be at least 2 characters');
  await verifyCaptcha(b.captchaId, b.captchaText);
  assertVerificationToken(b.verificationToken, email, OTP_PURPOSE.REGISTER);
  if (await common.findUserByEmail(email)) throw AppError.conflict('This email address is already registered');
  const passwordHash = await hashPassword(b.password);
  const user = await withTransaction(async (client) => {
    const u = await common.insertUser({ name, email, passwordHash, role: ROLES.PATIENT }, client);
    await patientModel.insertPatient(client, {
      userId: u.id, sex: b.sex, dateOfBirth: b.dateOfBirth, contactNumber: String(b.contactNumber).replace(/[\s-]/g, ''),
    });
    return u;
  });
  logger.info(`Patient registered: ${email}`);
  created(res, { user: publicUser(user) }, 'Registration successful. Please login');
}

export async function resetPassword(req, res) {
  const b = req.body;
  requireFields(b, ['email', 'password', 'confirmPassword', 'verificationToken', 'captchaId', 'captchaText']);
  const email = cleanEmail(b.email);
  assertPassword(b.password, b.confirmPassword);
  await verifyCaptcha(b.captchaId, b.captchaText);
  assertVerificationToken(b.verificationToken, email, OTP_PURPOSE.RESET);
  const updated = await common.updatePasswordByEmail(email, await hashPassword(b.password));
  if (!updated) throw AppError.notFound('No account exists with this email address');
  logger.info(`Password reset for ${email}`);
  ok(res, null, 'Password has been reset successfully. Please login');
}

/** Can this user see / join this appointment? */
function assertAppointmentAccess(user, appt) {
  const uid = Number(user.id);
  const allowed = user.role === ROLES.ADMIN
    || (user.role === ROLES.DOCTOR && Number(appt.doctor_id) === uid)
    || (user.role === ROLES.PATIENT && (Number(appt.patient_id) === uid || Number(appt.booked_by) === uid));
  if (!allowed) throw AppError.forbidden('You do not have access to this appointment');
}

const JOIN_EARLY_MINUTES = 15;

export async function meetingToken(req, res) {
  const id = toId(req.params.appointmentId, 'appointment id');
  const appt = await common.getAppointmentById(id);
  if (!appt) throw AppError.notFound('Appointment not found');
  assertAppointmentAccess(req.user, appt);
  if (req.user.role === ROLES.ADMIN) throw AppError.forbidden('Only the doctor and the patient can join the consultation');
  if (appt.status === APPOINTMENT_STATUS.CANCELLED) throw AppError.badRequest('This appointment has been cancelled');
  const now = nowInKolkata();
  const dto = appointmentDto(appt);
  if (appt.appointment_date !== now.date) {
    throw AppError.badRequest(`The consultation room opens on ${appt.appointment_date} at ${dto.startTime} (IST)`, { appointment: dto });
  }
  if (timeToMinutes(now.time) < timeToMinutes(dto.startTime) - JOIN_EARLY_MINUTES) {
    throw AppError.badRequest(`The consultation room opens ${JOIN_EARLY_MINUTES} minutes before ${dto.startTime} (IST)`, { appointment: dto });
  }
  const isDoctor = req.user.role === ROLES.DOCTOR;
  const jwt = createMeetingToken(req.user, appt.room_id, isDoctor);
  logger.info(`Meeting token issued: appointment ${id} user ${req.user.id} (${req.user.role})`);
  ok(res, {
    domain: env.jaas.domain,
    appId: env.jaas.appId,
    roomName: roomFqn(appt.room_id),
    jwt,
    isModerator: isDoctor,
    autoRecord: isDoctor,
    appointment: dto,
  });
}

export async function downloadPrescription(req, res) {
  const id = toId(req.params.appointmentId, 'appointment id');
  const appt = await common.getAppointmentById(id);
  if (!appt) throw AppError.notFound('Appointment not found');
  assertAppointmentAccess(req.user, appt);
  const pres = await common.getPrescriptionByAppointment(id);
  if (!pres || !pres.pdf_key) throw AppError.notFound('Prescription is not available for this appointment');
  const pdf = await getPrescription(pres.pdf_key);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="prescription-${id}.pdf"`,
    'Content-Length': pdf.length,
    'Cache-Control': 'private, no-store',
  });
  res.send(pdf);
}
