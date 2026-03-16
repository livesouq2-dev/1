const axios = require('axios');
const cheerio = require('cheerio');
const Ad = require('../models/Ad');

// OLX Lebanon URLs
const OLX_URLS = {
    jobs: 'https://www.olx.com.lb/en/jobs/',
    rentals: 'https://www.olx.com.lb/en/properties/apartments-villas-for-rent/'
};

// Headers to mimic a real browser
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
};

// Random delay between requests (2-5 seconds)
function randomDelay() {
    const ms = 2000 + Math.random() * 3000;
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract OLX ID from URL (e.g., ID116822345)
function extractOlxId(url) {
    const match = url.match(/ID(\d+)\.html/);
    return match ? `olx_${match[1]}` : null;
}

/**
 * Scrape ad listing page to get individual ad URLs
 */
async function scrapeListingPage(url) {
    try {
        console.log(`🔍 جاري سحب القائمة من: ${url}`);
        const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);
        
        const adLinks = [];
        
        // OLX uses various selectors for ad cards - try multiple patterns
        // Pattern 1: data-testid based links
        $('a[href*="/ad/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/ad/') && href.includes('ID')) {
                const fullUrl = href.startsWith('http') ? href : `https://www.olx.com.lb${href}`;
                if (!adLinks.includes(fullUrl)) {
                    adLinks.push(fullUrl);
                }
            }
        });
        
        console.log(`📋 تم العثور على ${adLinks.length} إعلان في الصفحة`);
        return adLinks.slice(0, 15); // Limit to 15 ads per category to avoid overload
    } catch (error) {
        console.error(`❌ خطأ في سحب القائمة: ${error.message}`);
        return [];
    }
}

/**
 * Scrape individual ad details
 */
async function scrapeAdDetails(url) {
    try {
        const sourceId = extractOlxId(url);
        if (!sourceId) return null;
        
        // Check if this ad already exists
        const existingAd = await Ad.findOne({ sourceId });
        if (existingAd) {
            console.log(`⏭️ إعلان موجود مسبقاً: ${sourceId}`);
            return null;
        }
        
        console.log(`📄 جاري سحب تفاصيل: ${url}`);
        const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);
        
        // Extract title
        let title = $('h1').first().text().trim();
        if (!title) title = $('[data-aut-id="itemTitle"]').text().trim();
        if (!title) title = $('title').text().split('|')[0].trim();
        
        // Extract description
        let description = '';
        $('[data-aut-id="itemDescriptionContent"]').each((i, el) => {
            description += $(el).text().trim() + ' ';
        });
        if (!description) {
            // Try other selectors
            description = $('[class*="Description"]').first().text().trim();
        }
        if (!description) {
            description = $('meta[name="description"]').attr('content') || '';
        }
        description = description.trim().substring(0, 1000);
        
        // Extract price
        let price = '';
        $('[data-aut-id="itemPrice"], [class*="price"], [class*="Price"]').each((i, el) => {
            const text = $(el).text().trim();
            if (text && (text.includes('USD') || text.includes('$') || text.match(/\d/))) {
                price = text;
                return false; // break
            }
        });
        if (!price) price = 'اتصل للسعر';
        
        // Extract location
        let location = '';
        $('[class*="ocation"], [data-aut-id="itemLocation"]').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 2) {
                location = text;
                return false;
            }
        });
        if (!location) {
            // Try breadcrumb location
            $('[class*="readcrumb"] a, [aria-label*="breadcrumb"] a').each((i, el) => {
                const text = $(el).text().trim();
                if (text && !text.includes('Home') && !text.includes('OLX') && text.length > 2) {
                    location = text;
                }
            });
        }
        if (!location) location = 'لبنان';
        
        // Extract phone/whatsapp - MULTIPLE STRATEGIES
        let whatsapp = '';
        
        // Strategy 1: Try OLX phone reveal API
        try {
            const adIdMatch = url.match(/ID(\d+)\.html/);
            if (adIdMatch) {
                const phoneRes = await axios.get(
                    `https://www.olx.com.lb/api/listing/${adIdMatch[1]}/contactInfo`,
                    { headers: { ...HEADERS, 'Referer': url }, timeout: 8000 }
                );
                if (phoneRes.data && phoneRes.data.phone) {
                    whatsapp = phoneRes.data.phone;
                    console.log(`📱 تم سحب الرقم من API: ${whatsapp}`);
                }
            }
        } catch (e) {
            // API might be protected, continue with other methods
        }

        // Strategy 2: Look for phone in __NEXT_DATA__ or embedded JSON
        if (!whatsapp) {
            $('script').each((i, el) => {
                const scriptContent = $(el).html() || '';
                // Look for __NEXT_DATA__ which often has phone info
                if (scriptContent.includes('__NEXT_DATA__') || scriptContent.includes('phoneNumber') || scriptContent.includes('phone_number')) {
                    // Try to extract phone from JSON in script tags
                    const phoneMatch = scriptContent.match(/"(?:phone|phoneNumber|phone_number|mobile|whatsapp)"[\s]*:[\s]*"([+\d\s\-()]{8,})"/i);
                    if (phoneMatch) {
                        whatsapp = phoneMatch[1].trim();
                        console.log(`📱 تم سحب الرقم من JSON: ${whatsapp}`);
                    }
                }
            });
        }

        // Strategy 3: Extract Lebanese phone numbers from description text
        if (!whatsapp && description) {
            // Lebanese phone patterns: +961, 03, 70, 71, 76, 78, 79, 81, etc.
            const phonePatterns = [
                /(?:\+961|00961)[\s\-]?(?:\d[\s\-]?){7,8}/g,       // +961 XX XXX XXX
                /(?:^|\s)(0[1-9][\s\-]?(?:\d[\s\-]?){6,7})(?:\s|$|[,.])/gm,  // 0X XXXXXXX
                /(?:^|\s)((?:70|71|76|78|79|81|03|06)\s?[\d\s\-]{6,8})(?:\s|$|[,.])/gm, // 7X XXXXXX
                /(?:whatsapp|واتس|واتساب|اتصل|call|phone|هاتف|رقم)[\s:]*([+\d\s\-()]{8,})/gi
            ];
            
            for (const pattern of phonePatterns) {
                const matches = description.match(pattern);
                if (matches && matches.length > 0) {
                    // Clean the match
                    whatsapp = matches[0].replace(/[^\d+]/g, '');
                    // Add +961 prefix if missing
                    if (whatsapp.length >= 7 && whatsapp.length <= 8 && !whatsapp.startsWith('+') && !whatsapp.startsWith('00')) {
                        whatsapp = '+961' + whatsapp;
                    } else if (whatsapp.startsWith('0') && whatsapp.length === 8) {
                        whatsapp = '+961' + whatsapp.substring(1);
                    }
                    console.log(`📱 تم سحب الرقم من الوصف: ${whatsapp}`);
                    break;
                }
            }
        }
        
        // Strategy 4: HTML tel: links
        if (!whatsapp) {
            $('[href*="tel:"]').each((i, el) => {
                const href = $(el).attr('href') || '';
                if (href.includes('tel:')) {
                    const num = href.replace('tel:', '').trim();
                    if (num.length >= 8) {
                        whatsapp = num;
                        return false;
                    }
                }
            });
        }

        // Strategy 5: Show OLX link so user can find the number
        if (!whatsapp) {
            whatsapp = 'انظر الإعلان الأصلي';
        }
        
        // Extract images
        let images = [];
        $('[class*="slider"] img, [class*="gallery"] img, [class*="image"] img, [data-aut-id*="image"] img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || '';
            if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('default')) {
                images.push(src);
            }
        });
        // Also try og:image
        if (images.length === 0) {
            const ogImage = $('meta[property="og:image"]').attr('content');
            if (ogImage && ogImage.startsWith('http')) {
                images.push(ogImage);
            }
        }
        images = images.slice(0, 5); // Max 5 images
        
        if (!title) {
            console.log(`⚠️ لم يتم العثور على عنوان للإعلان: ${url}`);
            return null;
        }
        
        // Skip ads without a valid phone number (must contain at least 7 digits)
        const digitCount = (whatsapp || '').replace(/[^\d]/g, '').length;
        if (digitCount < 7) {
            console.log(`⏭️ تخطي (بدون رقم واتساب): ${title}`);
            return null;
        }
        
        return {
            title: title.substring(0, 100),
            description: description || title,
            price,
            location,
            whatsapp,
            images,
            sourceId,
            sourceUrl: url
        };
    } catch (error) {
        console.error(`❌ خطأ في سحب التفاصيل: ${error.message}`);
        return null;
    }
}

/**
 * Map OLX job type to our format
 */
function mapJobType(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('full-time') || lower.includes('full time')) return 'full-time';
    if (lower.includes('part-time') || lower.includes('part time')) return 'part-time';
    if (lower.includes('remote')) return 'remote';
    if (lower.includes('freelance') || lower.includes('project')) return 'freelance';
    return null;
}

/**
 * Map OLX experience to our format
 */
function mapExperience(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('0-2') || lower.includes('entry') || lower.includes('junior')) return 'entry';
    if (lower.includes('2-5') || lower.includes('3-5') || lower.includes('mid')) return 'mid';
    if (lower.includes('5-10') || lower.includes('10+') || lower.includes('senior')) return 'senior';
    return 'any';
}

/**
 * Scrape jobs from OLX Lebanon
 */
async function scrapeJobs() {
    const adLinks = await scrapeListingPage(OLX_URLS.jobs);
    const results = { saved: 0, skipped: 0, errors: 0 };
    
    for (const link of adLinks) {
        try {
            await randomDelay();
            const adData = await scrapeAdDetails(link);
            
            if (!adData) {
                results.skipped++;
                continue;
            }
            
            const ad = new Ad({
                title: adData.title,
                description: adData.description,
                category: 'jobs',
                subCategory: null,
                jobType: mapJobType(adData.description),
                jobExperience: mapExperience(adData.description),
                price: adData.price,
                location: adData.location,
                whatsapp: adData.whatsapp,
                images: adData.images,
                source: 'olx',
                sourceId: adData.sourceId,
                sourceUrl: adData.sourceUrl,
                status: 'pending', // تحتاج موافقة الأدمن
                user: null
            });
            
            await ad.save();
            results.saved++;
            console.log(`✅ تم حفظ: ${adData.title}`);
        } catch (error) {
            if (error.code === 11000) {
                // Duplicate sourceId - already exists
                results.skipped++;
            } else {
                results.errors++;
                console.error(`❌ خطأ في حفظ الإعلان: ${error.message}`);
            }
        }
    }
    
    return results;
}

/**
 * Scrape rentals from OLX Lebanon
 */
async function scrapeRentals() {
    const adLinks = await scrapeListingPage(OLX_URLS.rentals);
    const results = { saved: 0, skipped: 0, errors: 0 };
    
    for (const link of adLinks) {
        try {
            await randomDelay();
            const adData = await scrapeAdDetails(link);
            
            if (!adData) {
                results.skipped++;
                continue;
            }
            
            const ad = new Ad({
                title: adData.title,
                description: adData.description,
                category: 'realestate',
                subCategory: 'rent',
                price: adData.price,
                location: adData.location,
                whatsapp: adData.whatsapp,
                images: adData.images,
                source: 'olx',
                sourceId: adData.sourceId,
                sourceUrl: adData.sourceUrl,
                status: 'pending', // تحتاج موافقة الأدمن
                user: null
            });
            
            await ad.save();
            results.saved++;
            console.log(`✅ تم حفظ: ${adData.title}`);
        } catch (error) {
            if (error.code === 11000) {
                results.skipped++;
            } else {
                results.errors++;
                console.error(`❌ خطأ في حفظ الإعلان: ${error.message}`);
            }
        }
    }
    
    return results;
}

/**
 * Run full scrape for both categories
 */
async function scrapeAll() {
    console.log('\n🚀 ═══════════════════════════════════');
    console.log('    بدء سحب إعلانات OLX Lebanon');
    console.log('═══════════════════════════════════\n');
    
    const startTime = Date.now();
    
    // Scrape jobs
    console.log('📌 ─── فرص العمل ───');
    const jobResults = await scrapeJobs();
    
    // Wait between categories
    await randomDelay();
    
    // Scrape rentals
    console.log('\n📌 ─── الشقق للإيجار ───');
    const rentalResults = await scrapeRentals();
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    
    const summary = {
        jobs: jobResults,
        rentals: rentalResults,
        total: {
            saved: jobResults.saved + rentalResults.saved,
            skipped: jobResults.skipped + rentalResults.skipped,
            errors: jobResults.errors + rentalResults.errors
        },
        duration: `${totalTime} ثانية`,
        scrapedAt: new Date().toISOString()
    };
    
    console.log('\n📊 ═══════════════════════════════════');
    console.log(`    ✅ تم حفظ: ${summary.total.saved} إعلان`);
    console.log(`    ⏭️ تم تخطي: ${summary.total.skipped} (موجود مسبقاً)`);
    console.log(`    ❌ أخطاء: ${summary.total.errors}`);
    console.log(`    ⏱️ المدة: ${summary.duration}`);
    console.log('═══════════════════════════════════\n');
    
    return summary;
}

module.exports = { scrapeAll, scrapeJobs, scrapeRentals };
