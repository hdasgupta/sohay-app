import { useEffect, useState } from 'react';
import { loaderBus } from '../../utils/eventBus.js';
import './Loader.css';

/** Full screen hour-glass loader. Visible while at least one backend call is running. */
export function HourGlass({ size = 72 }) {
  return (
    <svg className="hourglass" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="hg-sand" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <g className="hg-body">
        <rect x="14" y="4" width="36" height="5" rx="2" className="hg-frame" />
        <rect x="14" y="55" width="36" height="5" rx="2" className="hg-frame" />
        <path d="M18 9h28c0 10-8 15-11 23 3 8 11 13 11 23H18c0-10 8-15 11-23-3-8-11-13-11-23z" className="hg-glass" />
        <path className="hg-top" d="M21 12h22c-1 6-6 10-11 17-5-7-10-11-11-17z" fill="url(#hg-sand)" />
        <path className="hg-bottom" d="M20 53h24c-1-7-6-11-12-15-6 4-11 8-12 15z" fill="url(#hg-sand)" />
        <line className="hg-stream" x1="32" y1="29" x2="32" y2="52" stroke="#fbbf24" strokeWidth="1.6" strokeDasharray="2 3" />
      </g>
    </svg>
  );
}

export default function Loader() {
  const [active, setActive] = useState(() => new Map());

  useEffect(() => loaderBus.subscribe((evt) => {
    setActive((prev) => {
      const next = new Map(prev);
      if (evt.type === 'start') next.set(evt.id, evt.message);
      else next.delete(evt.id);
      return next;
    });
  }), []);

  if (active.size === 0) return null;
  const message = [...active.values()].pop();
  return (
    <div className="loader-overlay" role="alertdialog" aria-busy="true" aria-live="assertive" aria-label="Loading">
      <div className="loader-box">
        <HourGlass />
        <p className="loader-message">{message}</p>
      </div>
    </div>
  );
}
