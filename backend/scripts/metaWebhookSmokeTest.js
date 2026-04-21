// Phase-4 smoke test: prove the webhook + ingest pipeline works end-to-end
// against live Meta data, without needing a running Express server.
//
// Steps:
//   1. Pull a real leadgen_id + Page token from Meta (same approach as Phase
//      2/3 tests).
//   2. Seed MetaLeadForm with client_id=null so the ingest path can find the
//      form row but NOT route to a client — confirms the "unmapped" branch.
//   3. Seed a synthetic Client, wire its meta_pages with the real Page token
//      (encrypted via the project's standard util), and bind the form to it.
//   4. Call ingestLead({source:'webhook', ...}) directly — this is what the
//      webhook handler does once signature verification passes.
//   5. Verify Lead row + MetaLeadRaw row in Mongo.
//   6. Verify signature verify util round-trips a real HMAC.
//
// Written to clean up after itself — the synthetic Client + Lead are removed
// at the end unless --keep is passed. Safe to re-run.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const KEEP = process.argv.includes('--keep');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

console.log('Connecting to MongoDB...');
await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected.\n');

const { default: Client } = await import('../models/Client.js');
const { default: Lead } = await import('../models/Lead.js');
const { default: MetaLeadForm } = await import('../models/MetaLeadForm.js');
const { default: MetaLeadRaw } = await import('../models/MetaLeadRaw.js');
const { encrypt } = await import('../utils/encryption.js');
const { ingestLead, resolveFormOwner } = await import('../services/metaLeadService.js');
const { verifyWebhookSignature } = await import('../utils/metaSignature.js');
const { listPagesForSystemUser, fetchLeadForms, fetchLeadsForForm } =
  await import('../services/metaAdsService.js');

const h = (t) => console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const info = (t) => console.log(`    ${t}`);

let failures = 0;
let testClient = null;
let testLead = null;

try {
  // ------------------------------------------------------------------
  h('1. Pull live Page + form + a real leadgen_id');
  // ------------------------------------------------------------------
  const { pages } = await listPagesForSystemUser();
  const samplePage = pages.find((p) => p.id === '1067412303117759') || pages[0];
  ok(`Page: ${samplePage.name} (${samplePage.id})`);

  const { data: forms } = await fetchLeadForms(samplePage.id, samplePage.access_token);
  if (!forms.length) throw new Error('Sample Page has no forms — pick a different Page');
  const sampleForm = forms[0];
  ok(`Form: ${sampleForm.name} (${sampleForm.id})`);

  const { data: leads } = await fetchLeadsForForm(sampleForm.id, samplePage.access_token, 0);
  if (!leads.length) throw new Error('Sample form has no leads — nothing to ingest');
  const sampleLead = leads[0];
  ok(`Sample leadgen_id: ${sampleLead.id} (created ${sampleLead.created_time})`);

  // ------------------------------------------------------------------
  h('2. Signature verification util round-trip');
  // ------------------------------------------------------------------
  const body = Buffer.from(JSON.stringify({ hello: 'world', ts: Date.now() }));
  const secret = process.env.META_APP_SECRET;
  const sig =
    'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (!verifyWebhookSignature(body, sig, secret)) {
    failures++;
    console.log('  ✗ verifyWebhookSignature rejected a valid HMAC');
  } else ok('Valid HMAC accepted');
  if (verifyWebhookSignature(body, sig, 'wrong-secret')) {
    failures++;
    console.log('  ✗ verifyWebhookSignature accepted wrong secret');
  } else ok('Wrong secret rejected');
  if (verifyWebhookSignature(Buffer.from('tampered'), sig, secret)) {
    failures++;
    console.log('  ✗ verifyWebhookSignature accepted tampered body');
  } else ok('Tampered body rejected');

  // ------------------------------------------------------------------
  h('3. Unmapped form → status=unmapped');
  // ------------------------------------------------------------------
  // Seed form with no client_id so ingestLead can find it but not route it.
  await MetaLeadForm.findOneAndUpdate(
    { form_id: sampleForm.id },
    {
      $set: {
        form_id: sampleForm.id,
        page_id: samplePage.id,
        name: sampleForm.name,
        status: sampleForm.status,
        locale: sampleForm.locale || '',
      },
      $setOnInsert: { client_id: null },
    },
    { upsert: true, new: true }
  );
  // Clear any prior raw so the ingest path runs fresh.
  await MetaLeadRaw.deleteOne({ leadgen_id: sampleLead.id });

  const unmappedResult = await ingestLead({
    leadgenId: sampleLead.id,
    pageId: samplePage.id,
    formId: sampleForm.id,
    source: 'webhook',
    rawPayload: { test: 'phase-4-unmapped' },
  });
  if (unmappedResult.status === 'unmapped') ok(`ingestLead returned status=unmapped as expected`);
  else {
    failures++;
    console.log(`  ✗ expected 'unmapped', got '${unmappedResult.status}'`);
  }

  // ------------------------------------------------------------------
  h('4. Assign form to a synthetic client + ingest → status=processed');
  // ------------------------------------------------------------------
  testClient = await Client.create({
    clientName: `TEST-META-PHASE4-${Date.now()}`,
    place: '—',
    status: 'active',
    meta_enabled: true,
    meta_ad_account_id: '',
    meta_pages: [
      {
        page_id: samplePage.id,
        page_name: samplePage.name,
        encrypted_access_token: encrypt(samplePage.access_token),
        subscribed: false,
      },
    ],
  });
  ok(`Synthetic client: ${testClient._id}`);

  await MetaLeadForm.updateOne(
    { form_id: sampleForm.id },
    { $set: { client_id: testClient._id } }
  );
  const { client } = await resolveFormOwner(sampleForm.id);
  if (client?._id?.equals(testClient._id)) ok('Form resolves to synthetic client');
  else {
    failures++;
    console.log('  ✗ resolveFormOwner returned wrong client');
  }

  // Clear prior raw so the duplicate-short-circuit doesn't fire.
  await MetaLeadRaw.deleteOne({ leadgen_id: sampleLead.id });

  const processedResult = await ingestLead({
    leadgenId: sampleLead.id,
    pageId: samplePage.id,
    formId: sampleForm.id,
    source: 'webhook',
    rawPayload: { test: 'phase-4-processed', entry_time: Date.now() },
  });

  if (processedResult.status === 'processed') {
    ok(`ingestLead returned status=processed`);
    testLead = processedResult.lead;
    info(`Lead._id=${testLead._id}  email=${testLead.email}  name=${testLead.name}`);
    info(`  meta_form_id=${testLead.meta_form_id}  meta_ad_id=${testLead.meta_ad_id}`);
    info(`  platform=${testLead.platform}  source=${testLead.source}`);
  } else {
    failures++;
    console.log(`  ✗ expected 'processed', got '${processedResult.status}'`);
    if (processedResult.raw?.error) info(`raw.error=${processedResult.raw.error}`);
  }

  // ------------------------------------------------------------------
  h('5. Idempotency — re-ingest same leadgen_id → status=duplicate');
  // ------------------------------------------------------------------
  const dupe = await ingestLead({
    leadgenId: sampleLead.id,
    pageId: samplePage.id,
    formId: sampleForm.id,
    source: 'webhook',
    rawPayload: { test: 'phase-4-dupe' },
  });
  if (dupe.status === 'duplicate') ok('Second ingest returned status=duplicate');
  else {
    failures++;
    console.log(`  ✗ expected 'duplicate', got '${dupe.status}'`);
  }

  const leadCount = await Lead.countDocuments({ meta_leadgen_id: sampleLead.id });
  if (leadCount === 1) ok(`Lead count for leadgen_id = 1 (no duplicate rows)`);
  else {
    failures++;
    console.log(`  ✗ expected 1 Lead row, found ${leadCount}`);
  }

  // ------------------------------------------------------------------
  h('6. MetaLeadRaw audit row check');
  // ------------------------------------------------------------------
  const raw = await MetaLeadRaw.findOne({ leadgen_id: sampleLead.id });
  if (raw?.processed && raw.lead_id?.equals(testLead._id)) {
    ok(`MetaLeadRaw processed=true, lead_id linked`);
    info(`source=${raw.source}  received_at=${raw.received_at?.toISOString()}`);
  } else {
    failures++;
    console.log(`  ✗ MetaLeadRaw not properly linked`);
  }

  // ------------------------------------------------------------------
  h(failures === 0 ? '✅ Phase 4 smoke test passed' : `❌ ${failures} failure(s)`);
} catch (err) {
  failures++;
  console.error('\nCRASH:', err);
} finally {
  if (!KEEP && testClient) {
    console.log('\nCleanup...');
    await MetaLeadRaw.deleteMany({ source: 'webhook', page_id: { $in: testClient.meta_pages.map((p) => p.page_id) } });
    if (testLead) await Lead.deleteOne({ _id: testLead._id });
    await MetaLeadForm.updateOne(
      { client_id: testClient._id },
      { $set: { client_id: null } }
    );
    await Client.deleteOne({ _id: testClient._id });
    console.log('Synthetic client + leads removed.');
  } else if (KEEP) {
    console.log('\n--keep passed, synthetic data left in place for manual inspection.');
  }
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}
