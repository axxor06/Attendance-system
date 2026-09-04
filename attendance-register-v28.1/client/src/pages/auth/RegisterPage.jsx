import { Navigate } from 'react-router-dom';

/**
 * Compatibility route kept for old bookmarks. Public account creation is now
 * a registration request so HOD approval, class validation, photo upload, and
 * status tracking use one authoritative flow.
 */
export default function RegisterPage() {
  return <Navigate to="/request-registration?role=student" replace />;
}
