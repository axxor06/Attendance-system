import { Navigate } from 'react-router-dom';

/**
 * Compatibility entry point for older bookmarks.
 * HOD account management is intentionally split into dedicated Students and
 * Faculty workspaces; this module must never recreate the old combined screen.
 */
export default function PeoplePage() {
  return <Navigate to="/hod/students" replace />;
}
