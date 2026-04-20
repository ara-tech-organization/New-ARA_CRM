import mongoose from 'mongoose';

// Daily metrics row (parity with Google Metric.js).
// One row per (client_id, entity_id, date) at a given level.
const metaInsightsSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    ad_account_id: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ['account', 'campaign', 'adset', 'ad'],
      required: true,
    },
    entity_id: { type: String, required: true, trim: true },
    campaign_id: { type: String, default: '' },
    adset_id: { type: String, default: '' },
    ad_id: { type: String, default: '' },
    date: { type: Date, required: true },

    // Core metrics
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    unique_clicks: { type: Number, default: 0 },
    inline_link_clicks: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },

    // Calculated KPIs
    cpm: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },

    // Action breakdowns (Meta returns arrays of {action_type, value})
    actions: { type: mongoose.Schema.Types.Mixed, default: {} },
    action_values: { type: mongoose.Schema.Types.Mixed, default: {} },
    cost_per_action_type: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Lead-focused shortcuts (mirror DailyLeadData.metaData)
    leads: { type: Number, default: 0 },
    messaging_conversations_started: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    conversion_values: { type: Number, default: 0 },

    // Video
    video_thruplay: { type: Number, default: 0 },

    // Currency — account native + INR snapshot (INR left 0 in INR-only mode)
    currency: { type: String, default: '' },
    spend_inr: { type: Number, default: 0 },

    last_synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

metaInsightsSchema.index(
  { client_id: 1, entity_id: 1, date: 1 },
  { unique: true }
);
metaInsightsSchema.index({ client_id: 1, level: 1, date: 1 });
metaInsightsSchema.index({ client_id: 1, campaign_id: 1, date: 1 });

const MetaInsights = mongoose.model('MetaInsights', metaInsightsSchema);

export default MetaInsights;
