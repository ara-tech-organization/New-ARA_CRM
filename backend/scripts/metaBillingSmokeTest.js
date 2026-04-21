// Phase 5 smoke test: prove the billing reconciler against the real
// MetaInsights rows that Phase 3 already wrote into Mongo.
//
// Strategy: create a synthetic Client, relabel an existing subset of
// MetaInsights rows to belong to this Client (so we have real spend numbers
// to reconcile without touching production ledgers), then run:
//
//   1. Dry-run pass — no writes, returns totals
//   2. Live pass — debits client balance, writes BillingTransaction rows
//   3. Live pass again — idempotent, no duplicate transactions
//   4. Refund path — modify an insight's spend DOWN, reconcile, see credit
//   5. Verify totals + cleanup
//
// Cleans up after itself unless --keep is passed.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const KEEP = process.argv.includes("--keep");

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

console.log("Connecting to MongoDB...");
await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected.\n");

const { default: Client } = await import("../models/Client.js");
const { default: MetaInsights } = await import("../models/MetaInsights.js");
const { default: BillingTransaction } = await import("../models/BillingTransaction.js");
const { default: DailyDebitSnapshot } = await import("../models/DailyDebitSnapshot.js");
const { reconcileMetaSpend } = await import("../services/metaBillingService.js");

const h = (t) => console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const info = (t) => console.log(`    ${t}`);

let failures = 0;
let testClient = null;
let clonedInsightIds = [];

const restoreDryRun = process.env.META_BILLING_DRY_RUN;

try {
  // ------------------------------------------------------------------
  h("1. Create synthetic client with ₹100,000 balance");
  // ------------------------------------------------------------------
  testClient = await Client.create({
    clientName: `TEST-BILLING-PHASE5-${Date.now()}`,
    place: "—",
    status: "active",
    meta_enabled: true,
    meta_ad_account_id: "",
    billing: {
      billing_type: "monthly",
      total_added_funds: 100_000,
      total_spend: 0,
      available_balance: 100_000,
      low_balance_threshold: 100,
    },
  });
  ok(`Client: ${testClient._id}  balance=₹${testClient.billing.available_balance}`);

  // ------------------------------------------------------------------
  h("2. Clone 5 real MetaInsights rows under the synthetic client");
  // ------------------------------------------------------------------
  // Pull 5 real campaign-level rows from Phase 3's sync run.
  const real = await MetaInsights.find({
    ad_account_id: "act_800798932805550",
    level: "campaign",
    spend: { $gt: 0 },
  })
    .sort({ date: -1 })
    .limit(5)
    .lean();

  if (real.length === 0) {
    throw new Error(
      "No MetaInsights rows with spend found. Run metaSyncSmokeTest.js first."
    );
  }

  const clones = await MetaInsights.insertMany(
    real.map((r) => ({
      ...r,
      _id: undefined,
      client_id: testClient._id,
      // Offset the campaign_id + entity_id so we don't collide with real
      // rows; we need stable ids for the reconciler to look up.
      campaign_id: `${r.campaign_id}-phase5-test`,
      entity_id: `${r.entity_id}-phase5-test`,
    }))
  );
  clonedInsightIds = clones.map((c) => c._id);
  const totalSpend = clones.reduce((s, r) => s + Number(r.spend), 0).toFixed(2);
  ok(`Cloned ${clones.length} rows, total spend=₹${totalSpend}`);
  clones.forEach((c) =>
    info(`   ${c.date.toISOString().slice(0, 10)}  campaign=${c.campaign_id}  spend=₹${c.spend}`)
  );

  // ------------------------------------------------------------------
  h("3. DRY RUN — should compute deltas but write nothing");
  // ------------------------------------------------------------------
  process.env.META_BILLING_DRY_RUN = "true";

  const dryBefore = await Client.findById(testClient._id);
  const dryBeforeTxCount = await BillingTransaction.countDocuments({
    client_id: testClient._id,
  });

  const drySummary = await reconcileMetaSpend(testClient);

  const dryAfter = await Client.findById(testClient._id);
  const dryAfterTxCount = await BillingTransaction.countDocuments({
    client_id: testClient._id,
  });

  if (drySummary.dry_run !== true) {
    failures++;
    console.log("  ✗ expected dry_run=true");
  } else ok("Summary.dry_run=true");

  if (dryBefore.billing.available_balance !== dryAfter.billing.available_balance) {
    failures++;
    console.log("  ✗ dry-run mutated balance");
  } else ok(`Balance unchanged: ₹${dryAfter.billing.available_balance}`);

  if (dryBeforeTxCount !== dryAfterTxCount) {
    failures++;
    console.log("  ✗ dry-run wrote BillingTransaction rows");
  } else ok(`BillingTransaction count unchanged: ${dryAfterTxCount}`);

  ok(
    `Projected: debits=${drySummary.debits} credits=${drySummary.credits} noops=${drySummary.noops}`
  );
  info(`   total_debited=₹${drySummary.total_debited}`);

  // ------------------------------------------------------------------
  h("4. LIVE — should debit balance + write transactions");
  // ------------------------------------------------------------------
  process.env.META_BILLING_DRY_RUN = "false";

  const liveSummary = await reconcileMetaSpend(testClient);

  const liveAfter = await Client.findById(testClient._id);
  const liveTxns = await BillingTransaction.find({
    client_id: testClient._id,
    source: "meta_ads_daily_spend",
  }).sort({ occurred_at: 1 });

  if (liveSummary.debits !== clones.length) {
    failures++;
    console.log(`  ✗ expected ${clones.length} debits, got ${liveSummary.debits}`);
  } else ok(`Debits=${liveSummary.debits}`);

  if (liveTxns.length !== clones.length) {
    failures++;
    console.log(
      `  ✗ expected ${clones.length} BillingTransaction rows, found ${liveTxns.length}`
    );
  } else ok(`BillingTransaction rows=${liveTxns.length}`);

  const expectedBalance = Math.round((100_000 - Number(totalSpend)) * 100) / 100;
  const actualBalance =
    Math.round((liveAfter.billing.available_balance || 0) * 100) / 100;
  if (Math.abs(actualBalance - expectedBalance) > 0.01) {
    failures++;
    console.log(
      `  ✗ balance expected=₹${expectedBalance}, got=₹${actualBalance}`
    );
  } else ok(`Balance after debit: ₹${actualBalance}  (spent ₹${totalSpend})`);

  const snapshotCount = await DailyDebitSnapshot.countDocuments({
    client_id: testClient._id,
    platform: "meta",
  });
  if (snapshotCount !== clones.length) {
    failures++;
    console.log(
      `  ✗ expected ${clones.length} DailyDebitSnapshot rows, got ${snapshotCount}`
    );
  } else ok(`DailyDebitSnapshot rows=${snapshotCount}  platform='meta'`);

  // ------------------------------------------------------------------
  h("5. IDEMPOTENCY — re-run live pass, expect no new transactions");
  // ------------------------------------------------------------------
  const idempotentSummary = await reconcileMetaSpend(testClient);
  const idempotentTxns = await BillingTransaction.countDocuments({
    client_id: testClient._id,
    source: "meta_ads_daily_spend",
  });

  if (idempotentSummary.debits !== 0 || idempotentSummary.credits !== 0) {
    failures++;
    console.log(
      `  ✗ second pass should have 0 debits/credits, got debits=${idempotentSummary.debits} credits=${idempotentSummary.credits}`
    );
  } else ok("Second pass: 0 debits, 0 credits — all noops");

  if (idempotentTxns !== liveTxns.length) {
    failures++;
    console.log(
      `  ✗ BillingTransaction count drifted: before=${liveTxns.length} after=${idempotentTxns}`
    );
  } else ok(`BillingTransaction count unchanged: ${idempotentTxns}`);

  const idempotentBalance = Math.round(
    (await Client.findById(testClient._id)).billing.available_balance * 100
  ) / 100;
  if (Math.abs(idempotentBalance - actualBalance) > 0.01) {
    failures++;
    console.log(
      `  ✗ balance drifted on idempotent pass: before=₹${actualBalance} after=₹${idempotentBalance}`
    );
  } else ok(`Balance unchanged: ₹${idempotentBalance}`);

  // ------------------------------------------------------------------
  h("6. REFUND PATH — lower one insight's spend, expect a credit");
  // ------------------------------------------------------------------
  const target = clones[0];
  const originalSpend = Number(target.spend);
  const reducedSpend = Math.round(originalSpend * 0.5 * 100) / 100;
  const expectedRefund = Math.round((originalSpend - reducedSpend) * 100) / 100;

  await MetaInsights.updateOne(
    { _id: target._id },
    { $set: { spend: reducedSpend } }
  );
  info(`   Reduced campaign=${target.campaign_id} date=${target.date.toISOString().slice(0, 10)} from ₹${originalSpend} → ₹${reducedSpend}`);

  const refundSummary = await reconcileMetaSpend(testClient);
  const refundTxns = await BillingTransaction.find({
    client_id: testClient._id,
    source: "meta_ads_refund",
  });

  if (refundSummary.credits !== 1) {
    failures++;
    console.log(`  ✗ expected 1 credit, got ${refundSummary.credits}`);
  } else ok(`Credits=1  amount=₹${refundSummary.total_credited}`);

  if (refundTxns.length !== 1) {
    failures++;
    console.log(`  ✗ expected 1 refund transaction, got ${refundTxns.length}`);
  } else ok(`BillingTransaction source=meta_ads_refund  amount=₹${refundTxns[0].amount}`);

  if (Math.abs(refundTxns[0].amount - expectedRefund) > 0.01) {
    failures++;
    console.log(
      `  ✗ refund amount expected=₹${expectedRefund}, got=₹${refundTxns[0].amount}`
    );
  } else ok(`Refund amount correct`);

  const finalBalance = Math.round(
    (await Client.findById(testClient._id)).billing.available_balance * 100
  ) / 100;
  const expectedFinalBalance =
    Math.round((actualBalance + expectedRefund) * 100) / 100;
  if (Math.abs(finalBalance - expectedFinalBalance) > 0.01) {
    failures++;
    console.log(
      `  ✗ final balance expected=₹${expectedFinalBalance}, got=₹${finalBalance}`
    );
  } else ok(`Final balance: ₹${finalBalance}  (refund restored)`);

  // ------------------------------------------------------------------
  h(failures === 0 ? "✅ Phase 5 billing smoke test passed" : `❌ ${failures} failure(s)`);
} catch (err) {
  failures++;
  console.error("\nCRASH:", err);
} finally {
  process.env.META_BILLING_DRY_RUN = restoreDryRun;

  if (!KEEP && testClient) {
    console.log("\nCleanup...");
    await BillingTransaction.deleteMany({ client_id: testClient._id });
    await DailyDebitSnapshot.deleteMany({ client_id: testClient._id });
    await MetaInsights.deleteMany({ _id: { $in: clonedInsightIds } });
    await Client.deleteOne({ _id: testClient._id });
    console.log("Synthetic client + ledger removed.");
  } else if (KEEP) {
    console.log("\n--keep passed; synthetic data preserved for inspection.");
  }

  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}
