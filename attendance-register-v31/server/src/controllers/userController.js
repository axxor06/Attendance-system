import asyncHandler from 'express-async-handler';
import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { User, RefreshSession, Department, Class, Otp, Attendance, Subject, Timetable } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { sendAccountCreatedEmail, sendOtpEmail } from '../utils/email.js';
import { notifyUser } from '../services/notificationService.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, canonicalRole, NOTIFICATION_TYPE, OTP_PURPOSE, roleValues, ROLES } from '../config/constants.js';
import { createOtp } from '../utils/otp.js';
import { getLoginFailureReset } from '../utils/loginProtection.js';
import { calculateAge, isValidDateOnly } from '../utils/dateOfBirth.js';
import { getOverallAttendance, getSubjectWiseAttendance } from '../services/attendanceService.js';
import { getFacultyTimetableAccessIds } from '../services/timetableService.js';
import { isAllowedProfileImageUrl } from '../services/imagekitService.js';
import { ACADEMIC_IDENTIFIER_MESSAGE, isValidAcademicIdentifier, normalizeAcademicIdentifier } from '../utils/identifierPolicy.js';
import {
  allowedUserCreationRoles,
  applyUserScope,
  assertManageableUser,
  assertStudentAccess,
  isGlobalAdministrator,
  isSameId,
} from '../utils/authorization.js';

function privilegedRole(role) {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(canonicalRole(role));
}

async function isAuthorizedTutorForStudent(actor, student) {
  return canonicalRole(actor?.role) === ROLES.ADMIN
    && canonicalRole(student?.role) === ROLES.USER
    && Boolean(await Class.exists({ _id: student.class, classTeacher: actor._id, isActive: true }));
}

const permanentCredentialAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

function generatePermanentCredential(length = 16) {
  const required = ['A', 'a', '7', '!'];
  const chars = [...required];
  while (chars.length < length) chars.push(permanentCredentialAlphabet[randomInt(permanentCredentialAlphabet.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join('');
}

async function revokeUserSessions(userId) {
  await RefreshSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function resolveDepartmentAndClass({ actor, role, departmentId, classId }) {
  let resolvedDepartment = departmentId || null;
  let classDoc = null;

  if (classId) {
    classDoc = await Class.findOne({ _id: classId, isActive: true }).select('_id department');
    if (!classDoc) throw ApiError.badRequest('Invalid or inactive class.');
    if (resolvedDepartment && !isSameId(resolvedDepartment, classDoc.department)) {
      throw ApiError.badRequest('The selected class does not belong to the selected department.');
    }
    resolvedDepartment = classDoc.department;
  }

  if ([ROLES.ADMIN, ROLES.USER].includes(canonicalRole(role)) && !resolvedDepartment) {
    throw ApiError.badRequest('A department is required for this account role.');
  }
  if (resolvedDepartment) {
    const departmentDoc = await Department.findOne({ _id: resolvedDepartment, isActive: true }).select('_id');
    if (!departmentDoc) throw ApiError.badRequest('Invalid or inactive department.');
  }
  if (canonicalRole(role) === ROLES.USER && !classDoc) {
    throw ApiError.badRequest('A class must be assigned when creating or moving a student.');
  }
  return { department: resolvedDepartment, classDoc };
}

export const createUser = asyncHandler(async (req, res) => {
  const {
    name, email, role: requestedRole, registerNumber, employeeId, department, classId, phone, dateOfBirth, designation, qualification, admissionYear, avatarUrl, password,
  } = req.body;
  const role = canonicalRole(requestedRole);
  const normalizedRegisterNumber = registerNumber ? normalizeAcademicIdentifier(registerNumber) : '';
  const normalizedEmployeeId = employeeId ? normalizeAcademicIdentifier(employeeId) : '';
  if (normalizedRegisterNumber && !isValidAcademicIdentifier(normalizedRegisterNumber)) throw ApiError.badRequest(`Register number is invalid. ${ACADEMIC_IDENTIFIER_MESSAGE}`);
  if (normalizedEmployeeId && !isValidAcademicIdentifier(normalizedEmployeeId)) throw ApiError.badRequest(`Employee ID is invalid. ${ACADEMIC_IDENTIFIER_MESSAGE}`);
  if (dateOfBirth && !isValidDateOnly(dateOfBirth)) throw ApiError.badRequest('Date of birth must be a valid non-future date in YYYY-MM-DD format.');
  if (!isAllowedProfileImageUrl(avatarUrl)) throw ApiError.badRequest('Profile photo must be uploaded through configured image storage.');
  const allowedRoles = allowedUserCreationRoles(req.user);
  if (!allowedRoles.includes(role)) throw ApiError.forbidden('This role cannot be created by your account.');
  if (role === ROLES.SUPER_ADMIN) throw ApiError.forbidden('SUPER_ADMIN accounts cannot be created through this endpoint.');

  const { department: resolvedDepartment, classDoc } = await resolveDepartmentAndClass({
    actor: req.user, role, departmentId: department, classId,
  });
  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw ApiError.emailAlreadyExists();

  if (role === ROLES.USER && normalizedRegisterNumber && await User.exists({ registerNumber: normalizedRegisterNumber })) {
    throw ApiError.conflict('A student with this register number already exists.');
  }
  if (role === ROLES.ADMIN && normalizedEmployeeId && await User.exists({ employeeId: normalizedEmployeeId })) {
    throw ApiError.conflict('A staff member with this employee ID already exists.');
  }

  const providedPassword = Boolean(password);
  const user = await User.create({
    name,
    email: normalizedEmail,
    password: password || undefined,
    passwordResetRequired: true,
    role,
    registerNumber: role === ROLES.USER ? normalizedRegisterNumber || undefined : undefined,
    employeeId: role !== ROLES.USER ? normalizedEmployeeId || undefined : undefined,
    department: resolvedDepartment,
    class: role === ROLES.USER ? classDoc._id : null,
    phone: phone || undefined,
    dateOfBirth: dateOfBirth || null,
    designation: designation || null,
    qualification: qualification || null,
    admissionYear: admissionYear || null,
    avatarUrl: avatarUrl || null,
    isEmailVerified: true,
    createdBy: req.user._id,
  });

  if (providedPassword) {
    await sendAccountCreatedEmail({
      to: user.email,
      name: user.name,
      role: user.role,
      credentialsMessage: 'Use the initial password provided securely by your administrator, then change it after first sign-in.',
    });
  } else {
    try {
      const code = await createOtp(user.email, OTP_PURPOSE.PASSWORD_RESET, {
        expiresMinutes: privilegedRole(user.role) ? 5 : undefined,
        maxAttempts: privilegedRole(user.role) ? 3 : undefined,
      });
      await sendOtpEmail({ to: user.email, name: user.name, otp: code, purpose: OTP_PURPOSE.PASSWORD_RESET });
    } catch {
      await Otp.deleteMany({ email: user.email, purpose: OTP_PURPOSE.PASSWORD_RESET });
      await User.deleteOne({ _id: user._id });
      throw ApiError.internal('Account setup email could not be sent. The account was not created.');
    }
  }

  await notifyUser({ userId: user._id, type: NOTIFICATION_TYPE.ACCOUNT_CREATED, title: 'Welcome', message: `Your ${role} account has been created.` });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.CREATE, targetType: 'User', targetId: user._id, description: `Created ${role} account for ${user.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 201, `${role} account created successfully`, {
    user: user.toSafeObject(),
    credentialMode: providedPassword ? 'administrator-provided-password' : 'email-setup-code',
  });
});

export const getUsers = asyncHandler(async (req, res) => {
  const {
    role: requestedRole,
    department,
    classId,
    semester,
    tutorsOnly,
    sortBy = 'name',
    sortOrder = 'asc',
    search,
    page = 1,
    limit = 25,
  } = req.query;
  const manageableRoles = allowedUserCreationRoles(req.user);
  const role = requestedRole ? canonicalRole(requestedRole) : null;
  if (role && !manageableRoles.includes(role)) throw ApiError.forbidden('This role is not available in your view.');
  if (tutorsOnly && role !== ROLES.ADMIN) throw ApiError.badRequest('Tutor filtering is available for Faculty only.');
  const filter = await applyUserScope(req, {
    role: role ? { $in: roleValues(role) } : { $in: manageableRoles.flatMap((value) => roleValues(value)) },
    ...(department ? { department } : {}),
    ...(classId ? { class: classId } : {}),
  });
  if (semester) {
    const semesterClasses = await Class.find({ semester, isActive: true }).select('_id').lean();
    filter.$and = [...(filter.$and || []), { class: { $in: semesterClasses.map((item) => item._id) } }];
  }
  if (tutorsOnly) {
    const tutorIds = await Class.distinct('classTeacher', { isActive: true, classTeacher: { $ne: null } });
    filter._id = { $in: tutorIds };
  }
  if (search) {
    const escapedSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
    const searchPattern = `^${escapedSearch}`;
    filter.$and = [
      ...(filter.$and || []),
      { $or: [
        { name: { $regex: searchPattern, $options: 'i' } },
        { email: { $regex: searchPattern, $options: 'i' } },
        { registerNumber: { $regex: searchPattern, $options: 'i' } },
        { employeeId: { $regex: searchPattern, $options: 'i' } },
      ] },
    ];
  }
  const pageNum = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const limitNum = Math.min(100, Math.max(1, Number.isInteger(Number(limit)) ? Number(limit) : 25));
  const allowedSorts = new Set(['name', 'department', 'semester', 'class', 'createdAt']);
  const safeSortBy = allowedSorts.has(sortBy) ? sortBy : 'name';
  const direction = String(sortOrder).toLowerCase() === 'desc' ? -1 : 1;
  const aggregateFilter = { ...filter };
  if (aggregateFilter.department) aggregateFilter.department = new mongoose.Types.ObjectId(String(aggregateFilter.department));
  if (aggregateFilter.class) aggregateFilter.class = new mongoose.Types.ObjectId(String(aggregateFilter.class));
  if (aggregateFilter._id?.$in) aggregateFilter._id = { $in: aggregateFilter._id.$in.map((id) => new mongoose.Types.ObjectId(String(id))) };
  if (aggregateFilter.$and) aggregateFilter.$and = aggregateFilter.$and.map((condition) => condition.class?.$in ? { ...condition, class: { $in: condition.class.$in.map((id) => new mongoose.Types.ObjectId(String(id))) } } : condition);
  const sortStage = safeSortBy === 'department'
    ? { sortDepartment: direction, sortName: 1, _id: 1 }
    : safeSortBy === 'semester'
      ? { sortSemester: direction, sortName: 1, _id: 1 }
      : safeSortBy === 'class'
        ? { sortClass: direction, sortName: 1, _id: 1 }
        : { [safeSortBy === 'createdAt' ? 'createdAt' : 'sortName']: direction, _id: direction };
  const usersPipeline = [
    { $match: aggregateFilter },
    { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'departmentDoc' } },
    { $unwind: { path: '$departmentDoc', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'classDoc' } },
    { $unwind: { path: '$classDoc', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'semesters', localField: 'classDoc.semester', foreignField: '_id', as: 'semesterDoc' } },
    { $unwind: { path: '$semesterDoc', preserveNullAndEmptyArrays: true } },
    { $addFields: {
      sortName: { $toLower: { $ifNull: ['$name', ''] } },
      sortDepartment: { $toLower: { $ifNull: ['$departmentDoc.name', ''] } },
      sortSemester: { $ifNull: ['$semesterDoc.number', 0] },
      sortClass: { $toLower: { $ifNull: ['$classDoc.name', ''] } },
    } },
    { $sort: sortStage },
    { $skip: (pageNum - 1) * limitNum },
    { $limit: limitNum },
    { $project: {
      _id: 1, name: 1, email: 1, phone: 1, role: 1, registerNumber: 1, employeeId: 1,
      dateOfBirth: 1, designation: 1, qualification: 1, admissionYear: 1, avatarUrl: 1,
      isActive: 1, lastLoginAt: 1, deviceBoundAt: 1, createdAt: 1, updatedAt: 1,
      department: { _id: '$departmentDoc._id', name: '$departmentDoc.name', code: '$departmentDoc.code' },
      class: { _id: '$classDoc._id', name: '$classDoc.name', code: '$classDoc.code', department: '$classDoc.department', semester: { _id: '$semesterDoc._id', number: '$semesterDoc.number', label: '$semesterDoc.label' } },
    } },
  ];
  const userQuery = safeSortBy === 'name' || safeSortBy === 'createdAt'
    ? User.find(filter)
      .select('-password -tokenVersion -failedLoginAttempts -loginFailureWindowStartedAt -loginLockedUntil -passwordResetRequired')
      .populate({ path: 'class', select: '_id name code department semester', populate: { path: 'semester', select: '_id number label' } })
      .populate('department', '_id name code')
      .sort(safeSortBy === 'createdAt' ? { createdAt: direction, _id: direction } : { name: direction, _id: direction })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()
    : User.aggregate(usersPipeline);
  const [users, total, activeCount, inactiveCount] = await Promise.all([
    userQuery,
    User.countDocuments(filter),
    User.countDocuments({ ...filter, isActive: true }),
    User.countDocuments({ ...filter, isActive: false }),
  ]);
  const tutorClasses = tutorsOnly && users.length
    ? await Class.find({ isActive: true, classTeacher: { $in: users.map((user) => user._id) } }).select('_id name code department semester classTeacher').populate('department', '_id name code').populate('semester', '_id number label').sort({ name: 1 }).lean()
    : [];
  const tutorClassesByUser = new Map();
  tutorClasses.forEach((classDoc) => {
    const key = String(classDoc.classTeacher);
    tutorClassesByUser.set(key, [...(tutorClassesByUser.get(key) || []), classDoc]);
  });
  const safeUsers = users.map((user) => ({
    ...user,
    role: canonicalRole(user.role),
    age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : null,
    ...(tutorsOnly ? { tutorClasses: tutorClassesByUser.get(String(user._id)) || [] } : {}),
  }));
  return sendResponse(res, 200, 'Users fetched', { users: safeUsers, summary: { total, active: activeCount, inactive: inactiveCount }, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});

export const getAssignedStudents = asyncHandler(async (req, res) => {
  const { search, classId, page = 1, limit = 25 } = req.query;
  let filter = await applyUserScope(req, { role: { $in: roleValues(ROLES.USER) }, isActive: true });
  if (classId) filter = { ...filter, class: classId };
  if (search) {
    const escapedSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
    const searchPattern = `^${escapedSearch}`;
    filter.$and = [
      ...(filter.$and || []),
      { $or: [
        { name: { $regex: searchPattern, $options: 'i' } },
        { email: { $regex: searchPattern, $options: 'i' } },
        { registerNumber: { $regex: searchPattern, $options: 'i' } },
      ] },
    ];
  }
  const pageNum = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const limitNum = Math.min(100, Math.max(1, Number.isInteger(Number(limit)) ? Number(limit) : 25));
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -tokenVersion -failedLoginAttempts -loginFailureWindowStartedAt -loginLockedUntil -passwordResetRequired')
      .populate('department', 'name code')
      .populate('class', 'name code')
      .sort({ name: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    User.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Assigned students fetched', {
    students: users.map((user) => ({ ...user, role: canonicalRole(user.role), age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : null })),
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
});

export const getUserSummary = asyncHandler(async (req, res) => {
  const filter = await applyUserScope(req, { _id: req.params.id });
  const user = await User.findOne(filter)
    .select('-password')
    .populate('department', 'name code programLevel semesterCount')
    .populate({ path: 'class', select: 'name code semester', populate: { path: 'semester', select: 'name number' } });
  if (!user) throw ApiError.notFound('User not found');
  if (canonicalRole(user.role) === ROLES.USER) await assertStudentAccess(req, user._id);
  else await assertManageableUser(req.user, user);

  const summary = { user: user.toSafeObject(), registrationStatus: user.isActive ? 'approved' : 'inactive' };
  if (canonicalRole(user.role) === ROLES.USER) {
    const [overall, subjectWise, recentAttendance] = await Promise.all([
      getOverallAttendance({ studentId: user._id }),
      getSubjectWiseAttendance({ studentId: user._id }),
      Attendance.find({ student: user._id }).select('date periodOrder periodName subject class status remarks markedAt editedAt').populate('subject', 'name code').sort({ date: -1, periodOrder: 1 }).limit(20).lean(),
    ]);
    summary.attendance = { overall, subjectWise, recent: recentAttendance };
    summary.deviceStatus = { bound: Boolean(user.deviceBoundAt), boundAt: user.deviceBoundAt || null };
  } else if (canonicalRole(user.role) === ROLES.ADMIN) {
    const { subjectIds: timetableSubjectIds } = await getFacultyTimetableAccessIds(user._id);
    const subjects = await Subject.find({
      isActive: true,
      $or: [{ faculty: user._id }, { _id: { $in: timetableSubjectIds } }],
    })
      .select('name code class semester department')
      .populate('class', 'name code')
      .populate('semester', 'name number')
      .populate('department', 'name code')
      .sort({ name: 1 })
      .limit(100)
      .lean();
    const tutorClasses = await Class.find({ classTeacher: user._id, isActive: true }).select('name code department semester classTeacher').populate('department', 'name code').populate('semester', 'number label').lean();
    summary.assignedSubjects = subjects;
    summary.assignedClasses = [...new Map([...subjects.filter((subject) => subject.class).map((subject) => [String(subject.class._id), subject.class]), ...tutorClasses.map((classDoc) => [String(classDoc._id), classDoc])]).values()];
    summary.timetable = await Timetable.find({ isActive: true, class: { $in: summary.assignedClasses.map((classDoc) => classDoc._id) } }).select('class days').populate('class', 'name code').populate('days.slots.subject', 'name code').populate('days.slots.faculty', 'name employeeId').sort({ class: 1 }).lean();
  }
  return sendResponse(res, 200, 'User profile summary fetched', summary);
});

export const getUserById = asyncHandler(async (req, res) => {
  const filter = await applyUserScope(req, { _id: req.params.id });
  const user = await User.findOne(filter).select('-password').populate('department', 'name code').populate('class', 'name code');
  if (!user) throw ApiError.notFound('User not found');
  if (canonicalRole(user.role) === ROLES.USER) await assertStudentAccess(req, user._id);
  else await assertManageableUser(req.user, user);
  return sendResponse(res, 200, 'User fetched', { user: user.toSafeObject() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { name, email, phone, dateOfBirth, designation, qualification, admissionYear, registerNumber, employeeId, department, classId, isActive, avatarUrl } = req.body;
  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '' && !isValidDateOnly(dateOfBirth)) throw ApiError.badRequest('Date of birth must be a valid non-future date in YYYY-MM-DD format.');
  if (!isAllowedProfileImageUrl(avatarUrl)) throw ApiError.badRequest('Profile photo must be uploaded through configured image storage.');
  const filter = await applyUserScope(req, { _id: req.params.id });
  const user = await User.findOne(filter);
  if (!user) throw ApiError.notFound('User not found');
  const tutorStudentEdit = await isAuthorizedTutorForStudent(req.user, user);
  if (!tutorStudentEdit) await assertManageableUser(req.user, user);
  if (tutorStudentEdit && [name, designation, qualification, admissionYear, registerNumber, employeeId, department, classId, isActive].some((value) => value !== undefined)) {
    throw ApiError.forbidden('A Faculty tutor may edit only contact and photo details for students in the assigned class.');
  }

  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const duplicate = await User.exists({ email: normalizedEmail, _id: { $ne: user._id } });
    if (duplicate) throw ApiError.emailAlreadyExists();
    user.email = normalizedEmail;
    user.isEmailVerified = true;
  }
  if ((registerNumber !== undefined || employeeId !== undefined) && !isGlobalAdministrator(req.user)) {
    throw ApiError.forbidden('Only an authorized HOD can change register or employee IDs.');
  }
  const normalizedRegisterNumber = registerNumber === undefined ? undefined : normalizeAcademicIdentifier(registerNumber);
  const normalizedEmployeeId = employeeId === undefined ? undefined : normalizeAcademicIdentifier(employeeId);
  if (normalizedRegisterNumber && !isValidAcademicIdentifier(normalizedRegisterNumber)) throw ApiError.badRequest(`Register number is invalid. ${ACADEMIC_IDENTIFIER_MESSAGE}`);
  if (normalizedEmployeeId && !isValidAcademicIdentifier(normalizedEmployeeId)) throw ApiError.badRequest(`Employee ID is invalid. ${ACADEMIC_IDENTIFIER_MESSAGE}`);
  if (registerNumber !== undefined && canonicalRole(user.role) === ROLES.USER) user.registerNumber = normalizedRegisterNumber || null;
  if (employeeId !== undefined && canonicalRole(user.role) !== ROLES.USER) user.employeeId = normalizedEmployeeId || null;

  let resolvedDepartment = user.department;
  let resolvedClass = user.class;
  if (department !== undefined || classId !== undefined) {
    const relationship = await resolveDepartmentAndClass({
      actor: req.user,
      role: user.role,
      departmentId: department === undefined ? user.department : department,
      classId: classId === undefined ? user.class : classId,
    });
    resolvedDepartment = relationship.department;
    resolvedClass = relationship.classDoc?._id || null;
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone || null;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
  if (designation !== undefined) user.designation = designation || null;
  if (qualification !== undefined) user.qualification = qualification || null;
  if (admissionYear !== undefined) user.admissionYear = admissionYear || null;

  if (department !== undefined || classId !== undefined) {
    user.department = resolvedDepartment;
    if (canonicalRole(user.role) === ROLES.USER) user.class = resolvedClass;
  }
  if (isActive !== undefined) {
    const nextActiveState = Boolean(isActive);
    if (user.isActive && !nextActiveState) user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    user.isActive = nextActiveState;
  }
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  await user.save();
  if (isActive === false) await revokeUserSessions(user._id);
  await logActivity({ actorId: req.user._id, action: isActive === false ? ACTIVITY_ACTION.DEACTIVATE : ACTIVITY_ACTION.UPDATE, targetType: 'User', targetId: user._id, description: isActive === false ? `Deactivated user ${user.name}` : `Updated user ${user.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'User updated successfully', { user: user.toSafeObject() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findOne(await applyUserScope(req, { _id: req.params.id }));
  await assertManageableUser(req.user, user);
  user.isActive = false;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeUserSessions(user._id);
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.DEACTIVATE, targetType: 'User', targetId: user._id, description: `Deactivated user ${user.name}; academic records retained`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'User deactivated successfully');
});

export const resetStudentDevice = asyncHandler(async (req, res) => {
  const user = await User.findOne(await applyUserScope(req, { _id: req.params.id, role: { $in: roleValues(ROLES.USER) } })).select('+deviceBindingHash');
  await assertManageableUser(req.user, user);
  if (canonicalRole(user.role) !== ROLES.USER) throw ApiError.badRequest('Only student device bindings can be reset.');

  user.deviceBindingHash = null;
  user.deviceBoundAt = null;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeUserSessions(user._id);
  await notifyUser({ userId: user._id, type: NOTIFICATION_TYPE.GENERAL, title: 'Device access reset', message: 'Your student device access was reset by an authorized administrator. Sign in again from your approved device.' });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.DEVICE_BINDING_RESET, targetType: 'User', targetId: user._id, description: `Reset student device binding for ${user.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Student device binding reset successfully.', { user: user.toSafeObject() });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne(await applyUserScope(req, { _id: req.params.id })).select('+passwordResetRequired');
  await assertManageableUser(req.user, user);

  // HOD resets are permanent account resets. The generated credential is still
  // returned only once to the authorized HOD; it is never persisted in plaintext.
  // Students may voluntarily change it later, but are not forced through the
  // first-login flow after an administrative reset.
  const permanentPassword = req.body.newPassword || generatePermanentCredential();
  user.password = permanentPassword;
  user.passwordResetRequired = false;
  Object.assign(user, getLoginFailureReset());
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeUserSessions(user._id);
  await notifyUser({ userId: user._id, type: NOTIFICATION_TYPE.PASSWORD_CHANGED, title: 'Password reset by administrator', message: 'Your password was reset by an authorized administrator. You may change it from your profile at any time.' });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.PASSWORD_RESET, targetType: 'User', targetId: user._id, description: `Permanently reset password for ${user.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Permanent password reset successfully. It will only be shown once.', { resetCredential: permanentPassword, passwordIsPermanent: true });
});
