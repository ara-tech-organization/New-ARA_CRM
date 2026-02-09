import mongoose from 'mongoose';

const vaultSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
    },
    clientName: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['Facebook', 'Instagram', 'Google Ads', 'Email', 'Website', 'Other'],
    },
    username: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
vaultSchema.index({ clientId: 1 });
vaultSchema.index({ platform: 1 });

const Vault = mongoose.model('Vault', vaultSchema);

export default Vault;
