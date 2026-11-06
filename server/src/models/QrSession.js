import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * One active QR session per (subject, date, periodOrder).
 * The `token` field stores only a keyed HMAC-SHA256 digest of the short
 * 8-character attendance code. The raw code is returned once to the faculty
 * client (shown as text and encoded in the QR image) and is never stored.
 * Students submit the code; the controller hashes it and looks it up within
 * the student's own class. Generating a new code invalidates the previous one.
 */
const qrSessionSchema = new Schema(
  {
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    faculty: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    dayOfWeek: { type: String, required: true },
    periodOrder: { type: Number, required: true },
    periodName: { type: String, required: true },
    token: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    scannedStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// TTL: auto-delete 1 hour after expiry (keeps collection small)
qrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
qrSessionSchema.index({ subject: 1, date: 1, periodOrder: 1, isActive: 1 });
qrSessionSchema.index(
  { subject: 1, class: 1, date: 1, periodOrder: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

const QrSession = mongoose.model('QrSession', qrSessionSchema);
export default QrSession;
