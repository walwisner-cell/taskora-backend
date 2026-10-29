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

// What a customer in this country can choose.
async function optionsFor(country) {
  const tokens = require('./tokens');
  const s = await tokens.settingsFor(country);
  const all = await tokens.settings();
  const rule = (country && all.countryRules[country]) || {};
  const codesOn = rule.protectedPayMode === 'code' && s.momoAccounts.length > 0;
  return {
    protectedMode: codesOn ? 'code' : 'simulated',
    cashJobs: rule.cashJobs !== false && (await getSetting('cashJobsEnabled')) !== false,
    payTo: codesOn ? s.momoAccounts : [],
    currency: s.currency, rate: s.rate,
  };
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
  const usd = money((contract.amount || 0) + (contract.serviceFee || 0));
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

function publicPayment(e) {
  if (!e || e.paidBy !== 'code') return null;
  return { code: e.paymentCode, status: e.status, amountDue: e.amountDue, currency: e.dueCurrency, amountDueUsd: e.amountDueUsd, payTo: e.payTo || [], expiresAt: e.paymentExpiresAt, customerSaysPaidAt: e.customerSaysPaidAt || null, customerTransactionId: e.customerTransactionId || null, receipt: e.receipt || null };
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
  const team = await db.filter('users', u => u.role === 'admin' && u.active !== false && (u.isSuperAdmin || ['financial', 'accountant', 'controller'].includes(u.adminDepartment)));
  for (const a of team) await notify(a.id, '💳', `${customer.name} says they paid booking #${c.bookingNumber} with code ${e.paymentCode} (${e.dueCurrency} ${e.amountDue}${tx ? `, their transaction ID ${tx}` : ''}). Check Trothen's mobile money statement and confirm it in Admin → Customer Payments.`, null, { section: 'custpay' });
  return { ok: true };
}

// Finance: the money is on Trothen's statement.
async function confirm(admin, code, transactionId, amountReceived) {
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
  const now = new Date().toISOString();
  await db.update('escrowTransactions', e.id, { status: 'held', receipt: tx, amountReceived: got, overpaid: got > e.amountDue + 0.009 ? money(got - e.amountDue) : 0, confirmedBy: admin.id, confirmedByName: admin.name, confirmedAt: now });
  const next = c.statusAfterPayment || 'pending_provider_confirmation';
  const patch = { status: next, paidAt: now };
  if (next === 'pending_provider_confirmation') {
    // The pro gets the same time to answer as they would have had at booking.
    const window = c.providerResponseDeadline && c.createdAt ? Math.max(60 * 60 * 1000, new Date(c.providerResponseDeadline).getTime() - new Date(c.createdAt).getTime()) : 4 * 60 * 60 * 1000;
    patch.providerResponseDeadline = new Date(Date.now() + window).toISOString();
  }
  if (next === 'active') {
    patch.signedAt = now.slice(0, 10);
    if (e.materialsAdvanceAmount > 0) await db.update('escrowTransactions', e.id, { materialsAdvanceReleased: true });
  }
  const updated = await db.update('contracts', c.id, patch);
  await notify(c.customerId, '✅', `We received your payment for booking #${c.bookingNumber} (${e.dueCurrency} ${got}). Trothen is holding it safely until you confirm the job is done.${next === 'pending_provider_confirmation' ? ' Your pro has been asked to confirm.' : ''}`, 'bookingUpdates', { section: 'bookings' });
  if (next === 'pending_provider_confirmation') {
    const by = new Date(patch.providerResponseDeadline).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
    await notify(c.providerId, '📋', `New paid booking: "${c.service}" on ${c.date || 'a date to agree'}. The customer has paid and Trothen is holding the money. Confirm by ${by} or it is cancelled and refunded.`, null, { section: 'bookings' });
  } else {
    await notify(c.providerId, '✅', `The customer paid for "${c.service}". Trothen is holding the money; the job is now active.`, null, { section: 'contracts' });
  }
  return { ok: true, contract: updated };
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
  await db.update('contracts', c.id, { status: 'cancelled', cancelledByRole: 'system', cancelReason: 'Not paid', cancelledAt: new Date().toISOString() });
  try { await require('./store').giveBackStock(c); } catch (x) { /* nothing held */ }
  try { await require('./loyalty').givePointsBack(c); } catch (x) { /* none */ }
  if (c.jobId) { const job = await db.find('jobs', j => j.id === c.jobId); if (job && job.status === 'matched') await db.update('jobs', job.id, { status: 'open' }); }
  await notify(c.customerId, '⌛', message, 'bookingUpdates', { section: 'bookings' });
}
async function expireUnpaid() {
  const now = Date.now();
  const due = await db.filter('escrowTransactions', e => e.paidBy === 'code' && e.status === 'awaiting_payment' && !e.customerSaysPaidAt && e.paymentExpiresAt && new Date(e.paymentExpiresAt).getTime() < now);
  for (const e of due) {
    try { await endUnpaid(e, 'expired', `Your booking with payment code ${e.paymentCode} was cancelled because no payment was reported in time. If you already sent the money, contact support with your transaction ID.`); }
    catch (x) { console.error('[customer-payments] expire failed:', e.id, x.message); }
  }
  return due.length;
}

// Refunds the finance team must send back by mobile money: payments that
// came in by code and were later refunded (in full or, after a split
// dispute, in part), and not yet marked as sent.
async function refundsToSend() {
  const rows = await db.filter('escrowTransactions', e => e.paidBy === 'code' && e.receipt && !e.refundSentAt && !e.refundNotNeeded && (e.status === 'refunded' || (e.refundedAmount || 0) > 0));
  return rows.map(e => {
    const full = e.status === 'refunded';
    const usd = full ? money((e.originalAmount || e.amount) + (e.serviceFee || 0)) : money(e.refundedAmount);
    const local = full ? (e.amountReceived || e.amountDue) : (e.dueCurrency === 'USD' ? usd : Math.round(usd * (e.amountDue / (e.amountDueUsd || 1))));
    return { escrowId: e.id, contractId: e.contractId, code: e.paymentCode, full, amountUsd: usd, amountLocal: local, currency: e.dueCurrency, receivedWith: e.receipt };
  });
}
async function markRefundSent(admin, escrowId, transactionId) {
  const e = await db.find('escrowTransactions', x => x.id === escrowId && x.paidBy === 'code');
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
  const old = (await db.filter('escrowTransactions', e => prior.includes(e.contractId) && e.paidBy === 'code' && e.status === 'refunded' && e.receipt && !e.refundSentAt && !e.refundNotNeeded))
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

module.exports = { PAY_METHODS, cleanPayMethod, optionsFor, usesCodes, codeFieldsFor, publicPayment, customerReportsPaid, confirm, reject, expireUnpaid, refundsToSend, markRefundSent, transferToReassignment, localDue };
