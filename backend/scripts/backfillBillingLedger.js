/**
 * Backfill the BillingTransaction ledger from existing Payment + Metric data.
 *
 * Usage:
 *   node scripts/backfillBillingLedger.js                     # dry run, all clients
 *   node scripts/backfillBillingLedger.js --apply             # apply changes, all clients
 *   node scripts/backfillBillingLedger.js --client=<id>       # dry run, single client
 *   node scripts/backfillBillingLedger.js --client=<id> --apply
 *
 * Safe to re-run: with --apply it first deletes any prior `backfill_*` ledger
 * rows and all DailyDebitSnapshot rows for the client before re-inserting.
 * Manually-created ledger rows (source: manual_payment / google_ads_daily_spend
 * / google_ads_refund / admin_adjustment) are NEVER touched.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Client from '../models/Client.js';
import Payment from '../models/Payment.js';
import Metric from '../models/Metric.js';
import BillingTransaction from '../models/BillingTransaction.js';
import DailyDebitSnapshot from '../models/DailyDebitSnapshot.js';

dotenv.config();

const ARGS = process.argv.slice(2);
const DRY_RUN = !ARGS.includes('--apply');
const CLIENT_ARG = ARGS.find(a => a.startsWith('--client='));
const CLIENT_ID_FILTER = CLIENT_ARG ? CLIENT_ARG.split('=')[1] : null;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function startOfUtcDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function backfillClient(client) {
  console.log(`\n=== Client: ${client.clientName} (${client._id}) ===`);

  const payments = await Payment.find({ client_id: client._id }).sort({ date: 1, createdAt: 1 });
  const metrics = await Metric.find({
    client_id: client._id,
    cost: { $gt: 0 }
  }).sort({ date: 1 });

  const events = [];

  for (const p of payments) {
    events.push({
      type: 'credit',
      amount: round2(p.amount),
      occurred_at: p.date || p.createdAt,
      source: 'backfill_payment',
      reference: { payment_id: p._id },
      idempotency_key: `backfill:payment:${p._id}`,
      description: `Backfill: ${p.notes?.trim() || 'Payment'}`
    });
  }

  for (const m of metrics) {
    const dateKey = startOfUtcDay(m.date);
    events.push({
      type: 'debit',
      amount: round2(m.cost),
      occurred_at: dateKey,
      source: 'backfill_spend',
      reference: {
        campaign_id: m.campaign_id,
        campaign_name: m.campaign_name,
        metric_date: dateKey
      },
      idempotency_key: `backfill:gads:${client._id}:${dateKey.toISOString().slice(0, 10)}:${m.campaign_id}`,
      description: `Backfill: Google Ads spend (${m.campaign_name}) on ${dateKey.toISOString().slice(0, 10)}`
    });
  }

  // Chronological order; ties resolved by type (credits before debits on same ts)
  events.sort((a, b) => {
    const ta = new Date(a.occurred_at).getTime();
    const tb = new Date(b.occurred_at).getTime();
    if (ta !== tb) return ta - tb;
    if (a.type === b.type) return 0;
    return a.type === 'credit' ? -1 : 1;
  });

  let balance = 0;
  let totalCredits = 0;
  let totalDebits = 0;
  const ledgerDocs = [];
  const snapshotMap = new Map();

  for (const e of events) {
    if (e.type === 'credit') {
      balance = round2(balance + e.amount);
      totalCredits = round2(totalCredits + e.amount);
    } else {
      balance = round2(balance - e.amount);
      totalDebits = round2(totalDebits + e.amount);
    }

    ledgerDocs.push({
      client_id: client._id,
      type: e.type,
      amount: e.amount,
      balance_after: balance,
      occurred_at: e.occurred_at,
      source: e.source,
      reference: e.reference,
      description: e.description,
      idempotency_key: e.idempotency_key
    });

    if (e.type === 'debit' && e.reference?.campaign_id) {
      const key = `${e.reference.campaign_id}|${new Date(e.occurred_at).toISOString().slice(0, 10)}`;
      snapshotMap.set(key, round2((snapshotMap.get(key) || 0) + e.amount));
    }
  }

  const ledgerBalance = round2(balance);
  const cachedBalance = round2(client.billing?.available_balance);
  const drift = round2(cachedBalance - ledgerBalance);

  console.log(`  Payments:          ${payments.length}`);
  console.log(`  Metric rows (>0):  ${metrics.length}`);
  console.log(`  Ledger rows:       ${ledgerDocs.length}`);
  console.log(`  Snapshot rows:     ${snapshotMap.size}`);
  console.log(`  Total credits:     ${totalCredits.toFixed(2)}`);
  console.log(`  Total debits:      ${totalDebits.toFixed(2)}`);
  console.log(`  Ledger balance:    ${ledgerBalance.toFixed(2)}`);
  console.log(`  Cached balance:    ${cachedBalance.toFixed(2)}`);
  console.log(`  Drift (cache - ledger): ${drift >= 0 ? '+' : ''}${drift.toFixed(2)}`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] No changes written.');
    return;
  }

  // Wipe any prior backfill rows + all snapshots for this client
  const deletedTx = await BillingTransaction.deleteMany({
    client_id: client._id,
    source: { $in: ['backfill_payment', 'backfill_spend'] }
  });
  const deletedSnap = await DailyDebitSnapshot.deleteMany({ client_id: client._id });
  console.log(`  Cleared ${deletedTx.deletedCount} old backfill tx + ${deletedSnap.deletedCount} snapshots.`);

  if (ledgerDocs.length > 0) {
    await BillingTransaction.insertMany(ledgerDocs, { ordered: false });
  }

  const snapshotDocs = [];
  for (const [key, amount] of snapshotMap.entries()) {
    const [campaign_id, dateStr] = key.split('|');
    snapshotDocs.push({
      client_id: client._id,
      campaign_id,
      date: new Date(dateStr + 'T00:00:00.000Z'),
      debited_amount: amount,
      reported_amount: amount,
      last_synced_at: new Date()
    });
  }
  if (snapshotDocs.length > 0) {
    await DailyDebitSnapshot.insertMany(snapshotDocs, { ordered: false });
  }

  await Client.findByIdAndUpdate(client._id, {
    'billing.total_added_funds': totalCredits,
    'billing.total_spend': totalDebits,
    'billing.available_balance': ledgerBalance
  });

  console.log('  [APPLIED] Ledger, snapshots, and client cache updated.');
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  if (CLIENT_ID_FILTER) console.log(`Client filter: ${CLIENT_ID_FILTER}`);

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const filter = CLIENT_ID_FILTER ? { _id: CLIENT_ID_FILTER } : {};
  const clients = await Client.find(filter);

  if (clients.length === 0) {
    console.log('No clients matched.');
  }

  for (const client of clients) {
    try {
      await backfillClient(client);
    } catch (err) {
      console.error(`  Failed for client ${client._id}:`, err.message);
    }
  }

  console.log(
    `\nDone. ${DRY_RUN ? 'No changes applied — re-run with --apply to commit.' : 'Backfill complete.'}`
  );
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
