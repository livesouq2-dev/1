// ===== API Configuration =====
const API = '';  // Empty for same origin, or 'http://localhost:3000' for dev* 
const ADMIN_PHONE = '+961 71 163 211';
const APP_VERSION = '3.2.0'; // CACHE API - works on cloud platforms!

// ===== Automatic Cache Management =====
// This runs immediately and silently clears outdated cache for all users
(function autoCacheManager() {
    try {
        const lastVersion = localStorage.getItem('appVersion');

        // If version changed OR no version (old user), clear everything
        if (lastVersion !== APP_VERSION) {
            // List of ALL possible cache keys to clear (old and new)
            const cacheKeysToRemove = [
                'cachedAds',          // Old cache key
                'cachedAdsTime',      // Old cache time
                'cachedAllAds',       // New cache key
                'cachedAllAdsTime',   // New cache time
                'adsCache',           // Any other variations
                'adsCacheTime',
                'allAds',
                'allAdsTime'
            ];

            // Clear all cache keys silently
            cacheKeysToRemove.forEach(key => {
                try { localStorage.removeItem(key); } catch (e) { }
            });

            // Save new version to prevent repeated clearing
            localStorage.setItem('appVersion', APP_VERSION);

            // Log only in development
            if (window.location.hostname === 'localhost') {
                console.log('🔄 Cache cleared, updated to v' + APP_VERSION);
            }
        }
    } catch (e) {
        // Silently fail if localStorage is not available
    }
})();

// ===== Register Service Worker for Offline Support =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                // Silent success
            })
            .catch(err => {
                // Silent fail - SW not critical
            });
    });
}

// ===== Auth State =====
let token = localStorage.getItem('token');
let currentUser = null;

// ===== Theme Management =====
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.textContent = newTheme === 'dark' ? '🌙' : '☀️';
}

// ===== Track WhatsApp Click =====
function trackWhatsAppClick(adId) {
    // Send click tracking request (async, don't wait for response)
    fetch(`${API}/api/ads/${adId}/whatsapp-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).catch(() => { }); // Silent fail - don't block user if tracking fails
}

// ===== Load Public Stats (Users & Ads count) =====
async function loadStats() {
    try {
        const res = await fetch(`${API}/api/ads/stats`);
        const data = await res.json();
        const statUsers = document.getElementById('statUsers');
        const statAds = document.getElementById('statAds');
        if (statUsers && data.totalUsers) statUsers.textContent = data.totalUsers;
        if (statAds && data.totalAds) statAds.textContent = data.totalAds;
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

// ===== Load Gold, Silver & Dollar Prices from Backend =====
async function loadPrices() {
    try {
        const res = await fetch(`${API}/api/ads/prices`);
        if (res.ok) {
            const data = await res.json();

            // Update DOM with prices from database
            document.getElementById('goldPrice').textContent = `$${data.goldOunce?.toLocaleString() || '--'}`;
            document.getElementById('goldLiraPrice').textContent = `$${data.goldLira?.toLocaleString() || '--'}`;
            document.getElementById('silverPrice').textContent = `$${data.silverOunce?.toLocaleString() || '--'}`;
            document.getElementById('dollarPrice').textContent = `${data.dollarRate?.toLocaleString() || '--'} ل.ل`;

            // Update timestamp
            if (data.updatedAt) {
                const updateTime = new Date(data.updatedAt);
                const timeStr = updateTime.toLocaleDateString('ar-LB') + ' ' +
                    updateTime.toLocaleTimeString('ar-LB', { hour: '2-digit', minute: '2-digit' });
                document.getElementById('pricesUpdate').textContent = `آخر تحديث: ${timeStr}`;
            }
        }
    } catch (e) {
        console.log('Prices not available');
        document.getElementById('pricesUpdate').textContent = 'غير متوفر';
    }
}

// ===== Share Functions =====
function shareWhatsApp(title, url) {
    const text = encodeURIComponent(`شاهد هذا الإعلان: ${title}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

function shareFacebook(url) {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
}

function shareInstagram(title) {
    // Instagram doesn't have a web share API, so we copy the link and show a message
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('✅ تم نسخ الرابط!\\nافتح انستغرام وشارك الرابط في قصتك أو رسالة');
    });
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('✅ تم نسخ الرابط!');
    });
}

// ===== Image Gallery Navigation Functions =====
function changeGalleryImage(direction) {
    if (!window.galleryImages) return;
    window.galleryCurrentIndex += direction;

    // Loop around
    if (window.galleryCurrentIndex >= window.galleryImages.length) {
        window.galleryCurrentIndex = 0;
    } else if (window.galleryCurrentIndex < 0) {
        window.galleryCurrentIndex = window.galleryImages.length - 1;
    }

    setGalleryImage(window.galleryCurrentIndex);
}

function setGalleryImage(index) {
    if (!window.galleryImages || !window.galleryImages[index]) return;
    window.galleryCurrentIndex = index;

    // Update main image
    document.getElementById('galleryMainImg').src = window.galleryImages[index];
    document.getElementById('galleryIndex').textContent = index + 1;

    // Update thumbnail active state
    document.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

// ===== Image Compression Function - OPTIMIZED FOR FAST LOADING =====
// Compresses image to max 600x600 and 50% quality for FAST loading on slow internet
async function compressImage(file, maxWidth = 600, maxHeight = 600, quality = 0.5) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions - scale down more aggressively
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 with AGGRESSIVE compression (50% quality)
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== Handle Multiple Images Preview =====
document.getElementById('adImages')?.addEventListener('change', async function (e) {
    const files = Array.from(e.target.files).slice(0, 4); // Max 4 images
    const preview = document.getElementById('imagesPreview');
    preview.innerHTML = '';

    for (const file of files) {
        const compressed = await compressImage(file);
        const img = document.createElement('img');
        img.src = compressed;
        img.style.cssText = 'width: 100%; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid var(--glass-border);';
        preview.appendChild(img);
    }
});

// ===== Toggle Job Fields =====
function toggleJobFields() {
    const category = document.getElementById('adCategory')?.value;
    const jobFields = document.getElementById('jobFields');
    const titleLabel = document.getElementById('titleLabel');
    const priceLabel = document.getElementById('priceLabel');
    const descLabel = document.getElementById('descLabel');
    const adTitle = document.getElementById('adTitle');
    const adPrice = document.getElementById('adPrice');
    const adDescription = document.getElementById('adDescription');

    if (category === 'jobs') {
        // Show job fields
        if (jobFields) jobFields.style.display = 'block';
        // Update labels for job posting
        if (titleLabel) titleLabel.textContent = '💼 المسمى الوظيفي';
        if (priceLabel) priceLabel.textContent = '💰 الراتب';
        if (descLabel) descLabel.textContent = '📋 المتطلبات والوصف';
        // Update placeholders
        if (adTitle) adTitle.placeholder = 'مثال: مطلوب مبرمج Full-Stack';
        if (adPrice) adPrice.placeholder = 'مثال: $500-$1000 أو قابل للتفاوض';
        if (adDescription) adDescription.placeholder = 'المهارات المطلوبة، المسؤوليات، مزايا العمل...';
    } else {
        // Hide job fields
        if (jobFields) jobFields.style.display = 'none';
        // Reset labels
        if (titleLabel) titleLabel.textContent = 'عنوان الإعلان';
        if (priceLabel) priceLabel.textContent = 'السعر';
        if (descLabel) descLabel.textContent = 'الوصف';
        // Reset placeholders
        if (adTitle) adTitle.placeholder = 'مثال: سيارة BMW للبيع';
        if (adPrice) adPrice.placeholder = '$0.00';
        if (adDescription) adDescription.placeholder = 'أضف تفاصيل عن منتجك...';
    }
}

// ===== Sub-Categories Data (Lebanon-specific) =====
const subCategories = {
    cars: [
        { value: 'toyota', label: 'تويوتا' },
        { value: 'mercedes', label: 'مرسيدس' },
        { value: 'bmw', label: 'BMW' },
        { value: 'kia', label: 'كيا' },
        { value: 'hyundai', label: 'هيونداي' },
        { value: 'nissan', label: 'نيسان' },
        { value: 'honda', label: 'هوندا' },
        { value: 'chevrolet', label: 'شيفروليه' },
        { value: 'ford', label: 'فورد' },
        { value: 'audi', label: 'أودي' },
        { value: 'volkswagen', label: 'فولكسفاجن' },
        { value: 'renault', label: 'رينو' },
        { value: 'peugeot', label: 'بيجو' },
        { value: 'other_car', label: 'أخرى' }
    ],
    realestate: [
        { value: 'apartment_sale', label: 'شقة للبيع' },
        { value: 'apartment_rent', label: 'شقة للإيجار' },
        { value: 'villa', label: 'فيلا' },
        { value: 'land', label: 'أرض' },
        { value: 'office', label: 'مكتب' },
        { value: 'shop', label: 'محل تجاري' },
        { value: 'warehouse', label: 'مستودع' },
        { value: 'building', label: 'مبنى كامل' },
        { value: 'chalet', label: 'شاليه' }
    ],
    home: [
        { value: 'phones', label: '📱 هواتف' },
        { value: 'laptops', label: '💻 لابتوب' },
        { value: 'tablets', label: '📲 تابلت' },
        { value: 'tv', label: '📺 تلفزيون' },
        { value: 'appliances', label: '🏠 أجهزة منزلية' },
        { value: 'furniture', label: '🪑 أثاث' },
        { value: 'clothes', label: '👔 ملابس' },
        { value: 'accessories', label: '⌚ اكسسوارات' },
        { value: 'gaming', label: '🎮 ألعاب' },
        { value: 'other_product', label: 'أخرى' }
    ],
    services: [
        { value: 'electrical', label: '⚡ كهرباء' },
        { value: 'plumbing', label: '🔧 سباكة' },
        { value: 'moving', label: '🚚 نقل أثاث' },
        { value: 'cleaning', label: '🧹 تنظيف' },
        { value: 'car_repair', label: '🔧 صيانة سيارات' },
        { value: 'ac_repair', label: '❄️ تصليح مكيفات' },
        { value: 'painting', label: '🎨 دهان' },
        { value: 'carpentry', label: '🪚 نجارة' },
        { value: 'tutoring', label: '📚 دروس خصوصية' },
        { value: 'delivery', label: '📦 توصيل' },
        { value: 'other_service', label: 'أخرى' }
    ]
};

// ===== Update Sub-Categories Dropdown =====
function updateSubCategories() {
    const category = document.getElementById('adCategory')?.value;
    const subCategoryGroup = document.getElementById('subCategoryGroup');
    const subCategorySelect = document.getElementById('adSubCategory');

    if (!subCategoryGroup || !subCategorySelect) return;

    // Clear existing options
    subCategorySelect.innerHTML = '<option value="">اختر النوع</option>';

    // Check if category has subcategories
    if (subCategories[category]) {
        // Show the dropdown
        subCategoryGroup.style.display = 'block';

        // Add options
        subCategories[category].forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.value;
            option.textContent = sub.label;
            subCategorySelect.appendChild(option);
        });
    } else {
        // Hide for jobs and donations
        subCategoryGroup.style.display = 'none';
    }
}

// ===== Update Sub-Categories for Edit Modal =====
function updateEditSubCategories(selectedValue = '') {
    const category = document.getElementById('editAdCategory')?.value;
    const subCategoryGroup = document.getElementById('editSubCategoryGroup');
    const subCategorySelect = document.getElementById('editAdSubCategory');

    if (!subCategoryGroup || !subCategorySelect) return;

    // Clear existing options
    subCategorySelect.innerHTML = '<option value="">اختر النوع</option>';

    // Check if category has subcategories
    if (subCategories[category]) {
        // Show the dropdown
        subCategoryGroup.style.display = 'block';

        // Add options
        subCategories[category].forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.value;
            option.textContent = sub.label;
            if (sub.value === selectedValue) option.selected = true;
            subCategorySelect.appendChild(option);
        });
    } else {
        // Hide for jobs and donations
        subCategoryGroup.style.display = 'none';
    }
}

// ===== Show Ad Detail Modal =====
let allAdsData = []; // Store ads globally for detail view

function showAdDetail(adId) {
    const ad = allAdsData.find(a => a._id === adId);
    if (!ad) return;

    const categoryNames = {
        home: 'المنتجات والأجهزة',
        cars: 'سيارات',
        realestate: 'عقارات',
        services: 'خدمات',
        jobs: 'فرص العمل',
        donations: 'تبرعات'
    };

    const categoryIcons = {
        home: '📱',
        cars: '🚗',
        realestate: '🏗️',
        services: '🔧',
        jobs: '💼',
        donations: '💝'
    };

    const jobTypeNames = {
        'full-time': 'دوام كامل',
        'part-time': 'دوام جزئي',
        'remote': 'عن بُعد',
        'freelance': 'حر / مستقل'
    };

    const experienceNames = {
        'entry': 'مبتدئ (0-1 سنة)',
        'mid': 'متوسط (2-4 سنوات)',
        'senior': 'خبير (5+ سنوات)',
        'any': 'غير محدد'
    };

    // Build image gallery HTML
    let imagesHTML = '';
    if (ad.images && ad.images.length > 0) {
        if (ad.images.length === 1) {
            imagesHTML = `<img src="${ad.images[0]}" alt="${ad.title}" class="ad-detail-img">`;
        } else {
            // Multiple images - create gallery with navigation
            imagesHTML = `
                <div class="ad-gallery" id="adGallery">
                    <div class="gallery-main">
                        <img src="${ad.images[0]}" alt="${ad.title}" class="ad-detail-img" id="galleryMainImg">
                        <button class="gallery-nav gallery-prev" onclick="changeGalleryImage(-1)">❮</button>
                        <button class="gallery-nav gallery-next" onclick="changeGalleryImage(1)">❯</button>
                        <div class="gallery-counter"><span id="galleryIndex">1</span>/${ad.images.length}</div>
                    </div>
                    <div class="gallery-thumbs">
                        ${ad.images.map((img, i) => `
                            <img src="${img}" alt="صورة ${i + 1}" class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="setGalleryImage(${i})">
                        `).join('')}
                    </div>
                </div>
            `;
            // Store images globally for navigation
            window.galleryImages = ad.images;
            window.galleryCurrentIndex = 0;
        }
    }

    let detailHTML = `
        <div class="ad-detail">
            ${imagesHTML}
            <div class="ad-detail-header">
                <span class="ad-detail-category">${categoryIcons[ad.category] || '📦'} ${categoryNames[ad.category] || ad.category}</span>
                ${ad.isFeatured ? '<span class="badge gold">⭐ مميز</span>' : ''}
            </div>
            <h2 class="ad-detail-title">${ad.title}</h2>
            <div class="ad-detail-info">
                <div class="ad-detail-row">
                    <span>📍 الموقع:</span>
                    <strong>${ad.location}</strong>
                </div>
                <div class="ad-detail-row">
                    <span>${ad.category === 'jobs' ? '💰 الراتب:' : '💵 السعر:'}</span>
                    <strong class="price-highlight">${ad.price}</strong>
                </div>
    `;

    // Add job-specific fields for all job ads
    if (ad.category === 'jobs') {
        detailHTML += `
                <div class="ad-detail-row">
                    <span>⏰ نوع الوظيفة:</span>
                    <strong>${jobTypeNames[ad.jobType] || 'لم تُحدد'}</strong>
                </div>
                <div class="ad-detail-row">
                    <span>📊 الخبرة المطلوبة:</span>
                    <strong>${experienceNames[ad.jobExperience] || 'لم تُحدد'}</strong>
                </div>
        `;
    }

    detailHTML += `
            </div>
            <div class="ad-detail-description">
                <h4>${ad.category === 'jobs' ? '📋 المتطلبات والوصف:' : '📝 الوصف:'}</h4>
                <p>${ad.description || 'لا يوجد وصف'}</p>
            </div>
            ${ad.whatsapp ? `
                <a href="https://wa.me/${ad.whatsapp}?text=مرحباً، أنا مهتم بإعلانك: ${ad.title}" target="_blank" class="btn btn-primary ad-detail-whatsapp" onclick="trackWhatsAppClick('${ad._id}')">
                    💬 تواصل عبر واتساب
                </a>
            ` : ''}
        </div>
    `;

    document.getElementById('adDetailContent').innerHTML = detailHTML;
    openModal('adDetailModal');
}

// ===== Helper: Compress and Convert Image to Base64 - ULTRA OPTIMIZED =====
// Aggressive compression for fast loading on slow connections
function compressImageHelper(file, maxWidth = 500, quality = 0.4) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Aggressive resize - max 500px any dimension
                const maxDimension = maxWidth;
                if (width > height && width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                // Use better image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP if supported (smaller), fallback to JPEG
                let compressedBase64;
                if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
                    compressedBase64 = canvas.toDataURL('image/webp', quality);
                } else {
                    compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                }

                // Log compression result (dev only)
                if (window.location.hostname === 'localhost') {
                    const originalSize = Math.round(file.size / 1024);
                    const compressedSize = Math.round((compressedBase64.length * 3 / 4) / 1024);
                    console.log(`📦 Image: ${originalSize}KB → ${compressedSize}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% smaller)`);
                }

                resolve(compressedBase64);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ===== Image Preview =====
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('adImage');
    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const preview = document.getElementById('imagePreview');
                const previewImg = document.getElementById('previewImg');
                const base64 = await compressImage(file);
                previewImg.src = base64;
                preview.style.display = 'block';
            }
        });
    }
});

// ===== DOM Elements =====
const header = document.getElementById('header');
const mobileMenu = document.getElementById('mobileMenu');
const navLinks = document.getElementById('navLinks');
const navActions = document.getElementById('navActions');
const userMenu = document.getElementById('userMenu');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const postAdBtn = document.getElementById('postAdBtn');
const ctaBtn = document.getElementById('ctaBtn');
const listingsGrid = document.getElementById('listingsGrid');
const tabs = document.querySelectorAll('.tab');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadAds();
    loadStats(); // Load users & ads count
    loadPrices(); // Load gold, silver & dollar prices
    setupEventListeners();
});

// ===== Auth Functions =====
async function checkAuth() {
    if (!token) {
        showLoggedOut();
        return;
    }
    try {
        const res = await fetch(`${API}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.user) {
            currentUser = data.user;
            showLoggedIn();
        } else {
            logout();
        }
    } catch (e) {
        showLoggedOut();
    }
}

function showLoggedIn() {
    navActions.classList.add('hidden');
    userMenu.classList.remove('hidden');
    document.getElementById('userName').textContent = `مرحباً، ${currentUser.name}`;
}

function showLoggedOut() {
    navActions.classList.remove('hidden');
    userMenu.classList.add('hidden');
    currentUser = null;
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    showLoggedOut();
}

// ===== Load Ads from API - ULTRA FAST FOR SLOW CONNECTIONS =====
// Priority: 1) Server-embedded ads (instant), 2) LocalStorage cache, 3) Fetch from API
async function loadAds(category = 'all', subCategory = null, retryCount = 0) {
    const cacheKey = 'cachedAllAds';
    const cacheTimeKey = 'cachedAllAdsTime';
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
    const MAX_RETRIES = 3;
    const FETCH_TIMEOUT = 20000; // 20 seconds

    // Helper function to filter and render ads
    const filterAndRender = (ads, cat, subCat) => {
        if (!ads || !listingsGrid) return 0;

        let filteredAds = [...ads]; // Create copy

        // Filter by main category
        if (cat && cat !== 'all') {
            filteredAds = filteredAds.filter(ad => ad.category === cat);
        }

        // Filter by subcategory
        if (subCat) {
            filteredAds = filteredAds.filter(ad => ad.subCategory === subCat);
        }

        // Render results
        if (filteredAds.length > 0) {
            renderAds(filteredAds);
        } else if (cat !== 'all') {
            listingsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📭 لا توجد إعلانات لهذه الفئة حالياً</p>
                    <button class="btn btn-outline" onclick="loadAds('all')" style="margin-top: 10px;">عرض كل الإعلانات</button>
                </div>
            `;
        } else {
            listingsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📭 لا توجد إعلانات حالياً</p>
                    <p>كن أول من ينشر إعلان!</p>
                </div>
            `;
        }

        return filteredAds.length;
    };

    // Track if we have any cached data to show
    let hasCachedData = false;

    // ===== STEP 0: SHOW PLACEHOLDER ADS INSTANTLY =====
    // These show immediately while real ads load
    const placeholderAds = [
        { _id: 'p1', title: 'جاري التحميل...', description: 'يتم تحميل الإعلانات الآن', category: 'cars', price: '---', location: 'لبنان', images: [], isPlaceholder: true },
        { _id: 'p2', title: 'جاري التحميل...', description: 'يتم تحميل الإعلانات الآن', category: 'home', price: '---', location: 'لبنان', images: [], isPlaceholder: true },
        { _id: 'p3', title: 'جاري التحميل...', description: 'يتم تحميل الإعلانات الآن', category: 'realestate', price: '---', location: 'لبنان', images: [], isPlaceholder: true },
        { _id: 'p4', title: 'جاري التحميل...', description: 'يتم تحميل الإعلانات الآن', category: 'services', price: '---', location: 'لبنان', images: [], isPlaceholder: true }
    ];

    // ===== STEP 1: CHECK FOR SERVER-EMBEDDED ADS (INSTANT!) =====
    if (window.__INITIAL_ADS__ && window.__INITIAL_ADS__.length > 0) {
        // Server embedded ads - show INSTANTLY
        hasCachedData = true;
        allAdsData = window.__INITIAL_ADS__;
        filterAndRender(window.__INITIAL_ADS__, category, subCategory);
        updateCategoryCounts(window.__INITIAL_ADS__);
        // Clear the embedded data after first use
        delete window.__INITIAL_ADS__;
    }

    // ===== STEP 1.5: LOAD FROM CACHE API (INSTANT!) =====
    // This API returns cached ads from server memory (works on cloud platforms)
    if (!hasCachedData) {
        try {
            const cacheResponse = await fetch(`${API}/api/ads/cache`, {
                headers: { 'Accept': 'application/json' }
            });
            if (cacheResponse.ok) {
                const cacheData = await cacheResponse.json();
                if (cacheData.ads && cacheData.ads.length > 0) {
                    hasCachedData = true;
                    allAdsData = cacheData.ads;
                    filterAndRender(cacheData.ads, category, subCategory);
                    updateCategoryCounts(cacheData.ads);

                    // Save to localStorage for offline use
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(cacheData.ads));
                        localStorage.setItem(cacheTimeKey, Date.now().toString());
                    } catch (e) { /* localStorage full */ }

                    console.log(`📦 Loaded ${cacheData.ads.length} ads from cache`);
                    return; // All ads loaded, no need to fetch from main API
                }
            }
        } catch (e) {
            // Cache API not available, continue with other methods
            console.log('📦 Cache API not available, loading from main API...');
        }
    }

    // ===== STEP 2: SHOW CACHED ADS (even if old) =====
    let cacheIsFresh = false;

    try {
        const cachedAds = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(cacheTimeKey);

        if (cachedAds) {
            const ads = JSON.parse(cachedAds);

            if (ads && ads.length > 0) {
                // Only update if we have more ads than embedded
                if (!hasCachedData || ads.length > allAdsData.length) {
                    hasCachedData = true;
                    allAdsData = ads;
                    filterAndRender(ads, category, subCategory);
                    updateCategoryCounts(ads);
                }

                // Check if cache is fresh
                if (cachedTime) {
                    const age = Date.now() - parseInt(cachedTime);
                    if (age < CACHE_DURATION) {
                        cacheIsFresh = true;
                        // Cache is fresh, no need to fetch
                        return;
                    }
                }
                // Cache is old but we showed it - now fetch in background silently
            }
        }
    } catch (e) {
        // Ignore cache errors
    }

    // ===== STEP 3: SHOW PLACEHOLDER CARDS (only if no cache) =====
    if (!hasCachedData && listingsGrid) {
        // Show placeholder cards that look like real ads but are loading
        renderAds(placeholderAds);
    }

    // ===== STEP 3: FETCH FROM SERVER (background for cached, foreground for new) =====
    try {
        const url = `${API}/api/ads`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (data.ads && data.ads.length > 0) {
            // Save to cache
            try {
                localStorage.setItem(cacheKey, JSON.stringify(data.ads));
                localStorage.setItem(cacheTimeKey, Date.now().toString());
            } catch (e) {
                // Storage full - clear and retry
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimeKey);
            }

            allAdsData = data.ads;
            filterAndRender(data.ads, category, subCategory);
            updateCategoryCounts(data.ads);

        } else if (!hasCachedData) {
            listingsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📭 لا توجد إعلانات حالياً</p>
                    <p>كن أول من ينشر إعلان!</p>
                </div>
            `;
        }
    } catch (e) {
        // Retry only if no cached data shown
        if (!hasCachedData && retryCount < MAX_RETRIES) {
            setTimeout(() => loadAds(category, subCategory, retryCount + 1), 2000 * (retryCount + 1));
            return;
        }

        // Show error only if no cached ads
        if (!hasCachedData && listingsGrid) {
            listingsGrid.innerHTML = `
                <div class="empty-state">
                    <p>⚠️ تعذر تحميل الإعلانات</p>
                    <button class="btn btn-primary" onclick="loadAds('${category}')" style="margin-top: 10px;">🔄 إعادة المحاولة</button>
                </div>
            `;
        }
        // If we have cached data, user already sees ads - no need to show error
    }
}

// ===== Force Refresh Ads (clear cache and reload) =====
function refreshAds() {
    localStorage.removeItem('cachedAllAds');
    localStorage.removeItem('cachedAllAdsTime');
    loadAds('all');
}


function renderAds(ads) {
    const categoryIcons = {
        home: '📱',
        cars: '🚗',
        realestate: '🏗️',
        services: '🔧',
        jobs: '💼',
        donations: '💝'
    };
    const categoryNames = {
        home: 'المنتجات والأجهزة',
        cars: 'سيارات',
        realestate: 'عقارات',
        services: 'خدمات',
        jobs: 'فرص العمل',
        donations: 'تبرعات'
    };

    // Get favorites from localStorage
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    listingsGrid.innerHTML = ads.map((ad, index) => {
        // Check if this is a placeholder ad
        if (ad.isPlaceholder) {
            return `
                <article class="listing-card placeholder-card animate-fadeInUp" style="animation-delay: ${index * 0.1}s">
                    <div class="listing-img">
                        <div class="skeleton skeleton-image" style="height: 200px; display: flex; align-items: center; justify-content: center;">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                    <div class="listing-info">
                        <span class="cat">${categoryIcons[ad.category] || '📦'} ${categoryNames[ad.category] || ad.category}</span>
                        <h3 class="skeleton-text" style="background: var(--glass); height: 20px; border-radius: 4px;"></h3>
                        <p class="skeleton-text" style="background: var(--glass); height: 16px; width: 60%; border-radius: 4px;"></p>
                    </div>
                </article>
            `;
        }

        // Regular ad
        return `
        <article class="listing-card ${ad.isFeatured ? 'featured' : ''} animate-fadeInUp" data-category="${ad.category}" data-id="${ad._id}" style="animation-delay: ${index * 0.1}s">
            <div class="listing-img" onclick="showAdDetail('${ad._id}')" style="cursor: pointer;">
                <img src="${ad.images && ad.images[0] ? ad.images[0] : 'https://via.placeholder.com/400x250?text=' + encodeURIComponent(ad.title)}" alt="${ad.title}" loading="lazy">
                <span class="click-hint">👆 اضغط للتفاصيل</span>
                ${ad.isFeatured ? '<span class="badge gold animate-pulse">⭐ مميز</span>' : '<span class="badge">✨ جديد</span>'}
                <button class="fav-btn ${favorites.includes(ad._id) ? 'active' : ''}" onclick="toggleFavorite('${ad._id}', this)" title="إضافة للمفضلة">
                    ${favorites.includes(ad._id) ? '❤️' : '🤍'}
                </button>
                <div class="share-dropdown">
                    <button class="share-btn" onclick="this.parentElement.classList.toggle('active')" title="مشاركة">📤</button>
                    <div class="share-menu">
                        <button onclick="shareWhatsApp('${ad.title}', window.location.href)">💬 واتساب</button>
                        <button onclick="shareFacebook(window.location.href)">📘 فيسبوك</button>
                        <button onclick="shareInstagram('${ad.title}')">📸 انستغرام</button>
                        <button onclick="copyLink(window.location.href)">📋 نسخ الرابط</button>
                    </div>
                </div>
            </div>
            <div class="listing-info">
                <span class="cat">${categoryIcons[ad.category] || '📦'} ${categoryNames[ad.category] || ad.category}</span>
                <h3>${ad.title}</h3>
                <p class="listing-location">📍 ${ad.location}</p>
                <p class="listing-description">${ad.description ? (ad.description.length > 150 ? ad.description.substring(0, 150) + '...' : ad.description) : ''}</p>
                <div class="listing-footer">
                    <div class="price">${ad.price && !ad.price.includes('$') && !isNaN(ad.price) ? '$' + ad.price : ad.price}</div>
                </div>
                ${ad.whatsapp ? `<a href="https://wa.me/${ad.whatsapp}?text=مرحباً، أنا مهتم بإعلانك: ${ad.title}" target="_blank" class="listing-whatsapp">💬 تواصل واتساب</a>` : ''}
                </div>
            </div>
        </article>
    `;
    }).join('');

    // Update stats - only count real ads, not placeholders
    const realAds = ads.filter(ad => !ad.isPlaceholder);
    if (realAds.length > 0) {
        document.getElementById('statAds').textContent = realAds.length;
    }
}

function updateCategoryCounts(ads) {
    const counts = { home: 0, cars: 0, realestate: 0, services: 0, jobs: 0 };
    ads.forEach(ad => {
        if (counts[ad.category] !== undefined) counts[ad.category]++;
    });
    document.getElementById('countHome').textContent = `${counts.home} إعلان`;
    document.getElementById('countCars').textContent = `${counts.cars} إعلان`;
    document.getElementById('countRealestate').textContent = `${counts.realestate} إعلان`;
    document.getElementById('countServices').textContent = `${counts.services} إعلان`;
    document.getElementById('countJobs').textContent = `${counts.jobs} إعلان`;
}

// ===== Modal Functions =====
function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

function switchModal(toId) {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    openModal(toId);
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Header scroll
    window.addEventListener('scroll', () => {
        header.style.background = window.pageYOffset > 100 ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.9)';
    });

    // Mobile menu
    mobileMenu?.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenu.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
    });

    // Login button
    loginBtn?.addEventListener('click', () => openModal('loginModal'));

    // Logout
    logoutBtn?.addEventListener('click', logout);

    // Theme Toggle
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    // Set initial theme icon
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

    // Post ad buttons
    postAdBtn?.addEventListener('click', () => {
        if (!token) {
            alert('يجب تسجيل الدخول أولاً');
            openModal('loginModal');
        } else {
            openModal('postAdModal');
        }
    });
    ctaBtn?.addEventListener('click', () => {
        if (!token) openModal('loginModal');
        else openModal('postAdModal');
    });

    // Category tabs with dropdown support
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const parent = tab.closest('.tab-dropdown');
            const submenu = parent?.querySelector('.tab-submenu');

            // Toggle submenu if tab has one
            if (submenu) {
                e.stopPropagation();
                // Close other submenus
                document.querySelectorAll('.tab-submenu.active').forEach(s => {
                    if (s !== submenu) s.classList.remove('active');
                });
                submenu.classList.toggle('active');
            }

            // Set active state and load ads
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadAds(tab.dataset.tab);
        });
    });

    // Subcategory buttons click handler
    document.querySelectorAll('.tab-submenu button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const subCategory = btn.dataset.sub;
            const parentTab = btn.closest('.tab-dropdown').querySelector('.tab');
            const category = parentTab.dataset.tab;

            // Update active states
            document.querySelectorAll('.tab-submenu button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabs.forEach(t => t.classList.remove('active'));
            parentTab.classList.add('active');

            // Close submenu
            btn.closest('.tab-submenu').classList.remove('active');

            // Load filtered ads - if "all_*" then show all ads in category
            const filterSub = subCategory.startsWith('all_') ? null : subCategory;
            loadAds(category, filterSub);
        });
    });

    // Close submenus when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.tab-submenu.active').forEach(s => s.classList.remove('active'));
    });

    // Category cards
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.dataset.cat;
            document.querySelector(`[data-tab="${cat}"]`)?.click();
            document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Modal overlays
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            document.body.style.overflow = '';
        });
    });

    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.token) {
                token = data.token;
                localStorage.setItem('token', token);
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userJoinDate', data.user.createdAt ? new Date(data.user.createdAt).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG'));
                currentUser = data.user;
                showLoggedIn();
                closeModal('loginModal');
                alert(`مرحباً ${data.user.name}! ✅`);
            } else {
                alert(data.message || 'خطأ في تسجيل الدخول');
            }
        } catch (e) {
            alert('خطأ في الاتصال بالسيرفر');
        }
    });

    // Register form
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const phone = document.getElementById('regPhone').value;
        const password = document.getElementById('regPassword').value;
        try {
            const res = await fetch(`${API}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, password })
            });
            const data = await res.json();
            if (data.token) {
                token = data.token;
                localStorage.setItem('token', token);
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userName', name);
                localStorage.setItem('userJoinDate', new Date().toLocaleDateString('ar-EG'));
                currentUser = data.user;
                showLoggedIn();
                closeModal('registerModal');
                alert(`مرحباً ${data.user.name}! تم إنشاء حسابك بنجاح ✅`);
            } else {
                alert(data.message || 'خطأ في إنشاء الحساب');
            }
        } catch (e) {
            alert('خطأ في الاتصال بالسيرفر');
        }
    });

    // Post ad form
    document.getElementById('adForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get up to 4 images as compressed base64
        let imagesBase64 = [];
        const imageFiles = document.getElementById('adImages')?.files;

        // DEBUG: Log image file info
        console.log('📷 Image files selected:', imageFiles ? imageFiles.length : 0);

        if (imageFiles && imageFiles.length > 0) {
            const filesToProcess = Array.from(imageFiles).slice(0, 4); // Max 4 images
            console.log('📷 Processing', filesToProcess.length, 'files');

            for (const file of filesToProcess) {
                console.log('📷 Compressing:', file.name, 'Size:', file.size);
                try {
                    const compressed = await compressImage(file);
                    console.log('📷 Compressed to:', compressed ? compressed.length : 0, 'chars');
                    imagesBase64.push(compressed);
                } catch (err) {
                    console.error('❌ Compression error:', err);
                }
            }
        }

        console.log('📷 Total images to send:', imagesBase64.length);
        if (imagesBase64.length > 0) {
            console.log('📷 First image preview:', imagesBase64[0].substring(0, 100) + '...');
        }

        const category = document.getElementById('adCategory').value;
        const subCategory = document.getElementById('adSubCategory')?.value || null;
        const adData = {
            title: document.getElementById('adTitle').value,
            category: category,
            subCategory: subCategory,
            price: document.getElementById('adPrice').value,
            location: document.getElementById('adLocation').value,
            whatsapp: document.getElementById('adWhatsapp').value,
            images: imagesBase64,
            description: document.getElementById('adDescription').value
        };

        console.log('📤 Sending ad with', adData.images.length, 'images');

        // Add job-specific fields if category is jobs
        if (category === 'jobs') {
            adData.jobType = document.getElementById('jobType')?.value || null;
            adData.jobExperience = document.getElementById('jobExperience')?.value || null;
        }
        try {
            const res = await fetch(`${API}/api/ads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(adData)
            });
            const data = await res.json();
            if (data.status === 'success') {
                closeModal('postAdModal');
                // Show success modal with WhatsApp button
                openModal('successModal');
                document.getElementById('adForm').reset();
            } else {
                alert(data.message || 'خطأ في نشر الإعلان');
            }
        } catch (e) {
            alert('خطأ في الاتصال بالسيرفر');
        }
    });

    // Footer My Ads link
    document.getElementById('footerMyAds')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!token) {
            alert('يجب تسجيل الدخول أولاً');
            openModal('loginModal');
        } else {
            openModal('myAdsModal');
            loadMyAds();
        }
    });

    // Footer Post Ad link
    document.getElementById('footerPostAd')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!token) {
            alert('يجب تسجيل الدخول أولاً');
            openModal('loginModal');
        } else {
            openModal('postAdModal');
        }
    });

    // Footer Help link
    document.getElementById('footerHelp')?.addEventListener('click', (e) => {
        e.preventDefault();
        openModal('helpModal');
    });

    // Footer Terms link
    document.getElementById('footerTerms')?.addEventListener('click', (e) => {
        e.preventDefault();
        openModal('termsModal');
    });

    // Profile Button (Nav Menu)
    document.getElementById('navProfileBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!token) {
            alert('يجب تسجيل الدخول أولاً');
            openModal('loginModal');
        } else {
            openModal('profileModal');
            loadProfile();
        }
    });

    // Edit Ad Form
    document.getElementById('editAdForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adId = document.getElementById('editAdId').value;
        const adData = {
            title: document.getElementById('editAdTitle').value,
            category: document.getElementById('editAdCategory').value,
            subCategory: document.getElementById('editAdSubCategory')?.value || null,
            price: document.getElementById('editAdPrice').value,
            location: document.getElementById('editAdLocation').value,
            description: document.getElementById('editAdDescription').value
        };
        try {
            const res = await fetch(`${API}/api/ads/${adId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(adData)
            });
            const data = await res.json();
            if (data.ad) {
                alert('✅ ' + data.message);
                closeModal('editAdModal');
                loadMyAds();
            } else {
                alert(data.message || 'خطأ في تعديل الإعلان');
            }
        } catch (e) {
            alert('خطأ في الاتصال بالسيرفر');
        }
    });
}

// ===== Load My Ads =====
async function loadMyAds() {
    const container = document.getElementById('myAdsContainer');
    container.innerHTML = '<div class="loading-state">🔄 جاري التحميل...</div>';
    try {
        const res = await fetch(`${API}/api/ads/my-ads`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.ads && data.ads.length > 0) {
            renderMyAds(data.ads);
        } else {
            container.innerHTML = '<div class="empty-state">📭 لا توجد لديك إعلانات<br><br><button class="btn btn-primary" onclick="closeModal(\'myAdsModal\'); openModal(\'postAdModal\');">+ أضف إعلانك الأول</button></div>';
        }
    } catch (e) {
        container.innerHTML = '<div class="empty-state">⚠️ تعذر تحميل الإعلانات</div>';
    }
}

function renderMyAds(ads) {
    const statusLabels = { pending: '⏳ بانتظار الموافقة', approved: '✅ موافق عليه', rejected: '❌ مرفوض' };
    const statusColors = { pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444' };
    const categoryNames = { home: 'المنتجات والأجهزة', cars: 'سيارات', realestate: 'عقارات', services: 'خدمات' };

    document.getElementById('myAdsContainer').innerHTML = `
        <div class="my-ads-list">
            ${ads.map(ad => `
                <div class="my-ad-card">
                    <div class="my-ad-info">
                        <h4>${ad.title}</h4>
                        <p>${categoryNames[ad.category] || ad.category} • ${ad.price}</p>
                        <span class="ad-status" style="color:${statusColors[ad.status]}">${statusLabels[ad.status]}</span>
                    </div>
                    <div class="my-ad-actions">
                        <button class="btn-edit" onclick="openEditAd('${ad._id}', '${ad.title}', '${ad.category}', '${ad.price}', '${ad.location}', '${ad.description || ''}', '${ad.subCategory || ''}')">✏️ تعديل</button>
                        <button class="btn-delete" onclick="deleteMyAd('${ad._id}')">🗑️ حذف</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Open Edit Ad Modal
function openEditAd(id, title, category, price, location, description, subCategory) {
    document.getElementById('editAdId').value = id;
    document.getElementById('editAdTitle').value = title;
    document.getElementById('editAdCategory').value = category;
    document.getElementById('editAdPrice').value = price;
    document.getElementById('editAdLocation').value = location;
    document.getElementById('editAdDescription').value = description;
    updateEditSubCategories(subCategory || '');
    closeModal('myAdsModal');
    openModal('editAdModal');
}

// Delete Ad
async function deleteMyAd(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
    try {
        const res = await fetch(`${API}/api/ads/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert('✅ ' + data.message);
        loadMyAds();
    } catch (e) {
        alert('خطأ في حذف الإعلان');
    }
}

// ===== FAVORITES FEATURE =====
function toggleFavorite(adId, btn) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    if (favorites.includes(adId)) {
        favorites = favorites.filter(id => id !== adId);
        btn.innerHTML = '🤍';
        btn.classList.remove('active');
    } else {
        favorites.push(adId);
        btn.innerHTML = '❤️';
        btn.classList.add('active');
        // Add pulse animation
        btn.style.animation = 'pulse 0.3s ease';
        setTimeout(() => btn.style.animation = '', 300);
    }

    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// ===== LOAD PROFILE =====
async function loadProfile() {
    // Get user info from localStorage
    const userName = localStorage.getItem('userName') || 'مستخدم';
    const userEmail = localStorage.getItem('userEmail') || '-';
    const joinDate = localStorage.getItem('userJoinDate') || new Date().toLocaleDateString('ar-EG');

    // Set profile info
    document.getElementById('profileName').textContent = userName;
    document.getElementById('profileEmail').textContent = userEmail;
    document.getElementById('profileDate').textContent = joinDate;
    document.getElementById('profileAvatar').textContent = userName.charAt(0).toUpperCase() || '👤';

    // Get favorites count
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    document.getElementById('profileFavsCount').textContent = favorites.length;

    // Get ads count
    try {
        const res = await fetch(`${API}/api/ads/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        document.getElementById('profileAdsCount').textContent = data.ads?.length || 0;
    } catch (e) {
        document.getElementById('profileAdsCount').textContent = '0';
    }
}

// ===== CSS for new elements =====
const style = document.createElement('style');
style.textContent = `
    /* ===== SMOOTH ANIMATIONS ===== */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    
    /* Apply animations to elements */
    .hero-content { animation: fadeInUp 0.8s ease-out; }
    .category-card { animation: fadeInUp 0.6s ease-out backwards; }
    .category-card:nth-child(1) { animation-delay: 0.1s; }
    .category-card:nth-child(2) { animation-delay: 0.2s; }
    .category-card:nth-child(3) { animation-delay: 0.3s; }
    .category-card:nth-child(4) { animation-delay: 0.4s; }
    .listing-card { animation: fadeInUp 0.5s ease-out backwards; }
    .pricing-card { animation: fadeInUp 0.6s ease-out backwards; }
    .pricing-card:nth-child(1) { animation-delay: 0.1s; }
    .pricing-card:nth-child(2) { animation-delay: 0.2s; }
    
    /* Smooth hover effects */
    .listing-card { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .listing-card:hover { transform: translateY(-10px) scale(1.02); box-shadow: 0 20px 40px rgba(99, 102, 241, 0.2); }
    .category-card { transition: all 0.3s ease; }
    .category-card:hover { transform: translateY(-8px); box-shadow: 0 15px 30px rgba(0,0,0,0.3); }
    .btn { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .btn:hover { transform: translateY(-3px); }
    .btn:active { transform: translateY(-1px); }
    .tab { transition: all 0.3s ease; }
    .tab:hover { transform: translateY(-2px); }
    
    /* Loading shimmer effect */
    .loading-shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
    
    /* Smooth scroll behavior */
    html { scroll-behavior: smooth; }
    
    /* Focus states for accessibility */
    .btn:focus, .tab:focus, input:focus, textarea:focus, select:focus { outline: 2px solid var(--primary); outline-offset: 2px; }
    
    /* Favorites Button */
    .fav-btn { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.2rem; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(5px); z-index: 10; }
    .fav-btn:hover { background: rgba(0,0,0,0.7); transform: scale(1.1); }
    .fav-btn.active { background: rgba(239, 68, 68, 0.8); }
    .listing-img { position: relative; }
    
    .hidden { display: none !important; }
    .user-menu { display: flex; align-items: center; gap: 15px; }
    .user-menu span { color: var(--secondary); font-weight: 600; }
    .modal-switch { text-align: center; margin-top: 20px; color: var(--text-muted); }
    .modal-switch a { color: var(--primary); }
    .empty-state { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted); }
    
    /* Favorites List */
    .favorites-list { max-height: 60vh; overflow-y: auto; }
    .fav-card { display: flex; align-items: center; gap: 15px; padding: 15px; margin-bottom: 10px; background: rgba(255,255,255,0.05); border-radius: 12px; transition: all 0.3s ease; }
    .fav-card:hover { background: rgba(255,255,255,0.1); transform: translateX(-5px); }
    .fav-card img { width: 80px; height: 80px; object-fit: cover; border-radius: 10px; }
    .fav-info { flex: 1; }
    .fav-info h4 { margin: 0 0 5px 0; font-size: 1rem; }
    .fav-info p { margin: 0 0 5px 0; font-size: 0.85rem; color: var(--text-muted); }
    .fav-price { color: var(--secondary); font-weight: 700; font-size: 1.1rem; }
    .fav-actions { display: flex; flex-direction: column; gap: 8px; }
    .btn-sm { padding: 6px 12px !important; font-size: 0.8rem !important; }
    .loading-state { text-align: center; padding: 40px; color: var(--text-muted); }
    
    /* Profile Modal */
    .profile-content { text-align: center; }
    .profile-avatar { margin-bottom: 20px; }
    .avatar-circle { width: 80px; height: 80px; background: var(--gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto; color: white; font-weight: 700; }
    .profile-info { margin-bottom: 25px; }
    .profile-field { margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 10px; }
    .profile-field label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 5px; }
    .profile-field p { margin: 0; font-size: 1rem; color: var(--text); font-weight: 600; }
    .profile-stats { display: flex; justify-content: center; gap: 40px; margin-bottom: 25px; padding: 20px; background: rgba(99, 102, 241, 0.1); border-radius: 15px; }
    .profile-stat { text-align: center; }
    .profile-stat .stat-value { display: block; font-size: 2.5rem; font-weight: 800; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .profile-stat .stat-name { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; }
    .profile-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    .profile-header { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%); border-radius: 15px; }
    .commission-notice { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; }
    .commission-notice p { margin: 5px 0; }
    .phone-link { display: inline-block; margin-top: 10px; padding: 10px 20px; background: var(--gradient-gold); color: var(--dark); border-radius: 8px; font-weight: 700; font-size: 1.1rem; text-decoration: none; }
    .whatsapp-link { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%) !important; color: white !important; }
    .whatsapp-link:hover { transform: scale(1.05); box-shadow: 0 5px 20px rgba(37, 211, 102, 0.4); }
    .success-modal { text-align: center; }
    .success-icon { font-size: 4rem; margin-bottom: 20px; }
    .success-modal h2 { color: #22c55e; margin-bottom: 15px; }
    .success-modal p { color: var(--text-muted); margin-bottom: 20px; }
    .whatsapp-btn { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; border-radius: 12px; font-weight: 700; font-size: 1.2rem; text-decoration: none; transition: all 0.3s; }
    .whatsapp-btn:hover { transform: scale(1.05); box-shadow: 0 10px 30px rgba(37, 211, 102, 0.4); }
    .my-ads-modal { max-width: 700px; max-height: 80vh; overflow-y: auto; }
    .my-ads-list { display: flex; flex-direction: column; gap: 15px; }
    .my-ad-card { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; }
    .my-ad-info h4 { margin: 0 0 5px 0; font-size: 1.1rem; }
    .my-ad-info p { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
    .ad-status { display: inline-block; margin-top: 8px; font-size: 0.85rem; font-weight: 600; }
    .my-ad-actions { display: flex; gap: 10px; }
    .btn-edit, .btn-delete { padding: 8px 16px; border-radius: 8px; font-size: 0.9rem; cursor: pointer; border: none; transition: 0.3s; }
    .btn-edit { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
    .btn-delete { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .btn-edit:hover, .btn-delete:hover { transform: scale(1.05); }
    .loading-state { text-align: center; padding: 40px; color: var(--text-muted); }
    
    /* Listing WhatsApp Button */
    .listing-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
    .listing-whatsapp { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px 15px; margin-top: 12px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); border-radius: 10px; font-size: 0.95rem; font-weight: 700; color: white; text-decoration: none; transition: 0.3s; }
    .listing-whatsapp:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(37, 211, 102, 0.4); }
    
    /* Contact Link */
    .contact-link { color: #25D366 !important; font-weight: 700; }
    .contact-link:hover { color: #128C7E !important; }
    
    /* Profile Link in Nav */
    .profile-link { color: var(--primary) !important; font-weight: 700; background: rgba(99, 102, 241, 0.1); padding: 8px 15px; border-radius: 8px; transition: all 0.3s; }
    .profile-link:hover { background: rgba(99, 102, 241, 0.2); }
    
    /* Page Modals (Help, Terms) */
    .page-modal { max-height: 85vh; overflow-y: auto; }
    .page-modal h2 { margin-bottom: 20px; }
    .help-section, .terms-section { margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; }
    .help-section h3, .terms-section h3 { margin: 0 0 10px 0; font-size: 1.1rem; color: var(--secondary); }
    .help-section p, .terms-section p { margin: 0; line-height: 1.8; color: var(--text-muted); }
    
    /* Large Pricing */
    .price-large span { font-size: 2.8rem !important; font-weight: 800; }
    .price-large { font-size: 1.2rem !important; }
    
    /* Bottom Navigation Bar */
    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000; display: flex; justify-content: space-around; align-items: center; padding: 10px 0 15px; background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.1); }
    .bottom-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 12px; background: none; border: none; color: var(--text-muted); text-decoration: none; cursor: pointer; transition: 0.3s; font-family: inherit; }
    .bottom-nav-item:hover, .bottom-nav-item.active { color: var(--primary); }
    .bottom-nav-icon { font-size: 1.4rem; }
    .bottom-nav-label { font-size: 0.7rem; font-weight: 600; }
    .bottom-nav-add { background: var(--gradient); color: white !important; border-radius: 12px; margin-top: -20px; padding: 12px 16px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); }
    .bottom-nav-add:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5); }
    .bottom-nav-profile { color: var(--primary) !important; }
    .bottom-nav-profile .bottom-nav-icon { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.6rem; }
    body { padding-bottom: 80px; }
    @media (min-width: 769px) { .bottom-nav { display: none; } body { padding-bottom: 0; } }
    
    /* Mobile Modal Responsive */
    @media (max-width: 768px) {
        .modal { padding: 10px; }
        .modal-content { padding: 20px 15px; max-height: 90vh; overflow-y: auto; }
        .modal h2 { font-size: 1.2rem; margin-bottom: 15px; }
        .form-group { margin-bottom: 12px; }
        .form-group label { font-size: 0.85rem; margin-bottom: 5px; }
        .form-group input, .form-group select, .form-group textarea { padding: 10px 12px; font-size: 0.9rem; }
        .form-group textarea { rows: 2; }
        .commission-notice { padding: 12px; margin-bottom: 15px; }
        .commission-notice p { font-size: 0.85rem; margin: 3px 0; }
        .phone-link, .whatsapp-link { padding: 8px 16px; font-size: 0.95rem; }
        .btn { padding: 10px 20px; font-size: 0.95rem; }
        
        /* Global Mobile Font Size Reduction (20-25% smaller) */
        html { font-size: 13px; }
        h1 { font-size: 1.8rem !important; }
        h2 { font-size: 1.4rem !important; }
        h3 { font-size: 1.1rem !important; }
        h4 { font-size: 1rem !important; }
        p, span, a, li { font-size: 0.9rem !important; }
        .hero-title { font-size: 2rem !important; }
        .hero-subtitle { font-size: 1rem !important; }
        .section-badge { font-size: 0.75rem !important; padding: 6px 12px !important; }
        .category-card h3 { font-size: 0.95rem !important; }
        .category-card p { font-size: 0.75rem !important; }
        .tab { font-size: 0.8rem !important; padding: 8px 14px !important; }
        .listing-card h3 { font-size: 1rem !important; }
        .listing-card p { font-size: 0.8rem !important; }
        .listing-card .price { font-size: 1.1rem !important; }
        .listing-card .cat { font-size: 0.7rem !important; }
        .stat span { font-size: 2.2rem !important; }
        .stat small { font-size: 0.95rem !important; }
        .hero-stats { gap: 30px !important; }
        .footer-links h4 { font-size: 0.95rem !important; }
        .footer-links a { font-size: 0.85rem !important; }
        .logo { font-size: 1.3rem !important; }
        .nav-links a { font-size: 0.9rem !important; }
        .listing-whatsapp { font-size: 0.85rem !important; padding: 8px 12px !important; }
    }
`;
document.head.appendChild(style);

// Bottom Navigation Event Listeners
document.getElementById('bottomAddBtn')?.addEventListener('click', () => {
    if (!token) {
        alert('يجب تسجيل الدخول أولاً');
        openModal('loginModal');
    } else {
        openModal('postAdModal');
    }
});

document.getElementById('bottomMyAdsBtn')?.addEventListener('click', () => {
    if (!token) {
        alert('يجب تسجيل الدخول أولاً');
        openModal('loginModal');
    } else {
        openModal('myAdsModal');
        loadMyAds();
    }
});

// Favorites Button Handler
document.getElementById('bottomFavBtn')?.addEventListener('click', () => {
    openModal('favoritesModal');
    loadFavorites();
});

// ===== LOAD FAVORITES =====
async function loadFavorites() {
    const container = document.getElementById('favoritesContainer');
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>🤍 لا توجد إعلانات في المفضلة</p>
                <p>اضغط على ❤️ في أي إعلان لإضافته هنا</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="loading-state">جاري التحميل...</div>';

    try {
        const res = await fetch(`${API}/api/ads`);
        const data = await res.json();
        const favoriteAds = data.ads.filter(ad => favorites.includes(ad._id));

        if (favoriteAds.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>🤍 لا توجد إعلانات في المفضلة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = favoriteAds.map(ad => `
            <div class="fav-card">
                <img src="${ad.images && ad.images[0] ? ad.images[0] : 'https://via.placeholder.com/100x100?text=' + encodeURIComponent(ad.title)}" alt="${ad.title}">
                <div class="fav-info">
                    <h4>${ad.title}</h4>
                    <p>📍 ${ad.location}</p>
                    <span class="fav-price">${ad.price}</span>
                </div>
                <div class="fav-actions">
                    ${ad.whatsapp ? `<a href="https://wa.me/${ad.whatsapp}?text=مرحباً، أنا مهتم بإعلانك: ${ad.title}" target="_blank" class="btn btn-primary btn-sm">💬 تواصل</a>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="removeFavorite('${ad._id}')">🗑️ إزالة</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div class="empty-state">حدث خطأ في التحميل</div>';
    }
}

// Remove from favorites
function removeFavorite(adId) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favorites = favorites.filter(id => id !== adId);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
    // Update the heart button if visible
    const btn = document.querySelector(`.listing-card[data-id="${adId}"] .fav-btn`);
    if (btn) {
        btn.innerHTML = '🤍';
        btn.classList.remove('active');
    }
}

// Bottom Profile Button Handler
document.getElementById('bottomProfileBtn')?.addEventListener('click', () => {
    if (!token) {
        alert('يجب تسجيل الدخول أولاً');
        openModal('loginModal');
    } else {
        openModal('profileModal');
        loadProfile();
    }
});

console.log('%c🛒 بدّل وبيع', 'font-size: 24px; font-weight: bold; color: #6366f1;');

// Load stats on page load
loadStats();
