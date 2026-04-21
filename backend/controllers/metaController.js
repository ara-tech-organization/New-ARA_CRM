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
import BillingTransaction from '../models/BillingTransaction.js';
import {
  syncAllMetaClients,
  syncSingleMetaClient,
  syncByAdAccount,
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
    { new: true }
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
        leads: { $sum: '$leads' },
        messaging_conversations_started: { $sum: '$messaging_conversations_started' },
        rows: { $sum: 1 },
      },
    },
  ]);
  const sum = summaryAgg || {
    spend: 0, impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0,
    leads: 0, messaging_conversations_started: 0, rows: 0,
  };
  const summary = {
    spend: round2(sum.spend),
    impressions: sum.impressions || 0,
    reach: sum.reach || 0,
    clicks: sum.clicks || 0,
    inline_link_clicks: sum.inline_link_clicks || 0,
    leads: sum.leads || 0,
    messaging_conversations_started: sum.messaging_conversations_started || 0,
    ctr: sum.impressions > 0 ? round2((sum.clicks / sum.impressions) * 100) : 0,
    cpc: sum.clicks > 0 ? round2(sum.spend / sum.clicks) : 0,
    cpl: sum.leads > 0 ? round2(sum.spend / sum.leads) : 0,
    cpm: sum.impressions > 0 ? round2((sum.spend / sum.impressions) * 1000) : 0,
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
        leads: { $sum: '$leads' },
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
        leads: 1,
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
        leads: { $sum: '$leads' },
        messaging: { $sum: '$messaging_conversations_started' },
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
      leads: c.leads,
      messaging_conversations_started: c.messaging,
      ctr: c.impressions > 0 ? round2((c.clicks / c.impressions) * 100) : 0,
      cpl: c.leads > 0 ? round2(c.spend / c.leads) : 0,
    };
  });

  // ---- Lead forms ----
  const leadForms = await MetaLeadForm.find({ client_id: clientId })
    .select('form_id name status locale page_id last_seen_at')
    .lean();
  const formLeadCounts = await Lead.aggregate([
    {
      $match: {
        client: clientId,
        source: 'meta',
        createdAt: dateRange,
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

  // ---- Recent leads ----
  const recent_leads = await Lead.find({
    client: clientId,
    source: 'meta',
    createdAt: dateRange,
  })
    .select('name email phone status meta_form_name meta_campaign_id meta_ad_id platform createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // ---- Billing ----
  const billingTxns = await BillingTransaction.find({
    client_id: clientId,
    source: { $in: ['meta_ads_daily_spend', 'meta_ads_refund', 'meta_ads_adjustment'] },
    occurred_at: dateRange,
  })
    .sort({ occurred_at: -1 })
    .limit(500)
    .lean();

  const billing_totals = billingTxns.reduce(
    (acc, t) => {
      if (t.type === 'debit') acc.total_debits = round2(acc.total_debits + t.amount);
      else if (t.type === 'credit') acc.total_credits = round2(acc.total_credits + t.amount);
      return acc;
    },
    { total_debits: 0, total_credits: 0 }
  );

  // ---- Live Meta-side figures ------------------------------------------
  // Meta exposes the prepaid balance + lifetime spend directly, unlike
  // Google Ads. Pull them on every analytics fetch so the frontend always
  // shows current values. `balance` and `amount_spent` come back as paise
  // strings — convert to rupees with 2-decimal precision.
  let meta_account = null;
  if (client.meta_ad_account_id) {
    try {
      const { account } = await verifyAdAccountAccess(client.meta_ad_account_id);
      meta_account = {
        id: account.id,
        name: account.name || '',
        currency: account.currency || '',
        timezone_name: account.timezone_name || '',
        account_status: account.account_status,
        balance: round2(Number(account.balance || 0) / 100),
        amount_spent: round2(Number(account.amount_spent || 0) / 100),
        disable_reason: account.disable_reason ?? 0,
        fetched_at: new Date(),
      };
    } catch (err) {
      meta_account = { error: err.message, fetched_at: new Date() };
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
    recent_leads,
    billing: {
      ...billing_totals,
      available_balance: round2(client.billing?.available_balance),
      total_added_funds: round2(client.billing?.total_added_funds),
      total_spend: round2(client.billing?.total_spend),
      low_balance_threshold: client.billing?.low_balance_threshold || 0,
      meta_live_balance: meta_account?.balance ?? null,
      meta_lifetime_spend: meta_account?.amount_spent ?? null,
      transactions: billingTxns.map((t) => ({
        type: t.type,
        amount: t.amount,
        source: t.source,
        occurred_at: t.occurred_at,
        campaign_id: t.reference?.campaign_id,
        campaign_name: t.reference?.campaign_name,
        metric_date: t.reference?.metric_date,
      })),
    },
    meta_account,
    entity_counts: {
      campaigns: await MetaCampaign.countDocuments({ client_id: clientId }),
      adsets: await MetaAdSet.countDocuments({ client_id: clientId }),
      ads: await MetaAd.countDocuments({ client_id: clientId }),
    },
  });
};
