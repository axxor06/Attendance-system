import express from 'express';
import mongoose from 'mongoose';
import { getRedisClient, isRedisConfigured } from '../services/redisService.js';
import authRoutes from './authRoutes.js';
import departmentRoutes from './departmentRoutes.js';
import semesterRoutes from './semesterRoutes.js';
import classRoutes from './classRoutes.js';
import userRoutes from './userRoutes.js';
import periodTemplateRoutes from './periodTemplateRoutes.js';
import timetableRoutes from './timetableRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import assignmentRequestRoutes from './assignmentRequestRoutes.js';
import subjectRoutes from './subjectRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import searchRoutes from './searchRoutes.js';
import reportRoutes from './reportRoutes.js';
import registrationRequestRoutes from './registrationRequestRoutes.js';
import qrRoutes from './qrRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import messageRoutes from './messageRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/semesters', semesterRoutes);
router.use('/classes', classRoutes);
router.use('/users', userRoutes);
router.use('/periods', periodTemplateRoutes);
router.use('/timetables', timetableRoutes);
router.use('/leave-requests', leaveRoutes);
router.use('/assignment-requests', assignmentRequestRoutes);
router.use('/subjects', subjectRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/search', searchRoutes);
router.use('/reports', reportRoutes);
router.use('/registration-requests', registrationRequestRoutes);
router.use('/qr', qrRoutes);
router.use('/uploads', uploadRoutes);
router.use('/messages', messageRoutes);

function redisStatus() {
  if (!isRedisConfigured()) return 'not_configured';
  return getRedisClient()?.isReady ? 'connected' : 'disconnected';
}

router.get('/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(200).json({
    success: true,
    status: 'ok',
    database: databaseReady ? 'connected' : 'disconnected',
    redis: redisStatus(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  const redis = redisStatus();
  const redisRequired = process.env.NODE_ENV === 'production';
  if (!databaseReady || (redisRequired && redis !== 'connected')) {
    return res.status(503).json({ success: false, status: 'not_ready', database: databaseReady ? 'connected' : 'disconnected', redis });
  }
  return res.status(200).json({ success: true, status: 'ready', database: 'connected', redis });
});

export default router;
