import crypto from "node:crypto";
import { env } from "../config/env.js";
const store = new Map();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCaptcha() {
  let answer = "";
  for (let i = 0; i < 6; i++)
    answer += alphabet[crypto.randomInt(alphabet.length)];
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + env.captchaTtlSeconds * 1000;
  store.set(id, { answer, expiresAt });
  for (const [k, v] of store) if (v.expiresAt < Date.now()) store.delete(k);
  return { id, answer, expiresAt };
}
export const consumeCaptcha = (id, input) => {
  const v = store.get(id);
  store.delete(id);
  return Boolean(
    v &&
    v.expiresAt > Date.now() &&
    String(input || "")
      .trim()
      .toUpperCase() === v.answer,
  );
};
export function captchaSvg(answer) {
  const t = [...answer]
    .map(
      (c, i) =>
        `<text x="${20 + i * 31}" y="56" transform="rotate(${i % 2 ? "-7" : "7"},${20 + i * 31},45)" font-size="34" font-weight="900" fill="#173b73">${c}</text>`,
    )
    .join("");
  const l = Array.from(
    { length: 7 },
    (_, i) =>
      `<line x1="${5 + i * 33}" y1="${10 + (i % 3) * 22}" x2="${115 + i * 13}" y2="${82 - (i % 4) * 12}" stroke="#416b9b" stroke-width="2" opacity=".75"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="90"><rect width="210" height="90" rx="10" fill="#eef6ff"/>${l}${t}<circle cx="28" cy="18" r="3" fill="#173b73"/><circle cx="180" cy="70" r="4" fill="#0f5db7"/></svg>`;
}
