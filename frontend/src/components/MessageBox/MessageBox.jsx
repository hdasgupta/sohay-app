import { useEffect, useMemo, useState } from 'react';
import './MessageBox.css';

const ICONS = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '✕',
};

const TITLES = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

/**
 * Single toast. Vanishes after `duration` seconds (default 10) and shows a
 * shrinking progress line until then.
 */
const MessageBox = ({ id, type = 'info', text, title, duration = 10, onClose }) => {
  const [leaving, setLeaving] = useState(false);
  const safeType = useMemo(() => (ICONS[type] ? type : 'info'), [type]);

  useEffect(() => {
    const hideTimer = setTimeout(() => setLeaving(true), duration * 1000);
    const removeTimer = setTimeout(() => onClose?.(id), duration * 1000 + 320);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, id, onClose]);

  return (
    <div className={`msg msg-${safeType} ${leaving ? 'leaving' : ''}`} role="alert">
      <span className="msg-icon" aria-hidden="true">
        {ICONS[safeType]}
      </span>
      <div className="msg-body">
        <strong className="msg-title">{title || TITLES[safeType]}</strong>
        <div className="msg-text">{text}</div>
      </div>
      <button type="button" className="msg-close" aria-label="Close message" onClick={() => onClose?.(id)}>
        ×
      </button>
      <span className="msg-progress" style={{ animationDuration: `${duration}s` }} />
    </div>
  );
};

export default MessageBox;
