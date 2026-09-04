# Attendance Register v28.1 Verification Report

## Scope

Version 28.1 is the permitted follow-up patch to Attendance Register v28. It applies a targeted production-readiness and reliability pass to the existing MERN application without removing working pages, routes, roles, permissions, academic workflows, attendance behavior, timetable behavior, or the server-derived Messages relationship model.

The patch was intentionally limited to issues that could be verified from the source and existing test contracts. It does not claim a production security score that would require live infrastructure or authenticated multi-device testing.

## Implemented changes

| Area | Result |
|---|---|
| HTTP lifecycle | The Node HTTP server now applies bounded request, header, keep-alive, and shutdown timeouts. Timeout overrides are documented in `server/.env.example` and production configuration rejects values outside the 1,000–120,000 millisecond range. |
| Security headers | Helmet protections remain enabled; production HSTS/CSP behavior is preserved and an explicit restrictive `Permissions-Policy` disables camera, microphone, geolocation, payment, and USB capabilities that the API does not use. |
| Error handling | Malformed JSON, oversized request bodies, unexpected multipart files, and common duplicate records now receive safe structured responses with actionable status codes and messages. Database values and provider details are not returned to clients. Client connection-refused, timeout, unreachable, and request-only failures now map to an actionable connection message instead of a generic server error. |
| Observability | Access logs are compact JSON records containing request ID, method, route path, status, duration, and response size without query strings, request bodies, cookies, or user-agent data. API and activity-log failure logs are metadata-only and API error paths exclude query strings. |
| Startup behavior | MongoDB startup failures now propagate as safe initialization errors to the server entrypoint rather than exiting inside the database module. Redis startup errors are normalized and avoid raw provider messages in logs. |
| Rate limiting | Rate-limit window and maximum values are bounded when read from environment variables, preventing malformed configuration from creating invalid middleware or weakening abuse controls. |
| Performance | Response compression is enabled for payloads above 1 KB. Messages conversation polling pauses while the document is hidden and refreshes on visibility return, reducing unnecessary background requests. |
| Authentication lifecycle | The client refresh interceptor now checks the authentication epoch before invalidating a session after a concurrent terminal refresh failure, preventing a stale failure from invalidating a newer local session. HOD-managed reset credentials expire within a bounded TTL, expired credentials are rejected, and the server permits only the authenticated change-password route until the user completes the change. Single-flight refresh, StrictMode-safe bootstrap, rotation, reuse detection, and family revocation remain intact. |
| Existing security model | Role-based access control, object-level authorization, relationship-derived messaging recipients, text-only MongoDB messages, per-user message deletion, sender-only global deletion, timetable conflict validation, exact attendance/QR slot checks, upload validation, device binding, OTP/reset controls, and safe projections were preserved. |

## Existing workflow verification

The v28 workflow protections were re-audited rather than rewritten. The new HOD reset path is also server-gated: a temporary-password account cannot use other protected resources until Change Password succeeds. HOD, Faculty, and Student route boundaries remain server-enforced. Timetable availability continues to use the selected class and persisted timetable identity, excludes the exact edited timetable, omits occupied Faculty, and returns structured conflict details. Faculty attendance and QR selectors remain restricted to exact subject/Faculty timetable slots. Messages continues to show existing conversations by default, while authorized recipient search is available only after the user explicitly opens Add chat; searching alone never creates a conversation.

The Smart Seed remains guarded against production execution, requires strong seed credentials, preserves existing records, uses canonical roles, maintains relationship references, generates real nested slot IDs, validates generated and read-back timetable conflicts, and reports totals. Live database execution was not available in this sandbox and is not claimed below.

## Automated verification

| Gate | Result |
|---|---:|
| Server Node test suite | **78 passed, 0 failed** |
| Client Node test suite | **32 passed, 0 failed** |
| Server source syntax checks | **Passed for all `server/src/**/*.js` files** |
| Client lint | **0 warnings, 0 errors** |
| Client production build | **Passed** |
| Server dependency audit | **0 vulnerabilities at high threshold** |
| Client dependency audit | **0 vulnerabilities at high threshold** |
| OpenAPI validation | **Passed; 54 documented paths** |
| Timetable validation guard | **Passed safety check: refuses to run without `MONGO_URI`** |
| Timetable ID diagnosis guard | **Passed safety check: refuses to run without `MONGO_URI`** |
| Unsafe client HTML scan | **No `dangerouslySetInnerHTML` or `innerHTML` in client source** |
| Source packaging scan | **Passed after independent extraction and exclusion checks** |

## Packaging

The final patch archive is source-only and uses the consistent v28.1 naming policy:

- Archive filename: `attendance-register-v28.1.zip`
- Archive root directory: `attendance-register-v28.1`
- Client package: `attendance-register-client`, version `28.1.0`
- Server package: `attendance-register-server`, version `28.1.0`
- Active verification filename: `verification/V28_1_VERIFICATION_REPORT.md`

The archive excludes `node_modules`, client build output, coverage, `.git`, real `.env` files, credentials, logs, and temporary generated artifacts. Safe `.env.example` files remain included.

## Staging boundary

The following scenarios remain **UNVERIFIED** because they require live infrastructure or authenticated sessions: MongoDB persistence and duplicate-index behavior, Redis-backed multi-instance rate limits, SMTP delivery and reset flows, ImageKit uploads with real credentials, HOD/Faculty/Student browser login, refresh-token rotation and reuse-family revocation, concurrent database writes, cross-device Student binding, timetable save races, QR replay/concurrent scans, message relationship changes and BOLA attempts, read-state/notification delivery, backup restoration, deployed HTTPS cookies/CSP/HSTS, reverse-proxy trust, and production query plans.

These scenarios must be executed against a disposable, backup-verified staging environment using `PRODUCTION_CHECKLIST.md` before production deployment. The report therefore records verified implementation and static/contract evidence without claiming that source-only validation substitutes for live end-to-end proof.
