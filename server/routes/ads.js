const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Ad = require('../models/Ad');
const User = require('../models/User');
const Prices = require('../models/Prices');

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

// Get all approved ads (public)
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        const query = { status: 'approved' };
        if (category && category !== 'all') {
            query.category = category;
        }
        const ads = await Ad.find(query)
            .populate('user', 'name')
            .sort({ isFeatured: -1, createdAt: -1 });
        res.json({ ads });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get public stats (users count, ads count)
router.get('/stats', async (req, res) => {
    try {
        const totalAds = await Ad.countDocuments({ status: 'approved' });
        const totalUsers = await User.countDocuments({ isActive: true });
        res.json({ totalAds, totalUsers });
    } catch (error) {
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
        res.json({ message: 'تم حذف الإعلان بنجاح' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
