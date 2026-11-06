import asyncHandler from 'express-async-handler';
import { User, Subject, Attendance, ActivityLog, Class, Department, AttendanceCorrection, Timetable } from '../models/index.js';
import { getRegistrationSummary } from '../services/badgeService.js';
import { memoize } from '../utils/memoryCache.js';

// The HOD dashboard aggregates are institution-wide and identical for every HOD, so they are
// computed once per window however many HODs open it. Short enough to feel live.
const HOD_DASHBOARD_CACHE_MS = Number(process.env.HOD_DASHBOARD_CACHE_MS ?? 30000);
// After that, the previous result is still served instantly while one background refresh runs.
const HOD_DASHBOARD_STALE_MS = Number(process.env.HOD_DASHBOARD_STALE_MS ?? 10 * 60 * 1000);
import { getDayOfWeekName } from '../services/attendanceSessionService.js';
import { getClassDaySchedule, getFacultySubjectScope } from '../services/timetableService.js';
import sendResponse from '../utils/sendResponse.js';
import {
  getOverallAttendance,
  getSubjectWiseAttendance,
  getMonthlyAttendance,
  getLowAttendanceSummary,
} from '../services/attendanceService.js';
import { roleValues, ROLES, LOW_ATTENDANCE_THRESHOLD, PRESENT_LIKE_STATUSES, PERIOD_KIND } from '../config/constants.js';

function todayRange() {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(); end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const getHodDashboard = asyncHandler(async (req, res) => {
  const { start, end } = todayRange();
  const since = monthStart();
  const attendanceScope = {};
  const userScope = {};
  const activityActorScope = {};

  const [totalStudents, totalFaculty, totalDepartments, totalClasses] = await Promise.all([
    User.countDocuments({ ...userScope, role: { $in: roleValues(ROLES.USER) }, isActive: true }),
    User.countDocuments({ ...userScope, role: { $in: roleValues(ROLES.ADMIN) }, isActive: true }),
    Department.countDocuments({ isActive: true }),
    Class.countDocuments({ ...attendanceScope, isActive: true }),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [[todayAgg], [monthAgg], lowAttendance, recentActivity, trend, registrationRequests, correctionsLastWeek] = await Promise.all([
    Attendance.aggregate([{ $match: { ...attendanceScope, date: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } } } }]),
    Attendance.aggregate([{ $match: { ...attendanceScope, date: { $gte: since } } }, { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } } } }]),
    memoize('hod:low-attendance', HOD_DASHBOARD_CACHE_MS, () => getLowAttendanceSummary({ threshold: LOW_ATTENDANCE_THRESHOLD, limit: 10 }), { staleMs: HOD_DASHBOARD_STALE_MS }),
    ActivityLog.find(activityActorScope).populate('actor', 'name role').sort({ createdAt: -1 }).limit(15),
    // Group on the stored date itself (already UTC midnight) and format afterwards: much cheaper
    // than converting every document's date to a string.
    memoize('hod:trend', HOD_DASHBOARD_CACHE_MS, async () => {
      const from = new Date(); from.setDate(from.getDate() - 13); from.setUTCHours(0, 0, 0, 0);
      const days = await Attendance.aggregate([{ $match: { ...attendanceScope, date: { $gte: from } } }, { $group: { _id: '$date', total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } } } }, { $sort: { _id: 1 } }]);
      return days.map((day) => ({ date: day._id.toISOString().slice(0, 10), total: day.total, present: day.present, percentage: day.total ? Math.round((day.present / day.total) * 10000) / 100 : 0 }));
    }, { staleMs: HOD_DASHBOARD_STALE_MS }),
    getRegistrationSummary(),
    AttendanceCorrection.countDocuments({ createdAt: { $gte: weekAgo } }),
  ]);

  return sendResponse(res, 200, 'HOD dashboard data fetched', {
    registrationRequests,
    correctionsLastWeek,
    totals: { totalStudents, totalFaculty, totalDepartments, totalClasses },
    todayAttendance: { total: todayAgg?.total || 0, present: todayAgg?.present || 0, percentage: todayAgg?.total ? Math.round((todayAgg.present / todayAgg.total) * 10000) / 100 : 0 },
    monthlyAttendance: { total: monthAgg?.total || 0, present: monthAgg?.present || 0, percentage: monthAgg?.total ? Math.round((monthAgg.present / monthAgg.total) * 10000) / 100 : 0 },
    lowAttendanceStudents: lowAttendance.students,
    lowAttendanceCount: lowAttendance.total,
    recentActivity,
    attendanceTrend: trend,
  });
});

export const getFacultyDashboard = asyncHandler(async (req, res) => {
  const facultyId = req.user._id;
  const { start, end } = todayRange();
  const facultySubjectScope = await getFacultySubjectScope(facultyId);
  const subjectsFilter = { isActive: true, ...facultySubjectScope };

  const dayName = getDayOfWeekName(new Date());
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [subjects, recentAttendance, todayMarkedCount, todayTimetables, recentCorrections, correctionsLastWeek] = await Promise.all([
    Subject.find(subjectsFilter)
      .populate('class', 'name code')
      .populate('department', 'name code'),
    Attendance.find({ faculty: facultyId })
      .populate('subject', 'name code')
      .populate('student', 'name registerNumber')
      .sort({ markedAt: -1 })
      .limit(15),
    Attendance.countDocuments({ faculty: facultyId, date: { $gte: start, $lte: end } }),
    Timetable.find({ isActive: true, 'days.dayOfWeek': dayName, 'days.slots.faculty': facultyId })
      .select('class days')
      .populate('class', 'name code')
      .populate('days.slots.subject', 'name code')
      .lean(),
    AttendanceCorrection.find({ correctedBy: facultyId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .populate('student', 'name registerNumber')
      .populate('subject', 'name code')
      .lean(),
    AttendanceCorrection.countDocuments({ correctedBy: facultyId, createdAt: { $gte: weekAgo } }),
  ]);

  // Today's teaching periods straight from the class timetables, flagged with whether
  // attendance has already been stored for each.
  const todayPeriods = todayTimetables.flatMap((timetable) => {
    const day = (timetable.days || []).find((item) => item.dayOfWeek === dayName);
    return (day?.slots || [])
      .filter((slot) => slot.kind === PERIOD_KIND.CLASS && slot.subject && String(slot.faculty) === String(facultyId))
      .map((slot) => ({
        classId: timetable.class?._id, className: timetable.class?.name || 'Class',
        subjectId: slot.subject._id, subjectName: slot.subject.name, subjectCode: slot.subject.code,
        periodOrder: slot.order, periodName: slot.name, startTime: slot.startTime || null, endTime: slot.endTime || null,
      }));
  }).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || a.periodOrder - b.periodOrder);
  const markedToday = todayPeriods.length
    ? await Attendance.find({ faculty: facultyId, date: start, periodOrder: { $in: [...new Set(todayPeriods.map((period) => period.periodOrder))] } }).select('subject periodOrder').lean()
    : [];
  const markedKeys = new Set(markedToday.map((row) => `${row.subject}:${row.periodOrder}`));
  const todaySchedule = todayPeriods.map((period) => ({ ...period, attendanceTaken: markedKeys.has(`${period.subjectId}:${period.periodOrder}`) }));

  return sendResponse(res, 200, 'Faculty dashboard data fetched', {
    dayOfWeek: dayName,
    todaySchedule,
    recentCorrections,
    correctionsLastWeek,
    assignedSubjectsCount: subjects.length,
    subjects,
    todayMarkedCount,
    recentAttendance,
  });
});

export const getStudentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { start, end } = todayRange();
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const todayName = dayNames[new Date().getDay()];

  const student = await User.findById(studentId).populate('class');

  const [overall, subjectWise, monthly, recent, todayAttendance, schedule] = await Promise.all([
    getOverallAttendance({ studentId }),
    getSubjectWiseAttendance({ studentId }),
    getMonthlyAttendance({ studentId }),
    Attendance.find({ student: studentId }).populate('subject', 'name code').sort({ date: -1, periodOrder: 1 }).limit(15),
    Attendance.find({ student: studentId, date: { $gte: start, $lte: end } }).populate('subject', 'name code').sort({ periodOrder: 1 }),
    student?.class?._id ? getClassDaySchedule(student.class._id, todayName) : Promise.resolve({ slots: [] }),
  ]);

  // Build timetable with today's attendance status per period
  let timetable = [];
  if (schedule?.slots?.length) {
    const attendanceByPeriod = {};
    todayAttendance.forEach(a => { attendanceByPeriod[a.periodOrder] = a.status; });
    timetable = schedule.slots.map(period => ({
      order: period.order,
      name: period.name,
      kind: period.kind,
      startTime: period.startTime || null,
      endTime: period.endTime || null,
      subject: period.subject ? { id: period.subject._id, name: period.subject.name, code: period.subject.code } : null,
      faculty: period.faculty ? { id: period.faculty._id, name: period.faculty.name, employeeId: period.faculty.employeeId } : null,
      attendanceStatus: attendanceByPeriod[period.order] || null,
    }));
  }

  // Attendance prediction
  const { total, present } = overall;
  const prediction = { needed75: 0, needed85: 0 };
  if (total > 0 && overall.percentage < 75) {
    prediction.needed75 = Math.max(0, Math.ceil((0.75 * total - present) / 0.25));
  }
  if (overall.percentage >= 75) {
    prediction.canMiss75 = Math.max(0, Math.floor((present - 0.75 * total) / 0.75));
  }
  if (total > 0 && overall.percentage < 85) {
    prediction.needed85 = Math.max(0, Math.ceil((0.85 * total - present) / 0.15));
  }
  if (overall.percentage >= 85) {
    prediction.canMiss85 = Math.max(0, Math.floor((present - 0.85 * total) / 0.85));
  }

  return sendResponse(res, 200, 'Student dashboard data fetched', {
    overall, subjectWise, monthly,
    recentHistory: recent,
    todayAttendance,
    timetable,
    prediction,
    lowAttendanceWarning: overall.total >= 5 && overall.percentage < LOW_ATTENDANCE_THRESHOLD,
    studentClass: student?.class?.name || null,
    todayDay: todayName,
  });
});
