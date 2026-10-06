# Attendance Register REST API Reference

All endpoints are mounted under `/api`. Successful responses retain the existing `{ success, message, data }` shape. Errors use `{ success: false, error: { code, message }, requestId }` and may retain a legacy top-level message for frontend compatibility. Browser clients use an in-memory access token and an HTTP-only refresh cookie; refresh-token values are never returned in JSON.

## End-to-end request security

Critical JSON mutations use explicit body allowlists. Unexpected fields are rejected before authentication, registration, HOD review, account, messaging, academic, attendance, QR, timetable, leave, assignment, notification, or profile controllers run. Refresh and logout requests validate the browser `Origin` and reject `Sec-Fetch-Site: cross-site` requests when Origin is absent. Access and refresh JWTs are signed and verified with HS256 only. Production startup fails closed when JWT secrets are weak, reused, or placeholder values; cookies, origins, LAN allowances, rate-limit bypasses, Redis, or trusted-proxy settings are unsafe. Academic identifiers are normalized and bounded server-side, and the legacy unmounted self-registration identifier path has been removed.

## Authentication and credential flows

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/registration-requests` | Public, registration limiter | Submit a Student or Faculty request without an applicant-supplied register number or employee ID. The response returns a short `statusCode` such as `AR-7K4P-92XM`; only its hash is stored. |
| POST | `/auth/verify-email` | Public, OTP-verification limiter | Atomically consume an email-verification OTP. |
| POST | `/auth/resend-otp` | Public, OTP-generation limiter | Send a replacement OTP for an allowed purpose. |
| POST | `/auth/login` | Public, login limiter | Verify email/register number and password; returns an access token and sets an HTTP-only refresh cookie. |
| POST | `/auth/refresh` | Refresh cookie, refresh limiter | Rotate the persistent refresh session and return an access token. A short same-token grace window handles legitimate multi-tab races; stale reuse outside the window revokes the refresh family. |
| POST | `/auth/logout` | Refresh cookie, refresh limiter | Revoke the presented refresh session and clear the cookie. |
| POST | `/auth/forgot-password` | Public, forgot-password limiter | Return a generic response and send a reset OTP only when appropriate. |
| POST | `/auth/verify-reset-otp` | Public, reset limiter | Verify a reset OTP without consuming it so the client can present the new-password step. |
| POST | `/auth/reset-password` | Public, reset limiter | Consume a reset OTP, reject password reuse, increment token version, and revoke sessions. |
| GET | `/auth/me` | Authenticated | Return the current safe user object. |
| PATCH | `/auth/me` | Authenticated | Update role-permitted profile fields (name/employeeId/dateOfBirth restricted to HOD). No longer accepts `email` — see the dedicated flow below. |
| POST | `/auth/me/email-change` | Authenticated, OTP-generation limiter | Request an email change. Stores the target as pending, emails it an OTP, and immediately emails the current address so the account owner is alerted even before confirmation. Does not modify `email` yet. |
| POST | `/auth/me/email-change/confirm` | Authenticated, OTP-verification limiter | Verify the OTP sent to the pending address and apply the change; re-checks uniqueness for the verification-window race. |
| POST | `/auth/me/email-change/cancel` | Authenticated | Clear a pending email-change request without applying it. |
| POST | `/auth/change-password` | Authenticated, reset limiter | Verify the current password, reject reuse, increment token version, revoke sessions, and clear the refresh cookie. |

Access JWTs contain the user ID, role, and current `tokenVersion`. The protected middleware rejects tokens whose version is stale after a password change, reset, administrator reset, or account deactivation. Passwords require at least 12 characters plus the shared complexity policy. OTP codes are hashed, expiring, attempt-limited, and single-use. Repeated failed logins trigger account-aware temporary progressive lockout, returning HTTP 429 with `Retry-After`; a successful login resets the failure state. HOD resets generate a cryptographically random permanent password, store only its bcrypt hash, clear `passwordResetRequired`, revoke existing sessions, and return the plaintext exactly once to the authorized HOD over the protected response. The permanent password is never logged or recoverable later; the reset does not force a first-login change. Administrator-created accounts without a supplied password use an emailed setup code. Managed-account creation returns only a safe `credentialMode`: either an administrator-provided initial password or an emailed setup code. Password-change success requires the client to sign out and return to login.

## Users and academic entities

Authenticated users can read only role-permitted views. HOD (`super_admin`) institution routes validate the role, route identifiers, request bodies, and object-level ownership server-side. Faculty (`admin`) can use only assigned teaching resources and the server-scoped assigned-student read endpoint; Student (`user`) is self-only. No client-side role state is trusted.

Collection endpoints accept positive-integer `page` and `limit` query parameters with server-side maximums. Responses preserve their resource arrays and add `pagination: { total, page, limit, pages }`. Public class options are capped at 200 records. The HOD-only `GET /users` directory accepts validated `department=<ObjectId>`, `semester=<ObjectId>`, `tutorsOnly=true`, `sortBy=name|department|semester|class|createdAt`, and `sortOrder=asc|desc` queries. Student listings can be filtered by department or semester and sorted server-side; the HOD Tutors view uses `role=admin&tutorsOnly=true` and returns each tutor’s active class names and IDs. Omitting `department` is the All Departments view; all filters apply to the same bounded paginated response rather than loading an unrestricted directory into the browser.

| Resource | Main endpoints |
|---|---|
| Users | `GET /users/assigned-students` (Faculty scoped), `GET /users`, `GET /users/:id`, `GET /users/:id/summary`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`, `POST /users/:id/reset-password`, `POST /users/:id/reset-device` |
| Departments | `GET /departments`, `GET /departments/:id`, plus HOD (`super_admin`) CRUD |
| Semesters | `GET /semesters`, `GET /semesters/:id`, plus HOD (`super_admin`) CRUD |
| Classes | `GET /classes`, `GET /classes/:id`, `GET /classes/public-options`, plus HOD (`super_admin`) CRUD; Faculty reads assigned classes only |
| Subjects | `GET /subjects`, `GET /subjects/:id`, `GET /subjects/my-subjects`, plus HOD (`super_admin`) CRUD; Faculty reads assigned subjects. `GET /subjects` remains paginated with a maximum `limit=100`; Academic Management requests bounded pages and merges them so class subject counts do not depend on the first page. |
| Periods | `GET /periods`, `GET /periods/:day`, plus HOD (`super_admin`) management and controlled legacy fallback. `GET /periods/:day?classId=<classId>&subjectId=<subjectId>` validates the active class and subject, then returns only exact class-timetable periods for the authenticated Faculty and selected subject; stale timetable/slot IDs are rejected and legacy templates remain compatible. |
| Timetables | `GET /timetables`, `GET /timetables/:classId`, `GET /timetables/availability`, `PUT /timetables/:classId` — department → semester → class schedules; the route parameter is always the **class ID**, while the successful response’s `data.timetable._id` is the persisted timetable-document ID. Every raw `days[].slots[]` document must contain its own unique Mongo ObjectId; the seed derives stable IDs from class/day/order and the validator refuses to pass missing, invalid, or duplicate IDs. HOD writes and server-side overlap checks remain authoritative. Availability accepts the class, optional active subject, day, order, time range, and optional `slotId`; the server resolves the active timetable for that class, rejects a mismatched `excludeTimetableId`, verifies exact raw slot membership, compares each persisted candidate slot’s `faculty` with the requested candidate Faculty, checks internal overlaps while excluding only the exact edited slot, omits the current timetable from external checks, and returns the resolved `timetableId`. The PUT path derives its own active timetable `_id`, excludes that document and class from external checks, and keeps separate internal and external conflict diagnostics in development logs. It is scoped to active Faculty in the selected class department and returns `faculty`, `availableFaculty`, `eligibleFacultyCount`, `busyFacultyCount`, and `availableFacultyCount`. Conflict responses identify the Faculty, day, period, time, current/conflicting timetable, class, and slot IDs. The UI uses explicit idle/loading/success/empty/error states, cancels stale requests, and never treats a pending or failed check as proof that every Faculty member is busy. |
| Leave requests | `GET /leave-requests`, `POST /leave-requests`, `PATCH /leave-requests/:id/decision` — Student submission; current class tutor or HOD decision; rejection reason required. List responses include `decidedBy` and `decidedAt` when decided so Student, Faculty, and HOD views can show the reviewer and decision date. |
| Assignment requests | `GET /assignment-requests`, `POST /assignment-requests`, `PATCH /assignment-requests/:id/decision` — Faculty exact-slot inability requests; HOD accepts with a server-verified free replacement or rejects without changing the timetable |

User deletion is a soft deactivation. Academic attendance and audit history remain retained. When `POST /users` uses the emailed setup-code mode and email delivery fails, the account and newly created setup OTP are rolled back.

## Attendance

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/attendance/mark` | HOD, Faculty; authenticated attendance-submission limiter | Bulk-mark a validated subject roster for a date and period. The limiter is user-aware with IP fallback. |
| GET | `/attendance/session-roster` | HOD, authorized Faculty | Return the authorized roster and existing statuses for a subject session. |
| PATCH | `/attendance/:id` | HOD, authorized Faculty | Edit an attendance entry after subject/class ownership validation. |
| GET | `/attendance/history` | Authenticated | Return paginated history filtered to the current student, assigned faculty scope, or broader administrative scope. |
| GET | `/attendance/pending` | Faculty | Return pending assigned subject-period combinations using a batched query. |

The attendance collection enforces uniqueness for `(student, subject, date, periodOrder)`. Requests use server-side roster membership checks and indexed bulk operations. Faculty attendance and QR actions for class-specific schedules are additionally bound to the exact timetable slot assigned to the caller; a subject-level assignment cannot expand that scope. The Faculty client sends the selected subject and class to the period endpoint and applies a second exact subject/Faculty filter to returned class-timetable slots before making a roster request, while the API remains the final authorization authority. ISO date-only weekday resolution uses UTC consistently so deployments in different timezones do not select an adjacent day.

## QR attendance

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/qr/generate` | HOD, authorized Faculty | Create a short-lived QR session for an authorized subject and class period. |
| POST | `/qr/scan` | Student | Validate session state, class, subject, enrollment, expiry, active student state, and duplicate state before recording presence. |
| GET | `/qr/stats` | HOD, authorized Faculty | Read live statistics for an authorized subject session and exact assigned timetable period. |

## Assignment requests

A Faculty member can submit an inability request only for an active class slot that the server confirms is currently assigned to that Faculty member. The request stores the timetable, class, weekday, slot, subject, and original Faculty identifiers immutably, keeps a single pending request per slot, bounds the reason text, and notifies active HOD accounts. Faculty list results are limited to the submitting account’s own requests.

HOD review is institution-wide. Rejection requires a written reason and leaves the timetable unchanged. Acceptance requires an active different Faculty account; the API recalculates exact time/order conflicts at decision time and atomically replaces the slot assignment and closes the pending request. Both outcomes create audit activity and notifications.

QR tokens are cryptographically random and only their SHA-256 digests are stored in MongoDB. The database has a partial unique index for one active session per subject/class/date/period, while scans use atomic attendance upsert and `$addToSet` claim semantics. The client prefers native BarcodeDetector, falls back to jsQR when native detection is unavailable, and always supports manual link entry. Concurrent generation or scanning must still be verified against a disposable MongoDB instance before production use.

## Reports

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/reports/subject/:subjectId?format=pdf|excel` | Faculty scoped, HOD | Export an authorized subject report. |
| GET | `/reports/student/:studentId?format=pdf|excel` | Student self, Faculty scoped, HOD | Export an authorized student report. |
| GET | `/reports/class/:classId/monthly?year=YYYY&month=M&format=pdf|excel` | Faculty scoped, HOD | Export an authorized class monthly report. |

Path and query identifiers are validated as MongoDB ObjectIds before report controllers execute. Filenames are sanitized and report authorization is performed before export generation. Subject and class exports are capped by `MAX_REPORT_ROWS` and return HTTP 413 when the requested synchronous export is too large.

## Direct messaging

All messaging routes require authentication and derive permissions from current MongoDB relationships. Recipients are never accepted from a client-provided role, class, subject, or arbitrary URL.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/messages/recipients?group=all&search=&page=1&limit=25` | Authenticated | Return a bounded safe list of active accounts the current user may message. `group` is validated as `all`, `students`, `faculty`, `hod`, or `tutors` and is applied before pagination. The UI presents HOD with All/Students/Faculty/Tutors tabs and Faculty/Student with All/Students/Faculty/Tutors/HOD tabs. HOD sees active Faculty/Students; Faculty sees active Students in taught/tutored classes, active HODs, assigned tutors, and active Faculty peers; Students see one deterministic active HOD, their class Tutor, teaching Faculty, and active classmates. Students receive one deterministic active HOD and the class’s single active Tutor in their respective groups; other student contacts remain relationship-scoped. Each recipient includes server-derived group and tutor metadata. Search results do not create conversations. |
| GET | `/messages/profiles/:userId` | Authenticated recipient relationship | Return a safe profile for an account the caller is currently allowed to message. HOD receives expanded authorized student attendance details; Faculty profiles include teaching/tutor classes; Student profiles include authorized academic identity fields. Credentials and session/device secrets are never returned. |
| GET | `/messages/conversations?page=1&limit=20` | Authenticated | Return only direct conversations containing the caller, with safe other-participant fields, latest-message metadata, and unread count. |
| POST | `/messages/conversations` | Authenticated | Find or create a direct two-user conversation after rechecking the recipient relationship and active status. Body: `{ "recipientId": "<userId>" }`. |
| GET | `/messages/conversations/:conversationId/messages?page=1&limit=30` | Conversation participant | Return a bounded thread page. Pages are returned oldest-to-newest within each page; only members can read it. |
| POST | `/messages/conversations/:conversationId/messages` | Conversation participant, message limiter | Send one bounded text message. Body: `{ "body": "message text" }`; empty text, media-shaped fields, and relationship changes are rejected. |
| PATCH | `/messages/conversations/:conversationId/messages/:messageId` | Conversation participant, message limiter | Edit only a message sent by the authenticated caller. Body: `{ "body": "updated text" }`; the server records `editedAt`. |
| DELETE | `/messages/conversations/:conversationId/messages/:messageId` | Conversation participant, message limiter | Delete a message with body `{ "mode": "me" }` for the authenticated participant only, or `{ "mode": "everyone" }` for permanent sender-owned deletion. Both modes remove matching notifications and repair the caller’s visible conversation preview; only the sender can use `everyone`. |
| PATCH | `/messages/conversations/:conversationId/read` | Conversation participant | Mark received unread messages as read and synchronize matching message notifications as read. |

Message bodies are trimmed, required, and limited to 5,000 characters. Per-user visibility is stored in `hiddenFor` for Delete from me; Delete from everyone removes the message record after sender ownership and conversation membership checks. There is no image, PDF, video, audio, voice, multipart, external-file, or arbitrary-URL message path. HTTP 400/422 indicates malformed or empty text, 403 indicates relationship or conversation-membership failure, 404 indicates an unavailable conversation/account, and 429 indicates a message rate limit. Notifications use a generic `New message` title/text and metadata containing only `conversationId` and `messageId`. Send, edit, and delete activity is audit logged with recipient/message identifiers, never the message body. Message edits and deletes recheck conversation membership and sender ownership on the server; client controls cannot edit or delete another user’s message.

## Notifications, search, registration requests, and health

Notifications are authenticated and user-scoped. Global search is available to HOD and Faculty and its results navigate to canonical scoped pages rather than being inert. Registration request submission and status checks are public but separately rate-limited and validated. Status references are short enough to type manually but are random, hashed at rest, expiry-enforced, and non-enumerating; review endpoints require HOD.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/registration-requests` | Public, registration limiter | Submit a Student or Faculty request without an applicant-supplied register number or employee ID; only a bcrypt hash is stored. |
| GET | `/registration-requests/status?code=AR-7K4P-92XM` | Public, status limiter | Return status using a short, expiring reference; approved requests include the HOD-assigned identifier. Existing `requestId` + `statusToken` private links remain accepted during migration. |
| GET | `/registration-requests` | HOD | List reviewable requests without credential fields or applicant identifiers. |
| POST | `/registration-requests/:id/approve` | HOD | Approve with `{ identifier }`, check the role-specific register number or employee ID for uniqueness, create the account, store the assigned identifier on the processed request, and remove the processed password hash. |
| POST | `/registration-requests/:id/reject` | HOD | Reject a request with a required 5–500 character reason and remove its stored credential hash. |
| GET | `/health` | Public | Liveness-only process response. |
| GET | `/ready` | Public | Returns 200 when MongoDB is ready; in production also requires configured Redis to be connected. Development Redis is optional. |

## Seed and raw timetable identity verification

The Smart Seed writes timetables through a native MongoDB collection update, so it assigns each generated slot a real deterministic ObjectId before the write and reads the raw documents back before reporting success. The generated identity is stable for the same class/day/order coordinate across repeat seeds. The permanent audit prints `Missing slot IDs: N` and exits nonzero for missing, invalid, or duplicate raw slot IDs, while `diagnose:timetable-ids` prints the raw timetable ID, class interpretation, per-day slot IDs, and integrity counts.

```bash
cd server
npm run validate:timetables
DIAGNOSTIC_TIMETABLE_IDS='<classId>,<timetableId>' npm run diagnose:timetable-ids
```

The class ID belongs in `/api/timetables/:classId`, while `excludeTimetableId` and `slotId` must come from that freshly loaded persisted timetable response. The save endpoint does not trust a client-supplied exclusion; it resolves the active timetable by `classId` and excludes the resulting Mongo `_id` itself. Never substitute a class ID for the timetable document ID, invent a temporary slot ID, or remove `slotId` or conflict validation. With `DEBUG_TIMETABLE_CONFLICTS=true`, save diagnostics report `internalConflictCount`, `externalConflictCount`, first examples, exact time ranges, Faculty IDs, conflicting timetable/class IDs, and whether a conflicting document matches the active timetable.

## Faculty attendance period scope

`GET /api/periods/:day?classId=<classId>` remains the same authenticated read route. When the caller is Faculty and the class has an active class timetable, the response is scoped to class slots whose `kind` is `class` and whose persisted `subject` and `faculty` match the relevant assignment; breaks, free periods, other subjects, and other Faculty assignments are not offered as attendance choices. HOD and Student schedule reads retain their existing class-schedule behavior. `GET /api/attendance/session-roster` and attendance marking continue to re-resolve the subject’s class, UTC date weekday, subject slot, and exact Faculty assignment server-side. The client also filters the returned class timetable by subject and current Faculty, waits for the period list before requesting a roster, ignores stale selections, and shares identical in-flight reads during React StrictMode. The server’s HTTP 403 response remains the correct protection for a manually forged or stale subject/period pair.

## Rate limits and errors

Sensitive endpoints have independent configurable limits, including authenticated user-aware QR, attendance-submission, and message-send limits with IP fallback. When `REDIS_URL` is configured, the limiters share counters through Redis across all API instances. Without Redis, the memory store is a development/test fallback. Errors include request IDs for diagnostics; sensitive values are not included in error messages or logs. Timetable occupancy conflicts return code `TIMETABLE_CONFLICT` and a safe detail array naming the Faculty member, current and conflicting class/timetable/slot identifiers, day, period, and both time ranges when available; no stack trace or database internals are exposed. The optional `DEBUG_TIMETABLE_CONFLICTS=true` server setting emits bounded structured conflict diagnostics for staging investigation only. The machine-readable contract is [docs/openapi.yaml](./docs/openapi.yaml). Avatar updates must use the validated ImageKit upload URL; direct arbitrary origins are rejected. HOD Students and Faculty directories, Faculty assigned-student history, and notification consumers use bounded server pagination. CI is defined in `.github/workflows/ci.yml`.

## Role requirements

Student accounts are bound to one opaque browser device identifier sent in `X-Device-Id`; only its SHA-256 hash is stored. Authorized HOD users can reset a student binding, which revokes that student’s sessions. Faculty and management accounts remain multi-device. The backend never trusts frontend role state. Every protected route verifies the bearer token, loads the current user, checks active state, token version, and student device binding, applies the route role gate, validates identifiers, and performs resource-level checks where a path, query, request body, attendance record, subject, class, report, or QR token identifies a resource.

## References

[1]: ./SECURITY_AUDIT.md "Security audit"
[2]: ./ARCHITECTURE.md "Architecture overview"
[3]: ./README.md "Project README"
