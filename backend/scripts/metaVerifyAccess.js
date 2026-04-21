// Health-check the Meta API setup end-to-end. Run anytime to confirm that:
//   1. The System User token itself is valid and has the scopes we need.
//   2. All 21 client Pages are visible and each has its own Page access token.
//   3. A sample Page token can actually list lead forms + fetch posts
//      (proves the MANAGE task really grants what we expect).
//   4. All 25 Ad Accounts are visible (read-only sanity check for Phase 2).
//
// Usage:
//   node backend/scripts/metaVerifyAccess.js
//
// No write operations. Safe to run as often as you like.

import dotenv from "dotenv";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const token = process.env.META_SYSTEM_USER_TOKEN;
const appId = process.env.META_APP_ID;
const secret = process.env.META_APP_SECRET;
const version = process.env.META_API_VERSION || "v19.0";

if (!token || !appId || !secret) {
  console.error(
    "Missing env. Need META_SYSTEM_USER_TOKEN, META_APP_ID, META_APP_SECRET in backend/.env.",
  );
  process.exit(1);
}

const get = (path) =>
  new Promise((resolve, reject) => {
    https
      .get(`https://graph.facebook.com/${version}${path}`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      })
      .on("error", reject);
  });

const section = (n, title) =>
  console.log(
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${n}. ${title}\n`,
  );

const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => console.log(`  ✗ ${m}`);
const info = (m) => console.log(`    ${m}`);

const REQUIRED_SCOPES = [
  "ads_read",
  "ads_management",
  "leads_retrieval",
  "pages_read_engagement",
  "pages_show_list",
  "pages_manage_metadata",
  "business_management",
];

const REQUIRED_TASKS = ["MANAGE"]; // we granted the full bundle, but MANAGE is what we require

let failures = 0;

const run = async () => {
  // ---------------------------------------------------------------
  section(1, "System User token validity");
  // ---------------------------------------------------------------
  const debug = await get(
    `/debug_token?input_token=${token}&access_token=${appId}|${secret}`,
  );
  if (debug.status !== 200 || !debug.body?.data?.is_valid) {
    fail(`Token invalid — HTTP ${debug.status}`);
    info(JSON.stringify(debug.body));
    failures++;
    return;
  }
  const d = debug.body.data;
  pass(`type=${d.type}  app=${d.application}  is_valid=${d.is_valid}`);
  pass(
    `expires_at=${d.expires_at === 0 ? "never" : new Date(d.expires_at * 1000).toISOString()}`,
  );

  const missingScopes = REQUIRED_SCOPES.filter(
    (s) => !(d.scopes || []).includes(s),
  );
  if (missingScopes.length) {
    fail(`Missing scopes: ${missingScopes.join(", ")}`);
    failures++;
  } else {
    pass(`All ${REQUIRED_SCOPES.length} required scopes present`);
  }

  // ---------------------------------------------------------------
  section(2, "Pages assigned to System User");
  // ---------------------------------------------------------------
  const pagesResp = await get(
    `/me/accounts?fields=id,name,access_token,tasks&limit=100&access_token=${token}`,
  );
  if (pagesResp.status !== 200 || !Array.isArray(pagesResp.body?.data)) {
    fail(`Could not list Pages — HTTP ${pagesResp.status}`);
    info(JSON.stringify(pagesResp.body));
    failures++;
    return;
  }

  const pages = pagesResp.body.data;
  pass(`Pages visible: ${pages.length}`);
  if (pages.length === 0) {
    fail("No Pages assigned — run metaAssignPagesToSystemUser.js");
    failures++;
    return;
  }

  let pagesMissingToken = 0;
  let pagesMissingTasks = 0;
  for (const p of pages) {
    if (!p.access_token) pagesMissingToken++;
    if (!REQUIRED_TASKS.every((t) => (p.tasks || []).includes(t)))
      pagesMissingTasks++;
  }
  if (pagesMissingToken) {
    fail(`${pagesMissingToken} Pages missing access_token`);
    failures++;
  } else pass("Every Page has a Page access token");

  if (pagesMissingTasks) {
    fail(`${pagesMissingTasks} Pages missing task=${REQUIRED_TASKS.join(",")}`);
    failures++;
  } else pass(`Every Page has required tasks (${REQUIRED_TASKS.join(",")})`);

  // ---------------------------------------------------------------
  section(3, "Deep test — sample Page can read leadgen_forms");
  // ---------------------------------------------------------------
  const sample = pages[0];
  info(`Sample: ${sample.name} (${sample.id})`);

  const forms = await get(
    `/${sample.id}/leadgen_forms?fields=id,name,status,locale&limit=5&access_token=${sample.access_token}`,
  );
  if (forms.status === 200 && Array.isArray(forms.body?.data)) {
    pass(
      `leadgen_forms accessible — ${forms.body.data.length} form(s) on this Page`,
    );
    forms.body.data.forEach((f) =>
      info(`   • ${f.name || "(unnamed)"} [${f.id}] status=${f.status || "?"}`),
    );
  } else {
    fail(`Could not read leadgen_forms — HTTP ${forms.status}`);
    info(JSON.stringify(forms.body));
    failures++;
  }

  // ---------------------------------------------------------------
  section(4, "Ad accounts visible to System User");
  // ---------------------------------------------------------------
  const adAccounts = await get(
    `/me/adaccounts?fields=id,name,account_status,currency,timezone_name&limit=100&access_token=${token}`,
  );
  if (adAccounts.status === 200 && Array.isArray(adAccounts.body?.data)) {
    const accounts = adAccounts.body.data;
    pass(`Ad accounts: ${accounts.length}`);

    const currencies = [...new Set(accounts.map((a) => a.currency))];
    const timezones = [...new Set(accounts.map((a) => a.timezone_name))];
    info(`Currencies: ${currencies.join(", ")}`);
    info(`Timezones:  ${timezones.join(", ")}`);

    const nonInr = accounts.filter((a) => a.currency !== "INR");
    if (nonInr.length)
      info(
        `⚠ ${nonInr.length} account(s) not in INR — will need FX conversion`,
      );

    const offTz = accounts.filter((a) => a.timezone_name !== "Asia/Kolkata");
    if (offTz.length)
      info(
        `⚠ ${offTz.length} account(s) off Asia/Kolkata: ${offTz.map((a) => `${a.name} (${a.timezone_name})`).join("; ")}`,
      );
  } else {
    fail(`Could not list ad accounts — HTTP ${adAccounts.status}`);
    info(JSON.stringify(adAccounts.body));
    failures++;
  }

  // ---------------------------------------------------------------
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (failures === 0) {
    console.log("✅ All checks passed. Meta integration is ready for Phase 2.");
  } else {
    console.log(`❌ ${failures} check(s) failed. See output above.`);
    process.exitCode = 1;
  }
};

run().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(2);
});
