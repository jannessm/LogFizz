/// <reference lib="webworker" />

// -------------------------------------------------------------------
// Cache version – bump this string to force a new install event when
// the service worker file itself hasn't changed but the app has.
// Vite‑built assets contain content hashes, so a new deployment will
// always produce a new sw.js if you import it through the build, but
// since sw.js lives in /public and is served as‑is we keep a manual
// version string as a safety net.
// -------------------------------------------------------------------
const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'logfizz-cache';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// Core assets that are required for the app shell to work offline.
// Vite‑hashed JS/CSS bundles will be cached at runtime on first load.
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// --------------- INSTALL ---------------
// Pre‑cache the app shell so the app can boot offline.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate the new SW immediately instead of waiting for all tabs to close.
  self.skipWaiting();
});

// --------------- ACTIVATE ---------------
// Clean up caches from older versions so storage doesn't grow unbounded.
// After activation, notify all clients that a new version is active so
// they can prompt the user to reload.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Take control of all open clients immediately.
      return self.clients.claim();
    }).then(() => {
      // Tell every controlled page that a new version just activated.
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    })
  );
});

// --------------- MESSAGE ---------------
// Allow the page to tell us to skipWaiting (used when the user clicks
// "Reload" in the update prompt).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --------------- FETCH ---------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our own origin.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Never cache API calls – they carry user data and auth tokens.
  if (url.pathname.startsWith('/api')) return;

  // --- Navigation requests (HTML pages) ---
  // Strategy: Network‑first, fall back to cache, ultimate fallback to
  // the cached root (SPA – any route can be served from /).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh navigation response for offline use.
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline – serve from cache.
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // --- Static assets (JS, CSS, images, fonts, …) ---
  // Strategy: Cache‑first.  Vite‑hashed assets are immutable so once
  // cached they never need to be re‑validated.  Un‑hashed assets
  // (manifest, icons) are updated via the new SW install.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Not in cache yet – fetch from network, cache, and return.
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Last resort fallbacks for specific resource types.
          if (request.destination === 'image') {
            return caches.match('/icon.svg');
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    })
  );
});
