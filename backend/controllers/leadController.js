import mongoose from 'mongoose';
import Lead from '../models/Lead.js';
import MetaInsights from '../models/MetaInsights.js';
import Client from '../models/Client.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  metricsByClientDay,
  crmLeadsByClientDay,
  withIngestionGap,
  toObjectId,
  round2,
} from '../services/metaMetricsService.js';

const MAIN_API_URL = process.env.MAIN_API_URL || 'https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net';

// Fetch with timeout
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

/**
 * @desc    Get all leads
 * @route   GET /api/leads
 * @access  Private
 */
export const getLeads = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.date) filter.date = req.query.date;
  // Inclusive date-range filter — used by the Daily Lead Data page so it
  // can pull just the rows it needs instead of the full 10k-document
  // dump that the legacy non-filtered call returns.
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = filter.date || {};
    if (typeof filter.date === 'string') {
      // `date` was already set to an exact day; range params should not
      // also be present, but if they are we let the exact match win.
    } else {
      if (req.query.dateFrom) filter.date.$gte = req.query.dateFrom;
      if (req.query.dateTo) filter.date.$lte = req.query.dateTo;
    }
  }

  const leads = await Lead.find(filter)
    .populate('assignedTo', 'name email userID')
    .populate('client', 'name email company')
    .populate('createdBy', 'name email userID')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Lead.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: leads.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: leads,
  });
});

/**
 * @desc    Get single lead
 * @route   GET /api/leads/:id
 * @access  Private
 */
export const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate('assignedTo', 'name email userID')
    .populate('client', 'name email company')
    .populate('createdBy', 'name email userID');

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found',
    });
  }

  res.status(200).json({
    success: true,
    data: lead,
  });
});

/**
 * @desc    Create lead
 * @route   POST /api/leads
 * @access  Private
 */
export const createLead = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user._id;

  const lead = await Lead.create(req.body);

  res.status(201).json({
    success: true,
    data: lead,
  });
});

/**
 * @desc    Update lead
 * @route   PUT /api/leads/:id
 * @access  Private
 */
export const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found',
    });
  }

  res.status(200).json({
    success: true,
    data: lead,
  });
});

/**
 * @desc    Delete lead
 * @route   DELETE /api/leads/:id
 * @access  Private
 */
export const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found',
    });
  }

  await lead.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Lead deleted successfully',
  });
});

/**
 * @desc    Monthly Meta leads pivot grouped by client. Counts come from
 *          metaMetricsService, so a cell here always matches the same client's
 *          row on the daily table, the dashboard and client-ads.
 *          Returns: { month, months[], dates[], clients: [{clientId, clientName, daily:{date:count}, total}] }
 * @route   GET /api/leads/monthly-meta-by-client?month=YYYY-MM
 * @access  Private
 */
const monthlyMetaCache = new Map();
const MONTHLY_META_TTL = 60 * 1000;
// Months list rarely changes — cache it for 10 min so we don't rescan the full
// MetaInsights collection on every uncached month-tab click.
let monthsCache = { ts: 0, months: [] };
const MONTHS_CACHE_TTL = 10 * 60 * 1000;

const getCampaignMonths = async (force = false) => {
  if (!force && monthsCache.months.length > 0 && Date.now() - monthsCache.ts < MONTHS_CACHE_TTL) {
    return monthsCache.months;
  }
  const rows = await MetaInsights.aggregate([
    { $match: { level: 'campaign' } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } } } },
    { $sort: { _id: 1 } },
  ]).allowDiskUse(true);
  const months = rows.map(r => r._id).filter(Boolean);
  monthsCache = { ts: Date.now(), months };
  return months;
};

export const getMonthlyMetaByClient = asyncHandler(async (req, res) => {
  const { month, refresh } = req.query;
  const requested = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
  const cacheKey = requested || '__latest__';
  const cached = monthlyMetaCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.ts < MONTHLY_META_TTL) {
    return res.status(200).json({ success: true, cached: true, data: cached.data });
  }

  const months = await getCampaignMonths(!!refresh);
  if (months.length === 0) {
    const empty = { month: null, months: [], dates: [], clients: [] };
    monthlyMetaCache.set(cacheKey, { ts: Date.now(), data: empty });
    return res.status(200).json({ success: true, cached: false, data: empty });
  }

  const targetMonth = requested || months[months.length - 1];
  const [yr, mo] = targetMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
  const from = `${targetMonth}-01`;
  const to = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

  // Requested month had no campaign rows? Return shell (months still useful for tabs).
  if (!months.includes(targetMonth) && requested) {
    const empty = { month: targetMonth, months, dates: [], clients: [] };
    monthlyMetaCache.set(cacheKey, { ts: Date.now(), data: empty });
    return res.status(200).json({ success: true, cached: false, data: empty });
  }

  // Same shared definition as every other surface, so a cell here can no
  // longer disagree with the daily table or client-ads for the same day.
  const [pivotRows, allClients] = await Promise.all([
    metricsByClientDay({ from, to }),
    Client.find({}, { clientName: 1 }).lean(),
  ]);

  const clientNameById = new Map(allClients.map(c => [String(c._id), c.clientName || '']));

  const dateSet = new Set();
  const clientMap = new Map();

  for (const row of pivotRows) {
    const cid = row.clientId;
    const dateStr = row.date;
    if (!cid || !dateStr) continue;

    dateSet.add(dateStr);
    if (!clientMap.has(cid)) {
      clientMap.set(cid, {
        clientId: cid,
        clientName: clientNameById.get(cid) || '',
        daily: {},
        total: 0,
      });
    }
    const c = clientMap.get(cid);
    const v = row.totalLeads || 0;
    c.daily[dateStr] = (c.daily[dateStr] || 0) + v;
    c.total += v;
  }

  const clients = Array.from(clientMap.values())
    .filter(c => {
      const n = (c.clientName || '').trim().toLowerCase();
      return n && n !== 'unknown' && n !== 'unknown client';
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName));

  const data = {
    month: targetMonth,
    months,
    dates: Array.from(dateSet).sort(),
    clients,
  };

  monthlyMetaCache.set(cacheKey, { ts: Date.now(), data });
  monthlyMetaCache.set(targetMonth, { ts: Date.now(), data });
  res.status(200).json({ success: true, cached: false, data });
});

/**
 * @desc    Daily lead pivot per client across a date range. Source: Lead
 *          collection (legacy upstream sync — includes Meta + Google + manual
 *          entries). Sister endpoint to getMonthlyMetaByClient but row-shaped
 *          (one row per client × date) and inclusive of Google + spend fields.
 *          Returns: { from, to, clientId, entries: [...], dailyTotals: {...} }
 *          - 90-day max range to prevent runaway queries.
 *          - 60s in-memory cache keyed by from-to-clientId.
 * @route   GET /api/leads/daily-by-client?from=YYYY-MM-DD&to=YYYY-MM-DD[&clientId=...]
 * @access  Private
 */
const dailyByClientCache = new Map();
const DAILY_BY_CLIENT_TTL = 60 * 1000;
const DAILY_RANGE_MAX_DAYS = 90;

const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (from, to) => {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
};

export const getDailyByClient = asyncHandler(async (req, res) => {
  const { from, to, clientId, refresh } = req.query;

  if (!ymdRe.test(from || '') || !ymdRe.test(to || '')) {
    return res.status(400).json({
      success: false,
      message: 'from and to are required as YYYY-MM-DD',
    });
  }
  if (from > to) {
    return res.status(400).json({
      success: false,
      message: 'from must be on or before to',
    });
  }
  const span = daysBetween(from, to);
  if (span > DAILY_RANGE_MAX_DAYS) {
    return res.status(400).json({
      success: false,
      message: `Date range too wide (${span + 1} days). Max ${DAILY_RANGE_MAX_DAYS + 1} days.`,
    });
  }

  const cacheKey = `${from}|${to}|${clientId || 'all'}`;
  const cached = dailyByClientCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.ts < DAILY_BY_CLIENT_TTL) {
    return res.status(200).json({ success: true, cached: true, data: cached.data });
  }

  // Reported counts come from metaMetricsService, the single definition
  // shared with the dashboard, the monthly grid and client-ads. The CRM
  // lookup below is diagnostic only — it never changes a reported number,
  // it just lets the row flag leads Meta delivered that never reached us.
  const objectIdClient = toObjectId(clientId);
  const clientIds = objectIdClient || undefined;

  const [pivotRows, crmByKey, allClients] = await Promise.all([
    metricsByClientDay({ clientIds, from, to }),
    crmLeadsByClientDay({ clientIds, from, to }),
    Client.find({}, { clientName: 1 }).lean(),
  ]);

  const clientNameById = new Map(allClients.map(c => [String(c._id), c.clientName || '']));

  // Re-shape into the same row format the controller previously produced from
  // Lead. Sort by clientName + date so the table reads naturally.
  //
  // Orphan rows are dropped: if a MetaInsights record references a
  // client_id whose Client doc has been deleted (or whose name is
  // somehow empty), we skip it instead of rendering "Unknown Client".
  // Keeps the table clean even when the cascade missed some
  // historical insights data.
  const rows = pivotRows
    .map(r => ({
      ...r,
      clientName: clientNameById.get(r.clientId) || '',
    }))
    .filter(r => r.clientName && r.clientName.trim() !== '')
    .sort((a, b) => {
      const n = (a.clientName || '').localeCompare(b.clientName || '');
      if (n !== 0) return n;
      return (a.date || '').localeCompare(b.date || '');
    });

  const totals = {
    metaForm: 0, metaWhatsapp: 0, metaCalls: 0, metaFund: 0, metaTotalLeads: 0,
    googleCall: 0, googleWebsite: 0, googleFund: 0, googleTotalLeads: 0,
    totalLeads: 0, totalSpend: 0, entryCount: 0,
    crmFormLeads: 0, missingFormLeads: 0,
  };

  const entries = rows.map(r => {
    const { clientId: cid, date } = r;
    const m = withIngestionGap(r, crmByKey.get(`${cid}|${date}`));

    const metaForm = m.formLeads;
    const metaWhatsapp = m.whatsappLeads;
    const metaCalls = m.calls;
    const metaFund = m.spend;
    const metaTotalLeads = m.totalLeads;
    const googleCall = 0;
    const googleWebsite = 0;
    const googleFund = 0;
    const googleTotalLeads = 0;
    const totalLeads = metaTotalLeads;
    const totalSpend = round2(metaFund + googleFund);
    const googleCPL = 0;

    totals.metaForm += metaForm;
    totals.metaWhatsapp += metaWhatsapp;
    totals.metaCalls += metaCalls;
    totals.metaFund += metaFund;
    totals.metaTotalLeads += metaTotalLeads;
    totals.googleCall += googleCall;
    totals.googleWebsite += googleWebsite;
    totals.googleFund += googleFund;
    totals.googleTotalLeads += googleTotalLeads;
    totals.totalLeads += totalLeads;
    totals.totalSpend += totalSpend;
    totals.entryCount += 1;
    totals.crmFormLeads += m.crmFormLeads;
    totals.missingFormLeads += m.missingFormLeads;

    return {
      clientId: cid,
      clientName: r.clientName || '',
      date,
      metaForm,
      metaWhatsapp,
      metaCalls,
      metaFund,
      metaCPL: m.cpl,
      metaTotalLeads,
      googleCall,
      googleWebsite,
      googleFund,
      googleCPL,
      googleTotalLeads,
      totalLeads,
      totalSpend,
      // Diagnostic: Meta delivered `metaForm` form leads, the CRM only holds
      // `crmFormLeads` of them. Non-zero `missingFormLeads` means ingestion
      // dropped leads nobody can follow up on.
      crmFormLeads: m.crmFormLeads,
      missingFormLeads: m.missingFormLeads,
    };
  });

  // Round currency totals at the end too, so accumulated float drift doesn't show.
  totals.metaFund = round2(totals.metaFund);
  totals.googleFund = round2(totals.googleFund);
  totals.totalSpend = round2(totals.totalSpend);

  const data = {
    from,
    to,
    clientId: clientId || 'all',
    entries,
    dailyTotals: totals,
  };

  dailyByClientCache.set(cacheKey, { ts: Date.now(), data });
  res.status(200).json({ success: true, cached: false, data });
});

/**
 * @desc    Get lead stats
 * @route   GET /api/leads/stats/summary
 * @access  Private
 */
export const getLeadStats = asyncHandler(async (req, res) => {
  const stats = await Lead.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
      },
    },
  ]);

  const sourceStats = await Lead.aggregate([
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
      },
    },
  ]);

  const totalLeads = await Lead.countDocuments();
  const totalValue = await Lead.aggregate([
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalLeads,
      totalValue: totalValue[0]?.total || 0,
      byStatus: stats,
      bySource: sourceStats,
    },
  });
});

