const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { isNonEmptyString, isValidCardExpiry, isValidPostalCode, validate, postalCodeErrorMessage } = require('../validators');
const { notify } = require('../notify');
const { currencyForCountry, convertFromUSD } = require('../currency-data');
const { resolveRate } = require('../plan-pricing');

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
  let payouts = await db.filter('payouts', p => p.providerId === req.user.sub);
  const { from, to } = req.query;
  if (from) payouts = payouts.filter(p => p.date >= from);
  if (to) payouts = payouts.filter(p => p.date <= to);
  payouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ payouts });
});

// GET /api/payouts/pdf — a real, downloadable payout history report for a
// provider, honoring the same from/to date range as the on-screen history.
// Built so "who paid me, and when" is answerable from a document alone,
// not just by scrolling the dashboard.
router.get('/payouts/pdf', requireAuth, requireRole('provider'), async (req, res) => {
  const { from, to } = req.query;
  const provider = await db.find('users', u => u.id === req.user.sub);
  let payouts = await db.filter('payouts', p => p.providerId === req.user.sub);
  if (from) payouts = payouts.filter(p => p.date >= from);
  if (to) payouts = payouts.filter(p => p.date <= to);
  payouts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const { createReportDoc } = require('../pdf-report-builder');
  const rangeLabel = from || to ? `${from || 'earliest'} to ${to || 'today'}` : 'All time';
  const { sectionHeader, row, twoColumnRow, table, finish } = createReportDoc({
    res,
    filename: `Taskora-Payout-History-${provider.name.replace(/\s+/g, '-')}.pdf`,
    title: 'Payout History Report',
    subtitle: 'AI-Matched · Identity-Verified · Escrow-Protected',
    docId: rangeLabel,
    verificationSeed: `payouts|${provider.id}|${from || ''}|${to || ''}|${payouts.length}`,
  });

  sectionHeader('Report Summary');
  twoColumnRow('Provider', `${provider.name} (${provider.email})`, 'Date Range', rangeLabel);
  const totalGross = payouts.reduce((s, p) => s + (p.grossAmount ?? p.amount), 0);
  const totalCommission = payouts.reduce((s, p) => s + (p.commissionAmount || 0), 0);
  const totalNet = payouts.reduce((s, p) => s + p.amount, 0);
  twoColumnRow('Total Earned (Gross)', `$${totalGross.toFixed(2)}`, 'Total Commission', `$${totalCommission.toFixed(2)}`);
  row('Total Paid Out (Net)', `$${totalNet.toFixed(2)}`);

  if (payouts.length === 0) {
    sectionHeader('Payouts');
    row('No payouts', 'No payouts were found in this date range.');
  } else {
    for (const payout of payouts) {
      sectionHeader(`Payout ${payout.id} — ${payout.date}`);
      twoColumnRow('Gross Earned', `$${(payout.grossAmount ?? payout.amount).toFixed(2)}`, 'Commission', payout.commissionAmount ? `$${payout.commissionAmount.toFixed(2)} (${Math.round((payout.commissionRate || 0) * 100)}%)` : '—');
      twoColumnRow('Net Paid Out', `$${payout.amount.toFixed(2)}`, 'Method / Status', `${payout.method} · ${payout.status}`);
      if (payout.lineItems && payout.lineItems.length) {
        table(
          [{ label: 'Customer', width: 110 }, { label: 'Job', width: 140 }, { label: 'Date', width: 60 }, { label: 'Booking #', width: 80 }, { label: 'Amount', width: 60, align: 'right' }],
          payout.lineItems.map(li => [li.customerName, li.service, li.jobDate || '—', li.bookingNumber, `$${li.amount}`])
        );
      }
    }
  }

  finish({
    closingNote: 'This report reflects Taskora\'s payout records for this provider account as of the moment it was generated. Commission is deducted according to the provider\'s plan at the time of each payout. Provided for the provider\'s own recordkeeping.',
  });
});
// POST /api/payouts/request — provider requests payout of released escrow
const { COMMISSION_RATES, effectiveCommissionRate } = require('../commission');

router.post('/payouts/request', requireAuth, requireRole('provider'), async (req, res) => {
  const { payoutCurrency } = req.body || {}; // 'usd' or 'local' — defaults to local if the provider has a non-US country
  const provider = await db.find('users', u => u.id === req.user.sub);

  // What's actually payable is escrow that's been RELEASED (the customer
  // confirmed the work) and hasn't already gone out in an earlier payout —
  // not escrow that's still held pending confirmation. Paying out held
  // funds would defeat the entire point of escrow protection, and paying
  // out the same released escrow twice would be a real financial bug, not
  // just a display one — so every included escrow record gets stamped
  // with this payout's id the moment it's included, and never counted
  // again after that.
  const releasedEscrow = await db.filter('escrowTransactions', e =>
    e.status === 'released' && !e.payoutId
  );
  const contracts = await db.filter('contracts', c => c.providerId === req.user.sub);
  const contractIds = new Set(contracts.map(c => c.id));
  const payableEscrow = releasedEscrow.filter(e => contractIds.has(e.contractId));

  // Materials advances release the moment they're agreed, independent of
  // whether the rest of the job is done — so they're gathered separately
  // here, using their own payout tracking field, since the MAIN escrow
  // record for that contract might still legitimately be 'held' for the
  // remainder while the advance itself is fully payable right now.
  const allEscrowForProvider = await db.filter('escrowTransactions', e => contractIds.has(e.contractId));
  const payableAdvances = allEscrowForProvider.filter(e =>
    e.materialsAdvanceReleased && e.materialsAdvanceAmount > 0 && !e.materialsAdvancePayoutId
  );

  const grossAmount = payableEscrow.reduce((sum, e) => sum + (e.amount - (e.materialsAdvanceAmount || 0)), 0)
    + payableAdvances.reduce((sum, e) => sum + e.materialsAdvanceAmount, 0);

  if (grossAmount <= 0) {
    return res.status(400).json({ error: 'Nothing to pay out yet — this only includes jobs the customer has marked complete, or agreed materials advances, that haven\'t already been paid out.' });
  }

  // A provider should be able to see exactly which jobs and which
  // customers make up a payout, not just a lump sum — this is what
  // actually answers "who paid, and for what" when they look at their
  // payout history later.
  const lineItems = [];
  for (const e of payableEscrow) {
    const contract = contracts.find(c => c.id === e.contractId);
    if (!contract) continue;
    const customer = await db.find('users', u => u.id === contract.customerId);
    const review = await db.find('reviews', r => r.contractId === contract.id);
    const newlyPayable = e.amount - (e.materialsAdvanceAmount || 0);
    if (newlyPayable <= 0) continue; // the whole amount was already an advance, nothing further to add here
    lineItems.push({
      contractId: contract.id,
      bookingNumber: contract.bookingNumber || contract.id,
      customerName: customer ? customer.name : 'Unknown customer',
      customerEmail: customer ? customer.email : null,
      customerPhone: customer ? customer.phone : null,
      service: contract.service,
      jobDate: contract.date || null,
      jobTime: contract.time || null,
      address: contract.address || null,
      contractStatus: contract.status,
      signedAt: contract.signedAt || (contract.createdAt || '').slice(0, 10),
      review: review ? { stars: review.stars, text: review.text || null } : null,
      amount: newlyPayable,
    });
  }
  for (const e of payableAdvances) {
    const contract = contracts.find(c => c.id === e.contractId);
    if (!contract) continue;
    const customer = await db.find('users', u => u.id === contract.customerId);
    lineItems.push({
      contractId: contract.id,
      bookingNumber: contract.bookingNumber || contract.id,
      customerName: customer ? customer.name : 'Unknown customer',
      customerEmail: customer ? customer.email : null,
      customerPhone: customer ? customer.phone : null,
      service: `${contract.service} (materials advance)`,
      jobDate: contract.date || null,
      jobTime: contract.time || null,
      address: contract.address || null,
      contractStatus: contract.status,
      signedAt: contract.signedAt || (contract.createdAt || '').slice(0, 10),
      review: null,
      amount: e.materialsAdvanceAmount,
    });
  }

  // Commission is based on the provider's plan at the time they cash out —
  // matches the rates genuinely advertised on the Pricing page (Starter
  // 12%, Pro 8%, Super Pro 5%), actually deducted here rather than just
  // being marketing copy. A provider attached to a Custom-plan
  // organization uses that org's negotiated rate instead — the "volume
  // commission discount" promised on the Custom pricing card.
  const organization = provider.organizationId ? await db.find('organizations', o => o.id === provider.organizationId) : null;
  const commissionRate = effectiveCommissionRate(provider, organization);
  const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
  const netAmount = Math.round((grossAmount - commissionAmount) * 100) / 100;

  // The contract/escrow ledger is always denominated in USD — that stays
  // the canonical accounting currency regardless of payout choice, so
  // reports and reconciliation are never ambiguous. What the provider
  // actually RECEIVES can be converted to their local currency at their
  // choice — the same way an international payout provider (Wise, Payoneer,
  // etc.) would let you choose your payout currency for a USD-denominated
  // balance.
  const currency = currencyForCountry(provider ? provider.country : 'United States');
  const wantsLocal = payoutCurrency === 'local' && currency.code !== 'USD';
  const rate = wantsLocal ? resolveRate(currency.code, await db.all('exchangeRates')) : null;
  const payoutAmountLocal = wantsLocal ? convertFromUSD(netAmount, currency.code, rate) : null;

  const payout = {
    id: `po_${nanoid(10)}`,
    providerId: req.user.sub,
    date: new Date().toISOString().slice(0, 10),
    grossAmount,
    commissionRate,
    commissionAmount,
    amount: netAmount, // canonical USD amount actually paid out, after commission
    payoutCurrency: wantsLocal ? currency.code : 'USD',
    payoutAmountLocal,
    exchangeRateNote: wantsLocal ? 'Approximate test-mode exchange rate — not a live market rate' : null,
    method: (provider && provider.payoutMethod) || 'Bank Transfer',
    status: 'processing',
    lineItems,
    createdAt: new Date().toISOString(),
  };
  await db.insert('payouts', payout);

  // Stamp every included escrow record so it can never be paid out again.
  for (const e of payableEscrow) {
    await db.update('escrowTransactions', e.id, { payoutId: payout.id });
  }
  for (const e of payableAdvances) {
    await db.update('escrowTransactions', e.id, { materialsAdvancePayoutId: payout.id });
  }

  const displayAmount = wantsLocal ? `${currency.symbol}${payoutAmountLocal} (${currency.code}, ≈ $${payout.amount} USD)` : `$${payout.amount}`;
  await notify(req.user.sub, '💸', `Payout of ${displayAmount} requested (after ${Math.round(commissionRate*100)}% commission — $${commissionAmount} — on $${grossAmount} earned) — processing.`, 'payoutAlerts', { section: 'earnings' });
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

  // Real completed-jobs tracking — this used to be a static number set once
  // at signup and never touched again (every provider profile showed the
  // same seed value forever, regardless of real activity). Now it's
  // incremented for real, exactly once, the moment a job is genuinely
  // confirmed complete — the same event that releases their escrow.
  const provider = await db.find('users', u => u.id === contract.providerId);
  if (provider) await db.update('users', provider.id, { jobs: (provider.jobs || 0) + 1 });

  // The alert tells the provider their real, current total available
  // balance — not just this one job's amount — so it's an accurate,
  // actionable number the moment they see it, matching exactly what
  // they'd see if they opened Earnings & Payouts right now.
  const providerContracts = await db.filter('contracts', c => c.providerId === contract.providerId);
  const providerContractIds = new Set(providerContracts.map(c => c.id));
  const releasedUnpaid = (await db.filter('escrowTransactions', e => e.status === 'released' && !e.payoutId))
    .filter(e => providerContractIds.has(e.contractId));
  const totalAvailable = releasedUnpaid.reduce((s, e) => s + e.amount, 0);

  await notify(contract.providerId, '💰', `Escrow released — $${contract.amount} for ${contract.service}. You now have $${totalAvailable} available to request as a payout.`, 'payoutAlerts', { section: 'earnings' });
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
  if (!['active', 'pending_agreement', 'pending_provider_confirmation'].includes(contract.status)) {
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
  await notify(otherPartyId, '🚫', message, 'bookingUpdates', { section: 'bookings' });

  res.json({ contract: updated, escrow: escrow ? { ...escrow, status: 'refunded' } : null });
});

// GET /api/payments/mine — a customer's real payment history: every
// contract they've funded, who the provider was, and what currency they
// actually paid in. The same "who paid / who got paid" concept as the
// provider's payout history, just from the other side of the transaction.
router.get('/payments/mine', requireAuth, requireRole('customer'), async (req, res) => {
  const { from, to } = req.query;
  let contracts = await db.filter('contracts', c => c.customerId === req.user.sub);
  if (from) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) >= from);
  if (to) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) <= to);
  contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const payments = await Promise.all(contracts.map(async c => {
    const provider = await db.find('users', u => u.id === c.providerId);
    const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
    const dispute = await db.find('disputes', d => d.contractId === c.id);
    return {
      contractId: c.id,
      bookingNumber: c.bookingNumber || c.id,
      date: (c.createdAt || '').slice(0, 10),
      providerName: provider ? provider.name : 'Unknown provider',
      providerEmail: provider ? provider.email : null,
      providerPhone: provider ? provider.phone : null,
      service: c.service,
      jobDate: c.date || null,
      jobTime: c.time || null,
      address: c.address || null,
      amount: c.amount,
      status: c.status,
      escrowStatus: escrow ? escrow.status : 'none',
      paidCurrency: escrow ? escrow.paidCurrency : 'USD',
      paidAmountLocal: escrow ? escrow.paidAmountLocal : null,
      disputeStatus: dispute ? dispute.status : null,
    };
  }));
  res.json({ payments });
});

// GET /api/payments/pdf — a real, downloadable payment history report for a
// customer, same date-range concept as the provider's payout report.
router.get('/payments/pdf', requireAuth, requireRole('customer'), async (req, res) => {
  const { from, to } = req.query;
  const customer = await db.find('users', u => u.id === req.user.sub);
  let contracts = await db.filter('contracts', c => c.customerId === req.user.sub);
  if (from) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) >= from);
  if (to) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) <= to);
  contracts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const rows = await Promise.all(contracts.map(async c => {
    const provider = await db.find('users', u => u.id === c.providerId);
    const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
    return { c, provider, escrow };
  }));

  const { createReportDoc } = require('../pdf-report-builder');
  const rangeLabel = from || to ? `${from || 'earliest'} to ${to || 'today'}` : 'All time';
  const { sectionHeader, row, twoColumnRow, table, finish } = createReportDoc({
    res,
    filename: `Taskora-Payment-History-${customer.name.replace(/\s+/g, '-')}.pdf`,
    title: 'Payment History Report',
    subtitle: 'AI-Matched · Identity-Verified · Escrow-Protected',
    docId: rangeLabel,
    verificationSeed: `payments|${customer.id}|${from || ''}|${to || ''}|${contracts.length}`,
  });

  sectionHeader('Report Summary');
  twoColumnRow('Customer', `${customer.name} (${customer.email})`, 'Date Range', rangeLabel);
  const totalPaid = contracts.reduce((s, c) => s + c.amount, 0);
  row('Total Paid (USD)', `$${totalPaid.toFixed(2)} across ${contracts.length} booking${contracts.length === 1 ? '' : 's'}`);

  sectionHeader('Bookings & Payments');
  if (rows.length === 0) {
    row('No payments', 'No payments were found in this date range.');
  } else {
    table(
      [{ label: 'Date', width: 65 }, { label: 'Provider', width: 100 }, { label: 'Service', width: 165 }, { label: 'Booking #', width: 75 }, { label: 'Amount', width: 55, align: 'right' }],
      rows.map(({ c, provider }) => [(c.createdAt || '').slice(0, 10), provider ? provider.name : 'Unknown', c.service, c.bookingNumber || c.id, `$${c.amount}`])
    );
  }

  finish({
    closingNote: 'This report reflects Taskora\'s payment records for this customer account as of the moment it was generated. All amounts shown are in USD, the platform\'s canonical accounting currency, regardless of what currency was actually charged at checkout. Provided for the customer\'s own recordkeeping.',
  });
});

// the Financial team when an admin account has been set up that way — a
// super admin or an unscoped regional admin still sees this unchanged.
router.get('/escrow/summary', requireAuth, requireRole('admin'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me.isSuperAdmin && me.adminDepartment && !['financial', 'legal'].includes(me.adminDepartment)) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${me.adminDepartment} team and doesn't have access to this.` });
  }
  // A regional admin (no department, just assigned a city) should only ever
  // see their own city's numbers here — every other financial view already
  // works this way; this was the one that didn't, which meant a regional
  // admin could see platform-wide totals well beyond their own city.
  const region = (!me.isSuperAdmin && !me.adminDepartment) ? me.region : null;

  let all = await db.all('escrowTransactions');
  let payouts = await db.all('payouts');
  if (region) {
    const contracts = await db.all('contracts');
    const regionalContractIds = new Set();
    for (const c of contracts) {
      const customer = await db.find('users', u => u.id === c.customerId);
      if (customer && customer.city === region) regionalContractIds.add(c.id);
    }
    all = all.filter(e => regionalContractIds.has(e.contractId));
    const regionalProviderIds = new Set((await db.filter('users', u => u.role === 'provider' && u.city === region)).map(u => u.id));
    payouts = payouts.filter(p => regionalProviderIds.has(p.providerId));
  }

  const held = all.filter(e => e.status === 'held').reduce((s, e) => s + e.amount, 0);
  const released = all.filter(e => e.status === 'released').reduce((s, e) => s + e.amount, 0);
  // Real commission revenue — the sum of what's actually been deducted
  // across every payout ever made, not a placeholder figure.
  const commissionRevenue = payouts.reduce((s, p) => s + (p.commissionAmount || 0), 0);
  res.json({ held, released, count: all.length, commissionRevenue });
});

// GET /api/admin/financial-by-region — a real, per-city breakdown of escrow
// held/released and commission revenue, plus a grand total row, so the
// super admin (or the financial team) can actually see how each region is
// performing rather than only ever seeing one flattened global number.
router.get('/admin/financial-by-region', requireAuth, requireRole('admin'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me.isSuperAdmin && me.adminDepartment && !['financial', 'legal'].includes(me.adminDepartment)) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${me.adminDepartment} team and doesn't have access to this.` });
  }

  // Optional date range, applied the same way the Platform Transactions
  // panel applies it (against the contract's createdAt for escrow, and the
  // payout's own date for commission) — so the two panels stay in sync
  // when an admin filters by date.
  const { from, to } = req.query;

  const contracts = await db.all('contracts');
  let escrow = await db.all('escrowTransactions');
  let payouts = await db.all('payouts');
  const customers = await db.filter('users', u => u.role === 'customer');
  const providers = await db.filter('users', u => u.role === 'provider');
  const customerById = new Map(customers.map(c => [c.id, c]));
  const providerById = new Map(providers.map(p => [p.id, p]));
  const contractById = new Map(contracts.map(c => [c.id, c]));

  if (from || to) {
    escrow = escrow.filter(e => {
      const contract = contractById.get(e.contractId);
      const date = (contract && contract.createdAt || '').slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
    payouts = payouts.filter(p => {
      const date = (p.date || '').slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }

  // Group everything by the CUSTOMER's city — same convention used
  // everywhere else a "region" is derived (disputes, transactions).
  const byRegion = new Map(); // region -> { region, country, held, released, commissionRevenue, transactionCount }
  function bucket(region, country) {
    if (!byRegion.has(region)) byRegion.set(region, { region, country, held: 0, released: 0, commissionRevenue: 0, transactionCount: 0 });
    return byRegion.get(region);
  }

  for (const e of escrow) {
    const contract = contractById.get(e.contractId);
    const customer = contract && customerById.get(contract.customerId);
    if (!customer) continue;
    const b = bucket(customer.city || 'Unknown', customer.country || 'Unknown');
    if (e.status === 'held') b.held += e.amount;
    if (e.status === 'released') b.released += e.amount;
    b.transactionCount += 1;
  }
  for (const p of payouts) {
    const provider = providerById.get(p.providerId);
    if (!provider) continue;
    const b = bucket(provider.city || 'Unknown', provider.country || 'Unknown');
    b.commissionRevenue += (p.commissionAmount || 0);
  }

  // Average transaction value per region — total volume moved (held +
  // released) divided by however many escrow transactions built that
  // volume. Guards against divide-by-zero for a region with commission
  // activity but no escrow transactions in range.
  for (const b of byRegion.values()) {
    b.avgTransaction = b.transactionCount > 0 ? Math.round(((b.held + b.released) / b.transactionCount) * 100) / 100 : 0;
  }

  const regions = Array.from(byRegion.values()).sort((a, b) => (b.held + b.released) - (a.held + a.released));
  const total = regions.reduce((acc, r) => ({
    held: acc.held + r.held,
    released: acc.released + r.released,
    commissionRevenue: acc.commissionRevenue + r.commissionRevenue,
    transactionCount: acc.transactionCount + r.transactionCount,
  }), { held: 0, released: 0, commissionRevenue: 0, transactionCount: 0 });
  total.avgTransaction = total.transactionCount > 0 ? Math.round(((total.held + total.released) / total.transactionCount) * 100) / 100 : 0;

  res.json({ regions, total });
});

module.exports = router;
