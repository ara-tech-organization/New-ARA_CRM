import mongoose from 'mongoose';

const dailyDebitSnapshotSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true
    },
    platform: {
      type: String,
      enum: ['google', 'meta'],
      required: true,
      default: 'google'
    },
    campaign_id: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    debited_amount: {
      type: Number,
      default: 0
    },
    reported_amount: {
      type: Number,
      default: 0
    },
    last_synced_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

dailyDebitSnapshotSchema.index(
  { client_id: 1, platform: 1, campaign_id: 1, date: 1 },
  { unique: true }
);

const DailyDebitSnapshot = mongoose.model(
  'DailyDebitSnapshot',
  dailyDebitSnapshotSchema
);

export default DailyDebitSnapshot;
