import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  setup,
  teardown,
  pool,
  adminToken,
  auth,
  uniqueEmail,
  PASSWORD,
  createDoctor,
  registerPatient,
  login,
  fullWeek,
  tokenFor,
} from "./helpers.js";

let request;
let admin;
before(async () => {
  request = await setup();
  admin = await adminToken(request);
});
after(async () => {
  await teardown();
  await pool.end();
});

const doctorBody = (patch = {}) => ({
  name: "Dr. Mira Sen",
  sex: "Female",
  speciality: "Clinical Psychology",
  email: uniqueEmail("doc"),
  password: PASSWORD,
  confirmPassword: PASSWORD,
  availability: [
    { weekday: 1, startTime: "09:00", endTime: "12:00" },
    { weekday: 1, startTime: "14:00", endTime: "16:30" },
    { weekday: 3, startTime: "10:00", endTime: "11:00" },
  ],
  ...patch,
});

describe("admin: role protection", () => {
  test("patients cannot access admin API", async () => {
    const p = await registerPatient(request);
    await request.get("/api/admin/doctors").set(auth(p.token)).expect(403);
  });
  test("anonymous cannot access admin API", async () => {
    await request.get("/api/admin/doctors").expect(401);
  });
});

describe("admin: add doctor", () => {
  test("validation: at least one slot", async () => {
    const r = await request
      .post("/api/admin/doctors")
      .set(auth(admin))
      .send(doctorBody({ availability: [] }));
    assert.equal(r.status, 400);
  });
  test("validation: overlapping slots on the same day", async () => {
    const r = await request
      .post("/api/admin/doctors")
      .set(auth(admin))
      .send(
        doctorBody({
          availability: [
            { weekday: 2, startTime: "09:00", endTime: "11:00" },
            { weekday: 2, startTime: "10:00", endTime: "12:00" },
          ],
        }),
      );
    assert.equal(r.status, 400);
    assert.match(r.body.message, /overlap/);
  });
  test("validation: password rules and confirm", async () => {
    assert.equal(
      (
        await request
          .post("/api/admin/doctors")
          .set(auth(admin))
          .send(doctorBody({ password: "abc", confirmPassword: "abc" }))
      ).status,
      400,
    );
    assert.equal(
      (
        await request
          .post("/api/admin/doctors")
          .set(auth(admin))
          .send(doctorBody({ confirmPassword: "Other@1234" }))
      ).status,
      400,
    );
  });
  test("validation: invalid signature image", async () => {
    const r = await request
      .post("/api/admin/doctors")
      .set(auth(admin))
      .send(doctorBody({ signature: "data:text/plain;base64,aGVsbG8=" }));
    assert.equal(r.status, 400);
  });
  test("creates doctor with weekday availability; doctor can login as doctor", async () => {
    const body = doctorBody();
    const r = await request
      .post("/api/admin/doctors")
      .set(auth(admin))
      .send(body)
      .expect(201);
    assert.equal(r.body.data.availability.length, 3);
    assert.deepEqual(r.body.data.weekdays, [1, 3]);
    const l = await login(request, body.email);
    assert.equal(l.body.data.user.role, "doctor");
  });
  test("email must be unique across admin / doctor / patient", async () => {
    const p = await registerPatient(request);
    const r = await request
      .post("/api/admin/doctors")
      .set(auth(admin))
      .send(doctorBody({ email: p.email }));
    assert.equal(r.status, 409);
  });
  test("slot ending at midnight (24:00) is supported", async () => {
    const r = await request
      .post("/api/admin/doctors")
      .set(auth(admin))
      .send(
        doctorBody({
          availability: [{ weekday: 5, startTime: "22:00", endTime: "24:00" }],
        }),
      )
      .expect(201);
    assert.equal(r.body.data.availability[0].endTime, "24:00");
  });
});

describe("admin: doctor listing / edit / disable", () => {
  let doc;
  before(async () => {
    doc = await createDoctor(request, admin);
  });

  test("list contains the doctor with availability", async () => {
    const r = await request
      .get("/api/admin/doctors")
      .set(auth(admin))
      .expect(200);
    const found = r.body.data.find((d) => d.id === doc.id);
    assert.ok(found);
    assert.equal(found.availability.length, 7);
  });
  test("edit without password keeps the old password", async () => {
    const r = await request
      .put(`/api/admin/doctors/${doc.id}`)
      .set(auth(admin))
      .send({
        name: "Dr. Edited",
        sex: "Male",
        speciality: "Neuro Psychiatry",
        email: doc.email,
        availability: [{ weekday: 0, startTime: "10:00", endTime: "11:00" }],
      })
      .expect(200);
    assert.equal(r.body.data.name, "Dr. Edited");
    assert.deepEqual(r.body.data.weekdays, [0]);
    assert.equal((await login(request, doc.email)).status, 200);
  });
  test("edit with new password", async () => {
    await request
      .put(`/api/admin/doctors/${doc.id}`)
      .set(auth(admin))
      .send({
        name: "Dr. Edited",
        sex: "Male",
        speciality: "Neuro Psychiatry",
        email: doc.email,
        password: "Changed@123",
        confirmPassword: "Changed@123",
        availability: fullWeek(),
      })
      .expect(200);
    assert.equal((await login(request, doc.email, "Changed@123")).status, 200);
    await request
      .put(`/api/admin/doctors/${doc.id}`)
      .set(auth(admin))
      .send({
        name: "Dr. Edited",
        sex: "Male",
        speciality: "Neuro Psychiatry",
        email: doc.email,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        availability: fullWeek(),
      })
      .expect(200);
  });
  test("edit rejects an email used by someone else", async () => {
    const other = await createDoctor(request, admin);
    const r = await request
      .put(`/api/admin/doctors/${doc.id}`)
      .set(auth(admin))
      .send({
        name: "X Y",
        sex: "Male",
        speciality: "Psy",
        email: other.email,
        availability: fullWeek(),
      });
    assert.equal(r.status, 409);
  });
  test("get doctor by id / 404", async () => {
    await request
      .get(`/api/admin/doctors/${doc.id}`)
      .set(auth(admin))
      .expect(200);
    await request
      .get("/api/admin/doctors/99999999")
      .set(auth(admin))
      .expect(404);
    await request.get("/api/admin/doctors/abc").set(auth(admin)).expect(400);
  });
  test("disable: doctor cannot login, hidden from patients, existing token rejected", async () => {
    const docToken = await tokenFor(request, doc.email);
    await request
      .patch(`/api/admin/doctors/${doc.id}/status`)
      .set(auth(admin))
      .send({ disabled: true })
      .expect(200);
    const l = await login(request, doc.email);
    assert.equal(l.status, 403);
    await request
      .get("/api/doctor/appointments")
      .set(auth(docToken))
      .expect(403);
    const p = await registerPatient(request);
    const list = await request
      .get("/api/patient/doctors")
      .set(auth(p.token))
      .expect(200);
    assert.equal(
      list.body.data.some((d) => d.id === doc.id),
      false,
    );
    const slots = await request
      .get(`/api/patient/slots?doctorId=${doc.id}&date=2099-01-01`)
      .set(auth(p.token));
    assert.equal(slots.status, 400);
  });
  test("enable again", async () => {
    await request
      .patch(`/api/admin/doctors/${doc.id}/status`)
      .set(auth(admin))
      .send({ disabled: false })
      .expect(200);
    assert.equal((await login(request, doc.email)).status, 200);
  });
  test("status body validation", async () => {
    await request
      .patch(`/api/admin/doctors/${doc.id}/status`)
      .set(auth(admin))
      .send({ disabled: "yes" })
      .expect(400);
  });
  test("patients list for admin", async () => {
    const p = await registerPatient(request);
    const r = await request
      .get("/api/admin/patients")
      .set(auth(admin))
      .expect(200);
    assert.ok(r.body.data.some((x) => x.id === p.id));
  });
});
