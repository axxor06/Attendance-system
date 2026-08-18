import express from 'express';
import * as authController from '../controllers/authController.js';
import * as v from '../validators/authValidators.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { cookieOriginGuard } from '../middleware/cookieOriginGuard.js';
import {
  loginLimiter,
  otpGenerateLimiter,
  otpVerifyLimiter,
  forgotPasswordLimiter,
  passwordResetLimiter,
  refreshLimiter,
} from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/register', otpGenerateLimiter, v.registerStudentValidator, validate, authController.registerStudent);
router.post('/verify-email', otpVerifyLimiter, v.verifyEmailValidator, validate, authController.verifyEmail);
router.post('/resend-otp', otpGenerateLimiter, v.resendOtpValidator, validate, authController.resendOtp);
router.post('/login', loginLimiter, v.loginValidator, validate, authController.login);
router.post('/refresh', cookieOriginGuard, refreshLimiter, authController.refresh);
router.post('/logout', cookieOriginGuard, refreshLimiter, authController.logout);
router.post('/forgot-password', forgotPasswordLimiter, v.forgotPasswordValidator, validate, authController.forgotPassword);
router.post('/verify-reset-otp', passwordResetLimiter, v.verifyResetOtpValidator, validate, authController.verifyResetOtp);
router.post('/reset-password', passwordResetLimiter, v.resetPasswordValidator, validate, authController.resetPassword);

router.use(protect);
router.patch('/me', v.updateMeValidator, validate, authController.updateMe);
router.get('/me', authController.getMe);
router.post('/change-password', passwordResetLimiter, v.changePasswordValidator, validate, authController.changePassword);

export default router;
