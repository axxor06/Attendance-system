import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * One active QR session per (subject, date, periodOrder).
 * The `token` field stores only a SHA-256 digest of the opaque QR bearer token.
 * The raw token is returned once to the faculty client for QR rendering and is
 * never stored in MongoDB. Students submit the raw token and the controller
 * hashes it before lookup. Generating a new QR invalidates the previous one.
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
