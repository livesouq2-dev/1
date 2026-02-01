// Service Worker for بدّل وبيع - Fast Offline Support
const CACHE_NAME = 'badelwbi3-v2.2.1';
const API_CACHE = 'badelwbi3-api-v1';

// Static files to cache on install
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js?v=2.2.1',
    '/logo.png',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap'
];

// Install: Cache static files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_FILES))
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== API_CACHE)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Serve from cache, update in background
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API requests: Network first, fall back to cache
    if (url.pathname.startsWith('/api/ads')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Clone and cache the response
                    const clonedResponse = response.clone();
                    caches.open(API_CACHE).then(cache => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Static files: Cache first, network fallback
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Update cache in background
                    fetch(event.request).then(response => {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response);
                        });
                    }).catch(() => { });
                    return cachedResponse;
                }
                return fetch(event.request);
            })
    );
});
