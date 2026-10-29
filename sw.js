const CACHE = 'fitness-week-2026-11-03-v3-ui';
const ASSETS = [
  './',
  './index.html',
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
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req).then((res) => {
        if (res && res.ok && (req.url.startsWith(self.location.origin))) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
