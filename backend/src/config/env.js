import "dotenv/config";
const must = ["DATABASE_URL", "FRONTEND_URL", "JWT_SECRET", "OTP_SECRET"];
for (const key of must)
  if (!process.env[key])
    throw new Error(`Missing environment variable: ${key}`);
export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  otpSecret: process.env.OTP_SECRET,
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 600),
  captchaTtlSeconds: Number(process.env.CAPTCHA_TTL_SECONDS || 300),
  mailFrom: process.env.MAIL_FROM || "himaghna.dasgupta@gmail.com",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpSecure: String(process.env.SMTP_SECURE || "true") === "true",
  smtpUser: process.env.SMTP_USER || "himaghna.dasgupta@gmail.com",
  smtpPass: process.env.SMTP_PASS || "",
  s3Endpoint: process.env.AWS_ENDPOINT_URL_S3,
  s3AccessKey: process.env.AWS_ACCESS_KEY_ID,
  s3Secret: process.env.AWS_SECRET_ACCESS_KEY,
  s3Region: process.env.AWS_REGION || "ap-southeast-1",
  s3Bucket: process.env.AWS_S3_BUCKET || "prescriptions",
  jitsiDomain: process.env.JITSI_DOMAIN || "8x8.vc",
  jitsiTenant: process.env.JITSI_TENANT || "",
  googleTargetEmail:
    process.env.GOOGLE_DRIVE_TARGET_EMAIL || "himaghna.dasgupta@gmail.com",
  googleClientId: process.env.GOOGLE_DRIVE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || "",
  googleRefreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "",
  googleFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
};
