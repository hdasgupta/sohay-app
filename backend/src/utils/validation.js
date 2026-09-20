export const allowedSexes = new Set([
  "male",
  "female",
  "other",
  "prefer_not_to_say",
]);
export const allowedTiming = new Set([
  "morning",
  "afternoon",
  "evening",
  "night",
]);
export const allowedFood = new Set(["Before food", "with food", "after food"]);
export const strongPassword =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;
export const timeSlots = Array.from(
  { length: 48 },
  (_, i) =>
    `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
export function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date));
}
export function endTime(start) {
  const [h, m] = String(start).slice(0, 5).split(":").map(Number);
  const n = h * 60 + m + 30;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function availabilitySlots(rows) {
  const out = new Set();
  for (const r of rows) {
    const [sh, sm] = String(r.start_time).slice(0, 5).split(":").map(Number);
    const [eh, em] = String(r.end_time).slice(0, 5).split(":").map(Number);
    for (let x = sh * 60 + sm; x + 30 <= eh * 60 + em; x += 30)
      out.add(
        `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`,
      );
  }
  return [...out].sort();
}
export const rangeEndSlots = [...timeSlots, "24:00"];
export function validateAvailability(list) {
  if (!Array.isArray(list) || !list.length)
    throw new Error("Doctor must have at least one availability slot.");
  const rows = {};
  for (const x of list) {
    const day = Number(x.weekday);
    if (!Number.isInteger(day) || day < 0 || day > 6)
      throw new Error("Invalid weekday.");
    if (
      !timeSlots.includes(x.startTime) ||
      !timeSlots.includes(x.endTime) ||
      x.startTime >= x.endTime
    )
      throw new Error("Invalid time range.");
    (rows[day] ??= []).push(x);
  }
  for (const day of Object.keys(rows)) {
    const dayRows = rows[day].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    for (let i = 1; i < dayRows.length; i++)
      if (dayRows[i - 1].endTime > dayRows[i].startTime)
        throw new Error("Availability slots conflict on a day.");
  }
}
export function activeSlotKeys(patientId, doctorId, date, start) {
  return {
    doctor: `${doctorId}|${date}|${start}`,
    patient: `${patientId}|${date}|${start}`,
  };
}
