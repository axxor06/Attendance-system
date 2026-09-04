import nodemailer from 'nodemailer';

let transporter = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

/**
 * Verifies the SMTP connection/credentials. Called once at server startup
 * so a misconfigured .env fails loudly at boot instead of silently on the
 * first user signup.
 */
export async function verifyEmailConnection() {
  try {
    await getTransporter().verify();
    console.info('[Email] SMTP connection verified successfully.');
  } catch (err) {
    console.warn('[Email] SMTP verification failed', {
      category: 'SMTP_VERIFY_FAILURE',
      errorName: err?.name || 'Error',
      errorCode: typeof err?.code === 'string' ? err.code.slice(0, 80) : undefined,
    });
  }
}

async function sendMail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  return getTransporter().sendMail({ from, to, subject, html });
}

function baseTemplate({ title, bodyHtml }) {
  return `
  <div style="font-family: Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; background:#f4f6fb; padding: 32px 0;">
    <div style="background:#ffffff; border-radius:14px; padding: 32px; box-shadow: 0 4px 18px rgba(20,30,60,0.08);">
      <div style="text-align:center; margin-bottom:20px;">
        <div style="display:inline-block; width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#8b5cf6); line-height:48px; color:#fff; font-weight:700; font-size:20px;">A</div>
        <h2 style="margin:14px 0 0; color:#1e1b4b; font-size:18px;">${escapeHtml(title)}</h2>
      </div>
      ${bodyHtml}
      <p style="margin-top:28px; font-size:12px; color:#9ca3af; text-align:center;">
        Attendance Management System &middot; This is an automated message, please do not reply.
      </p>
    </div>
  </div>`;
}

export async function sendOtpEmail({ to, name, otp, purpose }) {
  const purposeText =
    purpose === 'password_reset'
      ? 'reset your password'
      : 'verify your email address';

  const minutes = process.env.OTP_EXPIRES_MINUTES || 10;

  const html = baseTemplate({
    title:
      purpose === 'password_reset' ? 'Password Reset Code' : 'Verify Your Email',
    bodyHtml: `
      <p style="color:#374151; font-size:14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="color:#374151; font-size:14px;">Use the code below to ${purposeText}. This code expires in ${minutes} minutes.</p>
      <div style="text-align:center; margin:24px 0;">
        <span style="display:inline-block; letter-spacing:6px; font-size:28px; font-weight:700; color:#4f46e5; background:#eef2ff; padding:14px 28px; border-radius:10px;">${escapeHtml(otp)}</span>
      </div>
      <p style="color:#9ca3af; font-size:13px;">If you did not request this code, you can safely ignore this email.</p>
    `,
  });

  return sendMail({
    to,
    subject:
      purpose === 'password_reset'
        ? 'Your Password Reset Code'
        : 'Your Email Verification Code',
    html,
  });
}

export async function sendPasswordChangedEmail({ to, name }) {
  const html = baseTemplate({
    title: 'Password Changed',
    bodyHtml: `
      <p style="color:#374151; font-size:14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="color:#374151; font-size:14px;">Your account password was just changed. If this wasn't you, please contact your administrator immediately.</p>
    `,
  });

  return sendMail({ to, subject: 'Your Password Was Changed', html });
}

export async function sendAccountCreatedEmail({ to, name, role, credentialsMessage }) {
  const html = baseTemplate({
    title: 'Welcome to the Attendance System',
    bodyHtml: `
      <p style="color:#374151; font-size:14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="color:#374151; font-size:14px;">An account has been created for you as <b>${escapeHtml(role)}</b>.</p>
      <p style="color:#374151; font-size:14px;">${escapeHtml(credentialsMessage || 'Please log in using the credentials provided to you by your administrator.')}</p>
    `,
  });
  return sendMail({ to, subject: 'Your Account Has Been Created', html });
}

export async function sendLowAttendanceEmail({ to, name, subjectName, percentage }) {
  const html = baseTemplate({
    title: 'Low Attendance Warning',
    bodyHtml: `
      <p style="color:#374151; font-size:14px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="color:#374151; font-size:14px;">
        Your attendance in <b>${escapeHtml(subjectName)}</b> has dropped to
        <b style="color:#dc2626;">${percentage}%</b>, which is below the required threshold.
      </p>
      <p style="color:#374151; font-size:14px;">Please make sure to attend upcoming classes to avoid academic issues.</p>
    `,
  });

  return sendMail({ to, subject: `Low Attendance Warning - ${String(subjectName || 'Subject').replace(/[\r\n]+/g, ' ').slice(0, 120)}`, html });
}
