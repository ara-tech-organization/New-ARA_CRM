import mongoose from 'mongoose';
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

  // Sources:
  //   MetaInsights → spend / ad-side metrics per campaign per day.
  //   Lead        → actual CRM leads (what the ClientAdDetails page counts).
  //
  // MetaInsights.messaging_conversations_started counts ad clicks that
  // opened a chat, not leads that actually landed in the CRM. That
  // metric can diverge from the CRM significantly (e.g. 3 conversations
  // started but 0 WhatsApp leads reached us). ClientAdDetails already
  // overrides its counts with CRM Lead records; this endpoint now does
  // the same per (clientId, date) so both views agree.
  const [yr1, mo1, d1] = from.split('-').map(Number);
  const [yr2, mo2, d2] = to.split('-').map(Number);
  const rangeStart = new Date(Date.UTC(yr1, mo1 - 1, d1));
  const rangeEnd = new Date(Date.UTC(yr2, mo2 - 1, d2 + 1)); // exclusive upper bound

  // Business day is IST — leads store meta_created_time in UTC. Shift
  // the query window by IST offset when filtering Lead docs, and add
  // the same offset when bucketing by date, so a lead submitted at
  // 23:30 IST lands in that IST day, not the next UTC day.
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const leadRangeStart = new Date(rangeStart.getTime() - IST_MS);
  const leadRangeEnd = new Date(rangeEnd.getTime() - IST_MS);

  const objectIdClient = clientId && /^[0-9a-fA-F]{24}$/.test(clientId)
    ? new mongoose.Types.ObjectId(clientId)
    : null;

  const leadDateFilter = {
    $or: [
      { meta_created_time: { $gte: leadRangeStart, $lt: leadRangeEnd } },
      { meta_created_time: null, createdAt: { $gte: leadRangeStart, $lt: leadRangeEnd } },
    ],
  };

  const [pivotRows, crmRows, allClients] = await Promise.all([
    MetaInsights.aggregate([
      {
        $match: {
          level: 'campaign',
          date: { $gte: rangeStart, $lt: rangeEnd },
          ...(objectIdClient ? { client_id: objectIdClient } : {}),
        },
      },
      {
        $group: {
          _id: {
            clientId: '$client_id',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          },
          metaForm: { $sum: { $ifNull: ['$leads', 0] } },
          metaWhatsapp: { $sum: { $ifNull: ['$messaging_conversations_started', 0] } },
          metaCalls: { $sum: { $ifNull: ['$actions.click_to_call_native_call_placed', 0] } },
          metaFund: { $sum: { $ifNull: ['$spend', 0] } },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]).allowDiskUse(true),
    Lead.aggregate([
      {
        $match: {
          // MUST match ClientAdDetails' Lead query (metaController's
          // leads_in_range) — restrict to Meta-source leads, otherwise
          // any manual "other" / Google leads flagged with
          // platform='whatsapp' inflate the count and this endpoint
          // disagrees with the client-ads page again.
          source: 'meta',
          ...leadDateFilter,
          ...(objectIdClient ? { client: objectIdClient } : {}),
        },
      },
      {
        $group: {
          _id: {
            clientId: '$client',
            // Bucket by IST calendar date, not UTC.
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: {
                  $add: [
                    { $ifNull: ['$meta_created_time', '$createdAt'] },
                    IST_MS,
                  ],
                },
              },
            },
          },
          crmForm: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$platform', ''] } }, 'whatsapp'] },
                0,
                1,
              ],
            },
          },
          crmWhatsapp: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$platform', ''] } }, 'whatsapp'] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]).allowDiskUse(true),
    Client.find({}, { clientName: 1 }).lean(),
  ]);

  const clientNameById = new Map(allClients.map(c => [String(c._id), c.clientName || '']));

  // Lookup for the CRM-based overrides. Key is `${clientId}|${date}`
  // so per-day per-client counts can be applied straight in the map
  // step below. When a key is absent (no CRM leads for that day) we
  // fall back to MetaInsights values, matching ClientAdDetails.
  const crmByKey = new Map();
  crmRows.forEach((r) => {
    const cid = r._id.clientId == null ? '' : String(r._id.clientId);
    crmByKey.set(`${cid}|${r._id.date}`, {
      form: r.crmForm || 0,
      whatsapp: r.crmWhatsapp || 0,
    });
  });

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
      _id: { clientId: r._id.clientId, date: r._id.date },
      clientName: clientNameById.get(String(r._id.clientId)) || '',
      metaForm: r.metaForm || 0,
      metaWhatsapp: r.metaWhatsapp || 0,
      metaCalls: r.metaCalls || 0,
      metaFund: r.metaFund || 0,
      googleCall: 0,
      googleWebsite: 0,
      googleFund: 0,
    }))
    .filter(r => r.clientName && r.clientName.trim() !== '')
    .sort((a, b) => {
      const n = (a.clientName || '').localeCompare(b.clientName || '');
      if (n !== 0) return n;
      return (a._id.date || '').localeCompare(b._id.date || '');
    });

  const totals = {
    metaForm: 0, metaWhatsapp: 0, metaCalls: 0, metaFund: 0, metaTotalLeads: 0,
    googleCall: 0, googleWebsite: 0, googleFund: 0, googleTotalLeads: 0,
    totalLeads: 0, totalSpend: 0, entryCount: 0,
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const entries = rows.map(r => {
    const cid = r._id.clientId == null ? '' : String(r._id.clientId);
    const date = r._id.date;
    // CRM Lead counts are authoritative when present. If CRM has ANY
    // leads for this (client, date), use its bucketed counts for both
    // form + WhatsApp. Otherwise fall back to MetaInsights so days
    // where the CRM hasn't ingested yet aren't silently zeroed out.
    const crm = crmByKey.get(`${cid}|${date}`);
    const metaForm = crm ? crm.form : (r.metaForm || 0);
    const metaWhatsapp = crm ? crm.whatsapp : (r.metaWhatsapp || 0);
    const metaCalls = r.metaCalls || 0;
    const metaFund = round2(r.metaFund || 0);
    const googleCall = r.googleCall || 0;
    const googleWebsite = r.googleWebsite || 0;
    const googleFund = round2(r.googleFund || 0);
    const metaTotalLeads = metaForm + metaWhatsapp;
    const googleTotalLeads = googleCall + googleWebsite;
    const totalLeads = metaTotalLeads + googleTotalLeads;
    const totalSpend = round2(metaFund + googleFund);
    const metaCPL = metaTotalLeads > 0 ? Math.round(metaFund / metaTotalLeads) : 0;
    const googleCPL = googleTotalLeads > 0 ? Math.round(googleFund / googleTotalLeads) : 0;

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

    return {
      clientId: cid,
      clientName: r.clientName || '',
      date,
      metaForm,
      metaWhatsapp,
      metaCalls,
      metaFund,
      metaCPL,
      metaTotalLeads,
      googleCall,
      googleWebsite,
      googleFund,
      googleCPL,
      googleTotalLeads,
      totalLeads,
      totalSpend,
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

