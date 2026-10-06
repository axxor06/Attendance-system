# Attendance Register v24 Verification Report

## Scope

This release adds the Faculty attendance-period correction to the previously delivered v23 timetable and subject-count remediation. It preserves the server’s exact subject/class/date/period/Faculty authorization, HTTP 403 behavior for forged or stale requests, rotating refresh-session security, durable timetable slot IDs, whole-week timetable conflict validation, and the existing seed scale and Faculty counts.

## Root cause

The reported request sequence showed `GET /api/attendance/session-roster` being sent with a dashboard deep-link `periodOrder` before the class-period response had loaded. The old Faculty page accepted that initial period value immediately. Its period filtering then matched the selected subject but did not require the persisted timetable slot to belong to the logged-in Faculty member. Therefore, a subject period taught by another Faculty member could be requested by the current Faculty account.

The server correctly rejected the mismatch with:

```text
403 You are not assigned to this exact timetable period.
```

The repeated response was the same invalid request being issued more than once during development/StrictMode lifecycle activity. The problem was therefore not a server authorization failure and not fixed by removing the 403 guard.

## Implemented correction

The class-specific period endpoint now scopes Faculty responses to active timetable slots with `kind: class` and the requesting Faculty’s persisted `_id`. HOD and Student class schedule reads retain their existing behavior. The pending-attendance dashboard now builds pending sessions only from slots matching the subject and current Faculty assignment, so dashboard links no longer seed invalid period choices.

Both manual Take Attendance and QR Attendance now filter class-timetable periods by exact persisted subject and Faculty IDs. The roster loader waits until a matching period has been loaded before sending `session-roster`; a non-matching deep-link period is cleared rather than submitted. QR generation also requires a currently listed period before sending its request. Stale selections are ignored through request identity checks.

A small client single-flight helper shares identical in-flight subject, period, and roster reads during React StrictMode, preventing duplicate identical reads without weakening server behavior. The attendance and period API wrappers accept Axios request configuration for the existing cancellation conventions. The server’s `resolveSessionContext` remains authoritative for roster loading, attendance marking, QR generation, and QR statistics.

## Automated verification

| Gate | Result |
|---|---:|
| Server Node test suite | **58 passed, 0 failed** |
| Client Node test suite | **26 passed, 0 failed** |
| Client lint | **0 warnings, 0 errors** |
| Client production build | **Passed** |
| Server source syntax checks | **All `server/src/**/*.js` modules passed** |
| OpenAPI validation | **Passed; 47 documented paths** |
| Server dependency audit | **0 vulnerabilities** |
| Client dependency audit | **0 vulnerabilities** |
| No-Mongo seed guard | **Refused safely; status 1** |
| No-Mongo timetable audit guard | **Refused safely; status 1** |
| No-Mongo timetable diagnosis guard | **Refused safely; status 1** |
| Source-only archive extraction | **Passed after final packaging** |

The complete gate output is in `verification/v24-gates.log`, which is attached separately and excluded from the source archive as a generated log.

## Live staging procedure

MongoDB, Redis, authenticated browser sessions, and the user’s live database are not available in the sandbox. The following live claims remain **UNVERIFIED** until executed in a disposable, backup-verified staging environment.

Run v24 against the existing v22 database only after taking a backup and fully stopping old Node/Vite processes. Start the v24 backend and frontend from the same source tree. Log in as a Faculty member who owns at least one exact class-timetable slot. On the Faculty dashboard, open every pending-attendance link and confirm the period selector contains only the assigned subject/Faculty slots. Confirm the server logs show one request for each identical subject/period/roster read under StrictMode, or at minimum no duplicate invalid requests.

Throttle the period endpoint and open a deep link containing an initial period. Confirm no `session-roster` request is sent until the exact matching period list is loaded. A valid assignment should return HTTP 200. Selecting a subject period owned by another Faculty member must not be available in the UI; a manually forged request must still return HTTP 403. QR generation and QR statistics must follow the same exact-slot behavior.

The previously delivered v23 timetable checks remain required: raw nested slot IDs must be present, unchanged full-week saves must return HTTP 200, genuinely available Faculty saves must persist, and genuinely occupied cross-class assignments must remain HTTP 409 with structured details. Academic Management must continue to show complete subject counts across all seeded classes.

## Packaging

The v24 archive is source-only and excludes `node_modules`, client build output, coverage, generated logs, `.env` files, repository metadata, credentials, and external harness artifacts. The approved `/favicon.png` asset remains intentionally absent pending the owner’s PNG asset.
