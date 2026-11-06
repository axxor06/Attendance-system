import { format, isSameDay, isYesterday } from 'date-fns';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const idOf = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const time = (value) => new Date(value).getTime();

/** Merge message lists by id (incoming wins), oldest first. Used for polling and "load earlier". */
export function mergeMessages(existing, incoming) {
  const byId = new Map();
  [...existing, ...incoming].forEach((message) => byId.set(idOf(message), message));
  return [...byId.values()].sort((a, b) => time(a.createdAt) - time(b.createdAt) || idOf(a).localeCompare(idOf(b)));
}

/** Merge conversation pages by id, newest activity first. */
export function mergeConversations(existing, incoming) {
  const byId = new Map();
  [...existing, ...incoming].forEach((conversation) => byId.set(idOf(conversation), conversation));
  const activity = (c) => time(c.lastMessage?.sentAt || c.updatedAt || c.createdAt || 0);
  return [...byId.values()].sort((a, b) => activity(b) - activity(a));
}

export function dayLabel(value, now = new Date()) {
  const date = new Date(value);
  if (isSameDay(date, now)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, date.getFullYear() === now.getFullYear() ? 'EEEE, d MMMM' : 'd MMMM yyyy');
}

/**
 * Flattens a chronological message list into render items: a day separator whenever the
 * calendar day changes, and per-message flags for visually grouping consecutive messages
 * from the same sender within a few minutes.
 */
export function buildThreadItems(messages, now = new Date()) {
  const items = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const newDay = !previous || !isSameDay(new Date(previous.createdAt), new Date(message.createdAt));
    if (newDay) items.push({ type: 'day', key: `day-${format(new Date(message.createdAt), 'yyyy-MM-dd')}`, label: dayLabel(message.createdAt, now) });
    const joinsPrevious = Boolean(previous) && !newDay && idOf(previous.sender) === idOf(message.sender) && time(message.createdAt) - time(previous.createdAt) < GROUP_WINDOW_MS;
    const nextDay = next && !isSameDay(new Date(message.createdAt), new Date(next.createdAt));
    const joinsNext = Boolean(next) && !nextDay && idOf(next.sender) === idOf(message.sender) && time(next.createdAt) - time(message.createdAt) < GROUP_WINDOW_MS;
    items.push({ type: 'message', key: idOf(message), message, startsGroup: !joinsPrevious, endsGroup: !joinsNext });
  });
  return items;
}

/** Idempotency key for a send, so a retry or double tap stores one message. */
export function createClientMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
