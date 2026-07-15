const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { isNonEmptyString, isValidCardExpiry, isValidPostalCode, validate, postalCodeErrorMessage } = require('../validators');
const { notify } = require('../notify');
const { currencyForCountry, convertFromUSD } = require('../currency-data');

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
router.get('/payment-methods/mine', requireAuth, async (req, res) => {
  const methods = await db.filter('paymentMethods', m => m.userId === req.user.sub);
  res.json({ methods });
});

// POST /api/payment-methods — add a test payment method (any input accepted;
// only last 4 digits + brand are ever kept)
router.post('/payment-methods', requireAuth, async (req, res) => {
  const { cardNumber, expiry, nameOnCard, billingAddress, billingZip } = req.body || {};
  const accountHolder = await db.find('users', u => u.id === req.user.sub);
  const errors = validate([
    ['cardNumber', isNonEmptyString(cardNumber, { min: 4 }), 'Enter a card number (any digits — this is test mode)'],
    ['expiry', isValidCardExpiry(expiry), 'Enter a valid, non-expired expiry date in MM/YY format'],
    ['nameOnCard', isNonEmptyString(nameOnCard, { min: 2 }), 'Enter the name on the card'],
    ['billingAddress', isNonEmptyString(billingAddress, { min: 3, max: 200 }), 'Enter the billing address'],
    ['billingZip', isValidPostalCode(billingZip, accountHolder && accountHolder.country), postalCodeErrorMessage(accountHolder && accountHolder.country)],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const digitsOnly = String(cardNumber).replace(/\D/g, '');
  if (digitsOnly.length < 4) return res.status(400).json({ error: 'Card number must contain at least 4 digits' });
  const last4 = digitsOnly.slice(-4);
  const brand = detectCardBrand(digitsOnly);

  const existing = await db.filter('paymentMethods', m => m.userId === req.user.sub);
  const method = {
    id: `pm_${nanoid(10)}`,
    userId: req.user.sub,
    brand, last4, nameOnCard: nameOnCard.trim(), expiry: expiry.trim(),
    billingAddress: billingAddress.trim(), billingZip: billingZip.trim(),
    isDefault: existing.length === 0, // first one added becomes default automatically
    mode: 'test',
    createdAt: new Date().toISOString(),
  };
  await db.insert('paymentMethods', method);
  res.status(201).json({ method });
});

// PATCH /api/payment-methods/:id/default
router.patch('/payment-methods/:id/default', requireAuth, async (req, res) => {
  const method = await db.find('paymentMethods', m => m.id === req.params.id && m.userId === req.user.sub);
  if (!method) return res.status(404).json({ error: 'Payment method not found' });
  const others = await db.filter('paymentMethods', m => m.userId === req.user.sub);
  for (const m of others) {
    if (m.id !== method.id && m.isDefault) await db.update('paymentMethods', m.id, { isDefault: false });
  }
  const updated = await db.update('paymentMethods', method.id, { isDefault: true });
  res.json({ method: updated });
});

// DELETE /api/payment-methods/:id
router.delete('/payment-methods/:id', requireAuth, async (req, res) => {
  const method = await db.find('paymentMethods', m => m.id === req.params.id && m.userId === req.user.sub);
  if (!method) return res.status(404).json({ error: 'Payment method not found' });
  await db.remove('paymentMethods', method.id);
  // If we just removed the default, promote whichever method is left, if any.
  if (method.isDefault) {
    const remaining = await db.filter('paymentMethods', m => m.userId === req.user.sub);
    if (remaining.length) await db.update('paymentMethods', remaining[0].id, { isDefault: true });
  }
  res.json({ ok: true });
});

// GET /api/payouts/mine — provider payout history
router.get('/payouts/mine', requireAuth, requireRole('provider'), async (req, res) => {
  const payouts = await db.filter('payouts', p => p.providerId === req.user.sub);
  res.json({ payouts });
});

// POST /api/payouts/request — provider requests payout of released escrow
router.post('/payouts/request', requireAuth, requireRole('provider'), async (req, res) => {
  const { payoutCurrency } = req.body || {}; // 'usd' or 'local' — defaults to local if the provider has a non-US country
  const provider = await db.find('users', u => u.id === req.user.sub);
  const contracts = await db.filter('contracts', c => c.providerId === req.user.sub && c.status === 'active');
  let releasable = 0;
  for (const c of contracts) {
    const e = await db.find('escrowTransactions', e => e.contractId === c.id && e.status === 'held');
    releasable += e ? e.amount : 0;
  }

  // The contract/escrow ledger is always denominated in USD — that stays
  // the canonical accounting currency regardless of payout choice, so
  // reports and reconciliation are never ambiguous. What the provider
  // actually RECEIVES can be converted to their local currency at their
  // choice — the same way an international payout provider (Wise, Payoneer,
  // etc.) would let you choose your payout currency for a USD-denominated
  // balance.
  const currency = currencyForCountry(provider ? provider.country : 'United States');
  const wantsLocal = payoutCurrency === 'local' && currency.code !== 'USD';
  const payoutAmountLocal = wantsLocal ? convertFromUSD(releasable || 0, currency.code) : null;

  const payout = {
    id: `po_${nanoid(10)}`,
    providerId: req.user.sub,
    date: new Date().toISOString().slice(0, 10),
    amount: releasable || 0, // canonical USD amount — always present
    payoutCurrency: wantsLocal ? currency.code : 'USD',
    payoutAmountLocal, // the converted amount actually paid out, if not USD
    exchangeRateNote: wantsLocal ? 'Approximate test-mode exchange rate — not a live market rate' : null,
    method: (provider && provider.payoutMethod) || 'Bank Transfer',
    status: 'processing',
    createdAt: new Date().toISOString(),
  };
  await db.insert('payouts', payout);
  const displayAmount = wantsLocal ? `${currency.symbol}${payoutAmountLocal} (${currency.code}, ≈ $${payout.amount} USD)` : `$${payout.amount}`;
  await notify(req.user.sub, '💸', `Payout of ${displayAmount} requested — processing.`, 'payoutAlerts');
  res.status(201).json({ payout });
});

// POST /api/contracts/:id/complete — customer confirms job done -> release escrow
router.post('/contracts/:id/complete', requireAuth, requireRole('customer'), async (req, res) => {
  const contract = await db.find('contracts', c => c.id === req.params.id && c.customerId === req.user.sub);
  if (!contract) return res.status(404).json({ error: 'Contract not found' });
  if (contract.status !== 'active') {
    return res.status(400).json({ error: `This booking is already ${contract.status} and can't be marked complete` });
  }
  const escrow = await db.find('escrowTransactions', e => e.contractId === contract.id);
  if (escrow) await db.update('escrowTransactions', escrow.id, { status: 'released' });
  const updated = await db.update('contracts', contract.id, { status: 'completed' });
  await notify(contract.providerId, '💰', `Escrow released — $${contract.amount} for ${contract.service}.`, 'payoutAlerts');
  res.json({ contract: updated, escrow: { ...escrow, status: 'released' } });
});

// POST /api/contracts/:id/cancel — either the customer or the provider can
// cancel a booking before it's marked complete, or withdraw a Mutual
// Agreement offer that hasn't been responded to yet. Escrow is refunded
// (not released to the provider) since no work was confirmed done — and for
// a still-pending offer, there's no escrow yet to begin with, since funds
// were never held until the provider actually agreed to a number. The other
// party is notified either way.
router.post('/contracts/:id/cancel', requireAuth, async (req, res) => {
  const contract = await db.find('contracts', c =>
    c.id === req.params.id && (c.customerId === req.user.sub || c.providerId === req.user.sub)
  );
  if (!contract) return res.status(404).json({ error: 'Contract not found' });
  if (!['active', 'pending_agreement'].includes(contract.status)) {
    return res.status(400).json({ error: `This booking is already ${contract.status} and can't be cancelled` });
  }
  const escrow = await db.find('escrowTransactions', e => e.contractId === contract.id);
  if (escrow) await db.update('escrowTransactions', escrow.id, { status: 'refunded' });
  const updated = await db.update('contracts', contract.id, { status: 'cancelled' });

  const iAmCustomer = contract.customerId === req.user.sub;
  const otherPartyId = iAmCustomer ? contract.providerId : contract.customerId;
  const canceller = await db.find('users', u => u.id === req.user.sub);
  const message = escrow
    ? `${canceller ? canceller.name : 'The other party'} cancelled the booking for "${contract.service}". Any held escrow has been refunded.`
    : `${canceller ? canceller.name : 'The other party'} withdrew the offer for "${contract.service}".`;
  await notify(otherPartyId, '🚫', message, 'bookingUpdates');

  res.json({ contract: updated, escrow: escrow ? { ...escrow, status: 'refunded' } : null });
});

// GET /api/escrow/summary — admin: platform-wide escrow snapshot
router.get('/escrow/summary', requireAuth, requireRole('admin'), async (req, res) => {
  const all = await db.all('escrowTransactions');
  const held = all.filter(e => e.status === 'held').reduce((s, e) => s + e.amount, 0);
  const released = all.filter(e => e.status === 'released').reduce((s, e) => s + e.amount, 0);
  res.json({ held, released, count: all.length });
});

module.exports = router;
