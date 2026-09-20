import { nanoid } from "nanoid";
import { env } from "../config/env.js";
export function createRoom() {
  const roomId = `wbffmh-${Date.now()}-${nanoid(12)}`;
  return {
    roomId,
    publicUrl: `https://${env.jitsiDomain}/${env.jitsiTenant ? `${env.jitsiTenant}/` : ""}${roomId}`,
  };
}
