import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  campaign_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['ENABLED', 'PAUSED', 'REMOVED'],
    default: 'ENABLED'
  },
  budget: {
    type: Number, // in INR (after conversion from micros)
    required: true
  }
}, {
  timestamps: true
});

// Add index for performance
campaignSchema.index({ client_id: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);

export default Campaign;