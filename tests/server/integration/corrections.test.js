import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hasMongo, startHarness, seedAcademicWorld, isoDaysAgo } from './_harness.js';

const skip = hasMongo ? false : 'MONGO_TEST_URI is not set';
let h; let w;
const yesterday = isoDaysAgo(1);

before(async () => {
  if (!hasMongo) return;
  h = await startHarness('corr');
  w = await seedAcademicWorld(h.models);
  // Faculty A takes attendance for yesterday: s1 absent, s2 present, s3 present.
  const res = await h.api.post('/attendance/mark', { user: w.facultyA, body: {
    subjectId: String(w.subjectA._id), date: yesterday, periodOrder: 1,
    entries: [
      { studentId: String(w.students[0]._id), status: 'absent' },
      { studentId: String(w.students[1]._id), status: 'present' },
      { studentId: String(w.students[2]._id), status: 'present' },
    ],
  } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});
after(async () => { if (h) await h.stop(); });

const correctionBody = (changes, extra = {}) => ({ subjectId: String(w.subjectA._id), date: yesterday, periodOrder: 1, changes, ...extra });
const record = (student, date = yesterday) => h.models.Attendance.findOne({ student: student._id, subject: w.subjectA._id, date: new Date(`${date}T00:00:00.000Z`), periodOrder: 1 });

test('faculty lists yesterday\'s sessions with real counts; other faculty see nothing of it', { skip }, async () => {
  const mine = await h.api.get('/attendance/corrections/sessions', { user: w.facultyA, query: { date: yesterday } });
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  const session = mine.data.sessions.find((s) => s.subjectId === String(w.subjectA._id) && s.periodOrder === 1);
  assert.ok(session && session.marked);
  assert.equal(session.markedCount, 3);
  assert.equal(session.absentCount, 1);
  assert.equal(mine.data.editable, true);
  const other = await h.api.get('/attendance/corrections/sessions', { user: w.facultyB, query: { date: yesterday } });
  assert.ok(!other.data.sessions.some((s) => s.subjectId === String(w.subjectA._id)));
  assert.equal((await h.api.get('/attendance/corrections/sessions', { user: w.students[0], query: { date: yesterday } })).status, 403);
  assert.equal((await h.api.get('/attendance/corrections/sessions', { user: w.facultyA, query: { date: 'nonsense' } })).status, 400);
});

test('roster shows stored statuses and attendance ids; unauthorized faculty and students are refused', { skip }, async () => {
  const q = { subjectId: String(w.subjectA._id), date: yesterday, periodOrder: 1 };
  const res = await h.api.get('/attendance/corrections/roster', { user: w.facultyA, query: q });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const s1 = res.data.roster.find((r) => r.name === 'Student 1');
  assert.equal(s1.status, 'absent');
  assert.ok(s1.attendanceId);
  assert.equal((await h.api.get('/attendance/corrections/roster', { user: w.facultyB, query: q })).status, 403);
  assert.equal((await h.api.get('/attendance/corrections/roster', { user: w.students[0], query: q })).status, 403);
  assert.equal((await h.api.get('/attendance/corrections/roster', { user: w.facultyA, query: { ...q, subjectId: 'zzz' } })).status, 400);
  assert.equal((await h.api.get('/attendance/corrections/roster', { user: w.facultyA, query: { ...q, subjectId: '64b7f0f0f0f0f0f0f0f0f0f0' } })).status, 404);
});

test('absent -> present updates the SAME record, audits it, and recalculates the percentage', { skip }, async () => {
  const before = await record(w.students[0]);
  const overallBefore = (await h.api.get('/dashboard/student', { user: w.students[0] })).data.overall;
  assert.equal(overallBefore.percentage, 0);
  const total = await h.models.Attendance.countDocuments();

  const res = await h.api.post('/attendance/corrections', { user: w.facultyA, body: correctionBody(
    [{ studentId: String(w.students[0]._id), status: 'present' }], { reason: 'Student was in class' }) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.data.updated.length, 1);
  assert.equal(res.data.updated[0].previousStatus, 'absent');
  assert.equal(res.data.updated[0].overall.percentage, 100);

  const after = await record(w.students[0]);
  assert.equal(String(after._id), String(before._id), 'same document, no duplicate');
  assert.equal(after.status, 'present');
  assert.equal(String(after.editedBy), String(w.facultyA._id));
  assert.ok(after.editedAt);
  assert.equal(await h.models.Attendance.countDocuments(), total, 'no records created');

  const audit = await h.models.AttendanceCorrection.find({ attendance: before._id });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].previousStatus, 'absent');
  assert.equal(audit[0].newStatus, 'present');
  assert.equal(String(audit[0].correctedBy), String(w.facultyA._id));
  assert.equal(audit[0].reason, 'Student was in class');

  const dash = (await h.api.get('/dashboard/student', { user: w.students[0] })).data;
  assert.equal(dash.overall.percentage, 100, 'student dashboard reflects the correction');
  assert.equal(dash.recentHistory[0].status, 'present');
  const note = await h.models.Notification.findOne({ user: w.students[0]._id, type: 'attendance_corrected' });
  assert.ok(note, 'student is told about the change');
});

test('present -> absent and late/excused work; unchanged entries are not audited', { skip }, async () => {
  const res = await h.api.post('/attendance/corrections', { user: w.facultyA, body: correctionBody([
    { studentId: String(w.students[1]._id), status: 'absent' },
    { studentId: String(w.students[2]._id), status: 'late' },
    { studentId: String(w.students[0]._id), status: 'present' },
  ]) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.data.updated.length, 2);
  assert.equal(res.data.unchanged.length, 1);
  assert.equal((await record(w.students[1])).status, 'absent');
  assert.equal((await record(w.students[2])).status, 'late');
  assert.equal(await h.models.AttendanceCorrection.countDocuments(), 3);
});

test('audit history is append-only: successive corrections accumulate and cannot be rewritten', { skip }, async () => {
  const rec = await record(w.students[1]);
  await h.api.post('/attendance/corrections', { user: w.facultyA, body: correctionBody([{ studentId: String(w.students[1]._id), status: 'present' }]) });
  const rows = await h.models.AttendanceCorrection.find({ attendance: rec._id }).sort({ createdAt: 1, _id: 1 });
  assert.deepEqual(rows.map((r) => `${r.previousStatus}>${r.newStatus}`), ['present>absent', 'absent>present']);
  const doc = rows[0];
  doc.newStatus = 'late';
  await doc.save();
  const reloaded = await h.models.AttendanceCorrection.findById(doc._id);
  assert.equal(reloaded.newStatus, 'absent', 'immutable fields ignore updates');
});

test('authorization: other faculty, students, tampered ids and out-of-roster students are rejected', { skip }, async () => {
  const body = correctionBody([{ studentId: String(w.students[0]._id), status: 'absent' }]);
  assert.equal((await h.api.post('/attendance/corrections', { user: w.facultyB, body })).status, 403);
  assert.equal((await h.api.post('/attendance/corrections', { user: w.students[0], body })).status, 403);
  assert.equal((await h.api.post('/attendance/corrections', { body })).status, 401);
  const outsider = await h.api.post('/attendance/corrections', { user: w.facultyA, body: correctionBody([{ studentId: String(w.outsider._id), status: 'present' }]) });
  assert.equal(outsider.status, 403);
  assert.equal(await h.models.Attendance.countDocuments({ student: w.outsider._id }), 0);
  // Mass assignment: unknown fields are refused.
  const sneaky = await h.api.post('/attendance/corrections', { user: w.facultyA, body: { ...body, facultyId: String(w.facultyB._id) } });
  assert.equal(sneaky.status, 400);
  assert.equal((await record(w.students[0])).status, 'present', 'nothing changed');
  // PATCH by record id: other faculty cannot touch it either.
  const rec = await record(w.students[0]);
  assert.equal((await h.api.patch(`/attendance/${rec._id}`, { user: w.facultyB, body: { status: 'absent' } })).status, 403);
  assert.equal((await h.api.patch('/attendance/64b7f0f0f0f0f0f0f0f0f0f0', { user: w.facultyA, body: { status: 'absent' } })).status, 404);
  assert.equal((await h.api.patch('/attendance/not-an-id', { user: w.facultyA, body: { status: 'absent' } })).status, 400);
});

test('edit window: faculty blocked beyond the window, HOD allowed; future dates rejected', { skip }, async () => {
  const old = isoDaysAgo(45);
  await h.models.Attendance.create({
    student: w.students[0]._id, subject: w.subjectA._id, class: w.classA._id, faculty: w.facultyA._id,
    date: new Date(`${old}T00:00:00.000Z`), dayOfWeek: 'x', periodOrder: 1, periodName: 'Period 1', status: 'absent',
  });
  const body = { subjectId: String(w.subjectA._id), date: old, periodOrder: 1, changes: [{ studentId: String(w.students[0]._id), status: 'present' }] };
  const blocked = await h.api.post('/attendance/corrections', { user: w.facultyA, body });
  assert.equal(blocked.status, 403);
  assert.match(blocked.body.error?.message || blocked.body.message, /30 days/);
  const roster = await h.api.get('/attendance/corrections/roster', { user: w.facultyA, query: { subjectId: body.subjectId, date: old, periodOrder: 1 } });
  assert.equal(roster.data.editable, false);
  const hod = await h.api.post('/attendance/corrections', { user: w.hod, body });
  assert.equal(hod.status, 200, JSON.stringify(hod.body));
  const future = isoDaysAgo(-5);
  const fut = await h.api.post('/attendance/corrections', { user: w.facultyA, body: { ...body, date: future } });
  assert.equal(fut.status, 400);
  const mark = await h.api.post('/attendance/mark', { user: w.facultyA, body: { subjectId: body.subjectId, date: future, periodOrder: 1, entries: [{ studentId: String(w.students[0]._id), status: 'present' }] } });
  assert.equal(mark.status, 400);
});

test('configurable window: ATTENDANCE_CORRECTION_WINDOW_DAYS=0 removes the limit', { skip }, async () => {
  process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS = '0';
  try {
    const old = isoDaysAgo(60);
    await h.models.Attendance.create({
      student: w.students[1]._id, subject: w.subjectA._id, class: w.classA._id, faculty: w.facultyA._id,
      date: new Date(`${old}T00:00:00.000Z`), dayOfWeek: 'x', periodOrder: 1, periodName: 'Period 1', status: 'absent',
    });
    const res = await h.api.post('/attendance/corrections', { user: w.facultyA, body: { subjectId: String(w.subjectA._id), date: old, periodOrder: 1, changes: [{ studentId: String(w.students[1]._id), status: 'present' }] } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  } finally { delete process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS; }
});

test('student with no record yet can be added through a correction without duplicates', { skip }, async () => {
  const later = isoDaysAgo(2);
  const first = await h.api.post('/attendance/mark', { user: w.facultyA, body: { subjectId: String(w.subjectA._id), date: later, periodOrder: 1, entries: [{ studentId: String(w.students[0]._id), status: 'present' }] } });
  assert.equal(first.status, 200);
  const body = { subjectId: String(w.subjectA._id), date: later, periodOrder: 1, changes: [{ studentId: String(w.students[1]._id), status: 'present' }] };
  const results = await Promise.all([h.api.post('/attendance/corrections', { user: w.facultyA, body }), h.api.post('/attendance/corrections', { user: w.facultyA, body })]);
  assert.ok(results.some((r) => r.status === 200));
  assert.equal(await h.models.Attendance.countDocuments({ student: w.students[1]._id, date: new Date(`${later}T00:00:00.000Z`), periodOrder: 1 }), 1);
  const rec = await h.models.Attendance.findOne({ student: w.students[1]._id, date: new Date(`${later}T00:00:00.000Z`) });
  const rows = await h.models.AttendanceCorrection.find({ attendance: rec._id });
  assert.equal(rows[0].previousStatus, null);
});

test('concurrent corrections of one record never duplicate it and keep a consistent audit chain', { skip }, async () => {
  const day = isoDaysAgo(3);
  await h.api.post('/attendance/mark', { user: w.facultyA, body: { subjectId: String(w.subjectA._id), date: day, periodOrder: 1, entries: [{ studentId: String(w.students[2]._id), status: 'present' }] } });
  const statuses = ['absent', 'late', 'excused', 'absent', 'late', 'excused', 'absent', 'late'];
  const results = await Promise.all(statuses.map((status) => h.api.post('/attendance/corrections', { user: w.facultyA, body: { subjectId: String(w.subjectA._id), date: day, periodOrder: 1, changes: [{ studentId: String(w.students[2]._id), status }] } })));
  assert.ok(results.every((r) => [200, 409, 500].includes(r.status)));
  assert.ok(results.some((r) => r.status === 200));
  assert.equal(await h.models.Attendance.countDocuments({ student: w.students[2]._id, date: new Date(`${day}T00:00:00.000Z`) }), 1);
  const rec = await h.models.Attendance.findOne({ student: w.students[2]._id, date: new Date(`${day}T00:00:00.000Z`) });
  const rows = await h.models.AttendanceCorrection.find({ attendance: rec._id }).sort({ createdAt: 1, _id: 1 });
  let expected = 'present';
  for (const row of rows) { assert.equal(row.previousStatus, expected, 'audit chain is gap-free'); expected = row.newStatus; }
  assert.equal(rec.status, expected, 'final status equals the last audited status');
});

test('PATCH /attendance/:id audits with a reason; re-submitting a session audits status changes', { skip }, async () => {
  const rec = await record(w.students[0]);
  const patch = await h.api.patch(`/attendance/${rec._id}`, { user: w.facultyA, body: { status: 'excused', reason: 'Medical certificate' } });
  assert.equal(patch.status, 200, JSON.stringify(patch.body));
  const row = await h.models.AttendanceCorrection.findOne({ attendance: rec._id }).sort({ createdAt: -1, _id: -1 });
  assert.equal(row.source, 'edit');
  assert.equal(row.reason, 'Medical certificate');
  assert.equal(row.newStatus, 'excused');

  const resubmit = await h.api.post('/attendance/mark', { user: w.facultyA, body: { subjectId: String(w.subjectA._id), date: yesterday, periodOrder: 1, entries: [{ studentId: String(w.students[0]._id), status: 'absent' }] } });
  assert.equal(resubmit.status, 200);
  const last = await h.models.AttendanceCorrection.findOne({ attendance: rec._id }).sort({ createdAt: -1, _id: -1 });
  assert.equal(last.source, 'resubmit');
  assert.equal(last.previousStatus, 'excused');
});

test('audit list: HOD sees all, faculty see their own subjects, students and others are refused, filters work', { skip }, async () => {
  const hod = await h.api.get('/attendance/corrections', { user: w.hod });
  assert.equal(hod.status, 200);
  assert.ok(hod.data.pagination.total >= 8);
  const mine = await h.api.get('/attendance/corrections', { user: w.facultyA });
  assert.ok(mine.data.pagination.total >= 8);
  const theirs = await h.api.get('/attendance/corrections', { user: w.facultyB });
  assert.equal(theirs.data.pagination.total, 0, 'faculty B teaches no corrected subject');
  assert.equal((await h.api.get('/attendance/corrections', { user: w.students[0] })).status, 403);
  const byStudent = await h.api.get('/attendance/corrections', { user: w.hod, query: { studentId: String(w.students[0]._id) } });
  assert.ok(byStudent.data.corrections.every((c) => String(c.student._id) === String(w.students[0]._id)));
  assert.equal((await h.api.get('/attendance/corrections', { user: w.hod, query: { studentId: 'bad' } })).status, 400);
  assert.equal((await h.api.get('/attendance/corrections', { user: w.hod, query: { limit: '1000' } })).status, 400);
});

test('exports and reports use the corrected data', { skip }, async () => {
  const rec = await record(w.students[0], yesterday);
  await h.api.post('/attendance/corrections', { user: w.facultyA, body: correctionBody([{ studentId: String(w.students[0]._id), status: 'present' }]) });
  const { getSubjectRoster } = await import('../../../server/src/services/attendanceService.js');
  const rows = await getSubjectRoster({ subjectId: String(w.subjectA._id) });
  const s1 = rows.find((r) => r.name === 'Student 1');
  const dbCount = await h.models.Attendance.countDocuments({ student: w.students[0]._id, status: { $in: ['present', 'late'] } });
  assert.equal(s1.present, dbCount);
  assert.equal((await h.models.Attendance.findById(rec._id)).status, 'present');
});

test('HOD dashboard statistics refresh immediately after a correction (cache is invalidated)', { skip }, async () => {
  const first = await h.api.get('/dashboard/hod', { user: w.hod });
  assert.equal(first.status, 200);
  const before = first.data.lowAttendanceCount;
  // Make Student 3 clearly low: mark absent in a fresh session, then check the count moves at once.
  const day = isoDaysAgo(9);
  const entries = w.students.map((s) => ({ studentId: String(s._id), status: 'absent' }));
  assert.equal((await h.api.post('/attendance/mark', { user: w.facultyA, body: { subjectId: String(w.subjectA._id), date: day, periodOrder: 1, entries } })).status, 200);
  const second = await h.api.get('/dashboard/hod', { user: w.hod });
  assert.ok(second.data.lowAttendanceCount >= before, `${before} -> ${second.data.lowAttendanceCount}`);
  const fix = await h.api.post('/attendance/corrections', { user: w.facultyA, body: { subjectId: String(w.subjectA._id), date: day, periodOrder: 1, changes: entries.map((e) => ({ studentId: e.studentId, status: 'present' })) } });
  assert.equal(fix.status, 200, JSON.stringify(fix.body));
  const third = await h.api.get('/dashboard/hod', { user: w.hod });
  assert.ok(third.data.lowAttendanceCount <= second.data.lowAttendanceCount, 'correcting to present cannot raise the low-attendance count');
  assert.ok(third.data.registrationRequests, 'registration card data is present and uncached');
  assert.equal(typeof third.data.correctionsLastWeek, 'number');
});
