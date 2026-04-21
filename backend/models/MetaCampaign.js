import mongoose from 'mongoose';

const metaCampaignSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    ad_account_id: { type: String, required: true, trim: true },
    campaign_id: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
    objective: { type: String, default: '' },
    status: { type: String, default: '' },
    effective_status: { type: String, default: '' },
    daily_budget: { type: Number, default: 0 },
    lifetime_budget: { type: Number, default: 0 },
    buying_type: { type: String, default: '' },
    special_ad_categories: { type: [String], default: [] },
    start_time: { type: Date },
    stop_time: { type: Date },
    last_synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

metaCampaignSchema.index({ campaign_id: 1 }, { unique: true });
metaCampaignSchema.index({ client_id: 1, status: 1 });
metaCampaignSchema.index({ client_id: 1, ad_account_id: 1 });

const MetaCampaign = mongoose.model('MetaCampaign', metaCampaignSchema);

export default MetaCampaign;
