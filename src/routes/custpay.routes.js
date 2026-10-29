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
  res.json({ protectedMode: o.protectedMode, cashJobs: o.cashJobs, payTo: o.payTo, currency: { code: o.currency.code, symbol: o.currency.symbol } });
});

// POST /api/customer-payments/:contractId/paid { transactionId } — "I have sent it".
router.post('/customer-payments/:contractId/paid', requireAuth, requireRole('customer'), limiter, async (req, res) => {
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
  if (!m.isSuperAdmin && !VIEW.includes(m.adminDepartment)) return res.status(403).json({ error: 'Only a super admin, customer service or the finance team can see customer payments.' });
  req.adminUser = m; next();
}
const gate = [requireAuth, requireRole('admin'), gateFn];
const financeOnly = (req, res, next) => (req.adminUser.isSuperAdmin || FINANCE.includes(req.adminUser.adminDepartment) ? next() : res.status(403).json({ error: 'Only a super admin or the finance team can do this.' }));
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
    canAct: req.adminUser.isSuperAdmin || FINANCE.includes(req.adminUser.adminDepartment),
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
