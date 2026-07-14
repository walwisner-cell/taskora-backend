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
async function notify(userId, icon, text, category = null) {
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
    time: 'Just now',
    read: false,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { notify };
