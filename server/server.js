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

// Middleware
app.use(cors());
app.use(express.json());
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
