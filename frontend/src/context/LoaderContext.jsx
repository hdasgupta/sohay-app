import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Loader from '../components/Loader/Loader';
import { registerHttpHooks } from '../api/httpClient';
import { useMessage } from './MessageContext';

const LoaderContext = createContext(null);

/**
 * Counts the in-flight backend calls (through the axios interceptors) and shows
 * the hour glass loader while at least one call is pending.
 */
export const LoaderProvider = ({ children }) => {
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState('Talking to the server, please wait...');
  const messenger = useMessage();

  const start = useCallback((text) => {
    if (text) setMessage(text);
    setPending((current) => current + 1);
  }, []);

  const stop = useCallback(() => {
    setPending((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    registerHttpHooks({
      onRequestStart: () => setPending((current) => current + 1),
      onRequestEnd: () => setPending((current) => Math.max(0, current - 1)),
      onError: (text) => messenger.error(text),
    });
  }, [messenger]);

  const value = useMemo(() => ({ busy: pending > 0, start, stop, setMessage }), [pending, start, stop]);

  return (
    <LoaderContext.Provider value={value}>
      {children}
      {pending > 0 ? <Loader message={message} /> : null}
    </LoaderContext.Provider>
  );
};

export const useLoader = () => {
  const context = useContext(LoaderContext);
  if (!context) throw new Error('useLoader must be used inside LoaderProvider');
  return context;
};
