# Security Audit — Attendance Register v6

**Assessment scope.** This audit covers the v5.1 baseline after the v6 hardening, v7 authentication, v8 UI/stability passes, and v8.1 backend-first bug-fix pass. The project remains a modular MERN monolith: Express and Mongoose enforce the security boundary, while React supplies role-aware presentation only. The review prioritizes authorization, object-level access control, authentication/session security, abuse resistance, LAN development safety, and production-readiness.

> **Security principle:** A user interface decision is never treated as authorization. Every protected resource is checked again against the authenticated user, role, department, class, subject, enrollment, or session relationship on the server.

## Executive summary

The v6 pass adds an explicit `ADMIN` role, centralizes role and object authorization, scopes HOD queries to the authenticated department and its classes, replaces email-only registration status checks with a private request capability, and hardens administrator password resets and session invalidation. The v7 pass adds single-flight refresh coordination and v8 adds permission-consistent UI controls, visible recovery states, and an exact client mirror of the backend password policy. The v8.1 pass adds database uniqueness enforcement for semesters and active period templates, transaction-first period-template replacement with audit logging, cookie-origin guards on refresh/logout, a minimal public class-options payload, auth-epoch logout invalidation, and resilient client retry states. LAN development is enabled through controlled host binding, environment-driven API URLs, explicit CORS configuration, and HTTP-compatible development cookies. Existing REST routes, MongoDB models, dashboards, attendance, QR, reports, notifications, and academic workflows are preserved.

| Control area | Result | Evidence |
|---|---|---|
| Explicit role model | Implemented | [`constants.js`](./server/src/config/constants.js), [`authorization.js`](./server/src/utils/authorization.js) |
| ADMIN/SUPER_ADMIN separation | Implemented | [`userController.js`](./server/src/controllers/userController.js) and role-gated routes |
| HOD department isolation | Implemented in backend predicates | User, class, subject, attendance, dashboard, search, registration, and report controllers |
| IDOR/BOLA protection | Implemented for major object paths | `assert*Access` helpers and controller query filters |
| Private registration status | Implemented | [`RegistrationRequest.js`](./server/src/models/RegistrationRequest.js) and registration routes |
| Session invalidation | Implemented for password/security changes and deactivation | Auth and user controllers; refresh-session model |
| OTP attempt bounds | Implemented | [`Otp.js`](./server/src/models/Otp.js), [`otp.js`](./server/src/utils/otp.js) |
| Redis-backed rate limiting | Preserved with development memory fallback | [`rateLimiters.js`](./server/src/middleware/rateLimiters.js) |
| LAN development | Implemented with explicit development opt-in | [`app.js`](./server/src/app.js), [`server.js`](./server/src/server.js), Vite config, env examples |
| Backend verification | Passed | Syntax checks passed; `npm test`: 16 tests passed |
| Frontend verification | Passed with non-blocking legacy warnings | Client tests: 3 passed; `npm run build` passed; `npm run lint` reported 0 errors and 12 non-blocking warnings |

## Authorization and privilege boundaries

The canonical role values are `super_admin`, `admin`, `hod`, `faculty`, and `student`.[^1] `SUPER_ADMIN` is the only role allowed to manage `ADMIN` accounts. `ADMIN` may create and manage HOD, faculty, and student accounts, but cannot manage `ADMIN` or `SUPER_ADMIN` accounts. HOD account management is limited to administrators, and HODs cannot create privileged accounts or manage another department.[^2]

Object access is checked independently from route-level role authorization. A permitted role does not automatically imply access to every object. Student access is self-only unless a faculty relationship, HOD department scope, or administrator scope authorizes the record. Faculty access requires an active subject/class relationship. HOD access requires a department match or a class belonging to the HOD department. These checks are implemented as database predicates rather than post-query frontend filters.[^3]

| Actor | Permitted account creation roles | Object scope |
|---|---|---|
| `SUPER_ADMIN` | ADMIN, HOD, faculty, student | Institution-wide, subject to protected SUPER_ADMIN self-target rules |
| `ADMIN` | HOD, faculty, student | Institution-wide except ADMIN and SUPER_ADMIN accounts |
| `HOD` | faculty, student | Authenticated department and its class set |
| `FACULTY` | None | Assigned subjects/classes and related students |
| `STUDENT` | None | Own records and authorized QR scan context |

## HOD isolation and BOLA/IDOR controls

HOD isolation is anchored to `req.user.department`, not to a client-supplied department filter. `applyDepartmentScope()` injects the department predicate into department, class, subject, and related reads. `applyUserScope()` additionally includes students whose class belongs to the HOD department, which handles student records linked through class membership. `getDepartmentScope()` resolves the department’s class IDs for aggregate and report paths.[^3]

| Resource | Enforcement |
|---|---|
| Users | Manageable-role hierarchy, self-target denial, department/class scope, and session revocation on sensitive changes |
| Classes | HOD department predicate, teacher department validation, scoped detail/update/delete checks |
| Subjects | Class/department/semester consistency, faculty/student relationship validation, HOD department predicate |
| Attendance | Session context checks, subject access checks, HOD department predicates, and student self-scope |
| Reports | Subject/class/student access assertions, HOD-scoped roster queries, validated date and format inputs |
| Registration requests | HOD class-to-department predicate and private request status capability |
| Search | Role-specific database predicates for HOD, faculty, ADMIN, and SUPER_ADMIN |
| Departments | HOD reads limited to the authenticated department; global writes limited to ADMIN/SUPER_ADMIN |

An object outside an HOD’s scope is not returned or mutated. The key security property is that the query itself contains the scope predicate before the object is returned or changed.[^4]

## Authentication, OTP, and session security

Access JWTs contain the user ID, role, and token version. Protected middleware compares the token version with the current user record, so password changes, account deactivation, and other sensitive changes can invalidate already-issued access tokens.[^5] Refresh tokens carry a unique `jti`, are stored server-side only as a digest, and rotate within a refresh-session family. Reuse detection revokes the family.

Public and administrator password flows do not expose passwords or reset credentials through API responses. Password reset and administrator reset flows use hashed OTP records with bounded attempts, expiry, one-time consumption, and purpose separation. Privileged administrator resets use a five-minute expiry and three-attempt cap. The user must complete the reset flow before `passwordResetRequired` is cleared.[^6]

Registration status no longer accepts an email-only lookup. Submission returns a `requestId` and a high-entropy `statusToken`; the database stores only the SHA-256 token digest. Status checks require both values, are rate-limited, and return a generic response when the capability does not match. Approval and rejection clear the stored status-token digest.[^7]

## Abuse resistance and input handling

Sensitive endpoints retain separate rate limits for login, refresh, OTP generation, OTP verification, forgot-password, password reset, registration submission, registration-status checks, and general API traffic. Redis is used when `REDIS_URL` is configured; the process-local limiter is intentionally a development fallback and is not sufficient for a multi-instance production deployment.[^8]

Login protection is account-aware and progressive. Failed attempts are tracked in a bounded field, temporary lock duration increases after the configured threshold, successful login clears the failure state, and lock responses include `Retry-After`. Request body, URL-encoded, Mongo sanitization, object-ID, validation, and report-size controls remain in the request pipeline.[^9]

## LAN development boundary

Development servers bind to `0.0.0.0` so a second device on the same private network can reach the client and API. The client API base URL is environment-driven. CORS retains exact configured origins and adds RFC1918/localhost HTTP origins only when `NODE_ENV` is not production and `ALLOW_LAN_ORIGINS=true`.[^10] Refresh cookies use `lax` and `Secure=false` for HTTP LAN development; production forces `Secure` when `NODE_ENV=production` and requires HTTPS configuration.

LAN development must remain on a private network. The README documents Windows Firewall rules that allow only TCP ports 5173 and 5000 on the Private profile; it does not recommend disabling the firewall.[^11]

## UI permission consistency

The frontend now treats role visibility as a usability boundary rather than a security boundary. HOD users do not see global department or semester mutation controls, and their timetable screen is explicitly read-only because those backend routes are institution-wide administrator operations. Department-scoped people and subject operations remain available where their existing backend gates and predicates permit them. SUPER_ADMIN and ADMIN retain the administrator controls already supported by the backend.

The client password-policy helper mirrors the server’s minimum length and character-class checks for registration, request registration, reset, and change-password forms. The backend validators remain authoritative and unchanged as the security boundary.

## Verification and residual risk

The backend syntax pass and the automated Node test suite completed successfully. The suite reports 16 passing tests covering token claims, registration credential schema exposure, refresh-family support, semester and active period-template uniqueness, cookie-origin behavior, period-template audit logging, progressive lockout calculations, reset-required privacy, administrator OTP reset wiring, pagination bounds, Redis fallback mode, liveness/readiness, CORS, malformed identifiers, and production seed refusal. The frontend Vite build completed successfully. Frontend lint completed with 0 errors and retained legacy unused-import warnings in unrelated pre-existing pages.

The v8.1 client test, lint, and build pass completed after the runtime and copy fixes; remaining lint output consists of 12 non-blocking legacy unused-import warnings in unrelated pages. Sensitive-pattern and stale-copy scans returned no matches in source. The sandbox does not provide a disposable MongoDB/Redis deployment for full integration testing. Before production release, run the database-backed scenarios in the production checklist, including refresh rotation/reuse, password and role changes, deactivation, HOD cross-department BOLA attempts, QR expiry and concurrent scans, registration approval/rejection, and report exports. Configure exact HTTPS origins, TLS-protected MongoDB, shared Redis, trusted proxy hops, backups, monitoring, and alerting before exposing the service publicly.

## References

[^1]: [`server/src/config/constants.js`](./server/src/config/constants.js) — canonical role constants.
[^2]: [`server/src/controllers/userController.js`](./server/src/controllers/userController.js) — role hierarchy, manageable-user checks, and session invalidation.
[^3]: [`server/src/utils/authorization.js`](./server/src/utils/authorization.js) — central object-level authorization and HOD scope helpers.
[^4]: [`server/src/controllers/attendanceController.js`](./server/src/controllers/attendanceController.js), [`server/src/controllers/classController.js`](./server/src/controllers/classController.js), and [`server/src/controllers/subjectController.js`](./server/src/controllers/subjectController.js) — resource-specific scope enforcement.
[^5]: [`server/src/utils/jwt.js`](./server/src/utils/jwt.js) and [`server/src/middleware/auth.js`](./server/src/middleware/auth.js) — token claims and token-version validation.
[^6]: [`server/src/models/Otp.js`](./server/src/models/Otp.js) and [`server/src/utils/otp.js`](./server/src/utils/otp.js) — OTP hashing, expiry, and attempt bounds.
[^7]: [`server/src/controllers/registrationRequestController.js`](./server/src/controllers/registrationRequestController.js) and [`server/src/routes/registrationRequestRoutes.js`](./server/src/routes/registrationRequestRoutes.js) — private status capability.
[^8]: [`server/src/middleware/rateLimiters.js`](./server/src/middleware/rateLimiters.js) and [`server/src/services/redisService.js`](./server/src/services/redisService.js) — rate-limit storage behavior.
[^9]: [`server/src/app.js`](./server/src/app.js) and [`server/src/utils/loginProtection.js`](./server/src/utils/loginProtection.js) — request protections and progressive lockout.
[^10]: [`server/src/app.js`](./server/src/app.js), [`server/src/server.js`](./server/src/server.js), and [`client/vite.config.js`](./client/vite.config.js) — LAN host and CORS behavior.
[^11]: [`README.md`](./README.md) — LAN setup and Windows Firewall instructions.
