const CACHE = 'fitness-week-2026-11-03-v13-p2-review';
const ASSETS = [
  './',
  './index.html',
  './stage.css',
  './stage.js',
  './toy-renderer.js',
  './workspace.js',
  './workspace.css',
  './reference-data.js',
  './references.js',
  './references.css',
  './sync-config.js',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './images/warmup1.jpg',
  './images/warmup2.jpg',
  './images/meal-bf.jpg',
  './images/meal-lunch.jpg',
  './images/meal-dinner.jpg',
  './images/form-legpress.jpg',
  './images/form-chest.jpg',
  './images/form-row.jpg',
  './images/form-legcurl.jpg',
  './images/form-arms-ss.jpg',
  './images/form-crunch.jpg',
  './images/form-squat.jpg',
  './images/form-pulldown.jpg',
  './images/form-shoulderpress.jpg',
  './images/form-lateral.jpg',
  './images/form-plank.jpg',
  './images/form-rdl.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('fitness-week-2026-11-03-') && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Keep the active version's cache handle. A retiring worker must not reopen
  // its deleted cache or serve another version's HTML during an update.
  const cache = Promise.resolve().then(() => caches.open(CACHE)).catch(() => null);
  // Network success must not depend on cache availability or quota. Cache
  // writes stay in the worker's background lifetime, outside the response.
  const fetched = fetch(req);
  const updated = Promise.all([cache, fetched]).then(async ([current, res]) => {
    if(current && res && res.ok){try{await current.put(req, res.clone());}catch(_){}}
  });
  event.waitUntil(updated.catch(() => undefined));
  event.respondWith(cache.then(async (current) => {
    if(current){try{const hit=await current.match(req);if(hit)return hit;}catch(_){}}
    return fetched;
  }));
});
