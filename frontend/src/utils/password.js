/** Password rules shared by every password field (mirrors the backend) */
export const PASSWORD_RULES = [
  { key: 'upper', label: 'At least one upper case letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'At least one lower case letter', test: (p) => /[a-z]/.test(p) },
  { key: 'digit', label: 'At least one digit', test: (p) => /\d/.test(p) },
  { key: 'special', label: 'At least one special character', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  { key: 'length', label: 'At least 8 characters long', test: (p) => p.length >= 8 },
  { key: 'space', label: 'No spaces', test: (p) => p.length > 0 && !/\s/.test(p) },
];
export const isPasswordValid = (p) => typeof p === 'string' && PASSWORD_RULES.every((r) => r.test(p));
