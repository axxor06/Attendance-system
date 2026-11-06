import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hasMongo, startHarness, seedAcademicWorld, isoDaysAgo } from './_harness.js';
import { ATTENDANCE_CODE_ALPHABET } from '../../../server/src/config/constants.js';

const skip = hasMongo ? false : 'MONGO_TEST_URI is not set';
let h; let w;
const today = isoDaysAgo(0);

before(async () => {
  if (!hasMongo) return;
  h = await startHarness('qr');
  w = await seedAcademicWorld(h.models);
});
after(async () => { if (h) await h.stop(); });

async function generate(user = w.facultyA, subject = w.subjectA, periodOrder = 1) {
  return h.api.post('/qr/generate', { user, body: { subjectId: String(subject._id), date: today, periodOrder } });
}

test('generate returns a short random 8-character code and stores only a keyed digest', { skip }, async () => {
  const res = await generate();
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const { code } = res.data;
  assert.match(code, new RegExp(`^[${ATTENDANCE_CODE_ALPHABET}]{8}$`));
  assert.ok(!/[01OIL]/.test(code), 'no ambiguous characters');
  const session = await h.models.QrSession.findById(res.data.sessionId).select('+token');
  assert.notEqual(session.token, code);
  assert.match(session.token, /^[a-f0-9]{64}$/);
  assert.ok(session.expiresAt > new Date());
  const codes = new Set();
  for (let i = 0; i < 25; i += 1) { codes.add((await generate()).data.code); }
  assert.ok(codes.size >= 24, 'codes are unpredictable, not sequential or repeated');
});

test('only the assigned faculty can generate a code', { skip }, async () => {
  assert.equal((await generate(w.facultyB, w.subjectA)).status, 403);
  assert.equal((await h.api.post('/qr/generate', { user: w.students[0], body: { subjectId: String(w.subjectA._id), date: today, periodOrder: 1 } })).status, 403);
});

test('valid manual code marks present exactly once; repeat is 409 and never duplicates', { skip }, async () => {
  const { data } = await generate();
  const ok = await h.api.post('/qr/scan', { user: w.students[0], body: { code: data.code.toLowerCase().replace(/^(.{4})/, '$1 ') } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const record = await h.models.Attendance.findOne({ student: w.students[0]._id, subject: w.subjectA._id });
  assert.equal(record.status, 'present');
  const again = await h.api.post('/qr/scan', { user: w.students[0], body: { code: data.code } });
  assert.equal(again.status, 409);
  assert.equal(await h.models.Attendance.countDocuments({ student: w.students[0]._id, subject: w.subjectA._id }), 1);
});

test('invalid, malformed, wrong-class and unknown codes are rejected', { skip }, async () => {
  const { data } = await generate();
  assert.equal((await h.api.post('/qr/scan', { user: w.students[1], body: { code: 'SHORT' } })).status, 400);
  assert.equal((await h.api.post('/qr/scan', { user: w.students[1], body: { code: 'O0I1L0O0' } })).status, 400);
  assert.equal((await h.api.post('/qr/scan', { user: w.students[1], body: { code: 'ABCDEFGH' } })).status, 400);
  assert.equal((await h.api.post('/qr/scan', { user: w.students[1], body: {} })).status, 400);
  // A student of another class cannot use (or learn about) this class's code.
  const wrongClass = await h.api.post('/qr/scan', { user: w.outsider, body: { code: data.code } });
  assert.equal(wrongClass.status, 400);
  assert.equal(await h.models.Attendance.countDocuments({ student: w.outsider._id }), 0);
  // Faculty cannot scan.
  assert.equal((await h.api.post('/qr/scan', { user: w.facultyA, body: { code: data.code } })).status, 403);
  assert.equal((await h.api.post('/qr/scan', { body: { code: data.code } })).status, 401);
});

test('expired and superseded codes are rejected', { skip }, async () => {
  const first = await generate();
  const second = await generate();
  const superseded = await h.api.post('/qr/scan', { user: w.students[1], body: { code: first.data.code } });
  assert.equal(superseded.status, 400, 'regenerating invalidates the previous code');
  await h.models.QrSession.updateOne({ _id: second.data.sessionId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const expired = await h.api.post('/qr/scan', { user: w.students[1], body: { code: second.data.code } });
  assert.equal(expired.status, 410);
  assert.equal(await h.models.Attendance.countDocuments({ student: w.students[1]._id }), 0);
});

test('student outside the subject roster is refused; wrong-subject codes do not leak across subjects', { skip }, async () => {
  await h.models.Subject.updateOne({ _id: w.subjectA._id }, { $set: { students: [w.students[0]._id, w.students[1]._id] } });
  const { data } = await generate();
  const refused = await h.api.post('/qr/scan', { user: w.students[2], body: { code: data.code } });
  assert.equal(refused.status, 403);
  assert.equal(await h.models.Attendance.countDocuments({ student: w.students[2]._id }), 0);
  await h.models.Subject.updateOne({ _id: w.subjectA._id }, { $set: { students: [] } });
});

test('existing faculty-marked record is never overwritten or misreported as present', { skip }, async () => {
  await h.models.Attendance.deleteMany({});
  await h.models.Attendance.create({
    student: w.students[2]._id, subject: w.subjectA._id, class: w.classA._id, faculty: w.facultyA._id,
    date: new Date(`${today}T00:00:00.000Z`), dayOfWeek: 'x', periodOrder: 1, periodName: 'Period 1', status: 'absent',
  });
  const { data } = await generate();
  const res = await h.api.post('/qr/scan', { user: w.students[2], body: { code: data.code } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code ?? res.body.code, 'ATTENDANCE_ALREADY_MARKED', JSON.stringify(res.body));
  const record = await h.models.Attendance.findOne({ student: w.students[2]._id });
  assert.equal(record.status, 'absent');
});

test('concurrent scans: one student, many simultaneous submissions -> one record', { skip }, async () => {
  await h.models.Attendance.deleteMany({});
  const { data } = await generate();
  const results = await Promise.all(Array.from({ length: 15 }, () => h.api.post('/qr/scan', { user: w.students[1], body: { code: data.code } })));
  assert.equal(results.filter((r) => r.status === 200).length, 1, JSON.stringify(results.map((r) => r.status)));
  assert.equal(results.filter((r) => r.status === 409).length, 14);
  assert.equal(await h.models.Attendance.countDocuments({ student: w.students[1]._id }), 1);
});

test('concurrent scans by different students all persist', { skip }, async () => {
  await h.models.Attendance.deleteMany({});
  const { data } = await generate();
  const results = await Promise.all(w.students.map((s) => h.api.post('/qr/scan', { user: s, body: { code: data.code } })));
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  assert.equal(await h.models.Attendance.countDocuments({ subject: w.subjectA._id, status: 'present' }), 3);
  const stats = await h.api.get('/qr/stats', { user: w.facultyA, query: { subjectId: String(w.subjectA._id), date: today, periodOrder: 1 } });
  assert.equal(stats.data.session.scannedCount, 3);
});

test('legacy `token` field is still accepted for older clients', { skip }, async () => {
  await h.models.Attendance.deleteMany({});
  const { data } = await generate();
  const res = await h.api.post('/qr/scan', { user: w.students[0], body: { token: data.code } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});
