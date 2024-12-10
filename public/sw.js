const CACHE_NAME = 'sha-library-cache-v1';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/card.js',
  '/404.html',
  '/cards.css',
  '/cards.js',
  '/color.js',
  '/config.js',
  '/index.html',
  '/petite-vue.es.js',
  '/qr-creator.es6.min.js',
  '/Welcome.jsonl',
];

// Install the Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching files...');
      return cache.addAll(CACHE_ASSETS);
    })
  );
});

// Activate the Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache...');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // if path end with '/' then serve /index.html
  console.log(`[Service Worker] Fetching: ${event.request.url}`);
  if (event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() =>
          caches.match('/404.html') // Fallback for offline use
        )
      );
    })
  );
});

