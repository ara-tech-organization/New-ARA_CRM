import express from 'express';
import { protectClient } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Client from '../models/Client.js';

const router = express.Router();

/**
 * @desc    Get Google Ads analytics for the authenticated client.
 *          Meta data is fetched directly by the frontend against
 *          /api/meta/client/:id/analytics — an earlier attempt to
 *          proxy both through here was unreliable on Azure (internal
 *          self-calls to http://localhost:${PORT} timed out).
 * @route   GET /api/client-portal/analytics
 * @access  Private (client portal)
 *
 * Never 400s when Google is missing — returns an empty shell so the
 * client portal still loads for Meta-only clients.
 */
router.get('/analytics', protectClient, asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  const clientId = req.clientId;

  const client = await Client.findById(clientId).lean();
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const googleEnabled = !!(client.google_ads_enabled && client.google_ads_customer_id);
  const metaEnabled = !!(client.meta_enabled && client.meta_ad_account_id);

  const emptyShell = () => ({
    client: {
      _id: client._id,
      clientName: client.clientName,
      google_ads_enabled: googleEnabled,
      google_ads_customer_id: client.google_ads_customer_id || '',
    },
    summary: {},
    campaignMetrics: [],
    keywords: [],
    dailyMetrics: [],
  });

  let response = emptyShell();
  let googleError = null;

  if (googleEnabled) {
    const axios = (await import('axios')).default;
    const baseUrl = process.env.MAIN_API_URL || `http://localhost:${process.env.PORT || 5000}`;
    try {
      const r = await axios.get(`${baseUrl}/api/analytics/client/${clientId}`, {
        params: { start_date, end_date },
        headers: { Authorization: req.headers.authorization },
        timeout: 15000,
      });
      response = r.data;
    } catch (err) {
      googleError = err.response?.data?.error || err.message || 'Google fetch failed';
    }
  }

  response.integrations = {
    google_enabled: googleEnabled,
    meta_enabled: metaEnabled,
  };
  if (googleError) response.google_error = googleError;

  res.json(response);
}));

export default router;
