/** Handles 8x8 JaaS webhooks: RECORDING_UPLOADED -> download from 8x8 -> upload to Cloudflare R2 */
import crypto from 'node:crypto';
import axios from 'axios';
import { query } from '../config/db.js';
import { SYSTEM_SQL } from '../scripts/system.sql.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { putRecordingStream, isR2Configured } from './storage.service.js';
import { todayInKolkata } from '../utils/date.js';

const TOLERANCE_SECONDS = 5 * 60;

/** Verify X-Jaas-Signature: t=<ts>,v1=<base64 hmac-sha256("<ts>.<raw body>")> */
export function verifyJaasSignature(rawBody, header, secret = env.jaas.webhookSecret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret) {
    if (env.isProduction) logger.warn('JAAS_WEBHOOK_SECRET not set - webhook signature NOT verified');
    return true;
  }
  if (!header) throw AppError.unauthorized('Missing webhook signature');
  const parts = Object.create(null);
  const v1 = [];
  for (const el of String(header).split(',')) {
    const [k, ...rest] = el.trim().split('=');
    const v = rest.join('=');
    if (k === 'v1') v1.push(v); else parts[k] = v;
  }
  const ts = Number(parts.t);
  if (!ts || !v1.length) throw AppError.unauthorized('Malformed webhook signature');
  if (Math.abs(nowSec - ts) > TOLERANCE_SECONDS) throw AppError.unauthorized('Webhook timestamp outside tolerance');
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`, 'utf8').digest('base64');
  const ok = v1.some((sig) => {
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) throw AppError.unauthorized('Invalid webhook signature');
  return true;
}

async function transfer(recordingId, appointmentId, sourceUrl, sessionId) {
  try {
    if (!isR2Configured()) throw new Error('Cloudflare R2 not configured (set R2_* variables)');
    const res = await axios.get(sourceUrl, { responseType: 'stream', timeout: 10 * 60 * 1000 });
    const key = `recordings/${todayInKolkata()}/appointment-${appointmentId || 'unknown'}-${sessionId || recordingId}.mp4`;
    const stored = await putRecordingStream(key, res.data, res.headers['content-type'] || 'video/mp4');
    await query(SYSTEM_SQL.RECORDING_UPDATE, [recordingId, stored.key, stored.url, 'uploaded', null]);
  } catch (err) {
    logger.error(`Recording ${recordingId} transfer failed: ${err.message}`);
    await query(SYSTEM_SQL.RECORDING_UPDATE, [recordingId, null, null, 'failed', err.message.slice(0, 500)]);
  }
}

/** Process a webhook event. Returns a small status object. */
export async function handleJaasEvent(event) {
  const type = event?.eventType;
  logger.info(`JaaS webhook ${type} for ${event?.fqn}`);
  if (type !== 'RECORDING_UPLOADED') return { handled: false, type };
  const fqn = String(event.fqn || '');
  const roomId = fqn.split('/').pop();
  let appointmentId = null;
  if (/^[0-9a-f-]{36}$/i.test(roomId)) {
    const { rows } = await query(SYSTEM_SQL.APPOINTMENT_ID_BY_ROOM, [roomId]);
    appointmentId = rows[0]?.id ?? null;
  }
  const data = event.data || {};
  const { rows } = await query(SYSTEM_SQL.RECORDING_INSERT, [
    appointmentId, fqn, String(event.idempotencyKey || crypto.randomUUID()), data.recordingSessionId || null,
    Number.isFinite(data.durationSec) ? Math.round(data.durationSec) : null, data.preAuthenticatedLink || null, 'pending',
  ]);
  if (!rows.length) return { handled: true, duplicate: true };
  if (data.preAuthenticatedLink) {
    // do the heavy transfer after acknowledging the webhook
    setImmediate(() => transfer(rows[0].id, appointmentId, data.preAuthenticatedLink, data.recordingSessionId));
  }
  return { handled: true, recordingId: Number(rows[0].id), appointmentId };
}
