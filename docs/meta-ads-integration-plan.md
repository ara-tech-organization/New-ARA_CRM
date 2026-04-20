# Meta Marketing API — Backend-Only Integration Plan

Scope: everything that lives under `backend/`. Zero frontend work. Existing frontend will consume these endpoints later in the shape described in section 8.

---

## 1. Meta Business Setup (Prerequisites — not code)

Before any backend work:

1. **Create Meta App** at developers.facebook.com → type: *Business*
2. **Products to add:** Marketing API, Webhooks, Facebook Login for Business, Pages API
3. **Generate System User token** in Business Manager:
   - Business Settings → System Users → "ARA CRM Sync" (Admin role)
   - Assign every client's Ad Account + Page to this System User
   - Scopes: `ads_read`, `ads_management`, `leads_retrieval`, `pages_read_engagement`, `pages_show_list`, `pages_manage_metadata`, `business_management`
   - Output: `META_SYSTEM_USER_TOKEN` (never expires if configured correctly)
4. **Capture app credentials:** `META_APP_ID`, `META_APP_SECRET`
5. **Generate random** `META_VERIFY_TOKEN` (for webhook handshake)
6. **Submit for App Review** (needed for `leads_retrieval` in production)

---

## 2. Environment Variables

Add to `backend/.env` and `backend/.env.example`:

```
# Meta Marketing API
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
META_SYSTEM_USER_TOKEN=
META_API_VERSION=v19.0
META_API_BASE_URL=https://graph.facebook.com
META_ENCRYPTION_KEY=                   # 32-byte hex, AES-256-GCM
META_SYNC_ENABLED=true                 # kill switch
META_SYNC_INTERVAL_MINUTES=15          # independent of Google
META_WEBHOOK_PATH=/api/meta/webhook
META_LEAD_BACKFILL_DAYS=30
META_INSIGHTS_BACKFILL_DAYS=30
```

Remove (after Phase 7 decommission): `META_SYNC_API_URL`

---

## 3. Data Model Changes

### 3.1 Extend existing models

**`backend/models/Client.js`** — add sibling to `google_ads_*`:
- `meta_enabled` (Boolean, default false)
- `meta_business_id` (String)
- `meta_ad_account_id` (String, unique sparse, format `act_\d+`)
- `meta_ad_account_name` (String)
- `meta_ad_account_currency` (String, 3-letter ISO)
- `meta_ad_account_timezone` (String)
- `meta_pages` (Array of sub-docs: `{page_id, page_name, encrypted_access_token, token_issued_at, token_expires_at, subscribed: Boolean}`)
- `meta_instagram_account_ids` (Array<String>)
- `meta_onboarded_at` (Date — backfill anchor)
- `meta_last_sync_at` (Date)
- `meta_last_sync_status` (enum: 'success', 'partial', 'failed')
- `meta_last_sync_error` (String)

**`backend/models/Lead.js`** — add:
- `meta_leadgen_id` (String, unique sparse) — natural dedup key
- `meta_form_id`, `meta_form_name`
- `meta_campaign_id`, `meta_campaign_name`
- `meta_adset_id`, `meta_adset_name`
- `meta_ad_id`, `meta_ad_name`
- `platform` (enum: 'facebook', 'instagram', 'messenger', 'whatsapp', 'unknown')
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `raw_field_data` (Mixed — for debugging unmapped fields)

**`backend/models/BillingTransaction.js`** — add to `source` enum:
- `'meta_ads_daily_spend'`
- `'meta_ads_refund'`
- `'meta_ads_adjustment'`

**`backend/models/DailyDebitSnapshot.js`** — add:
- `platform` (enum: 'google', 'meta'), required
- Update compound unique index to include `platform` → `(client_id, platform, campaign_id, date)`
- **Migration required** — backfill existing rows with `platform: 'google'`

**`backend/models/DailyLeadData.js`** — already has `metaData` sub-doc. No schema change; populate it from aggregation query on `MetaInsights` instead of external API.

### 3.2 New collections

| File | Purpose | Key fields | Indexes |
|---|---|---|---|
| `backend/models/MetaCampaign.js` | Campaigns | `client_id`, `ad_account_id`, `campaign_id`, `name`, `objective`, `status`, `effective_status`, `daily_budget`, `lifetime_budget`, `buying_type`, `start_time`, `stop_time`, `special_ad_categories` | unique(`campaign_id`); (`client_id`, `status`) |
| `backend/models/MetaAdSet.js` | Ad sets | `client_id`, `campaign_id`, `adset_id`, `name`, `status`, `effective_status`, `daily_budget`, `lifetime_budget`, `optimization_goal`, `billing_event`, `bid_strategy`, `targeting_summary`, `start_time`, `end_time` | unique(`adset_id`); (`client_id`,`campaign_id`) |
| `backend/models/MetaAd.js` | Ads | `client_id`, `adset_id`, `campaign_id`, `ad_id`, `name`, `status`, `effective_status`, `creative_id`, `preview_shareable_link`, `tracking_specs` | unique(`ad_id`); (`client_id`,`adset_id`) |
| `backend/models/MetaInsights.js` | Daily metrics (parity with `Metric.js`) | `client_id`, `level` ('account'\|'campaign'\|'adset'\|'ad'), `entity_id`, `ad_account_id`, `date`, `impressions`, `reach`, `frequency`, `clicks`, `unique_clicks`, `inline_link_clicks`, `spend`, `cpm`, `cpc`, `ctr`, `actions{lead, onsite_conversion_messaging_conversation_started_7d, purchase, complete_registration, ...}`, `action_values`, `cost_per_action_type`, `conversions`, `conversion_values`, `video_thruplay_watched_actions`, `currency`, `spend_inr` (converted) | unique(`client_id`, `entity_id`, `date`); (`client_id`,`date`,`level`) |
| `backend/models/MetaLeadForm.js` | Lead form definitions | `client_id`, `page_id`, `form_id`, `name`, `status`, `locale`, `question_schema[]` (key, label, type, options), `leads_count`, `last_seen_at` | unique(`form_id`) |
| `backend/models/MetaLeadRaw.js` | Audit log of every webhook/poll | `leadgen_id`, `form_id`, `page_id`, `ad_id`, `campaign_id`, `received_at`, `source` ('webhook'\|'poll'), `raw_payload`, `processed`, `processed_at`, `lead_id` (→ Lead._id once created), `error` | unique(`leadgen_id`); (`processed`, `received_at`) |
| `backend/models/MetaSyncRun.js` | Per-sync observability | `run_id`, `started_at`, `ended_at`, `duration_ms`, `scope` ('full'\|'incremental'\|'single-client'), `client_id` (optional), `status` ('success'\|'partial'\|'failed'), `counts{campaigns, adsets, ads, insights_rows, forms, leads_fetched, leads_inserted}`, `errors[]`, `rate_limit_usage` | (`started_at` desc) |
| `backend/models/MetaWebhookRetry.js` | Dead-letter queue | `leadgen_id`, `payload`, `attempts`, `next_attempt_at`, `last_error`, `status` ('pending'\|'resolved'\|'abandoned') | (`status`, `next_attempt_at`) |
| `backend/models/ExchangeRate.js` | FX cache (only if multi-currency) | `from_currency`, `to_currency`, `date`, `rate`, `source` | unique(`from_currency`, `to_currency`, `date`) |

---

## 4. Utilities

### 4.1 `backend/utils/crypto.js` (new)
- `encrypt(plaintext)` / `decrypt(ciphertext)` using AES-256-GCM, key from `META_ENCRYPTION_KEY`
- Used for `meta_pages[].encrypted_access_token`
- Constant-time compare helper `safeEqual(a, b)`

### 4.2 `backend/utils/metaSignature.js` (new)
- `verifyWebhookSignature(rawBody, headerSignature, appSecret)` — HMAC-SHA256, constant-time compare
- Must operate on **raw request body** → configure `express.json({ verify: ... })` in `backend/server.js` to retain `req.rawBody` on `/api/meta/webhook` only

### 4.3 `backend/utils/metaFieldMapper.js` (new)
- `mapLeadgenFields(fieldData, questionSchema)` → normalize into `{name, email, phone, ...custom}`
- Handles Meta's quirks: `FULL_NAME` vs `full_name`, localized labels, multi-value answers
- Extracts UTM params from `tracking_parameters` when present

### 4.4 `backend/utils/metaRateLimit.js` (new)
- Parse `X-Business-Use-Case-Usage` header on every response
- `shouldThrottle(usage)` → returns `{throttle: true, resumeAt}` when any bucket > 80%
- Stores snapshot in memory + periodically to `MetaSyncRun.rate_limit_usage`

### 4.5 Extend `backend/utils/dateUtils.js` (or create)
- `formatMetaDate(date)` — `YYYY-MM-DD` in account timezone
- `mongoDayBucket(date, tz)` — normalize for compound keys

---

## 5. Service Layer

### 5.1 `backend/services/metaAdsService.js` (new)
Thin Graph API wrapper, centralizes auth, retries, pagination. Uses `axios` (already installed).

**Responsibilities:**
- Build axios instance with `baseURL = ${META_API_BASE_URL}/${META_API_VERSION}`
- Inject access token per call: agency system-user token by default; per-Page token when calling `/{leadgen_id}` or `/{form_id}/leads`
- Auto-paginate `paging.next`, cap at 10,000 items per call to prevent runaway
- Retry strategy: 3 retries on 5xx and on error codes `1, 2, 4, 17, 32, 613` (transient/rate-limit) with exponential backoff (2s, 8s, 32s)
- Throw typed errors: `MetaAuthError`, `MetaRateLimitError`, `MetaPermissionError`, `MetaTransientError`, `MetaValidationError`
- Log every request/response summary to `MetaSyncRun.errors` on failure

**Methods:**
- `verifyAdAccountAccess(adAccountId)` → returns `{id, name, currency, timezone_name, account_status, business}` or throws
- `listPagesForSystemUser()` → `/me/accounts?fields=id,name,access_token,tasks`
- `getLongLivedPageToken(userToken, pageId)` → exchanged Page token (for Mode B)
- `subscribePageToLeadgen(pageId, pageAccessToken)` → `POST /{page_id}/subscribed_apps` with `subscribed_fields=leadgen`
- `unsubscribePage(pageId, pageAccessToken)`
- `fetchCampaigns(adAccountId)` — all fields needed for `MetaCampaign`
- `fetchAdSets(adAccountId)`
- `fetchAds(adAccountId)`
- `fetchInsights(adAccountId, {level, since, until, breakdowns?})` — with `time_increment=1` for daily rows
- `fetchLeadForms(pageId, pageAccessToken)`
- `fetchLeadsForForm(formId, pageAccessToken, sinceTs)` — for polling
- `fetchSingleLead(leadgenId, pageAccessToken)` — for webhook
- `updateCampaignStatus(campaignId, status)` — **not called in v1**, stub only

**Field selection (minimize quota):** centralize `FIELD_SETS` constant per entity. Never request `*`.

### 5.2 `backend/services/metaLeadService.js` (new)
Ingestion business logic, shared between webhook and poller.

- `ingestLead({leadgenId, pageId, source})`
  1. Check `MetaLeadRaw` by `leadgenId` → if processed, return early (idempotent)
  2. Resolve `client_id` via `MetaLeadForm.form_id` → if unmapped, persist raw with `processed=false` and return (surfaces in unassigned admin route)
  3. Decrypt Page token from `Client.meta_pages`
  4. Call `metaAdsService.fetchSingleLead(leadgenId, pageToken)`
  5. Map fields via `metaFieldMapper`
  6. Upsert into `Lead` keyed on `meta_leadgen_id`
  7. Mark `MetaLeadRaw.processed=true`, link `lead_id`
  8. Emit internal event `lead.created.meta` (via simple EventEmitter singleton in `backend/events/index.js` — no new dep)
- `enqueueRetry(leadgenId, error)` — push to `MetaWebhookRetry`
- `processRetries()` — invoked by scheduler tick, picks pending rows where `next_attempt_at <= now`, exponential backoff (1m, 5m, 15m, 1h, 6h), abandons after 5 attempts

### 5.3 `backend/services/metaBillingService.js` (new)
- `reconcileMetaSpend(client, insightsRows)` — mirrors `syncService.js:151-279` logic, generalized with `platform='meta'`
- Currency conversion: if `client.currency !== insights.currency`, fetch FX from `ExchangeRate` (populate daily via `backend/services/fxService.js` — new, hits frankfurter.app), cache
- Idempotency key: `meta:${client_id}:${campaign_id}:${date}`
- Respects `dry_run` flag (env var `META_BILLING_DRY_RUN=true` during Phase 3 validation)

### 5.4 `backend/services/metaFormSyncService.js` (new)
- `syncFormsForClient(client)` — iterate `client.meta_pages`, fetch forms, upsert `MetaLeadForm`
- Detects new forms (creates with `client_id` pre-filled)
- Detects orphaned forms (Page removed) — marks `status='archived'`

---

## 6. Sync Orchestration

### 6.1 `backend/sync/metaSyncService.js` (new)
Parallels `backend/sync/syncService.js`.

- `syncAllMetaClients({deep=false, runId})`
  1. Create `MetaSyncRun` row with `status='running'`
  2. Query `Client.find({meta_enabled: true, meta_ad_account_id: {$ne: null}})`
  3. For each client **sequentially** (rate-limit safety):
     - `syncMetaClient(client, {deep})`
     - Catch per-client errors, append to `run.errors`, continue
  4. Process `MetaWebhookRetry` queue at end of run
  5. Finalize `MetaSyncRun` — status, counts, duration
- `syncMetaClient(client, {deep})`
  1. Verify ad account access → update `Client.meta_last_sync_*`
  2. Upsert campaigns, ad sets, ads (in that order)
  3. Compute insights window: `deep` → `meta_onboarded_at` to today; incremental → `today - META_INSIGHTS_BACKFILL_DAYS`
  4. Fetch + upsert `MetaInsights` at three levels (campaign, adset, ad) — separate API calls
  5. Sync lead forms
  6. Poll leads per form since `max(MetaLeadRaw.received_at)` for that form
  7. Call `metaBillingService.reconcileMetaSpend(...)` using **campaign-level insights only**
  8. Recompute `DailyLeadData` aggregates for affected dates

### 6.2 `backend/sync/scheduler.js` (modify existing)
- Add a second cron registration: `*/${META_SYNC_INTERVAL_MINUTES} * * * *`, offset by 5 minutes from Google to avoid API contention (e.g. Google at :00/:15/:30/:45, Meta at :05/:20/:35/:50)
- Guard against overlapping runs with `isMetaSyncRunning` flag (same pattern as Google)
- Expose status via new `getMetaSyncStatus()` — returns `{frequency, nextSyncIn, lastRun, status, cronSchedule}`
- Honor `META_SYNC_ENABLED` kill switch
- On startup: **run once after 45-second delay** (stagger with Google's 30s)

### 6.3 `backend/sync/metaRetryWorker.js` (new)
- Runs every 2 minutes inside the same scheduler module
- Calls `metaLeadService.processRetries()`
- Lightweight — no new cron library needed

---

## 7. Routes & Controllers

All under `/api/meta/`. Parallel to `/api/google-ads/` naming.

### 7.1 `backend/routes/meta.js` (new) + `backend/controllers/metaController.js` (new)

**Public webhook (no auth):**
- `GET /api/meta/webhook` — verification handshake
  - Validates `hub.mode=subscribe` + `hub.verify_token === META_VERIFY_TOKEN`
  - Responds with `hub.challenge` (200) or 403
- `POST /api/meta/webhook` — lead push
  - Verify `X-Hub-Signature-256` using `metaSignature.verifyWebhookSignature(req.rawBody, ...)` → 401 on mismatch
  - Parse `entry[].changes[].value` (leadgen object)
  - For each: `metaLeadService.ingestLead({leadgenId, pageId, source:'webhook'})` — async but `Promise.allSettled`, respond 200 within 5s
  - On ingest error → `enqueueRetry` then still respond 200 (never let Meta retry — we own retries)

**Protected (agency admin only — `authorize('superadmin','admin','PMM')`):**
- `GET /api/meta/sync-status` → live scheduler status + last `MetaSyncRun`
- `GET /api/meta/sync-runs?limit=50` → run history for observability
- `POST /api/meta/sync` → triggers `syncAllMetaClients({deep:false})`, returns `{runId}`
- `POST /api/meta/sync/:clientId` → single-client sync
- `POST /api/meta/sync/:clientId/deep` → full backfill from `meta_onboarded_at`
- `GET /api/meta/health` → pings `/me?fields=id` with system token; returns 200/503
- `GET /api/meta/unassigned-forms` → `MetaLeadForm.find({client_id: null})`
- `POST /api/meta/forms/:formId/assign` `{client_id}` → binds + triggers backfill of that form's leads
- `POST /api/meta/forms/:formId/reprocess` → replays all `MetaLeadRaw` for that form
- `GET /api/meta/rate-limit-usage` → current quota consumption snapshot

**Client configuration:**
- `GET /api/meta/client/:clientId/config` → current Meta linkage (decrypted tokens NEVER returned — only `token_expires_at`)
- `PUT /api/meta/client/:clientId/config` `{meta_ad_account_id, meta_pages[], meta_enabled, meta_onboarded_at}` → validates ad account access first
- `POST /api/meta/client/:clientId/test-connection` → calls `verifyAdAccountAccess`
- `POST /api/meta/client/:clientId/pages/:pageId/subscribe` → subscribes Page to `leadgen` webhook
- `DELETE /api/meta/client/:clientId/pages/:pageId/subscribe` → unsubscribes
- `GET /api/meta/client/:clientId/available-pages` → lists Pages accessible to system user (for admin picker)

### 7.2 Extend `backend/routes/analytics.js`

Modify `GET /api/analytics/client/:clientId` to include a `meta` section in the response (parallel to existing Google section):
- `meta.summary` — aggregate KPIs for date range
- `meta.campaigns[]` — with nested metrics
- `meta.adsets[]`, `meta.ads[]`
- `meta.daily_trend[]` — one row per day
- `meta.lead_forms[]` — form list with lead counts
- `meta.billing` — transactions where `source` starts with `meta_`

Data sourced by aggregation pipelines over `MetaCampaign`, `MetaAdSet`, `MetaAd`, `MetaInsights`, `Lead`, `BillingTransaction`.

### 7.3 Wire in `backend/server.js`
- Mount raw-body middleware **only** for `/api/meta/webhook` (ordering matters: before `express.json()` global, or use conditional verify)
- Register `app.use('/api/meta', require('./routes/meta'))`
- Register scheduler start after DB connect (same pattern as Google)

### 7.4 Middleware additions in `backend/middleware/`
- `metaWebhookRateLimit.js` — 100 req/min per IP via `express-rate-limit`
- Extend `permissions.js` with new enum values: `META_VIEW`, `META_SYNC`, `META_MANAGE_CONFIG`, `META_MANAGE_FORMS`

---

## 8. Response Shape Contract (for frontend consumption later)

Keep the contract stable so frontend can be wired independently. Document in `docs/meta-ads-api.md`:

- `GET /api/meta/sync-status` → `{enabled, frequency_minutes, next_sync_in_seconds, last_run: {run_id, status, started_at, ended_at, counts, errors_count}}`
- `GET /api/analytics/client/:clientId?platform=meta&from=&to=` → response shape matching Google section
- `GET /api/meta/client/:clientId/config` → `{meta_enabled, meta_ad_account_id, meta_ad_account_name, meta_pages:[{page_id, page_name, subscribed, token_expires_at}], meta_onboarded_at, meta_last_sync_at, meta_last_sync_status}`

---

## 9. Migrations & Backfill Scripts

Place under `backend/scripts/migrations/`:

1. `2026-04-meta-schema-init.js` — ensures indexes, adds `platform='google'` default to existing `DailyDebitSnapshot` rows
2. `2026-04-meta-onboard-client.js <clientId> <adAccountId>` — one-shot enable: sets flags, verifies access, subscribes Pages, kicks deep sync
3. `2026-04-meta-backfill-leads.js <clientId> <days>` — replays `MetaLeadRaw` or pulls historical leads per form (capped at 90 days by Meta API)
4. `2026-04-meta-reconcile-billing-dry.js` — runs reconciliation with `META_BILLING_DRY_RUN=true`, outputs CSV report for review
5. `2026-04-meta-decommission-external.js` — after Phase 7, removes `META_SYNC_API_URL` references and the proxy endpoint

---

## 10. Testing Strategy

Under `backend/tests/meta/` (if Jest not present, use simple Node `--test`):

**Unit:**
- `metaFieldMapper.test.js` — localized labels, multi-value, missing fields
- `crypto.test.js` — encrypt/decrypt roundtrip, tamper detection
- `metaSignature.test.js` — valid/invalid/malformed signatures, constant-time
- `metaRateLimit.test.js` — header parsing edge cases

**Integration (mock Graph API with `nock`):**
- `metaAdsService.test.js` — pagination, retries, rate-limit backoff, error mapping
- `metaLeadService.test.js` — idempotency, unmapped form, retry enqueue
- `metaBillingService.test.js` — delta calc, refunds, currency conversion, idempotency

**E2E:**
- `webhook.test.js` — full pipeline: POST webhook → lead in DB
- `sync.test.js` — run `syncMetaClient` against mocked Graph, verify Mongo state

**Manual QA runbook:** `docs/meta-qa-runbook.md` — step-by-step for first pilot client

---

## 11. Observability

- **Request logging:** every Graph call logs `{client_id, endpoint, duration_ms, status, rate_limit_headers}` to `meta_api_calls` collection (TTL 30 days) or existing log pipeline
- **Error aggregation:** `MetaSyncRun.errors[]` rolled up per day in a nightly summary document `meta_daily_health`
- **Webhook-vs-poll delta alarm:** nightly job counts `MetaLeadRaw` where `source='poll'` and no matching earlier `source='webhook'` row for same `leadgen_id` — if >5 in a day, raise `WEBHOOK_DEGRADED` flag on an internal status doc
- **Token expiry monitor:** daily cron scans `Client.meta_pages[].token_expires_at`, raises 7-day and 24-hour warnings (emit to an `alerts` collection — email integration out of scope)
- **Health endpoint** `/api/meta/health` → for external uptime monitor
- **Rate limit telemetry:** aggregate `rate_limit_usage` snapshots daily; alert at 80%

---

## 12. Security Checklist

- [ ] System User token stored only in `.env`, never logged, never returned via API
- [ ] Page access tokens encrypted at rest (AES-256-GCM, key in separate env var)
- [ ] Webhook signature verified with constant-time compare on **raw body**
- [ ] Webhook endpoint rate-limited; public but authenticated by signature
- [ ] Permission checks: `META_VIEW` / `META_SYNC` / `META_MANAGE_CONFIG` / `META_MANAGE_FORMS`
- [ ] Audit trail on config changes → new `MetaConfigAudit` collection (`user_id`, `client_id`, `action`, `before`, `after`, `at`)
- [ ] PII redaction in logs (hash email/phone when logged)
- [ ] `META_BILLING_DRY_RUN` default true during rollout, flip to false only after Phase 3 sign-off

---

## 13. Rollout Phases (Backend Only)

| Phase | Deliverable | Duration | Gate |
|---|---|---|---|
| **0** | Meta App + System User + one pilot client's accounts assigned | 1 day | Manual validation in Graph API Explorer |
| **1** | Env vars, models, indexes, migration script, utils (crypto, signature, mapper, rate limit) | 2 days | `npm test` passes; indexes verified in Mongo |
| **2** | `metaAdsService` + unit/integration tests with `nock` | 2 days | All service methods green |
| **3** | `metaSyncService` + scheduler wiring + `POST /sync/:clientId` admin route — read-only | 2 days | Pilot client's campaigns/insights appear in DB |
| **4** | Webhook endpoint + `metaLeadService` + `MetaLeadRaw` + `metaFormSyncService` + retry worker | 3 days | Test lead from real Facebook form lands in `Lead` collection |
| **5** | `metaBillingService` + DailyDebitSnapshot platform migration — run in `DRY_RUN` mode | 2 days | Dry-run CSV matches manual Meta Ads Manager export within ±₹1 |
| **6** | Flip billing live + analytics route extension + config endpoints + observability | 2 days | Pilot client has clean ledger for 7 days |
| **7** | Expand to all clients; decommission `crmasdmanager` (remove `dailyEntryController.js:559-598`) | 2 days | Parity confirmed for 2 weeks |

**Total: ~16 working days** for a single backend dev. Frontend team can start wiring once Phase 6 ships the stable `/api/analytics/client/:clientId` shape.

---

## 14. Go/No-Go Decisions Required Before Phase 1

1. **Credential mode?** → Recommend **Mode A only** for v1 (agency System User token). Mode B (per-client OAuth) deferred.
2. **Multi-currency support?** → If every client is INR, skip `ExchangeRate` / `fxService` and the `spend_inr` field. Saves ~1 day.
3. **Write operations (pause/resume campaigns from CRM)?** → Out of scope v1. Read-only.
4. **Keep manual `DailyEntry` Meta fields as fallback?** → Yes, until Phase 7 closes.
5. **Dry-run duration for billing?** → Minimum 7 days on pilot before flipping live.
6. **Scope of pilot?** → Pick **1 client** with active Meta spend and working webhook setup for Phases 3–6.
