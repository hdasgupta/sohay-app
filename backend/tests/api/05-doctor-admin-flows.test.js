import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  setup,
  teardown,
  pool,
  adminToken,
  auth,
  createDoctor,
  registerPatient,
  tokenFor,
  todayInKolkata,
  addDays,
  insertAppointment,
  getOutbox,
  clearOutbox,
  env,
} from "./helpers.js";

const { cancelPastAppointments } =
  await import("../../src/jobs/appointmentStatus.job.js");

// 1x1 transparent PNG
const SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
let request;
let admin;
let doc;
let docToken;
let patient;
let other;
const tomorrow = () => addDays(todayInKolkata(), 1);

before(async () => {
  request = await setup();
  admin = await adminToken(request);
  doc = await createDoctor(request, admin, { name: "Dr. Flow" });
  docToken = await tokenFor(request, doc.email);
  patient = await registerPatient(request, {
    name: "Flow Patient",
    dateOfBirth: "1996-01-01",
  });
  other = await registerPatient(request, { name: "Other Patient" });
  await pool.query(
    "INSERT INTO medicines (name) SELECT unnest($1::varchar[]) ON CONFLICT DO NOTHING",
    [
      [
        "ZZTEST Calmex 10 Tablet",
        "ZZTEST Calmex Syrup",
        "ZZTEST Relaxo 5 Capsule",
      ],
    ],
  );
});
after(async () => {
  await teardown();
  await pool.end();
});

describe("admin: reschedule appointment", () => {
  let apptId;
  test("no upcoming appointment -> empty list", async () => {
    const r = await request
      .get(
        `/api/admin/appointments/upcoming?patientId=${patient.id}&doctorId=${doc.id}`,
      )
      .set(auth(admin))
      .expect(200);
    assert.deepEqual(r.body.data, []);
  });
  test("upcoming appointment is listed", async () => {
    const b = await request
      .post("/api/patient/appointments")
      .set(auth(patient.token))
      .send({ doctorId: doc.id, date: tomorrow(), startTime: "09:00" })
      .expect(201);
    apptId = b.body.data.id;
    const r = await request
      .get(
        `/api/admin/appointments/upcoming?patientId=${patient.id}&doctorId=${doc.id}`,
      )
      .set(auth(admin))
      .expect(200);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].id, apptId);
  });
  test("reschedule slots exclude conflicts of doctor AND patient", async () => {
    await request
      .post("/api/patient/appointments")
      .set(auth(other.token))
      .send({ doctorId: doc.id, date: tomorrow(), startTime: "11:00" })
      .expect(201);
    const doc2 = await createDoctor(request, admin);
    await request
      .post("/api/patient/appointments")
      .set(auth(patient.token))
      .send({ doctorId: doc2.id, date: tomorrow(), startTime: "12:00" })
      .expect(201);
    const r = await request
      .get(`/api/admin/slots?appointmentId=${apptId}&date=${tomorrow()}`)
      .set(auth(admin))
      .expect(200);
    assert.equal(r.body.data.includes("11:00"), false, "doctor busy");
    assert.equal(r.body.data.includes("12:00"), false, "patient busy");
    assert.equal(r.body.data.includes("13:00"), true);
  });
  test("reschedule into a conflicting slot -> 409", async () => {
    const r = await request
      .put(`/api/admin/appointments/${apptId}/reschedule`)
      .set(auth(admin))
      .send({ date: tomorrow(), startTime: "11:00" });
    assert.equal(r.status, 409);
  });
  test("reschedule to same slot -> 400", async () => {
    const r = await request
      .put(`/api/admin/appointments/${apptId}/reschedule`)
      .set(auth(admin))
      .send({ date: tomorrow(), startTime: "09:00" });
    assert.equal(r.status, 400);
  });
  test("reschedule succeeds -> status rescheduled, email sent, old slot free", async () => {
    clearOutbox();
    const newDate = addDays(todayInKolkata(), 2);
    const r = await request
      .put(`/api/admin/appointments/${apptId}/reschedule`)
      .set(auth(admin))
      .send({ date: newDate, startTime: "16:30" })
      .expect(200);
    assert.equal(r.body.data.status, "rescheduled");
    assert.equal(r.body.data.date, newDate);
    assert.equal(r.body.data.startTime, "16:30");
    assert.ok(
      getOutbox().some(
        (m) => m.to === patient.email && /rescheduled/i.test(m.subject),
      ),
    );
    const s = await request
      .get(`/api/patient/slots?doctorId=${doc.id}&date=${tomorrow()}`)
      .set(auth(other.token))
      .expect(200);
    assert.ok(s.body.data.includes("09:00"));
  });
  test("non-admin cannot reschedule", async () => {
    await request
      .put(`/api/admin/appointments/${apptId}/reschedule`)
      .set(auth(patient.token))
      .send({ date: tomorrow(), startTime: "13:00" })
      .expect(403);
  });
});

describe("doctor: appointments, medicines, signature, prescription", () => {
  let todayAppt;
  before(async () => {
    todayAppt = await insertAppointment({
      patientId: patient.id,
      doctorId: doc.id,
      date: todayInKolkata(),
      start: "00:00",
      end: "00:30",
    });
  });
  test("doctor appointment list (read only, latest first)", async () => {
    const r = await request
      .get("/api/doctor/appointments")
      .set(auth(docToken))
      .expect(200);
    assert.ok(r.body.data.length >= 2);
    const keys = r.body.data.map((a) => `${a.date} ${a.startTime}`);
    assert.deepEqual(keys, [...keys].sort().reverse());
  });
  test("today appointments with auto calculated age", async () => {
    const r = await request
      .get("/api/doctor/appointments/today")
      .set(auth(docToken))
      .expect(200);
    const row = r.body.data.find((x) => x.appointmentId === todayAppt);
    assert.ok(row);
    const [y, m, d] = todayInKolkata().split("-").map(Number);
    let age = y - 1996;
    if (m < 1 || (m === 1 && d < 1)) age -= 1;
    assert.equal(row.age, age);
  });
  test("medicine search", async () => {
    const r = await request
      .get("/api/doctor/medicines?q=zztest calm")
      .set(auth(docToken))
      .expect(200);
    assert.deepEqual(r.body.data.map((x) => x.name).sort(), [
      "ZZTEST Calmex 10 Tablet",
      "ZZTEST Calmex Syrup",
    ]);
    const short = await request
      .get("/api/doctor/medicines?q=z")
      .set(auth(docToken))
      .expect(200);
    assert.deepEqual(short.body.data, []);
    const wild = await request
      .get("/api/doctor/medicines?q=%25%25")
      .set(auth(docToken))
      .expect(200);
    assert.deepEqual(wild.body.data, []);
  });
  const item = {
    medicineName: "ZZTEST Calmex 10 Tablet",
    dose: "1 pcs",
    instructions: "Swallow whole",
    morning: true,
    night: true,
    foodTiming: "after_food",
  };
  test("prescription requires signature", async () => {
    const r = await request
      .post("/api/doctor/prescriptions")
      .set(auth(docToken))
      .send({ appointmentId: todayAppt, patientAge: 30, items: [item] });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /signature/);
  });
  test("save signature", async () => {
    await request
      .put("/api/doctor/signature")
      .set(auth(docToken))
      .send({ signature: "nope" })
      .expect(400);
    await request
      .put("/api/doctor/signature")
      .set(auth(docToken))
      .send({ signature: SIGNATURE })
      .expect(200);
    const p = await request
      .get("/api/doctor/profile")
      .set(auth(docToken))
      .expect(200);
    assert.equal(p.body.data.signature, SIGNATURE);
  });
  test("prescription validation", async () => {
    const send = (body) =>
      request
        .post("/api/doctor/prescriptions")
        .set(auth(docToken))
        .send({
          appointmentId: todayAppt,
          patientAge: 30,
          items: [item],
          ...body,
        });
    assert.equal((await send({ items: [] })).status, 400);
    assert.equal((await send({ patientAge: -3 })).status, 400);
    assert.equal((await send({ items: [{ ...item, dose: "" }] })).status, 400);
    assert.equal(
      (await send({ items: [{ ...item, foodTiming: "whenever" }] })).status,
      400,
    );
    assert.equal(
      (await send({ items: [{ ...item, morning: false, night: false }] }))
        .status,
      400,
    );
  });
  test("cannot prescribe for a future appointment", async () => {
    const r = await request
      .get("/api/doctor/appointments")
      .set(auth(docToken))
      .expect(200);
    const future = r.body.data.find(
      (a) => a.date > todayInKolkata() && a.status !== "cancelled",
    );
    const res = await request
      .post("/api/doctor/prescriptions")
      .set(auth(docToken))
      .send({ appointmentId: future.id, patientAge: 30, items: [item] });
    assert.equal(res.status, 400);
  });
  test("another doctor cannot prescribe", async () => {
    const d2 = await createDoctor(request, admin);
    const t2 = await tokenFor(request, d2.email);
    await request
      .put("/api/doctor/signature")
      .set(auth(t2))
      .send({ signature: SIGNATURE })
      .expect(200);
    const r = await request
      .post("/api/doctor/prescriptions")
      .set(auth(t2))
      .send({ appointmentId: todayAppt, patientAge: 30, items: [item] });
    assert.equal(r.status, 404);
  });
  test("generate prescription -> stored in DB + storage -> appointment completed", async () => {
    const r = await request
      .post("/api/doctor/prescriptions")
      .set(auth(docToken))
      .send({
        appointmentId: todayAppt,
        patientAge: 31,
        notes: "Sleep 8 hours",
        items: [
          item,
          {
            medicineName: "ZZTEST Calmex Syrup",
            dose: "10 ml",
            morning: false,
            sos: true,
            foodTiming: "before_food",
          },
        ],
      })
      .expect(201);
    assert.ok(r.body.data.pdfUrl);
    const { rows } = await pool.query(
      "SELECT p.patient_age, p.pdf_url, count(i.id) AS items FROM prescriptions p JOIN prescription_items i ON i.prescription_id = p.id WHERE p.appointment_id = $1 GROUP BY p.id",
      [todayAppt],
    );
    assert.equal(rows[0].patient_age, 31);
    assert.equal(Number(rows[0].items), 2);
    const list = await request
      .get("/api/patient/appointments")
      .set(auth(patient.token))
      .expect(200);
    const a = list.body.data.find((x) => x.id === todayAppt);
    assert.equal(a.status, "completed");
    assert.equal(a.hasPrescription, true);
  });
  test("completed appointment cannot be modified", async () => {
    await request
      .post("/api/doctor/prescriptions")
      .set(auth(docToken))
      .send({ appointmentId: todayAppt, patientAge: 31, items: [item] })
      .expect(409);
    await request
      .patch(`/api/patient/appointments/${todayAppt}/cancel`)
      .set(auth(patient.token))
      .expect(400);
    await request
      .put(`/api/admin/appointments/${todayAppt}/reschedule`)
      .set(auth(admin))
      .send({ date: tomorrow(), startTime: "20:00" })
      .expect(400);
    const job = await cancelPastAppointments(addDays(todayInKolkata(), 1));
    assert.ok(job >= 0);
    const { rows } = await pool.query(
      "SELECT status FROM appointments WHERE id = $1",
      [todayAppt],
    );
    assert.equal(rows[0].status, "completed");
  });
  test("download prescription PDF (patient + doctor), forbidden for others", async () => {
    const r = await request
      .get(`/api/prescriptions/${todayAppt}/download`)
      .set(auth(patient.token))
      .buffer(true)
      .parse((res, cb) => {
        const c = [];
        res.on("data", (d) => c.push(d));
        res.on("end", () => cb(null, Buffer.concat(c)));
      })
      .expect(200);
    assert.equal(r.headers["content-type"], "application/pdf");
    assert.equal(r.body.subarray(0, 5).toString(), "%PDF-");
    await request
      .get(`/api/prescriptions/${todayAppt}/download`)
      .set(auth(docToken))
      .expect(200);
    await request
      .get(`/api/prescriptions/${todayAppt}/download`)
      .set(auth(other.token))
      .expect(403);
  });
});

describe("video meeting (8x8 JaaS)", () => {
  let apptToday;
  let apptFuture;
  before(async () => {
    apptToday = await insertAppointment({
      patientId: other.id,
      doctorId: doc.id,
      date: todayInKolkata(),
      start: "00:30",
      end: "01:00",
    });
    const b = await request
      .post("/api/patient/appointments")
      .set(auth(other.token))
      .send({
        doctorId: doc.id,
        date: addDays(todayInKolkata(), 3),
        startTime: "10:00",
      })
      .expect(201);
    apptFuture = b.body.data.id;
  });
  test("doctor gets moderator token with recording enabled", async () => {
    const r = await request
      .get(`/api/meetings/${apptToday}/token`)
      .set(auth(docToken))
      .expect(200);
    assert.equal(r.body.data.domain, "8x8.vc");
    assert.equal(r.body.data.autoRecord, true);
    assert.ok(r.body.data.roomName.startsWith(`${env.jaas.appId}/`));
    const decoded = jwt.decode(r.body.data.jwt);
    assert.equal(decoded.context.user.moderator, "true");
    assert.equal(decoded.room, r.body.data.roomName.split("/")[1]);
  });
  test("patient gets non-moderator token", async () => {
    const r = await request
      .get(`/api/meetings/${apptToday}/token`)
      .set(auth(other.token))
      .expect(200);
    assert.equal(jwt.decode(r.body.data.jwt).context.user.moderator, "false");
  });
  test("unrelated users cannot join", async () => {
    await request
      .get(`/api/meetings/${apptToday}/token`)
      .set(auth(patient.token))
      .expect(403);
  });
  test("future appointment room is not open yet", async () => {
    const r = await request
      .get(`/api/meetings/${apptFuture}/token`)
      .set(auth(other.token));
    assert.equal(r.status, 400);
    assert.match(r.body.message, /opens on/);
  });
  test("JaaS webhook stores RECORDING_UPLOADED events (idempotent)", async () => {
    const { rows } = await pool.query(
      "SELECT room_id FROM appointments WHERE id = $1",
      [apptToday],
    );
    const key = crypto.randomUUID();
    const event = {
      eventType: "RECORDING_UPLOADED",
      fqn: `${env.jaas.appId}/${rows[0].room_id}`,
      idempotencyKey: key,
      data: { durationSec: 42, recordingSessionId: "rs-1" },
    };
    const r = await request
      .post("/api/webhooks/jaas")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event))
      .expect(200);
    assert.equal(r.body.data.appointmentId, apptToday);
    const dup = await request
      .post("/api/webhooks/jaas")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event))
      .expect(200);
    assert.equal(dup.body.data.duplicate, true);
    await pool.query(
      "DELETE FROM meeting_recordings WHERE idempotency_key = $1",
      [key],
    );
  });
});

describe("midnight job", () => {
  test("past scheduled / rescheduled appointments become cancelled", async () => {
    const y = addDays(todayInKolkata(), -1);
    const a1 = await insertAppointment({
      patientId: patient.id,
      doctorId: doc.id,
      date: y,
      start: "10:00",
      end: "10:30",
      status: "scheduled",
    });
    const a2 = await insertAppointment({
      patientId: other.id,
      doctorId: doc.id,
      date: y,
      start: "11:00",
      end: "11:30",
      status: "rescheduled",
    });
    const n = await cancelPastAppointments();
    assert.ok(n >= 2);
    const { rows } = await pool.query(
      "SELECT status, slot_active FROM appointments WHERE id = ANY($1::bigint[])",
      [[a1, a2]],
    );
    assert.ok(
      rows.every((r) => r.status === "cancelled" && r.slot_active === false),
    );
    const list = await request
      .get("/api/patient/appointments")
      .set(auth(patient.token))
      .expect(200);
    const a = list.body.data.find((x) => x.id === a1);
    assert.equal(a.isUpcoming, false);
  });
});
