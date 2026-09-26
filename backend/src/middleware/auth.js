/** JWT authentication + role based authorisation */
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { query } from "../config/db.js";
import { COMMON_SQL } from "../scripts/common.sql.js";
import AppError from "../utils/AppError.js";
import logger from "../utils/logger.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      name: user.name,
      email: user.email,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw AppError.unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw AppError.unauthorized(
        "Your session has expired. Please login again",
      );
    }
    const { rows } = await query(COMMON_SQL.USER_FIND_BY_ID, [
      Number(payload.sub),
    ]);
    if (!rows.length) throw AppError.unauthorized("Account no longer exists");
    if (rows[0].is_disabled)
      throw AppError.forbidden(
        "Your account has been disabled. Please contact the administrator",
      );
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn(
        `Forbidden: user ${req.user?.id} (${req.user?.role}) tried ${req.method} ${req.originalUrl}`,
      );
      return next(AppError.forbidden());
    }
    return next();
  };
