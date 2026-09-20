import { pool } from "../config/db.js";
import {
  healthCheck,
  findUserByEmail,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
} from "../../scripts/sql/generalQueries.js";
import { comparePassword, issueJwt } from "../services/authService.js";
import {
  generateCaptcha,
  consumeCaptcha,
  captchaSvg,
} from "../services/captchaService.js";
import { requestOtp as createOtp, verifyOtp } from "../services/otpService.js";
import { validDate } from "../utils/validation.js";
export async function health(req, res) {
  const r = await pool.query(healthCheck, ["ok"]);
  res.json({ status: r.rows[0].status });
}
export function captcha(req, res) {
  const c = generateCaptcha();
  console.log("[CAPTCHA] generated", c.id);
  res.json({
    id: c.id,
    image: `data:image/svg+xml;base64,${Buffer.from(captchaSvg(c.answer)).toString("base64")}`,
    expiresAt: c.expiresAt,
  });
}
export async function requestOtp(req, res) {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const purpose = req.body.purpose;
  if (!email || !["register", "reset"].includes(purpose))
    return res.status(400).json({ message: "Invalid OTP request." });
  if (!consumeCaptcha(req.body.captchaId, req.body.captchaAnswer))
    return res.status(400).json({ message: "Invalid captcha." });
  const u = await pool.query(findUserByEmail, [
    email,
    "admin",
    "patient",
    "doctor",
    1,
  ]);
  if (purpose === "register" && u.rowCount)
    return res.status(409).json({ message: "Email is already registered." });
  if (purpose === "reset" && !u.rowCount)
    return res
      .status(404)
      .json({ message: "Email does not exist in the user database." });
  const r = await createOtp(email, purpose);
  res.json({
    message: "OTP sent successfully. It is valid for 10 minutes.",
    expiresAt: r.expiresAt,
  });
}
export function verifyOtpCode(req, res) {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const purpose = req.body.purpose;
  const token = verifyOtp(email, purpose, req.body.otp);
  res.json({
    message: "OTP verified successfully.",
    otpVerificationToken: token,
  });
}
export async function login(req, res) {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  if (!consumeCaptcha(req.body.captchaId, req.body.captchaAnswer))
    return res.status(400).json({ message: "Invalid captcha." });
  const r = await pool.query(findUserByEmail, [
    email,
    "admin",
    "patient",
    "doctor",
    1,
  ]);
  if (!r.rowCount)
    return res.status(401).json({ message: "Invalid email or password." });
  const u = r.rows[0];
  if (u.is_disabled)
    return res.status(403).json({ message: "This account is disabled." });
  if (!(await comparePassword(req.body.password, u.password_hash)))
    return res.status(401).json({ message: "Invalid email or password." });
  const token = issueJwt({
    sub: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
  });
  console.log("[AUTH] login success", u.email, u.role);
  res.json({
    token,
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
  });
}
