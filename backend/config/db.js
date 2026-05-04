import mongoose from 'mongoose';

// One-shot fix-up that runs on every boot but is idempotent. Existing
// Client docs created before the schema change had `google_ads_customer_id`
// and `meta_ad_account_id` defaulted to '', and the sparse unique indexes
// indexed those empty strings — so creating a second client without those
// fields collided with E11000 and returned 500. Unsetting empty values
// turns them into "missing" so the sparse index ignores them.
const cleanupEmptyUniqueFields = async () => {
  try {
    const Client = mongoose.connection.collection('clients');
    if (!Client) return;
    await Client.updateMany(
      { google_ads_customer_id: '' },
      { $unset: { google_ads_customer_id: 1 } }
    );
    await Client.updateMany(
      { meta_ad_account_id: '' },
      { $unset: { meta_ad_account_id: 1 } }
    );
  } catch (err) {
    // Don't block boot — log and move on.
    console.error('Client unique-field cleanup skipped:', err.message);
  }
};

// Self-heal client portal users. Three issues we've seen in production:
//
//   1. A client's only ClientPortalUser was created with the schema's
//      default role of 'telecaller', leaving the legitimate client
//      owner unable to access the Users tab. The legacy fallback in
//      clientAuthController fixes this on next login, but doing it at
//      boot means the affected admin sees the right tabs the moment
//      their session refreshes — no need for a second login.
//   2. Older rows might be missing the new `username` field (added
//      after rollout). Backfill from the email's local-part so they
//      can log in by username.
//   3. Stale unique indexes block telecaller saves. The first version of
//      this model had `{ clientId: 1, email: 1 }, { unique: true }`
//      (no partial filter, email required). When email later became
//      optional and defaulted to '', that old index still enforces
//      uniqueness on '' — so the second telecaller without an email
//      collides with E11000. Mongoose's autoIndex won't drop indexes
//      whose options no longer match the schema, so we drop it here
//      and let `syncIndexes()` rebuild with the partial-filter version.
const healClientPortalUsers = async () => {
  try {
    const ClientPortalUser = mongoose.connection.collection('clientportalusers');
    if (!ClientPortalUser) return;

    // (3) Drop the stale strict-unique (clientId, email) index if present,
    // then rebuild from the schema. The new index has a partialFilter so
    // empty-string emails are not enforced unique.
    try {
      const indexes = await ClientPortalUser.indexes();
      const stale = indexes.find(
        (ix) =>
          ix.key &&
          ix.key.clientId === 1 &&
          ix.key.email === 1 &&
          ix.unique === true &&
          !ix.partialFilterExpression
      );
      if (stale) {
        await ClientPortalUser.dropIndex(stale.name);
      }
      // Rebuild any missing indexes from the schema (idempotent).
      const ClientPortalUserModel = (await import('../models/ClientPortalUser.js')).default;
      await ClientPortalUserModel.syncIndexes();
    } catch (e) {
      console.error('ClientPortalUser index repair skipped:', e.message);
    }

    // Promote sole telecaller → admin per client (skips clients that
    // already have at least one admin).
    const stuckClients = await ClientPortalUser.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$clientId',
          adminCount: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          firstUserId: { $first: '$_id' },
        },
      },
      { $match: { adminCount: 0 } },
    ]).toArray();

    for (const row of stuckClients) {
      await ClientPortalUser.updateOne(
        { _id: row.firstUserId },
        { $set: { role: 'admin' } }
      );
    }

    // Backfill missing usernames from email local-part. If two rows
    // collide on the same derived username we just append a suffix
    // from their _id so the unique index is satisfied.
    const noUsername = await ClientPortalUser.find({
      $or: [{ username: { $exists: false } }, { username: '' }, { username: null }],
    }).toArray();

    for (const u of noUsername) {
      const local = String(u.email || '').split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user';
      const base = local.length >= 3 ? local : `user${String(u._id).slice(-6)}`;
      let candidate = base;
      // Try the bare local-part first, then with an _id suffix on collision.
      for (let i = 0; i < 3; i += 1) {
        const clash = await ClientPortalUser.findOne({ clientId: u.clientId, username: candidate });
        if (!clash) break;
        candidate = `${base}${String(u._id).slice(-4 - i)}`;
      }
      try {
        await ClientPortalUser.updateOne({ _id: u._id }, { $set: { username: candidate } });
      } catch (e) {
        // Final fallback — guaranteed unique.
        await ClientPortalUser.updateOne(
          { _id: u._id },
          { $set: { username: `user${String(u._id)}` } }
        );
      }
    }
  } catch (err) {
    console.error('ClientPortalUser self-heal skipped:', err.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection pool settings for better performance
      maxPoolSize: 50,
      minPoolSize: 10,
      maxIdleTimeMS: 120000,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      // Performance optimizations
      autoIndex: process.env.NODE_ENV !== 'production', // Disable auto-indexing in production
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Run after the connection is open so collections are ready.
    cleanupEmptyUniqueFields();
    healClientPortalUsers();

    // Monitor connection pool
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to DB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected');
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
