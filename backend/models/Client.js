import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { encrypt } from '../utils/encryption.js';

const clientSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: [true, 'Please add a client name'],
      trim: true,
    },
    place: {
      type: String,
      trim: true,
      default: '',
    },
    organisationType: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    onboardDate: {
      type: Date,
      default: Date.now,
    },
    gstNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      // 'dropped' is a soft-delete status — the row stays in the DB
      // for history but is excluded from the live client list by
      // default. Re-onboarding flips the status back to 'active'.
      enum: ['active', 'inactive', 'pending', 'suspended', 'dropped'],
      default: 'active',
    },
    // ── Drop history ─────────────────────────────────────────────
    // Captures why a client was dropped, when, and by whom — plus
    // a small list of past drop/re-onboard events so the audit
    // trail isn't wiped if the client is later reactivated and
    // dropped a second time.
    drop_reason: { type: String, default: '' },
    dropped_at: { type: Date, default: null },
    dropped_by: { type: String, default: '' },
    reonboarded_at: { type: Date, default: null },
    drop_history: [{
      action: { type: String, enum: ['dropped', 'reonboarded'], required: true },
      reason: { type: String, default: '' },
      at: { type: Date, default: Date.now },
      by: { type: String, default: '' },
    }],
    accountID: {
      type: String,
      trim: true,
      default: '',
    },
    accountId: {
      type: String,
      trim: true,
      default: '',
    },
    customerID: {
      type: String,
      trim: true,
      default: '',
    },
    googleCustomerId: {
      type: String,
      trim: true,
      default: '',
    },
    removalReason: {
      type: String,
      trim: true,
      default: '',
    },
    links: {
      type: [String],
      default: [],
    },
    assignedSMM: {
      type: String,
      trim: true,
      default: '',
    },
    assignedSME: {
      type: String,
      trim: true,
      default: '',
    },
    team: {
      type: String,
      trim: true,
      default: '',
    },
    // creativeCommitment / staticCommitment / motionCreative / notes
    // were removed from the schema — they were UI-only commitments
    // that nothing else in the system read or aggregated, and the
    // agency stopped using them. Historical documents may still have
    // these keys; Mongoose just ignores unknown fields on read, so no
    // migration is needed.
    billing: {
      billing_type: { type: String, enum: ['monthly', 'quarterly'], default: 'monthly' },
      total_added_funds: { type: Number, default: 0 },
      total_spend: { type: Number, default: 0 },
      available_balance: { type: Number, default: 0 },
      low_balance_threshold: { type: Number, default: 100 }
    },
    currency: { type: String, default: 'INR' },
    time_zone: { type: String, default: 'Asia/Kolkata' },
    google_ads_customer_id: {
      type: String,
      trim: true,
      // No `default` here on purpose. With `unique + sparse`, the sparse
      // index only skips null/missing values — empty strings are still
      // indexed. Defaulting to '' caused E11000 duplicate-key 500s the
      // moment a second client was created without a Customer ID.
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          return !v || /^\d{10}$/.test(v);
        },
        message: 'Google Ads Customer ID must be exactly 10 digits'
      }
    },
    google_ads_account_name: {
      type: String,
      trim: true,
      default: '',
    },
    google_ads_enabled: {
      type: Boolean,
      default: false,
    },

    // Meta (Facebook / Instagram) Marketing API fields
    meta_enabled: {
      type: Boolean,
      default: false,
    },
    meta_business_id: {
      type: String,
      trim: true,
      default: '',
    },
    meta_ad_account_id: {
      type: String,
      trim: true,
      // Same reason as google_ads_customer_id above — `default: ''`
      // breaks the sparse unique index because empty strings ARE indexed.
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          return !v || /^act_\d+$/.test(v);
        },
        message: 'Meta Ad Account ID must start with "act_" followed by digits',
      },
    },
    meta_ad_account_name: {
      type: String,
      trim: true,
      default: '',
    },
    meta_ad_account_currency: {
      type: String,
      trim: true,
      default: '',
    },
    meta_ad_account_timezone: {
      type: String,
      trim: true,
      default: '',
    },
    meta_pages: {
      type: [
        {
          page_id: { type: String, required: true },
          page_name: { type: String, default: '' },
          encrypted_access_token: { type: String, default: '' },
          token_issued_at: { type: Date },
          token_expires_at: { type: Date },
          subscribed: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    meta_instagram_account_ids: {
      type: [String],
      default: [],
    },
    meta_onboarded_at: {
      type: Date,
    },
    meta_last_sync_at: {
      type: Date,
    },
    meta_last_sync_status: {
      type: String,
      enum: ['success', 'partial', 'failed', ''],
      default: '',
    },
    meta_last_sync_error: {
      type: String,
      default: '',
    },

    // Client Portal fields
    portalEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    portalPassword: {
      type: String,
      default: '',
      select: false,
    },
    // Recoverable encrypted copy of the portal password — used by
    // the admin "Reveal password" button on the Client Portal Access
    // page so the original plaintext can be shown when a client
    // forgets it. Stored encrypted-at-rest with AES via the
    // utils/encryption helper (server-side key only). `portalPassword`
    // above is still the bcrypt hash used for actual login auth.
    portalPasswordEnc: {
      type: String,
      default: '',
      select: false,
    },
    portalEnabled: {
      type: Boolean,
      default: false,
    },

    // Editable telecalling targets per client. These power the
    // "Target" cells in the EOD report — were hardcoded as 10 daily
    // consults / 100 daily calls; admins can now tune them.
    // Monthly targets default to daily × 31 unless overridden.
    telecalling_targets: {
      day_consult: { type: Number, default: 10, min: 0 },
      day_calls: { type: Number, default: 100, min: 0 },
      month_consult: { type: Number, default: 310, min: 0 },
      month_calls: { type: Number, default: 3100, min: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Hash portal password before save AND keep a recoverable encrypted
// copy alongside for admin reveal. The plaintext only exists on the
// model instance for the duration of this hook — once `portalPassword`
// is overwritten with the bcrypt hash, it's gone from the document.
clientSchema.pre('save', async function () {
  if (!this.isModified('portalPassword') || !this.portalPassword) return;
  const plaintext = this.portalPassword;
  // 1) Hash for login auth — same as before.
  const salt = await bcrypt.genSalt(10);
  this.portalPassword = await bcrypt.hash(plaintext, salt);
  // 2) Encrypted copy so an admin can reveal the original when a
  //    client forgets it. encrypt() throws if the env key is missing,
  //    so we swallow the error and leave portalPasswordEnc empty —
  //    login still works via the hash; only reveal is unavailable.
  try {
    this.portalPasswordEnc = encrypt(plaintext);
  } catch (err) {
    // The bcrypt hash still landed (login works) but recovery is
    // disabled until the encryption key is sorted out. Log loudly
    // so an operator notices instead of silently losing the
    // "Reveal password" feature for every new save.
    console.error(
      '[Client.pre-save] Could not encrypt portalPassword for recovery — '
      + `feature disabled for this row. Reason: ${err?.message || err}`
    );
    this.portalPasswordEnc = '';
  }
});

// Compare portal password
clientSchema.methods.matchPortalPassword = async function (enteredPassword) {
  if (!this.portalPassword) return false;
  return await bcrypt.compare(enteredPassword, this.portalPassword);
};

// Index for better query performance
clientSchema.index({ clientName: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ accountID: 1 });
clientSchema.index({ createdAt: -1 });
clientSchema.index({ google_ads_enabled: 1 });
clientSchema.index({ meta_enabled: 1 });
clientSchema.index({ 'meta_pages.page_id': 1 });
clientSchema.index({ 'billing.available_balance': 1 });
// Text index for fast text search
clientSchema.index({ clientName: 'text', place: 'text', organisationType: 'text', accountID: 'text' });
clientSchema.index({ portalEmail: 1 }, { sparse: true });

const Client = mongoose.model('Client', clientSchema);

export default Client;
