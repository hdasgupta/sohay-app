/**
 * End to end smoke test of the API (development helper, safe to delete).
 * It fabricates a captcha token with the server secret so the flows can run
 * without a human reading the captcha image.
 *   node smoke-test.mjs
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcryptjs from 'bcryptjs';
import { env } from './src/config/env.js';
import { pool, query, queryOne } from './src/config/db.js';

const api = axios.create({ baseURL: `http://localhost:${env.port}/api`, validateStatus: () => true });
const ANSWER = 'test12';
const captcha = () => ({
  captchaToken: jwt.sign(
    {
      answerHash: crypto.createHmac('sha256', env.captchaSecret).update(ANSWER).digest('hex'),
      nonce: crypto.randomUUID(),
    },
    env.captchaSecret,
    { expiresIn: 300 },
  ),
  captchaAnswer: ANSWER,
});

const show = (label, response) => {
  const ok = response.status < 400;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} [${response.status}] ${response.data?.message || ''}`);
  if (!ok) console.log('      ', JSON.stringify(response.data));
  return response.data?.data;
};

const forceOtp = async (email, purpose) => {
  const code = '123456';
  const hash = await bcryptjs.hash(code, 10);
  await query(
    `INSERT INTO otp_requests (email, purpose, code_hash, expires_at) VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::INTERVAL)`,
    [email, purpose, hash, '10'],
  );
  return code;
};

const run = async () => {
  const stamp = Date.now();
  const patientEmail = `smoke.patient.${stamp}@example.com`;
  const doctorEmail = `smoke.doctor.${stamp}@example.com`;

  // 1. admin login
  const admin = show(
    'admin login',
    await api.post('/auth/login', { email: env.seedAdmin.email, password: env.seedAdmin.password, ...captcha() }),
  );
  const adminAuth = { headers: { Authorization: `Bearer ${admin.token}` } };

  // 2. add doctor with availability on every weekday
  const availability = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: '09:00', endTime: '17:00' }));
  const doctor = show(
    'add doctor',
    await api.post(
      '/admin/doctors',
      {
        name: 'Ananya Sen',
        sex: 'FEMALE',
        speciality: 'Clinical Psychiatry',
        email: doctorEmail,
        password: 'Doctor@12345',
        confirmPassword: 'Doctor@12345',
        availability,
      },
      adminAuth,
    ),
  );

  // 2b. overlapping slots must be rejected
  const overlap = await api.post(
    '/admin/doctors',
    {
      name: 'Overlap Test',
      sex: 'MALE',
      speciality: 'Test',
      email: `overlap.${stamp}@example.com`,
      password: 'Doctor@12345',
      confirmPassword: 'Doctor@12345',
      availability: [
        { weekday: 1, startTime: '09:00', endTime: '11:00' },
        { weekday: 1, startTime: '10:30', endTime: '12:00' },
      ],
    },
    adminAuth,
  );
  console.log(`${overlap.status === 400 ? 'PASS' : 'FAIL'} overlapping availability rejected [${overlap.status}]`);

  // 3. register a patient
  const registerOtp = await forceOtp(patientEmail, 'REGISTER');
  show(
    'register patient',
    await api.post('/auth/register-patient', {
      name: 'Rahul Ghosh',
      sex: 'MALE',
      dateOfBirth: '1992-04-17',
      email: patientEmail,
      contactNumber: '9830012345',
      password: 'Patient@12345',
      confirmPassword: 'Patient@12345',
      otp: registerOtp,
      ...captcha(),
    }),
  );

  // 4. patient login + booking
  const patient = show(
    'patient login',
    await api.post('/auth/login', { email: patientEmail, password: 'Patient@12345', ...captcha() }),
  );
  const patientAuth = { headers: { Authorization: `Bearer ${patient.token}` } };

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const slots = show(
    'available slots',
    await api.get(`/patient/slots?doctorId=${doctor.id}&date=${tomorrow}&forPatientId=${patient.user.id}`, patientAuth),
  );
  console.log(`      first slots: ${slots.slice(0, 3).map((s) => s.startTime).join(', ')} (total ${slots.length})`);

  const appointment = show(
    'book appointment',
    await api.post(
      '/patient/appointments',
      { doctorId: doctor.id, forPatientId: patient.user.id, date: tomorrow, startTime: slots[0].startTime },
      patientAuth,
    ),
  );

  const dup = await api.post(
    '/patient/appointments',
    { doctorId: doctor.id, forPatientId: patient.user.id, date: tomorrow, startTime: slots[0].startTime },
    patientAuth,
  );
  console.log(`${dup.status === 409 ? 'PASS' : 'FAIL'} duplicate slot rejected [${dup.status}]`);

  show('patient appointment list', await api.get('/patient/appointments', patientAuth));
  show('consultation context', await api.get(`/consultations/${appointment.id}`, patientAuth));

  // 5. admin reschedule
  show(
    'admin finds upcoming appointment',
    await api.get(`/admin/appointments/upcoming?doctorId=${doctor.id}&patientId=${patient.user.id}`, adminAuth),
  );
  show(
    'admin reschedules',
    await api.patch(
      `/admin/appointments/${appointment.id}/reschedule`,
      { date: tomorrow, startTime: slots[4].startTime },
      adminAuth,
    ),
  );

  // 6. doctor: make the appointment "today" so prescription flow can run
  await query(`UPDATE appointments SET appointment_date = CURRENT_DATE, start_time = $1, end_time = $2 WHERE id = $3`, [
    '23:00',
    '23:30',
    appointment.id,
  ]);
  const doctorLogin = show(
    'doctor login',
    await api.post('/auth/login', { email: doctorEmail, password: 'Doctor@12345', ...captcha() }),
  );
  const doctorAuth = { headers: { Authorization: `Bearer ${doctorLogin.token}` } };
  show('doctor appointment list', await api.get('/doctor/appointments', doctorAuth));
  const today = show('today patients', await api.get('/doctor/today-patients', doctorAuth));
  const medicines = show('medicine search', await api.get('/doctor/medicines?term=paracet', doctorAuth));
  console.log(`      matched medicines: ${medicines.slice(0, 3).map((m) => m.name).join(' | ')}`);

  const prescription = show(
    'generate prescription',
    await api.post(
      '/doctor/prescriptions',
      {
        appointmentId: today[0].appointmentId,
        age: today[0].age,
        advice: 'Sleep at a fixed hour, avoid caffeine after 6 pm.',
        medicines: [
          {
            medicineName: medicines[0]?.name || 'Paracetamol 500mg Tablet',
            dose: '1 pcs',
            conditionNote: 'Only if fever crosses 100F',
            morning: true,
            night: true,
            sos: false,
            food: 'AFTER_FOOD',
          },
          {
            medicineName: 'Multivitamin Syrup',
            dose: '10 ml',
            conditionNote: null,
            evening: true,
            sos: true,
            food: 'WITH_FOOD',
          },
        ],
      },
      doctorAuth,
    ),
  );
  show('prescription download url', await api.get(`/prescriptions/${prescription.id}/url`, doctorAuth));

  const row = await queryOne('SELECT status FROM appointments WHERE id = $1', [appointment.id]);
  console.log(`${row.status === 'COMPLETED' ? 'PASS' : 'FAIL'} appointment marked COMPLETED (${row.status})`);

  await pool.end();
};

run().catch(async (error) => {
  console.error('smoke test crashed:', error);
  await pool.end();
  process.exit(1);
});
