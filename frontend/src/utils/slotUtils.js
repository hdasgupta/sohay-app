/** 48 half hour slots of a day, shared by the add / edit doctor screens. */
export const SLOT_MINUTES = 30;

export const pad = (value) => String(value).padStart(2, '0');

export const buildSlotStarts = () => {
  const list = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += SLOT_MINUTES) {
    list.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return list;
};

export const buildSlotEnds = () => {
  const list = [];
  for (let minutes = SLOT_MINUTES; minutes <= 24 * 60; minutes += SLOT_MINUTES) {
    list.push(minutes === 24 * 60 ? '24:00' : `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return list;
};

export const timeToMinutes = (value) => {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
};

/** End times strictly after the chosen start time, as required by the spec. */
export const endsAfter = (startTime, ends = buildSlotEnds()) => {
  if (!startTime) return [];
  const start = timeToMinutes(startTime);
  return ends.filter((end) => timeToMinutes(end) > start);
};

export const toOption = (time) => ({ id: time, name: formatTime(time) });

export const formatTime = (value) => {
  if (!value) return '';
  const [hourText, minuteText] = String(value).split(':');
  const hour = Number(hourText);
  if (hour === 24) return '12:00 AM (next day)';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minuteText} ${suffix}`;
};

export const formatSlot = (startTime, endTime) => `${formatTime(startTime)} - ${formatTime(endTime)}`;

/** True when [aStart,aEnd) and [bStart,bEnd) overlap. */
export const overlaps = (aStart, aEnd, bStart, bEnd) =>
  timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
