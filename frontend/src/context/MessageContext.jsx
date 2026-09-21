import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import MessageBox from '../components/MessageBox/MessageBox';
import '../components/MessageBox/MessageBox.css';

const MessageContext = createContext(null);
const DEFAULT_DURATION = 10;

export const MessageProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const counter = useRef(0);
  const lastMessage = useRef({ signature: '', at: 0 });

  const remove = useCallback((id) => {
    setMessages((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((type, text, duration = DEFAULT_DURATION, title) => {
    if (!text) return;
    // The same message can arrive twice in a row (double invoked effects in
    // development, retried calls). Identical back to back messages are merged.
    const signature = `${type}|${text}`;
    const now = Date.now();
    if (lastMessage.current.signature === signature && now - lastMessage.current.at < 1500) {
      console.log('[messagebox] duplicate message suppressed:', text);
      return;
    }
    lastMessage.current = { signature, at: now };
    counter.current += 1;
    const id = `msg-${counter.current}`;
    console.log(`[messagebox] ${type}: ${text}`);
    setMessages((current) => [...current, { id, type, text, duration, title }]);
  }, []);

  const value = useMemo(
    () => ({
      info: (text, duration, title) => push('info', text, duration, title),
      success: (text, duration, title) => push('success', text, duration, title),
      warning: (text, duration, title) => push('warning', text, duration, title),
      error: (text, duration, title) => push('error', text, duration, title),
    }),
    [push],
  );

  return (
    <MessageContext.Provider value={value}>
      {children}
      <div className="msg-stack" aria-live="polite">
        {messages.map((message) => (
          <MessageBox key={message.id} {...message} onClose={remove} />
        ))}
      </div>
    </MessageContext.Provider>
  );
};

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useMessage must be used inside MessageProvider');
  return context;
};
