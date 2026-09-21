import { badRequest } from '../utils/httpError.js';
import { isValidISODate } from '../utils/dates.js';
import { isAlignedSlot } from '../utils/slots.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const requireFields = (body, fields) => {
  const missing = fields.filter((field) => {
    const value = body?.[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(', ')}`);
};

export const normalizeEmail = (email) => {
  const value = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(value)) throw badRequest('Please provide a valid email address');
  return value;
};

export const assertEnum = (value, allowed, label) => {
  if (!allowed.includes(value)) throw badRequest(`${label} must be one of: ${allowed.join(', ')}`);
  return value;
};

export const assertISODate = (value, label = 'Date') => {
  if (!isValidISODate(value)) throw badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  return value;
};

export const assertSlot = (value, label = 'Time slot') => {
  if (!isAlignedSlot(value)) throw badRequest(`${label} must be a 30 minute aligned time (HH:MM)`);
  return value;
};

export const assertContactNumber = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 15) throw badRequest('Contact number must contain 10 to 15 digits');
  return String(value).trim();
};
