# Attendance Register v28 Verification Report

## Scope

Version 28 is the next major Attendance Register release. It hardens the browser-to-API-to-database path and delivers the sidebar and Messages redesign without changing the existing security model or removing working features.

## Security changes

| Area | Result |
|---|---|
| Critical request bodies | Authentication, profile, account-management, registration, HOD review, messaging, academic, attendance, QR, timetable, leave, assignment, and notification mutations now reject fields outside their explicit endpoint contract. |
| Cookie-authenticated requests | Refresh and logout retain exact Origin validation and now reject cross-site Fetch Metadata requests when an Origin header is absent. |
| JWT verification | Access and refresh signing and verification are pinned to HS256. |
| Production startup | Startup fails closed for weak or placeholder JWT secrets, reused access/refresh secrets, insecure production cookies, LAN-origin allowances, disabled rate limits, missing Redis, invalid proxy-hop configuration, or non-HTTPS production origins. |
| Role migration | Canonical Faculty/admin aliases cannot bypass the explicit role-model migration guard during password login or bearer authentication. |
| Academic identifiers | HOD account creation, HOD account updates, HOD self-profile Employee ID changes, and registration approval use a shared bounded identifier policy. |
| Registration state | HOD rejection is an atomic pending-to-rejected transition, preventing concurrent approval/rejection races from overwriting processed state. |
| Legacy surface reduction | The unmounted legacy self-registration controller and validator that accepted applicant-controlled identifiers were removed. |

## Automated verification

| Gate | Result |
|---|---:|
| Server source syntax | Passed for all `server/src/**/*.js` modules |
| Server tests | 72 passed, 0 failed |
| Client tests | 28 passed, 0 failed |
| Client lint | 0 warnings, 0 errors |
| Client production build | Passed |
| Server dependency audit | 0 vulnerabilities at high threshold |
| Client dependency audit | 0 vulnerabilities at high threshold |
| OpenAPI validation | Passed; 54 documented paths |
| Targeted source scans | Passed for unsafe HTML, message-media fields, real environment files, and debug artifacts |

## Staging boundary

The sandbox did not exercise live MongoDB, Redis, SMTP, ImageKit, authenticated browser sessions, multi-device student binding, refresh-token theft/reuse, concurrent database races, real registration approval/rejection, message ownership races, QR replay, or production HTTPS deployment. These scenarios remain required in a disposable staging environment and are listed in `PRODUCTION_CHECKLIST.md`.

## Packaging

The v28 archive is source-only. It excludes dependency directories, build output, coverage, `.git`, real environment files, logs, and temporary generated artifacts. The final checksum and byte size are reported outside the archive.

## Active UI follow-up requirements

The Messages page now renders role-specific navigation tabs over existing conversations: HOD receives All, Students, Faculty, and Tutors; Faculty and Student receive All, Students, Faculty, Tutors, and HOD. The permanent recipient user-list/cards were removed. An Add chat button opens recipient search on demand; HOD results are limited to permitted Faculty and Students, Faculty results are limited to students they teach, Tutors, HOD, and other Faculty, and Student results are limited to same-class classmates, the HOD, teaching Faculty, and the class Tutor. Students from other departments or semesters are excluded. Searching alone never creates a conversation; selecting an authorized result does. Chat actions now provide Delete from me for per-user visibility and Delete from everyone for permanent sender-owned removal. The confirmation is concise: “Delete this message permanently? It will be removed from the conversation”. The HOD Registrations page includes a manual Refresh action; refreshed results are filtered to the selected status so processed requests do not remain visible in the pending view. Attendance QR guidance now uses a concise 14-word secure-link sentence without changing token behavior. The project-wide visual refresh updates shared theme tokens, surfaces, buttons, modal overlays, responsive spacing, and search controls. Global, directory, attendance, and Add chat inputs now share the same aligned icon, padding, focus ring, contrast, and touch-size treatment; hardcoded search-result surfaces were moved onto the theme tokens.

## v28 visual refresh

The authenticated shell now uses a calmer navy, sage, warm-accent, and paper palette with consistent content spacing, neutral shadows, rounded surfaces, stronger focus states, and restrained motion. Desktop and mobile navigation use clearer active indicators, purposeful icon sizing, refined branding, improved account controls, and responsive touch targets. Messages uses a polished two-pane inbox, quieter conversation surfaces, clearer role tabs, refined message bubbles and action menus, and an Add chat modal with the shared search-field icon alignment. Global, directory, attendance, and Add chat search controls share the same padding, icon placement, focus treatment, and responsive behavior.
