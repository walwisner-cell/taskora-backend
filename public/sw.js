// Intentionally a pass-through, not a cache. Trothen is real-time,
// account-specific data end to end — a cached response here could show
// someone a stale booking status, an old escrow amount, or (worse) another
// session's data after a shared/kiosk-style logout. If real offline
// support is wanted later, cache only truly static assets (icons, fonts)
// explicitly by URL — never blanket-cache API responses or the app shell
// itself.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
