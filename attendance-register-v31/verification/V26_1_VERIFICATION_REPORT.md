# Attendance Register v26.1 Verification Report

## Release scope

v26.1 retains the secure one-to-one Messages workspace for HOD, Faculty, and Student roles while preserving the v25 attendance, QR, timetable, tutor, leave, authentication, and directory behavior. It fixes the missing `roleValues` import that caused HTTP 500 errors when switching recipient groups, keeps Telegram-style tabs directly under the Messages heading, and requests each selected group from a server-filtered endpoint. Faculty can use All, Students, Faculty, HOD, and Tutors sections; Students can use All, Students, Faculty, HOD, and Tutors sections. Students receive one deterministic active HOD and the single Tutor assigned to their current class in their dedicated groups. The release also retains relationship-authorized chat profiles, delivery ticks, keyboard-friendly composition, the HOD Tutors directory, validated People sorting/filtering, outside-touch action-menu dismissal, and cross-device layout improvements. Messaging is intentionally **text-only**. Message bodies are trimmed, required, limited to 5,000 characters, and stored in MongoDB through the `Message` model. The release contains no image, PDF, video, audio, voice, multipart, external-file, or arbitrary-URL message path.

The Faculty “No periods for this subject” failure was traced to broad qualified-subject discovery being narrower only at the later exact slot check: a subject could be listed for several eligible Faculty members even when the selected Faculty had no active class-timetable slot for it. Subject discovery, Faculty dashboard subjects, pending-attendance subjects, and the period endpoint now share exact active timetable ownership; the endpoint additionally validates the selected class/subject pair and returns only matching Faculty slots. Timetable availability checks internal overlaps while excluding only the exact edited slot, and save errors distinguish internal overlaps from external class conflicts.

## Implemented controls

The server derives recipient eligibility from canonical roles and current active relationships. HOD can message active Faculty and Students. Faculty can message active Students in taught classes, timetable assignments, or a class they tutor, active HODs, assigned Tutors, and active Faculty peers. Students can message one deterministic active HOD, the class’s single Tutor, Faculty who teach their current class, and active classmates. Recipient discovery, direct-conversation creation, and every send recheck active status and relationship scope. Conversation reads and writes require membership in the canonical two-person participant pair, preventing guessed-ID BOLA access.

Conversation lists and thread messages are paginated. The list includes safe other-participant fields, latest-message preview metadata, and unread counts. Opening a thread marks only received unread messages as read and synchronizes matching message notifications as read. New-message notifications contain generic text and only the conversation/message identifiers in metadata. Message sends are recorded through the existing audit service without storing the body in audit metadata. A dedicated authenticated user-keyed send limiter remains enabled.

The client provides role-specific protected paths at `/hod/messages`, `/faculty/messages`, and `/student/messages`, shared navigation, a permanently visible Telegram-style contact panel under the page heading, server-filtered group tabs, request-race protection, green WhatsApp-style unread badges on contact avatars and conversation rows, a clean responsive two-pane workspace, safe profile viewing, direct conversation creation, Enter/Shift+Enter text composition, double-check read indicators, loading/empty/error recovery, paginated thread display, unread indicators, read state, and actionable new-message notifications. The HOD People surface adds a Tutors workspace and server-backed student department/semester filters and name/department/semester/class sorting; responsive navigation uses the mobile drawer through tablet widths and expands for TV-sized displays. Profile-photo upload behavior remains separate and unchanged; it is not used for Messages.

## Automated evidence

| Gate | Result |
|---|---:|
| Server Node contract tests | **66 passed, 0 failed** |
| Client Node contract tests | **28 passed, 0 failed** |
| Server source syntax checks | **Passed for all `server/src/**/*.js` files** |
| Client lint | **Passed with 0 warnings and 0 errors** |
| Client production build | **Passed** |
| Server dependency audit | **0 vulnerabilities** |
| Client dependency audit | **0 vulnerabilities** |
| OpenAPI parser and messaging-path validation | **Passed; 53 documented paths** |
| Source-only archive hygiene | **Verified after independent extraction**; the final archive path, size, and SHA-256 are supplied with the release delivery. |

## Honest staging boundary

The sandbox does not contain the project’s MongoDB, Redis, SMTP, or live authenticated browser sessions. Therefore, the following remain **UNVERIFIED** until staging: live recipient relationship data for all role pairs, direct API BOLA attempts using real conversation IDs, relationship removal after an existing conversation, concurrent message writes, notification delivery, read/unread state against real records, refresh-session behavior, seed persistence, and deployed HTTPS/CSP/CORS behavior. These checks are listed in `PRODUCTION_CHECKLIST.md` and must be completed against a disposable, backup-verified staging database before production deployment.

No live database seed, file transfer, external storage upload, or browser-authenticated messaging result is claimed by this report.
