// ===== Import Data to New MongoDB =====
// This script imports the exported data into a new MongoDB
// 
// Steps:
//   1. First run: node export-data.js (to export from old DB)
//   2. Change MONGODB_URI in .env to the NEW MongoDB URI
//   3. Run: node import-data.js

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Ad = require('./server/models/Ad');
const User = require('./server/models/User');
const Prices = require('./server/models/Prices');

// Import exported data
const exportedData = require('./data');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

async function importData() {
    try {
        console.log('🔌 Connecting to NEW MongoDB...');
        console.log(`   URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Connected!');

        // Confirm before importing
        console.log('');
        console.log(`📊 Data to import:`);
        console.log(`   👥 Users: ${exportedData.users.length}`);
        console.log(`   📋 Ads: ${exportedData.ads.length}`);
        console.log(`   💰 Prices: ${exportedData.prices.length}`);
        console.log('');
        console.log('⏳ Importing...');

        // Import Users (using insertMany with raw data to preserve hashed passwords)
        if (exportedData.users.length > 0) {
            // Use the underlying collection to bypass the pre-save hook (password hashing)
            await User.collection.insertMany(exportedData.users.map(u => ({
                ...u,
                _id: new mongoose.Types.ObjectId(u._id)
            })));
            console.log(`✅ Imported ${exportedData.users.length} users`);
        }

        // Import Ads
        if (exportedData.ads.length > 0) {
            await Ad.collection.insertMany(exportedData.ads.map(a => ({
                ...a,
                _id: new mongoose.Types.ObjectId(a._id),
                user: new mongoose.Types.ObjectId(a.user)
            })));
            console.log(`✅ Imported ${exportedData.ads.length} ads`);
        }

        // Import Prices
        if (exportedData.prices.length > 0) {
            await Prices.collection.insertMany(exportedData.prices.map(p => ({
                ...p,
                _id: new mongoose.Types.ObjectId(p._id)
            })));
            console.log(`✅ Imported ${exportedData.prices.length} price records`);
        }

        console.log('');
        console.log('🎉 ===== Import Complete! =====');
        console.log('Your data has been migrated to the new MongoDB.');

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error('❌ Error:', err.message);
        if (err.code === 11000) {
            console.error('⚠️ Duplicate data detected - the data may already exist in this database.');
        }
        process.exit(1);
    }
}

importData();
