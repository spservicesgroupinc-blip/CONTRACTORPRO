const CACHE_NAME = 'geotime-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/pwa-icon.svg',
  '/manifest.json'
];

// Install Service Worker and cache essential shells
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Pre-caching skipped some files, proceeding securely', err);
      });
    })
  );
});

// Clean up old caches on Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache registry:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch interception
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip intercepting API and remote fetch routes (e.g., Google Sheets / GAS proxy server) 
  // to ensure real-time clock syncing is never served with stale caches
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.host.includes('googleapis.com') || requestUrl.host.includes('google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Handle API failures gracefully when offline
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "OFFLINE", 
            message: "You are offline. Your punches are saved locally and will auto-sync when you regain connection." 
          }), 
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Stale-While-Revalidate for application assets, layouts, and libraries
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Spawn standard network request in background to refresh cache silently
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => { /* ignore backgrounds fetch errors if offline */ });
        
        return cachedResponse;
      }
      
      // Fallback directly to network
      return fetch(event.request).then((response) => {
        // Cache dynamic assets (like cdn script imports and sub pages) on the fly
        if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Safe offline layout fallback for main screen navigation if they aren't connected
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
