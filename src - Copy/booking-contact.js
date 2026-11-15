// v147: when may a customer and a pro reach each other outside the chat?
//
// Only once a booking between them is CONFIRMED: the pro has accepted and
// (for a protected payment) the customer has paid, which is when a booking
// becomes "active". This is how Uber, Airbnb, Thumbtack and TaskRabbit do
// it: before booking, people talk in the chat; phone calls, phone numbers
// and email addresses open once there is a booking. It keeps both sides
// safe (nobody gets a stranger's number) and keeps the work on Trothen.
//
// Counts as confirmed:
//   - a booking or job that is active (or in a dispute),
//   - a ride the driver has accepted (also "active"),
//   - a paid store order (also "active"),
//   - any of these completed in the last 7 days (for follow-ups: a leak
//     that came back, goods that didn't arrive).
const db = require('./db');

const LIVE = ['active', 'disputed'];
const AFTER_DAYS = 7;
const DAY = 24 * 3600 * 1000;

function contractConfirmed(c) {
  if (!c) return false;
  if (LIVE.includes(c.status)) return true;
  if (['completed', 'released'].includes(c.status)) {
    const t = Date.parse(c.completedAt || c.updatedAt || c.createdAt || 0);
    return Number.isFinite(t) && Date.now() - t < AFTER_DAYS * DAY;
  }
  return false;
}

async function confirmedBetween(aId, bId) {
  if (!aId || !bId || aId === bId) return false;
  const list = await db.filter('contracts', c => (c.customerId === aId && c.providerId === bId) || (c.customerId === bId && c.providerId === aId));
  return list.some(contractConfirmed);
}

module.exports = { contractConfirmed, confirmedBetween, AFTER_DAYS };
