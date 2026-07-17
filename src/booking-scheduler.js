const db = require('./db');
const { notify } = require('./notify');

// Expires exactly one overdue booking: refunds any held escrow, marks the
// contract expired, and notifies both parties with a message that actually
// tells them what happened and what to do next — not just a silent status
// change. Exported separately from the sweep below so the lazy safety-net
// check in POST /contracts/:id/respond-offer can reuse the exact same
// logic instead of duplicating it.
async function expireOneBooking(contract) {
  const escrow = await db.find('escrowTransactions', e => e.contractId === contract.id);
  if (escrow && escrow.status === 'held') {
    await db.update('escrowTransactions', escrow.id, { status: 'refunded' });
  }
  const updated = await db.update('contracts', contract.id, { status: 'expired' });

  const provider = await db.find('users', u => u.id === contract.providerId);
  const isDirectBooking = contract.status === 'pending_provider_confirmation';
  const customerMessage = isDirectBooking
    ? `${provider ? provider.name : 'The provider'} didn't confirm "${contract.service}" in time, so the booking was automatically cancelled and any held funds refunded. Try another provider, or book them again for a later time.`
    : `${provider ? provider.name : 'The provider'} didn't respond to your offer for "${contract.service}" in time, so it expired automatically and any held funds were refunded.`;
  await notify(contract.customerId, '⏰', customerMessage, null, { section: 'bookings' });
  await notify(contract.providerId, '⏰', `You didn't respond to the booking request for "${contract.service}" in time, so it expired automatically and the customer was refunded.`, null, { section: 'bookings' });

  return updated;
}

// The scheduled sweep — finds every booking still awaiting a provider's
// response whose deadline has already passed, and expires each one for
// real. This is what makes the deadline actually mean something: without
// this running, "respond within 4 hours" would just be a label with no
// consequence, and a customer's money would sit held indefinitely against
// a job nobody ever confirmed.
async function expireOverdueBookingResponses() {
  const now = new Date();
  const pending = await db.filter('contracts', c =>
    ['pending_agreement', 'pending_provider_confirmation'].includes(c.status)
    && c.providerResponseDeadline
    && new Date(c.providerResponseDeadline) < now
  );

  let expired = 0;
  for (const contract of pending) {
    try {
      await expireOneBooking(contract);
      expired += 1;
    } catch (e) {
      console.error(`[booking-scheduler] Failed to expire contract ${contract.id}:`, e.message);
    }
  }
  if (expired > 0) console.log(`[booking-scheduler] Expired ${expired} overdue booking response${expired === 1 ? '' : 's'}.`);
  return { expired, checked: pending.length };
}

module.exports = { expireOneBooking, expireOverdueBookingResponses };
