/**
 * Shared harness for integration tests that run against a REAL MongoDB.
 *
 * Set MONGO_TEST_URI (e.g. mongodb://127.0.0.1:27017/?replicaSet=rs0). Each test
 * file gets its own throw-away database that is dropped afterwards, so the suite
 * never touches application data. When MONGO_TEST_URI is not set the suites
 * report "skipped" instead of failing, keeping `npm test` usable without MongoDB.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const serverRequire = createRequire(new URL('../../../server/package.json', import.meta.url));

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-test-refresh-secret';
process.env.CLIENT_URL ||= 'http://allowed.example.test';
process.env.ALLOWED_ORIGINS ||= 'http://allowed.example.test';
process.env.RATE_LIMIT_MAX_REQUESTS = '100000';
process.env.RATE_LIMIT_QR_SCAN_MAX = '100000';
process.env.RATE_LIMIT_QR_GENERATE_MAX = '100000';
process.env.RATE_LIMIT_ATTENDANCE_SUBMIT_MAX = '100000';
process.env.RATE_LIMIT_MESSAGE_SEND_MAX = '100000';
process.env.RATE_LIMIT_REGISTRATION_REQUEST_MAX = '100000';
process.env.RATE_LIMIT_LOGIN_MAX = '100000';

export const MONGO_TEST_URI = process.env.MONGO_TEST_URI || '';
export const hasMongo = Boolean(MONGO_TEST_URI);

export async function startHarness(label = 'it', connectOptions = {}) {
  const mongoose = serverRequire('mongoose');
  const dbName = `ar_test_${label}_${crypto.randomBytes(4).toString('hex')}`;
  const url = new URL(MONGO_TEST_URI);
  url.pathname = `/${dbName}`;
  await mongoose.connect(url.toString(), connectOptions);
  const models = await import('../../../server/src/models/index.js');
  await Promise.all(Object.values(models).map((model) => model.init()));
  const { default: app } = await import('../../../server/src/app.js');
  const { generateAccessToken } = await import('../../../server/src/utils/jwt.js');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const deviceIds = new Map();
  const tokenFor = (user) => generateAccessToken(user);
  function deviceIdFor(user) {
    const key = String(user._id);
    if (!deviceIds.has(key)) deviceIds.set(key, `device-${key}-0123456789`);
    return deviceIds.get(key);
  }
  async function call(method, path, { user, body, query, headers = {} } = {}) {
    const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null)).toString()}` : '';
    const response = await fetch(`${baseUrl}${path}${qs}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(user ? { authorization: `Bearer ${tokenFor(user)}`, 'x-device-id': deviceIdFor(user) } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await response.json(); } catch { /* empty body */ }
    return { status: response.status, body: json, data: json?.data };
  }
  const api = {
    get: (path, options) => call('GET', path, options),
    post: (path, options) => call('POST', path, options),
    patch: (path, options) => call('PATCH', path, options),
    delete: (path, options) => call('DELETE', path, options),
  };
  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    if (process.env.PERF_KEEP === '1') console.log(`    [harness] keeping database ${dbName}`);
    else await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  return { mongoose, models, api, stop, baseUrl, tokenFor };
}

/** A small but complete academic world: 1 department, 2 classes, subjects, timetable, people. */
export async function seedAcademicWorld(models) {
  const { Department, Semester, Class, Subject, Timetable, User } = models;
  const dept = await Department.create({ name: 'Computer Science', code: 'CSE', programLevel: 'degree' });
  const dept2 = await Department.create({ name: 'Mechanical', code: 'MECH', programLevel: 'degree' });
  const sem3 = await Semester.create({ number: 3, label: 'Semester 3' });
  const sem4 = await Semester.create({ number: 4, label: 'Semester 4' });
  const password = 'Str0ng!Passw0rd#1';
  const make = (fields) => User.create({ password, isEmailVerified: true, isActive: true, roleModelVersion: 2, ...fields });
  const hod = await make({ name: 'Head Admin', email: 'hod@example.test', role: 'super_admin', employeeId: 'HOD1' });
  const facultyA = await make({ name: 'Faculty A', email: 'fa@example.test', role: 'admin', employeeId: 'FAC1', department: dept._id });
  const facultyB = await make({ name: 'Faculty B', email: 'fb@example.test', role: 'admin', employeeId: 'FAC2', department: dept._id });
  const classA = await Class.create({ department: dept._id, semester: sem3._id, name: 'CSE - Semester 3', code: 'CSE-SEM3', classTeacher: facultyA._id });
  const classB = await Class.create({ department: dept2._id, semester: sem4._id, name: 'MECH - Semester 4', code: 'MECH-SEM4' });
  const students = [];
  for (let i = 1; i <= 3; i += 1) {
    students.push(await make({ name: `Student ${i}`, email: `s${i}@example.test`, role: 'user', registerNumber: `REG00${i}`, department: dept._id, class: classA._id }));
  }
  const outsider = await make({ name: 'Outsider', email: 'out@example.test', role: 'user', registerNumber: 'REG900', department: dept2._id, class: classB._id });
  const subjectA = await Subject.create({ name: 'Algorithms', code: 'CS301', department: dept._id, semester: sem3._id, class: classA._id, faculty: [facultyA._id] });
  const subjectB = await Subject.create({ name: 'Databases', code: 'CS302', department: dept._id, semester: sem3._id, class: classA._id, faculty: [facultyB._id] });
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((dayOfWeek) => ({
    dayOfWeek,
    slots: [
      { order: 1, name: 'Period 1', kind: 'class', startTime: '09:00', endTime: '09:50', subject: subjectA._id, faculty: facultyA._id },
      { order: 2, name: 'Period 2', kind: 'class', startTime: '10:00', endTime: '10:50', subject: subjectB._id, faculty: facultyB._id },
    ],
  }));
  await Timetable.create({ class: classA._id, days, createdBy: hod._id });
  return { dept, dept2, sem3, sem4, hod, facultyA, facultyB, classA, classB, students, outsider, subjectA, subjectB, password };
}

export function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
