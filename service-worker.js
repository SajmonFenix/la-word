const CACHE = 'la-word-v1';
const BASE = '/la-word';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll([
        BASE + '/',
        BASE + '/index.html',
        BASE + '/css/style.css',
        BASE + '/js/storage.js',
        BASE + '/js/cards.js',
        BASE + '/js/ui.js',
        BASE + '/js/app.js',
        BASE + '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
