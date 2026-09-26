export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v) => EMAIL_RE.test(String(v || "").trim());
export const isPhone = (v) =>
  /^\+?[0-9]{7,15}$/.test(String(v || "").replace(/[\s-]/g, ""));
export const initials = (name = "") =>
  name
    .replace(/^dr\.?\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
