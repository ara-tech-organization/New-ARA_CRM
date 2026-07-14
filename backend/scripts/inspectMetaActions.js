/**
 * Dump the raw Meta `actions` map for one client/day, per campaign.
 *
 * `messaging_conversations_started` is currently mapped from a single action
 * type — onsite_conversion.messaging_conversation_started_7d — which Meta
 * reports across ALL messaging destinations (WhatsApp, Messenger, Instagram
 * Direct). This prints every action type Meta actually returned so we can see
 * whether a WhatsApp-specific one exists and what it's worth.
 *
 * Run from backend/:
 *   node scripts/inspectMetaActions.js <clientId> <YYYY-MM-DD>
 *
 * Example:
 *   node scripts/inspectMetaActions.js 6a3bb4f1943dc8af1d6c5801 2026-07-14
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import MetaInsights from '../models/MetaInsights.js';
import MetaCampaign from '../models/MetaCampaign.js';
import Client from '../models/Client.js';

const [clientId, day] = process.argv.slice(2);

if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(day || '')) {
  console.error('Usage: node scripts/inspectMetaActions.js <clientId> <YYYY-MM-DD>');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const [y, m, d] = day.split('-').map(Number);
const date = new Date(Date.UTC(y, m - 1, d));

const client = await Client.findById(clientId).select('clientName').lean();
console.log(`\nClient: ${client?.clientName || clientId}`);
console.log(`Date:   ${day}\n`);

const rows = await MetaInsights.find({
  client_id: new mongoose.Types.ObjectId(clientId),
  level: 'campaign',
  date,
}).lean();

if (rows.length === 0) {
  console.log('No campaign-level insight rows for that day.');
  await mongoose.disconnect();
  process.exit(0);
}

const campaignIds = rows.map((r) => r.campaign_id).filter(Boolean);
const campaigns = await MetaCampaign.find({ campaign_id: { $in: campaignIds } })
  .select('campaign_id name objective')
  .lean();
const campaignById = new Map(campaigns.map((c) => [c.campaign_id, c]));

// Union of every action type Meta returned, so we can see the full menu.
const seenTypes = new Set();
const totals = {};

for (const r of rows) {
  const c = campaignById.get(r.campaign_id) || {};
  console.log('─'.repeat(78));
  console.log(`CAMPAIGN : ${c.name || r.campaign_id}`);
  console.log(`OBJECTIVE: ${c.objective || '(unknown)'}`);
  console.log(`spend=${r.spend}  leads=${r.leads}  messaging_conversations_started=${r.messaging_conversations_started}`);
  console.log('  actions:');

  const actions = r.actions && typeof r.actions === 'object' ? r.actions : {};
  const keys = Object.keys(actions).sort();
  if (keys.length === 0) {
    console.log('    (none)');
  }
  for (const k of keys) {
    seenTypes.add(k);
    totals[k] = (totals[k] || 0) + (Number(actions[k]) || 0);
    console.log(`    ${k.padEnd(58)} ${actions[k]}`);
  }
  console.log('');
}

console.log('═'.repeat(78));
console.log('TOTALS FOR THE DAY — every action type Meta returned:\n');
for (const k of Array.from(seenTypes).sort()) {
  const star = k.includes('messaging') ? ' <-- messaging' : '';
  console.log(`  ${k.padEnd(58)} ${String(totals[k]).padStart(6)}${star}`);
}

console.log('\nCurrently reported as "META WHATSAPP":');
console.log('  onsite_conversion.messaging_conversation_started_7d =',
  totals['onsite_conversion.messaging_conversation_started_7d'] ?? 0);

await mongoose.disconnect();
