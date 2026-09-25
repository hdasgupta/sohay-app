import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadAuth, saveAuth, clearAuth } from '../utils/authStorage.js';
import { authBus, notify } from '../utils/eventBus.js';
import logger from '../utils/logger.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadAuth());

  const login = useCallback((data) => {
    saveAuth(data);
    setAuth(loadAuth());
    logger.info(`Logged in as ${data.user.email} (${data.user.role})`);
  }, []);

  const logout = useCallback((reason) => {
    clearAuth();
    setAuth(null);
    logger.info('Logged out', reason || '');
  }, []);

  useEffect(() => authBus.subscribe((e) => {
    if (e.type === 'expired') {
      setAuth(null);
      notify.warning('Your session has expired. Please login again');
    }
  }), []);

  // keep tabs in sync
  useEffect(() => {
    const onStorage = (e) => { if (e.key === 'wbfmh.auth') setAuth(loadAuth()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ user: auth?.user || null, token: auth?.token || null, login, logout }), [auth, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
