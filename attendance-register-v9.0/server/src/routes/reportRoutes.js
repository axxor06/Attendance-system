import express from 'express';
import * as controller from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';

const router = express.Router();
router.param('subjectId', validateObjectIdParam);
router.param('studentId', validateObjectIdParam);
router.param('classId', validateObjectIdParam);

router.use(protect);

router.get(
  '/subject/:subjectId',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOD, ROLES.FACULTY),
  controller.exportSubjectReport
);
router.get(
  '/student/:studentId?',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT),
  controller.exportStudentReport
);
router.get(
  '/class/:classId/monthly',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOD, ROLES.FACULTY),
  controller.exportClassMonthlyReport
);

export default router;
