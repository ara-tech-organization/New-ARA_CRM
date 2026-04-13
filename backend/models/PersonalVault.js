import mongoose from 'mongoose';

const personalVaultSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Email', 'Social Media', 'Banking', 'Cloud Service', 'Website', 'App', 'Other'],
      default: 'Other',
    },
    username: {
      type: String,
      required: [true, 'Please add a username or email'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
    },
    url: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

personalVaultSchema.index({ createdBy: 1 });
personalVaultSchema.index({ category: 1 });
personalVaultSchema.index({ sharedWith: 1 });

const PersonalVault = mongoose.model('PersonalVault', personalVaultSchema);

export default PersonalVault;
