const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'عنوان الإعلان مطلوب'],
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: [true, 'وصف الإعلان مطلوب'],
        maxlength: 1000
    },
    category: {
        type: String,
        required: [true, 'الفئة مطلوبة'],
        enum: ['home', 'cars', 'realestate', 'services', 'jobs', 'donations']
    },
    subCategory: {
        type: String,
        default: null
    },
    // Job-specific fields
    jobType: {
        type: String,
        enum: ['full-time', 'part-time', 'remote', 'freelance'],
        default: null
    },
    jobExperience: {
        type: String,
        enum: ['entry', 'mid', 'senior', 'any'],
        default: null
    },
    price: {
        type: String,
        required: [true, 'السعر مطلوب']
    },
    location: {
        type: String,
        required: [true, 'الموقع مطلوب']
    },
    whatsapp: {
        type: String,
        required: [true, 'رقم الواتساب مطلوب']
    },
    images: [{
        type: String
    }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNote: {
        type: String
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    views: {
        type: Number,
        default: 0
    },
    whatsappClicks: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Optimized Indexes for FAST queries
// Compound index for the main ads query (approved ads sorted by featured then date)
adSchema.index({ status: 1, isFeatured: -1, createdAt: -1 });

// Category filtering with status
adSchema.index({ category: 1, status: 1, createdAt: -1 });

// User's ads
adSchema.index({ user: 1, createdAt: -1 });

// Status only (for admin queries)
adSchema.index({ status: 1 });

// Text search index for search functionality
adSchema.index({ title: 'text', description: 'text', location: 'text' });

module.exports = mongoose.model('Ad', adSchema);
