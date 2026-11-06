import express from 'express';
import * as controller from '../controllers/attendanceController.js';
import * as correctionController from '../controllers/attendanceCorrectionController.js';
import * as v from '../validators/attendanceValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { attendanceSubmitLimiter } from '../middleware/rateLimiters.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.use(protect);

// Faculty + HOD: marking and session management
router.post(
  '/mark',
  attendanceSubmitLimiter,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  rejectUnknownBodyFields(['subjectId', 'date', 'periodOrder', 'entries']),
  v.markAttendanceValidator,
  validate,
  controller.markAttendance
);
router.get(
  '/session-roster',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  v.getSessionRosterValidator,
  validate,
  controller.getSessionRoster
);

// Historical correction workflow: pick a date -> session -> roster -> save corrections.
// Declared before '/:id' so 'corrections' is never treated as an id.
router.get('/corrections/sessions', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), v.correctableSessionsValidator, validate, correctionController.listCorrectableSessions);
router.get('/corrections/roster', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), v.correctionRosterValidator, validate, correctionController.getCorrectionRoster);
router.get('/corrections', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), v.listCorrectionsValidator, validate, correctionController.listCorrections);
router.post(
  '/corrections',
  attendanceSubmitLimiter,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  rejectUnknownBodyFields(['subjectId', 'date', 'periodOrder', 'changes', 'reason']),
  v.submitCorrectionsValidator,
  validate,
  correctionController.submitCorrections
);
router.patch(
  '/:id',
  attendanceSubmitLimiter,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  rejectUnknownBodyFields(['status', 'remarks', 'reason']),
  v.editAttendanceValidator,
  v.editAttendanceReasonValidator,
  validate,
  controller.editAttendanceEntry
);
router.get(
  '/pending',
  authorize(ROLES.ADMIN),
  controller.getPendingAttendance
);

// All roles (filtered internally by role in the controller)
router.get('/history', controller.getAttendanceHistory);

export default router;
