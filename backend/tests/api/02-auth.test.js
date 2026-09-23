import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, pool, captcha, login, uniqueEmail, PASSWORD, env, getOutbox, clearOutbox, auth, signVerificationTokenForTest, registerPatient,
} from './helpers.js';

let request;
before(async () => { request = await setup(); });
after(async () => { await teardown(); await pool.end(); });

const otpFromOutbox = (email) => {
  const mail = [...getOutbox()].reverse().find((m) => m.to === email);
  return mail && /^(\d{6}) is your verification code/.exec(mail.subject)?.[1];
};

describe('system', () => {
  test('health endpoint', async () => {
    const r = await request.get('/api/health').expect(200);
    assert.equal(r.body.data.status, 'up');
  });
  test('unknown route -> 404 json', async () => {
    const r = await request.get('/api/nope').expect(404);
    assert.equal(r.body.success, false);
  });
  test('CORS allows the configured frontend', async () => {
    const r = await request.options('/api/auth/login').set('Origin', env.frontendUrl).set('Access-Control-Request-Method', 'POST');
    assert.equal(r.headers['access-control-allow-origin'], env.frontendUrl);
  });
  test('malformed json -> 400', async () => {
    const r = await request.post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    assert.equal(r.status, 400);
  });
});

describe('captcha', () => {
  test('returns a PNG data URL image and an id', async () => {
    const r = await request.get('/api/captcha').expect(200);
    assert.match(r.body.data.image, /^data:image\/png;base64,/);
    assert.match(r.body.data.captchaId, /^[0-9a-f-]{36}$/);
    assert.equal(r.body.data.text, undefined);
  });
  test('captcha is single use', async () => {
    const c = await captcha(request);
    await request.post('/api/auth/login').send({ email: env.admin.email, password: env.admin.password, ...c }).expect(200);
    const again = await request.post('/api/auth/login').send({ email: env.admin.email, password: env.admin.password, ...c });
    assert.equal(again.status, 400);
    assert.match(again.body.message, /expired/i);
  });
  test('wrong captcha rejected', async () => {
    const c = await captcha(request);
    const r = await request.post('/api/auth/login').send({ email: env.admin.email, password: env.admin.password, captchaId: c.captchaId, captchaText: 'WRONG1' });
    assert.equal(r.status, 400);
  });
});

describe('login with automatic role detection', () => {
  test('seeded admin can login and role is detected', async () => {
    const r = await login(request, env.admin.email, env.admin.password);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.user.role, 'admin');
    assert.ok(r.body.data.token);
    assert.ok(new Date(r.body.data.expiresAt) > new Date(Date.now() + 29 * 86400000));
  });
  test('email is case insensitive', async () => {
    const r = await login(request, env.admin.email.toUpperCase(), env.admin.password);
    assert.equal(r.status, 200);
  });
  test('wrong password -> 401', async () => {
    const r = await login(request, env.admin.email, 'Wrong@12345');
    assert.equal(r.status, 401);
  });
  test('missing fields -> 400', async () => {
    const r = await request.post('/api/auth/login').send({ email: env.admin.email });
    assert.equal(r.status, 400);
  });
  test('password stored as salted bcrypt hash', async () => {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE lower(email) = lower($1)', [env.admin.email]);
    assert.match(rows[0].password_hash, /^\$2[aby]\$\d{2}\$.{53}$/);
  });
  test('/auth/me requires a valid token', async () => {
    await request.get('/api/auth/me').expect(401);
    await request.get('/api/auth/me').set(auth('garbage')).expect(401);
    const r = await login(request, env.admin.email, env.admin.password);
    const me = await request.get('/api/auth/me').set(auth(r.body.data.token)).expect(200);
    assert.equal(me.body.data.user.email, env.admin.email);
  });
});

describe('patient registration with email OTP', () => {
  const email = uniqueEmail('reg');
  let verificationToken;

  test('send OTP (html email, 10 minutes validity)', async () => {
    clearOutbox();
    const r = await request.post('/api/auth/otp/send').send({ email, purpose: 'register' }).expect(200);
    assert.equal(r.body.data.validitySeconds, 600);
    const mail = getOutbox().find((m) => m.to === email);
    assert.ok(mail);
    assert.match(mail.html, /valid for 10 minutes/);
  });
  test('OTP resend cooldown', async () => {
    const r = await request.post('/api/auth/otp/send').send({ email, purpose: 'register' });
    assert.equal(r.status, 429);
  });
  test('wrong OTP rejected', async () => {
    const r = await request.post('/api/auth/otp/verify').send({ email, purpose: 'register', otp: '000000' === otpFromOutbox(email) ? '111111' : '000000' });
    assert.equal(r.status, 400);
  });
  test('correct OTP returns verification token', async () => {
    const r = await request.post('/api/auth/otp/verify').send({ email, purpose: 'register', otp: otpFromOutbox(email) }).expect(200);
    verificationToken = r.body.data.verificationToken;
    assert.ok(verificationToken);
  });
  test('OTP cannot be reused', async () => {
    const r = await request.post('/api/auth/otp/verify').send({ email, purpose: 'register', otp: otpFromOutbox(email) });
    assert.equal(r.status, 400);
  });
  const base = () => ({ name: 'Reg Patient', sex: 'Male', dateOfBirth: '1985-01-20', email, contactNumber: '9830012345', password: PASSWORD, confirmPassword: PASSWORD, verificationToken });
  test('weak password rejected', async () => {
    const c = await captcha(request);
    const r = await request.post('/api/auth/register').send({ ...base(), password: 'weak', confirmPassword: 'weak', ...c });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Password must contain/);
  });
  test('password mismatch rejected', async () => {
    const c = await captcha(request);
    const r = await request.post('/api/auth/register').send({ ...base(), confirmPassword: 'Other@12345', ...c });
    assert.equal(r.status, 400);
  });
  test('invalid dob / sex / phone rejected', async () => {
    for (const patch of [{ dateOfBirth: '1800-01-01' }, { sex: 'X' }, { contactNumber: '12' }]) {
      const c = await captcha(request);
      const r = await request.post('/api/auth/register').send({ ...base(), ...patch, ...c });
      assert.equal(r.status, 400, JSON.stringify(patch));
    }
  });
  test('verification token for another email rejected', async () => {
    const c = await captcha(request);
    const r = await request.post('/api/auth/register').send({ ...base(), email: uniqueEmail('other'), ...c });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /not verified/);
  });
  test('registration succeeds and patient can login', async () => {
    const c = await captcha(request);
    await request.post('/api/auth/register').send({ ...base(), ...c }).expect(201);
    const r = await login(request, email);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.user.role, 'patient');
  });
  test('duplicate email cannot register / request register OTP', async () => {
    const r = await request.post('/api/auth/otp/send').send({ email, purpose: 'register' });
    assert.equal(r.status, 409);
    const c = await captcha(request);
    const r2 = await request.post('/api/auth/register').send({ ...base(), ...c });
    assert.equal(r2.status, 409);
  });
  test('admin email also blocks patient registration (unique across all user types)', async () => {
    const r = await request.post('/api/auth/otp/send').send({ email: env.admin.email, purpose: 'register' });
    assert.equal(r.status, 409);
  });
});

describe('reset password', () => {
  test('unknown email -> error', async () => {
    const r = await request.post('/api/auth/otp/send').send({ email: uniqueEmail('ghost'), purpose: 'reset_password' });
    assert.equal(r.status, 404);
  });
  test('reset with verified OTP and login with new password', async () => {
    const p = await registerPatient(request);
    clearOutbox();
    await request.post('/api/auth/otp/send').send({ email: p.email, purpose: 'reset_password' }).expect(200);
    const v = await request.post('/api/auth/otp/verify').send({ email: p.email, purpose: 'reset_password', otp: otpFromOutbox(p.email) }).expect(200);
    const c = await captcha(request);
    await request.post('/api/auth/reset-password').send({ email: p.email, password: 'NewPass@123', confirmPassword: 'NewPass@123', verificationToken: v.body.data.verificationToken, ...c }).expect(200);
    assert.equal((await login(request, p.email, PASSWORD)).status, 401);
    assert.equal((await login(request, p.email, 'NewPass@123')).status, 200);
  });
  test('register-purpose token cannot reset a password', async () => {
    const p = await registerPatient(request);
    const c = await captcha(request);
    const r = await request.post('/api/auth/reset-password').send({ email: p.email, password: 'NewPass@123', confirmPassword: 'NewPass@123', verificationToken: signVerificationTokenForTest(p.email, 'register'), ...c });
    assert.equal(r.status, 400);
  });
});
