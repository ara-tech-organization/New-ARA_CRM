import express from 'express';
import Payment from '../models/Payment.js';
import Client from '../models/Client.js';
import BillingTransaction from '../models/BillingTransaction.js';

const router = express.Router();

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// POST /api/payments - Add payment/funds to a client
router.post('/', async (req, res) => {
  try {
    const { clientId, amount, method, notes, date } = req.body;

    if (!clientId || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'Client ID and amount are required' });
    }

    const amountNum = round2(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    let paymentDate = new Date();
    if (date !== undefined && date !== null && date !== '') {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      paymentDate = parsed;
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const payment = await Payment.create({
      client_id: clientId,
      amount: amountNum,
      method: method || 'bank_transfer',
      notes: notes || '',
      date: paymentDate
    });

    let updatedClient;
    try {
      updatedClient = await Client.findByIdAndUpdate(
        clientId,
        {
          $inc: {
            'billing.available_balance': amountNum,
            'billing.total_added_funds': amountNum
          }
        },
        { new: true }
      );
    } catch (err) {
      await Payment.deleteOne({ _id: payment._id });
      throw err;
    }

    const newBalance = round2(updatedClient?.billing?.available_balance);

    try {
      await BillingTransaction.create({
        client_id: clientId,
        type: 'credit',
        amount: amountNum,
        balance_after: newBalance,
        occurred_at: payment.date || paymentDate,
        source: 'manual_payment',
        reference: { payment_id: payment._id },
        description: notes ? `Funds added: ${notes}` : 'Funds added',
        idempotency_key: `payment:${payment._id}`
      });
    } catch (err) {
      // Roll back the balance increment to prevent cache drift
      await Client.findByIdAndUpdate(clientId, {
        $inc: {
          'billing.available_balance': -amountNum,
          'billing.total_added_funds': -amountNum
        }
      });
      await Payment.deleteOne({ _id: payment._id });
      throw err;
    }

    res.status(201).json({
      message: 'Payment added successfully',
      payment: {
        id: payment._id,
        amount: payment.amount,
        method: payment.method,
        date: payment.date,
        notes: payment.notes,
        balance_after: newBalance
      }
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// GET /api/payments/:clientId - Get payments for a client
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const payments = await Payment.find({ client_id: clientId }).sort({ date: -1 });

    res.json({
      count: payments.length,
      payments: payments.map(p => ({
        id: p._id,
        amount: p.amount,
        method: p.method,
        date: p.date,
        notes: p.notes
      }))
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

export default router;
