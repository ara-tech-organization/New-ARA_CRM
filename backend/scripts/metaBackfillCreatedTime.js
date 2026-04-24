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
  // the wrapper auto-paginates up to MAX_ITEMS_PER_EDGE=10000.
  let metaLeads = [];
  try {
    const result = await fetchLeadsForForm(form.form_id, pageToken, 0);
    metaLeads = result.data || [];
  } catch (err) {
    apiErrors++;
    console.log(`  ✗ form=${form.form_id} ${form.name} — ${err.message}`);
    continue;
  }

  console.log(
    `  ${form.name.padEnd(45)}  meta=${metaLeads.length}   client=${client.clientName}`
  );

  // Build {leadgen_id → created_time} map, then do a single bulkWrite per form.
  const ops = [];
  for (const m of metaLeads) {
    if (!m?.id || !m?.created_time) continue;
    const createdTime = new Date(m.created_time);
    if (Number.isNaN(createdTime.getTime())) continue;
    matchedLeads++;
    ops.push({
      updateOne: {
        filter: { meta_leadgen_id: m.id, meta_created_time: { $exists: false } },
        update: { $set: { meta_created_time: createdTime } },
      },
    });
  }

  if (APPLY && ops.length) {
    // Cosmos DB chokes on large bulkWrites. Chunk at 50 so each command
    // stays well under the server-side timeout.
    const CHUNK = 50;
    let modifiedForForm = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const slice = ops.slice(i, i + CHUNK);
      try {
        const result = await Lead.bulkWrite(slice, { ordered: false });
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
