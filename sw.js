const CACHE_NAME = 'finance-flow-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './auth.js',
    './transactions.js',
    './accounts.js',
    './categories.js',
    './charts.js',
    './ai.js',
    './utils.js',
    './state.js',
    './constants.js',
    './config_v2.js',
    './supabaseClient.js',
    './dataLoader.js',
    './assets/icon-192.png',
    './assets/icon-512.png',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests (like API calls) for now, or handle them with Network First
    if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('cdn') && !event.request.url.includes('fonts')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache Hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
