import mongoose from 'mongoose';

const dailyLeadDataSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Please add a date'],
      unique: true,
    },
    // Meta campaign metrics
    metaData: {
      formLeads: {
        type: Number,
        default: 0,
      },
      whatsAppLeads: {
        type: Number,
        default: 0,
      },
      totalLeads: {
        type: Number,
        default: 0,
      },
      spend: {
        type: Number,
        default: 0,
      },
      impressions: {
        type: Number,
        default: 0,
      },
      clicks: {
        type: Number,
        default: 0,
      },
      cpl: {
        type: Number,
        default: 0,
      },
      ctr: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
      revenue: {
        type: Number,
        default: 0,
      },
    },
    // Google campaign metrics
    googleData: {
      callLeads: {
        type: Number,
        default: 0,
      },
      websiteLeads: {
        type: Number,
        default: 0,
      },
      totalLeads: {
        type: Number,
        default: 0,
      },
      spend: {
        type: Number,
        default: 0,
      },
      impressions: {
        type: Number,
        default: 0,
      },
      clicks: {
        type: Number,
        default: 0,
      },
      cpl: {
        type: Number,
        default: 0,
      },
      ctr: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
      revenue: {
        type: Number,
        default: 0,
      },
    },
    // Overall metrics
    totalLeads: {
      type: Number,
      default: 0,
    },
    totalSpend: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    totalConversions: {
      type: Number,
      default: 0,
    },
    averageCPL: {
      type: Number,
      default: 0,
    },
    roi: {
      type: Number,
      default: 0,
    },
    // Quality metrics
    qualifiedLeadsPercentage: {
      type: Number,
      default: 0,
    },
    conversionRate: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
dailyLeadDataSchema.index({ date: -1 });
dailyLeadDataSchema.index({ recordedBy: 1 });

const DailyLeadData = mongoose.model('DailyLeadData', dailyLeadDataSchema);

export default DailyLeadData;
