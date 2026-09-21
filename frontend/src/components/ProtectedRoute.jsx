import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader/Loader';

/** Guards the role specific areas and redirects to the correct default page. */
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, role, ready, defaultPage } = useAuth();
  const location = useLocation();

  if (!ready) return <Loader message="Restoring your session..." />;

  if (!isAuthenticated) {
    console.warn('[route] blocked, user is not logged in:', location.pathname);
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    console.warn(`[route] role ${role} cannot open ${location.pathname}`);
    return <Navigate to={defaultPage} replace />;
  }

  return children;
};

export default ProtectedRoute;
