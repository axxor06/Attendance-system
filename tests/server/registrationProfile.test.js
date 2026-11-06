import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeExperience,
  normalizeFacultyEducation,
  normalizeStudentEducation,
  parseExperienceYears,
  parsePercentage,
} from '../../server/src/utils/registrationProfile.js';

const NOW = new Date('2026-10-31T00:00:00Z');
const base = { level: 'class_12', institution: 'City School', boardOrUniversity: 'State Board', yearOfCompletion: 2025, percentage: 82.5 };
const messages = (fn) => { try { fn(); return []; } catch (e) { return e.details || [e.message]; } };

test('percentage accepts 0-100 with up to two decimals only', () => {
  const ok = [];
  for (const value of ['0', '100', '99.99', 55, '7.5']) assert.ok(parsePercentage(value, ok) !== null, String(value));
  assert.deepEqual(ok, []);
  for (const value of ['101', '-1', '12.345', 'abc', '1e2', '100.01']) {
    const errors = [];
    parsePercentage(value, errors);
    assert.equal(errors.length, 1, `${value} should be rejected`);
  }
  assert.equal(parsePercentage('', []), null);
});

test('experience years: 0, 1, 5, 12 and 2.5 are valid; negative, text and excessive are not', () => {
  for (const [input, expected] of [[0, 0], ['1', 1], [5, 5], ['12', 12], ['2.5', 2.5]]) {
    const errors = [];
    assert.equal(parseExperienceYears(input, errors), expected);
    assert.deepEqual(errors, []);
  }
  for (const input of ['-1', 'abc', '61', '1.55', '', undefined]) {
    const errors = [];
    parseExperienceYears(input, errors);
    assert.equal(errors.length, 1, `${input} should be rejected`);
  }
});

test('student education supports every level and the alternative-result path', () => {
  for (const level of ['class_10', 'class_12', 'diploma', 'degree']) {
    assert.equal(normalizeStudentEducation({ ...base, level }, { now: NOW }).level, level);
  }
  assert.equal(normalizeStudentEducation({ ...base, level: 'other', levelOther: 'IB Diploma' }, { now: NOW }).levelOther, 'IB Diploma');
  assert.ok(messages(() => normalizeStudentEducation({ ...base, level: 'other' }, { now: NOW })).some((m) => /description/.test(m)));
  const alt = normalizeStudentEducation({ ...base, percentage: undefined, alternativeResult: 'CGPA 8.4' }, { now: NOW });
  assert.equal(alt.percentage, null);
  assert.equal(alt.alternativeResult, 'CGPA 8.4');
  assert.ok(messages(() => normalizeStudentEducation({ ...base, percentage: undefined }, { now: NOW })).some((m) => /percentage/i.test(m)));
  assert.ok(messages(() => normalizeStudentEducation({ ...base, yearOfCompletion: 2027 }, { now: NOW })).some((m) => /year/i.test(m)));
  assert.ok(messages(() => normalizeStudentEducation({ ...base, level: 'phd' }, { now: NOW })).length > 0);
});

test('normalisers return only known fields (no mass assignment) and trim whitespace', () => {
  const out = normalizeStudentEducation({ ...base, institution: '  City   School ', role: 'super_admin', isAdmin: true }, { now: NOW });
  assert.deepEqual(Object.keys(out).sort(), ['alternativeResult', 'boardOrUniversity', 'institution', 'level', 'levelOther', 'percentage', 'yearOfCompletion']);
  assert.equal(out.institution, 'City School');
});

test('faculty education requires all fields; experience workplace is optional only at zero years', () => {
  const edu = { qualification: 'M.Sc', specialization: 'Physics', institution: 'University', yearOfCompletion: 2019 };
  assert.equal(normalizeFacultyEducation(edu, { now: NOW }).qualification, 'M.Sc');
  for (const key of Object.keys(edu)) assert.ok(messages(() => normalizeFacultyEducation({ ...edu, [key]: '' }, { now: NOW })).length > 0, key);
  assert.deepEqual(normalizeExperience({ totalYears: 0 }), { totalYears: 0, previousInstitution: '', previousRole: '' });
  assert.deepEqual(normalizeExperience({ totalYears: '0', previousInstitution: 'Fake Corp', previousRole: 'Fake' }), { totalYears: 0, previousInstitution: '', previousRole: '' });
  assert.ok(messages(() => normalizeExperience({ totalYears: 3 })).length === 2);
  assert.deepEqual(normalizeExperience({ totalYears: 3, previousInstitution: 'ABC College', previousRole: 'Lecturer' }), { totalYears: 3, previousInstitution: 'ABC College', previousRole: 'Lecturer' });
});
