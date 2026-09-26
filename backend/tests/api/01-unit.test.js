import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
process.env.NODE_ENV = "test";
const { expandRanges, validateAvailability } =
  await import("../../src/utils/slots.js");
const d = await import("../../src/utils/date.js");
const { passwordErrors } = await import("../../src/utils/password.js");
const { renderCaptcha } = await import("../../src/services/captcha.service.js");
const { verifyJaasSignature } =
  await import("../../src/services/recording.service.js");
const { buildPrescriptionPdf } =
  await import("../../src/services/pdf.service.js");
const { createMeetingToken } =
  await import("../../src/services/jitsi.service.js");
const { default: jwt } = await import("jsonwebtoken");
const { pool } = await import("../../src/config/db.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
test.after(() => pool.end());

describe("slot utilities", () => {
  test("expands ranges into 30 minute slots", () => {
    assert.deepEqual(
      expandRanges([{ start_time: "09:00:00", end_time: "11:00:00" }]),
      ["09:00", "09:30", "10:00", "10:30"],
    );
    assert.deepEqual(expandRanges([{ startTime: "23:00", endTime: "24:00" }]), [
      "23:00",
      "23:30",
    ]);
  });
  test("rejects empty availability", () =>
    assert.throws(() => validateAvailability([]), /at least one time slot/));
  test("rejects overlapping slots on a day", () => {
    assert.throws(
      () =>
        validateAvailability([
          { weekday: 1, startTime: "09:00", endTime: "11:00" },
          { weekday: 1, startTime: "10:30", endTime: "12:00" },
        ]),
      /overlap/,
    );
  });
  test("allows adjacent slots and same times on different days", () => {
    const v = validateAvailability([
      { weekday: 1, startTime: "09:00", endTime: "10:00" },
      { weekday: 1, startTime: "10:00", endTime: "11:00" },
      { weekday: 2, startTime: "09:00", endTime: "10:00" },
    ]);
    assert.equal(v.length, 3);
  });
  test("rejects end before start and off-grid times", () => {
    assert.throws(
      () =>
        validateAvailability([
          { weekday: 1, startTime: "10:00", endTime: "09:30" },
        ]),
      /after start/,
    );
    assert.throws(
      () =>
        validateAvailability([
          { weekday: 1, startTime: "10:15", endTime: "11:00" },
        ]),
      /30 minute/,
    );
    assert.throws(
      () =>
        validateAvailability([
          { weekday: 9, startTime: "10:00", endTime: "11:00" },
        ]),
      /weekday/,
    );
  });
});

describe("date utilities (Asia/Kolkata)", () => {
  test("now in Kolkata is UTC+05:30", () => {
    const n = d.nowInKolkata(new Date("2026-01-01T20:00:00Z"));
    assert.deepEqual(n, { date: "2026-01-02", time: "01:30:00" });
  });
  test("weekday / addDays / age", () => {
    assert.equal(d.weekdayOf("2026-09-22"), 2);
    assert.equal(d.addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(d.ageOn("2000-09-23", "2026-09-22"), 25);
    assert.equal(d.ageOn("2000-09-22", "2026-09-22"), 26);
  });
  test("validation and formatting", () => {
    assert.equal(d.isValidIsoDate("2026-02-30"), false);
    assert.equal(d.isValidIsoDate("2024-02-29"), true);
    assert.equal(d.formatDisplayTime("14:30"), "02:30 PM");
    assert.equal(d.formatDisplayTime("00:00"), "12:00 AM");
    assert.equal(
      d.isFutureSlot("2026-09-22", "10:00", {
        date: "2026-09-22",
        time: "09:59:00",
      }),
      true,
    );
    assert.equal(
      d.isFutureSlot("2026-09-22", "10:00", {
        date: "2026-09-22",
        time: "10:00:00",
      }),
      false,
    );
  });
});

describe("password rules", () => {
  test("valid password passes", () =>
    assert.deepEqual(passwordErrors("Admin@12345"), []));
  test("each rule is enforced", () => {
    assert.ok(
      passwordErrors("admin@12345").includes("at least one upper case letter"),
    );
    assert.ok(
      passwordErrors("ADMIN@12345").includes("at least one lower case letter"),
    );
    assert.ok(passwordErrors("Admin@abcde").includes("at least one digit"));
    assert.ok(
      passwordErrors("Admin12345").includes("at least one special character"),
    );
    assert.ok(passwordErrors("Ad@1").includes("at least 8 characters"));
    assert.ok(passwordErrors("Admin @12345").includes("no spaces"));
  });
});

describe("captcha image", () => {
  test("renders a PNG and never embeds the answer as text", () => {
    const buf = renderCaptcha("K7QX3M");
    const png = PNG.sync.read(buf);
    assert.equal(png.width, 240);
    assert.equal(png.height, 80);
    assert.equal(buf.includes(Buffer.from("K7QX3M")), false);
  });
});

describe("8x8 JaaS webhook signature", () => {
  const payload =
    '{"eventType":"PARTICIPANT_JOINED","sessionId":"9a441d60-ceaf-4eba-b0a8-a7d940a76e1b","timestamp":1632490058278,"fqn":"vpaas-magic-cookie-96f0941768964ab380ed0fbada7a502f/sampleappromanticshiftsstripas","idempotencyKey":"9e9e7420-562d-4659-8e22-44b9b22aaa49","customerId":"96f0941768964ab380ed0fbada7a502f","appId":"vpaas-magic-cookie-96f0941768964ab380ed0fbada7a502f","data":{"avatar":"","name":"Test User","id":"auth0|5f903d7a77f3b4006eb8e67d","participantJid":"fc1ea14a-9bca-4218-a563-8c627e803d56@8x8.vc","moderator":true,"email":"test.user@company.com"}}';
  const secret = "whsec_9635df66714a4cf088ee9d0979dd3bf6";
  test("accepts the documented example signature", () => {
    assert.equal(
      verifyJaasSignature(
        payload,
        "t=1632490060,v1=xlzqEojlh4qb21sQpXYsWgyK8x9HVpz+RQldsv18rV0=",
        secret,
        1632490060,
      ),
      true,
    );
  });
  test("rejects tampered payloads and stale timestamps", () => {
    assert.throws(
      () =>
        verifyJaasSignature(
          `${payload} `,
          "t=1632490060,v1=xlzqEojlh4qb21sQpXYsWgyK8x9HVpz+RQldsv18rV0=",
          secret,
          1632490060,
        ),
      /Invalid/,
    );
    assert.throws(
      () =>
        verifyJaasSignature(
          payload,
          "t=1632490060,v1=xlzqEojlh4qb21sQpXYsWgyK8x9HVpz+RQldsv18rV0=",
          secret,
          1632499999,
        ),
      /tolerance/,
    );
  });
});

describe("8x8 JaaS meeting JWT", () => {
  test("is RS256 signed with kid and moderator/recording features for doctor", () => {
    const token = createMeetingToken(
      { id: 7, name: "Dr A", email: "a@b.c" },
      "2b1d2f7e-8b1f-4bb0-9a57-1f0f6f1f7c11",
      true,
    );
    const decoded = jwt.decode(token, { complete: true });
    assert.equal(decoded.header.alg, "RS256");
    assert.equal(decoded.header.kid, process.env.JAAS_API_KEY_ID);
    assert.equal(decoded.payload.sub, process.env.JAAS_APP_ID);
    assert.equal(decoded.payload.context.user.moderator, "true");
    assert.equal(decoded.payload.context.features.recording, "true");
    const patient = jwt.decode(
      createMeetingToken({ id: 8, name: "P", email: "p@b.c" }, "room", false),
    );
    assert.equal(patient.context.user.moderator, "false");
  });
});

describe("prescription pdf", () => {
  test("builds a valid PDF document", async () => {
    const buf = await buildPrescriptionPdf({
      prescriptionId: 1,
      doctor: { name: "Dr. Test", speciality: "Psychiatry", signature: null },
      patient: { name: "Patient", age: 30, sex: "Male" },
      date: "2026-09-22",
      items: [
        {
          medicineName: "Dolo 650 Tablet",
          dose: "1 pcs",
          instructions: "with water",
          morning: true,
          night: true,
          foodTiming: "after_food",
        },
      ],
      notes: "Rest well",
    });
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(buf.length > 2000);
  });
});

describe("SQL hygiene", () => {
  test("SQL files contain no quoted string literals and live in the scripts folder", async () => {
    const dir = path.resolve(__dirname, "../../src/scripts");
    for (const f of fs
      .readdirSync(dir)
      .filter((x) => x.endsWith(".sql.js") && x !== "transaction.sql.js")) {
      const mod = await import(path.join(dir, f));
      const collect = (o) =>
        Object.values(o).flatMap((v) =>
          typeof v === "string" ? [v] : typeof v === "object" ? collect(v) : [],
        );
      for (const sql of Object.values(mod).flatMap((v) =>
        typeof v === "string" ? [v] : collect(v),
      )) {
        assert.equal(
          sql.includes("'"),
          false,
          `quote found in ${f}: ${sql.slice(0, 80)}`,
        );
      }
    }
    const schema = fs
      .readFileSync(path.join(dir, "schema.sql"), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    assert.equal(schema.includes("'"), false);
    assert.match(schema, /DROP SCHEMA IF EXISTS public CASCADE/);
  });
  test("controllers never contain inline SQL", () => {
    const dir = path.resolve(__dirname, "../../src/controllers");
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      assert.equal(
        /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b/.test(src),
        false,
        `inline SQL in ${f}`,
      );
    }
  });
});
