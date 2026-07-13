const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

function publicProvider(u) {
  return {
    id: u.id, name: u.name, initials: u.initials, role: u.providerRole, category: u.category,
    rating: u.rating, jobs: u.jobs, price: u.price, tags: u.tags, color: u.color, since: u.since,
    verified: u.verified, country: u.country, city: u.city,
  };
}

// GET /api/providers?category=Plumbing&q=leak&city=Atlanta
router.get('/providers', (req, res) => {
  const { category, q, city } = req.query;
  let providers = db.filter('users', u => u.role === 'provider');
  if (category) providers = providers.filter(p => p.category === category);
  if (city) providers = providers.filter(p => p.city === city);
  if (q) {
    const needle = q.toLowerCase();
    providers = providers.filter(p =>
      p.category.toLowerCase().includes(needle) ||
      (p.providerRole || '').toLowerCase().includes(needle) ||
      (p.tags || []).some(t => t.toLowerCase().includes(needle))
    );
  }
  res.json({ providers: providers.map(publicProvider) });
});

// GET /api/providers/:id  (profile page: includes reviews)
router.get('/providers/:id', (req, res) => {
  const p = db.find('users', u => u.id === req.params.id && u.role === 'provider');
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  const reviews = db.filter('reviews', r => r.providerId === p.id);
  res.json({ provider: publicProvider(p), reviews });
});

// ---- Jobs & AI matching -----------------------------------------------------

// POST /api/jobs — customer posts a job, triggers AI matching immediately
router.post('/jobs', requireAuth, requireRole('customer'), (req, res) => {
  const { category, description, budget } = req.body || {};
  if (!category || !description) return res.status(400).json({ error: 'category and description are required' });

  const job = {
    id: `job_${nanoid(10)}`,
    customerId: req.user.sub,
    category, description, budget: budget || null,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  db.insert('jobs', job);

  // --- AI matching (deterministic scoring stand-in for a real ranking model) ---
  // Score = base 70 + rating weight + experience weight + small deterministic jitter
  // derived from the job id, so results are stable but vary per job.
  const customer = db.find('users', u => u.id === req.user.sub);
  const candidates = db.filter('users', u => u.role === 'provider' && u.category === category && u.verified && (!customer || u.city === customer.city));
  const scored = candidates.map(p => {
    const jitter = (parseInt(job.id.slice(-4), 36) % 7);
    const score = Math.min(99, Math.round(70 + p.rating * 4 + Math.min(p.jobs, 300) / 30 + jitter));
    return { provider: p, score };
  }).sort((a, b) => b.score - a.score).slice(0, 3);

  const matches = scored.map(({ provider, score }) => {
    const match = {
      id: `match_${nanoid(10)}`,
      jobId: job.id,
      providerId: provider.id,
      customerId: req.user.sub,
      score,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.insert('matches', match);
    return { ...match, provider: publicProvider(provider) };
  });

  res.status(201).json({ job, matches });
});

// GET /api/jobs/mine — customer's posted jobs
router.get('/jobs/mine', requireAuth, requireRole('customer'), (req, res) => {
  const jobs = db.filter('jobs', j => j.customerId === req.user.sub);
  res.json({ jobs });
});

// GET /api/matches/mine — provider's pending AI matches
router.get('/matches/mine', requireAuth, requireRole('provider'), (req, res) => {
  const matches = db.filter('matches', m => m.providerId === req.user.sub && m.status === 'pending');
  const withJob = matches.map(m => ({ ...m, job: db.find('jobs', j => j.id === m.jobId) }));
  res.json({ matches: withJob });
});

// POST /api/matches/:id/respond  { decision: 'accept' | 'decline' }
router.post('/matches/:id/respond', requireAuth, requireRole('provider'), (req, res) => {
  const { decision } = req.body || {};
  const match = db.find('matches', m => m.id === req.params.id && m.providerId === req.user.sub);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ error: 'decision must be accept or decline' });

  db.update('matches', match.id, { status: decision === 'accept' ? 'accepted' : 'declined' });

  let contract = null;
  if (decision === 'accept') {
    const job = db.find('jobs', j => j.id === match.jobId);
    contract = {
      id: `ct_${nanoid(10)}`,
      customerId: match.customerId,
      providerId: match.providerId,
      jobId: match.jobId,
      service: job ? job.description : 'Service',
      amount: job && job.budget ? parseInt(String(job.budget).replace(/[^0-9]/g, '')) || 100 : 100,
      status: 'active',
      signedAt: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    db.insert('contracts', contract);
    if (job) db.update('jobs', job.id, { status: 'matched' });
  }
  res.json({ match, contract });
});

// ---- Contracts / bookings ----------------------------------------------------

// POST /api/contracts — direct booking of a specific provider (skips matching)
router.post('/contracts', requireAuth, requireRole('customer'), (req, res) => {
  const { providerId, service, date, time, address, amount } = req.body || {};
  const provider = db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  const contract = {
    id: `ct_${nanoid(10)}`,
    customerId: req.user.sub,
    providerId,
    service: service || 'General service',
    date, time, address,
    amount: amount || provider.price * 2,
    status: 'active',
    signedAt: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  db.insert('contracts', contract);
  const escrow = { id: `esc_${nanoid(10)}`, contractId: contract.id, amount: contract.amount, status: 'held', createdAt: new Date().toISOString() };
  db.insert('escrowTransactions', escrow);
  res.status(201).json({ contract, escrow });
});

// GET /api/contracts/mine — works for both customers and providers
router.get('/contracts/mine', requireAuth, (req, res) => {
  const field = req.user.role === 'provider' ? 'providerId' : 'customerId';
  const contracts = db.filter('contracts', c => c[field] === req.user.sub);
  const withNames = contracts.map(c => {
    const customer = db.find('users', u => u.id === c.customerId);
    const provider = db.find('users', u => u.id === c.providerId);
    const escrow = db.find('escrowTransactions', e => e.contractId === c.id);
    return { ...c, customerName: customer ? customer.name : 'Customer', providerName: provider ? provider.name : 'Provider', escrow };
  });
  res.json({ contracts: withNames });
});

module.exports = router;
