import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, pool, adminToken, auth, createDoctor, registerPatient, todayInKolkata, addDays, weekdayOf, getOutbox, clearOutbox, env,
} from './helpers.js';

let request; let admin; let docA; let docB; let p1; let p2;
const tomorrow = () => addDays(todayInKolkata(), 1);

before(async () => {
  request = await setup();
  admin = await adminToken(request);
  docA = await createDoctor(request, admin, { name: 'Dr. A' });
  docB = await createDoctor(request, admin, { name: 'Dr. B' });
  p1 = await registerPatient(request, { name: 'Patient One' });
  p2 = await registerPatient(request, { name: 'Patient Two' });
});
after(async () => { await teardown(); await pool.end(); });

describe('patient: doctors and slots', () => {
  test('lists enabled doctors with weekdays', async () => {
    const r = await request.get('/api/patient/doctors').set(auth(p1.token)).expect(200);
    const a = r.body.data.find((d) => d.id === docA.id);
    assert.deepEqual(a.weekdays, [0, 1, 2, 3, 4, 5, 6]);
  });
  test('slots are 30 minute divisions of availability', async () => {
    const r = await request.get(`/api/patient/slots?doctorId=${docA.id}&date=${tomorrow()}`).set(auth(p1.token)).expect(200);
    assert.equal(r.body.data.length, 48);
    assert.equal(r.body.data[0], '00:00');
    assert.equal(r.body.data[47], '23:30');
  });
  test('no slots on a weekday the doctor does not work', async () => {
    const d = await createDoctor(request, admin, { availability: [{ weekday: weekdayOf(tomorrow()), startTime: '10:00', endTime: '11:00' }] });
    const r1 = await request.get(`/api/patient/slots?doctorId=${d.id}&date=${tomorrow()}`).set(auth(p1.token)).expect(200);
    assert.deepEqual(r1.body.data, ['10:00', '10:30']);
    const r2 = await request.get(`/api/patient/slots?doctorId=${d.id}&date=${addDays(tomorrow(), 1)}`).set(auth(p1.token)).expect(200);
    assert.deepEqual(r2.body.data, []);
  });
  test('past dates have no slots; invalid date rejected', async () => {
    const r = await request.get(`/api/patient/slots?doctorId=${docA.id}&date=${addDays(todayInKolkata(), -1)}`).set(auth(p1.token)).expect(200);
    assert.deepEqual(r.body.data, []);
    await request.get(`/api/patient/slots?doctorId=${docA.id}&date=2026-13-45`).set(auth(p1.token)).expect(400);
  });
  test('doctors/admins cannot use the patient API', async () => {
    await request.get('/api/patient/doctors').set(auth(admin)).expect(403);
  });
});

describe('patient: booking and conflicts', () => {
  let apptId;
  test('book appointment -> email with in-app 8x8 meeting link', async () => {
    clearOutbox();
    const r = await request.post('/api/patient/appointments').set(auth(p1.token)).send({ doctorId: docA.id, date: tomorrow(), startTime: '10:00' }).expect(201);
    apptId = r.body.data.id;
    assert.equal(r.body.data.status, 'scheduled');
    assert.equal(r.body.data.endTime, '10:30');
    assert.match(r.body.data.roomId, /^[0-9a-f-]{36}$/);
    const mail = getOutbox().find((m) => m.to === p1.email);
    assert.ok(mail, 'confirmation email sent');
    assert.ok(mail.html.includes(`${env.frontendUrl}/meeting/${apptId}`));
  });
  test('booked slot disappears from doctor slots for everybody', async () => {
    const r = await request.get(`/api/patient/slots?doctorId=${docA.id}&date=${tomorrow()}`).set(auth(p2.token)).expect(200);
    assert.equal(r.body.data.includes('10:00'), false);
  });
  test('same doctor + same slot by another patient -> 409', async () => {
    const r = await request.post('/api/patient/appointments').set(auth(p2.token)).send({ doctorId: docA.id, date: tomorrow(), startTime: '10:00' });
    assert.equal(r.status, 409);
  });
  test('same patient + same slot with another doctor -> 409', async () => {
    const r = await request.post('/api/patient/appointments').set(auth(p1.token)).send({ doctorId: docB.id, date: tomorrow(), startTime: '10:00' });
    assert.equal(r.status, 409);
    const s = await request.get(`/api/patient/slots?doctorId=${docB.id}&date=${tomorrow()}`).set(auth(p1.token)).expect(200);
    assert.equal(s.body.data.includes('10:00'), false);
  });
  test('parallel double booking is prevented by the database', async () => {
    const results = await Promise.all([p1, p2].map((p) => request.post('/api/patient/appointments').set(auth(p.token)).send({ doctorId: docB.id, date: tomorrow(), startTime: '15:00' })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409]);
  });
  test('booking outside window / off-grid slot rejected', async () => {
    assert.equal((await request.post('/api/patient/appointments').set(auth(p1.token)).send({ doctorId: docA.id, date: addDays(todayInKolkata(), 200), startTime: '10:00' })).status, 400);
    assert.equal((await request.post('/api/patient/appointments').set(auth(p1.token)).send({ doctorId: docA.id, date: tomorrow(), startTime: '10:15' })).status, 409);
    assert.equal((await request.post('/api/patient/appointments').set(auth(p1.token)).send({ doctorId: docA.id, date: addDays(todayInKolkata(), -1), startTime: '10:00' })).status, 400);
  });
  test('cannot book for a patient outside the family', async () => {
    const r = await request.post('/api/patient/appointments').set(auth(p1.token)).send({ patientId: p2.id, doctorId: docA.id, date: tomorrow(), startTime: '11:00' });
    assert.equal(r.status, 403);
  });
  test('appointment list sorted latest first', async () => {
    await request.post('/api/patient/appointments').set(auth(p1.token)).send({ doctorId: docA.id, date: addDays(todayInKolkata(), 5), startTime: '09:00' }).expect(201);
    const r = await request.get('/api/patient/appointments').set(auth(p1.token)).expect(200);
    const keys = r.body.data.map((a) => `${a.date} ${a.startTime}`);
    assert.deepEqual(keys, [...keys].sort().reverse());
    assert.ok(r.body.data.every((a) => a.isUpcoming));
  });
  test('cancel upcoming appointment frees the slot', async () => {
    await request.patch(`/api/patient/appointments/${apptId}/cancel`).set(auth(p1.token)).expect(200);
    const s = await request.get(`/api/patient/slots?doctorId=${docA.id}&date=${tomorrow()}`).set(auth(p2.token)).expect(200);
    assert.ok(s.body.data.includes('10:00'));
    const again = await request.patch(`/api/patient/appointments/${apptId}/cancel`).set(auth(p1.token));
    assert.equal(again.status, 400);
  });
  test('other patient cannot cancel', async () => {
    const r = await request.post('/api/patient/appointments').set(auth(p1.token)).send({ doctorId: docA.id, date: tomorrow(), startTime: '12:00' }).expect(201);
    await request.patch(`/api/patient/appointments/${r.body.data.id}/cancel`).set(auth(p2.token)).expect(403);
  });
});

describe('patient: family management', () => {
  let owner; let member; let outsider; let invitationId;
  before(async () => {
    owner = await registerPatient(request, { name: 'Family Owner' });
    member = await registerPatient(request, { name: 'Family Member' });
    outsider = await registerPatient(request, { name: 'Outsider' });
  });
  test('no family yet -> members = only self', async () => {
    const r = await request.get('/api/patient/members').set(auth(owner.token)).expect(200);
    assert.equal(r.body.data.family, null);
    assert.equal(r.body.data.members.length, 1);
  });
  test('cannot invite before creating a family', async () => {
    await request.post('/api/patient/family/invitations').set(auth(owner.token)).send({ email: member.email }).expect(400);
  });
  test('create family', async () => {
    await request.post('/api/patient/family').set(auth(owner.token)).send({ name: 'The Boses' }).expect(201);
    await request.post('/api/patient/family').set(auth(owner.token)).send({ name: 'Again' }).expect(409);
  });
  test('invite validations', async () => {
    await request.post('/api/patient/family/invitations').set(auth(owner.token)).send({ email: owner.email }).expect(400);
    await request.post('/api/patient/family/invitations').set(auth(owner.token)).send({ email: 'nobody@autotest.wbfmh.local' }).expect(404);
  });
  test('invite -> notification email -> invitee sees it', async () => {
    clearOutbox();
    const r = await request.post('/api/patient/family/invitations').set(auth(owner.token)).send({ email: member.email }).expect(201);
    invitationId = r.body.data.id;
    assert.ok(getOutbox().some((m) => m.to === member.email && /invited you/.test(m.subject)));
    await request.post('/api/patient/family/invitations').set(auth(owner.token)).send({ email: member.email }).expect(409);
    const f = await request.get('/api/patient/family').set(auth(member.token)).expect(200);
    assert.equal(f.body.data.receivedInvitations.length, 1);
  });
  test('reject -> inviter notified', async () => {
    clearOutbox();
    await request.post(`/api/patient/family/invitations/${invitationId}/respond`).set(auth(member.token)).send({ action: 'reject' }).expect(200);
    assert.ok(getOutbox().some((m) => m.to === owner.email && /declined/.test(m.subject)));
    await request.post(`/api/patient/family/invitations/${invitationId}/respond`).set(auth(member.token)).send({ action: 'accept' }).expect(400);
  });
  test('only the invitee can respond', async () => {
    const r = await request.post('/api/patient/family/invitations').set(auth(owner.token)).send({ email: member.email }).expect(201);
    invitationId = r.body.data.id;
    await request.post(`/api/patient/family/invitations/${invitationId}/respond`).set(auth(outsider.token)).send({ action: 'accept' }).expect(404);
  });
  test('accept -> joins family -> inviter notified', async () => {
    clearOutbox();
    await request.post(`/api/patient/family/invitations/${invitationId}/respond`).set(auth(member.token)).send({ action: 'accept' }).expect(200);
    assert.ok(getOutbox().some((m) => m.to === owner.email && /accepted/.test(m.subject)));
    const r = await request.get('/api/patient/members').set(auth(owner.token)).expect(200);
    assert.equal(r.body.data.members.length, 2);
  });
  test('member of a family cannot be invited to another', async () => {
    await request.post('/api/patient/family').set(auth(outsider.token)).send({ name: 'Other Family' }).expect(201);
    await request.post('/api/patient/family/invitations').set(auth(outsider.token)).send({ email: member.email }).expect(409);
  });
  test('book for a family member; both receive email; booker sees it in list', async () => {
    clearOutbox();
    const r = await request.post('/api/patient/appointments').set(auth(owner.token)).send({ patientId: member.id, doctorId: docB.id, date: tomorrow(), startTime: '18:00' }).expect(201);
    assert.equal(r.body.data.patientId, member.id);
    assert.ok(getOutbox().some((m) => m.to === member.email));
    assert.ok(getOutbox().some((m) => m.to === owner.email));
    const list = await request.get('/api/patient/appointments').set(auth(owner.token)).expect(200);
    assert.ok(list.body.data.some((a) => a.id === r.body.data.id));
  });
  test('withdraw pending invitation', async () => {
    const extra = await registerPatient(request);
    const r = await request.post('/api/patient/family/invitations').set(auth(owner.token)).send({ email: extra.email }).expect(201);
    await request.delete(`/api/patient/family/invitations/${r.body.data.id}`).set(auth(owner.token)).expect(200);
    const f = await request.get('/api/patient/family').set(auth(extra.token)).expect(200);
    assert.equal(f.body.data.receivedInvitations.length, 0);
  });
  test('leave family', async () => {
    await request.post('/api/patient/family/leave').set(auth(member.token)).expect(200);
    const r = await request.get('/api/patient/members').set(auth(member.token)).expect(200);
    assert.equal(r.body.data.family, null);
    await request.post('/api/patient/family/leave').set(auth(member.token)).expect(400);
  });
});
