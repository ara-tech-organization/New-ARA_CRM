import mongoose from 'mongoose';

const metaAdSetSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    ad_account_id: { type: String, required: true, trim: true },
    campaign_id: { type: String, required: true, trim: true },
    adset_id: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
    status: { type: String, default: '' },
    effective_status: { type: String, default: '' },
    daily_budget: { type: Number, default: 0 },
    lifetime_budget: { type: Number, default: 0 },
    optimization_goal: { type: String, default: '' },
    billing_event: { type: String, default: '' },
    bid_strategy: { type: String, default: '' },
    targeting_summary: { type: mongoose.Schema.Types.Mixed },
    start_time: { type: Date },
    end_time: { type: Date },
    last_synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

metaAdSetSchema.index({ adset_id: 1 }, { unique: true });
metaAdSetSchema.index({ client_id: 1, campaign_id: 1 });

const MetaAdSet = mongoose.model('MetaAdSet', metaAdSetSchema);

export default MetaAdSet;
