import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Per-client portal user. Each Client can have multiple ClientPortalUsers,
// each with their own role:
//   - admin     → full portal (Google Ads, Meta Ads, Meta Leads + Users tab)
//   - telecaller → only the Meta Leads tab (lead handling workflow)
//
// On the very first login attempt for a Client that still uses the legacy
// per-client portalEmail/portalPassword, clientAuthController seeds an
// `admin` ClientPortalUser from those fields so existing portal logins
// keep working with no manual migration.
const clientPortalUserSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    // Display name — kept on the schema for backwards compatibility with
    // existing rows, but no longer collected from the UI. New creates
    // default this to the username so legacy code that reads `user.name`
    // still has something usable.
    name: {
      type: String,
      trim: true,
      default: '',
    },
    // The login identifier. Required for every user; admins seeded from
    // the legacy portalEmail get their username auto-derived from the
    // email's local-part. Telecallers usually don't have a real email,
    // so the admin sets their username directly when creating them.
    username: {
      type: String,
      required: [true, 'Please add a username'],
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 60,
      match: [/^[a-z0-9._-]+$/, 'Username may only contain lowercase letters, digits, dot, underscore, hyphen'],
    },
    // Email is optional now — telecallers may not have one. When provided
    // it can also be used to log in (the controller accepts either).
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      select: false,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'telecaller'],
      default: 'telecaller',
      index: true,
    },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClientPortalUser',
    },
  },
  { timestamps: true }
);

// Username is the canonical login identifier — unique per client.
clientPortalUserSchema.index({ clientId: 1, username: 1 }, { unique: true });
// Email is optional but unique per-client *when present*. Sparse so
// multiple users with no email don't collide with each other.
clientPortalUserSchema.index(
  { clientId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string', $ne: '' } },
  }
);

clientPortalUserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

clientPortalUserSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

const ClientPortalUser = mongoose.model('ClientPortalUser', clientPortalUserSchema);
export default ClientPortalUser;
