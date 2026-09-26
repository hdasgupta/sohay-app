import bcrypt from "bcryptjs";
import env from "../config/env.js";

/** Same rules as the frontend Password component */
export const PASSWORD_RULES = [
  {
    key: "upper",
    test: (p) => /[A-Z]/.test(p),
    message: "at least one upper case letter",
  },
  {
    key: "lower",
    test: (p) => /[a-z]/.test(p),
    message: "at least one lower case letter",
  },
  { key: "digit", test: (p) => /\d/.test(p), message: "at least one digit" },
  {
    key: "special",
    test: (p) => /[^A-Za-z0-9\s]/.test(p),
    message: "at least one special character",
  },
  {
    key: "length",
    test: (p) => p.length >= 8,
    message: "at least 8 characters",
  },
  { key: "space", test: (p) => !/\s/.test(p), message: "no spaces" },
];

export function passwordErrors(password) {
  if (typeof password !== "string") return PASSWORD_RULES.map((r) => r.message);
  return PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.message);
}

/** bcryptjs hash - genSalt produces a unique random salt that is embedded in the hash */
export async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(env.bcryptRounds);
  return bcrypt.hash(plain, salt);
}
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
