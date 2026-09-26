import jwt from "jsonwebtoken";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";

export const roomFqn = (roomId) => `${env.jaas.appId}/${roomId}`;

export function createMeetingToken(user, roomId, isModerator) {
  if (!env.jaas.privateKey || !env.jaas.appId || !env.jaas.apiKeyId) {
    throw new AppError("Video service is not configured", 500);
  }

  const now = Math.floor(Date.now() / 1000);

  // JaaS kid must identify the exact API key.
  // Accept either:
  //   <key-id>
  // or
  //   <app-id>/<key-id>
  const kid = env.jaas.apiKeyId.includes("/")
    ? env.jaas.apiKeyId
    : `${env.jaas.appId}/${env.jaas.apiKeyId}`;

  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: env.jaas.appId,

    // The JWT room claim is the room portion only.
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

      room: {
        regex: false,
      },
    },
  };

  return jwt.sign(payload, env.jaas.privateKey, {
    algorithm: "RS256",
    header: {
      kid,
      typ: "JWT",
      alg: "RS256",
    },
  });
}
