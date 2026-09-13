const { nanoid } = require('nanoid');
const db = require('./db');

// Creates a real notification tied to a real event. Centralized here so
// every route that triggers a user-facing event (a match, a payout, a
// resolved dispute, etc.) creates a consistent record instead of each
// route inventing its own shape.
//
// `category` is optional and, when given, is checked against the
// recipient's saved notifPrefs before creating the notification — this is
// what makes the notification-preference toggles in Settings real instead
// of cosmetic. Account-critical notifications (suspension, verification
// decisions, disputes) are called with no category, which means they're
// never suppressible — same principle as why you can't opt out of a bank
// fraud alert.
async function notify(userId, icon, text, category = null, linkTo = null) {
  if (category) {
    const user = await db.find('users', u => u.id === userId);
    const prefs = user && user.notifPrefs;
    // Default to "on" for any preference the user hasn't explicitly touched.
    if (prefs && prefs[category] === false) return;
  }
  await db.insert('notifications', {
    id: `ntf_${nanoid(10)}`,
    userId,
    icon,
    text,
    read: false,
    // Where clicking this notification should actually take the person —
    // a dashboard section key, e.g. { section: 'messages' }. Optional:
    // omitted for notifications with no obvious single destination.
    linkTo,
    createdAt: new Date().toISOString(),
  });

  // Item 2's real "background notifications": every notification that
  // makes it this far (i.e. wasn't suppressed by the preference check
  // above) also goes out as a real push message, so it still reaches the
  // person even with the app fully closed — not just sound/vibration
  // while a tab happens to be open (see index.html's polling, which is a
  // separate, complementary mechanism for while the app IS open).
  // Deliberately fire-and-forget: notify() is called from dozens of
  // places mid-request, and a slow or failing push send should never
  // delay or break the actual action (a payment, a booking, a match)
  // that triggered this notification in the first place.
  const { isPushConfigured, sendPushToUser } = require('./push-notifications');
  if (isPushConfigured()) {
    sendPushToUser(userId, { icon, text, linkTo }).catch(e => console.error('[notify] push send failed:', e.message));
  }
}

module.exports = { notify };
