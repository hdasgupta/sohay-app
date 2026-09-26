import { describe, it, expect } from "vitest";
import {
  START_TIMES,
  END_TIMES,
  startOptionsFor,
  endOptionsFor,
  availabilityError,
  totalHours,
  toMinutes,
} from "../../src/utils/timeSlots.js";
import { guessDose, timingSummary } from "../../src/utils/medicine.js";
import { PASSWORD_RULES, isPasswordValid } from "../../src/utils/password.js";
import {
  ageFromDob,
  addDaysIso,
  weekdayOfIso,
  daysInMonth,
  formatTime,
  todayIso,
  isFuture,
  clinicToDate,
} from "../../src/utils/date.js";
import { isEmail, isPhone, initials } from "../../src/utils/validators.js";
import {
  saveAuth,
  loadAuth,
  clearAuth,
  rememberRedirect,
  takeRedirect,
} from "../../src/utils/authStorage.js";
import { pageWindow } from "../../src/components/Pagination/Pagination.jsx";

describe("timeSlots", () => {
  it("builds 48 half hour start and end times", () => {
    expect(START_TIMES).toHaveLength(48);
    expect(START_TIMES[0]).toBe("00:00");
    expect(START_TIMES.at(-1)).toBe("23:30");
    expect(END_TIMES[0]).toBe("00:30");
    expect(END_TIMES.at(-1)).toBe("24:00");
  });
  it("end options only contain times after the start", () => {
    const opts = endOptionsFor([{ startTime: "10:00", endTime: "" }], 0);
    expect(opts[0]).toBe("10:30");
    expect(opts.every((t) => toMinutes(t) > 600)).toBe(true);
  });
  it("end options stop at the next slot start and start options skip busy ranges", () => {
    const day = [
      { startTime: "09:00", endTime: "10:00" },
      { startTime: "11:00", endTime: "12:00" },
    ];
    expect(endOptionsFor(day, 0).at(-1)).toBe("11:00");
    expect(startOptionsFor(day, 0)).not.toContain("11:30");
    expect(startOptionsFor(day, 0)).toContain("09:30");
  });
  it("validates availability", () => {
    expect(availabilityError([])).toMatch(/at least one/);
    expect(
      availabilityError([{ weekday: 1, startTime: "10:00", endTime: "" }]),
    ).toMatch(/at least one|complete/);
    expect(
      availabilityError([{ weekday: 1, startTime: "10:00", endTime: "09:00" }]),
    ).toMatch(/after/);
    expect(
      availabilityError([
        { weekday: 1, startTime: "09:00", endTime: "11:00" },
        { weekday: 1, startTime: "10:00", endTime: "12:00" },
      ]),
    ).toMatch(/overlap/);
    expect(
      availabilityError([
        { weekday: 1, startTime: "09:00", endTime: "11:00" },
        { weekday: 2, startTime: "10:00", endTime: "12:00" },
      ]),
    ).toBeNull();
    expect(
      totalHours([{ weekday: 1, startTime: "09:00", endTime: "11:30" }]),
    ).toBe(2.5);
  });
});

describe("medicine", () => {
  it("guesses the dose from the medicine form", () => {
    expect(guessDose("Crocin 500 Tablet")).toBe("1 pcs");
    expect(guessDose("Amoxil Capsule")).toBe("1 pcs");
    expect(guessDose("Benadryl Syrup")).toBe("10 ml");
    expect(guessDose("Something")).toBe("");
  });
  it("summarises timings", () => {
    expect(timingSummary({ morning: true, night: true })).toBe(
      "Morning · Night",
    );
    expect(timingSummary({ sos: true })).toBe("SOS");
  });
});

describe("password", () => {
  it("has the six required rules", () => {
    expect(PASSWORD_RULES.map((r) => r.key)).toEqual([
      "upper",
      "lower",
      "digit",
      "special",
      "length",
      "space",
    ]);
  });
  it("validates passwords", () => {
    expect(isPasswordValid("Abcdef1!")).toBe(true);
    expect(isPasswordValid("abcdef1!")).toBe(false);
    expect(isPasswordValid("Abc def1!")).toBe(false);
    expect(isPasswordValid("Ab1!")).toBe(false);
    expect(isPasswordValid("Abcdefg1")).toBe(false);
  });
});

describe("date", () => {
  it("computes age from date of birth", () => {
    expect(ageFromDob("1990-06-15", "2026-06-14")).toBe(35);
    expect(ageFromDob("1990-06-15", "2026-06-15")).toBe(36);
  });
  it("date arithmetic", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOfIso("2026-09-22")).toBe(2);
    expect(daysInMonth(2024, 1)).toBe(29);
  });
  it("formats times", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("13:30")).toBe("01:30 PM");
    expect(formatTime("24:00")).toBe("Midnight");
  });
  it("uses Asia/Kolkata for today and for slot instants", () => {
    expect(todayIso(new Date("2026-09-22T19:00:00Z"))).toBe("2026-09-23"); // 00:30 IST next day
    expect(clinicToDate("2026-09-22", "10:00").toISOString()).toBe(
      "2026-09-22T04:30:00.000Z",
    );
    expect(
      isFuture("2026-09-22", "10:00", new Date("2026-09-22T04:00:00Z")),
    ).toBe(true);
  });
});

describe("validators", () => {
  it("email, phone and initials", () => {
    expect(isEmail("a@b.com")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isPhone("+91 98300 12345")).toBe(true);
    expect(isPhone("12ab")).toBe(false);
    expect(initials("Dr. Anita Roy")).toBe("AR");
  });
});

describe("authStorage", () => {
  it("stores the session with a 30 day expiry", () => {
    saveAuth({ token: "t", user: { id: 1, role: "patient" } });
    const a = loadAuth();
    expect(a.token).toBe("t");
    const days = (new Date(a.expiresAt).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29.9);
    clearAuth();
    expect(loadAuth()).toBeNull();
  });
  it("drops an expired session", () => {
    localStorage.setItem(
      "wbfmh.auth",
      JSON.stringify({ token: "t", user: {}, expiresAt: Date.now() - 1000 }),
    );
    expect(loadAuth()).toBeNull();
  });
  it("remembers a deep link once and ignores auth pages", () => {
    rememberRedirect("/login");
    expect(takeRedirect()).toBeNull();
    rememberRedirect("/patient/appointments");
    expect(takeRedirect()).toBe("/patient/appointments");
    expect(takeRedirect()).toBeNull();
  });
});

describe("pageWindow", () => {
  it("shows at most 5 links centred on the current page", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(6, 10)).toEqual([4, 5, 6, 7, 8]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 0)).toEqual([]);
  });
});
