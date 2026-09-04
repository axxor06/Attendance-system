import express from 'express';
import * as controller from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();

router.use(protect);

router.get('/', controller.getMyNotifications);
router.patch('/:id/read', rejectUnknownBodyFields([]), controller.markNotificationRead);
router.patch('/read-all', rejectUnknownBodyFields([]), controller.markAllNotificationsRead);
router.delete('/:id', rejectUnknownBodyFields([]), controller.deleteNotification);

export default router;
