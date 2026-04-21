// Generate a CSV that pairs every Meta ad account with the best-matching
// Client in the CRM, based on fuzzy name similarity.
//
// Workflow:
//   1. node backend/scripts/metaMappingReport.js
//      → writes backend/scripts/output/meta-mapping.csv
//   2. Open the CSV in Excel. For each row:
//        - Change `action` to "link", "skip", or "orphan"
//        - If auto-pick is wrong, paste the correct Mongo ObjectId into
//          `client_id_to_link` (copy from `all_clients` sheet below)
//   3. node backend/scripts/metaMappingApply.js
//      → reads the CSV and wires each Client → meta_ad_account_id.
//
// Safe — this script is read-only on both Meta and Mongo.

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

const OUT_DIR = path.resolve(__dirname, "output");
const CSV_PATH = path.join(OUT_DIR, "meta-mapping.csv");
const ALL_CLIENTS_PATH = path.join(OUT_DIR, "all-clients.csv");

console.log("Connecting to MongoDB...");
await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected.\n");

const { default: Client } = await import("../models/Client.js");
const { listPagesForSystemUser } = await import("../services/metaAdsService.js");

// -- Fuzzy name matching ----------------------------------------------------

// Words that appear so often they hurt matching. Don't weight them.
const NOISE = new Set([
  "ara",
  "ad",
  "advanced",
  "the",
  "and",
  "&",
  "clinic",
  "clinics",
  "-",
  "—",
  "skin",
  "hair",
  "grohair",
  "gloskin",
  "test",
  "new",
  "old",
  "naturals",
  "dr",
]);

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (s) =>
  normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !NOISE.has(t));

// Jaccard similarity on token sets, plus a bigram-based fallback for short
// names. Returns a score 0-100.
const similarity = (a, b) => {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersect = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = intersect / union;

  // Boost when every token of the shorter side appears in the longer side
  // (e.g. "Namakkal" ⊂ "Grohair Namakkal Clinic").
  const [short, long] =
    tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  const coverage = [...short].filter((t) => long.has(t)).length / short.size;

  return Math.round(Math.max(jaccard, coverage * 0.9) * 100);
};

// -- Load both sides --------------------------------------------------------

console.log("Loading Clients from Mongo...");
const clients = await Client.find({})
  .select("_id clientName place organisationType status meta_ad_account_id google_ads_customer_id")
  .lean();
console.log(`  ${clients.length} clients`);

console.log("Fetching Meta Ad accounts...");
// We don't have a single service method for ad accounts; use the same
// query we use in Phase-2 verify.
const { META_API_BASE_URL = "https://graph.facebook.com", META_API_VERSION = "v19.0" } =
  process.env;
const fetchAdAccounts = async () => {
  let url = `${META_API_BASE_URL}/${META_API_VERSION}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,business&limit=100&access_token=${process.env.META_SYSTEM_USER_TOKEN}`;
  const all = [];
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(`Graph: ${data.error.message}`);
    all.push(...(data.data || []));
    url = data.paging?.next || null;
  }
  return all;
};
const adAccounts = await fetchAdAccounts();
console.log(`  ${adAccounts.length} ad accounts`);

console.log("Fetching Pages (for reference column)...");
const { pages } = await listPagesForSystemUser();
console.log(`  ${pages.length} pages`);

// -- Build mapping proposals ------------------------------------------------

// Build existing-link lookup to show what's already wired.
const clientByAdAccount = new Map(
  clients
    .filter((c) => c.meta_ad_account_id)
    .map((c) => [c.meta_ad_account_id, c])
);

const proposals = adAccounts.map((acc) => {
  const already = clientByAdAccount.get(acc.id);

  // Rank every client by similarity to this ad account name.
  const ranked = clients
    .map((c) => ({
      client: c,
      score: similarity(acc.name, c.clientName),
    }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const alts = ranked
    .slice(1, 3)
    .filter((r) => r.score >= 30)
    .map((r) => `${r.client.clientName} [${r.client._id}] (${r.score})`)
    .join(" | ");

  // Also try Page-name similarity if Client name didn't do well.
  let bestPageMatch = null;
  if (top.score < 50) {
    const pageRanked = pages
      .map((p) => ({ page: p, score: similarity(acc.name, p.name) }))
      .sort((a, b) => b.score - a.score)[0];
    if (pageRanked && pageRanked.score >= 50) bestPageMatch = pageRanked;
  }

  return {
    ad_account_id: acc.id,
    ad_account_name: acc.name,
    currency: acc.currency,
    timezone: acc.timezone_name,
    account_status: acc.account_status,
    current_link_client_id: already?._id || "",
    current_link_client_name: already?.clientName || "",
    action:
      already?.meta_ad_account_id
        ? "already-linked"
        : top.score >= 60
          ? "link"
          : top.score >= 35
            ? "review"
            : "orphan",
    client_id_to_link: already?._id
      ? String(already._id)
      : top.score >= 60
        ? String(top.client._id)
        : "",
    proposed_client_name: top.client.clientName,
    match_score: top.score,
    alternative_matches: alts,
    best_page_match: bestPageMatch
      ? `${bestPageMatch.page.name} [${bestPageMatch.page.id}] (${bestPageMatch.score})`
      : "",
    notes: "",
  };
});

// -- Write CSVs -------------------------------------------------------------

const csvEscape = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, columns) =>
  [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))].join("\n");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const mappingColumns = [
  "action",
  "client_id_to_link",
  "ad_account_id",
  "ad_account_name",
  "proposed_client_name",
  "match_score",
  "alternative_matches",
  "best_page_match",
  "currency",
  "timezone",
  "account_status",
  "current_link_client_id",
  "current_link_client_name",
  "notes",
];
fs.writeFileSync(CSV_PATH, toCsv(proposals, mappingColumns));

const clientRows = clients.map((c) => ({
  client_id: String(c._id),
  client_name: c.clientName,
  place: c.place,
  status: c.status,
  google_ads_customer_id: c.google_ads_customer_id || "",
  meta_ad_account_id: c.meta_ad_account_id || "",
}));
fs.writeFileSync(
  ALL_CLIENTS_PATH,
  toCsv(clientRows, [
    "client_id",
    "client_name",
    "place",
    "status",
    "google_ads_customer_id",
    "meta_ad_account_id",
  ])
);

// -- Summary ---------------------------------------------------------------

const actionCounts = proposals.reduce((acc, p) => {
  acc[p.action] = (acc[p.action] || 0) + 1;
  return acc;
}, {});

console.log("\n━━━━━━ Summary ━━━━━━");
console.log(`Ad accounts: ${adAccounts.length}`);
console.log(`Clients:     ${clients.length}`);
console.log(`Pages:       ${pages.length}`);
console.log("\nProposed actions:");
for (const [action, count] of Object.entries(actionCounts)) {
  console.log(`  ${action.padEnd(15)} ${count}`);
}

console.log("\nOutputs:");
console.log(`  ${CSV_PATH}`);
console.log(`  ${ALL_CLIENTS_PATH}`);

console.log(`\nNext:
  1. Open ${path.basename(CSV_PATH)} in Excel.
  2. For each row, check:
       - action=link         : auto-pick is confident (score ≥ 60); leave alone or override
       - action=review       : needs your eyes (score 35-59); fix client_id_to_link or change to skip
       - action=orphan       : no CRM client matches (score < 35); leave as orphan if agency-internal
       - action=already-linked : skip, already set
  3. Save the CSV.
  4. Run: node backend/scripts/metaMappingApply.js
`);

await mongoose.disconnect();
