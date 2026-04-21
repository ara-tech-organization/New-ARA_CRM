// Phase-3 end-to-end smoke: run the orchestrator against a real ad account
// and verify rows land in Mongo. Defaults to act_800798932805550 (ARA -
// Grohair Namakkal) which has active campaigns + insights.
//
// Usage:
//   node backend/scripts/metaSyncSmokeTest.js
//   node backend/scripts/metaSyncSmokeTest.js act_1234567890
//
// Safe to re-run — sync upserts, no duplicates. Written rows have
// client_id=null so they're trivial to clean up.
//
// Cleanup (optional, copy-paste into node -e with MONGODB_URI set):
//   await mongoose.connect(process.env.MONGODB_URI);
//   await Promise.all([MetaCampaign, MetaAdSet, MetaAd, MetaInsights]
//     .map(m => m.deleteMany({ client_id: null })));

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_AD_ACCOUNT = 'act_800798932805550';
const adAccountId = process.argv[2] || DEFAULT_AD_ACCOUNT;

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not set in backend/.env');
  process.exit(1);
}

console.log(`Connecting to MongoDB...`);
await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected.\n');

const { syncByAdAccount } = await import('../sync/metaSyncService.js');
const { default: MetaCampaign } = await import('../models/MetaCampaign.js');
const { default: MetaAdSet } = await import('../models/MetaAdSet.js');
const { default: MetaAd } = await import('../models/MetaAd.js');
const { default: MetaInsights } = await import('../models/MetaInsights.js');
const { default: MetaSyncRun } = await import('../models/MetaSyncRun.js');

const runId = `meta-smoke-${Date.now()}`;
const run = await MetaSyncRun.create({
  run_id: runId,
  started_at: new Date(),
  scope: 'incremental',
  status: 'running',
  counts: {
    campaigns: 0, adsets: 0, ads: 0, insights_rows: 0, forms: 0,
    leads_fetched: 0, leads_inserted: 0,
  },
  errors: [],
});

console.log(`Running sync for ${adAccountId}  runId=${runId}\n`);

try {
  const result = await syncByAdAccount({
    adAccountId,
    clientId: null,
    onboardedAt: null,
    deep: false,
    run,
    label: adAccountId,
  });

  run.status = result.ok ? 'success' : 'partial';
  run.ended_at = new Date();
  run.duration_ms = run.ended_at - run.started_at;
  await run.save();

  console.log('\n━━━━━━ Sync result ━━━━━━');
  console.log(`status=${run.status}  duration=${run.duration_ms}ms`);
  console.log('counts:', run.counts);
  if (run.errors.length) {
    console.log('errors:');
    run.errors.forEach((e) => console.log(`  - [${e.stage}] ${e.message}`));
  }

  // ----------------- DB verification -----------------
  console.log('\n━━━━━━ DB verification ━━━━━━');

  const campaignCount = await MetaCampaign.countDocuments({ ad_account_id: adAccountId });
  const adsetCount = await MetaAdSet.countDocuments({ ad_account_id: adAccountId });
  const adCount = await MetaAd.countDocuments({ ad_account_id: adAccountId });
  const insightCampaignCount = await MetaInsights.countDocuments({
    ad_account_id: adAccountId,
    level: 'campaign',
  });
  const insightAdsetCount = await MetaInsights.countDocuments({
    ad_account_id: adAccountId,
    level: 'adset',
  });
  const insightAdCount = await MetaInsights.countDocuments({
    ad_account_id: adAccountId,
    level: 'ad',
  });

  console.log(`MetaCampaign    rows: ${campaignCount}`);
  console.log(`MetaAdSet       rows: ${adsetCount}`);
  console.log(`MetaAd          rows: ${adCount}`);
  console.log(`MetaInsights[campaign]: ${insightCampaignCount}`);
  console.log(`MetaInsights[adset]:    ${insightAdsetCount}`);
  console.log(`MetaInsights[ad]:       ${insightAdCount}`);

  // Spot-check: aggregate campaign-level spend last 30d
  const agg = await MetaInsights.aggregate([
    { $match: { ad_account_id: adAccountId, level: 'campaign' } },
    {
      $group: {
        _id: null,
        total_spend: { $sum: '$spend' },
        total_impressions: { $sum: '$impressions' },
        total_clicks: { $sum: '$clicks' },
        total_leads: { $sum: '$leads' },
        row_count: { $sum: 1 },
      },
    },
  ]);
  console.log('\nAggregate (campaign-level insights):', agg[0] || 'none');

  // Show a sample campaign + most recent insights row
  const sampleCampaign = await MetaCampaign.findOne({ ad_account_id: adAccountId }).lean();
  if (sampleCampaign) {
    console.log('\nSample campaign:');
    console.log(`  ${sampleCampaign.name} [${sampleCampaign.campaign_id}]`);
    console.log(`  status=${sampleCampaign.status} objective=${sampleCampaign.objective}`);
  }

  const latestInsight = await MetaInsights.findOne({
    ad_account_id: adAccountId,
    level: 'campaign',
  })
    .sort({ date: -1 })
    .lean();
  if (latestInsight) {
    console.log('\nLatest campaign-level insight row:');
    console.log(`  date=${latestInsight.date.toISOString().slice(0, 10)}  entity=${latestInsight.entity_id}`);
    console.log(`  spend=₹${latestInsight.spend} impressions=${latestInsight.impressions} clicks=${latestInsight.clicks} leads=${latestInsight.leads}`);
  }

  console.log('\n✅ Smoke test complete.');
  process.exitCode = result.ok ? 0 : 1;
} catch (err) {
  console.error('Smoke test crashed:', err);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect();
}
