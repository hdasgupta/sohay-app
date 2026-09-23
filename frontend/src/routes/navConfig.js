/** Navigation links per role. The first entry is the default landing page. */
export const NAV = {
  admin: [
    { to: '/admin/add-doctor', label: 'Add Doctor', icon: 'plus' },
    { to: '/admin/doctors', label: 'Doctor List', icon: 'list' },
    { to: '/admin/reschedule', label: 'Reschedule Appointment', icon: 'calendar' },
  ],
  patient: [
    { to: '/patient/book', label: 'Book Appointment', icon: 'calendar' },
    { to: '/patient/appointments', label: 'Appointment List', icon: 'list' },
    { to: '/patient/family', label: 'Manage Family', icon: 'users' },
  ],
  doctor: [
    { to: '/doctor/prescription', label: 'Generate Prescription', icon: 'pill' },
    { to: '/doctor/appointments', label: 'Appointment List', icon: 'list' },
  ],
};

export const defaultPathFor = (role) => NAV[role]?.[0]?.to || '/login';

/** Can this role open this path? (used for the post-login deep-link redirect) */
export function isPathAllowed(role, path) {
  if (!path) return false;
  if (path.startsWith('/meeting/')) return role === 'patient' || role === 'doctor';
  if (role === 'admin' && /^\/admin\/doctors\/\d+\/edit$/.test(path)) return true;
  return (NAV[role] || []).some((n) => path === n.to || path.startsWith(`${n.to}?`));
}
