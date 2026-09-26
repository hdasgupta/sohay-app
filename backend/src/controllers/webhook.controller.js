import { ok } from "../utils/response.js";
import AppError from "../utils/AppError.js";
import {
  verifyJaasSignature,
  handleJaasEvent,
} from "../services/recording.service.js";

export async function jaasWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  verifyJaasSignature(raw, req.get("X-Jaas-Signature"));
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    throw AppError.badRequest("Invalid JSON");
  }
  ok(res, await handleJaasEvent(event));
}
