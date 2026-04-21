import mongoose from 'mongoose';

// Dead-letter queue for leads we failed to process on first webhook delivery.
// Scheduler's retry worker picks rows where status='pending' and next_attempt_at <= now.
const metaWebhookRetrySchema = new mongoose.Schema(
  {
    leadgen_id: { type: String, required: true, trim: true },
    page_id: { type: String, default: '' },
    form_id: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed },
    attempts: { type: Number, default: 0 },
    next_attempt_at: { type: Date, default: Date.now },
    last_error: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'abandoned'],
      default: 'pending',
    },
    resolved_at: { type: Date },
  },
  { timestamps: true }
);

metaWebhookRetrySchema.index({ status: 1, next_attempt_at: 1 });
metaWebhookRetrySchema.index({ leadgen_id: 1 });

const MetaWebhookRetry = mongoose.model(
  'MetaWebhookRetry',
  metaWebhookRetrySchema
);

export default MetaWebhookRetry;
