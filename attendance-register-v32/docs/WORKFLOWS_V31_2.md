# v31.2 workflows, schema changes and migration

## 1. Registration approval

1. Applicant submits `POST /registration-requests` (student: `classId` + `previousEducation`; faculty: `departmentId` + `facultyEducation` + `experience`). Fields for the other role are rejected, unknown fields are rejected, role/status/department cannot be supplied by the applicant (department is derived from the chosen class).
2. A `RegistrationRequest` (status `pending`) is stored. **No `User` document exists yet**, so a pending or rejected applicant has no credentials, no token and nothing to authenticate: backend enforcement is structural, not a flag check. (Design kept from earlier versions deliberately; the alternative, a `User` with a pending flag, would require every protected path to remember to check it.)
3. Every active HOD gets exactly one notification (`dedupeKey = registration-request:<id>`, unique per user). Failure to notify never fails the submission.
4. HOD reviews at `/hod/registrations` (filters, search, details with education/experience), then approves (assigns the register number / employee ID) or rejects (reason required).
5. Approval claims the request with one atomic `findOneAndUpdate({status:'pending'})`, so duplicate or simultaneous approvals produce exactly one account; the loser gets 409. The reviewer, time and a history entry are recorded; the stored password hash is removed on both outcomes. Related notifications are marked read.

**Scope decision.** This product has a single institution-wide HOD tier (see `ARCHITECTURE.md`), so every HOD may review every request; anyone else gets 404. All scope checks go through `assertRequestScope`, the one place to change if department-scoped HODs are introduced. The brief's "authorized department" is therefore "the whole institution" here.

**Pending login.** Logging in as a pending applicant with the *correct* password returns 403 `REGISTRATION_PENDING`; a wrong password gets the generic 401 (no account enumeration; a dummy bcrypt compare keeps timing uniform). Rejected applicants use the existing private status code.

## 2. Counts, badges, notifications

| Number | Source | Changed by |
| --- | --- | --- |
| Requests badge / dashboard card | `RegistrationRequest.countDocuments({status:'pending'})` grouped by role | submit, approve, reject only |
| Notifications badge | `Notification.countDocuments({user, isRead:false})` | reading, new notifications |
| Messages badge | unread `Message` rows for the user | reading a conversation, new messages |

Reading a notification never changes the pending count. Message notifications are one reopened row per conversation. No real-time infrastructure exists, so clients poll `GET /notifications/summary` (HOD 20 s, faculty 45 s, student 60 s, +0-20 % jitter, only while the tab is visible, plus on focus and after any action).

## 3. Attendance codes

- 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, `crypto.randomInt`, about 39.6 bits. Generation retries on the (astronomically unlikely) digest collision.
- Stored as HMAC-SHA256 (`ATTENDANCE_CODE_SECRET`, default `JWT_ACCESS_SECRET`); the raw code is returned once to the faculty client. The QR image encodes `/scan-qr?code=<code>`.
- Lifetime `QR_SESSION_TTL_MINUTES` (default 5). Regenerating invalidates the previous code.
- Scan: lookup is `{digest, class: student.class, isActive}`; then expiry, subject active, enrollment, and an upsert protected by the unique attendance index. The upsert metadata distinguishes "created" from "already existed", so the student is never told "present" over an existing absent record.
- 8 characters is a short-lived session lookup key, not authentication: the student must be signed in and active, bound to the device, in the session's class, and under the per-user scan rate limit (default 30 / 15 min).

## 4. Historical correction

`GET /attendance/corrections/sessions` -> `GET /attendance/corrections/roster` -> `POST /attendance/corrections`.

- Authorization: HOD any session; faculty must currently teach the subject **and** hold the timetable slot for that weekday/period **or** have marked that very session (covers later timetable edits).
- Each change updates the existing record with a conditional `findOneAndUpdate({_id, status: <status read>})`; a concurrent change returns 409 instead of silently winning. A student with no record yet is created through the unique index. Duplicates are impossible.
- Every status change appends an immutable `AttendanceCorrection` row (record, student, class, subject, date, period, previous/new status, corrector, reason, source). In replica-set deployments the batch is one transaction; on a standalone mongod it falls back to per-record updates with compensation if the audit insert fails.
- Edit window: faculty `ATTENDANCE_CORRECTION_WINDOW_DAYS` (default **30**, `0` = unlimited); HOD exempt; future dates rejected (1 day timezone slack). The same policy now applies to `POST /attendance/mark` and `PATCH /attendance/:id`. Before this version there was no limit at all and no trail; 30 is a new default, not a preserved one.
- Percentages are computed on read by the existing aggregation (present + late count as attended), so student pages, reports, exports and dashboards show corrected data immediately; HOD dashboard caches are invalidated on write.
- Not built: a student "correction request" queue. The brief's faculty dashboard item "pending corrections" has no data source without one, so the dashboard shows real *recent corrections* instead.

## 5. Schema changes (all additive)

| Collection | Change |
| --- | --- |
| `registrationrequests` | + `previousEducation`, `facultyEducation`, `experience`, `history[]`; index `{status, requestedRole, createdAt}` |
| `users` | + optional `previousEducation`, `facultyEducation`, `experience` (copied at approval) |
| `attendancecorrections` | **new**, append-only |
| `notifications` | + `dedupeKey`, unique partial index `{user, dedupeKey}`; new types `registration_request`, `attendance_corrected` |
| `messages` | + `clientMessageId`, unique partial index `{conversation, sender, clientMessageId}` |
| `attendances` | + indexes `{date, status}`, `{student, status}` |
| `qrsessions` | digest is now HMAC of an 8-char code (same field, same index) |
| `timetables` | duplicate `unique_timetable_per_class` index declaration removed |

### Migration

No data migration and no resets. Existing documents remain valid: old requests render "Not provided" for education; old notifications have no `dedupeKey`; old messages have no `clientMessageId`.

1. Deploy. Mongoose creates missing indexes on start (`autoIndex`). On a large production `attendances` collection build the two new indexes in a quiet window (`db.attendances.createIndex({date:1,status:1}); db.attendances.createIndex({student:1,status:1})`) before or during deploy.
2. QR sessions live at the moment of deploy (at most 5 minutes) stop validating; faculty regenerate.
3. If a database already has both `class_1` and `unique_timetable_per_class` on `timetables`, nothing changes for you; fresh databases now build cleanly.
4. Optional: set `ATTENDANCE_CORRECTION_WINDOW_DAYS` explicitly.

## 6. Testing

```bash
cd server
npm run test:unit                    # no database needed
MONGO_TEST_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0' npm run test:integration
PERF_TEST=1 MONGO_TEST_URI=... node --test ../tests/server/integration/performance.test.js
cd ../client && npm test && npx oxlint && npx vite build
```

Integration suites create a throw-away database per file and drop it afterwards (`PERF_KEEP=1` keeps it for `explain`). They skip, rather than fail, without `MONGO_TEST_URI`.

## 7. Known limits

- Cold computation of the HOD low-attendance list groups the whole attendance history: about 0.7 s at 65k records on a single shared CPU, linear in history. It is cached and served stale-while-revalidate, but at millions of rows the next step is per-student running counters.
- The HOD dashboard cache is per process; with several API instances each computes once per window.
- The general `/api` rate limiter runs before authentication, so it keys by IP (its `keyType: 'user'` option cannot apply). Behind one school NAT, raise `RATE_LIMIT_MAX_REQUESTS`; per-user limiters mounted after `protect` (QR scan, messages, attendance submit) are unaffected.
- `docs/openapi.yaml` was not regenerated; `API.md` lists the new endpoints.
- Badges poll; they are not push-based.
