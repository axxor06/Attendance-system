# Attendance Register v5 REST API Reference

All endpoints are mounted under `/api`. Successful responses retain the existing `{ success, message, data }` shape. Errors use `{ success: false, error: { code, message }, requestId }` and may retain a legacy top-level message for frontend compatibility. Browser clients use an in-memory access token and an HTTP-only refresh cookie; refresh-token values are never returned in JSON.

## Authentication and credential flows

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public, OTP-generation limiter | Register a student with the shared strong-password policy and send email verification. |
| POST | `/auth/verify-email` | Public, OTP-verification limiter | Atomically consume an email-verification OTP. |
| POST | `/auth/resend-otp` | Public, OTP-generation limiter | Send a replacement OTP for an allowed purpose. |
| POST | `/auth/login` | Public, login limiter | Verify email/register number and password; returns an access token and sets an HTTP-only refresh cookie. |
| POST | `/auth/refresh` | Refresh cookie, refresh limiter | Rotate the persistent refresh session and return an access token. Reuse revokes the refresh family. |
| POST | `/auth/logout` | Refresh cookie, refresh limiter | Revoke the presented refresh session and clear the cookie. |
| POST | `/auth/forgot-password` | Public, forgot-password limiter | Return a generic response and send a reset OTP only when appropriate. |
| POST | `/auth/reset-password` | Public, reset limiter | Consume a reset OTP, reject password reuse, increment token version, and revoke sessions. |
| GET | `/auth/me` | Authenticated | Return the current safe user object. |
| POST | `/auth/change-password` | Authenticated, reset limiter | Verify the current password, reject reuse, increment token version, revoke sessions, and clear the refresh cookie. |

Access JWTs contain the user ID, role, and current `tokenVersion`. The protected middleware rejects tokens whose version is stale after a password change, reset, administrator reset, or account deactivation. Passwords require at least 12 characters plus the shared complexity policy. OTP codes are hashed, expiring, attempt-limited, and single-use. Repeated failed logins trigger account-aware temporary progressive lockout, returning HTTP 429 with `Retry-After`; a successful login resets the failure state. Administrator resets and administrator-created accounts without a supplied password use an OTP and set `passwordResetRequired` until the user completes reset. Password-change success requires the client to sign out and return to login.

## Users and academic entities

Authenticated users can read only role-permitted views. HOD and SUPER_ADMIN administration routes validate coarse role, route identifiers, request bodies, and object-level ownership server-side. HODs manage faculty and students; only SUPER_ADMIN can create or manage HOD accounts.

Collection endpoints accept positive-integer `page` and `limit` query parameters with server-side maximums. Responses preserve their resource arrays and add `pagination: { total, page, limit, pages }`. Public class options are capped at 200 records.

| Resource | Main endpoints |
|---|---|
| Users | `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`, `POST /users/:id/reset-password` |
| Departments | `GET /departments`, `GET /departments/:id`, plus HOD/SUPER_ADMIN CRUD |
| Semesters | `GET /semesters`, `GET /semesters/:id`, plus HOD/SUPER_ADMIN CRUD |
| Classes | `GET /classes`, `GET /classes/:id`, `GET /classes/public-options`, plus HOD/SUPER_ADMIN CRUD |
| Subjects | `GET /subjects`, `GET /subjects/:id`, `GET /subjects/my-subjects`, plus HOD/SUPER_ADMIN CRUD |
| Periods | `GET /periods`, `GET /periods/:day`, plus HOD/SUPER_ADMIN management |

User deletion is a soft deactivation. Academic attendance and audit history remain retained.

## Attendance

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/attendance/mark` | SUPER_ADMIN, Faculty, HOD | Bulk-mark a validated subject roster for a date and period. |
| GET | `/attendance/session-roster` | SUPER_ADMIN, Faculty, HOD | Return the authorized roster and existing statuses for a subject session. |
| PATCH | `/attendance/:id` | SUPER_ADMIN, authorized Faculty, HOD | Edit an attendance entry after subject/class ownership validation. |
| GET | `/attendance/history` | Authenticated | Return paginated history filtered to the current student, assigned faculty scope, or broader administrative scope. |
| GET | `/attendance/pending` | Faculty | Return pending assigned subject-period combinations using a batched query. |

The attendance collection enforces uniqueness for `(student, subject, date, periodOrder)`. Requests use server-side roster membership checks and indexed bulk operations.

## QR attendance

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/qr/generate` | SUPER_ADMIN, Faculty, HOD | Create a short-lived QR session for an authorized subject and class period. |
| POST | `/qr/scan` | Student | Validate session state, class, subject, enrollment, expiry, active student state, and duplicate state before recording presence. |
| GET | `/qr/stats` | SUPER_ADMIN, Faculty, HOD | Read live statistics for an authorized subject session. |

QR tokens are cryptographically random. The database has a partial unique index for one active session per subject/class/date/period, while scans use atomic attendance upsert and `$addToSet` claim semantics. Concurrent generation or scanning must still be verified against a disposable MongoDB instance before production release.

## Reports

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/reports/subject/:subjectId?format=pdf|excel` | Faculty scoped, HOD, SUPER_ADMIN | Export an authorized subject report. |
| GET | `/reports/student/:studentId?format=pdf|excel` | Student self, Faculty scoped, HOD/SUPER_ADMIN | Export an authorized student report. |
| GET | `/reports/class/:classId/monthly?year=YYYY&month=M&format=pdf|excel` | Faculty scoped, HOD, SUPER_ADMIN | Export an authorized class monthly report. |

Path and query identifiers are validated as MongoDB ObjectIds before report controllers execute. Filenames are sanitized and report authorization is performed before export generation. Subject and class exports are capped by `MAX_REPORT_ROWS` and return HTTP 413 when the requested synchronous export is too large.

## Notifications, search, registration requests, and health

Notifications are authenticated and user-scoped. Global search is available to SUPER_ADMIN, HOD, and faculty; topbar results navigate to a scoped page rather than being inert. Registration request submission and status checks are public but separately rate-limited and validated; review endpoints require SUPER_ADMIN or HOD.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/registration-requests` | Public, registration limiter | Submit a student registration request; only a bcrypt hash is stored. |
| GET | `/registration-requests/status?email=...` | Public, status limiter | Return the request status for the supplied email. |
| GET | `/registration-requests` | SUPER_ADMIN/HOD | List reviewable requests without credential fields. |
| POST | `/registration-requests/:id/approve` | SUPER_ADMIN/HOD | Create the student from the stored hash and remove the processed hash. |
| POST | `/registration-requests/:id/reject` | SUPER_ADMIN/HOD | Reject a request and remove its stored credential hash. |
| GET | `/health` | Public | Liveness-only process response. |
| GET | `/ready` | Public | Returns 200 only when MongoDB is ready; otherwise 503. |

## Rate limits and errors

Sensitive endpoints have independent configurable limits. When `REDIS_URL` is configured, the limiters share counters through Redis across all API instances. Without Redis, the memory store is a development/test fallback. Errors include request IDs for diagnostics; sensitive values are not included in error messages or logs. The machine-readable contract is [docs/openapi.yaml](./docs/openapi.yaml). CI is defined in `.github/workflows/ci.yml`.

## Role requirements

The backend never trusts frontend role state. Every protected route verifies the bearer token, loads the current user, checks active state and token version, applies the route role gate, validates identifiers, and performs resource-level checks where a path, query, request body, attendance record, subject, class, report, or QR token identifies a resource.

## References

[1]: ./SECURITY_AUDIT.md "v5 security audit"
[2]: ./ARCHITECTURE.md "v5 architecture"
[3]: ./README.md "v5 project README"
