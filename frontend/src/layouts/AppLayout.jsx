import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header/Header';
import NavPanel from '../components/NavPanel/NavPanel';
import PageTransition from '../components/PageTransition/PageTransition';
import { useAuth } from '../context/AuthContext';
import './AppLayout.css';

const LINKS_BY_ROLE = {
  ADMIN: [
    { to: '/admin/add-doctor', label: 'Add Doctor', icon: '➕' },
    { to: '/admin/doctor-list', label: 'Doctor List', icon: '🩺' },
    { to: '/admin/reschedule', label: 'Reschedule Appointment', icon: '🔁' },
  ],
  PATIENT: [
    { to: '/patient/book-appointment', label: 'Book Appointment', icon: '📅' },
    { to: '/patient/manage-family', label: 'Manage Family', icon: '👪' },
    { to: '/patient/appointment-list', label: 'Appointment List', icon: '📋' },
  ],
  DOCTOR: [
    { to: '/doctor/generate-prescription', label: 'Generate Prescription', icon: '📝' },
    { to: '/doctor/appointment-list', label: 'Appointment List', icon: '📋' },
  ],
};

const AppLayout = () => {
  const { role } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const links = LINKS_BY_ROLE[role] || [];

  return (
    <div className="app-shell">
      <Header onToggleNav={() => setNavOpen((open) => !open)} />
      <NavPanel open={navOpen} onClose={() => setNavOpen(false)} links={links} />
      <main className="app-main">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <footer className="app-footer">
        © {new Date().getFullYear()} West Bengal Forum for Mental Health · Appointment portal
      </footer>
    </div>
  );
};

export default AppLayout;
