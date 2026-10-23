// Offline shell cache. Bump VERSION whenever any app file changes so phones pick up the update.
const VERSION = 'macro-check-v11';
// core.js carries the release number so a new page can never run an old core.js (keep in sync with index.html).
const SHELL = ['./', 'index.html', 'core.js?v=11', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser's HTTP cache, so a new release never stores an old file
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle same-origin GETs; Open Food Facts and the scanner library go straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // The catalogue changes weekly: always try the network first, use the stored copy only when offline.
  if (url.pathname.endsWith('/catalog/catalog.json')) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;   // cached copy first (fast, offline), refreshed in the background
    })
  );
});
