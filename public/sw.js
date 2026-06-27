const CACHE_NAME = 'geotime-cache-v5';
const STATIC_CACHE = 'geotime-static-v5';
const DYNAMIC_CACHE = 'geotime-dynamic-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pwa-icon.svg',
  '/manifest.json'
];

// Cache size limit
const CACHE_LIMIT = 50;

// Install Service Worker and cache essential shells
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[Service Worker] Pre-caching skipped some files:', err);
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
          if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE && cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Trim cache to size limit
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

// Fetch interception with optimized strategies
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Network-first for API calls (real-time data)
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone successful responses for cache
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if available, otherwise offline message
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "OFFLINE", 
                message: "You are offline. Your punches are saved locally and will auto-sync when you regain connection." 
              }), 
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Skip external domains (fonts, CDN)
  if (requestUrl.host.includes('googleapis.com') || 
      requestUrl.host.includes('google.com') || 
      requestUrl.host.includes('tailwindcss.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for static assets
  if (STATIC_ASSETS.some(asset => requestUrl.pathname.endsWith(asset))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Update cache in background
          fetch(event.request).then(response => {
            if (response.ok) {
              caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request);
      })
    );
    return;
  }

  // Stale-while-revalidate for app shell and assets
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
            trimCache(DYNAMIC_CACHE, CACHE_LIMIT);
          });
        }
        return networkResponse;
      }).catch(() => null);

      // Return cached immediately, update in background
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetchPromise.then(response => {
        if (!response && isNavigation) {
          return caches.match('/');
        }
        return response;
      });
    })
  );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => {
        if (name !== STATIC_CACHE) {
          caches.delete(name);
        }
      });
    });
  }
});
