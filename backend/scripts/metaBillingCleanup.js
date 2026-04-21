// One-shot: undo the BillingTransaction rows + balance deltas that were
// written before we disabled the billing reconciler.
//
// For every Client with meta_enabled=true:
//   1. Sum all BillingTransaction rows where source starts with "meta_ads_"
//   2. Subtract those net movements from Client.billing.available_balance
//      and Client.billing.total_spend
//   3. Delete the BillingTransaction rows
//   4. Delete DailyDebitSnapshot rows where platform='meta'
//
// Safe to re-run — after the first successful pass there's nothing left
// to clean.
//
// Usage:
//   node backend/scripts/metaBillingCleanup.js            # dry-run (default)
//   node backend/scripts/metaBillingCleanup.js --apply    # actually delete

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const APPLY = process.argv.includes("--apply");

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

console.log("Connecting to MongoDB...");
await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected.\n");

const { default: Client } = await import("../models/Client.js");
const { default: BillingTransaction } = await import(
  "../models/BillingTransaction.js"
);
const { default: DailyDebitSnapshot } = await import(
  "../models/DailyDebitSnapshot.js"
);

const META_SOURCES = [
  "meta_ads_daily_spend",
  "meta_ads_refund",
  "meta_ads_adjustment",
];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

console.log(`Mode: ${APPLY ? "APPLY (writes will happen)" : "DRY-RUN (no writes)"}\n`);

const clients = await Client.find({
  $or: [{ meta_enabled: true }, { meta_ad_account_id: { $ne: "" } }],
}).select("_id clientName billing");

console.log(`Clients to inspect: ${clients.length}\n`);

let totalTxDeleted = 0;
let totalSnapshotsDeleted = 0;
let totalBalanceReverted = 0;

for (const client of clients) {
  const txs = await BillingTransaction.find({
    client_id: client._id,
    source: { $in: META_SOURCES },
  });

  if (!txs.length) {
    console.log(`  ~ ${client.clientName.padEnd(50)} — clean`);
    continue;
  }

  // Compute net balance movement done by these transactions.
  // debit    → available_balance -amount, total_spend +amount
  // credit   → available_balance +amount, total_spend -amount
  let balanceDelta = 0;
  let spendDelta = 0;
  for (const t of txs) {
    if (t.type === "debit") {
      balanceDelta -= t.amount;
      spendDelta += t.amount;
    } else if (t.type === "credit") {
      balanceDelta += t.amount;
      spendDelta -= t.amount;
    }
  }

  const snapCount = await DailyDebitSnapshot.countDocuments({
    client_id: client._id,
    platform: "meta",
  });

  console.log(
    `  → ${client.clientName.padEnd(50)}  txs=${txs.length}  snapshots=${snapCount}  ` +
      `balance_revert=₹${round2(-balanceDelta)}  spend_revert=₹${round2(-spendDelta)}`
  );

  if (APPLY) {
    // Reverse the cached balance + total_spend aggregates.
    await Client.updateOne(
      { _id: client._id },
      {
        $inc: {
          "billing.available_balance": -balanceDelta,
          "billing.total_spend": -spendDelta,
        },
      }
    );

    // Delete the ledger rows.
    await BillingTransaction.deleteMany({
      client_id: client._id,
      source: { $in: META_SOURCES },
    });

    // Drop the daily snapshots so a future sync (if billing is re-enabled)
    // starts fresh.
    await DailyDebitSnapshot.deleteMany({
      client_id: client._id,
      platform: "meta",
    });

    totalTxDeleted += txs.length;
    totalSnapshotsDeleted += snapCount;
    totalBalanceReverted += Math.abs(balanceDelta);
  }
}

console.log("\n━━━━━━ Summary ━━━━━━");
if (APPLY) {
  console.log(`  BillingTransaction rows deleted:   ${totalTxDeleted}`);
  console.log(`  DailyDebitSnapshot rows deleted:   ${totalSnapshotsDeleted}`);
  console.log(`  Total balance reverted:            ₹${round2(totalBalanceReverted)}`);
  console.log("\n✅ Cleanup complete.");
} else {
  console.log("  (dry-run — no writes)\n  Re-run with --apply to execute.");
}

await mongoose.disconnect();
process.exit(0);
