/** 30 minute time helpers for the availability editor */
export const SLOT_MINUTES = 30;
const pad = (n) => String(n).padStart(2, "0");
export const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** 00:00 ... 23:30 */
export const START_TIMES = Array.from({ length: 48 }, (_, i) =>
  toHHMM(i * SLOT_MINUTES),
);
/** 00:30 ... 24:00 */
export const END_TIMES = Array.from({ length: 48 }, (_, i) =>
  toHHMM((i + 1) * SLOT_MINUTES),
);

/** Start options for a slot row: times not inside any other slot of the day */
export function startOptionsFor(daySlots, index) {
  const others = daySlots.filter(
    (_, i) => i !== index && daySlots[i].startTime && daySlots[i].endTime,
  );
  return START_TIMES.filter((t) => {
    const m = toMinutes(t);
    return !others.some(
      (o) => m >= toMinutes(o.startTime) && m < toMinutes(o.endTime),
    );
  });
}

/** End options: every time after start up to (and including) the next slot's start, or 24:00 */
export function endOptionsFor(daySlots, index) {
  const row = daySlots[index];
  if (!row?.startTime) return [];
  const s = toMinutes(row.startTime);
  const nextStarts = daySlots
    .filter((o, i) => i !== index && o.startTime && toMinutes(o.startTime) > s)
    .map((o) => toMinutes(o.startTime));
  const limit = nextStarts.length ? Math.min(...nextStarts) : 24 * 60;
  return END_TIMES.filter((t) => toMinutes(t) > s && toMinutes(t) <= limit);
}

/** Returns an error message or null. availability = [{weekday,startTime,endTime}] */
export function availabilityError(availability) {
  const complete = availability.filter((a) => a.startTime && a.endTime);
  if (complete.length === 0)
    return "A doctor must have at least one time slot in the week";
  if (complete.length !== availability.length)
    return "Please complete or remove the empty time slot rows";
  const byDay = {};
  for (const a of complete) {
    if (toMinutes(a.endTime) <= toMinutes(a.startTime))
      return "End time must be after start time";
    (byDay[a.weekday] ||= []).push(a);
  }
  for (const list of Object.values(byDay)) {
    const sorted = [...list].sort(
      (x, y) => toMinutes(x.startTime) - toMinutes(y.startTime),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime))
        return "Time slots of a day must not overlap";
    }
  }
  return null;
}

export const totalHours = (availability) =>
  availability
    .filter((a) => a.startTime && a.endTime)
    .reduce((s, a) => s + (toMinutes(a.endTime) - toMinutes(a.startTime)), 0) /
  60;
