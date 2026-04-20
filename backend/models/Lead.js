import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['meta', 'google', 'website', 'referral', 'direct', 'other'],
      default: 'direct',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
      default: 'new',
    },
    value: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Meta (Facebook / Instagram) lead fields
    meta_leadgen_id: { type: String, trim: true, unique: true, sparse: true },
    meta_form_id: { type: String, trim: true, default: '' },
    meta_form_name: { type: String, trim: true, default: '' },
    meta_campaign_id: { type: String, trim: true, default: '' },
    meta_campaign_name: { type: String, trim: true, default: '' },
    meta_adset_id: { type: String, trim: true, default: '' },
    meta_adset_name: { type: String, trim: true, default: '' },
    meta_ad_id: { type: String, trim: true, default: '' },
    meta_ad_name: { type: String, trim: true, default: '' },
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'messenger', 'whatsapp', 'unknown', ''],
      default: '',
    },
    utm_source: { type: String, trim: true, default: '' },
    utm_medium: { type: String, trim: true, default: '' },
    utm_campaign: { type: String, trim: true, default: '' },
    utm_content: { type: String, trim: true, default: '' },
    utm_term: { type: String, trim: true, default: '' },
    raw_field_data: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ client: 1, createdAt: -1 });
leadSchema.index({ meta_form_id: 1, createdAt: -1 });
leadSchema.index({ meta_campaign_id: 1 });
leadSchema.index({ meta_ad_id: 1 });

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
