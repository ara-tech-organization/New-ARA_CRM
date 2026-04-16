import express from 'express';
import Payment from '../models/Payment.js';
import Client from '../models/Client.js';

const router = express.Router();

// POST /api/payments - Add payment/funds to a client
router.post('/', async (req, res) => {
  try {
    const { clientId, amount, method, notes } = req.body;

    if (!clientId || !amount) {
      return res.status(400).json({ error: 'Client ID and amount are required' });
    }

    // Validate client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Create payment
    const payment = new Payment({
      client_id: clientId,
      amount: parseFloat(amount),
      method: method || 'bank_transfer',
      notes: notes || ''
    });

    await payment.save();

    res.status(201).json({
      message: 'Payment added successfully',
      payment: {
        id: payment._id,
        amount: payment.amount,
        method: payment.method,
        date: payment.date,
        notes: payment.notes
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