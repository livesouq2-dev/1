/**
 * Fix sourceId duplicate key error
 * This script:
 * 1. Drops the old sourceId_1 sparse index
 * 2. Removes the sourceId field from ads where it's null
 * 3. The new partial filter index will be created automatically by Mongoose
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

async function fix() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected!');

        const db = mongoose.connection.db;
        const adsCollection = db.collection('ads');

        // Step 1: Drop the old problematic index
        console.log('\n📋 Current indexes on ads collection:');
        const indexes = await adsCollection.indexes();
        indexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''} ${idx.sparse ? '(sparse)' : ''}`);
        });

        const hasOldIndex = indexes.some(idx => idx.name === 'sourceId_1');
        if (hasOldIndex) {
            console.log('\n🗑️  Dropping old sourceId_1 index...');
            await adsCollection.dropIndex('sourceId_1');
            console.log('✅ Old index dropped!');
        } else {
            console.log('\n✅ sourceId_1 index not found (already removed)');
        }

        // Step 2: Remove sourceId field from documents where it's null
        const result = await adsCollection.updateMany(
            { sourceId: null },
            { $unset: { sourceId: "" } }
        );
        console.log(`\n🧹 Cleaned up ${result.modifiedCount} ads with null sourceId`);

        // Step 3: Show updated indexes
        console.log('\n📋 Indexes after fix:');
        const newIndexes = await adsCollection.indexes();
        newIndexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''}`);
        });

        console.log('\n✅ Fix complete! You can now upload ads without the duplicate key error.');
        console.log('   The new partial filter index will be created automatically when the server starts.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

fix();
