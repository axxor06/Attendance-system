# Attendance Register Production Checklist

This checklist is the release gate for moving Attendance Register from development or staging into production. It assumes the existing modular monolith, REST API, MongoDB models, refresh-session flow, QR attendance, reports, and dashboards remain in use.

## Security and secrets

| Check | Required action | Status |
|---|---|---|
| Application mode | Set `NODE_ENV=production`; confirm seed and migration scripts cannot run accidentally | [ ] |
| JWT secrets | Generate two different high-entropy secrets and store them in the deployment secret manager | [ ] |
| Database | Use an authenticated, TLS-enabled, network-restricted MongoDB deployment with least-privilege credentials | [ ] |
| Redis | Configure a shared authenticated/TLS Redis deployment for all API instances | [ ] |
| SMTP | Configure a production SMTP provider, sender identity, and delivery monitoring | [ ] |
| CORS | Set `CLIENT_URL` and `ALLOWED_ORIGINS` to exact HTTPS origins; remove development LAN placeholders | [ ] |
| Cookies | Set `REFRESH_COOKIE_SECURE=true`; use an intentional SameSite policy and review domain/path settings | [ ] |
| Proxy trust | Set `TRUST_PROXY_HOPS` to the exact trusted proxy count; do not use blanket proxy trust | [ ] |
| Environment files | Ensure `.env`, `.env.local`, logs, real credentials, and build output are not committed or packaged | [ ] |
| Migration | If upgrading a legacy database, run the guarded credential and canonical-role migrations against a verified backup; review ambiguous legacy `admin` records | [ ] |
| Startup security gate | Confirm production refuses weak/placeholder or reused JWT secrets, missing shared Redis, insecure cookies, enabled LAN origins, disabled rate-limit bypasses, invalid proxy hops, and non-HTTPS origins before accepting traffic | [ ] |
| HTTP lifecycle limits | Confirm request, header, keep-alive, and shutdown timeout values remain within the documented 1,000–120,000 ms bounds and slow/incomplete clients are terminated safely | [ ] |
| Browser capability policy | Confirm production responses include Helmet protections, HSTS, CSP, and the restrictive Permissions-Policy; verify the deployed CSP still permits the client and configured image origin | [ ] |
| Safe structured logs | Confirm access logs contain request IDs, method, route path, status, duration, and response size without query strings, request bodies, cookies, or user-agent data; confirm API errors are metadata-only | [ ] |
| Response compression | Confirm representative directory/report responses over 1 KB negotiate compression at the reverse proxy or application layer without compressing incompatible responses twice | [ ] |
| Actionable error boundary | Send malformed JSON, oversized JSON, duplicate email/identifier, and unexpected multipart-field requests; confirm safe status codes and actionable messages without database/provider details | [ ] |
| JWT algorithm policy | Confirm issued access and refresh tokens use HS256 and tokens signed with an unexpected algorithm are rejected | [ ] |
| Critical body contracts | Send extra fields to authentication, registration, account-management, HOD review, profile, and message mutation endpoints; each request is rejected without changing state | [ ] |
| Cookie CSRF boundary | Send refresh/logout requests with an unexpected Origin or `Sec-Fetch-Site: cross-site`; the request is rejected and no session state changes | [ ] |

## Role and authorization verification

The API must be tested with separate canonical accounts for HOD (`super_admin`), Faculty (`admin`), and Student (`user`). The client must not be the only test mechanism; issue direct API requests as well. HOD institution-wide authority, Faculty assignment scope, Student self-only access, and the ambiguous legacy-admin migration refusal must be verified independently.

| Scenario | Expected result | Status |
|---|---|---|
| HOD creates Faculty/Student accounts | Allowed and audited | [ ] |
| Faculty creates or modifies institution accounts | Denied | [ ] |
| Faculty mutates departments, semesters, classes, subjects, or period templates | Denied | [ ] |
| HOD manages another HOD account through the managed-user endpoint | Denied; self/protected-role guard remains active | [ ] |
| HOD lists users, classes, subjects, departments, registrations, reports, and Tutors | Institution-wide authorized scope returned; Tutors are derived from active class-teacher assignments | [ ] |
| Faculty lists assigned students | Only active students derived from assigned subjects/classes returned | [ ] |
| Faculty accesses an unassigned subject/class/student | Denied | [ ] |
| HOD starts a text conversation with active Faculty/Student | Allowed; recipient is server-derived and the send is audited without message content | [ ] |
| Faculty starts a text conversation with a Student outside taught/tutored classes | Denied; recipient is absent from discovery and direct create/send returns 403 | [ ] |
| Student sends text to HOD, teaching Faculty, or active classmate | Allowed only for current active relationships | [ ] |
| Student sends text to unrelated Faculty/student or inactive account | Denied and not returned by recipient discovery | [ ] |
| Non-member reads or sends to another conversation ID | Denied with no message metadata disclosure | [ ] |
| Authorized chat profile | HOD can view the authorized profile details available for the selected Faculty/Student; Faculty/Student see only relationship-authorized academic details; no password, hash, OTP, refresh token, or device hash appears | [ ] |
| Message delivery ticks | Sender sees double grey checks after send; they become double blue checks only after the recipient opens/reads the thread | [ ] |
| Message composer keyboard behavior | Enter sends once; Shift+Enter inserts a line break; IME composition is not submitted prematurely | [ ] |
| Student changes a student ID in attendance/report URLs | Denied | [ ] |
| Ambiguous legacy `admin` account signs in before reviewed migration | Denied with migration-required response | [ ] |
| Deactivated user uses existing access token | Denied | [ ] |
| Password or role change uses old access/refresh tokens | Denied; sessions revoked | [ ] |
| HOD creates a student with an initial password | Student can log in once, receives first-login signal, must change password, then reaches dashboard | [ ] |
| HOD creates a student without an initial password | No hidden password is stored; one-time setup code is emailed; delivery failure rolls back account and OTP | [ ] |

## Authentication and abuse controls

Confirm that login, refresh, OTP generation, OTP verification, password reset, password change, QR scanning, attendance submission, registration submission, registration status, and general API rate limits are active. Confirm `REFRESH_ROTATION_GRACE_MS` is short and documented. In a two-tab test, concurrent refresh races must not revoke an otherwise active family. In a multi-instance deployment, confirm that counters are shared through Redis rather than process memory.

| Scenario | Expected result | Status |
|---|---|---|
| Repeated invalid login for one account | Progressive lock and HTTP 429 with bounded `Retry-After` | [ ] |
| Successful login after failure window | Failure state clears | [ ] |
| OTP wrong code attempts exceed cap | Verification stops; record cannot be brute-forced indefinitely | [ ] |
| OTP expires or is reused | Rejected | [ ] |
| Registration status with email only | Rejected; no email enumeration | [ ] |
| Registration status with short, malformed, wrong, reused, or expired reference | Generic no-match response or controlled validation/expiry error; no CastError or internal error | [ ] |
| HOD reset | Authorized HOD receives a cryptographically random permanent password once; it is not emailed, logged, or stored in plaintext; active sessions are revoked and no forced first-login change is set | [ ] |
| Ten expired API requests | Exactly one frontend refresh request; all original requests retry with the new access token | [ ] |
| Two tabs refresh the same token at nearly the same time | Legitimate short race does not unnecessarily revoke the active family | [ ] |
| Refresh token reuse outside the grace window | Entire refresh family revoked | [ ] |
| HOD registration decision race | Submit approval and rejection concurrently for one pending request; exactly one terminal transition succeeds and the other returns a controlled conflict | [ ] |
| Attendance submission burst | Dedicated authenticated user-aware limiter returns HTTP 429 after its configured threshold | [ ] |
| Message send burst | Dedicated authenticated user-aware message limiter returns HTTP 429 after its configured threshold | [ ] |
| HOD People sorting/filtering | Student department/semester and name/department/semester/class sorting are server-backed, stable across pagination, and reject unknown query fields | [ ] |
| HOD Tutors directory | Tutors view shows every active class tutor, assigned class names/IDs, and updates after tutor reassignment without exposing unrelated Faculty | [ ] |
| Unknown password-reset email | Generic response | [ ] |

## Messaging verification

Use separate HOD, Faculty, and Student accounts against a disposable replica-set-capable staging database. Verify direct API calls in addition to the browser UI.

| Scenario | Expected result | Status |
|---|---|---|
| Recipient discovery | Each role receives only its documented active relationship scope, with bounded search/pagination and safe fields | [ ] |
| Relationship change after conversation exists | A deactivated recipient or removed teaching/class relationship cannot receive another text message; existing thread reads remain member-scoped | [ ] |
| Direct conversation creation | Repeated requests return one canonical two-participant conversation; HOD-to-HOD and self messaging are rejected | [ ] |
| BOLA thread attempt | A third account cannot list messages, mark read, or send using a guessed conversation ID | [ ] |
| Text validation | Valid text persists in MongoDB; empty, whitespace-only, over-5,000-character, and media-shaped payloads fail | [ ] |
| Read/unread | Recipient conversation count increments after send, opening or polling the thread marks received messages read, and sender’s own messages do not count unread | [ ] |
| Notifications/audit | Recipient gets generic notification metadata with only conversation/message IDs; audit record contains no body or secrets | [ ] |

## Attendance and QR verification

Use a disposable staging database and multiple browser/device sessions for concurrency checks. The result must be enforced by the API and database indexes, not merely by UI state.

| Scenario | Expected result | Status |
|---|---|---|
| Duplicate attendance coordinate | Unique constraint or safe conflict; no duplicate record | [ ] |
| Concurrent QR scans by the same student | One attendance record and one successful claim | [ ] |
| Expired QR token | Rejected | [ ] |
| QR token for another class/subject/period | Rejected | [ ] |
| Student outside subject roster | Rejected | [ ] |
| Inactive student/subject/session | Rejected | [ ] |
| Second active QR session for same coordinate | Older session deactivated or unique conflict handled safely | [ ] |
| Attendance edit outside allowed relationship | Denied | [ ] |
| Faculty marks or generates QR for another period of an assigned subject | Denied; exact class-timetable slot ownership is required | [ ] |
| Faculty QR or attendance period selector with an unrelated subject | Unrelated periods are not offered; no generic invalid-period request is sent | [ ] |
| ISO date-only attendance request in a non-UTC deployment | Same calendar date resolves to the intended weekday and class timetable | [ ] |
| Faculty inability request for another Faculty’s slot, break, stale timetable, or duplicate pending slot | Denied or safely conflicted; no request is created | [ ] |
| HOD rejects an inability request | Rejection reason is required; timetable assignment remains unchanged; original Faculty is notified | [ ] |
| Student, Faculty, and HOD leave histories | Pending, Approved, and Rejected sections are present; decided requests show reviewer and decision date, with rejection reason when applicable | [ ] |
| HOD accepts an inability request with a busy/inactive/invalid replacement | Denied at decision time; request and timetable remain unchanged | [ ] |
| HOD accepts an inability request with a free replacement | Timetable replacement and request closure commit atomically; both Faculty members are notified and audit activity is recorded | [ ] |
| Timetable Faculty availability query fails | UI fails closed and says availability could not be checked; it does not label every Faculty member busy | [ ] |
| Timetable save collides with an occupied Faculty assignment | HTTP 409 identifies Faculty, day, period, and time where available; UI shows the actionable conflict | [ ] |
| Existing QR duplicate records before index build | Identified and resolved before migration | [ ] |
| Existing message indexes | `Conversation.participantKey`, participant/last-message, thread order, and unread recipient/read state indexes are present | [ ] |

## Database, indexes, and performance

Review the indexes in the Mongoose models against the actual production query plans. Confirm that pagination limits, report row caps, and request body limits are suitable for the institution’s data size. Run representative dashboard, search, attendance-history, and report queries with profiling enabled in staging.

Backups must be automated, encrypted, retention-controlled, and periodically restored into an isolated environment. MongoDB health, replication, storage, slow queries, and connection pool pressure require alerts. Redis health, memory policy, connection errors, and rate-limit fallback events require alerts.

## Frontend and LAN-to-production transition

Before production, remove LAN placeholders from both environment files. The client must point to the production API origin, and the API must allow only the production HTTPS origin. Confirm refresh cookies work in the final browser deployment, including login, refresh, logout, password change, and session invalidation.

For development-only LAN testing, use `ALLOW_LAN_ORIGINS=true`, HTTP `lax` cookies, `VITE_API_BASE_URL=http://<PC-LAN-IP>:5000/api`, and Windows Firewall rules scoped to the Private profile. Never carry those settings into production. The Windows Firewall must not be disabled.

Run keyboard and responsive checks for desktop, tablet, narrow mobile, and TV-sized widths. Confirm visible focus rings, modal focus trapping, Escape/backdrop dismissal, outside-touch closing for action menus, readable status contrast, usable horizontal table scrolling, reduced-motion behavior, empty states, loading states, error recovery, and no duplicate StrictMode/polling requests.

## Verification commands

Run these commands from a clean checkout before packaging or deployment. The messaging staging matrix above remains required because static tests cannot prove database relationships, notification delivery, read-state transitions, or live BOLA behavior:

```bash
cd server
npm ci --no-audit --no-fund
while IFS= read -r file; do node --check "$file"; done < <(find src -type f -name '*.js' -print | sort)
npm test

cd ../client
npm ci --no-audit --no-fund
npm run lint
npm run build
```

Add database-backed integration tests to the deployment run. Static scans should check for real environment files, secrets, password or OTP logging, hidden/temporary-password responses, browser token persistence, unsafe HTML injection, and accidental build/node_modules packaging. Validate the OpenAPI contract and confirm no legacy release branding remains. Confirm `GET /api/health` reports Redis state and that a development instance starts with Redis absent/unavailable when MongoDB is available. Confirm the seed uses canonical roles, ten departments, eight semesters, up to 80 classes, a 20-Faculty-per-department target, 55–60 Students per generated class, five subjects per class, deterministic generation, conflict-free Monday–Saturday timetables, preservation of existing records, rejection of conflicting class/subject relationships, and a bounded MongoDB connection timeout; profile URLs are restricted to configured ImageKit storage; unchanged legacy avatars do not block contact edits; and Students, Faculty, assigned-student, and notification histories use server-backed pagination. Run the assignment-request and exact-slot attendance scenarios above against a replica-set-capable staging MongoDB.

## Rollout and rollback

Deploy the API and client from the same reviewed commit. Verify `/api/health` and `/api/ready`, log in with a non-privileged staging account, perform a refresh, exercise one scoped dashboard, and confirm logs contain request IDs without secrets. Monitor 4xx/5xx rates, login locks, refresh reuse events, rate-limit errors, MongoDB latency, Redis availability, email delivery, and report duration.

Keep the previous application image and configuration available for rollback. Database schema/index migrations must be backward-compatible or have a documented rollback plan. If an authorization regression is suspected, stop writes or route traffic to the previous known-good build while preserving audit logs and investigating the affected data scope.

## Deployment sign-off

A deployment owner, security reviewer, database owner, and operations owner should sign off the checklist. No production deployment is complete until all required authorization, session, QR, backup-restore, and observability checks are marked complete.

## References

[1]: ./SECURITY_AUDIT.md "Security audit"
[2]: ./ARCHITECTURE.md "Architecture overview"
[3]: ./README.md "Local, LAN, firewall, and production setup"
[4]: ./server/src/utils/authorization.js "Central authorization scope helpers"
[5]: ./server/src/controllers/authController.js "Authentication and refresh-session flow"


## Availability-specific staging verification

Run these checks against a disposable, clean, backup-verified MongoDB database after seeding. Record the actual values returned by the API for each selected class, subject, day, and time range.

| Scenario | Required evidence | Status |
|---|---|---:|
| Availability success | `GET /api/timetables/availability` returns a safe Faculty list and `availableFacultyCount`; the UI transitions from `Checking availability…` to the same real options. | [ ] |
| Availability empty | The API returns `eligibleFacultyCount > 0`, `busyFacultyCount == eligibleFacultyCount`, and `availableFacultyCount == 0`; the UI says `No Faculty available for this period` and explains that eligible Faculty are occupied. | [ ] |
| Availability error | Force 401, 403, 404, 409, 422, 429, 500, and a network failure; each request terminates with a safe actionable message and never leaves the selector loading. | [ ] |
| Exact-slot scope | A Faculty assigned Monday Period 1 remains available Monday Period 2 and Tuesday Period 1; a conflicting same-day/time assignment is omitted. The check compares persisted `candidate.faculty` with each candidate Faculty; the hypothetical requested slot is not required to contain a Faculty. | [ ] |
| Department scope | Faculty from another department are not returned, and a direct save attempt using one is rejected server-side. | [ ] |
| Subject context | A supplied subject must be active and belong to the selected class; malformed or mismatched subject IDs are rejected without exposing database details. | [ ] |
| Stale request | Change class, subject, day, or period while a request is delayed; the old response cannot overwrite the current state. | [ ] |
| Faculty period scope | As Faculty, load a class day and confirm `/api/periods/:day?classId=...` returns only class slots whose subject and persisted Faculty match the logged-in Faculty; other Faculty’s slots, breaks, and free periods are not offered. | [ ] |
| Pending-link scope | Confirm the Faculty dashboard pending list contains only subject/day/period combinations owned by that Faculty in the exact class timetable. Opening each link must select a valid period without a roster 403. | [ ] |
| Roster request ordering | Open a dashboard deep link with a period query parameter and throttle the period response; no `session-roster` request is sent until the matching subject/F faculty period is loaded. A non-matching period is cleared rather than requested. | [ ] |
| StrictMode duplicate reads | In a React StrictMode development build, reload Faculty attendance and confirm identical `my-subjects`, class-period, and session-roster reads are single-flight rather than duplicate network requests. | [ ] |
| Save authority | Two simultaneous saves attempting the same Faculty/day/time produce one valid write and one safe HTTP 409 conflict; the server remains authoritative even if the UI list is stale. | [ ] |
| Seed workload | Record Faculty/class/subject ratios and per-department/day/period eligible, busy, and available counts. Confirm the workload-balanced generator preserves no-double-booking and avoids unnecessary Faculty concentration. | [ ] |
| Raw slot-ID persistence | Immediately after seed, inspect raw `timetables.days[].slots[]` in MongoDB; every slot has a unique 24-hex ObjectId, with `Missing slot IDs: 0`, invalid `0`, and duplicate `0`. | [ ] |
| Repeat-seed stability | Run the seed twice and confirm the same class/day/order coordinates retain the same slot IDs; no temporary frontend IDs or class IDs appear in slot identity fields. | [ ] |
| GET-to-raw identity | For representative classes, the raw timetable `_id` and every nested raw slot `_id` equal the IDs returned by `GET /api/timetables/:classId`. | [ ] |
| Exact availability success | For every representative current class slot, send `classId`, the returned `excludeTimetableId`, exact `slotId`, day/order/time, and active subject context; valid requests return HTTP 200. | [ ] |
| Stale-slot rejection | Send a deliberately stale, missing, or cross-class `slotId`; the API returns HTTP 400 with the exact stale-slot message and the UI does not bypass or hide it. | [ ] |
| Unchanged full-week save | Submit the freshly loaded timetable unchanged; the API returns HTTP 200 and the timetable remains intact after reload. | [ ] |
| Available-Faculty save | Assign a genuinely available Faculty member and save; the API returns HTTP 200, the assignment persists, and a reload returns the same persisted slot IDs and assignment. | [ ] |
| Occupied-Faculty save | Assign a truly occupied Faculty member; the API returns HTTP 409 with `TIMETABLE_CONFLICT` and exact Faculty/class/day/period/time details. | [ ] |
| Conflict-source diagnosis | With `DEBUG_TIMETABLE_CONFLICTS=true`, record `internalConflictCount`, `externalConflictCount`, first internal/external conflict, active timetable ID, conflicting timetable/class IDs, Faculty ID, slot IDs, and both exact time ranges. Confirm a self-conflict has neither an active-timetable match nor a same-class external record. | [ ] |
| Same-timetable edit | Edit a timetable while retaining its own existing Faculty assignments; they produce zero external conflicts, while two overlapping assignments for the same Faculty in the submitted week still produce an internal HTTP 409. | [ ] |
| Cross-class conflict | Use the same Faculty in another class at the same time; availability omits that Faculty and a manually submitted save returns HTTP 409. The same Faculty at a different time remains allowed. | [ ] |
| Academic Management counts | Open all 10 departments and 80 class panels; every subject badge matches a server-derived subject count, and no class shows a false zero because the first subject page contained no matching records. | [ ] |
| Faculty directory All Departments | Open HOD Faculty and confirm the default dropdown value is All Departments, the paginated total includes every active Faculty, and changing to each department sends a server-backed filter without loading an unrestricted client directory. | [ ] |
| Faculty directory filtered search | Combine a department selection with name/email/employee-ID search, move between pages, and confirm results, totals, empty state, and summary counts all reflect the same server-side filter. | [ ] |
| Timetable clarity | Verify desktop and mobile HOD timetable views show readable day cards with slot counts, distinct slot sections, visible type/subject/Faculty/time/note labels, and no horizontal overflow beyond the intended table/card containers. | [ ] |

Use the following post-seed evidence commands and retain their output with the release record:

```bash
cd server
npm run validate:timetables
DIAGNOSTIC_TIMETABLE_IDS='<classId>,<timetableId>' npm run diagnose:timetable-ids
```

The exact API proof should record the selected Faculty directory query, including omitted department for All Departments and the selected department ObjectId for filtered results. It should also record the class ID used in `/api/timetables/:classId`, the separate persisted timetable ID returned in `data.timetable._id`, and the exact nested `slotId` used in availability. For PUT, record the complete seven-day payload received by the server and the `DEBUG_TIMETABLE_CONFLICTS` summary. Do not replace either persisted identity with a class ID, a generated browser ID, or a value reconstructed from day/order. A clean source build or mock browser run cannot prove raw Mongo persistence or the live HTTP 200/409 flows.

The current sandbox has mock-backed browser evidence for success, empty, and API-error states. The v28.1 static suite also covers strict body contracts, Fetch Metadata cookie protection, pinned JWT algorithms, fail-closed production configuration including cookie and HTTP lifecycle validation, canonical legacy-role migration guards, shared academic identifier validation, atomic registration rejection, structured security headers/logging, safe duplicate/malformed-body errors, and visibility-aware Messages polling. Source and contract tests also cover exact Faculty period scoping, pending-link filtering, request ordering, and duplicate-read sharing. MongoDB, Redis, SMTP, deployed HTTPS, real seed execution, concurrent database writes, raw slot-ID persistence, exact availability, unchanged saves, available-Faculty saves, occupied-Faculty HTTP 409 behavior, messaging relationships, text persistence, BOLA attempts, read/unread state, notification delivery, and real authentication sessions remain **UNVERIFIED** until this staging checklist is completed.
