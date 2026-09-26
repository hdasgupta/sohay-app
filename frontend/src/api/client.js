/**
 * Axios instance used by every API module.
 *  - attaches the JWT
 *  - shows the hour-glass loader for every backend call (config.loaderMessage / config.silentLoader)
 *  - shows an error message box for every failed call (config.silentError to suppress)
 *  - on 401 clears the session and asks the app to go to the login page
 */
import axios from "axios";
import env from "../config/env.js";
import { getToken, clearAuth } from "../utils/authStorage.js";
import { loaderBus, notify, authBus, nextId } from "../utils/eventBus.js";
import logger from "../utils/logger.js";

const client = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-Client-Timezone"] =
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!config.silentLoader) {
    config.loaderId = nextId();
    loaderBus.emit({
      type: "start",
      id: config.loaderId,
      message: config.loaderMessage || "Please wait...",
    });
  }
  logger.info(`API -> ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

const stopLoader = (config) => {
  if (config?.loaderId) loaderBus.emit({ type: "stop", id: config.loaderId });
};

async function extractMessage(error) {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message;
    } catch {
      return null;
    }
  }
  return data?.message;
}

client.interceptors.response.use(
  (response) => {
    stopLoader(response.config);
    logger.info(`API <- ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    stopLoader(error.config);
    const status = error.response?.status;
    let message = await extractMessage(error);
    if (!message) {
      if (error.code === "ECONNABORTED")
        message = "The server took too long to respond. Please try again";
      else if (!error.response)
        message =
          "Unable to reach the server. Please check your internet connection (the server may be waking up, retry in a few seconds)";
      else message = `Request failed (${status})`;
    }
    logger.error(
      `API x ${status || "network"} ${error.config?.url}: ${message}`,
    );
    const isAuthCall = /\/auth\/(login|otp|register|reset-password)/.test(
      error.config?.url || "",
    );
    if (status === 401 && !isAuthCall) {
      clearAuth();
      authBus.emit({ type: "expired" });
    }
    if (!error.config?.silentError) notify.error(message);
    const normalised = new Error(message);
    normalised.status = status;
    normalised.details = error.response?.data?.details;
    normalised.isApiError = true;
    return Promise.reject(normalised);
  },
);

/** unwrap { success, message, data } */
export const unwrap = (res) => ({
  data: res.data?.data,
  message: res.data?.message,
});
export default client;
