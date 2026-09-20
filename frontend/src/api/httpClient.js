import axios from 'axios';
import { readItem, removeItem, writeItem } from '../utils/safeStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const STORAGE_KEY = 'wbffmh.auth';

/**
 * Hooks registered by LoaderContext / MessageContext so that every backend call
 * shows the loader and every failure shows an error message box.
 */
const hooks = {
  onRequestStart: null,
  onRequestEnd: null,
  onError: null,
  onUnauthorized: null,
};

export const registerHttpHooks = (next) => {
  Object.assign(hooks, next);
};

export const readStoredAuth = () => {
  try {
    const raw = readItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('[http] could not read stored login information', error);
    return null;
  }
};

export const writeStoredAuth = (value) => {
  try {
    if (value) writeItem(STORAGE_KEY, JSON.stringify(value));
    else removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[http] could not persist login information', error);
  }
};

const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
  // Bearer tokens are used for authentication, so the automatic XSRF cookie
  // lookup is disabled (it also fails in sandboxed frames without cookies).
  xsrfCookieName: false,
  withXSRFToken: false,
});

httpClient.interceptors.request.use((config) => {
  const stored = readStoredAuth();
  if (stored?.token) config.headers.Authorization = `Bearer ${stored.token}`;
  console.log(`[http] -> ${String(config.method).toUpperCase()} ${config.url}`);
  hooks.onRequestStart?.(config);
  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    console.log(`[http] <- ${response.status} ${response.config.url}`);
    hooks.onRequestEnd?.(response.config);
    return response;
  },
  (error) => {
    hooks.onRequestEnd?.(error.config);
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK' ? 'Backend server is not reachable right now' : error.message) ||
      'Unexpected error';
    console.error(`[http] <- error ${status || ''} ${error.config?.url || ''} :: ${message}`);
    hooks.onError?.(message, status);
    if (status === 401) hooks.onUnauthorized?.();
    return Promise.reject(new Error(message));
  },
);

/** Unwraps the { success, message, data } envelope used by the backend. */
export const unwrap = (response) => response.data?.data;
export const unwrapFull = (response) => response.data;

export default httpClient;
