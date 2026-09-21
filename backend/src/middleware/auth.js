import { verifyAuthToken } from '../utils/jwt.js';
import { forbidden, unauthorized } from '../utils/httpError.js';
import { queryOne } from '../config/db.js';
import { SELECT_USER_BY_ID } from '../scripts/common.sql.js';

export const ROLES = { ADMIN: 'ADMIN', PATIENT: 'PATIENT', DOCTOR: 'DOCTOR' };

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('Missing authentication token');

    const payload = verifyAuthToken(token);
    const user = await queryOne(SELECT_USER_BY_ID, [payload.sub]);
    if (!user) throw unauthorized('Account no longer exists');
    if (user.is_disabled) throw forbidden('Your account has been disabled');

    req.user = { id: Number(user.id), name: user.name, email: user.email, role: user.role };
    console.log(`[auth] ${req.method} ${req.originalUrl} by ${user.email} (${user.role})`);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      console.warn(`[auth] role ${req.user.role} blocked from ${req.originalUrl}`);
      return next(forbidden(`This action is limited to: ${roles.join(', ')}`));
    }
    return next();
  };
