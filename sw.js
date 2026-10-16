// Service Worker for 100% Offline Support & Auto-Update
const CACHE_NAME = 'harmonium-multi-instrument-studio-v4.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './audio.js',
    './app.js',
    './PLAYING_GUIDE.html',
    './PLAYING_GUIDE.md',
    './manifest.json',
    './version.json'
];

// Install: Cache all core files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all studio assets for offline use');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activate: Remove older caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Serve from cache first, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Cache dynamic local requests
                if (event.request.url.startsWith('file:') || event.request.url.startsWith('http')) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If offline and request fails, return cached index
                return caches.match('./index.html');
            });
        })
    );
});
