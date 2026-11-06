import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThreadItems, createClientMessageId, dayLabel, mergeConversations, mergeMessages } from '../src/utils/messageThread.js';

const msg = (id, sender, iso) => ({ _id: id, sender, createdAt: iso, body: id });
const NOW = new Date('2026-10-31T12:00:00');

test('mergeMessages de-duplicates by id, prefers incoming data and keeps chronological order', () => {
  const merged = mergeMessages(
    [msg('b', 'u1', '2026-10-31T09:01:00'), msg('a', 'u1', '2026-10-31T09:00:00')],
    [{ ...msg('b', 'u1', '2026-10-31T09:01:00'), readAt: '2026-10-31T09:05:00' }, msg('c', 'u2', '2026-10-31T09:02:00')],
  );
  assert.deepEqual(merged.map((m) => m._id), ['a', 'b', 'c']);
  assert.equal(merged[1].readAt, '2026-10-31T09:05:00');
});

test('mergeConversations keeps every loaded page and orders by latest activity', () => {
  const merged = mergeConversations(
    [{ _id: '1', lastMessage: { sentAt: '2026-10-01T00:00:00Z' } }, { _id: '2', lastMessage: { sentAt: '2026-10-05T00:00:00Z' } }],
    [{ _id: '1', lastMessage: { sentAt: '2026-10-30T00:00:00Z' } }, { _id: '3', lastMessage: { sentAt: '2026-10-02T00:00:00Z' } }],
  );
  assert.deepEqual(merged.map((c) => c._id), ['1', '2', '3']);
});

test('day labels read naturally', () => {
  assert.equal(dayLabel('2026-10-31T01:00:00', NOW), 'Today');
  assert.equal(dayLabel('2025-01-05T10:00:00', NOW), '5 January 2025');
  assert.match(dayLabel('2026-03-04T10:00:00', NOW), /^Wednesday, 4 March$/);
});

test('thread items insert one separator per day and group close messages from one sender', () => {
  const items = buildThreadItems([
    msg('1', 'a', '2026-10-29T10:00:00'),
    msg('2', 'a', '2026-10-29T10:01:00'),
    msg('3', 'b', '2026-10-29T10:02:00'),
    msg('4', 'b', '2026-10-30T09:00:00'),
    msg('5', 'b', '2026-10-30T10:30:00'),
  ], NOW);
  assert.deepEqual(items.filter((i) => i.type === 'day').map((i) => i.key), ['day-2026-10-29', 'day-2026-10-30']);
  const messages = items.filter((i) => i.type === 'message');
  assert.deepEqual(messages.map((i) => [i.startsGroup, i.endsGroup]), [[true, false], [false, true], [true, true], [true, true], [true, true]]);
});

test('client message ids are unique and match the server pattern', () => {
  const ids = new Set(Array.from({ length: 200 }, () => createClientMessageId()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);
});
