import mongoose from 'mongoose';

// Immutable audit trail of every lead payload received, regardless of source.
// Webhook and poll both write here first; processing is idempotent on leadgen_id.
const metaLeadRawSchema = new mongoose.Schema(
  {
    leadgen_id: { type: String, required: true, trim: true },
    form_id: { type: String, default: '' },
    page_id: { type: String, default: '' },
    ad_id: { type: String, default: '' },
    adset_id: { type: String, default: '' },
    campaign_id: { type: String, default: '' },
    received_at: { type: Date, default: Date.now },
    source: {
      type: String,
      enum: ['webhook', 'poll', 'manual'],
      required: true,
    },
    raw_payload: { type: mongoose.Schema.Types.Mixed },
    processed: { type: Boolean, default: false },
    processed_at: { type: Date },
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

metaLeadRawSchema.index({ leadgen_id: 1 }, { unique: true });
metaLeadRawSchema.index({ processed: 1, received_at: -1 });
metaLeadRawSchema.index({ form_id: 1, received_at: -1 });

const MetaLeadRaw = mongoose.model('MetaLeadRaw', metaLeadRawSchema);

export default MetaLeadRaw;
