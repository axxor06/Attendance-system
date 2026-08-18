/**
 * FULL SEED SCRIPT — realistic test data for development & demo
 *
 * Creates:
 *   - 1 HOD admin account (from .env)
 *   - 3 Departments (CSE, ECE, MECH)
 *   - 8 Semesters (1–8)
 *   - 6 Classes (CSE Sem1/Sem3/Sem5, ECE Sem1/Sem3, MECH Sem1)
 *   - 20 Faculty accounts
 *   - 120 Student accounts (20 per class)
 *   - Period templates for Mon–Sat
 *   - 12 Subjects across classes
 *   - 60 days of attendance history per student
 *   - Notifications for all users
 *
 * Safe to run multiple times — skips if admin already exists.
 * Run: npm run seed
 */

import dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the demo seed while NODE_ENV=production. Use a separate staging/development database.');
  process.exit(1);
}

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hashPass(p) { return bcrypt.hashSync(p, 12); }

const seedPasswords = {
  admin: process.env.SEED_ADMIN_PASSWORD,
  faculty: process.env.SEED_FACULTY_PASSWORD,
  student: process.env.SEED_STUDENT_PASSWORD,
};

if (Object.values(seedPasswords).some((password) => !password || password.length < 12)) {
  console.error('Set SEED_ADMIN_PASSWORD, SEED_FACULTY_PASSWORD, and SEED_STUDENT_PASSWORD to values of at least 12 characters before seeding.');
  process.exit(1);
}
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Connect ──────────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB');
}

// ─── Collections (raw to avoid schema issues during seed) ─────────────────────
const col = (name) => mongoose.connection.collection(name);

async function run() {
  await connect();

  // ── Check if already seeded ──────────────────────────────────────────────
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@college.edu').toLowerCase();
  const existingAdmin = await col('users').findOne({ email: adminEmail });
  if (existingAdmin) {
    console.log(`⚠  Admin already exists (${adminEmail}). Seed skipped.`);
    console.log('   Delete the database or drop the users collection to re-seed.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n🌱 Seeding database...\n');

  // ── IDs ──────────────────────────────────────────────────────────────────
  const hodId       = new mongoose.Types.ObjectId();
  const deptCSE     = new mongoose.Types.ObjectId();
  const deptECE     = new mongoose.Types.ObjectId();
  const deptMECH    = new mongoose.Types.ObjectId();
  const sem1Id      = new mongoose.Types.ObjectId();
  const sem2Id      = new mongoose.Types.ObjectId();
  const sem3Id      = new mongoose.Types.ObjectId();
  const sem4Id      = new mongoose.Types.ObjectId();
  const sem5Id      = new mongoose.Types.ObjectId();
  const sem6Id      = new mongoose.Types.ObjectId();
  const sem7Id      = new mongoose.Types.ObjectId();
  const sem8Id      = new mongoose.Types.ObjectId();

  const clsCSE1Id   = new mongoose.Types.ObjectId();
  const clsCSE3Id   = new mongoose.Types.ObjectId();
  const clsCSE5Id   = new mongoose.Types.ObjectId();
  const clsECE1Id   = new mongoose.Types.ObjectId();
  const clsECE3Id   = new mongoose.Types.ObjectId();
  const clsMECH1Id  = new mongoose.Types.ObjectId();

  const mkIds = (n) => Array.from({ length: n }, () => new mongoose.Types.ObjectId());

  // 20 faculty IDs and 120 student IDs: 20 students per class.
  const facultyIds = mkIds(20);
  const [fac1Id, fac2Id, fac3Id, fac4Id, fac5Id] = facultyIds;
  const stuCSE1  = mkIds(20);
  const stuCSE3  = mkIds(20);
  const stuCSE5  = mkIds(20);
  const stuECE1  = mkIds(20);
  const stuECE3  = mkIds(20);
  const stuMECH1 = mkIds(20);

  const subCSE1_OS    = new mongoose.Types.ObjectId();
  const subCSE1_MATHS = new mongoose.Types.ObjectId();
  const subCSE3_DS    = new mongoose.Types.ObjectId();
  const subCSE3_DBMS  = new mongoose.Types.ObjectId();
  const subCSE5_CN    = new mongoose.Types.ObjectId();
  const subCSE5_SE    = new mongoose.Types.ObjectId();
  const subECE1_ED    = new mongoose.Types.ObjectId();
  const subECE1_PHY   = new mongoose.Types.ObjectId();
  const subECE3_VLSI  = new mongoose.Types.ObjectId();
  const subECE3_MICRO = new mongoose.Types.ObjectId();
  const subMECH1_ENG  = new mongoose.Types.ObjectId();
  const subMECH1_TH   = new mongoose.Types.ObjectId();

  const now = new Date();

  // ── 1. HOD ────────────────────────────────────────────────────────────────
  await col('users').insertOne({
    _id: hodId,
    name: process.env.SEED_ADMIN_NAME || 'Head Admin',
    email: adminEmail,
    password: hashPass(seedPasswords.admin),
    role: 'hod',
    // HOD scope is anchored to this department; keep the fixture compatible
    // with the production authorization model without changing live data.
    department: deptCSE,
    isEmailVerified: true,
    isActive: true,
    createdAt: now, updatedAt: now,
  });
  console.log(`✔ HOD created: ${adminEmail}`);

  // ── 2. Departments ────────────────────────────────────────────────────────
  await col('departments').insertMany([
    { _id: deptCSE,  name: 'Computer Science & Engineering', code: 'CSE', isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
    { _id: deptECE,  name: 'Electronics & Communication',   code: 'ECE', isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
    { _id: deptMECH, name: 'Mechanical Engineering',        code: 'MECH',isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
  ]);
  console.log('✔ 3 Departments');

  // ── 3. Semesters ──────────────────────────────────────────────────────────
  await col('semesters').insertMany(
    [1,2,3,4,5,6,7,8].map((n, i) => ({
      _id: [sem1Id,sem2Id,sem3Id,sem4Id,sem5Id,sem6Id,sem7Id,sem8Id][i],
      number: n, label: `Semester ${n}`, isActive: true,
      createdBy: hodId, createdAt: now, updatedAt: now,
    }))
  );
  console.log('✔ 8 Semesters');

  // ── 4. Classes ────────────────────────────────────────────────────────────
  await col('classes').insertMany([
    { _id: clsCSE1Id,  name: 'Computer Science & Engineering - Semester 1', code: 'CSE-SEM1', department: deptCSE,  semester: sem1Id, isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
    { _id: clsCSE3Id,  name: 'Computer Science & Engineering - Semester 3', code: 'CSE-SEM3', department: deptCSE,  semester: sem3Id, isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
    { _id: clsCSE5Id,  name: 'Computer Science & Engineering - Semester 5', code: 'CSE-SEM5', department: deptCSE,  semester: sem5Id, isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
    { _id: clsECE1Id,  name: 'Electronics & Communication - Semester 1',   code: 'ECE-SEM1', department: deptECE,  semester: sem1Id, isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
    { _id: clsECE3Id,  name: 'Electronics & Communication - Semester 3',   code: 'ECE-SEM3', department: deptECE,  semester: sem3Id, isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
    { _id: clsMECH1Id, name: 'Mechanical Engineering - Semester 1',        code: 'MECH-SEM1',department: deptMECH, semester: sem1Id, isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
  ]);
  console.log('✔ 6 Classes');

  // ── 5. Faculty ────────────────────────────────────────────────────────────
  const facultySeed = [
    { name: 'Dr. Priya Nair', email: 'priya.nair@college.edu', department: deptCSE },
    { name: 'Prof. Rahul Sharma', email: 'rahul.sharma@college.edu', department: deptCSE },
    { name: 'Dr. Anjali Menon', email: 'anjali.menon@college.edu', department: deptECE },
    { name: 'Prof. Suresh Kumar', email: 'suresh.kumar@college.edu', department: deptECE },
    { name: 'Dr. Ravi Pillai', email: 'ravi.pillai@college.edu', department: deptMECH },
    { name: 'Prof. Meera Joseph', email: 'meera.joseph@college.edu', department: deptCSE },
    { name: 'Dr. Kiran Das', email: 'kiran.das@college.edu', department: deptCSE },
    { name: 'Prof. Nisha Varma', email: 'nisha.varma@college.edu', department: deptCSE },
    { name: 'Dr. Aditya Rao', email: 'aditya.rao@college.edu', department: deptCSE },
    { name: 'Prof. Sneha Iyer', email: 'sneha.iyer@college.edu', department: deptCSE },
    { name: 'Dr. Vishnu Menon', email: 'vishnu.menon@college.edu', department: deptECE },
    { name: 'Prof. Kavya Nair', email: 'kavya.nair@college.edu', department: deptECE },
    { name: 'Dr. Rohan Mathew', email: 'rohan.mathew@college.edu', department: deptECE },
    { name: 'Prof. Divya Krishnan', email: 'divya.krishnan@college.edu', department: deptECE },
    { name: 'Dr. Akash Patel', email: 'akash.patel@college.edu', department: deptECE },
    { name: 'Prof. Siddharth Rao', email: 'siddharth.rao@college.edu', department: deptMECH },
    { name: 'Dr. Neha Thomas', email: 'neha.thomas@college.edu', department: deptMECH },
    { name: 'Prof. Arun Babu', email: 'arun.babu@college.edu', department: deptMECH },
    { name: 'Dr. Lakshmi Menon', email: 'lakshmi.menon@college.edu', department: deptMECH },
    { name: 'Prof. Joel Varghese', email: 'joel.varghese@college.edu', department: deptMECH },
  ];
  const facultyData = facultyIds.map((id, index) => ({
    _id: id,
    ...facultySeed[index],
    employeeId: `FAC${String(index + 1).padStart(3, '0')}`,
  }));
  await col('users').insertMany(facultyData.map(f => ({
    ...f, role: 'faculty', password: hashPass(seedPasswords.faculty),
    isEmailVerified: true, isActive: true, phone: `+91 9${randInt(100,999)} ${randInt(100,999)} ${randInt(1000,9999)}`,
    createdBy: hodId, createdAt: now, updatedAt: now,
  })));
  console.log(`✔ ${facultyData.length} Faculty`);

  // ── 6. Students ───────────────────────────────────────────────────────────
  const studentGroups = [
    { ids: stuCSE1,  classId: clsCSE1Id,  dept: deptCSE,  prefix: 'CSE1', year: '23' },
    { ids: stuCSE3,  classId: clsCSE3Id,  dept: deptCSE,  prefix: 'CSE3', year: '21' },
    { ids: stuCSE5,  classId: clsCSE5Id,  dept: deptCSE,  prefix: 'CSE5', year: '21' },
    { ids: stuECE1,  classId: clsECE1Id,  dept: deptECE,  prefix: 'ECE1', year: '23' },
    { ids: stuECE3,  classId: clsECE3Id,  dept: deptECE,  prefix: 'ECE3', year: '21' },
    { ids: stuMECH1, classId: clsMECH1Id, dept: deptMECH, prefix: 'MCH1', year: '23' },
  ];

  const firstNames = ['Arjun','Ananya','Rahul','Priya','Vishnu','Sneha','Aditya','Kavya','Rohan','Divya','Akash','Meera','Siddharth','Nisha','Kiran'];
  const lastNames  = ['Kumar','Sharma','Nair','Pillai','Menon','Krishnan','Patel','Singh','Rao','Das'];

  const allStudents = [];
  let stuCounter = 1;
  for (const group of studentGroups) {
    for (const id of group.ids) {
      const fn = firstNames[stuCounter % firstNames.length];
      const ln = lastNames[stuCounter % lastNames.length];
      allStudents.push({
        _id: id,
        name: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${stuCounter}@student.edu`,
        password: hashPass(seedPasswords.student),
        role: 'student',
        registerNumber: `${group.year}${group.prefix}0${String(stuCounter).padStart(2,'0')}`,
        class: group.classId,
        department: group.dept,
        phone: `+91 9${randInt(100,999)} ${randInt(100,999)} ${randInt(1000,9999)}`,
        isEmailVerified: true,
        isActive: true,
        createdBy: hodId,
        createdAt: now, updatedAt: now,
      });
      stuCounter++;
    }
  }
  await col('users').insertMany(allStudents);
  console.log(`✔ ${allStudents.length} Students`);
  console.log('   Sample login: ' + allStudents[0].email + ' / use the configured seed environment values');

  // ── 7. Period Templates (Mon–Sat) ─────────────────────────────────────────
  const weekdayPeriods = [
    { order:1, name:'Period 1',  kind:'class',  startTime:'08:00', endTime:'08:55' },
    { order:2, name:'Period 2',  kind:'class',  startTime:'09:00', endTime:'09:55' },
    { order:3, name:'Period 3',  kind:'class',  startTime:'10:00', endTime:'10:55' },
    { order:4, name:'Break',     kind:'break',  startTime:'11:00', endTime:'11:20' },
    { order:5, name:'Period 4',  kind:'class',  startTime:'11:20', endTime:'12:15' },
    { order:6, name:'Lunch',     kind:'break',  startTime:'12:15', endTime:'13:00' },
    { order:7, name:'Period 5',  kind:'class',  startTime:'13:00', endTime:'13:55' },
    { order:8, name:'Period 6',  kind:'class',  startTime:'14:00', endTime:'14:55' },
  ];
  const saturdayPeriods = [
    { order:1, name:'Period 1', kind:'class', startTime:'08:00', endTime:'08:55' },
    { order:2, name:'Period 2', kind:'class', startTime:'09:00', endTime:'09:55' },
    { order:3, name:'Break',    kind:'break', startTime:'10:00', endTime:'10:15' },
    { order:4, name:'Period 3', kind:'class', startTime:'10:15', endTime:'11:10' },
    { order:5, name:'Period 4', kind:'class', startTime:'11:15', endTime:'12:10' },
  ];

  const dayTemplates = [
    ...['monday','tuesday','wednesday','thursday','friday'].map(day => ({
      dayOfWeek: day, periods: weekdayPeriods, isActive: true,
      createdBy: hodId, createdAt: now, updatedAt: now,
    })),
    { dayOfWeek: 'saturday', periods: saturdayPeriods, isActive: true, createdBy: hodId, createdAt: now, updatedAt: now },
  ];
  await col('periodtemplates').insertMany(dayTemplates);
  console.log('✔ Period templates: Mon–Fri (8 slots), Saturday (5 slots)');

  // ── 8. Subjects ───────────────────────────────────────────────────────────
  const subjects = [
    { _id: subCSE1_OS,    name: 'Operating Systems',         code: 'CS101', department: deptCSE,  semester: sem1Id, class: clsCSE1Id,  faculty: [fac1Id] },
    { _id: subCSE1_MATHS, name: 'Engineering Mathematics I', code: 'MA101', department: deptCSE,  semester: sem1Id, class: clsCSE1Id,  faculty: [fac2Id] },
    { _id: subCSE3_DS,    name: 'Data Structures',           code: 'CS301', department: deptCSE,  semester: sem3Id, class: clsCSE3Id,  faculty: [fac1Id] },
    { _id: subCSE3_DBMS,  name: 'Database Management',       code: 'CS302', department: deptCSE,  semester: sem3Id, class: clsCSE3Id,  faculty: [fac2Id] },
    { _id: subCSE5_CN,    name: 'Computer Networks',         code: 'CS501', department: deptCSE,  semester: sem5Id, class: clsCSE5Id,  faculty: [fac1Id] },
    { _id: subCSE5_SE,    name: 'Software Engineering',      code: 'CS502', department: deptCSE,  semester: sem5Id, class: clsCSE5Id,  faculty: [fac2Id] },
    { _id: subECE1_ED,    name: 'Electronic Devices',        code: 'EC101', department: deptECE,  semester: sem1Id, class: clsECE1Id,  faculty: [fac3Id] },
    { _id: subECE1_PHY,   name: 'Engineering Physics',       code: 'PH101', department: deptECE,  semester: sem1Id, class: clsECE1Id,  faculty: [fac4Id] },
    { _id: subECE3_VLSI,  name: 'VLSI Design',               code: 'EC301', department: deptECE,  semester: sem3Id, class: clsECE3Id,  faculty: [fac3Id] },
    { _id: subECE3_MICRO, name: 'Microprocessors',           code: 'EC302', department: deptECE,  semester: sem3Id, class: clsECE3Id,  faculty: [fac4Id] },
    { _id: subMECH1_ENG,  name: 'Engineering Drawing',       code: 'ME101', department: deptMECH, semester: sem1Id, class: clsMECH1Id, faculty: [fac5Id] },
    { _id: subMECH1_TH,   name: 'Engineering Thermodynamics',code: 'ME102', department: deptMECH, semester: sem1Id, class: clsMECH1Id, faculty: [fac5Id] },
  ];
  await col('subjects').insertMany(subjects.map(s => ({
    ...s, students: [], isElective: false, isActive: true,
    createdBy: hodId, createdAt: now, updatedAt: now,
  })));
  console.log('✔ 12 Subjects');

  // ── 9. Attendance History (60 school days) ─────────────────────────────────
  console.log('⏳ Generating 60 days of attendance history...');
  const classPeriodOrders = [1, 2, 3, 5, 7, 8]; // class periods from weekday template
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  // Map class→subjects and class→students
  const classSubjects = {
    [clsCSE1Id]:  [{ id: subCSE1_OS, facId: fac1Id, name: 'Operating Systems' }, { id: subCSE1_MATHS, facId: fac2Id, name: 'Engineering Mathematics I' }],
    [clsCSE3Id]:  [{ id: subCSE3_DS, facId: fac1Id, name: 'Data Structures' },   { id: subCSE3_DBMS, facId: fac2Id, name: 'Database Management' }],
    [clsCSE5Id]:  [{ id: subCSE5_CN, facId: fac1Id, name: 'Computer Networks' }, { id: subCSE5_SE,   facId: fac2Id, name: 'Software Engineering' }],
    [clsECE1Id]:  [{ id: subECE1_ED, facId: fac3Id, name: 'Electronic Devices' },{ id: subECE1_PHY,  facId: fac4Id, name: 'Engineering Physics' }],
    [clsECE3Id]:  [{ id: subECE3_VLSI,facId: fac3Id,name: 'VLSI Design' },        { id: subECE3_MICRO,facId: fac4Id,name: 'Microprocessors' }],
    [clsMECH1Id]: [{ id: subMECH1_ENG,facId: fac5Id,name: 'Engineering Drawing'}, { id: subMECH1_TH,  facId: fac5Id,name: 'Engineering Thermodynamics' }],
  };
  const classStudents = {
    [clsCSE1Id]:  stuCSE1,
    [clsCSE3Id]:  stuCSE3,
    [clsCSE5Id]:  stuCSE5,
    [clsECE1Id]:  stuECE1,
    [clsECE3Id]:  stuECE3,
    [clsMECH1Id]: stuMECH1,
  };

  // Give each student a realistic attendance rate (70–100%)
  const studentAttRate = {};
  for (const students of Object.values(classStudents)) {
    for (const sid of students) {
      // A few students have low attendance (for dashboard warnings)
      studentAttRate[sid.toString()] = Math.random() < 0.15 ? randInt(55, 74) / 100 : randInt(75, 98) / 100;
    }
  }

  const attendanceDocs = [];
  const markedAt = new Date();

  for (let daysAgo = 60; daysAgo >= 1; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setUTCHours(0, 0, 0, 0);
    const jsDay = date.getDay();
    if (jsDay === 0) continue; // skip Sunday
    const dayName = dayNames[jsDay];
    const isSat = jsDay === 6;
    const periodOrders = isSat ? [1, 2, 4, 5] : classPeriodOrders;
    const periodNames  = isSat
      ? { 1:'Period 1', 2:'Period 2', 4:'Period 3', 5:'Period 4' }
      : { 1:'Period 1', 2:'Period 2', 3:'Period 3', 5:'Period 4', 7:'Period 5', 8:'Period 6' };

    for (const [classId, subs] of Object.entries(classSubjects)) {
      const students = classStudents[classId];
      // Assign 2 subjects across the 4-6 periods in round-robin
      for (let pi = 0; pi < periodOrders.length; pi++) {
        const order = periodOrders[pi];
        const sub = subs[pi % subs.length];
        for (const studentId of students) {
          const rate = studentAttRate[studentId.toString()];
          const isPresent = Math.random() < rate;
          attendanceDocs.push({
            date,
            dayOfWeek: dayName,
            periodOrder: order,
            periodName: periodNames[order] || `Period ${order}`,
            subject: sub.id,
            class: new mongoose.Types.ObjectId(classId),
            student: studentId,
            faculty: sub.facId,
            status: isPresent ? 'present' : 'absent',
            remarks: '',
            markedAt,
            createdAt: markedAt,
            updatedAt: markedAt,
          });
        }
      }
    }
  }

  // Insert in batches of 1000 for speed
  const BATCH = 1000;
  for (let i = 0; i < attendanceDocs.length; i += BATCH) {
    await col('attendances').insertMany(attendanceDocs.slice(i, i + BATCH));
  }
  console.log(`✔ ${attendanceDocs.length} attendance records (60 school days)`);

  // ── 10. Notifications ─────────────────────────────────────────────────────
  const allUserIds = [hodId, ...facultyData.map(f => f._id), ...allStudents.map(s => s._id)];
  const notifMessages = [
    { type: 'account_created', title: 'Welcome to Attendance Register', message: 'Your account has been set up successfully.' },
    { type: 'general', title: 'System Ready', message: 'The attendance system is now configured and ready to use.' },
  ];
  await col('notifications').insertMany(
    allUserIds.flatMap(userId =>
      notifMessages.map(n => ({ ...n, user: userId, isRead: false, meta: {}, createdAt: now, updatedAt: now }))
    )
  );
  console.log('✔ Notifications created for all users');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('═══════════════════════════════════════');
  console.log('  Login credentials for testing:');
  console.log('───────────────────────────────────────');
  console.log(`  HOD:     ${adminEmail}`);
  console.log('           (use the configured seed environment values)');
  console.log('  Faculty: priya.nair@college.edu');
  console.log('           (use the configured seed environment values)');
  console.log('  Faculty: rahul.sharma@college.edu');
  console.log('           (use the configured seed environment values)');
  console.log(`  Student: ${allStudents[0].email}`);
  console.log('           (use the configured seed environment values)');
  console.log(`  Student: ${allStudents[6].email}`);
  console.log('           (use the configured seed environment values)');
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
