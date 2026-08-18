import ApiError from './ApiError.js';
import { Class, Subject, User } from '../models/index.js';
import { ROLES } from '../config/constants.js';

export function isSameId(left, right) {
  return left?.toString() === right?.toString();
}

export function isSuperAdmin(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function isGlobalAdministrator(user) {
  return isSuperAdmin(user) || isAdmin(user);
}

export function isHod(user) {
  return user?.role === ROLES.HOD;
}

export function isHodOrAdmin(user) {
  return isHod(user) || isGlobalAdministrator(user);
}

export function allowedUserCreationRoles(actor) {
  if (isSuperAdmin(actor)) return [ROLES.ADMIN, ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT];
  if (isAdmin(actor)) return [ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT];
  if (isHod(actor)) return [ROLES.FACULTY, ROLES.STUDENT];
  return [];
}

export function applyDepartmentScope(req, filter = {}) {
  if (!isHod(req.user)) return filter;
  if (!req.user.department) return { ...filter, _id: null };
  return { ...filter, department: req.user.department };
}

export async function getDepartmentScope(req) {
  if (!isHod(req.user)) return null;
  if (!req.user.department) return { departmentId: null, classIds: [] };
  const classIds = await Class.distinct('_id', { department: req.user.department });
  return { departmentId: req.user.department, classIds };
}

export async function applyUserScope(req, filter = {}) {
  if (!isHod(req.user)) return filter;
  const scope = await getDepartmentScope(req);
  if (!scope.departmentId) return { ...filter, _id: null };
  return {
    ...filter,
    $and: [
      ...(filter.$and || []),
      {
        $or: [
          { department: scope.departmentId },
          { class: { $in: scope.classIds } },
        ],
      },
    ],
  };
}

export async function assertManageableUser(actor, user) {
  if (!user) throw ApiError.notFound('User not found');
  if (isSameId(actor._id, user._id)) {
    throw ApiError.forbidden('You cannot manage your own account through this endpoint.');
  }
  if (user.role === ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('SUPER_ADMIN accounts cannot be managed through this endpoint.');
  }
  if (user.role === ROLES.ADMIN && !isSuperAdmin(actor)) {
    throw ApiError.forbidden('Only SUPER_ADMIN can manage ADMIN accounts.');
  }
  if (user.role === ROLES.HOD && !isGlobalAdministrator(actor)) {
    throw ApiError.forbidden('Only administrators can manage HOD accounts.');
  }
  if (isHod(actor) && !isSameId(actor.department, user.department)) {
    throw ApiError.forbidden('You are not authorized to manage another department.');
  }
  return user;
}

export async function assertStudentAccess(req, studentId) {
  let filter = { _id: studentId, role: ROLES.STUDENT };
  if (isHod(req.user)) {
    const scope = await getDepartmentScope(req);
    if (!scope.departmentId) throw ApiError.notFound('Student not found');
    filter = {
      ...filter,
      $or: [
        { department: scope.departmentId },
        { class: { $in: scope.classIds } },
      ],
    };
  }
  const student = await User.findOne(filter).select('name role class department isActive registerNumber');
  if (!student) {
    if (req.user.role === ROLES.STUDENT && !isSameId(req.user._id, studentId)) {
      throw ApiError.forbidden('You can only access your own records.');
    }
    throw ApiError.notFound('Student not found');
  }
  if (req.user.role === ROLES.STUDENT) {
    if (!isSameId(req.user._id, student._id)) throw ApiError.forbidden('You can only access your own records.');
    return student;
  }
  if (isGlobalAdministrator(req.user) || isHod(req.user)) return student;
  if (req.user.role === ROLES.FACULTY) {
    const hasAccess = await Subject.exists({
      faculty: req.user._id,
      isActive: true,
      $or: [{ students: student._id }, { class: student.class }],
    });
    if (hasAccess) return student;
  }
  throw ApiError.forbidden('You are not authorized to access this student record.');
}

export async function assertSubjectAccess(req, subjectId, { requireFaculty = false } = {}) {
  const subjectFilter = { _id: subjectId };
  if (isHod(req.user)) {
    subjectFilter.department = req.user.department || null;
  }
  const subject = await Subject.findOne(subjectFilter).populate('class', 'name code department');
  if (!subject) throw ApiError.notFound('Subject not found');
  if (isGlobalAdministrator(req.user) || isHod(req.user)) return subject;
  if (req.user.role === ROLES.FACULTY && subject.faculty.some((facultyId) => isSameId(facultyId, req.user._id))) return subject;
  if (!requireFaculty && req.user.role === ROLES.STUDENT) {
    const isInClass = isSameId(req.user.class, subject.class?._id || subject.class);
    const isEnrolled = subject.students?.length === 0 || subject.students.some((studentId) => isSameId(studentId, req.user._id));
    if (isInClass && isEnrolled) return subject;
  }
  throw ApiError.forbidden('You are not authorized to access this subject.');
}

export async function assertClassAccess(req, classId) {
  const classFilter = { _id: classId };
  if (isHod(req.user)) classFilter.department = req.user.department || null;
  const classDoc = await Class.findOne(classFilter).select('_id department name code classTeacher semester');
  if (!classDoc) throw ApiError.notFound('Class not found');
  if (isGlobalAdministrator(req.user) || isHod(req.user)) return classDoc;
  if (req.user.role === ROLES.STUDENT) {
    if (!isSameId(req.user.class, classDoc._id)) throw ApiError.forbidden('You are not authorized to access this class.');
    return classDoc;
  }
  if (req.user.role === ROLES.FACULTY) {
    const hasAccess = await Subject.exists({ class: classDoc._id, faculty: req.user._id, isActive: true });
    if (hasAccess) return classDoc;
  }
  throw ApiError.forbidden('You are not authorized to access this class.');
}
