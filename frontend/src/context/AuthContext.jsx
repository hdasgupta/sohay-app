import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStoredAuth, registerHttpHooks, writeStoredAuth } from '../api/httpClient';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export const DEFAULT_PAGE_BY_ROLE = {
  ADMIN: '/admin/add-doctor',
  PATIENT: '/patient/book-appointment',
  DOCTOR: '/doctor/generate-prescription',
};

export const AuthProvider = ({ children }) => {
  // Login information is kept in local storage so the session survives reloads.
  const [auth, setAuth] = useState(() => readStoredAuth());
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    console.log('[auth] logging out');
    writeStoredAuth(null);
    setAuth(null);
  }, []);

  useEffect(() => {
    registerHttpHooks({ onUnauthorized: () => logout() });
  }, [logout]);

  useEffect(() => {
    const verify = async () => {
      if (auth?.token) {
        try {
          const profile = await authApi.me();
          setAuth((current) => {
            const next = { ...current, user: { ...current.user, ...profile } };
            writeStoredAuth(next);
            return next;
          });
        } catch (error) {
          console.warn('[auth] stored token is no longer valid', error.message);
          writeStoredAuth(null);
          setAuth(null);
        }
      }
      setReady(true);
    };
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((payload) => {
    const next = { token: payload.token, user: payload.user, defaultPage: payload.defaultPage };
    writeStoredAuth(next);
    setAuth(next);
    console.log('[auth] logged in as', payload.user?.role);
    return next;
  }, []);

  const value = useMemo(
    () => ({
      token: auth?.token || null,
      user: auth?.user || null,
      role: auth?.user?.role || null,
      defaultPage: auth?.defaultPage || DEFAULT_PAGE_BY_ROLE[auth?.user?.role] || '/login',
      isAuthenticated: Boolean(auth?.token),
      ready,
      login,
      logout,
    }),
    [auth, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
