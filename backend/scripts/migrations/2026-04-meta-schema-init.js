// Phase-1 migration for the Meta Marketing API integration.
//
// Run once per environment:
//   node backend/scripts/migrations/2026-04-meta-schema-init.js
//
// What it does:
//   1. Back-fills `platform: 'google'` on every existing DailyDebitSnapshot doc.
//   2. Drops the old unique index (client_id, campaign_id, date) and replaces
//      it with (client_id, platform, campaign_id, date).
//   3. Ensures Mongo builds the indexes declared on the new Meta models.
//
// Safe to re-run — every step is idempotent.

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import DailyDebitSnapshot from '../../models/DailyDebitSnapshot.js';
import MetaCampaign from '../../models/MetaCampaign.js';
import MetaAdSet from '../../models/MetaAdSet.js';
import MetaAd from '../../models/MetaAd.js';
import MetaInsights from '../../models/MetaInsights.js';
import MetaLeadForm from '../../models/MetaLeadForm.js';
import MetaLeadRaw from '../../models/MetaLeadRaw.js';
import MetaSyncRun from '../../models/MetaSyncRun.js';
import MetaWebhookRetry from '../../models/MetaWebhookRetry.js';

dotenv.config();

const OLD_INDEX_KEY = { client_id: 1, campaign_id: 1, date: 1 };
const NEW_INDEX_KEY = { client_id: 1, platform: 1, campaign_id: 1, date: 1 };

const indexKeysEqual = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  try {
    // ------------------------------------------------------------------
    // 1. Backfill platform on DailyDebitSnapshot
    // ------------------------------------------------------------------
    const backfillResult = await DailyDebitSnapshot.updateMany(
      { platform: { $exists: false } },
      { $set: { platform: 'google' } }
    );
    console.log(
      `DailyDebitSnapshot backfill: matched=${backfillResult.matchedCount} modified=${backfillResult.modifiedCount}`
    );

    // ------------------------------------------------------------------
    // 2. Swap the unique compound index
    // ------------------------------------------------------------------
    const collection = DailyDebitSnapshot.collection;
    const existing = await collection.indexes();

    for (const idx of existing) {
      if (idx.name === '_id_') continue;
      if (idx.unique && indexKeysEqual(idx.key, OLD_INDEX_KEY)) {
        console.log(`Dropping old unique index: ${idx.name}`);
        await collection.dropIndex(idx.name);
      }
    }

    const hasNew = (await collection.indexes()).some(
      (idx) => idx.unique && indexKeysEqual(idx.key, NEW_INDEX_KEY)
    );
    if (!hasNew) {
      console.log('Creating new compound unique index (client_id, platform, campaign_id, date)...');
      await collection.createIndex(NEW_INDEX_KEY, {
        unique: true,
        name: 'client_platform_campaign_date_unique',
      });
    } else {
      console.log('New compound unique index already present.');
    }

    // ------------------------------------------------------------------
    // 3. Ensure indexes on new Meta collections
    // ------------------------------------------------------------------
    const models = [
      MetaCampaign,
      MetaAdSet,
      MetaAd,
      MetaInsights,
      MetaLeadForm,
      MetaLeadRaw,
      MetaSyncRun,
      MetaWebhookRetry,
    ];
    for (const Model of models) {
      console.log(`Syncing indexes for ${Model.modelName}...`);
      await Model.syncIndexes();
    }

    console.log('\nMigration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
};

run();
