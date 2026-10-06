import { Class, Subject, Timetable, User } from '../models/index.js';
import { canonicalRole, roleValues, ROLES } from '../config/constants.js';
import ApiError from './ApiError.js';

function idValue(value) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

function uniqueIds(values) {
  return [...new Set(values.map(idValue).filter(Boolean))];
}

export function escapeRegex(value) {
  return String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function participantKeyFor(left, right) {
  return uniqueIds([left, right]).sort().join(':');
}

export async function getAllowedMessagingRecipientIds(actor) {
  const actorRole = canonicalRole(actor?.role);
  const actorId = idValue(actor?._id);
  if (!actorId) return [];

  if (actorRole === ROLES.SUPER_ADMIN) {
    const users = await User.find({
      _id: { $ne: actorId },
      role: { $in: [...roleValues(ROLES.ADMIN), ...roleValues(ROLES.USER)] },
      isActive: true,
    }).select('_id').lean();
    return uniqueIds(users);
  }

  if (actorRole === ROLES.ADMIN) {
    const [subjects, tutorClasses, timetableRows, hods, facultyPeers] = await Promise.all([
      Subject.find({ faculty: actorId, isActive: true }).select('_id class students').lean(),
      Class.find({ classTeacher: actorId, isActive: true }).select('_id classTeacher').lean(),
      Timetable.find({ isActive: true, 'days.slots.faculty': actorId }).select('class days.slots').lean(),
      User.find({ role: { $in: roleValues(ROLES.SUPER_ADMIN) }, isActive: true }).select('_id').lean(),
      User.find({ _id: { $ne: actorId }, role: { $in: roleValues(ROLES.ADMIN) }, isActive: true }).select('_id').lean(),
    ]);
    const timetableAssignments = timetableRows.flatMap((row) => (row.days || []).flatMap((day) => (day.slots || [])
      .filter((slot) => idValue(slot.faculty) === actorId && slot.subject)
      .map((slot) => ({ classId: row.class, subjectId: slot.subject }))));
    const timetableSubjectIds = uniqueIds(timetableAssignments.map((assignment) => assignment.subjectId));
    const timetableSubjects = timetableSubjectIds.length
      ? await Subject.find({ _id: { $in: timetableSubjectIds }, isActive: true }).select('_id class students').lean()
      : [];
    const teachingSubjects = [...subjects, ...timetableSubjects];
    const subjectById = new Map(teachingSubjects.map((subject) => [idValue(subject._id), subject]));
    const wholeClassSubjectClassIds = teachingSubjects.filter((subject) => !(subject.students || []).length).map((subject) => subject.class);
    const classIds = [
      ...wholeClassSubjectClassIds,
      ...tutorClasses.map((classDoc) => classDoc._id),
      ...timetableAssignments.flatMap((assignment) => {
        const subject = subjectById.get(idValue(assignment.subjectId));
        return subject && !(subject.students || []).length ? [assignment.classId] : [];
      }),
    ];
    const studentIds = [
      ...teachingSubjects.flatMap((subject) => subject.students || []),
      ...timetableAssignments.flatMap((assignment) => subjectById.get(idValue(assignment.subjectId))?.students || []),
    ];
    const uniqueClassIds = uniqueIds(classIds);
    const uniqueStudentIds = uniqueIds(studentIds);
    const students = uniqueClassIds.length || uniqueStudentIds.length
      ? await User.find({
        _id: { $ne: actorId },
        role: { $in: roleValues(ROLES.USER) },
        isActive: true,
        $or: [
          ...(uniqueClassIds.length ? [{ class: { $in: uniqueClassIds } }] : []),
          ...(uniqueStudentIds.length ? [{ _id: { $in: uniqueStudentIds } }] : []),
        ],
      }).select('_id').lean()
      : [];
    const tutorIds = uniqueIds(tutorClasses.map((classDoc) => classDoc.classTeacher));
    const tutors = tutorIds.length
      ? await User.find({ _id: { $in: tutorIds }, role: { $in: roleValues(ROLES.ADMIN) }, isActive: true }).select('_id').lean()
      : [];
    return uniqueIds([...students, ...hods, ...tutors, ...facultyPeers]).filter((id) => id !== actorId);
  }

  if (actorRole === ROLES.USER) {
    const classId = idValue(actor.class);
    if (!classId) {
      const hods = await User.find({ role: { $in: roleValues(ROLES.SUPER_ADMIN) }, isActive: true })
        .select('_id')
        .sort({ createdAt: 1, _id: 1 })
        .limit(1)
        .lean();
      return uniqueIds(hods);
    }
    const [classmates, subjects, timetableRows, classDoc, hods] = await Promise.all([
      User.find({ class: classId, role: { $in: roleValues(ROLES.USER) }, isActive: true, _id: { $ne: actorId } }).select('_id').lean(),
      Subject.find({ class: classId, isActive: true }).select('faculty students').lean(),
      Timetable.find({ class: classId, isActive: true }).select('days.slots.faculty days.slots.subject').lean(),
      Class.findOne({ _id: classId, isActive: true }).select('classTeacher').lean(),
      User.find({ role: { $in: roleValues(ROLES.SUPER_ADMIN) }, isActive: true })
        .select('_id')
        .sort({ createdAt: 1, _id: 1 })
        .limit(1)
        .lean(),
    ]);
    const relevantSubjects = subjects.filter((subject) => {
      const roster = subject.students || [];
      return roster.length === 0 || roster.some((studentId) => idValue(studentId) === actorId);
    });
    const relevantSubjectIds = new Set(relevantSubjects.map((subject) => idValue(subject._id)));
    const facultyIds = [
      ...relevantSubjects.flatMap((subject) => subject.faculty || []),
      ...timetableRows.flatMap((row) => (row.days || []).flatMap((day) => (day.slots || [])
        .filter((slot) => !slot.subject || relevantSubjectIds.has(idValue(slot.subject)))
        .map((slot) => slot.faculty).filter(Boolean))),
      classDoc?.classTeacher,
    ];
    const faculty = facultyIds.length
      ? await User.find({ _id: { $in: uniqueIds(facultyIds) }, role: { $in: roleValues(ROLES.ADMIN) }, isActive: true }).select('_id').lean()
      : [];
    return uniqueIds([...classmates, ...faculty, ...hods]).filter((id) => id !== actorId);
  }

  return [];
}

export async function assertMessagingRecipient(actor, recipientId) {
  const recipient = await User.findOne({ _id: recipientId, isActive: true })
    .select('_id name email role avatarUrl employeeId registerNumber class department')
    .lean();
  if (!recipient) throw ApiError.notFound('The selected account is not available.');
  if (idValue(actor?._id) === idValue(recipient._id)) throw ApiError.badRequest('You cannot send a message to yourself.');
  const allowedIds = await getAllowedMessagingRecipientIds(actor);
  if (!allowedIds.includes(idValue(recipient._id))) {
    throw ApiError.forbidden('You are not authorized to message this account.');
  }
  return recipient;
}

export function messageUserProjection(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: canonicalRole(user.role),
    avatarUrl: user.avatarUrl || null,
    employeeId: user.employeeId || null,
    registerNumber: user.registerNumber || null,
    department: user.department ? {
      _id: user.department._id || user.department,
      name: user.department.name || null,
      code: user.department.code || null,
    } : null,
    class: user.class ? {
      _id: user.class._id || user.class,
      name: user.class.name || null,
      code: user.class.code || null,
      semester: user.class.semester ? {
        _id: user.class.semester._id || user.class.semester,
        number: user.class.semester.number || null,
        label: user.class.semester.label || null,
      } : null,
    } : null,
  };
}
