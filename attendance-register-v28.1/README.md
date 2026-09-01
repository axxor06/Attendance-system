# Attendance Register

Attendance Register is a MERN-based college attendance platform with purpose-built HOD, Faculty, and Student workspaces. Attendance is stored independently by student, subject, date, and period, so concurrent or adjacent classes do not overwrite one another. The platform keeps the existing REST API, MongoDB models, QR attendance, reports, notifications, academic workflows, refresh-concurrency protections, one-device Student binding, ImageKit validation, deterministic seed generation, and resilient notification delivery while extending the canonical role model and information architecture. It includes class-specific department → semester → class timetables, availability-checked Faculty assignment, one-class tutor authority, Faculty inability requests, and Student leave review. It also restores Tailwind v4 utility generation, bounds dashboard charts and scroll shells at narrow widths, and preserves the StrictMode-safe single-flight refresh path. HOD is stored as `super_admin`, Faculty as `admin`, and Student as `user`; the interface uses college terminology only. HOD now has separate Students and Faculty management destinations, Faculty has a server-scoped assigned-students workspace, and each role has its own route namespace and dashboard priorities. The shared Messages workspace provides secure one-to-one conversations, relationship-derived recipients, bounded MongoDB text storage, unread/read state, notifications, and Telegram-style role sections. HOD sees All, Students, Faculty, and Tutors; Faculty and Students see All, Students, Faculty, Tutors, and HOD. Existing direct threads are the only items shown in the inbox. An Add chat action opens recipient search on demand; results are filtered by server-side relationships, and selecting a result—not searching—creates or opens a conversation. Faculty recipients are limited to students they teach, tutors, HODs, and other Faculty. Student recipients are limited to classmates in the same class, the HOD, Faculty teaching them, and their Tutor; students from other departments or semesters are excluded. Student HOD and Tutor recipients remain deterministic and relationship-scoped. Chat profiles show only relationship-authorized academic details, with expanded safe profile information for HOD viewing. Enter sends a message, Shift+Enter inserts a line break, and sent messages use double checks that turn blue after the recipient reads them.

> **Security boundary:** the React application controls presentation only. Every role check, resource relationship, attendance rule, report scope, and QR validation is enforced again by the Express API.

The v28.1 release preserves the v28 visual refresh and adds a restrained operational polish pass. It uses a navy, sage, warm-accent, and paper palette across authenticated and public surfaces. Shared buttons, cards, modals, navigation, global search, directory search, attendance filters, and Add chat search now use consistent icon alignment, spacing, focus states, shadows, contrast, and responsive touch targets. The refresh keeps motion brief and respects reduced-motion preferences rather than adding decorative animation.

## Technology and structure

| Layer | Implementation |
|---|---|
| Backend | Node.js, Express, Mongoose, MongoDB, JWT, HTTP-only refresh cookies, bcryptjs, Nodemailer, PDFKit, ExcelJS |
| Security middleware | Helmet, explicit CORS allowlist, cookie Origin/Fetch Metadata guards, request IDs, Mongo sanitization, strict body contracts, express-validator, endpoint-specific rate limits, bounded HTTP lifecycle settings, metadata-only structured logs, and response compression |
| Distributed state | MongoDB-backed refresh sessions and QR sessions; optional Redis-backed distributed rate limiting |
| Frontend | React 19, Vite, React Router, Axios, Tailwind CSS v4, Recharts, Lucide, Framer Motion |
| Tests | Node’s built-in test runner, backend syntax checks, frontend lint, Vite production build |

The backend code lives under `server/src`. Controllers keep the existing feature boundaries, models define the persistence contract, validators protect request inputs, and `server/src/utils/authorization.js` centralizes object-level checks. The client separates API services, role pages, dashboard shells, common controls, charts, and responsive navigation.

## Authentication and password handling

Access tokens are short-lived JWTs kept in frontend memory. They include the user ID, role, and a per-user `tokenVersion`. The protected-request middleware loads the current user, verifies active status, rejects tokens whose version no longer matches the database, and enforces the student’s one-device binding using an opaque `X-Device-Id` header. Password changes, password resets, administrator password resets, and account deactivation increment that version and revoke refresh sessions.

Refresh tokens are HTTP-only cookies. Each token has a unique `jti`, is stored server-side only as a SHA-256 digest, and belongs to a persistent refresh-session family. Access and refresh JWTs are explicitly pinned to HS256, and cookie-authenticated refresh/logout requests require an allowed browser origin or trusted non-browser request metadata. Rotation uses an atomic claim of the current session. A short `REFRESH_ROTATION_GRACE_MS` window allows a recent same-token multi-tab race to obtain an active descendant without revoking the family; a stale, tampered, mismatched, expired, or reused token outside that bounded window still revokes the family so a stolen descendant cannot continue refreshing. A page reload or frontend development-server restart can therefore keep a user signed in: the browser sends the still-valid HTTP-only refresh cookie, the StrictMode-safe bootstrap performs one single-flight rotation, and a new short-lived access token is placed only in memory. This is intentional session continuity, not access-token persistence. Explicit logout clears the cookie and revokes the current refresh session; password changes, administrator resets, and deactivation invalidate all user sessions through token-version and refresh-session revocation.

Passwords require the shared strength policy at public registration, pending registration, password reset, password change, administrator creation, and administrator reset. User passwords are hashed by the Mongoose save hook. Pending registration requests are hashed with bcrypt before storage, and the approval path reuses the verified hash exactly once instead of hashing it twice. After approval or rejection, the registration request’s credential hash is removed. HOD-managed password resets generate a cryptographically random permanent password in the protected response to the authorized operator. It is hashed by the User save hook, never logged or persisted in plaintext, clears `passwordResetRequired`, invalidates existing sessions, and is shown exactly once. Students may voluntarily change their password later; an HOD reset does not force a first-login password change. Administrator-created accounts without an explicit password use a single-use email setup-code flow; no undiscoverable temporary password is created or sent to the user. HOD-created managed accounts with an explicit strong initial password can sign in once, receive a non-sensitive `requiresPasswordChange` signal, and are routed to Change Password before normal workspace access. Accounts created without an explicit password are created without a password, receive a secure email setup code, and are rolled back if delivery fails.

Legacy databases that contain `registrationrequests.password` require the guarded migration script before the new approval controller can consume them:

```bash
cd server
ALLOW_CREDENTIAL_MIGRATION=true NODE_ENV=staging npm run migrate:registration-passwords
```

Run this only during a controlled maintenance window against a backup-verified staging or production database. The migration refuses production unless `ALLOW_CREDENTIAL_MIGRATION=true` is explicitly set. Confirm the old `password` field is absent after verification, then unset the flag.

## Canonical role migration

The only accepted internal role values in a clean database are `super_admin` (HOD), `admin` (Faculty), and `user` (Student). Public registration continues to ask for `student` or `faculty`; the approval controller maps those labels to canonical storage values. Existing `hod`, `faculty`, and `student` records are recognized during the controlled migration window and can be mapped safely. Legacy `admin` records are intentionally treated as ambiguous because that value has represented more than one administrative meaning in older deployments; they are never silently remapped or granted new access.

Run the role migration only after a verified backup and manual review:

```bash
cd server
ROLE_MIGRATION_DRY_RUN=true ALLOW_ROLE_MODEL_MIGRATION=true npm run migrate:canonical-roles
ALLOW_ROLE_MODEL_MIGRATION=true npm run migrate:canonical-roles
```

If the inventory reports legacy `admin` records, provide an explicit reviewed map keyed by MongoDB user ID, for example `ROLE_MIGRATION_ADMIN_MAP='{"<userId>":"super_admin"}'`. The command is idempotent, refuses to run without `ALLOW_ROLE_MODEL_MIGRATION=true`, and performs no automatic interpretation of ambiguous legacy administrators. Existing legacy records remain readable through canonical compatibility queries until the migration is completed.

## Registration, OTP, and reset behavior

OTP codes use cryptographically secure randomness, bcrypt hashing, expiry, one-time consumption, and a maximum of five failed verification attempts. Privileged password-reset OTPs use a shorter expiry and a stricter attempt cap. Verification increments attempts atomically and consumes a matching code atomically, preventing simultaneous requests from using the same OTP successfully. Public registration status returns a short reference such as `AR-7K4P-92XM`; only its SHA-256 digest is stored, it is rate-limited and expiry-enforced, and it never supports email-only lookup. The same reference remains queryable through pending, approved, and rejected states until bounded expiry; terminal-state polling stops and hidden tabs pause polling. Older private links remain accepted during migration. OTP values, status references, and reset credentials are never logged.

Public Student and Faculty registration does not accept applicant-controlled register numbers or employee IDs. A HOD must approve a pending request with a bounded role-appropriate identifier; the server normalizes it, checks the corresponding unique User field, atomically claims the pending request, creates the account, and rolls back the claim on failure. Duplicate identifiers return a clear conflict without approving the request. HOD rejection requires a written reason, and approved status checks expose only the assigned identifier—not password hashes, OTPs, status-token hashes, or other review data.

Sensitive endpoints have separate configurable limits for login, refresh, OTP generation, OTP verification, forgot-password, reset-password, password change, QR generation, QR scanning, attendance submission, registration submission, registration-status checks, and general API traffic. QR and attendance submission limits use authenticated user keys after IP fallback, while public/auth endpoints remain IP-based. Configure `RATE_LIMIT_PASSWORD_CHANGE_MAX`, `RATE_LIMIT_QR_GENERATE_MAX`, `RATE_LIMIT_QR_SCAN_MAX`, `RATE_LIMIT_ATTENDANCE_SUBMIT_MAX`, `RATE_LIMIT_REGISTRATION_STATUS_MAX`, `RATE_LIMIT_PROFILE_PHOTO_MAX`, and `RATE_LIMIT_MESSAGE_SEND_MAX` alongside the other endpoint-specific limits. When `REDIS_URL` is present, all instances use the shared Redis store. Without Redis, the application deliberately falls back to process-local memory limiting for development only.

Login protection is account-aware as well as IP-aware. After the configured failure threshold within `LOGIN_FAILURE_WINDOW_MS`, the account receives a temporary lock whose duration increases up to `LOGIN_LOCK_MAX_MS`; a successful login clears the failure state. Lockout responses are HTTP 429 and expose `Retry-After` to permitted browser clients. Configure `LOGIN_FAILURE_WINDOW_MS`, `LOGIN_FAILURE_THRESHOLD`, `LOGIN_LOCK_BASE_MS`, and `LOGIN_LOCK_MAX_MS` in the server environment.

## Bounded collections and report safety

Administrative class, subject, department, semester, registration-request, faculty-subject, user, and attendance-history collections accept validated `page` and `limit` parameters with server-side maximums. List responses retain their existing array fields and include a `pagination` object so existing clients remain compatible. Public class options are capped at 200 records. Synchronous PDF/Excel reports enforce `MAX_REPORT_ROWS` and return HTTP 413 when the requested export is too large; narrow the date range or export smaller periods rather than increasing the cap casually.

## Roles and authorization

| Internal role | College label | Intended scope |
|---|---|---|
| `super_admin` | HOD | Full authorized institution control over departments, semesters, classes, subjects, accounts, registrations, attendance corrections, QR operations, reports, notifications, and audit-sensitive actions. Validation, RBAC, resource checks, rate limits, and audit logging still apply. |
| `admin` | Faculty | Assigned subjects and classes, attendance marking/editing, authorized QR sessions, scoped reports, notifications, and a read-only server-scoped assigned-student roster. No institution-wide academic or account administration. |
| `user` | Student | Own profile fields permitted by policy, own attendance, own timetable, own notifications, and QR scans authorized by class, subject, session, and enrollment. The account is bound to one browser device. |

Faculty access is checked against actual subject and class relationships rather than role alone. Students cannot change an identifier to read another student’s attendance. HOD queries are institution-wide only because canonical `super_admin` is the HOD role, while every mutation still passes validation, object-level authorization, audit, rate-limit, and sanitization checks. Only HOD can use institution account-management mutations. The HOD interface deliberately separates `/hod/students`, `/hod/faculty`, and `/hod/tutors`; the former combined `/hod/people` path redirects to Students for transition compatibility. Students can be filtered by department and semester and sorted server-side by name, department, semester, or class. The Tutors view is derived from active `Class.classTeacher` relationships and shows each tutor’s assigned class names and IDs.

## Attendance and QR integrity

Attendance has a compound unique index on `(student, subject, date, periodOrder)`. Bulk roster writes use indexed operations, and QR scans use an atomic `$addToSet` claim alongside the unique attendance index. QR sessions return a short-lived opaque token but store only its SHA-256 digest in MongoDB. QR scans validate active session state, expiry, active student status, class membership, subject activity, subject enrollment, session subject/class/period consistency, and duplicate state. Concurrent duplicate insert races return a safe conflict response.

QR creation deactivates older sessions for the subject/date/period and has a MongoDB partial unique index for one active session per subject/class/date/period. The controller also converts duplicate-key races into a safe conflict response. If an existing deployment already contains duplicate active QR sessions, resolve those records before building the new unique index.

## Direct messages

The Messages workspace is available at `/hod/messages`, `/faculty/messages`, and `/student/messages`. HOD may message any active Faculty or Student. Faculty may message active Students in a class they teach through an active Subject or timetable assignment, plus active HODs and assigned class tutors. Students may message one deterministic active HOD, the single Tutor assigned to their current class, active Faculty teaching their current class through Subject or timetable relationships, and active classmates. The server recomputes this relationship scope for recipient discovery, conversation creation, profile viewing, and every send; the client never grants authority by role or recipient ID.

Messages are text-only and are stored in MongoDB with a bounded body of up to 5,000 characters. There is no image, PDF, video, audio, voice, multipart, or external-file message path. Conversations are direct two-person threads with a canonical sorted participant key. Listing and thread endpoints require membership in the conversation, are paginated, and return only safe participant/message fields. Received messages can be marked read, matching message notifications are synchronized as read, and unread counts appear as WhatsApp-style green badges on conversation rows and contact avatars. Owners can edit or permanently delete only their own message from the protected conversation; edits record `editedAt`, deletes remove the matching notification and repair the conversation preview. A new-message notification contains only generic text plus conversation/message identifiers; audit activity records contain no message body.

## Frontend product experience

The dashboard shell uses a deep blue-gray navigation system, warm-neutral light surfaces, a single restrained ochre accent, and semantic green/amber/red status colors. v27 gives HOD, Faculty, and Student dashboards stronger metric hierarchy, clearer action cards, touch-sized controls, and more consistent loading/error/empty states. Shared search fields use aligned icons, readable focus states, and responsive touch targets across navigation, directories, and Messages. The Messages workspace uses a clean WhatsApp-inspired two-pane layout with clear contact hierarchy, readable bubbles, mobile back navigation, recoverable loading/error/empty states, and restrained 160ms motion. The dark theme is independently composed with near-black and slate surfaces rather than inverting the light palette. The interface avoids neon, RGB, glass, gradient blobs, oversized cards, and decorative animation. HOD, Faculty, and Student dashboards use different information priorities: institution oversight, teaching-day execution, and personal attendance respectively. The Student QR page progressively uses native BarcodeDetector when available and falls back to jsQR, explains camera-permission/HTTPS requirements, and provides a secure manual-link fallback. HOD Academic Management and Periods are backed by real server APIs; Academic Management requests bounded subject pages up to the server maximum and merges them before calculating class counts, so the first page cannot create false `0 Subjects` panels. Periods follows a department → semester → class hierarchy with exact subject and Faculty slot assignments and server-side availability checks. The HOD Faculty directory starts with an All Departments view and provides a server-backed department dropdown without changing global pagination or search. Faculty attendance and QR period selectors now use only slots matching the selected subject and logged-in Faculty member, so a subject taught by another Faculty member cannot produce an invalid period request. The timetable editor hides busy Faculty, fails closed when an availability check cannot be completed, and reports the occupied Faculty, day, period, and time when a concurrent save conflicts. Its weekly view uses compact day cards with slot counts, clearer slot grouping, separate type/subject/Faculty and time/note controls, and responsive spacing to reduce visual congestion without changing the save payload. Faculty attendance reads share identical in-flight subject, period, and roster requests during React StrictMode and stale selections cannot overwrite the current state. Availability compares each persisted candidate slot’s Faculty against the hypothetical candidate Faculty; it never expects the hypothetical requested slot itself to contain a Faculty. Save requests preserve current nested slot IDs and the server derives the active timetable ID from the class route. Each class has at most one current tutor, and tutor Student access is restricted to that class. Faculty can submit a reasoned inability request for an exact assigned slot; HOD decisions are audited and accepted requests require a fresh server-side replacement-availability check. Faculty QR and manual attendance selectors show only periods matching the selected subject’s class timetable and date, while the server keeps the exact subject-slot authorization as the final guard. Student leave requests notify the current tutor and HOD, while Student, Faculty, and HOD leave views are organized into Pending, Approved, and Rejected sections with reviewer identity/date and rejection feedback. Registration, reset, change-password, academic management, timetable, reports, directories, and role dashboards expose recoverable loading/error/empty states. Route-not-found, forbidden, unauthorized, validation, network, server, and render failures use a shared branded error page with safe recovery actions; no stack traces, tokens, or internal paths are shown. Desktop navigation collapses to icon tooltips at large screens, while phone and tablet widths use the touch-friendly mobile drawer with Escape/focus/scroll handling. Profile controls stay in the top-right or sidebar footer. Topbar search supports debounced server search and role-safe destinations. Action menus use portal popovers that close on outside click/touch and Escape. The dashboard shell widens on TV-sized screens, keeps compact gutters on phones, and avoids unnecessary option requests and duplicate message loads.

The reusable modal renders through `document.body`, traps keyboard focus, restores focus after close, prevents background scrolling, supports Escape/backdrop/X/Cancel dismissal, and uses a documented stacking hierarchy: base content, navigation, mobile drawer, popover, modal, then toast. The application root also includes a privacy-safe error boundary and branded auth/lazy-route loading screen so render or bootstrap failures do not become blank white pages. The global stylesheet keeps reduced-motion support, visible focus rings, a 320px minimum layout width, and horizontal overflow protection. `client/index.html` references `/favicon.png`; the corresponding `client/public/favicon.png` is intentionally not included until the owner supplies the approved PNG asset.

## Local development

Use Node.js 20 or newer, npm, MongoDB 7 or a compatible MongoDB deployment, and an SMTP provider for OTP and notification flows. Redis is optional for one local backend and required for coordinated rate limits when running multiple API instances. Copy the environment examples and replace placeholders; never commit `.env` files.

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

The API runs on `http://localhost:5000`, the Vite client runs on `http://localhost:5173`, and the liveness/readiness endpoints are `/api/health` and `/api/ready`. The development seed creates 1 HOD, ten departments, eight semesters, up to 80 department-semester classes, a 20-Faculty target per department, 55–60 Students per generated class, five subjects per generated class, conflict-free class-specific weekly timetables, and notifications. Each native-Mongo timetable write includes a stable real ObjectId at every `days[].slots[]._id`; the seed reads raw documents back and refuses to report completion if any slot ID is missing, invalid, duplicated, or if any timetable conflict exists. Existing records are preserved and missing records are added. The seed script requires explicit seed passwords of at least 12 characters and refuses to run when `NODE_ENV=production`. The server environment example documents lockout controls, `MAX_REPORT_ROWS`, `REFRESH_ROTATION_GRACE_MS`, development host binding, private-network CORS, and the production security requirements. Startup fails closed for weak/placeholder or reused JWT secrets, missing production Redis, insecure production cookies, enabled LAN origins or disabled rate limits, invalid proxy hops, and non-HTTPS production origins; set production values deliberately and do not commit `.env` files.

## Optional Docker development and deployment tooling

Docker is optional and is not required for normal development. The primary workflow is local Node.js, MongoDB, and the separate `server`/`client` terminals described above. When a complete local Compose stack or deployment reference is useful, the local `docker-compose.yml` runs the backend, frontend, and MongoDB on one private Compose network. The backend connects to `mongodb://mongo:27017/attendance_register`, not `host.docker.internal`. The client is built with `VITE_API_BASE_URL=/api`, and its Nginx server proxies `/api/` to the `server` service.

Create `server/.env` from `server/.env.example`, set the required JWT, email, and seed values, then run:

```bash
docker compose up --build
```

Open `http://localhost:5173`. Stop the stack with `docker compose down`; add `-v` only when you intentionally want to remove the MongoDB development volume. The production multi-instance example is optional deployment tooling in `deploy/docker-compose.production.yml`; it uses private MongoDB/Redis service names with an Nginx edge proxy.

## LAN/Wi-Fi development

To open the client from another device on the same private network, identify the development PC’s private IPv4 address, such as `192.168.1.28`. Student device binding uses one opaque browser-local identifier sent over `X-Device-Id`; do not clear site storage during a student session unless an authorized HOD has reset the binding. In `client/.env`, set `VITE_API_BASE_URL=http://192.168.1.28:5000/api`. In `server/.env`, replace `YOUR_PC_LAN_IP` in `ALLOWED_ORIGINS` with the same address and keep `NODE_ENV=development`, `ALLOW_LAN_ORIGINS=true`, `REFRESH_COOKIE_SECURE=false`, and `REFRESH_COOKIE_SAMESITE=lax`. The Vite server and API bind to `0.0.0.0` by default for development, but production must use HTTPS, exact origins, and Secure cookies.

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

Terminate HTTPS at a managed load balancer or reverse proxy, set exact HTTPS values in `CLIENT_URL` and `ALLOWED_ORIGINS`, set `REFRESH_COOKIE_SECURE=true`, disable LAN origins and rate-limit bypasses, provide a shared `REDIS_URL`, and configure `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops. Server startup rejects unsafe production configuration before it accepts traffic. Run multiple stateless API instances behind the proxy. MongoDB must remain private, authenticated, TLS-protected, backed up, and monitored; the demonstration Compose MongoDB service is not an internet-facing production database.

For multiple backend instances, configure one shared Redis URL. The example deployment files include `deploy/docker-compose.production.yml`, `deploy/Dockerfile.edge`, and `deploy/nginx.conf`. Redis is used for shared rate-limit state; critical authentication, QR, attendance, and academic state remains in MongoDB.

## Verification

The backend test command is:

```bash
cd server
npm test
```

The server suite covers token-version claims, refresh-token claims, registration credential schema exposure, DOB and dynamic age, short status-reference hashing and validation, Redis fallback mode, liveness/readiness metadata, CORS allowlisting, malformed identifiers, production seed refusal, progressive lockout calculations, secure first-login signaling, hashed QR token storage, QR-specific rate limits, password-reset-required behavior, secure administrator reset wiring, HOD scope boundaries, bounded photo uploads, safe centralized errors, Docker service-name wiring, the scaled seed fixture, exact timetable occupancy, UTC-safe date resolution, exact Faculty subject/period scope, tutor scope, leave decisions, assignment requests, and bounded directory search. The client suite covers the single-flight refresh coordinator, including five simultaneous callers sharing one refresh task, short registration status references, profile scope confirmation, QR fallback/error behavior, responsive accessibility contracts, subject-matched Faculty period selectors, Academic Management tutor confirmation, busy-Faculty filtering with fail-closed availability errors, cancellable directory search, three-state leave sections with reviewer attribution, timezone-safe attendance dates, invalid-date rejection, and polished leave-rejection feedback. The client lint/build pass validates the canonical route tree, separate directories, responsive UI, subject-scoped Faculty period requests, and shared panel system with 0 warnings and 0 errors. The current client test suite contains 28 passing tests; the server suite contains 72 passing tests, including strict body contracts, Fetch Metadata cookie protection, JWT algorithm pinning, fail-closed production configuration, canonical role migration, messaging scope, BOLA, text bounds, notification, audit, owner-only message edit/delete, route, schema, profile, directory, timetable identity, exact Faculty period, registration assignment, and rate-limit contracts. The operational checklist also calls for database-backed tests covering raw `days[].slots[]._id` persistence after seed, GET-to-availability exact-ID flow, unchanged saves, intentional HTTP 409 conflicts, refresh rotation/reuse, password changes, account deactivation, BOLA/RBAC boundaries, QR expiry/wrong-class/duplicate/concurrent scans, registration approval, and report authorization. Those tests require a disposable MongoDB instance and are not simulated by the sandbox-only suite. GitHub Actions runs backend syntax/tests plus frontend lint/build on pushes and pull requests.

Profile-photo uploads use explicit file-size, detected-MIME, extension, safe filename, and executable-content controls rather than relying on client-provided MIME alone. Message bodies are intentionally text-only and never use the profile-photo storage path.

## Profile photos and date of birth

`dateOfBirth` is stored as an authoritative `YYYY-MM-DD` value and age is calculated at read time, including birthday and leap-year handling. The profile and HOD Students and Faculty views expose DOB and derived age while protecting register numbers, employee IDs, class, department, role, and authorization boundaries according to the existing RBAC rules. `npm run migrate:user-dob` audits legacy age-only records and refuses to invent dates; set `ALLOW_LEGACY_AGE_CLEANUP=true` only after a verified backup and manual data review to remove obsolete age fields.

Profile photos use `POST /api/uploads/registration-photo` for public registration and `POST /api/uploads/profile-photo` for authenticated profiles. The server keeps ImageKit private credentials backend-only, limits files to 3 MB, checks JPG/PNG/WebP magic bytes, uses unique safe names, and applies a dedicated upload rate limit. Configure `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, and optionally `IMAGEKIT_PROFILE_FOLDER` in `server/.env`; no `VITE_*` variable should contain the private key.

## Backup and restore

Backup and restore are operational procedures rather than an automated feature of this repository. For a private MongoDB deployment, schedule `mongodump` at least daily, retain multiple rolling copies, keep encrypted off-site copies, and periodically test restores in an isolated environment. A basic backup command is:

```bash
mongodump --uri="$MONGO_URI" --out="./backups/$(date +%Y-%m-%d)"
```

Restore into a maintenance or staging database with:

```bash
mongorestore --uri="$MONGO_URI" --drop ./backups/YYYY-MM-DD
```

Do not run `--drop` against production without an approved maintenance window and a verified backup. The project does not claim that backups are automatically created, uploaded, encrypted, or monitored; those responsibilities belong to the deployment operator.

## Supporting documentation

| Document | Purpose |
|---|---|
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | Verified findings, remediation status, migration notes, and remaining limitations. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Frontend, backend, authentication, QR, database, Redis, and deployment architecture. |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Deployment, secrets, observability, backup, and verification checklist. |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Local, reverse-proxy, multi-instance, Redis, MongoDB, and rollout guidance. |
| [API.md](./API.md) | REST endpoint and role-scope reference. |
| [docs/openapi.yaml](./docs/openapi.yaml) | OpenAPI 3.1 contract for the implemented API, including auth, pagination, QR, reports, and error responses. |
| [CHANGELOG.md](./CHANGELOG.md) | Project change history for role, authorization, workflow, and UX improvements. |

## References

[1]: ./server/src/controllers/registrationRequestController.js "Registration request credential flow"
[2]: ./server/src/controllers/authController.js "Authentication and refresh-session flow"
[3]: ./server/src/middleware/rateLimiters.js "Endpoint-specific and Redis-backed rate limits"
[4]: ./client/src/components/common/Modal.jsx "Portal modal and focus behavior"


## Timetable availability diagnosis and state handling

The availability endpoint is scoped to active Faculty in the selected class department and checks both internal overlaps in the active timetable and exact overlapping assignments in other active timetables. Faculty attendance period options are separately scoped by the server to the selected subject and logged-in Faculty member’s own class-timetable slots. It compares the `faculty` on each persisted candidate slot with the requested candidate Faculty while using the hypothetical requested slot only for day/time overlap. A Faculty member teaching another class at a different period remains available; a conflicting assignment is omitted. The endpoint returns safe diagnostic counts: `eligibleFacultyCount`, `busyFacultyCount`, and `availableFacultyCount`, along with compatible `faculty` and `availableFaculty` arrays. An optional `subjectId` is validated against the selected class for context, while the HOD-only role and class authorization remain server-side. The `/api/timetables/:classId` route parameter is a class ID; the returned `data.timetable._id` is the separate persisted timetable-document ID. Every persisted nested slot must also have a real unique Mongo ObjectId. During availability checks the server resolves the active timetable for the class, rejects a mismatched `excludeTimetableId`, validates exact raw `slotId` membership, and excludes that current document directly from external conflict queries.

The client has explicit idle, loading, success, empty, error, and stale/cancelled handling. It sends the selected subject, cancels obsolete requests with `AbortController`, and ignores responses whose request identity no longer matches the current class/day/period/subject selection. A success response displays the actual Faculty list and count; an empty response explains how many eligible Faculty are occupied; an error response gives a safe retry instruction. No pending request is treated as success, and an unexpected current request that remains loading is converted to a retryable error. Save-time validation covers the complete submitted Monday–Sunday payload, preserves existing nested slot IDs from the client, derives the active timetable from the selected class, excludes that current document and class from external checks, and returns structured exact conflicts. Development diagnostics separate internal submitted-payload conflicts from external timetable conflicts and report the first example from each category. An unchanged payload must return HTTP 200; an intentionally occupied Faculty assignment must remain HTTP 409 with details. `DEBUG_TIMETABLE_CONFLICTS=true` logs bounded identity and conflict snapshots for staging. The previously found null-Faculty break/free-slot fallback remains fixed; only explicit Faculty assignments are considered conflicts.

## Verification boundary

The current v28.1 source passed 75 server tests, 30 client tests, client lint and production build, server syntax checks, dependency audits, and OpenAPI validation. v28.1 adds bounded HTTP request/header/keep-alive timeouts, metadata-only structured API error logging, safe actionable duplicate and malformed-body errors, response compression for payloads above 1 KB, an explicit restrictive Permissions-Policy header, epoch-aware refresh failure handling, and visibility-aware Messages polling. The `npm run validate:timetables` command scans active MongoDB timetables, reports `Missing slot IDs: N`, and exits nonzero when overlaps or raw slot-ID integrity failures exist; its missing-`MONGO_URI` safety guard was verified. The `npm run diagnose:timetable-ids` command reports whether supplied IDs are timetable documents, class route IDs, which active timetable belongs to each class, and the raw per-day slot IDs; its missing-`MONGO_URI` guard was verified. Mock-backed browser checks cover the availability lifecycle; live seed persistence, unchanged-save, intentional-conflict, and exact GET-to-availability requests require the seeded staging database and are intentionally not claimed as verified here.


## Fresh timetable identity handling

The timetable editor normalizes only valid Mongo `_id`/compatible `id` response forms before creating draft slots, so malformed objects cannot become `[object Object]`. Existing slot IDs are retained in the full weekly save payload, and the successful response is normalized again before becoming current state. Class timetable and subject requests use one cancellable request scope; stale responses are ignored, and a class switch clears the previous timetable, draft slots, Faculty choices, availability states, and conflict details before loading the new class. Availability requests send `cleanId(timetable)` and `cleanId(slot)` from the same current state, while the server still rejects arbitrary or stale identifiers. Academic Management uses bounded requests for every subject page and calculates each class badge from the complete loaded subject set rather than the default first page. The Faculty directory’s department selector sends a validated `department` query to the existing HOD-only `/api/users` endpoint; an empty value means All Departments. The timetable editor presents each day and slot as a readable, responsive group while preserving exact timetable and nested slot IDs.
