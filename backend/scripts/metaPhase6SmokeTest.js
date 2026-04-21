// Phase 6 smoke test: drive every new Phase-6 controller through the
// Express app in-process, against live Meta + real Mongo.
//
// We boot Express (same app.js wiring as server.js) on a dynamic port,
// create a synthetic Client, then hit each endpoint with fetch() and assert
// the response shape. Cleans up after itself unless --keep is passed.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";

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
const { default: Lead } = await import("../models/Lead.js");
const { default: MetaLeadForm } = await import("../models/MetaLeadForm.js");
const { default: MetaInsights } = await import("../models/MetaInsights.js");
const { default: BillingTransaction } = await import("../models/BillingTransaction.js");
const { default: DailyDebitSnapshot } = await import("../models/DailyDebitSnapshot.js");
const { default: metaRoutes } = await import("../routes/meta.js");

// Boot a minimal Express just for /api/meta — keeps the test hermetic,
// no startup cron, no other side-effects.
const app = express();
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      if (buf?.length && req.originalUrl?.startsWith("/api/meta/webhook")) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(cookieParser());
app.use("/api/meta", metaRoutes);

const server = app.listen(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/api/meta`;

const h = (t) => console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const info = (t) => console.log(`    ${t}`);

let failures = 0;
let testClient = null;
let clonedInsightIds = [];

const api = async (method, pathStr, body) => {
  const res = await fetch(`${base}${pathStr}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: res.status, body: parsed };
};

try {
  // ------------------------------------------------------------------
  h("1. Create synthetic client (no Meta config yet)");
  // ------------------------------------------------------------------
  testClient = await Client.create({
    clientName: `TEST-META-PHASE6-${Date.now()}`,
    place: "—",
    status: "active",
    billing: {
      billing_type: "monthly",
      total_added_funds: 50_000,
      total_spend: 0,
      available_balance: 50_000,
      low_balance_threshold: 100,
    },
  });
  const cid = testClient._id.toString();
  ok(`Client: ${cid}`);

  // ------------------------------------------------------------------
  h("2. GET /config returns blank Meta config");
  // ------------------------------------------------------------------
  const cfg0 = await api("GET", `/client/${cid}/config`);
  if (cfg0.status === 200 && cfg0.body.meta_enabled === false) {
    ok(`enabled=false, ad_account_id="${cfg0.body.meta_ad_account_id}"`);
  } else {
    failures++;
    console.log(`  ✗ got status=${cfg0.status} body=${JSON.stringify(cfg0.body)}`);
  }

  // ------------------------------------------------------------------
  h("3. GET /available-pages returns live Pages");
  // ------------------------------------------------------------------
  const pagesResp = await api("GET", `/client/${cid}/available-pages`);
  if (pagesResp.status === 200 && Array.isArray(pagesResp.body.pages) && pagesResp.body.pages.length > 0) {
    ok(`available-pages: ${pagesResp.body.pages.length} Pages`);
    const allUnassigned = pagesResp.body.pages.every((p) => p.already_assigned === false);
    if (allUnassigned) ok("all show already_assigned=false (fresh client)");
    else { failures++; console.log("  ✗ some page marked already_assigned on a fresh client"); }
  } else {
    failures++;
    console.log(`  ✗ got status=${pagesResp.status} body=${JSON.stringify(pagesResp.body).slice(0, 200)}`);
  }

  // ------------------------------------------------------------------
  h("4. PUT /config — set ad_account + enable, validates Meta side");
  // ------------------------------------------------------------------
  const putResp = await api("PUT", `/client/${cid}/config`, {
    meta_enabled: true,
    meta_ad_account_id: "act_800798932805550",
  });
  if (putResp.status === 200 && putResp.body.success) {
    ok(`ad_account_name="${putResp.body.config.meta_ad_account_name}"`);
    ok(`currency=${putResp.body.config.meta_ad_account_currency}  tz=${putResp.body.config.meta_ad_account_timezone}`);
  } else {
    failures++;
    console.log(`  ✗ PUT failed: status=${putResp.status} body=${JSON.stringify(putResp.body)}`);
  }

  // ------------------------------------------------------------------
  h("5. PUT /config — reject bad ad_account_id");
  // ------------------------------------------------------------------
  const bad = await api("PUT", `/client/${cid}/config`, {
    meta_ad_account_id: "12345-not-valid",
  });
  if (bad.status === 400) ok("invalid format returned 400");
  else { failures++; console.log(`  ✗ expected 400, got ${bad.status}`); }

  // ------------------------------------------------------------------
  h("6. POST /test-connection");
  // ------------------------------------------------------------------
  const testConn = await api("POST", `/client/${cid}/test-connection`);
  if (testConn.status === 200 && testConn.body.ok) {
    ok(`test-connection: ${testConn.body.account.name}`);
  } else { failures++; console.log(`  ✗ test-connection failed: ${JSON.stringify(testConn.body)}`); }

  // ------------------------------------------------------------------
  h("7. PUT /config — attach one Page from available-pages");
  // ------------------------------------------------------------------
  const samplePage = pagesResp.body.pages.find(
    (p) => p.page_id === "1067412303117759"
  ) || pagesResp.body.pages[0];
  // We don't have the plaintext Page token here (available-pages intentionally
  // omits it); the subscribe endpoint handles fetch+encrypt. We simulate an
  // operator who used subscribe, which *also* attaches the Page. Do the
  // equivalent by calling subscribe directly:
  const subResp = await api(
    "POST",
    `/client/${cid}/pages/${samplePage.page_id}/subscribe`
  );
  if (subResp.status === 200 && subResp.body.ok && subResp.body.subscribed === true) {
    ok(`Page ${samplePage.page_id} subscribed to leadgen`);
  } else {
    failures++;
    console.log(`  ✗ subscribe failed: ${JSON.stringify(subResp.body).slice(0, 400)}`);
  }

  // ------------------------------------------------------------------
  h("8. GET /config — Page appears with has_token=true, subscribed=true");
  // ------------------------------------------------------------------
  const cfgAfter = await api("GET", `/client/${cid}/config`);
  const attached = (cfgAfter.body.meta_pages || []).find(
    (p) => p.page_id === samplePage.page_id
  );
  if (attached && attached.has_token && attached.subscribed) {
    ok(`has_token=true subscribed=true`);
  } else {
    failures++;
    console.log(
      `  ✗ page not attached correctly: ${JSON.stringify(attached)}`
    );
  }

  // ------------------------------------------------------------------
  h("9. Seed real MetaInsights + forms + leads so analytics has data");
  // ------------------------------------------------------------------
  const real = await MetaInsights.find({
    ad_account_id: "act_800798932805550",
    level: "campaign",
    spend: { $gt: 0 },
  })
    .sort({ date: -1 })
    .limit(10)
    .lean();

  const clones = await MetaInsights.insertMany(
    real.map((r) => ({
      ...r,
      _id: undefined,
      client_id: testClient._id,
      campaign_id: `${r.campaign_id}-ph6`,
      entity_id: `${r.entity_id}-ph6`,
      ad_account_id: "act_800798932805550",
    }))
  );
  clonedInsightIds = clones.map((c) => c._id);
  const totalSpend = clones.reduce((s, r) => s + Number(r.spend), 0).toFixed(2);
  const totalLeads = clones.reduce((s, r) => s + (r.leads || 0), 0);
  ok(`Cloned ${clones.length} insights rows (spend=₹${totalSpend}, leads=${totalLeads})`);

  // Seed a MetaLeadForm row for the client
  await MetaLeadForm.findOneAndUpdate(
    { form_id: "972207495782606" },
    {
      $set: {
        form_id: "972207495782606",
        page_id: samplePage.page_id,
        client_id: testClient._id,
        name: "ARA -Sahakara",
        status: "ACTIVE",
      },
    },
    { upsert: true, new: true }
  );

  // Seed 2 real leads
  const testLeads = await Lead.insertMany([
    {
      name: "Test Lead One",
      email: `test1-${Date.now()}@example.com`,
      source: "meta",
      status: "new",
      client: testClient._id,
      meta_leadgen_id: `smoke6-${Date.now()}-1`,
      meta_form_id: "972207495782606",
      meta_form_name: "ARA -Sahakara",
      meta_campaign_id: clones[0]?.campaign_id,
      platform: "facebook",
    },
    {
      name: "Test Lead Two",
      email: `test2-${Date.now()}@example.com`,
      source: "meta",
      status: "new",
      client: testClient._id,
      meta_leadgen_id: `smoke6-${Date.now()}-2`,
      meta_form_id: "972207495782606",
      meta_form_name: "ARA -Sahakara",
      platform: "facebook",
    },
  ]);
  ok(`Seeded 2 Leads + 1 MetaLeadForm`);

  // ------------------------------------------------------------------
  h("10. GET /client/:id/analytics — summary + campaigns + daily_trend");
  // ------------------------------------------------------------------
  const analytics = await api("GET", `/client/${cid}/analytics?from=2026-01-01&to=2026-12-31`);
  if (analytics.status !== 200) {
    failures++;
    console.log(`  ✗ analytics failed: ${JSON.stringify(analytics.body).slice(0, 400)}`);
  } else {
    const b = analytics.body;
    ok(`summary.spend=₹${b.summary.spend}  leads=${b.summary.leads}  cpl=₹${b.summary.cpl}`);
    info(`   impressions=${b.summary.impressions} clicks=${b.summary.clicks} ctr=${b.summary.ctr}%`);

    if (b.campaigns.length > 0) ok(`campaigns: ${b.campaigns.length} rows`);
    else { failures++; console.log("  ✗ no campaigns returned"); }

    if (b.daily_trend.length > 0) ok(`daily_trend: ${b.daily_trend.length} days`);
    else { failures++; console.log("  ✗ no daily_trend returned"); }

    if (b.lead_forms.length > 0) ok(`lead_forms: ${b.lead_forms.length} (leads_in_range=${b.lead_forms[0].leads_in_range})`);
    else { failures++; console.log("  ✗ no lead_forms"); }

    if (b.recent_leads.length === 2) ok(`recent_leads: 2`);
    else { failures++; console.log(`  ✗ expected 2 recent_leads, got ${b.recent_leads.length}`); }

    // Cross-check summary.spend matches our seeded total
    if (Math.abs(b.summary.spend - Number(totalSpend)) < 0.05) {
      ok(`summary.spend matches seeded total`);
    } else {
      failures++;
      console.log(`  ✗ spend mismatch: analytics=₹${b.summary.spend} seeded=₹${totalSpend}`);
    }
  }

  // ------------------------------------------------------------------
  h("11. DELETE page subscribe → subscribed=false");
  // ------------------------------------------------------------------
  const unsub = await api(
    "DELETE",
    `/client/${cid}/pages/${samplePage.page_id}/subscribe`
  );
  if (unsub.status === 200 && unsub.body.ok && unsub.body.subscribed === false) {
    ok(`unsubscribed successfully`);
  } else {
    failures++;
    console.log(`  ✗ unsubscribe: ${JSON.stringify(unsub.body)}`);
  }

  // ------------------------------------------------------------------
  h("12. GET on unknown client → 404");
  // ------------------------------------------------------------------
  const missing = await api("GET", `/client/69e7189d1f64a29d76ae5999/config`);
  if (missing.status === 404) ok("404 for unknown client");
  else { failures++; console.log(`  ✗ expected 404, got ${missing.status}`); }

  h(failures === 0 ? "✅ Phase 6 smoke test passed" : `❌ ${failures} failure(s)`);
} catch (err) {
  failures++;
  console.error("\nCRASH:", err);
} finally {
  // Re-subscribe the Page so production Meta state matches what we had before
  // the test: the test client was the one that unsubscribed, but the Page
  // token is shared and `subscribed_apps` is per App, so unsubscribe did
  // affect the real subscription. Re-subscribe now.
  if (testClient) {
    try {
      const client = await Client.findById(testClient._id);
      const attached = (client?.meta_pages || []).find(Boolean);
      if (attached?.encrypted_access_token) {
        const { decrypt } = await import("../utils/encryption.js");
        const { subscribePageToLeadgen } = await import("../services/metaAdsService.js");
        await subscribePageToLeadgen(attached.page_id, decrypt(attached.encrypted_access_token));
        console.log("\nPage re-subscribed to preserve production state.");
      }
    } catch (e) {
      console.error("Page re-subscribe failed:", e?.message);
    }
  }

  if (!KEEP && testClient) {
    console.log("Cleanup...");
    await BillingTransaction.deleteMany({ client_id: testClient._id });
    await DailyDebitSnapshot.deleteMany({ client_id: testClient._id });
    await MetaInsights.deleteMany({ _id: { $in: clonedInsightIds } });
    await Lead.deleteMany({ client: testClient._id });
    await MetaLeadForm.updateOne(
      { form_id: "972207495782606" },
      { $set: { client_id: null } }
    );
    await Client.deleteOne({ _id: testClient._id });
    console.log("Synthetic test data removed.");
  } else if (KEEP) {
    console.log("\n--keep passed; synthetic data preserved.");
  }

  server.close();
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}
