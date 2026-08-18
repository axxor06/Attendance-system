# Production Checklist — Attendance Register v6

This checklist is the release gate for moving Attendance Register v6 from development or staging into production. It assumes the existing modular monolith, REST API, MongoDB models, refresh-session flow, QR attendance, reports, and dashboards remain in use.

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
| Migration | If upgrading a legacy database, run the guarded registration credential migration against a verified backup and rotate affected credentials | [ ] |

## Role and authorization verification

The API must be tested with separate accounts for `SUPER_ADMIN`, `ADMIN`, two HODs in different departments, faculty in each department, and students in each class. The client must not be the only test mechanism; issue direct API requests as well.

| Scenario | Expected result | Status |
|---|---|---|
| SUPER_ADMIN creates ADMIN | Allowed and audited | [ ] |
| ADMIN creates ADMIN | Denied | [ ] |
| ADMIN modifies ADMIN or SUPER_ADMIN | Denied | [ ] |
| HOD creates ADMIN or SUPER_ADMIN | Denied | [ ] |
| HOD modifies another HOD | Denied | [ ] |
| HOD creates faculty/student in own department | Allowed | [ ] |
| HOD creates or assigns a resource in another department | Denied | [ ] |
| HOD lists users, classes, subjects, departments, registrations, and reports | Only own department/class scope returned | [ ] |
| HOD changes a department/class/subject/report ID to another department | Denied or not found; no data returned | [ ] |
| Faculty accesses an unassigned subject or unrelated student | Denied | [ ] |
| Student changes a student ID in attendance/report URLs | Denied | [ ] |
| Deactivated user uses existing access token | Denied | [ ] |
| Password or role change uses old access/refresh tokens | Denied; sessions revoked | [ ] |

## Authentication and abuse controls

Confirm that login, refresh, OTP generation, OTP verification, password reset, registration submission, registration status, and general API rate limits are active. In a multi-instance deployment, confirm that counters are shared through Redis rather than process memory.

| Scenario | Expected result | Status |
|---|---|---|
| Repeated invalid login for one account | Progressive lock and HTTP 429 with bounded `Retry-After` | [ ] |
| Successful login after failure window | Failure state clears | [ ] |
| OTP wrong code attempts exceed cap | Verification stops; record cannot be brute-forced indefinitely | [ ] |
| OTP expires or is reused | Rejected | [ ] |
| Registration status with email only | Rejected; no email enumeration | [ ] |
| Registration status with invalid request ID/token | Generic no-match response or validation error | [ ] |
| Administrator reset | OTP sent; no password returned or emailed; reset required until completion | [ ] |
| Refresh token reuse | Entire refresh family revoked | [ ] |
| Unknown password-reset email | Generic response | [ ] |

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
| Existing QR duplicate records before index build | Identified and resolved before migration | [ ] |

## Database, indexes, and performance

Review the indexes in the Mongoose models against the actual production query plans. Confirm that pagination limits, report row caps, and request body limits are suitable for the institution’s data size. Run representative dashboard, search, attendance-history, and report queries with profiling enabled in staging.

Backups must be automated, encrypted, retention-controlled, and periodically restored into an isolated environment. MongoDB health, replication, storage, slow queries, and connection pool pressure require alerts. Redis health, memory policy, connection errors, and rate-limit fallback events require alerts.

## Frontend and LAN-to-production transition

Before production, remove LAN placeholders from both environment files. The client must point to the production API origin, and the API must allow only the production HTTPS origin. Confirm refresh cookies work in the final browser deployment, including login, refresh, logout, password change, and session invalidation.

For development-only LAN testing, use `ALLOW_LAN_ORIGINS=true`, HTTP `lax` cookies, `VITE_API_BASE_URL=http://<PC-LAN-IP>:5000/api`, and Windows Firewall rules scoped to the Private profile. Never carry those settings into production. The Windows Firewall must not be disabled.

Run keyboard and responsive checks for desktop, tablet, and narrow mobile widths. Confirm visible focus rings, modal focus trapping, Escape/backdrop dismissal, readable status contrast, usable horizontal table scrolling, reduced-motion behavior, empty states, loading states, and error recovery.

## Verification commands

Run these commands from a clean checkout before packaging or deployment:

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

Add database-backed integration tests to the release run. Static scans should check for real environment files, secrets, password or OTP logging, temporary-password responses, browser token persistence, unsafe HTML injection, and accidental build/node_modules packaging.

## Rollout and rollback

Deploy the API and client from the same reviewed commit. Verify `/api/health` and `/api/ready`, log in with a non-privileged staging account, perform a refresh, exercise one scoped dashboard, and confirm logs contain request IDs without secrets. Monitor 4xx/5xx rates, login locks, refresh reuse events, rate-limit errors, MongoDB latency, Redis availability, email delivery, and report duration.

Keep the previous application image and configuration available for rollback. Database schema/index migrations must be backward-compatible or have a documented rollback plan. If an authorization regression is suspected, stop writes or route traffic to the previous known-good build while preserving audit logs and investigating the affected data scope.

## Release sign-off

A release owner, security reviewer, database owner, and operations owner should sign off the checklist. No production release is complete until all required authorization, session, QR, backup-restore, and observability checks are marked complete.

## References

[1]: ./SECURITY_AUDIT.md "v6 security audit"
[2]: ./ARCHITECTURE.md "v6 architecture"
[3]: ./README.md "Local, LAN, firewall, and production setup"
[4]: ./server/src/utils/authorization.js "Central authorization scope helpers"
[5]: ./server/src/controllers/authController.js "Authentication and refresh-session flow"
