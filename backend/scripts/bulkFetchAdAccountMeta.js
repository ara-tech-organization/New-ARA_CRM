/**
 * Bulk-fetch ad account name / currency / timezone for all Meta clients.
 *
 * Calls GET /{adAccountId}?fields=name,currency,timezone_name using the
 * System User token and writes the result to each client document.
 *
 * Run from backend/ directory:
 *   node scripts/bulkFetchAdAccountMeta.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import { verifyAdAccountAccess } from '../services/metaAdsService.js';

if (!process.env.MONGODB_URI)            { console.error('MONGODB_URI not set');            process.exit(1); }
if (!process.env.META_SYSTEM_USER_TOKEN) { console.error('META_SYSTEM_USER_TOKEN not set'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB.\n');

const clients = await Client.find({
  meta_enabled: true,
  meta_ad_account_id: { $exists: true, $ne: '' },
});

console.log(`Found ${clients.length} clients with ad accounts.\n`);

let ok = 0;
let fail = 0;

for (const client of clients) {
  try {
    const { account } = await verifyAdAccountAccess(client.meta_ad_account_id);
    client.meta_ad_account_name     = account.name          || '';
    client.meta_ad_account_currency = account.currency      || '';
    client.meta_ad_account_timezone = account.timezone_name || '';
    await client.save();
    console.log(`  OK   ${client.clientName.padEnd(48)} ${account.name} · ${account.currency} · ${account.timezone_name}`);
    ok++;
  } catch (err) {
    console.error(`  FAIL ${client.clientName}: ${err.message}`);
    fail++;
  }
}

console.log(`\nDone. Updated: ${ok}, Failed: ${fail}`);
await mongoose.disconnect();
