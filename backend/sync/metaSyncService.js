// Meta sync orchestrator — pulls campaigns, ad sets, ads, and daily insights
// for every Meta-enabled client, upserts them into Mongo, and records a
// MetaSyncRun row per invocation for observability.
//
// Scope (Phase 3): READ-ONLY. No lead ingestion (Phase 4), no billing
// reconciliation (Phase 5). Failures are caught per-stage and per-client so
// one broken account never stops the whole run.

import crypto from 'crypto';
import Client from '../models/Client.js';
import MetaCampaign from '../models/MetaCampaign.js';
import MetaAdSet from '../models/MetaAdSet.js';
import MetaAd from '../models/MetaAd.js';
import MetaInsights from '../models/MetaInsights.js';
import MetaSyncRun from '../models/MetaSyncRun.js';
import {
  fetchCampaigns,
  fetchAdSets,
  fetchAds,
  fetchInsights,
  verifyAdAccountAccess,
} from '../services/metaAdsService.js';
import { MetaApiError } from '../services/metaErrors.js';
import {
  syncFormsForClient,
  pollLeadsForClient,
} from '../services/metaFormSyncService.js';

const INSIGHTS_BACKFILL_DAYS = parseInt(process.env.META_INSIGHTS_BACKFILL_DAYS, 10) || 90;

const newRunId = () => `meta-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

const ymd = (date) => new Date(date).toISOString().slice(0, 10);

const toDateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Meta returns `daily_budget` etc. in minor units (paise for INR). Divide by
// 100 to store in currency-native units matching how DailyLeadData does it.
const fromMinorUnits = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : 0;
};

// Pull a specific action_type value out of Meta's `actions` array.
const actionValue = (actions, actionType) => {
  if (!Array.isArray(actions)) return 0;
  const hit = actions.find((a) => a?.action_type === actionType);
  return hit ? toNumber(hit.value) : 0;
};

// Flatten Meta's actions array into {action_type: value} for compact storage.
const flattenActions = (actions) => {
  if (!Array.isArray(actions)) return {};
  const out = {};
  for (const a of actions) {
    if (a?.action_type) out[a.action_type] = toNumber(a.value);
  }
  return out;
};

// Always pull the last META_INSIGHTS_BACKFILL_DAYS (default 90).
// Onboard date no longer floors the window — operators want full history
// regardless of when a given client was linked in the CRM.
const pickInsightsWindow = () => {
  const today = new Date();
  const until = ymd(today);
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - INSIGHTS_BACKFILL_DAYS);
  return { since: ymd(since), until };
};

// -- Upsert helpers ---------------------------------------------------------

const upsertCampaigns = async (clientId, adAccountId, campaigns) => {
  let count = 0;
  for (const c of campaigns) {
    if (!c?.id) continue;
    await MetaCampaign.findOneAndUpdate(
      { campaign_id: c.id },
      {
        client_id: clientId,
        ad_account_id: adAccountId,
        campaign_id: c.id,
        name: c.name || '',
        objective: c.objective || '',
        status: c.status || '',
        effective_status: c.effective_status || '',
        daily_budget: fromMinorUnits(c.daily_budget),
        lifetime_budget: fromMinorUnits(c.lifetime_budget),
        buying_type: c.buying_type || '',
        special_ad_categories: Array.isArray(c.special_ad_categories)
          ? c.special_ad_categories
          : [],
        start_time: toDateOrNull(c.start_time),
        stop_time: toDateOrNull(c.stop_time),
        last_synced_at: new Date(),
      },
      { upsert: true, returnDocument: "after" }
    );
    count++;
  }
  return count;
};

const upsertAdSets = async (clientId, adAccountId, adsets) => {
  let count = 0;
  for (const s of adsets) {
    if (!s?.id || !s?.campaign_id) continue;
    await MetaAdSet.findOneAndUpdate(
      { adset_id: s.id },
      {
        client_id: clientId,
        ad_account_id: adAccountId,
        campaign_id: s.campaign_id,
        adset_id: s.id,
        name: s.name || '',
        status: s.status || '',
        effective_status: s.effective_status || '',
        daily_budget: fromMinorUnits(s.daily_budget),
        lifetime_budget: fromMinorUnits(s.lifetime_budget),
        optimization_goal: s.optimization_goal || '',
        billing_event: s.billing_event || '',
        bid_strategy: s.bid_strategy || '',
        targeting_summary: s.targeting || null,
        start_time: toDateOrNull(s.start_time),
        end_time: toDateOrNull(s.end_time),
        last_synced_at: new Date(),
      },
      { upsert: true, returnDocument: "after" }
    );
    count++;
  }
  return count;
};

const upsertAds = async (clientId, adAccountId, ads) => {
  let count = 0;
  for (const a of ads) {
    if (!a?.id || !a?.adset_id) continue;
    await MetaAd.findOneAndUpdate(
      { ad_id: a.id },
      {
        client_id: clientId,
        ad_account_id: adAccountId,
        campaign_id: a.campaign_id || '',
        adset_id: a.adset_id,
        ad_id: a.id,
        name: a.name || '',
        status: a.status || '',
        effective_status: a.effective_status || '',
        creative_id: a.creative?.id || '',
        preview_shareable_link: a.preview_shareable_link || '',
        tracking_specs: a.tracking_specs || null,
        last_synced_at: new Date(),
      },
      { upsert: true, returnDocument: "after" }
    );
    count++;
  }
  return count;
};

const upsertInsights = async (clientId, adAccountId, rows, level) => {
  let count = 0;
  for (const r of rows) {
    const entityId =
      level === 'ad' ? r.ad_id :
      level === 'adset' ? r.adset_id :
      level === 'campaign' ? r.campaign_id :
      adAccountId;

    if (!entityId || !r.date_start) continue;

    const actions = flattenActions(r.actions);
    const actionValues = flattenActions(r.action_values);
    const costPerAction = flattenActions(r.cost_per_action_type);

    await MetaInsights.findOneAndUpdate(
      { client_id: clientId, entity_id: entityId, date: new Date(r.date_start) },
      {
        client_id: clientId,
        ad_account_id: adAccountId,
        level,
        entity_id: entityId,
        campaign_id: r.campaign_id || '',
        adset_id: r.adset_id || '',
        ad_id: r.ad_id || '',
        date: new Date(r.date_start),
        impressions: toNumber(r.impressions),
        reach: toNumber(r.reach),
        frequency: toNumber(r.frequency),
        clicks: toNumber(r.clicks),
        unique_clicks: toNumber(r.unique_clicks),
        inline_link_clicks: toNumber(r.inline_link_clicks),
        spend: toNumber(r.spend),
        cpm: toNumber(r.cpm),
        cpc: toNumber(r.cpc),
        ctr: toNumber(r.ctr),
        actions,
        action_values: actionValues,
        cost_per_action_type: costPerAction,
        leads: actionValue(r.actions, 'lead'),
        messaging_conversations_started: actionValue(
          r.actions,
          'onsite_conversion.messaging_conversation_started_7d'
        ),
        conversions: toNumber(r.conversions),
        conversion_values: toNumber(r.conversion_values),
        video_thruplay: actionValue(
          r.video_thruplay_watched_actions,
          'video_view'
        ),
        currency: r.account_currency || '',
        last_synced_at: new Date(),
      },
      { upsert: true, returnDocument: "after" }
    );
    count++;
  }
  return count;
};

// -- Core sync routines -----------------------------------------------------

/**
 * Low-level sync: operates on raw IDs so the Phase 3 smoke test can target an
 * ad account before any Client doc has `meta_enabled=true`.
 *
 * @param {object} args
 * @param {string} args.adAccountId   Must start with "act_"
 * @param {string|null} args.clientId Mongo ObjectId (string) or null — null
 *   writes rows with `client_id: null` which makes them easy to clean up.
 * @param {Date|string|null} args.onboardedAt Anchor for deep window
 * @param {boolean} args.deep        True → from onboardedAt, false → 30d
 * @param {object} args.run          MetaSyncRun doc to accumulate counts into
 * @param {string} args.label        Pretty label for logs
 */
export const syncByAdAccount = async ({
  adAccountId,
  clientId = null,
  onboardedAt = null,
  deep = false,
  run,
  label = adAccountId,
}) => {
  const stages = [];
  const pushError = (stage, err) => {
    const msg = err?.message || String(err);
    run.errors.push({
      client_id: clientId,
      stage,
      message: msg,
      code: err?.code ? String(err.code) : '',
      at: new Date(),
    });
    stages.push({ stage, status: 'failed', message: msg });
    console.error(`[meta-sync] ${label}: ${stage} failed — ${msg}`);
  };

  // 0. Verify access first — fast failure if ad account is unreachable
  try {
    await verifyAdAccountAccess(adAccountId);
    stages.push({ stage: 'verify', status: 'ok' });
  } catch (err) {
    pushError('verify', err);
    return { ok: false, stages };
  }

  // 1. Campaigns
  try {
    const { data } = await fetchCampaigns(adAccountId);
    const n = await upsertCampaigns(clientId, adAccountId, data);
    run.counts.campaigns += n;
    stages.push({ stage: 'campaigns', status: 'ok', count: n });
    console.log(`[meta-sync] ${label}: campaigns upserted=${n}`);
  } catch (err) {
    pushError('campaigns', err);
  }

  // 2. Ad sets
  try {
    const { data } = await fetchAdSets(adAccountId);
    const n = await upsertAdSets(clientId, adAccountId, data);
    run.counts.adsets += n;
    stages.push({ stage: 'adsets', status: 'ok', count: n });
    console.log(`[meta-sync] ${label}: adsets upserted=${n}`);
  } catch (err) {
    pushError('adsets', err);
  }

  // 3. Ads
  try {
    const { data } = await fetchAds(adAccountId);
    const n = await upsertAds(clientId, adAccountId, data);
    run.counts.ads += n;
    stages.push({ stage: 'ads', status: 'ok', count: n });
    console.log(`[meta-sync] ${label}: ads upserted=${n}`);
  } catch (err) {
    pushError('ads', err);
  }

  // 4. Insights (campaign + adset + ad levels; daily rows)
  const window = pickInsightsWindow();
  for (const level of ['campaign', 'adset', 'ad']) {
    try {
      const { data } = await fetchInsights(adAccountId, {
        level,
        since: window.since,
        until: window.until,
      });
      const n = await upsertInsights(clientId, adAccountId, data, level);
      run.counts.insights_rows += n;
      stages.push({ stage: `insights:${level}`, status: 'ok', count: n });
      console.log(
        `[meta-sync] ${label}: insights(${level}) rows=${n} range=${window.since}..${window.until}`
      );
    } catch (err) {
      pushError(`insights:${level}`, err);
    }
  }

  return { ok: run.errors.length === 0, stages };
};

/**
 * High-level sync: takes a populated Client doc and routes into syncByAdAccount.
 */
export const syncMetaClient = async (client, { deep = false, run } = {}) => {
  if (!client?.meta_ad_account_id) {
    return {
      ok: false,
      stages: [{ stage: 'precheck', status: 'skipped', message: 'meta_ad_account_id missing' }],
    };
  }

  const result = await syncByAdAccount({
    adAccountId: client.meta_ad_account_id,
    clientId: client._id,
    // Use CRM onboardDate (usually months/years old) as the floor — not
    // meta_onboarded_at, which gets auto-stamped to *today* on first enable
    // and would shrink the backfill window to zero. meta_onboarded_at
    // remains useful as a "when did we turn on Meta integration" timestamp
    // for operators; it just shouldn't constrain the sync window.
    onboardedAt: client.onboardDate,
    deep,
    run,
    label: `${client.clientName || 'client'} (${client.meta_ad_account_id})`,
  });

  // Lead forms + lead polling — only runs when Pages are configured.
  if (client?.meta_pages?.length) {
    try {
      const formResult = await syncFormsForClient(client);
      if (run) run.counts.forms += formResult.formsSeen;
      result.stages.push({
        stage: 'forms',
        status: formResult.errors.length ? 'partial' : 'ok',
        count: formResult.formsSeen,
      });
      for (const e of formResult.errors) {
        run?.errors.push({
          client_id: client._id,
          stage: 'forms',
          message: `page=${e.page_id} — ${e.message}`,
          at: new Date(),
        });
      }
    } catch (err) {
      run?.errors.push({
        client_id: client._id,
        stage: 'forms',
        message: err?.message || String(err),
        at: new Date(),
      });
      result.stages.push({ stage: 'forms', status: 'failed', message: err?.message });
    }

    try {
      const pollResult = await pollLeadsForClient(client, { run });
      result.stages.push({
        stage: 'leads',
        status: pollResult.errors.length ? 'partial' : 'ok',
        count: pollResult.inserted,
        fetched: pollResult.fetched,
      });
      for (const e of pollResult.errors) {
        run?.errors.push({
          client_id: client._id,
          stage: 'leads',
          message: `form=${e.form_id} — ${e.message}`,
          at: new Date(),
        });
      }
    } catch (err) {
      run?.errors.push({
        client_id: client._id,
        stage: 'leads',
        message: err?.message || String(err),
        at: new Date(),
      });
      result.stages.push({ stage: 'leads', status: 'failed', message: err?.message });
    }
  }

  try {
    client.meta_last_sync_at = new Date();
    client.meta_last_sync_status = result.stages.every((s) => s.status === 'ok')
      ? 'success'
      : 'partial';
    client.meta_last_sync_error =
      result.stages.find((s) => s.status === 'failed')?.message || '';
    await client.save();
  } catch (err) {
    console.error('[meta-sync] could not update client sync status:', err?.message);
  }

  return result;
};

/**
 * Iterate every meta-enabled client and sync them sequentially.
 * Sequential on purpose — parallel calls compound into Meta rate limits.
 */
export const syncAllMetaClients = async ({ deep = false } = {}) => {
  const runId = newRunId();
  const startedAt = new Date();
  const run = await MetaSyncRun.create({
    run_id: runId,
    started_at: startedAt,
    scope: deep ? 'deep' : (process.env.META_SYNC_ENABLED === 'false' ? 'incremental' : 'incremental'),
    status: 'running',
    counts: {
      campaigns: 0, adsets: 0, ads: 0, insights_rows: 0, forms: 0,
      leads_fetched: 0, leads_inserted: 0,
    },
    errors: [],
  });

  try {
    const clients = await Client.find({
      meta_enabled: true,
      meta_ad_account_id: { $ne: '', $exists: true },
    });
    console.log(`[meta-sync] run=${runId} clients=${clients.length} deep=${deep}`);

    for (const client of clients) {
      try {
        await syncMetaClient(client, { deep, run });
      } catch (err) {
        run.errors.push({
          client_id: client._id,
          stage: 'client',
          message: err?.message || String(err),
          code: err instanceof MetaApiError && err.code != null ? String(err.code) : '',
          at: new Date(),
        });
      }
    }

    run.status = run.errors.length === 0 ? 'success' : 'partial';
  } catch (err) {
    run.status = 'failed';
    run.errors.push({
      stage: 'run',
      message: err?.message || String(err),
      at: new Date(),
    });
  } finally {
    run.ended_at = new Date();
    run.duration_ms = run.ended_at - startedAt;
    await run.save();
    console.log(
      `[meta-sync] run=${runId} status=${run.status} duration=${run.duration_ms}ms ` +
      `campaigns=${run.counts.campaigns} adsets=${run.counts.adsets} ads=${run.counts.ads} ` +
      `insights=${run.counts.insights_rows} errors=${run.errors.length}`
    );
  }

  return run;
};

/**
 * Sync a single client by id, wrapped in its own MetaSyncRun.
 */
export const syncSingleMetaClient = async (clientId, { deep = false } = {}) => {
  const runId = newRunId();
  const startedAt = new Date();
  const run = await MetaSyncRun.create({
    run_id: runId,
    started_at: startedAt,
    scope: 'single-client',
    client_id: clientId,
    status: 'running',
    counts: {
      campaigns: 0, adsets: 0, ads: 0, insights_rows: 0, forms: 0,
      leads_fetched: 0, leads_inserted: 0,
    },
    errors: [],
  });

  try {
    const client = await Client.findById(clientId);
    if (!client) throw new Error(`Client not found: ${clientId}`);

    const result = await syncMetaClient(client, { deep, run });
    run.status = result.ok ? 'success' : 'partial';
  } catch (err) {
    run.status = 'failed';
    run.errors.push({
      client_id: clientId,
      stage: 'run',
      message: err?.message || String(err),
      at: new Date(),
    });
  } finally {
    run.ended_at = new Date();
    run.duration_ms = run.ended_at - startedAt;
    await run.save();
  }

  return run;
};

export const __testing = {
  pickInsightsWindow,
  flattenActions,
  fromMinorUnits,
  actionValue,
};
