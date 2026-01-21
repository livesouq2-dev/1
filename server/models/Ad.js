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
    }
}, {
    timestamps: true
});

// Index for faster queries
adSchema.index({ category: 1, status: 1 });
adSchema.index({ user: 1 });

module.exports = mongoose.model('Ad', adSchema);
