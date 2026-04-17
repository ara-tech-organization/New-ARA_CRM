import mongoose from 'mongoose';

const metricSchema = new mongoose.Schema({
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  campaign_id: {
    type: String,
    required: true
  },
  campaign_name: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  cost: { type: Number, default: 0 }, // in INR (after conversion from micros)
  conversions: { type: Number, default: 0 },
  click_breakdown: {
    website_clicks: { type: Number, default: 0 },
    call_clicks: { type: Number, default: 0 },
    other_clicks: { type: Number, default: 0 }
  },
  raw_click_types: [{
    click_type: { type: Number },
    clicks: { type: Number }
  }],
  // Impression-share metrics (Search campaigns only; 0 elsewhere). Stored as percentages.
  search_impression_share: { type: Number, default: 0 },
  search_rank_lost_impression_share: { type: Number, default: 0 },
  search_budget_lost_top_impression_share: { type: Number, default: 0 },

  // Calculated KPIs
  ctr: { type: Number, default: 0 }, // Click Through Rate (%)
  cpc: { type: Number, default: 0 }, // Cost Per Click
  cpa: { type: Number, default: 0 }, // Cost Per Acquisition
  conversion_rate: { type: Number, default: 0 }, // (conversions / clicks) * 100
  roas: { type: Number, default: 0 } // Return on Ad Spend
}, {
  timestamps: true
});

// Compound index for efficient queries
metricSchema.index({ client_id: 1, campaign_id: 1, date: 1 });

const Metric = mongoose.model('Metric', metricSchema);

export default Metric;