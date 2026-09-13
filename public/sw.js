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

// Item 2's real background notifications — this is the part that only
// runs when the app is NOT open in a tab (when it IS open, the page's
// own polling + sound/vibration handles it instead — see index.html).
// The payload is whatever notify() sent server-side (src/notify.js):
// { icon, text, linkTo }. Deliberately defensive about a malformed or
// missing payload — a push service redelivering an old or corrupted
// message should never throw inside a service worker, which can disable
// push handling entirely until the worker restarts.
self.addEventListener('push', (event) => {
  let payload = { text: 'You have a new notification on Trothen' };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) { /* fall back to the default above */ }

  event.waitUntil(
    self.registration.showNotification('Trothen', {
      body: payload.text || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { linkTo: payload.linkTo || null },
    })
  );
});

// Clicking the OS-level notification should behave like clicking the
// equivalent in-app notification would: focus an already-open Trothen
// tab if one exists (rather than opening a confusing second tab), and
// hand it the linkTo so the app can navigate to the right section —
// picked up by the 'message' listener the app itself registers on
// navigator.serviceWorker (see index.html).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const linkTo = event.notification.data && event.notification.data.linkTo;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', linkTo });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
