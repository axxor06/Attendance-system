import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFacultyPeriods } from '../src/utils/facultyPeriodScope.js';
import { clearSingleFlightRequests, requestSingleFlight } from '../src/utils/requestSingleFlight.js';

const facultyId = '507f1f77bcf86cd799439011';
const otherFacultyId = '507f1f77bcf86cd799439012';
const subjectId = '507f1f77bcf86cd799439021';
const otherSubjectId = '507f1f77bcf86cd799439022';

const classPeriods = [
  { order: 1, kind: 'class', subject: subjectId, faculty: facultyId },
  { order: 2, kind: 'class', subject: subjectId, faculty: otherFacultyId },
  { order: 3, kind: 'class', subject: otherSubjectId, faculty: facultyId },
  { order: 4, kind: 'break', subject: null, faculty: null },
];

test('Faculty period scope returns only the exact assigned subject slots', () => {
  const periods = filterFacultyPeriods(classPeriods, { source: 'class-timetable', subjectId, facultyId });
  assert.deepEqual(periods.map((period) => period.order), [1]);
});

test('legacy template compatibility does not fabricate a Faculty assignment', () => {
  const periods = filterFacultyPeriods(classPeriods, { source: 'legacy-template', subjectId, facultyId });
  assert.deepEqual(periods.map((period) => period.order), [1, 2, 3]);
});

test('identical Faculty reads share one in-flight request', async () => {
  clearSingleFlightRequests();
  let calls = 0;
  const task = () => {
    calls += 1;
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 5));
  };
  const first = requestSingleFlight('faculty-roster:test', task);
  const second = requestSingleFlight('faculty-roster:test', task);
  assert.strictEqual(first, second);
  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }]);
  assert.equal(calls, 1);
});
