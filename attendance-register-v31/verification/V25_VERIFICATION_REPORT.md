# Attendance Register v25 Verification Report

## Scope

v25 combines the prior timetable identity, conflict-validation, subject-pagination, and Faculty attendance-period remediations with two focused UI improvements: an HOD Faculty directory filter and a cleaner timetable editor.

## Faculty directory change

The HOD Faculty directory now defaults to **All Departments**. A department dropdown lists the authorized department options and sends the selected department ObjectId to the existing HOD-only `GET /api/users?role=admin` endpoint. Search, pagination, loading/error/empty states, and summary values remain based on the same server-filtered response. Student account management does not receive the Faculty-specific filter.

The server already validates the optional department query as a Mongo ObjectId and applies it inside the existing authorization scope. No unrestricted Faculty payload, new privilege, or client-only filtering was introduced.

## Timetable clarity change

The HOD timetable editor now presents each day as a compact responsive card with a visible slot count. Each slot is grouped into a readable identity area and a separate scheduling area. Period type, subject, assigned Faculty, start/end times, and optional notes use clearer labels and spacing. The layout collapses cleanly on smaller screens and retains the existing conflict highlight, availability helper, add/remove controls, complete weekly payload, persisted timetable ID, nested slot IDs, and server-authoritative save behavior.

No conflict validation, exact `slotId` validation, stale-load protection, Faculty count, seed behavior, or authorization rule was weakened.

## Automated verification

| Gate | Result |
|---|---:|
| Server Node test suite | **58 passed, 0 failed** |
| Client Node test suite | **26 passed, 0 failed** |
| Server source syntax checks | **All `server/src/**/*.js` modules passed** |
| Client lint | **0 warnings, 0 errors** |
| Client production build | **Passed** |
| OpenAPI validation | **Passed; 47 documented paths** |
| Server dependency audit | **0 vulnerabilities** |
| Client dependency audit | **0 vulnerabilities** |
| No-Mongo seed/audit/diagnosis guards | **All refused safely with status 1** |
| Source-only archive extraction | **Passed after final packaging** |

The complete command output is stored in `verification/v25-gates.log`, attached separately and excluded from the source archive as a generated log.

## Live staging limits

MongoDB, Redis, authenticated browser sessions, and the user’s live database were not available in the sandbox. The following remain **UNVERIFIED** until exercised in a disposable, backup-verified staging environment:

| Scenario | Required live evidence |
|---|---|
| Faculty directory | All Departments shows the full authorized Faculty set; every department filter, search-plus-filter combination, pagination transition, summary, and empty state is accurate. Direct non-HOD access remains denied. |
| Timetable UI | Desktop and mobile views remain readable, keyboard-accessible, and free of unintended horizontal overflow. Existing timetable IDs and slot IDs remain unchanged through unchanged save/reload. |
| Timetable saves | Unchanged save returns HTTP 200; an available Faculty assignment persists; a genuinely occupied cross-class assignment remains HTTP 409 with exact details. |
| Faculty attendance | Pending dashboard links open valid assigned periods; a valid subject/date/period roster returns HTTP 200; a forged wrong-period request remains HTTP 403; QR generation and statistics follow the same exact-slot rule. |
| Authentication | Refresh rotation, single-flight behavior across real browser tabs, and genuine refresh-token reuse/family revocation are exercised against real sessions. |

Use the existing v25 project with the v22 database only after a verified backup. Fully stop old frontend/backend processes before starting v25. Run `npm run validate:timetables` before timetable tests and retain its output with the release record.
