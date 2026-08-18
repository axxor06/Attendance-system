import asyncHandler from 'express-async-handler';
import { Subject, Class, Department, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, ROLES } from '../config/constants.js';
import { assertSubjectAccess, applyDepartmentScope, isHod, isSameId } from '../utils/authorization.js';
import { paginationMeta, parsePagination } from '../utils/pagination.js';

async function validateSubjectRelationships({ actor, department, semester, classId, faculty = [], students = [] }) {
  const classDoc = await Class.findOne({ _id: classId, isActive: true }).select('_id department semester');
  if (!classDoc) throw ApiError.badRequest('Invalid or inactive class.');
  if (!isSameId(classDoc.department, department) || !isSameId(classDoc.semester, semester)) throw ApiError.badRequest('Subject department, semester, and class must match.');
  if (isHod(actor) && !isSameId(actor.department, classDoc.department)) throw ApiError.forbidden('You can only manage subjects in your department.');

  if (faculty.length > 0) {
    const facultyCount = await User.countDocuments({ _id: { $in: faculty }, role: ROLES.FACULTY, isActive: true, department: classDoc.department });
    if (facultyCount !== new Set(faculty.map(String)).size) throw ApiError.badRequest('Every subject faculty member must be active and belong to the subject department.');
  }
  if (students.length > 0) {
    const studentCount = await User.countDocuments({ _id: { $in: students }, role: ROLES.STUDENT, isActive: true, class: classDoc._id });
    if (studentCount !== new Set(students.map(String)).size) throw ApiError.badRequest('Every enrolled student must be active and belong to the subject class.');
  }
  const departmentDoc = await Department.findOne({ _id: department, isActive: true }).select('_id');
  if (!departmentDoc) throw ApiError.badRequest('Invalid or inactive department.');
  return classDoc;
}

export const createSubject = asyncHandler(async (req, res) => {
  const { name, code, department, semester, classId, faculty = [], students = [], isElective } = req.body;
  await validateSubjectRelationships({ actor: req.user, department, semester, classId, faculty, students });
  if (await Subject.exists({ code: code.toUpperCase(), class: classId })) throw ApiError.conflict('A subject with this code already exists for this class.');
  const subject = await Subject.create({ name, code, department, semester, class: classId, faculty, students, isElective: !!isElective, createdBy: req.user._id });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.CREATE, targetType: 'Subject', targetId: subject._id, description: `Created subject ${subject.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 201, 'Subject created successfully', { subject });
});

export const getSubjects = asyncHandler(async (req, res) => {
  const { department, semester, classId, facultyId, search } = req.query;
  if (isHod(req.user) && department && !isSameId(req.user.department, department)) throw ApiError.forbidden('You are not authorized to view another department.');
  let filter = applyDepartmentScope(req, department ? { department } : {});
  if (semester) filter.semester = semester;
  if (classId) filter.class = classId;
  if (facultyId) filter.faculty = facultyId;
  if (req.user.role === ROLES.FACULTY) filter.faculty = req.user._id;
  if (req.user.role === ROLES.STUDENT) filter.class = req.user.class || null;
  if (search) {
    const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
    filter.$or = [{ name: { $regex: escapedSearch, $options: 'i' } }, { code: { $regex: escapedSearch, $options: 'i' } }];
  }
  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const [subjects, total] = await Promise.all([
    Subject.find(filter).populate('department', 'name code').populate('semester', 'number label').populate('class', 'name code').populate('faculty', 'name email employeeId').sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit),
    Subject.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Subjects fetched', { subjects, pagination: paginationMeta({ total, page: pagination.page, limit: pagination.limit }) });
});

export const getSubjectById = asyncHandler(async (req, res) => {
  const subject = await assertSubjectAccess(req, req.params.id);
  await subject.populate([{ path: 'department', select: 'name code' }, { path: 'semester', select: 'number label' }, { path: 'class', select: 'name code' }, { path: 'faculty', select: 'name email employeeId' }, { path: 'students', select: 'name registerNumber email' }]);
  return sendResponse(res, 200, 'Subject fetched', { subject });
});

export const getMySubjects = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const filter = { faculty: req.user._id, isActive: true };
  const [subjects, total] = await Promise.all([
    Subject.find(filter).populate('department', 'name code').populate('semester', 'number label').populate('class', 'name code').sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit),
    Subject.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Your subjects fetched', { subjects, pagination: paginationMeta({ total, page: pagination.page, limit: pagination.limit }) });
});

export const updateSubject = asyncHandler(async (req, res) => {
  const { name, code, faculty, students, isElective, isActive } = req.body;
  const subject = await assertSubjectAccess(req, req.params.id, { requireFaculty: false });
  await validateSubjectRelationships({ actor: req.user, department: subject.department, semester: subject.semester, classId: subject.class, faculty: faculty === undefined ? subject.faculty : faculty, students: students === undefined ? subject.students : students });
  if (name !== undefined) subject.name = name;
  if (code !== undefined) subject.code = code;
  if (faculty !== undefined) subject.faculty = faculty;
  if (students !== undefined) subject.students = students;
  if (isElective !== undefined) subject.isElective = Boolean(isElective);
  if (isActive !== undefined) subject.isActive = Boolean(isActive);
  await subject.save();
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.UPDATE, targetType: 'Subject', targetId: subject._id, description: `Updated subject ${subject.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Subject updated successfully', { subject });
});

export const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await assertSubjectAccess(req, req.params.id);
  if (await Attendance.exists({ subject: subject._id })) throw ApiError.conflict('Cannot delete a subject that already has attendance records. Deactivate it instead.');
  await subject.deleteOne();
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.DELETE, targetType: 'Subject', targetId: subject._id, description: `Deleted subject ${subject.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Subject deleted successfully');
});
