import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const fixIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('dailyentries');

    // Get current indexes
    console.log('\nCurrent indexes:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Drop problematic indexes (old unique index on just 'date')
    const indexesToDrop = [];

    for (const index of indexes) {
      // Skip the default _id index
      if (index.name === '_id_') continue;

      // Check for old unique index on just 'date'
      if (index.unique && index.key.date && !index.key.client) {
        indexesToDrop.push(index.name);
        console.log(`\nFound old unique index to drop: ${index.name}`);
      }
    }

    // Drop old indexes
    for (const indexName of indexesToDrop) {
      console.log(`Dropping index: ${indexName}`);
      await collection.dropIndex(indexName);
      console.log(`Dropped index: ${indexName}`);
    }

    // Delete any entries without a client field (orphaned data)
    const orphanedCount = await collection.countDocuments({ client: { $exists: false } });
    if (orphanedCount > 0) {
      console.log(`\nFound ${orphanedCount} entries without client field. Deleting...`);
      await collection.deleteMany({ client: { $exists: false } });
      console.log('Deleted orphaned entries');
    }

    // Create the correct compound unique index
    console.log('\nCreating compound unique index on date + client...');
    try {
      await collection.createIndex(
        { date: 1, client: 1 },
        { unique: true, name: 'date_client_unique' }
      );
      console.log('Created compound unique index successfully');
    } catch (err) {
      if (err.code === 85) {
        console.log('Index already exists with different name, skipping...');
      } else {
        throw err;
      }
    }

    // Show final indexes
    console.log('\nFinal indexes:');
    const finalIndexes = await collection.indexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log('\n✅ Index fix completed successfully!');
    console.log('You can now create daily entries for the same date with different clients.');

  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

fixIndexes();
