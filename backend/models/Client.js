import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
    accountId: {
      type: String,
      trim: true,
      default: '',
    },
    customerID: {
      type: String,
      trim: true,
      default: '',
    },
    googleCustomerId: {
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
    // Client Portal fields
    portalEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    portalPassword: {
      type: String,
      default: '',
      select: false,
    },
    portalEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash portal password before save
clientSchema.pre('save', async function (next) {
  if (!this.isModified('portalPassword') || !this.portalPassword) return next();
  const salt = await bcrypt.genSalt(10);
  this.portalPassword = await bcrypt.hash(this.portalPassword, salt);
  next();
});

// Compare portal password
clientSchema.methods.matchPortalPassword = async function (enteredPassword) {
  if (!this.portalPassword) return false;
  return await bcrypt.compare(enteredPassword, this.portalPassword);
};

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
clientSchema.index({ portalEmail: 1 }, { sparse: true });

const Client = mongoose.model('Client', clientSchema);

export default Client;
