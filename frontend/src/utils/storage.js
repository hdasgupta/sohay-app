export const saveSession = (s) => {
  localStorage.setItem("appointment_token", s.token);
  localStorage.setItem("appointment_user", JSON.stringify(s.user));
};
export const clearSession = () => {
  localStorage.removeItem("appointment_token");
  localStorage.removeItem("appointment_user");
};
export function getSession() {
  try {
    const token = localStorage.getItem("appointment_token");
    const user = JSON.parse(localStorage.getItem("appointment_user") || "null");
    return token && user ? { token, user } : null;
  } catch (e) {
    console.error("[STORAGE]", e);
    clearSession();
    return null;
  }
}
