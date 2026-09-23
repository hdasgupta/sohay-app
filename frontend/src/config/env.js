/** Frontend runtime configuration (from Vite .env files) */
const env = {
  appEnv: import.meta.env.VITE_APP_ENV || import.meta.env.MODE,
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, ''),
  organisationName: import.meta.env.VITE_ORGANISATION_NAME || 'West Bengal Forum for Mental Health',
  timezone: import.meta.env.VITE_APP_TIMEZONE || 'Asia/Kolkata',
};
export default env;
