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

const loadClientOr404 = async (req, res) => {
  const { clientId } = req.params;
  if (!mongoose.isValidObjectId(clientId)) {
    res.status(400).json({ success: false, message: 'Invalid clientId' });
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

  // ---- Summary (campaign-level only — avoids double-counting adset/ad) ----
  // We break leads into two buckets:
  //   form_leads  = Meta "lead" action (Lead Ads form submissions)
  //   whatsapp_leads = "onsite_conversion.messaging_conversation_started_7d"
  //                    (CTWA conversations; includes Messenger too since Meta
  //                    doesn't separate them without a breakdown parameter)
  //   total_leads = form_leads + whatsapp_leads
  const [summaryAgg] = await MetaInsights.aggregate([
    {
      $match: {
        client_id: clientId,
        level: 'campaign',
        date: dateRange,
      },
    },
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
        conversions: { $sum: '$conversions' },
        video_thruplay: { $sum: '$video_thruplay' },
        rows: { $sum: 1 },
      },
    },
  ]);
  const sum = summaryAgg || {
    spend: 0, impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0,
    form_leads: 0, whatsapp_leads: 0, conversions: 0, video_thruplay: 0, rows: 0,
  };
  const totalLeads = (sum.form_leads || 0) + (sum.whatsapp_leads || 0);
  const summary = {
    // Money
    spend: round2(sum.spend),
    // Audience
    impressions: sum.impressions || 0,
    reach: sum.reach || 0,
    // Actions
    clicks: sum.clicks || 0,
    inline_link_clicks: sum.inline_link_clicks || 0,
    video_thruplay: sum.video_thruplay || 0,
    // Lead breakdown
    form_leads: sum.form_leads || 0,
    whatsapp_leads: sum.whatsapp_leads || 0,
    total_leads: totalLeads,
    conversions: sum.conversions || 0,
    // KPIs
    ctr: sum.impressions > 0 ? round2((sum.clicks / sum.impressions) * 100) : 0,
    cpc: sum.clicks > 0 ? round2(sum.spend / sum.clicks) : 0,
    cpm: sum.impressions > 0 ? round2((sum.spend / sum.impressions) * 1000) : 0,
    // Cost per lead, per bucket
    cpl_form: sum.form_leads > 0 ? round2(sum.spend / sum.form_leads) : 0,
    cpl_whatsapp: sum.whatsapp_leads > 0 ? round2(sum.spend / sum.whatsapp_leads) : 0,
    cpl: totalLeads > 0 ? round2(sum.spend / totalLeads) : 0,
    // Legacy aliases (old field names — keep until frontend migrates)
    leads: totalLeads,
    messaging_conversations_started: sum.whatsapp_leads || 0,
  };

  // ---- Daily trend (one row per day) ----
  const dailyTrend = await MetaInsights.aggregate([
    {
      $match: {
        client_id: clientId,
        level: 'campaign',
        date: dateRange,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
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
        impressions: 1,
        clicks: 1,
        form_leads: 1,
        whatsapp_leads: 1,
        total_leads: { $add: ['$form_leads', '$whatsapp_leads'] },
        // legacy alias
        leads: { $add: ['$form_leads', '$whatsapp_leads'] },
      },
    },
  ]);

  // ---- Campaign breakdown ----
  const campaignAgg = await MetaInsights.aggregate([
    {
      $match: {
        client_id: clientId,
        level: 'campaign',
        date: dateRange,
      },
    },
    {
      $group: {
        _id: '$entity_id',
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        form_leads: { $sum: '$leads' },
        whatsapp_leads: { $sum: '$messaging_conversations_started' },
      },
    },
    { $sort: { spend: -1 } },
  ]);

  const campaignIds = campaignAgg.map((c) => c._id);
  const campaignDocs = await MetaCampaign.find({ campaign_id: { $in: campaignIds } })
    .select('campaign_id name status objective effective_status daily_budget')
    .lean();
  const campaignById = new Map(campaignDocs.map((c) => [c.campaign_id, c]));

  const campaigns = campaignAgg.map((c) => {
    const doc = campaignById.get(c._id) || {};
    const totalLeads = (c.form_leads || 0) + (c.whatsapp_leads || 0);
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
      form_leads: c.form_leads || 0,
      whatsapp_leads: c.whatsapp_leads || 0,
      total_leads: totalLeads,
      ctr: c.impressions > 0 ? round2((c.clicks / c.impressions) * 100) : 0,
      cpl_form: c.form_leads > 0 ? round2(c.spend / c.form_leads) : 0,
      cpl_whatsapp: c.whatsapp_leads > 0 ? round2(c.spend / c.whatsapp_leads) : 0,
      cpl: totalLeads > 0 ? round2(c.spend / totalLeads) : 0,
      // legacy aliases
      leads: totalLeads,
      messaging_conversations_started: c.whatsapp_leads || 0,
    };
  });

  // ---- Lead forms ----
  // Lead date filter: prefer Meta's authoritative `meta_created_time`
  // (when the user actually submitted the form), fall back to our `createdAt`
  // (ingestion time) only for legacy rows that predate the backfill.
  const leadDateFilter = {
    $or: [
      { meta_created_time: dateRange },
      { meta_created_time: null, createdAt: dateRange },
    ],
  };

  const leadForms = await MetaLeadForm.find({ client_id: clientId })
    .select('form_id name status locale page_id last_seen_at')
    .lean();
  const formLeadCounts = await Lead.aggregate([
    {
      $match: {
        client: clientId,
        source: 'meta',
        ...leadDateFilter,
      },
    },
    { $group: { _id: '$meta_form_id', count: { $sum: 1 } } },
  ]);
  const leadCountByForm = new Map(formLeadCounts.map((r) => [r._id, r.count]));
  const lead_forms = leadForms.map((f) => ({
    form_id: f.form_id,
    name: f.name,
    status: f.status,
    page_id: f.page_id,
    leads_in_range: leadCountByForm.get(f.form_id) || 0,
    last_seen_at: f.last_seen_at,
  }));

  // ---- Leads in range ----
  // Filter by Meta's `meta_created_time` (actual form submission), not our
  // `createdAt` (DB ingestion), so leads synced late still land in the right
  // window. Mirrors the filter used for `lead_forms.leads_in_range`.
  const leads_in_range = await Lead.find({
    client: clientId,
    source: 'meta',
    ...leadDateFilter,
  })
    .select('name email phone status meta_form_id meta_form_name meta_campaign_id meta_adset_id meta_ad_id platform createdAt meta_created_time raw_field_data utm_source utm_medium utm_campaign utm_content utm_term is_duplicate lead_location lead_category telecaller_name first_call_date first_call_label response_label remarks next_followup_date appointment_status appointment_date appointment_booked_date follow_ups')
    .sort({ meta_created_time: -1, createdAt: -1 })
    .lean();

  // ---- Live Meta-side figures ------------------------------------------
  // Meta exposes the prepaid balance + lifetime spend directly, unlike
  // Google Ads. Pull them on every analytics fetch so the frontend always
  // shows current values. `balance` and `amount_spent` come back as paise
  // strings — convert to rupees with 2-decimal precision.
  let meta_account = null;
  if (client.meta_ad_account_id) {
    // Fields persisted on the Client document — used both as a defensive
    // fallback when the live Meta verify fails AND to backfill any keys
    // the live call doesn't return (e.g. timezone_name has been observed
    // missing on freshly synced accounts). The admin Ads page reads
    // these directly from its cached client list, which is why this
    // panel never goes blank there. The client portal only sees the API
    // response, so we have to do the merge here.
    const persisted = {
      id: client.meta_ad_account_id || '',
      name: client.meta_ad_account_name || '',
      currency: client.meta_ad_account_currency || '',
      timezone_name: client.meta_ad_account_timezone || '',
    };
    try {
      const { account } = await verifyAdAccountAccess(client.meta_ad_account_id);
      meta_account = {
        id: account.id || persisted.id,
        name: account.name || persisted.name,
        currency: account.currency || persisted.currency,
        timezone_name: account.timezone_name || persisted.timezone_name,
        account_status: account.account_status,
        balance: round2(Number(account.balance || 0) / 100),
        amount_spent: round2(Number(account.amount_spent || 0) / 100),
        disable_reason: account.disable_reason ?? 0,
        fetched_at: new Date(),
      };
    } catch (err) {
      // Live verify failed — keep whatever the Client doc has so the
      // portal's Meta panel still renders Ad Account / Currency / TZ.
      meta_account = {
        ...persisted,
        error: err.message,
        fetched_at: new Date(),
      };
    }
  }

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
    lead_forms,
    leads_in_range,
    meta_account,
    entity_counts: {
      campaigns: await MetaCampaign.countDocuments({ client_id: clientId }),
      adsets: await MetaAdSet.countDocuments({ client_id: clientId }),
      ads: await MetaAd.countDocuments({ client_id: clientId }),
    },
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

  const { name, phone, email, ...rest } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Name is required' });
  }
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ success: false, message: 'Phone is required' });
  }

  // Lead schema requires email — for manual WhatsApp leads we synthesize
  // a placeholder so the row passes validation. The placeholder is
  // recognisable (contains "manual-whatsapp") so future cleanup scripts
  // can find these rows. If a real email is supplied, use it.
  const cleanEmail = String(email || '').trim().toLowerCase();
  const finalEmail = cleanEmail
    || `manual-whatsapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@placeholder.invalid`;

  const doc = {
    client: client._id,
    source: 'meta',
    platform: 'whatsapp',
    name: String(name).trim(),
    email: finalEmail,
    phone: String(phone).trim(),
    meta_form_name: 'WhatsApp (manual entry)',
    // Treat the create timestamp as the "received" time. Any synced lead
    // gets meta_created_time from Meta's `leadgen.created_time`; manual
    // entries don't have one, so we set it to "now" so they sort
    // alongside same-day synced rows.
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
