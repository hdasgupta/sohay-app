/**
 * Captcha generator: paints distorted glyphs into a raw PNG (pngjs) - the answer never leaves the server.
 * Hardening against OCR: per-glyph rotation/scale/shear, sine warp of the whole image, overlapping glyphs,
 * colour-matched interference curves, speckle noise and a gradient background.
 */
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { query } from '../config/db.js';
import { COMMON_SQL } from '../scripts/common.sql.js';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { CAPTCHA_CHARSET, glyphCells } from './captchaFont.js';

const WIDTH = 240;
const HEIGHT = 80;
const LENGTH = 6;
const testAnswers = new Map(); // only populated when NODE_ENV=test

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => crypto.randomInt(min, max + 1);
const hashAnswer = (answer) =>
  crypto.createHmac('sha256', env.captchaSecret).update(String(answer).trim().toUpperCase()).digest('hex');

function randomText() {
  let s = '';
  for (let i = 0; i < LENGTH; i += 1) s += CAPTCHA_CHARSET[crypto.randomInt(CAPTCHA_CHARSET.length)];
  return s;
}

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function renderCaptcha(text) {
  const buf = new Float32Array(WIDTH * HEIGHT * 3);
  // gradient background
  const hueBg = rand(0, 360);
  const c1 = hsl(hueBg, 0.35, 0.88);
  const c2 = hsl((hueBg + 60) % 360, 0.35, 0.8);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const t = (x / WIDTH + y / HEIGHT) / 2;
      const i = (y * WIDTH + x) * 3;
      for (let c = 0; c < 3; c += 1) buf[i + c] = c1[c] * (1 - t) + c2[c] * t + rand(-18, 18);
    }
  }
  const plot = (x, y, color, alpha = 1) => {
    const xi = Math.round(x); const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= WIDTH || yi >= HEIGHT) return;
    const i = (yi * WIDTH + xi) * 3;
    for (let c = 0; c < 3; c += 1) buf[i + c] = buf[i + c] * (1 - alpha) + color[c] * alpha;
  };
  const disc = (cx, cy, r, color) => {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) plot(cx + dx, cy + dy, color, Math.min(1, r - d + 0.6));
    }
  };

  const glyphColors = [];
  const cellW = WIDTH / (LENGTH + 0.8);
  [...text].forEach((ch, idx) => {
    const color = hsl(rand(0, 360), rand(0.55, 0.85), rand(0.18, 0.38));
    glyphColors.push(color);
    const scale = rand(4.4, 5.4);
    const angle = rand(-0.45, 0.45);
    const shear = rand(-0.35, 0.35);
    const cx = cellW * (idx + 0.9) + rand(-4, 4);
    const cy = HEIGHT / 2 + rand(-7, 7);
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const radius = Math.max(2, Math.round(scale * rand(0.36, 0.46)));
    const cells = glyphCells(ch);
    const lit = new Set(cells.map((c) => `${c.x - 0.5},${c.y - 0.5}`));
    const toCanvas = (gxCell, gyCell) => {
      const gx = (gxCell - 2.5) * scale;
      const gy = (gyCell - 3.5) * scale * 1.15;
      const sx = gx + shear * gy;
      return [cx + sx * cos - gy * sin, cy + sx * sin + gy * cos];
    };
    const segment = (a, b) => {
      const [x1, y1] = toCanvas(a.x, a.y); const [x2, y2] = toCanvas(b.x, b.y);
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5));
      for (let k = 0; k <= steps; k += 1) {
        const t = k / steps;
        disc(x1 + (x2 - x1) * t + rand(-0.3, 0.3), y1 + (y2 - y1) * t + rand(-0.3, 0.3), radius, color);
      }
    };
    for (const cell of cells) {
      const gx = cell.x - 0.5; const gy = cell.y - 0.5;
      const [px0, py0] = toCanvas(cell.x, cell.y);
      disc(px0, py0, radius, color);
      const right = lit.has(`${gx + 1},${gy}`); const down = lit.has(`${gx},${gy + 1}`);
      if (right) segment(cell, { x: cell.x + 1, y: cell.y });
      if (down) segment(cell, { x: cell.x, y: cell.y + 1 });
      if (lit.has(`${gx + 1},${gy + 1}`) && !right && !down) segment(cell, { x: cell.x + 1, y: cell.y + 1 });
      if (lit.has(`${gx - 1},${gy + 1}`) && !down && !lit.has(`${gx - 1},${gy}`)) segment(cell, { x: cell.x - 1, y: cell.y + 1 });
    }
  });

  // interference curves in glyph colours
  for (let n = 0; n < 3; n += 1) {
    const color = glyphColors[n % glyphColors.length];
    const x0 = rand(0, WIDTH * 0.2); const x3 = rand(WIDTH * 0.8, WIDTH);
    const pts = [[x0, rand(0, HEIGHT)], [rand(0, WIDTH), rand(-20, HEIGHT + 20)], [rand(0, WIDTH), rand(-20, HEIGHT + 20)], [x3, rand(0, HEIGHT)]];
    const thick = 1;
    for (let t = 0; t <= 1; t += 0.002) {
      const u = 1 - t;
      const x = u ** 3 * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t ** 3 * pts[3][0];
      const y = u ** 3 * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t ** 3 * pts[3][1];
      disc(x, y, thick, color);
    }
  }
  // speckles
  for (let n = 0; n < 600; n += 1) plot(rand(0, WIDTH), rand(0, HEIGHT), hsl(rand(0, 360), 0.6, rand(0.2, 0.7)), rand(0.4, 1));

  // global sine warp
  const out = new PNG({ width: WIDTH, height: HEIGHT });
  const ax = rand(2.5, 4.5); const ay = rand(2, 4);
  const px = rand(0, Math.PI * 2); const py = rand(0, Math.PI * 2);
  const lx = rand(18, 30); const ly = rand(26, 40);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const sx = Math.min(WIDTH - 1, Math.max(0, Math.round(x + ax * Math.sin(y / lx + px))));
      const sy = Math.min(HEIGHT - 1, Math.max(0, Math.round(y + ay * Math.sin(x / ly + py))));
      const si = (sy * WIDTH + sx) * 3;
      const di = (y * WIDTH + x) * 4;
      out.data[di] = Math.max(0, Math.min(255, buf[si]));
      out.data[di + 1] = Math.max(0, Math.min(255, buf[si + 1]));
      out.data[di + 2] = Math.max(0, Math.min(255, buf[si + 2]));
      out.data[di + 3] = 255;
    }
  }
  return PNG.sync.write(out);
}

/** Create and persist a captcha; returns { captchaId, image (data URL), expiresAt } */
export async function createCaptcha() {
  const text = randomText();
  const png = renderCaptcha(text);
  const { rows } = await query(COMMON_SQL.CAPTCHA_INSERT, [hashAnswer(text), env.captchaValidityMinutes]);
  if (env.isTest) testAnswers.set(rows[0].id, text);
  return { captchaId: rows[0].id, image: `data:image/png;base64,${png.toString('base64')}`, expiresAt: rows[0].expires_at };
}

/** Verify (single use). Throws AppError on failure. */
export async function verifyCaptcha(captchaId, captchaText) {
  if (!captchaId || !captchaText) throw AppError.badRequest('Please enter the captcha');
  if (!/^[0-9a-f-]{36}$/i.test(String(captchaId))) throw AppError.badRequest('Invalid captcha, please refresh it');
  const { rows } = await query(COMMON_SQL.CAPTCHA_CONSUME, [captchaId, false]);
  if (!rows.length) throw AppError.badRequest('Captcha expired, please refresh and try again');
  const expected = Buffer.from(rows[0].answer_hash, 'hex');
  const given = Buffer.from(hashAnswer(captchaText), 'hex');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    logger.warn('Captcha mismatch');
    throw AppError.badRequest('Captcha does not match, please try again');
  }
  return true;
}

/** Test helper - never available outside NODE_ENV=test */
export function peekCaptchaAnswer(id) {
  if (!env.isTest) throw new Error('peekCaptchaAnswer is only available in tests');
  return testAnswers.get(id);
}
