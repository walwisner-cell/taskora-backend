// v157: paying for extra work and tips when the booking was paid for real
// (by card, payment code or mobile money wallet).
//
// Before v156 a tip, or extra work the customer approved, was simply added to
// what the pro would be paid, although nothing collected it from the
// customer. v156 turned both off for real payments. This brings them back
// properly, the way escrow marketplaces handle an amount added after booking:
// the extra is a payment of its own, made the same way as the booking (the
// same card page, payment code or wallet prompt), with its own receipt.
//
//   - Extra work: the customer approves the pro's request, then pays it.
//     Only once it is paid does the job's total go up. The money is held
//     with the booking's own money and released, refunded or split with it.
//   - A tip: the customer completes the job and adds a tip, then pays it.
//     Once paid it goes to the pro with no commission, like any tip.
//   - Not paid in time: the extra or the tip simply lapses. The booking
//     itself is never affected.
//
// Each one is a small linked record in the contracts list (topUpFor = the
// booking it belongs to), so the existing payment pages, confirmations,
// time limits and refunds all work for it unchanged. v158: its statuses are
// its own (topup_paid, topup_released, topup_refunded, topup_lapsed), never
// "completed" or "cancelled", so it is never counted as a job, a
// cancellation or something to review.

const db = require('./db');
const { notify } = require('./notify');
const { nanoid } = require('nanoid');
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

const OPEN_PAY = ['awaiting_payment'];

// Starts a payment for extra work or a tip on `parent`. Returns
// { child, escrow, payment } or throws an error with .status.
async function create(parent, kind, amountUsd, extra) {
  const { generateBookingNumber, fundEscrowForContract } = require('./routes/marketplace.routes');
  const custPay = require('./customer-payments');
  const amount = money(amountUsd);
  const serviceFee = kind === 'extra' ? money((extra && extra.serviceFee) || 0) : 0;
  const now = new Date().toISOString();
  const child = {
    id: `ct_${nanoid(10)}`,
    bookingNumber: await generateBookingNumber(),
    customerId: parent.customerId,
    providerId: parent.providerId,
    topUpFor: parent.id,
    topUpKind: kind,
    scopeRequestId: (extra && extra.scopeRequestId) || null,
    service: `${kind === 'tip' ? 'Tip' : 'Extra work'}: ${String(parent.service || '').slice(0, 150)}`,
    date: parent.date || null, time: parent.time || null,
    amount, laborAmount: amount, serviceFee,
    payMethod: 'protected',
    payCurrency: parent.payCurrency || 'usd',
    status: 'awaiting_payment',
    statusAfterPayment: 'topup_paid',
    createdAt: now,
  };
  const escrow = await fundEscrowForContract(child, parent.customerId, parent.payCurrency);
  if (!escrow || escrow.status !== 'awaiting_payment') {
    // No real payment step in this country right now (test mode): nothing to
    // wait for, so it counts as paid at once, as tips and extras always did there.
    child.status = 'topup_paid'; child.paidAt = now;
    await db.insert('contracts', child);
    await applyPaid(child, escrow);
    return { child, escrow, payment: null, paidAtOnce: true };
  }
  await db.insert('contracts', child);
  return { child, escrow, payment: custPay.publicPayment(escrow) };
}

// The money for a top-up arrived. Called from customer-payments.finishPayment
// (a code confirmed, a card page paid, a wallet prompt approved), after the
// child has been marked paid.
async function applyPaid(child, escrow) {
  const parent = await db.find('contracts', c => c.id === child.topUpFor);
  const e = escrow || await db.find('escrowTransactions', x => x.contractId === child.id);
  if (!parent) return;
  if (child.topUpKind === 'tip') {
    // The tip goes out with the pro's next payout, with no commission (the
    // payout counts it from this record's tipAmount). Its money is not job
    // money, so it isn't "held" for release.
    await db.update('contracts', child.id, { tipAmount: child.amount, tipPaid: false, completedAt: new Date().toISOString() });
    if (e) await db.update('escrowTransactions', e.id, { status: 'collected', collectedAt: new Date().toISOString() });
    const customer = await db.find('users', u => u.id === child.customerId);
    await notify(child.providerId, '🌟', `${customer ? customer.name : 'The customer'} left you a $${child.amount.toFixed(2)} tip on "${parent.service}". Tips have no commission and are added to your next payout.`, 'payoutAlerts', { section: 'earnings' });
    await notify(child.customerId, '✅', `Thank you. Your $${child.amount.toFixed(2)} tip for "${parent.service}" was paid and goes to your pro in full.`, 'bookingUpdates', { section: 'bookings' });
    return;
  }
  // Extra work: the job's total goes up now that it is paid. The extra's own
  // money stays held on this record and follows the booking's money.
  if (!['active', 'disputed'].includes(parent.status) || (e && e.status !== 'held')) {
    // The booking ended while the extra was being paid: give the extra back.
    if (e && e.status === 'held') await db.update('escrowTransactions', e.id, { status: 'refunded', refundReason: 'the booking ended before the extra work was paid' });
    await db.update('contracts', child.id, { status: 'topup_refunded', cancelReason: 'Booking ended' });
    await notify(child.customerId, '↩️', `Your payment for extra work on "${parent.service}" arrived after the booking had ended, so it will be refunded.`, 'bookingUpdates', { section: 'bookings' });
    return;
  }
  const newAmount = money((parent.amount || 0) + child.amount);
  const newLabor = money((parent.laborAmount != null ? parent.laborAmount : (parent.amount || 0) - (parent.storeGoodsTotal || 0)) + child.amount);
  await db.update('contracts', parent.id, { amount: newAmount, laborAmount: newLabor, serviceFee: money((parent.serviceFee || 0) + (child.serviceFee || 0)), extraWorkPaid: money((parent.extraWorkPaid || 0) + child.amount) });
  if (child.scopeRequestId) await db.update('scopeChangeRequests', child.scopeRequestId, { status: 'approved', decidedAt: new Date().toISOString(), paidAt: new Date().toISOString(), topUpContractId: child.id });
  await notify(child.providerId, '✅', `The customer approved and paid the extra $${child.amount.toFixed(2)} for "${parent.service}". New total: $${newAmount.toFixed(2)}. Trothen holds it with the rest until the job is complete.`, null, { section: 'contracts' });
  await notify(child.customerId, '✅', `Your payment of $${money(child.amount + (child.serviceFee || 0)).toFixed(2)} for the extra work on "${parent.service}" arrived. Trothen holds it with the rest until you confirm the job is done.`, 'bookingUpdates', { section: 'bookings' });
}

// A top-up wasn't paid in time (or the customer cancelled it): it lapses.
async function lapsed(child) {
  if (child.scopeRequestId) {
    const r = await db.find('scopeChangeRequests', x => x.id === child.scopeRequestId);
    if (r && r.status === 'awaiting_payment') await db.update('scopeChangeRequests', r.id, { status: 'not_paid', decidedAt: new Date().toISOString() });
    if (r) await notify(child.providerId, 'ℹ️', `The extra $${child.amount.toFixed(2)} you asked for on "${String(child.service).replace(/^Extra work: /, '')}" wasn't paid, so the job stays at its booked price.`, null, { section: 'contracts' });
  }
}

// The booking's own money moved (completed, refunded, split, reopened):
// the paid extra work moves with it. Payments still waiting are stopped.
async function follow(parentId, to) {
  const kids = await db.filter('contracts', c => c.topUpFor === parentId && c.topUpKind === 'extra');
  for (const k of kids) {
    const e = await db.find('escrowTransactions', x => x.contractId === k.id);
    if (!e) continue;
    if (OPEN_PAY.includes(e.status) && (to === 'refunded' || to === 'released')) {
      await db.update('escrowTransactions', e.id, { status: 'payment_cancelled' });
      if (e.paidBy === 'card' && e.cardSessionId) { try { await require('./stripe-pay').expireSession(e.cardSessionId); } catch (x) { /* a late payment is refunded automatically */ } }
      await db.update('contracts', k.id, { status: 'topup_lapsed', cancelReason: 'Booking ended' });
      await lapsed(k);
      continue;
    }
    if (to === 'released' && e.status === 'held') { await db.update('escrowTransactions', e.id, { status: 'released' }); await db.update('contracts', k.id, { status: 'topup_released', completedAt: new Date().toISOString() }); }
    else if (to === 'refunded' && e.status === 'held') { await db.update('escrowTransactions', e.id, { status: 'refunded' }); await db.update('contracts', k.id, { status: 'topup_refunded', cancelReason: 'Booking refunded' }); }
    else if (to === 'held' && e.status === 'released' && !e.payoutId) { await db.update('escrowTransactions', e.id, { status: 'held' }); await db.update('contracts', k.id, { status: 'topup_paid' }); }
  }
}

// Extra work still waiting to be paid on a booking (so a second one isn't started).
async function pendingExtra(parentId) {
  return db.find('contracts', c => c.topUpFor === parentId && c.topUpKind === 'extra' && c.status === 'awaiting_payment');
}

module.exports = { create, applyPaid, lapsed, follow, pendingExtra };
