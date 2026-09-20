/** Time slot helpers. A slot is always 30 minutes long. */
export const SLOT_MINUTES = 30;
export const TIME_FORMAT = 'HH24:MI';

/** ['00:00', '00:30' ... '23:30'] */
export const ALL_SLOT_STARTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, index) =>
  minutesToTime(index * SLOT_MINUTES),
);

/** ['00:30', '01:00' ... '24:00'] */
export const ALL_SLOT_ENDS = ALL_SLOT_STARTS.map((time) => minutesToTime(timeToMinutes(time) + SLOT_MINUTES));

export function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export const isAlignedSlot = (time) => /^\d{2}:\d{2}$/.test(time) && timeToMinutes(time) % SLOT_MINUTES === 0;

/** Expand an availability window into its 30 minute slot starts. */
export const expandWindow = (startTime, endTime) => {
  const slots = [];
  for (let m = timeToMinutes(startTime); m + SLOT_MINUTES <= timeToMinutes(endTime); m += SLOT_MINUTES) {
    slots.push(minutesToTime(m));
  }
  return slots;
};

/** Expand many availability windows, de-duplicated and sorted. */
export const expandWindows = (windows) => {
  const set = new Set();
  windows.forEach((w) => expandWindow(w.start_time || w.startTime, w.end_time || w.endTime).forEach((s) => set.add(s)));
  return [...set].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
};

/** True when two [start,end) windows overlap. */
export const windowsOverlap = (a, b) =>
  timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);

export const endOfSlot = (startTime) => minutesToTime(timeToMinutes(startTime) + SLOT_MINUTES);
