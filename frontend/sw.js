// Service Worker for Jettic Games
// Provides basic caching for offline functionality

const CACHE_VERSION = 'v5-no-cache-20250211';
const CACHE_NAME = `jettic-${CACHE_VERSION}`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/+$/, '');
const BASE_PATH = SCOPE_PATH === '/' ? '' : SCOPE_PATH;
const withBase = (path) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${BASE_PATH}${normalized}` || '/';
};
const urlsToCache = [
    withBase('/'),
    withBase('/index.html'),
    withBase('/styles.css'),
    withBase('/games.json'),
    withBase('/backend-config.json')
];

// Install event - cache static assets
self.addEventListener('install', event => {
    // Skip waiting to activate immediately
    self.skipWaiting();
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
            // Never cache app.js to ensure updates are always loaded
            if (event.request.url.includes('app.js')) {
                console.log('Bypassing cache for app.js');
                return fetch(event.request, { cache: 'no-store' });
            }
            
            const network = await fetch(event.request);
            // Stale-while-revalidate for GET requests (except app.js)
            if (event.request.method === 'GET' && !event.request.url.includes('app.js')) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, network.clone());
            }
            return network;
        } catch (err) {
            // Don't serve cached app.js
            if (event.request.url.includes('app.js')) {
                return new Response('App.js failed to load', { status: 503 });
            }
            
            const cached = await caches.match(event.request);
            if (cached) return cached;
            // Fallback for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match(withBase('/index.html'));
            }
            return new Response('Offline', { status: 503 });
        }
    })());
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', event => {
    // Take control of all clients immediately
    event.waitUntil(
        Promise.all([
            // Clear all old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control immediately
            self.clients.claim()
        ])
    );
});
