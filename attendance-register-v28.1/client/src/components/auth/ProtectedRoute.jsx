import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ErrorPage from '../common/ErrorPage.jsx';
import { canonicalRole, getHomePath } from '../layout/navigation.js';

export default function ProtectedRoute({ children, allowedRoles, basePath }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.requiresPasswordChange && !location.pathname.endsWith('/change-password')) {
    const passwordPath = basePath || getHomePath(canonicalRole(user.role));
    return <Navigate to={`${passwordPath}/change-password`} replace state={{ firstLogin: true }} />;
  }

  const normalizedUserRole = canonicalRole(user.role);
  const normalizedAllowedRoles = allowedRoles?.map(canonicalRole);
  if (normalizedAllowedRoles && !normalizedAllowedRoles.includes(normalizedUserRole)) {
    return <ErrorPage kind="forbidden" title="Access restricted" message="Your account does not have permission to open this workspace." />;
  }

  return children;
}
