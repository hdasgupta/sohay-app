import AppError from "./AppError.js";
import { passwordErrors } from "./password.js";
import { isValidIsoDate, todayInKolkata } from "./date.js";
import { SEXES } from "../config/constants.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[0-9]{7,15}$/;

export const cleanString = (v, max = 255) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export const cleanEmail = (v) => cleanString(v, 255).toLowerCase();

export function requireFields(body, fields) {
  const missing = fields.filter(
    (f) =>
      body[f] === undefined ||
      body[f] === null ||
      String(body[f]).trim() === "",
  );
  if (missing.length)
    throw AppError.badRequest(
      `Missing required field(s): ${missing.join(", ")}`,
      { missing },
    );
}

export function assertEmail(email) {
  if (!EMAIL_RE.test(email))
    throw AppError.badRequest("Please enter a valid email address");
}

export function assertPassword(password, confirmPassword) {
  const errs = passwordErrors(password);
  if (errs.length)
    throw AppError.badRequest(`Password must contain ${errs.join(", ")}`, {
      password: errs,
    });
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw AppError.badRequest("Password and confirm password do not match");
  }
}

export function assertSex(sex) {
  if (!SEXES.includes(sex))
    throw AppError.badRequest(`Sex must be one of ${SEXES.join(", ")}`);
}

export function assertDob(dob) {
  if (!isValidIsoDate(dob))
    throw AppError.badRequest(
      "Date of birth must be a valid date (YYYY-MM-DD)",
    );
  if (dob < "1900-01-01" || dob > todayInKolkata())
    throw AppError.badRequest("Date of birth must be between 1900 and today");
}

export function assertPhone(phone) {
  if (!PHONE_RE.test(String(phone).replace(/[\s-]/g, ""))) {
    throw AppError.badRequest("Contact number must contain 7 to 15 digits");
  }
}

export function toId(value, name = "id") {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0)
    throw AppError.badRequest(`Invalid ${name}`);
  return n;
}

/** escape LIKE wildcards in user input */
export const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
