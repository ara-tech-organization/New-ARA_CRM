// Read the reviewed meta-mapping.csv and wire each Client row to its
// meta_ad_account_id. For every row with action="link" and a valid
// client_id_to_link, we:
//
//   1. Verify the ad account is reachable with the System User token
//      (fills in ad_account_name, currency, timezone_name).
//   2. Update Client.meta_* fields + flip meta_enabled=true.
//   3. Print a per-row result line.
//
// Rows with action="skip" or "orphan" or "already-linked" are ignored.
//
// Flags:
//   --dry-run : read + verify, print what WOULD change, make no writes.
//   --enable  : set meta_enabled=true on successful link (default).
//   --no-enable : leave meta_enabled as-is.

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");
const ENABLE = !process.argv.includes("--no-enable");
const CSV_PATH = path.resolve(__dirname, "output", "meta-mapping.csv");

if (!fs.existsSync(CSV_PATH)) {
  console.error(
    `No CSV at ${CSV_PATH}. Run metaMappingReport.js first.`
  );
  process.exit(1);
}

// -- Minimal CSV parser (handles quoted fields with embedded commas) --------
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuote = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuote = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuote = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
};

const csvRows = parseCsv(fs.readFileSync(CSV_PATH, "utf8")).filter((r) => r.some((c) => c !== ""));
const header = csvRows.shift();
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const required = ["action", "client_id_to_link", "ad_account_id"];
for (const k of required) {
  if (!(k in idx)) {
    console.error(`CSV missing required column: ${k}`);
    process.exit(1);
  }
}

console.log("Connecting to MongoDB...");
await mongoose.connect(process.env.MONGODB_URI);
const { default: Client } = await import("../models/Client.js");
const { verifyAdAccountAccess } = await import("../services/metaAdsService.js");

let linked = 0;
let skipped = 0;
let errored = 0;
const errors = [];

console.log(`\nReading ${csvRows.length} rows from ${path.basename(CSV_PATH)}`);
console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "LIVE"}  enable: ${ENABLE}\n`);

for (const r of csvRows) {
  const action = r[idx.action]?.trim().toLowerCase();
  const clientId = r[idx.client_id_to_link]?.trim();
  const adAccountId = r[idx.ad_account_id]?.trim();
  const accountName = r[idx.ad_account_name]?.trim();

  const label = `${adAccountId}  "${accountName}"`;

  if (action === "already-linked") {
    skipped++;
    continue;
  }
  if (action !== "link") {
    skipped++;
    continue;
  }
  if (!clientId || !mongoose.isValidObjectId(clientId)) {
    errored++;
    errors.push({ label, reason: `missing/invalid client_id_to_link` });
    console.log(`  ✗ ${label}  — invalid client_id`);
    continue;
  }
  if (!/^act_\d+$/.test(adAccountId)) {
    errored++;
    errors.push({ label, reason: `invalid ad_account_id format` });
    console.log(`  ✗ ${label}  — invalid ad_account_id`);
    continue;
  }

  // Verify ad account is reachable (and fetch canonical name/currency/tz).
  let meta;
  try {
    const { account } = await verifyAdAccountAccess(adAccountId);
    meta = account;
  } catch (err) {
    errored++;
    errors.push({ label, reason: `verify failed: ${err.message}` });
    console.log(`  ✗ ${label}  — verify failed: ${err.message}`);
    continue;
  }

  // Load client.
  const client = await Client.findById(clientId);
  if (!client) {
    errored++;
    errors.push({ label, reason: `client ${clientId} not found` });
    console.log(`  ✗ ${label}  — client ${clientId} not found`);
    continue;
  }

  // Guard against stomping an already-linked client to a different ad account.
  if (
    client.meta_ad_account_id &&
    client.meta_ad_account_id !== adAccountId
  ) {
    errored++;
    errors.push({
      label,
      reason: `Client "${client.clientName}" already linked to ${client.meta_ad_account_id}`,
    });
    console.log(
      `  ✗ ${label}  — client already linked to ${client.meta_ad_account_id}`
    );
    continue;
  }

  if (DRY_RUN) {
    linked++;
    console.log(
      `  → ${label}  ⇒  ${client.clientName} [${client._id}]  (dry-run; currency=${meta.currency}, tz=${meta.timezone_name})`
    );
    continue;
  }

  client.meta_ad_account_id = adAccountId;
  client.meta_ad_account_name = meta.name || "";
  client.meta_ad_account_currency = meta.currency || "";
  client.meta_ad_account_timezone = meta.timezone_name || "";
  if (ENABLE) client.meta_enabled = true;
  if (!client.meta_onboarded_at) client.meta_onboarded_at = new Date();
  await client.save();
  linked++;
  console.log(`  ✓ ${label}  ⇒  ${client.clientName} [${client._id}]`);
}

console.log("\n━━━━━━ Summary ━━━━━━");
console.log(`  linked:  ${linked}`);
console.log(`  skipped: ${skipped}`);
console.log(`  errored: ${errored}`);

if (errors.length) {
  console.log("\nErrors:");
  errors.forEach((e) => console.log(`  - ${e.label}: ${e.reason}`));
}

if (!DRY_RUN && linked > 0) {
  console.log(`\nNext step — kick initial sync for the newly-linked clients:
    curl -X POST "https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net/api/meta/sync"
  or for a single client:
    curl -X POST "https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net/api/meta/sync/<clientId>"
`);
}

await mongoose.disconnect();
process.exit(errored > 0 ? 1 : 0);
