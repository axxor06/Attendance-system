import express from 'express';
import * as controller from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.use(protect);

router.get('/hod', authorize(ROLES.SUPER_ADMIN), controller.getHodDashboard);
router.get('/faculty', authorize(ROLES.ADMIN), controller.getFacultyDashboard);
router.get('/student', authorize(ROLES.USER), controller.getStudentDashboard);

export default router;
