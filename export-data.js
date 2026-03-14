// ===== Export MongoDB Data to data.js =====
// This script connects to your current MongoDB and exports all collections
// Run: node export-data.js

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Ad = require('./server/models/Ad');
const User = require('./server/models/User');
const Prices = require('./server/models/Prices');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

async function exportData() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Connected!');

        // Export all collections
        console.log('📦 Exporting Users...');
        const users = await User.find({}).lean();
        console.log(`   Found ${users.length} users`);

        console.log('📦 Exporting Ads...');
        const ads = await Ad.find({}).lean();
        console.log(`   Found ${ads.length} ads`);

        console.log('📦 Exporting Prices...');
        const prices = await Prices.find({}).lean();
        console.log(`   Found ${prices.length} price records`);

        // Build the data.js file content
        const dataContent = `// ===== Exported MongoDB Data =====
// Exported on: ${new Date().toISOString()}
// Source: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}
// 
// To import into a new MongoDB, run: node import-data.js

const exportedData = {
    users: ${JSON.stringify(users, null, 2)},

    ads: ${JSON.stringify(ads, null, 2)},

    prices: ${JSON.stringify(prices, null, 2)}
};

module.exports = exportedData;
`;

        // Write to file
        const fs = require('fs');
        fs.writeFileSync('./data.js', dataContent, 'utf8');
        
        console.log('');
        console.log('✅ ===== Export Complete! =====');
        console.log(`📄 File: data.js`);
        console.log(`👥 Users: ${users.length}`);
        console.log(`📋 Ads: ${ads.length}`);
        console.log(`💰 Prices: ${prices.length}`);
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Change MONGODB_URI in .env to the new URI');
        console.log('   2. Run: node import-data.js');

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

exportData();
