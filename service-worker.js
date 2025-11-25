// Service Worker for PWA functionality
const CACHE_NAME = 'pulpa-fdc-v1.1';
const STATIC_CACHE = 'static-v1.1';
const IMAGE_CACHE = 'images-v1.1';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Image URLs to cache (productos de Frutos de Copán)
const imageUrlsToCache = [
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png',
    './icons/badge-72x72.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('Static cache opened');
                return cache.addAll(urlsToCache);
            }),
            caches.open(IMAGE_CACHE).then((cache) => {
                console.log('Image cache opened');
                return cache.addAll(imageUrlsToCache).catch(err => {
                    console.log('Some images failed to cache:', err);
                });
            })
        ])
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [STATIC_CACHE, IMAGE_CACHE];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip Google Apps Script requests - always fetch from network
    if (url.href.includes('script.google.com')) {
        return event.respondWith(fetch(request));
    }
    
    // Image requests - cache first, network fallback
    if (request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(request).then(response => {
                    return response || fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Static resources - cache first
    event.respondWith(
        caches.match(request)
            .then((response) => {
                if (response) {
                    return response;
                }

                return fetch(request).then(
                    (response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();

                        caches.open(STATIC_CACHE)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-solicitudes') {
        event.waitUntil(syncSolicitudes());
    }
});

async function syncSolicitudes() {
    // Get pending solicitudes from IndexedDB
    // Send to server when online
    console.log('Syncing solicitudes...');
}

// Push notification support
self.addEventListener('push', (event) => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
