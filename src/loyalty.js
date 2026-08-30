const db = require('./db');
const { notify } = require('./notify');

const POINTS_FOR_FREE_BOOKING = 25;

// Awards a loyalty point for a real customer action — booking, rebooking,
// referral, or review, exactly the four ways specified. "Rebooking" isn't
// tracked as a separate, higher-value action from a first-time booking —
// every booking earns the same 1 point regardless of whether it's a new
// provider or someone the customer has booked before, since a different
// point value for the two wasn't actually specified.
//
// Awarding a point never blocks the action it's attached to — a failure
// here should never be the reason a booking, review, or referral itself
// fails, so every caller treats this as fire-and-forget.
async function awardLoyaltyPoint(customerId, reason) {
  try {
    const customer = await db.find('users', u => u.id === customerId && u.role === 'customer');
    if (!customer) return;
    const newTotal = (customer.loyaltyPoints || 0) + 1;
    await db.update('users', customer.id, { loyaltyPoints: newTotal });
    if (newTotal > 0 && newTotal % POINTS_FOR_FREE_BOOKING === 0) {
      await notify(customer.id, '🎁', `You've earned ${POINTS_FOR_FREE_BOOKING} loyalty points — you have a free booking credit ready to use on your next job!`, null, { section: 'settings' });
    }
  } catch (e) {
    console.error('[loyalty] Failed to award a point:', e.message);
  }
}

module.exports = { awardLoyaltyPoint, POINTS_FOR_FREE_BOOKING };
