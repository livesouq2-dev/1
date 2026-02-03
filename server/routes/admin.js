const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Ad = require('../models/Ad');
const User = require('../models/User');
const Prices = require('../models/Prices');

// Import cache from ads routes to invalidate when admin makes changes
const { cache: adsCache } = require('./ads');

// Import cache manager for rebuilding ads-cache.json
const { rebuildAdsCache } = require('../utils/cacheManager');

// Admin auth middleware
const adminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'يجب تسجيل الدخول' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'badel_secret');
        req.user = await User.findById(decoded.id);
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: 'غير مصرح - للمشرفين فقط' });
        }
        next();
    } catch (error) {
        res.status(401).json({ message: 'جلسة غير صالحة' });
    }
};

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const now = new Date();
        const fiveMinAgo = new Date(now - 5 * 60 * 1000);
        const oneHourAgo = new Date(now - 60 * 60 * 1000);
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

        const totalUsers = await User.countDocuments();

        // Detailed active users breakdown
        const activeNow = await User.countDocuments({
            lastActive: { $gte: fiveMinAgo }
        });
        const activeLastHour = await User.countDocuments({
            lastActive: { $gte: oneHourAgo }
        });
        const activeToday = await User.countDocuments({
            lastActive: { $gte: oneDayAgo }
        });

        const totalAds = await Ad.countDocuments();
        const pendingAds = await Ad.countDocuments({ status: 'pending' });
        const approvedAds = await Ad.countDocuments({ status: 'approved' });
        const rejectedAds = await Ad.countDocuments({ status: 'rejected' });

        // Ads by category
        const adsByCategory = await Ad.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        res.json({
            stats: {
                totalUsers,
                activeNow,        // نشط الآن (آخر 5 دقائق)
                activeLastHour,   // نشط آخر ساعة
                activeToday,      // نشط اليوم (24 ساعة)
                activeUsers: activeToday, // للتوافق مع الكود القديم
                totalAds,
                pendingAds,
                approvedAds,
                rejectedAds,
                adsByCategory
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get pending ads
router.get('/pending-ads', adminAuth, async (req, res) => {
    try {
        const ads = await Ad.find({ status: 'pending' })
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 });
        res.json({ ads });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all ads (for admin)
router.get('/ads', adminAuth, async (req, res) => {
    try {
        const ads = await Ad.find()
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.json({ ads });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Approve ad
router.patch('/ads/:id/approve', adminAuth, async (req, res) => {
    try {
        const ad = await Ad.findByIdAndUpdate(
            req.params.id,
            { status: 'approved', isFeatured: req.body.featured || false },
            { new: true }
        );
        if (!ad) {
            return res.status(404).json({ message: 'الإعلان غير موجود' });
        }

        // Invalidate memory cache
        if (adsCache) adsCache.invalidateAll();

        // Rebuild static JSON cache (async, don't wait)
        rebuildAdsCache().catch(err => console.error('Cache rebuild error:', err));

        res.json({ message: 'تم قبول الإعلان', ad });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Reject ad
router.patch('/ads/:id/reject', adminAuth, async (req, res) => {
    try {
        const ad = await Ad.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected', adminNote: req.body.reason || '' },
            { new: true }
        );
        if (!ad) {
            return res.status(404).json({ message: 'الإعلان غير موجود' });
        }

        // Invalidate memory cache
        if (adsCache) adsCache.invalidateAll();

        // Rebuild static JSON cache
        rebuildAdsCache().catch(err => console.error('Cache rebuild error:', err));

        res.json({ message: 'تم رفض الإعلان', ad });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update/Edit ad (admin)
router.put('/ads/:id', adminAuth, async (req, res) => {
    try {
        const { title, description, category, subCategory, price, location, whatsapp, jobType, jobExperience, isFeatured } = req.body;
        const updateData = { title, description, category, subCategory, price, location, whatsapp, isFeatured };

        // Add job-specific fields if category is jobs
        if (category === 'jobs') {
            updateData.jobType = jobType || null;
            updateData.jobExperience = jobExperience || null;
        }

        const ad = await Ad.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        if (!ad) {
            return res.status(404).json({ message: 'الإعلان غير موجود' });
        }

        // Invalidate memory cache
        if (adsCache) adsCache.invalidateAll();

        // Rebuild static JSON cache
        rebuildAdsCache().catch(err => console.error('Cache rebuild error:', err));

        res.json({ message: 'تم تعديل الإعلان', ad });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete ad
router.delete('/ads/:id', adminAuth, async (req, res) => {
    try {
        await Ad.findByIdAndDelete(req.params.id);

        // Invalidate memory cache
        if (adsCache) adsCache.invalidateAll();

        // Rebuild static JSON cache
        rebuildAdsCache().catch(err => console.error('Cache rebuild error:', err));

        res.json({ message: 'تم حذف الإعلان' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        await Ad.deleteMany({ user: req.params.id });
        res.json({ message: 'تم حذف المستخدم وإعلاناته' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create admin (first time setup) - SECURED
// Admin credentials are stored in environment variables
router.post('/setup', async (req, res) => {
    try {
        // Check if any admin already exists
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(400).json({ message: 'يوجد مشرف مسبقاً - لا يمكن إنشاء حساب جديد' });
        }

        // Get admin credentials from environment variables
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@badel.com';
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            console.error('❌ ADMIN_PASSWORD not set in environment variables');
            return res.status(500).json({ message: 'خطأ في تكوين النظام - تواصل مع المطور' });
        }

        const admin = await User.create({
            name: 'المشرف',
            email: adminEmail.toLowerCase(),
            password: adminPassword,
            role: 'admin'
        });

        console.log('✅ تم إنشاء حساب المشرف بنجاح:', adminEmail);

        res.json({
            message: 'تم إنشاء حساب المشرف بنجاح!',
            email: adminEmail
            // Password NOT returned for security
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===== MANUAL CACHE REBUILD =====

// Rebuild ads cache manually (admin)
router.post('/rebuild-cache', adminAuth, async (req, res) => {
    try {
        const result = await rebuildAdsCache();
        if (result.success) {
            res.json({
                message: `✅ تم إعادة بناء الـ cache بنجاح! (${result.count} إعلان)`,
                count: result.count
            });
        } else {
            res.status(500).json({ message: '❌ فشل في بناء الـ cache: ' + result.error });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===== PRICES MANAGEMENT =====

// Get current prices (admin)
router.get('/prices', adminAuth, async (req, res) => {
    try {
        const prices = await Prices.getPrices();
        res.json(prices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update prices (admin only)
router.put('/prices', adminAuth, async (req, res) => {
    try {
        const { goldOunce, goldLira, silverOunce, dollarRate } = req.body;

        let prices = await Prices.findOne();
        if (!prices) {
            prices = new Prices();
        }

        if (goldOunce !== undefined) prices.goldOunce = goldOunce;
        if (goldLira !== undefined) prices.goldLira = goldLira;
        if (silverOunce !== undefined) prices.silverOunce = silverOunce;
        if (dollarRate !== undefined) prices.dollarRate = dollarRate;
        prices.updatedAt = new Date();
        prices.updatedBy = req.user.name || 'admin';

        await prices.save();

        res.json({
            message: 'تم تحديث الأسعار بنجاح',
            prices
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
