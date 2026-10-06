# Attendance Register v22 Verification Report

## Scope

This release applies the requirements in `pasted_content_39.txt` to the v21 source. It does not add Faculty accounts, change the Smart Seed Faculty target, remove `slotId` validation, substitute a class ID for a timetable-document ID, bypass stale-slot protection, or weaken authoritative timetable conflict validation.

## Implemented changes

| Area | Implementation |
|---|---|
| Raw timetable slot identity | Added `stableTimetableSlotId()` using a deterministic SHA-256-derived 24-hex Mongo ObjectId for each class/day/order coordinate. Smart Seed assigns the ID to every class, break, and free-period slot before the native MongoDB `updateOne` write. |
| Seed read-back gate | Smart Seed validates generated documents before writing, reads raw active timetable documents back, validates raw slot-ID integrity and overlap totals, and refuses completion when either condition fails. |
| Permanent raw audit | `npm run validate:timetables` now reports total, valid, missing, invalid, and duplicate slot IDs and exits nonzero for any raw slot-ID defect or actual Faculty overlap. |
| Staging diagnosis | `npm run diagnose:timetable-ids` now prints raw per-day slot IDs and missing/invalid/duplicate counts while preserving the class-ID versus timetable-document-ID distinction. |
| Client timetable IDs | `PeriodsPage` accepts only valid Mongo IDs and cannot turn malformed objects into `[object Object]`. It continues to send the current persisted `excludeTimetableId` and exact `slotId`; server validation remains active. |
| Academic Management counts | Added a bounded all-page loader that requests the existing subject endpoint at `limit=100`, follows its pagination metadata, merges all pages, and uses the complete set for class counts and expanded lists. The global server pagination limit and authorization remain unchanged. |
| Documentation | Updated `README.md`, `API.md`, `docs/openapi.yaml`, `PRODUCTION_CHECKLIST.md`, `SECURITY_FINAL_AUDIT.md`, and `CHANGELOG.md` with the new identity contract and staging proof requirements. |

## Automated verification

| Gate | Result |
|---|---:|
| Server tests | **55 passed, 0 failed** |
| Client tests | **22 passed, 0 failed** |
| Client lint | **Passed with 0 warnings/errors** |
| Client production build | **Passed** |
| Server JavaScript syntax checks | **Passed for all `server/src/**/*.js` files** |
| OpenAPI validation | **Passed; 47 documented paths** |
| Server dependency audit | **0 vulnerabilities** |
| Client dependency audit | **0 vulnerabilities** |
| No-Mongo seed guard | **Passed; refused with status 1 and `MONGO_URI not set.`** |
| No-Mongo timetable audit guard | **Passed; refused with status 1 and `MONGO_URI is required.`** |
| No-Mongo timetable diagnosis guard | **Passed; refused with status 1 and `MONGO_URI is required.`** |
| Final gate log | `verification/v22-gates.log` |

The focused tests cover deterministic coordinate stability, valid raw ObjectId acceptance, missing and duplicate slot detection, all-page subject merging, bounded page refusal, existing timetable conflict semantics, stale-ID contracts, and the unchanged security/RBAC contracts.

## Important evidence boundary

MongoDB, Redis, live authentication sessions, and the seeded application database were unavailable in the sandbox. Therefore, this report does **not** claim that the following live flows have passed: Smart Seed execution against the user’s database, raw `days[].slots[]._id` inspection after seed, equality between raw Mongo IDs and `GET /api/timetables/:classId` IDs, HTTP 200 availability for every current slot, unchanged full-week save HTTP 200, available-Faculty save persistence, deliberate occupied-Faculty HTTP 409 details, or all 80 live Academic Management counts.

The source-level diagnosis is highly plausible because Smart Seed previously used native MongoDB writes without explicit embedded slot IDs while availability intentionally checks raw `.lean()` slot membership. It remains **unverified in live MongoDB** until the staging procedure below is executed.

## Required staging procedure

Run against a disposable, backup-verified staging database with the application configured and authenticated as HOD:

```bash
cd server
npm ci --no-audit --no-fund
npm run seed
npm run validate:timetables
DIAGNOSTIC_TIMETABLE_IDS='<classId>,<timetableId>' npm run diagnose:timetable-ids
```

After the seed, inspect raw MongoDB documents directly and confirm every `timetables.days[].slots[]._id` is present, a real ObjectId, unique, and stable after a second seed run. Load a class through `GET /api/timetables/<classId>`, record the returned timetable `_id` and exact nested slot `_id`, then submit availability using the class ID, returned timetable ID as `excludeTimetableId`, and returned slot ID as `slotId`. Confirm valid requests return HTTP 200 and a deliberately stale or cross-class slot returns HTTP 400 with the existing stale-slot message.

Submit the freshly loaded weekly timetable unchanged and confirm HTTP 200. Assign a genuinely available Faculty member and confirm HTTP 200 plus persistence after reload. Assign a genuinely occupied Faculty member and confirm HTTP 409 with `TIMETABLE_CONFLICT` and exact Faculty/class/day/period/time details. Finally, open Academic Management, expand all ten departments and all 80 classes, and reconcile every displayed subject badge with the server’s subject records; no class may show a false zero because only the first subject page was loaded.

## Packaging policy

The v22 archive is source-only. It excludes `node_modules`, client build output, coverage, logs, `.env` files, repository metadata, credentials, and external harness artifacts. The supplied favicon requirement remains unchanged: `client/index.html` references `/favicon.png`, while the approved PNG asset remains intentionally absent pending the owner’s asset.
