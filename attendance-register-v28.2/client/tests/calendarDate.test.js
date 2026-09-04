import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCalendarDate, parseCalendarDate } from '../src/utils/calendarDate.js';

test('calendar-date formatter preserves an ISO date-only calendar day', () => {
  assert.equal(formatCalendarDate('2026-08-24', 'EEEE, MMM d, yyyy'), 'Monday, Aug 24, 2026');
  assert.equal(formatCalendarDate('2026-08-24T00:00:00.000Z', 'EEEE, MMM d, yyyy'), 'Monday, Aug 24, 2026');
  assert.equal(formatCalendarDate('not-a-date', 'MMM d, yyyy'), '—');
  assert.equal(parseCalendarDate('2026-02-30'), null);
});
