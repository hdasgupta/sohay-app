import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './Header.css';
import OrgLogo from '../OrgLogo/OrgLogo';

const ORG_NAME = import.meta.env.VITE_ORG_NAME || 'West Bengal Forum for Mental Health';

const Header = ({ onToggleNav }) => {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-top">
        <button type="button" className="hamburger" onClick={onToggleNav} aria-label="Show navigation links">
          <span />
          <span />
          <span />
        </button>
        <div className="user-block">
          <span className="user-name">{user?.name}</span>
          <span className="user-email">{user?.email}</span>
        </div>
        <div className="header-top-right">
          <span className="chip info role-chip">{user?.role}</span>
          <ThemeToggle />
          <button type="button" className="btn btn-danger btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
      <div className="header-brand">
        <OrgLogo size={40} />
        <h1 className="brand-name">{ORG_NAME}</h1>
      </div>
    </header>
  );
};

export default Header;
