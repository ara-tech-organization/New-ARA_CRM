import express from 'express';
import FundEntry from '../models/FundEntry.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Agency-side only — fund entries log money movement and shouldn't be
// readable or writable from anywhere outside an authenticated agency
// session.
router.use(protect);

const MAIN_API_URL = process.env.MAIN_API_URL || 'https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net';

const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
};

// GET /api/funds
// Reads directly from the local FundEntry collection — the same place
// POST /api/funds writes to. Previously this proxied to an older CRM
// backend (MAIN_API_URL), which meant entries saved via the FundEntry
// UI never surfaced in any list view. That legacy proxy is still
// available at /api/funds/legacy for anyone who needs the old data.
//
// Query params (all optional):
//   dateFrom       — YYYY-MM-DD, inclusive lower bound on `date`
//   dateTo         — YYYY-MM-DD, inclusive upper bound on `date`
//   entryType      — 'daily_fund' | 'general'
//   clientId       — filter to a single client
router.get('/', async (req, res) => {
  try {
    const { dateFrom, dateTo, entryType, clientId } = req.query;
    const query = {};
    if (entryType) query.entryType = entryType;
    if (clientId) query.clientId = clientId;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = dateFrom;
      if (dateTo)   query.date.$lte = dateTo;
    }
    const entries = await FundEntry.find(query)
      .sort({ date: -1, updatedAt: -1 })
      .limit(2000)
      .lean();
    return res.status(200).json({ count: entries.length, data: entries });
  } catch (error) {
    console.error('Funds fetch error:', error.message);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

// GET /api/funds/legacy — the old MAIN_API_URL proxy. Kept in case
// anything still relies on it; new UI reads from the /api/funds root.
router.get('/legacy', async (req, res) => {
  try {
    const headers = {};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    if (req.headers.cookie) headers.cookie = req.headers.cookie;
    const qs = new URLSearchParams(req.query).toString();
    const url = `${MAIN_API_URL}/api/funds${qs ? `?${qs}` : ''}`;
    const response = await fetchWithTimeout(url, { headers }, 20000);
    if (!response.ok) return res.status(200).json([]);
    return res.status(200).json(await response.json());
  } catch {
    return res.status(200).json([]);
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
    const parsedMetaAmount = parseFloat(metaAmount) || 0;
    const parsedGoogleAmount = parseFloat(googleAmount) || 0;
    const totalAmountAdded = parsedMetaAmount + parsedGoogleAmount;
    const fundAdded = totalAmountAdded > 0;

    // Build update object
    const updateData = {
      entryType: 'daily_fund',
      clientId,
      clientName,
      date,
      metaBalance: parseFloat(metaBalance) || 0,
      googleBalance: parseFloat(googleBalance) || 0,
      metaAmount: parsedMetaAmount,
      metaPaymentMode: metaPaymentMode || '',
      metaPaymentDetails: metaPaymentDetails || '',
      googleAmount: parsedGoogleAmount,
      googlePaymentMode: googlePaymentMode || '',
      googlePaymentDetails: googlePaymentDetails || '',
      totalAmountAdded,
      fundAdded,
      status: 'completed',
    };

    // Track when meta/google fund was added
    if (parsedMetaAmount > 0) {
      updateData.metaFundDate = new Date();
    }
    if (parsedGoogleAmount > 0) {
      updateData.googleFundDate = new Date();
    }

    // Find existing entry or create new one (upsert)
    const entry = await FundEntry.findOneAndUpdate(
      {
        entryType: 'daily_fund',
        clientId: clientId,
        date: date,
      },
      updateData,
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
