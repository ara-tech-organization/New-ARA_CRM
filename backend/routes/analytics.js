import express from 'express';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Metric from '../models/Metric.js';
import Campaign from '../models/Campaign.js';
import Keyword from '../models/Keyword.js';
import BillingTransaction from '../models/BillingTransaction.js';
import syncService from '../sync/syncService.js';
import { protectAdminOrClient } from '../middleware/auth.js';

// Used by BOTH the admin Ads dashboard and the client portal — gate
// behind the dual-purpose auth middleware so a JWT (agency or portal)
// is required. Per-route handlers should also enforce tenant ownership
// (the portal token's clientId must match the URL's :clientId) — see
// the assertion block below in /client/:clientId.

// Simple in-memory cache with TTL
const cache = new Map();

function getCacheKey(endpoint, params = {}) {
  return `${endpoint}_${JSON.stringify(params)}`;
}

function getCachedData(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < 5 * 60 * 1000) { // 5 minutes TTL
    return entry.data;
  }
  cache.delete(key); // Remove expired entry
  return null;
}

function setCachedData(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

const router = express.Router();

// Every route under here requires a valid agency or portal token.
router.use(protectAdminOrClient);

// GET /api/analytics/clients - List all clients with overview data
router.get('/clients', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const cacheKey = getCacheKey('clients', { start_date, end_date });

    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
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

    // Data freshness is maintained by the background sync scheduler
    // (see backend/sync/scheduler.js) — the request no longer blocks on
    // Google Ads API calls.

  // Get all clients with Google Ads enabled
  const clients = await Client.find({ google_ads_enabled: true })
    .select('clientName google_ads_customer_id google_ads_account_name billing')
    .sort({ clientName: 1 });

  const clientOverviews = [];

  for (const client of clients) {
    // Get total metrics for the client with date filtering
    const metrics = await Metric.aggregate([
      { $match: { client_id: client._id, ...dateFilter } },
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
      { $match: { client_id: client._id, ...dateFilter } },
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
      totalClicks: metricData.totalClicks,
      clickTypes,
      totalImpressions: metricData.totalImpressions,
      totalCost: metricData.totalCost,
      totalConversions: metricData.totalConversions,
      cpl: Math.round(cpl * 100) / 100, // Round to 2 decimal places
      ctr: metricData.totalImpressions > 0 ? (metricData.totalClicks / metricData.totalImpressions) * 100 : 0,
      cpc: metricData.totalClicks > 0 ? metricData.totalCost / metricData.totalClicks : 0
    });
  }

  const responseData = {
    count: clientOverviews.length,
    clients: clientOverviews
  };

  // Cache the response
  setCachedData(cacheKey, responseData);

  res.json(responseData);
  } catch (error) {
    console.error('Get analytics clients error:', error);

    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/client/:clientId - Detailed reports for single client with date filters
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    // Portal tokens MUST be asking about their own client — anything
    // else is an IDOR attempt and gets a 403. Agency tokens pass.
    if (req.clientId && String(req.clientId) !== String(clientId)) {
      return res.status(403).json({ error: 'Portal token cannot access another client' });
    }
    const { start_date, end_date } = req.query;
    const cacheKey = getCacheKey('client', { clientId, start_date, end_date });

    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Validate client exists and has Google Ads enabled
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    if (!client.google_ads_enabled || !client.google_ads_customer_id) {
      return res.status(400).json({ error: 'Client does not have Google Ads enabled' });
    }

    // Data freshness is maintained by the background sync scheduler.
    // Exception: if this client has never been synced (no metrics rows yet)
    // we do a one-time blocking sync so freshly-linked clients aren't stuck
    // showing empty data until the next scheduled tick.
    const hasAnyMetrics = await Metric.exists({ client_id: client._id });
    if (!hasAnyMetrics) {
      await syncService.manualSync(clientId);
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

  // Group metrics by campaign — sum raw numbers, then derive KPIs from totals
  // (more accurate than averaging per-day KPIs).
  const campaignMetrics = {};
  const campaignISCounts = {}; // days where impression-share data was present
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
        // Impression-share sums (averaged at the end)
        _is_sum: 0,
        _rank_lost_sum: 0,
        _budget_lost_top_sum: 0
      };
      campaignISCounts[campaignId] = 0;
    }
    campaignMetrics[campaignId].impressions += metric.impressions || 0;
    campaignMetrics[campaignId].clicks += metric.clicks || 0;
    campaignMetrics[campaignId].cost += metric.cost || 0;
    campaignMetrics[campaignId].conversions += metric.conversions || 0;
    campaignMetrics[campaignId].callClicks += metric.click_breakdown?.call_clicks || 0;
    campaignMetrics[campaignId].websiteClicks += metric.click_breakdown?.website_clicks || 0;

    // Only count impression-share on days it actually had data (>0)
    if ((metric.search_impression_share || 0) > 0 ||
        (metric.search_rank_lost_impression_share || 0) > 0 ||
        (metric.search_budget_lost_top_impression_share || 0) > 0) {
      campaignMetrics[campaignId]._is_sum += metric.search_impression_share || 0;
      campaignMetrics[campaignId]._rank_lost_sum += metric.search_rank_lost_impression_share || 0;
      campaignMetrics[campaignId]._budget_lost_top_sum += metric.search_budget_lost_top_impression_share || 0;
      campaignISCounts[campaignId]++;
    }
  });

  // Derive KPIs from totals (more accurate than averaging daily rates)
  Object.keys(campaignMetrics).forEach(campaignId => {
    const c = campaignMetrics[campaignId];
    const isCount = campaignISCounts[campaignId] || 0;

    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const cpc = c.clicks > 0 ? c.cost / c.clicks : 0;
    const cpa = c.conversions > 0 ? c.cost / c.conversions : 0;
    const convRate = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;
    const roas = c.cost > 0 ? (c.conversions * 100) / c.cost : 0;

    c.ctr = Math.round(ctr * 100) / 100;
    c.cpc = Math.round(cpc * 100) / 100;
    c.cpa = Math.round(cpa * 100) / 100;
    c.conversion_rate = Math.round(convRate * 100) / 100;
    c.roas = Math.round(roas * 100) / 100;
    c.cost_per_conversion = c.cpa; // alias for the UI label "Cost/Conversions"

    // Impression-share: average across days that reported it
    c.search_impression_share = isCount > 0
      ? Math.round((c._is_sum / isCount) * 100) / 100
      : 0;
    c.search_rank_lost_impression_share = isCount > 0
      ? Math.round((c._rank_lost_sum / isCount) * 100) / 100
      : 0;
    c.search_budget_lost_top_impression_share = isCount > 0
      ? Math.round((c._budget_lost_top_sum / isCount) * 100) / 100
      : 0;
    delete c._is_sum;
    delete c._rank_lost_sum;
    delete c._budget_lost_top_sum;

    // Click-type breakdown (unchanged)
    const campaignClickTypes = {};
    if (c.websiteClicks > 0) {
      campaignClickTypes[25] = c.websiteClicks;
    }
    const knownClicks = c.websiteClicks + c.callClicks;
    const unknownClicks = c.clicks - knownClicks;
    if (unknownClicks > 0) {
      campaignClickTypes["unknown_click_types"] = unknownClicks;
    }
    c.clickTypes = campaignClickTypes;
  });

  // Billing ledger — load fresh client (balance may have changed during sync)
  const freshClient = await Client.findById(clientId).select('billing onboardDate');
  const billingLedger = await buildBillingLedger(
    clientId,
    start_date,
    end_date,
    freshClient?.billing,
    freshClient?.onboardDate
  );

  const responseData = {
    client: {
      clientId: client._id,
      clientName: client.clientName,
      googleAdsCustomerId: client.google_ads_customer_id,
      googleAdsAccountName: client.google_ads_account_name,
      billing: billingLedger
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
    campaigns: campaigns,
    keywords: await buildKeywordAggregates(clientId, dateFilter, req.query.keywords_limit)
  };

  // Attach per-campaign top keywords
  const perCampaignLimit = (() => {
    const p = parseInt(req.query.campaign_keywords_limit, 10);
    return Number.isFinite(p) && p >= 0 ? p : 20;
  })();
  const campaignKeywordMap = await buildCampaignKeywordAggregates(
    clientId,
    dateFilter,
    perCampaignLimit
  );
  responseData.campaignMetrics.forEach(c => {
    c.top_keywords = campaignKeywordMap[c.campaignId] || [];
  });

  // Cache the response
  setCachedData(cacheKey, responseData);

  res.json(responseData);
  } catch (error) {
    console.error('Get client analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Aggregate keyword-level metrics for a client within the requested date range.
 * Returns the TOP N keywords (default 20) by cost desc within the range.
 *
 * Pass `?keywords_limit=100` to change the cap, or `?keywords_limit=0` for all.
 */
async function buildKeywordAggregates(clientId, dateFilter, limitParam) {
  const match = { client_id: new mongoose.Types.ObjectId(clientId) };
  if (dateFilter.date) match.date = dateFilter.date;

  let limit = 20;
  if (limitParam !== undefined) {
    const parsed = parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed >= 0) limit = parsed;
  }

  const rows = await Keyword.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          campaign_id: '$campaign_id',
          criterion_id: '$criterion_id'
        },
        keyword_text: { $last: '$keyword_text' },
        match_type: { $last: '$match_type' },
        status: { $last: '$status' },
        campaign_id: { $last: '$campaign_id' },
        campaign_name: { $last: '$campaign_name' },
        ad_group_id: { $last: '$ad_group_id' },
        ad_group_name: { $last: '$ad_group_name' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        cost: { $sum: '$cost' },
        conversions: { $sum: '$conversions' }
      }
    },
    {
      $project: {
        _id: 0,
        campaign_id: 1,
        campaign_name: 1,
        ad_group_id: 1,
        ad_group_name: 1,
        criterion_id: '$_id.criterion_id',
        keyword_text: 1,
        match_type: 1,
        status: 1,
        impressions: 1,
        clicks: 1,
        cost: { $round: ['$cost', 2] },
        conversions: 1,
        ctr: {
          $cond: [
            { $gt: ['$impressions', 0] },
            { $round: [{ $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] }, 2] },
            0
          ]
        },
        cpc: {
          $cond: [
            { $gt: ['$clicks', 0] },
            { $round: [{ $divide: ['$cost', '$clicks'] }, 2] },
            0
          ]
        },
        cpa: {
          $cond: [
            { $gt: ['$conversions', 0] },
            { $round: [{ $divide: ['$cost', '$conversions'] }, 2] },
            0
          ]
        }
      }
    },
    { $sort: { cost: -1, clicks: -1 } },
    ...(limit > 0 ? [{ $limit: limit }] : [])
  ]);

  return rows;
}

/**
 * Per-campaign top-N keywords (default 20 per campaign).
 * Returns a map of campaign_id -> keyword[] sorted by cost desc.
 *
 * Pass `?campaign_keywords_limit=N` to change the cap, or `=0` for all.
 */
async function buildCampaignKeywordAggregates(clientId, dateFilter, limit = 20) {
  const match = { client_id: new mongoose.Types.ObjectId(clientId) };
  if (dateFilter.date) match.date = dateFilter.date;

  const rows = await Keyword.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          campaign_id: '$campaign_id',
          criterion_id: '$criterion_id'
        },
        keyword_text: { $last: '$keyword_text' },
        match_type: { $last: '$match_type' },
        status: { $last: '$status' },
        campaign_id: { $last: '$campaign_id' },
        campaign_name: { $last: '$campaign_name' },
        ad_group_id: { $last: '$ad_group_id' },
        ad_group_name: { $last: '$ad_group_name' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        cost: { $sum: '$cost' },
        conversions: { $sum: '$conversions' }
      }
    },
    { $sort: { cost: -1, clicks: -1 } },
    {
      $group: {
        _id: '$campaign_id',
        keywords: {
          $push: {
            criterion_id: '$_id.criterion_id',
            ad_group_id: '$ad_group_id',
            ad_group_name: '$ad_group_name',
            keyword_text: '$keyword_text',
            match_type: '$match_type',
            status: '$status',
            impressions: '$impressions',
            clicks: '$clicks',
            cost: '$cost',
            conversions: '$conversions'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        campaign_id: '$_id',
        keywords: limit > 0 ? { $slice: ['$keywords', limit] } : '$keywords'
      }
    }
  ]);

  // Convert to a map keyed by campaign_id, and compute per-keyword KPIs.
  const map = {};
  for (const row of rows) {
    map[row.campaign_id] = row.keywords.map(k => {
      const impressions = k.impressions || 0;
      const clicks = k.clicks || 0;
      const cost = k.cost || 0;
      const conversions = k.conversions || 0;
      return {
        criterion_id: k.criterion_id,
        ad_group_id: k.ad_group_id,
        ad_group_name: k.ad_group_name,
        keyword_text: k.keyword_text,
        match_type: k.match_type,
        status: k.status,
        impressions,
        clicks,
        cost: Math.round(cost * 100) / 100,
        conversions,
        ctr: impressions > 0
          ? Math.round((clicks / impressions) * 10000) / 100
          : 0,
        cpc: clicks > 0
          ? Math.round((cost / clicks) * 100) / 100
          : 0,
        cpa: conversions > 0
          ? Math.round((cost / conversions) * 100) / 100
          : 0,
        conversion_rate: clicks > 0
          ? Math.round((conversions / clicks) * 10000) / 100
          : 0
      };
    });
  }
  return map;
}

/**
 * Build the billing section of the analytics response.
 * - Summary fields come from the cached `client.billing` doc.
 * - `transactions`, `balance_timeline`, `spend_by_day`, `credits_by_day`
 *   are derived from the BillingTransaction ledger, filtered to the
 *   requested date range (or today if none given).
 */
async function buildBillingLedger(clientId, start_date, end_date, billingCache, onboardDate) {
  const clientObjectId = new mongoose.Types.ObjectId(clientId);

  // Live total_spend = sum of Google Ads cost since onboardDate (not ledger-derived).
  // This makes the number meaningful even right after a reset, when the ledger
  // has no debits yet (existing metrics were marked as "already in opening balance").
  const spendMatch = { client_id: clientObjectId };
  if (onboardDate) {
    const onboardStart = new Date(onboardDate);
    onboardStart.setUTCHours(0, 0, 0, 0);
    spendMatch.date = { $gte: onboardStart };
  }
  const spendAgg = await Metric.aggregate([
    { $match: spendMatch },
    { $group: { _id: null, total: { $sum: '$cost' } } }
  ]);
  const liveTotalSpend = Math.round((spendAgg[0]?.total || 0) * 100) / 100;

  // Live total_added_funds = sum(ledger credits + positive adjustments) since onboardDate.
  // Covers manual payments AND reconcile/reset opening balances.
  const addedMatch = { client_id: clientObjectId };
  if (onboardDate) {
    const onboardStart = new Date(onboardDate);
    onboardStart.setUTCHours(0, 0, 0, 0);
    addedMatch.occurred_at = { $gte: onboardStart };
  }
  const addedAgg = await BillingTransaction.aggregate([
    { $match: addedMatch },
    {
      $group: {
        _id: null,
        credits: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
        positiveAdjustments: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$type', 'adjustment'] },
                  { $gt: ['$balance_after', { $subtract: ['$balance_after', '$amount'] }] }
                ]
              },
              '$amount',
              0
            ]
          }
        }
      }
    }
  ]);
  const liveTotalAddedFunds = Math.round(
    ((addedAgg[0]?.credits || 0) + (addedAgg[0]?.positiveAdjustments || 0)) * 100
  ) / 100;

  let rangeStart;
  let rangeEnd;
  if (start_date && end_date) {
    rangeStart = new Date(start_date);
    rangeEnd = new Date(end_date + 'T23:59:59.999Z');
  } else {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    rangeStart = new Date(todayStr);
    rangeEnd = new Date(todayStr + 'T23:59:59.999Z');
  }

  const transactions = await BillingTransaction.find({
    client_id: clientObjectId,
    occurred_at: { $gte: rangeStart, $lte: rangeEnd }
  })
    .sort({ occurred_at: -1 })
    .limit(500)
    .lean();

  const dailyAgg = await BillingTransaction.aggregate([
    {
      $match: {
        client_id: clientObjectId,
        occurred_at: { $gte: rangeStart, $lte: rangeEnd }
      }
    },
    { $sort: { occurred_at: 1 } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurred_at' } },
        balance_eod: { $last: '$balance_after' },
        debit_total: {
          $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] }
        },
        credit_total: {
          $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const balance_timeline = dailyAgg.map(d => ({
    date: d._id,
    balance: Math.round(d.balance_eod * 100) / 100
  }));
  const spend_by_day = dailyAgg
    .filter(d => d.debit_total > 0)
    .map(d => ({ date: d._id, amount: Math.round(d.debit_total * 100) / 100 }));
  const credits_by_day = dailyAgg
    .filter(d => d.credit_total > 0)
    .map(d => ({ date: d._id, amount: Math.round(d.credit_total * 100) / 100 }));

  // Totals within the selected range
  const rangeCredits = credits_by_day.reduce((sum, d) => sum + d.amount, 0);
  const rangeDebits = spend_by_day.reduce((sum, d) => sum + d.amount, 0);

  return {
    billing_type: billingCache?.billing_type || 'monthly',
    low_balance_threshold: billingCache?.low_balance_threshold ?? 100,
    available_balance: Math.round((billingCache?.available_balance || 0) * 100) / 100,
    total_spend: liveTotalSpend,
    total_added_funds: liveTotalAddedFunds,
    range: {
      start_date: rangeStart.toISOString().split('T')[0],
      end_date: rangeEnd.toISOString().split('T')[0],
      credits_in_range: Math.round(rangeCredits * 100) / 100,
      debits_in_range: Math.round(rangeDebits * 100) / 100,
      net_change_in_range: Math.round((rangeCredits - rangeDebits) * 100) / 100
    },
    transactions: transactions.map(tx => ({
      id: tx._id,
      type: tx.type,
      amount: tx.amount,
      balance_after: tx.balance_after,
      occurred_at: tx.occurred_at,
      source: tx.source,
      description: tx.description,
      reference: tx.reference || {}
    })),
    balance_timeline,
    spend_by_day,
    credits_by_day
  };
}

export default router;