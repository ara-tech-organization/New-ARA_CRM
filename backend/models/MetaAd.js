import mongoose from 'mongoose';

const metaAdSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    ad_account_id: { type: String, required: true, trim: true },
    campaign_id: { type: String, required: true, trim: true },
    adset_id: { type: String, required: true, trim: true },
    ad_id: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
    status: { type: String, default: '' },
    effective_status: { type: String, default: '' },
    creative_id: { type: String, default: '' },
    preview_shareable_link: { type: String, default: '' },
    tracking_specs: { type: mongoose.Schema.Types.Mixed },
    last_synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

metaAdSchema.index({ ad_id: 1 }, { unique: true });
metaAdSchema.index({ client_id: 1, adset_id: 1 });
metaAdSchema.index({ client_id: 1, campaign_id: 1 });

const MetaAd = mongoose.model('MetaAd', metaAdSchema);

export default MetaAd;
