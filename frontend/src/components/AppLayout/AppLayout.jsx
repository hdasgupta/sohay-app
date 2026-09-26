import { useCallback, useState } from "react";
import Header from "../Header/Header.jsx";
import NavDrawer from "../NavDrawer/NavDrawer.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { notify } from "../../utils/eventBus.js";
import "./AppLayout.css";

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const onLogout = () => {
    logout("user clicked logout");
    notify.info("You have been logged out");
  };
  return (
    <div className="app-layout">
      <Header onMenuClick={() => setOpen(true)} onLogout={onLogout} />
      <NavDrawer open={open} onClose={close} role={user?.role} />
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        © {new Date().getFullYear()} West Bengal Forum for Mental Health · All
        times in IST (Asia/Kolkata)
      </footer>
    </div>
  );
}
