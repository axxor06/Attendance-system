import mongoose from 'mongoose';

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, immutable: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
    body: { type: String, trim: true, required: true, maxlength: 5000 },
    hiddenFor: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    // Client-generated idempotency key: a retried/double-tapped send returns the original message.
    clientMessageId: { type: String, trim: true, maxlength: 64, default: undefined, immutable: true },
    editedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, hiddenFor: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
messageSchema.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);

messageSchema.pre('validate', function requireText(next) {
  if (!this.body?.trim()) return next(new Error('A message must contain text.'));
  next();
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
