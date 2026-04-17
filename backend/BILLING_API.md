# Billing API Reference

Complete endpoint list for the client billing ledger — covering onboarding, daily operations, and drift reconciliation.

---

## Endpoint summary

| # | Purpose | Endpoint | Frequency |
|---|---------|----------|-----------|
| 1 | Link client to GA | `PUT /api/clients/:id` | Once per client |
| 2 | Set opening balance | `POST /api/billing/:id/reset` | Once per client (after linking) |
| 3 | Add funds after Visa top-up | `POST /api/payments` | Every top-up |
| 4 | View balance + ledger + analytics | `GET /api/analytics/client/:id` | Every page load |
| 5 | List raw payments | `GET /api/payments/:id` | Payments tab |
| 6 | Reconcile drift with GA | `POST /api/billing/:id/reconcile` | Weekly (optional) |

---

## 1. Link client to Google Ads

**Once per client.** Updates existing client with their GA customer ID.

```http
PUT /api/clients/68deb02a11a12187d52ad0ac
Content-Type: application/json

{
  "google_ads_customer_id": "2000367396",
  "google_ads_enabled": true
}
```

### Response `200`

```json
{
  "success": true,
  "data": {
    "_id": "68deb02a11a12187d52ad0ac",
    "clientName": "Advanced Grohair & Gloskin Karaikudi",
    "google_ads_customer_id": "2000367396",
    "google_ads_enabled": true,
    "onboardDate": "2026-04-17T00:00:00.000Z",
    "billing": {
      "available_balance": 0,
      "total_spend": 0,
      "total_added_funds": 0
    }
  }
}
```

**Validation:** `google_ads_customer_id` must be exactly 10 digits. Pass any other client fields to update in the same call.

---

## 2. Set opening balance (reset)

**Once per client, right after linking.** Wipes any old ledger data and sets the starting balance from what GA currently shows.

```http
POST /api/billing/68deb02a11a12187d52ad0ac/reset
Content-Type: application/json

{
  "opening_balance": 5728.89,
  "start_date": "2026-04-17",
  "notes": "Opening balance from GA UI",
  "confirm": true
}
```

### Request fields

| Field | Required | Notes |
|-------|----------|-------|
| `opening_balance` | ✅ | Current "Available funds" from GA UI |
| `confirm` | ✅ | Must be literally `true` (safety guard) |
| `start_date` | ❌ | Defaults to today. Becomes new `onboardDate` |
| `notes` | ❌ | Shown in ledger description |

### Response `200`

```json
{
  "message": "Client billing reset successfully. Tracking begins from start_date.",
  "reset": {
    "cleared_transactions": 0,
    "cleared_snapshots": 0,
    "existing_metrics_marked_as_accounted": 2,
    "new_onboard_date": "2026-04-17",
    "opening_balance": 5728.89,
    "opening_ledger_row_id": "69e1ded75855d457855afc44"
  },
  "client": {
    "clientId": "68deb02a11a12187d52ad0ac",
    "clientName": "Advanced Grohair & Gloskin Karaikudi",
    "onboardDate": "2026-04-17T00:00:00.000Z",
    "billing": {
      "available_balance": 5728.89,
      "total_spend": 0,
      "total_added_funds": 0
    }
  }
}
```

---

## 3. Add funds (Visa top-up)

**Every time** you top up Google Ads. Enter it in CRM at the same time for accurate tracking.

```http
POST /api/payments
Content-Type: application/json

{
  "clientId": "68deb02a11a12187d52ad0ac",
  "amount": 10000,
  "method": "other",
  "notes": "Visa ••5983 top-up",
  "date": "2026-04-20"
}
```

### Request fields

| Field | Required | Notes |
|-------|----------|-------|
| `clientId` | ✅ | |
| `amount` | ✅ | Positive number in INR |
| `method` | ❌ | `bank_transfer` \| `upi` \| `cash` \| `other`. Default `bank_transfer` |
| `notes` | ❌ | Shown in ledger + payments list |
| `date` | ❌ | ISO string. Defaults to now. Use for backdated entries |

### Response `201`

```json
{
  "message": "Payment added successfully",
  "payment": {
    "id": "69e1f0a8...",
    "amount": 10000,
    "method": "other",
    "date": "2026-04-20T00:00:00.000Z",
    "notes": "Visa ••5983 top-up",
    "balance_after": 15728.89
  }
}
```

---

## 4. View balance + ledger + analytics

**Every billing-page load.** Returns KPIs, full ledger, balance timeline, campaigns — everything.

```http
GET /api/analytics/client/68deb02a11a12187d52ad0ac
GET /api/analytics/client/68deb02a11a12187d52ad0ac?start_date=2026-04-01&end_date=2026-04-30
```

### Query params (optional)

| Param | Notes |
|-------|-------|
| `start_date` | ISO date. Defaults to today |
| `end_date` | ISO date. Defaults to today |

### Response `200` (abridged)

```json
{
  "client": {
    "clientId": "68deb02a11a12187d52ad0ac",
    "clientName": "Advanced Grohair & Gloskin Karaikudi",
    "googleAdsCustomerId": "2000367396",
    "googleAdsAccountName": "Advanced Grohair & Gloskin Karaikudi",
    "billing": {
      "billing_type": "monthly",
      "low_balance_threshold": 100,
      "available_balance": 5728.89,
      "total_spend": 0,
      "total_added_funds": 0,
      "range": {
        "start_date": "2026-04-17",
        "end_date": "2026-04-17",
        "credits_in_range": 0,
        "debits_in_range": 0,
        "net_change_in_range": 0
      },
      "transactions": [
        {
          "id": "69e1ded75855d457855afc44",
          "type": "adjustment",
          "amount": 5728.89,
          "balance_after": 5728.89,
          "occurred_at": "2026-04-17T00:00:00.000Z",
          "source": "admin_adjustment",
          "description": "Fresh start after server restart",
          "reference": {}
        }
      ],
      "balance_timeline": [
        { "date": "2026-04-17", "balance": 5728.89 }
      ],
      "spend_by_day": [],
      "credits_by_day": []
    }
  },
  "dateRange": { "start_date": "2026-04-17", "end_date": "2026-04-17" },
  "summary": {
    "totalImpressions": 432,
    "totalClicks": 8,
    "totalCost": 386.04,
    "totalConversions": 0,
    "cpl": 0,
    "ctr": 2.93,
    "cpc": 29.02,
    "cpa": 0,
    "roas": 0
  },
  "dailyMetrics": [ /* per-campaign-per-day rows */ ],
  "campaignMetrics": [ /* aggregated per campaign */ ],
  "campaigns": [ /* all campaigns with budget + status */ ]
}
```

### Transaction types reference

| `type` | `source` | Meaning |
|--------|----------|---------|
| `credit` | `manual_payment` | Admin top-up via `/api/payments` |
| `debit` | `google_ads_daily_spend` | Auto-synced Google Ads spend |
| `credit` | `google_ads_refund` | GA refunded invalid clicks (auto) |
| `adjustment` | `admin_adjustment` | From reset or reconcile |

---

## 5. List raw payments

**Payments tab** in UI. Returns just the `Payment` collection — not debits or adjustments.

```http
GET /api/payments/68deb02a11a12187d52ad0ac
```

### Response `200`

```json
{
  "count": 3,
  "payments": [
    {
      "id": "69e1f0a8...",
      "amount": 10000,
      "method": "other",
      "date": "2026-04-20T00:00:00.000Z",
      "notes": "Visa ••5983 top-up"
    },
    {
      "id": "69de1234...",
      "amount": 5000,
      "method": "bank_transfer",
      "date": "2026-04-01T00:00:00.000Z",
      "notes": "April initial"
    }
  ]
}
```

Sorted newest-first.

---

## 6. Reconcile drift with GA

**Weekly sanity check** or whenever CRM vs GA doesn't match. Deep-syncs spend, inserts one adjustment row to close any gap.

```http
POST /api/billing/68deb02a11a12187d52ad0ac/reconcile
Content-Type: application/json

{
  "google_ads_balance": 4500.25,
  "notes": "Weekly reconcile 2026-04-24",
  "skip_deep_sync": false
}
```

### Request fields

| Field | Required | Notes |
|-------|----------|-------|
| `google_ads_balance` | ✅ | Current "Available funds" from GA UI |
| `notes` | ❌ | Shown in ledger |
| `skip_deep_sync` | ❌ | Default `false`. Set `true` to skip pre-reconcile deep sync |

### Response `200`

```json
{
  "message": "Reconciled. Adjustment of +120.50 inserted.",
  "reconciliation": {
    "google_ads_balance": 4500.25,
    "ledger_before": {
      "total_credits": 10000,
      "total_debits": 5620.25,
      "total_adjustments": 5728.89,
      "balance": 10108.64
    },
    "gap_detected": 120.50,
    "adjustment_inserted": {
      "id": "69e2abcd...",
      "amount": 120.50,
      "type": "adjustment",
      "occurred_at": "2026-04-24T10:15:00.000Z"
    },
    "ledger_after": {
      "available_balance": 4500.25,
      "total_spend": 5620.25,
      "total_added_funds": 10120.50
    },
    "deep_sync_ran": true
  }
}
```

If balance already matches GA (no gap), `adjustment_inserted` will be `null` and message will say *"Already in sync with Google Ads — no adjustment needed."*

---

## Error responses (all endpoints)

| Status | Meaning |
|--------|---------|
| `400` | Validation error — check `error` field for details |
| `404` | Client not found |
| `500` | Server error — check logs |

All error responses follow the shape:

```json
{ "error": "human-readable message" }
```

---

## Auto-magic (no endpoint needed)

- **Every 15 min**: cron syncs today's spend from Google Ads → inserts debit ledger rows
- **Google refunds invalid clicks**: auto-detected via negative delta → inserts credit rows
- **New campaigns created in GA**: auto-picked up in next sync
- **`onboardDate` floor**: never pulls or reconciles data from before the client's onboard date

---

## Typical workflows

### Onboarding an existing client (has GA balance already)

1. `PUT /api/clients/:id` → set `google_ads_customer_id` + `google_ads_enabled: true`
2. Check Google Ads UI → note current "Available funds"
3. `POST /api/billing/:id/reset` → set `opening_balance` to that number
4. Done. Cron will handle spend sync going forward.

### Onboarding a brand-new client (empty GA account)

1. `PUT /api/clients/:id` → set `google_ads_customer_id` + `google_ads_enabled: true`
2. Skip reset (no opening balance needed)
3. When they fund the account, `POST /api/payments` for each top-up

### Daily usage

- You top up Google Ads → `POST /api/payments` with amount + notes
- User opens client billing page → frontend calls `GET /api/analytics/client/:id`
- User opens payments history tab → frontend calls `GET /api/payments/:id`

### Monthly reconciliation (optional)

- Check GA UI → note current available balance
- `POST /api/billing/:id/reconcile` with that number
- Any drift gets closed with a single `adjustment` ledger row

---

## Endpoint cheat sheet — which to use when

| Situation | Use |
|-----------|-----|
| New client being onboarded | #1 (link) → #2 (reset if existing balance) |
| Made a Visa top-up | #3 |
| User opens "billing" page in UI | #4 |
| User opens "payments history" tab | #5 |
| Numbers drifting from GA | #6 |
| CRM was down for days, catch up | #6 (includes deep-sync) |
| Nothing | Nothing — cron runs automatically every 15 min |
