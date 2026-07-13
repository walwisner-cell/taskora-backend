const { nanoid } = require('nanoid');
const db = require('./db');

// Creates a real notification tied to a real event. Centralized here so
// every route that triggers a user-facing event (a match, a payout, a
// resolved dispute, etc.) creates a consistent record instead of each
// route inventing its own shape.
function notify(userId, icon, text) {
  db.insert('notifications', {
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
