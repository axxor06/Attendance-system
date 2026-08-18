# Attendance Register v6

Attendance Register is a MERN-based college attendance platform with purpose-built HOD, ADMIN, SUPER_ADMIN, faculty, and student experiences. Attendance is stored independently by student, subject, date, and period, so concurrent or adjacent classes do not overwrite one another. The v8 project preserves the existing REST API, MongoDB models, role dashboards, QR attendance, reports, notifications, and academic-management workflows while adding a reference-guided premium UI, visible recovery states, permission-consistent controls, and the earlier credential, session, authorization, concurrency, and deployment hardening.

> **Security boundary:** the React application controls presentation only. Every role check, resource relationship, attendance rule, report scope, and QR validation is enforced again by the Express API.

## Technology and structure

| Layer | Implementation |
|---|---|
| Backend | Node.js, Express, Mongoose, MongoDB, JWT, HTTP-only refresh cookies, bcryptjs, Nodemailer, PDFKit, ExcelJS |
| Security middleware | Helmet, explicit CORS allowlist, request IDs, Mongo sanitization, express-validator, endpoint-specific rate limits |
| Distributed state | MongoDB-backed refresh sessions and QR sessions; optional Redis-backed distributed rate limiting |
| Frontend | React 19, Vite, React Router, Axios, Tailwind CSS v4, Recharts, Lucide, Framer Motion |
| Tests | Node’s built-in test runner, backend syntax checks, frontend lint, Vite production build |

The backend code lives under `server/src`. Controllers keep the existing feature boundaries, models define the persistence contract, validators protect request inputs, and `server/src/utils/authorization.js` centralizes object-level checks. The client separates API services, role pages, dashboard shells, common controls, charts, and responsive navigation.

## Authentication and password handling

Access tokens are short-lived JWTs kept in frontend memory. They include the user ID, role, and a per-user `tokenVersion`. The protected-request middleware loads the current user, verifies active status, and rejects tokens whose version no longer matches the database. Password changes, password resets, administrator password resets, and account deactivation increment that version and revoke refresh sessions.

Refresh tokens are HTTP-only cookies. Each token has a unique `jti`, is stored server-side only as a SHA-256 digest, and belongs to a persistent refresh-session family. Rotation uses an atomic claim of the current session. Reusing a token, presenting a tampered token, or losing a concurrent rotation race revokes the family so a stolen descendant cannot continue refreshing.

Passwords require the shared strength policy at public registration, pending registration, password reset, password change, administrator creation, and administrator reset. User passwords are hashed by the Mongoose save hook. Pending registration requests are hashed with bcrypt before storage, and the approval path reuses the verified hash exactly once instead of hashing it twice. After approval or rejection, the registration request’s credential hash is removed. Administrator password resets and administrator-created accounts without an explicit password use a single-use email OTP; no undiscoverable temporary password is sent to the user. Such accounts remain blocked by `passwordResetRequired` until the reset completes.

Legacy v4 databases that contain `registrationrequests.password` require the guarded migration script before the new approval controller can consume them:

```bash
cd server
ALLOW_CREDENTIAL_MIGRATION=true NODE_ENV=staging npm run migrate:registration-passwords
```

Run this only during a controlled maintenance window against a backup-verified staging or production database. The migration refuses production unless `ALLOW_CREDENTIAL_MIGRATION=true` is explicitly set. Confirm the old `password` field is absent after verification, then unset the flag.

## Registration, OTP, and reset behavior

OTP codes use cryptographically secure randomness, bcrypt hashing, expiry, one-time consumption, and a maximum of five failed verification attempts. Privileged password-reset OTPs use a shorter expiry and a stricter attempt cap. Verification increments attempts atomically and consumes a matching code atomically, preventing simultaneous requests from using the same OTP successfully. Public registration status uses a request ID plus a high-entropy status token; it never supports email-only lookup. OTP values and status tokens are never logged.

Sensitive endpoints have separate configurable limits for login, refresh, OTP generation, OTP verification, forgot-password, reset-password, registration submission, registration-status checks, and general API traffic. When `REDIS_URL` is present, all instances use the shared Redis store. Without Redis, the application deliberately falls back to process-local memory limiting for development only.

Login protection is account-aware as well as IP-aware. After the configured failure threshold within `LOGIN_FAILURE_WINDOW_MS`, the account receives a temporary lock whose duration increases up to `LOGIN_LOCK_MAX_MS`; a successful login clears the failure state. Lockout responses are HTTP 429 and expose `Retry-After` to permitted browser clients. Configure `LOGIN_FAILURE_WINDOW_MS`, `LOGIN_FAILURE_THRESHOLD`, `LOGIN_LOCK_BASE_MS`, and `LOGIN_LOCK_MAX_MS` in the server environment.

## Bounded collections and report safety

Administrative class, subject, department, semester, registration-request, faculty-subject, user, and attendance-history collections accept validated `page` and `limit` parameters with server-side maximums. List responses retain their existing array fields and include a `pagination` object so existing clients remain compatible. Public class options are capped at 200 records. Synchronous PDF/Excel reports enforce `MAX_REPORT_ROWS` and return HTTP 413 when the requested export is too large; narrow the date range or export smaller periods rather than increasing the cap casually.

## Roles and authorization

| Role | Intended scope |
|---|---|
| `SUPER_ADMIN` | Full system administration, ADMIN/HOD management, global academic settings, broad reports, and security-sensitive operational access. |
| `admin` | Institution-wide operational administration, HOD/faculty/student management, academic management, registrations, reports, and search; cannot manage SUPER_ADMIN or ADMIN accounts. |
| `hod` | Department-scoped faculty/student management, classes, subjects, registrations, attendance administration, reports, and analytics; cannot manage global settings or other departments. |
| `faculty` | Assigned subjects/classes, attendance marking/editing, authorized QR sessions, scoped reports, and faculty dashboard data. |
| `student` | Own profile, own attendance, own timetable, own notifications, and QR scans authorized by class, subject, session, and enrollment. |

Faculty access is checked against actual subject and class relationships rather than role alone. Students cannot change an identifier to read another student’s attendance. HOD queries are scoped in backend database predicates using the authenticated department and its classes; frontend filtering is not a security boundary. HODs cannot create or manage `SUPER_ADMIN`, `ADMIN`, or other-department accounts. Only `SUPER_ADMIN` can manage `ADMIN` accounts; `ADMIN` can manage HOD, faculty, and student accounts.

## Attendance and QR integrity

Attendance has a compound unique index on `(student, subject, date, periodOrder)`. Bulk roster writes use indexed operations, and QR scans use an atomic `$addToSet` claim alongside the unique attendance index. QR scans validate active session state, expiry, active student status, class membership, subject activity, subject enrollment, session subject/class/period consistency, and duplicate state.

QR creation deactivates older sessions for the subject/date/period and has a MongoDB partial unique index for one active session per subject/class/date/period. The controller also converts duplicate-key races into a safe conflict response. If an existing deployment already contains duplicate active QR sessions, resolve those records before building the new unique index.

## Frontend product experience

The v8 dashboard shell uses a dark ink navigation rail, warm ivory workspace, restrained amber primary accent, sage positive status, and clay risk/error states. Its visual direction is inspired by the supplied rounded premium dashboard reference, but all content remains attendance-specific and comes from the existing APIs. HOD Academic Management hides institution-wide department and semester mutations, and HOD timetable access is visibly read-only because the backend reserves those writes for SUPER_ADMIN and ADMIN. Registration, reset, change-password, academic management, timetable, report filters, student attendance, and role dashboards expose recoverable loading/error/empty states where their data requests can fail. Desktop navigation is collapsible and mobile navigation uses the same shared role-aware route configuration. Topbar search supports debounced server search, actionable result navigation, and Ctrl/Cmd+K focus. Notifications and profile menus are body-level portal popovers that reposition within the viewport.

The reusable modal renders through `document.body`, traps keyboard focus, restores focus after close, prevents background scrolling, supports Escape/backdrop/X/Cancel dismissal, and uses a documented stacking hierarchy: base content, navigation, mobile drawer, popover, modal, then toast. The application root also includes a privacy-safe error boundary and branded auth/lazy-route loading screen so render or bootstrap failures do not become blank white pages. The global stylesheet keeps reduced-motion support, visible focus rings, a 320px minimum layout width, and horizontal overflow protection.

## Local development

Use Node.js 20 or newer, npm, MongoDB 7 or a compatible MongoDB deployment, and an SMTP provider for OTP and notification flows. Copy the environment examples and replace placeholders; never commit `.env` files.

```bash
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

The API runs on `http://localhost:5000`, the Vite client runs on `http://localhost:5173`, and the liveness/readiness endpoints are `/api/health` and `/api/ready`. The seed script requires explicit seed passwords of at least 12 characters and refuses to run when `NODE_ENV=production`. The server environment example documents lockout controls, `MAX_REPORT_ROWS`, development host binding, and private-network CORS; set production values deliberately and do not commit `.env` files.

## LAN/Wi-Fi development

To open the client from another device on the same private network, identify the development PC’s private IPv4 address, such as `192.168.1.28`. In `client/.env`, set `VITE_API_BASE_URL=http://192.168.1.28:5000/api`. In `server/.env`, replace `YOUR_PC_LAN_IP` in `ALLOWED_ORIGINS` with the same address and keep `NODE_ENV=development`, `ALLOW_LAN_ORIGINS=true`, `REFRESH_COOKIE_SECURE=false`, and `REFRESH_COOKIE_SAMESITE=lax`. The Vite server and API bind to `0.0.0.0` by default for development, but production must use HTTPS, exact origins, and Secure cookies.

Start both processes on the PC, then visit `http://192.168.1.28:5173` from the phone, tablet, or other computer. Do not use `localhost` in the client API URL on the second device because it refers to that device itself. Keep the network private and do not expose the development server directly to the public internet.

### Windows Firewall

Do not disable Windows Firewall. Instead, allow only the two development ports on the active private network profile. Open **Windows Defender Firewall with Advanced Security**, choose **Inbound Rules**, select **New Rule**, choose **Port**, select **TCP**, enter `5173`, choose **Allow the connection**, apply it only to **Private**, and give it a name such as `Attendance Vite LAN Development`. Repeat the same steps for TCP port `5000` with a name such as `Attendance API LAN Development`.

Alternatively, run PowerShell as Administrator and create scoped rules:

```powershell
New-NetFirewallRule -DisplayName "Attendance Vite LAN Development" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "Attendance API LAN Development" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow -Profile Private
```

Remove the rules when LAN development is finished, or restrict their `-RemoteAddress` to the local subnet if the environment requires tighter control. Confirm that the PC and test device are connected to the same private Wi-Fi network and that the network is not configured as Public.

## Production deployment

Terminate HTTPS at a managed load balancer or reverse proxy, set exact HTTPS values in `CLIENT_URL` and `ALLOWED_ORIGINS`, set `REFRESH_COOKIE_SECURE=true`, and configure `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops. Run multiple stateless API instances behind the proxy. MongoDB must remain private, authenticated, TLS-protected, backed up, and monitored; the demonstration Compose MongoDB service is not an internet-facing production database.

For multiple backend instances, configure one shared Redis URL. The example deployment files include `deploy/docker-compose.production.yml`, `deploy/Dockerfile.edge`, and `deploy/nginx.conf`. Redis is used for shared rate-limit state; critical authentication, QR, attendance, and academic state remains in MongoDB.

## Verification

The backend test command is:

```bash
cd server
npm test
```

The test suite covers token-version claims, refresh-token claims, registration credential schema exposure, Redis fallback mode, liveness/readiness, CORS allowlisting, malformed identifiers, production seed refusal, progressive lockout calculations, password-reset-required behavior, and secure administrator reset wiring. The client test command covers the single-flight refresh coordinator, and the v8 client lint/build pass validates the redesigned route tree and shared UI system. The release checklist also calls for database-backed tests covering refresh rotation/reuse, password changes, account deactivation, BOLA/RBAC boundaries, QR expiry/wrong-class/duplicate/concurrent scans, registration approval, and report authorization. Those tests require a disposable MongoDB instance and are not simulated by the sandbox-only suite. GitHub Actions runs backend syntax/tests plus frontend lint/build on pushes and pull requests.

The project does not include a file-upload route. If uploads are added later, use explicit file-size, detected MIME, extension, safe filename, path-traversal, and executable-content controls rather than relying on the client-provided MIME type.

## Supporting documentation

| Document | Purpose |
|---|---|
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | Verified findings, remediation status, migration notes, and remaining limitations. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Frontend, backend, authentication, QR, database, Redis, and deployment architecture. |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Release, secrets, observability, backup, and verification checklist. |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Local, reverse-proxy, multi-instance, Redis, MongoDB, and rollout guidance. |
| [API.md](./API.md) | REST endpoint and role-scope reference. |
| [docs/openapi.yaml](./docs/openapi.yaml) | OpenAPI 3.1 contract for the implemented API, including auth, pagination, QR, reports, and error responses. |
| [CHANGELOG.md](./CHANGELOG.md) | Release history for the v6 hardening, v7 auth fix, and v8 UI/stability redesign. |

## References

[1]: ./server/src/controllers/registrationRequestController.js "Registration request credential flow"
[2]: ./server/src/controllers/authController.js "Authentication and refresh-session flow"
[3]: ./server/src/middleware/rateLimiters.js "Endpoint-specific and Redis-backed rate limits"
[4]: ./client/src/components/common/Modal.jsx "Portal modal and focus behavior"
