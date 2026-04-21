import mongoose from 'mongoose';

const metaSyncRunSchema = new mongoose.Schema(
  {
    run_id: { type: String, required: true, trim: true },
    started_at: { type: Date, default: Date.now },
    ended_at: { type: Date },
    duration_ms: { type: Number, default: 0 },
    scope: {
      type: String,
      enum: ['full', 'incremental', 'single-client', 'deep'],
      required: true,
    },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    status: {
      type: String,
      enum: ['running', 'success', 'partial', 'failed'],
      default: 'running',
    },
    counts: {
      campaigns: { type: Number, default: 0 },
      adsets: { type: Number, default: 0 },
      ads: { type: Number, default: 0 },
      insights_rows: { type: Number, default: 0 },
      forms: { type: Number, default: 0 },
      leads_fetched: { type: Number, default: 0 },
      leads_inserted: { type: Number, default: 0 },
    },
    errors: {
      type: [
        {
          client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
          stage: { type: String, default: '' },
          message: { type: String, default: '' },
          code: { type: String, default: '' },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    rate_limit_usage: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

metaSyncRunSchema.index({ run_id: 1 }, { unique: true });
metaSyncRunSchema.index({ started_at: -1 });
metaSyncRunSchema.index({ status: 1, started_at: -1 });

const MetaSyncRun = mongoose.model('MetaSyncRun', metaSyncRunSchema);

export default MetaSyncRun;
