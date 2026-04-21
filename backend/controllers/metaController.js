// Thin HTTP layer on top of metaSyncService. Phase 3 exposes only the
// read-only sync admin surface; webhook + config endpoints land in later
// phases.

import mongoose from 'mongoose';
import Client from '../models/Client.js';
import MetaSyncRun from '../models/MetaSyncRun.js';
import MetaLeadForm from '../models/MetaLeadForm.js';
import MetaLeadRaw from '../models/MetaLeadRaw.js';
import MetaWebhookRetry from '../models/MetaWebhookRetry.js';
import {
  syncAllMetaClients,
  syncSingleMetaClient,
  syncByAdAccount,
} from '../sync/metaSyncService.js';
import {
  getMetaSyncStatus,
  triggerMetaSyncNow,
} from '../sync/scheduler.js';
import { verifySystemUser, verifyAdAccountAccess } from '../services/metaAdsService.js';
import { ingestLead, enqueueRetry } from '../services/metaLeadService.js';
import { verifyWebhookSignature } from '../utils/metaSignature.js';

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
