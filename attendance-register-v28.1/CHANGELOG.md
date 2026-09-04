# Project change history

## v28.1 operational hardening and production-readiness pass

Applied a targeted production-readiness pass without rewriting or removing working features. The HTTP server now enforces bounded request, header, keep-alive, and shutdown lifetimes through documented environment controls. Production configuration rejects invalid timeout values and invalid refresh-cookie SameSite combinations before startup.

Improved the global error boundary with safe actionable responses for malformed JSON, oversized request bodies, unexpected multipart files, and common duplicate records such as email addresses, Student register numbers, Faculty employee IDs, and codes. Access logs are compact structured records that omit query strings, user-agent metadata, and request bodies; API error logs are metadata-only. Database and Redis startup failures now return safe initialization errors to the server entrypoint instead of exiting inside lower-level modules.

Added response compression for payloads above 1 KB and an explicit restrictive Permissions-Policy header. The client refresh interceptor is now auth-epoch-aware during concurrent terminal failures, and Messages conversation polling pauses while the document is hidden and refreshes when visibility returns. Existing refresh rotation/reuse detection, RBAC/BOLA, timetable/attendance/QR authorization, relationship-derived messaging, text-only storage, and all existing navigation items remain intact.

The v28.1 source passes 75 server tests, 30 client tests, zero client lint warnings/errors, the production build, server syntax checks, high-threshold dependency audits, OpenAPI validation with 54 documented paths, and source safety scans. Live MongoDB, Redis, SMTP, ImageKit, authenticated browser, concurrent database, refresh-reuse, and deployed HTTPS scenarios remain staging requirements.

## v28 professional workspace, Messages UX, and release consistency

Redesigned the authenticated workspace around a calmer, product-focused sidebar for desktop and mobile, with clearer navigation hierarchy, purposeful active states, refined account controls, consistent icon treatment, and responsive behavior that remains easy to scan. The Messages workspace now provides a clearer two-pane conversation experience, polished message bubbles and action menus, better Add chat search alignment, consistent role navigation, readable empty/loading/error states, and touch-friendly controls without changing the server authorization matrix.

Refined the shared theme across authentication, dashboards, directories, attendance, registration, and Messages with a restrained navy, sage, warm-accent, and paper palette. Shared buttons, cards, modals, global search, directory search, attendance filters, and Add chat controls now use consistent spacing, icon alignment, focus states, contrast, shadows, responsive sizing, and restrained motion.

Preserved the end-to-end security model: server-side role and relationship authorization, strict JSON body contracts, CSRF origin and Fetch Metadata checks, pinned JWT algorithms, refresh rotation and reuse detection, fail-closed production configuration, text-only message storage, owner-only message edits, per-user and sender-only global deletion semantics, timetable/attendance/QR protections, and safe response projections. This release is named consistently as v28 across the project root, package metadata, lockfiles, documentation, verification artifacts, and archive.

## v27.1 end-to-end security hardening

Added explicit request-body allowlists to authentication, profile, account-management, registration, HOD review, and text-message mutation routes so unexpected fields fail safely instead of silently reaching controllers. Refresh and logout retain Origin validation and now also reject cross-site Fetch Metadata requests when the browser omits Origin. JWT access and refresh verification is pinned to HS256.

Server startup now fails closed for weak or placeholder JWT secrets, reused access and refresh secrets, insecure production cookie configuration, enabled LAN origins or disabled rate limits in production, missing shared Redis, invalid trusted-proxy settings, and non-HTTPS production browser origins. Legacy Faculty aliases can no longer bypass the canonical role-migration guard, and academic identifier normalization/validation is shared across HOD account and registration paths.

HOD registration rejection is now an atomic pending-to-rejected transition, and the unmounted legacy self-registration controller and validator that accepted applicant-controlled identifiers were removed. The HOD Registrations page now has a working refresh action and filters refreshed data to the selected status, preventing already processed people from remaining in the pending view.

Messages now show role-specific navigation tabs over existing conversations: HOD sees All, Students, Faculty, and Tutors; Faculty and Student see All, Students, Faculty, Tutors, and HOD. The permanent recipient user-list/cards were removed. Add chat opens recipient search only on demand; the server limits HOD, Faculty, Tutor, Student, teaching, and same-class results to the authorized relationship matrix, and selecting a result—not searching—creates or opens a conversation. Chat deletion now offers Delete from me and sender-only Delete from everyone, with per-user visibility stored securely. Attendance QR copy-link guidance is concise and unchanged in token behavior. The patch passes 72 server tests, 28 client tests, zero client lint warnings/errors, the production build, both high-threshold dependency audits, and OpenAPI validation with 54 documented paths. Live MongoDB, Redis, authenticated browser, refresh-reuse, concurrency, and production HTTPS scenarios remain staging requirements.

## v27 secure registration, Messages actions, and dashboard polish

Public Student and Faculty registration no longer asks applicants for a register number or employee ID. HOD approval now requires a bounded role-specific identifier, performs a server-side uniqueness check, atomically claims the pending request, and rolls back safely on failure. Duplicate identifiers return a clear conflict without approving the request. HOD rejection requires a reason, and approved status checks expose the assigned identifier without exposing credential or token data.

Direct messages now support owner-only edit and permanent delete actions inside the chat. Both operations recheck conversation membership and sender ownership on the server, edits record `editedAt`, deletes clean up the matching unread notification and repair the conversation preview, and all activity remains audit-safe and text-only. The Messages UI adds accessible action menus, inline editing, deliberate deletion confirmation, edited labels, theme-aware surfaces, and resilient mobile behavior.

HOD, Faculty, and Student dashboards received a restrained hierarchy and responsive interaction polish. The shared theme now uses a calmer navy, sage, warm-accent, and paper palette with consistent surfaces, shadows, focus rings, active feedback, modal overlays, and responsive spacing. Global, directory, attendance, and Add chat search controls now use one aligned icon/input treatment; the Add chat modal keeps search on demand with a clear Add chat entry point. Messages uses role tabs over existing conversations, while authorized recipient search appears only inside Add chat. Existing refresh-token, RBAC/BOLA, timetable, attendance, QR, notification, and session protections remain in place.

## v26.1 recipient groups and main-page message layout

Fixed the HOD Messages contact area so role tabs are always visible directly beneath the Messages heading, matching the requested Telegram-style layout. Each tab now requests its own server-filtered recipient page: HOD can independently load All, Students, Faculty, and Tutors rather than having a student-heavy first page make other groups appear empty. The missing `roleValues` import that caused HTTP 500 errors on Students, Faculty, and HOD tabs is corrected. Faculty and Student group requests remain limited by the same server-derived relationship authorization, and the `group` query accepts only the known categories. Students now receive one deterministic active HOD and the single Tutor assigned to their class in the dedicated groups.

Added recipient-loading skeletons, race-safe recipient/conversation refresh handling, clear empty/error states, synchronized message-notification read state when a conversation is opened, green unread badges on chat contacts, and a clean WhatsApp-inspired responsive two-pane Messages workspace. Regression contracts cover the role helper, group filter, Student HOD policy, notification synchronization, permanent main-page panel, and unread UI.

Fixed the Faculty “No periods for this subject” mismatch by aligning subject discovery, dashboard subjects, pending attendance, and period requests with exact active timetable-slot ownership. The period endpoint now accepts a validated subject ID and filters class-timetable periods server-side before the client applies a second exact-match check. Timetable availability now checks internal overlaps while excluding only the exact edited slot; save-time conflict responses distinguish internal self-conflicts from conflicts in another class and retain structured detail fields. The alternate seed keeps assignments inside the class department, updates subject Faculty relationships for selected timetable assignments, and validates persisted slot IDs and real Faculty conflicts. No text-only storage, RBAC, BOLA, session, attendance, QR, or timetable protections were weakened.

## v26 secure direct messaging

Added a shared Messages workspace for HOD, Faculty, and Student routes with server-derived relationship-scoped recipients. HOD can message active Faculty and Students; Faculty can message active Students in taught or tutored classes; Students can message active HOD accounts, teaching Faculty, and active classmates. Recipient discovery, conversation creation, and every send recheck active status and current relationships, while conversation reads/sends require two-person participant membership.

Added canonical direct conversations, paginated thread and conversation APIs, unread counts, received-message read state, generic new-message notifications, and audit-safe send records. The client adds role-visible navigation, Telegram-style recipient sections, safe profile viewing, responsive thread display, double-check delivery indicators, Enter/Shift+Enter compose behavior, recoverable loading/error/empty states, and notification-compatible unread behavior.

Messaging is intentionally text-only: message bodies are trimmed, required, bounded to 5,000 characters, and stored directly in MongoDB. There is no image, PDF, video, audio, voice, multipart, external-file, or arbitrary-URL message path.

The corrected v26.1 source passes 66 server contract tests, 28 client contract tests, client lint, and the Vite production build. OpenAPI, clean source packaging, and dependency audit gates are run before delivery. Live MongoDB relationship/BOLA tests, notification delivery, read/unread behavior, and browser-authenticated messaging remain staging verification requirements.

## v25 Faculty directory and timetable UI polish

The HOD Faculty directory now opens in an **All Departments** view and includes a department dropdown. Selecting a department sends its validated ObjectId to the existing protected, paginated `/api/users?role=admin` endpoint; search, summary counts, loading states, and pagination continue to operate on the filtered server response. Student directory behavior is unchanged.

The HOD timetable editor now uses clearer weekly day cards with visible slot counts, more deliberate spacing, separate period-type/subject/Faculty and time/note controls, and responsive two-column slot groups. The redesign reduces visual congestion while preserving the exact weekly payload, persisted timetable and nested slot IDs, availability lifecycle, conflict details, and server-authoritative save validation.

The v25 source retains the v24 exact Faculty-period attendance safeguards and is covered by the existing server and client suites plus new directory/layout contract checks. Live authenticated UI behavior remains a staging verification requirement.

## v24 Faculty attendance period remediation

The Faculty manual and QR attendance selectors now expose only class-timetable slots whose persisted subject and Faculty match the selected subject and logged-in Faculty member. The period endpoint applies the same Faculty-owned-slot scope for class-timetable reads, while HOD and Student schedule reads retain their existing behavior. The pending-attendance dashboard now creates links only from exact subject/class/day/period assignments owned by the current Faculty member.

The attendance pages wait for the validated period list before loading a roster, reject stale selections locally, share identical in-flight subject/period/roster reads during React StrictMode, and ignore stale results. The server continues to resolve the class timetable and exact Faculty assignment for every roster, mark, QR, and statistics request; forged or stale combinations remain HTTP 403. No authorization guard was removed.

The v24 source adds a shared period-scope utility and regression coverage for exact subject/Faculty matching, legacy-template compatibility, and single-flight duplicate-read behavior. The source passes 58 server tests, 26 client tests, client lint, and the Vite production build. Live authenticated Faculty attendance and QR flows remain staging evidence requirements.

## Combined timetable conflict remediation

The timetable conflict path now distinguishes the two sources of conflicts. Availability receives a hypothetical requested slot with only day/order/time; its comparison now uses each persisted candidate slot’s explicit `faculty` against the candidate Faculty ID, so real same-time assignments are hidden while breaks and free periods remain non-blocking. The PUT path derives the active timetable document from the route’s class ID, normalizes its actual Mongo `_id`, and excludes that document and current class from external conflict queries without trusting a browser-supplied exclusion.

The complete weekly save payload preserves existing nested slot IDs. Development diagnostics now report separate internal and external conflict counts, first examples, exact time ranges, Faculty IDs, slot IDs, conflicting timetable/class IDs, and whether any reported conflict matches the active timetable. Internal overlaps remain HTTP 409, and genuine cross-class simultaneous Faculty assignments remain HTTP 409. No Faculty count, seed data, or validation rule was weakened.

This combined source passes 57 server tests, 22 client tests, client lint, and the Vite production build. Live MongoDB seed/read-back, the user’s exact unchanged-save request, and deliberate real-conflict request remain staging evidence requirements.

## Latest remediation

The Smart Seed now assigns a stable real Mongo ObjectId to every generated timetable slot, including class, break, and free-period slots, before its native MongoDB `updateOne` write. It reads raw active timetable documents back, validates unique slot IDs and zero authoritative Faculty-overlap conflicts, and refuses to report completion when either integrity condition fails. `npm run validate:timetables` reports missing, invalid, and duplicate raw slot IDs; `npm run diagnose:timetable-ids` prints raw slot IDs by day for a supplied class/timetable investigation.

Academic Management now requests bounded subject pages at the server’s maximum of 100 and merges the pages before calculating class subject badges or expanded lists. The regular server-paginated subject endpoint remains unchanged, and no unrestricted payload or Faculty-count adjustment was introduced. PeriodsPage accepts only valid Mongo identifiers and never converts malformed response objects into `[object Object]`; exact persisted `timetableId` and `slotId` validation remains enforced by the server.

The current source gates pass 57 server tests, 22 client tests, client lint, and the Vite production build. Live MongoDB seed/read-back, exact availability HTTP 200, unchanged save HTTP 200, available-Faculty persistence, intentional occupied-Faculty HTTP 409, and all 80 Academic Management counts remain staging requirements rather than sandbox claims.

## Current implementation improvements

The application now uses canonical HOD, Faculty, and Student route namespaces and sends each role to its correct workspace after sign-in. Authenticated navigation no longer blocks the outlet behind an exit animation, so loading, empty, error, and populated states remain visible during route changes. Password resets performed by an authorized HOD generate a permanent one-time credential, clear the forced-reset state, revoke existing sessions, and never log or persist the plaintext credential.

Academic scheduling now follows a department → semester → class hierarchy. Each class owns an explicit weekly timetable with subject and Faculty assignments. Busy Faculty members are hidden from availability selectors, overlapping assignments are rechecked on the server, and conflict responses identify the occupied Faculty member, day, period, and time where possible. Stable class-tutor assignment is managed in Academic Management with a confirmation modal; tutor access remains limited to the assigned class.

Faculty can submit an inability request against an exact current timetable slot. HOD review is scope-protected, rejection requires a reason, accepted replacements are checked again for live availability and committed atomically with audit and notification records, and pending duplicates are prevented. Students can submit leave requests to their tutor and HOD, review decisions, and read polished reviewer feedback when a request is rejected.

Directory search is debounced, bounded, cancellable, stale-response-safe, and visibly indicates when a search is in progress. Server-side query validation, role-aware indexes, and bounded prefix matching reduce unnecessary collection work without loading unrestricted institutional data into the browser. HOD Students supports department/semester filters and stable server-side name, department, semester, and class sorting. HOD also has a dedicated Tutors view derived from active class-teacher assignments. Search-field icon spacing was corrected so icons and placeholder text remain clearly separated on desktop and mobile; action menus now close on outside touch/click and Escape.

The timetable and attendance paths enforce the requested subject against the exact class timetable slot, while QR generation and session statistics apply the same check. Faculty QR and manual attendance period selectors now show only periods matching the selected subject, class, and date; ISO date-only weekday resolution is UTC-safe on the server and calendar-date-safe in attendance displays. Legacy day templates remain only as a controlled compatibility fallback. Student, Faculty, and HOD leave pages now use Pending, Approved, and Rejected sections and show the reviewer and decision date for completed requests. Static favicon wiring and recoverable loading/report errors prevent avoidable browser 404s, blank states, and generic feedback. The client retains rotating HTTP-only refresh cookies, single-flight refresh coordination, bounded same-token grace, family reuse detection, StrictMode-safe bootstrap, student one-device binding, secure OTP flows, strict upload validation, CORS/CSP protections, rate limits, audit logs, and server-side RBAC/BOLA checks.

## Verification notes

Automated checks cover authentication/session safety, canonical role behavior, resource authorization, timetable conflicts, subject-matched period selectors, UTC-safe date resolution, assignment requests, three-state leave presentation and decision attribution, secure text-messaging recipient/BOLA contracts, safe error serialization, search contracts, responsive navigation, and protected UI controls. Live MongoDB, Redis, Docker, seeded persistence, and multi-device workflows must still be executed in a disposable staging environment before production use.

The application deliberately avoids showing internal build labels in its interface, API root message, documentation headings, or project change history. Technical package and specification metadata remain valid for their tooling contracts but do not appear as product-facing labels.

## References

- [Project README](./README.md)
- [Architecture overview](./ARCHITECTURE.md)
- [Deployment guide](./DEPLOYMENT.md)
- [Security audit](./SECURITY_AUDIT.md)
- [Production checklist](./PRODUCTION_CHECKLIST.md)
- [REST API reference](./API.md)
- [OpenAPI document](./docs/openapi.yaml)

## Developer

Arjun Krishnan . p.s

Developed for accountable, secure academic operations.


The error path was tightened end to end: HTTP status handling now precedes generic error-code fallbacks, safe server messages and bounded conflict details are preserved, and timetable conflicts use `TIMETABLE_CONFLICT` with actionable Faculty/day/period/time context. This prevents a safe “Faculty is already occupied…” reason from degrading to “Something went wrong,” while stack traces, database internals, credentials, and filesystem paths remain excluded.

The supplied Smart Seed specification is now incorporated and hardened. A clean database targets ten departments, eight semesters, 80 department-semester classes, 20 Faculty per department (approximately 200 Faculty), 55–60 Students per class, five subjects per class, Monday–Friday eight-slot templates, Saturday five-slot templates, and conflict-free class timetables. Existing identities and relationships are preserved or rejected on mismatch rather than silently overwritten; the script remains production-refusing and was validated statically because MongoDB is unavailable in this sandbox.

The current local verification gates are 28 passing client tests, 64 passing server tests, zero client lint warnings/errors, and a successful Vite production build. Live MongoDB, Redis, Docker, seeded persistence, and multi-device workflows must still be executed in a disposable staging environment before production use.



When a timetable slot has no active available Faculty, the Faculty control is now disabled instead of presenting the fallback text as a selectable-looking option. The helper explains that the HOD should choose another period or subject; availability failures remain distinct and fail closed.

The smart seed now targets 20 active Faculty per department, approximately 200 Faculty on a clean database, while preserving existing identities and all server-side timetable overlap checks. A frontend restart can restore a valid session through the HTTP-only rotating refresh cookie; access tokens remain memory-only. Logout, password changes, administrator resets, deactivation, and refresh-token reuse detection continue to invalidate the appropriate session(s).

The timetable availability root cause was corrected. The overlap helper had treated a slot with no Faculty—such as a break or free period—as if it belonged to the candidate being checked, causing every Faculty member to appear occupied. It now compares only explicit Faculty assignments; unassigned slots never block availability. The server still filters genuinely busy Faculty and performs the final overlap check during timetable save.

The timetable availability investigation now has a complete root-cause correction. The server scopes eligible Faculty to the selected class department, validates optional subject context, returns eligible/busy/available counts, and compares only explicit Faculty assignments at exact overlapping day/time slots. A null Faculty break/free slot can no longer block every candidate. The Smart Seed still targets 20 Faculty per department and now sorts eligible candidates by subject preference, current workload, and stable ID while retaining the no-double-booking reservation set.

The HOD timetable client now sends subject context through a cancellable Axios request, resets old-class state before loading a new class, tracks request identity, aborts stale requests, and exposes explicit idle/loading/success/empty/error states. Success shows real Faculty options and counts; empty and API failures terminate with precise messages; stale responses cannot overwrite the current selection. Mock-backed browser verification exercised all three terminal outcomes.


The save-path root-cause investigation confirmed that `/api/timetables/:classId` uses a class identifier while the returned `data.timetable._id` is the persisted timetable-document identifier. Availability now resolves the active timetable for the selected class, rejects a mismatched `excludeTimetableId`, and excludes the current document directly. Save conflict queries also exclude the existing timetable by `_id: { $ne: existingTimetableId }`, while internal duplicate assignments and genuine cross-timetable overlaps remain rejected. Staging must prove an unchanged full-week save returns HTTP 200 and an intentionally occupied Faculty assignment returns HTTP 409 with exact structured details; those live database flows were unavailable in the sandbox.

The v21 timetable editor now preserves persisted identifiers from freshly loaded responses by normalizing both `_id` and compatible `id` fields for timetable documents and nested slots. Class timetable and subject loads share an AbortController and request identity; switching classes clears the prior draft and availability state before loading, and stale responses cannot overwrite the active class. Availability requests therefore send the current class’s timetable and slot IDs, while backend validation continues to reject arbitrary or stale identifiers.
