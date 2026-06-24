/**
 * Bulk-subscribe all Meta pages to the leadgen webhook.
 *
 * For every page that has an encrypted_access_token, calls:
 *   POST /{page_id}/subscribed_apps?subscribed_fields=leadgen
 * using the page's own access token (required by Meta — system user
 * token is NOT accepted for subscribe calls).
 *
 * Run from backend/ directory:
 *   node scripts/bulkSubscribePages.js
 *
 * Safe to re-run — subscribing an already-subscribed page is a no-op.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import { decrypt } from '../utils/encryption.js';
import { subscribePageToLeadgen } from '../services/metaAdsService.js';

if (!process.env.MONGODB_URI)              { console.error('MONGODB_URI not set');              process.exit(1); }
if (!process.env.META_SYSTEM_USER_TOKEN)   { console.error('META_SYSTEM_USER_TOKEN not set');   process.exit(1); }
if (!process.env.ENCRYPTION_KEY)           { console.error('ENCRYPTION_KEY not set');            process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB.\n');

const clients = await Client.find({ 'meta_pages.0': { $exists: true } })
  .select('clientName meta_pages');

console.log(`Found ${clients.length} clients.\n`);

let ok = 0;
let skip = 0;
let fail = 0;

for (const client of clients) {
  let changed = false;
  for (const page of client.meta_pages) {
    if (!page.encrypted_access_token) {
      console.log(`  SKIP ${client.clientName} — page ${page.page_id} (no token)`);
      skip++;
      continue;
    }
    try {
      const pageToken = decrypt(page.encrypted_access_token);
      await subscribePageToLeadgen(page.page_id, pageToken);
      page.subscribed = true;
      changed = true;
      console.log(`  OK   ${client.clientName} — page ${page.page_id} (${page.page_name})`);
      ok++;
    } catch (err) {
      console.error(`  FAIL ${client.clientName} — page ${page.page_id}: ${err.message}`);
      fail++;
    }
  }
  if (changed) {
    client.markModified('meta_pages');
    await client.save();
  }
}

console.log(`\nDone. Subscribed: ${ok}, Skipped (no token): ${skip}, Failed: ${fail}`);
await mongoose.disconnect();
