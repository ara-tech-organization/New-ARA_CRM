import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: [true, 'Please add a client name'],
      trim: true,
    },
    place: {
      type: String,
      trim: true,
      default: '',
    },
    organisationType: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    onboardDate: {
      type: Date,
      default: Date.now,
    },
    gstNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'suspended'],
      default: 'active',
    },
    accountID: {
      type: String,
      trim: true,
      default: '',
    },
    customerID: {
      type: String,
      trim: true,
      default: '',
    },
    removalReason: {
      type: String,
      trim: true,
      default: '',
    },
    links: {
      type: [String],
      default: [],
    },
    assignedSMM: {
      type: String,
      trim: true,
      default: '',
    },
    assignedSME: {
      type: String,
      trim: true,
      default: '',
    },
    team: {
      type: String,
      trim: true,
      default: '',
    },
    creativeCommitment: {
      type: String,
      trim: true,
      default: '',
    },
    staticCommitment: {
      type: String,
      trim: true,
      default: '',
    },
    motionCreative: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    billing: {
      billing_type: { type: String, enum: ['monthly', 'quarterly'], default: 'monthly' },
      total_added_funds: { type: Number, default: 0 },
      total_spend: { type: Number, default: 0 },
      available_balance: { type: Number, default: 0 },
      low_balance_threshold: { type: Number, default: 100 }
    },
    currency: { type: String, default: 'INR' },
    time_zone: { type: String, default: 'Asia/Kolkata' },
    google_ads_customer_id: {
      type: String,
      trim: true,
      default: '',
      unique: true,
      sparse: true,
      validate: {
        validator: function(v) {
          return v === '' || /^\d{10}$/.test(v);
        },
        message: 'Google Ads Customer ID must be exactly 10 digits'
      }
    },
    google_ads_account_name: {
      type: String,
      trim: true,
      default: '',
    },
    google_ads_enabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
clientSchema.index({ clientName: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ accountID: 1 });
clientSchema.index({ createdAt: -1 });
clientSchema.index({ google_ads_customer_id: 1 });
clientSchema.index({ google_ads_enabled: 1 });
clientSchema.index({ 'billing.available_balance': 1 });
// Text index for fast text search
clientSchema.index({ clientName: 'text', place: 'text', organisationType: 'text', accountID: 'text' });

const Client = mongoose.model('Client', clientSchema);

export default Client;
