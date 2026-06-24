/**
 * Bulk-fetch Meta page access tokens for all clients.
 *
 * For every page in every client's meta_pages array, calls:
 *   GET /v19.0/{page_id}?fields=access_token
 * using the System User token, then encrypts and saves the result.
 *
 * Run from backend/ directory:
 *   node scripts/bulkFetchPageTokens.js
 *
 * Safe to re-run — overwrites any existing token with a fresh one.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import { encrypt } from '../utils/encryption.js';

const API_VERSION = process.env.META_API_VERSION || 'v19.0';
const API_BASE = (process.env.META_API_BASE_URL || 'https://graph.facebook.com').replace(/\/$/, '');

if (!process.env.MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }
if (!process.env.META_SYSTEM_USER_TOKEN) { console.error('META_SYSTEM_USER_TOKEN not set'); process.exit(1); }
if (!process.env.ENCRYPTION_KEY) { console.error('ENCRYPTION_KEY not set'); process.exit(1); }

const token = process.env.META_SYSTEM_USER_TOKEN;

async function fetchPageToken(pageId) {
  const url = `${API_BASE}/${API_VERSION}/${pageId}?fields=access_token&access_token=${token}`;
  const res = await fetch(url);
  const body = await res.json();
  if (body.error) throw new Error(`Meta API error for page ${pageId}: ${body.error.message}`);
  if (!body.access_token) throw new Error(`No access_token returned for page ${pageId}`);
  return body.access_token;
}

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB.\n');

const clients = await Client.find({ 'meta_pages.0': { $exists: true } }).select('clientName meta_pages');
console.log(`Found ${clients.length} clients with pages.\n`);

let ok = 0;
let fail = 0;

for (const client of clients) {
  let changed = false;
  for (const page of client.meta_pages) {
    try {
      const pageToken = await fetchPageToken(page.page_id);
      page.encrypted_access_token = encrypt(pageToken);
      page.token_issued_at = new Date();
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

console.log(`\nDone. Success: ${ok}, Failed: ${fail}`);
await mongoose.disconnect();
