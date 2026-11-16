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

// v168: only Trothen's own requests go through here. Walter: "why is this
// like this", a grey "Where is the job?" map. This worker used to re-fetch
// EVERY request, the map pictures included. A worker's own fetches obey the
// site's security policy for connections (connect-src), which only allows
// Trothen and Google sign-in, so the browser refused every map picture
// (OpenStreetMap, Mapbox or Google) and every Google font: grey maps on
// the live site. Tests ran with the worker switched off, so they never saw
// it. Now anything from another site, and anything that isn't a plain GET,
// goes straight from the page, exactly as if there were no worker.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let sameSite = false;
  try { sameSite = new URL(req.url).origin === self.location.origin; } catch (e) { /* not a web address */ }
  if (!sameSite) return;
  event.respondWith(fetch(req));
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

  // v147: if Trothen is open and in front, the page shows its own pop-up,
  // so the phone doesn't show a second one. Otherwise the notification
  // carries the same tag the page uses, so it is never shown twice, and
  // the app icon gets a dot.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.some(c => c.visibilityState === 'visible' && c.focused)) return null;
      try { if (self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge().catch(() => {}); } catch (e) { /* no badges here */ }
      return self.registration.showNotification('Trothen', {
        body: payload.text || 'You have a new notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.id ? `n_${payload.id}` : undefined,
        renotify: false,
        data: { linkTo: payload.linkTo || null },
      });
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
