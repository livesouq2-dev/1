const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Secret (must be set in .env)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ خطأ: يجب تعريف JWT_SECRET في ملف .env');
    process.exit(1);
}

// Generate JWT Token with enhanced security
const signToken = (id) => {
    return jwt.sign(
        { id, iat: Date.now() },
        JWT_SECRET,
        { expiresIn: '7d', algorithm: 'HS256' }
    );
};

// Email validation helper
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Password strength validation
const isStrongPassword = (password) => {
    return password && password.length >= 6;
};

// Sanitize user response (never send password)
const sanitizeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isPremium: user.isPremium || false,
    premiumPlan: user.premiumPlan || 'none'
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Input validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'البريد الإلكتروني غير صالح' });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }

        // Check if user exists (case-insensitive)
        const existingUser = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (existingUser) {
            return res.status(400).json({ message: 'البريد الإلكتروني مستخدم مسبقاً' });
        }

        // Create user
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            phone: phone ? phone.trim() : undefined
        });

        const token = signToken(user._id);

        res.status(201).json({
            status: 'success',
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(400).json({ message: 'حدث خطأ في التسجيل' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان' });
        }

        // Find user (case-insensitive)
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        // Generic error message (don't reveal if email exists)
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ message: 'تم تعطيل هذا الحساب' });
        }

        // Update last active
        user.lastActive = Date.now();
        await user.save({ validateBeforeSave: false });

        const token = signToken(user._id);

        res.json({
            status: 'success',
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(400).json({ message: 'حدث خطأ في تسجيل الدخول' });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'غير مسجل الدخول' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'غير مسجل الدخول' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'تم تعطيل هذا الحساب' });
        }

        // Update last active
        user.lastActive = Date.now();
        await user.save({ validateBeforeSave: false });

        res.json({ user: sanitizeUser(user) });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'جلسة غير صالحة' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'انتهت صلاحية الجلسة، سجل دخولك مجدداً' });
        }
        res.status(401).json({ message: 'جلسة غير صالحة' });
    }
});

module.exports = router;
