// v119: customer payments by code (protected jobs) — what customers and
// the finance team can do. The rules live in src/customer-payments.js.
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const cp = require('../customer-payments');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many tries. Please wait a minute.' } });

// GET /api/customer-payments/options — what this customer can choose when booking.
router.get('/customer-payments/options', requireAuth, requireRole('customer'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const o = await cp.optionsFor(me && me.country);
  res.json({ protectedMode: o.protectedMode, cardAvailable: o.cardAvailable, cashJobs: o.cashJobs, payTo: o.payTo, currency: { code: o.currency.code, symbol: o.currency.symbol } });
});

// GET /api/customer-payments/cash-check?providerId=&amount= (v121)
// Yes or no: can this pro take a cash job of this price right now? Only
// the answer is returned, never the pro's token balance.
router.get('/customer-payments/cash-check', requireAuth, requireRole('customer'), async (req, res) => {
  const providerId = String(req.query.providerId || '');
  const amount = Number(req.query.amount);
  if (!providerId || !(amount > 0) || amount > 1000000) return res.status(400).json({ error: 'Choose a pro and a price.' });
  const pro = await db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!pro) return res.status(404).json({ error: 'Pro not found.' });
  const tokens = require('../tokens');
  const check = await tokens.cashReady(pro, amount);
  if (!check.ok) await tokens.nudgeCashNotReady(pro, check, amount);
  res.json({ ok: check.ok, message: check.ok ? null : `${String(pro.name || 'This pro').split(' ')[0]} can't take cash jobs at the moment. Choose "Protected by Trothen", or book another pro.` });
});

// v125: card payments (Stripe). The webhook is how Stripe tells Trothen a
// payment really went through; it is checked against STRIPE_WEBHOOK_SECRET
// so nobody else can pretend to be Stripe. Add this address in Stripe:
//   https://trothenpro.com/api/webhooks/stripe
// with the events checkout.session.completed and
// checkout.session.async_payment_succeeded.
router.post('/webhooks/stripe', async (req, res) => {
  const event = require('../stripe-pay').verifyWebhook(req.rawBody, req.headers['stripe-signature']);
  if (!event) return res.status(400).json({ error: 'Bad signature' });
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) await cp.confirmCardSession(event.data && event.data.object);
  } catch (e) { console.error('[stripe webhook]', e.message); return res.status(500).json({ error: 'Could not record it yet; Stripe will retry.' }); }
  res.json({ received: true });
});
// v147: MTN MoMo's callback (set LCMMMI_CALLBACK_URL to
// https://<site>/api/webhooks/mtn-momo). MTN is asked directly; the body is
// only used to know which payment to ask about.
const momoHook = async (req, res) => {
  const b = req.body || {};
  try { await cp.momoCallback(req.get('X-Reference-Id') || b.referenceId, b.externalId); } catch (e) { console.error('[momo callback]', e.message); }
  res.json({ ok: true });
};
router.put('/webhooks/mtn-momo', momoHook);
router.post('/webhooks/mtn-momo', momoHook);
// GET /api/customer-payments/:contractId/card-status — after coming back from Stripe.
router.get('/customer-payments/:contractId/card-status', requireAuth, requireRole('customer', 'provider'), async (req, res) => {
  const r = await cp.cardStatus(req.params.contractId, req.user.sub);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});

// POST /api/customer-payments/:contractId/paid { transactionId } — "I have sent it".
router.post('/customer-payments/:contractId/paid', requireAuth, requireRole('customer', 'provider'), limiter, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const r = await cp.customerReportsPaid(me, req.params.contractId, (req.body || {}).transactionId);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  res.json({ ok: true });
});

// ── FINANCE ────────────────────────────────────────────────────────────
const VIEW = ['customer_service', 'financial', 'accountant', 'controller'];
const FINANCE = ['financial', 'accountant', 'controller'];
async function gateFn(req, res, next) {
  const m = await db.find('users', u => u.id === req.user.sub);
  if (!m || m.active === false) return res.status(403).json({ error: 'This account has been suspended.' });
  if (!m.isSuperAdmin && !VIEW.includes(m.adminDepartment) && !require('../admin-permissions').gatePassed(req, m)) return res.status(403).json({ error: 'Only a super admin, customer service or the finance team can see customer payments.' });
  req.adminUser = m; next();
}
const gate = [requireAuth, requireRole('admin'), gateFn];
const financeOnly = (req, res, next) => (req.adminUser.isSuperAdmin || FINANCE.includes(req.adminUser.adminDepartment) || require('../admin-permissions').gatePassed(req, req.adminUser) ? next() : res.status(403).json({ error: 'Only a super admin or the finance team can do this.' }));
async function logIt(req, what, id) { try { await require('../access-log').logAccess(req, what, id); } catch (e) { /* never block */ } }

// GET /api/admin/customer-payments?q=CODE — payments waiting, and refunds to send.
router.get('/admin/customer-payments', gate, async (req, res) => {
  const q = String(req.query.q || '').trim().toUpperCase();
  const all = await db.filter('escrowTransactions', e => e.paidBy === 'code');
  let waiting = q ? all.filter(e => e.paymentCode === q || (e.customerTransactionId || '').toUpperCase() === q || (e.receipt || '').toUpperCase() === q) : all.filter(e => e.status === 'awaiting_payment');
  waiting = waiting.sort((a, b) => (a.customerSaysPaidAt ? 0 : 1) - (b.customerSaysPaidAt ? 0 : 1) || String(a.createdAt).localeCompare(String(b.createdAt))).slice(0, 100);
  const contracts = await db.filter('contracts', c => waiting.some(e => e.contractId === c.id));
  const users = await db.filter('users', u => contracts.some(c => c.customerId === u.id || c.providerId === u.id));
  const nameOf = (id) => { const u = users.find(x => x.id === id); return u ? u.name : 'Unknown'; };
  const phoneOf = (id) => { const u = users.find(x => x.id === id); return u ? u.phone || null : null; };
  const refunds = await cp.refundsToSend();
  const rc = await db.filter('contracts', c => refunds.some(r => r.contractId === c.id));
  const ru = await db.filter('users', u => rc.some(c => c.customerId === u.id));
  await logIt(req, 'customer_payments_view');
  res.json({
    canAct: req.adminUser.isSuperAdmin || FINANCE.includes(req.adminUser.adminDepartment) || require('../admin-permissions').adminCan(req.adminUser, 'custpay', 'confirm'), // v135
    payments: waiting.map(e => {
      const c = contracts.find(x => x.id === e.contractId) || {};
      return { ...cp.publicPayment(e), escrowId: e.id, bookingNumber: c.bookingNumber || null, service: c.service || null, bookingStatus: c.status || null, customer: nameOf(c.customerId), customerPhone: phoneOf(c.customerId), pro: nameOf(c.providerId), createdAt: e.createdAt, confirmedByName: e.confirmedByName || null };
    }),
    refunds: refunds.map(r => {
      const c = rc.find(x => x.id === r.contractId) || {};
      const u = ru.find(x => x.id === c.customerId) || {};
      return { ...r, bookingNumber: c.bookingNumber || null, customer: u.name || 'Unknown', customerPhone: u.phone || null };
    }),
  });
});
router.post('/admin/customer-payments/confirm', gate, financeOnly, async (req, res) => {
  const b = req.body || {};
  const r = await cp.confirm(req.adminUser, b.code, b.transactionId, b.amountReceived);
  if (!r.ok) return res.status(r.status || 400).json({ code: r.code, error: r.error });
  await logIt(req, 'customer_payment_confirm', `${b.code} ${b.transactionId} ${b.amountReceived}`.slice(0, 250));
  res.json({ ok: true, contract: { id: r.contract.id, status: r.contract.status } });
});
router.post('/admin/customer-payments/reject', gate, financeOnly, async (req, res) => {
  const b = req.body || {};
  const r = await cp.reject(req.adminUser, b.code, b.reason);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  await logIt(req, 'customer_payment_reject', String(b.code).slice(0, 40));
  res.json({ ok: true });
});
router.post('/admin/customer-payments/refund-sent', gate, financeOnly, async (req, res) => {
  const b = req.body || {};
  const r = await cp.markRefundSent(req.adminUser, b.escrowId, b.transactionId);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  await logIt(req, 'customer_refund_sent', `${b.escrowId} ${b.transactionId}`.slice(0, 250));
  res.json({ ok: true });
});

module.exports = router;
