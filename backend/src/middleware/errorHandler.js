import { env } from '../config/env.js';

export const notFoundHandler = (req, res) => {
  console.warn(`[http] 404 ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, next) => {
  const status = error.status || (error.code === '23505' ? 409 : 500);
  const message =
    error.code === '23505'
      ? 'A record with the same unique value already exists'
      : error.message || 'Unexpected server error';

  if (status >= 500) console.error(`[http] ${status} ${req.method} ${req.originalUrl} ::`, error);
  else console.warn(`[http] ${status} ${req.method} ${req.originalUrl} :: ${message}`);

  res.status(status).json({
    success: false,
    message,
    details: error.details || undefined,
    stack: env.nodeEnv === 'development' && status >= 500 ? error.stack : undefined,
  });
};
