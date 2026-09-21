export const SEX_OPTIONS = [
  { id: 'MALE', name: 'Male' },
  { id: 'FEMALE', name: 'Female' },
  { id: 'OTHER', name: 'Other' },
];

export const FOOD_OPTIONS = [
  { id: 'BEFORE_FOOD', name: 'Before food' },
  { id: 'WITH_FOOD', name: 'With food' },
  { id: 'AFTER_FOOD', name: 'After food' },
];

export const WEEKDAYS = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
];

export const STATUS_TONES = {
  SCHEDULED: 'info',
  RESCHEDULED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export const ORG_NAME = import.meta.env.VITE_ORG_NAME || 'West Bengal Forum for Mental Health';
export const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || '8x8.vc';
