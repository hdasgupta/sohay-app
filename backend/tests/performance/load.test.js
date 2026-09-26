/**
 * Performance / load test (no external tools).
 * Starts the API in-process on an ephemeral port and fires concurrent requests at the hottest
 * endpoints, then asserts throughput and latency budgets. Test data is removed afterwards.
 *   npm run test:perf            (uses .env.test database)
 *   PERF_CONCURRENCY=50 PERF_REQUESTS=1000 npm run test:perf
 */
process.env.NODE_ENV = "test";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const H = await import("../api/helpers.js");
const { createApp } = await import("../../src/app.js");

const CONCURRENCY = Number(process.env.PERF_CONCURRENCY || 25);
const REQUESTS = Number(process.env.PERF_REQUESTS || 400);
const P95_BUDGET_MS = Number(process.env.PERF_P95_MS || 800);

let server;
let base;
let patient;
let doctorId;
let doctorToken;
const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY });

function call(path, { method = "GET", token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const started = process.hrtime.bigint();
    const req = http.request(
      `${base}${path}`,
      {
        method,
        agent,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            ms: Number(process.hrtime.bigint() - started) / 1e6,
          }),
        );
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function load(name, makeRequest, total = REQUESTS) {
  const results = [];
  let next = 0;
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < total) {
        next += 1;
        results.push(await makeRequest());
      }
    }),
  );
  const secs = (Date.now() - t0) / 1000;
  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p) =>
    lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))];
  const errors = results.filter((r) => r.status >= 500).length;
  const summary = {
    name,
    requests: results.length,
    rps: Math.round(results.length / secs),
    p50: pct(50).toFixed(1),
    p95: pct(95).toFixed(1),
    p99: pct(99).toFixed(1),
    errors,
  };
  console.log(JSON.stringify(summary));
  return { ...summary, p95n: pct(95) };
}

before(async () => {
  const request = await H.setup();
  const admin = await H.adminToken(request);
  const doc = await H.createDoctor(request, admin, { name: "Dr. Perf" });
  doctorId = doc.id;
  doctorToken = await H.tokenFor(request, doc.email);
  patient = await H.registerPatient(request, { name: "Perf Patient" });
  await new Promise((r) => {
    server = createApp().listen(0, r);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  agent.destroy();
  await new Promise((r) => server.close(r));
  await H.teardown();
  await H.pool.end();
});

test("health endpoint throughput", async () => {
  const r = await load("GET /api/health", () => call("/api/health"));
  assert.equal(r.errors, 0);
  assert.ok(r.p95n < P95_BUDGET_MS, `p95 ${r.p95} ms`);
});

test("captcha generation under load", async () => {
  const r = await load(
    "GET /api/captcha",
    () => call("/api/captcha"),
    Math.round(REQUESTS / 4),
  );
  assert.equal(r.errors, 0);
  assert.ok(r.p95n < P95_BUDGET_MS * 3, `p95 ${r.p95} ms`);
});

test("authenticated doctor listing for patients", async () => {
  const r = await load("GET /api/patient/doctors", () =>
    call("/api/patient/doctors", { token: patient.token }),
  );
  assert.equal(r.errors, 0);
  assert.ok(r.p95n < P95_BUDGET_MS, `p95 ${r.p95} ms`);
});

test("slot availability computation", async () => {
  const date = H.addDays(H.todayInKolkata(), 1);
  const r = await load("GET /api/patient/slots", () =>
    call(`/api/patient/slots?doctorId=${doctorId}&date=${date}`, {
      token: patient.token,
    }),
  );
  assert.equal(r.errors, 0);
  assert.ok(r.p95n < P95_BUDGET_MS, `p95 ${r.p95} ms`);
});

test("medicine search", async () => {
  const r = await load("GET /api/doctor/medicines", () =>
    call("/api/doctor/medicines?q=para", { token: doctorToken }),
  );
  assert.equal(r.errors, 0);
  assert.ok(r.p95n < P95_BUDGET_MS, `p95 ${r.p95} ms`);
});

test("concurrent booking storm: exactly one booking per slot wins", async () => {
  const date = H.addDays(H.todayInKolkata(), 2);
  const request = H.api();
  const patients = [];
  for (let i = 0; i < 10; i += 1)
    patients.push(await H.registerPatient(request, { name: `Storm ${i}` }));
  const results = await Promise.all(
    patients.map((p) =>
      call("/api/patient/appointments", {
        method: "POST",
        token: p.token,
        body: { doctorId, date, startTime: "10:00" },
      }),
    ),
  );
  const created = results.filter((r) => r.status === 201).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  console.log(JSON.stringify({ name: "booking storm", created, conflicts }));
  assert.equal(created, 1);
  assert.equal(conflicts, 9);
});
