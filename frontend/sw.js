// Service Worker for WaterWall
// Provides basic caching for offline functionality

const CACHE_VERSION = 'v3-auth-fix';
const CACHE_NAME = `waterwall-${CACHE_VERSION}`;
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/games.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
    event.respondWith((async () => {
        try {
            const network = await fetch(event.request);
            // Stale-while-revalidate for GET requests
            if (event.request.method === 'GET') {
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, network.clone());
            }
            return network;
        } catch (err) {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            // Fallback for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
            return new Response('Offline', { status: 503 });
        }
    })());
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
