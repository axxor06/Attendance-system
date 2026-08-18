import { Attendance, Subject } from '../models/index.js';
import { PRESENT_LIKE_STATUSES } from '../config/constants.js';

/**
 * Builds the base $match stage shared by most attendance aggregations.
 */
function buildMatchStage({ studentId, subjectId, classId, classIds, from, to }) {
  const match = {};
  if (studentId) match.student = studentId;
  if (subjectId) match.subject = subjectId;
  if (classId) match.class = classId;
  if (classIds) match.class = { $in: classIds };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  return match;
}

/**
 * Returns { total, present, percentage } for a student, optionally
 * scoped to a subject and/or date range. "Present" counts both
 * 'present' and 'late' statuses per PRESENT_LIKE_STATUSES.
 */
export async function getOverallAttendance({ studentId, from, to }) {
  const match = buildMatchStage({ studentId, from, to });

  const [result] = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0],
          },
        },
      },
    },
  ]);

  const total = result?.total || 0;
  const present = result?.present || 0;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 10000) / 100;

  return { total, present, percentage };
}

/**
 * Returns subject-wise attendance breakdown for a student:
 * [{ subjectId, subjectName, subjectCode, total, present, percentage }]
 */
export async function getSubjectWiseAttendance({ studentId, from, to }) {
  const match = buildMatchStage({ studentId, from, to });

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$subject',
        total: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subject',
      },
    },
    { $unwind: '$subject' },
    {
      $project: {
        _id: 0,
        subjectId: '$_id',
        subjectName: '$subject.name',
        subjectCode: '$subject.code',
        total: 1,
        present: 1,
        percentage: {
          $cond: [
            { $eq: ['$total', 0] },
            0,
            {
              $round: [
                { $multiply: [{ $divide: ['$present', '$total'] }, 100] },
                2,
              ],
            },
          ],
        },
      },
    },
    { $sort: { subjectName: 1 } },
  ]);

  return rows;
}

/**
 * Returns month-by-month attendance percentage for a student over the
 * given date range (defaults to no bound, i.e. all-time).
 * [{ year, month, total, present, percentage }]
 */
export async function getMonthlyAttendance({ studentId, from, to }) {
  const match = buildMatchStage({ studentId, from, to });

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        total: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        year: '$_id.year',
        month: '$_id.month',
        total: 1,
        present: 1,
        percentage: {
          $cond: [
            { $eq: ['$total', 0] },
            0,
            {
              $round: [
                { $multiply: [{ $divide: ['$present', '$total'] }, 100] },
                2,
              ],
            },
          ],
        },
      },
    },
    { $sort: { year: 1, month: 1 } },
  ]);

  return rows;
}

/**
 * Returns attendance percentage for every student in a given subject -
 * used for faculty subject reports and "low attendance" alerts.
 * [{ studentId, name, registerNumber, total, present, percentage }]
 */
export async function getSubjectRoster({ subjectId, from, to, studentFilter = {} }) {
  const subject = await Subject.findById(subjectId).populate('class');
  if (!subject) return [];

  const match = buildMatchStage({ subjectId, from, to });

  const attendanceRows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$student',
        total: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0],
          },
        },
      },
    },
  ]);

  const byStudent = new Map(attendanceRows.map((r) => [r._id.toString(), r]));

  // Roster = explicit `students` override if set, else everyone in the class.
  const { User } = await import('../models/index.js');
  let students;
  if (subject.students && subject.students.length > 0) {
    students = await User.find({
      ...studentFilter,
      _id: { $in: subject.students },
    }).select('name registerNumber email');
  } else {
    students = await User.find({
      ...studentFilter,
      class: subject.class._id,
      role: 'student',
    }).select('name registerNumber email');
  }

  return students
    .map((s) => {
      const row = byStudent.get(s._id.toString());
      const total = row?.total || 0;
      const present = row?.present || 0;
      const percentage = total === 0 ? 0 : Math.round((present / total) * 10000) / 100;
      return {
        studentId: s._id,
        name: s.name,
        registerNumber: s.registerNumber,
        email: s.email,
        total,
        present,
        percentage,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns all students across the institution whose overall attendance
 * percentage is below the given threshold. Used for the HOD dashboard's
 * "Low Attendance Students" widget.
 */
export async function getLowAttendanceStudents({ threshold, classId, classIds, from, to }) {
  const match = buildMatchStage({ classId, classIds, from, to });

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$student',
        total: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        total: 1,
        present: 1,
        percentage: {
          $cond: [
            { $eq: ['$total', 0] },
            0,
            { $multiply: [{ $divide: ['$present', '$total'] }, 100] },
          ],
        },
      },
    },
    { $match: { percentage: { $lt: threshold } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
    {
      $lookup: {
        from: 'classes',
        localField: 'student.class',
        foreignField: '_id',
        as: 'classInfo',
      },
    },
    { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        studentId: '$student._id',
        name: '$student.name',
        registerNumber: '$student.registerNumber',
        email: '$student.email',
        className: '$classInfo.name',
        total: 1,
        present: 1,
        percentage: { $round: ['$percentage', 2] },
      },
    },
    { $sort: { percentage: 1 } },
  ]);

  return rows;
}
