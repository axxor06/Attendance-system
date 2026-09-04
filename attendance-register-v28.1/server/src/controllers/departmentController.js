import asyncHandler from 'express-async-handler';
import { Department, Class } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION } from '../config/constants.js';
import { paginationMeta, parsePagination } from '../utils/pagination.js';

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, programLevel, semesterCount } = req.body;

  const exists = await Department.findOne({
    $or: [{ name }, { code: code.toUpperCase() }],
  });
  if (exists) {
    throw ApiError.conflict('A department with this name or code already exists.');
  }

  const department = await Department.create({
    name,
    code,
    description,
    programLevel,
    semesterCount,
    createdBy: req.user._id,
  });

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.CREATE,
    targetType: 'Department',
    targetId: department._id,
    description: `Created department ${department.name}`,
  });

  return sendResponse(res, 201, 'Department created successfully', { department });
});

export const getPublicDepartmentOptions = asyncHandler(async (_req, res) => {
  const departments = await Department.find({ isActive: true }).select('_id name code programLevel semesterCount').sort({ name: 1 }).limit(100).lean();
  return sendResponse(res, 200, 'Public department options fetched', { departments });
});

export const getDepartments = asyncHandler(async (req, res) => {
  const { includeInactive, search } = req.query;
  let filter = includeInactive === 'true' ? {} : { isActive: true };
  if (search) {
    const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
    filter.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { code: { $regex: escapedSearch, $options: 'i' } },
    ];
  }
  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const [departments, total] = await Promise.all([
    Department.find(filter)
      .sort({ name: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Department.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Departments fetched', {
    departments,
    pagination: paginationMeta({ total, page: pagination.page, limit: pagination.limit }),
  });
});

export const getDepartmentById = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');
  return sendResponse(res, 200, 'Department fetched', { department });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, programLevel, semesterCount, isActive } = req.body;

  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');

  if (name) department.name = name;
  if (code) department.code = code;
  if (description !== undefined) department.description = description;
  if (programLevel !== undefined) department.programLevel = programLevel;
  if (semesterCount !== undefined) {
    const classes = await Class.find({ department: department._id }).populate('semester', 'number').select('semester').lean();
    const highestUsedSemester = classes.reduce((highest, item) => Math.max(highest, Number(item.semester?.number || 0)), 0);
    if (Number(semesterCount) < highestUsedSemester) {
      throw ApiError.conflict(`This program already has classes through semester ${highestUsedSemester}. Choose a duration of ${highestUsedSemester} or more.`);
    }
    department.semesterCount = semesterCount;
  }
  if (isActive !== undefined) department.isActive = isActive;

  await department.save();

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.UPDATE,
    targetType: 'Department',
    targetId: department._id,
    description: `Updated department ${department.name}`,
  });

  return sendResponse(res, 200, 'Department updated successfully', { department });
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');

  const classCount = await Class.countDocuments({ department: department._id });
  if (classCount > 0) {
    throw ApiError.conflict(
      'Cannot delete a department that still has classes. Delete or reassign its classes first.'
    );
  }

  await department.deleteOne();

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.DELETE,
    targetType: 'Department',
    targetId: department._id,
    description: `Deleted department ${department.name}`,
  });

  return sendResponse(res, 200, 'Department deleted successfully');
});
