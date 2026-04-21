// Meta Graph API wrapper — the only place in the backend that talks to Meta
// over HTTP. All sync routines, webhook handlers, and admin controllers go
// through this service.
//
// Responsibilities:
//   - Inject the correct access token per call (System User by default,
//     Page token when the caller passes one explicitly).
//   - Follow `paging.next` until the edge is exhausted or an item cap is hit.
//   - Retry transient failures (5xx, known-transient Meta error codes).
//   - Classify every non-2xx into a typed error from metaErrors.js.
//
// This file deliberately owns no business logic — no DB writes, no field
// mapping. It returns raw Graph API shapes. Higher-level services translate
// those into our models.

import { joinFields, FIELD_SETS } from './metaFieldSets.js';
import { classifyMetaError, MetaTransientError, MetaApiError } from './metaErrors.js';

const API_VERSION = process.env.META_API_VERSION || 'v19.0';
const API_BASE = (process.env.META_API_BASE_URL || 'https://graph.facebook.com').replace(/\/$/, '');
const MAX_PAGE_SIZE = 100;
const MAX_ITEMS_PER_EDGE = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2_000, 8_000, 32_000];

const systemToken = () => process.env.META_SYSTEM_USER_TOKEN || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const buildUrl = (pathOrUrl, params = {}, token) => {
  const base = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${API_BASE}/${API_VERSION}/${pathOrUrl.replace(/^\//, '')}`;
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  // If the URL already carries access_token (e.g. paging.next), don't override.
  if (!url.searchParams.has('access_token')) {
    url.searchParams.set('access_token', token);
  }
  return url.toString();
};

// Single HTTP round-trip. No retry here — the caller handles that.
const doFetch = async (url, { method = 'GET', body } = {}) => {
  const opts = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(url, opts);
  const rawText = await res.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = { raw: rawText };
  }
  return { status: res.status, body: parsed };
};

const isRetryable = (err) => err?.retryable === true;

// Call Graph API once, retrying transient failures with exponential backoff.
const requestWithRetry = async (url, endpointLabel, opts = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { status, body } = await doFetch(url, opts);
      if (status >= 200 && status < 300) return body;

      const typed = classifyMetaError(status, body, endpointLabel);
      if (isRetryable(typed) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1));
        lastError = typed;
        continue;
      }
      throw typed;
    } catch (err) {
      if (err instanceof MetaApiError) throw err;
      const transient = new MetaTransientError(
        err?.message || 'Meta request failed',
        { endpoint: endpointLabel }
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1));
        lastError = transient;
        continue;
      }
      throw transient;
    }
  }
  throw lastError || new MetaTransientError('Exhausted retries', { endpoint: endpointLabel });
};

// Follow Graph API cursor pagination, up to MAX_ITEMS_PER_EDGE rows.
const paginate = async (firstUrl, endpointLabel) => {
  const all = [];
  let url = firstUrl;
  let page = 0;
  while (url) {
    page++;
    const body = await requestWithRetry(url, `${endpointLabel} page=${page}`);
    if (!body) break;
    if (Array.isArray(body.data)) all.push(...body.data);
    else if (body.data) all.push(body.data);
    if (all.length >= MAX_ITEMS_PER_EDGE) break;
    url = body.paging?.next || null;
  }
  return all;
};

const resolveToken = (override) => {
  const t = override ?? systemToken();
  if (!t) throw new MetaApiError('No Meta access token available', { httpStatus: 0 });
  return t;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const verifySystemUser = async () => {
  const url = buildUrl('/me', { fields: 'id,name' }, resolveToken());
  const body = await requestWithRetry(url, 'GET /me');
  return { me: body };
};

export const verifyAdAccountAccess = async (adAccountId) => {
  const url = buildUrl(
    `/${adAccountId}`,
    { fields: joinFields('adAccount') },
    resolveToken()
  );
  const body = await requestWithRetry(url, `GET /${adAccountId}`);
  return { account: body };
};

export const listPagesForSystemUser = async () => {
  const url = buildUrl(
    '/me/accounts',
    { fields: joinFields('page'), limit: MAX_PAGE_SIZE },
    resolveToken()
  );
  const pages = await paginate(url, 'GET /me/accounts');
  return { pages };
};

export const subscribePageToLeadgen = async (pageId, pageAccessToken) => {
  const url = buildUrl(
    `/${pageId}/subscribed_apps`,
    { subscribed_fields: 'leadgen' },
    pageAccessToken
  );
  return requestWithRetry(url, `POST /${pageId}/subscribed_apps`, { method: 'POST' });
};

export const unsubscribePage = async (pageId, pageAccessToken) => {
  const url = buildUrl(`/${pageId}/subscribed_apps`, {}, pageAccessToken);
  return requestWithRetry(url, `DELETE /${pageId}/subscribed_apps`, { method: 'DELETE' });
};

export const fetchCampaigns = async (adAccountId) => {
  const url = buildUrl(
    `/${adAccountId}/campaigns`,
    { fields: joinFields('campaign'), limit: MAX_PAGE_SIZE },
    resolveToken()
  );
  const data = await paginate(url, `GET /${adAccountId}/campaigns`);
  return { data };
};

export const fetchAdSets = async (adAccountId) => {
  const url = buildUrl(
    `/${adAccountId}/adsets`,
    { fields: joinFields('adset'), limit: MAX_PAGE_SIZE },
    resolveToken()
  );
  const data = await paginate(url, `GET /${adAccountId}/adsets`);
  return { data };
};

export const fetchAds = async (adAccountId) => {
  const url = buildUrl(
    `/${adAccountId}/ads`,
    { fields: joinFields('ad'), limit: MAX_PAGE_SIZE },
    resolveToken()
  );
  const data = await paginate(url, `GET /${adAccountId}/ads`);
  return { data };
};

// Daily insights at the chosen level. `since` and `until` are YYYY-MM-DD.
// `time_increment=1` forces one row per day so we can upsert without rollups.
export const fetchInsights = async (
  adAccountId,
  { level, since, until, breakdowns } = {}
) => {
  if (!['account', 'campaign', 'adset', 'ad'].includes(level)) {
    throw new Error(`fetchInsights: invalid level=${level}`);
  }
  if (!since || !until) throw new Error('fetchInsights: since/until required');

  const params = {
    fields: joinFields('insights'),
    level,
    time_increment: 1,
    time_range: { since, until },
    limit: MAX_PAGE_SIZE,
    action_attribution_windows: ['7d_click', '1d_view'],
    use_unified_attribution_setting: 'true',
  };
  if (breakdowns?.length) params.breakdowns = breakdowns.join(',');

  const url = buildUrl(`/${adAccountId}/insights`, params, resolveToken());
  const data = await paginate(url, `GET /${adAccountId}/insights level=${level}`);
  return { data };
};

export const fetchLeadForms = async (pageId, pageAccessToken) => {
  const url = buildUrl(
    `/${pageId}/leadgen_forms`,
    { fields: joinFields('leadForm'), limit: MAX_PAGE_SIZE },
    pageAccessToken
  );
  const data = await paginate(url, `GET /${pageId}/leadgen_forms`);
  return { data };
};

export const fetchLeadsForForm = async (formId, pageAccessToken, sinceUnixSeconds = 0) => {
  const params = { fields: joinFields('lead'), limit: MAX_PAGE_SIZE };
  if (sinceUnixSeconds > 0) {
    params.filtering = [
      { field: 'time_created', operator: 'GREATER_THAN', value: sinceUnixSeconds },
    ];
  }
  const url = buildUrl(`/${formId}/leads`, params, pageAccessToken);
  const data = await paginate(url, `GET /${formId}/leads`);
  return { data };
};

export const fetchSingleLead = async (leadgenId, pageAccessToken) => {
  const url = buildUrl(`/${leadgenId}`, { fields: joinFields('lead') }, pageAccessToken);
  const body = await requestWithRetry(url, `GET /${leadgenId}`);
  return { lead: body };
};

export const updateCampaignStatus = async (/* campaignId, status */) => {
  throw new MetaApiError('updateCampaignStatus is disabled in v1 (read-only mode)', {
    httpStatus: 501,
  });
};

export const __internals = {
  buildUrl,
  paginate,
  requestWithRetry,
  API_VERSION,
  API_BASE,
  FIELD_SETS,
};
