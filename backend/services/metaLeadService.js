// Lead ingestion — the path every Meta lead flows through, whether it came
// from a webhook push or a scheduled poll.
//
// Core invariant: idempotent on `leadgen_id`.
//   - MetaLeadRaw is the audit trail (one row per leadgen_id, ever)
//   - Lead collection has unique sparse index on meta_leadgen_id
//   - Re-delivering the same webhook is a no-op
//
// Flow:
//   1. Upsert MetaLeadRaw (source = 'webhook' | 'poll' | 'manual')
//   2. Resolve client_id via MetaLeadForm.form_id lookup
//      - Unmapped forms: mark raw as unprocessed, return early
//   3. Fetch Page access token from Client.meta_pages
//   4. Call Graph API /{leadgen_id} to pull field_data
//   5. Map field_data → Lead shape, upsert Lead
//   6. Mark raw processed, link to Lead._id
//
// On unrecoverable failure during step 3+, the raw is kept; an error string
// is recorded; and the leadgen_id is pushed into MetaWebhookRetry for the
// background worker to retry later.

import Client from '../models/Client.js';
import Lead from '../models/Lead.js';
import MetaLeadForm from '../models/MetaLeadForm.js';
import MetaLeadRaw from '../models/MetaLeadRaw.js';
import MetaWebhookRetry from '../models/MetaWebhookRetry.js';
import { fetchSingleLead } from './metaAdsService.js';
import { mapLeadgenFields, extractUtmParams, detectPlatform } from '../utils/metaFieldMapper.js';
import { decrypt } from '../utils/encryption.js';
import { MetaApiError } from './metaErrors.js';

// Exponential backoff for MetaWebhookRetry: 1m, 5m, 15m, 1h, 6h, give up.
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
];
const MAX_RETRY_ATTEMPTS = RETRY_DELAYS_MS.length;

const pickPageFromClient = (client, pageId) => {
  if (!client?.meta_pages?.length) return null;
  return client.meta_pages.find((p) => p.page_id === pageId) || null;
};

const decryptPageToken = (page) => {
  if (!page?.encrypted_access_token) return '';
  try {
    return decrypt(page.encrypted_access_token);
  } catch (err) {
    throw new Error(`Failed to decrypt Page token for page_id=${page.page_id}: ${err.message}`);
  }
};

// Upsert MetaLeadRaw — the immutable audit entry for this leadgen_id.
// Returns the doc. Uses upsert-on-leadgen_id so re-delivery is a no-op.
const upsertRaw = async ({
  leadgenId,
  pageId,
  formId,
  adId,
  adsetId,
  campaignId,
  source,
  rawPayload,
}) => {
  const update = {
    $setOnInsert: {
      leadgen_id: leadgenId,
      received_at: new Date(),
      source,
    },
    $set: {
      ...(pageId ? { page_id: pageId } : {}),
      ...(formId ? { form_id: formId } : {}),
      ...(adId ? { ad_id: adId } : {}),
      ...(adsetId ? { adset_id: adsetId } : {}),
      ...(campaignId ? { campaign_id: campaignId } : {}),
      ...(rawPayload ? { raw_payload: rawPayload } : {}),
    },
  };
  return MetaLeadRaw.findOneAndUpdate({ leadgen_id: leadgenId }, update, {
    upsert: true,
    returnDocument: "after",
  });
};

const markRawProcessed = async (rawDoc, { leadId, error } = {}) => {
  rawDoc.processed = !error;
  rawDoc.processed_at = new Date();
  if (leadId) rawDoc.lead_id = leadId;
  if (error) rawDoc.error = String(error).slice(0, 2000);
  await rawDoc.save();
};

const writeLead = async ({ raw, client, formDoc, apiLead }) => {
  const mapped = mapLeadgenFields(apiLead?.field_data || []);
  const utm = extractUtmParams(apiLead?.tracking_parameters || []);
  const platform = detectPlatform(apiLead);

  const email = mapped.email || `noemail+${raw.leadgen_id}@meta-lead.local`;
  const name = mapped.name || `Meta Lead ${raw.leadgen_id}`;

  const update = {
    $setOnInsert: {
      meta_leadgen_id: raw.leadgen_id,
      source: 'meta',
      status: 'new',
      value: 0,
    },
    $set: {
      name,
      email,
      phone: mapped.phone || '',
      company: mapped.company || '',
      client: client?._id || null,
      meta_form_id: raw.form_id || apiLead?.form_id || '',
      meta_form_name: formDoc?.name || '',
      meta_campaign_id: apiLead?.campaign_id || raw.campaign_id || '',
      meta_adset_id: apiLead?.adset_id || raw.adset_id || '',
      meta_ad_id: apiLead?.ad_id || raw.ad_id || '',
      platform,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
      raw_field_data: apiLead?.field_data || [],
    },
  };

  return Lead.findOneAndUpdate({ meta_leadgen_id: raw.leadgen_id }, update, {
    upsert: true,
    returnDocument: "after",
  });
};

// -- public API --------------------------------------------------------------

/**
 * Resolve the client owning a given form. Returns { client, formDoc } or
 * nulls if unmapped — caller decides whether to queue a retry or let it sit.
 */
export const resolveFormOwner = async (formId) => {
  if (!formId) return { client: null, formDoc: null };
  const formDoc = await MetaLeadForm.findOne({ form_id: formId });
  if (!formDoc || !formDoc.client_id) return { client: null, formDoc };
  const client = await Client.findById(formDoc.client_id);
  return { client, formDoc };
};

/**
 * Main ingest path. Shared between webhook and poller.
 *
 * @param {object} args
 * @param {string} args.leadgenId      (required)
 * @param {string} args.pageId         (required; used to pick the Page token)
 * @param {string} [args.formId]       Optional hint; resolved from form lookup
 * @param {string} [args.adId]
 * @param {string} [args.adsetId]
 * @param {string} [args.campaignId]
 * @param {string} args.source         'webhook' | 'poll' | 'manual'
 * @param {object} [args.rawPayload]   Entire webhook/poll envelope for audit
 * @param {string} [args.pageAccessTokenOverride] Smoke-test path: skip Client lookup
 * @returns {{ status: 'processed'|'unmapped'|'deferred'|'duplicate', raw, lead? }}
 */
export const ingestLead = async ({
  leadgenId,
  pageId,
  formId,
  adId,
  adsetId,
  campaignId,
  source,
  rawPayload,
  pageAccessTokenOverride,
}) => {
  if (!leadgenId) throw new Error('ingestLead: leadgenId required');
  if (!['webhook', 'poll', 'manual'].includes(source)) {
    throw new Error(`ingestLead: invalid source=${source}`);
  }

  const raw = await upsertRaw({
    leadgenId,
    pageId,
    formId,
    adId,
    adsetId,
    campaignId,
    source,
    rawPayload,
  });

  if (raw.processed) {
    return { status: 'duplicate', raw };
  }

  // Resolve client + page token.
  let client = null;
  let formDoc = null;
  let pageToken = pageAccessTokenOverride || '';

  if (!pageAccessTokenOverride) {
    const resolution = await resolveFormOwner(formId || raw.form_id);
    client = resolution.client;
    formDoc = resolution.formDoc;

    if (!client) {
      // Unmapped form — surface in admin, don't retry (nothing to retry).
      raw.error = formDoc
        ? `Form ${formId} has no client_id assigned`
        : `Form ${formId} not found in MetaLeadForm`;
      await raw.save();
      return { status: 'unmapped', raw };
    }

    const page = pickPageFromClient(client, pageId || raw.page_id);
    if (!page) {
      raw.error = `Client ${client._id} has no meta_pages entry for page_id=${pageId}`;
      await raw.save();
      return { status: 'unmapped', raw };
    }

    try {
      pageToken = decryptPageToken(page);
    } catch (err) {
      await markRawProcessed(raw, { error: err.message });
      return { status: 'deferred', raw };
    }

    if (!pageToken) {
      raw.error = `Empty Page access token for page_id=${pageId}`;
      await raw.save();
      return { status: 'deferred', raw };
    }
  }

  // Fetch the actual lead content.
  let apiLead;
  try {
    const { lead } = await fetchSingleLead(raw.leadgen_id, pageToken);
    apiLead = lead;
  } catch (err) {
    await markRawProcessed(raw, { error: err.message });
    await enqueueRetry({
      leadgenId: raw.leadgen_id,
      pageId: raw.page_id,
      formId: raw.form_id,
      payload: rawPayload,
      lastError: err.message,
    });
    return { status: 'deferred', raw };
  }

  // Upsert Lead.
  try {
    const lead = await writeLead({ raw, client, formDoc, apiLead });
    await markRawProcessed(raw, { leadId: lead._id });

    if (formDoc) {
      formDoc.last_seen_at = new Date();
      await formDoc.save().catch(() => {}); // best-effort
    }

    return { status: 'processed', raw, lead };
  } catch (err) {
    await markRawProcessed(raw, { error: err.message });
    return { status: 'deferred', raw };
  }
};

// -- retry queue -------------------------------------------------------------

export const enqueueRetry = async ({
  leadgenId,
  pageId = '',
  formId = '',
  payload = null,
  lastError = '',
}) => {
  const existing = await MetaWebhookRetry.findOne({ leadgen_id: leadgenId, status: 'pending' });
  if (existing) {
    existing.attempts += 1;
    if (existing.attempts >= MAX_RETRY_ATTEMPTS) {
      existing.status = 'abandoned';
    } else {
      existing.next_attempt_at = new Date(
        Date.now() + RETRY_DELAYS_MS[Math.min(existing.attempts, RETRY_DELAYS_MS.length - 1)]
      );
    }
    existing.last_error = String(lastError).slice(0, 2000);
    await existing.save();
    return existing;
  }
  return MetaWebhookRetry.create({
    leadgen_id: leadgenId,
    page_id: pageId,
    form_id: formId,
    payload,
    attempts: 1,
    next_attempt_at: new Date(Date.now() + RETRY_DELAYS_MS[0]),
    last_error: String(lastError).slice(0, 2000),
    status: 'pending',
  });
};

/**
 * Background worker tick — processes any retry rows that are due.
 * Returns a small summary for logging.
 */
export const processRetries = async (limit = 50) => {
  const due = await MetaWebhookRetry.find({
    status: 'pending',
    next_attempt_at: { $lte: new Date() },
  })
    .sort({ next_attempt_at: 1 })
    .limit(limit);

  let processed = 0;
  let requeued = 0;
  let resolved = 0;
  let abandoned = 0;

  for (const entry of due) {
    processed++;
    try {
      const result = await ingestLead({
        leadgenId: entry.leadgen_id,
        pageId: entry.page_id,
        formId: entry.form_id,
        source: 'webhook',
        rawPayload: entry.payload,
      });

      if (result.status === 'processed' || result.status === 'duplicate') {
        entry.status = 'resolved';
        entry.resolved_at = new Date();
        await entry.save();
        resolved++;
      } else if (result.status === 'unmapped') {
        // Not a retryable failure — leave the raw surfaced for admin; drop the
        // retry row so we don't keep trying what will never succeed.
        entry.status = 'abandoned';
        entry.last_error = 'Unmapped form — requires admin assignment';
        await entry.save();
        abandoned++;
      } else {
        entry.attempts += 1;
        if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
          entry.status = 'abandoned';
          abandoned++;
        } else {
          entry.next_attempt_at = new Date(
            Date.now() + RETRY_DELAYS_MS[Math.min(entry.attempts, RETRY_DELAYS_MS.length - 1)]
          );
          requeued++;
        }
        await entry.save();
      }
    } catch (err) {
      entry.attempts += 1;
      entry.last_error = String(err?.message || err).slice(0, 2000);
      if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
        entry.status = 'abandoned';
        abandoned++;
      } else {
        entry.next_attempt_at = new Date(
          Date.now() + RETRY_DELAYS_MS[Math.min(entry.attempts, RETRY_DELAYS_MS.length - 1)]
        );
        requeued++;
      }
      await entry.save();
    }
  }

  return { processed, resolved, requeued, abandoned };
};

export const __testing = {
  upsertRaw,
  writeLead,
  MAX_RETRY_ATTEMPTS,
};
