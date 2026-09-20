import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSession, saveSession, clearSession } from "../utils/storage";
const C = createContext(null);
export function AppProvider({ children }) {
  const [session, setSession] = useState(getSession());
  const [theme, setTheme] = useState(
    localStorage.getItem("appointment_theme") || "dark",
  );
  const [busy, setBusy] = useState(0);
  const [message, setMessage] = useState(null);
  useEffect(() => {
    const f = (e) => setBusy((x) => Math.max(0, x + Number(e.detail || 0)));
    window.addEventListener("api:loading", f);
    return () => window.removeEventListener("api:loading", f);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("appointment_theme", theme);
  }, [theme]);
  const login = (s) => {
    saveSession(s);
    setSession(s);
  };
  const logout = () => {
    clearSession();
    setSession(null);
    location.href = "/login";
  };
  const notify = (type, text, duration = 10000) =>
    setMessage({ type, text, duration });
  const value = useMemo(
    () => ({
      session,
      login,
      logout,
      theme,
      setTheme,
      busy,
      message,
      setMessage,
      notify,
    }),
    [session, theme, busy, message],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useApp = () => useContext(C);
