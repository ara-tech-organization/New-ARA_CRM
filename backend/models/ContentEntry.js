import mongoose from 'mongoose';

const contentEntrySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Please add a date'],
    },
    clientName: {
      type: String,
      required: [true, 'Please select a client'],
      trim: true,
    },
    contentType: {
      type: String,
      enum: ['Reel', 'Static', 'Carousel'],
      required: [true, 'Please select a content type'],
    },
    postTitle: {
      type: String,
      required: [true, 'Please add a post title'],
      trim: true,
    },
    platform: {
      type: String,
      enum: ['Instagram', 'Facebook', 'YouTube'],
      required: [true, 'Please select a platform'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    referenceVideo: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Planned', 'Scheduled', 'Published', 'Missed'],
      default: 'Planned',
    },
    assignedSME: {
      type: String,
      trim: true,
      default: '',
    },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Revisions Needed', ''],
      default: '',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

contentEntrySchema.index({ date: -1 });
contentEntrySchema.index({ clientName: 1 });
contentEntrySchema.index({ status: 1 });
contentEntrySchema.index({ createdBy: 1 });
contentEntrySchema.index({ date: -1, clientName: 1 });

const ContentEntry = mongoose.model('ContentEntry', contentEntrySchema);

export default ContentEntry;
