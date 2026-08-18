# Changelog

All notable changes to Attendance Register are documented here. This release preserves the existing MERN application, routes, models, dashboards, QR attendance, reports, notifications, and deployment topology while completing the v8 design and stability pass.

## [9.0.0] — 2026-08-18

### Interface and navigation

Introduced a restrained glassmorphism visual system with translucent panels, soft gradient canvas, controlled blur, professional navy/stone/brass/teal accents, glass loading skeletons, and consistent focus/reduced-motion behavior. The existing role-aware navigation and route structure remain intact.

### Role experience

Added real-workflow quick actions for HODs, faculty, and students, linking to people management, registrations, timetable, reports, attendance marking, QR sessions, attendance records, notifications, and student scanning without adding fake data.

### Profile and account controls

Added a protected self-profile update endpoint and profile editor. Students and faculty can edit email and phone; privileged HOD/admin accounts can also edit their own display name. HOD/admin People management now supports authorized account edits for name, email, phone, department/class, and administrator-only identity IDs, while preserving department scoping and protected roles.

### Password reset

Added a real two-step self-service reset flow: verify the reset OTP first, then enter and confirm a new password. OTPs remain rate-limited, hashed, and single-use at final reset. Administrator resets continue using secure email reset codes rather than exposing plaintext temporary passwords.

### Release cleanup

The release packaging uses a current `attendance-register-v9.0` root folder with no legacy `v6` path wrapper, dependencies, build output, real environment files, or logs.

## [8.2.1] — 2026-08-18

### Runtime bug fix

Fixed OTP generation by importing and calling Node’s explicit `node:crypto` `randomInt` API. User creation and administrator password reset no longer fail with `crypto.randomInt is not a function`. Added a regression test that generates a valid six-digit cryptographic OTP code.

### Setup and session troubleshooting

Clarified that server dependencies must be installed before running the seed script. Added troubleshooting guidance for stale rotated refresh cookies and old browser tabs; refresh-token rotation and reuse detection remain enabled.

### Verification

Backend syntax checks passed and the Node test suite passed with 17 tests. The existing client test and frontend verification suite remains unchanged from v8.2.

## [8.2.0] — 2026-08-18

### Navigation and visual system

Replaced the persistent desktop sidebar with a compact, role-aware top navigation strip that reuses the existing navigation source of truth and preserves all management, faculty, and student routes. Phones continue to use the existing accessible drawer navigation, while tablets and desktops use the top strip. Sidebar collapse state and controls were removed from the authenticated shell without weakening route protection or removing any feature.

### Professional theme

Updated the global visual tokens to a restrained navy, stone, brass, teal, and clay palette. Login, dashboard, form, chart, loading, toast, error, and metric surfaces now share the same color and typography system. Replaced the former Fraunces/Inter pairing with Manrope for display text and DM Sans for interface text, while retaining JetBrains Mono for codes and data labels. Existing spacing, responsive behavior, data contracts, animations, and backend functionality remain unchanged.

### Verification

Backend syntax checks passed and the Node test suite passed with 16 tests. Client tests passed with 3 tests. Frontend lint completed with 0 errors and 12 non-blocking legacy warnings. The Vite production build passed after confirming Tailwind utilities were compiled correctly. A local browser smoke test loaded the redesigned login page without application console errors.

## [8.1.0] — 2026-08-18

### Backend security and data integrity

Added a database-level unique index for semester numbers and duplicate-key handling for concurrent semester writes. Period-template replacement now uses a transaction when MongoDB supports transactions, falls back safely for standalone development databases, enforces one active template per day, and records audit entries for upsert and deactivation. Refresh and logout now use a cookie-origin guard in addition to the existing SameSite and CORS controls. The unauthenticated public class-options response is limited to `_id`, `name`, and `code`.

### Frontend runtime stability

Fixed confirmed missing `useCallback` imports in registration, faculty, student, HOD, timetable, reports, and subject pages. PendingRegistrationsPage now handles rejected loads and awaits review actions. Faculty reports, faculty subjects, student timetable, student notifications, QR attendance, and take-attendance flows now expose resilient loading, error, and retry states. PeoplePage now reports partial class/department option failures without falling back to a full-browser refresh.

### Authentication and copy cleanup

Added auth-epoch invalidation so logout cannot be followed by stale bootstrap or interceptor refresh work, while refresh-token rotation and reuse detection remain enabled. Removed the remaining generated marketing copy from authentication, HOD, faculty, and academic-management screens and replaced it with direct attendance terminology.

### Verification

Backend syntax checks passed; the Node test suite passed with 16 tests. Client tests passed with 3 tests. The frontend lint check completed with 0 errors and 12 non-blocking legacy warnings, and the Vite production build passed. Sensitive-pattern and stale-copy scans returned no matches in source.

## [8.0.0] — 2026-08-18

### UI/UX redesign

The application now uses one unified attendance-focused visual system inspired by the supplied reference’s visual language: warm off-white surfaces, compact dark navigation, generous whitespace, large rounded cards, quiet borders, restrained shadows, icon-led actions, clear typography hierarchy, and short transform/opacity transitions. The reference’s health/workout data was not copied; every displayed metric remains sourced from the existing attendance APIs.

The login/authentication experience, desktop sidebar, mobile drawer, top bar, shared cards, metric tiles, dashboard canvas, management dashboard, and student dashboard now share the same product language. Existing routes, API wrappers, real data, role shells, forms, tables, charts, QR workflows, reports, notifications, and profile flows remain in place.

### Permission-consistent UI

HOD Academic Management is now explicitly department-scoped in the interface. Global department and semester create/edit/delete controls are hidden for HOD because the backend intentionally reserves those institution-wide mutations for SUPER_ADMIN and ADMIN. HOD can continue using department-scoped subject and people operations. HOD timetable access is read-only, while timetable mutation controls remain available only to SUPER_ADMIN and ADMIN, matching the existing backend route gates.

### Stability and validation

Academic Management, timetable, reports, faculty dashboard, student dashboard, student attendance, registration, and public registration request flows now resolve loading states with visible success, empty, error, and retry paths where applicable. A global error boundary provides recovery actions instead of a blank white screen, and auth/root/lazy-route fallbacks show a branded loading state. Public class-loading failures are explicit and retryable.

Client password validation now mirrors the backend exactly: at least 12 characters, with uppercase, lowercase, number, and symbol. The shared policy helper is used by registration, request registration, reset password, and change password forms; backend validation remains authoritative.

## [7.0.0] — 2026-08-18

### Authentication refresh correctness

Replaced the boolean refresh lock and callback subscriber queue with a module-level single-flight promise coordinator. Auth bootstrap, interceptor retries, and any future `authApi.refresh()` callers now share one refresh promise while a rotated refresh token is in flight. React StrictMode effect replay therefore cannot issue a second refresh rotation during startup, and simultaneous 401 responses wait for the same new access token. Refresh rotation and server-side reuse detection remain unchanged.

Added deterministic client tests for concurrent callers, promise identity, rejection cleanup, and later retry. A browser smoke test against a temporary mock API observed exactly one bootstrap refresh and one refresh for a batch of concurrent 401s; the People page remained rendered throughout.

### API data delivery and PeoplePage

Authenticated API responses now use `Cache-Control: no-store, private` so Express does not emit empty 304 responses for rapidly changing protected JSON. PeoplePage now validates the response envelope, handles request failures with a retryable error state, tolerates partial class/department option failures, and renders stable loading/empty/error/table states instead of failing into a blank view.

### Coordinated UI redesign

Redesigned the login/auth shell, form inputs, buttons, desktop sidebar, top bar, and PeoplePage affordances as one restrained academic operations interface. Added icon-led form fields, password visibility control, stronger focus treatment, refined active navigation states, responsive table scrolling, accessible tabs/captions/alerts, and short transform/opacity transitions that respect reduced-motion settings.

## [6.0.0] — 2026-08-18

### Security and authorization

The role model now includes an explicit `ADMIN` role between `SUPER_ADMIN` and HOD. `SUPER_ADMIN` can manage ADMIN accounts; ADMIN can manage HOD, faculty, and student accounts; HOD can manage faculty and students only within the authenticated department. Self-target protections, protected SUPER_ADMIN handling, manageable-user checks, and session invalidation are centralized in the authorization utilities and user controller.

HOD reads and mutations now use backend department/class predicates across users, classes, subjects, attendance, dashboards, search, registration requests, departments, and reports. Subject, class, and student access assertions protect object-level paths against IDOR/BOLA attempts. Subject creation validates class, department, semester, faculty, and student relationships.

Administrator password resets use secure OTP delivery rather than temporary-password responses. OTP records support per-purpose expiry and bounded attempts, with stricter settings for privileged resets. Password changes, resets, deactivation, and sensitive account changes invalidate sessions through token-version and refresh-session revocation behavior.

### Registration privacy

Public registration status no longer supports email-only lookup. Submission returns a private `requestId` and one-time `statusToken`; only the token digest is stored. The client now displays the values once, provides copy actions, and includes a dedicated private status page. Approval and rejection remove sensitive pending fields.

### LAN and deployment configuration

Vite and the API bind to configurable hosts, defaulting to `0.0.0.0` for same-Wi-Fi development. The client API URL is environment-driven through `VITE_API_BASE_URL`. Development CORS can opt into localhost and RFC1918 HTTP origins through `ALLOW_LAN_ORIGINS=true`, while production continues to require exact HTTPS origins. Refresh-cookie SameSite values are validated, and insecure `SameSite=None` is downgraded to `lax`.

README documentation now covers private-network LAN setup, development cookie values, API/client host configuration, and Windows Firewall rules for TCP ports 5173 and 5000 without recommending firewall disablement.

### Frontend experience

ADMIN and SUPER_ADMIN users now share the existing management shell with correct root/login redirects, role-aware navigation, search destinations, profile links, role labels, and account-management tabs. The people page exposes only roles permitted by the current actor, supports horizontal scrolling on narrow screens, and adds tab, search, and table accessibility semantics. The profile page uses consistent role labels and restrained role styling. A dedicated status page and one-time credential display improve the public registration workflow.

### Documentation

Added or refreshed `SECURITY_AUDIT.md`, `ARCHITECTURE.md`, `PRODUCTION_CHECKLIST.md`, `CHANGELOG.md`, and the root `README.md` with the v6 role model, HOD isolation, private status flow, LAN setup, Windows Firewall instructions, production transition guidance, and release checks.

### Verification

Backend dependencies were installed with `npm ci --no-audit --no-fund`. Backend syntax checks passed and the Node test suite passed with 13 tests. Frontend dependencies were installed with the same locked workflow. The Vite production build passed. Frontend lint completed with zero errors and retained non-blocking legacy unused-import warnings in unrelated pages.

## [5.1.0] — 2026-08-14

The v5.1 follow-up introduced account-aware progressive login throttling, secure administrator reset OTPs, bounded collection pagination, synchronous report row caps, GitHub Actions verification, and the first production-readiness documentation set.

## [5.0.0]

The v5 baseline introduced hashed pending-registration credentials, access-token token-version invalidation, Redis-backed distributed rate limiting with memory fallback, refresh-session family tracking and reuse detection, atomic OTP and QR protections, SUPER_ADMIN route integration, shared navigation, portal-based accessible modals/popovers, and the first production-readiness documentation set.
