import { useEffect } from 'react';
import { Route, useLocation } from 'react-router';
import AnimatedRoutes, { Redirect, useRouteLayerPhase } from './components/AnimatedRoutes/AnimatedRoutes.jsx';
import AppLayout from './components/AppLayout/AppLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { defaultPathFor } from './routes/navConfig.js';
import { rememberRedirect } from './utils/authStorage.js';
import logger from './utils/logger.js';

import LoginPage from './views/auth/LoginPage.jsx';
import RegisterPage from './views/auth/RegisterPage.jsx';
import ResetPasswordPage from './views/auth/ResetPasswordPage.jsx';
import AddEditDoctorPage from './views/admin/AddEditDoctorPage.jsx';
import DoctorListPage from './views/admin/DoctorListPage.jsx';
import ReschedulePage from './views/admin/ReschedulePage.jsx';
import BookAppointmentPage from './views/patient/BookAppointmentPage.jsx';
import AppointmentListPage from './views/patient/AppointmentListPage.jsx';
import FamilyPage from './views/patient/FamilyPage.jsx';
import GeneratePrescriptionPage from './views/doctor/GeneratePrescriptionPage.jsx';
import DoctorAppointmentsPage from './views/doctor/DoctorAppointmentsPage.jsx';
import MeetingPage from './views/meeting/MeetingPage.jsx';
import NotFoundPage from './views/common/NotFoundPage.jsx';

/** Any unknown path while logged out -> login, remembering the deep link */
function LoginRedirect() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;
  const isRoot = location.pathname === '/';
  const exiting = useRouteLayerPhase() === 'exit';
  useEffect(() => { if (!isRoot && !exiting) { rememberRedirect(path); logger.info(`Deep link ${path} stored until login`); } }, [path, isRoot, exiting]);
  return <Redirect to="/login" replace state={isRoot ? undefined : { from: { pathname: location.pathname, search: location.search } }} />;
}

function roleRoutes(role) {
  switch (role) {
    case 'admin':
      return [
        <Route key="a1" path="/admin/add-doctor" element={<AddEditDoctorPage />} />,
        <Route key="a2" path="/admin/doctors/:id/edit" element={<AddEditDoctorPage />} />,
        <Route key="a3" path="/admin/doctors" element={<DoctorListPage />} />,
        <Route key="a4" path="/admin/reschedule" element={<ReschedulePage />} />,
      ];
    case 'patient':
      return [
        <Route key="p1" path="/patient/book" element={<BookAppointmentPage />} />,
        <Route key="p2" path="/patient/appointments" element={<AppointmentListPage />} />,
        <Route key="p3" path="/patient/family" element={<FamilyPage />} />,
        <Route key="p4" path="/meeting/:appointmentId" element={<MeetingPage />} />,
      ];
    case 'doctor':
      return [
        <Route key="d1" path="/doctor/prescription" element={<GeneratePrescriptionPage />} />,
        <Route key="d2" path="/doctor/appointments" element={<DoctorAppointmentsPage />} />,
        <Route key="d3" path="/meeting/:appointmentId" element={<MeetingPage />} />,
      ];
    default:
      return [];
  }
}

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <AnimatedRoutes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<LoginRedirect />} />
      </AnimatedRoutes>
    );
  }

  const home = defaultPathFor(user.role);
  return (
    <AppLayout>
      <AnimatedRoutes>
        {roleRoutes(user.role)}
        <Route path="/" element={<Redirect to={home} replace />} />
        <Route path="/login" element={<Redirect to={home} replace />} />
        <Route path="/register" element={<Redirect to={home} replace />} />
        <Route path="/reset-password" element={<Redirect to={home} replace />} />
        <Route path="*" element={<NotFoundPage home={home} />} />
      </AnimatedRoutes>
    </AppLayout>
  );
}
