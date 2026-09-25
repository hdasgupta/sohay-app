/**
 * Date helpers. The clinic runs on Asia/Kolkata. Appointment dates / times coming from the API are
 * Kolkata wall-clock values. When the browser is in another timezone the local equivalent is shown too.
 */
import { MONTHS } from '../config/constants.js';

export const CLINIC_TZ = 'Asia/Kolkata';
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || CLINIC_TZ;
export const isClinicTimeZone = () => {
  const offsetNow = new Date().toLocaleString('en-US', { timeZone: browserTimeZone(), timeZoneName: 'shortOffset' });
  const offsetClinic = new Date().toLocaleString('en-US', { timeZone: CLINIC_TZ, timeZoneName: 'shortOffset' });
  return browserTimeZone() === CLINIC_TZ || offsetNow.split(' ').pop() === offsetClinic.split(' ').pop();
};

const pad = (n) => String(n).padStart(2, '0');
export const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-based

/** Today's date in Kolkata as YYYY-MM-DD, independent of the browser timezone */
export function todayIso(at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(at).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function addDaysIso(iso, days) {
  const { y, m, d } = parseIso(iso);
  const dt = new Date(Date.UTC(y, m, d + days));
  return dt.toISOString().slice(0, 10);
}

export const weekdayOfIso = (iso) => { const { y, m, d } = parseIso(iso); return new Date(Date.UTC(y, m, d)).getUTCDay(); };
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** 'Tue, 22 Sep 2026' */
export function formatDate(iso) {
  if (!iso) return '';
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m, d)).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export const formatMonthYear = (y, m) => `${MONTHS[m]} ${y}`;

/** '14:30' -> '02:30 PM' */
export function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, mi] = hhmm.split(':').map(Number);
  if (h === 24) return 'Midnight';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${pad(mi)} ${suffix}`;
}

/** Kolkata wall clock (date + HH:MM) -> real Date instant */
export const clinicToDate = (iso, hhmm) => new Date(`${iso}T${hhmm === '24:00' ? '23:59' : hhmm}:00+05:30`);

/** Local (browser) representation of a Kolkata slot, e.g. '22 Sep, 06:00 am GMT+1' */
export function localEquivalent(iso, hhmm) {
  return clinicToDate(iso, hhmm).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

/** Label for a slot. Adds the viewer's local time if their timezone differs from Kolkata. */
export function slotLabel(iso, start, end) {
  const base = `${formatTime(start)}${end ? ` - ${formatTime(end)}` : ''} IST`;
  if (isClinicTimeZone() || !iso) return base;
  return `${base} (your time: ${localEquivalent(iso, start)})`;
}

/** Timestamps (ISO with Z) shown in Kolkata time */
export function formatTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', { timeZone: CLINIC_TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** completed years */
export function ageFromDob(dobIso, onIso = todayIso()) {
  if (!dobIso) return '';
  const b = parseIso(dobIso); const t = parseIso(onIso);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age -= 1;
  return Math.max(0, age);
}

/** is a Kolkata slot (date + start) still in the future? */
export const isFuture = (iso, hhmm, now = new Date()) => clinicToDate(iso, hhmm).getTime() > now.getTime();
