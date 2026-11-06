import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hasMongo, startHarness, seedAcademicWorld } from './_harness.js';

const skip = hasMongo ? false : 'MONGO_TEST_URI is not set';
let h; let w; let convo;

before(async () => {
  if (!hasMongo) return;
  h = await startHarness('msg');
  w = await seedAcademicWorld(h.models);
});
after(async () => { if (h) await h.stop(); });

const names = (res) => res.data.recipients.map((r) => r.name).sort();
const open = async (user, recipient) => (await h.api.post('/messages/conversations', { user, body: { recipientId: String(recipient._id) } }));

test('opening Messages shows no people and no conversations until the user searches', { skip }, async () => {
  for (const user of [w.hod, w.facultyA, w.students[0]]) {
    const conv = await h.api.get('/messages/conversations', { user });
    assert.equal(conv.data.conversations.length, 0);
    const none = await h.api.get('/messages/recipients', { user });
    assert.equal(none.status, 200);
    assert.deepEqual(none.data.recipients, []);
    assert.equal(none.data.requiresQuery, true);
    const oneChar = await h.api.get('/messages/recipients', { user, query: { search: 'S' } });
    assert.deepEqual(oneChar.data.recipients, []);
  }
});

test('student recipient search only reveals classmates, their faculty and the HOD', { skip }, async () => {
  const s1 = w.students[0];
  const classmates = await h.api.get('/messages/recipients', { user: s1, query: { search: 'Student' } });
  assert.deepEqual(names(classmates), ['Student 2', 'Student 3']);
  const outsider = await h.api.get('/messages/recipients', { user: s1, query: { search: 'Outsider' } });
  assert.deepEqual(outsider.data.recipients, [], 'unrelated class is invisible');
  const byEmail = await h.api.get('/messages/recipients', { user: s1, query: { search: 'out@example' } });
  assert.deepEqual(byEmail.data.recipients, []);
  const faculty = await h.api.get('/messages/recipients', { user: s1, query: { group: 'faculty' } });
  assert.deepEqual(names(faculty), ['Faculty A', 'Faculty B']);
  const hod = await h.api.get('/messages/recipients', { user: s1, query: { group: 'hod' } });
  assert.deepEqual(names(hod), ['Head Admin']);
  const tutors = await h.api.get('/messages/recipients', { user: s1, query: { group: 'tutors' } });
  assert.deepEqual(names(tutors), ['Faculty A']);
  const students = await h.api.get('/messages/recipients', { user: s1, query: { group: 'students' } });
  assert.deepEqual(names(students), ['Student 2', 'Student 3']);
  assert.equal((await h.api.get('/messages/recipients', { user: s1, query: { group: 'everyone' } })).status, 400);
  assert.equal((await h.api.get('/messages/recipients', { user: s1, query: { search: 'x'.repeat(100) } })).status, 400);
  const regex = await h.api.get('/messages/recipients', { user: s1, query: { search: '.*' } });
  assert.deepEqual(regex.data.recipients, [], 'regex characters are escaped');
});

test('faculty and HOD scopes follow the existing policy', { skip }, async () => {
  const fa = await h.api.get('/messages/recipients', { user: w.facultyA, query: { group: 'students' } });
  assert.deepEqual(names(fa), ['Student 1', 'Student 2', 'Student 3']);
  assert.ok(!names(await h.api.get('/messages/recipients', { user: w.facultyA, query: { search: 'Outsider' } })).includes('Outsider'));
  const hod = await h.api.get('/messages/recipients', { user: w.hod, query: { search: 'Outsider' } });
  assert.deepEqual(names(hod), ['Outsider']);
  const hodAll = await h.api.get('/messages/recipients', { user: w.hod, query: { group: 'students', limit: '2' } });
  assert.equal(hodAll.data.recipients.length, 2);
  assert.equal(hodAll.data.pagination.total, 4);
  assert.deepEqual(names(await h.api.get('/messages/recipients', { user: w.hod, query: { group: 'hod' } })), [], 'HOD cannot message HOD');
});

test('unauthorized conversations are refused; authorized ones are idempotent', { skip }, async () => {
  assert.equal((await open(w.students[0], w.outsider)).status, 403);
  assert.equal((await open(w.students[0], w.students[0])).status, 400);
  assert.equal((await open(w.students[0], w.hod)).status, 200);
  assert.equal((await open(w.hod, w.outsider)).status, 200);
  const a = await open(w.students[0], w.students[1]);
  const b = await open(w.students[1], w.students[0]);
  assert.equal(a.status, 200);
  assert.equal(a.data.conversation._id, b.data.conversation._id, 'one conversation per pair');
  convo = a.data.conversation._id;
  assert.equal((await h.api.post('/messages/conversations', { user: w.students[0], body: { recipientId: 'x' } })).status, 400);
  assert.equal((await h.api.post('/messages/conversations', { user: w.students[0], body: { recipientId: String(w.students[1]._id), extra: 1 } })).status, 400);
});

test('a conversation without messages is not listed for either participant', { skip }, async () => {
  const empty = await open(w.students[0], w.hod);
  assert.equal(empty.status, 200);
  for (const user of [w.students[0], w.hod]) {
    const list = await h.api.get('/messages/conversations', { user });
    assert.ok(!list.data.conversations.some((c) => c._id === empty.data.conversation._id), 'empty thread hidden');
  }
  // The creator can still open it by id and send the first message, after which it appears for both.
  const sent = await h.api.post(`/messages/conversations/${empty.data.conversation._id}/messages`, { user: w.students[0], body: { body: 'first message' } });
  assert.equal(sent.status, 201);
  const list = await h.api.get('/messages/conversations', { user: w.hod });
  assert.ok(list.data.conversations.some((c) => c._id === empty.data.conversation._id));
});

test('conversation membership is enforced for reading, sending, editing and marking read', { skip }, async () => {
  const send = await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: 'hello' } });
  assert.equal(send.status, 201, JSON.stringify(send.body));
  for (const user of [w.outsider, w.students[2], w.facultyA]) {
    assert.equal((await h.api.get(`/messages/conversations/${convo}/messages`, { user })).status, 404);
    assert.equal((await h.api.post(`/messages/conversations/${convo}/messages`, { user, body: { body: 'intrude' } })).status, 404);
    assert.equal((await h.api.patch(`/messages/conversations/${convo}/read`, { user, body: {} })).status, 404);
    assert.equal((await h.api.patch(`/messages/conversations/${convo}/messages/${send.data.message._id}`, { user, body: { body: 'tamper' } })).status, 404);
  }
  // The recipient cannot edit the sender's message.
  assert.equal((await h.api.patch(`/messages/conversations/${convo}/messages/${send.data.message._id}`, { user: w.students[1], body: { body: 'tamper' } })).status, 404);
  const none = await h.api.get('/messages/conversations/64b7f0f0f0f0f0f0f0f0f0f0/messages', { user: w.students[0] });
  assert.equal(none.status, 404);
  assert.equal((await h.api.get('/messages/conversations/nope/messages', { user: w.students[0] })).status, 400);
  assert.equal((await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: '   ' } })).status, 400);
  assert.equal((await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: 'x'.repeat(5001) } })).status, 400);
  assert.equal((await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: 'hi', sender: String(w.hod._id) } })).status, 400);
  const stored = await h.models.Message.find({ conversation: convo });
  assert.equal(stored.length, 1);
  assert.equal(String(stored[0].sender), String(w.students[0]._id));
});

test('revoked access: a student moved out of the class can no longer message old classmates', { skip }, async () => {
  const moved = await h.models.User.create({ name: 'Mover', email: 'mover@example.test', password: 'Str0ng!Passw0rd#1', role: 'user', roleModelVersion: 2, isEmailVerified: true, registerNumber: 'REG777', class: w.classA._id, department: w.dept._id });
  const c = await open(moved, w.students[0]);
  assert.equal(c.status, 200);
  await h.models.User.updateOne({ _id: moved._id }, { $set: { class: w.classB._id } });
  const fresh = await h.models.User.findById(moved._id);
  const send = await h.api.post(`/messages/conversations/${c.data.conversation._id}/messages`, { user: fresh, body: { body: 'still there?' } });
  assert.equal(send.status, 403);
});

test('idempotent send: retries with the same clientMessageId store one message', { skip }, async () => {
  const key = 'client-key-0001';
  const results = await Promise.all(Array.from({ length: 6 }, () => h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: 'once only', clientMessageId: key } })));
  assert.ok(results.every((r) => [200, 201].includes(r.status)), JSON.stringify(results.map((r) => r.status)));
  assert.equal(await h.models.Message.countDocuments({ conversation: convo, body: 'once only' }), 1);
  assert.equal(new Set(results.map((r) => r.data.message._id)).size, 1);
  assert.equal((await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: 'x', clientMessageId: 'bad key!' } })).status, 400);
});

test('unread counts stay accurate and notifications do not flood', { skip }, async () => {
  await h.models.Message.deleteMany({});
  await h.models.Notification.deleteMany({});
  for (let i = 0; i < 4; i += 1) await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: `m${i}` } });
  const list = await h.api.get('/messages/conversations', { user: w.students[1] });
  const entry = list.data.conversations.find((c) => c._id === convo);
  assert.equal(entry.unreadCount, 4);
  const summary = await h.api.get('/notifications/summary', { user: w.students[1] });
  assert.equal(summary.data.unreadMessages, 4);
  assert.equal(summary.data.unreadNotifications, 1, 'one notification per conversation, not per message');
  assert.equal(summary.data.pendingRegistrations, null, 'only HODs get a registration count');
  const sender = await h.api.get('/notifications/summary', { user: w.students[0] });
  assert.equal(sender.data.unreadMessages, 0);
  await h.api.patch(`/messages/conversations/${convo}/read`, { user: w.students[1], body: {} });
  const after = await h.api.get('/notifications/summary', { user: w.students[1] });
  assert.equal(after.data.unreadMessages, 0);
  assert.equal(after.data.unreadNotifications, 0);
  await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: 'again' } });
  const reopened = await h.api.get('/notifications/summary', { user: w.students[1] });
  assert.equal(reopened.data.unreadNotifications, 1);
  assert.equal(await h.models.Notification.countDocuments({ user: w.students[1]._id }), 1);
});

test('large conversations paginate with a stable cursor and never load everything', { skip }, async () => {
  await h.models.Message.deleteMany({});
  const docs = Array.from({ length: 205 }, (_, i) => ({
    conversation: convo, sender: i % 2 ? w.students[0]._id : w.students[1]._id, recipient: i % 2 ? w.students[1]._id : w.students[0]._id,
    body: `msg ${String(i).padStart(3, '0')}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
  }));
  await h.models.Message.insertMany(docs);
  const seen = [];
  let before;
  let pages = 0;
  for (;;) {
    const res = await h.api.get(`/messages/conversations/${convo}/messages`, { user: w.students[0], query: { limit: '50', ...(before ? { before } : {}) } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.data.messages.length <= 50);
    seen.unshift(...res.data.messages.map((m) => m.body));
    pages += 1;
    if (!res.data.hasMore) break;
    before = res.data.nextBefore;
    assert.ok(before);
  }
  assert.equal(pages, 5);
  assert.equal(seen.length, 205);
  assert.equal(new Set(seen).size, 205, 'no duplicates across pages');
  assert.deepEqual(seen, [...seen].sort(), 'chronological order');
  const first = await h.api.get(`/messages/conversations/${convo}/messages`, { user: w.students[0] });
  assert.equal(first.data.messages.length, 30, 'default page is bounded');
  assert.equal(first.data.messages.at(-1).body, 'msg 204', 'newest messages first');
  assert.equal(first.data.pagination.total, 205);
  assert.equal((await h.api.get(`/messages/conversations/${convo}/messages`, { user: w.students[0], query: { limit: '500' } })).status, 400);
  const foreign = await h.models.Message.create({ conversation: (await open(w.hod, w.outsider)).data.conversation._id, sender: w.hod._id, recipient: w.outsider._id, body: 'private' });
  assert.equal((await h.api.get(`/messages/conversations/${convo}/messages`, { user: w.students[0], query: { before: String(foreign._id) } })).status, 400, 'cursor cannot point into another conversation');
});

test('delete for me / everyone and edit keep working', { skip }, async () => {
  const sent = await h.api.post(`/messages/conversations/${convo}/messages`, { user: w.students[0], body: { body: 'to edit' } });
  const id = sent.data.message._id;
  assert.equal((await h.api.patch(`/messages/conversations/${convo}/messages/${id}`, { user: w.students[0], body: { body: 'edited' } })).status, 200);
  assert.equal((await h.api.delete(`/messages/conversations/${convo}/messages/${id}`, { user: w.students[1], body: { mode: 'everyone' } })).status, 404);
  assert.equal((await h.api.delete(`/messages/conversations/${convo}/messages/${id}`, { user: w.students[1], body: { mode: 'me' } })).status, 200);
  const theirs = await h.api.get(`/messages/conversations/${convo}/messages`, { user: w.students[1], query: { limit: '5' } });
  assert.ok(!theirs.data.messages.some((m) => m._id === id));
  assert.equal((await h.api.delete(`/messages/conversations/${convo}/messages/${id}`, { user: w.students[0], body: { mode: 'everyone' } })).status, 200);
});
