import express from 'express';
import FundEntry from '../models/FundEntry.js';

const router = express.Router();

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

// GET /api/funds - Proxies to main API (production data)
router.get('/', async (req, res) => {
  try {
    const headers = {};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    if (req.headers.cookie) headers.cookie = req.headers.cookie;

    const qs = new URLSearchParams(req.query).toString();
    const url = `${MAIN_API_URL}/api/funds${qs ? `?${qs}` : ''}`;
    const response = await fetchWithTimeout(url, { headers }, 20000);
    if (!response.ok) {
      console.error(`Funds proxy: main API returned ${response.status}`);
      return res.status(200).json([]);
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Funds proxy error:', error.message);
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
