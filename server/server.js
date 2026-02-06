require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');
const adminRoutes = require('./routes/admin');
const Ad = require('./models/Ad');

const app = express();

// Trust proxy - Required for Render (behind proxy) to make rate-limit work correctly
app.set('trust proxy', 1);

// ===== SECURITY MIDDLEWARE =====

// 1. Helmet - Security HTTP Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: [
                "'self'", "'unsafe-inline'", "'unsafe-eval'",
                "https://pagead2.googlesyndication.com",
                "https://googleads.g.doubleclick.net",
                "https://www.googletagservices.com",
                "https://adservice.google.com",
                "https://ep2.adtrafficquality.google",
                "https://*.googlesyndication.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers in HTML
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:"],
            frameSrc: [
                "'self'",
                "https://pagead2.googlesyndication.com",
                "https://googleads.g.doubleclick.net",
                "https://tpc.googlesyndication.com",
                "https://*.googlesyndication.com"
            ],
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 1.5 Compression - Reduce response size for faster loading
app.use(compression());

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

// 5.5 FORCE Redirect old domain to custom domain (Critical for SEO!)
// This ensures Google indexes badelwbi3.com NOT the Render URL
app.use((req, res, next) => {
    const host = req.get('host');

    // Redirect from ANY onrender.com domain to custom domain
    if (host && host.includes('onrender.com')) {
        const newUrl = `https://badelwbi3.com${req.originalUrl}`;

        // Add headers to tell Google this is permanent
        res.set('X-Robots-Tag', 'noindex, nofollow');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Location', newUrl);

        console.log(`🔄 SEO Redirect: ${host} → badelwbi3.com`);
        return res.status(301).end();
    }

    // For the main domain, ensure canonical is set
    if (host && (host.includes('badelwbi3.com') || host === 'localhost:3000')) {
        res.set('Link', '<https://badelwbi3.com/>; rel="canonical"');
    }

    next();
});

// 6. Body Parser with size limit (allow multiple base64 images)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
                // Skip sanitization for image data URLs (base64 images)
                if (obj[key].startsWith('data:image/')) {
                    continue; // Allow base64 images
                }
                // Remove potential XSS scripts
                obj[key] = obj[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .replace(/data:(?!image\/)/gi, 'data_blocked:'); // Block non-image data URLs
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
        // Short cache for JS files (5 minutes) - IMPORTANT for fast updates
        else if (filepath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
        }
        // Longer cache for CSS and images
        else if (filepath.endsWith('.css') || filepath.match(/\.(png|jpg|jpeg|gif|webp|ico)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        }
    }
}));

// Serve public folder (for ads-cache.json etc) with short cache
app.use('/public', express.static(path.join(__dirname, '..', 'public'), {
    setHeaders: (res, filepath) => {
        // Short cache for JSON cache files (2 minutes)
        if (filepath.endsWith('.json')) {
            res.setHeader('Cache-Control', 'public, max-age=120'); // 2 minutes
        }
    }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend with embedded initial ads for INSTANT loading
app.get('/', async (req, res) => {
    try {
        // Get initial ads from cache or database (fast)
        const { cache } = require('./routes/ads');
        let initialAds = [];

        if (cache.isValid && cache.isValid('ads') && cache.ads) {
            initialAds = cache.ads.slice(0, 8); // First 8 ads from cache
        } else {
            // Fetch from DB if no cache
            initialAds = await Ad.find({ status: 'approved' })
                .select('title description category subCategory price location whatsapp isFeatured createdAt images')
                .populate('user', 'name')
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(8)
                .lean();
        }

        // Read HTML file
        const htmlPath = path.join(__dirname, '..', 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Inject initial ads data as JSON in script tag (before closing body)
        const adsScript = `<script>window.__INITIAL_ADS__ = ${JSON.stringify(initialAds)};</script>`;
        html = html.replace('</body>', adsScript + '</body>');

        res.send(html);
    } catch (error) {
        // Fallback: just send the HTML file
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
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

// MongoDB Connection - optimized for Free Tier
mongoose.connect(MONGODB_URI, {
    // REDUCED for Free Tier - only 5 connections max
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,  // 10 seconds
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    // Retry options
    retryWrites: true,
    retryReads: true,
    w: 'majority'
});

// MongoDB connection event handlers
mongoose.connection.on('connected', async () => {
    console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بشكل آمن');

    // Initialize ads cache file for instant loading
    try {
        const { initializeCacheFile } = require('./routes/ads');
        await initializeCacheFile();
    } catch (error) {
        console.error('⚠️ Cache init error:', error.message);
    }
});

mongoose.connection.on('error', (err) => {
    console.error('❌ خطأ في MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ تم قطع الاتصال بـ MongoDB - جاري إعادة الاتصال...');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('👋 تم إغلاق اتصال MongoDB');
    process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
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
