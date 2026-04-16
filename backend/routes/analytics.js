import express from 'express';
import Client from '../models/Client.js';
import Metric from '../models/Metric.js';
import Campaign from '../models/Campaign.js';

const router = express.Router();

// GET /api/analytics/clients - List all clients with overview data
router.get('/clients', async (req, res) => {
  try {
  // Get all clients with Google Ads enabled
  const clients = await Client.find({ google_ads_enabled: true })
    .select('clientName google_ads_customer_id google_ads_account_name billing')
    .sort({ clientName: 1 });

  const clientOverviews = [];

  for (const client of clients) {
    // Get total metrics for the client (last 30 days)
    const metrics = await Metric.aggregate([
      { $match: { client_id: client._id } },
      {
        $group: {
          _id: null,
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalCost: { $sum: '$cost' },
          totalConversions: { $sum: '$conversions' },
          totalCallClicks: { $sum: '$click_breakdown.call_clicks' },
          totalWebsiteClicks: { $sum: '$click_breakdown.website_clicks' }
        }
      }
    ]);

    const metricData = metrics[0] || {
      totalImpressions: 0,
      totalClicks: 0,
      totalCost: 0,
      totalConversions: 0,
      totalCallClicks: 0,
      totalWebsiteClicks: 0,
      totalOtherClicks: 0
    };

    // Calculate CPL (Cost Per Lead) - using conversions as leads
    const cpl = metricData.totalConversions > 0 ? metricData.totalCost / metricData.totalConversions : 0;

    // Get total budget from campaigns
    const campaigns = await Campaign.find({ client_id: client._id });
    const totalBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget || 0), 0);

    // Get average KPIs from stored values
    const avgKPIs = await Metric.aggregate([
      { $match: { client_id: client._id } },
      {
        $group: {
          _id: null,
          avgCtr: { $avg: '$ctr' },
          avgCpc: { $avg: '$cpc' },
          avgCpa: { $avg: '$cpa' },
          avgRoas: { $avg: '$roas' }
        }
      }
    ]);

    const kpis = avgKPIs[0] || { avgCtr: 0, avgCpc: 0, avgCpa: 0, avgRoas: 0 };

    // Show exact click types: click_type 25 accounts for website clicks
    const clickTypes = {
      25: metricData.totalWebsiteClicks  // Click type 25 (mapped to website clicks)
    };

    // Calculate remaining clicks from other click types
    const knownClicks = metricData.totalWebsiteClicks + metricData.totalCallClicks;
    const unknownClicks = metricData.totalClicks - knownClicks;

    if (unknownClicks > 0) {
      clickTypes["unknown_click_types"] = unknownClicks; // Clicks from unidentified click types
    }

    clientOverviews.push({
      clientId: client._id,
      clientName: client.clientName,
      googleAdsCustomerId: client.google_ads_customer_id,
      googleAdsAccountName: client.google_ads_account_name,
      fund: client.billing.total_added_funds || 0,
      availableBalance: client.billing.available_balance || 0,
      totalBudget,
      totalCallClicks: metricData.totalCallClicks,
      totalWebsiteClicks: metricData.totalWebsiteClicks,
      totalClicks: metricData.totalClicks,
      clickTypes,
      totalImpressions: metricData.totalImpressions,
      totalCost: metricData.totalCost,
      totalConversions: metricData.totalConversions,
      clickTypes, // Raw click types found
      cpl: Math.round(cpl * 100) / 100, // Round to 2 decimal places
      ctr: metricData.totalImpressions > 0 ? (metricData.totalClicks / metricData.totalImpressions) * 100 : 0,
      cpc: metricData.totalClicks > 0 ? metricData.totalCost / metricData.totalClicks : 0
    });
  }

  res.json({
    count: clientOverviews.length,
    clients: clientOverviews
  });
  } catch (error) {
    console.error('Get analytics clients error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics/client/:clientId - Detailed reports for single client with date filters
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    // Validate client exists and has Google Ads enabled
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    if (!client.google_ads_enabled || !client.google_ads_customer_id) {
      return res.status(400).json({ error: 'Client does not have Google Ads enabled' });
    }

  // Build date filter - default to today if no dates provided
  let dateFilter = {};
  if (start_date && end_date) {
    dateFilter.date = {
      $gte: new Date(start_date),
      $lte: new Date(end_date)
    };
  } else {
    // Default to today's date only
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    dateFilter.date = {
      $gte: new Date(todayStr),
      $lte: new Date(todayStr + 'T23:59:59.999Z')
    };
  }

  // Get daily metrics with date filtering
  const metrics = await Metric.find({
    client_id: clientId,
    ...dateFilter
  }).sort({ date: 1 });

  // Get campaigns for this client
  const campaigns = await Campaign.find({ client_id: clientId })
    .select('campaign_id name budget status')
    .sort({ createdAt: -1 });

  // Aggregate totals
  const totals = metrics.reduce((acc, metric) => {
    acc.impressions += metric.impressions || 0;
    acc.clicks += metric.clicks || 0;
    acc.cost += metric.cost || 0;
    acc.conversions += metric.conversions || 0;
    acc.callClicks += metric.click_breakdown?.call_clicks || 0;
    acc.websiteClicks += metric.click_breakdown?.website_clicks || 0;
    acc.ctr += metric.ctr || 0;
    acc.cpc += metric.cpc || 0;
    acc.cpa += metric.cpa || 0;
    acc.roas += metric.roas || 0;
    return acc;
  }, {
    impressions: 0,
    clicks: 0,
    cost: 0,
    conversions: 0,
    callClicks: 0,
    websiteClicks: 0,
    ctr: 0,
    cpc: 0,
    cpa: 0,
    roas: 0
  });

  // Calculate averages for KPIs
  const metricCount = metrics.length;
  const avgKpis = {
    ctr: metricCount > 0 ? totals.ctr / metricCount : 0,
    cpc: metricCount > 0 ? totals.cpc / metricCount : 0,
    cpa: metricCount > 0 ? totals.cpa / metricCount : 0,
    roas: metricCount > 0 ? totals.roas / metricCount : 0
  };

  // Calculate CPL (Cost Per Lead)
  const cpl = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

  // Calculate click types breakdown
  const clickTypes = {
    25: totals.websiteClicks  // Click type 25 (mapped to website clicks)
  };

  // Calculate remaining clicks from other click types
  const knownClicks = totals.websiteClicks + totals.callClicks;
  const unknownClicks = totals.clicks - knownClicks;

  if (unknownClicks > 0) {
    clickTypes["unknown_click_types"] = unknownClicks;
  }

  // Group metrics by campaign
  const campaignMetrics = {};
  const campaignCounts = {};
  metrics.forEach(metric => {
    const campaignId = metric.campaign_id;
    if (!campaignMetrics[campaignId]) {
      campaignMetrics[campaignId] = {
        campaignId,
        campaignName: metric.campaign_name,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        callClicks: 0,
        websiteClicks: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0
      };
      campaignCounts[campaignId] = 0;
    }
    campaignMetrics[campaignId].impressions += metric.impressions || 0;
    campaignMetrics[campaignId].clicks += metric.clicks || 0;
    campaignMetrics[campaignId].cost += metric.cost || 0;
    campaignMetrics[campaignId].conversions += metric.conversions || 0;
    campaignMetrics[campaignId].callClicks += metric.click_breakdown?.call_clicks || 0;
    campaignMetrics[campaignId].websiteClicks += metric.click_breakdown?.website_clicks || 0;
    campaignMetrics[campaignId].ctr += metric.ctr || 0;
    campaignMetrics[campaignId].cpc += metric.cpc || 0;
    campaignMetrics[campaignId].cpa += metric.cpa || 0;
    campaignMetrics[campaignId].roas += metric.roas || 0;
    campaignCounts[campaignId]++;
  });

  // Calculate averages for campaign KPIs
  Object.keys(campaignMetrics).forEach(campaignId => {
    const count = campaignCounts[campaignId];
    campaignMetrics[campaignId].ctr = count > 0 ? campaignMetrics[campaignId].ctr / count : 0;
    campaignMetrics[campaignId].cpc = count > 0 ? campaignMetrics[campaignId].cpc / count : 0;
    campaignMetrics[campaignId].cpa = count > 0 ? campaignMetrics[campaignId].cpa / count : 0;
    campaignMetrics[campaignId].roas = count > 0 ? campaignMetrics[campaignId].roas / count : 0;

    // Round to 2 decimal places
    campaignMetrics[campaignId].ctr = Math.round(campaignMetrics[campaignId].ctr * 100) / 100;
    campaignMetrics[campaignId].cpc = Math.round(campaignMetrics[campaignId].cpc * 100) / 100;
    campaignMetrics[campaignId].cpa = Math.round(campaignMetrics[campaignId].cpa * 100) / 100;
    campaignMetrics[campaignId].roas = Math.round(campaignMetrics[campaignId].roas * 100) / 100;

    // Add click types for this campaign
    const campaignClickTypes = {};
    if (campaignMetrics[campaignId].websiteClicks > 0) {
      campaignClickTypes[25] = campaignMetrics[campaignId].websiteClicks;
    }

    const knownClicks = campaignMetrics[campaignId].websiteClicks + campaignMetrics[campaignId].callClicks;
    const unknownClicks = campaignMetrics[campaignId].clicks - knownClicks;

    if (unknownClicks > 0) {
      campaignClickTypes["unknown_click_types"] = unknownClicks;
    }

    campaignMetrics[campaignId].clickTypes = campaignClickTypes;
  });

  res.json({
    client: {
      clientId: client._id,
      clientName: client.clientName,
      googleAdsCustomerId: client.google_ads_customer_id,
      googleAdsAccountName: client.google_ads_account_name,
      billing: client.billing
    },
    dateRange: {
      start_date: start_date || new Date().toISOString().split('T')[0],
      end_date: end_date || new Date().toISOString().split('T')[0]
    },
    summary: {
      totalImpressions: totals.impressions,
      totalClicks: totals.clicks,
      totalCost: totals.cost,
      totalConversions: totals.conversions,
      totalCallClicks: totals.callClicks,
      totalWebsiteClicks: totals.websiteClicks,
      clickTypes,
      cpl: Math.round(cpl * 100) / 100,
      ctr: Math.round(avgKpis.ctr * 100) / 100,
      cpc: Math.round(avgKpis.cpc * 100) / 100,
      cpa: Math.round(avgKpis.cpa * 100) / 100,
      roas: Math.round(avgKpis.roas * 100) / 100
    },
    dailyMetrics: metrics.map(m => {
      // Calculate click types for this specific day
      const dayClickTypes = {};
      if (m.click_breakdown?.website_clicks > 0) {
        dayClickTypes[25] = m.click_breakdown.website_clicks; // Click type 25
      }

      const knownClicks = (m.click_breakdown?.website_clicks || 0) + (m.click_breakdown?.call_clicks || 0);
      const unknownClicks = m.clicks - knownClicks;

      if (unknownClicks > 0) {
        dayClickTypes["unknown_click_types"] = unknownClicks;
      }

      return {
        date: m.date,
        campaignId: m.campaign_id,
        campaignName: m.campaign_name,
        impressions: m.impressions,
        clicks: m.clicks,
        cost: m.cost,
        conversions: m.conversions,
        clickBreakdown: {
          website_clicks: m.click_breakdown?.website_clicks || 0,
          call_clicks: m.click_breakdown?.call_clicks || 0
        },
        clickTypes: dayClickTypes,
        ctr: m.ctr,
        cpc: m.cpc,
        cpa: m.cpa,
        roas: m.roas
      };
    }),
    campaignMetrics: Object.values(campaignMetrics),
    campaigns: campaigns
  });
  } catch (error) {
    console.error('Get client analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;