import fs from 'node:fs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Unique, unguessable room name for one appointment. */
export const buildRoomId = () => `wbffmh-${crypto.randomUUID()}`;

const readPrivateKey = () => {
  if (env.jitsi.privateKey && env.jitsi.privateKey.includes('BEGIN')) return env.jitsi.privateKey;
  try {
    if (fs.existsSync(env.jitsi.privateKeyPath)) {
      const key = fs.readFileSync(env.jitsi.privateKeyPath, 'utf8');
      if (key.includes('BEGIN')) return key;
      console.warn('[jitsi] the file at JAAS_PRIVATE_KEY_PATH does not look like a PEM private key');
    }
  } catch (error) {
    console.warn('[jitsi] private key file could not be read:', error.message);
  }
  return null;
};

/** A value that is still the example/placeholder from .env.example. */
const isPlaceholder = (value) =>
  !value || /0{6,}/.test(value) || value.includes('your-') || value.includes('change-me');

/**
 * Is this deployment able to issue real JaaS (8x8.vc) tokens?
 *
 * 8x8.vc ALWAYS requires a signed JWT. Joining it without one - or with the
 * placeholder app id - produces "Sorry, you are not allowed to join this call"
 * inside the Jitsi iframe, so we check up front and fall back instead.
 */
export const jaasStatus = () => {
  const privateKey = readPrivateKey();
  const missing = [];
  if (isPlaceholder(env.jitsi.appId)) missing.push('JAAS_APP_ID');
  if (isPlaceholder(env.jitsi.apiKey)) missing.push('JAAS_API_KEY');
  if (!privateKey) missing.push('JAAS_PRIVATE_KEY or JAAS_PRIVATE_KEY_PATH');
  return { ready: missing.length === 0, missing, privateKey };
};

/**
 * JaaS (8x8.vc) JWT. Moderators (doctors) get recording rights so the client
 * can start the recording programmatically as soon as the doctor joins.
 */
export const buildJaasToken = ({ roomId, user, isModerator, privateKey }) => {
  const key = privateKey || jaasStatus().privateKey;
  if (!key) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: env.jitsi.appId,
    room: roomId,
    exp: now + env.jitsi.tokenTtlSeconds,
    nbf: now - 10,
    context: {
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        moderator: isModerator ? 'true' : 'false',
      },
      features: {
        recording: isModerator ? 'true' : 'false',
        livestreaming: 'false',
        transcription: 'false',
        'outbound-call': 'false',
      },
    },
  };
  try {
    const token = jwt.sign(payload, key, {
      algorithm: 'RS256',
      header: { kid: env.jitsi.apiKey, typ: 'JWT' },
    });
    console.log(`[jitsi] issued JaaS token for room ${roomId} (moderator=${!!isModerator})`);
    return token;
  } catch (error) {
    console.error('[jitsi] could not sign JaaS token:', error.message);
    return null;
  }
};

/** JaaS rooms are namespaced by the app id; public Jitsi rooms are not. */
export const buildRoomName = (roomId) => (jaasStatus().ready ? `${env.jitsi.appId}/${roomId}` : roomId);

/**
 * Everything needed to mount the iframe: domain, room name and (for JaaS) the
 * signed token. Degrades to the public Jitsi deployment with a clear warning
 * rather than handing the browser a room it will be refused from.
 */
export const resolveMeeting = ({ roomId, user, isModerator }) => {
  const status = jaasStatus();
  if (!status.ready) {
    console.warn(
      `[jitsi] JaaS is not configured (missing: ${status.missing.join(', ')}); ` +
        `falling back to ${env.jitsi.fallbackDomain} for room ${roomId}`,
    );
    return {
      domain: env.jitsi.fallbackDomain,
      roomName: roomId,
      jwt: null,
      jaas: false,
      canRecord: false,
      missingConfig: status.missing,
      notice:
        'Video is running on the public Jitsi deployment because the 8x8.vc (JaaS) credentials are not configured yet. ' +
        'Recording to Google Drive stays off until they are set.',
    };
  }
  return {
    domain: env.jitsi.domain,
    roomName: `${env.jitsi.appId}/${roomId}`,
    jwt: buildJaasToken({ roomId, user, isModerator, privateKey: status.privateKey }),
    jaas: true,
    canRecord: Boolean(isModerator),
    missingConfig: [],
    notice: null,
  };
};

/** Direct video room link, mailed next to the in-app link. */
export const buildMeetingUrl = (roomId) => {
  const status = jaasStatus();
  const domain = status.ready ? env.jitsi.domain : env.jitsi.fallbackDomain;
  return `https://${domain}/${status.ready ? `${env.jitsi.appId}/${roomId}` : roomId}`;
};

/** In-app consultation link that is mailed to the patient. */
export const buildJoinUrl = (appointmentId) => `${env.frontendUrl}/consultation/${appointmentId}`;
