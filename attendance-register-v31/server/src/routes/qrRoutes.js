import express from 'express';
import * as controller from '../controllers/qrController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { qrGenerateLimiter, qrScanLimiter } from '../middleware/rateLimiters.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();

router.use(protect);

// Faculty/HOD generate QR
router.post('/generate', qrGenerateLimiter, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), rejectUnknownBodyFields(['subjectId', 'date', 'periodOrder']), [
  body('subjectId').isMongoId().withMessage('Valid subject required'),
  body('date').isISO8601().withMessage('Valid date required'),
  body('periodOrder').isInt({ min: 1 }).withMessage('Valid period order required'),
], validate, controller.generateQr);

// Student scans QR token
router.post('/scan', qrScanLimiter, authorize(ROLES.USER), rejectUnknownBodyFields(['token']), [
  body('token').isString().trim().isLength({ min: 32, max: 2048 }).withMessage('QR token is invalid'),
], validate, controller.scanQr);

// Faculty polls live stats
router.get('/stats', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), controller.getQrSessionStats);

export default router;
