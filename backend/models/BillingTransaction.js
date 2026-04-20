import mongoose from 'mongoose';

const billingTransactionSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['credit', 'debit', 'adjustment', 'refund'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    balance_after: {
      type: Number,
      required: true
    },
    occurred_at: {
      type: Date,
      required: true
    },
    recorded_at: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: [
        'manual_payment',
        'google_ads_daily_spend',
        'google_ads_refund',
        'meta_ads_daily_spend',
        'meta_ads_refund',
        'meta_ads_adjustment',
        'admin_adjustment',
        'backfill_payment',
        'backfill_spend'
      ],
      required: true
    },
    reference: {
      payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
      campaign_id: { type: String },
      campaign_name: { type: String },
      metric_date: { type: Date }
    },
    description: {
      type: String,
      default: ''
    },
    idempotency_key: {
      type: String
    }
  },
  { timestamps: true }
);

billingTransactionSchema.index({ client_id: 1, occurred_at: -1 });
billingTransactionSchema.index({ client_id: 1, type: 1, occurred_at: -1 });
billingTransactionSchema.index(
  { idempotency_key: 1 },
  { unique: true, sparse: true }
);

const BillingTransaction = mongoose.model(
  'BillingTransaction',
  billingTransactionSchema
);

export default BillingTransaction;
