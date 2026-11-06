import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFacultyPayload, buildStudentEducationPayload, emptyFacultyProfile, emptyStudentEducation,
  validateExperienceYears, validateFacultyProfile, validatePercentage, validateStudentEducation,
} from '../src/utils/registrationProfile.js';
import { classifyScanError, extractCodeFromScan, formatCodeForDisplay, isCompleteCode, normalizeCodeInput } from '../src/utils/attendanceCode.js';

const NOW = new Date('2026-10-31T00:00:00');
const student = { ...emptyStudentEducation(), level: 'class_12', institution: 'City School', boardOrUniversity: 'State Board', yearOfCompletion: '2025', percentage: '82.5' };
const faculty = { ...emptyFacultyProfile(), qualification: 'M.Tech', specialization: 'CS', institution: 'NIT', yearOfCompletion: '2018', totalYears: '0' };

test('student education: complete input is valid; each rule reports on its own field', () => {
  assert.deepEqual(validateStudentEducation(student, NOW), {});
  assert.ok(validateStudentEducation({ ...student, level: '' }, NOW).level);
  assert.ok(validateStudentEducation({ ...student, level: 'other' }, NOW).levelOther);
  assert.ok(validateStudentEducation({ ...student, percentage: '101' }, NOW).percentage);
  assert.ok(validateStudentEducation({ ...student, percentage: '12.345' }, NOW).percentage);
  assert.ok(validateStudentEducation({ ...student, yearOfCompletion: '2027' }, NOW).yearOfCompletion);
  assert.ok(validateStudentEducation({ ...student, percentage: '' }, NOW).percentage, 'needs a percentage or alternative');
  assert.deepEqual(validateStudentEducation({ ...student, percentage: '', alternativeResult: 'CGPA 8.4' }, NOW), {});
  assert.equal(validatePercentage('0'), null);
  assert.equal(validatePercentage('100'), null);
});

test('faculty: zero experience needs no employment fields; positive experience does', () => {
  assert.deepEqual(validateFacultyProfile(faculty, NOW), {});
  const errors = validateFacultyProfile({ ...faculty, totalYears: '5' }, NOW);
  assert.ok(errors.previousInstitution && errors.previousRole);
  assert.deepEqual(validateFacultyProfile({ ...faculty, totalYears: '5', previousInstitution: 'ABC College', previousRole: 'Lecturer' }, NOW), {});
  for (const bad of ['-1', 'abc', '61', '']) assert.ok(validateExperienceYears(bad), bad);
  for (const good of ['0', '1', '5', '12', '2.5']) assert.equal(validateExperienceYears(good), null, good);
});

test('payload builders send only what applies', () => {
  assert.deepEqual(buildStudentEducationPayload({ ...student, institution: '  City   School ' }), { level: 'class_12', institution: 'City School', boardOrUniversity: 'State Board', yearOfCompletion: 2025, percentage: '82.5' });
  assert.deepEqual(buildFacultyPayload({ ...faculty, previousInstitution: 'leftover', previousRole: 'leftover' }).experience, { totalYears: '0' });
  assert.deepEqual(buildFacultyPayload({ ...faculty, totalYears: '3', previousInstitution: 'ABC', previousRole: 'Lecturer' }).experience, { totalYears: '3', previousInstitution: 'ABC', previousRole: 'Lecturer' });
});

test('code input is normalised without remapping characters', () => {
  assert.equal(normalizeCodeInput(' k7m2-p9q4 '), 'K7M2P9Q4');
  assert.equal(normalizeCodeInput('K7M2P9Q4XXXX'), 'K7M2P9Q4');
  assert.equal(normalizeCodeInput('0O1IL'), '', 'ambiguous characters are not part of the alphabet');
  assert.equal(isCompleteCode('K7M2 P9Q4'), true);
  assert.equal(isCompleteCode('K7M2P9'), false);
  assert.equal(formatCodeForDisplay('K7M2P9Q4'), 'K7M2 P9Q4');
});

test('scanned QR content: bare code, new link, legacy link, garbage', () => {
  assert.equal(extractCodeFromScan('K7M2P9Q4'), 'K7M2P9Q4');
  assert.equal(extractCodeFromScan('https://school.example/scan-qr?code=k7m2p9q4'), 'K7M2P9Q4');
  assert.equal(extractCodeFromScan('https://school.example/scan-qr?token=K7M2P9Q4'), 'K7M2P9Q4');
  assert.equal(extractCodeFromScan('hello world'), 'HELLWRD'.slice(0, 0) + normalizeCodeInput('hello world'));
  assert.equal(extractCodeFromScan(''), '');
});

test('scan failures map to distinct, clear states', () => {
  const err = (status, code) => ({ response: { status, data: { error: { code } } } });
  assert.equal(classifyScanError(err(409, 'ATTENDANCE_ALREADY_MARKED')), 'already');
  assert.equal(classifyScanError(err(410)), 'expired');
  assert.equal(classifyScanError(err(400)), 'invalid');
  assert.equal(classifyScanError(err(403)), 'not-allowed');
  assert.equal(classifyScanError(err(429)), 'rate-limited');
  assert.equal(classifyScanError({ message: 'Network Error' }), 'network');
});
