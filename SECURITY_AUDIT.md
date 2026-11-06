# Security Audit — Attendance Register

## Assessment scope

This audit covers the canonical-role, authorization, workspace, timetable, workflow, and visual architecture pass on the previously hardened Attendance Register MERN monolith. The review treats the Express API and MongoDB predicates as the security boundary; React route visibility is usability only. The pass preserves short-lived access JWTs, HTTP-only rotating refresh cookies, refresh-session family tracking and reuse detection, single-flight client refresh coordination, React StrictMode, student one-device binding, QR integrity, OTP controls, password policies, ImageKit validation, rate limits, audit logging, and safe error responses.

> **Security principle:** A user interface decision is never treated as authorization. Every protected resource is checked again against the authenticated user, canonical role, account state, object relationship, enrollment, assignment, or session relationship on the server.

## Canonical role policy

The only internal role values are `super_admin`, `admin`, and `user`. Their public college labels are HOD, Faculty, and Student respectively. There is no separate college-facing Super Admin role. Public registration continues to use the friendly request values `student` and `faculty`; approval maps them to `user` and `admin` before account persistence.

| Internal role | Public label | Authorization policy |
|---|---|---|
| `super_admin` | HOD | Full authorized institution control over academic structure, accounts, registration review, attendance correction, QR operations, reports, notifications, and audit-sensitive actions. Validation, resource checks, rate limits, and audit logging still apply. |
| `admin` | Faculty | Teaching-scoped access to active assigned subjects and classes, attendance operations, authorized QR sessions, scoped reports, notifications, and server-filtered assigned students. No institution-wide account or academic mutation. |
| `user` | Student | Self-only profile and attendance access, authorized QR scans, timetable, notifications, and one-device binding. |

Legacy `hod`, `faculty`, and `student` values are recognized by compatibility helpers during migration. A legacy raw `admin` is ambiguous because an earlier release used that value for a different privilege tier; the login and protected-request paths refuse it until an explicit reviewed migration marks it as canonical. The guarded `migrate:canonical-roles` command is idempotent, requires `ALLOW_ROLE_MODEL_MIGRATION=true`, supports dry-run inventory, and never silently interprets old administrators.

## Control status

| Control area | Result | Evidence or limitation |
|---|---|---|
| Canonical role model | Implemented | `constants.js`, `User.js`, JWT normalization, auth middleware, route guards, seed fixtures |
| HOD institution control | Implemented in code and static contracts | HOD is canonical `super_admin`; department, semester, class, subject, user, registration, attendance, QR, and report mutations are HOD-gated |
| Faculty teaching scope | Implemented in code and static contracts | Subject/class assignment predicates and server-scoped `/api/users/assigned-students` endpoint |
| Student self-only scope | Implemented in code and static contracts | `assertStudentAccess`, attendance/report predicates, canonical QR role check, one-device binding |
| Legacy migration safety | Implemented | Guarded idempotent migration and ambiguous legacy-admin refusal |
| IDOR/BOLA protection | Implemented for major resource paths | Database predicates and `assertStudentAccess`, `assertSubjectAccess`, `assertClassAccess` |
| Refresh rotation and reuse detection | Preserved | Atomic refresh-session claim, bounded same-token grace, family revocation on stale replay |
| Client refresh single-flight | Preserved | Shared in-flight promise for bootstrap and concurrent expired-request callers; React StrictMode retained |
| Password/OTP controls | Preserved | Hashed OTPs, expiry, attempt bounds, password strength policy, token-version invalidation |
| Student device binding | Preserved | Opaque client identifier; only SHA-256 server hash; authorized HOD reset revokes sessions |
| QR/attendance integrity | Preserved and aligned | Hashed QR tokens, expiry/class/enrollment checks, exact subject-slot authorization, uniqueness, duplicate handling, and Faculty selectors narrowed to matching class periods |
| Context-aware selectors and dates | Implemented | Subject/date/class-dependent period options, server-validated Faculty availability with fail-closed UI errors, and UTC-safe ISO date resolution |
| Leave visibility and attribution | Implemented | Pending/Approved/Rejected sections for Student, Faculty, and HOD views with reviewer identity, decision date, and rejection reason |
| Static error recovery | Implemented | Explicit favicon link and recoverable load/report errors instead of blank or generic UI states |
| Upload security | Preserved | Magic-byte validation, 3 MB cap, allowed ImageKit origin, safe metadata |
| Input and abuse protection | Preserved | Helmet/CORS, sanitization, validators, ObjectId checks, endpoint-specific rate limits, optional Redis |
| Automated backend verification | Passed | 45/45 Node tests; all server source syntax checks passed |
| Automated frontend verification | Passed | 17/17 client tests; lint 0 warnings/errors; Vite production build passed |
| Live database/runtime verification | Not available in sandbox | MongoDB, Docker, and Redis were unavailable; live seed/auth/role/QR workflows remain user/staging verification items |

## Authorization and object scope

`protect` verifies the bearer token, reloads the current account, checks active state and token version, rejects ambiguous un-migrated legacy administrators, normalizes legacy role aliases, and enforces the Student device binding. `authorize` compares canonical role values. Controllers then apply object-level predicates before returning or mutating records.

HOD is institution-wide, so the former department-isolation branch is not applied to canonical `super_admin`. This does not bypass validation: department/class/semester consistency, dependent-record deletion constraints, account self-target protections, and activity logging remain enforced. Faculty scope is derived from active Subject assignments and related Classes. A client-provided department or class filter cannot expand that scope. Students can only access their own attendance and authorized QR context.

The HOD UI has separate `/hod/students` and `/hod/faculty` destinations. They use role-specific filters, stats, table columns, detail summaries, and actions. `/hod/people` is only a compatibility redirect to Students and is not a combined management destination. Faculty uses `/faculty/students`, backed by a dedicated read endpoint that returns only active assigned students and exposes no HOD mutation actions.

## Authentication and session security

Access tokens are short-lived and carry the user ID, canonical role, and token version. Refresh values are HTTP-only cookies; MongoDB stores only a token digest, JTI, family identifier, and rotation metadata. Rotation atomically claims the current session. A bounded recent same-token grace path supports legitimate multi-tab races; stale replay, mismatched token, or reuse outside that window revokes the refresh family. The client shares one in-flight refresh promise across bootstrap and concurrent 401 recovery instead of issuing parallel refresh requests. The backend reuse response remains a forced re-login condition and was not weakened.

Password changes, resets, account deactivation, role/security changes, and authorized Student device resets invalidate sessions through token-version and refresh-session revocation. HOD password resets return a cryptographically generated permanent password only once to the authorized HOD response, store only its hash, clear the reset-required state, revoke existing sessions, and never log or email the plaintext. Self-service resets use hashed, expiring, purpose-specific OTPs with bounded attempts.

Self-service email changes (v28.1) no longer write the new address directly: `POST /auth/me/email-change` stores the target as `pendingEmail`, emails a purpose-scoped OTP to it, and separately notifies the account's current address immediately so a hijacked session cannot silently redirect the account's recovery channel without the legitimate owner being told. `POST /auth/me/email-change/confirm` only writes `email` after the OTP is verified and re-checks uniqueness to close the verification-window race; `POST /auth/me/email-change/cancel` clears a pending request. All three sit behind `protect` and the existing OTP-generation/verification rate limiters.

## QR, attendance, and data integrity

QR sessions store only SHA-256 token digests and validate active status, expiry, subject/class/period consistency, authenticated Student role, class membership, explicit subject enrollment, and duplicate state. Attendance has a compound uniqueness coordinate for student, subject, date, and period. Faculty marking and editing require assigned subject/class relationships; HOD can correct institution records; Students have history access only. Concurrent duplicate operations are converted into safe conflicts rather than duplicate records.

## Input, deployment, and privacy controls

The application keeps explicit CORS origins, secure production cookies, Helmet/CSP headers, request IDs, Mongo sanitization, express-validator input checks, ObjectId validation, report-size limits, route-specific rate limits, account-aware login lockout, and optional Redis-backed distributed limiter state. Without Redis, the process-local limiter is documented as development-only. Image uploads validate actual bytes and allowed origins; private ImageKit credentials remain server-side. Error responses do not expose stack traces, tokens, passwords, OTPs, or internal filesystem paths.

LAN development is opt-in and intended only for a private Wi-Fi network. The README documents exact origins, Vite/API binding, `X-Device-Id` behavior, and scoped Windows Firewall rules. Production requires HTTPS, exact origin allowlists, Secure cookies, private authenticated MongoDB, shared Redis for multi-instance limits, backups, monitoring, and trusted proxy configuration.

## Verification and residual risk

The automated gates completed successfully: 45 server tests passed, 17 client tests passed, the client linter reported zero warnings and errors, the client production build completed, every server source module passed `node --check`, and the OpenAPI document parsed successfully with 47 paths. Static route and role contracts cover canonical role mapping, HOD-only institution mutations, Faculty scope denial, Student device binding, refresh single-flight, QR fallback, protected modal behavior, public registration, password policy, notification recovery, class timetables, exact-slot attendance, UTC-safe date resolution, subject-matched Faculty period selectors, fail-closed availability errors, tutor scope, assignment decisions, three-state leave presentation with decision attribution, bounded directory search, and responsive navigation.

The sandbox did not provide MongoDB, Docker, or Redis. Consequently, no claim is made that a live seeded database, refresh rotation/reuse workflow, registration approval, multi-role login, QR scan, concurrent attendance write, Redis-backed limiter, Docker Compose runtime, LAN device flow, or database-backed leave/timetable persistence executed here. Mock-backed authenticated browser matrices did render HOD, Faculty, and Student workspaces at 1920×1080, 1366×900, 768×1024, 412×915, and 390×844 with no measured horizontal overflow. The generated 390px and 412px Student, Faculty, and HOD captures also showed readable mobile hierarchy and contained actions. Those live scenarios must be run against a disposable MongoDB/Redis environment before production. The timetable API now supplies class-specific subject/faculty assignments; legacy day templates remain only as a controlled read fallback for classes without an active timetable.

## References

[1]: ./server/src/config/constants.js "Canonical role constants and compatibility helpers"
[2]: ./server/src/utils/authorization.js "Canonical object-level authorization"
[3]: ./server/src/middleware/auth.js "Protected-request role and token checks"
[4]: ./server/src/controllers/authController.js "Authentication and refresh-session flow"
[5]: ./server/src/utils/migrateCanonicalRoles.js "Guarded canonical-role migration"
[6]: ./server/src/controllers/userController.js "HOD account management and Faculty assigned students"
[7]: ./server/src/controllers/attendanceController.js "Attendance authorization and writes"
[8]: ./server/src/controllers/qrController.js "QR generation and scan validation"
[9]: ./client/src/api/client.js "Client single-flight refresh coordinator"
[10]: ./server/src/models/AssignmentRequest.js "Immutable Faculty assignment-request schema"
[11]: ./server/src/controllers/assignmentRequestController.js "Exact-slot Faculty inability and HOD replacement workflow"
[12]: ./server/src/services/timetableService.js "Class timetable resolution and Faculty conflict checks"
[13]: ./README.md "Setup, role, LAN, timetable, and deployment guidance"
