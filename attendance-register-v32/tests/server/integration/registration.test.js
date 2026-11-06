import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hasMongo, startHarness, seedAcademicWorld } from './_harness.js';

const skip = hasMongo ? false : 'MONGO_TEST_URI is not set';
let h; let w;

before(async () => {
  if (!hasMongo) return;
  h = await startHarness('reg');
  w = await seedAcademicWorld(h.models);
});
after(async () => { if (h) await h.stop(); });

const studentPayload = (classId, overrides = {}) => ({
  requestedRole: 'student', name: 'New Student', email: 'new.student@example.test', password: 'Str0ng!Passw0rd#1', classId: String(classId),
  previousEducation: { level: 'class_12', institution: 'City Higher Secondary', boardOrUniversity: 'State Board', yearOfCompletion: 2025, percentage: 88.5 },
  ...overrides,
});
const facultyPayload = (departmentId, overrides = {}) => ({
  requestedRole: 'faculty', name: 'New Faculty', email: 'new.faculty@example.test', password: 'Str0ng!Passw0rd#1', departmentId: String(departmentId),
  facultyEducation: { qualification: 'M.Tech', specialization: 'Computer Science', institution: 'NIT Calicut', yearOfCompletion: 2018 },
  experience: { totalYears: 5, previousInstitution: 'ABC College', previousRole: 'Assistant Professor' },
  ...overrides,
});

test('student registration stores previous education, stays pending and notifies the HOD', { skip }, async () => {
  const res = await h.api.post('/registration-requests', { body: studentPayload(w.classA._id) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const saved = await h.models.RegistrationRequest.findOne({ email: 'new.student@example.test' });
  assert.equal(saved.status, 'pending');
  assert.equal(saved.previousEducation.level, 'class_12');
  assert.equal(saved.previousEducation.percentage, 88.5);
  assert.equal(await h.models.User.countDocuments({ email: 'new.student@example.test' }), 0, 'no account exists before approval');
  const notes = await h.models.Notification.find({ user: w.hod._id, type: 'registration_request' });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].isRead, false);
});

test('faculty registration stores education + experience; zero experience needs no workplace', { skip }, async () => {
  const ok = await h.api.post('/registration-requests', { body: facultyPayload(w.dept._id) });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const zero = await h.api.post('/registration-requests', { body: facultyPayload(w.dept._id, {
    email: 'fresh.grad@example.test', name: 'Fresh Grad',
    experience: { totalYears: 0, previousInstitution: 'should be dropped', previousRole: 'ignored' },
  }) });
  assert.equal(zero.status, 201, JSON.stringify(zero.body));
  const fresh = await h.models.RegistrationRequest.findOne({ email: 'fresh.grad@example.test' });
  assert.equal(fresh.experience.totalYears, 0);
  assert.equal(fresh.experience.previousInstitution, '');
});

test('education and experience validation rejects bad input', { skip }, async () => {
  const cases = [
    studentPayload(w.classA._id, { email: 'a1@example.test', previousEducation: { level: 'class_12', institution: 'X School', boardOrUniversity: 'Board', yearOfCompletion: 2025, percentage: 101 } }),
    studentPayload(w.classA._id, { email: 'a2@example.test', previousEducation: { level: 'phd', institution: 'X School', boardOrUniversity: 'Board', yearOfCompletion: 2025, percentage: 70 } }),
    studentPayload(w.classA._id, { email: 'a3@example.test', previousEducation: { level: 'degree', institution: 'X School', boardOrUniversity: 'Board', yearOfCompletion: 2025 } }),
    studentPayload(w.classA._id, { email: 'a4@example.test', previousEducation: { level: 'degree', institution: 'X School', boardOrUniversity: 'Board', yearOfCompletion: 2999, percentage: 70 } }),
    studentPayload(w.classA._id, { email: 'a5@example.test', previousEducation: { level: 'class_10', institution: 'X School', boardOrUniversity: 'Board', yearOfCompletion: 2020, percentage: 70.555 } }),
    studentPayload(w.classA._id, { email: 'a6@example.test', experience: { totalYears: 3 } }),
    facultyPayload(w.dept._id, { email: 'b1@example.test', experience: { totalYears: -1 } }),
    facultyPayload(w.dept._id, { email: 'b2@example.test', experience: { totalYears: 'abc' } }),
    facultyPayload(w.dept._id, { email: 'b3@example.test', experience: { totalYears: 4 } }),
    facultyPayload(w.dept._id, { email: 'b4@example.test', previousEducation: { level: 'degree' } }),
    facultyPayload(w.dept._id, { email: 'b5@example.test', role: 'super_admin' }),
  ];
  for (const body of cases) {
    const res = await h.api.post('/registration-requests', { body });
    assert.equal(res.status, 400, `${body.email} should be rejected: ${JSON.stringify(res.body)}`);
  }
  // Non-percentage systems: alternative result replaces the percentage.
  const alt = await h.api.post('/registration-requests', { body: studentPayload(w.classA._id, { email: 'alt@example.test', previousEducation: { level: 'other', levelOther: 'IB Diploma', institution: 'Intl School', boardOrUniversity: 'IB', yearOfCompletion: 2024, alternativeResult: 'Grade 38/45' } }) });
  assert.equal(alt.status, 201, JSON.stringify(alt.body));
});

test('duplicate email and concurrent submissions create one request and one notification', { skip }, async () => {
  const body = studentPayload(w.classA._id, { email: 'race@example.test', name: 'Racer' });
  const results = await Promise.all(Array.from({ length: 6 }, () => h.api.post('/registration-requests', { body })));
  assert.equal(results.filter((r) => r.status === 201).length, 1, JSON.stringify(results.map((r) => r.status)));
  assert.equal(await h.models.RegistrationRequest.countDocuments({ email: 'race@example.test' }), 1);
  const req = await h.models.RegistrationRequest.findOne({ email: 'race@example.test' });
  assert.equal(await h.models.Notification.countDocuments({ dedupeKey: `registration-request:${req._id}` }), 1);
});

test('pending applicant cannot sign in or use protected endpoints; sees a clear status only with the right password', { skip }, async () => {
  const wrong = await h.api.post('/auth/login', { body: { identifier: 'new.student@example.test', password: 'Wrong!Passw0rd#99' } });
  assert.equal(wrong.status, 401);
  const right = await h.api.post('/auth/login', { body: { identifier: 'new.student@example.test', password: 'Str0ng!Passw0rd#1' } });
  assert.equal(right.status, 403);
  assert.equal(right.body.error?.code ?? right.body.code, 'REGISTRATION_PENDING', JSON.stringify(right.body));
  assert.equal(right.body.accessToken, undefined);
  const noToken = await h.api.get('/notifications/summary');
  assert.equal(noToken.status, 401);
});

test('summary counts come from the database and are separate from notification counts', { skip }, async () => {
  const summary = await h.api.get('/registration-requests/summary', { user: w.hod });
  assert.equal(summary.status, 200);
  const pendingInDb = await h.models.RegistrationRequest.countDocuments({ status: 'pending' });
  assert.equal(summary.data.pending, pendingInDb);
  assert.equal(summary.data.students + summary.data.faculty, summary.data.pending);
  assert.ok(summary.data.faculty >= 2 && summary.data.students >= 2);

  const before = await h.api.get('/notifications/summary', { user: w.hod });
  assert.equal(before.data.pendingRegistrations, pendingInDb);
  assert.ok(before.data.unreadNotifications >= pendingInDb);

  // Reading every notification must NOT change the pending-request count.
  await h.api.patch('/notifications/read-all', { user: w.hod, body: {} });
  const afterRead = await h.api.get('/notifications/summary', { user: w.hod });
  assert.equal(afterRead.data.unreadNotifications, 0);
  assert.equal(afterRead.data.pendingRegistrations, pendingInDb);
});

test('only the HOD can list, view, approve or reject; others cannot see the data', { skip }, async () => {
  const req = await h.models.RegistrationRequest.findOne({ email: 'new.student@example.test' });
  for (const user of [w.facultyA, w.students[0]]) {
    assert.equal((await h.api.get('/registration-requests', { user })).status, 403);
    assert.equal((await h.api.get(`/registration-requests/${req._id}`, { user })).status, 403);
    assert.equal((await h.api.get('/registration-requests/summary', { user })).status, 403);
    assert.equal((await h.api.post(`/registration-requests/${req._id}/approve`, { user, body: { identifier: 'HACK1' } })).status, 403);
    assert.equal((await h.api.post(`/registration-requests/${req._id}/reject`, { user, body: { reason: 'nope nope' } })).status, 403);
  }
  assert.equal((await h.api.get('/registration-requests', { })).status, 401);
  assert.equal((await h.api.get('/registration-requests/not-an-id', { user: w.hod })).status, 400);
  const detail = await h.api.get(`/registration-requests/${req._id}`, { user: w.hod });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.request.previousEducation.institution, 'City Higher Secondary');
  assert.equal(detail.data.request.passwordHash, undefined);
});

test('approval creates the account, copies education, records the reviewer and decrements the count', { skip }, async () => {
  const before = (await h.api.get('/registration-requests/summary', { user: w.hod })).data;
  const req = await h.models.RegistrationRequest.findOne({ email: 'new.faculty@example.test' });
  const res = await h.api.post(`/registration-requests/${req._id}/approve`, { user: w.hod, body: { identifier: 'FAC900' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const user = await h.models.User.findOne({ email: 'new.faculty@example.test' });
  assert.equal(user.employeeId, 'FAC900');
  assert.equal(user.role, 'admin');
  assert.equal(user.experience.totalYears, 5);
  assert.equal(user.facultyEducation.qualification, 'M.Tech');
  const saved = await h.models.RegistrationRequest.findById(req._id).select('+passwordHash');
  assert.equal(saved.status, 'approved');
  assert.equal(String(saved.reviewedBy), String(w.hod._id));
  assert.ok(saved.reviewedAt);
  assert.ok(!saved.passwordHash, 'pending credential removed after approval');
  assert.deepEqual(saved.history.map((entry) => entry.status), ['pending', 'approved']);
  const after = (await h.api.get('/registration-requests/summary', { user: w.hod })).data;
  assert.equal(after.pending, before.pending - 1);
  assert.equal(after.faculty, before.faculty - 1);
  assert.equal(await h.models.Notification.countDocuments({ dedupeKey: `registration-request:${req._id}`, isRead: false }), 0);
});

test('duplicate and concurrent approvals create exactly one account', { skip }, async () => {
  const req = await h.models.RegistrationRequest.findOne({ email: 'race@example.test' });
  const results = await Promise.all([
    h.api.post(`/registration-requests/${req._id}/approve`, { user: w.hod, body: { identifier: 'REG500' } }),
    h.api.post(`/registration-requests/${req._id}/approve`, { user: w.hod, body: { identifier: 'REG500' } }),
    h.api.post(`/registration-requests/${req._id}/approve`, { user: w.hod, body: { identifier: 'REG500' } }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1, JSON.stringify(results.map((r) => r.status)));
  assert.equal(await h.models.User.countDocuments({ email: 'race@example.test' }), 1);
  const again = await h.api.post(`/registration-requests/${req._id}/approve`, { user: w.hod, body: { identifier: 'REG501' } });
  assert.equal(again.status, 409);
  const reject = await h.api.post(`/registration-requests/${req._id}/reject`, { user: w.hod, body: { reason: 'too late now' } });
  assert.equal(reject.status, 409);
});

test('rejection records reviewer and reason, drops the credential and lowers the pending count', { skip }, async () => {
  const before = (await h.api.get('/registration-requests/summary', { user: w.hod })).data.pending;
  const req = await h.models.RegistrationRequest.findOne({ email: 'fresh.grad@example.test' });
  const res = await h.api.post(`/registration-requests/${req._id}/reject`, { user: w.hod, body: { reason: 'Documents incomplete' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const saved = await h.models.RegistrationRequest.findById(req._id).select('+passwordHash');
  assert.equal(saved.status, 'rejected');
  assert.equal(saved.rejectionReason, 'Documents incomplete');
  assert.equal(String(saved.reviewedBy), String(w.hod._id));
  assert.ok(!saved.passwordHash, 'credential removed on rejection');
  assert.equal(await h.models.User.countDocuments({ email: 'fresh.grad@example.test' }), 0);
  assert.equal((await h.api.get('/registration-requests/summary', { user: w.hod })).data.pending, before - 1);
  const rejectedList = await h.api.get('/registration-requests', { user: w.hod, query: { status: 'rejected' } });
  assert.ok(rejectedList.data.requests.some((r) => r.email === 'fresh.grad@example.test'), 'history preserved');
});

test('list filters: role, search, status', { skip }, async () => {
  const faculty = await h.api.get('/registration-requests', { user: w.hod, query: { status: 'all', role: 'faculty' } });
  assert.ok(faculty.data.requests.length >= 2);
  assert.ok(faculty.data.requests.every((r) => ['admin', 'faculty'].includes(r.requestedRole)));
  const search = await h.api.get('/registration-requests', { user: w.hod, query: { status: 'all', search: 'fresh' } });
  assert.equal(search.data.requests.length, 1);
  const injected = await h.api.get('/registration-requests', { user: w.hod, query: { status: 'all', search: '.*' } });
  assert.equal(injected.status, 200);
  assert.equal(injected.data.requests.length, 0, 'regex metacharacters are escaped');
  assert.equal((await h.api.get('/registration-requests', { user: w.hod, query: { status: 'bogus' } })).status, 400);
});
