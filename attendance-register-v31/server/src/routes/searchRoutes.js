import express from 'express';
import * as controller from '../controllers/searchController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.use(protect);
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), controller.globalSearch);

export default router;
