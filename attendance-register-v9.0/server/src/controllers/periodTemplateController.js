import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { PeriodTemplate } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, DAYS_OF_WEEK } from '../config/constants.js';

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
  const templates = await PeriodTemplate.find({ isActive: true }).sort({ dayOfWeek: 1 });

  const ordered = DAYS_OF_WEEK
    .map((day) => templates.find((template) => template.dayOfWeek === day))
    .filter(Boolean);

  return sendResponse(res, 200, 'Active period templates fetched', { templates: ordered });
});

export const getPeriodTemplateByDay = asyncHandler(async (req, res) => {
  const { day } = req.params;
  if (!DAYS_OF_WEEK.includes(day)) {
    throw ApiError.badRequest('Invalid day of week.');
  }

  const template = await PeriodTemplate.findOne({ dayOfWeek: day, isActive: true });
  if (!template) {
    throw ApiError.notFound(`No active period template configured for ${day}.`);
  }

  return sendResponse(res, 200, 'Period template fetched', { template });
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
