// ===== API Configuration =====
const API = '';  // Empty for same origin, or 'http://localhost:3000' for dev* 
const ADMIN_PHONE = '+961 71 163 211';

// ===== Auth State =====
let token = localStorage.getItem('token');
let currentUser = null;

// ===== Helper: Compress and Convert Image to Base64 =====
function compressImage(file, maxWidth = 800, quality = 0.7) {
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

                // Resize if larger than maxWidth
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed JPEG
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
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

// ===== Load Ads from API =====
async function loadAds(category = 'all') {
    try {
        const url = category === 'all' ? `${API}/api/ads` : `${API}/api/ads?category=${category}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ads && data.ads.length > 0) {
            renderAds(data.ads);
            updateCategoryCounts(data.ads);
        } else {
            listingsGrid.innerHTML = `
                <div class="empty-state">
                    <p>📭 لا توجد إعلانات حالياً</p>
                    <p>كن أول من ينشر إعلان!</p>
                </div>
            `;
        }
    } catch (e) {
        listingsGrid.innerHTML = `
            <div class="empty-state">
                <p>⚠️ تعذر تحميل الإعلانات</p>
                <p>تأكد من تشغيل السيرفر</p>
            </div>
        `;
    }
}

function renderAds(ads) {
    const categoryIcons = {
        home: '🏠',
        cars: '🚗',
        realestate: '🏗️',
        services: '🔧'
    };
    const categoryNames = {
        home: 'منتجات منزلية',
        cars: 'سيارات',
        realestate: 'عقارات',
        services: 'خدمات'
    };

    listingsGrid.innerHTML = ads.map(ad => `
        <article class="listing-card" data-category="${ad.category}">
            <div class="listing-img">
                <img src="${ad.images && ad.images[0] ? ad.images[0] : 'https://via.placeholder.com/400x250?text=' + encodeURIComponent(ad.title)}" alt="${ad.title}">
                ${ad.isFeatured ? '<span class="badge gold">مميز</span>' : '<span class="badge">جديد</span>'}
            </div>
            <div class="listing-info">
                <span class="cat">${categoryIcons[ad.category] || '📦'} ${categoryNames[ad.category] || ad.category}</span>
                <h3>${ad.title}</h3>
                <p>📍 ${ad.location}</p>
                <div class="listing-footer">
                    <div class="price">${ad.price}</div>
                </div>
                ${ad.whatsapp ? `<a href="https://wa.me/${ad.whatsapp}?text=مرحباً، أنا مهتم بإعلانك: ${ad.title}" target="_blank" class="listing-whatsapp">💬 تواصل واتساب</a>` : ''}
                </div>
            </div>
        </article>
    `).join('');

    // Update stats
    document.getElementById('statAds').textContent = ads.length;
}

function updateCategoryCounts(ads) {
    const counts = { home: 0, cars: 0, realestate: 0, services: 0 };
    ads.forEach(ad => {
        if (counts[ad.category] !== undefined) counts[ad.category]++;
    });
    document.getElementById('countHome').textContent = `${counts.home} إعلان`;
    document.getElementById('countCars').textContent = `${counts.cars} إعلان`;
    document.getElementById('countRealestate').textContent = `${counts.realestate} إعلان`;
    document.getElementById('countServices').textContent = `${counts.services} إعلان`;
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

    // Category tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadAds(tab.dataset.tab);
        });
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

        // Get image as compressed base64 if file selected
        let imageBase64 = '';
        const imageFile = document.getElementById('adImage').files[0];
        if (imageFile) {
            imageBase64 = await compressImage(imageFile);
        }

        const adData = {
            title: document.getElementById('adTitle').value,
            category: document.getElementById('adCategory').value,
            price: document.getElementById('adPrice').value,
            location: document.getElementById('adLocation').value,
            whatsapp: document.getElementById('adWhatsapp').value,
            images: imageBase64 ? [imageBase64] : [],
            description: document.getElementById('adDescription').value
        };
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

    // Edit Ad Form
    document.getElementById('editAdForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adId = document.getElementById('editAdId').value;
        const adData = {
            title: document.getElementById('editAdTitle').value,
            category: document.getElementById('editAdCategory').value,
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
    const categoryNames = { home: 'منتجات منزلية', cars: 'سيارات', realestate: 'عقارات', services: 'خدمات' };

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
                        <button class="btn-edit" onclick="openEditAd('${ad._id}', '${ad.title}', '${ad.category}', '${ad.price}', '${ad.location}', '${ad.description || ''}')">✏️ تعديل</button>
                        <button class="btn-delete" onclick="deleteMyAd('${ad._id}')">🗑️ حذف</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Open Edit Ad Modal
function openEditAd(id, title, category, price, location, description) {
    document.getElementById('editAdId').value = id;
    document.getElementById('editAdTitle').value = title;
    document.getElementById('editAdCategory').value = category;
    document.getElementById('editAdPrice').value = price;
    document.getElementById('editAdLocation').value = location;
    document.getElementById('editAdDescription').value = description;
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

// ===== CSS for new elements =====
const style = document.createElement('style');
style.textContent = `
    .hidden { display: none !important; }
    .user-menu { display: flex; align-items: center; gap: 15px; }
    .user-menu span { color: var(--secondary); font-weight: 600; }
    .modal-switch { text-align: center; margin-top: 20px; color: var(--text-muted); }
    .modal-switch a { color: var(--primary); }
    .empty-state { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted); }
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
    
    /* Page Modals (Help, Terms) */
    .page-modal { max-height: 85vh; overflow-y: auto; }
    .page-modal h2 { margin-bottom: 20px; }
    .help-section, .terms-section { margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; }
    .help-section h3, .terms-section h3 { margin: 0 0 10px 0; font-size: 1.1rem; color: var(--secondary); }
    .help-section p, .terms-section p { margin: 0; line-height: 1.8; color: var(--text-muted); }
    
    /* Bottom Navigation Bar */
    .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000; display: flex; justify-content: space-around; align-items: center; padding: 10px 0 15px; background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.1); }
    .bottom-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 12px; background: none; border: none; color: var(--text-muted); text-decoration: none; cursor: pointer; transition: 0.3s; font-family: inherit; }
    .bottom-nav-item:hover, .bottom-nav-item.active { color: var(--primary); }
    .bottom-nav-icon { font-size: 1.4rem; }
    .bottom-nav-label { font-size: 0.7rem; font-weight: 600; }
    .bottom-nav-add { background: var(--gradient); color: white !important; border-radius: 12px; margin-top: -20px; padding: 12px 16px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); }
    .bottom-nav-add:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5); }
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
        .stat-number { font-size: 2.2rem !important; }
        .stat-label { font-size: 0.9rem !important; }
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

console.log('%c🛒 بدّل وبيع', 'font-size: 24px; font-weight: bold; color: #6366f1;');
