import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import AppErrorBoundary from './components/common/AppErrorBoundary.jsx';

// Auth (eager - first thing visitors see)
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import RequestRegistrationPage from './pages/auth/RequestRegistrationPage.jsx';

// Public QR scan page
import ScanQrPage from './pages/student/ScanQrPage.jsx';

// HOD pages (lazy)
const HodDashboardPage         = lazy(() => import('./pages/hod/HodDashboardPage.jsx'));
const AcademicManagementPage   = lazy(() => import('./pages/hod/AcademicManagementPage.jsx'));
const PeoplePage               = lazy(() => import('./pages/hod/PeoplePage.jsx'));
const PeriodsPage              = lazy(() => import('./pages/hod/PeriodsPage.jsx'));
const CheckRequestStatusPage  = lazy(() => import('./pages/auth/CheckRequestStatusPage.jsx'));
const PendingRegistrationsPage = lazy(() => import('./pages/hod/PendingRegistrationsPage.jsx'));
const HodReportsPage           = lazy(() => import('./pages/hod/HodReportsPage.jsx'));

// Faculty pages (lazy)
const FacultyDashboardPage     = lazy(() => import('./pages/faculty/FacultyDashboardPage.jsx'));
const TakeAttendancePage       = lazy(() => import('./pages/faculty/TakeAttendancePage.jsx'));
const QrAttendancePage         = lazy(() => import('./pages/faculty/QrAttendancePage.jsx'));
const FacultySubjectsPage      = lazy(() => import('./pages/faculty/FacultySubjectsPage.jsx'));
const FacultyReportsPage       = lazy(() => import('./pages/faculty/FacultyReportsPage.jsx'));

// Student pages (lazy)
const StudentDashboardPage     = lazy(() => import('./pages/student/StudentDashboardPage.jsx'));
const StudentAttendancePage    = lazy(() => import('./pages/student/StudentAttendancePage.jsx'));
const StudentTimetablePage     = lazy(() => import('./pages/student/StudentTimetablePage.jsx'));
const StudentNotificationsPage = lazy(() => import('./pages/student/StudentNotificationsPage.jsx'));

// Shared pages (lazy)
const ProfilePage              = lazy(() => import('./pages/shared/ProfilePage.jsx'));
const ChangePasswordPage       = lazy(() => import('./pages/shared/ChangePasswordPage.jsx'));

const MANAGEMENT_ROLES = ['super_admin', 'admin', 'hod'];

function getHomePath(role) {
  return MANAGEMENT_ROLES.includes(role) ? '/hod' : `/${role}`;
}

function LoadingScreen({ label = 'Loading' }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 text-ink">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-amber shadow-[0_12px_28px_rgba(22,43,73,0.15)]">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-6 w-6 rounded-full border-2 border-amber/30 border-t-amber"
            aria-hidden="true"
          />
        </div>
        <p className="mt-5 text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-xs text-slate">Please wait.</p>
      </div>
    </main>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen label="Loading" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getHomePath(user.role)} replace />;
}

function RouteFallback() {
  return <LoadingScreen label="Loading" />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '14px',
            background: '#162B49',
            color: '#F6F7F9',
            fontSize: '13px',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(22,43,73,0.25)',
          },
          success: {
            iconTheme: { primary: '#3F766D', secondary: '#F6F7F9' },
          },
          error: {
            iconTheme: { primary: '#B5564E', secondary: '#F6F7F9' },
          },
        }}
      />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          {/* Public auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/request-registration" element={<RequestRegistrationPage />} />
          <Route path="/check-request-status" element={<CheckRequestStatusPage />} />
          <Route path="/scan-qr" element={<ScanQrPage />} />

          {/* Shared management shell for HOD, ADMIN, and SUPER_ADMIN */}
          <Route path="/hod" element={<ProtectedRoute allowedRoles={MANAGEMENT_ROLES}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<HodDashboardPage />} />
            <Route path="academics" element={<AcademicManagementPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="periods" element={<PeriodsPage />} />
            <Route path="registrations" element={<PendingRegistrationsPage />} />
            <Route path="reports" element={<HodReportsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Faculty */}
          <Route path="/faculty" element={<ProtectedRoute allowedRoles={['faculty']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<FacultyDashboardPage />} />
            <Route path="take-attendance" element={<TakeAttendancePage />} />
            <Route path="qr-attendance" element={<QrAttendancePage />} />
            <Route path="subjects" element={<FacultySubjectsPage />} />
            <Route path="reports" element={<FacultyReportsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Student */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<StudentDashboardPage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="timetable" element={<StudentTimetablePage />} />
            <Route path="notifications" element={<StudentNotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
