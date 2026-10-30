const CACHE = 'fitness-week-2026-11-03-v12-static-gallery';
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
  const cache = caches.open(CACHE);
  const fetched = cache.then(async (current) => {
    const res = await fetch(req);
    if (res && res.ok) await current.put(req, res.clone());
    return res;
  });
  event.waitUntil(fetched.then(() => undefined, () => undefined));
  event.respondWith(cache.then(async (current) => (await current.match(req)) || fetched));
});
