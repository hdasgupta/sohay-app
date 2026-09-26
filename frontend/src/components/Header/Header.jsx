import { useAuth } from "../../context/AuthContext.jsx";
import ThemeToggle from "../ThemeToggle/ThemeToggle.jsx";
import Logo from "../Logo/Logo.jsx";
import { initials } from "../../utils/validators.js";
import "./Header.css";

const ROLE_LABEL = {
  admin: "Administrator",
  doctor: "Doctor",
  patient: "Patient",
};

/** Top: user name, email, theme, logout. Below: hamburger + organisation logo and name. */
export default function Header({ onMenuClick, onLogout }) {
  const { user } = useAuth();
  return (
    <header className="app-header">
      <div className="hdr-user-bar">
        <div className="hdr-user">
          <span className="hdr-avatar" aria-hidden="true">
            {initials(user?.name || "?")}
          </span>
          <div className="hdr-user-text">
            <span className="hdr-name" data-testid="header-name">
              {user?.name}
            </span>
            <span className="hdr-email" data-testid="header-email">
              {user?.email}
            </span>
          </div>
          <span className={`hdr-role hdr-role-${user?.role}`}>
            {ROLE_LABEL[user?.role] || user?.role}
          </span>
        </div>
        <div className="hdr-actions">
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-ghost btn-sm hdr-logout"
            onClick={onLogout}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </div>
      <div className="hdr-brand-bar">
        <button
          type="button"
          className="icon-btn hdr-burger"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <Logo size={46} subtitle="Sohay online application" />
      </div>
    </header>
  );
}
