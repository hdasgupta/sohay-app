/**
 * Shared test helpers. Tests run against the local test database (backend/.env.test).
 * Every entity created by tests uses the TEST_DOMAIN email suffix and is deleted afterwards.
 */
process.env.NODE_ENV = 'test';
const { default: env } = await import('../../src/config/env.js');
const { createApp } = await import('../../src/app.js');
const { bootstrapDatabase } = await import('../../src/db/init.js');
const { pool } = await import('../../src/config/db.js');
const { peekCaptchaAnswer } = await import('../../src/services/captcha.service.js');
const { getOutbox, clearOutbox } = await import('../../src/services/email.service.js');
const { signVerificationTokenForTest } = await import('../../src/services/otp.service.js');
const { todayInKolkata, addDays, weekdayOf } = await import('../../src/utils/date.js');
const supertest = (await import('supertest')).default;

export { env, pool, getOutbox, clearOutbox, todayInKolkata, addDays, weekdayOf, signVerificationTokenForTest };

export const TEST_DOMAIN = 'autotest.wbfmh.local';
export const PASSWORD = 'Test@12345';
let app = null;
let booted = false;

export async function setup() {
  if (!booted) { await bootstrapDatabase(); booted = true; }
  if (!app) app = createApp();
  return supertest(app);
}
export const api = () => supertest(app);

export const uniqueEmail = (tag = 'u') => `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@${TEST_DOMAIN}`;

export async function captcha(request) {
  const res = await request.get('/api/captcha').expect(200);
  return { captchaId: res.body.data.captchaId, captchaText: peekCaptchaAnswer(res.body.data.captchaId) };
}

export async function login(request, email, password = PASSWORD) {
  const c = await captcha(request);
  const res = await request.post('/api/auth/login').send({ email, password, ...c });
  return res;
}
export async function tokenFor(request, email, password = PASSWORD) {
  const res = await login(request, email, password);
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${res.body.message}`);
  return res.body.data.token;
}
export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export async function adminToken(request) {
  return tokenFor(request, env.admin.email, env.admin.password);
}

/** Register a patient through the real API (OTP bypassed with a signed verification token) */
export async function registerPatient(request, overrides = {}) {
  const email = overrides.email || uniqueEmail('patient');
  const c = await captcha(request);
  const body = {
    name: overrides.name || 'Test Patient',
    sex: 'Female',
    dateOfBirth: overrides.dateOfBirth || '1990-05-15',
    email,
    contactNumber: '9876543210',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    verificationToken: signVerificationTokenForTest(email, 'register'),
    ...c,
  };
  const res = await request.post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.body.message}`);
  const token = await tokenFor(request, email);
  return { id: res.body.data.user.id, email, token };
}

export const fullWeek = (start = '00:00', end = '24:00') =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: start, endTime: end }));

export async function createDoctor(request, adminTok, overrides = {}) {
  const email = overrides.email || uniqueEmail('doctor');
  const res = await request.post('/api/admin/doctors').set(auth(adminTok)).send({
    name: 'Dr. Test', sex: 'Male', speciality: 'Psychiatry', email, password: PASSWORD, confirmPassword: PASSWORD,
    availability: overrides.availability || fullWeek(), ...overrides,
  });
  if (res.status !== 201) throw new Error(`doctor create failed: ${res.status} ${res.body.message}`);
  return { id: res.body.data.id, email };
}

/** Insert an appointment directly (used for "today" / "past" fixtures that the API would refuse) */
export async function insertAppointment({ patientId, doctorId, date, start, end, status = 'scheduled' }) {
  const { rows } = await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, booked_by, appointment_date, start_time, end_time, status)
     VALUES ($1, $2, $1, $3::date, $4::time, $5::time, $6) RETURNING id`,
    [patientId, doctorId, date, start, end, status],
  );
  return Number(rows[0].id);
}

/** Remove every entity the tests created */
export async function cleanup() {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%@${TEST_DOMAIN}`]);
  await pool.query('DELETE FROM email_otps WHERE email LIKE $1', [`%@${TEST_DOMAIN}`]);
  await pool.query('DELETE FROM medicines WHERE name LIKE $1', ['ZZTEST %']);
}

export async function teardown() {
  await cleanup();
}
