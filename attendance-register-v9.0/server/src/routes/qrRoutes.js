import express from 'express';
import * as controller from '../controllers/qrController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.use(protect);

// Faculty/HOD generate QR
router.post('/generate', authorize(ROLES.SUPER_ADMIN, ROLES.FACULTY, ROLES.HOD), [
  body('subjectId').isMongoId().withMessage('Valid subject required'),
  body('date').isISO8601().withMessage('Valid date required'),
  body('periodOrder').isInt({ min: 1 }).withMessage('Valid period order required'),
], validate, controller.generateQr);

// Student scans QR token
router.post('/scan', authorize(ROLES.STUDENT), [
  body('token').notEmpty().withMessage('QR token is required'),
], validate, controller.scanQr);

// Faculty polls live stats
router.get('/stats', authorize(ROLES.SUPER_ADMIN, ROLES.FACULTY, ROLES.HOD), controller.getQrSessionStats);

export default router;
