# Meta Marketing API — Complete Backend Reference

Every HTTP endpoint added to the backend across phases 1–6, with concrete request/response JSON for each one. Drop this in front of any frontend developer and they can build the entire Meta UI without pinging backend once.

**Base URL (production):** `https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net`

All endpoints are under `/api/meta`. No auth middleware is currently wired (matches the `/api/google-ads` convention). When you're ready to gate these, add your standard JWT guard at the router level.

**Conventions:**

- Success: `2xx` + JSON body. Sync/onboarding routes use `{ success: true, ... }`; Meta-facing routes use `{ ok: true, ... }`.
- Error: appropriate HTTP status + `{ success: false, message: "..." }` or `{ ok: false, error: "..." }`.
- All monetary values are in **INR with decimals** (₹ major units, not paise).
- All percents are `0–100`, not `0–1`.
- All dates are ISO-8601 UTC strings.

---

## Table of contents

- [Phase 1 — Foundation (no HTTP)](#phase-1--foundation-no-http)
- [Phase 2 — Graph API wrapper (no HTTP)](#phase-2--graph-api-wrapper-no-http)
- [**Phase 3 — Admin & Sync**](#phase-3--admin--sync)
  - [GET /sync-status](#get-apimetasync-status)
  - [GET /sync-runs](#get-apimetasync-runs)
  - [POST /sync](#post-apimetasync)
  - [POST /sync/:clientId](#post-apimetasyncclientid)
  - [POST /sync/ad-account/:adAccountId](#post-apimetasyncad-accountadaccountid)
  - [GET /health](#get-apimetahealth)
  - [GET /ad-account/:adAccountId/verify](#get-apimetaad-accountadaccountidverify)
- [**Phase 4 — Webhook & Lead ingestion**](#phase-4--webhook--lead-ingestion)
  - [GET /webhook](#get-apimetawebhook)
  - [POST /webhook](#post-apimetawebhook)
  - [GET /unassigned-forms](#get-apimetaunassigned-forms)
  - [POST /forms/:formId/assign](#post-apimetaformsformidassign)
  - [POST /forms/:formId/reprocess](#post-apimetaformsformidreprocess)
  - [GET /retry-queue](#get-apimetaretry-queue)
  - [GET /raw-leads](#get-apimetaraw-leads)
- [Phase 5 — Billing reconciliation (no new HTTP)](#phase-5--billing-reconciliation-no-new-http)
- [**Phase 6 — Client config & Analytics**](#phase-6--client-config--analytics)
  - [GET /client/:clientId/config](#get-apimetaclientclientidconfig)
  - [PUT /client/:clientId/config](#put-apimetaclientclientidconfig)
  - [POST /client/:clientId/test-connection](#post-apimetaclientclientidtest-connection)
  - [GET /client/:clientId/available-pages](#get-apimetaclientclientidavailable-pages)
  - [POST /client/:clientId/pages/:pageId/subscribe](#post-apimetaclientclientidpagespageidsubscribe)
  - [DELETE /client/:clientId/pages/:pageId/subscribe](#delete-apimetaclientclientidpagespageidsubscribe)
  - [GET /client/:clientId/analytics](#get-apimetaclientclientidanalytics)
- [Environment variables (deployment)](#environment-variables-deployment)

---

# Phase 1 — Foundation (no HTTP)

No endpoints. Schema + utilities only:

- `backend/models/Client.js` — added `meta_enabled`, `meta_business_id`, `meta_ad_account_id`, `meta_ad_account_name/currency/timezone`, `meta_pages[]`, `meta_onboarded_at`, `meta_last_sync_*`
- `backend/models/Lead.js` — added `meta_leadgen_id` (unique sparse), `meta_form_id/name`, `meta_campaign_id/name`, `meta_adset_id/name`, `meta_ad_id/name`, `platform`, `utm_*`, `raw_field_data`
- `backend/models/BillingTransaction.js` — source enum now includes `meta_ads_daily_spend`, `meta_ads_refund`, `meta_ads_adjustment`
- `backend/models/DailyDebitSnapshot.js` — added `platform` enum (`google`|`meta`), compound unique index now `(client_id, platform, campaign_id, date)`
- New models: `MetaCampaign`, `MetaAdSet`, `MetaAd`, `MetaInsights`, `MetaLeadForm`, `MetaLeadRaw`, `MetaSyncRun`, `MetaWebhookRetry`
- New utils: `metaSignature.js` (HMAC-SHA256 for webhooks), `metaFieldMapper.js` (leadgen → Lead field mapping)
- Migration: `backend/scripts/migrations/2026-04-meta-schema-init.js`

# Phase 2 — Graph API wrapper (no HTTP)

No endpoints. Internal service `backend/services/metaAdsService.js` that the rest of the backend calls:

```
verifySystemUser()                        → /me
verifyAdAccountAccess(adAccountId)        → /act_{id}
listPagesForSystemUser()                  → /me/accounts (auto-paginated)
subscribePageToLeadgen(pageId, pageToken) → POST /{page_id}/subscribed_apps
unsubscribePage(pageId, pageToken)        → DELETE /{page_id}/subscribed_apps
fetchCampaigns(adAccountId)               → /act_{id}/campaigns (auto-paginated)
fetchAdSets(adAccountId)                  → /act_{id}/adsets
fetchAds(adAccountId)                     → /act_{id}/ads
fetchInsights(adAccountId, {level, since, until})  → /act_{id}/insights?time_increment=1
fetchLeadForms(pageId, pageToken)         → /{page_id}/leadgen_forms
fetchLeadsForForm(formId, pageToken, sinceTs)      → /{form_id}/leads
fetchSingleLead(leadgenId, pageToken)     → /{leadgen_id}
```

3 retries with 2s/8s/32s backoff on transient errors. Typed errors: `MetaAuthError`, `MetaPermissionError`, `MetaRateLimitError`, `MetaTransientError`, `MetaValidationError`.

---

# Phase 3 — Admin & Sync

## `GET /api/meta/sync-status`

Live status of the background scheduler plus the most recent run.

**Response 200:**

```json
{
  "enabled": true,
  "syncInProgress": false,
  "lastRunAt": "2026-04-21T06:05:00.000Z",
  "lastRunDurationMs": 87431,
  "lastRunError": null,
  "lastRunStatus": "success",
  "lastRunId": "meta-1776752000000-a3f2",
  "lastRunCounts": {
    "campaigns": 103,
    "adsets": 124,
    "ads": 243,
    "insights_rows": 683,
    "forms": 2,
    "leads_fetched": 5,
    "leads_inserted": 5
  },
  "intervalMinutes": 15,
  "last_run": {
    "run_id": "meta-1776752000000-a3f2",
    "scope": "incremental",
    "status": "success",
    "started_at": "2026-04-21T06:03:32.569Z",
    "ended_at": "2026-04-21T06:05:00.000Z",
    "duration_ms": 87431,
    "counts": {
      "campaigns": 103,
      "adsets": 124,
      "ads": 243,
      "insights_rows": 683,
      "forms": 2,
      "leads_fetched": 5,
      "leads_inserted": 5
    },
    "error_count": 0
  }
}
```

**cURL:**

```bash
curl -s https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/sync-status
```

---

## `GET /api/meta/sync-runs`

Run history, latest first.

**Query params:**

- `limit` (optional, int) — max rows, default `25`, cap `200`

**Response 200:**

```json
{
  "runs": [
    {
      "_id": "69e7189d...",
      "run_id": "meta-1776752000000-a3f2",
      "started_at": "2026-04-21T06:03:32.569Z",
      "ended_at": "2026-04-21T06:05:00.000Z",
      "duration_ms": 87431,
      "scope": "incremental",
      "client_id": null,
      "status": "success",
      "counts": {
        "campaigns": 103,
        "adsets": 124,
        "ads": 243,
        "insights_rows": 683,
        "forms": 2,
        "leads_fetched": 5,
        "leads_inserted": 5
      },
      "errors": []
    }
  ]
}
```

---

## `POST /api/meta/sync`

Trigger a full sync of every meta-enabled client. Fire-and-forget — returns immediately.

**Query params:**

- `deep=true` (optional) — run with full backfill from each client's `meta_onboarded_at`

**Request body:** none

**Response 200:**

```json
{
  "success": true,
  "message": "Meta sync triggered",
  "deep": false,
  "status": {
    "enabled": true,
    "syncInProgress": true,
    "lastRunAt": "2026-04-21T06:05:00.000Z",
    "intervalMinutes": 15
  }
}
```

**cURL:**

```bash
curl -X POST https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/sync
```

---

## `POST /api/meta/sync/:clientId`

**Blocking** single-client sync. Runs every stage (campaigns → insights → forms → leads → billing) and returns when done. Use this immediately after an operator finishes onboarding a client so the UI can show populated data.

**Path params:**

- `clientId` — Mongo ObjectId

**Query params:**

- `deep=true` (optional) — backfill from `meta_onboarded_at` instead of last 30 days

**Response 200:**

```json
{
  "success": true,
  "run_id": "meta-1776752123456-b7f1",
  "status": "success",
  "duration_ms": 18240,
  "counts": {
    "campaigns": 103,
    "adsets": 124,
    "ads": 243,
    "insights_rows": 683,
    "forms": 2,
    "leads_fetched": 5,
    "leads_inserted": 5
  },
  "errors": []
}
```

**Response 400** (client has no ad account configured):

```json
{ "success": false, "message": "Client has no meta_ad_account_id configured" }
```

**Response 404:**

```json
{ "success": false, "message": "Client not found" }
```

**cURL:**

```bash
curl -X POST https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/sync/69e7189d1f64a29d76ae5979
```

---

## `POST /api/meta/sync/ad-account/:adAccountId`

**Escape hatch** from Phase 3 for operators who want to verify an ad account syncs correctly **before** wiring it to a Client. Creates rows with `client_id: null` so they don't pollute real client data.

**Path params:**

- `adAccountId` — must match `act_<digits>`

**Query params:**

- `deep=true`, `onboardedAt=YYYY-MM-DD` (optional anchor)

**Response 200:**

```json
{
  "success": true,
  "run_id": "meta-adhoc-1776752000000",
  "status": "success",
  "duration_ms": 45231,
  "counts": {
    "campaigns": 103,
    "adsets": 124,
    "ads": 243,
    "insights_rows": 683,
    "forms": 0,
    "leads_fetched": 0,
    "leads_inserted": 0
  },
  "stages": [
    { "stage": "verify", "status": "ok" },
    { "stage": "campaigns", "status": "ok", "count": 103 },
    { "stage": "adsets", "status": "ok", "count": 124 },
    { "stage": "ads", "status": "ok", "count": 243 },
    { "stage": "insights:campaign", "status": "ok", "count": 108 },
    { "stage": "insights:adset", "status": "ok", "count": 156 },
    { "stage": "insights:ad", "status": "ok", "count": 419 }
  ],
  "errors": []
}
```

**Response 400:**

```json
{ "success": false, "message": "adAccountId must be of the form act_<digits>" }
```

---

## `GET /api/meta/health`

Graph API reachability check using the System User token. Wire to an uptime probe.

**Response 200:**

```json
{
  "ok": true,
  "meta_user": { "id": "122127939423102344", "name": "ARA CRM NEw" }
}
```

**Response 503:**

```json
{
  "ok": false,
  "error": "Meta API error (HTTP 401): Error validating access token..."
}
```

---

## `GET /api/meta/ad-account/:adAccountId/verify`

Quick ad-account reachability check. Returns the full account details from Meta.

**Response 200:**

```json
{
  "ok": true,
  "account": {
    "id": "act_800798932805550",
    "name": "ARA - Grohair Namakkal",
    "currency": "INR",
    "timezone_name": "Asia/Kolkata",
    "account_status": 1,
    "business": { "id": "633026626311825", "name": "ARA Discover Marketing" }
  }
}
```

**Response 400** / **5xx:**

```json
{ "ok": false, "error": "..." }
```

---

# Phase 4 — Webhook & Lead ingestion

## `GET /api/meta/webhook`

Meta's one-time verification handshake. Frontend never calls this. Returns `hub.challenge` as plain text when `hub.verify_token` matches `META_VERIFY_TOKEN`.

**Query params Meta sends:**

- `hub.mode=subscribe`
- `hub.verify_token=<META_VERIFY_TOKEN>`
- `hub.challenge=<random string>`

**Response 200:** `plain text`, body = challenge string
**Response 403:** `verification failed`

---

## `POST /api/meta/webhook`

Meta posts lead events here. Frontend never calls this. Signature-verified via `X-Hub-Signature-256` HMAC over the raw body using `META_APP_SECRET`. Always acknowledges with `200` within 5 seconds; ingest runs async.

**Meta's request body:**

```json
{
  "object": "page",
  "entry": [
    {
      "id": "346326028570941",
      "time": 1776753584,
      "changes": [
        {
          "field": "leadgen",
          "value": {
            "leadgen_id": "963835799670874",
            "page_id": "346326028570941",
            "form_id": "1488811796094855",
            "ad_id": "6973956389859",
            "adgroup_id": null,
            "created_time": 1776753580
          }
        }
      ]
    }
  ]
}
```

**Response 200:** `{ "ok": true }`
**Response 401:** `{ "ok": false, "error": "invalid signature" }`

---

## `GET /api/meta/unassigned-forms`

Lead forms discovered from webhooks or sync that aren't bound to any CRM client. Operator "needs review" inbox.

**Response 200:**

```json
{
  "forms": [
    {
      "_id": "69e7189d...",
      "form_id": "1488811796094855",
      "page_id": "346326028570941",
      "name": "",
      "status": "",
      "locale": "",
      "client_id": null,
      "question_schema": [],
      "leads_count": 0,
      "last_seen_at": "2026-04-21T06:19:44.000Z",
      "createdAt": "2026-04-21T06:19:44.000Z"
    }
  ]
}
```

---

## `POST /api/meta/forms/:formId/assign`

Bind a form to a client. Side effect: immediately reprocesses any `MetaLeadRaw` rows for this form that were parked waiting for assignment → those leads land in `Lead` collection.

**Path params:**

- `formId` — Meta form id (e.g. `972207495782606`)

**Request body:**

```json
{ "client_id": "69e7189d1f64a29d76ae5979" }
```

**Response 200:**

```json
{
  "success": true,
  "form": {
    "_id": "...",
    "form_id": "972207495782606",
    "page_id": "1067412303117759",
    "name": "ARA -Sahakara",
    "client_id": "69e7189d1f64a29d76ae5979",
    "status": "ACTIVE"
  },
  "reprocessed": 7
}
```

**Response 400:** `{ "success": false, "message": "Invalid client_id" }`
**Response 404:** `{ "success": false, "message": "Form not found" }` or `"Client not found"`

---

## `POST /api/meta/forms/:formId/reprocess`

Force-replay every `MetaLeadRaw` row for this form through the ingest pipeline. Use after fixing a config issue.

**Response 200:**

```json
{ "success": true, "total": 29, "processed": 29 }
```

---

## `GET /api/meta/retry-queue`

Webhook deliveries that failed their first ingest attempt. A non-zero `pending_count` that doesn't drain in 30 min is alertable.

**Response 200:**

```json
{
  "pending_count": 0,
  "abandoned_count": 0,
  "resolved_count": 14,
  "pending": []
}
```

**When there are pending entries:**

```json
{
  "pending_count": 2,
  "abandoned_count": 0,
  "resolved_count": 14,
  "pending": [
    {
      "_id": "...",
      "leadgen_id": "963835799670874",
      "page_id": "346326028570941",
      "form_id": "1488811796094855",
      "attempts": 1,
      "next_attempt_at": "2026-04-21T06:25:00.000Z",
      "last_error": "Form 1488811796094855 not found in MetaLeadForm",
      "status": "pending"
    }
  ]
}
```

---

## `GET /api/meta/raw-leads`

Audit log of every raw payload the webhook + poller received. Useful for debugging.

**Query params (all optional):**

- `limit` — int, default 25, cap 200
- `processed` — `true` / `false`
- `source` — `webhook` / `poll` / `manual`
- `formId` — exact match
- `pageId` — exact match

**Response 200:**

```json
{
  "totals": { "all": 342, "processed": 339, "unprocessed": 3 },
  "shown": 25,
  "rows": [
    {
      "leadgen_id": "1254191863545590",
      "received_at": "2026-04-21T05:30:00.000Z",
      "source": "webhook",
      "page_id": "1067412303117759",
      "form_id": "972207495782606",
      "ad_id": "6973956389859",
      "campaign_id": "",
      "processed": true,
      "processed_at": "2026-04-21T05:30:01.420Z",
      "lead_id": "69e718a264f72e92a903c499",
      "error": ""
    }
  ]
}
```

---

# Phase 5 — Billing reconciliation (no new HTTP)

No new endpoints. Billing runs **inside** the sync pipeline:

1. Every `POST /api/meta/sync` or `POST /api/meta/sync/:clientId` call kicks off `reconcileMetaSpend(client)` after insights have been upserted.
2. For each `(client, campaign, date)` row in `MetaInsights` with `level='campaign'` and `spend > 0`, it compares reported Meta spend against `DailyDebitSnapshot.debited_amount`.
3. Writes `BillingTransaction` rows with `source='meta_ads_daily_spend'` (debit) or `'meta_ads_refund'` (credit).
4. Idempotency key: `meta:${clientId}:${campaignId}:${YYYY-MM-DD}:${spend}`.

**Safety env var:**

- `META_BILLING_DRY_RUN=true` (default in `.env`) — computes deltas, logs them, writes **nothing**. Leave on for the first 7 days of live sync and reconcile logs against Meta Ads Manager reports.
- `META_BILLING_DRY_RUN=false` — live debits.

To observe what billing produced, use Phase 6's analytics endpoint — the `billing` block returns Meta transactions for a date range.

---

# Phase 6 — Client config & Analytics

All endpoints in this section are scoped to a specific client via `:clientId` (Mongo ObjectId).

## `GET /api/meta/client/:clientId/config`

Current Meta linkage for a client. Safe to poll on a "Meta Settings" tab.

**Response 200:**

```json
{
  "client_id": "69e7189d1f64a29d76ae5979",
  "client_name": "Advanced Grohair & Gloskin Namakkal",
  "meta_enabled": true,
  "meta_business_id": "633026626311825",
  "meta_ad_account_id": "act_800798932805550",
  "meta_ad_account_name": "ARA - Grohair Namakkal",
  "meta_ad_account_currency": "INR",
  "meta_ad_account_timezone": "Asia/Kolkata",
  "meta_pages": [
    {
      "page_id": "1067412303117759",
      "page_name": "Ad GroGlo Clinic Sahakar Nagar",
      "subscribed": true,
      "token_issued_at": "2026-04-20T12:30:45.123Z",
      "token_expires_at": null,
      "has_token": true
    }
  ],
  "meta_onboarded_at": "2026-04-20T12:30:45.123Z",
  "meta_last_sync_at": "2026-04-21T06:15:00.000Z",
  "meta_last_sync_status": "success",
  "meta_last_sync_error": ""
}
```

> **Plaintext Page tokens are never returned.** Only `has_token` and `token_expires_at` are exposed. Backend decrypts server-side when making Graph API calls.

**Response 400:** `{ "success": false, "message": "Invalid clientId" }`
**Response 404:** `{ "success": false, "message": "Client not found" }`

---

## `PUT /api/meta/client/:clientId/config`

Onboard or update a client's Meta linkage. All fields are optional; pass only what you want to change. The backend **live-verifies** the ad account against Meta before saving — invalid IDs are rejected.

**Request body (any subset):**

```json
{
  "meta_enabled": true,
  "meta_ad_account_id": "act_800798932805550",
  "meta_business_id": "633026626311825",
  "meta_onboarded_at": "2026-04-21"
}
```

**Response 200:**

```json
{
  "success": true,
  "config": {
    "client_id": "69e7189d...",
    "meta_enabled": true,
    "meta_ad_account_id": "act_800798932805550",
    "meta_ad_account_name": "ARA - Grohair Namakkal",
    "meta_ad_account_currency": "INR",
    "meta_ad_account_timezone": "Asia/Kolkata",
    "meta_pages": [],
    "meta_onboarded_at": "2026-04-21T00:00:00.000Z"
  }
}
```

**Response 400 (bad format):**

```json
{
  "success": false,
  "message": "meta_ad_account_id must match \"act_<digits>\""
}
```

**Response 400 (Meta rejected):**

```json
{
  "success": false,
  "message": "Meta Ad Account verification failed: (#100) Unsupported get request..."
}
```

**cURL:**

```bash
curl -X PUT https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/client/69e7189d.../config \
  -H 'Content-Type: application/json' \
  -d '{"meta_enabled":true,"meta_ad_account_id":"act_800798932805550"}'
```

---

## `POST /api/meta/client/:clientId/test-connection`

Dry-ping the configured ad account. Use on a "Test Connection" button after an operator pastes an ad account id.

**Request body:** none

**Response 200:**

```json
{
  "ok": true,
  "account": {
    "id": "act_800798932805550",
    "name": "ARA - Grohair Namakkal",
    "currency": "INR",
    "timezone_name": "Asia/Kolkata",
    "account_status": 1,
    "business": { "id": "633026626311825" }
  }
}
```

**Response 400 (no ad account set):** `{ "ok": false, "message": "No meta_ad_account_id configured" }`
**Response 5xx (Meta rejected):** `{ "ok": false, "error": "..." }`

---

## `GET /api/meta/client/:clientId/available-pages`

Every Facebook Page the agency's System User can see, with a flag for whether it's already attached to **this** client. Drives a page picker dropdown.

**Response 200:**

```json
{
  "pages": [
    {
      "page_id": "1067412303117759",
      "page_name": "Ad GroGlo Clinic Sahakar Nagar",
      "category": "",
      "tasks": [
        "ADVERTISE",
        "ANALYZE",
        "CREATE_CONTENT",
        "MESSAGING",
        "MODERATE",
        "MANAGE"
      ],
      "already_assigned": false,
      "instagram_business_account": null
    },
    {
      "page_id": "998035133385999",
      "page_name": "Minus Slimming Clinic Velachery",
      "category": "",
      "tasks": [
        "ADVERTISE",
        "ANALYZE",
        "CREATE_CONTENT",
        "MESSAGING",
        "MODERATE",
        "MANAGE"
      ],
      "already_assigned": true,
      "instagram_business_account": null
    }
  ]
}
```

---

## `POST /api/meta/client/:clientId/pages/:pageId/subscribe`

Attach a Page to the client and subscribe it to `leadgen`. Backend encrypts the Page token before storage. **Idempotent** — safe to call if already subscribed.

**Path params:**

- `clientId` — Mongo ObjectId
- `pageId` — Facebook Page id (e.g. `1067412303117759`)

**Request body:** none

**Response 200:**

```json
{ "ok": true, "subscribed": true, "graph_response": { "success": true } }
```

**Response 404 (Page unavailable):**

```json
{
  "ok": false,
  "message": "Page 1067412303117759 is not assigned to the System User — assign it in Business Settings first"
}
```

---

## `DELETE /api/meta/client/:clientId/pages/:pageId/subscribe`

Unsubscribe a Page. Keeps the row in `meta_pages` but flips `subscribed: false`. Use before re-binding to a different client.

**Response 200:**

```json
{ "ok": true, "subscribed": false, "graph_response": { "success": true } }
```

**Response 404:** `{ "ok": false, "message": "Page not assigned to this client" }`

---

## `GET /api/meta/client/:clientId/analytics`

**The one fat endpoint the dashboard needs.** Returns summary + campaigns + daily trend + lead forms + recent leads + billing in a single round trip.

**Query params (optional; default = last 30 days):**

- `from=YYYY-MM-DD` — inclusive, treated as start of day UTC
- `to=YYYY-MM-DD` — inclusive, treated as end of day UTC

**Response 200:**

```json
{
  "client_id": "69e7189d1f64a29d76ae5979",
  "client_name": "Advanced Grohair & Gloskin Namakkal",
  "range": { "from": "2026-03-22", "to": "2026-04-21" },

  "summary": {
    "spend": 62313.82,
    "impressions": 2028010,
    "reach": 834121,
    "clicks": 7057,
    "inline_link_clicks": 3512,
    "leads": 119,
    "messaging_conversations_started": 48,
    "ctr": 0.35,
    "cpc": 8.83,
    "cpl": 523.64,
    "cpm": 30.72
  },

  "campaigns": [
    {
      "campaign_id": "7001401191612",
      "name": "Namakkal before & after",
      "status": "ACTIVE",
      "effective_status": "ACTIVE",
      "objective": "OUTCOME_LEADS",
      "daily_budget": 800,
      "spend": 5125.66,
      "impressions": 145092,
      "clicks": 512,
      "leads": 12,
      "messaging_conversations_started": 3,
      "ctr": 0.35,
      "cpl": 427.14
    }
  ],

  "daily_trend": [
    {
      "date": "2026-03-22",
      "spend": 1250.45,
      "impressions": 58291,
      "clicks": 215,
      "leads": 4
    },
    {
      "date": "2026-03-23",
      "spend": 1180.3,
      "impressions": 55102,
      "clicks": 198,
      "leads": 3
    }
  ],

  "lead_forms": [
    {
      "form_id": "972207495782606",
      "name": "ARA -Sahakara",
      "status": "ACTIVE",
      "page_id": "1067412303117759",
      "leads_in_range": 29,
      "last_seen_at": "2026-04-21T06:15:00.000Z"
    }
  ],

  "leads_in_range": [
    {
      "_id": "69e718a2...",
      "name": "Upendra Bag",
      "email": "u.bag@example.com",
      "phone": "+91XXXXXXXXXX",
      "status": "new",
      "meta_form_id": "972207495782606",
      "meta_form_name": "ARA -Sahakara",
      "meta_campaign_id": "7001401191612",
      "meta_adset_id": "6973956389859",
      "meta_ad_id": "6973956389859",
      "platform": "facebook",
      "createdAt": "2026-04-21T05:30:00.000Z",
      "meta_created_time": "2026-04-20T18:42:11.000Z",
      "raw_field_data": [{ "name": "full_name", "values": ["Upendra Bag"] }]
    }
  ],

  "billing": {
    "total_debits": 62313.82,
    "total_credits": 0,
    "available_balance": 37686.18,
    "total_added_funds": 100000,
    "total_spend": 62313.82,
    "low_balance_threshold": 100,
    "transactions": [
      {
        "type": "debit",
        "amount": 351.96,
        "source": "meta_ads_daily_spend",
        "occurred_at": "2026-04-21T00:05:00.000Z",
        "campaign_id": "6995492548012",
        "campaign_name": "50% off leads",
        "metric_date": "2026-04-21T00:00:00.000Z"
      }
    ]
  },

  "entity_counts": { "campaigns": 103, "adsets": 124, "ads": 243 }
}
```

**Shape notes:**

- `summary.*` comes from campaign-level insights only — adset/ad-level rows are excluded to avoid double-counting.
- `daily_trend[]` is pre-sorted ascending.
- `leads_in_range[]` returns every Meta lead whose `meta_created_time` (or `createdAt` for legacy rows missing that field) falls inside the requested window — no row cap. Use `/api/leads` if you need pagination or richer lead fields.
- `billing.transactions[]` hard-capped at 500.
- `daily_budget`/`lifetime_budget`: currency-native major units (₹, not paise).
- Dates: ISO-8601 UTC strings.
- Percents (`ctr`, `cpc`): 0–100 scale, not 0–1.

**cURL:**

```bash
curl -s "https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/client/69e7189d1f64a29d76ae5979/analytics?from=2026-04-01&to=2026-04-21"
```

---

# Environment variables (deployment)

These must be set in Azure App Service → Configuration → Application settings:

| Var                           | Purpose                                          | Example                      |
| ----------------------------- | ------------------------------------------------ | ---------------------------- |
| `META_APP_ID`                 | Meta App ID                                      | `992567213118826`            |
| `META_APP_SECRET`             | Meta App Secret (for webhook HMAC + token debug) | `4dee09c9...`                |
| `META_VERIFY_TOKEN`           | Random string shared with Meta webhook config    | 64-char hex                  |
| `META_SYSTEM_USER_TOKEN`      | Permanent agency-wide token (never expires)      | `EAAOGvBA...`                |
| `META_API_VERSION`            | Graph API version                                | `v19.0`                      |
| `META_API_BASE_URL`           | Graph API base                                   | `https://graph.facebook.com` |
| `META_SYNC_ENABLED`           | Kill switch for the background scheduler         | `true`                       |
| `META_SYNC_INTERVAL_MINUTES`  | Sync cadence                                     | `15`                         |
| `META_INSIGHTS_BACKFILL_DAYS` | Default incremental window                       | `30`                         |
| `META_LEAD_BACKFILL_DAYS`     | Poller backfill window                           | `30`                         |
| `META_BILLING_DRY_RUN`        | `true` while validating; `false` for live debits | `true`                       |
| `ENCRYPTION_KEY`              | AES-256 key for Page tokens at rest              | 64-char hex                  |

Once all of these are live on Azure, every endpoint in this document works end-to-end.

```


1. Set the ad account

curl -X PUT "https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/client/68deb16211a12187d52ad0de/config" \
  -H "Content-Type: application/json" \
  -d '{
    "meta_enabled": true,
    "meta_ad_account_id": "act_1543617913485113"
  }'


Expected: {"success": true, "config": {"meta_ad_account_name": "Adgrohair Dharmapuri", "meta_ad_account_currency": "INR", ...}}

2. Attach + subscribe the Page

curl -X POST "https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/client/68deb16211a12187d52ad0de/pages/723158910877351/subscribe"


Expected: {"ok": true, "subscribed": true, "graph_response": {"success": true}}

3. Kick initial sync (blocking — returns when done)

curl -X POST "https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/sync/68deb16211a12187d52ad0de"



Expected: non-zero counts for campaigns, adsets, ads, insights_rows, forms, leads_fetched.

4. Verify

curl "https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api/meta/client/68deb16211a12187d52ad0de/analytics?from=2026-03-22&to=2026-04-21"


You'll get back summary.spend, campaigns[], daily_trend[], leads_in_range[] populated for Dharmapuri only.
```
