import { env } from '../config/env.js';

const TZ = env.jobs.timezone || 'Asia/Kolkata';

/** Local (clinic timezone) calendar date as YYYY-MM-DD. */
export const todayISO = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** Local (clinic timezone) wall clock as HH:MM. */
export const nowTime = (date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

export const isValidISODate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(Date.parse(value));

/** 0 = Sunday ... 6 = Saturday, matching doctor_availability.weekday. */
export const weekdayOf = (isoDate) => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

export const calculateAge = (dateOfBirth, onISODate = todayISO()) => {
  const dob = new Date(dateOfBirth);
  const ref = new Date(`${onISODate}T00:00:00Z`);
  let age = ref.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    ref.getUTCMonth() < dob.getUTCMonth() ||
    (ref.getUTCMonth() === dob.getUTCMonth() && ref.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return Math.max(age, 0);
};

export const prettyDate = (isoDate) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );

export const toISODate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date(value));
};
