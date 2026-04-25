// service-worker.js  (Phase 20 — force cache bust)
const CACHE = 'rios-v27-modern';
const SHELL = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))  // delete ALL old caches
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for JS/CSS/HTML with no-cache
  if (/\.(js|css|html)$/.test(url.pathname) || url.pathname === '/') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request)));
});
