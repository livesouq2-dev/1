require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');
const adminRoutes = require('./routes/admin');

const app = express();

// ===== SECURITY MIDDLEWARE =====

// 1. Rate Limiting - Prevent brute force attacks
const rateLimit = {};
const rateLimitMiddleware = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100; // max 100 requests per 15 min

    if (!rateLimit[ip]) {
        rateLimit[ip] = { count: 1, startTime: now };
    } else if (now - rateLimit[ip].startTime > windowMs) {
        rateLimit[ip] = { count: 1, startTime: now };
    } else {
        rateLimit[ip].count++;
        if (rateLimit[ip].count > maxRequests) {
            return res.status(429).json({ message: 'كثرة الطلبات، حاول لاحقاً' });
        }
    }
    next();
};

// 2. Security Headers
const securityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent XSS attacks
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; img-src 'self' https: data: blob:; connect-src 'self' https:;");
    // Remove server info
    res.removeHeader('X-Powered-By');
    next();
};

// 3. Input Sanitization
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove potential XSS scripts
                obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                // Remove MongoDB injection attempts
                obj[key] = obj[key].replace(/\$|\{|\}/g, '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    };
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
};

// Apply Security Middleware
app.use(rateLimitMiddleware);
app.use(securityHeaders);

// CORS Configuration (Secure)
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://badel-w-bi3.onrender.com', 'https://w-bi3.onrender.com']
        : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Body Parser with size limit (prevent large payload attacks)
app.use(express.json({ limit: '5mb' }));
app.use(sanitizeInput);
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// MongoDB Connection - Note: special characters in password need URL encoding
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://livesouq2_db_user:olleikmom313@cluster0.n1jewbg.mongodb.net/badel-w-bi3?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ تم الاتصال بقاعدة البيانات MongoDB');
    })
    .catch((err) => {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
    });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
🛒 بدّل وبيع - Badel w Bi3
━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 الموقع: http://localhost:${PORT}
🔧 لوحة التحكم: http://localhost:${PORT}/admin
━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 المشرف: +961 71 163 211
    `);
});
