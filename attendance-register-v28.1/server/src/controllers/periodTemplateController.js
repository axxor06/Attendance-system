import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { PeriodTemplate, Subject, Timetable } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, canonicalRole, DAYS_OF_WEEK, PERIOD_KIND, ROLES } from '../config/constants.js';
import { assertClassAccess, isSameId } from '../utils/authorization.js';
import { getClassDaySchedule } from '../services/timetableService.js';

function isTransactionUnsupported(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 20
    || error?.codeName === 'IllegalOperation'
    || message.includes('transaction numbers are only allowed')
    || message.includes('replica set')
    || message.includes('mongos');
}

async function replaceWithoutTransaction({ dayOfWeek, periods, actorId }) {
  const previous = await PeriodTemplate.findOne({ dayOfWeek, isActive: true }).sort({ _id: 1 });

  if (previous) {
    await PeriodTemplate.updateOne(
      { _id: previous._id, isActive: true },
      { $set: { isActive: false } },
    );
  }

  try {
    const template = await PeriodTemplate.create({
      dayOfWeek,
      periods,
      isActive: true,
      createdBy: actorId,
    });
    return { template, previous };
  } catch (error) {
    // If a competing request already installed a new active template, do not
    // reactivate the old one and violate the unique active-day invariant.
    const competingActive = await PeriodTemplate.findOne({ dayOfWeek, isActive: true });
    if (!competingActive && previous) {
      await PeriodTemplate.updateOne(
        { _id: previous._id },
        { $set: { isActive: true } },
      );
    }
    throw error;
  }
}

/**
 * Creates (or replaces) the active period template for a day of week.
 * Historical inactive templates remain available for attendance history.
 */
export const upsertPeriodTemplate = asyncHandler(async (req, res) => {
  const { dayOfWeek, periods } = req.body;

  if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
    throw ApiError.badRequest('Invalid day of week.');
  }

  if (!Array.isArray(periods) || periods.length === 0) {
    throw ApiError.badRequest('At least one period is required.');
  }

  let template;
  let previous;
  const session = await mongoose.startSession();

  try {
    try {
      await session.withTransaction(async () => {
        previous = await PeriodTemplate.findOne({ dayOfWeek, isActive: true })
          .sort({ _id: 1 })
          .session(session);

        if (previous) {
          await PeriodTemplate.updateOne(
            { _id: previous._id, isActive: true },
            { $set: { isActive: false } },
            { session },
          );
        }

        [template] = await PeriodTemplate.create([{
          dayOfWeek,
          periods,
          isActive: true,
          createdBy: req.user._id,
        }], { session });
      });
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      ({ template, previous } = await replaceWithoutTransaction({
        dayOfWeek,
        periods,
        actorId: req.user._id,
      }));
    }
  } finally {
    await session.endSession();
  }

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.UPDATE,
    targetType: 'PeriodTemplate',
    targetId: template._id,
    description: previous
      ? `Replaced periods for ${dayOfWeek}`
      : `Configured periods for ${dayOfWeek}`,
    requestId: req.id,
  });

  return sendResponse(res, 201, `Period template for ${dayOfWeek} saved successfully`, {
    template,
  });
});

/** Returns the currently active template for every configured day. */
export const getActivePeriodTemplates = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (classId) {
    await assertClassAccess(req, classId);
    const timetable = await Timetable.findOne({ class: classId, isActive: true }).lean();
    if (timetable) {
      const templates = DAYS_OF_WEEK
        .map((day) => {
          const dayEntry = timetable.days.find((item) => item.dayOfWeek === day);
          return dayEntry ? { _id: `${timetable._id}-${day}`, dayOfWeek: day, periods: dayEntry.slots } : null;
        })
        .filter(Boolean);
      return sendResponse(res, 200, 'Class timetable fetched', { templates, source: 'class-timetable' });
    }
  }

  const templates = await PeriodTemplate.find({ isActive: true }).sort({ dayOfWeek: 1 });
  const ordered = DAYS_OF_WEEK
    .map((day) => templates.find((template) => template.dayOfWeek === day))
    .filter(Boolean);
  return sendResponse(res, 200, 'Active period templates fetched', { templates: ordered, source: 'legacy-template' });
});

export const getPeriodTemplateByDay = asyncHandler(async (req, res) => {
  const { day } = req.params;
  const { classId, subjectId } = req.query;
  if (!DAYS_OF_WEEK.includes(day)) throw ApiError.badRequest('Invalid day of week.');
  if (subjectId && !/^[a-f\d]{24}$/i.test(String(subjectId))) throw ApiError.badRequest('subjectId must be a valid identifier.');
  if (subjectId && !classId) throw ApiError.badRequest('classId is required when subjectId is provided.');

  if (classId) {
    const classDoc = await assertClassAccess(req, classId);
    if (subjectId) {
      const subject = await Subject.findOne({ _id: subjectId, class: classDoc._id, isActive: true }).select('_id').lean();
      if (!subject) throw ApiError.badRequest('Selected subject does not belong to this active class.');
    }
    const { slots, source } = await getClassDaySchedule(classDoc._id, day);
    const isFaculty = canonicalRole(req.user.role) === ROLES.ADMIN;
    const periods = source === 'class-timetable'
      ? slots.filter((slot) => slot.kind === PERIOD_KIND.CLASS
        && (!isFaculty || isSameId(slot.faculty, req.user._id))
        && (!subjectId || isSameId(slot.subject, subjectId)))
      : slots;
    const scope = isFaculty && source === 'class-timetable' ? 'faculty-assigned-slots' : 'class-timetable';
    return sendResponse(res, 200, periods.length ? 'Class period template fetched' : 'No matching periods configured for this class day', {
      template: { dayOfWeek: day, periods },
      configured: periods.length > 0,
      source,
      scope,
      classId: String(classDoc._id),
      subjectId: subjectId || null,
    });
  }

  const template = await PeriodTemplate.findOne({ dayOfWeek: day, isActive: true });
  return sendResponse(res, 200, template ? 'Period template fetched' : 'No periods configured for this day', {
    template: template || { dayOfWeek: day, periods: [] },
    configured: Boolean(template),
    source: 'legacy-template',
  });
});

export const deactivatePeriodTemplate = asyncHandler(async (req, res) => {
  const template = await PeriodTemplate.findById(req.params.id);
  if (!template) throw ApiError.notFound('Period template not found');

  template.isActive = false;
  await template.save();

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.DEACTIVATE,
    targetType: 'PeriodTemplate',
    targetId: template._id,
    description: `Deactivated periods for ${template.dayOfWeek}`,
    requestId: req.id,
  });

  return sendResponse(res, 200, 'Period template deactivated', { template });
});
