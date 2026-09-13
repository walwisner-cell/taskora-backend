// Real background push notifications — the piece that was missing from
// item 2's "background notifications" requirement. Sound and vibration
// (see index.html) only work while the app is actually open in a tab;
// this is what lets a notification actually appear on someone's phone or
// desktop when the app is fully closed, which needs its own real
// infrastructure: a keypair the browser's push service trusts (VAPID),
// and a record of each device that's actually granted permission (a
// "subscription", created client-side by the browser's own Push API and
// handed to us to store).
const webpush = require('web-push');
const db = require('./db');

function isPushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

if (isPushConfigured()) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@trothenpro.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ Push notifications are configured (VAPID keys present).');
} else {
  console.log('⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — background push notifications are disabled. Notifications still work normally while the app is open. Generate a real keypair with: node -e "console.log(require(\'web-push\').generateVAPIDKeys())" and set both as environment variables (they only ever need to be generated once, ever, for the life of this app).');
}

// Sends a real push message to every device the user has subscribed on.
// A subscription can go stale on its own (the person uninstalled the
// app, cleared site data, or the OS revoked it) — the push service
// itself tells us this via a 404/410 response, which is the ONE error
// that should silently remove the subscription rather than just being
// logged, since retrying it will never succeed. Every other failure
// (network hiccup, payload too large, etc.) is logged but leaves the
// subscription in place, since it doesn't mean the subscription itself
// is actually dead.
async function sendPushToUser(userId, payload) {
  if (!isPushConfigured()) return { sent: 0, attempted: 0 };
  const subscriptions = await db.filter('pushSubscriptions', s => s.userId === userId);
  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.remove('pushSubscriptions', sub.id);
      } else {
        console.error(`[push-notifications] Failed to deliver to subscription ${sub.id}:`, e.message);
      }
    }
  }
  return { sent, attempted: subscriptions.length };
}

module.exports = { isPushConfigured, sendPushToUser };
