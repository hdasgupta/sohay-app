import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api",
  timeout: 30000,
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("appointment_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  window.dispatchEvent(new CustomEvent("api:loading", { detail: 1 }));
  console.log("[API] request", config.method, config.url);
  return config;
});
api.interceptors.response.use(
  (r) => {
    window.dispatchEvent(new CustomEvent("api:loading", { detail: -1 }));
    console.log("[API] response", r.status, r.config.url);
    return r;
  },
  (e) => {
    window.dispatchEvent(new CustomEvent("api:loading", { detail: -1 }));
    console.error("[API] failure", e);
    return Promise.reject(e);
  },
);
export const getErrorMessage = (e) =>
  e?.response?.data?.message || e?.message || "Backend call failed.";
