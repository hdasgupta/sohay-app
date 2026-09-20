import { NavLink } from 'react-router-dom';
import './NavPanel.css';
import OrgLogo from '../OrgLogo/OrgLogo';

/**
 * Sliding navigation popup that sits on top of the main page. Toggled by the
 * three line button in the header and closed by the cross button.
 */
const NavPanel = ({ open, onClose, links = [] }) => (
  <>
    <div className={`nav-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden={!open} />
    <nav className={`nav-panel ${open ? 'open' : ''}`} aria-label="Primary navigation" aria-hidden={!open}>
      <div className="nav-head">
        <div className="nav-brand">
          <OrgLogo size={34} />
          <span>Menu</span>
        </div>
        <button type="button" className="nav-close" onClick={onClose} aria-label="Close navigation">
          ✕
        </button>
      </div>
      <ul className="nav-links">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-icon" aria-hidden="true">{link.icon}</span>
              <span className="nav-text">{link.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="nav-foot">West Bengal Forum for Mental Health</p>
    </nav>
  </>
);

export default NavPanel;
