const mongoose = require('mongoose');

const pricesSchema = new mongoose.Schema({
    goldOunce: {
        type: Number,
        default: 2750
    },
    goldLira: {
        type: Number,
        default: 580
    },
    silverOunce: {
        type: Number,
        default: 32
    },
    dollarRate: {
        type: Number,
        default: 89500
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: String,
        default: 'admin'
    }
}, { timestamps: true });

// Ensure only one prices document exists
pricesSchema.statics.getPrices = async function () {
    let prices = await this.findOne();
    if (!prices) {
        prices = await this.create({});
    }
    return prices;
};

module.exports = mongoose.model('Prices', pricesSchema);
