# Attendance Register v23 Verification Report

## Scope

This release combines the prior v21/v22 remediation with `pasted_content_42.txt`. It does not change Faculty counts or Smart Seed scale, remove HTTP 409 responses, disable conflict validation, bypass stale-slot protection, or trust a browser-supplied timetable exclusion for save security.

## Exact traced findings

The route `PUT /api/timetables/:classId` receives a **class ID**. In the uploaded v22 controller, `upsertTimetable()` resolves the active timetable with `Timetable.findOne({ class: classDoc._id, isActive: true }).select('_id').lean()`, then passes that persisted `_id` into `findFacultyConflicts()`.

The uploaded v22 code already attempted to exclude `_id: { $ne: timetableId }`, but the external query did not also constrain the current class and the diagnostics did not separate internal from external results. The v23 path normalizes the resolved timetable ID to a Mongo ObjectId, excludes that exact document, and excludes the current class from external timetable candidates. The current class guard is defensive against stale duplicate records; it does not hide conflicts in other classes.

The uploaded v22 availability bug was confirmed in `getTimetableConflictDetails()`. The availability path creates a hypothetical requested slot with order and time but no Faculty. The old helper checked `slot.faculty` before examining persisted candidates, so it could not correctly compare the candidate Faculty against actual stored assignments.

## Before and after logic

### Availability

Before:

```js
const assignedFacultyId = slot.faculty;
if (!assignedFacultyId || !isSameId(assignedFacultyId, facultyId)) return [];
```

Here, `slot` may be the hypothetical requested slot and has no `faculty` field.

After:

```js
const sameTimetable = isSameId(timetable.class, classId)
  && isSameId(timetable._id, timetableId);
const day = dayEntry(timetable.days, dayOfWeek);
return (day?.slots || []).filter((candidate) => {
  if (!candidate.faculty
    || candidate.kind === PERIOD_KIND.BREAK
    || !isSameId(candidate.faculty, facultyId)) return false;
  if (sameTimetable && slotId && isSameId(candidate._id, slotId)) return false;
  return slotTimeOverlaps(candidate, slot);
});
```

The hypothetical slot supplies only the requested day/time overlap. The persisted candidate’s explicit `faculty` is compared with the candidate Faculty ID. Break and free slots remain non-blocking.

### PUT external conflict query

Before:

```js
const existingFilter = {
  isActive: true,
  'days.slots.faculty': { $in: facultyIds },
};
if (timetableId) existingFilter._id = { $ne: timetableId };
```

After:

```js
const activeTimetableId = normalizedObjectId(timetableId);
const currentClassId = normalizedObjectId(classId);
const existingFilter = {
  isActive: true,
  class: currentClassId ? { $ne: currentClassId } : { $ne: classId },
  'days.slots.faculty': { $in: facultyIds },
};
if (activeTimetableId) existingFilter._id = { $ne: activeTimetableId };
```

The save operation derives the active timetable from the class route and does not trust `excludeTimetableId` from the client. Same-week overlaps are collected separately as `internalConflicts`; overlaps from other timetable documents are collected as `externalConflicts`. Both remain authoritative HTTP 409 conditions.

## Diagnostics added

With `DEBUG_TIMETABLE_CONFLICTS=true`, the server now logs the complete submitted weekly assignment context before the external query, including `classId`, server-resolved `activeTimetableId`, observed optional `submittedTimetableId`, Faculty ID, day/order/time, and current slot ID. The conflict summary records `internalConflictCount`, `externalConflictCount`, `firstInternalConflict`, `firstExternalConflict`, exact slot/time fields, conflicting timetable/class IDs, and whether each reported conflicting timetable/class matches the active edit.

The client save path sends all seven days and now preserves valid existing nested slot `_id` values. The successful response is normalized before it becomes current timetable state.

## Automated verification

| Gate | Result |
|---|---:|
| Server test suite | **57 passed, 0 failed** |
| Focused timetable tests | **6 passed, 0 failed** |
| Client test suite | **22 passed, 0 failed** |
| Client lint | **Passed with 0 warnings/errors** |
| Client production build | **Passed** |
| Server syntax checks | **Passed for all `server/src/**/*.js` files** |
| OpenAPI validation | **Passed; 47 documented paths** |
| Server dependency audit | **0 vulnerabilities** |
| Client dependency audit | **0 vulnerabilities** |
| No-Mongo seed guard | **Refused safely; status 1** |
| No-Mongo timetable audit guard | **Refused safely; status 1** |
| No-Mongo timetable diagnosis guard | **Refused safely; status 1** |
| Independent archive extraction | **Passed; 239 files extracted and excluded-artifact scan passed** |

The complete gate output is in `verification/v23-gates.log`.

## Live verification boundary

MongoDB, Redis, authenticated browser sessions, and the user’s live database are not available in this sandbox. This report therefore does not claim that the user’s exact class now returns HTTP 200 on unchanged save, or that the live 34 conflict records have been proven internal versus external. The new diagnostics are specifically intended to establish that evidence in the user’s environment.

After replacing the running v21/v22 server with this source, enable `DEBUG_TIMETABLE_CONFLICTS=true`, restart the backend, load the same class, and save it unchanged. Confirm that the log shows the class ID, the server-resolved timetable `_id`, a seven-day submitted payload, and `externalConflictCount: 0` when the seed is conflict-free. A deliberate same-week duplicate Faculty assignment should show an internal conflict and remain HTTP 409. A genuine same-time assignment in another class should show an external conflict and remain HTTP 409. A valid full-week payload should return HTTP 200 and persist after reload.

The raw slot-ID and all-subject-count requirements from the previous release remain included. `npm run validate:timetables` must report zero missing/invalid/duplicate raw slot IDs, and Academic Management continues to merge bounded subject pages rather than relying on the first page.

## Packaging

The final v23 archive is source-only and excludes `node_modules`, client build output, coverage, logs, `.env` files, repository metadata, credentials, and external harness artifacts. It is independently extracted and checked before delivery; the final archive checksum and byte size are reported outside the archive. The approved `/favicon.png` asset remains intentionally absent pending the owner’s PNG asset.
