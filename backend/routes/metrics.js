import express from 'express';
import Metric from '../models/Metric.js';
import { protectAdminOrClient } from '../middleware/auth.js';

const router = express.Router();

// Metrics power both the admin dashboard and the client portal's
// per-client breakdown, so accept either token type. Handlers that
// take :clientId go through `assertTenantScope` to reject portal
// tokens addressing a different client.
router.use(protectAdminOrClient);

const assertTenantScope = (req, res, next) => {
  const { clientId } = req.params;
  if (req.clientId && String(req.clientId) !== String(clientId)) {
    return res.status(403).json({ error: 'Portal token cannot access another client' });
  }
  next();
};

// Get aggregated metrics for dashboard
router.get('/dashboard/:clientId', assertTenantScope, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    const metrics = await Metric.aggregate([
      {
        $match: {
          client_id: clientId,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: '$clicks' },
          totalCost: { $sum: '$cost' },
          totalConversions: { $sum: '$conversions' },
          totalImpressions: { $sum: '$impressions' },
          websiteClicks: { $sum: '$click_breakdown.website_clicks' },
          callClicks: { $sum: '$click_breakdown.call_clicks' },
          otherClicks: { $sum: '$click_breakdown.other_clicks' }
        }
      }
    ]);

    res.json(metrics[0] || {
      totalClicks: 0,
      totalCost: 0,
      totalConversions: 0,
      totalImpressions: 0,
      websiteClicks: 0,
      callClicks: 0,
      otherClicks: 0
    });
  } catch (error) {
    console.error('Metrics dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign-specific metrics
router.get('/campaigns/:clientId', assertTenantScope, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    const metrics = await Metric.aggregate([
      {
        $match: {
          client_id: clientId,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: '$campaign_id',
          campaign_name: { $first: '$campaign_name' },
          totalClicks: { $sum: '$clicks' },
          totalCost: { $sum: '$cost' },
          totalConversions: { $sum: '$conversions' },
          totalImpressions: { $sum: '$impressions' },
          websiteClicks: { $sum: '$click_breakdown.website_clicks' },
          callClicks: { $sum: '$click_breakdown.call_clicks' },
          otherClicks: { $sum: '$click_breakdown.other_clicks' }
        }
      },
      {
        $sort: { totalCost: -1 }
      }
    ]);

    res.json(metrics);
  } catch (error) {
    console.error('Campaign metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily metrics for charts
router.get('/daily/:clientId', assertTenantScope, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    const metrics = await Metric.find({
      client_id: clientId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ date: 1 });

    res.json(metrics);
  } catch (error) {
    console.error('Daily metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;