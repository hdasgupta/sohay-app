/** 8x8 JaaS (Jitsi as a Service) JWT generation - RS256 signed with the tenant private key. */
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";

export const roomFqn = (roomId) => `${env.jaas.appId}/${roomId}`;

/**
 * @param {{ id, name, email }} user
 * @param {string} roomId  unique appointment room uuid
 * @param {boolean} isModerator  doctor = moderator (can record)
 */
export function createMeetingToken(user, roomId, isModerator) {
  if (!env.jaas.privateKey || !env.jaas.appId || !env.jaas.apiKeyId)
    throw new AppError("Video service is not configured", 500);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: env.jaas.appId,
    room: roomId,
    iat: now,
    nbf: now - 10,
    exp: now + 3 * 60 * 60,
    context: {
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        avatar: "",
        moderator: isModerator ? "true" : "false",
      },
      features: {
        livestreaming: "false",
        recording: isModerator ? "true" : "false",
        transcription: "false",
        "outbound-call": "false",
        "sip-outbound-call": "false",
      },
      room: { regex: false },
    },
  };
  return jwt.sign(payload, env.jaas.privateKey, {
    algorithm: "RS256",
    header: { kid: env.jaas.apiKeyId, typ: "JWT", alg: "RS256" },
  });
}
