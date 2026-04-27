// Backfill Lead.meta_created_time on every existing Meta-sourced lead by
// querying Meta directly for each form's leads and matching on leadgen_id.
//
// Much more efficient than /{leadgen_id} per lead — we hit /{form_id}/leads
// once per form and get paginated created_time for every lead on that form.
//
// Usage:
//   node backend/scripts/metaBackfillCreatedTime.js            # dry-run
//   node backend/scripts/metaBackfillCreatedTime.js --apply    # write

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const APPLY = process.argv.includes("--apply");

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

console.log("Connecting to MongoDB...");
await mongoose.connect(process.env.MONGODB_URI);

const { default: Client } = await import("../models/Client.js");
const { default: Lead } = await import("../models/Lead.js");
const { default: MetaLeadForm } = await import("../models/MetaLeadForm.js");
const { fetchLeadsForForm } = await import("../services/metaAdsService.js");
const { decrypt } = await import("../utils/encryption.js");

console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY-RUN"}\n`);

// Pull every form that has a client linked (we need the Page token on the
// client to call fetchLeadsForForm, so unmapped forms are skipped).
const forms = await MetaLeadForm.find({ client_id: { $ne: null } });
console.log(`Forms with clients: ${forms.length}`);

let scannedForms = 0;
let matchedLeads = 0;
let updatedLeads = 0;
let missingTokens = 0;
let apiErrors = 0;

for (const form of forms) {
  scannedForms++;

  const client = await Client.findById(form.client_id).select("clientName meta_pages");
  if (!client) continue;

  const page = (client.meta_pages || []).find((p) => p.page_id === form.page_id);
  if (!page?.encrypted_access_token) {
    missingTokens++;
    continue;
  }

  let pageToken;
  try {
    pageToken = decrypt(page.encrypted_access_token);
  } catch (e) {
    missingTokens++;
    continue;
  }

  // Pull ALL leads on this form (sinceTs=0) — this may be 1000s of rows, but
  // the wrapper auto-paginates up to MAX_ITEMS_PER_EDGE=10000. Global fetch
  // has no default timeout, so one hanging paginated call would stall the
  // whole backfill — wrap it in a 90s deadline and skip the form on timeout.
  let metaLeads = [];
  try {
    const result = await Promise.race([
      fetchLeadsForForm(form.form_id, pageToken, 0),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("fetch timeout (90s)")), 90_000)
      ),
    ]);
    metaLeads = result.data || [];
  } catch (err) {
    apiErrors++;
    console.log(`  ✗ form=${form.form_id} ${form.name} — ${err.message}`);
    continue;
  }

  console.log(
    `  ${form.name.padEnd(45)}  meta=${metaLeads.length}   client=${client.clientName}`
  );

  // Build {leadgen_id → created_time} map first, then trim to only leads that
  // actually need writing. Querying which rows still lack meta_created_time
  // up-front means we skip forms that are already 100% backfilled without
  // sending any write commands (Cosmos is slow enough that even no-op
  // bulkWrites can time out on a flaky network).
  const metaMap = new Map();
  for (const m of metaLeads) {
    if (!m?.id || !m?.created_time) continue;
    const createdTime = new Date(m.created_time);
    if (Number.isNaN(createdTime.getTime())) continue;
    metaMap.set(m.id, createdTime);
  }
  matchedLeads += metaMap.size;

  // Pre-filter: only keep leads that still need backfill.
  const candidateIds = Array.from(metaMap.keys());
  const pending = candidateIds.length
    ? await Lead.find({
        meta_leadgen_id: { $in: candidateIds },
        meta_created_time: { $exists: false },
      })
        .select("meta_leadgen_id")
        .lean()
    : [];

  const ops = pending.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { meta_created_time: metaMap.get(doc.meta_leadgen_id) } },
    },
  }));

  if (!ops.length) {
    console.log(`      → already backfilled, skipping`);
    continue;
  }

  if (APPLY && ops.length) {
    // Cosmos DB chokes on large bulkWrites. Small chunks + per-chunk timeout
    // means no single slow command can stall the whole run.
    const CHUNK = 10;
    let modifiedForForm = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const slice = ops.slice(i, i + CHUNK);
      try {
        const result = await Promise.race([
          Lead.bulkWrite(slice, { ordered: false }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("bulkWrite timeout (60s)")), 60_000)
          ),
        ]);
        modifiedForForm += result.modifiedCount || 0;
      } catch (err) {
        // A partial-batch timeout is still a failure — log and move on so
        // one form doesn't stall the rest of the backfill.
        console.log(
          `      ! chunk ${i}-${i + slice.length} failed: ${err.message}`
        );
      }
    }
    updatedLeads += modifiedForForm;
    console.log(`      → updated ${modifiedForForm}/${ops.length} leads`);
  } else if (!APPLY && ops.length) {
    console.log(`      → ${ops.length} leads would be updated (dry-run)`);
  }
}

console.log("\n━━━━━━ Summary ━━━━━━");
console.log(`  Forms scanned:   ${scannedForms}`);
console.log(`  Meta leads seen: ${matchedLeads}`);
console.log(`  Updated in DB:   ${APPLY ? updatedLeads : "(dry-run)"}`);
console.log(`  Missing tokens:  ${missingTokens}`);
console.log(`  API errors:      ${apiErrors}`);

if (!APPLY) {
  console.log("\n(Dry-run — re-run with --apply to write.)");
}

await mongoose.disconnect();
process.exit(0);
