// v147: sending a pro's payout for real.
//
// Before, every payout turned to "paid" by itself 2 days after it was asked
// for, whether or not anyone had sent the money. Now:
//
//  - Finance (or a super admin) sends it and presses "Mark as sent", with
//    the transaction ID from the Mobile Money or bank receipt. The pro sees
//    the reference.
//  - A payout to an MTN Mobile Money wallet in Liberia can be sent straight
//    through Lonestar Cell MTN's MoMo system ("Send by MTN MoMo"), once its
//    disbursement keys are set and LCMMMI_INTEGRATION_ENABLED is true. MTN
//    answers later; a check every few minutes marks it paid (with MTN's
//    transaction ID) or puts it back in the queue with the reason.
//  - "Can't send" puts a note on it (wrong number, name doesn't match) and
//    tells the pro to fix their payout details; it stays in the queue.
//  - While real payments are not switched on (Admin → Tokens → Settings →
//    Real payments only), payouts still settle by themselves after 2 days,
//    as before, because no real money moved in.
const db = require('./db');
const { notify } = require('./notify');
const pm = require('./payout-methods');
const mm = require('./mobile-money');

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const local = (p) => (p.payoutAmountLocal ? ` (${p.payoutCurrency} ${p.payoutAmountLocal})` : '');

async function realPaymentsOn() {
  const { getSetting } = require('./platform-settings');
  return (await getSetting('realPaymentsOnly')) === true || (await getSetting('payoutsRequireRealPayment')) === true;
}

// Can this payout go through a Mobile Money system right now?
async function momoRoute(p) {
  const s = p.sendTo || {};
  if (pm.normalMethod(p.method) !== 'Mobile Money' || !s.network) return null;
  const pro = await db.find('users', u => u.id === p.providerId);
  const api = pro ? mm.apiFor(pro.country, s.network) : null;
  return api ? { ...api, country: pro.country } : null;
}

async function markSent(p, admin, reference) {
  const ref = String(reference || '').trim().slice(0, 60);
  if (ref.length < 4) return { error: 'Enter the transaction ID from the Mobile Money or bank receipt (at least 4 characters), so the pro and the accounts can match it.' };
  if (!['processing', 'sending'].includes(p.status)) return { error: 'This payout is not waiting to be sent.' };
  const now = new Date().toISOString();
  await db.update('payouts', p.id, { status: 'paid', paidAt: now, paidVia: 'manual', paidReference: ref, paidBy: admin.id, problem: null });
  await notify(p.providerId, '✅', `Your payout of ${money(p.amount)}${local(p)} was sent to ${p.destination || p.method}. Reference: ${ref}.`, 'payoutAlerts', { section: 'earnings' });
  return { ok: true };
}

async function markProblem(p, admin, reason) {
  const why = String(reason || '').trim().slice(0, 300);
  if (why.length < 5) return { error: 'Say what is wrong, so the pro can fix it.' };
  await db.update('payouts', p.id, { problem: { reason: why, at: new Date().toISOString(), by: admin.id } });
  await notify(p.providerId, '⚠️', `We couldn't send your payout of ${money(p.amount)} yet: ${why} Check your payout details in Settings. It will be sent as soon as that is fixed.`, 'payoutAlerts', { section: 'settings' });
  return { ok: true };
}

async function sendByMomo(p, admin) {
  if (p.status !== 'processing') return { error: 'This payout is not waiting to be sent.' };
  const route = await momoRoute(p);
  if (!route) return { error: 'This payout is not to a wallet that can be paid through a Mobile Money system. Send it by hand, then press "Mark as sent".' };
  if (!route.disbursement) return { error: `${route.name} payouts aren't switched on yet. Send it by hand from Trothen's ${route.name} account, then press "Mark as sent".` };
  const msisdn = p.sendTo && p.sendTo.number ? pm.open(p.sendTo.number) : null;
  if (!msisdn) return { error: 'The wallet number can\'t be read (it was saved with an older key). Ask the pro to enter it again.' };
  const lm = require('./liberia-momo');
  const rate = p.payoutAmountLocal && p.amount ? Number(String(p.payoutAmountLocal).replace(/[^\d.]/g, '')) / p.amount : null;
  // MTN wants the number in international form (231…), however it was typed.
  const read = mm.readNumber(String(msisdn), route.country);
  if (read.error) return { error: `The wallet number on this payout doesn't look right (${read.error}) Ask the pro to check it in their payout details.` };
  const r = await lm.requestMobileMoneyDisbursement(read.msisdn, p.amount, p.id, rate || null);
  if (!r.success) {
    await db.update('payouts', p.id, { problem: { reason: `${route.name} didn't accept it: ${r.message}`, at: new Date().toISOString(), by: admin.id } });
    return { error: `${route.name} didn't accept the payout: ${r.message}` };
  }
  await db.update('payouts', p.id, { status: 'sending', momoRef: r.referenceId, momoSentAt: new Date().toISOString(), momoAmountLocal: r.amountLrd, sentBy: admin.id, problem: null });
  return { ok: true, status: 'sending' };
}

// Every few minutes: payouts sent through MTN, did they go through?
async function sweepSending() {
  const list = await db.filter('payouts', p => p.status === 'sending' && p.momoRef);
  if (!list.length) return 0;
  const lm = require('./liberia-momo');
  let done = 0;
  for (const p of list) {
    try {
      const st = await lm.checkDisbursementStatus(p.momoRef);
      const status = String(st && st.status || '').toUpperCase();
      if (status === 'SUCCESSFUL') {
        const ref = st.financialTransactionId || p.momoRef;
        await db.update('payouts', p.id, { status: 'paid', paidAt: new Date().toISOString(), paidVia: 'mtn_momo', paidReference: ref });
        await notify(p.providerId, '✅', `Your payout of ${money(p.amount)}${local(p)} was sent to ${p.destination || 'your MTN Mobile Money'}. MTN reference: ${ref}.`, 'payoutAlerts', { section: 'earnings' });
        done++;
      } else if (status === 'FAILED' || status === 'REJECTED' || status === 'TIMEOUT') {
        const reason = (st && (st.reason || (st.reason && st.reason.message))) || status.toLowerCase();
        await db.update('payouts', p.id, { status: 'processing', momoRef: null, problem: { reason: `MTN MoMo: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`, at: new Date().toISOString() } });
        const supers = await db.filter('users', u => u.role === 'admin' && (u.isSuperAdmin || u.adminDepartment === 'financial') && u.active !== false);
        for (const a of supers) await notify(a.id, '⚠️', `An MTN MoMo payout of ${money(p.amount)} failed (${status}). It is back in Payments → Payouts being sent.`, null, { section: 'payments' });
      }
    } catch (e) { console.error('[payout-sending] status check:', e.message); }
  }
  return done;
}

module.exports = { realPaymentsOn, momoRoute, markSent, markProblem, sendByMomo, sweepSending };
