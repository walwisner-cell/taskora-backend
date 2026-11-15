// v119: how customers pay for a job while cards and in-app mobile money
// aren't available.
//
// Two ways, chosen by the customer when they book (or post a job):
//
//   PROTECTED (escrow) — the customer pays Trothen first and Trothen holds
//   the money until the customer confirms the job is done. In a country
//   where an admin has switched "payment codes" on, the customer is given a
//   one-time code and sends mobile money to Trothen's own number with the
//   code in the reference. The finance team finds it on Trothen's statement
//   and confirms it; only then is the pro asked to confirm the booking.
//   Refunds are listed for the finance team to send back. Where codes are
//   off, protected payments work as before (simulated until real payments
//   are switched on).
//
//   CASH — the customer pays the pro directly, after the work is done.
//   Trothen holds nothing, so there is no escrow and no service fee for the
//   customer; Trothen's commission is paid by the pro from their tokens
//   (see chargeCashCommission in src/tokens.js). The app says plainly that
//   a cash job is not covered by escrow.
const db = require('./db');
const { nanoid } = require('nanoid');
const { notify } = require('./notify');
const { getSetting } = require('./platform-settings');

const money = (n) => Math.round(Number(n) * 100) / 100;
const PAY_METHODS = ['protected', 'cash'];
function cleanPayMethod(v) { return PAY_METHODS.includes(v) ? v : 'protected'; }

// What a customer in this country can choose (v125).
// protectedMode is how a PROTECTED payment really works here:
//   'card'      Stripe card checkout (when the Stripe keys are set; the default then)
//   'code'      the customer sends money to one of Trothen's own accounts with a code
//   'simulated' escrow shown, no real money moves yet (until payments are connected)
//   'none'      "Real payments only" is ticked and nothing is set up here: Protected isn't offered
// v148: what the customer pays in one go. A goods order with a driver also
// carries the driver's delivery (alsoPaysUsd), so the buyer pays once.
const dueUsd = (c) => money((c.amount || 0) + (c.serviceFee || 0) + (c.alsoPaysUsd || 0));
async function optionsFor(country) {
  const tokens = require('./tokens');
  const s = await tokens.settingsFor(country);
  const all = await tokens.settings();
  const rule = (country && all.countryRules[country]) || {};
  const wanted = rule.protectedPayMode || 'auto';
  const stripeOn = require('./stripe-pay').isOn();
  let mode;
  if (wanted === 'code' && s.momoAccounts.length > 0) mode = 'code';
  else if ((wanted === 'card' || wanted === 'auto') && stripeOn) mode = 'card';
  else if (wanted === 'auto' && s.momoAccounts.length > 0 && rule.payToAccountsForJobs === true) mode = 'code';
  // v126: until real payments are connected, escrow is still offered and shown,
  // with no real money moving. Only when a super admin ticks "Real payments only"
  // is escrow hidden where no card or account is set up.
  else mode = (await getSetting('realPaymentsOnly')) === true ? 'none' : 'simulated';
  return {
    protectedMode: mode,
    cardAvailable: stripeOn,
    cashJobs: rule.cashJobs !== false && (await getSetting('cashJobsEnabled')) !== false,
    payTo: mode === 'code' ? s.momoAccounts : [],
    currency: s.currency, rate: s.rate,
  };
}
// Thrown when a protected payment is asked for where none is possible.
function noProtectedError() {
  return Object.assign(new Error('Paying through Trothen isn\'t available in your country yet. Choose "Cash to the pro after the job", or contact support.'), { status: 400, expose: true, code: 'PROTECTED_UNAVAILABLE' });
}
async function usesCodes(country) { return (await optionsFor(country)).protectedMode === 'code'; }
async function codeHours() { return Number(await getSetting('customerPaymentCodeHours')) || 24; }

// The exact amount the customer must send, in their own money, rounded UP
// to a whole unit so a payment is never short by a fraction.
function localDue(usd, currency, rate) {
  if (currency.code === 'USD') return money(usd);
  return Math.ceil(Math.round(usd * rate * 100) / 100); // round first so 12426.0000001 is not charged as 12427
}

// Called from fundEscrowForContract for a protected booking in a
// code-paying country. Returns the fields to put on the escrow record.
async function codeFieldsFor(contract, customer) {
  const tokens = require('./tokens');
  const o = await optionsFor(customer && customer.country);
  const usd = dueUsd(contract);
  return {
    status: 'awaiting_payment',
    paidBy: 'code',
    paymentCode: await tokens.newPaymentCode(),
    amountDueUsd: usd,
    amountDue: localDue(usd, o.currency, o.rate),
    dueCurrency: o.currency.code,
    payTo: o.payTo,
    paymentExpiresAt: new Date(Date.now() + (await codeHours()) * 60 * 60 * 1000).toISOString(),
  };
}

// v125: the payment fields for a protected booking in this customer's
// country: a payment code, a card checkout, nothing (test payments), or an
// error when there's no real way to pay here.
async function paymentFieldsFor(contract, customer, escrowId, rate) {
  const mf = await momoFieldsFor(contract, customer, rate); // v147: the customer's own MTN wallet first, where that system is on
  if (mf) return mf;
  const o = await optionsFor(customer && customer.country);
  if (o.protectedMode === 'code') return codeFieldsFor(contract, customer);
  if (o.protectedMode === 'card') {
    const usd = dueUsd(contract);
    const expiresAt = new Date(Date.now() + (contract.ride ? 0.5 : await codeHours()) * 60 * 60 * 1000).toISOString(); // v125: a ride's card page runs out after about half an hour
    const session = await require('./stripe-pay').createCheckout({ contract, escrowId, amountUsd: usd, customerEmail: customer && customer.email, expiresAt });
    return { status: 'awaiting_payment', paidBy: 'card', cardSessionId: session.id, cardUrl: session.url, amountDueUsd: usd, amountDue: usd, dueCurrency: 'USD', paymentExpiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : expiresAt };
  }
  if (o.protectedMode === 'none') throw noProtectedError();
  return null; // simulated: held at once (test sites only)
}

// v147: paying from the customer's own Mobile Money wallet in the app
// (MTN in Liberia, once its system is switched on). MTN sends a prompt to
// the customer's phone; nothing is held until MTN says the customer
// approved it (a check every minute or two, MTN's callback, or the
// customer's own screen asking). Declined, failed or not approved in time:
// the booking is cancelled and nothing was taken.
const MOMO_MINUTES = (contract) => (contract && contract.ride ? 10 : 30);
async function momoFieldsFor(contract, customer, rate) {
  if (!customer || !contract || contract.payMethod === 'cash') return null;
  const usd = dueUsd(contract);
  const r = await require('./mobile-money').chargeDefaultWallet(customer, usd, contract.id, rate);
  if (!r) return null;
  if (!r.success) throw Object.assign(new Error(`Mobile money charge could not be started: ${r.message}`), { status: 402, code: 'MOMO_FAILED' });
  const m = await db.find('paymentMethods', x => x.userId === customer.id && x.isDefault && x.type === 'mobile_money') || {};
  return {
    status: 'awaiting_payment', paidBy: 'momo', momoRef: r.referenceId, liberiaMoMoReference: r.referenceId,
    momoNetwork: m.network || m.brand || 'MTN Mobile Money', momoLast4: m.momoLast4 || m.last4 || null,
    amountDueUsd: usd, amountDue: Math.round(Number(r.amountLrd) || 0), dueCurrency: 'LRD',
    paymentExpiresAt: new Date(Date.now() + MOMO_MINUTES(contract) * 60 * 1000).toISOString(),
  };
}
// Ask MTN how one waiting wallet payment went, and act on it. Safe to call
// more than once and from anywhere (the sweep, the callback, the screen).
async function checkMomo(e) {
  if (!e || e.paidBy !== 'momo' || e.status !== 'awaiting_payment' || !e.momoRef) return e && e.status;
  const lm = require('./liberia-momo');
  if (!lm.isCollectionsConfigured()) return 'awaiting_payment';
  let st;
  try { st = await lm.checkCollectionStatus(e.momoRef); } catch (x) { console.error('[momo] status check:', e.id, x.message); return 'awaiting_payment'; }
  const status = String(st && st.status || '').toUpperCase();
  const fresh = await db.find('escrowTransactions', x => x.id === e.id);
  if (!fresh || fresh.status !== 'awaiting_payment') return fresh && fresh.status;
  const c = await db.find('contracts', x => x.id === e.contractId);
  if (status === 'SUCCESSFUL') {
    const ref = String(st.financialTransactionId || e.momoRef);
    const got = Number(st.amount) || e.amountDue;
    if (!c || c.status !== 'awaiting_payment') {
      // Approved after the booking ended: the money is given back by the finance team (Admin → Customer Payments → Refunds to send).
      await db.update('escrowTransactions', e.id, { status: 'refunded', receipt: ref, amountReceived: got, refundReason: 'paid after the booking was cancelled' });
      if (c) await notify(c.customerId, '↩️', `Your ${e.momoNetwork} payment for booking #${c.bookingNumber} came through after the booking had ended, so it will be sent back to your wallet.`, 'bookingUpdates', { section: 'bookings' });
      return 'refunded';
    }
    await finishPayment(e, c, { receipt: ref, amountReceived: got, confirmedByName: 'MTN MoMo' });
    return 'held';
  }
  if (status === 'FAILED' || status === 'REJECTED' || status === 'TIMEOUT' || (e.paymentExpiresAt && new Date(e.paymentExpiresAt).getTime() < Date.now() - 5 * 60 * 1000)) {
    const why = status === 'FAILED' || status === 'REJECTED' ? 'was declined or didn\'t go through' : 'wasn\'t approved in time';
    await endUnpaid(e, 'expired', `Your ${e.momoNetwork} payment for booking #${c ? c.bookingNumber : ''} ${why}, so nothing was taken and the booking was cancelled. Book again if you still need it.`, { momoStatus: status || 'NO_ANSWER' });
    return 'payment_expired';
  }
  return 'awaiting_payment';
}
async function sweepMomo() {
  const list = await db.filter('escrowTransactions', e => e.paidBy === 'momo' && e.status === 'awaiting_payment' && e.momoRef);
  let n = 0;
  for (const e of list) { const s = await checkMomo(e); if (s !== 'awaiting_payment') n++; }
  return n;
}
// MTN's callback names a reference; it is never trusted on its own: MTN is asked.
async function momoCallback(referenceId, externalId) {
  const ref = String(referenceId || '').slice(0, 80), ext = String(externalId || '').slice(0, 80);
  if (!ref && !ext) return null;
  const e = await db.find('escrowTransactions', x => x.paidBy === 'momo' && x.status === 'awaiting_payment' && ((ref && x.momoRef === ref) || (ext && x.contractId === ext)));
  return e ? checkMomo(e) : null;
}

// v125: what to tell the customer to do to pay, for a code or a card.
function howToPayWords(e) {
  if (!e) return 'pay in My Bookings.';
  if (e.paidBy === 'momo') return `approve the ${e.momoNetwork} payment of LRD ${Number(e.amountDue).toLocaleString()} on your phone${e.momoLast4 ? ` (the number ending ${e.momoLast4})` : ''}: enter your PIN when the prompt appears. Nothing is booked until you approve it.`;
  if (e.paidBy === 'card') return `pay $${Number(e.amountDueUsd).toFixed(2)} by card: open My Bookings and press Pay now. Nothing is booked until you pay.`;
  return `send ${e.dueCurrency} ${Number(e.amountDue).toLocaleString()} to ${(e.payTo || []).map(a => `${a.network} ${a.number} (${a.accountName})`).join(' or ')} with code ${e.paymentCode} in the reference, then press "I have sent it" in My Bookings.`;
}

function publicPayment(e) {
  if (e && e.paidBy === 'momo') return { method: 'momo', contractId: e.contractId, status: e.status, network: e.momoNetwork, last4: e.momoLast4, amountDue: e.amountDue, currency: e.dueCurrency, amountDueUsd: e.amountDueUsd, expiresAt: e.paymentExpiresAt, receipt: e.receipt || null };
  if (e && e.paidBy === 'card') return { method: 'card', url: e.cardUrl, status: e.status, amountDue: e.amountDue, currency: 'USD', amountDueUsd: e.amountDueUsd, expiresAt: e.paymentExpiresAt, receipt: e.receipt || null };
  if (!e || e.paidBy !== 'code') return null;
  return { method: 'code', code: e.paymentCode, status: e.status, amountDue: e.amountDue, currency: e.dueCurrency, amountDueUsd: e.amountDueUsd, payTo: e.payTo || [], expiresAt: e.paymentExpiresAt, customerSaysPaidAt: e.customerSaysPaidAt || null, customerTransactionId: e.customerTransactionId || null, receipt: e.receipt || null };
}

async function findAwaiting(contractId, customerId) {
  const c = await db.find('contracts', x => x.id === contractId && x.customerId === customerId);
  if (!c) return { error: { status: 404, error: 'Booking not found.' } };
  const e = await db.find('escrowTransactions', x => x.contractId === c.id);
  if (!e || e.paidBy !== 'code') return { error: { status: 400, error: 'This booking isn\'t paid with a payment code.' } };
  return { c, e };
}

// The customer says they have sent the money. This only alerts the team.
async function customerReportsPaid(customer, contractId, transactionId) {
  const { c, e, error } = await findAwaiting(contractId, customer.id);
  if (error) return error;
  if (e.status !== 'awaiting_payment' || c.status !== 'awaiting_payment') return { status: 400, error: 'This booking isn\'t waiting for a payment.' };
  if (e.customerSaysPaidAt) return { status: 400, error: 'You have already told us. The team is checking it.' };
  const tx = typeof transactionId === 'string' ? transactionId.trim() : '';
  if (tx && (tx.length < 4 || tx.length > 60)) return { status: 400, error: 'The transaction ID should be 4 to 60 characters, as shown in your mobile money message.' };
  await db.update('escrowTransactions', e.id, { customerSaysPaidAt: new Date().toISOString(), customerTransactionId: tx || null });
  const team = await db.filter('users', u => u.role === 'admin' && u.active !== false && (u.isSuperAdmin || ['financial', 'accountant', 'controller'].includes(u.adminDepartment) || require('./admin-permissions').customCan(u, 'custpay', 'confirm'))); // v135
  for (const a of team) await notify(a.id, '💳', `${customer.name} says they paid booking #${c.bookingNumber} with code ${e.paymentCode} (${e.dueCurrency} ${e.amountDue}${tx ? `, their transaction ID ${tx}` : ''}). Check Trothen's mobile money statement and confirm it in Admin → Customer Payments.`, null, { section: 'custpay' });
  return { ok: true };
}

// Finance: the money is on Trothen's statement.
// v149 audit: one confirmation at a time for a code or a transaction ID, so two
// finance staff pressing Confirm together can't use one receipt twice.
const confirming = new Set();
async function confirm(admin, code, transactionId, amountReceived) {
  const k1 = 'c:' + String(code || '').trim().toUpperCase(), k2 = 't:' + String(transactionId || '').trim().toLowerCase();
  if (confirming.has(k1) || confirming.has(k2)) return { status: 409, error: 'This payment is being confirmed by someone else right now. Refresh in a moment.' };
  confirming.add(k1); confirming.add(k2);
  // v153: the booking itself is locked too, so the "not paid in time" timer can't cancel it at the same moment
  const e0 = await db.find('escrowTransactions', x => x.paymentCode === String(code || '').trim().toUpperCase() && x.paidBy === 'code');
  const { contractStatusLocks } = require('./contract-locks');
  const lockId = e0 && e0.contractId;
  if (lockId && contractStatusLocks.has(lockId)) { confirming.delete(k1); confirming.delete(k2); return { status: 409, error: 'This booking is being updated right now. Refresh in a moment.' }; }
  if (lockId) contractStatusLocks.add(lockId);
  try { return await confirmOnce(admin, code, transactionId, amountReceived); } finally { confirming.delete(k1); confirming.delete(k2); if (lockId) contractStatusLocks.delete(lockId); }
}
async function confirmOnce(admin, code, transactionId, amountReceived) {
  const c0 = String(code || '').trim().toUpperCase();
  const e = await db.find('escrowTransactions', x => x.paymentCode === c0 && x.paidBy === 'code');
  if (!e) return { status: 404, error: `No customer payment with code ${c0}.` };
  if (e.status !== 'awaiting_payment') return { status: 409, error: `Code ${c0} is already ${e.status.replace(/_/g, ' ')}.` };
  const c = await db.find('contracts', x => x.id === e.contractId);
  if (!c || c.status !== 'awaiting_payment') return { status: 409, error: 'This booking is no longer waiting for payment (it may have been cancelled or run out). If the money arrived anyway, refund it to the customer.' };
  const tx = typeof transactionId === 'string' ? transactionId.trim() : '';
  if (tx.length < 4 || tx.length > 60) return { status: 400, error: 'Enter the transaction ID shown on Trothen\'s mobile money statement.' };
  const used = await db.find('escrowTransactions', x => x.receipt && x.receipt.toLowerCase() === tx.toLowerCase())
    || await db.find('tokenPurchases', x => x.receipt && x.receipt.toLowerCase() === tx.toLowerCase());
  if (used) return { status: 409, error: `Transaction ${tx} has already been used for another payment.` };
  const got = Number(amountReceived);
  if (!Number.isFinite(got) || got <= 0) return { status: 400, error: `Enter the amount that arrived (${e.dueCurrency}).` };
  if (got + 0.009 < e.amountDue) return { status: 400, code: 'UNDERPAID', error: `Only ${got} arrived but the booking needs ${e.amountDue}. Don't confirm it: ask the customer to send the rest, or cancel the booking and refund what arrived.` };
  return finishPayment(e, c, { receipt: tx, amountReceived: got, confirmedBy: admin.id, confirmedByName: admin.name });
}

// v125: the money for a booking really arrived (finance confirmed a code,
// or Stripe confirmed a card payment). Holds it and moves the booking on.
async function finishPayment(e, c, opts) {
  // v160: money for extra work or a tip is recorded while its booking is held, never during a Complete or Cancel of that booking
  if (c && c.topUpFor) return require('./contract-locks').waitAndHold(c.topUpFor, () => finishPaymentNow(e, c, opts));
  return finishPaymentNow(e, c, opts);
}
async function finishPaymentNow(e, c, { receipt, amountReceived, confirmedBy, confirmedByName }) {
  const got = amountReceived, tx = receipt;
  const now = new Date().toISOString();
  await db.update('escrowTransactions', e.id, { status: 'held', receipt: tx, amountReceived: got, overpaid: got > e.amountDue + 0.009 ? money(got - e.amountDue) : 0, confirmedBy: confirmedBy || null, confirmedByName: confirmedByName || null, confirmedAt: now });
  const next = c.statusAfterPayment || 'pending_provider_confirmation';
  const patch = { status: next, paidAt: now };
  if (next === 'pending_provider_confirmation') {
    // The pro gets the same time to answer as they would have had at booking.
    const window = c.providerResponseDeadline && c.createdAt ? Math.max(60 * 60 * 1000, new Date(c.providerResponseDeadline).getTime() - new Date(c.createdAt).getTime()) : 4 * 60 * 60 * 1000;
    let until = Date.now() + window;
    // v156: never after the job is due to start (15 minutes at the least), the same rule as at booking
    const start = require('./booking-rules').jobStart(c.date, c.time, null);
    if (start && Number.isFinite(start.getTime())) until = Math.min(until, Math.max(Date.now() + 15 * 60 * 1000, start.getTime()));
    patch.providerResponseDeadline = new Date(until).toISOString();
  }
  if (next === 'active') {
    patch.signedAt = now.slice(0, 10);
    if (e.materialsAdvanceAmount > 0) await db.update('escrowTransactions', e.id, { materialsAdvanceReleased: true });
  }
  const updated = await db.update('contracts', c.id, patch);
  if (c.topUpFor) { await require('./top-ups').applyPaid(updated, { ...e, status: 'held' }); return { ok: true, contract: updated }; } // v157: extra work or a tip
  if (c.storeOrder || c.delivery) { // v148: goods orders and deliveries have their own messages and next steps
    await require('./routes/orders.routes').afterPaid(updated, { ...e, receipt: tx, amountReceived: got });
    return { ok: true, contract: updated };
  }
  await notify(c.customerId, '✅', `We received your payment for booking #${c.bookingNumber} (${e.paidBy === 'card' ? `$${Number(got).toFixed(2)} by card` : `${e.dueCurrency} ${got}`}). Trothen is holding it safely until you confirm the job is done.${next === 'pending_provider_confirmation' ? ' Your pro has been asked to confirm.' : ''}`, 'bookingUpdates', { section: 'bookings' });
  if (next === 'pending_provider_confirmation') {
    const by = require('./booking-rules').whenFor(patch.providerResponseDeadline, await db.find('users', u => u.id === c.providerId)); // v158
    await notify(c.providerId, '📋', `New paid booking: "${c.service}" on ${c.date || 'a date to agree'}. The customer has paid and Trothen is holding the money. Confirm by ${by} or it is cancelled and refunded.`, null, { section: 'bookings' });
  } else {
    await notify(c.providerId, '✅', `The customer paid for "${c.service}". Trothen is holding the money; the job is now active.`, null, { section: 'contracts' });
  }
  return { ok: true, contract: updated };
}

// v125: Stripe says a Checkout page was paid. Safe to call more than once.
async function confirmCardSession(session) {
  if (!session || session.payment_status !== 'paid') return { ok: false, status: 'unpaid' };
  const escrowId = session.metadata && session.metadata.escrowId;
  // Trothen's own payment record (named on the Stripe page) first; the page id only as a fallback.
  const e = (escrowId && await db.find('escrowTransactions', x => x.paidBy === 'card' && x.id === escrowId && x.cardSessionId === session.id))
    || await db.find('escrowTransactions', x => x.paidBy === 'card' && x.cardSessionId === session.id && x.status === 'awaiting_payment');
  if (!e) return { ok: false, status: 'unknown' };
  if (e.status !== 'awaiting_payment') {
    // v125: the booking was cancelled or ran out, but the card was charged anyway: give it back.
    if (['payment_cancelled', 'payment_expired', 'payment_rejected'].includes(e.status) && !e.receipt) {
      await db.update('escrowTransactions', e.id, { status: 'refunded', receipt: session.payment_intent, amountReceived: money((session.amount_total || 0) / 100), refundReason: 'paid after the booking was cancelled' });
      try { await sweepCardRefunds(); } catch (x) { /* the 5-minute sweep tries again */ }
      return { ok: false, status: 'refunding' };
    }
    return { ok: true, status: 'already' };
  }
  const c = await db.find('contracts', x => x.id === e.contractId);
  const got = money((session.amount_total || 0) / 100);
  if (!c || c.status !== 'awaiting_payment' || got + 0.009 < e.amountDueUsd) {
    // Paid, but the booking was cancelled meanwhile (or paid short): give it back.
    await db.update('escrowTransactions', e.id, { status: 'refunded', receipt: session.payment_intent, amountReceived: got, refundReason: !c || c.status !== 'awaiting_payment' ? 'booking no longer waiting for payment' : 'paid less than due' });
    try { await sweepCardRefunds(); } catch (x) { /* the 5-minute sweep tries again */ }
    return { ok: false, status: 'refunding' };
  }
  await finishPayment(e, c, { receipt: session.payment_intent, amountReceived: got, confirmedByName: 'Stripe' });
  return { ok: true, status: 'paid' };
}
// The customer came back from Stripe: ask Stripe directly, in case the webhook is late.
async function cardStatus(contractId, customerId) {
  const c = await db.find('contracts', x => x.id === contractId && x.customerId === customerId);
  if (!c) return { status: 404, error: 'Booking not found' };
  const e = await db.find('escrowTransactions', x => x.contractId === c.id && (x.paidBy === 'card' || x.paidBy === 'momo'));
  if (!e) return { status: 404, error: 'No card payment for this booking' };
  if (e.paidBy === 'momo') await checkMomo(e); // v147
  else if (e.status === 'awaiting_payment' && e.cardSessionId) {
    const session = await require('./stripe-pay').getSession(e.cardSessionId);
    await confirmCardSession(session);
  }
  const now = await db.find('escrowTransactions', x => x.id === e.id);
  const cNow = await db.find('contracts', x => x.id === c.id);
  return { ok: true, paid: now.status !== 'awaiting_payment' && now.status !== 'payment_expired', escrowStatus: now.status, bookingStatus: cNow.status, bookingNumber: cNow.bookingNumber, isRide: !!cNow.ride, isOrder: !!(cNow.storeOrder || cNow.delivery) };
}
// Card refunds go back to the card by themselves. Runs every few minutes;
// the idempotency key means a refund is never sent twice.
async function sweepCardRefunds() {
  const sp = require('./stripe-pay');
  if (!process.env.STRIPE_SECRET_KEY) return 0;
  const rows = await db.filter('escrowTransactions', e => (e.paidBy === 'card' || (e.paidBy === 'order' && e.parentPaidBy === 'card')) && e.receipt && !e.refundSentAt && !e.refundNotNeeded && (e.status === 'refunded' || (e.refundedAmount || 0) > 0));
  let n = 0;
  for (const e of rows) {
    const full = e.status === 'refunded';
    // v148: an order paid together with its delivery gives back each part on its own
    const usd = full ? money(e.alsoPaysUsd || e.paidBy === 'order' ? (e.originalAmount || e.amount) + (e.serviceFee || 0) : (e.amountReceived || ((e.originalAmount || e.amount) + (e.serviceFee || 0)))) : money(e.refundedAmount);
    if (!(usd > 0)) continue;
    try {
      const r = await sp.refund(e.receipt, Math.round(usd * 100), `refund-${e.id}-${Math.round(usd * 100)}`);
      await db.update('escrowTransactions', e.id, { refundSentAt: new Date().toISOString(), refundSentTx: r.id, refundSentByName: 'Stripe', refundError: null });
      const c = await db.find('contracts', x => x.id === e.contractId);
      if (c) await notify(c.customerId, '↩️', `$${usd.toFixed(2)} for booking #${c.bookingNumber} has been refunded to your card. Banks usually show it within 5 to 10 days.`, 'bookingUpdates', { section: 'bookings' });
      n++;
    } catch (x) {
      await db.update('escrowTransactions', e.id, { refundError: String(x.message || x).slice(0, 300) });
      console.error('[card refunds] failed:', e.id, x.message);
    }
  }
  return n;
}

// No payment found for this code: the booking is cancelled.
async function reject(admin, code, reason) {
  const c0 = String(code || '').trim().toUpperCase();
  const e = await db.find('escrowTransactions', x => x.paymentCode === c0 && x.paidBy === 'code');
  if (!e) return { status: 404, error: `No customer payment with code ${c0}.` };
  if (e.status !== 'awaiting_payment') return { status: 409, error: `Code ${c0} is already ${e.status.replace(/_/g, ' ')}.` };
  if (typeof reason !== 'string' || reason.trim().length < 5) return { status: 400, error: 'Say why, in at least 5 characters. The customer sees this.' };
  await endUnpaid(e, 'rejected', `We couldn't find a payment for your booking with code ${e.paymentCode}: ${reason.trim()}. The booking has been cancelled. If you did send money, contact support with your transaction ID.`, { rejectReason: reason.trim().slice(0, 300), rejectedBy: admin.id });
  return { ok: true };
}

// The customer cancels before paying, or the code runs out.
async function endUnpaid(e, why, message, extra) {
  await db.update('escrowTransactions', e.id, { status: why === 'rejected' ? 'payment_rejected' : 'payment_expired', ...(extra || {}) });
  const c = await db.find('contracts', x => x.id === e.contractId);
  if (!c || c.status !== 'awaiting_payment') return;
  if (c.topUpFor) { // v157: an extra or a tip that wasn't paid just lapses; the booking carries on
    await db.update('contracts', c.id, { status: 'topup_lapsed', cancelReason: 'Not paid' }); // v158: never counted as a cancellation
    await require('./top-ups').lapsed(c);
    await notify(c.customerId, '⌛', `Your payment for "${c.service}" wasn't made in time, so it was dropped. Nothing was charged, and the booking itself carries on as before.`, 'bookingUpdates', { section: 'bookings' });
    return;
  }
  await db.update('contracts', c.id, { status: 'cancelled', cancelledByRole: 'system', cancelReason: 'Not paid', cancelledAt: new Date().toISOString() });
  try { await require('./store').giveBackStock(c); } catch (x) { /* nothing held */ }
  if (c.marketListingId) { const l = await db.find('marketListings', x => x.id === c.marketListingId); if (l && l.status === 'reserved' && l.reservedForOrderId === c.id) await db.update('marketListings', l.id, { status: 'live', reservedForOrderId: null }); } // v148
  try { await require('./loyalty').givePointsBack(c); } catch (x) { /* none */ }
  if (c.jobId) { const job = await db.find('jobs', j => j.id === c.jobId); if (job && job.status === 'matched') await db.update('jobs', job.id, { status: 'open' }); }
  await notify(c.customerId, '⌛', c.storeOrder ? String(message).replace(/booking/g, 'order').replace(/Book again/g, 'Order again') : message, 'bookingUpdates', { section: c.storeOrder ? 'orders' : 'bookings' });
}
// v158: one reminder before a payment code or card page runs out (when about
// a quarter of the time is left, at least 30 minutes before). A customer who
// meant to pay later used to find the booking simply cancelled.
const remindUnpaid = require('./single-flight').singleFlight(async function remindUnpaid(now) { // v160: never two runs at once
  const list = await db.filter('escrowTransactions', e => ['code', 'card'].includes(e.paidBy) && e.status === 'awaiting_payment' && !e.customerSaysPaidAt && !e.payReminderAt && e.paymentExpiresAt && e.createdAt);
  for (const e of list) {
    const end = Date.parse(e.paymentExpiresAt), start = Date.parse(e.createdAt);
    if (!Number.isFinite(end) || !Number.isFinite(start)) continue;
    const left = end - now, span = end - start;
    if (left <= 0 || left > Math.max(30 * 60 * 1000, span / 4) || span < 60 * 60 * 1000) continue;
    const c = await db.find('contracts', x => x.id === e.contractId);
    if (!c || c.status !== 'awaiting_payment') continue;
    await db.update('escrowTransactions', e.id, { payReminderAt: new Date(now).toISOString() });
    const cust = await db.find('users', u => u.id === c.customerId);
    const by = require('./booking-rules').whenFor(e.paymentExpiresAt, cust);
    const what = c.topUpFor ? `your payment for "${c.service}"` : c.storeOrder ? `order #${c.bookingNumber}` : `booking #${c.bookingNumber} ("${c.service}")`;
    const after = c.topUpFor ? 'it is dropped' : c.storeOrder ? 'the order is cancelled' : 'the booking is cancelled';
    await notify(c.customerId, '⏳', `Reminder: ${what} isn't paid yet. ${e.paidBy === 'code' ? `Send it with code ${e.paymentCode}` : 'Pay on the card page'} by ${by}, or ${after}. Open it from ${c.storeOrder ? 'My Orders' : 'My Bookings'} with Pay now.`, 'bookingUpdates', { section: c.storeOrder ? 'orders' : 'bookings' });
  }
});
async function expireUnpaid() {
  const now = Date.now();
  try { await remindUnpaid(now); } catch (e) { console.error('[custpay] reminders:', e.message); } // v158
  const due = await db.filter('escrowTransactions', e => e.paidBy === 'code' && e.status === 'awaiting_payment' && !e.customerSaysPaidAt && e.paymentExpiresAt && new Date(e.paymentExpiresAt).getTime() < now);
  // v125: card pages that ran out. Ask Stripe first, in case it was paid and the webhook was missed.
  const cardDue = await db.filter('escrowTransactions', e => e.paidBy === 'card' && e.status === 'awaiting_payment' && e.paymentExpiresAt && new Date(e.paymentExpiresAt).getTime() < now);
  for (const e of cardDue) {
    try {
      const sp = require('./stripe-pay');
      const session = e.cardSessionId ? await sp.getSession(e.cardSessionId) : null;
      if (session && session.payment_status === 'paid') { await confirmCardSession(session); continue; }
      if (session && session.status === 'open') { try { await sp.expireSession(e.cardSessionId); } catch (x) { /* already closed */ } }
      await endUnpaid(e, 'expired', 'Your booking was cancelled because it wasn\'t paid in time. Nothing was charged. Book again if you still need it.');
    } catch (x) { console.error('[customer-payments] card expire failed:', e.id, x.message); }
  }
  try { await sweepCardRefunds(); } catch (x) { console.error('[card refunds] sweep failed:', x.message); }
  try { await sweepMomo(); } catch (x) { console.error('[momo] sweep failed:', x.message); } // v147
  for (const e0 of due) {
    // v153: not while finance is confirming it or the customer is answering, and only if it is still unpaid now
    try {
      await require('./contract-locks').whenFree(e0.contractId, async () => {
        const e = await db.find('escrowTransactions', x => x.id === e0.id);
        if (!e || e.status !== 'awaiting_payment' || e.customerSaysPaidAt) return;
        await endUnpaid(e, 'expired', `Your booking with payment code ${e.paymentCode} was cancelled because no payment was reported in time. If you already sent the money, contact support with your transaction ID.`);
      });
    } catch (x) { console.error('[customer-payments] expire failed:', e0.id, x.message); }
  }
  // v125: a price the pro accepted that the customer never paid (test-mode
  // countries; payment-code countries are handled above).
  const unpaid = await db.filter('contracts', c => c.status === 'awaiting_payment' && c.paymentDueAt && new Date(c.paymentDueAt).getTime() < now);
  for (const c of unpaid) {
    try {
      if (await db.find('escrowTransactions', e => e.contractId === c.id)) continue;
      await db.update('contracts', c.id, { status: 'cancelled', cancelledByRole: 'system', cancelReason: 'Not paid', cancelledAt: new Date().toISOString() });
      try { await require('./store').giveBackStock(c); } catch (x) { /* nothing held */ }
  if (c.marketListingId) { const l = await db.find('marketListings', x => x.id === c.marketListingId); if (l && l.status === 'reserved' && l.reservedForOrderId === c.id) await db.update('marketListings', l.id, { status: 'live', reservedForOrderId: null }); } // v148
      if (c.jobId) { const job = await db.find('jobs', j => j.id === c.jobId); if (job && job.status === 'matched') await db.update('jobs', job.id, { status: 'open' }); }
      await notify(c.customerId, '⌛', `Your booking for "${c.service}" was cancelled because it wasn't paid in time. Nothing was charged. Book again if you still need it.`, 'bookingUpdates', { section: 'bookings' });
      await notify(c.providerId, '⌛', `The customer didn't pay for "${c.service}" in time, so the booking was cancelled.`, null, { section: 'contracts' });
    } catch (x) { console.error('[customer-payments] unpaid expire failed:', c.id, x.message); }
  }
  return due.length + unpaid.length;
}

// Refunds the finance team must send back by mobile money: payments that
// came in by code and were later refunded (in full or, after a split
// dispute, in part), and not yet marked as sent.
async function refundsToSend() {
  // v148: a delivery paid together with its goods order (paidBy 'order') is listed on its own, with the order's payment details.
  const rows = await db.filter('escrowTransactions', e => (e.paidBy === 'code' || e.paidBy === 'momo' || (e.paidBy === 'order' && e.parentPaidBy !== 'card')) && e.receipt && !e.refundSentAt && !e.refundNotNeeded && (e.status === 'refunded' || (e.refundedAmount || 0) > 0));
  return rows.map(e => {
    const full = e.status === 'refunded';
    const usd = full ? money((e.originalAmount || e.amount) + (e.serviceFee || 0)) : money(e.refundedAmount);
    const rate = e.amountDue / (e.amountDueUsd || 1);
    const local = full && !e.alsoPaysUsd && e.paidBy !== 'order' ? (e.amountReceived || e.amountDue) : (e.dueCurrency === 'USD' ? usd : Math.round(usd * rate));
    return { escrowId: e.id, contractId: e.contractId, code: e.paymentCode || (e.paidBy === 'momo' ? `${e.momoNetwork || 'MoMo'} ••${e.momoLast4 || ''}` : null), full, amountUsd: usd, amountLocal: local, currency: e.dueCurrency, receivedWith: e.receipt };
  });
}
async function markRefundSent(admin, escrowId, transactionId) {
  const e = await db.find('escrowTransactions', x => x.id === escrowId && (x.paidBy === 'code' || x.paidBy === 'momo' || x.paidBy === 'order'));
  if (!e) return { status: 404, error: 'Payment not found.' };
  if (e.refundSentAt) return { status: 409, error: 'This refund is already marked as sent.' };
  const tx = typeof transactionId === 'string' ? transactionId.trim() : '';
  if (tx.length < 4 || tx.length > 60) return { status: 400, error: 'Enter the transaction ID of the mobile money refund you sent.' };
  await db.update('escrowTransactions', e.id, { refundSentAt: new Date().toISOString(), refundSentTx: tx, refundSentBy: admin.id, refundSentByName: admin.name });
  const c = await db.find('contracts', x => x.id === e.contractId);
  if (c) await notify(c.customerId, '↩️', `Your refund for booking #${c.bookingNumber} has been sent to your mobile money (transaction ${tx}).`, 'bookingUpdates', { section: 'bookings' });
  return { ok: true };
}

// Job-board hires: when the first pro doesn't confirm, the money the
// customer already sent moves to the next pro's booking instead of being
// refunded and paid again. Returns the new escrow, or null.
async function transferToReassignment(job, newContract) {
  const prior = (await db.filter('contracts', c => c.jobId === job.id && c.id !== newContract.id)).map(c => c.id);
  const old = (await db.filter('escrowTransactions', e => prior.includes(e.contractId) && (e.paidBy === 'code' || e.paidBy === 'card' || e.paidBy === 'momo') && e.status === 'refunded' && e.receipt && !e.refundSentAt && !e.refundNotNeeded))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (!old) return null;
  const esc = {
    ...old,
    id: `esc_${nanoid(10)}`, contractId: newContract.id, status: 'held',
    amount: newContract.amount, serviceFee: newContract.serviceFee || 0,
    transferredFrom: old.id, createdAt: new Date().toISOString(),
  };
  delete esc.updatedAt;
  await db.insert('escrowTransactions', esc);
  await db.update('escrowTransactions', old.id, { refundNotNeeded: true, transferredTo: esc.id });
  return esc;
}

module.exports = { momoFieldsFor, checkMomo, sweepMomo, momoCallback, howToPayWords, PAY_METHODS, cleanPayMethod, optionsFor, noProtectedError, paymentFieldsFor, confirmCardSession, cardStatus, sweepCardRefunds, usesCodes, codeFieldsFor, publicPayment, customerReportsPaid, confirm, reject, expireUnpaid, refundsToSend, markRefundSent, transferToReassignment, localDue };
