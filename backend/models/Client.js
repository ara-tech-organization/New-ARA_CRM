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
// Text index for fast text search
clientSchema.index({ clientName: 'text', place: 'text', organisationType: 'text', accountID: 'text' });

const Client = mongoose.model('Client', clientSchema);

export default Client;
