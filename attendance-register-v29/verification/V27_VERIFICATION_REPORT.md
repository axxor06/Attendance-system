# Attendance Register v27 Verification Report

## Scope

This report records the v27 changes applied to the v26.1 source. The release removes applicant-controlled Student register numbers and Faculty employee IDs from public registration, adds HOD-assigned identifiers and reasoned rejection, adds secure direct-message edit/delete operations, and applies application-wide dashboard, search, and responsive UX polish.

## Implemented controls

| Area | Evidence |
|---|---|
| Public registration | Student and Faculty request forms no longer submit `registerNumber` or `employeeId`. The server rejects applicant-controlled identifier fields and stores only the required password hash and safe request data. |
| HOD approval | Approval requires a bounded role-appropriate identifier, validates its format, checks the correct unique User field, atomically claims the pending request, creates the account, stores the assigned identifier, and restores the pending state if account creation fails. |
| HOD rejection | Rejection requires a bounded reason. Processed credential hashes are removed. |
| Status privacy | Public status checks expose only status metadata, the assigned identifier after approval, and the rejection reason after rejection. Credential hashes, OTPs, status-token hashes, refresh data, and device hashes are not returned. |
| Message edits | A protected conversation member can edit only a message whose `sender` matches the authenticated user. Edited messages record `editedAt`. |
| Message deletes | A protected conversation member can permanently delete only their own message. The matching message notification is removed and the latest conversation preview is recalculated. |
| Message UI | The chat includes an owner-only action menu, inline editing, deliberate deletion confirmation, edited labels, and responsive controls. |
| Search and dashboards | Global, directory, and Messages search controls use consistent icons, focus states, and touch sizing. HOD, Faculty, and Student dashboards receive restrained hierarchy and responsive interaction polish. |
| Existing security | Refresh rotation/reuse detection, RBAC/BOLA checks, relationship-scoped messaging, text-only MongoDB message storage, timetable/attendance/QR authorization, and upload controls remain enabled. |

## Automated gates

| Gate | Result |
|---|---:|
| Server syntax checks | Passed for all `server/src/**/*.js` files |
| Server test suite | 67 passed, 0 failed |
| Client test suite | 28 passed, 0 failed |
| Client lint | 0 warnings, 0 errors |
| Client production build | Passed |
| Server dependency audit | 0 vulnerabilities at high threshold |
| Client dependency audit | 0 vulnerabilities at high threshold |
| OpenAPI validation | Passed; 54 documented paths |
| Targeted public-identifier scan | Passed |
| Obsolete message-media source scan | Passed |

## Staging boundary

MongoDB, Redis, SMTP, ImageKit, authenticated browser sessions, real HOD approval/rejection, unique-identifier races, message edit/delete concurrency, notification delivery, read-state updates, refresh-token reuse, multi-device behavior, and production HTTPS/CSP/CORS behavior require execution in a disposable staging environment. This report does not claim those live scenarios were exercised in the sandbox.

## Release hygiene

The final v27 archive is source-only and excludes dependencies, build output, coverage, repository metadata, real environment files, logs, temporary validation artifacts, and obsolete message-media source files. The final archive checksum and byte size are reported outside the archive so repackaging does not make the report self-referential.
