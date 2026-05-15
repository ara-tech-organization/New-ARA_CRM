import mongoose from 'mongoose';

// Sub-document for each follow-up attempt logged against a lead.
// One row per attempt — multiple attempts per lead are common (the CRM
// spreadsheet shows leads with 10+ follow-ups across weeks).
const followUpSchema = new mongoose.Schema(
  {
    number: { type: Number },                    // attempt index, 1-based
    date: { type: Date },
    call_label: { type: String, trim: true, default: '' },   // CONNECTED / NOT CONNECTED / DISCONNECTED / RNR / BUSY / etc.
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

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
