/** Application wide constants. These values are always passed to SQL as parameters. */
export const ROLES = Object.freeze({
  ADMIN: "admin",
  DOCTOR: "doctor",
  PATIENT: "patient",
});

export const APPOINTMENT_STATUS = Object.freeze({
  SCHEDULED: "scheduled",
  RESCHEDULED: "rescheduled",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
});
export const ACTIVE_APPOINTMENT_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.RESCHEDULED,
]);

export const INVITATION_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

export const FOOD_TIMING = Object.freeze({
  BEFORE: "before_food",
  WITH: "with_food",
  AFTER: "after_food",
});
export const FOOD_TIMING_LABEL = Object.freeze({
  before_food: "Before food",
  with_food: "With food",
  after_food: "After food",
});

export const OTP_PURPOSE = Object.freeze({
  REGISTER: "register",
  RESET: "reset_password",
});
export const SEXES = Object.freeze(["Male", "Female", "Other"]);
export const SLOT_MINUTES = 30;
export const ORGANISATION_NAME = "West Bengal Forum for Mental Health";
export const SCHEMA_VERSION = "1";
export const META_KEYS = Object.freeze({
  SCHEMA_VERSION: "schema_version",
  MEDICINES_IMPORTED: "medicines_imported",
});
