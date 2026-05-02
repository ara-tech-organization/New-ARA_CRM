import Lead from '../models/Lead.js';
import MetaInsights from '../models/MetaInsights.js';
import Client from '../models/Client.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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
 * @desc    Monthly Meta-only leads pivot grouped by client, sourced from MetaInsights
 *          (the local Meta-sync collection populated by the meta-scheduler cron).
 *          totalLeads = leads + messaging_conversations_started, level='campaign'
 *          to avoid double-counting adset/ad rows.
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
  // Range filter on the Date type — index-friendly, no string regex.
  const [yr, mo] = targetMonth.split('-').map(Number);
  const rangeStart = new Date(Date.UTC(yr, mo - 1, 1));
  const rangeEnd = new Date(Date.UTC(yr, mo, 1));

  // Requested month had no campaign rows? Return shell (months still useful for tabs).
  if (!months.includes(targetMonth) && requested) {
    const empty = { month: targetMonth, months, dates: [], clients: [] };
    monthlyMetaCache.set(cacheKey, { ts: Date.now(), data: empty });
    return res.status(200).json({ success: true, cached: false, data: empty });
  }

  // Run pivot aggregation + clients lookup in parallel — Cosmos $lookup is slow,
  // and the clients collection is small enough to join in JS.
  const [pivotRows, allClients] = await Promise.all([
    MetaInsights.aggregate([
      { $match: { level: 'campaign', date: { $gte: rangeStart, $lt: rangeEnd } } },
      {
        $group: {
          _id: {
            clientId: '$client_id',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          },
          metaLeads: {
            $sum: {
              $add: [
                { $ifNull: ['$leads', 0] },
                { $ifNull: ['$messaging_conversations_started', 0] },
              ],
            },
          },
        },
      },
    ]).allowDiskUse(true),
    Client.find({}, { clientName: 1 }).lean(),
  ]);

  const clientNameById = new Map(allClients.map(c => [String(c._id), c.clientName || '']));

  const dateSet = new Set();
  const clientMap = new Map();

  for (const row of pivotRows) {
    const rawCid = row._id.clientId;
    const cid = rawCid == null ? '' : String(rawCid);
    const dateStr = row._id.date;
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
    const v = row.metaLeads || 0;
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

