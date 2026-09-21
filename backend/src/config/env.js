import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};
const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const list = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),

  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  backendUrl: (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, ''),
  corsOrigins: list(process.env.CORS_ORIGINS),

  databaseUrl: process.env.DATABASE_URL,
  pgSsl: bool(process.env.PGSSL, true),

  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  captchaSecret: process.env.CAPTCHA_SECRET || 'dev-captcha-secret',
  captchaTtlSeconds: num(process.env.CAPTCHA_TTL_SECONDS, 300),
  bcryptSaltRounds: num(process.env.BCRYPT_SALT_ROUNDS, 12),

  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'WBFFMH Administrator',
    email: (process.env.SEED_ADMIN_EMAIL || 'wbffmh@gmail.com').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },

  otpTtlMinutes: num(process.env.OTP_TTL_MINUTES, 10),
  otpLength: num(process.env.OTP_LENGTH, 6),

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: num(process.env.SMTP_PORT, 465),
    secure: bool(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.MAIL_FROM_NAME || 'West Bengal Forum for Mental Health',
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
  },

  s3: {
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-southeast-1',
    bucket: process.env.S3_BUCKET || 'prescriptions',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    urlTtlSeconds: num(process.env.PRESCRIPTION_URL_TTL_SECONDS, 604800),
  },

  org: {
    name: process.env.ORG_NAME || 'West Bengal Forum for Mental Health',
    logoPath: path.resolve(BACKEND_ROOT, process.env.ORG_LOGO_PATH || 'assets/logo.png'),
    signaturePath: path.resolve(BACKEND_ROOT, process.env.DOCTOR_SIGNATURE_PATH || 'assets/signature.png'),
  },

  jitsi: {
    domain: process.env.JITSI_DOMAIN || '8x8.vc',
    /**
     * Used when the JaaS credentials are missing or still the placeholders:
     * 8x8.vc refuses a tokenless join ("Sorry, you are not allowed to join this
     * call"), while the public Jitsi deployment accepts it.
     */
    fallbackDomain: process.env.JITSI_FALLBACK_DOMAIN || 'meet.jit.si',
    appId: process.env.JAAS_APP_ID || '',
    apiKey: process.env.JAAS_API_KEY || '',
    privateKey: (process.env.JAAS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    privateKeyPath: path.resolve(BACKEND_ROOT, process.env.JAAS_PRIVATE_KEY_PATH || 'assets/jaas.pem'),
    tokenTtlSeconds: num(process.env.JAAS_TOKEN_TTL_SECONDS, 7200),
    webhookSecret: process.env.JAAS_WEBHOOK_SECRET || '',
  },

  drive: {
    enabled: bool(process.env.GOOGLE_DRIVE_ENABLED, false),
    ownerEmail: process.env.GOOGLE_DRIVE_OWNER_EMAIL || 'himaghna.dasgupta@gmail.com',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  },

  medicine: {
    csvUrl:
      process.env.MEDICINE_CSV_URL ||
      'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/refs/heads/main/DATA/indian_medicine_data.csv',
    importLimit: num(process.env.MEDICINE_IMPORT_LIMIT, 40000),
  },

  jobs: {
    cancelCron: process.env.CANCEL_JOB_CRON || '0 0 * * *',
    timezone: process.env.CANCEL_JOB_TIMEZONE || 'Asia/Kolkata',
  },
};

if (!env.databaseUrl) {
  console.error('[env] FATAL: DATABASE_URL is not configured in backend/.env');
}

console.log(`[env] loaded configuration for NODE_ENV=${env.nodeEnv}`);
