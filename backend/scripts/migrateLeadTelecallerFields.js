/*
 * One-off migration for the telecaller-sheet retrofit.
 *
 * Backfills the new fields added to Lead.js (`date`, `contact`,
 * `source_sheet`, `hair_or_skin`, `status_sheet`, `history_*`,
 * `treatment_value`) from the pre-existing legacy columns so the
 * /client-portal/leads sheet works against historical documents on
 * day one. Also canonicalises pre-normalisation call-label spellings
 * (`RNR` → `RNA`, `SWITCHED OFF` → `SWITCH OFF`, `WRONG NO` → `WRONG NUMBER`,
 * `DUP` → `DUPLICATE`) both on the top-level `first_call_label` and on
 * every entry of `follow_ups[]`, so the strict enums we'll promote in
 * a later pass don't reject any existing document.
 *
 * SAFE to re-run — every field write is idempotent: only touches
 * empty targets, and always rebuilds histories from the authoritative
 * follow_ups[] array (single source of truth).
 *
 * Usage:
 *   node backend/scripts/migrateLeadTelecallerFields.js              # dry run — prints stats only
 *   node backend/scripts/migrateLeadTelecallerFields.js --apply      # writes changes
 *   node backend/scripts/migrateLeadTelecallerFields.js --apply -v   # verbose per-doc log
 *
 * BEFORE `--apply` in production: mongodump first. This script does
 * not back up anything itself.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Lead from '../models/Lead.js';

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

// ─── Helpers ─────────────────────────────────────────────────────
// Strip everything non-digit, drop a leading 91 country code if the
// result is 12 chars long, keep the last 10. Returns '' when no
// usable phone digits are present so the unique-partial index skips it.
const normaliseContact = (raw) => {
  if (raw == null) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  const trimmed = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits;
  return trimmed.length >= 10 ? trimmed.slice(-10) : '';
};

// Legacy free-text call-label variants seen in production → canonical
// sheet dropdown values. Anything else falls through untouched (may
// still be a valid label like `CONNECTED` / `NOT CONNECTED` / etc.).
const CALL_LABEL_ALIASES = {
  RNR: 'RNA',
  'RING NO ANSWER': 'RNA',
  'RING-NO-ANSWER': 'RNA',
  DUP: 'DUPLICATE',
  'WRONG NO': 'WRONG NUMBER',
  'WRONG NO.': 'WRONG NUMBER',
  SWITCHED_OFF: 'SWITCH OFF',
  'SWITCHED OFF': 'SWITCH OFF',
  'SWITCH-OFF': 'SWITCH OFF',
};
const canonicaliseCallLabel = (raw) => {
  const s = String(raw || '').trim().toUpperCase();
  return CALL_LABEL_ALIASES[s] || s;
};

// Free-text response_label → sheet's STATUS bucket. When the legacy
// value maps cleanly, we seed status_sheet with it; otherwise we
// leave status_sheet empty and let the UI show Follow-up by default.
const STATUS_FROM_RESPONSE = {
  HOT: 'HOT', WARM: 'WARM', COLD: 'COLD',
  DARMANT: 'DARMANT', DARMONT: 'DARMANT',   // sheet spelling variants
  CLOSED: 'CLOSED',
};

// Rebuild both history columns from follow_ups[] every pass — single
// source of truth. `Attempt {n}: YYYY-MM-DD LABEL — remarks` matches
// the format the automation lib appends going forward.
const rebuildHistory = (followUps = []) => {
  const notConnected = [];
  const connected    = [];
  followUps.forEach((f, i) => {
    if (!f || !f.call_label) return;
    const n = f.number || i + 1;
    const dateStr = f.date ? new Date(f.date).toISOString().slice(0, 10) : '—';
    const label = String(f.call_label).toUpperCase();
    const line = `Attempt ${n}: ${dateStr} ${label} — ${f.remarks || ''}`.trim();
    const isConnected = f.connected || label === 'CONNECTED';
    (isConnected ? connected : notConnected).push(line);
  });
  return {
    history_not_connected: notConnected.join('\n'),
    history_connected: connected.join('\n'),
  };
};

// Meta / manual_source_type → sheet's SOURCE dropdown value.
const SOURCE_FROM_MANUAL = {
  whatsapp: 'WHATS APP', instagram: 'INSTAGRAM', facebook: 'FACEBOOK',
  google_lead: 'GOOGLE LEAD', justdial: 'JUSTDIAL', walk_in: 'WALK-IN',
  referral: 'REFFERAL', physical_marketing: 'PHYSICAL MARKETING',
  incall_google: 'INCALL GOOGLE', incall_fb: 'INCALL FB',
  incall_insta: 'INCALL INSTA', incall_self: 'INCALL SELF',
};

// ─── Main ────────────────────────────────────────────────────────
const main = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGO_URI / MONGODB_URI in env.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(`[migrate] connected · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const cursor = Lead.find({}).cursor();
  const stats = {
    scanned: 0,
    setDate: 0,
    setContact: 0,
    setSourceSheet: 0,
    setHairOrSkin: 0,
    setStatusSheet: 0,
    canonicalisedCallLabels: 0,
    rebuiltHistory: 0,
    saved: 0,
    skippedNoChange: 0,
    errors: 0,
  };

  for await (const lead of cursor) {
    stats.scanned += 1;
    let dirty = false;

    // Col 1 DATE — prefer meta_created_time (authoritative form-
    // submission timestamp) then createdAt.
    if (!lead.date) {
      const anchor = lead.meta_created_time || lead.createdAt;
      if (anchor) { lead.date = anchor; dirty = true; stats.setDate += 1; }
    }

    // Col 4 CONTACT — normalise from phone / raw_field_data.
    if (!lead.contact) {
      const raw = lead.phone
        || (lead.raw_field_data?.phone_number)
        || (lead.raw_field_data?.phone)
        || '';
      const normalised = normaliseContact(raw);
      if (normalised) { lead.contact = normalised; dirty = true; stats.setContact += 1; }
    }

    // Col 2 SOURCE — map manual_source_type (lowercase) first,
    // else infer from `platform` (Meta-sync leads).
    if (!lead.source_sheet) {
      const src = String(lead.manual_source_type || '').toLowerCase();
      let sheetSrc = SOURCE_FROM_MANUAL[src];
      if (!sheetSrc) {
        const p = String(lead.platform || '').toLowerCase();
        if (p === 'whatsapp')                       sheetSrc = 'WHATS APP';
        if (p === 'instagram')                      sheetSrc = 'INSTAGRAM';
        if (p === 'facebook' || p === 'messenger')  sheetSrc = 'FACEBOOK';
      }
      if (sheetSrc) { lead.source_sheet = sheetSrc; dirty = true; stats.setSourceSheet += 1; }
    }

    // Col 6 HAIR/SKIN — canonicalise the free-text lead_category.
    if (!lead.hair_or_skin) {
      const cat = String(lead.lead_category || '').trim().toUpperCase();
      if (cat === 'HAIR' || cat === 'SKIN') {
        lead.hair_or_skin = cat; dirty = true; stats.setHairOrSkin += 1;
      }
    }

    // Col 22 STATUS — seed from response_label when it maps.
    if (!lead.status_sheet) {
      const resp = String(lead.response_label || '').trim().toUpperCase();
      const mapped = STATUS_FROM_RESPONSE[resp];
      if (mapped) { lead.status_sheet = mapped; dirty = true; stats.setStatusSheet += 1; }
    }

    // Canonicalise first_call_label + every follow_ups[].call_label
    // so the strict enums we'll add later don't reject legacy docs.
    if (lead.first_call_label) {
      const canon = canonicaliseCallLabel(lead.first_call_label);
      if (canon !== lead.first_call_label) {
        lead.first_call_label = canon;
        dirty = true;
        stats.canonicalisedCallLabels += 1;
      }
    }
    if (Array.isArray(lead.follow_ups)) {
      for (const f of lead.follow_ups) {
        if (!f.call_label) continue;
        const canon = canonicaliseCallLabel(f.call_label);
        if (canon !== f.call_label) {
          f.call_label = canon;
          dirty = true;
          stats.canonicalisedCallLabels += 1;
        }
      }
    }

    // Cols 20/21 HISTORY — always rebuild from follow_ups[] (the
    // human never types here). Counted separately from other dirty
    // flags so the summary shows how many rows had legit call history.
    const { history_not_connected, history_connected } = rebuildHistory(lead.follow_ups);
    let historyDirty = false;
    if (history_not_connected !== (lead.history_not_connected || '')) {
      lead.history_not_connected = history_not_connected;
      historyDirty = true;
    }
    if (history_connected !== (lead.history_connected || '')) {
      lead.history_connected = history_connected;
      historyDirty = true;
    }
    if (historyDirty) { dirty = true; stats.rebuiltHistory += 1; }

    if (!dirty) {
      stats.skippedNoChange += 1;
      continue;
    }

    if (VERBOSE) {
      console.log(`  ${lead._id}  ${lead.name || '<no-name>'}  contact=${lead.contact || '—'}  src=${lead.source_sheet || '—'}  hs=${lead.hair_or_skin || '—'}`);
    }

    if (APPLY) {
      try {
        await lead.save();
        stats.saved += 1;
      } catch (err) {
        stats.errors += 1;
        console.error(`  save failed for ${lead._id}: ${err.message}`);
      }
    }
  }

  console.log('\n[migrate] summary');
  console.table(stats);
  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to persist changes.');
  }
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('[migrate] fatal', err);
  process.exit(1);
});
