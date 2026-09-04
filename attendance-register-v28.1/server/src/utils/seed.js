/**
 * SMART FULL SEED
 *
 * Safe to run repeatedly.
 *
 * Existing departments, semesters, faculty, classes, students, subjects,
 * period templates and notifications are preserved.
 *
 * Missing records are added.
 *
 * Timetables are ALWAYS rebuilt conflict-free:
 * - Existing timetable documents are replaced/updated.
 * - No faculty is assigned to two classes at the same day + period.
 * - Class periods always have a subject + faculty.
 * - Break periods never have subject/faculty.
 * - Faculty is selected from the same department as the class.
 * - If the normal subject faculty is busy, another department faculty is used.
 * - If all department faculty are busy, the period is left as Free Period.
 *
 * Run:
 *   npm run seed
 */

import dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run seed while NODE_ENV=production.');
  process.exit(1);
}

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { validateTimetableDocuments } from './timetableConflictUtils.js';
import { stableTimetableSlotId } from './timetableSlotId.js';

const col = (name) => mongoose.connection.collection(name);

function hashPass(password) {
  return bcrypt.hashSync(password, 12);
}

const seedPasswords = {
  admin: process.env.SEED_ADMIN_PASSWORD,
  faculty: process.env.SEED_FACULTY_PASSWORD,
  student: process.env.SEED_STUDENT_PASSWORD,
};

if (
  Object.values(seedPasswords).some(
    (password) => !password || password.length < 12
  )
) {
  console.error(
    'Set SEED_ADMIN_PASSWORD, SEED_FACULTY_PASSWORD and SEED_STUDENT_PASSWORD to values of at least 12 characters.'
  );
  process.exit(1);
}

let seedState = 0x14a2026;

function nextSeededRandom() {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 0x100000000;
}

function randInt(min, max) {
  return (
    Math.floor(nextSeededRandom() * (max - min + 1)) + min
  );
}



function seedDob(age, offset = 0) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let year = today.getUTCFullYear() - age;
  const monthNumber = (offset % 12) + 1;
  const dayNumber = (offset % 26) + 1;
  let candidate = Date.UTC(year, monthNumber - 1, dayNumber);
  // Keep deterministic month/day distribution while ensuring the raw seed
  // document satisfies the app's non-future date-of-birth contract.
  if (candidate > todayUtc) {
    year -= 1;
    candidate = Date.UTC(year, monthNumber - 1, dayNumber);
  }
  const date = new Date(candidate);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function seedPhone() {
  return `+91 9${randInt(100, 999)} ${randInt(
    100,
    999
  )} ${randInt(1000, 9999)}`;
}

function seededShuffle(array) {
  const copy = array.slice();

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextSeededRandom() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

async function connect() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGO_URI not set.');
    process.exit(1);
  }

  const timeoutMs = Number(
    process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000
  );

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS:
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : 10000,
    connectTimeoutMS:
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : 10000,
  });

  console.log('✔ Connected to MongoDB');
}

async function insertInBatches(collectionName, docs, batchSize = 1000) {
  for (let i = 0; i < docs.length; i += batchSize) {
    await col(collectionName).insertMany(
      docs.slice(i, i + batchSize)
    );
  }
}



const FIRST_NAMES = [
  'Arjun',
  'Ananya',
  'Rahul',
  'Priya',
  'Vishnu',
  'Sneha',
  'Aditya',
  'Kavya',
  'Rohan',
  'Divya',
  'Akash',
  'Meera',
  'Siddharth',
  'Nisha',
  'Kiran',
  'Sanjay',
  'Remya',
  'Midhun',
  'Asha',
  'Manu',
  'Greeshma',
  'Jithin',
  'Swetha',
  'Sajin',
  'Anu',
  'Vivek',
  'Reshma',
  'Binu',
  'Lekshmi',
  'Naveen',
  'Shilpa',
  'Anoop',
  'Roshni',
  'Vimal',
  'Geethu',
  'Harikrishnan',
  'Parvathy',
  'Nihal',
  'Fathima',
  'Adithya',
  'Amritha',
  'Athira',
  'Devika',
  'Gokul',
  'Ishaan',
  'Keerthana',
  'Malavika',
  'Megha',
  'Nandana',
  'Nikhil',
  'Riya',
  'Sreeram',
  'Sreya',
  'Abhinav',
  'Aparna',
  'Amal',
  'Anagha',
  'Basil',
  'Christy',
  'Deepak',
  'Elizabeth',
  'Farhan',
  'Gopika',
  'Hema',
  'Irfan',
  'Jyothi',
  'Karthik',
  'Lakshmi',
  'Muhammed',
  'Neethu',
  'Om',
  'Pranav',
  'Radhika',
  'Sachin',
  'Tanvi',
  'Uday',
  'Varun',
  'Yadhu',
  'Zara',
  'Anandu',
  'Bhavana',
];

const LAST_NAMES = [
  'Kumar',
  'Sharma',
  'Nair',
  'Pillai',
  'Menon',
  'Krishnan',
  'Patel',
  'Singh',
  'Rao',
  'Das',
  'Iyer',
  'Varma',
  'Thomas',
  'Joseph',
  'Babu',
  'Mohan',
  'Suresh',
  'Mathew',
  'Narayanan',
  'Warrier',
  'Panicker',
  'Kurup',
  'Chandran',
  'Raghavan',
  'Balakrishnan',
  'George',
  'Jacob',
  'Abraham',
  'Vishwanathan',
  'Subramaniam',
  'Achari',
  'Bose',
  'Chatterjee',
  'Desai',
  'Fernandes',
  'Gupta',
  'Hegde',
  'Iyengar',
  'Jain',
  'Kapoor',
  'Lal',
  'Malhotra',
  'Nambiar',
  'Ommen',
  'Pai',
  'Qureshi',
  'Reddy',
  'Shetty',
  'Tiwari',
  'Unni',
  'Verma',
  'Wadhwa',
  'Xavier',
  'Yohannan',
  'Zachariah',
  'Achuthan',
  'Balan',
  'Cherian',
  'Dev',
  'Eapen',
  'Francis',
  'Gopal',
  'Hussain',
  'Iqbal',
  'Jayan',
  'Kartha',
  'Lawrence',
  'Mani',
  'Nath',
  'Ouseph',
  'Prakash',
  'Qadir',
  'Ramachandran',
  'Sasidharan',
  'Thankachan',
  'Ummer',
  'Venu',
  'Wilson',
  'Yusuf',
  'Zacharia',
  'Achankunju',
  'Bhatt',
  'Chackalayil',
  'Dsouza',
  'Eusebio',
];

const nameCombos = seededShuffle(
  Array.from(
    new Set(
      FIRST_NAMES.flatMap((first) =>
        LAST_NAMES.map((last) => `${first} ${last}`)
      )
    )
  )
);

let nameCursor = 0;

function nextUniqueFullName() {
  if (nameCursor >= nameCombos.length) {
    throw new Error(
      'Name pool exhausted. Add more names to FIRST_NAMES/LAST_NAMES.'
    );
  }

  return nameCombos[nameCursor++];
}

const usedEmails = new Set();
const usedRegisterNumbers = new Set();
const usedEmployeeIds = new Set();

const ACCOUNT_SECURITY_DEFAULTS = {
  tokenVersion: 0,
  passwordResetRequired: false,
  failedLoginAttempts: 0,
  loginFailureWindowStartedAt: null,
  loginLockedUntil: null,
  deviceBindingHash: null,
  deviceBoundAt: null,
  lastLoginAt: null,
  avatarUrl: null,
};

async function reserveExistingIdentityValues() {
  const existingUsers = await col('users').find({}).project({ email: 1, registerNumber: 1, employeeId: 1 }).toArray();
  existingUsers.forEach(({ email, registerNumber, employeeId }) => {
    if (email) usedEmails.add(String(email).toLowerCase());
    if (registerNumber) usedRegisterNumbers.add(String(registerNumber));
    if (employeeId) usedEmployeeIds.add(String(employeeId));
  });
}

function emailFor(fullName, domain) {
  const base = fullName
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');

  let candidate = `${base}@${domain}`;
  let suffix = 1;

  while (usedEmails.has(candidate)) {
    suffix++;
    candidate = `${base}${suffix}@${domain}`;
  }

  usedEmails.add(candidate);

  return candidate;
}

// Keep enough active Faculty in every department for timetable alternatives.
// Existing Faculty are preserved; this is only the per-department target for
// missing seed records. The value is intentionally bounded and deterministic.
const FACULTY_TARGET_PER_DEPARTMENT = 20;

const departmentDefs = [
  {
    key: 'CSE',
    name: 'Computer Science',
    code: 'CSE',
  },
  {
    key: 'ECE',
    name: 'Electronics & Communication',
    code: 'ECE',
  },
  {
    key: 'MECH',
    name: 'Mechanical Engineering',
    code: 'MECH',
  },
  {
    key: 'CIVIL',
    name: 'Civil Engineering',
    code: 'CIVIL',
  },
  {
    key: 'EEE',
    name: 'Electrical & Electronics Engineering',
    code: 'EEE',
  },
  {
    key: 'AIDS',
    name: 'Artificial Intelligence & Data Science',
    code: 'AIDS',
  },
  {
    key: 'AUTO',
    name: 'Automobile Engineering',
    code: 'AUTO',
  },
  {
    key: 'MTRX',
    name: 'Mechatronics Engineering',
    code: 'MTRX',
  },
  {
    key: 'AERO',
    name: 'Aeronautical Engineering',
    code: 'AERO',
  },
  {
    key: 'ICE',
    name: 'Instrumentation & Control Engineering',
    code: 'ICE',
  },
];

function subjectsForClass(dept, semNumber) {
  if (semNumber === 1) {
    return [
      'Engineering Mathematics I',
      'Engineering Physics',
      'Communication Skills',
      'Environmental Studies',
      `${dept.name} Fundamentals`,
    ];
  }

  if (semNumber === 2) {
    return [
      'Engineering Mathematics II',
      'Engineering Chemistry',
      'Engineering Graphics',
      'Basic Electrical & Electronics',
      `${dept.name} Workshop Practice`,
    ];
  }

  const pool = [
    `${dept.name} Systems Design`,
    `${dept.name} Materials & Processes`,
    `${dept.name} Laboratory`,
    `Applied Mathematics for ${dept.name}`,
    'Professional Communication',
    'Industrial Safety & Ethics',
    'Numerical Methods',
    'Project Management',
    semNumber >= 7
      ? 'Professional Elective'
      : 'Open Elective',
    semNumber === 8
      ? 'Project Work'
      : 'Mini Project',
  ];

  const offset = (semNumber * 3) % pool.length;

  return Array.from(
    { length: 5 },
    (_, i) => pool[(offset + i) % pool.length]
  );
}

const weekdayPeriods = [
  {
    order: 1,
    name: 'Period 1',
    kind: 'class',
    startTime: '08:00',
    endTime: '08:55',
  },
  {
    order: 2,
    name: 'Period 2',
    kind: 'class',
    startTime: '09:00',
    endTime: '09:55',
  },
  {
    order: 3,
    name: 'Period 3',
    kind: 'class',
    startTime: '10:00',
    endTime: '10:55',
  },
  {
    order: 4,
    name: 'Break',
    kind: 'break',
    startTime: '11:00',
    endTime: '11:20',
  },
  {
    order: 5,
    name: 'Period 4',
    kind: 'class',
    startTime: '11:20',
    endTime: '12:15',
  },
  {
    order: 6,
    name: 'Lunch',
    kind: 'break',
    startTime: '12:15',
    endTime: '13:00',
  },
  {
    order: 7,
    name: 'Period 5',
    kind: 'class',
    startTime: '13:00',
    endTime: '13:55',
  },
  {
    order: 8,
    name: 'Period 6',
    kind: 'class',
    startTime: '14:00',
    endTime: '14:55',
  },
];

const saturdayPeriods = [
  {
    order: 1,
    name: 'Period 1',
    kind: 'class',
    startTime: '08:00',
    endTime: '08:55',
  },
  {
    order: 2,
    name: 'Period 2',
    kind: 'class',
    startTime: '09:00',
    endTime: '09:55',
  },
  {
    order: 3,
    name: 'Break',
    kind: 'break',
    startTime: '10:00',
    endTime: '10:15',
  },
  {
    order: 4,
    name: 'Period 3',
    kind: 'class',
    startTime: '10:15',
    endTime: '11:10',
  },
  {
    order: 5,
    name: 'Period 4',
    kind: 'class',
    startTime: '11:15',
    endTime: '12:10',
  },
];

const TIMETABLE_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

async function ensureDepartments(hodId, now) {
  const existing = await col('departments')
    .find({})
    .toArray();

  const byCode = new Map(
    existing.map((department) => [
      department.code,
      department,
    ])
  );

  const deptIds = {};
  let added = 0;

  for (const definition of departmentDefs) {
    let department = byCode.get(definition.code);

    if (!department) {
      const _id = new mongoose.Types.ObjectId();

      department = {
        _id,
        name: definition.name,
        code: definition.code,
        programLevel: 'degree',
        semesterCount: 8,
        isActive: true,
        createdBy: hodId,
        createdAt: now,
        updatedAt: now,
      };

      await col('departments').insertOne(department);

      added++;
    }

    deptIds[definition.key] = department._id;
  }

  return {
    deptIds,
    added,
  };
}

async function ensureSemesters(hodId, now) {
  const existing = await col('semesters')
    .find({})
    .toArray();

  const byNumber = new Map(
    existing.map((semester) => [
      Number(semester.number),
      semester,
    ])
  );

  const semIds = {};
  let added = 0;

  for (let number = 1; number <= 8; number++) {
    let semester = byNumber.get(number);

    if (!semester) {
      semester = {
        _id: new mongoose.Types.ObjectId(),
        number,
        label: `Semester ${number}`,
        isActive: true,
        createdBy: hodId,
        createdAt: now,
        updatedAt: now,
      };

      await col('semesters').insertOne(semester);

      added++;
    }

    semIds[number] = semester._id;
  }

  return {
    semIds,
    added,
  };
}

async function ensureAdmin(now, deptIds) {
  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ||
    'admin@college.edu'
  ).toLowerCase();

  let admin = await col('users').findOne({
    email: adminEmail,
  });

  if (admin) {
    const role = String(admin.role || '').toLowerCase();
    if (!['super_admin', 'hod'].includes(role)) {
      throw new Error(`SEED_ADMIN_EMAIL belongs to a non-HOD account (${adminEmail}). Refusing to use it as the administrator.`);
    }
    if (admin.isActive === false) {
      throw new Error(`The configured HOD account is inactive (${adminEmail}). Reactivate it or choose a different seed email.`);
    }
    console.log(`↷ HOD already exists: ${adminEmail}`);
    return admin;
  }

  const _id = new mongoose.Types.ObjectId();

  admin = {
    _id,
    ...ACCOUNT_SECURITY_DEFAULTS,
    name: process.env.SEED_ADMIN_NAME || 'Head Admin',
    email: adminEmail,
    password: hashPass(seedPasswords.admin),
    role: 'super_admin',
    roleModelVersion: 2,
    department: deptIds.CSE,
    dateOfBirth: '1978-06-15',
    isEmailVerified: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await col('users').insertOne(admin);

  console.log(`✔ HOD created: ${adminEmail}`);

  return admin;
}

async function ensureFaculty(hodId, deptIds, now) {
  const existingFaculty = await col('users')
    .find({
      role: 'admin',
      isActive: true,
    })
    .toArray();

  const facultyByDept = {};
  const facultyDocs = [];
  const designations = [
    'Professor',
    'Associate Professor',
    'Assistant Professor',
    'Senior Lecturer',
    'Lecturer',
  ];

  const qualifications = [
    'Ph.D.',
    'M.Tech',
    'M.E.',
    'M.Sc.',
    'MCA',
  ];

  let facultyCounter = existingFaculty.length;

  for (const dept of departmentDefs) {
    const deptId = deptIds[dept.key];

    const current = existingFaculty.filter(
      (faculty) =>
        String(faculty.department) === String(deptId)
    );

    facultyByDept[dept.key] = [...current];

    const required = FACULTY_TARGET_PER_DEPARTMENT - current.length;

    for (let i = 0; i < Math.max(0, required); i++) {
      facultyCounter++;

      const fullName = nextUniqueFullName();
      const qualification =
        qualifications[
          facultyCounter % qualifications.length
        ];

      const designation =
        designations[
          facultyCounter % designations.length
        ];

      const title =
        qualification === 'Ph.D.'
          ? 'Dr.'
          : 'Prof.';

      let employeeId = `FAC${String(facultyCounter).padStart(3, '0')}`;
      while (usedEmployeeIds.has(employeeId)) {
        facultyCounter++;
        employeeId = `FAC${String(facultyCounter).padStart(3, '0')}`;
      }
      usedEmployeeIds.add(employeeId);

      const document = {
        _id: new mongoose.Types.ObjectId(),
        ...ACCOUNT_SECURITY_DEFAULTS,
        name: `${title} ${fullName}`,
        email: emailFor(fullName, 'college.edu'),
        password: hashPass(seedPasswords.faculty),
        role: 'admin',
        roleModelVersion: 2,
        employeeId,
        department: deptId,
        designation,
        qualification,
        dateOfBirth: seedDob(
          30 + (facultyCounter % 28),
          facultyCounter
        ),
        phone: seedPhone(),
        isEmailVerified: true,
        isActive: true,
        createdBy: hodId,
        createdAt: now,
        updatedAt: now,
      };

      await col('users').insertOne(document);

      facultyByDept[dept.key].push(document);
      facultyDocs.push(document);
    }
  }

  return {
    facultyByDept,
    facultyDocs,
  };
}

async function ensureClasses(
  hodId,
  deptIds,
  semIds,
  facultyByDept,
  now
) {
  const existingClasses = await col('classes')
    .find({})
    .toArray();

  const byCode = new Map(
    existingClasses.map((item) => [
      item.code,
      item,
    ])
  );

  const classMeta = [];
  let added = 0;

  for (const dept of departmentDefs) {
    const deptFaculty = facultyByDept[dept.key];

    for (let semNumber = 1; semNumber <= 8; semNumber++) {
      const code = `${dept.code}-SEM${semNumber}`;

      let classDoc = byCode.get(code);

      if (classDoc && (String(classDoc.department) !== String(deptIds[dept.key]) || String(classDoc.semester) !== String(semIds[semNumber]))) {
        throw new Error(`Existing class ${code} has a department or semester relationship that does not match the seed specification. Refusing to overwrite it.`);
      }

      if (!classDoc) {
        classDoc = {
          _id: new mongoose.Types.ObjectId(),
          name: `${dept.name} - Semester ${semNumber}`,
          code,
          department: deptIds[dept.key],
          semester: semIds[semNumber],
          classTeacher:
            deptFaculty[
              (semNumber - 1) %
                deptFaculty.length
            ]._id,
          isActive: true,
          createdBy: hodId,
          createdAt: now,
          updatedAt: now,
        };

        await col('classes').insertOne(classDoc);

        added++;
      }

      classMeta.push({
        classId: classDoc._id,
        dept,
        semNumber,
        semIndex: semNumber - 1,
      });
    }
  }

  return {
    classMeta,
    added,
  };
}

async function ensureStudents(
  hodId,
  deptIds,
  classMeta,
  now
) {
  const existingStudents = await col('users')
    .find({
      role: 'user',
      isActive: true,
    })
    .toArray();

  const existingByClass = new Map();

  for (const student of existingStudents) {
    const key = String(student.class);

    if (!existingByClass.has(key)) {
      existingByClass.set(key, []);
    }

    existingByClass.get(key).push(student);
  }

  const studentDocs = [];
  const currentYear = new Date().getUTCFullYear();

  for (const meta of classMeta) {
    const classKey = String(meta.classId);

    const current =
      existingByClass.get(classKey) || [];

    const target = randInt(55, 60);
    const needed = Math.max(
      0,
      target - current.length
    );

    for (let i = 1; i <= needed; i++) {
      const fullName = nextUniqueFullName();

      const admissionYear =
        currentYear -
        Math.floor((meta.semNumber - 1) / 2);

      let serial = current.length + i;
      let registerNumber = `${String(admissionYear).slice(-2)}${meta.dept.code}${meta.semNumber}${String(serial).padStart(3, '0')}`;
      while (usedRegisterNumbers.has(registerNumber)) {
        serial++;
        registerNumber = `${String(admissionYear).slice(-2)}${meta.dept.code}${meta.semNumber}${String(serial).padStart(3, '0')}`;
      }
      usedRegisterNumbers.add(registerNumber);

      const student = {
        _id: new mongoose.Types.ObjectId(),
        ...ACCOUNT_SECURITY_DEFAULTS,
        name: fullName,
        email: emailFor(
          fullName,
          'student.edu'
        ),
        password: hashPass(
          seedPasswords.student
        ),
        role: 'user',
        roleModelVersion: 2,
        registerNumber,
        class: meta.classId,
        department:
          deptIds[meta.dept.key],
        admissionYear,
        dateOfBirth: seedDob(
          18 +
            Math.floor(
              (meta.semNumber - 1) / 2
            ),
          current.length + i
        ),
        phone: seedPhone(),
        isEmailVerified: true,
        isActive: true,
        createdBy: hodId,
        createdAt: now,
        updatedAt: now,
      };

      await col('users').insertOne(student);
      studentDocs.push(student);
    }
  }

  return {
    added: studentDocs.length,
  };
}

async function ensureSubjects(
  hodId,
  deptIds,
  semIds,
  classMeta,
  facultyByDept,
  now
) {
  const existingSubjects = await col('subjects')
    .find({
      isActive: true,
    })
    .toArray();

  const subjectMap = new Map();

  for (const subject of existingSubjects) {
    subjectMap.set(
      `${subject.class}|${subject.code}`,
      subject
    );
  }

  const classSubjectsMap = new Map();
  let added = 0;

  for (const meta of classMeta) {
    const classKey = String(meta.classId);
    const deptFaculty =
      facultyByDept[meta.dept.key];

    const names = subjectsForClass(
      meta.dept,
      meta.semNumber
    );

    const subjectsForThisClass = [];

    for (let idx = 0; idx < names.length; idx++) {
      const name = names[idx];

      const code =
        `${meta.dept.code}${meta.semNumber}0${idx + 1}`;

      const key =
        `${classKey}|${code}`;

      let subject = subjectMap.get(key);

      if (subject && (String(subject.department) !== String(deptIds[meta.dept.key]) || String(subject.semester) !== String(semIds[meta.semNumber]) || String(subject.class) !== classKey)) {
        throw new Error(`Existing subject ${code} has a relationship that does not match ${meta.dept.code} Semester ${meta.semNumber}. Refusing to overwrite it.`);
      }

      if (!subject) {
        const primaryFaculty =
          deptFaculty[
            (meta.semNumber + idx) %
              deptFaculty.length
          ];

        subject = {
          _id: new mongoose.Types.ObjectId(),
          name,
          code,
          department:
            deptIds[meta.dept.key],
          semester:
            semIds[meta.semNumber],
          class: meta.classId,

          /*
           * Give each subject several qualified faculty.
           * The timetable may choose whichever one is free.
           */
          faculty: [
            deptFaculty[
              (meta.semNumber + idx) %
                deptFaculty.length
            ]._id,
            deptFaculty[
              (meta.semNumber + idx + 1) %
                deptFaculty.length
            ]._id,
            deptFaculty[
              (meta.semNumber + idx + 2) %
                deptFaculty.length
            ]._id,
          ],

          students: [],
          isElective:
            name
              .toLowerCase()
              .includes('elective'),
          isActive: true,
          createdBy: hodId,
          createdAt: now,
          updatedAt: now,
        };

        await col('subjects').insertOne(subject);

        subjectMap.set(key, subject);
        added++;
      }

      subjectsForThisClass.push(subject);
    }

    classSubjectsMap.set(
      classKey,
      subjectsForThisClass
    );
  }

  return {
    classSubjectsMap,
    added,
  };
}

async function ensurePeriodTemplates(
  hodId,
  now
) {
  const existing = await col('periodtemplates')
    .find({})
    .toArray();

  const byDay = new Map(
    existing
      .filter((item) => item.isActive !== false)
      .map((item) => [item.dayOfWeek, item])
  );

  const templates = [
    ...[
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
    ].map((day) => ({
      dayOfWeek: day,
      periods: weekdayPeriods,
    })),

    {
      dayOfWeek: 'saturday',
      periods: saturdayPeriods,
    },
  ];

  let added = 0;

  for (const template of templates) {
    if (byDay.has(template.dayOfWeek)) {
      continue;
    }

    await col('periodtemplates').insertOne({
      dayOfWeek: template.dayOfWeek,
      periods: template.periods,
      isActive: true,
      createdBy: hodId,
      createdAt: now,
      updatedAt: now,
    });

    added++;
  }

  return { added };
}

/*
 * THIS IS THE IMPORTANT PART.
 *
 * We build ALL 80 timetables in memory first.
 *
 * facultyBusy:
 *
 *   facultyId + day + period
 *
 * This means a faculty member can NEVER be assigned to
 * two classes at the same time.
 *
  * We prefer Faculty already attached to the subject, but
 * sort eligible candidates by current weekly assignment load
 * so work is distributed instead of repeatedly selecting the
 * same person. If qualified Faculty are busy, every active
 * Faculty member in the class department is considered.

 *
 * Therefore the seed does NOT create the situation:
 *
 * Subject -> Faculty A
 * Faculty A busy
 * Faculty dropdown -> empty
 *
 * Instead it picks Faculty B/C/etc. who is actually free.
 */

async function rebuildTimetables(
  hodId,
  classMeta,
  classSubjectsMap,
  facultyByDept,
  now
) {
  const facultyBusy = new Set();
  const facultyLoad = new Map(
    Object.values(facultyByDept).flat().map((faculty) => [String(faculty._id), 0])
  );

  const timetableDays = new Map();

  for (const meta of classMeta) {
    timetableDays.set(
      String(meta.classId),
      Object.fromEntries(
        TIMETABLE_DAYS.map((day) => [
          day,
          [],
        ])
      )
    );
  }

  let assignedClassPeriods = 0;
  let freePeriods = 0;
  const facultyBySubject = new Map();

  function busyKey(
    facultyId,
    day,
    order
  ) {
    return `${String(facultyId)}|${day}|${order}`;
  }

  function isFree(
    facultyId,
    day,
    order
  ) {
    return !facultyBusy.has(
      busyKey(
        facultyId,
        day,
        order
      )
    );
  }

  function reserve(
    facultyId,
    day,
    order
  ) {
    facultyBusy.add(
      busyKey(
        facultyId,
        day,
        order
      )
    );
  }

  /*
   * We deliberately distribute classes in a
   * deterministic order.
   */
  for (const day of TIMETABLE_DAYS) {
    const periods =
      day === 'saturday'
        ? saturdayPeriods
        : weekdayPeriods;

    for (const period of periods) {
      for (
        let classIndex = 0;
        classIndex < classMeta.length;
        classIndex++
      ) {
        const meta = classMeta[classIndex];

        const classKey =
          String(meta.classId);

        const slots =
          timetableDays.get(classKey)[day];

                if (period.kind === 'break') {
          slots.push({
            _id: stableTimetableSlotId(meta.classId, day, period.order),
            order: period.order,

            name: period.name,
            kind: 'break',
            startTime: period.startTime,
            endTime: period.endTime,
            subject: null,
            faculty: null,
            note: period.name,
          });

          continue;
        }

        const subjects =
          classSubjectsMap.get(classKey) || [];

        if (!subjects.length) {
          throw new Error(
            `No subjects found for ${meta.dept.code} Semester ${meta.semNumber}`
          );
        }

        /*
         * Pick subject deterministically.
         */
        const subjectIndex =
          (classIndex +
            period.order +
            TIMETABLE_DAYS.indexOf(day)) %
          subjects.length;

        const subject =
          subjects[subjectIndex];

        const departmentFaculty = facultyByDept[meta.dept.key] || [];
        const departmentFacultyIds = new Set(departmentFaculty.map((faculty) => String(faculty._id)));
        const subjectFacultyIds = (subject.faculty || []).filter((id) => departmentFacultyIds.has(String(id)));
        const preferredFacultyIds = new Set(subjectFacultyIds.map((id) => String(id)));
        const candidates = [...new Set([...subjectFacultyIds, ...departmentFaculty.map((faculty) => faculty._id).filter((id) => !preferredFacultyIds.has(String(id)))])]
          .sort((left, right) => {
            const preferredDifference = Number(!preferredFacultyIds.has(String(left))) - Number(!preferredFacultyIds.has(String(right)));
            if (preferredDifference !== 0) return preferredDifference;
            const loadDifference = (facultyLoad.get(String(left)) || 0) - (facultyLoad.get(String(right)) || 0);
            if (loadDifference !== 0) return loadDifference;
            return String(left).localeCompare(String(right));
          });

        let selectedFaculty = null;

        for (const candidate of candidates) {
          if (isFree(candidate, day, period.order)) {
            selectedFaculty = candidate;
            break;
          }
        }

        /*
          * This should be rare because each department now targets
 * 20 Faculty and only 8 classes are scheduled per period.

         *
         * But if it does happen, we do NOT create an
         * invalid class period.
         */
        if (!selectedFaculty) {
          freePeriods++;

                    slots.push({
            _id: stableTimetableSlotId(meta.classId, day, period.order),
            order: period.order,
            name: 'Free Period',

            kind: 'break',
            startTime: period.startTime,
            endTime: period.endTime,
            subject: null,
            faculty: null,
            note: 'No Faculty available',
          });

          continue;
        }

        reserve(selectedFaculty, day, period.order);
        facultyLoad.set(String(selectedFaculty), (facultyLoad.get(String(selectedFaculty)) || 0) + 1);
        const subjectFaculty = facultyBySubject.get(String(subject._id)) || new Set((subject.faculty || []).map(String));
        subjectFaculty.add(String(selectedFaculty));
        facultyBySubject.set(String(subject._id), subjectFaculty);

                slots.push({
          _id: stableTimetableSlotId(meta.classId, day, period.order),
          order: period.order,
          name: period.name,

          kind: 'class',
          startTime: period.startTime,
          endTime: period.endTime,
          subject: subject._id,
          faculty: selectedFaculty,
          note: null,
        });

        assignedClassPeriods++;
      }
    }
  }

  /*
   * Replace/update every timetable.
   *
   * This is important because your database already has
   * the old timetables. Merely using insertMany() would
   * either fail on the unique class index or leave the old
   * assignments untouched.
   */
  const generatedDocuments = classMeta.map((meta) => {
    const classKey = String(meta.classId);
    return {
      class: meta.classId,
      days: TIMETABLE_DAYS.map((day) => ({
        dayOfWeek: day,
        slots: timetableDays.get(classKey)[day],
      })),
      isActive: true,
      createdBy: hodId,
      updatedBy: hodId,
      updatedAt: now,
    };
  });
  const generatedValidation = validateTimetableDocuments(generatedDocuments);
  if (generatedValidation.conflicts.length > 0) {
    throw new Error(`Generated timetable validation failed with ${generatedValidation.conflicts.length} actual overlapping assignment pair(s). No timetable writes were attempted.`);
  }
  if (!generatedValidation.slotIdIntegrity.ok) {
    throw new Error(`Generated timetable validation failed: ${generatedValidation.slotIdIntegrity.missingSlotIds.length} missing, ${generatedValidation.slotIdIntegrity.invalidSlotIds.length} invalid, or ${generatedValidation.slotIdIntegrity.duplicateSlotIds.length} duplicate slot ObjectId(s). No timetable writes were attempted.`);
  }

  let added = 0;
  let updated = 0;

  if (facultyBySubject.size > 0) {
    await col('subjects').bulkWrite([...facultyBySubject.entries()].map(([subjectId, facultyIds]) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(subjectId) },
        update: { $addToSet: { faculty: { $each: [...facultyIds].map((id) => new mongoose.Types.ObjectId(id)) } } },
      },
    })));
  }

  for (const document of generatedDocuments) {
    const result =
      await col('timetables').updateOne(
        { class: document.class },
        {
          $set: {
            days: document.days,
            isActive: true,
            updatedBy: hodId,
            updatedAt: now,
          },
          $setOnInsert: {
            createdBy: hodId,
            createdAt: now,
          },
        },
        { upsert: true }
      );

    if (result.upsertedCount) {
      added++;
    } else if (
      result.modifiedCount ||
      result.matchedCount
    ) {
      updated++;
    }
  }

  const persisted = await col('timetables')
    .find({ class: { $in: classMeta.map((meta) => meta.classId) }, isActive: true })
    .project({ _id: 1, class: 1, days: 1 })
    .toArray();
  if (persisted.length !== generatedDocuments.length) {
    throw new Error(`Persisted timetable validation failed: expected ${generatedDocuments.length} active timetables but read back ${persisted.length}.`);
  }
  const persistedValidation = validateTimetableDocuments(persisted);
  if (persistedValidation.conflicts.length > 0) {
    throw new Error(`Persisted timetable validation failed with ${persistedValidation.conflicts.length} actual overlapping assignment pair(s).`);
  }
  if (!persistedValidation.slotIdIntegrity.ok) {
    throw new Error(`Persisted timetable validation failed: ${persistedValidation.slotIdIntegrity.missingSlotIds.length} missing, ${persistedValidation.slotIdIntegrity.invalidSlotIds.length} invalid, or ${persistedValidation.slotIdIntegrity.duplicateSlotIds.length} duplicate raw slot ObjectId(s).`);
  }

  return {
    added,
    updated,
    assignedClassPeriods,
    freePeriods,
    facultyAssignments: persistedValidation.assignments.length,
    conflicts: persistedValidation.conflicts.length,
    totalSlots: persistedValidation.slotIdIntegrity.totalSlots,
    validSlotIds: persistedValidation.slotIdIntegrity.validSlotIds,
  };
}

async function ensureNotifications(
  hodId,
  now
) {
  const users = await col('users')
    .find({
      isActive: true,
      role: {
        $in: [
          'super_admin',
          'admin',
          'user',
        ],
      },
    })
    .project({ _id: 1 })
    .toArray();

  const existingCount =
    await col('notifications').countDocuments();

  /*
   * Do not regenerate the huge notification set.
   */
  if (existingCount > 0) {
    return {
      added: 0,
    };
  }

  const notificationDocs =
    users.flatMap(({ _id }) => [
      {
        type: 'account_created',
        title:
          'Welcome to Attendance Register',
        message:
          'Your account has been set up successfully.',
        user: _id,
        isRead: false,
        meta: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        type: 'general',
        title: 'System Ready',
        message:
          'The attendance system is now configured and ready to use.',
        user: _id,
        isRead: false,
        meta: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

  await insertInBatches(
    'notifications',
    notificationDocs
  );

  return {
    added: notificationDocs.length,
  };
}

async function run() {
  await connect();
  await reserveExistingIdentityValues();

  console.log('\n🌱 SMART SEED STARTED\n');

  const now = new Date();

  /*
   * First locate the existing HOD.
   *
   * If it exists, DO NOT delete anything.
   */
  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ||
    'admin@college.edu'
  ).toLowerCase();

  let existingAdmin =
    await col('users').findOne({
      email: adminEmail,
    });

  /*
   * Temporary ID only for creating departments
   * if HOD doesn't exist yet.
   */
  const temporaryHodId =
    existingAdmin?._id ||
    new mongoose.Types.ObjectId();

  const {
    deptIds,
    added: departmentAdded,
  } = await ensureDepartments(
    temporaryHodId,
    now
  );

  console.log(
    `Departments: ${Object.keys(deptIds).length} total, ${departmentAdded} new`
  );

  const {
    semIds,
    added: semesterAdded,
  } = await ensureSemesters(
    temporaryHodId,
    now
  );

  console.log(
    `Semesters: 8 total, ${semesterAdded} new`
  );

  const admin = await ensureAdmin(
    now,
    deptIds
  );

  const hodId = admin._id;

  /*
   * Make sure newly-created departments point to the
   * actual HOD.
   */
  await col('departments').updateMany(
    {
      createdBy: {
        $exists: false,
      },
    },
    {
      $set: {
        createdBy: hodId,
      },
    }
  );

  const {
    facultyByDept,
    facultyDocs,
  } = await ensureFaculty(
    hodId,
    deptIds,
    now
  );

  console.log(
    `Faculty: ${facultyDocs.length} new`
  );

  const {
    classMeta,
    added: classAdded,
  } = await ensureClasses(
    hodId,
    deptIds,
    semIds,
    facultyByDept,
    now
  );

  const totalClasses =
    await col('classes').countDocuments({
      isActive: true,
    });

  console.log(
    `Classes: ${totalClasses} total, ${classAdded} new`
  );

  const {
    added: studentAdded,
  } = await ensureStudents(
    hodId,
    deptIds,
    classMeta,
    now
  );

  console.log(
    `Students: ${studentAdded} new`
  );

  const {
    classSubjectsMap,
    added: subjectAdded,
  } = await ensureSubjects(
    hodId,
    deptIds,
    semIds,
    classMeta,
    facultyByDept,
    now
  );

  const totalSubjects =
    await col('subjects').countDocuments({
      isActive: true,
    });

  console.log(
    `Subjects: ${subjectAdded} new`
  );

  const {
    added: templateAdded,
  } = await ensurePeriodTemplates(
    hodId,
    now
  );

  console.log(
    `Period templates: ${templateAdded} new`
  );

  /*
   * IMPORTANT:
   *
   * Timetables are rebuilt even when everything else
   * already exists.
   */
  console.log(
    '\n⏳ Rebuilding conflict-free timetables...'
  );

  const timetableResult =
    await rebuildTimetables(
      hodId,
      classMeta,
      classSubjectsMap,
      facultyByDept,
      now
    );

  console.log(
    `✔ Timetables added: ${timetableResult.added}`
  );

  console.log(
    `✔ Timetables updated: ${timetableResult.updated}`
  );

  console.log(
    `✔ Class periods assigned: ${timetableResult.assignedClassPeriods}`
  );

  console.log(
    `✔ Free periods: ${timetableResult.freePeriods}`
  );

  console.log('\nConflict validation:');
  console.log(`  Faculty assignments: ${timetableResult.facultyAssignments}`);
  console.log(`  Conflicts found: ${timetableResult.conflicts}`);
  console.log(`  Raw timetable slots: ${timetableResult.totalSlots}`);
  console.log(`  Persisted slot ObjectIds: ${timetableResult.validSlotIds}`);

  const {
    added: notificationAdded,
  } = await ensureNotifications(
    hodId,
    now
  );

  console.log(
    `Notifications: ${notificationAdded} new`
  );

  const totals = {
    departments:
      await col('departments').countDocuments({
        isActive: true,
      }),

    semesters:
      await col('semesters').countDocuments({
        isActive: true,
      }),

    classes:
      await col('classes').countDocuments({
        isActive: true,
      }),

    faculty:
      await col('users').countDocuments({
        role: 'admin',
        isActive: true,
      }),

    students:
      await col('users').countDocuments({
        role: 'user',
        isActive: true,
      }),

    subjects:
      await col('subjects').countDocuments({
        isActive: true,
      }),

    periodTemplates:
      await col('periodtemplates').countDocuments({
        isActive: true,
      }),

    timetables:
      await col('timetables').countDocuments({
        isActive: true,
      }),

    notifications:
      await col('notifications').countDocuments(),
  };

  console.log('\n==========================================');
  console.log('          ✅ SMART SEED COMPLETE');
  console.log('==========================================');

  console.log('\nAdded this run:');
  console.log(
    `  Departments:       ${departmentAdded}`
  );
  console.log(
    `  Semesters:         ${semesterAdded}`
  );
  console.log(
    `  HOD:               ${existingAdmin ? 0 : 1}`
  );
  console.log(
    `  Faculty:           ${facultyDocs.length}`
  );
  console.log(
    `  Classes:           ${classAdded}`
  );
  console.log(
    `  Students:          ${studentAdded}`
  );
  console.log(
    `  Subjects:          ${subjectAdded}`
  );
  console.log(
    `  Period templates:  ${templateAdded}`
  );
  console.log(
    `  Timetables added:  ${timetableResult.added}`
  );
  console.log(
    `  Timetables updated: ${timetableResult.updated}`
  );
  console.log(
    `  Notifications:     ${notificationAdded}`
  );

  console.log('\nTotal in database:');
  console.log(
    `  Departments:       ${totals.departments}`
  );
  console.log(
    `  Semesters:         ${totals.semesters}`
  );
  console.log(
    `  Classes:           ${totals.classes}`
  );
  console.log(
    `  Faculty:           ${totals.faculty}`
  );
  console.log(
    `  Students:          ${totals.students}`
  );
  console.log(
    `  Subjects:          ${totals.subjects}`
  );
  console.log(
    `  Period templates:  ${totals.periodTemplates}`
  );
  console.log(
    `  Timetables:        ${totals.timetables}`
  );
  console.log(
    `  Notifications:     ${totals.notifications}`
  );

  console.log('\nLogin credentials:');
  console.log(`  HOD:     ${adminEmail}`);
  console.log(
    '           Use SEED_ADMIN_PASSWORD'
  );
  console.log(
    '  Faculty: Use SEED_FACULTY_PASSWORD'
  );
  console.log(
    '  Student: Use SEED_STUDENT_PASSWORD'
  );

  console.log('\n==========================================');
  console.log(
    'Existing data was NOT deleted.'
  );
  console.log(
    'Existing records were NOT regenerated.'
  );
  console.log(
    'Timetables WERE rebuilt and read back with conflict validation.'
  );
  console.log(
    'No class period is created without a Faculty.'
  );
  console.log(
    'No Faculty is double-booked at the same time.'
  );
  console.log('==========================================\n');

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('\n❌ Seed failed:', error);

  mongoose
    .disconnect()
    .finally(() => process.exit(1));
});