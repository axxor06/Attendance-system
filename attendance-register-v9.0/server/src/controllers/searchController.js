import asyncHandler from 'express-async-handler';
import { User, Class, Subject, Department } from '../models/index.js';
import sendResponse from '../utils/sendResponse.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/constants.js';
import { isGlobalAdministrator, isHod, isSameId } from '../utils/authorization.js';

export const globalSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) throw ApiError.badRequest('Search query must be at least 2 characters.');
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
  const regex = { $regex: escaped, $options: 'i' };
  const scopedHod = isHod(req.user);
  const scopedFaculty = req.user.role === ROLES.FACULTY;
  const classIds = scopedHod || scopedFaculty ? await Class.distinct('_id', scopedHod ? { department: req.user.department || null } : { _id: { $in: await Subject.distinct('class', { faculty: req.user._id, isActive: true }) } }) : null;
  const studentScope = scopedHod ? { class: { $in: classIds || [] } } : scopedFaculty ? { class: { $in: classIds || [] } } : {};
  const facultyScope = scopedHod ? { department: req.user.department || null } : scopedFaculty ? { _id: req.user._id } : {};
  const subjectScope = scopedHod ? { department: req.user.department || null } : scopedFaculty ? { faculty: req.user._id } : {};
  const departmentScope = scopedHod ? { _id: req.user.department || null } : scopedFaculty ? { _id: req.user.department || null } : {};

  const [students, faculty, departments, subjects] = await Promise.all([
    User.find({ ...studentScope, role: ROLES.STUDENT, $or: [{ name: regex }, { registerNumber: regex }, { email: regex }] }).select('name registerNumber email class').populate('class', 'name code').limit(10),
    User.find({ ...facultyScope, role: ROLES.FACULTY, $or: [{ name: regex }, { employeeId: regex }, { email: regex }] }).select('name employeeId email department').populate('department', 'name code').limit(10),
    Department.find({ ...departmentScope, $or: [{ name: regex }, { code: regex }] }).limit(10),
    Subject.find({ ...subjectScope, $or: [{ name: regex }, { code: regex }] }).select('name code class department').populate('class', 'name code').limit(10),
  ]);

  return sendResponse(res, 200, 'Search results fetched', { students, faculty, departments, subjects });
});
