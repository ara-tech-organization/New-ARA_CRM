// Interactive CLI: walk through every Page assigned to the System User and
// ask the operator which CRM Client each one belongs to. Writes the Page
// (with encrypted access_token) into Client.meta_pages and, as a bonus,
// claims any MetaLeadForm rows that were parked with client_id=null.
//
// Usage:
//   node backend/scripts/metaPagesManualLink.js
//
// Controls per Page:
//   <number>  pick a client from the suggestion list
//   l         list all meta-enabled clients (wider net)
//   /text     filter clients by substring (case-insensitive)
//   s         skip this Page (leave unlinked)
//   u         show the current link for this Page (if any)
//   q         quit — progress is saved row-by-row, safe to re-run

import dotenv from "dotenv";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

console.log("Connecting to MongoDB...");
await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected.\n");

const { default: Client } = await import("../models/Client.js");
const { default: MetaLeadForm } = await import("../models/MetaLeadForm.js");
const { encrypt } = await import("../utils/encryption.js");
const { listPagesForSystemUser, subscribePageToLeadgen } = await import(
  "../services/metaAdsService.js"
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// -- Fuzzy scoring (lighter than the mapping report — we want a generous suggestion list) --
const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tokenize = (s) => normalize(s).split(" ").filter((t) => t.length >= 2);
const score = (a, b) => {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter((t) => B.has(t)).length;
  const [smaller, bigger] = A.size <= B.size ? [A, B] : [B, A];
  const coverage = [...smaller].filter((t) => bigger.has(t)).length / smaller.size;
  return Math.round(Math.max(shared / new Set([...A, ...B]).size, coverage * 0.9) * 100);
};

// -- Load sides ------------------------------------------------------------
console.log("Fetching Pages from Meta...");
const { pages } = await listPagesForSystemUser();
console.log(`  ${pages.length} pages\n`);

console.log("Loading Clients from Mongo...");
const allClients = await Client.find({})
  .select("_id clientName meta_ad_account_id meta_ad_account_name meta_pages meta_enabled status")
  .lean();
console.log(`  ${allClients.length} clients`);

// Prefer clients that are already Meta-enabled — they're the usual targets.
const metaEnabled = allClients.filter((c) => c.meta_enabled || c.meta_ad_account_id);
console.log(`  ${metaEnabled.length} with meta_enabled/ad_account linked\n`);

// Fast lookup of which pages are already assigned to any client
const pageIdToOwner = new Map();
for (const c of allClients) {
  for (const p of c.meta_pages || []) {
    pageIdToOwner.set(p.page_id, c);
  }
}

// -- Helpers ---------------------------------------------------------------
const renderList = (rows) =>
  rows
    .map(
      (r, i) =>
        `  [${String(i + 1).padStart(2)}] ${r.clientName.padEnd(55)} ` +
        `${r.meta_ad_account_name || r.meta_ad_account_id || ""}`
    )
    .join("\n");

const applyLink = async ({ client, page }) => {
  // Upsert the Page row inside Client.meta_pages.
  const existing = (client.meta_pages || []).find((p) => p.page_id === page.id);
  const entry = {
    page_id: page.id,
    page_name: page.name,
    encrypted_access_token: encrypt(page.access_token),
    token_issued_at: new Date(),
    token_expires_at: existing?.token_expires_at,
    subscribed: true,
  };

  const meta_pages = existing
    ? (client.meta_pages || []).map((p) => (p.page_id === page.id ? entry : p))
    : [...(client.meta_pages || []), entry];

  await Client.updateOne(
    { _id: client._id },
    {
      $set: {
        meta_pages,
        meta_enabled: true,
        meta_onboarded_at: client.meta_onboarded_at || new Date(),
      },
    }
  );

  // Confirm subscription (idempotent on Meta's side).
  let subscribeOutcome = "not-called";
  try {
    await subscribePageToLeadgen(page.id, page.access_token);
    subscribeOutcome = "ok";
  } catch (err) {
    subscribeOutcome = `failed: ${err.message}`;
  }

  // Claim any MetaLeadForm rows parked with client_id=null for this Page.
  const claimed = await MetaLeadForm.updateMany(
    { page_id: page.id, client_id: null },
    { $set: { client_id: client._id } }
  );

  return { subscribeOutcome, formsClaimed: claimed.modifiedCount };
};

// -- Main loop -------------------------------------------------------------
let linked = 0;
let skipped = 0;
let errors = 0;

for (let i = 0; i < pages.length; i++) {
  const page = pages[i];
  const prev = pageIdToOwner.get(page.id);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Page ${i + 1}/${pages.length}:  ${page.name}`);
  console.log(`  id=${page.id}   tasks=[${(page.tasks || []).join(",")}]`);
  if (prev) {
    console.log(
      `  Currently linked to: "${prev.clientName}" (${prev._id}) — will replace on confirm`
    );
  }

  // Compute scored suggestions across ALL clients (we don't exclude metaEnabled-only
  // because sometimes operator wants to link a fresh client).
  const suggestions = allClients
    .map((c) => ({ client: c, s: score(page.name, c.clientName) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .filter((r) => r.s >= 15);

  let workingList = suggestions.map((r) => ({ ...r.client, _score: r.s }));
  const printList = () => {
    if (!workingList.length) {
      console.log("  (no matches — type 'l' for full list, '/text' to search, 's' to skip)");
      return;
    }
    console.log("  Suggestions:");
    workingList.forEach((r, idx) => {
      const scoreStr = typeof r._score === "number" ? ` (match ${r._score})` : "";
      const adAcct = r.meta_ad_account_id ? ` — ${r.meta_ad_account_id}` : "";
      console.log(`    [${String(idx + 1).padStart(2)}] ${r.clientName}${adAcct}${scoreStr}`);
    });
  };
  printList();

  let resolved = false;
  while (!resolved) {
    const raw = (await ask("  › ")).trim();

    if (!raw || raw === "s") {
      skipped++;
      console.log("  skipped.");
      resolved = true;
      break;
    }
    if (raw === "q") {
      console.log("\nExiting. Progress saved.");
      rl.close();
      await mongoose.disconnect();
      process.exit(0);
    }
    if (raw === "l") {
      workingList = allClients.slice().sort((a, b) =>
        a.clientName.localeCompare(b.clientName)
      );
      printList();
      continue;
    }
    if (raw === "u") {
      console.log(
        prev
          ? `  Currently linked to: ${prev.clientName} (${prev._id})`
          : "  Not currently linked to any client."
      );
      continue;
    }
    if (raw.startsWith("/")) {
      const q = raw.slice(1).toLowerCase();
      workingList = allClients
        .filter((c) => c.clientName.toLowerCase().includes(q))
        .sort((a, b) => a.clientName.localeCompare(b.clientName))
        .slice(0, 30);
      printList();
      continue;
    }

    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > workingList.length) {
      console.log("  ? unrecognized input. Use a number, 'l', '/text', 's', 'u', or 'q'.");
      continue;
    }

    const picked = workingList[n - 1];
    const confirm = (await ask(
      `  Link "${page.name}" → "${picked.clientName}"? [Y/n] `
    )).trim().toLowerCase();
    if (confirm && confirm !== "y") {
      console.log("  not linked.");
      continue;
    }

    try {
      // Reload the full doc (we selected a lean slice earlier — applyLink needs the real fields).
      const clientDoc = await Client.findById(picked._id).lean();
      const result = await applyLink({ client: clientDoc, page });
      linked++;
      console.log(
        `  ✓ linked. subscribe=${result.subscribeOutcome}  ` +
          `forms_claimed=${result.formsClaimed}`
      );
    } catch (err) {
      errors++;
      console.log(`  ✗ failed: ${err.message}`);
    }
    resolved = true;
  }
}

console.log("\n━━━━━━ Summary ━━━━━━");
console.log(`  linked:  ${linked}`);
console.log(`  skipped: ${skipped}`);
console.log(`  errors:  ${errors}`);

rl.close();
await mongoose.disconnect();
process.exit(0);
