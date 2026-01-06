// ===== API Configuration =====
const API = '';  // Empty for same origin, or 'http://localhost:3000' for dev* 
const ADMIN_PHONE = '+961 71 163 211';

// ===== Auth State =====
let token = localStorage.getItem('token');
let currentUser = null;

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
                <div class="price">${ad.price}</div>
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
        const adData = {
            title: document.getElementById('adTitle').value,
            category: document.getElementById('adCategory').value,
            price: document.getElementById('adPrice').value,
            location: document.getElementById('adLocation').value,
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
                alert(`✅ ${data.message}\n\n📞 للموافقة السريعة تواصل مع: ${ADMIN_PHONE}`);
                document.getElementById('adForm').reset();
            } else {
                alert(data.message || 'خطأ في نشر الإعلان');
            }
        } catch (e) {
            alert('خطأ في الاتصال بالسيرفر');
        }
    });
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
    .phone-link { display: inline-block; margin-top: 10px; padding: 10px 20px; background: var(--gradient-gold); color: var(--dark); border-radius: 8px; font-weight: 700; font-size: 1.1rem; }
`;
document.head.appendChild(style);

console.log('%c🛒 بدّل وبيع', 'font-size: 24px; font-weight: bold; color: #6366f1;');
