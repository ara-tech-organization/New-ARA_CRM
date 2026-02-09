import express from 'express';
import FundEntry from '../models/FundEntry.js';

const router = express.Router();

// GET /api/funds - Get all fund entries (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { clientId, dateFrom, dateTo, entryType } = req.query;

    const query = {};

    // Filter by entryType if provided, otherwise return all
    if (entryType) {
      query.entryType = entryType;
    }

    if (clientId) {
      query.clientId = clientId;
    }

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = dateFrom;
      if (dateTo) query.date.$lte = dateTo;
    }

    const entries = await FundEntry.find(query).sort({ date: -1 });

    res.status(200).json(entries);
  } catch (error) {
    console.error('Error fetching funds:', error);
    res.status(500).json({ message: 'Failed to fetch funds', error: error.message });
  }
});

// POST /api/funds - Create/Update daily fund entry for a single client
router.post('/', async (req, res) => {
  try {
    const {
      clientId,
      clientName,
      date,
      metaBalance,
      googleBalance,
      metaAmount,
      metaPaymentMode,
      metaPaymentDetails,
      googleAmount,
      googlePaymentMode,
      googlePaymentDetails,
    } = req.body;

    if (!clientId || !date) {
      return res.status(400).json({ message: 'Client ID and date are required' });
    }

    // Calculate total amount added
    const totalAmountAdded = (parseFloat(metaAmount) || 0) + (parseFloat(googleAmount) || 0);
    const fundAdded = totalAmountAdded > 0;

    // Find existing entry or create new one (upsert)
    const entry = await FundEntry.findOneAndUpdate(
      {
        entryType: 'daily_fund',
        clientId: clientId,
        date: date,
      },
      {
        entryType: 'daily_fund',
        clientId,
        clientName,
        date,
        metaBalance: parseFloat(metaBalance) || 0,
        googleBalance: parseFloat(googleBalance) || 0,
        metaAmount: parseFloat(metaAmount) || 0,
        metaPaymentMode: metaPaymentMode || '',
        metaPaymentDetails: metaPaymentDetails || '',
        googleAmount: parseFloat(googleAmount) || 0,
        googlePaymentMode: googlePaymentMode || '',
        googlePaymentDetails: googlePaymentDetails || '',
        totalAmountAdded,
        fundAdded,
        status: 'completed',
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    res.status(200).json(entry);
  } catch (error) {
    console.error('Error saving fund entry:', error);
    res.status(500).json({ message: 'Failed to save fund entry', error: error.message });
  }
});

export default router;
