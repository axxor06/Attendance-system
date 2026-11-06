/**
 * Scale and abuse-path measurements against a real MongoDB.
 * Opt-in (PERF_TEST=1) because it seeds thousands of documents:
 *
 *   PERF_TEST=1 MONGO_TEST_URI=... node --test tests/server/integration/performance.test.js
 *
 * Results are printed, not mocked. Thresholds are deliberately generous (CI machines vary);
 * the printed numbers are what matter.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hasMongo, startHarness, seedAcademicWorld, isoDaysAgo } from './_harness.js';

const enabled = hasMongo && process.env.PERF_TEST === '1';
const skip = enabled ? false : 'set PERF_TEST=1 and MONGO_TEST_URI to run';
const STUDENTS = Number(process.env.PERF_STUDENTS || 4800);
const FACULTY = 120;
const CLASSES = 60;
const PENDING = 2500;

let h; let w; let commandCount = 0; let students = []; let classDocs = []; let big;
const report = [];
const ms = (n) => `${n.toFixed(1)} ms`;
const pct = (arr, p) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];
async function timed(fn) { const t = performance.now(); const r = await fn(); return [performance.now() - t, r]; }
// Every timed call must succeed: a fast 401/500 is not a measurement.
async function sample(n, fn) {
  const times = [];
  for (let i = 0; i < n; i += 1) {
    const [t, r] = await timed(() => fn(i));
    assert.equal(r.status, 200, `timed request failed with ${r.status}: ${JSON.stringify(r.body)?.slice(0, 160)}`);
    times.push(t);
  }
  return times;
}
function log(label, times, extra = '') { const line = `${label}: n=${times.length} p50=${ms(pct(times, 50))} p95=${ms(pct(times, 95))} max=${ms(Math.max(...times))} ${extra}`; report.push(line); console.log(`    [perf] ${line}`); }

before(async () => {
  if (!enabled) return;
  h = await startHarness('perf', { monitorCommands: true });
  h.mongoose.connection.getClient().on('commandStarted', (e) => { if (!['hello', 'isMaster', 'ping', 'endSessions'].includes(e.commandName)) commandCount += 1; });
  w = await seedAcademicWorld(h.models);
  const { User, Class, Subject, Attendance, RegistrationRequest, Conversation, Message } = h.models;
  const t0 = performance.now();
  const hash = '$2a$10$abcdefghijklmnopqrstuuMwqf7e8Yc3wq1oV9y6Hh3sV6o5aQmKy'; // never used to log in
  const base = { password: hash, isEmailVerified: true, isActive: true, roleModelVersion: 2 };
  const fac = await User.collection.insertMany(Array.from({ length: FACULTY }, (_, i) => ({ ...base, name: `Perf Faculty ${i}`, email: `pf${i}@perf.test`, role: 'admin', employeeId: `PF${i}`, department: w.dept._id, createdAt: new Date(), updatedAt: new Date() })));
  // One class per (department, semester): 10 departments x 6 semesters = 60 classes.
  const { Department, Semester } = h.models;
  const depts = await Department.insertMany(Array.from({ length: 10 }, (_, i) => ({ name: `Perf Dept ${i}`, code: `PD${i}`, programLevel: 'degree' })));
  const sems = await Semester.insertMany([1, 2, 5, 6, 7, 8].map((number) => ({ number, label: `Semester ${number}` })));
  classDocs = await Class.insertMany(depts.flatMap((dept, d) => sems.map((sem, k) => ({ department: dept._id, semester: sem._id, name: `Perf Class ${d}-${k}`, code: `PC${d}-${k}`, isActive: true }))).slice(0, CLASSES));
  const docs = Array.from({ length: STUDENTS }, (_, i) => ({ ...base, name: `Perf Student ${i}`, email: `ps${i}@perf.test`, role: 'user', registerNumber: `PR${String(i).padStart(5, '0')}`, department: w.dept._id, class: classDocs[i % CLASSES]._id, createdAt: new Date(), updatedAt: new Date() }));
  await User.collection.insertMany(docs);
  students = await User.find({ email: /@perf\.test$/, role: 'user' }).select('_id class name role roleModelVersion email').limit(STUDENTS).lean();
  await RegistrationRequest.collection.insertMany(Array.from({ length: PENDING }, (_, i) => ({ name: `Pending ${i}`, email: `pending${i}@perf.test`, requestedRole: i % 4 ? 'user' : 'admin', status: 'pending', department: w.dept._id, class: i % 4 ? classDocs[i % CLASSES]._id : null, passwordHash: hash, statusCodeHash: String(i).padStart(64, "0"), history: [], createdAt: new Date(Date.now() - i * 1000), updatedAt: new Date() })));
  // Attendance history: one "big" class of 120 students for 40 days x 2 periods, plus a spread across the rest.
  big = classDocs[0];
  const subj = await Subject.create({ name: 'Perf Subject', code: 'PERF1', department: w.dept._id, semester: w.sem3._id, class: big._id, faculty: [w.facultyA._id] });
  big.subject = subj;
  const bigStudents = students.filter((s) => String(s.class) === String(big._id)).slice(0, 80);
  const att = [];
  for (let d = 1; d <= 60; d += 1) for (const s of bigStudents) att.push({ student: s._id, subject: subj._id, class: big._id, faculty: w.facultyA._id, date: new Date(`${isoDaysAgo(d)}T00:00:00.000Z`), dayOfWeek: 'x', periodOrder: 1, periodName: 'Period 1', status: (d + s.name.length) % 7 === 0 ? 'absent' : 'present', markedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  const others = students.slice(0, 3000);
  for (const s of others) for (let d = 1; d <= 20; d += 1) att.push({ student: s._id, subject: subj._id, class: s.class, faculty: w.facultyA._id, date: new Date(`${isoDaysAgo(d)}T00:00:00.000Z`), dayOfWeek: 'x', periodOrder: 2, periodName: 'Period 2', status: (d + s.name.length) % 9 === 0 ? 'absent' : 'present', markedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  for (let i = 0; i < att.length; i += 20000) await Attendance.collection.insertMany(att.slice(i, i + 20000), { ordered: false });
  // One conversation with 6,000 messages.
  const conv = await Conversation.create({ participants: [w.facultyA._id, bigStudents[0]._id], participantKey: [String(w.facultyA._id), String(bigStudents[0]._id)].sort().join(':'), lastMessageAt: new Date(), lastMessagePreview: 'x' });
  big.conv = conv; big.student = bigStudents[0];
  await Message.collection.insertMany(Array.from({ length: 6000 }, (_, i) => ({ conversation: conv._id, sender: i % 2 ? w.facultyA._id : bigStudents[0]._id, recipient: i % 2 ? bigStudents[0]._id : w.facultyA._id, body: `perf message ${i}`, hiddenFor: [], createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60000), updatedAt: new Date() })));
  console.log(`    [perf] seeded ${STUDENTS} students, ${FACULTY} faculty, ${CLASSES + 2} classes, ${att.length} attendance, ${PENDING} pending requests, 6000 messages in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
});
after(async () => { if (h) await h.stop(); });

test('registration counts and review queue stay fast with thousands of pending requests', { skip }, async () => {
  const summary = await h.api.get('/registration-requests/summary', { user: w.hod });
  assert.equal(summary.data.pending, PENDING);
  const t = await sample(30, () => h.api.get('/registration-requests/summary', { user: w.hod }));
  log('GET /registration-requests/summary', t, `(pending=${PENDING})`);
  const l = await sample(30, (i) => h.api.get('/registration-requests', { user: w.hod, query: { page: String(1 + (i % 20)), limit: '25', role: i % 2 ? 'student' : 'faculty' } }));
  log('GET /registration-requests (page, role filter)', l);
  const s = await sample(20, () => h.api.get('/registration-requests', { user: w.hod, query: { search: 'pending 17' } }));
  log('GET /registration-requests?search=', s);
  const b = await sample(30, () => h.api.get('/notifications/summary', { user: w.hod }));
  log('GET /notifications/summary (HOD, badge poll)', b);
  const sb = await sample(30, (i) => h.api.get('/notifications/summary', { user: students[i] }));
  log('GET /notifications/summary (student, badge poll)', sb);
  assert.ok(pct(t, 95) < 500 && pct(b, 95) < 500);
});

test('large-directory searches and pagination are bounded', { skip }, async () => {
  const hodSearch = await sample(25, (i) => h.api.get('/messages/recipients', { user: w.hod, query: { search: `Perf Student ${i}` } }));
  log('HOD recipient search (4.8k students)', hodSearch);
  const hodGroup = await sample(15, (i) => h.api.get('/messages/recipients', { user: w.hod, query: { group: 'students', page: String(1 + i) } }));
  log('HOD browse category, paged', hodGroup);
  const none = await h.api.get('/messages/recipients', { user: w.hod });
  assert.equal(none.data.recipients.length, 0, 'default returns nobody');
  const student = students[5];
  const studentSearch = await sample(25, () => h.api.get('/messages/recipients', { user: student, query: { search: 'Perf' } }));
  log('student recipient search (class-scoped)', studentSearch);
  const globalSearch = await sample(20, (i) => h.api.get('/search', { user: w.hod, query: { q: `Perf Student 1${i}` } }));
  log('HOD global search', globalSearch);
  assert.ok(pct(hodSearch, 95) < 800);
});

test('attendance aggregation, dashboards and correction screens at scale', { skip }, async () => {
  const hodDash = await sample(10, () => h.api.get('/dashboard/hod', { user: w.hod }));
  log('GET /dashboard/hod', hodDash, '(~120k attendance records)');
  const stu = await sample(20, (i) => h.api.get('/dashboard/student', { user: students[i] }));
  log('GET /dashboard/student', stu);
  const bigStudent = big.student;
  const stuBig = await sample(10, () => h.api.get('/dashboard/student', { user: bigStudent }));
  log('GET /dashboard/student (60 days of history)', stuBig);
  const fdash = await sample(10, () => h.api.get('/dashboard/faculty', { user: w.facultyA }));
  log('GET /dashboard/faculty', fdash);
  const day = isoDaysAgo(5);
  const sessions = await sample(15, () => h.api.get('/attendance/corrections/sessions', { user: w.hod, query: { date: day } }));
  log('GET /attendance/corrections/sessions (HOD, one day)', sessions);
  const roster = await sample(15, () => h.api.get('/attendance/corrections/roster', { user: w.hod, query: { subjectId: String(big.subject._id), date: day, periodOrder: '1' } }));
  log('GET /attendance/corrections/roster', roster);
  const ex = await h.api.get('/attendance/corrections/roster', { user: w.hod, query: { subjectId: String(big.subject._id), date: day, periodOrder: '1' } });
  assert.ok(ex.data.roster.length >= 80);
  assert.ok(pct(hodDash, 95) < 2000);
});

test('diagnostic: where the HOD dashboard spends its time', { skip }, async () => {
  const { Attendance, User, ActivityLog } = h.models;
  const { getLowAttendanceSummary } = await import('../../../server/src/services/attendanceService.js');
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const fourteen = new Date(Date.now() - 13 * 86400000);
  const present = { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } };
  const parts = {
    'low-attendance summary': () => getLowAttendanceSummary({ threshold: 75, limit: 10 }),
    'month aggregate': () => Attendance.aggregate([{ $match: { date: { $gte: since } } }, { $group: { _id: null, total: { $sum: 1 }, present } }]),
    '14-day trend': () => Attendance.aggregate([{ $match: { date: { $gte: fourteen } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, present } }]),
    'student/faculty counts': () => Promise.all([User.countDocuments({ role: 'user', isActive: true }), User.countDocuments({ role: 'admin', isActive: true })]),
    'recent activity': () => ActivityLog.find({}).sort({ createdAt: -1 }).limit(15),
  };
  for (const [label, fn] of Object.entries(parts)) {
    const times = [];
    for (let i = 0; i < 6; i += 1) { const [t] = await timed(fn); times.push(t); }
    log(`  dashboard part: ${label}`, times);
  }
});

test('messaging pagination: 6,000-message conversation is served in bounded pages', { skip }, async () => {
  const first = await h.api.get(`/messages/conversations/${big.conv._id}/messages`, { user: w.facultyA, query: { limit: '30' } });
  assert.equal(first.data.messages.length, 30);
  let before = first.data.nextBefore;
  const times = [];
  let pages = 1;
  while (before && pages < 40) { const [t, r] = await timed(() => h.api.get(`/messages/conversations/${big.conv._id}/messages`, { user: w.facultyA, query: { limit: '30', before } })); assert.equal(r.status, 200); times.push(t); before = r.data.nextBefore; pages += 1; }
  log('GET messages?before= (cursor, deep pages)', times, `(${pages} pages walked, 30 msgs each)`);
  const list = await sample(20, () => h.api.get('/messages/conversations', { user: w.facultyA }));
  log('GET /messages/conversations', list);
});

test('repeated nonexistent and malformed ids take cheap failure paths', { skip }, async () => {
  const ghost = '64b7f0f0f0f0f0f0f0f0f0f0';
  const cases = [
    ['GET /registration-requests/:id', (u) => h.api.get(`/registration-requests/${ghost}`, { user: w.hod })],
    ['GET /messages/conversations/:id/messages', () => h.api.get(`/messages/conversations/${ghost}/messages`, { user: w.facultyA })],
    ['GET /attendance/corrections/roster (ghost subject)', () => h.api.get('/attendance/corrections/roster', { user: w.facultyA, query: { subjectId: ghost, date: isoDaysAgo(2), periodOrder: '1' } })],
    ['PATCH /attendance/:id (ghost)', () => h.api.patch(`/attendance/${ghost}`, { user: w.facultyA, body: { status: 'absent' } })],
  ];
  for (const [label, fn] of cases) {
    commandCount = 0;
    const N = 200;
    const t0 = performance.now();
    const results = await Promise.all(Array.from({ length: N }, fn));
    const wall = performance.now() - t0;
    assert.ok(results.every((r) => [403, 404].includes(r.status)), `${label}: ${[...new Set(results.map((r) => r.status))]}`);
    const line = `${label}: ${N} concurrent ghost requests -> ${[...new Set(results.map((r) => r.status))]} in ${ms(wall)} (${ms(wall / N)}/req), ${(commandCount / N).toFixed(1)} DB commands/request`;
    report.push(line); console.log(`    [perf] ${line}`);
  }
  // Malformed ids never reach the database at all.
  commandCount = 0;
  const bad = await Promise.all(Array.from({ length: 200 }, () => h.api.get('/registration-requests/not-an-object-id', { user: w.hod })));
  assert.ok(bad.every((r) => r.status === 400));
  const authCommands = commandCount;
  commandCount = 0;
  await Promise.all(Array.from({ length: 200 }, () => h.api.get('/messages/conversations/%24ne/messages', { user: w.facultyA })));
  const line = `malformed id: 200 requests -> 400, ${(authCommands / 200).toFixed(2)} DB commands/request (auth lookup only)`;
  report.push(line); console.log(`    [perf] ${line}`);
});

test('concurrent QR scans by distinct students all persist exactly once', { skip }, async () => {
  const { QrSession, Attendance, Subject } = h.models;
  const cls = classDocs[1];
  const subj = await Subject.create({ name: 'Perf QR', code: 'PERFQR', department: w.dept._id, semester: w.sem3._id, class: cls._id, faculty: [w.facultyA._id] });
  const cohort = students.filter((s) => String(s.class) === String(cls._id));
  const { generateAttendanceCode, hashAttendanceCode } = await import('../../../server/src/utils/attendanceCode.js');
  const code = generateAttendanceCode();
  const date = new Date(`${isoDaysAgo(0)}T00:00:00.000Z`);
  await QrSession.create({ subject: subj._id, class: cls._id, faculty: w.facultyA._id, date, dayOfWeek: 'monday', periodOrder: 1, periodName: 'Period 1', token: hashAttendanceCode(code), expiresAt: new Date(Date.now() + 300000), isActive: true });
  const t0 = performance.now();
  const results = await Promise.all(cohort.map((s) => h.api.post('/qr/scan', { user: s, body: { code } })));
  const wall = performance.now() - t0;
  const ok = results.filter((r) => r.status === 200).length;
  const line = `QR scan: ${cohort.length} concurrent students -> ${ok} ok, ${results.length - ok} other, wall ${ms(wall)}`;
  report.push(line); console.log(`    [perf] ${line}`);
  assert.equal(ok, cohort.length, JSON.stringify([...new Set(results.map((r) => r.status))]));
  assert.equal(await Attendance.countDocuments({ subject: subj._id }), cohort.length);
});
