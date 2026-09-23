import { useEffect } from 'react';
import { NavLink } from 'react-router';
import { NAV } from '../../routes/navConfig.js';
import Logo from '../Logo/Logo.jsx';
import './NavDrawer.css';

const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  pill: <><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" /><path d="m8.5 8.5 7 7" /></>,
};

/** Left drawer overlaying the page. Hamburger opens it, the cross / backdrop / a link closes it. */
export default function NavDrawer({ open, onClose, role }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`nd-backdrop ${open ? 'nd-show' : ''}`} onClick={onClose} aria-hidden="true" data-testid="nav-backdrop" />
      <aside className={`nav-drawer ${open ? 'nd-open' : ''}`} aria-hidden={!open} aria-label="Main navigation" inert={!open}>
        <div className="nd-head">
          <Logo size={36} showName={false} />
          <span className="nd-title">Menu</span>
          <button type="button" className="icon-btn nd-close" onClick={onClose} aria-label="Close navigation menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="nd-links">
          {(NAV[role] || []).map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onClose} className={({ isActive }) => `nd-link ${isActive ? 'nd-active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{ICONS[item.icon]}</svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <p className="nd-foot">All times are in Indian Standard Time (IST)</p>
      </aside>
    </>
  );
}
