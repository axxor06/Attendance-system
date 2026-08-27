# Architecture — Attendance Register

Attendance Register is a deliberately small modular monolith. The hardening pass preserves the existing MERN boundaries rather than introducing microservices, GraphQL, Kubernetes, or a second authorization system. The browser renders role-aware pages and calls the REST API; the API remains the only security authority. The current architecture completes the canonical college role model, separates HOD Students and Faculty information architecture, adds a server-scoped Faculty assigned-student workspace, and retains the authentication, ImageKit, seed, pagination, and refresh-concurrency protections.

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

The client uses React Router with a shared `DashboardLayout` and three canonical route namespaces. `/hod` is the HOD institution command centre, `/faculty` is the teaching desk, and `/student` is the personal attendance workspace. Route namespaces are mapped from canonical stored roles and are independent of public wording; `/hod/people` remains only as a safe redirect to `/hod/students`. Backend predicates remain the security authority.

| Internal role | College shell | Route | Main experience |
|---|---|---|---|
| `super_admin` | HOD | `/hod` | Institution-wide management, academics, accounts, registrations, attendance, QR, reports |
| `admin` | Faculty | `/faculty` | Assigned subjects/classes, attendance, QR, scoped reports, assigned students |
| `user` | Student | `/student` | Own attendance, timetable, notifications, profile, and QR scan |

The sidebar and mobile navigation consume one canonical role-aware navigation configuration. HOD navigation exposes separate Students and Faculty directories, alongside academic and operational destinations. Faculty navigation exposes assigned students without HOD mutation actions. Student navigation exposes personal attendance, timetable, QR, and notifications. The top bar keeps profile controls and role-safe search. The shell uses deep blue-gray navigation, warm-neutral surfaces, a single accent, semantic status colors, and restrained transitions; light and dark themes use independent near-black/slate compositions. Shared primitives keep loading, empty, error, modal, focus, and stacking behavior consistent across roles.

The public registration workflow has two pages. `RequestRegistrationPage` submits a student or faculty request and displays a short random status reference such as `AR-7K4P-92XM`; only its hash is stored by the API and the reference is never placed in browser persistence. `CheckRequestStatusPage` accepts the short reference and preserves compatibility with older private links, displaying a generic no-match response when the capability is invalid. HOD Students and Faculty directory summaries use scoped server endpoints to return authorized attendance/device or teaching-assignment information without authentication secrets. Faculty assigned-student results are server-filtered from active subject assignments.

## Backend module boundaries

Routes define coarse authentication and role gates. Controllers coordinate validated input, object-level authorization, database operations, activity logs, and response shapes. Models define persistence and indexes. Services contain cross-controller operations such as attendance aggregation, reports, notifications, and Redis connectivity. Utilities centralize authorization, JWT claims, OTP verification, pagination, refresh-session hashing, and password policy.

The principal authorization module is [`server/src/utils/authorization.js`](./server/src/utils/authorization.js). It contains canonical role predicates, HOD-only institution mutation policy, Faculty assignment scope, manageable-user checks, and `assertStudentAccess`, `assertSubjectAccess`, and `assertClassAccess`. Controllers call these helpers before returning or mutating records.

## Role and scope model

The canonical model stores HOD as `super_admin`, Faculty as `admin`, and Student as `user`. HOD has institution-wide authorized scope, but every operation still validates inputs, object relationships, audit requirements, rate limits, and active-state rules. Faculty scope is derived from active subject assignments and class relationships, never from a client-provided department or class filter. Students are self-only and are bound to one opaque browser-device hash.

Legacy `hod`, `faculty`, and `student` rows are normalized through compatibility helpers during the guarded migration window. Legacy `admin` rows are ambiguous because that value has represented more than one administrative tier; the login and protect paths refuse such accounts until an explicit reviewed role migration marks them as canonical. The migration command is idempotent and requires an operator confirmation flag.

## Stability and failure recovery

Auth bootstrap and root redirect show branded loading UI instead of returning `null`. Lazy routes use the same visible loading surface. A global error boundary provides retry, dashboard, login, and start-page recovery actions without exposing stack traces. API-driven pages use predictable loading, populated/empty, error, and retry states; partial `Promise.allSettled` loading is used where a page can continue with some data.

## Authentication and session flow

The login flow resolves an email or register number, applies account-aware progressive failure protection, verifies the password, enforces active/email/reset-required state, and returns a short-lived access token plus an HTTP-only refresh cookie. Access tokens include `id`, `role`, and `tokenVersion`. The browser also creates a random opaque device identifier stored in site-local storage. It is sent as `X-Device-Id`; the server stores only a SHA-256 digest for students, binds on first successful login, and enforces the binding on refresh and every protected request. An authorized HOD reset clears a Student binding, increments `tokenVersion`, revokes refresh sessions, and records an audit event. Faculty and HOD accounts remain multi-device. Protected middleware reloads the user and rejects stale token versions or mismatched student device bindings.

Refresh tokens carry a `jti` and `tokenType=refresh`. MongoDB stores only a digest and records the session family. Refresh rotation atomically claims the current session. If a previously used token is presented or a concurrent rotation loses the claim, the family is revoked. Password changes, password resets, administrator resets, role/security changes, and deactivation revoke refresh sessions and increment the token version as appropriate.

Development cookies use `SameSite=Lax` and `Secure=false` for HTTP LAN access. Production forces `Secure=true` when `NODE_ENV=production`; production deployment must use HTTPS and exact origin allowlists.

## Academic and attendance data flow

Departments contain classes; classes reference semesters and may reference an active Faculty class tutor; subjects reference one class, department, semester, Faculty, and optional explicit Students. Subject creation validates that department, semester, and class agree, and that Faculty and explicit Students belong to the appropriate scope. Dependent client selectors narrow options to the active academic context, while the API validates every identifier and relationship again.

Attendance is stored per Student, subject, date, and period order. A compound uniqueness constraint prevents duplicate records for the same attendance coordinate. The attendance controller validates session context, faculty/HOD subject access, class membership, student status, and editable date/period rules before writes. Aggregation services accept class IDs for HOD dashboard and low-attendance scoping.

## Timetable, leave, and QR attendance flow

Each class owns a weekly timetable whose class periods carry their subject and Faculty assignment. HOD availability is scoped to active Faculty in the selected class department and is computed against all other overlapping active class assignments for the requested day, order, and time range. The response includes safe eligible/busy/available counts and compatibility Faculty arrays. The client sends optional subject context, models idle/loading/success/empty/error states, cancels stale requests, and fails closed when a check cannot be completed. The server rechecks class, subject, Faculty department, and overlap constraints authoritatively on save with an actionable occupied-Faculty response. Null-Faculty break/free slots never create conflicts. Faculty attendance and QR period selectors show only periods matching the selected subject, class, and ISO date. ISO date-only weekday resolution uses UTC on the server and calendar-date-safe parsing in the client so a deployment timezone cannot change the selected day.

Student leave requests are visible to the Student, current tutor, and HOD within their authorized scopes. All three role views organize requests into Pending, Approved, and Rejected sections and show the decision maker, decision date, and rejection reason when present. Decisions remain server-scoped and rejection reasons are mandatory.

Faculty/HOD QR generation validates the subject and active session context, deactivates older sessions for the same coordinate, and relies on a partial unique index for one active session per subject/class/date/period. Student scan requests validate token integrity, expiry, active session state, Student activity, class membership, subject activity, enrollment, session consistency, and duplicate state. The attendance write and scan claim are protected by MongoDB atomic operations and the attendance uniqueness index.

## Registration and OTP flow

Public registration validates email, password, and role-specific class/department identifiers, hashes the chosen password into a pending request, and returns a short random status reference. The database stores only a SHA-256 hash of that reference; a legacy private token hash remains supported for existing requests. Status checks are format-validated, rate-limited, expiry-enforced, and non-enumerating. Approval creates a verified account with the existing password hash, then removes the pending credential while retaining the status-reference hash until expiry. Rejection removes the pending credential under the same rules.

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
