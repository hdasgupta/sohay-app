import { timeToMinutes, minutesToTime } from './date.js';
import { SLOT_MINUTES } from '../config/constants.js';
import AppError from './AppError.js';

/** Break availability ranges into 30 minute slot start times */
export function expandRanges(ranges) {
  const out = [];
  for (const r of ranges) {
    const start = timeToMinutes(r.start_time ?? r.startTime);
    const end = timeToMinutes(r.end_time ?? r.endTime);
    for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) out.push(minutesToTime(t));
  }
  return [...new Set(out)].sort();
}

/**
 * Validate weekday-wise availability coming from the Add / Edit doctor page.
 * input: [{ weekday: 0-6, startTime: 'HH:MM', endTime: 'HH:MM' }]
 */
export function validateAvailability(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw AppError.badRequest('A doctor must have at least one time slot in the week');
  }
  const byDay = new Map();
  for (const item of list) {
    const weekday = Number(item.weekday);
    const { startTime, endTime } = item;
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw AppError.badRequest('Invalid weekday in availability');
    const re = /^([01]\d|2[0-4]):(00|30)$/;
    if (!re.test(startTime || '') || !re.test(endTime || '')) throw AppError.badRequest('Time slots must be on 30 minute boundaries (HH:MM)');
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    if (s >= 1440 || e > 1440 || e <= s) throw AppError.badRequest('End time must be after start time');
    if (!byDay.has(weekday)) byDay.set(weekday, []);
    byDay.get(weekday).push({ s, e });
  }
  for (const [weekday, ranges] of byDay) {
    ranges.sort((a, b) => a.s - b.s);
    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i].s < ranges[i - 1].e) {
        throw AppError.badRequest(`Time slots overlap on weekday ${weekday}`, { weekday });
      }
    }
  }
  return list.map((i) => ({ weekday: Number(i.weekday), startTime: i.startTime, endTime: i.endTime }));
}
