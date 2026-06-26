// Thin HTTP layer on top of metaSyncService. Phase 3 exposes only the
// read-only sync admin surface; webhook + config endpoints land in later
// phases.

import mongoose from 'mongoose';
import Client from '../models/Client.js';
import MetaSyncRun from '../models/MetaSyncRun.js';
import MetaLeadForm from '../models/MetaLeadForm.js';
import MetaLeadRaw from '../models/MetaLeadRaw.js';
import MetaWebhookRetry from '../models/MetaWebhookRetry.js';
import MetaCampaign from '../models/MetaCampaign.js';
import MetaAdSet from '../models/MetaAdSet.js';
import MetaAd from '../models/MetaAd.js';
import MetaInsights from '../models/MetaInsights.js';
import Lead from '../models/Lead.js';
import AbstractEntry from '../models/AbstractEntry.js';
import {
  syncAllMetaClients,
  syncSingleMetaClient,
  syncByAdAccount,
  syncAllMetaClientsHistorical,
  syncSingleMetaClientHistorical,
} from '../sync/metaSyncService.js';
import {
  getMetaSyncStatus,
  triggerMetaSyncNow,
} from '../sync/scheduler.js';
import {
  verifySystemUser,
  verifyAdAccountAccess,
  listPagesForSystemUser,
  subscribePageToLeadgen,
  unsubscribePage,
} from '../services/metaAdsService.js';
import { ingestLead, enqueueRetry } from '../services/metaLeadService.js';
import { verifyWebhookSignature } from '../utils/metaSignature.js';
import { encrypt } from '../utils/encryption.js';

// ────────────────────────────────────────────────────────────────────
// Manual-override allow-list for the Monthly Abstract / EOD report.
// Lives at the top of the file (rather than next to saveMonthlyAbstractCell
// at the bottom) because both `getMonthlyAbstract` and `getTelecallingReport`
// reach for it during their merge passes — having to scroll past 1700
// lines to find the definition was a readability trap.
//
// EDITABLE_ABSTRACT_FIELDS is the single source of truth for what
// columns telecallers can override. Adding a new editable field is
// a one-line change here (plus flipping `editable: true` on the
// matching column in the frontend's MonthlyAbstract COLUMNS list).
//
// `readManualValues` is the gatekeeper — every merge path filters
// the stored map through this helper so even a hand-edited row in
// MongoDB can't bleed an unexpected key into the auto-computed cells.
// ────────────────────────────────────────────────────────────────────
const EDITABLE_ABSTRACT_FIELDS = new Set([
  // Source columns the Leads table can't represent anymore (its source
  // dropdown is limited to WhatsApp / Instagram / Facebook):
  'google_lead',
  'justdial',
  'walk_in',
  'referral',
  'physical_marketing',
  'incall_google',
  'incall_fb',
  'incall_insta',
  'incall_self',
  // Top-level INCALL override saved from the EOD report's single
  // INCALL cell. When set, it wins over the sum of the four
  // incall_* sub-types for that day — useful when the team only
  // tracks a combined number instead of the breakdown.
  'incall_total',
  // Revenue — no field on Lead at all:
  'convert_value',
]);

// Defensive read: lean() docs can return manualValues as either a
// plain object or a Map depending on the Mongoose driver version.
const readManualValues = (manualValues) => {
  if (!manualValues) return {};
  const entries = manualValues instanceof Map
    ? Array.from(manualValues.entries())
    : Object.entries(manualValues);
  const out = {};
  entries.forEach(([k, v]) => {
    if (EDITABLE_ABSTRACT_FIELDS.has(k) && v != null && Number.isFinite(Number(v))) {
      out[k] = Number(v);
    }
  });
  return out;
};

// POST /api/meta/sync — sync every meta-enabled client, fire-and-forget.
export const postSyncAll = async (req, res) => {
  const deep = String(req.query.deep || '').toLowerCase() === 'true';
  // Fire without awaiting so the HTTP call returns immediately.
  triggerMetaSyncNow().catch((err) =>
    console.error('[meta-controller] background sync failed:', err)
  );
  res.json({
    success: true,
    message: 'Meta sync triggered',
    deep,
    status: getMetaSyncStatus(),
  });
};

// POST /api/meta/sync/historical?since=YYYY-MM-DD&until=YYYY-MM-DD
// Fire-and-forget historical backfill. Loops every meta-enabled client and
// pulls insights for the explicit window — bypasses META_INSIGHTS_BACKFILL_DAYS
// without an env-var change or restart.
export const postSyncHistorical = async (req, res) => {
  const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
  const { since, until } = req.query;
  if (!ymdRe.test(since || '') || !ymdRe.test(until || '')) {
    return res.status(400).json({
      success: false,
      message: 'since and until are required as YYYY-MM-DD',
    });
  }
  if (since > until) {
    return res.status(400).json({
      success: false,
      message: 'since must be on or before until',
    });
  }

  syncAllMetaClientsHistorical({ since, until }).catch((err) =>
    console.error('[meta-controller] historical sync failed:', err)
  );

  res.status(202).json({
    success: true,
    message: 'Historical Meta sync triggered',
    window: { since, until },
    note: 'Use GET /api/meta/sync-status or /api/meta/sync-runs to track progress.',
  });
};

// POST /api/meta/sync-runs/cleanup[?force=1]
// Marks zombie "running" runs as failed. Without ?force, only entries with
// duration_ms=0 AND started_at >30min ago are touched (same rule as the
// boot-time cleanup in server.js). With ?force=1, every "running" entry is
// killed regardless of age — use only when you know nothing real is running.
export const postCleanupSyncRuns = async (req, res) => {
  const force = String(req.query.force || '').toLowerCase() === '1' ||
    String(req.query.force || '').toLowerCase() === 'true';

  const filter = { status: 'running', duration_ms: 0 };
  if (!force) {
    filter.started_at = { $lt: new Date(Date.now() - 30 * 60 * 1000) };
  }

  try {
    const result = await MetaSyncRun.updateMany(filter, {
      $set: { status: 'failed', ended_at: new Date() },
      $push: {
        errors: {
          stage: 'cleanup',
          message: force
            ? 'force-cleaned via /sync-runs/cleanup?force=1'
            : 'cleaned via /sync-runs/cleanup (>30min stale)',
          at: new Date(),
        },
      },
    });

    res.json({
      success: true,
      force,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error('[meta-controller] cleanup failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/meta/sync/historical/:clientId?since=YYYY-MM-DD&until=YYYY-MM-DD
// Fire-and-forget historical backfill for ONE client. Use when onboarding a
// new client so you don't waste Meta API quota re-syncing the others.
export const postSyncHistoricalClient = async (req, res) => {
  const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
  const { clientId } = req.params;
  const { since, until } = req.query;

  if (!mongoose.isValidObjectId(clientId)) {
    return res.status(400).json({ success: false, message: 'Invalid clientId' });
  }
  if (!ymdRe.test(since || '') || !ymdRe.test(until || '')) {
    return res.status(400).json({
      success: false,
      message: 'since and until are required as YYYY-MM-DD',
    });
  }
  if (since > until) {
    return res.status(400).json({
      success: false,
      message: 'since must be on or before until',
    });
  }

  const client = await Client.findById(clientId);
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }
  if (!client.meta_ad_account_id) {
    return res.status(400).json({
      success: false,
      message: 'Client has no meta_ad_account_id configured',
    });
  }

  syncSingleMetaClientHistorical(clientId, { since, until }).catch((err) =>
    console.error('[meta-controller] historical client sync failed:', err)
  );

  res.status(202).json({
    success: true,
    message: 'Historical Meta sync triggered for client',
    clientId,
    clientName: client.clientName,
    window: { since, until },
    note: 'Use GET /api/meta/sync-runs to track progress.',
  });
};

// POST /api/meta/sync/:clientId — blocking so the caller can see counts.
export const postSyncClient = async (req, res) => {
  const { clientId } = req.params;
  const deep = String(req.query.deep || '').toLowerCase() === 'true';

  if (!mongoose.isValidObjectId(clientId)) {
    return res.status(400).json({ success: false, message: 'Invalid clientId' });
  }

  const client = await Client.findById(clientId);
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }
  if (!client.meta_ad_account_id) {
    return res.status(400).json({
      success: false,
      message: 'Client has no meta_ad_account_id configured',
    });
  }

  try {
    const run = await syncSingleMetaClient(clientId, { deep });
    res.json({
      success: run.status !== 'failed',
      run_id: run.run_id,
      status: run.status,
      duration_ms: run.duration_ms,
      counts: run.counts,
      errors: run.errors,
    });
  } catch (err) {
    console.error('[meta-controller] postSyncClient error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/meta/sync/ad-account/:adAccountId — Phase-3 convenience for smoke-
// testing against a raw ad account before any Client row has meta_enabled=true.
// Ad account IDs are public-ish (visible in Ads Manager URLs), so this is
// safe to expose behind the same auth-level as the rest of this surface.
export const postSyncAdAccount = async (req, res) => {
  const { adAccountId } = req.params;
  const deep = String(req.query.deep || '').toLowerCase() === 'true';
  const onboardedAt = req.query.onboardedAt ? new Date(req.query.onboardedAt) : null;

  if (!/^act_\d+$/.test(adAccountId)) {
    return res.status(400).json({
      success: false,
      message: 'adAccountId must be of the form act_<digits>',
    });
  }

  const runId = `meta-adhoc-${Date.now()}`;
  const run = await MetaSyncRun.create({
    run_id: runId,
    started_at: new Date(),
    scope: deep ? 'deep' : 'incremental',
    status: 'running',
    counts: {
      campaigns: 0, adsets: 0, ads: 0, insights_rows: 0, forms: 0,
      leads_fetched: 0, leads_inserted: 0,
    },
    errors: [],
  });

  try {
    const result = await syncByAdAccount({
      adAccountId,
      clientId: null,
      onboardedAt,
      deep,
      run,
      label: adAccountId,
    });

    run.status = result.ok ? 'success' : 'partial';
    run.ended_at = new Date();
    run.duration_ms = run.ended_at - run.started_at;
    await run.save();

    res.json({
      success: result.ok,
      run_id: runId,
      status: run.status,
      duration_ms: run.duration_ms,
      counts: run.counts,
      stages: result.stages,
      errors: run.errors,
    });
  } catch (err) {
    run.status = 'failed';
    run.ended_at = new Date();
    run.duration_ms = run.ended_at - run.started_at;
    run.errors.push({ stage: 'run', message: err.message || String(err), at: new Date() });
    await run.save();
    console.error('[meta-controller] postSyncAdAccount error:', err);
    res.status(500).json({ success: false, message: err.message, run_id: runId });
  }
};

// GET /api/meta/sync-status — live scheduler + last run snapshot.
export const getStatus = async (req, res) => {
  const status = getMetaSyncStatus();
  const lastRun = await MetaSyncRun.findOne().sort({ started_at: -1 }).lean();
  res.json({
    ...status,
    last_run: lastRun
      ? {
          run_id: lastRun.run_id,
          scope: lastRun.scope,
          status: lastRun.status,
          started_at: lastRun.started_at,
          ended_at: lastRun.ended_at,
          duration_ms: lastRun.duration_ms,
          counts: lastRun.counts,
          error_count: (lastRun.errors || []).length,
        }
      : null,
  });
};

// GET /api/meta/sync-runs?limit=50 — run history.
export const getRuns = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 200);
  const runs = await MetaSyncRun.find()
    .sort({ started_at: -1 })
    .limit(limit)
    .lean();
  res.json({ runs });
};

// GET /api/meta/health — Graph API reachable?
export const getHealth = async (req, res) => {
  try {
    const { me } = await verifySystemUser();
    res.json({ ok: true, meta_user: me });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
};

// GET /api/meta/ad-account/:adAccountId/verify — quick reachability check
export const getVerifyAdAccount = async (req, res) => {
  const { adAccountId } = req.params;
  if (!/^act_\d+$/.test(adAccountId)) {
    return res.status(400).json({ ok: false, message: 'Invalid adAccountId' });
  }
  try {
    const { account } = await verifyAdAccountAccess(adAccountId);
    res.json({ ok: true, account });
  } catch (err) {
    res.status(err?.httpStatus || 500).json({ ok: false, error: err.message });
  }
};

// -- Webhook ----------------------------------------------------------------

// GET /api/meta/webhook — Meta's one-time verification handshake.
// Respond with hub.challenge as plain text when hub.verify_token matches.
export const getWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.META_VERIFY_TOKEN || '';

  if (mode === 'subscribe' && token && token === expected) {
    return res.status(200).type('text/plain').send(String(challenge || ''));
  }
  return res.status(403).type('text/plain').send('verification failed');
};

// POST /api/meta/webhook — Meta lead delivery.
// Must respond 200 within ~20s or Meta retries. We respond immediately and
// process leads asynchronously; any errors enqueue a retry, never bubble.
export const postWebhook = async (req, res) => {
  const appSecret = process.env.META_APP_SECRET || '';
  const signature = req.get('x-hub-signature-256') || req.get('X-Hub-Signature-256');

  if (!verifyWebhookSignature(req.rawBody, signature, appSecret)) {
    console.warn('[meta-webhook] signature verification failed');
    return res.status(401).json({ ok: false, error: 'invalid signature' });
  }

  // Acknowledge immediately — keeps Meta's retry machinery quiet.
  res.status(200).json({ ok: true });

  const body = req.body || {};
  if (body.object !== 'page' || !Array.isArray(body.entry)) return;

  // Flatten entry[].changes[] into individual leadgen events.
  const tasks = [];
  for (const entry of body.entry) {
    const pageId = entry?.id;
    for (const change of entry?.changes || []) {
      if (change?.field !== 'leadgen') continue;
      const v = change?.value || {};
      tasks.push({
        leadgenId: v.leadgen_id,
        pageId: v.page_id || pageId,
        formId: v.form_id,
        adId: v.ad_id,
        adsetId: v.adgroup_id,
        campaignId: v.campaign_id,
        rawPayload: { entry, change },
      });
    }
  }

  await Promise.allSettled(
    tasks.map(async (t) => {
      if (!t.leadgenId) return;
      try {
        const result = await ingestLead({ ...t, source: 'webhook' });
        if (result.status === 'deferred') {
          await enqueueRetry({
            leadgenId: t.leadgenId,
            pageId: t.pageId,
            formId: t.formId,
            payload: t.rawPayload,
            lastError: result.raw?.error || 'deferred',
          });
        }
      } catch (err) {
        console.error('[meta-webhook] ingest crashed:', err?.message || err);
        await enqueueRetry({
          leadgenId: t.leadgenId,
          pageId: t.pageId,
          formId: t.formId,
          payload: t.rawPayload,
          lastError: err?.message || String(err),
        });
      }
    })
  );
};

// -- Form admin -------------------------------------------------------------

// GET /api/meta/unassigned-forms
export const getUnassignedForms = async (req, res) => {
  const forms = await MetaLeadForm.find({ client_id: null })
    .sort({ last_seen_at: -1 })
    .lean();
  res.json({ forms });
};

// POST /api/meta/forms/:formId/assign  { client_id }
export const postAssignForm = async (req, res) => {
  const { formId } = req.params;
  const { client_id } = req.body || {};
  if (!mongoose.isValidObjectId(client_id)) {
    return res.status(400).json({ success: false, message: 'Invalid client_id' });
  }
  const client = await Client.findById(client_id);
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }
  const form = await MetaLeadForm.findOneAndUpdate(
    { form_id: formId },
    { $set: { client_id } },
    { returnDocument: "after" }
  );
  if (!form) {
    return res.status(404).json({ success: false, message: 'Form not found' });
  }

  // Reprocess any raw rows that were parked unprocessed for this form.
  const unprocessed = await MetaLeadRaw.find({ form_id: formId, processed: false });
  let reprocessed = 0;
  for (const r of unprocessed) {
    try {
      const result = await ingestLead({
        leadgenId: r.leadgen_id,
        pageId: r.page_id,
        formId: r.form_id,
        source: 'manual',
      });
      if (result.status === 'processed') reprocessed++;
    } catch (err) {
      console.error('[meta-assign] reprocess failed:', err?.message);
    }
  }

  res.json({ success: true, form, reprocessed });
};

// POST /api/meta/forms/:formId/reprocess — replay every raw row for this form.
export const postReprocessForm = async (req, res) => {
  const { formId } = req.params;
  const raws = await MetaLeadRaw.find({ form_id: formId });
  let processed = 0;
  for (const r of raws) {
    // Clear processed flag so ingestLead doesn't short-circuit.
    r.processed = false;
    await r.save();
    try {
      const result = await ingestLead({
        leadgenId: r.leadgen_id,
        pageId: r.page_id,
        formId: r.form_id,
        source: 'manual',
      });
      if (result.status === 'processed') processed++;
    } catch (err) {
      console.error('[meta-reprocess]', r.leadgen_id, err?.message);
    }
  }
  res.json({ success: true, total: raws.length, processed });
};

// GET /api/meta/retry-queue — operator visibility
export const getRetryQueue = async (req, res) => {
  const pending = await MetaWebhookRetry.find({ status: 'pending' })
    .sort({ next_attempt_at: 1 })
    .limit(200)
    .lean();
  const abandoned = await MetaWebhookRetry.countDocuments({ status: 'abandoned' });
  const resolved = await MetaWebhookRetry.countDocuments({ status: 'resolved' });
  res.json({
    pending_count: pending.length,
    abandoned_count: abandoned,
    resolved_count: resolved,
    pending,
  });
};

// GET /api/meta/raw-leads?limit=50&processed=false&formId=... — inspect the
// audit log of everything the webhook + poller have received.
export const getRawLeads = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 200);
  const filter = {};
  if (req.query.processed === 'true') filter.processed = true;
  if (req.query.processed === 'false') filter.processed = false;
  if (req.query.formId) filter.form_id = String(req.query.formId);
  if (req.query.pageId) filter.page_id = String(req.query.pageId);
  if (req.query.source) filter.source = String(req.query.source);

  const [total, processed, unprocessed, rows] = await Promise.all([
    MetaLeadRaw.countDocuments({}),
    MetaLeadRaw.countDocuments({ processed: true }),
    MetaLeadRaw.countDocuments({ processed: false }),
    MetaLeadRaw.find(filter).sort({ received_at: -1 }).limit(limit).lean(),
  ]);

  res.json({
    totals: { all: total, processed, unprocessed },
    shown: rows.length,
    rows: rows.map((r) => ({
      leadgen_id: r.leadgen_id,
      received_at: r.received_at,
      source: r.source,
      page_id: r.page_id,
      form_id: r.form_id,
      ad_id: r.ad_id,
      campaign_id: r.campaign_id,
      processed: r.processed,
      processed_at: r.processed_at,
      lead_id: r.lead_id,
      error: r.error,
    })),
  });
};

// ---------------------------------------------------------------------------
// Phase 6: client config + analytics
// ---------------------------------------------------------------------------

// Helpers
const sanitizePagesForResponse = (pages = []) =>
  pages.map((p) => ({
    page_id: p.page_id,
    page_name: p.page_name,
    subscribed: !!p.subscribed,
    token_issued_at: p.token_issued_at || null,
    token_expires_at: p.token_expires_at || null,
    has_token: !!p.encrypted_access_token,
  }));

// Resolve `:clientId` from the URL and enforce tenant ownership so
// cross-tenant reads / writes can't happen via URL manipulation.
//   - Portal callers (req.clientId set by protectAdminOrClient): the
//     URL clientId MUST match their token's clientId. Anything else
//     returns 403.
//   - Agency callers (req.user set): admin / superadmin can access any
//     client; other roles fall back to permission scoping that already
//     lives on individual endpoints. (We could tighten this further per
//     team if needed.)
//   - Unauthenticated callers shouldn't reach this helper now that the
//     route file is behind `protectAdminOrClient`, but we 401 defensively.
const loadClientOr404 = async (req, res) => {
  const { clientId } = req.params;
  if (!mongoose.isValidObjectId(clientId)) {
    res.status(400).json({ success: false, message: 'Invalid clientId' });
    return null;
  }

  if (!req.user && !req.clientId) {
    res.status(401).json({ success: false, message: 'Not authorized' });
    return null;
  }
  if (req.clientId && String(req.clientId) !== String(clientId)) {
    res.status(403).json({
      success: false,
      message: 'Portal token cannot access another client',
    });
    return null;
  }

  const client = await Client.findById(clientId);
  if (!client) {
    res.status(404).json({ success: false, message: 'Client not found' });
    return null;
  }
  return client;
};

// GET /api/meta/client/:clientId/config
export const getClientConfig = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;
  res.json({
    client_id: client._id,
    client_name: client.clientName,
    meta_enabled: !!client.meta_enabled,
    meta_business_id: client.meta_business_id || '',
    meta_ad_account_id: client.meta_ad_account_id || '',
    meta_ad_account_name: client.meta_ad_account_name || '',
    meta_ad_account_currency: client.meta_ad_account_currency || '',
    meta_ad_account_timezone: client.meta_ad_account_timezone || '',
    meta_pages: sanitizePagesForResponse(client.meta_pages),
    meta_onboarded_at: client.meta_onboarded_at || null,
    meta_last_sync_at: client.meta_last_sync_at || null,
    meta_last_sync_status: client.meta_last_sync_status || '',
    meta_last_sync_error: client.meta_last_sync_error || '',
  });
};

// PUT /api/meta/client/:clientId/config
// Accepts:
//   meta_enabled:       boolean
//   meta_ad_account_id: "act_..."
//   meta_business_id:   string
//   meta_onboarded_at:  ISO date
//   meta_pages:         [{ page_id, page_name, access_token }]
//     - if access_token is present it's encrypted before storage
//     - if only page_id is sent, existing encrypted_access_token is preserved
//   pages_replace:      boolean — if true, replace the array; otherwise merge by page_id
export const putClientConfig = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const body = req.body || {};

  // Validate ad account before saving (if provided).
  if (body.meta_ad_account_id) {
    if (!/^act_\d+$/.test(body.meta_ad_account_id)) {
      return res.status(400).json({
        success: false,
        message: 'meta_ad_account_id must match "act_<digits>"',
      });
    }
    try {
      const { account } = await verifyAdAccountAccess(body.meta_ad_account_id);
      client.meta_ad_account_id = body.meta_ad_account_id;
      client.meta_ad_account_name = account.name || '';
      client.meta_ad_account_currency = account.currency || '';
      client.meta_ad_account_timezone = account.timezone_name || '';
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: `Meta Ad Account verification failed: ${err.message}`,
      });
    }
  }

  if (typeof body.meta_enabled === 'boolean') client.meta_enabled = body.meta_enabled;
  if (typeof body.meta_business_id === 'string') client.meta_business_id = body.meta_business_id;
  if (body.meta_onboarded_at) client.meta_onboarded_at = new Date(body.meta_onboarded_at);
  else if (client.meta_enabled && !client.meta_onboarded_at) {
    client.meta_onboarded_at = new Date();
  }

  // Pages merge/replace
  if (Array.isArray(body.meta_pages)) {
    const incoming = body.meta_pages
      .filter((p) => p && p.page_id)
      .map((p) => ({
        page_id: String(p.page_id),
        page_name: p.page_name || '',
        access_token: p.access_token || '', // plaintext — we'll encrypt
      }));

    const replace = !!body.pages_replace;
    const existing = replace ? [] : [...(client.meta_pages || [])];
    const byId = new Map(existing.map((e) => [e.page_id, e]));

    for (const p of incoming) {
      const prev = byId.get(p.page_id) || {};
      byId.set(p.page_id, {
        page_id: p.page_id,
        page_name: p.page_name || prev.page_name || '',
        encrypted_access_token: p.access_token
          ? encrypt(p.access_token)
          : prev.encrypted_access_token || '',
        token_issued_at: p.access_token ? new Date() : prev.token_issued_at,
        token_expires_at: prev.token_expires_at,
        subscribed: prev.subscribed ?? false,
      });
    }
    client.meta_pages = Array.from(byId.values());
  }

  await client.save();

  res.json({
    success: true,
    config: {
      client_id: client._id,
      meta_enabled: client.meta_enabled,
      meta_ad_account_id: client.meta_ad_account_id,
      meta_ad_account_name: client.meta_ad_account_name,
      meta_ad_account_currency: client.meta_ad_account_currency,
      meta_ad_account_timezone: client.meta_ad_account_timezone,
      meta_pages: sanitizePagesForResponse(client.meta_pages),
      meta_onboarded_at: client.meta_onboarded_at,
    },
  });
};

// POST /api/meta/client/:clientId/test-connection
// Verifies the configured ad account is reachable with the system user token.
export const postTestConnection = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;
  if (!client.meta_ad_account_id) {
    return res.status(400).json({ ok: false, message: 'No meta_ad_account_id configured' });
  }
  try {
    const { account } = await verifyAdAccountAccess(client.meta_ad_account_id);
    res.json({ ok: true, account });
  } catch (err) {
    res.status(err?.httpStatus || 500).json({ ok: false, error: err.message });
  }
};

// GET /api/meta/client/:clientId/available-pages
// Lists every Page the agency's System User can access — operator uses this
// to pick which Pages to wire to a client.
export const getClientAvailablePages = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;
  try {
    const { pages } = await listPagesForSystemUser();
    const assignedPageIds = new Set((client.meta_pages || []).map((p) => p.page_id));
    res.json({
      pages: pages.map((p) => ({
        page_id: p.id,
        page_name: p.name,
        category: p.category || '',
        tasks: p.tasks || [],
        already_assigned: assignedPageIds.has(p.id),
        instagram_business_account: p.instagram_business_account || null,
      })),
    });
  } catch (err) {
    res.status(err?.httpStatus || 500).json({ ok: false, error: err.message });
  }
};

// POST /api/meta/client/:clientId/pages/:pageId/subscribe
// Binds the Page (if not already in meta_pages) and calls Graph
// /subscribed_apps with subscribed_fields=leadgen.
export const postClientSubscribePage = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;
  const { pageId } = req.params;

  // If the Page isn't yet on the client, pull it from listPagesForSystemUser
  // so we can grab its access_token and encrypt it.
  let page = (client.meta_pages || []).find((p) => p.page_id === pageId);
  if (!page) {
    try {
      const { pages } = await listPagesForSystemUser();
      const hit = pages.find((p) => p.id === pageId);
      if (!hit) {
        return res.status(404).json({
          ok: false,
          message: `Page ${pageId} is not assigned to the System User — assign it in Business Settings first`,
        });
      }
      page = {
        page_id: hit.id,
        page_name: hit.name,
        encrypted_access_token: encrypt(hit.access_token),
        token_issued_at: new Date(),
        subscribed: false,
      };
      client.meta_pages = [...(client.meta_pages || []), page];
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // Decrypt the stored token to subscribe with it.
  let pageToken = '';
  try {
    const { decrypt } = await import('../utils/encryption.js');
    pageToken = decrypt(page.encrypted_access_token);
  } catch (err) {
    return res.status(500).json({ ok: false, error: `Failed to decrypt Page token: ${err.message}` });
  }

  try {
    const result = await subscribePageToLeadgen(pageId, pageToken);
    // Update subscribed=true on the matching subdoc.
    client.meta_pages = (client.meta_pages || []).map((p) =>
      p.page_id === pageId ? { ...(p.toObject ? p.toObject() : p), subscribed: true } : p
    );
    await client.save();
    res.json({ ok: true, subscribed: true, graph_response: result });
  } catch (err) {
    res.status(err?.httpStatus || 500).json({ ok: false, error: err.message });
  }
};

// DELETE /api/meta/client/:clientId/pages/:pageId/subscribe
export const deleteClientSubscribePage = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;
  const { pageId } = req.params;
  const page = (client.meta_pages || []).find((p) => p.page_id === pageId);
  if (!page) {
    return res.status(404).json({ ok: false, message: 'Page not assigned to this client' });
  }

  let pageToken = '';
  try {
    const { decrypt } = await import('../utils/encryption.js');
    pageToken = decrypt(page.encrypted_access_token);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  try {
    const result = await unsubscribePage(pageId, pageToken);
    client.meta_pages = (client.meta_pages || []).map((p) =>
      p.page_id === pageId ? { ...(p.toObject ? p.toObject() : p), subscribed: false } : p
    );
    await client.save();
    res.json({ ok: true, subscribed: false, graph_response: result });
  } catch (err) {
    res.status(err?.httpStatus || 500).json({ ok: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const parseDateRange = (q) => {
  const until = q.to ? new Date(q.to) : new Date();
  const since = q.from
    ? new Date(q.from)
    : new Date(until.getTime() - 30 * 86400_000);
  // Normalize to start/end of day so "from=2026-04-01" includes that whole day.
  since.setUTCHours(0, 0, 0, 0);
  until.setUTCHours(23, 59, 59, 999);
  return { since, until };
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// GET /api/meta/client/:clientId/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getClientAnalytics = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const { since, until } = parseDateRange(req.query);
  const clientId = client._id;
  const dateRange = { $gte: since, $lte: until };

  // IST date boundaries for lead queries
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const leadSince = new Date(since.getTime() - IST_MS);
  const leadUntil = new Date(until.getTime() - IST_MS);
  const leadDateRange = { $gte: leadSince, $lte: leadUntil };
  const leadDateFilter = {
    $or: [
      { meta_created_time: leadDateRange },
      { meta_created_time: null, createdAt: leadDateRange },
    ],
  };

  // ---- Batch 1: all independent DB queries in parallel ----
  const [
    summaryAggResult,
    dailyTrend,
    campaignAgg,
    leadForms,
    formLeadCounts,
    leads_in_range,
  ] = await Promise.all([
    MetaInsights.aggregate([
      { $match: { client_id: clientId, level: 'campaign', date: dateRange } },
      {
        $group: {
          _id: null,
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          reach: { $sum: '$reach' },
          clicks: { $sum: '$clicks' },
          inline_link_clicks: { $sum: '$inline_link_clicks' },
          form_leads: { $sum: '$leads' },
          whatsapp_leads: { $sum: '$messaging_conversations_started' },
          calls: { $sum: { $ifNull: ['$actions.click_to_call_native_call_placed', 0] } },
          conversions: { $sum: '$conversions' },
          video_thruplay: { $sum: '$video_thruplay' },
          rows: { $sum: 1 },
        },
      },
    ]),
    MetaInsights.aggregate([
      { $match: { client_id: clientId, level: 'campaign', date: dateRange } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          clicks: { $sum: '$clicks' },
          reach: { $sum: '$reach' },
          form_leads: { $sum: '$leads' },
          whatsapp_leads: { $sum: '$messaging_conversations_started' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          spend: { $round: ['$spend', 2] },
          impressions: 1, clicks: 1, reach: 1, form_leads: 1, whatsapp_leads: 1,
          total_leads: { $add: ['$form_leads', '$whatsapp_leads'] },
          ctr: { $cond: [{ $gt: ['$impressions', 0] }, { $round: [{ $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] }, 2] }, 0] },
          cpc: { $cond: [{ $gt: ['$clicks', 0] }, { $round: [{ $divide: ['$spend', '$clicks'] }, 2] }, 0] },
          cpm: { $cond: [{ $gt: ['$impressions', 0] }, { $round: [{ $multiply: [{ $divide: ['$spend', '$impressions'] }, 1000] }, 2] }, 0] },
          cpl: { $cond: [{ $gt: [{ $add: ['$form_leads', '$whatsapp_leads'] }, 0] }, { $round: [{ $divide: ['$spend', { $add: ['$form_leads', '$whatsapp_leads'] }] }, 2] }, 0] },
          leads: { $add: ['$form_leads', '$whatsapp_leads'] },
        },
      },
    ]),
    MetaInsights.aggregate([
      { $match: { client_id: clientId, level: 'campaign', date: dateRange } },
      {
        $group: {
          _id: '$entity_id',
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          clicks: { $sum: '$clicks' },
          form_leads: { $sum: '$leads' },
          whatsapp_leads: { $sum: '$messaging_conversations_started' },
          calls: { $sum: { $ifNull: ['$actions.click_to_call_native_call_placed', 0] } },
        },
      },
      { $sort: { spend: -1 } },
    ]),
    MetaLeadForm.find({ client_id: clientId })
      .select('form_id name status locale page_id last_seen_at')
      .lean(),
    Lead.aggregate([
      { $match: { client: clientId, source: 'meta', ...leadDateFilter } },
      { $group: { _id: '$meta_form_id', count: { $sum: 1 } } },
    ]),
    Lead.find({ client: clientId, source: 'meta', ...leadDateFilter })
      .select('name email phone status meta_form_id meta_form_name meta_campaign_id meta_adset_id meta_ad_id platform createdAt meta_created_time raw_field_data utm_source utm_medium utm_campaign utm_content utm_term is_duplicate lead_location lead_category telecaller_name first_call_date first_call_label response_label remarks next_followup_date appointment_status appointment_date appointment_booked_date follow_ups')
      .sort({ meta_created_time: -1, createdAt: -1 })
      .lean(),
  ]);

  // ---- Build summary from aggregation result ----
  const [summaryAgg] = summaryAggResult;
  const sum = summaryAgg || {
    spend: 0, impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0,
    form_leads: 0, whatsapp_leads: 0, calls: 0, conversions: 0, video_thruplay: 0, rows: 0,
  };
  const totalLeads = (sum.form_leads || 0) + (sum.whatsapp_leads || 0);
  const summary = {
    spend: round2(sum.spend),
    impressions: sum.impressions || 0,
    reach: sum.reach || 0,
    clicks: sum.clicks || 0,
    inline_link_clicks: sum.inline_link_clicks || 0,
    video_thruplay: sum.video_thruplay || 0,
    form_leads: sum.form_leads || 0,
    whatsapp_leads: sum.whatsapp_leads || 0,
    calls: sum.calls || 0,
    total_leads: totalLeads,
    conversions: sum.conversions || 0,
    ctr: sum.impressions > 0 ? round2((sum.clicks / sum.impressions) * 100) : 0,
    cpc: sum.clicks > 0 ? round2(sum.spend / sum.clicks) : 0,
    cpm: sum.impressions > 0 ? round2((sum.spend / sum.impressions) * 1000) : 0,
    cpl_form: sum.form_leads > 0 ? round2(sum.spend / sum.form_leads) : 0,
    cpl_whatsapp: sum.whatsapp_leads > 0 ? round2(sum.spend / sum.whatsapp_leads) : 0,
    cpl: totalLeads > 0 ? round2(sum.spend / totalLeads) : 0,
    avg_cost_per_conv: (() => {
      const totalConv = totalLeads + (sum.calls || 0);
      return totalConv > 0 ? round2(sum.spend / totalConv) : 0;
    })(),
    leads: totalLeads,
    messaging_conversations_started: sum.whatsapp_leads || 0,
  };

  // ---- Build campaigns (campaignDocs lookup depends on campaignAgg) ----
  const campaignIds = campaignAgg.map((c) => c._id);
  const campaignDocs = await MetaCampaign.find({ campaign_id: { $in: campaignIds } })
    .select('campaign_id name status objective effective_status daily_budget')
    .lean();
  const campaignById = new Map(campaignDocs.map((c) => [c.campaign_id, c]));

  const campaigns = campaignAgg.map((c) => {
    const doc = campaignById.get(c._id) || {};
    const formLeads = c.form_leads || 0;
    const waLeads   = c.whatsapp_leads || 0;
    const calls     = c.calls || 0;
    const totalConv = formLeads + waLeads + calls;
    return {
      campaign_id: c._id,
      name: doc.name || '(unknown)',
      status: doc.status || '',
      effective_status: doc.effective_status || '',
      objective: doc.objective || '',
      daily_budget: doc.daily_budget || 0,
      spend: round2(c.spend),
      impressions: c.impressions,
      clicks: c.clicks,
      form_leads: formLeads,
      whatsapp_leads: waLeads,
      calls,
      total_leads: totalConv,
      ctr: c.impressions > 0 ? round2((c.clicks / c.impressions) * 100) : 0,
      avg_cost_per_conv: totalConv > 0 ? round2(c.spend / totalConv) : 0,
      cpl: totalConv > 0 ? round2(c.spend / totalConv) : 0,
      cpl_form: formLeads > 0 ? round2(c.spend / formLeads) : 0,
      cpl_whatsapp: waLeads > 0 ? round2(c.spend / waLeads) : 0,
      leads: totalConv,
      messaging_conversations_started: waLeads,
    };
  });

  // ---- Lead forms count map ----
  const leadCountByForm = new Map(formLeadCounts.map((r) => [r._id, r.count]));
  const lead_forms = leadForms.map((f) => ({
    form_id: f.form_id,
    name: f.name,
    status: f.status,
    page_id: f.page_id,
    leads_in_range: leadCountByForm.get(f.form_id) || 0,
    last_seen_at: f.last_seen_at,
  }));

  // ---- Override Leads + Messages with actual CRM records ------------------
  // MetaInsights campaign attribution misses organic form leads and counts
  // messaging_conversations_started (ad click → chat opened) rather than
  // actual WhatsApp leads that became CRM records.
  // Use leads_in_range as source of truth for both buckets.
  const actualFormLeads = leads_in_range.filter(
    (l) => (l.platform || '').toLowerCase() !== 'whatsapp'
  ).length;
  const actualWALeads = leads_in_range.filter(
    (l) => (l.platform || '').toLowerCase() === 'whatsapp'
  ).length;
  summary.form_leads = actualFormLeads;
  summary.whatsapp_leads = actualWALeads;
  summary.messaging_conversations_started = actualWALeads;
  const newTotalLeads = actualFormLeads + actualWALeads;
  summary.total_leads = newTotalLeads;
  summary.leads = newTotalLeads;
  summary.cpl_form = actualFormLeads > 0 ? round2(summary.spend / actualFormLeads) : 0;
  summary.cpl = newTotalLeads > 0 ? round2(summary.spend / newTotalLeads) : 0;
  const totalConvActual = newTotalLeads + summary.calls;
  summary.avg_cost_per_conv = totalConvActual > 0 ? round2(summary.spend / totalConvActual) : 0;

  // ---- Override per-campaign leads + messages with CRM records -----------
  // Same source-of-truth logic as the summary override above, applied per
  // campaign using meta_campaign_id. Organic leads (no campaign_id) are
  // counted in the summary but not attributed to any campaign row.
  const leadsByCampaign = new Map();
  for (const l of leads_in_range) {
    if (!l.meta_campaign_id) continue;
    if (!leadsByCampaign.has(l.meta_campaign_id)) {
      leadsByCampaign.set(l.meta_campaign_id, { form: 0, whatsapp: 0 });
    }
    const bucket = leadsByCampaign.get(l.meta_campaign_id);
    if ((l.platform || '').toLowerCase() === 'whatsapp') bucket.whatsapp++;
    else bucket.form++;
  }
  for (const c of campaigns) {
    const crm = leadsByCampaign.get(c.campaign_id) || { form: 0, whatsapp: 0 };
    c.form_leads = crm.form;
    c.whatsapp_leads = crm.whatsapp;
    c.messaging_conversations_started = crm.whatsapp;
    const totalConv = crm.form + crm.whatsapp + c.calls;
    c.total_leads = totalConv;
    c.leads = totalConv;
    c.avg_cost_per_conv = totalConv > 0 ? round2(c.spend / totalConv) : 0;
    c.cpl = totalConv > 0 ? round2(c.spend / totalConv) : 0;
    c.cpl_form = crm.form > 0 ? round2(c.spend / crm.form) : 0;
    c.cpl_whatsapp = crm.whatsapp > 0 ? round2(c.spend / crm.whatsapp) : 0;
  }

  // ---- Hourly leads (single-day only, computed from leads_in_range) --------
  const IST_OFFSET_HOURLY = 5.5 * 60 * 60 * 1000;
  const isSingleDay = since.toISOString().slice(0, 10) === until.toISOString().slice(0, 10);
  let hourly_leads = null;
  if (isSingleDay && leads_in_range.length > 0) {
    const hourCounts = new Array(24).fill(0);
    for (const l of leads_in_range) {
      const ts = l.meta_created_time || l.createdAt;
      if (!ts) continue;
      const istHour = new Date(new Date(ts).getTime() + IST_OFFSET_HOURLY).getUTCHours();
      hourCounts[istHour]++;
    }
    hourly_leads = hourCounts
      .map((leads, h) => ({ hour: h, hourPart: `${String(h).padStart(2, '0')}:00`, leads }))
      .filter((_, h) => h >= 7 && h <= 23);
  }

  // ---- Batch 2: Meta API + today's spend + entity counts in parallel -------
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);

  const fetchMetaAccount = async () => {
    if (!client.meta_ad_account_id) return null;
    const persisted = {
      id: client.meta_ad_account_id || '',
      name: client.meta_ad_account_name || '',
      currency: client.meta_ad_account_currency || '',
      timezone_name: client.meta_ad_account_timezone || '',
    };
    try {
      const { account } = await verifyAdAccountAccess(client.meta_ad_account_id);
      let available_balance = null;
      const ds = account.funding_source_details?.display_string || '';
      if (/available\s+balance/i.test(ds)) {
        const m = ds.match(/[\d,]+(?:\.\d+)?/);
        if (m) available_balance = round2(Number(m[0].replace(/,/g, '')));
      }
      return {
        id: account.id || persisted.id,
        name: account.name || persisted.name,
        currency: account.currency || persisted.currency,
        timezone_name: account.timezone_name || persisted.timezone_name,
        account_status: account.account_status,
        available_balance,
        balance: round2(Number(account.balance || 0) / 100),
        amount_spent: round2(Number(account.amount_spent || 0) / 100),
        disable_reason: account.disable_reason ?? 0,
        fetched_at: new Date(),
      };
    } catch (err) {
      return { ...persisted, error: err.message, fetched_at: new Date() };
    }
  };

  const [meta_account, todaySummaryResult, campaignCount, adsetCount, adCount] = await Promise.all([
    fetchMetaAccount(),
    MetaInsights.aggregate([
      { $match: { client_id: clientId, level: 'campaign', date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, spend: { $sum: '$spend' } } },
    ]),
    client.meta_ad_account_id ? MetaCampaign.countDocuments({ client_id: clientId }) : Promise.resolve(0),
    client.meta_ad_account_id ? MetaAdSet.countDocuments({ client_id: clientId }) : Promise.resolve(0),
    client.meta_ad_account_id ? MetaAd.countDocuments({ client_id: clientId }) : Promise.resolve(0),
  ]);

  const today_spend = round2((todaySummaryResult[0] || {}).spend || 0);

  res.json({
    client_id: clientId,
    client_name: client.clientName,
    range: {
      from: since.toISOString().slice(0, 10),
      to: until.toISOString().slice(0, 10),
    },
    summary,
    campaigns,
    daily_trend: dailyTrend,
    hourly_leads,
    lead_forms,
    leads_in_range,
    meta_account,
    today_spend,
    entity_counts: { campaigns: campaignCount, adsets: adsetCount, ads: adCount },
  });
};

// PUT /api/meta/client/:clientId/leads/:leadId
// Inline-edit endpoint for the CRM telecaller columns rendered by
// MetaLeadsTable. Lives on the Meta route tree (rather than /api/leads/:id)
// so the client-portal can hit it with its own clientToken — same pattern as
// /api/meta/client/:clientId/analytics. The /api/leads/:id PUT is admin-only
// and runs leadValidation which would reject our partial CRM patches.
//
// Accepts a partial body — only allow-listed fields are persisted, so a
// stray `status` or `assignedTo` from the frontend can never escalate.
const CRM_EDITABLE_FIELDS = [
  'is_duplicate',
  'lead_location',
  'lead_category',
  'telecaller_name',
  'first_call_date',
  'first_call_label',
  'response_label',
  'remarks',
  'next_followup_date',
  'appointment_status',
  'appointment_date',
  'appointment_booked_date',
  'follow_ups',
];

export const updateClientLead = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const { leadId } = req.params;
  if (!mongoose.isValidObjectId(leadId)) {
    return res.status(400).json({ success: false, message: 'Invalid leadId' });
  }

  const lead = await Lead.findOne({ _id: leadId, client: client._id });
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  for (const key of CRM_EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(req.body, key)) continue;
    const value = req.body[key];
    if (key === 'follow_ups') {
      // Replace the full array — simpler than diffing, and the table sends
      // the entire ordered list on every save.
      lead.follow_ups = Array.isArray(value)
        ? value.map((f) => ({
            number: f.number,
            date: f.date || null,
            call_label: f.call_label || '',
            remarks: f.remarks || '',
            connected: !!f.connected,
          }))
        : [];
    } else if (
      key === 'first_call_date' ||
      key === 'next_followup_date' ||
      key === 'appointment_date' ||
      key === 'appointment_booked_date'
    ) {
      lead[key] = value ? new Date(value) : null;
    } else {
      lead[key] = value;
    }
  }

  await lead.save();
  res.json({ success: true, lead: lead.toObject() });
};

// GET /api/meta/clients
// Multi-client comparison endpoint that powers the Meta tab on the
// AdsDashboard ("Ads Comparison") page. Mirrors the shape of
// /api/analytics/clients but for Meta-linked clients. Aggregates
// MetaInsights across all `meta_enabled: true` clients in a single
// $group pipeline (keyed by client_id) so the page stays fast even
// with dozens of clients.
export const getClientsAdsComparison = async (req, res) => {
  try {
    const { since, until } = parseDateRange(req.query);
    const dateRange = { $gte: since, $lte: until };

    const clients = await Client.find({ meta_enabled: true })
      .select('clientName meta_ad_account_id meta_ad_account_name meta_ad_account_currency meta_pages')
      .sort({ clientName: 1 })
      .lean();

    if (clients.length === 0) {
      return res.json({ count: 0, clients: [] });
    }

    const clientIds = clients.map((c) => c._id);

    // Single round-trip aggregation across all clients.
    const aggRows = await MetaInsights.aggregate([
      {
        $match: {
          client_id: { $in: clientIds },
          level: 'campaign',
          date: dateRange,
        },
      },
      {
        $group: {
          _id: '$client_id',
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          reach: { $sum: '$reach' },
          clicks: { $sum: '$clicks' },
          form_leads: { $sum: '$leads' },
          whatsapp_leads: { $sum: '$messaging_conversations_started' },
        },
      },
    ]);
    const byId = new Map(aggRows.map((r) => [String(r._id), r]));

    // Aggregate budgets per client. Daily lifetime budgets are stored on
    // MetaCampaign — sum across active campaigns to approximate "Budget".
    const budgetRows = await MetaCampaign.aggregate([
      { $match: { client_id: { $in: clientIds } } },
      {
        $group: {
          _id: '$client_id',
          totalBudget: {
            $sum: {
              $add: [
                { $ifNull: ['$daily_budget', 0] },
                { $ifNull: ['$lifetime_budget', 0] },
              ],
            },
          },
        },
      },
    ]);
    const budgetById = new Map(budgetRows.map((r) => [String(r._id), r.totalBudget]));

    const overviews = clients.map((c) => {
      const row = byId.get(String(c._id)) || {};
      const spend = round2(row.spend);
      const impressions = row.impressions || 0;
      const reach = row.reach || 0;
      const clicks = row.clicks || 0;
      const leads = (row.form_leads || 0) + (row.whatsapp_leads || 0);
      const ctr = impressions > 0 ? round2((clicks / impressions) * 100) : 0;
      const cpc = clicks > 0 ? round2(spend / clicks) : 0;
      const cpm = impressions > 0 ? round2((spend / impressions) * 1000) : 0;
      const cpl = leads > 0 ? round2(spend / leads) : 0;
      const frequency = reach > 0 ? round2(impressions / reach) : 0;
      const firstPage = Array.isArray(c.meta_pages) && c.meta_pages.length > 0 ? c.meta_pages[0] : null;
      return {
        clientId: c._id,
        clientName: c.clientName,
        metaAccountName: c.meta_ad_account_name || c.clientName,
        metaAdAccountId: c.meta_ad_account_id || '',
        pageName: firstPage?.page_name || '',
        currency: c.meta_ad_account_currency || 'INR',
        // Budget fields — Meta doesn't expose a single "fund" + "available
        // balance" the way Google's billing record does, so keep these as
        // best-effort sums (campaign budgets) and zeros for the columns
        // we don't have a source for. Frontend renders them with the same
        // INR formatter so missing values just show ₹0.
        totalBudget: round2(budgetById.get(String(c._id)) || 0),
        availableBalance: 0,
        spend,
        reach,
        impressions,
        frequency,
        clicks,
        ctr,
        cpc,
        cpm,
        leads,
        formLeads: row.form_leads || 0,
        whatsappLeads: row.whatsapp_leads || 0,
        cpl,
      };
    });

    res.json({
      count: overviews.length,
      range: {
        from: since.toISOString().slice(0, 10),
        to: until.toISOString().slice(0, 10),
      },
      clients: overviews,
    });
  } catch (error) {
    console.error('getClientsAdsComparison error:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/meta/dashboard-overview?from=YYYY-MM-DD&to=YYYY-MM-DD
// Dashboard-specific bulk summary. Same aggregation as /meta/clients but
// returns only the fields the dashboard's per-client cards consume, in the
// snake_case shape they already expect. Replaces the N+1 of one
// /meta/client/:id/analytics call per client on dashboard load.
export const getMetaDashboardOverview = async (req, res) => {
  try {
    const { since, until } = parseDateRange(req.query);
    const dateRange = { $gte: since, $lte: until };

    const clients = await Client.find({ meta_enabled: true })
      .select('_id')
      .lean();
    if (clients.length === 0) return res.json({ count: 0, clients: [] });

    const clientIds = clients.map((c) => c._id);
    const rows = await MetaInsights.aggregate([
      { $match: { client_id: { $in: clientIds }, level: 'campaign', date: dateRange } },
      {
        $group: {
          _id: '$client_id',
          spend: { $sum: '$spend' },
          form_leads: { $sum: '$leads' },
          whatsapp_leads: { $sum: '$messaging_conversations_started' },
          calls: { $sum: { $ifNull: ['$actions.click_to_call_native_call_placed', 0] } },
        },
      },
    ]);

    const overviews = rows.map((r) => {
      const spend = round2(r.spend);
      const form_leads = r.form_leads || 0;
      const whatsapp_leads = r.whatsapp_leads || 0;
      const total_leads = form_leads + whatsapp_leads;
      const cpl = total_leads > 0 ? round2(spend / total_leads) : 0;
      const calls = r.calls || 0;
      return { clientId: r._id, spend, total_leads, form_leads, whatsapp_leads, calls, cpl };
    });

    res.json({ count: overviews.length, clients: overviews });
  } catch (error) {
    console.error('getMetaDashboardOverview error:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/meta/daily-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD[&clientId=ObjectId]
// Date-wise totals of Leads / Messages / Calls across all Meta-enabled clients
// (or one client when clientId is supplied). Powers the 3-row metrics band.
export const getMetaDailyMetrics = async (req, res) => {
  try {
    const { since, until } = parseDateRange(req.query);
    const clientId = req.query.clientId;

    const matchStage = {
      level: 'campaign',
      date: { $gte: since, $lte: until },
    };
    if (clientId && /^[0-9a-fA-F]{24}$/.test(clientId)) {
      matchStage.client_id = new (await import('mongoose')).default.Types.ObjectId(clientId);
    }

    const rows = await MetaInsights.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          leads:    { $sum: '$leads' },
          messages: { $sum: '$messaging_conversations_started' },
          calls:    { $sum: { $ifNull: ['$actions.click_to_call_native_call_placed', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dates    = rows.map((r) => r._id);
    const leads    = rows.map((r) => r.leads    || 0);
    const messages = rows.map((r) => r.messages || 0);
    const calls    = rows.map((r) => r.calls    || 0);

    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    res.json({
      dates,
      leads,
      messages,
      calls,
      totals: { leads: sum(leads), messages: sum(messages), calls: sum(calls) },
    });
  } catch (error) {
    console.error('getMetaDailyMetrics error:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/meta/client/:clientId/leads
// Create a manual lead row — used for WhatsApp leads that don't come
// through the normal Meta lead-form sync. The portal admin and the
// agency admin both hit this endpoint; access control is the same as
// the rest of the meta tree (no middleware — clientId in the URL is
// the scoping mechanism).
//
// Marks the lead as `source: 'meta'` + `platform: 'whatsapp'` so it
// shows up in the same Leads table as the synced ones, distinguishable
// by the source chip. The CRM telecaller fields (lead_location, etc.)
// are accepted on create so the user can fill them in once instead of
// creating then editing. We intentionally skip `meta_leadgen_id` —
// manual rows don't have one, and the Lead schema's index is sparse so
// missing values don't collide.
export const createClientLead = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const { name, phone, email, manual_source_type, ...rest } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Name is required' });
  }
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ success: false, message: 'Phone is required' });
  }

  // Normalize the source — defaults to whatsapp for backwards compat
  // with the original Add-WhatsApp-Lead flow. The dashboard's Leads
  // Abstract groups rows by this field.
  const allowedSources = new Set([
    'whatsapp', 'instagram', 'facebook', 'google_lead', 'justdial',
    'walk_in', 'referral', 'physical_marketing',
    'incall_google', 'incall_fb', 'incall_insta', 'incall_self',
  ]);
  const sourceType = allowedSources.has(manual_source_type) ? manual_source_type : 'whatsapp';
  const sourceLabelMap = {
    whatsapp: 'WhatsApp (manual entry)',
    instagram: 'Instagram (manual entry)',
    facebook: 'Facebook (manual entry)',
    google_lead: 'Google Lead (manual entry)',
    justdial: 'Justdial (manual entry)',
    walk_in: 'Walk-In (manual entry)',
    referral: 'Referral (manual entry)',
    physical_marketing: 'Physical Marketing (manual entry)',
    incall_google: 'Incall — Google (manual entry)',
    incall_fb: 'Incall — Facebook (manual entry)',
    incall_insta: 'Incall — Instagram (manual entry)',
    incall_self: 'Incall — Self (manual entry)',
  };
  // platform must match the Lead schema's enum; map the bucket to the
  // closest existing value, fall back to 'unknown' for the new ones.
  const platformByType = {
    whatsapp: 'whatsapp',
    instagram: 'instagram',
    facebook: 'facebook',
    incall_fb: 'facebook',
    incall_insta: 'instagram',
  };

  // Lead schema requires email — for manual entries we synthesize a
  // recognisable placeholder so the row passes validation. If a real
  // email is supplied, use it.
  const cleanEmail = String(email || '').trim().toLowerCase();
  const finalEmail = cleanEmail
    || `manual-${sourceType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@placeholder.invalid`;

  const doc = {
    client: client._id,
    source: 'meta',
    platform: platformByType[sourceType] || 'unknown',
    manual_source_type: sourceType,
    name: String(name).trim(),
    email: finalEmail,
    phone: String(phone).trim(),
    meta_form_name: sourceLabelMap[sourceType],
    meta_created_time: new Date(),
  };

  // Allow-list the CRM telecaller fields so a stray `assignedTo` or
  // similar can't sneak in. Mirrors updateClientLead's CRM_EDITABLE_FIELDS.
  for (const key of CRM_EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(rest, key)) continue;
    const value = rest[key];
    if (key === 'follow_ups') {
      doc.follow_ups = Array.isArray(value)
        ? value.map((f) => ({
            number: f.number,
            date: f.date || null,
            call_label: f.call_label || '',
            remarks: f.remarks || '',
            connected: !!f.connected,
          }))
        : [];
    } else if (
      key === 'first_call_date' ||
      key === 'next_followup_date' ||
      key === 'appointment_date' ||
      key === 'appointment_booked_date'
    ) {
      doc[key] = value ? new Date(value) : null;
    } else {
      doc[key] = value;
    }
  }

  try {
    const lead = await Lead.create(doc);
    res.status(201).json({ success: true, lead: lead.toObject() });
  } catch (err) {
    console.error('createClientLead error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/meta/client/:clientId/leads/:leadId
// Removes a manually-entered WhatsApp lead. Synced Meta-form leads
// are intentionally NOT deletable through this endpoint — they're an
// audit record of what Meta delivered, and removing them silently
// would corrupt counts on the analytics aggregations. We identify
// manual entries by the marker the create endpoint sets:
//   meta_form_name === 'WhatsApp (manual entry)'  AND
//   platform === 'whatsapp'  AND
//   no meta_leadgen_id (synced rows always have one).
export const deleteClientLead = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const { leadId } = req.params;
  if (!mongoose.isValidObjectId(leadId)) {
    return res.status(400).json({ success: false, message: 'Invalid leadId' });
  }

  const lead = await Lead.findOne({ _id: leadId, client: client._id });
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  // Manual entries are identifiable in two ways: the new
  // `manual_source_type` field (set on every manual create going
  // forward), or the legacy `meta_form_name` marker ending in
  // "(manual entry)" for rows created before the field was added.
  // Both checks must agree that there's no Meta leadgen id.
  const isManualEntry =
    !lead.meta_leadgen_id &&
    (
      (typeof lead.manual_source_type === 'string' && lead.manual_source_type.length > 0)
      || (typeof lead.meta_form_name === 'string' && lead.meta_form_name.endsWith('(manual entry)'))
    );

  if (!isManualEntry) {
    return res.status(403).json({
      success: false,
      message: 'Only manually-entered leads can be deleted. Synced Meta form leads are immutable.',
    });
  }

  await lead.deleteOne();
  res.json({ success: true, message: 'Lead deleted', leadId });
};

// GET /api/meta/client/:clientId/telecalling-report?date=YYYY-MM-DD
// Powers the EOD Report tab on both the admin Client Ad Details page
// and the client portal. Aggregates a single client's Lead documents
// for the given day + current month + a week of appointment windows.
// Returns plain numbers — no charts, no time series — so the React
// page can render every section without further math.
export const getTelecallingReport = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  // Resolve the target date (defaults to today in server timezone).
  const targetDateStr = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);
  const targetEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

  // Month window — from the 1st of the month through end of target day.
  const monthStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
  const monthEnd = targetEnd;

  // Yesterday/today/future 5 days for the Appointment Status table.
  const dayWindow = (offset) => {
    const start = new Date(targetDate);
    start.setUTCDate(start.getUTCDate() + offset);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  };

  // Pull every lead for the month — small enough to aggregate in JS
  // and lets us count multiple metrics from one fetch.
  const monthLeads = await Lead.find({
    client: client._id,
    source: 'meta',
    $or: [
      { meta_created_time: { $gte: monthStart, $lte: monthEnd } },
      { createdAt: { $gte: monthStart, $lte: monthEnd } },
    ],
  })
    .select('meta_created_time createdAt platform meta_form_name manual_source_type is_duplicate first_call_date first_call_label response_label appointment_status appointment_date appointment_booked_date follow_ups name phone email lead_location lead_category telecaller_name remarks next_followup_date')
    .lean();

  // ── Helpers ───────────────────────────────────────────────────────
  const dateMatches = (lead, start, end) => {
    const t = lead.meta_created_time || lead.createdAt;
    if (!t) return false;
    const d = new Date(t);
    return d >= start && d <= end;
  };

  // Bucket a lead into one of the dashboard's source columns.
  const sourceBucketOf = (lead) => {
    if (lead.manual_source_type) return lead.manual_source_type;
    const plat = String(lead.platform || '').toLowerCase();
    if (plat === 'whatsapp') return 'whatsapp';
    if (plat === 'instagram') return 'instagram';
    if (plat === 'facebook') return 'facebook';
    return 'facebook';   // unknown synced rows default to Facebook
  };

  const isConnected = (lead) => {
    const lbl = String(lead.first_call_label || '').toUpperCase();
    if (lbl === 'CONNECTED') return true;
    return Array.isArray(lead.follow_ups) && lead.follow_ups.some((f) => f.connected || String(f.call_label || '').toUpperCase() === 'CONNECTED');
  };
  const isNotConnected = (lead) => {
    const lbl = String(lead.first_call_label || '').toUpperCase();
    return ['NOT CONNECTED', 'DISCONNECTED', 'RNR', 'BUSY'].includes(lbl);
  };
  const isInvalidOrDuplicate = (lead) => {
    if (lead.is_duplicate) return true;
    const lbl = String(lead.first_call_label || '').toUpperCase();
    if (lbl === 'INVALID') return true;
    return String(lead.response_label || '').toUpperCase() === 'DUPLICATE';
  };

  // ── DAY aggregate ─────────────────────────────────────────────────
  const dayLeads = monthLeads.filter((l) => dateMatches(l, targetDate, targetEnd));

  // Per-source bucket counts for the EOD's Day Summary block.
  // Each incall variant is tracked separately so manual overrides
  // for individual incall types (from the Abstract grid) can land
  // on the right key; the combined `incall` field below is a
  // computed sum that's what the EOD UI actually renders.
  const bucketCounts = {
    whatsapp: 0, instagram: 0, facebook: 0, google_lead: 0,
    justdial: 0, walk_in: 0, referral: 0, physical_marketing: 0,
    incall_google: 0, incall_fb: 0, incall_insta: 0, incall_self: 0,
    incall: 0,
  };
  dayLeads.forEach((l) => {
    const b = sourceBucketOf(l);
    if (bucketCounts[b] != null) bucketCounts[b] += 1;
    else bucketCounts.facebook += 1;
  });

  const totalLeadsDay = dayLeads.length;
  const connectedDay = dayLeads.filter(isConnected).length;
  const notConnectedDay = dayLeads.filter((l) => !isConnected(l) && isNotConnected(l)).length;
  const invalidDuplicateDay = dayLeads.filter(isInvalidOrDuplicate).length;
  const validDay = Math.max(totalLeadsDay - invalidDuplicateDay, 0);

  // Call totals — fresh = first call on the target day, callback = any
  // follow_up dated on the target day.
  const sameDay = (d) => {
    if (!d) return false;
    const x = new Date(d);
    return x.getUTCFullYear() === targetDate.getUTCFullYear()
      && x.getUTCMonth() === targetDate.getUTCMonth()
      && x.getUTCDate() === targetDate.getUTCDate();
  };

  let freshCallsDay = 0;
  let callbackCallsDay = 0;
  let freshConnectedDay = 0;
  let callbackConnectedDay = 0;
  monthLeads.forEach((l) => {
    if (l.first_call_date && sameDay(l.first_call_date)) {
      freshCallsDay += 1;
      if (String(l.first_call_label || '').toUpperCase() === 'CONNECTED') freshConnectedDay += 1;
    }
    (l.follow_ups || []).forEach((f) => {
      if (f.date && sameDay(f.date)) {
        callbackCallsDay += 1;
        if (f.connected || String(f.call_label || '').toUpperCase() === 'CONNECTED') callbackConnectedDay += 1;
      }
    });
  });

  // Appointments booked on the day (booked-on date).
  const appointmentsBookedDay = monthLeads.filter((l) =>
    l.appointment_booked_date && sameDay(l.appointment_booked_date)
  ).length;

  // Consulted / converted — anchored to the response_label updated on
  // the lead today. Approximation: if the lead has the right label and
  // any call activity on the target day, count it.
  const touchedToday = (l) =>
    sameDay(l.first_call_date)
    || (l.follow_ups || []).some((f) => sameDay(f.date))
    || sameDay(l.appointment_date)
    || sameDay(l.appointment_booked_date);

  const consultedDay = monthLeads.filter((l) =>
    String(l.response_label || '').toUpperCase() === 'CONSULTED' && touchedToday(l)
  ).length;
  const convertedDay = monthLeads.filter((l) =>
    ['TREATMENT BOOKED', 'CLOSED'].includes(String(l.response_label || '').toUpperCase()) && touchedToday(l)
  ).length;

  // Response breakdown for today — count of leads at each response
  // label the telecaller has set (HOT / WARM / COLD / etc.). Mirrors
  // the dropdown values in MetaLeadsTable's RESPONSE_LABEL_OPTIONS.
  // Powers the client-portal EOD's "Response" panel so the team sees
  // exactly what they picked on each lead. Anchored to `touchedToday`
  // so the count reflects leads worked on this date.
  const RESPONSE_LABELS_FOR_BREAKDOWN = [
    'TREATMENT BOOKED', 'CONSULTED', 'WARM', 'HOT', 'COLD',
    'NOT INTERESTED', 'NOT REQUIRED', 'NOT ENQUIRED', 'CTC', 'WILL CALL',
    'DUPLICATE', 'CLOSED',
  ];
  const responseBreakdownDay = RESPONSE_LABELS_FOR_BREAKDOWN.reduce((acc, label) => {
    acc[label] = monthLeads.filter((l) =>
      String(l.response_label || '').toUpperCase() === label && touchedToday(l)
    ).length;
    return acc;
  }, {});
  // Pull whatever the telecaller has manually saved for today and
  // apply it the same way the Monthly Abstract does — that's how the
  // two views stay in lockstep. The allow-list inside readManualValues
  // gates which keys are honored.
  const manualToday = await AbstractEntry.findOne({
    client: client._id,
    date: targetDateStr,
  }).lean();
  const manualOverridesToday = readManualValues(manualToday?.manualValues);

  // Source overrides — every key in EDITABLE_ABSTRACT_FIELDS that maps
  // onto a bucket gets replaced when a manual value exists. Replace
  // semantics on purpose: with the Leads source dropdown now limited
  // to WhatsApp / Instagram / Facebook, no new lead can have these
  // values, so the manual entry IS the authoritative count.
  Object.entries(manualOverridesToday).forEach(([k, v]) => {
    if (bucketCounts[k] != null) bucketCounts[k] = v;
  });

  // INCALL display rule:
  //   - If the telecaller typed a value into the EOD's single INCALL
  //     cell (`incall_total`), that wins.
  //   - Otherwise sum the four sub-types — which themselves reflect
  //     any manual edits made in the Monthly Abstract.
  if (manualOverridesToday.incall_total != null) {
    bucketCounts.incall = manualOverridesToday.incall_total;
  } else {
    bucketCounts.incall =
      bucketCounts.incall_google + bucketCounts.incall_fb +
      bucketCounts.incall_insta + bucketCounts.incall_self;
  }

  // Converted value isn't derivable from the Lead schema at all, so
  // we fall back to 0 if the telecaller hasn't entered one yet.
  const convertedValueDay = manualOverridesToday.convert_value ?? 0;

  // ── MONTH aggregate ───────────────────────────────────────────────
  const consultedMonth = monthLeads.filter((l) =>
    String(l.response_label || '').toUpperCase() === 'CONSULTED'
  ).length;
  const connectedMonth = monthLeads.reduce((sum, l) => {
    let count = 0;
    if (String(l.first_call_label || '').toUpperCase() === 'CONNECTED') count += 1;
    (l.follow_ups || []).forEach((f) => {
      if (f.connected || String(f.call_label || '').toUpperCase() === 'CONNECTED') count += 1;
    });
    return sum + count;
  }, 0);

  // Working-day projection: extrapolate the current pace to full month.
  const daysElapsed = targetDate.getUTCDate();
  const daysInMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0)).getUTCDate();
  const project = (achieved) => Math.round((achieved / Math.max(daysElapsed, 1)) * daysInMonth);

  // Read tunable targets from the client doc (with sensible defaults).
  // The defaults match the original hardcoded values so existing
  // clients keep showing the same numbers until an admin edits them.
  const t = client.telecalling_targets || {};
  const DAY_CONSULT_TARGET = Number.isFinite(t.day_consult) ? t.day_consult : 10;
  const DAY_CALL_TARGET = Number.isFinite(t.day_calls) ? t.day_calls : 100;
  const MONTH_CONSULT_TARGET = Number.isFinite(t.month_consult) ? t.month_consult : DAY_CONSULT_TARGET * 31;
  const MONTH_CALL_TARGET = Number.isFinite(t.month_calls) ? t.month_calls : DAY_CALL_TARGET * 31;

  // ── APPOINTMENT STATUS (yesterday, today, next 5 days) ───────────
  const appointmentDays = [-1, 0, 1, 2, 3, 4, 5].map((offset) => {
    const { start, end } = dayWindow(offset);
    const onThisDay = monthLeads.filter((l) =>
      l.appointment_date && new Date(l.appointment_date) >= start && new Date(l.appointment_date) <= end
    );
    // Pull a wider slice for the future days that aren't in monthLeads (next month spillover).
    return {
      offset,
      date: start.toISOString().slice(0, 10),
      day_name: start.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
      booked: onThisDay.length,
      visited: onThisDay.filter((l) => String(l.appointment_status || '').toUpperCase() === 'COMPLETED').length,
      rescheduled: onThisDay.filter((l) => String(l.appointment_status || '').toUpperCase() === 'RESCHEDULED').length,
      not_visited: onThisDay.filter((l) => {
        const s = String(l.appointment_status || '').toUpperCase();
        return s !== 'COMPLETED' && s !== 'RESCHEDULED';
      }).length,
    };
  });

  // Future-day appointments can land in the next month; pull them too.
  const futureRange = dayWindow(5);
  if (futureRange.end > monthEnd) {
    const futureLeads = await Lead.find({
      client: client._id,
      source: 'meta',
      appointment_date: { $gte: targetDate, $lte: futureRange.end },
    })
      .select('appointment_date appointment_status')
      .lean();
    appointmentDays.forEach((row) => {
      if (row.offset <= 0) return;
      const { start, end } = dayWindow(row.offset);
      const onDay = futureLeads.filter((l) =>
        l.appointment_date && new Date(l.appointment_date) >= start && new Date(l.appointment_date) <= end
      );
      row.booked = onDay.length;
      row.visited = onDay.filter((l) => String(l.appointment_status || '').toUpperCase() === 'COMPLETED').length;
      row.rescheduled = onDay.filter((l) => String(l.appointment_status || '').toUpperCase() === 'RESCHEDULED').length;
      row.not_visited = onDay.filter((l) => {
        const s = String(l.appointment_status || '').toUpperCase();
        return s !== 'COMPLETED' && s !== 'RESCHEDULED';
      }).length;
    });
  }

  res.json({
    date: targetDateStr,
    month: targetDateStr.slice(0, 7),
    client_name: client.clientName || '',
    targets: {
      day_consult: DAY_CONSULT_TARGET,
      day_calls: DAY_CALL_TARGET,
      month_consult: MONTH_CONSULT_TARGET,
      month_calls: MONTH_CALL_TARGET,
    },
    day: {
      target_consulted: { target: DAY_CONSULT_TARGET, achieved: consultedDay },
      target_calls: freshCallsDay + callbackCallsDay,
      target_connected: { target: DAY_CALL_TARGET, achieved: freshConnectedDay + callbackConnectedDay },
      leads_abstract: {
        ...bucketCounts,
        total: totalLeadsDay,
        valid: validDay,
        connected: connectedDay,
        not_connected: notConnectedDay,
        connected_pct: validDay > 0 ? Math.round((connectedDay / validDay) * 100) : 0,
        valid_pct: totalLeadsDay > 0 ? Math.round((validDay / totalLeadsDay) * 100) : 0,
      },
      calls: {
        fresh: freshCallsDay,
        callback: callbackCallsDay,
        total: freshCallsDay + callbackCallsDay,
        fresh_connected: freshConnectedDay,
        callback_connected: callbackConnectedDay,
        connected_total: freshConnectedDay + callbackConnectedDay,
      },
      appointments_booked: appointmentsBookedDay,
      consultation: {
        consulted: consultedDay,
        converted: convertedDay,
        converted_value: convertedValueDay,
      },
      // Per-label breakdown of `response_label` for leads touched
      // today. Keys are the exact strings the dropdown shows so the
      // frontend can render them without re-mapping.
      response_breakdown: responseBreakdownDay,
      // Compact projection of every lead touched today. The client
      // portal's EOD renders this as a "Today's Leads" table showing
      // exactly what the telecaller filled in for each lead — Date,
      // Source, Name, Contact, Location, Hair/Skin, First Call Date,
      // Call Label, Response, Remarks, Next Follow-up, Appointment
      // Status, Appt. Date, FU#, and the latest follow-up summary.
      // Limited to leads with same-day activity so the list stays
      // focused on today's work.
      today_leads: dayLeads.map((l) => {
        const followUps = Array.isArray(l.follow_ups) ? l.follow_ups : [];
        const latestFu = followUps.length ? followUps[followUps.length - 1] : null;
        return {
          _id: l._id,
          date: (l.meta_created_time || l.createdAt || null),
          source: l.manual_source_type || l.platform || '',
          form_name: l.meta_form_name || '',
          name: l.name || '',
          phone: l.phone || '',
          email: l.email || '',
          lead_location: l.lead_location || '',
          lead_category: l.lead_category || '',
          first_call_date: l.first_call_date || null,
          first_call_label: l.first_call_label || '',
          response_label: l.response_label || '',
          remarks: l.remarks || '',
          next_followup_date: l.next_followup_date || null,
          appointment_status: l.appointment_status || '',
          appointment_date: l.appointment_date || null,
          fu_count: followUps.length,
          latest_followup: latestFu
            ? {
                date: latestFu.date || null,
                call_label: latestFu.call_label || '',
                remarks: latestFu.remarks || '',
                connected: !!latestFu.connected,
              }
            : null,
          is_duplicate: !!l.is_duplicate,
        };
      }),
    },
    month_target: {
      consulted: {
        target: MONTH_CONSULT_TARGET,
        achieved: consultedMonth,
        projection: project(consultedMonth),
        achieved_pct: MONTH_CONSULT_TARGET > 0 ? Math.round((consultedMonth / MONTH_CONSULT_TARGET) * 100) : 0,
        projection_pct: MONTH_CONSULT_TARGET > 0 ? Math.round((project(consultedMonth) / MONTH_CONSULT_TARGET) * 100) : 0,
      },
      connected: {
        target: MONTH_CALL_TARGET,
        achieved: connectedMonth,
        projection: project(connectedMonth),
        achieved_pct: MONTH_CALL_TARGET > 0 ? Math.round((connectedMonth / MONTH_CALL_TARGET) * 100) : 0,
        projection_pct: MONTH_CALL_TARGET > 0 ? Math.round((project(connectedMonth) / MONTH_CALL_TARGET) * 100) : 0,
      },
    },
    appointment_status: appointmentDays,
  });
};

// PUT /api/meta/client/:clientId/telecalling-targets
// Body: { day_consult, day_calls, month_consult, month_calls }
// Updates the four telecalling targets on the client doc. Each field
// is optional — only the provided keys are written. The full target
// block is returned so the caller can refresh state without a second
// GET.
export const updateTelecallingTargets = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const fields = ['day_consult', 'day_calls', 'month_consult', 'month_calls'];
  if (!client.telecalling_targets) client.telecalling_targets = {};

  fields.forEach((key) => {
    const raw = req.body?.[key];
    if (raw === undefined || raw === null || raw === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw Object.assign(new Error(`Invalid ${key}: must be a non-negative number`), { status: 400 });
    }
    client.telecalling_targets[key] = Math.round(n);
  });

  await client.save();
  res.json({
    success: true,
    targets: {
      day_consult: client.telecalling_targets.day_consult ?? 10,
      day_calls: client.telecalling_targets.day_calls ?? 100,
      month_consult: client.telecalling_targets.month_consult ?? 310,
      month_calls: client.telecalling_targets.month_calls ?? 3100,
    },
  });
};

// GET /api/meta/client/:clientId/monthly-abstract?month=YYYY-MM
//      ?from=YYYY-MM-DD&to=YYYY-MM-DD (overrides month)
// Powers the "Monthly Abstract" sheet AND the per-client Lead Check
// panel — one row per date in the given window, columns for every
// source bucket plus call/appointment/consult/convert counts. When
// `from`+`to` are given, the window is exactly that range; otherwise
// the whole `month` is returned. Returned shape is a flat list of
// rows so the frontend can render the grid without further math.
export const getMonthlyAbstract = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const ym = /^\d{4}-\d{2}$/;

  // Prefer explicit from/to. Fall back to month, then current month.
  let monthStart;
  let monthEnd;
  if (ymd.test(req.query.from || '') && ymd.test(req.query.to || '')) {
    monthStart = new Date(`${req.query.from}T00:00:00.000Z`);
    monthEnd = new Date(`${req.query.to}T23:59:59.999Z`);
    // Guard against a reversed range — swap so the loop below still works.
    if (monthEnd < monthStart) {
      const tmp = monthStart; monthStart = monthEnd; monthEnd = tmp;
    }
  } else {
    const monthStr = ym.test(req.query.month || '')
      ? req.query.month
      : new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split('-').map(Number);
    monthStart = new Date(Date.UTC(year, month - 1, 1));
    monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  }
  // Number of days in the requested window — replaces daysInMonth.
  const daysInMonth = Math.floor((monthEnd - monthStart) / 86400000) + 1;

  // Single fetch: every lead created in this month + every follow-up
  // (need their dates for the call/connect breakdown). Same approach
  // as the daily report — small data set, aggregate in JS.
  const leads = await Lead.find({
    client: client._id,
    source: 'meta',
    $or: [
      { meta_created_time: { $gte: monthStart, $lte: monthEnd } },
      { createdAt: { $gte: monthStart, $lte: monthEnd } },
    ],
  })
    .select('meta_created_time createdAt platform manual_source_type is_duplicate first_call_date first_call_label response_label appointment_booked_date follow_ups name phone email lead_location lead_category telecaller_name remarks next_followup_date appointment_status appointment_date')
    .lean();

  // We also need leads whose first_call_date / follow_up.date fall
  // within the month even if the lead itself was created earlier
  // (call-back rows from previous months). Pull those in addition.
  const olderActivity = await Lead.find({
    client: client._id,
    source: 'meta',
    $or: [
      { first_call_date: { $gte: monthStart, $lte: monthEnd } },
      { 'follow_ups.date': { $gte: monthStart, $lte: monthEnd } },
      { appointment_booked_date: { $gte: monthStart, $lte: monthEnd } },
    ],
    _id: { $nin: leads.map((l) => l._id) },
  })
    .select('meta_created_time createdAt platform manual_source_type is_duplicate first_call_date first_call_label response_label appointment_booked_date follow_ups name phone email lead_location lead_category telecaller_name remarks next_followup_date appointment_status appointment_date')
    .lean();

  const allLeads = leads.concat(olderActivity);

  // Helper: bucket a lead by source for the per-day row.
  const bucketOf = (lead) => {
    if (lead.manual_source_type) return lead.manual_source_type;
    const plat = String(lead.platform || '').toLowerCase();
    if (plat === 'whatsapp') return 'whatsapp';
    if (plat === 'instagram') return 'instagram';
    if (plat === 'facebook') return 'facebook';
    return 'facebook';
  };

  const isConnectedLbl = (lbl) => String(lbl || '').toUpperCase() === 'CONNECTED';
  const isNotConnectedLbl = (lbl) =>
    ['NOT CONNECTED', 'DISCONNECTED', 'RNR', 'BUSY'].includes(String(lbl || '').toUpperCase());

  // Build an empty row template — one entry per UTC date in the month.
  const blankRow = () => ({
    date: '',
    // source buckets (the screenshot's 13 columns before "Total Leads")
    whatsapp: 0, instagram: 0, facebook: 0, google_lead: 0,
    justdial: 0, walk_in: 0, referral: 0, physical_marketing: 0,
    incall_google: 0, incall_fb: 0, incall_insta: 0, incall_self: 0,
    incall: 0,
    // lead status
    total_leads: 0,
    connected: 0,
    not_connected: 0,
    invalid_duplicate: 0,
    // calls
    fresh_calls: 0,
    callback_1: 0,
    callback_2: 0,
    callback_3: 0,
    callback: 0,
    total_calls: 0,
    fresh_calls_connected: 0,
    callback_connected: 0,
    total_connected_calls: 0,
    // appointments + consultation
    total_appointments: 0,
    consulted: 0,
    convert: 0,
    convert_value: 0,
  });

  // Walk the range day-by-day so the rows cover the *requested* window
  // (which may span months when from/to are given) instead of being
  // glued to a single month index.
  const isoDate = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const rows = [];
  for (let i = 0; i < daysInMonth; i += 1) {
    const d = new Date(monthStart);
    d.setUTCDate(d.getUTCDate() + i);
    const row = blankRow();
    row.date = isoDate(d);
    rows.push(row);
  }
  const rowByDate = new Map(rows.map((r) => [r.date, r]));

  const dateKey = (d) => {
    if (!d) return null;
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    const y = x.getUTCFullYear();
    const m = String(x.getUTCMonth() + 1).padStart(2, '0');
    const day = String(x.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Pass 1 — lead-level columns (source bucket, totals, connected/not).
  // Anchored to the lead's *created* date so the source columns line up
  // with the daily lead-volume row.
  allLeads.forEach((lead) => {
    const created = lead.meta_created_time || lead.createdAt;
    const k = dateKey(created);
    const row = k && rowByDate.get(k);
    if (!row) return;
    row.total_leads += 1;
    const b = bucketOf(lead);
    if (b === 'incall_google') { row.incall_google += 1; row.incall += 1; }
    else if (b === 'incall_fb') { row.incall_fb += 1; row.incall += 1; }
    else if (b === 'incall_insta') { row.incall_insta += 1; row.incall += 1; }
    else if (b === 'incall_self') { row.incall_self += 1; row.incall += 1; }
    else if (row[b] != null) row[b] += 1;
    else row.facebook += 1;

    const lbl = String(lead.first_call_label || '').toUpperCase();
    const hasConnectedFollow = (lead.follow_ups || []).some((f) =>
      f.connected || isConnectedLbl(f.call_label)
    );
    if (lbl === 'CONNECTED' || hasConnectedFollow) row.connected += 1;
    else if (isNotConnectedLbl(lbl)) row.not_connected += 1;

    if (lead.is_duplicate || lbl === 'INVALID'
        || String(lead.response_label || '').toUpperCase() === 'DUPLICATE') {
      row.invalid_duplicate += 1;
    }
  });

  // Pass 2 — call activity columns (fresh + callback). Each is
  // anchored to the call's own date, not the lead's created date,
  // so a lead created last month with a follow-up today still adds
  // to today's call totals.
  allLeads.forEach((lead) => {
    const freshK = dateKey(lead.first_call_date);
    if (freshK) {
      const r = rowByDate.get(freshK);
      if (r) {
        r.fresh_calls += 1;
        if (isConnectedLbl(lead.first_call_label)) r.fresh_calls_connected += 1;
      }
    }
    (lead.follow_ups || []).forEach((f, idx) => {
      const k = dateKey(f.date);
      const r = k && rowByDate.get(k);
      if (!r) return;
      // Call-back N column buckets the first three follow-ups; later
      // ones still count toward "Call Back" total.
      if (idx === 0) r.callback_1 += 1;
      else if (idx === 1) r.callback_2 += 1;
      else if (idx === 2) r.callback_3 += 1;
      r.callback += 1;
      if (f.connected || isConnectedLbl(f.call_label)) r.callback_connected += 1;
    });

    // Appointments + consult/convert — anchored to the booked date
    // (when the appointment was created), matching how the screenshot
    // tracks "Total Appointments" per day.
    const bookedK = dateKey(lead.appointment_booked_date);
    if (bookedK) {
      const r = rowByDate.get(bookedK);
      if (r) {
        r.total_appointments += 1;
        const respLbl = String(lead.response_label || '').toUpperCase();
        if (respLbl === 'CONSULTED') r.consulted += 1;
        if (['TREATMENT BOOKED', 'CLOSED'].includes(respLbl)) {
          r.convert += 1;
          // converted_value isn't tracked on Lead yet; leave 0.
        }
      }
    }
  });

  // Finalise computed columns.
  rows.forEach((r) => {
    r.total_calls = r.fresh_calls + r.callback;
    r.total_connected_calls = r.fresh_calls_connected + r.callback_connected;
  });

  // Merge manually-entered values over the auto-computed numbers.
  // `readManualValues` enforces the editable allow-list, so even if
  // someone managed to write an unexpected key to AbstractEntry by
  // hand, it can't bleed into auto-computed columns here.
  const manualEntries = await AbstractEntry.find({
    client: client._id,
    date: { $gte: isoDate(monthStart), $lte: isoDate(monthEnd) },
  }).lean();
  const manualByDate = new Map(
    manualEntries.map((e) => [e.date, readManualValues(e.manualValues)])
  );
  rows.forEach((r) => {
    const overrides = manualByDate.get(r.date);
    if (!overrides) return;
    Object.entries(overrides).forEach(([k, v]) => {
      r[k] = v;
    });
  });

  // Totals row — sum every numeric column across the month.
  const total = blankRow();
  total.date = 'TOTAL';
  Object.keys(total).forEach((k) => {
    if (k === 'date') return;
    total[k] = rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  });

  // Compact projection of every lead in the window — mirrors the
  // `today_leads` shape on the EOD report so the client portal's
  // Monthly Abstract can render the same 15-column table. Limited to
  // leads with `meta_created_time` inside the window (or createdAt
  // fallback) — i.e. the exact same scope as /client-portal/leads.
  const monthLeadsList = allLeads.map((l) => {
    const followUps = Array.isArray(l.follow_ups) ? l.follow_ups : [];
    const latestFu = followUps.length ? followUps[followUps.length - 1] : null;
    return {
      _id: l._id,
      date: (l.meta_created_time || l.createdAt || null),
      source: l.manual_source_type || l.platform || '',
      name: l.name || '',
      phone: l.phone || '',
      email: l.email || '',
      lead_location: l.lead_location || '',
      lead_category: l.lead_category || '',
      first_call_date: l.first_call_date || null,
      first_call_label: l.first_call_label || '',
      response_label: l.response_label || '',
      remarks: l.remarks || '',
      next_followup_date: l.next_followup_date || null,
      appointment_status: l.appointment_status || '',
      appointment_date: l.appointment_date || null,
      fu_count: followUps.length,
      latest_followup: latestFu
        ? {
            date: latestFu.date || null,
            call_label: latestFu.call_label || '',
            remarks: latestFu.remarks || '',
            connected: !!latestFu.connected,
          }
        : null,
      is_duplicate: !!l.is_duplicate,
    };
  });

  res.json({
    // `month` is preserved for backward compat with the Monthly Abstract
    // view (it reads YYYY-MM from the range start).
    month: isoDate(monthStart).slice(0, 7),
    from: isoDate(monthStart),
    to: isoDate(monthEnd),
    client_name: client.clientName || '',
    days_in_month: daysInMonth,
    rows,
    total,
    // Per-lead detail for the whole window — used by the client-portal
    // Monthly Abstract's "Leads this month" table. Same shape as EOD's
    // today_leads so the frontend renders both with one component.
    leads: monthLeadsList,
  });
};

// POST /api/meta/client/:clientId/monthly-abstract/cell
//   body: { date: "YYYY-MM-DD", field: "<editable_key>", value: number }
// Upserts a single manually-entered abstract cell. EDITABLE_ABSTRACT_FIELDS
// (declared near the top of this file) is the allow-list for `field`.
export const saveMonthlyAbstractCell = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const { date, field } = req.body || {};
  const rawValue = req.body?.value;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
  }
  if (!field || !EDITABLE_ABSTRACT_FIELDS.has(field)) {
    return res.status(400).json({ message: `field "${field}" is not editable` });
  }
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num < 0) {
    return res.status(400).json({ message: 'value must be a non-negative number' });
  }

  // Upsert: same (client, date) doc gets new key set; brand-new
  // (client, date) creates a fresh doc with this field as the only key.
  const updatedBy = req.user?.name || req.user?.email || '';
  const updated = await AbstractEntry.findOneAndUpdate(
    { client: client._id, date },
    {
      $set: {
        [`manualValues.${field}`]: num,
        updatedBy,
      },
      $setOnInsert: {
        client: client._id,
        date,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  res.json({
    success: true,
    data: {
      date,
      field,
      value: num,
      manualValues: updated?.manualValues || {},
    },
  });
};
