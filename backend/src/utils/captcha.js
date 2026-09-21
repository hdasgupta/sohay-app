import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import svgCaptcha from 'svg-captcha';
import { env } from '../config/env.js';
import { badRequest } from './httpError.js';

/**
 * Captcha is rendered as an SVG made of vector paths + noise lines, so the
 * answer never travels to the browser as readable text. The answer is kept in a
 * short lived signed token that the client echoes back on submit.
 */
export const createCaptcha = () => {
  const captcha = svgCaptcha.create({
    size: 6,
    noise: 5,
    color: true,
    background: '#0b1b33',
    ignoreChars: '0oO1ilI',
    width: 240,
    height: 90,
    fontSize: 72,
    charPreset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  });

  const answerHash = crypto
    .createHmac('sha256', env.captchaSecret)
    .update(captcha.text.toLowerCase())
    .digest('hex');

  const token = jwt.sign({ answerHash, nonce: crypto.randomUUID() }, env.captchaSecret, {
    expiresIn: env.captchaTtlSeconds,
  });

  console.log('[captcha] issued a new challenge');
  return { token, svg: captcha.data, ttlSeconds: env.captchaTtlSeconds };
};

export const assertCaptcha = (token, answer) => {
  if (!token || !answer) throw badRequest('Captcha is required');
  let payload;
  try {
    payload = jwt.verify(token, env.captchaSecret);
  } catch (error) {
    console.warn('[captcha] challenge expired or tampered:', error.message);
    throw badRequest('Captcha expired, please refresh the captcha image');
  }
  const candidate = crypto
    .createHmac('sha256', env.captchaSecret)
    .update(String(answer).trim().toLowerCase())
    .digest('hex');
  if (candidate !== payload.answerHash) {
    console.warn('[captcha] wrong answer supplied');
    throw badRequest('Captcha does not match, please try again');
  }
  console.log('[captcha] verified successfully');
};
