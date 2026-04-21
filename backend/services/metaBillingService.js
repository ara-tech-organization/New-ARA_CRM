// Meta billing reconciliation — mirrors the Google Ads reconciler in
// sync/syncService.js:reconcileDailyDebit, generalized with platform='meta'.
//
// Model: ad-spend pass-through. Every rupee Meta reports as `spend` on a
// given (client, campaign, date) debits the client's balance. Corrections
// (Meta sometimes revises yesterday's number) produce credit or debit deltas.
//
// Source of truth: MetaInsights rows where level='campaign'.
// Idempotency key: BillingTransaction.idempotency_key = meta:<clientId>:<campaignId>:<YYYY-MM-DD>
//
// Safety: META_BILLING_DRY_RUN=true short-circuits all writes. In dry-run
// mode this function still queries + computes deltas, logs them, and
// returns a summary — no Mongo mutations.

import Client from '../models/Client.js';
import MetaInsights from '../models/MetaInsights.js';
import BillingTransaction from '../models/BillingTransaction.js';
import DailyDebitSnapshot from '../models/DailyDebitSnapshot.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const startOfUtcDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const isDryRun = () =>
  String(process.env.META_BILLING_DRY_RUN || 'true').toLowerCase() !== 'false';

// Reconcile one (client, campaign, day) MetaInsights row.
// Returns { action: 'debit'|'credit'|'noop', delta, balanceAfter }.
const reconcileSingle = async (clientId, insight, { dryRun }) => {
  const reportedCost = round2(insight.spend);
  const dateKey = startOfUtcDay(insight.date);
  const campaignId = insight.campaign_id || insight.entity_id;

  const snapshot = await DailyDebitSnapshot.findOne({
    client_id: clientId,
    platform: 'meta',
    campaign_id: campaignId,
    date: dateKey,
  });

  const debitedSoFar = snapshot ? round2(snapshot.debited_amount) : 0;
  const delta = round2(reportedCost - debitedSoFar);

  if (delta === 0) {
    if (snapshot && !dryRun) {
      snapshot.reported_amount = reportedCost;
      snapshot.last_synced_at = new Date();
      await snapshot.save();
    }
    return { action: 'noop', delta: 0 };
  }

  const isDebit = delta > 0;
  const absAmount = round2(Math.abs(delta));
  const balanceChange = isDebit ? -absAmount : absAmount;
  const totalSpendChange = delta;
  const idempotencyKey = `meta:${clientId}:${campaignId}:${dateKey.toISOString().slice(0, 10)}:${reportedCost}`;

  if (dryRun) {
    return {
      action: isDebit ? 'debit' : 'credit',
      delta,
      absAmount,
      dryRun: true,
      idempotency_key: idempotencyKey,
    };
  }

  const updatedClient = await Client.findByIdAndUpdate(
    clientId,
    {
      $inc: {
        'billing.available_balance': balanceChange,
        'billing.total_spend': totalSpendChange,
      },
    },
    { new: true }
  );
  const newBalance = round2(updatedClient?.billing?.available_balance);

  try {
    await BillingTransaction.create({
      client_id: clientId,
      type: isDebit ? 'debit' : 'credit',
      amount: absAmount,
      balance_after: newBalance,
      occurred_at: new Date(),
      source: isDebit ? 'meta_ads_daily_spend' : 'meta_ads_refund',
      reference: {
        campaign_id: campaignId,
        campaign_name: insight.campaign_name || '',
        metric_date: dateKey,
      },
      description: isDebit
        ? `Meta spend (campaign ${campaignId}) on ${dateKey.toISOString().slice(0, 10)}`
        : `Meta cost revision / refund (campaign ${campaignId}) on ${dateKey.toISOString().slice(0, 10)}`,
      idempotency_key: idempotencyKey,
    });
  } catch (err) {
    // Duplicate key = another concurrent reconciliation already wrote this.
    // Roll the cached balance change back so the two attempts net to one.
    if (err?.code === 11000) {
      await Client.findByIdAndUpdate(clientId, {
        $inc: {
          'billing.available_balance': -balanceChange,
          'billing.total_spend': -totalSpendChange,
        },
      });
      return { action: 'noop', delta: 0, duplicate: true };
    }
    // Other failure — undo the inc to prevent drift, then bubble up.
    await Client.findByIdAndUpdate(clientId, {
      $inc: {
        'billing.available_balance': -balanceChange,
        'billing.total_spend': -totalSpendChange,
      },
    });
    throw err;
  }

  // Persist / refresh the snapshot so future runs know where we left off.
  if (snapshot) {
    snapshot.debited_amount = reportedCost;
    snapshot.reported_amount = reportedCost;
    snapshot.last_synced_at = new Date();
    await snapshot.save();
  } else {
    try {
      await DailyDebitSnapshot.create({
        client_id: clientId,
        platform: 'meta',
        campaign_id: campaignId,
        date: dateKey,
        debited_amount: reportedCost,
        reported_amount: reportedCost,
        last_synced_at: new Date(),
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  return {
    action: isDebit ? 'debit' : 'credit',
    delta,
    absAmount,
    balanceAfter: newBalance,
  };
};

/**
 * Reconcile every campaign-level MetaInsights row for a client within the
 * sync window. Safe to re-run — idempotent on (client, campaign, date, cost).
 *
 * @param {Object} client  Client mongoose doc (needs _id)
 * @param {Object} opts
 * @param {Date|null} opts.since   Floor date; defaults to 30d back
 * @returns {Object} summary counts
 */
export const reconcileMetaSpend = async (client, { since = null } = {}) => {
  const dryRun = isDryRun();

  const floor = since ? startOfUtcDay(since) : (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();

  const rows = await MetaInsights.find({
    client_id: client._id,
    level: 'campaign',
    date: { $gte: floor },
    spend: { $gt: 0 },
  }).sort({ date: 1 });

  const summary = {
    dry_run: dryRun,
    window_since: floor,
    rows_considered: rows.length,
    debits: 0,
    credits: 0,
    noops: 0,
    total_debited: 0,
    total_credited: 0,
    errors: [],
  };

  for (const insight of rows) {
    try {
      const result = await reconcileSingle(client._id, insight, { dryRun });
      if (result.action === 'debit') {
        summary.debits++;
        summary.total_debited = round2(summary.total_debited + result.absAmount);
      } else if (result.action === 'credit') {
        summary.credits++;
        summary.total_credited = round2(summary.total_credited + result.absAmount);
      } else {
        summary.noops++;
      }
    } catch (err) {
      summary.errors.push({
        campaign_id: insight.campaign_id || insight.entity_id,
        date: insight.date,
        message: err?.message || String(err),
      });
      console.error(
        `[meta-billing] reconcile failed client=${client._id} campaign=${insight.campaign_id} date=${insight.date?.toISOString()}:`,
        err?.message
      );
    }
  }

  const mode = dryRun ? 'DRY-RUN' : 'LIVE';
  console.log(
    `[meta-billing] ${mode} client=${client._id} rows=${summary.rows_considered} ` +
    `debits=${summary.debits} credits=${summary.credits} noops=${summary.noops} ` +
    `total_debited=₹${summary.total_debited} total_credited=₹${summary.total_credited}`
  );

  return summary;
};

export const __testing = {
  reconcileSingle,
  round2,
  isDryRun,
};
