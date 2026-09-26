/**
 * Date helpers. The clinic works in Asia/Kolkata. Appointment dates (DATE) and times (TIME)
 * are clinic-local wall-clock values; timestamps are TIMESTAMPTZ.
 */
export const TZ = "Asia/Kolkata";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Current wall clock in Kolkata -> { date: 'YYYY-MM-DD', time: 'HH:MM:SS' } */
export function nowInKolkata(at = new Date()) {
  const p = Object.fromEntries(
    partsFormatter.formatToParts(at).map((x) => [x.type, x.value]),
  );
  const hour = p.hour === "24" ? "00" : p.hour;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${hour}:${p.minute}:${p.second}`,
  };
}
export const todayInKolkata = () => nowInKolkata().date;

export const isValidIsoDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

/** 0 = Sunday ... 6 = Saturday for an ISO date (calendar maths only, tz independent) */
export function weekdayOf(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** 'HH:MM' or 'HH:MM:SS' -> minutes since midnight (24:00 -> 1440) */
export function timeToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
}
export function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export const normaliseTime = (t) => minutesToTime(timeToMinutes(t));
export const isValidSlotTime = (t) =>
  typeof t === "string" &&
  /^([01]\d|2[0-4]):(00|30)(:00)?$/.test(t) &&
  timeToMinutes(t) <= 1440;

/** Age in completed years on a given date */
export function ageOn(dobIso, onIso = todayInKolkata()) {
  const [by, bm, bd] = dobIso.split("-").map(Number);
  const [ty, tm, td] = onIso.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return Math.max(0, age);
}

/** True if the slot (date + start time) is strictly in the future (Kolkata) */
export function isFutureSlot(isoDate, startTime, now = nowInKolkata()) {
  if (isoDate > now.date) return true;
  if (isoDate < now.date) return false;
  return timeToMinutes(startTime) > timeToMinutes(now.time);
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const weekdayName = (i) => WEEKDAY_NAMES[i];

/** Human readable: 'Tue, 22 Sep 2026' */
export function formatDisplayDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
/** '14:30' -> '02:30 PM' */
export function formatDisplayTime(t) {
  const min = timeToMinutes(t);
  if (min === 1440) return "12:00 AM (midnight)";
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}
