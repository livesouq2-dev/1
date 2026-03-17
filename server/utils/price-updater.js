const axios = require('axios');
const Prices = require('../models/Prices');

// Free APIs (no API key needed - lifetime free)
const GOLD_API = 'https://api.gold-api.com/price/XAU';
const SILVER_API = 'https://api.gold-api.com/price/XAG';
const DOLLAR_API = 'https://api.exchangerate-api.com/v4/latest/USD';

// Gold Lira: 8 grams, 21K purity (0.875), 1 ounce = 31.1 grams
const GOLD_LIRA_GRAMS = 8;
const OUNCE_TO_GRAMS = 31.1;

/**
 * Fetch gold price per ounce (USD)
 */
async function fetchGoldPrice() {
    try {
        const res = await axios.get(GOLD_API, { timeout: 10000 });
        if (res.data && res.data.price) {
            return Math.round(res.data.price * 100) / 100;
        }
    } catch (e) {
        console.log('⚠️ Gold API error:', e.message);
    }
    return null;
}

/**
 * Fetch silver price per ounce (USD)
 */
async function fetchSilverPrice() {
    try {
        const res = await axios.get(SILVER_API, { timeout: 10000 });
        if (res.data && res.data.price) {
            return Math.round(res.data.price * 100) / 100;
        }
    } catch (e) {
        console.log('⚠️ Silver API error:', e.message);
    }
    return null;
}

/**
 * Fetch USD to LBP rate
 */
async function fetchDollarRate() {
    try {
        const res = await axios.get(DOLLAR_API, { timeout: 10000 });
        if (res.data && res.data.rates && res.data.rates.LBP) {
            return res.data.rates.LBP;
        }
    } catch (e) {
        console.log('⚠️ Dollar API error:', e.message);
    }
    return null;
}

/**
 * Calculate gold lira price from ounce price
 * Lebanese formula: سعر أونصة ÷ 31.1 × 0.875 × 8 غرامات
 */
function calculateGoldLira(goldOuncePrice) {
    const goldLira = (goldOuncePrice / OUNCE_TO_GRAMS) * 0.875 * GOLD_LIRA_GRAMS;
    return Math.round(goldLira);
}

/**
 * Update all prices automatically
 */
async function updatePrices() {
    console.log('🔄 جاري تحديث الأسعار تلقائياً...');
    
    try {
        // Fetch all prices in parallel
        const [goldPrice, silverPrice, dollarRate] = await Promise.all([
            fetchGoldPrice(),
            fetchSilverPrice(),
            fetchDollarRate()
        ]);

        const updates = {};
        let updated = false;

        if (goldPrice) {
            updates.goldOunce = goldPrice;
            updates.goldLira = calculateGoldLira(goldPrice);
            updated = true;
            console.log(`   💰 الذهب: $${goldPrice}/أونصة | الليرة: $${updates.goldLira}`);
        }

        if (silverPrice) {
            updates.silverOunce = silverPrice;
            updated = true;
            console.log(`   🥈 الفضة: $${silverPrice}/أونصة`);
        }

        if (dollarRate) {
            updates.dollarRate = dollarRate;
            updated = true;
            console.log(`   💵 الدولار: ${dollarRate} ل.ل`);
        }

        if (updated) {
            updates.updatedAt = new Date();
            updates.updatedBy = 'auto';

            // Update or create prices document
            let prices = await Prices.findOne();
            if (prices) {
                Object.assign(prices, updates);
                await prices.save();
            } else {
                await Prices.create(updates);
            }

            console.log('✅ تم تحديث الأسعار بنجاح!');
            return updates;
        } else {
            console.log('⚠️ لم يتم تحديث أي سعر (جميع APIs فشلت)');
            return null;
        }
    } catch (error) {
        console.error('❌ خطأ في تحديث الأسعار:', error.message);
        return null;
    }
}

/**
 * Start auto-update interval (every hour)
 */
function startAutoUpdate(intervalMs = 60 * 60 * 1000) {
    // First update after 30 seconds (let server start first)
    setTimeout(() => {
        updatePrices();
    }, 30 * 1000);

    // Then update every hour
    setInterval(() => {
        updatePrices();
    }, intervalMs);

    console.log(`⏰ تحديث الأسعار التلقائي: كل ${intervalMs / 60000} دقيقة`);
}

module.exports = { updatePrices, startAutoUpdate };
