require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

// Import routes
const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');
const adminRoutes = require('./routes/admin');

const app = express();

// ===== SECURITY MIDDLEWARE =====

// 1. Helmet - Security HTTP Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://pagead2.googlesyndication.com"],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers in HTML
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:"],
            frameSrc: ["'self'", "https://pagead2.googlesyndication.com"],
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Rate Limiting - General API protection
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per 15 min
    message: { message: 'كثرة الطلبات، حاول لاحقاً' },
    standardHeaders: true,
    legacyHeaders: false
});

// 3. Strict Rate Limiting for Auth routes (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Only 10 login attempts per 15 min
    message: { message: 'كثرة محاولات تسجيل الدخول، انتظر 15 دقيقة' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful logins
});

// 4. Very Strict Limiter for Admin Setup (prevent abuse)
const setupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Only 3 attempts per hour
    message: { message: 'تم حظر هذا الإجراء مؤقتاً' }
});

// Apply general rate limiting
app.use('/api/', generalLimiter);

// Apply strict rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/admin/setup', setupLimiter);

// 5. CORS Configuration (Secure but allows same-origin)
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://badel-w-bi3.onrender.com',
    'https://w-bi3.onrender.com',
    'https://badelwbi3.com',
    'https://www.badelwbi3.com'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (same-origin, mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
}));

// 6. Body Parser with size limit (prevent large payload attacks)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 7. MongoDB Injection Prevention
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        console.warn(`⚠️ محاولة NoSQL Injection محظورة من: ${req.ip}`);
    }
}));

// 8. HTTP Parameter Pollution Prevention
app.use(hpp({
    whitelist: ['category', 'status'] // Allow duplicate params for these
}));

// 9. Input Sanitization (XSS Prevention)
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove potential XSS scripts
                obj[key] = obj[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .replace(/data:/gi, 'data_blocked:');
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

app.use(sanitizeInput);

// 10. Remove X-Powered-By header
app.disable('x-powered-by');

// Serve static files
app.use(express.static(path.join(__dirname, '..'), {
    setHeaders: (res, filepath) => {
        // No cache for HTML files (always fresh)
        if (filepath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        // Cache static assets like CSS/JS
        else if (filepath.endsWith('.css') || filepath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour instead of 1 year
        }
    }
}));

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

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: 'الصفحة غير موجودة' });
});

// Error Handler (Don't leak error details in production)
app.use((err, req, res, next) => {
    console.error('❌ خطأ:', err.message);
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === 'production'
            ? 'حدث خطأ في الخادم'
            : err.message
    });
});

// MongoDB Connection - ONLY from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ خطأ: يجب تعريف MONGODB_URI في ملف .env');
    console.log('📝 أنشئ ملف .env وأضف: MONGODB_URI=your_connection_string');
    process.exit(1);
}

mongoose.connect(MONGODB_URI, {
    // Security options
    retryWrites: true,
    w: 'majority'
})
    .then(() => {
        console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بشكل آمن');
    })
    .catch((err) => {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
        process.exit(1);
    });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
🛒 بدّل وبيع - Badel w Bi3
━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 الوضع: ${process.env.NODE_ENV === 'production' ? 'إنتاج (محمي)' : 'تطوير'}
🌐 الموقع: http://localhost:${PORT}
🔧 لوحة التحكم: http://localhost:${PORT}/admin
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ الحماية: Helmet ✓ | Rate Limit ✓ | NoSQL Sanitize ✓
    `);
});
