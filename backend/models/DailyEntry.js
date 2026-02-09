import mongoose from 'mongoose';

const dailyEntrySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Please add a date'],
    },
    // Client ID from main API (stored as String, not ObjectId reference)
    clientId: {
      type: String,
      required: [true, 'Please select a client'],
    },
    // Client name stored for quick access without API lookup
    clientName: {
      type: String,
      default: '',
    },
    // Meta Campaign metrics
    metaForm: {
      type: Number,
      default: 0,
    },
    metaWhatsapp: {
      type: Number,
      default: 0,
    },
    metaFund: {
      type: Number,
      default: 0,
    },
    metaTotalLeads: {
      type: Number,
      default: 0,
    },
    metaCPL: {
      type: Number,
      default: 0,
    },
    // Google Campaign metrics
    googleCall: {
      type: Number,
      default: 0,
    },
    googleWebsite: {
      type: Number,
      default: 0,
    },
    googleFund: {
      type: Number,
      default: 0,
    },
    googleTotalLeads: {
      type: Number,
      default: 0,
    },
    googleCPL: {
      type: Number,
      default: 0,
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
    overallCPL: {
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
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to calculate derived fields (Mongoose 9 syntax - no next() callback)
dailyEntrySchema.pre('save', function () {
  // Calculate Meta totals
  this.metaTotalLeads = this.metaForm + this.metaWhatsapp;
  if (this.metaTotalLeads > 0) {
    this.metaCPL = this.metaFund / this.metaTotalLeads;
  } else {
    this.metaCPL = 0;
  }

  // Calculate Google totals
  this.googleTotalLeads = this.googleCall + this.googleWebsite;
  if (this.googleTotalLeads > 0) {
    this.googleCPL = this.googleFund / this.googleTotalLeads;
  } else {
    this.googleCPL = 0;
  }

  // Calculate overall metrics
  this.totalLeads = this.metaTotalLeads + this.googleTotalLeads;
  this.totalSpend = this.metaFund + this.googleFund;
  if (this.totalLeads > 0) {
    this.overallCPL = this.totalSpend / this.totalLeads;
  } else {
    this.overallCPL = 0;
  }
});

// Index for better query performance
dailyEntrySchema.index({ date: -1, clientId: 1 });
dailyEntrySchema.index({ clientId: 1 });
dailyEntrySchema.index({ recordedBy: 1 });
// Compound unique index to prevent duplicate entries for same client on same date
dailyEntrySchema.index({ date: 1, clientId: 1 }, { unique: true });

const DailyEntry = mongoose.model('DailyEntry', dailyEntrySchema);

// Sync indexes to ensure proper index configuration
DailyEntry.syncIndexes().catch(err => {
  console.log('DailyEntry index sync note:', err.message);
});

export default DailyEntry;
