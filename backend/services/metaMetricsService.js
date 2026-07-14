// Centralized Meta metrics.
//
// Every page that reports Meta leads/spend reads from here. Before this
// module existed, each endpoint ran its own aggregation and its own
// CRM-override rules, so the same client on the same day showed 10 on
// client-ads, 12 on the dashboard and 14 on the monthly grid.
//
// The reported numbers come from MetaInsights — never from CRM Lead records:
//
//   formLeads     Meta lead-form submissions (`leads`).
//   whatsappLeads Click-to-WhatsApp conversations started
//                 (`messaging_conversations_started`). This IS the conversion
//                 metric for a WhatsApp campaign. Meta fires no lead webhook
//                 for a conversation, so a WhatsApp lead can only enter the
//                 CRM if someone types it in by hand — which makes Meta the
//                 only complete source for it.
//   totalLeads    formLeads + whatsappLeads.
//
// CRM Lead records still matter, but as the list your team works, not as the
// reporting ledger: they undercount whenever ingestion breaks (a dropped
// webhook silently becomes a missing lead). crmLeadsBy* below exposes that
// shortfall so the UI can surface it instead of quietly reporting a smaller
// number.

import mongoose from 'mongoose';
import MetaInsights from '../models/MetaInsights.js';
import Lead from '../models/Lead.js';

const INSIGHTS_LEVEL = 'campaign'; // adset/ad rows would double-count

export const IST_MS = 5.5 * 60 * 60 * 1000;

export const round2 = (n) =>
  Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export const toObjectId = (id) =>
  id && /^[0-9a-fA-F]{24}$/.test(String(id))
    ? new mongoose.Types.ObjectId(String(id))
    : null;

// The IST calendar day for a given instant. The frontend used to derive "today"
// from toISOString(), which is UTC — so between 00:00 and 05:30 IST it asked for
// yesterday.
export const istToday = (now = new Date()) =>
  new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);

// MetaInsights.date is the ad account's own calendar day (Meta returns
// date_start as "YYYY-MM-DD" for an IST-timezone account) stored at UTC
// midnight — see metaSyncService.upsertInsights. An IST business day therefore
// maps 1:1 onto a UTC-midnight stamp and must NOT be shifted.
export const insightsRange = (from, to) => {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y1, m1 - 1, d1)),
    end: new Date(Date.UTC(y2, m2 - 1, d2 + 1)), // exclusive
  };
};

// Lead docs store true UTC instants, so the window shifts back by the IST
// offset: a lead submitted 23:30 IST belongs to that IST day, not the next
// UTC one.
export const leadRange = (from, to) => {
  const { start, end } = insightsRange(from, to);
  return {
    start: new Date(start.getTime() - IST_MS),
    end: new Date(end.getTime() - IST_MS),
  };
};

const leadDateFilter = (from, to) => {
  const { start, end } = leadRange(from, to);
  return {
    $or: [
      { meta_created_time: { $gte: start, $lt: end } },
      { meta_created_time: null, createdAt: { $gte: start, $lt: end } },
    ],
  };
};

// The canonical definitions. Edit here and every page moves together.
const METRIC_ACCUMULATORS = {
  spend: { $sum: { $ifNull: ['$spend', 0] } },
  impressions: { $sum: { $ifNull: ['$impressions', 0] } },
  reach: { $sum: { $ifNull: ['$reach', 0] } },
  clicks: { $sum: { $ifNull: ['$clicks', 0] } },
  inline_link_clicks: { $sum: { $ifNull: ['$inline_link_clicks', 0] } },
  conversions: { $sum: { $ifNull: ['$conversions', 0] } },
  video_thruplay: { $sum: { $ifNull: ['$video_thruplay', 0] } },
  formLeads: { $sum: { $ifNull: ['$leads', 0] } },
  whatsappLeads: { $sum: { $ifNull: ['$messaging_conversations_started', 0] } },
  calls: { $sum: { $ifNull: ['$actions.click_to_call_native_call_placed', 0] } },
};

const matchStage = ({ clientIds, from, to }) => {
  const { start, end } = insightsRange(from, to);
  const stage = { level: INSIGHTS_LEVEL, date: { $gte: start, $lt: end } };
  if (clientIds) {
    stage.client_id = Array.isArray(clientIds) ? { $in: clientIds } : clientIds;
  }
  return stage;
};

// Derived rates live here too, so CPL/CTR/CPC can't drift between pages
// either.
export const finalize = (r = {}) => {
  const formLeads = r.formLeads || 0;
  const whatsappLeads = r.whatsappLeads || 0;
  const totalLeads = formLeads + whatsappLeads;
  const calls = r.calls || 0;
  const spend = round2(r.spend);
  const impressions = r.impressions || 0;
  const reach = r.reach || 0;
  const clicks = r.clicks || 0;
  const conversions = totalLeads + calls;

  return {
    spend,
    impressions,
    reach,
    clicks,
    inline_link_clicks: r.inline_link_clicks || 0,
    video_thruplay: r.video_thruplay || 0,
    formLeads,
    whatsappLeads,
    totalLeads,
    calls,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
    cpl: totalLeads > 0 ? round2(spend / totalLeads) : 0,
    avg_cost_per_conv: conversions > 0 ? round2(spend / conversions) : 0,
    frequency: reach > 0 ? round2(impressions / reach) : 0,
  };
};

export const metricsTotals = async ({ clientIds, from, to }) => {
  const rows = await MetaInsights.aggregate([
    { $match: matchStage({ clientIds, from, to }) },
    { $group: { _id: null, ...METRIC_ACCUMULATORS } },
  ]);
  return finalize(rows[0]);
};

export const metricsByClient = async ({ clientIds, from, to }) => {
  const rows = await MetaInsights.aggregate([
    { $match: matchStage({ clientIds, from, to }) },
    { $group: { _id: '$client_id', ...METRIC_ACCUMULATORS } },
  ]);
  return new Map(rows.map((r) => [String(r._id), finalize(r)]));
};

export const metricsByDay = async ({ clientIds, from, to }) => {
  const rows = await MetaInsights.aggregate([
    { $match: matchStage({ clientIds, from, to }) },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        ...METRIC_ACCUMULATORS,
      },
    },
    { $sort: { _id: 1 } },
  ]).allowDiskUse(true);
  return rows.map((r) => ({ date: r._id, ...finalize(r) }));
};

export const metricsByClientDay = async ({ clientIds, from, to }) => {
  const rows = await MetaInsights.aggregate([
    { $match: matchStage({ clientIds, from, to }) },
    {
      $group: {
        _id: {
          clientId: '$client_id',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        },
        ...METRIC_ACCUMULATORS,
      },
    },
    { $sort: { '_id.date': 1 } },
  ]).allowDiskUse(true);
  return rows.map((r) => ({
    clientId: r._id.clientId == null ? '' : String(r._id.clientId),
    date: r._id.date,
    ...finalize(r),
  }));
};

// --- CRM ingestion gap ------------------------------------------------------
// Diagnostic only. Reported lead counts never come from here — this exists so
// the UI can say "Meta delivered 12, the CRM holds 10" instead of silently
// reporting 10 and losing two leads nobody will ever call.

const CRM_LEAD_ACCUMULATORS = {
  crmFormLeads: {
    $sum: {
      $cond: [
        { $eq: [{ $toLower: { $ifNull: ['$platform', ''] } }, 'whatsapp'] },
        0,
        1,
      ],
    },
  },
  crmWhatsappLeads: {
    $sum: {
      $cond: [
        { $eq: [{ $toLower: { $ifNull: ['$platform', ''] } }, 'whatsapp'] },
        1,
        0,
      ],
    },
  },
};

const crmMatchStage = ({ clientIds, from, to }) => {
  // source:'meta' keeps manual Google/Justdial/walk-in rows out of the count.
  const stage = { source: 'meta', ...leadDateFilter(from, to) };
  if (clientIds) {
    stage.client = Array.isArray(clientIds) ? { $in: clientIds } : clientIds;
  }
  return stage;
};

export const crmLeadsByClient = async ({ clientIds, from, to }) => {
  const rows = await Lead.aggregate([
    { $match: crmMatchStage({ clientIds, from, to }) },
    { $group: { _id: '$client', ...CRM_LEAD_ACCUMULATORS } },
  ]);
  return new Map(
    rows.map((r) => [
      String(r._id),
      { crmFormLeads: r.crmFormLeads || 0, crmWhatsappLeads: r.crmWhatsappLeads || 0 },
    ])
  );
};

export const crmLeadsByClientDay = async ({ clientIds, from, to }) => {
  const rows = await Lead.aggregate([
    { $match: crmMatchStage({ clientIds, from, to }) },
    {
      $group: {
        _id: {
          clientId: '$client',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $add: [{ $ifNull: ['$meta_created_time', '$createdAt'] }, IST_MS],
              },
            },
          },
        },
        ...CRM_LEAD_ACCUMULATORS,
      },
    },
  ]).allowDiskUse(true);
  return new Map(
    rows.map((r) => [
      `${r._id.clientId == null ? '' : String(r._id.clientId)}|${r._id.date}`,
      { crmFormLeads: r.crmFormLeads || 0, crmWhatsappLeads: r.crmWhatsappLeads || 0 },
    ])
  );
};

// Attach the CRM shortfall to a finalized metrics object. `missingFormLeads`
// is the count Meta says it delivered that never became a CRM record.
export const withIngestionGap = (metrics, crm) => {
  const crmFormLeads = crm?.crmFormLeads || 0;
  return {
    ...metrics,
    crmFormLeads,
    crmWhatsappLeads: crm?.crmWhatsappLeads || 0,
    missingFormLeads: Math.max(0, (metrics.formLeads || 0) - crmFormLeads),
  };
};
