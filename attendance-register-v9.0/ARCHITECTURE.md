# Architecture — Attendance Register v6

Attendance Register v8 is a deliberately small modular monolith. The hardening pass preserves the existing MERN boundaries rather than introducing microservices, GraphQL, Kubernetes, or a second authorization system. The browser renders role-aware pages and calls the REST API; the API remains the only security authority.

## System boundary

| Layer | Responsibility | Key location |
|---|---|---|
| React/Vite client | Role-aware routes, responsive dashboard shell, forms, charts, loading/empty/error states | `client/src` |
| Express API | Authentication, authorization, validation, business rules, report generation, security middleware | `server/src` |
| MongoDB/Mongoose | Users, departments, classes, subjects, attendance, QR sessions, refresh sessions, OTPs, notifications, audit records | `server/src/models` |
| Redis, optional but required for multi-instance limits | Shared rate-limit state | `server/src/services/redisService.js` |
| SMTP | OTP, reset, approval, and notification email delivery | `server/src/utils/email.js` |
| Nginx/Docker Compose | Production edge termination and service composition | `deploy` |

The API is configured under `/api`. Development uses Vite on port 5173 and Express on port 5000. Production should terminate HTTPS at a trusted reverse proxy and pass only the configured proxy hop count through `TRUST_PROXY_HOPS`.

## Frontend route architecture

The client uses React Router with a shared `DashboardLayout`. Management roles use the `/hod` route shell so the existing HOD pages can serve HOD, ADMIN, and SUPER_ADMIN users while backend predicates determine the data they can actually see or change. Faculty and student roles retain their existing shells and route namespaces.

| Role | Shell | Main experience |
|---|---|---|
| `super_admin` | `/hod` | Institution-wide management, role administration, academics, registrations, reports |
| `admin` | `/hod` | Institution-wide operations excluding ADMIN/SUPER_ADMIN account management |
| `hod` | `/hod` | Department-scoped people, academics, registrations, reports, and dashboard |
| `faculty` | `/faculty` | Assigned subjects, attendance, QR, and faculty reports |
| `student` | `/student` | Own attendance, timetable, notifications, and QR scan |

The sidebar and mobile navigation consume one role-aware navigation configuration. The top bar supports ADMIN search access, management-shell profile paths, portal popovers, notification counts, and keyboard focus with Ctrl/Cmd+K. The v8 shell uses a warm ivory canvas, dark ink navigation rail, rounded premium surfaces, restrained accents, and short route/card transitions. Shared Card, StatCard, Button, Input, loading, empty, and error primitives keep the visual language consistent across roles. Modal dialogs render through `document.body`, trap focus, restore focus, prevent background scrolling, and follow the documented navigation/popover/modal/toast stacking hierarchy.

The public registration workflow has two pages. `RequestRegistrationPage` submits a request and displays the returned `requestId` and one-time status token without storing credentials in browser persistence. `CheckRequestStatusPage` requires both private values and displays a generic no-match response when the capability is invalid.

## Backend module boundaries

Routes define coarse authentication and role gates. Controllers coordinate validated input, object-level authorization, database operations, activity logs, and response shapes. Models define persistence and indexes. Services contain cross-controller operations such as attendance aggregation, reports, notifications, and Redis connectivity. Utilities centralize authorization, JWT claims, OTP verification, pagination, refresh-session hashing, and password policy.

The principal authorization module is [`server/src/utils/authorization.js`](./server/src/utils/authorization.js). It contains role predicates, creation-role hierarchy, HOD department/class scope helpers, manageable-user checks, and `assertStudentAccess`, `assertSubjectAccess`, and `assertClassAccess`. Controllers call these helpers before returning or mutating records.

## Role and HOD scope model

`req.user.department` is the server-side scope anchor for HODs. It is never replaced by a department value supplied by the browser. A HOD list query receives a department predicate, and a HOD student query can include users whose `class` belongs to the scoped department because student records may be related through class rather than a denormalized department field.

`SUPER_ADMIN` has full administrative scope. `ADMIN` has institution-wide operational scope but cannot manage ADMIN or SUPER_ADMIN accounts. HODs can create faculty and student accounts only inside their department and cannot create departments, semesters, or global period-template settings. The frontend therefore hides global department/semester mutation controls for HOD and presents period templates as read-only; the backend remains the independent enforcement boundary. Faculty and students remain constrained by assignment, enrollment, class, and self-access rules.

## Stability and failure recovery

Auth bootstrap and root redirect show branded loading UI instead of returning `null`. Lazy routes use the same visible loading surface. A global error boundary provides retry, dashboard, login, and start-page recovery actions without exposing stack traces. API-driven pages use predictable loading, populated/empty, error, and retry states; partial `Promise.allSettled` loading is used where a page can continue with some data.

## Authentication and session flow

The login flow resolves an email or register number, applies account-aware progressive failure protection, verifies the password, enforces active/email/reset-required state, and returns a short-lived access token plus an HTTP-only refresh cookie. Access tokens include `id`, `role`, and `tokenVersion`. Protected middleware reloads the user and rejects stale token versions.

Refresh tokens carry a `jti` and `tokenType=refresh`. MongoDB stores only a digest and records the session family. Refresh rotation atomically claims the current session. If a previously used token is presented or a concurrent rotation loses the claim, the family is revoked. Password changes, password resets, administrator resets, role/security changes, and deactivation revoke refresh sessions and increment the token version as appropriate.

Development cookies use `SameSite=Lax` and `Secure=false` for HTTP LAN access. Production forces `Secure=true` when `NODE_ENV=production`; production deployment must use HTTPS and exact origin allowlists.

## Academic and attendance data flow

Departments contain classes; classes reference semesters and may reference an active faculty class teacher; subjects reference one class, department, semester, faculty, and optional explicit students. Subject creation validates that department, semester, and class agree, and that faculty and explicit students belong to the appropriate scope.

Attendance is stored per student, subject, date, and period order. A compound uniqueness constraint prevents duplicate records for the same attendance coordinate. The attendance controller validates session context, faculty/HOD subject access, class membership, student status, and editable date/period rules before writes. Aggregation services accept class IDs for HOD dashboard and low-attendance scoping.

## QR attendance flow

Faculty/HOD QR generation validates the subject and active session context, deactivates older sessions for the same coordinate, and relies on a partial unique index for one active session per subject/class/date/period. Student scan requests validate token integrity, expiry, active session state, student activity, class membership, subject activity, enrollment, session consistency, and duplicate state. The attendance write and scan claim are protected by MongoDB atomic operations and the attendance uniqueness index.

## Registration and OTP flow

Public registration validates email, password, class, and optional identifiers, hashes the chosen password into a pending request, and returns a request ID plus a random status token. The database stores only a SHA-256 hash of that token. Status checks require both values and are rate-limited. Approval creates a verified student with the existing password hash, then removes the pending credential and status-token hash. Rejection removes the same sensitive fields.

OTP records store a bcrypt hash, purpose, expiry, attempt counter, and per-record maximum attempts. Verification uses an atomic bounded attempt update and atomic consumption. Privileged password resets use shorter expiry and fewer attempts than general verification.

## LAN and production topology

For LAN development, Vite and Express bind to `0.0.0.0`, the client uses `VITE_API_BASE_URL=http://<PC-LAN-IP>:5000/api`, and the API uses exact `ALLOWED_ORIGINS` plus the opt-in development private-origin check. Windows Firewall should allow only TCP 5173 and 5000 on the Private profile. LAN development must not be exposed directly to the public internet.

For production, place Nginx or a managed HTTPS proxy in front of stateless API instances. Use exact HTTPS client origins, Secure cookies, a shared Redis URL for rate limits, private TLS MongoDB, secret rotation, backups, monitoring, health/readiness checks, and central logs. The modular monolith can scale horizontally without moving authentication, QR, attendance, or academic state out of MongoDB.

## References

[1]: ./server/src/config/constants.js "Role and domain constants"
[2]: ./server/src/utils/authorization.js "Central authorization and HOD scope helpers"
[3]: ./server/src/controllers/authController.js "Authentication and refresh-session flow"
[4]: ./server/src/controllers/attendanceController.js "Attendance authorization and writes"
[5]: ./server/src/services/attendanceService.js "Attendance aggregation services"
[6]: ./server/src/controllers/registrationRequestController.js "Private registration status and approval flow"
[7]: ./server/src/app.js "Express middleware and CORS boundary"
[8]: ./README.md "Local, LAN, firewall, and production setup"
