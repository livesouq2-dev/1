const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Ad = require('../models/Ad');
const User = require('../models/User');
const Prices = require('../models/Prices');

// ===== Simple In-Memory Cache for Fast Response =====
const cache = {
    ads: null,
    adsTime: 0,
    stats: null,
    statsTime: 0,
    prices: null,
    pricesTime: 0,
    CACHE_DURATION: 2 * 60 * 1000,  // 2 minutes
    STATS_CACHE: 5 * 60 * 1000,     // 5 minutes for stats

    isValid(key) {
        const now = Date.now();
        if (key === 'ads') return this.ads && (now - this.adsTime) < this.CACHE_DURATION;
        if (key === 'stats') return this.stats && (now - this.statsTime) < this.STATS_CACHE;
        if (key === 'prices') return this.prices && (now - this.pricesTime) < this.STATS_CACHE;
        return false;
    },

    set(key, data) {
        const now = Date.now();
        if (key === 'ads') { this.ads = data; this.adsTime = now; }
        if (key === 'stats') { this.stats = data; this.statsTime = now; }
        if (key === 'prices') { this.prices = data; this.pricesTime = now; }
    },

    invalidate(key) {
        if (key === 'ads') { this.ads = null; this.adsTime = 0; }
        if (key === 'stats') { this.stats = null; this.statsTime = 0; }
        if (key === 'prices') { this.prices = null; this.pricesTime = 0; }
    },

    invalidateAll() {
        this.ads = null; this.adsTime = 0;
        this.stats = null; this.statsTime = 0;
    }
};

// ===== Persistent JSON Cache for INSTANT Loading =====
const fs = require('fs');
const path = require('path');
const CACHE_FILE_PATH = path.join(__dirname, '..', '..', 'public', 'ads-cache.json');

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', '..', 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Update the cache file with all approved ads
async function updateCacheFile() {
    try {
        const Ad = require('../models/Ad');

        // Fetch all approved ads
        const ads = await Ad.find({ status: 'approved' })
            .select('title description category subCategory price location whatsapp isFeatured createdAt images jobType jobExperience')
            .populate('user', 'name')
            .sort({ isFeatured: -1, createdAt: -1 })
            .limit(200)
            .lean();

        // Update memory cache too
        cache.set('ads', ads);

        // Write to file (async, non-blocking)
        const cacheData = {
            ads: ads,
            updatedAt: new Date().toISOString(),
            count: ads.length
        };

        fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheData), 'utf8', (err) => {
            if (err) {
                console.error('❌ Error writing cache file:', err.message);
            } else {
                console.log(`✅ Cache file updated: ${ads.length} ads saved`);
            }
        });

        return ads;
    } catch (error) {
        console.error('❌ Error updating cache file:', error.message);
        return null;
    }
}

// Initialize cache file on startup
async function initializeCacheFile() {
    try {
        // Check if file exists and is recent (less than 5 minutes old)
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const stats = fs.statSync(CACHE_FILE_PATH);
            const age = Date.now() - stats.mtimeMs;
            if (age < 5 * 60 * 1000) {
                console.log('📦 Cache file exists and is fresh');
                // Load into memory cache
                const data = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
                if (data.ads) {
                    cache.set('ads', data.ads);
                    console.log(`📦 Loaded ${data.ads.length} ads into memory cache`);
                }
                return;
            }
        }

        // Create/update cache file
        console.log('📦 Initializing cache file...');
        await updateCacheFile();
    } catch (error) {
        console.error('❌ Error initializing cache:', error.message);
    }
}

// Auth middleware
const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'badel_secret');
        req.user = await User.findById(decoded.id);
        if (!req.user) {
            return res.status(401).json({ message: 'المستخدم غير موجود' });
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'جلسة غير صالحة' });
    }
};

// ===== FAST CACHE ENDPOINT - Returns all cached ads instantly =====
// This is used by frontend for instant loading (works on cloud platforms like Render)
router.get('/cache', async (req, res) => {
    try {
        // If cache is valid, return it immediately
        if (cache.isValid('ads') && cache.ads && cache.ads.length > 0) {
            console.log('⚡ Serving instant cache');
            return res.json({
                ads: cache.ads,
                updatedAt: new Date(cache.adsTime).toISOString(),
                count: cache.ads.length,
                fromCache: true
            });
        }

        // Cache is empty or expired, refresh it
        const ads = await updateCacheFile();
        if (ads && ads.length > 0) {
            return res.json({
                ads: ads,
                updatedAt: new Date().toISOString(),
                count: ads.length,
                fromCache: false
            });
        }

        // No ads found
        res.json({ ads: [], count: 0 });
    } catch (error) {
        console.error('❌ Cache endpoint error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// Get all approved ads (public) - WITH CACHE
router.get('/', async (req, res) => {
    try {
        const { category, page = 1, limit = 100 } = req.query;

        // Try to use cache for faster response
        if (cache.isValid('ads') && cache.ads && cache.ads.length > 0) {
            console.log('📦 Serving ads from cache');

            let resultAds = cache.ads;

            // Filter by category if requested
            if (category && category !== 'all') {
                resultAds = cache.ads.filter(ad => ad.category === category);
            }

            // Apply pagination
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const paginatedAds = resultAds.slice(startIndex, startIndex + parseInt(limit));

            return res.json({ ads: paginatedAds, total: resultAds.length, fromCache: true });
        }

        // Fetch all approved ads from database
        const allAds = await Ad.find({ status: 'approved' })
            .select('title description category subCategory price location whatsapp isFeatured createdAt images jobType jobExperience')
            .populate('user', 'name')
            .sort({ isFeatured: -1, createdAt: -1 })
            .limit(200)
            .lean();

        // Cache all ads
        if (allAds && allAds.length > 0) {
            cache.set('ads', allAds);
            console.log(`📦 Cached ${allAds.length} ads`);
        }

        // Filter by category if requested
        let resultAds = allAds || [];
        if (category && category !== 'all') {
            resultAds = resultAds.filter(ad => ad.category === category);
        }

        // Apply pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const paginatedAds = resultAds.slice(startIndex, startIndex + parseInt(limit));

        res.json({ ads: paginatedAds, total: resultAds.length });
    } catch (error) {
        console.error('❌ Error loading ads:', error.message);
        // If cache exists, serve it on error
        if (cache.ads && cache.ads.length > 0) {
            const { category } = req.query;
            let resultAds = cache.ads;
            if (category && category !== 'all') {
                resultAds = cache.ads.filter(ad => ad.category === category);
            }
            return res.json({ ads: resultAds, fromCache: true, stale: true });
        }
        res.status(500).json({ message: 'خطأ في تحميل الإعلانات', error: error.message });
    }
});

// Get public stats (users count, ads count) - WITH CACHE
router.get('/stats', async (req, res) => {
    try {
        // Check cache
        if (cache.isValid('stats')) {
            return res.json(cache.stats);
        }

        // Use Promise.all for parallel queries (faster)
        const [totalAds, totalUsers] = await Promise.all([
            Ad.countDocuments({ status: 'approved' }),
            User.countDocuments({ isActive: true })
        ]);

        const stats = { totalAds, totalUsers };
        cache.set('stats', stats);

        res.json(stats);
    } catch (error) {
        // Serve cached stats on error
        if (cache.stats) return res.json(cache.stats);
        res.status(500).json({ message: error.message });
    }
});

// Get current prices (public)
router.get('/prices', async (req, res) => {
    try {
        const prices = await Prices.getPrices();
        res.json({
            goldOunce: prices.goldOunce,
            goldLira: prices.goldLira,
            silverOunce: prices.silverOunce,
            dollarRate: prices.dollarRate,
            updatedAt: prices.updatedAt
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Track WhatsApp click (public) - for analytics
router.post('/:id/whatsapp-click', async (req, res) => {
    try {
        const ad = await Ad.findByIdAndUpdate(
            req.params.id,
            { $inc: { whatsappClicks: 1 } },
            { new: true }
        );
        if (!ad) {
            return res.status(404).json({ message: 'الإعلان غير موجود' });
        }
        res.json({ success: true, clicks: ad.whatsappClicks });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get user's ads
router.get('/my-ads', auth, async (req, res) => {
    try {
        const ads = await Ad.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json({ ads });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create ad (protected) - requires approval
router.post('/', auth, async (req, res) => {
    try {
        const { title, description, category, subCategory, price, location, whatsapp, images, jobType, jobExperience } = req.body;

        // Debug: Log image info
        console.log('📸 Images received:', images ? images.length : 0);
        if (images && images.length > 0) {
            images.forEach((img, i) => {
                console.log(`  Image ${i + 1}: ${img ? img.substring(0, 50) + '...' : 'null'} (length: ${img ? img.length : 0})`);
            });
        }

        const adData = {
            title,
            description,
            category,
            subCategory: subCategory || null,
            price,
            location,
            whatsapp,
            images: images || [],
            user: req.user._id,
            status: 'pending' // Needs admin approval
        };

        // Add job-specific fields if category is jobs
        if (category === 'jobs') {
            adData.jobType = jobType || null;
            adData.jobExperience = jobExperience || null;
        }

        const ad = await Ad.create(adData);

        // Invalidate cache after creating ad
        cache.invalidateAll();

        res.status(201).json({
            status: 'success',
            message: 'تم إرسال إعلانك بنجاح! سيتم مراجعته من قبل المشرف. للدفع العمولة والموافقة السريعة، تواصل مع المشرف على الرقم: +961 71 163 211',
            ad,
            adminContact: '+961 71 163 211'
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update ad (owner only)
router.put('/:id', auth, async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({ message: 'الإعلان غير موجود' });
        }
        if (ad.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'غير مصرح لك بتعديل هذا الإعلان' });
        }

        const { title, description, category, subCategory, price, location, images } = req.body;
        ad.title = title || ad.title;
        ad.description = description || ad.description;
        ad.category = category || ad.category;
        ad.subCategory = subCategory !== undefined ? subCategory : ad.subCategory;
        ad.price = price || ad.price;
        ad.location = location || ad.location;
        ad.images = images || ad.images;
        ad.status = 'pending'; // Reset to pending after edit

        await ad.save();

        // Invalidate cache after update
        cache.invalidateAll();

        res.json({ message: 'تم تعديل الإعلان بنجاح! سيتم مراجعته مجدداً', ad });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete ad (owner or admin)
router.delete('/:id', auth, async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({ message: 'الإعلان غير موجود' });
        }
        if (ad.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'غير مصرح لك بحذف هذا الإعلان' });
        }
        await Ad.findByIdAndDelete(req.params.id);

        // Invalidate cache after delete
        cache.invalidateAll();

        res.json({ message: 'تم حذف الإعلان بنجاح' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Export router and cache for use in admin routes
module.exports = router;
module.exports.cache = cache;
module.exports.updateCacheFile = updateCacheFile;
module.exports.initializeCacheFile = initializeCacheFile;
