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
