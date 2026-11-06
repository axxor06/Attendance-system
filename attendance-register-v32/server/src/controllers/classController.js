import asyncHandler from 'express-async-handler';
import { Class, Department, Semester, Subject, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, roleValues, ROLES } from '../config/constants.js';
import { assertClassAccess, applyDepartmentScope, isSameId } from '../utils/authorization.js';
import { paginationMeta, parsePagination } from '../utils/pagination.js';

async function buildDisplayFields(departmentId, semesterId) {
  const [department, semester] = await Promise.all([Department.findOne({ _id: departmentId, isActive: true }), Semester.findOne({ _id: semesterId, isActive: true })]);
  if (!department) throw ApiError.badRequest('Invalid or inactive department.');
  if (!semester) throw ApiError.badRequest('Invalid or inactive semester.');
  const configuredDuration = Number(department.semesterCount || (department.programLevel === 'diploma' ? 6 : 8));
  if (Number(semester.number) > configuredDuration) throw ApiError.badRequest(`Semester ${semester.number} is outside this program's configured duration of ${configuredDuration}.`);
  return { name: `${department.name} - ${semester.label}`, code: `${department.code}-SEM${semester.number}` };
}

async function resolveClassTeacher(actor, classTeacher) {
  if (!classTeacher) return null;
  const teacher = await User.findOne({ _id: classTeacher, role: { $in: roleValues(ROLES.ADMIN) }, isActive: true }).select('_id');
  if (!teacher) throw ApiError.badRequest('Class tutor must be an active Faculty account.');
  return teacher._id;
}

export const getPublicClassOptions = asyncHandler(async (_req, res) => {
  // Registration needs only a stable option id and display label. Keep
  // department/semester internals out of this unauthenticated endpoint.
  const classes = await Class.find({ isActive: true })
    .select('_id name code')
    .sort({ name: 1 })
    .limit(200)
    .lean();
  return sendResponse(res, 200, 'Class options fetched', { classes });
});

export const createClass = asyncHandler(async (req, res) => {
  const { department, semester, classTeacher } = req.body;
  const teacherId = await resolveClassTeacher(req.user, classTeacher);
  if (await Class.exists({ department, semester })) throw ApiError.conflict('A class already exists for this department and semester.');
  const { name, code } = await buildDisplayFields(department, semester);
  const newClass = await Class.create({ department, semester, name, code, classTeacher: teacherId, createdBy: req.user._id });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.CREATE, targetType: 'Class', targetId: newClass._id, description: `Created class ${newClass.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 201, 'Class created successfully', { class: newClass });
});

export const getClasses = asyncHandler(async (req, res) => {
  const { department, semester, search } = req.query;
  let filter = department ? { department } : {};
  filter = applyDepartmentScope(req, filter);
  if (req.user.role === ROLES.USER) filter._id = req.user.class || null;
  if (req.user.role === ROLES.ADMIN) {
    const [assignedClassIds, tutorClassIds] = await Promise.all([
      Subject.distinct('class', { faculty: req.user._id, isActive: true }),
      Class.distinct('_id', { classTeacher: req.user._id, isActive: true }),
    ]);
    filter._id = { $in: [...new Set([...assignedClassIds, ...tutorClassIds].map(String))] };
  }
  if (semester) filter.semester = semester;
  if (search) {
    const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
    filter.$or = [{ name: { $regex: escapedSearch, $options: 'i' } }, { code: { $regex: escapedSearch, $options: 'i' } }];
  }
  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const [classes, total] = await Promise.all([
    Class.find(filter).populate('department', 'name code programLevel semesterCount').populate('semester', 'number label').populate('classTeacher', 'name email').sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Class.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Classes fetched', { classes, pagination: paginationMeta({ total, page: pagination.page, limit: pagination.limit }) });
});

export const getClassById = asyncHandler(async (req, res) => {
  const classDoc = await assertClassAccess(req, req.params.id);
  const [studentCount, subjectCount] = await Promise.all([User.countDocuments({ class: classDoc._id, role: { $in: roleValues(ROLES.USER) } }), Subject.countDocuments({ class: classDoc._id })]);
  await classDoc.populate([{ path: 'department', select: 'name code' }, { path: 'semester', select: 'number label' }, { path: 'classTeacher', select: 'name email' }]);
  return sendResponse(res, 200, 'Class fetched', { class: classDoc, studentCount, subjectCount });
});

export const updateClass = asyncHandler(async (req, res) => {
  const { classTeacher, isActive } = req.body;
  const classDoc = await assertClassAccess(req, req.params.id);
  const teacherId = classTeacher === undefined ? classDoc.classTeacher : await resolveClassTeacher(req.user, classTeacher);
  if (classTeacher !== undefined) classDoc.classTeacher = teacherId;
  if (isActive !== undefined) classDoc.isActive = Boolean(isActive);
  await classDoc.save();
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.UPDATE, targetType: 'Class', targetId: classDoc._id, description: `Updated class ${classDoc.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Class updated successfully', { class: classDoc });
});

export const deleteClass = asyncHandler(async (req, res) => {
  const classDoc = await assertClassAccess(req, req.params.id);
  const [studentCount, subjectCount] = await Promise.all([User.countDocuments({ class: classDoc._id, role: { $in: roleValues(ROLES.USER) } }), Subject.countDocuments({ class: classDoc._id })]);
  if (studentCount > 0 || subjectCount > 0) throw ApiError.conflict('Cannot delete a class that still has students or subjects assigned to it. Deactivate it instead.');
  await classDoc.deleteOne();
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.DELETE, targetType: 'Class', targetId: classDoc._id, description: `Deleted class ${classDoc.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Class deleted successfully');
});
