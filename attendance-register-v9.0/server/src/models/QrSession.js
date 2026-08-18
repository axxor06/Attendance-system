import mongoose from 'mongoose';
import crypto from 'crypto';

const { Schema } = mongoose;

/**
 * One active QR session per (subject, date, periodOrder).
 * The `token` is a cryptographically random string stored in the QR code.
 * Students scan the QR → their app sends the token → backend validates it
 * against the active session and marks them present.
 * Generating a new QR immediately invalidates the previous one (see controller).
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
    token: { type: String, required: true, unique: true, default: () => crypto.randomBytes(32).toString('hex') },
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
