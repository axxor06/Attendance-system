import mongoose from 'mongoose';

const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2 && new Set(value.map((id) => String(id))).size === 2,
        message: 'A conversation must contain exactly two different participants.',
      },
      required: true,
    },
    participantKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastSender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
