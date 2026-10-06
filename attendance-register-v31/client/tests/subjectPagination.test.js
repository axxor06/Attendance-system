import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAllSubjectPages } from '../src/utils/loadAllSubjectPages.js';

test('all subject pages are merged for Academic Management counts', async () => {
  const calls = [];
  const responseByPage = {
    1: { subjects: Array.from({ length: 100 }, (_, index) => ({ _id: `subject-${index + 1}`, class: 'class-1' })), pagination: { pages: 3 } },
    2: { subjects: Array.from({ length: 100 }, (_, index) => ({ _id: `subject-${index + 101}`, class: 'class-2' })), pagination: { pages: 3 } },
    3: { subjects: Array.from({ length: 20 }, (_, index) => ({ _id: `subject-${index + 201}`, class: 'class-3' })), pagination: { pages: 3 } },
  };
  const subjects = await loadAllSubjectPages(async (params) => {
    calls.push(params);
    return { data: { data: responseByPage[params.page] } };
  });

  assert.equal(subjects.length, 220);
  assert.deepEqual(calls, [
    { page: 1, limit: 100 },
    { page: 2, limit: 100 },
    { page: 3, limit: 100 },
  ]);
  assert.equal(subjects.filter((subject) => subject.class === 'class-1').length, 100);
  assert.equal(subjects.filter((subject) => subject.class === 'class-2').length, 100);
  assert.equal(subjects.filter((subject) => subject.class === 'class-3').length, 20);
});

test('subject pagination refuses an unbounded directory response', async () => {
  await assert.rejects(
    loadAllSubjectPages(async () => ({ data: { data: { subjects: [], pagination: { pages: 101 } } } })),
    /safe browser loading limit/
  );
});
