import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import AppErrorBoundary from './components/common/AppErrorBoundary.jsx';
import ErrorPage from './components/common/ErrorPage.jsx';
import { getHomePath } from './components/layout/navigation.js';

// Auth (eager - first thing visitors see)
import LoginPage from './pages/auth/LoginPage.jsx';
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import RequestRegistrationPage from './pages/auth/RequestRegistrationPage.jsx';

// Public QR scan page
import ScanQrPage from './pages/student/ScanQrPage.jsx';

// HOD pages (lazy)
const HodDashboardPage         = lazy(() => import('./pages/hod/HodDashboardPage.jsx'));
const AcademicManagementPage   = lazy(() => import('./pages/hod/AcademicManagementPage.jsx'));
const HodStudentsPage          = lazy(() => import('./pages/hod/StudentsPage.jsx'));
const HodFacultyPage           = lazy(() => import('./pages/hod/FacultyPage.jsx'));
const HodTutorsPage            = lazy(() => import('./pages/hod/TutorsPage.jsx'));
const PeriodsPage              = lazy(() => import('./pages/hod/PeriodsPage.jsx'));
const CheckRequestStatusPage  = lazy(() => import('./pages/auth/CheckRequestStatusPage.jsx'));
const PendingRegistrationsPage = lazy(() => import('./pages/hod/PendingRegistrationsPage.jsx'));
const HodReportsPage           = lazy(() => import('./pages/hod/HodReportsPage.jsx'));
const LeaveReviewPage          = lazy(() => import('./pages/shared/LeaveReviewPage.jsx'));
const AssignmentRequestsPage   = lazy(() => import('./pages/shared/AssignmentRequestsPage.jsx'));
const MessagesPage              = lazy(() => import('./pages/shared/MessagesPage.jsx'));

// Faculty pages (lazy)
const FacultyDashboardPage     = lazy(() => import('./pages/faculty/FacultyDashboardPage.jsx'));
const TakeAttendancePage       = lazy(() => import('./pages/faculty/TakeAttendancePage.jsx'));
const QrAttendancePage         = lazy(() => import('./pages/faculty/QrAttendancePage.jsx'));
const FacultySubjectsPage      = lazy(() => import('./pages/faculty/FacultySubjectsPage.jsx'));
const FacultyStudentsPage      = lazy(() => import('./pages/faculty/FacultyStudentsPage.jsx'));
const FacultyReportsPage       = lazy(() => import('./pages/faculty/FacultyReportsPage.jsx'));

// Student pages (lazy)
const StudentDashboardPage     = lazy(() => import('./pages/student/StudentDashboardPage.jsx'));
const StudentAttendancePage    = lazy(() => import('./pages/student/StudentAttendancePage.jsx'));
const StudentTimetablePage     = lazy(() => import('./pages/student/StudentTimetablePage.jsx'));
const StudentNotificationsPage = lazy(() => import('./pages/student/StudentNotificationsPage.jsx'));
const StudentLeaveRequestsPage = lazy(() => import('./pages/student/StudentLeaveRequestsPage.jsx'));

// Shared pages (lazy)
const ProfilePage              = lazy(() => import('./pages/shared/ProfilePage.jsx'));
const ChangePasswordPage       = lazy(() => import('./pages/shared/ChangePasswordPage.jsx'));

function LoadingScreen({ label = 'Loading' }) {
  return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5 text-ink">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-accent">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-6 w-6 rounded-full border-2 border-accent/30 border-t-accent"
            aria-hidden="true"
          />
        </div>
        <p className="mt-5 text-sm font-semibold text-ink">{label}</p>
          <p className="mt-1 text-xs text-slate">Preparing your workspace.</p>
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
      <ThemeProvider>
        <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '14px',
            background: 'var(--color-ink)',
            color: 'var(--color-cream)',
            fontSize: '13px',
            padding: '12px 16px',
            boxShadow: '0 8px 28px rgba(15,30,43,0.18)',
          },
          success: {
            iconTheme: { primary: 'var(--color-sage)', secondary: 'var(--color-cream)' },
          },
          error: {
            iconTheme: { primary: 'var(--color-clay)', secondary: 'var(--color-cream)' },
          },
        }}
      />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          {/* Public auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/request-registration?role=student" replace />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/request-registration" element={<RequestRegistrationPage />} />
          <Route path="/check-request-status" element={<CheckRequestStatusPage />} />
          <Route path="/scan-qr" element={<ScanQrPage />} />

          {/* HOD institution workspace */}
          <Route path="/hod" element={<ProtectedRoute allowedRoles={['super_admin']} basePath="/hod"><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<HodDashboardPage />} />
            <Route path="academics" element={<AcademicManagementPage />} />
            <Route path="students" element={<HodStudentsPage />} />
            <Route path="faculty" element={<HodFacultyPage />} />
            <Route path="tutors" element={<HodTutorsPage />} />
            <Route path="people" element={<Navigate to="/hod/students" replace />} />
            <Route path="periods" element={<PeriodsPage />} />
            <Route path="registrations" element={<PendingRegistrationsPage />} />
            <Route path="reports" element={<HodReportsPage />} />
            <Route path="notifications" element={<StudentNotificationsPage />} />
            <Route path="leave-requests" element={<LeaveReviewPage mode="hod" />} />
            <Route path="assignment-requests" element={<AssignmentRequestsPage mode="hod" />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Faculty */}
          <Route path="/faculty" element={<ProtectedRoute allowedRoles={['admin']} basePath="/faculty"><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<FacultyDashboardPage />} />
            <Route path="take-attendance" element={<TakeAttendancePage />} />
            <Route path="qr-attendance" element={<QrAttendancePage />} />
            <Route path="subjects" element={<FacultySubjectsPage />} />
            <Route path="students" element={<FacultyStudentsPage />} />
            <Route path="reports" element={<FacultyReportsPage />} />
            <Route path="notifications" element={<StudentNotificationsPage />} />
            <Route path="leave-requests" element={<LeaveReviewPage mode="faculty" />} />
            <Route path="assignment-requests" element={<AssignmentRequestsPage mode="faculty" />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Student */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['user']} basePath="/student"><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<StudentDashboardPage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="timetable" element={<StudentTimetablePage />} />
            <Route path="scan-qr" element={<ScanQrPage />} />
            <Route path="notifications" element={<StudentNotificationsPage />} />
            <Route path="leave-requests" element={<StudentLeaveRequestsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
          </Route>

          <Route path="*" element={<ErrorPage kind="not-found" title="Page not found" message="The page you requested does not exist or may have moved." />} />
        </Routes>
        </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
