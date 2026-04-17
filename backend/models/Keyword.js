import mongoose from 'mongoose';

const keywordSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true
    },
    campaign_id: { type: String, required: true },
    campaign_name: { type: String },
    ad_group_id: { type: String },
    ad_group_name: { type: String },
    criterion_id: { type: String, required: true },
    keyword_text: { type: String, required: true },
    match_type: {
      type: String,
      enum: ['EXACT', 'PHRASE', 'BROAD', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    status: {
      type: String,
      enum: ['ENABLED', 'PAUSED', 'REMOVED', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    date: { type: Date, required: true },

    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },

    ctr: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    cpa: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Prevent duplicate rows for the same keyword/day
keywordSchema.index(
  { client_id: 1, campaign_id: 1, criterion_id: 1, date: 1 },
  { unique: true }
);
keywordSchema.index({ client_id: 1, date: -1 });
keywordSchema.index({ client_id: 1, campaign_id: 1, date: -1 });

const Keyword = mongoose.model('Keyword', keywordSchema);

export default Keyword;
