export const ROLES = Object.freeze({
  ADMIN: "admin",
  DOCTOR: "doctor",
  PATIENT: "patient",
});
export const SEX_OPTIONS = Object.freeze(["Male", "Female", "Other"]);
export const WEEKDAYS = Object.freeze([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);
export const WEEKDAYS_SHORT = Object.freeze([
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
]);
export const MONTHS = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);
export const FOOD_TIMINGS = Object.freeze([
  { code: "before_food", label: "Before food" },
  { code: "with_food", label: "With food" },
  { code: "after_food", label: "After food" },
]);
export const OTP_PURPOSE = Object.freeze({
  REGISTER: "register",
  RESET: "reset_password",
});
export const OTP_VALIDITY_SECONDS = 600;
export const BOOKING_WINDOW_DAYS = 90;
export const AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const STATUS_LABEL = Object.freeze({
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
});
