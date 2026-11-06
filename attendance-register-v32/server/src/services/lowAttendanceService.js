import { User } from '../models/index.js';
import { notifyUser } from './notificationService.js';
import { sendLowAttendanceEmail } from '../utils/email.js';
import { getOverallAttendance } from './attendanceService.js';
import { LOW_ATTENDANCE_THRESHOLD, NOTIFICATION_TYPE } from '../config/constants.js';

/**
 * Checks each student's overall attendance after a marking session and
 * sends a low-attendance email + notification to anyone who has dropped
 * below the threshold. Runs all students concurrently (rather than one
 * sequential DB round-trip per student) and is intended to be fired
 * after the HTTP response has already been sent, so a slow class roster
 * never delays the faculty member's "saved" confirmation.
 */
export async function checkAndNotifyLowAttendance(studentIds, subject) {
  await Promise.all(
    studentIds.map(async (studentId) => {
      const overall = await getOverallAttendance({ studentId });
      if (overall.total < 5 || overall.percentage >= LOW_ATTENDANCE_THRESHOLD) return;

      const student = await User.findById(studentId);
      if (!student) return;

      await Promise.all([
        sendLowAttendanceEmail({
          to: student.email,
          name: student.name,
          subjectName: subject.name,
          percentage: overall.percentage,
        }).catch((err) => console.error('[Email] low attendance email failed:', err.message)),
        notifyUser({
          userId: studentId,
          type: NOTIFICATION_TYPE.LOW_ATTENDANCE,
          title: 'Low attendance warning',
          message: `Your overall attendance has dropped to ${overall.percentage}%.`,
          meta: { percentage: overall.percentage },
        }),
      ]);
    })
  );
}
