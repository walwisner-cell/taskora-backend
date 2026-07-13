const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { isNonEmptyString, validate } = require('../validators');
const { notify } = require('../notify');

const router = express.Router();

// ── TEST-MODE PAYMENT METHODS ────────────────────────────────────────────────
// This is a sandbox stand-in, not a real payment integration. It exists so
// the booking/escrow flow can be exercised end-to-end during testing without
// blocking on a real processor being chosen yet.
//
// Even in test mode, this never stores a full card number — only the last 4
// digits and a guessed brand, discarding everything else immediately. That's
// deliberate: it's the same handling pattern a real Stripe/processor
// integration would need (tokenize, never persist the PAN), so swapping in
// a real processor later means replacing this file's internals, not
// redesigning how the rest of the app calls it.
function detectCardBrand(digits) {
  if (/^4/.test(digits)) return 'Visa';
  if (/^5[1-5]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  return 'Card';
}

// GET /api/payment-methods/mine
router.get('/payment-methods/mine', requireAuth, (req, res) => {
  const methods = db.filter('paymentMethods', m => m.userId === req.user.sub);
  res.json({ methods });
});

// POST /api/payment-methods — add a test payment method (any input accepted;
// only last 4 digits + brand are ever kept)
router.post('/payment-methods', requireAuth, (req, res) => {
  const { cardNumber, expiry, nameOnCard } = req.body || {};
  const errors = validate([
    ['cardNumber', isNonEmptyString(cardNumber, { min: 4 }), 'Enter a card number (any digits — this is test mode)'],
    ['expiry', isNonEmptyString(expiry, { min: 4, max: 7 }), 'Enter an expiry date (MM/YY)'],
    ['nameOnCard', isNonEmptyString(nameOnCard, { min: 2 }), 'Enter the name on the card'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const digitsOnly = String(cardNumber).replace(/\D/g, '');
  if (digitsOnly.length < 4) return res.status(400).json({ error: 'Card number must contain at least 4 digits' });
  const last4 = digitsOnly.slice(-4);
  const brand = detectCardBrand(digitsOnly);

  const existing = db.filter('paymentMethods', m => m.userId === req.user.sub);
  const method = {
    id: `pm_${nanoid(10)}`,
    userId: req.user.sub,
    brand, last4, nameOnCard: nameOnCard.trim(), expiry: expiry.trim(),
    isDefault: existing.length === 0, // first one added becomes default automatically
    mode: 'test',
    createdAt: new Date().toISOString(),
  };
  db.insert('paymentMethods', method);
  res.status(201).json({ method });
});

// PATCH /api/payment-methods/:id/default
router.patch('/payment-methods/:id/default', requireAuth, (req, res) => {
  const method = db.find('paymentMethods', m => m.id === req.params.id && m.userId === req.user.sub);
  if (!method) return res.status(404).json({ error: 'Payment method not found' });
  db.filter('paymentMethods', m => m.userId === req.user.sub).forEach(m => {
    if (m.id !== method.id && m.isDefault) db.update('paymentMethods', m.id, { isDefault: false });
  });
  const updated = db.update('paymentMethods', method.id, { isDefault: true });
  res.json({ method: updated });
});

// DELETE /api/payment-methods/:id
router.delete('/payment-methods/:id', requireAuth, (req, res) => {
  const method = db.find('paymentMethods', m => m.id === req.params.id && m.userId === req.user.sub);
  if (!method) return res.status(404).json({ error: 'Payment method not found' });
  db.remove('paymentMethods', method.id);
  // If we just removed the default, promote whichever method is left, if any.
  if (method.isDefault) {
    const remaining = db.filter('paymentMethods', m => m.userId === req.user.sub);
    if (remaining.length) db.update('paymentMethods', remaining[0].id, { isDefault: true });
  }
  res.json({ ok: true });
});

// GET /api/payouts/mine — provider payout history
router.get('/payouts/mine', requireAuth, requireRole('provider'), (req, res) => {
  const payouts = db.filter('payouts', p => p.providerId === req.user.sub);
  res.json({ payouts });
});

// POST /api/payouts/request — provider requests payout of released escrow
router.post('/payouts/request', requireAuth, requireRole('provider'), (req, res) => {
  const contracts = db.filter('contracts', c => c.providerId === req.user.sub && c.status === 'active');
  const releasable = contracts.reduce((sum, c) => {
    const e = db.find('escrowTransactions', e => e.contractId === c.id && e.status === 'held');
    return sum + (e ? e.amount : 0);
  }, 0);
  const payout = {
    id: `po_${nanoid(10)}`,
    providerId: req.user.sub,
    date: new Date().toISOString().slice(0, 10),
    amount: releasable || 0,
    method: 'Bank Transfer',
    status: 'processing',
    createdAt: new Date().toISOString(),
  };
  db.insert('payouts', payout);
  notify(req.user.sub, '💸', `Payout of $${payout.amount} requested — processing.`);
  res.status(201).json({ payout });
});

// POST /api/contracts/:id/complete — customer confirms job done -> release escrow
router.post('/contracts/:id/complete', requireAuth, requireRole('customer'), (req, res) => {
  const contract = db.find('contracts', c => c.id === req.params.id && c.customerId === req.user.sub);
  if (!contract) return res.status(404).json({ error: 'Contract not found' });
  const escrow = db.find('escrowTransactions', e => e.contractId === contract.id);
  if (escrow) db.update('escrowTransactions', escrow.id, { status: 'released' });
  const updated = db.update('contracts', contract.id, { status: 'completed' });
  notify(contract.providerId, '💰', `Escrow released — $${contract.amount} for ${contract.service}.`);
  res.json({ contract: updated, escrow: { ...escrow, status: 'released' } });
});

// GET /api/escrow/summary — admin: platform-wide escrow snapshot
router.get('/escrow/summary', requireAuth, requireRole('admin'), (req, res) => {
  const all = db.all('escrowTransactions');
  const held = all.filter(e => e.status === 'held').reduce((s, e) => s + e.amount, 0);
  const released = all.filter(e => e.status === 'released').reduce((s, e) => s + e.amount, 0);
  res.json({ held, released, count: all.length });
});

module.exports = router;
