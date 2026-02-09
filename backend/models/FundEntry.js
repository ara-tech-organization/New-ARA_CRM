import mongoose from 'mongoose';

const fundEntrySchema = new mongoose.Schema(
  {
    entryID: {
      type: String,
      unique: true,
      sparse: true, // Allow null for daily fund entries
    },
    // Entry type: 'general' for accounting, 'daily_fund' for Meta/Google fund tracking
    entryType: {
      type: String,
      enum: ['general', 'daily_fund'],
      default: 'general',
    },
    // ===== General Fund Entry Fields =====
    amount: {
      type: Number,
      min: [0, 'Amount cannot be negative'],
    },
    type: {
      type: String,
      enum: ['income', 'expense', 'investment', 'withdrawal'],
    },
    category: {
      type: String,
      enum: [
        'client_payment',
        'ad_spend',
        'salary',
        'office_expense',
        'software',
        'marketing',
        'commission',
        'refund',
        'other',
      ],
    },
    date: {
      type: String, // YYYY-MM-DD format for easy filtering (matches main API)
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    // Reference to client (ObjectId for general entries)
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    },
    // Client ID from main API (String for daily fund entries)
    clientId: {
      type: String,
    },
    // Client name (for daily fund entries)
    clientName: {
      type: String,
      trim: true,
    },
    // Payment details (for general entries)
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit_card', 'bank_transfer', 'check', 'online', 'other'],
    },
    transactionId: {
      type: String,
      trim: true,
    },
    // Status tracking
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled', 'failed'],
      default: 'completed',
    },
    // Invoice reference
    invoiceNumber: {
      type: String,
      trim: true,
    },
    // Attachment
    attachment: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Who recorded this entry
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Approval workflow
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvalDate: {
      type: Date,
    },

    // ===== Daily Fund Entry Fields (Meta/Google - matches main API) =====
    metaBalance: {
      type: Number,
      default: 0,
    },
    googleBalance: {
      type: Number,
      default: 0,
    },
    fundAdded: {
      type: Boolean,
      default: false,
    },
    metaAmount: {
      type: Number,
      default: 0,
    },
    metaPaymentMode: {
      type: String,
      enum: ['', 'Card', 'QR Code', 'Net Banking'],
      default: '',
    },
    metaPaymentDetails: {
      type: String,
      default: '',
    },
    googleAmount: {
      type: Number,
      default: 0,
    },
    googlePaymentMode: {
      type: String,
      enum: ['', 'Card', 'QR Code', 'Net Banking'],
      default: '',
    },
    googlePaymentDetails: {
      type: String,
      default: '',
    },
    totalAmountAdded: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Generate entryID before validation (only for general entries)
fundEntrySchema.pre('validate', async function (next) {
  if (this.isNew && !this.entryID && this.entryType === 'general') {
    try {
      const count = await mongoose.model('FundEntry').countDocuments({ entryType: 'general' });
      this.entryID = `FND${String(count + 1).padStart(5, '0')}`;
    } catch (error) {
      next(error);
    }
  }
  next();
});

// Index for better query performance
fundEntrySchema.index({ date: -1 });
fundEntrySchema.index({ type: 1 });
fundEntrySchema.index({ category: 1 });
fundEntrySchema.index({ client: 1 });
fundEntrySchema.index({ recordedBy: 1 });
fundEntrySchema.index({ status: 1 });
fundEntrySchema.index({ entryType: 1 });
fundEntrySchema.index({ clientId: 1 });
// Compound unique index for daily fund entries (one per client per date)
fundEntrySchema.index({ entryType: 1, clientId: 1, date: 1 }, { unique: true, sparse: true });

const FundEntry = mongoose.model('FundEntry', fundEntrySchema);

export default FundEntry;
