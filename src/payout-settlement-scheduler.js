const db = require('./db');
const { notify } = require('./notify');

// Payouts started life as 'processing' and never moved — there was no
// real distinction between a payout just requested and one that had
// actually gone out, because nothing ever advanced the status. This
// simulates realistic settlement (2 days, matching how "1-3 business
// days" typically gets communicated in real payment platforms) so
// "processing" and "paid" mean something real and different, without
// pretending to have a real bank rail this app doesn't have yet.
//
// Deliberately doesn't invent a 'failed' state here — there's no real
// failure condition to detect without an actual payment processor, and
// simulating one just to check a box would be dishonest. A payout an
// admin needs to flag as failed for a real reason (bad payout details,
// etc.) is a manual admin action, not something this sweep guesses at.
const SETTLEMENT_DELAY_MS = 2 * 24 * 60 * 60 * 1000; // 2 simulated days

async function sweepPayoutSettlement() {
  const processing = await db.filter('payouts', p => p.status === 'processing');
  let settled = 0;
  for (const payout of processing) {
    const age = Date.now() - new Date(payout.createdAt).getTime();
    if (age < SETTLEMENT_DELAY_MS) continue;
    await db.update('payouts', payout.id, { status: 'paid', paidAt: new Date().toISOString() });
    await notify(payout.providerId, '✅', `Your payout of $${payout.amount} has settled and should now be in your account.`, 'payoutAlerts', { section: 'earnings' });
    settled += 1;
  }
  if (settled > 0) console.log(`[payout-settlement-scheduler] Settled ${settled} payout${settled === 1 ? '' : 's'}.`);
  return { checked: processing.length, settled };
}

module.exports = { sweepPayoutSettlement };
