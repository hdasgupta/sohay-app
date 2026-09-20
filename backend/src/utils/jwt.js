import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from './httpError.js';

export const signAuthToken = (user) =>
  jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

export const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (error) {
    console.warn('[jwt] token verification failed:', error.message);
    throw unauthorized('Session expired, please login again');
  }
};
