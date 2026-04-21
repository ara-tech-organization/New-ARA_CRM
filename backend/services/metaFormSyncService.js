// Form discovery + lead polling.
//
// Two jobs:
//   1. syncFormsForClient(client)
//      Enumerate every Page the client owns, list its leadgen_forms, upsert
//      rows in MetaLeadForm. New forms land with client_id pre-filled so the
//      normal ingest path can match them immediately.
//
//   2. pollLeadsForClient(client, {run})
//      For each form with a known client_id, pull leads created after the
//      last poll cursor and hand them to metaLeadService.ingestLead. This is
//      the safety net for missed webhooks.

import MetaLeadForm from '../models/MetaLeadForm.js';
import { fetchLeadForms, fetchLeadsForForm } from './metaAdsService.js';
import { ingestLead } from './metaLeadService.js';
import { decrypt } from '../utils/encryption.js';

const decryptPageToken = (page) => {
  if (!page?.encrypted_access_token) return '';
  try {
    return decrypt(page.encrypted_access_token);
  } catch {
    return '';
  }
};

// Upsert one form + return the MetaLeadForm doc.
const upsertForm = async ({ clientId, pageId, form }) => {
  const questionSchema = Array.isArray(form.questions)
    ? form.questions.map((q) => ({
        key: q.key || '',
        label: q.label || '',
        type: q.type || '',
        options: Array.isArray(q.options) ? q.options.map((o) => o?.value ?? String(o)) : [],
      }))
    : [];

  return MetaLeadForm.findOneAndUpdate(
    { form_id: form.id },
    {
      $setOnInsert: {
        form_id: form.id,
        // Only bind client_id on first insert so admins can re-assign later
        // without sync clobbering their choice.
        client_id: clientId,
      },
      $set: {
        page_id: pageId,
        name: form.name || '',
        status: form.status || '',
        locale: form.locale || '',
        question_schema: questionSchema,
        leads_count: typeof form.leads_count === 'number' ? form.leads_count : undefined,
        last_seen_at: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );
};

/**
 * List every leadgen form on every Page the client has configured.
 * Returns { formsSeen, errors }.
 */
export const syncFormsForClient = async (client) => {
  if (!client?.meta_pages?.length) return { formsSeen: 0, errors: [] };

  let formsSeen = 0;
  const errors = [];

  for (const page of client.meta_pages) {
    const pageToken = decryptPageToken(page);
    if (!pageToken) {
      errors.push({ page_id: page.page_id, message: 'page token unavailable' });
      continue;
    }
    try {
      const { data: forms } = await fetchLeadForms(page.page_id, pageToken);
      for (const form of forms) {
        if (!form?.id) continue;
        await upsertForm({ clientId: client._id, pageId: page.page_id, form });
        formsSeen++;
      }
    } catch (err) {
      errors.push({ page_id: page.page_id, message: err?.message || String(err) });
    }
  }

  return { formsSeen, errors };
};

/**
 * Poll each mapped form for new leads since the last poll.
 * Ingests each lead via the same metaLeadService.ingestLead used by webhooks.
 * Errors on a single form are collected — other forms continue.
 */
export const pollLeadsForClient = async (client, { run } = {}) => {
  if (!client?.meta_pages?.length) return { fetched: 0, inserted: 0, errors: [] };

  const forms = await MetaLeadForm.find({ client_id: client._id });
  const pageTokenByPageId = new Map();
  for (const page of client.meta_pages) {
    pageTokenByPageId.set(page.page_id, decryptPageToken(page));
  }

  let fetched = 0;
  let inserted = 0;
  const errors = [];

  for (const form of forms) {
    const pageToken = pageTokenByPageId.get(form.page_id);
    if (!pageToken) {
      errors.push({ form_id: form.form_id, message: 'no Page token' });
      continue;
    }

    // Pull everything created after the last successful poll. On first run
    // last_polled_at is unset so we pull everything — Meta limits leadgen
    // retention to 90 days anyway.
    const sinceTs = form.last_polled_at
      ? Math.floor(new Date(form.last_polled_at).getTime() / 1000)
      : 0;

    let leads = [];
    try {
      const result = await fetchLeadsForForm(form.form_id, pageToken, sinceTs);
      leads = result.data || [];
      fetched += leads.length;
    } catch (err) {
      errors.push({ form_id: form.form_id, message: err?.message || String(err) });
      continue;
    }

    for (const apiLead of leads) {
      try {
        const result = await ingestLead({
          leadgenId: apiLead.id,
          pageId: form.page_id,
          formId: form.form_id,
          adId: apiLead.ad_id,
          adsetId: apiLead.adset_id,
          campaignId: apiLead.campaign_id,
          source: 'poll',
          rawPayload: apiLead,
        });
        if (result.status === 'processed') inserted++;
      } catch (err) {
        errors.push({
          form_id: form.form_id,
          leadgen_id: apiLead?.id,
          message: err?.message || String(err),
        });
      }
    }

    form.last_polled_at = new Date();
    await form.save().catch(() => {});
  }

  if (run) {
    run.counts.leads_fetched += fetched;
    run.counts.leads_inserted += inserted;
    run.counts.forms += forms.length;
  }

  return { fetched, inserted, errors };
};
