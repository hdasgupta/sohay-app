import bcryptjs from 'bcryptjs';
import { env } from '../config/env.js';
import { badRequest } from './httpError.js';

export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'At least one upper case letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'At least one lower case letter', test: (v) => /[a-z]/.test(v) },
  { key: 'digit', label: 'At least one digit', test: (v) => /[0-9]/.test(v) },
  { key: 'special', label: 'At least one special character', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
  { key: 'nospace', label: 'No space allowed', test: (v) => !/\s/.test(v) },
];

export const validatePasswordStrength = (password) => {
  const value = String(password || '');
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
  return { valid: failed.length === 0, failed };
};

export const assertStrongPassword = (password, confirmPassword) => {
  const { valid, failed } = validatePasswordStrength(password);
  if (!valid) {
    console.warn('[password] rejected weak password:', failed.join(' | '));
    throw badRequest('Password does not satisfy the required rules', failed);
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw badRequest('Password and confirm password do not match');
  }
};

/** Hash with a freshly generated per-password salt. */
export const hashPassword = async (password) => {
  const salt = await bcryptjs.genSalt(env.bcryptSaltRounds);
  const hash = await bcryptjs.hash(password, salt);
  console.log('[password] generated salted hash');
  return hash;
};

export const verifyPassword = async (password, hash) => bcryptjs.compare(String(password || ''), String(hash || ''));
