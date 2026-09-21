import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/common/LoginPage';
import RegisterPatientPage from './pages/common/RegisterPatientPage';
import ResetPasswordPage from './pages/common/ResetPasswordPage';
import NotFoundPage from './pages/common/NotFoundPage';
import ConsultationPage from './pages/common/ConsultationPage';
import AddDoctorPage from './pages/admin/AddDoctorPage';
import DoctorListPage from './pages/admin/DoctorListPage';
import RescheduleAppointmentPage from './pages/admin/RescheduleAppointmentPage';
import BookAppointmentPage from './pages/patient/BookAppointmentPage';
import ManageFamilyPage from './pages/patient/ManageFamilyPage';
import PatientAppointmentListPage from './pages/patient/PatientAppointmentListPage';
import GeneratePrescriptionPage from './pages/doctor/GeneratePrescriptionPage';
import DoctorAppointmentListPage from './pages/doctor/DoctorAppointmentListPage';
import { useAuth } from './context/AuthContext';

const HomeRedirect = () => {
  const { isAuthenticated, defaultPage, ready } = useAuth();
  if (!ready) return null;
  return <Navigate to={isAuthenticated ? defaultPage : '/login'} replace />;
};

const App = () => (
  <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPatientPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />

    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route
        path="/admin/add-doctor"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AddDoctorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/add-doctor/:doctorId"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AddDoctorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/doctor-list"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DoctorListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reschedule"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <RescheduleAppointmentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patient/book-appointment"
        element={
          <ProtectedRoute allowedRoles={['PATIENT']}>
            <BookAppointmentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/manage-family"
        element={
          <ProtectedRoute allowedRoles={['PATIENT']}>
            <ManageFamilyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/appointment-list"
        element={
          <ProtectedRoute allowedRoles={['PATIENT']}>
            <PatientAppointmentListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/generate-prescription"
        element={
          <ProtectedRoute allowedRoles={['DOCTOR']}>
            <GeneratePrescriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/appointment-list"
        element={
          <ProtectedRoute allowedRoles={['DOCTOR']}>
            <DoctorAppointmentListPage />
          </ProtectedRoute>
        }
      />

      <Route path="/consultation/:appointmentId" element={<ConsultationPage />} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default App;
