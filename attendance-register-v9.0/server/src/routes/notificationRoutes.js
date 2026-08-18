import express from 'express';
import * as controller from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', controller.getMyNotifications);
router.patch('/:id/read', controller.markNotificationRead);
router.patch('/read-all', controller.markAllNotificationsRead);
router.delete('/:id', controller.deleteNotification);

export default router;
