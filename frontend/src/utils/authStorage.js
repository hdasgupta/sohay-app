/** Persist the login for 30 days in localStorage (until manual logout) */
import { AUTH_TTL_MS } from "../config/constants.js";
import logger from "./logger.js";

const KEY = "wbfmh.auth";
const REDIRECT_KEY = "wbfmh.redirectAfterLogin";

export function saveAuth({ token, user, expiresAt }) {
  const exp = expiresAt
    ? new Date(expiresAt).getTime()
    : Date.now() + AUTH_TTL_MS;
  localStorage.setItem(KEY, JSON.stringify({ token, user, expiresAt: exp }));
}

export function loadAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.token || !data.user || Date.now() > Number(data.expiresAt)) {
      logger.warn("Stored session expired - clearing");
      localStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export const clearAuth = () => localStorage.removeItem(KEY);
export const getToken = () => loadAuth()?.token || null;

export const rememberRedirect = (path) => {
  if (path && !/^\/(login|register|reset-password)/.test(path))
    sessionStorage.setItem(REDIRECT_KEY, path);
};
export const takeRedirect = () => {
  const p = sessionStorage.getItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  return p;
};
