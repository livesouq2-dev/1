const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Ad = require('../models/Ad');
const User = require('../models/User');

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
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({
            lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
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
                activeUsers,
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
        res.json({ message: 'تم رفض الإعلان', ad });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update/Edit ad (admin)
router.put('/ads/:id', adminAuth, async (req, res) => {
    try {
        const { title, description, category, price, location, whatsapp, jobType, jobExperience, isFeatured } = req.body;
        const updateData = { title, description, category, price, location, whatsapp, isFeatured };

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
        res.json({ message: 'تم تعديل الإعلان', ad });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete ad
router.delete('/ads/:id', adminAuth, async (req, res) => {
    try {
        await Ad.findByIdAndDelete(req.params.id);
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

// Create admin (first time setup)
router.post('/setup', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(400).json({ message: 'يوجد مشرف مسبقاً' });
        }
        const admin = await User.create({
            name: 'المشرف',
            email: 'admin@badel.com',
            password: 'admin123',
            role: 'admin'
        });
        res.json({ message: 'تم إنشاء حساب المشرف', email: 'admin@badel.com', password: 'admin123' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
