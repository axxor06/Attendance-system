import asyncHandler from 'express-async-handler';
import { User, Subject, Class, Department } from '../models/index.js';
import sendResponse from '../utils/sendResponse.js';
import ApiError from '../utils/ApiError.js';
import { canonicalRole, roleValues, ROLES } from '../config/constants.js';
import { getFacultyTimetableAccessIds } from '../services/timetableService.js';
import { isGlobalAdministrator } from '../utils/authorization.js';

export const globalSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) throw ApiError.badRequest('Search query must be at least 2 characters.');
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
  const regex = { $regex: escaped, $options: 'i' };
  const institutionWide = isGlobalAdministrator(req.user);
  const scopedFaculty = canonicalRole(req.user.role) === ROLES.ADMIN;
  const timetableAccess = scopedFaculty ? await getFacultyTimetableAccessIds(req.user._id) : { subjectIds: [], classIds: [] };
  const classIds = scopedFaculty ? [...new Set([
    ...(await Subject.distinct('class', { faculty: req.user._id, isActive: true })),
    ...(await Class.distinct('_id', { classTeacher: req.user._id, isActive: true })),
    ...timetableAccess.classIds,
  ].map(String))] : null;
  const studentScope = scopedFaculty ? { class: { $in: classIds || [] } } : {};
  const facultyScope = scopedFaculty ? { _id: req.user._id } : {};
  const subjectScope = institutionWide ? {} : scopedFaculty ? { $or: [{ faculty: req.user._id }, { _id: { $in: timetableAccess.subjectIds } }] } : {};
  const departmentScope = institutionWide ? {} : scopedFaculty ? { _id: req.user.department || null } : {};
  const subjectSearchScope = search ? { $and: [{ $or: [{ name: regex }, { code: regex }] }] } : {};
  const subjectFilter = { ...subjectScope, ...subjectSearchScope };

  const [students, faculty, departments, subjects] = await Promise.all([
    User.find({ ...studentScope, role: { $in: roleValues(ROLES.USER) }, $or: [{ name: regex }, { registerNumber: regex }, { email: regex }] }).select('name registerNumber email class').populate('class', 'name code').limit(10),
    User.find({ ...facultyScope, role: { $in: roleValues(ROLES.ADMIN) }, $or: [{ name: regex }, { employeeId: regex }, { email: regex }] }).select('name employeeId email department').populate('department', 'name code').limit(10),
    Department.find({ ...departmentScope, $or: [{ name: regex }, { code: regex }] }).limit(10),
    Subject.find(subjectFilter).select('name code class department').populate('class', 'name code').limit(10),
  ]);

  return sendResponse(res, 200, 'Search results fetched', { students, faculty, departments, subjects });
});
