import ApiError from './ApiError.js';
import { Class, Subject, Timetable, User } from '../models/index.js';
import { canonicalRole, roleValues, ROLES } from '../config/constants.js';

function idValue(value) {
  return value?._id?.toString?.() || value?.toString?.();
}

function roleOf(user) {
  return canonicalRole(user?.role);
}

export function isSameId(left, right) {
  const leftId = idValue(left);
  const rightId = idValue(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

/** Canonical p27 HOD capability. The stored role is super_admin. */
export function isSuperAdmin(user) {
  return roleOf(user) === ROLES.SUPER_ADMIN;
}

/** Canonical p27 Faculty capability. The stored role is admin. */
export function isAdmin(user) {
  return roleOf(user) === ROLES.ADMIN;
}

export function isStudent(user) {
  return roleOf(user) === ROLES.USER;
}

/** Public-facing code still calls this HOD for readability. */
export function isHod(user) {
  return isSuperAdmin(user);
}

/** Only HOD has institution-wide administrator capability in p27. */
export function isGlobalAdministrator(user) {
  return isSuperAdmin(user);
}

export function isHodOrAdmin(user) {
  return isSuperAdmin(user) || isAdmin(user);
}

export function allowedUserCreationRoles(actor) {
  if (isSuperAdmin(actor)) return [ROLES.ADMIN, ROLES.USER];
  return [];
}

export function applyDepartmentScope(req, filter = {}) {
  // HOD/super_admin has full authorized institution scope in p27.
  return filter;
}

export async function getDepartmentScope(req) {
  // Kept for callers that build reports. A null scope means institution-wide.
  return null;
}

/**
 * Applies the narrow Faculty/admin student view. It is intentionally based on
 * current Subject assignments, never on a client-provided department/class.
 */
export async function applyUserScope(req, filter = {}) {
  if (isSuperAdmin(req.user)) return filter;
  if (isAdmin(req.user)) {
    const [subjects, tutorClasses] = await Promise.all([
      Subject.find({ faculty: req.user._id, isActive: true }).select('students class').lean(),
      Class.find({ classTeacher: req.user._id, isActive: true }).select('_id').lean(),
    ]);
    const studentIds = subjects.flatMap((subject) => (subject.students || []).map(idValue)).filter(Boolean);
    const classIds = [
      ...subjects.map((subject) => idValue(subject.class)).filter(Boolean),
      ...tutorClasses.map((classDoc) => idValue(classDoc._id)).filter(Boolean),
    ];
    const assignedConditions = [];
    if (studentIds.length) assignedConditions.push({ _id: { $in: studentIds } });
    if (classIds.length) assignedConditions.push({ class: { $in: [...new Set(classIds)] } });
    if (!assignedConditions.length) return { ...filter, _id: null };
    return {
      ...filter,
      role: { $in: roleValues(ROLES.USER) },
      $and: [...(filter.$and || []), { $or: assignedConditions }],
    };
  }
  if (isStudent(req.user)) return { ...filter, _id: req.user._id };
  return { ...filter, _id: null };
}

export async function assertManageableUser(actor, user) {
  if (!user) throw ApiError.notFound('User not found');
  if (!isSuperAdmin(actor)) throw ApiError.forbidden('Only an authorized HOD can manage institution accounts.');
  if (isSameId(actor._id, user._id)) {
    throw ApiError.forbidden('You cannot manage your own account through this endpoint.');
  }
  if (canonicalRole(user.role) === ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('HOD accounts cannot be managed through this endpoint.');
  }
  return user;
}

export async function assertStudentAccess(req, studentId) {
  const actorRole = roleOf(req.user);
  const filter = { _id: studentId, role: { $in: roleValues(ROLES.USER) } };
  const student = await User.findOne(filter).select('name role class department isActive registerNumber');
  if (!student) {
    if (actorRole === ROLES.USER && !isSameId(req.user._id, studentId)) {
      throw ApiError.forbidden('You can only access your own records.');
    }
    throw ApiError.notFound('Student not found');
  }
  student.role = canonicalRole(student.role);
  if (actorRole === ROLES.USER) {
    if (!isSameId(req.user._id, student._id)) throw ApiError.forbidden('You can only access your own records.');
    return student;
  }
  if (isSuperAdmin(req.user)) return student;
  if (isAdmin(req.user)) {
    const [subjectAccess, tutorAccess] = await Promise.all([
      Subject.exists({
        faculty: req.user._id,
        isActive: true,
        $or: [{ students: student._id }, { class: student.class }],
      }),
      Class.exists({ _id: student.class, classTeacher: req.user._id, isActive: true }),
    ]);
    if (subjectAccess || tutorAccess) return student;
  }
  throw ApiError.forbidden('You are not authorized to access this student record.');
}

export async function assertSubjectAccess(req, subjectId, { requireFaculty = false } = {}) {
  const subject = await Subject.findOne({ _id: subjectId }).populate('class', 'name code department');
  if (!subject) throw ApiError.notFound('Subject not found');
  if (isSuperAdmin(req.user)) return subject;
  if (isAdmin(req.user)) {
    const directAssignment = subject.faculty.some((facultyId) => isSameId(facultyId, req.user._id));
    const timetableAssignment = await Timetable.exists({
      class: subject.class?._id || subject.class,
      isActive: true,
      days: { $elemMatch: { slots: { $elemMatch: { subject: subject._id, faculty: req.user._id, kind: 'class' } } } },
    });
    if (directAssignment || timetableAssignment) return subject;
  }
  if (!requireFaculty && isStudent(req.user)) {
    const isInClass = isSameId(req.user.class, subject.class?._id || subject.class);
    const isEnrolled = subject.students?.length === 0 || subject.students.some((studentId) => isSameId(studentId, req.user._id));
    if (isInClass && isEnrolled) return subject;
  }
  throw ApiError.forbidden('You are not authorized to access this subject.');
}

export async function assertClassAccess(req, classId) {
  const classDoc = await Class.findOne({ _id: classId }).select('_id department name code classTeacher semester');
  if (!classDoc) throw ApiError.notFound('Class not found');
  if (isSuperAdmin(req.user)) return classDoc;
  if (isStudent(req.user)) {
    if (!isSameId(req.user.class, classDoc._id)) throw ApiError.forbidden('You are not authorized to access this class.');
    return classDoc;
  }
  if (isAdmin(req.user)) {
    const [subjectAccess, timetableAccess, tutorAccess] = await Promise.all([
      Subject.exists({ class: classDoc._id, faculty: req.user._id, isActive: true }),
      Timetable.exists({
        class: classDoc._id,
        isActive: true,
        days: { $elemMatch: { slots: { $elemMatch: { faculty: req.user._id, kind: 'class' } } } },
      }),
      Class.exists({ _id: classDoc._id, classTeacher: req.user._id, isActive: true }),
    ]);
    if (subjectAccess || timetableAccess || tutorAccess) return classDoc;
  }
  throw ApiError.forbidden('You are not authorized to access this class.');
}
