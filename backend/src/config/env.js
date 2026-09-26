/**
 * Environment loader.
 * Order of precedence (first wins, real process env always wins):
 *   1. process.env (Render dashboard variables)
 *   2. /etc/secrets/.env.<NODE_ENV>   (Render "Secret File")
 *   3. ./.env.<NODE_ENV>
 *   4. ./.env
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const NODE_ENV = process.env.NODE_ENV || "development";
const candidates = [
  `/etc/secrets/.env.${NODE_ENV}`,
  path.resolve(process.cwd(), `.env.${NODE_ENV}`),
  path.resolve(process.cwd(), ".env"),
];
for (const file of candidates) {
  if (fs.existsSync(file))
    dotenv.config({ path: file, override: false, quiet: true });
}

// Everything in this app is Asia/Kolkata
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

const bool = (v, d = false) =>
  v === undefined || v === ""
    ? d
    : ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const list = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const env = {
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === "production",
  isTest: NODE_ENV === "test",
  port: int(process.env.PORT, 5000),
  timezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  ),
  corsOrigins: list(process.env.CORS_ORIGINS),
  corsAllowVercelPreviews: bool(process.env.CORS_ALLOW_VERCEL_PREVIEWS, true),

  databaseUrl: process.env.DATABASE_URL,
  dbSsl: bool(process.env.DB_SSL, NODE_ENV === "production"),
  dbPoolMax: int(process.env.DB_POOL_MAX, 10),

  jwtSecret: process.env.JWT_SECRET || "insecure-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  bcryptRounds: int(process.env.BCRYPT_SALT_ROUNDS, 12),
  otpSecret: process.env.OTP_SECRET || "insecure-otp-secret",
  captchaSecret: process.env.CAPTCHA_SECRET || "insecure-captcha-secret",
  otpValidityMinutes: int(process.env.OTP_VALIDITY_MINUTES, 10),
  captchaValidityMinutes: int(process.env.CAPTCHA_VALIDITY_MINUTES, 5),

  admin: {
    name: process.env.ADMIN_NAME || "Administrator",
    email: (process.env.ADMIN_EMAIL || "wbffmh@gmail.com").toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "Admin@12345",
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || "resend",
    resendApiKey: process.env.RESEND_API_KEY,
    from:
      process.env.EMAIL_FROM ||
      "West Bengal Forum for Mental Health <onboarding@resend.dev>",
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || "s3",
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "ap-southeast-1",
    bucket: process.env.PRESCRIPTION_BUCKET || "prescriptions",
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET || "wbfmh-recordings",
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
  },

  jaas: {
    appId: process.env.JAAS_APP_ID,
    apiKeyId: process.env.JAAS_API_KEY_ID,
    domain: process.env.JAAS_DOMAIN || "8x8.vc",
    webhookSecret: process.env.JAAS_WEBHOOK_SECRET,
    privateKey: (process.env.JAAS_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },

  medicineCsvUrl: process.env.MEDICINE_CSV_URL,
  medicineImportOnStart: bool(process.env.MEDICINE_IMPORT_ON_START, true),
  enableCron: bool(process.env.ENABLE_CRON, true),
};

export default env;
