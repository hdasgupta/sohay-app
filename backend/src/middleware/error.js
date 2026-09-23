import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

export function notFound(req, _res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Translate PostgreSQL constraint errors into friendly messages */
function fromPg(err) {
  if (err.code === '23505') {
    if (/ux_users_email/.test(err.constraint || '')) return new AppError('This email address is already registered', 409);
    if (/ux_doctor_slot/.test(err.constraint || '')) return new AppError('This time slot is already booked for the doctor', 409);
    if (/ux_patient_slot/.test(err.constraint || '')) return new AppError('The patient already has an appointment in this time slot', 409);
    if (/ux_open_invitation/.test(err.constraint || '')) return new AppError('An invitation is already pending for this patient', 409);
    return new AppError('Duplicate record', 409);
  }
  if (err.code === '23503') return new AppError('Referenced record does not exist', 400);
  if (err.code === '22P02' || err.code === '22007' || err.code === '22008') return new AppError('Invalid input value', 400);
  if (err.code === '23514') return new AppError('Input violates a data rule', 400);
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;
  if (!(error instanceof AppError)) {
    if (err.type === 'entity.too.large') error = new AppError('Request is too large', 413);
    else if (err.type === 'entity.parse.failed') error = new AppError('Malformed JSON body', 400);
    else error = fromPg(err) || error;
  }
  const status = error.status || 500;
  if (status >= 500) logger.error(`${req.method} ${req.originalUrl} ->`, err.stack || err.message);
  else logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${error.message}`);
  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProduction && !(error instanceof AppError) ? 'Something went wrong. Please try again' : error.message,
    details: error.details,
  });
}
