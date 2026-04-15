import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  client_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['bank_transfer', 'upi', 'cash', 'other'],
    default: 'bank_transfer'
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Index for performance
paymentSchema.index({ client_id: 1 });
paymentSchema.index({ date: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;