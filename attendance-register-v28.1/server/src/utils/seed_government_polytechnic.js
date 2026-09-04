/**
 * Government Polytechnic College seed — Kerala Diploma / SBTE Revision 2021.
 *
 * This script uses the existing Attendance Register collections and relationships.
 * It creates six departments, six shared semester records, one class per
 * department/semester, 40 faculty, approximately 210 students, a complete
 * department curriculum catalogue, period templates, attendance history, and
 * notifications. It is safe to re-run: a completed seed is detected by its
 * deterministic marker or seed administrator email and skipped.
 *
 * Required environment variables: MONGO_URI, SEED_SUPER_ADMIN_PASSWORD,
 * SEED_ADMIN_PASSWORD, SEED_FACULTY_PASSWORD, SEED_STUDENT_PASSWORD.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { roleValues, ROLES } from '../config/constants.js';

dotenv.config();

const SEED_TAG = 'government-polytechnic-sbte-rev2021';
const uri = process.env.MONGO_URI;
const isProduction = process.env.NODE_ENV === 'production';
const passwords = {
  superAdmin: process.env.SEED_SUPER_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD,
  hod: process.env.SEED_ADMIN_PASSWORD,
  faculty: process.env.SEED_FACULTY_PASSWORD,
  student: process.env.SEED_STUDENT_PASSWORD,
};
if (isProduction) {
  console.error('Refusing to run the government-polytechnic seed in NODE_ENV=production.');
  process.exit(1);
}
if (!uri) {
  console.error('MONGO_URI is required.');
  process.exit(1);
}
if (Object.values(passwords).some((value) => !value || value.length < 12)) {
  console.error('Set SEED_SUPER_ADMIN_PASSWORD, SEED_ADMIN_PASSWORD, SEED_FACULTY_PASSWORD, and SEED_STUDENT_PASSWORD to strong values of at least 12 characters.');
  process.exit(1);
}

const now = new Date();
const col = (name) => mongoose.connection.collection(name);
const idFor = (label) => new mongoose.Types.ObjectId(crypto.createHash('sha256').update(`${SEED_TAG}:${label}`).digest('hex').slice(0, 24));
const hash = (value) => bcrypt.hashSync(value, 12);
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const dobFor = (age, index) => {
  const year = new Date().getUTCFullYear() - age;
  const month = String((index % 12) + 1).padStart(2, '0');
  const day = String((index % 26) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const stableRate = (index) => [0.65, 0.72, 0.78, 0.82, 0.87, 0.91, 0.95][index % 7];
const firstNames = ['Arjun', 'Adithya', 'Anjali', 'Nihal', 'Fathima', 'Akhil', 'Amritha', 'Athira', 'Devika', 'Gokul', 'Harikrishnan', 'Ishaan', 'Keerthana', 'Malavika', 'Megha', 'Nandana', 'Nikhil', 'Parvathy', 'Riya', 'Sreeram', 'Sreya', 'Vishnu', 'Abhinav', 'Aparna'];
const lastNames = ['Krishnan', 'Raj', 'Menon', 'Nair', 'Pillai', 'Varma', 'Thomas', 'Joseph', 'Babu', 'Mohan', 'Kumar', 'Suresh', 'Mathew', 'Das', 'Rao', 'Iyer', 'Narayanan', 'Sharma'];
const facultyNames = ['Priya Nair', 'Rahul Sharma', 'Anjali Menon', 'Suresh Kumar', 'Ravi Pillai', 'Meera Joseph', 'Kiran Das', 'Nisha Varma', 'Aditya Rao', 'Sneha Iyer', 'Vishnu Menon', 'Kavya Nair', 'Rohan Mathew', 'Divya Krishnan', 'Akash Patel', 'Siddharth Rao', 'Neha Thomas', 'Arun Babu', 'Lakshmi Menon', 'Joel Varghese', 'Sanjay Kumar', 'Remya Nair', 'Midhun Raj', 'Asha Menon', 'Manu Thomas', 'Greeshma Pillai', 'Jithin Das', 'Swetha Varma', 'Sajin Joseph', 'Anu Krishnan', 'Vivek Nair', 'Reshma Mathew', 'Binu Raj', 'Lekshmi Das', 'Naveen Kumar', 'Shilpa Menon', 'Anoop Thomas', 'Roshni Nair', 'Vimal Joseph', 'Geethu Varma'];
const designations = ['Lecturer', 'Senior Lecturer', 'Instructor', 'Demonstrator', 'Workshop Instructor'];
const qualifications = ['M.Tech', 'M.E.', 'B.Tech', 'M.Sc.', 'Ph.D.'];
const facultyNameFor = (index) => facultyNames[index] || `${firstNames[(index + 4) % firstNames.length]} ${lastNames[(index * 5 + 2) % lastNames.length]}`;

const departments = [
  { name: 'Civil Engineering', code: 'CE', description: 'Diploma in Civil Engineering' },
  { name: 'Computer Hardware Engineering', code: 'CH', description: 'Diploma in Computer Hardware Engineering' },
  { name: 'Electronics Engineering', code: 'EC', description: 'Diploma in Electronics Engineering' },
  { name: 'Electrical & Electronics Engineering', code: 'EEE', description: 'Diploma in Electrical & Electronics Engineering' },
  { name: 'Instrumentation Engineering', code: 'IE', description: 'Diploma in Instrumentation Engineering' },
  { name: 'Mechanical Engineering', code: 'ME', description: 'Diploma in Mechanical Engineering' },
];

const curriculum = {
  "Civil Engineering": {
    "1": [
      "Communication Skills in English",
      "Mathematics I",
      "Applied Physics I",
      "Applied Chemistry",
      "Engineering Graphics",
      "Applied Physics Lab",
      "Applied Chemistry Lab",
      "Introduction to IT Systems Lab",
      "Engineering Workshop Practice",
      "Sports and Yoga"
    ],
    "2": [
      "Mathematics II",
      "Applied Physics II",
      "Environmental Science",
      "Engineering Mechanics",
      "Basic Surveying",
      "Communication Skills in English Lab",
      "Applied Physics Lab",
      "Engineering Mechanics Lab",
      "Basic Surveying Lab",
      "Engineering Workshop Practice"
    ],
    "3": [
      "Advanced Surveying",
      "Concrete Technology",
      "Building Construction and Construction Materials",
      "Theory of Structures",
      "Concrete Technology Lab",
      "Surveying Lab",
      "Construction Materials Lab",
      "Building Drawing and Estimation Lab",
      "CAD Lab",
      "Internship I"
    ],
    "4": [
      "Geotechnical Engineering",
      "Hydraulics and Irrigation Engineering",
      "Estimating & Costing",
      "Community Skills in Indian Knowledge System",
      "Advanced Surveying Lab",
      "Hydraulics and Irrigation Engineering Lab",
      "Estimating and Costing Lab",
      "Geotechnical Engineering Lab",
      "Minor Project"
    ],
    "5": [
      "Construction Management and Safety Engineering",
      "Design of Steel and RCC Structures",
      "Transportation Engineering",
      "Habitat Technology",
      "Transportation Engineering Lab",
      "Structural Engineering Drawing Lab",
      "Advanced CAD Lab",
      "Seminar",
      "Internship II",
      "Major Project"
    ],
    "6": [
      "Entrepreneurship and Startup",
      "Public Health Engineering",
      "Renewable Energy and Environment",
      "Indian Constitution",
      "Computer Application Lab",
      "Material Testing Lab",
      "Public Health Engineering Lab",
      "Major Project"
    ]
  },
  "Computer Hardware Engineering": {
    "1": [
      "Communication Skills in English",
      "Mathematics I",
      "Applied Physics I",
      "Applied Chemistry",
      "Engineering Graphics",
      "Applied Physics Lab",
      "Applied Chemistry Lab",
      "Introduction to IT Systems Lab",
      "Engineering Workshop Practice",
      "Sports and Yoga"
    ],
    "2": [
      "Mathematics II",
      "Applied Physics II",
      "Environmental Science",
      "Fundamentals of Electrical & Electronics Engineering",
      "Problem Solving and Programming",
      "Communication Skills in English Lab",
      "Applied Physics Lab",
      "Fundamentals of Electrical & Electronics Engineering Lab",
      "Problem Solving and Programming Lab",
      "Engineering Workshop Practice",
      "Internship I"
    ],
    "3": [
      "Computer System Architecture",
      "Programming in C",
      "Computer Networks I",
      "Digital Computer Fundamentals",
      "Programming in C Lab",
      "System Administration Lab",
      "Digital Computer Fundamentals Lab",
      "Computer Hardware Lab I",
      "Application Development Lab"
    ],
    "4": [
      "Object Oriented Programming",
      "Computer Networks II",
      "Embedded System and Real Time Operating System",
      "Community Skills in Indian Knowledge System",
      "Object Oriented Programming Lab",
      "Network Administration Lab I",
      "Embedded System Lab",
      "Computer Hardware Lab II",
      "Minor Project",
      "Internship II"
    ],
    "5": [
      "Project Management and Software Engineering",
      "Internet of Things",
      "Operating System",
      "Virtualisation Technology and Cloud Computing",
      "Web Programming",
      "Data Structures",
      "Internet of Things Lab",
      "Network Administration Lab II",
      "Virtualisation Technology and Cloud Computing Lab",
      "Web Programming Lab",
      "Data Structures Lab",
      "Seminar",
      "Major Project"
    ],
    "6": [
      "Software Testing",
      "Fundamentals of Artificial Intelligence & Machine Learning",
      "Database Management Systems",
      "Introduction to IoT",
      "Multimedia",
      "Cloud Computing",
      "Computer System Hardware",
      "Indian Constitution",
      "Corresponding practical/elective labs",
      "Major Project"
    ]
  },
  "Electronics Engineering": {
    "1": [
      "Communication Skills in English",
      "Mathematics I",
      "Applied Physics I",
      "Applied Chemistry",
      "Engineering Graphics",
      "Applied Physics Lab",
      "Applied Chemistry Lab",
      "Introduction to IT Systems Lab",
      "Engineering Workshop Practice",
      "Sports and Yoga"
    ],
    "2": [
      "Mathematics II",
      "Applied Physics II",
      "Environmental Science",
      "Fundamentals of Electrical & Electronics Engineering",
      "Basic Electronics",
      "Communication Skills in English Lab",
      "Applied Physics Lab",
      "Fundamentals of Electrical & Electronics Engineering Lab",
      "Engineering Graphics Using CAD Software",
      "Electronics Tinkering Workshop",
      "Internship I"
    ],
    "3": [
      "Electric Circuits & Networks",
      "Principles of Electronic Communication",
      "Electronic Circuits",
      "Digital Electronics",
      "Fundamentals of C Programming",
      "Principles of Electronic Communication Lab",
      "Electronic Circuits Lab",
      "Digital Electronics Lab",
      "Fundamentals of C Programming Lab"
    ],
    "4": [
      "Microcontroller and Applications",
      "Electronic Measurements and Instrumentation",
      "Linear Integrated Circuits",
      "Community Skills in Indian Knowledge System",
      "Microcontroller and Applications Lab",
      "Linear Integrated Circuits Lab",
      "PCB and Prototyping Workshop",
      "Python Programming Lab",
      "Minor Project"
    ],
    "5": [
      "Industrial Management and Safety",
      "Embedded System",
      "Industrial Automation",
      "Optical Communication and Networking",
      "Microwave Devices and Radar",
      "Advanced Microprocessor",
      "Digital Communication",
      "Telecommunication Networks",
      "Corresponding practical labs",
      "Seminar",
      "Major Project"
    ],
    "6": [
      "Entrepreneurship and Startup",
      "Medical Electronics",
      "Verilog HDL & Programmable Logic Devices",
      "Consumer Electronics",
      "Concepts of IoT",
      "Contemporary Electronics",
      "Introduction to Hybrid and Electric Vehicles",
      "Introduction to Multimedia",
      "Indian Constitution",
      "Simulation Lab with Numerical Software",
      "Computer Hardware and Data Communication Lab",
      "Corresponding elective labs",
      "Major Project"
    ]
  },
  "Electrical & Electronics Engineering": {
    "1": [
      "Communication Skills in English",
      "Mathematics I",
      "Applied Physics I",
      "Applied Chemistry",
      "Engineering Graphics",
      "Applied Physics Lab",
      "Applied Chemistry Lab",
      "Introduction to IT Systems Lab",
      "Engineering Workshop Practice",
      "Sports and Yoga"
    ],
    "2": [
      "Mathematics II",
      "Applied Physics II",
      "Environmental Science",
      "Fundamentals of Electrical & Electronics Engineering",
      "Elementary Concept of Electrical System",
      "Communication Skills in English Lab",
      "Applied Physics Lab",
      "Fundamentals of Electrical & Electronics Engineering Lab",
      "Engineering Graphics Using CAD Software",
      "Engineering Workshop Practice",
      "Internship I"
    ],
    "3": [
      "Analog & Digital Circuits",
      "DC Machines & Traction Motors",
      "Fundamentals of Electric Circuits",
      "Electrical & Electronics Measuring Instruments",
      "Mechanical Engineering",
      "DC Machines Lab",
      "Electrical Measurements Lab",
      "Electrical Workshop Practice",
      "Mechanical Engineering Lab"
    ],
    "4": [
      "Power Electronics Devices and Circuits",
      "Electrical Installation Design & Estimation",
      "Induction Machines",
      "Community Skills in Indian Knowledge System",
      "Electronics Lab",
      "Induction Machines Lab",
      "Domestic Appliances Repair & Maintenance Workshop",
      "Professional Practice Lab",
      "Minor Project"
    ],
    "5": [
      "Industrial Management and Safety",
      "Synchronous Machines & FHP Motors",
      "Electricity Generation, Transmission & Distribution",
      "Renewable Energy Power Plant",
      "Industrial Drives & Control",
      "Switch Gear & Protection",
      "Corresponding labs",
      "Seminar",
      "Internship II",
      "Major Project"
    ],
    "6": [
      "Entrepreneurship and Startup",
      "Energy Conservation & Audit",
      "Microcontroller & PLC",
      "Electric Vehicles",
      "Solar Power Technologies",
      "Energy Conservation & Management",
      "Electrification of Residential Buildings",
      "Electric Vehicles and Traction",
      "Indian Constitution",
      "Electrical Computer Aided Drafting Lab",
      "Industrial Automation Lab",
      "Corresponding elective labs",
      "Major Project"
    ]
  },
  "Instrumentation Engineering": {
    "1": [
      "Communication Skills in English",
      "Mathematics I",
      "Applied Physics I",
      "Applied Chemistry",
      "Engineering Graphics",
      "Applied Physics Lab",
      "Applied Chemistry Lab",
      "Introduction to IT Systems Lab",
      "Engineering Workshop Practice",
      "Sports and Yoga"
    ],
    "2": [
      "Mathematics II",
      "Applied Physics II",
      "Environmental Science",
      "Fundamentals of Electrical & Electronics Engineering",
      "Electronic Instrumentation",
      "Communication Skills in English Lab",
      "Applied Physics Lab",
      "Fundamentals of Electrical & Electronics Engineering Lab",
      "Electronic Instrumentation Lab",
      "Engineering Workshop Practice",
      "Internship I"
    ],
    "3": [
      "Digital Circuits and Systems",
      "Sensors and Transducers",
      "Analog Circuits for Instrumentation",
      "Control Engineering",
      "Digital Circuits and Systems Lab",
      "Sensors and Transducers Lab",
      "Analog Circuits Lab for Instrumentation",
      "Maintenance & Calibration Workshop I",
      "Product Design & Development Workshop"
    ],
    "4": [
      "Process Variables Measurement",
      "Microcontroller Programming and Applications",
      "Process Control Instrumentation",
      "Community Skills in Indian Knowledge System",
      "Analytical & Biomedical Instruments",
      "Process Control Instrumentation Lab",
      "Microcontroller and Interfacing Lab",
      "Maintenance & Calibration Workshop II",
      "Minor Project"
    ],
    "5": [
      "Industrial Management and Safety",
      "Industrial Instrumentation",
      "Industrial Process Control",
      "Transducers and Signal Conditioning",
      "Instrumentation System Design",
      "Industrial Instrumentation Lab",
      "Process Control Lab",
      "Seminar",
      "Internship II"
    ],
    "6": [
      "Entrepreneurship and Startup",
      "Advanced Process Control",
      "Biomedical Instrumentation",
      "Computerized Measurement and Control",
      "Industrial Automation",
      "Indian Constitution",
      "Advanced Instrumentation Lab",
      "Major Project"
    ]
  },
  "Mechanical Engineering": {
    "1": [
      "Communication Skills in English",
      "Mathematics I",
      "Applied Physics I",
      "Applied Chemistry",
      "Engineering Graphics",
      "Applied Physics Lab",
      "Applied Chemistry Lab",
      "Introduction to IT Systems Lab",
      "Engineering Workshop Practice",
      "Sports and Yoga"
    ],
    "2": [
      "Mathematics II",
      "Applied Physics II",
      "Environmental Science",
      "Engineering Mechanics",
      "Manufacturing Technology",
      "Communication Skills in English Lab",
      "Applied Physics Lab",
      "Engineering Mechanics Lab",
      "Basic CAD Lab",
      "Engineering Workshop Practice"
    ],
    "3": [
      "Strength of Materials",
      "Material Science and Metrology",
      "Machine Tools",
      "Fundamentals of Electrical Engineering",
      "Machine Drawing",
      "Material Testing and Metallography Lab",
      "Mechanical Workshop III",
      "Electrical and Electronics Lab",
      "Advanced CADD Lab",
      "Internship I"
    ],
    "4": [
      "Thermal Engineering",
      "Fluid Mechanics and Hydraulic Machines",
      "Automobile Engineering",
      "Community Skills in Indian Knowledge System",
      "Industrial Engineering",
      "Thermal Engineering Lab",
      "Fluid Mechanics Lab",
      "Mechanical Workshop IV",
      "Minor Project"
    ],
    "5": [
      "Industrial Management and Safety",
      "Design of Machine Elements",
      "Refrigeration and Air Conditioning",
      "Modern Production Process",
      "Material Handling",
      "Power Plant Engineering",
      "Machine Shop Practice",
      "Hydraulic Machines Lab",
      "Automotive Lab",
      "Seminar",
      "Internship II",
      "Major Project"
    ],
    "6": [
      "Entrepreneurship and Startup",
      "Mechatronics",
      "Computer Integrated Manufacturing",
      "Electric Vehicles",
      "Electric and Hybrid Vehicles",
      "Computer Aided Design and Manufacturing",
      "Operation Research",
      "Renewable Energy Technologies",
      "Product Design",
      "Indian Constitution",
      "Production Software Lab",
      "Refrigeration and Air Conditioning Lab",
      "Advanced Machine Tools Lab",
      "Major Project"
    ]
  }
};
const officialCodes = {
  "Instrumentation Engineering": {
    "Communication Skills in English": "1001",
    "Mathematics I": "1002",
    "Applied Physics I": "1003",
    "Applied Chemistry": "1004",
    "Engineering Graphics": "1005",
    "Applied Physics Lab": "2006",
    "Applied Chemistry Lab": "1007",
    "Introduction to IT Systems Lab": "1008",
    "Engineering Workshop Practice": "2009",
    "Sports and Yoga": "1009",
    "Mathematics II": "2002",
    "Applied Physics II": "2003",
    "Environmental Science": "2001",
    "Fundamentals of Electrical & Electronics Engineering": "2031",
    "Electronic Instrumentation": "2081",
    "Communication Skills in English Lab": "2008",
    "Fundamentals of Electrical & Electronics Engineering Lab": "2039",
    "Electronic Instrumentation Lab": "2089",
    "Internship I": "3009",
    "Digital Circuits and Systems": "3081",
    "Sensors and Transducers": "3082",
    "Analog Circuits for Instrumentation": "3083",
    "Control Engineering": "3084",
    "Digital Circuits and Systems Lab": "3085",
    "Sensors and Transducers Lab": "3086",
    "Analog Circuits Lab for Instrumentation": "3087",
    "Maintenance & Calibration Workshop I": "3088",
    "Product Design & Development Workshop": "3089",
    "Process Variables Measurement": "4081",
    "Microcontroller Programming and Applications": "4082",
    "Process Control Instrumentation": "4083",
    "Community Skills in Indian Knowledge System": "4001",
    "Analytical & Biomedical Instruments": "4084",
    "Process Control Instrumentation Lab": "4087",
    "Microcontroller and Interfacing Lab": "4088",
    "Maintenance & Calibration Workshop II": "4089",
    "Minor Project": "4009",
    "Internship II": "5009",
    "Industrial Management and Safety": "5001",
    "Industrial Instrumentation": "5081"
  }
};

const courseRooms = [
  'Room 101', 'Room 102', 'Room 103', 'Computer Lab 1', 'Computer Lab 2',
  'Electronics Lab', 'Digital Electronics Lab', 'Electrical Machines Lab',
  'Civil Engineering Lab', 'Surveying Lab', 'Mechanical Workshop', 'Automobile Lab',
  'Instrumentation Lab', 'Network Lab', 'Embedded Systems Lab',
];

async function main() {
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB');
  const adminEmail = String(process.env.SEED_ADMIN_EMAIL || 'hod@college.edu').trim().toLowerCase();
  const superAdminEmail = String(process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@college.edu').trim().toLowerCase();
  const alreadySeeded = await col('seedmetadata').findOne({ _id: SEED_TAG }) || await col('users').findOne({ email: adminEmail });
  if (alreadySeeded) {
    console.log(`⚠ Government Polytechnic seed already exists (${adminEmail}). Nothing was duplicated.`);
    await mongoose.disconnect();
    return;
  }

  const hodByCode = Object.fromEntries(departments.map((department) => [department.code, idFor(`hod:${department.code}`)]));
  const departmentByCode = Object.fromEntries(departments.map((department) => [department.code, idFor(`department:${department.code}`)]));
  const semesterByNumber = Object.fromEntries([1, 2, 3, 4, 5, 6].map((number) => [number, idFor(`semester:${number}`)]));
  const classByKey = {};
  for (const department of departments) for (let semester = 1; semester <= 6; semester += 1) classByKey[`${department.code}:${semester}`] = idFor(`class:${department.code}:${semester}`);

  const superAdminId = idFor('user:super-admin');
  const facultyByDepartment = Object.fromEntries(departments.map((department) => [department.code, []]));
  const facultyDistribution = [17, 17, 16, 17, 16, 17];
  let facultyCursor = 0;
  const facultyUsers = [];
  for (let departmentIndex = 0; departmentIndex < departments.length; departmentIndex += 1) {
    const department = departments[departmentIndex];
    for (let localIndex = 0; localIndex < facultyDistribution[departmentIndex]; localIndex += 1) {
      const id = idFor(`faculty:${department.code}:${localIndex + 1}`);
      const name = facultyNameFor(facultyCursor);
      const employeeId = `FAC-${department.code}-${String(localIndex + 1).padStart(2, '0')}`;
      facultyByDepartment[department.code].push(id);
      facultyUsers.push({ _id: id, name, email: `${slug(name)}.${department.code.toLowerCase()}@faculty.college.edu`, role: 'admin', employeeId, department: departmentByCode[department.code], phone: `+91 98${String(100000 + facultyCursor).slice(-8)}`, designation: designations[facultyCursor % designations.length], qualification: qualifications[facultyCursor % qualifications.length], dateOfBirth: dobFor(30 + (facultyCursor % 15), facultyCursor), password: hash(passwords.faculty), isEmailVerified: true, isActive: true, seedTag: SEED_TAG, createdBy: hodByCode[department.code], createdAt: now, updatedAt: now });
      facultyCursor += 1;
    }
  }

  const hodUsers = departments.map((department, index) => ({ _id: hodByCode[department.code], name: `${facultyNames[(index + 3) % facultyNames.length]} — HOD`, email: index === 0 ? adminEmail : `hod.${department.code.toLowerCase()}@college.edu`, role: 'super_admin', employeeId: `HOD-${department.code}`, department: departmentByCode[department.code], phone: `+91 97${String(100000 + index).slice(-8)}`, designation: 'HOD', qualification: index % 2 ? 'M.Tech' : 'M.E.', dateOfBirth: dobFor(42 + index, index), password: hash(passwords.hod), isEmailVerified: true, isActive: true, seedTag: SEED_TAG, createdAt: now, updatedAt: now }));
  const superAdmin = { _id: superAdminId, name: process.env.SEED_HOD_NAME || 'Head of Department', email: process.env.SEED_HOD_EMAIL || superAdminEmail, role: 'super_admin', employeeId: 'SUPER-001', password: hash(passwords.superAdmin), isEmailVerified: true, isActive: true, seedTag: SEED_TAG, createdAt: now, updatedAt: now };

  const studentDistribution = { CE: 36, CH: 42, EC: 34, EEE: 36, IE: 30, ME: 32 };
  const students = [];
  let studentGlobal = 0;
  for (const department of departments) {
    const count = studentDistribution[department.code];
    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const semester = (localIndex % 6) + 1;
      const id = idFor(`student:${department.code}:${localIndex + 1}`);
      const first = firstNames[studentGlobal % firstNames.length];
      const last = lastNames[(studentGlobal * 3) % lastNames.length];
      const registerNumber = `GP-${department.code}-${String(2024 + (localIndex % 2)).slice(-2)}-${String(localIndex + 1).padStart(3, '0')}`;
      students.push({ _id: id, name: `${first} ${last}`, email: `${slug(first)}.${slug(last)}.${department.code.toLowerCase()}${localIndex + 1}@student.college.edu`, role: 'user', registerNumber, department: departmentByCode[department.code], class: classByKey[`${department.code}:${semester}`], admissionYear: 2024 + (localIndex % 2), academicStatus: 'active', gender: ['female', 'male', 'female', 'male'][studentGlobal % 4], phone: `+91 96${String(100000 + studentGlobal).slice(-8)}`, dateOfBirth: dobFor(18 + (studentGlobal % 6), studentGlobal), password: hash(passwords.student), isEmailVerified: true, isActive: true, seedTag: SEED_TAG, createdBy: hodByCode[department.code], createdAt: now, updatedAt: now });
      studentGlobal += 1;
    }
  }

  const users = [superAdmin, ...hodUsers, ...facultyUsers, ...students];
  await col('users').insertMany(users.map((user) => ({ ...user, roleModelVersion: 2 })));
  console.log(`✔ Accounts: ${hodUsers.length + 1} HOD, ${facultyUsers.length} Faculty, ${students.length} Students`);

  await col('departments').insertMany(departments.map((department) => ({ _id: departmentByCode[department.code], ...department, isActive: true, createdBy: hodByCode[department.code], seedTag: SEED_TAG, createdAt: now, updatedAt: now })));
  await col('semesters').insertMany([1, 2, 3, 4, 5, 6].map((number) => ({ _id: semesterByNumber[number], number, label: `Semester ${number}`, isActive: true, seedTag: SEED_TAG, createdAt: now, updatedAt: now })));
  const classes = departments.flatMap((department) => [1, 2, 3, 4, 5, 6].map((semester) => ({ _id: classByKey[`${department.code}:${semester}`], department: departmentByCode[department.code], semester: semesterByNumber[semester], name: `${department.name} - Semester ${semester}`, code: `${department.code}-S${semester}-A`, classTeacher: facultyByDepartment[department.code][(semester - 1) % facultyByDepartment[department.code].length], isActive: true, seedTag: SEED_TAG, createdBy: hodByCode[department.code], createdAt: now, updatedAt: now })));
  await col('classes').insertMany(classes);
  console.log(`✔ Academic structure: ${departments.length} departments, 6 semesters, ${classes.length} classes`);

  const subjects = [];
  const subjectStudents = new Map();
  for (const department of departments) {
    for (let semester = 1; semester <= 6; semester += 1) {
      const classId = classByKey[`${department.code}:${semester}`];
      const classStudents = students.filter((student) => String(student.class) === String(classId));
      const facultyPool = facultyByDepartment[department.code];
      const names = curriculum[department.name][String(semester)] || [];
      names.forEach((name, index) => {
        const sourceCode = officialCodes[department.name]?.[name];
        const code = sourceCode ? `${department.code}-${sourceCode}` : `${department.code}-S${semester}-${String(index + 1).padStart(2, '0')}`;
        const id = idFor(`subject:${department.code}:${semester}:${index + 1}`);
        const isElective = /elective|software testing|artificial intelligence|database management systems|multimedia|cloud computing/i.test(name);
        const assignedStudents = isElective ? classStudents.filter((_, studentIndex) => studentIndex % 2 === index % 2).map((student) => student._id) : [];
        subjectStudents.set(String(id), isElective && assignedStudents.length ? assignedStudents : classStudents.map((student) => student._id));
        subjects.push({ _id: id, name, code, department: departmentByCode[department.code], semester: semesterByNumber[semester], class: classId, faculty: [facultyPool[index % facultyPool.length]], students: assignedStudents, isElective, isActive: true, room: courseRooms[index % courseRooms.length], seedTag: SEED_TAG, createdBy: hodByCode[department.code], createdAt: now, updatedAt: now });
      });
    }
  }
  await col('subjects').insertMany(subjects);
  console.log(`✔ Subjects: ${subjects.length} curriculum subjects; every subject has faculty assigned`);

  const weekdayPeriods = [
    { order: 1, name: 'Period 1', kind: 'class', startTime: '08:00', endTime: '08:55' },
    { order: 2, name: 'Period 2', kind: 'class', startTime: '09:00', endTime: '09:55' },
    { order: 3, name: 'Period 3', kind: 'class', startTime: '10:00', endTime: '10:55' },
    { order: 4, name: 'Break', kind: 'break', startTime: '11:00', endTime: '11:20' },
    { order: 5, name: 'Period 4', kind: 'class', startTime: '11:20', endTime: '12:15' },
    { order: 6, name: 'Lunch', kind: 'break', startTime: '12:15', endTime: '13:00' },
    { order: 7, name: 'Period 5', kind: 'class', startTime: '13:00', endTime: '13:55' },
    { order: 8, name: 'Period 6', kind: 'class', startTime: '14:00', endTime: '14:55' },
  ];
  const saturdayPeriods = [
    { order: 1, name: 'Period 1', kind: 'class', startTime: '08:00', endTime: '08:55' },
    { order: 2, name: 'Period 2', kind: 'class', startTime: '09:00', endTime: '09:55' },
    { order: 3, name: 'Break', kind: 'break', startTime: '10:00', endTime: '10:15' },
    { order: 4, name: 'Period 3', kind: 'class', startTime: '10:15', endTime: '11:10' },
    { order: 5, name: 'Period 4', kind: 'class', startTime: '11:15', endTime: '12:10' },
  ];
  const periodTemplates = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((dayOfWeek) => ({ _id: idFor(`period:${dayOfWeek}`), dayOfWeek, periods: weekdayPeriods, isActive: true, seedTag: SEED_TAG, createdAt: now, updatedAt: now })).concat({ _id: idFor('period:saturday'), dayOfWeek: 'saturday', periods: saturdayPeriods, isActive: true, seedTag: SEED_TAG, createdAt: now, updatedAt: now });
  await col('periodtemplates').insertMany(periodTemplates);

  const timetableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const timetableDocs = [];
  const facultyForSubject = new Map(subjects.map((subject) => [String(subject._id), new Set((subject.faculty || []).map(String))]));
  classes.forEach((classDoc, classIndex) => {
    const classSubjects = subjects.filter((subject) => String(subject.class) === String(classDoc._id));
    const days = timetableDays.map((dayOfWeek, dayIndex) => {
      const baseSlots = dayOfWeek === 'saturday' ? saturdayPeriods : dayOfWeek === 'sunday' ? [] : weekdayPeriods;
      const slots = baseSlots.map((period) => {
        if (period.kind === 'break') return { ...period };
        const subject = classSubjects[(period.order + dayIndex + classIndex) % classSubjects.length];
        // Keep timetable assignments within the class department. Each
        // department has enough Faculty for the classes sharing a period, and
        // the deterministic rotation keeps assignments conflict-free without
        // creating cross-department teaching relationships.
        const departmentFaculty = facultyByDepartment[department.code] || [];
        if (!departmentFaculty.length) throw new Error(`No Faculty available for department ${department.code}.`);
        const faculty = departmentFaculty[(classIndex + (dayIndex * classes.length) + (period.order * classes.length)) % departmentFaculty.length];
        facultyForSubject.get(String(subject._id))?.add(String(faculty._id));
        return { ...period, subject: subject._id, faculty: faculty._id };
      });
      return { dayOfWeek, slots };
    });
    timetableDocs.push({ _id: idFor(`timetable:${classDoc.code}`), class: classDoc._id, days, isActive: true, createdBy: classDoc.createdBy, seedTag: SEED_TAG, createdAt: now, updatedAt: now });
  });
  await col('subjects').bulkWrite(subjects.map((subject) => ({ updateOne: { filter: { _id: subject._id }, update: { $set: { faculty: [...(facultyForSubject.get(String(subject._id)) || new Set())] } } } })));
  await col('timetables').insertMany(timetableDocs);
  console.log(`✔ Class timetables: ${timetableDocs.length} department-semester schedules with availability-safe assignments`);

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const periodOrders = [1, 2, 3, 5, 7, 8];
  const attendanceDocs = [];
  for (let daysAgo = 90; daysAgo >= 1; daysAgo -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    date.setUTCHours(0, 0, 0, 0);
    const day = date.getUTCDay();
    if (day === 0) continue;
    const dayOfWeek = dayNames[day];
    const dayPeriods = day === 6 ? [1, 2, 4, 5] : periodOrders;
    for (const subject of subjects) {
      const eligible = subjectStudents.get(String(subject._id)) || [];
      for (let p = 0; p < eligible.length; p += 1) {
        const studentId = eligible[p];
        const attendanceRate = stableRate((p + daysAgo + subject.code.length) % 7);
        const present = ((p * 11 + daysAgo * 3 + subject.code.length) % 100) < Math.round(attendanceRate * 100);
        const periodOrder = dayPeriods[(p + daysAgo) % dayPeriods.length];
        const facultyId = subject.faculty[0];
        attendanceDocs.push({ date, dayOfWeek, periodOrder, periodName: `Period ${periodOrder}`, subject: subject._id, class: subject.class, student: studentId, faculty: facultyId, status: present ? 'present' : 'absent', remarks: '', markedAt: now, createdAt: now, updatedAt: now });
      }
    }
  }
  for (let i = 0; i < attendanceDocs.length; i += 1000) await col('attendances').insertMany(attendanceDocs.slice(i, i + 1000));
  console.log(`✔ Attendance: ${attendanceDocs.length} records across 90 calendar days`);

  const notificationTemplates = [
    { type: 'attendance_shortage', title: 'Attendance review', message: 'Please review your attendance percentage and attend upcoming classes regularly.' },
    { type: 'exam', title: 'Internal assessment notice', message: 'Please check the academic calendar for internal assessment dates.' },
    { type: 'holiday', title: 'Campus announcement', message: 'Please check the latest department announcement and timetable updates.' },
    { type: 'assignment', title: 'Assignment reminder', message: 'Review outstanding subject work before the next scheduled class.' },
  ];
  const notifications = users.flatMap((user, userIndex) => notificationTemplates.slice(0, roleValues(ROLES.USER).includes(user.role) ? 2 : 3).map((template, index) => ({ _id: idFor(`notification:${String(user._id)}:${index}`), user: user._id, ...template, isRead: false, meta: { seedTag: SEED_TAG }, createdAt: now, updatedAt: now })));
  await col('notifications').insertMany(notifications);
  await col('seedmetadata').insertOne({ _id: SEED_TAG, createdAt: now, departments: departments.length, classes: classes.length, subjects: subjects.length, faculty: facultyUsers.length, students: students.length, attendance: attendanceDocs.length });

  const departmentCounts = Object.fromEntries(departments.map((department) => [department.name, students.filter((student) => String(student.department) === String(departmentByCode[department.code])).length]));
  const refsValid = classes.every((item) => departmentByCode[item.code.split('-')[0]] && item.semester) && subjects.every((item) => item.department && item.semester && item.class && item.faculty?.length);
  if (departments.length !== 6 || classes.length !== 36 || facultyUsers.length !== 100 || students.length < 150 || students.length > 250 || timetableDocs.length !== classes.length || !refsValid) throw new Error('Seed validation failed: relationship/count checks did not pass.');

  console.log('\n========================================');
  console.log('GOVERNMENT POLYTECHNIC SEED COMPLETE');
  console.log('========================================');
  console.log(`Departments:        ${departments.length}`);
  console.log('Semesters:          6 shared records / 36 department-semester classes');
  console.log(`Classes:            ${classes.length}`);
  console.log(`Subjects:           ${subjects.length}`);
  console.log(`Faculty:            ${facultyUsers.length} (100 required)`);
  console.log(`Students:           ${students.length}`);
  console.log(`Timetable entries:  ${timetableDocs.reduce((sum, item) => sum + item.days.reduce((daySum, day) => daySum + day.slots.length, 0), 0)}`);
  console.log(`Attendance records: ${attendanceDocs.length}`);
  console.log(`Notifications:      ${notifications.length}`);
  for (const [name, count] of Object.entries(departmentCounts)) console.log(`${name.padEnd(34)} ${count} students`);
  console.log('Seed validation: PASSED');
  console.log('========================================');
  console.log(`Super Admin: ${superAdminEmail}`);
  console.log(`Primary HOD:  ${adminEmail}`);
  console.log('Use the configured seed environment passwords; none are printed or stored in plaintext.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seed failed:', error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
