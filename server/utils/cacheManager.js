const fs = require('fs');
const path = require('path');
const Ad = require('../models/Ad');

// Path to the cache file (in public folder for static serving)
const CACHE_FILE = path.join(__dirname, '../../public/ads-cache.json');

/**
 * Rebuild the ads cache file
 * Called automatically when ads are approved/rejected/deleted
 */
async function rebuildAdsCache() {
    try {
        console.log('🔄 Rebuilding ads cache...');

        // Get all approved ads, sorted by featured first, then by date
        const ads = await Ad.find({ status: 'approved' })
            .populate('user', 'name')
            .sort({ isFeatured: -1, createdAt: -1 })
            .lean(); // Use lean() for faster query

        // Create cache object with metadata
        const cacheData = {
            generatedAt: new Date().toISOString(),
            count: ads.length,
            ads: ads.map(ad => ({
                _id: ad._id,
                title: ad.title,
                description: ad.description,
                category: ad.category,
                subCategory: ad.subCategory,
                price: ad.price,
                location: ad.location,
                whatsapp: ad.whatsapp,
                images: ad.images,
                isFeatured: ad.isFeatured,
                createdAt: ad.createdAt,
                user: ad.user ? { name: ad.user.name } : null
            }))
        };

        // Ensure public directory exists
        const publicDir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }

        // Write to file
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData), 'utf8');

        console.log(`✅ Ads cache rebuilt: ${ads.length} ads saved to ${CACHE_FILE}`);
        return { success: true, count: ads.length };
    } catch (error) {
        console.error('❌ Error rebuilding ads cache:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get cache file path (for serving)
 */
function getCacheFilePath() {
    return CACHE_FILE;
}

/**
 * Check if cache exists
 */
function cacheExists() {
    return fs.existsSync(CACHE_FILE);
}

module.exports = {
    rebuildAdsCache,
    getCacheFilePath,
    cacheExists
};
