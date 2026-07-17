import mongoose from 'mongoose';

// ─── Telecaller-sheet dropdown enums ─────────────────────────────
// Exact strings from the TELECALLING sheet (GROHAIR - LEAD SHEET-TNJ-2025)
// so xlsx import/export round-trips cleanly. Note: `DARMANT` is the
// sheet's original spelling — kept verbatim for compatibility.
// Empty string is included in every enum so an unset value is valid
// (Mongoose enum otherwise rejects '' on save).
export const SOURCE_ENUM = [
  '', 'WHATS APP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE LEAD', 'JUSTDIAL',
  'WALK-IN', 'REFFERAL', 'PHYSICAL MARKETING',
  'INCALL GOOGLE', 'INCALL FB', 'INCALL INSTA', 'INCALL SELF',
];
export const CALL_LABEL_ENUM = [
  '', 'CONNECTED', 'INVALID', 'BUSY', 'SWITCH OFF', 'WRONG NUMBER',
  'RNA', 'DUPLICATE', 'DISCONNECTED', 'NOT CONNECTED',
];
export const RESPONSE_LABEL_ENUM = [
  '', 'HOT', 'WARM', 'COLD', 'DARMANT', 'CLOSED',
  'APPOINTMENT BOOKED', 'REPEAT', 'INVALID',
];
export const APPOINTMENT_STATUS_ENUM = [
  '', 'APPOINTMENT BOOKED', 'APPOINTMENT BOOKED - VISITED',
  'APPOINTMENT BOOKED - NOT VISITED', 'APPOINTMENT RESCHEDULED',
];
export const FOLLOWUP_CALL_LABEL_ENUM = [
  '', 'CONNECTED', 'BUSY', 'SWITCH OFF', 'RNA',
  'DISCONNECTED', 'NOT CONNECTED',
];
export const STATUS_SHEET_ENUM = [
  '', 'HOT', 'WARM', 'COLD', 'DARMANT', 'CLOSED', 'Follow-up',
];
export const HAIR_OR_SKIN_ENUM = ['', 'HAIR', 'SKIN'];

// Not-connected labels that count towards the DARMANT-flip rule.
// Kept alongside the enums because both the automation lib and the
// migration reference the same list.
export const NOT_CONNECTED_LABELS = new Set([
  'BUSY', 'SWITCH OFF', 'RNA', 'DISCONNECTED', 'NOT CONNECTED',
]);

// Sub-document for each follow-up attempt logged against a lead.
// One row per attempt — multiple attempts per lead are common (the CRM
// spreadsheet shows leads with 10+ follow-ups across weeks).
//
// call_label is intentionally kept free-text (no Mongoose enum) so
// legacy documents carrying pre-normalisation values like `RNR` don't
// throw ValidationError on save. The controller + automation lib
// enforce FOLLOWUP_CALL_LABEL_ENUM at write time; the migration
// canonicalises historical values in place.
const followUpSchema = new mongoose.Schema(
  {
    number: { type: Number },                    // attempt index, 1-based
    date: { type: Date },
    call_label: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    connected: { type: Boolean, default: false },            // mirrors call_label === 'CONNECTED' for fast filtering
  },
  { _id: true, timestamps: true }
);

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['meta', 'google', 'website', 'referral', 'direct', 'other'],
      default: 'direct',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
      default: 'new',
    },
    value: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Meta (Facebook / Instagram) lead fields
    meta_leadgen_id: { type: String, trim: true, unique: true, sparse: true },
    // Meta's authoritative form-submission timestamp (from leadgen.created_time).
    // Use THIS for "when did the user actually fill the form" — `createdAt`
    // reflects when our sync/webhook ingested it, which can be hours/days later
    // for backfilled leads.
    meta_created_time: { type: Date },
    meta_form_id: { type: String, trim: true, default: '' },
    meta_form_name: { type: String, trim: true, default: '' },
    meta_campaign_id: { type: String, trim: true, default: '' },
    meta_campaign_name: { type: String, trim: true, default: '' },
    meta_adset_id: { type: String, trim: true, default: '' },
    meta_adset_name: { type: String, trim: true, default: '' },
    meta_ad_id: { type: String, trim: true, default: '' },
    meta_ad_name: { type: String, trim: true, default: '' },
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'messenger', 'whatsapp', 'unknown', ''],
      default: '',
    },
    utm_source: { type: String, trim: true, default: '' },
    utm_medium: { type: String, trim: true, default: '' },
    utm_campaign: { type: String, trim: true, default: '' },
    utm_content: { type: String, trim: true, default: '' },
    utm_term: { type: String, trim: true, default: '' },
    raw_field_data: { type: mongoose.Schema.Types.Mixed },

    // ===== CRM telecaller workflow fields =====
    // These mirror the columns of the spreadsheet the team uses today and
    // are edited inline from MetaLeadsTable on both /client-ads and the
    // client portal dashboard.
    is_duplicate: { type: Boolean, default: false },
    lead_location: { type: String, trim: true, default: '' },
    lead_category: { type: String, trim: true, default: '' },   // e.g. HAIR / SKIN
    telecaller_name: { type: String, trim: true, default: '' },

    // Source bucket for manual entries — used by the EOD dashboard's
    // Leads Abstract. Synced Meta-form leads infer their bucket from
    // `platform` + `meta_form_name`; manual entries set this explicitly.
    // 'whatsapp' is the default to preserve the existing manual flow.
    //
    // The enum INTENTIONALLY keeps the legacy off-platform values
    // (google_lead / justdial / walk_in / referral / physical_marketing /
    // incall_*) even though the Leads-table source dropdown was trimmed
    // to whatsapp + instagram + facebook only. Old documents in the DB
    // may still carry those values; widening the enum would mean writes
    // still work, narrowing it would make Mongoose throw on reads of
    // historical data. If you ever want to clean these up, plan a
    // backfill migration that maps old values onto AbstractEntry
    // manualValues + clears the lead's manual_source_type.
    manual_source_type: {
      type: String,
      enum: ['', 'whatsapp', 'instagram', 'facebook', 'google_lead', 'justdial', 'walk_in', 'referral', 'physical_marketing', 'incall_google', 'incall_fb', 'incall_insta', 'incall_self'],
      default: '',
    },

    // Initial call
    first_call_date: { type: Date },
    first_call_label: { type: String, trim: true, default: '' },   // CONNECTED / NOT CONNECTED / DISCONNECTED / INVALID
    response_label: { type: String, trim: true, default: '' },     // TREATMENT BOOKED / CONSULTED / WARM / HOT / NOT INTERESTED / DUPLICATE / etc.
    remarks: { type: String, trim: true, default: '' },

    // Reminder + appointment
    next_followup_date: { type: Date },
    appointment_status: { type: String, trim: true, default: '' }, // APPOINTMENT BOOKED / RESCHEDULED / etc.
    appointment_date: { type: Date },
    appointment_booked_date: { type: Date },                       // Date on which the appointment was booked (audit/reporting)

    // Follow-ups — one entry per attempt
    follow_ups: { type: [followUpSchema], default: [] },

    // ─── Telecaller-sheet retrofit (col 1-26) ────────────────────
    // Added Jul 2026 to power the /client-portal/leads Excel-style
    // sheet with validation, auto-history and daily queue. Fields
    // parallel the existing CRM columns above but are enum-validated
    // against the TELECALLING sheet's exact strings for xlsx round-
    // trip fidelity. A one-off migration script backfills these from
    // legacy free-text fields on existing documents.
    //
    // Mapping to sheet columns:
    //   col 1  DATE                        → date
    //   col 2  SOURCE                      → source_sheet (enum)
    //   col 4  CONTACT (10-digit)          → contact
    //   col 6  HAIR/SKIN                   → hair_or_skin (enum)
    //   col 12 REMINDER DATE               → reminder_date virtual → next_followup_date
    //   col 20 FOLLOWUP HIST NOT CONN CALLS→ history_not_connected (auto-appended)
    //   col 21 FOLLOWUP HIST CONN CALLS    → history_connected (auto-appended)
    //   col 22 STATUS                      → status_sheet (enum)
    //   col 23 CONSULTED DATE              → consulted_date
    //   col 24 TREATMENT BOOKED DATE       → treatment_booked_date
    //   col 25 TREATMENT VALUE             → treatment_value
    //   col 16 FOLLOW-UP NUMBER            → follow_up_number virtual (from follow_ups.length)
    //   col 26 MONTH                       → month virtual (from date)
    //   col 5 LOCATION                     → REUSES existing lead_location
    //   col 7 TELECALLER NAME              → REUSES existing telecaller_name
    //   col 8 FIRST CALL DATE              → REUSES existing first_call_date
    //   col 9 CALL LABEL                   → REUSES existing first_call_label
    //   col 10 RESPONSE LABEL              → REUSES existing response_label
    //   col 11 REMARKS                     → REUSES existing remarks
    //   col 13 APPOINTMENT STATUS          → REUSES existing appointment_status
    //   col 14/15 APPT DATE / BOOKED DATE  → REUSES existing appointment_date / appointment_booked_date
    //   cols 17/18/19 FOLLOW-UP call/date/remarks → REUSES existing follow_ups[] sub-doc
    date: { type: Date },
    contact: { type: String, trim: true, default: '' },
    source_sheet: {
      type: String, trim: true, default: '',
      enum: SOURCE_ENUM,
    },
    hair_or_skin: {
      type: String, trim: true, default: '',
      enum: HAIR_OR_SKIN_ENUM,
    },
    status_sheet: {
      type: String, trim: true, default: '',
      enum: STATUS_SHEET_ENUM,
    },
    history_not_connected: { type: String, default: '' },   // col 20 — read-only, auto-appended
    history_connected:     { type: String, default: '' },   // col 21 — read-only, auto-appended
    consulted_date:        { type: Date },
    treatment_booked_date: { type: Date },
    treatment_value:       { type: Number, default: 0 },
    // Flags rows the automation lib tripped into DARMANT after 5
    // not-connected attempts. Kept as a separate boolean so the
    // sheet can be un-flagged without losing the DARMANT status.
    darmant_flagged: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ client: 1, createdAt: -1 });
leadSchema.index({ client: 1, meta_created_time: -1 });
leadSchema.index({ meta_created_time: -1 });
leadSchema.index({ meta_form_id: 1, createdAt: -1 });
leadSchema.index({ meta_campaign_id: 1 });
leadSchema.index({ meta_ad_id: 1 });

// ─── Telecaller-sheet indexes ────────────────────────────────────
// contact + client: unique 10-digit phone WITHIN a client (the same
// number can legitimately exist across different clients). Partial
// filter so blank contact values don't collide — a schema-wide
// unique on '' would explode after the second empty document.
leadSchema.index(
  { client: 1, contact: 1 },
  {
    unique: true,
    partialFilterExpression: { contact: { $type: 'string', $gt: '' } },
    name: 'client_contact_unique',
  }
);
// Contact alone (cross-client duplicate lookups in the UI).
leadSchema.index({ contact: 1 });
// Powers the "Due Today" queue chip.
leadSchema.index({ client: 1, next_followup_date: 1 });
// Powers queue filter chips + status counts.
leadSchema.index({ client: 1, status_sheet: 1 });

// ─── Virtuals for computed sheet columns ─────────────────────────
// Col 16 FOLLOW-UP NUMBER — one-based attempt counter derived from
// the embedded follow_ups[] length. Kept as a virtual so the UI can
// display it without a denormalised copy that could drift from truth.
leadSchema.virtual('follow_up_number').get(function () {
  return Array.isArray(this.follow_ups) ? this.follow_ups.length : 0;
});
// Col 26 MONTH — month name of the sheet's DATE. Falls back to
// meta_created_time / createdAt for legacy docs without `date`.
leadSchema.virtual('month').get(function () {
  const anchor = this.date || this.meta_created_time || this.createdAt;
  if (!anchor) return '';
  return new Date(anchor).toLocaleString('en-GB', { month: 'long' });
});
// Col 12 REMINDER DATE — alias over next_followup_date so the sheet
// vocabulary works without a second physical field. Read + write in
// both directions so the /leads/queue endpoint and the grid can use
// either name interchangeably.
leadSchema.virtual('reminder_date')
  .get(function () { return this.next_followup_date; })
  .set(function (v) { this.next_followup_date = v; });

leadSchema.set('toJSON',   { virtuals: true });
leadSchema.set('toObject', { virtuals: true });

// Pre-save mirror: keep the free-text `lead_category` in sync with
// the enum-validated `hair_or_skin`. Legacy readers of `lead_category`
// (older admin pages) keep working; the new sheet writes go through
// `hair_or_skin` and the mirror propagates.
leadSchema.pre('save', function (next) {
  if (this.isModified('hair_or_skin') && this.hair_or_skin) {
    this.lead_category = this.hair_or_skin;
  }
  next();
});

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
