// Phase-2 smoke test: exercise every metaAdsService method against the live
// Graph API, using the real System User token + a real Page token.
//
// Usage:
//   node backend/scripts/metaSmokeTest.js
//
// Picks the first ad account & Page the System User can see so the script is
// self-configuring. Safe to run repeatedly — read-only except for subscribe
// endpoints, which this script does NOT call.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  verifySystemUser,
  verifyAdAccountAccess,
  listPagesForSystemUser,
  fetchCampaigns,
  fetchAdSets,
  fetchAds,
  fetchInsights,
  fetchLeadForms,
  fetchLeadsForForm,
  fetchSingleLead,
} = await import('../services/metaAdsService.js');

const h = (t) => console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const info = (t) => console.log(`    ${t}`);
const fail = (t, err) => {
  console.log(`  ✗ ${t}`);
  if (err) {
    console.log(`    [${err.name}] ${err.message}`);
    if (err.code) info(`code=${err.code} httpStatus=${err.httpStatus} retryable=${err.retryable}`);
  }
};

const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400_000);

let failures = 0;

try {
  // ---------------- 1. verifySystemUser ----------------
  h('1. verifySystemUser()');
  const me = await verifySystemUser();
  ok(`me.id=${me.me.id} name=${me.me.name}`);

  // ---------------- 2. listPagesForSystemUser ----------------
  h('2. listPagesForSystemUser()');
  const { pages } = await listPagesForSystemUser();
  ok(`Pages: ${pages.length}`);
  const samplePage = pages[0];
  info(`Sample: ${samplePage.name} (${samplePage.id})`);

  // ---------------- 3. verifyAdAccountAccess ----------------
  h('3. verifyAdAccountAccess(act_800798932805550)');
  const { account } = await verifyAdAccountAccess('act_800798932805550');
  ok(`account.name=${account.name} currency=${account.currency} tz=${account.timezone_name}`);

  // ---------------- 4. fetchCampaigns ----------------
  h('4. fetchCampaigns(act_800798932805550)');
  const { data: campaigns } = await fetchCampaigns('act_800798932805550');
  ok(`Campaigns: ${campaigns.length}`);
  campaigns.slice(0, 3).forEach((c) =>
    info(`   • ${c.name} [${c.id}] ${c.status} obj=${c.objective}`)
  );

  // ---------------- 5. fetchAdSets ----------------
  h('5. fetchAdSets(act_800798932805550)');
  const { data: adsets } = await fetchAdSets('act_800798932805550');
  ok(`AdSets: ${adsets.length}`);

  // ---------------- 6. fetchAds ----------------
  h('6. fetchAds(act_800798932805550)');
  const { data: ads } = await fetchAds('act_800798932805550');
  ok(`Ads: ${ads.length}`);

  // ---------------- 7. fetchInsights ----------------
  h('7. fetchInsights(level=campaign, last 7 days)');
  const since = ymd(daysAgo(7));
  const until = ymd(daysAgo(0));
  const { data: insights } = await fetchInsights('act_800798932805550', {
    level: 'campaign',
    since,
    until,
  });
  ok(`Insights rows: ${insights.length}`);
  const totalSpend = insights.reduce((s, r) => s + Number(r.spend || 0), 0).toFixed(2);
  const totalImpr = insights.reduce((s, r) => s + Number(r.impressions || 0), 0);
  info(`Range: ${since} → ${until}   spend=₹${totalSpend}   impressions=${totalImpr}`);

  // ---------------- 8. fetchLeadForms ----------------
  h('8. fetchLeadForms(samplePage, pageToken)');
  const { data: forms } = await fetchLeadForms(samplePage.id, samplePage.access_token);
  ok(`Lead forms on ${samplePage.name}: ${forms.length}`);
  forms.slice(0, 3).forEach((f) =>
    info(`   • ${f.name} [${f.id}] ${f.status}`)
  );

  // ---------------- 9. fetchLeadsForForm ----------------
  if (forms.length) {
    const f = forms[0];
    h(`9. fetchLeadsForForm(${f.id})`);
    const { data: leads } = await fetchLeadsForForm(f.id, samplePage.access_token, 0);
    ok(`Leads for form "${f.name}": ${leads.length}`);
    if (leads.length) {
      const l = leads[0];
      info(`First lead id=${l.id} created=${l.created_time} ad_id=${l.ad_id || 'n/a'}`);

      // ---------------- 10. fetchSingleLead ----------------
      h(`10. fetchSingleLead(${l.id})`);
      const { lead } = await fetchSingleLead(l.id, samplePage.access_token);
      ok(`Lead fetched id=${lead.id}  fields=${(lead.field_data || []).length}`);
    } else {
      info('No leads on this form — fetchSingleLead skipped');
    }
  }

  h(failures === 0 ? '✅ All metaAdsService methods work end-to-end' : `❌ ${failures} failure(s)`);
} catch (err) {
  failures++;
  fail('UNHANDLED', err);
  console.error(err);
  process.exit(1);
}

process.exit(failures === 0 ? 0 : 1);
