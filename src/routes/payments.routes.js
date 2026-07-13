const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

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
  res.status(201).json({ payout });
});

// POST /api/contracts/:id/complete — customer confirms job done -> release escrow
router.post('/contracts/:id/complete', requireAuth, requireRole('customer'), (req, res) => {
  const contract = db.find('contracts', c => c.id === req.params.id && c.customerId === req.user.sub);
  if (!contract) return res.status(404).json({ error: 'Contract not found' });
  const escrow = db.find('escrowTransactions', e => e.contractId === contract.id);
  if (escrow) db.update('escrowTransactions', escrow.id, { status: 'released' });
  const updated = db.update('contracts', contract.id, { status: 'completed' });
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
