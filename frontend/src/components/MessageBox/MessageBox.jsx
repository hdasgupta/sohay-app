import { useCallback, useEffect, useRef, useState } from "react";
import { messageBus } from "../../utils/eventBus.js";
import "./MessageBox.css";

export const DEFAULT_DURATION = 10000;
const TITLES = {
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

const ICONS = {
  info: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  ),
  success: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  error: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  ),
};

let counter = 0;

function Toast({ msg, onClose }) {
  const timer = useRef(null);
  useEffect(() => {
    timer.current = setTimeout(() => onClose(msg.id), msg.duration);
    return () => clearTimeout(timer.current);
  }, [msg, onClose]);
  return (
    <div
      className={`mb-toast mb-${msg.type}`}
      role={msg.type === "error" ? "alert" : "status"}
      data-type={msg.type}
    >
      <span className="mb-icon">{ICONS[msg.type]}</span>
      <div className="mb-body">
        <strong className="mb-title">{TITLES[msg.type]}</strong>
        <p className="mb-text">{msg.text}</p>
      </div>
      <button
        type="button"
        className="mb-close"
        onClick={() => onClose(msg.id)}
        aria-label="Close message"
      >
        ×
      </button>
      <span
        className="mb-progress"
        style={{ animationDuration: `${msg.duration}ms` }}
        data-testid="mb-progress"
      />
    </div>
  );
}

/** Stack of info / success / warning / error messages. Each vanishes after `duration` (default 10s). */
export default function MessageBox() {
  const [messages, setMessages] = useState([]);
  const close = useCallback(
    (id) => setMessages((list) => list.filter((m) => m.id !== id)),
    [],
  );

  useEffect(
    () =>
      messageBus.subscribe(({ type = "info", text, duration }) => {
        if (!text) return;
        counter += 1;
        const msg = {
          id: counter,
          type: TITLES[type] ? type : "info",
          text: String(text),
          duration: duration || DEFAULT_DURATION,
        };
        setMessages((list) => {
          if (list.some((m) => m.text === msg.text && m.type === msg.type))
            return list; // no duplicates
          return [...list.slice(-2), msg];
        });
      }),
    [],
  );

  return (
    <div className="mb-stack" aria-live="polite">
      {messages.map((m) => (
        <Toast key={m.id} msg={m} onClose={close} />
      ))}
    </div>
  );
}
