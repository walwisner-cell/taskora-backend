const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { isNonEmptyString, validate } = require('../validators');

const router = express.Router();

function publicProvider(u) {
  return {
    id: u.id, name: u.name, initials: u.initials, role: u.providerRole, category: u.category,
    rating: u.rating, jobs: u.jobs, price: u.price, tags: u.tags, color: u.color, since: u.since,
    verified: u.verified, country: u.country, city: u.city,
  };
}

// Parses a customer-entered budget string like "$80-150", "$80 - $150", or
// "$120" into a single representative amount. Previously this stripped all
// non-digit characters and parsed the result as one number, which turned a
// range like "$80-150" into 80150 — fixed to take the first number in the
// string (a sensible starting quote) instead.
function parseBudgetAmount(budget, fallback = 100) {
  if (!budget) return fallback;
  const match = String(budget).match(/\d+/);
  if (!match) return fallback;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// GET /api/categories — public directory of active categories with real,
// live counts of verified providers in each (no auth required; this powers
// the marketing homepage and the full "Browse Categories" page).
router.get('/categories', (req, res) => {
  const categories = db.filter('categories', c => c.active);
  const withCounts = categories.map(c => ({
    id: c.id,
    name: c.name,
    proCount: db.filter('users', u => u.role === 'provider' && u.verified && u.category === c.name).length,
  }));
  res.json({ categories: withCounts });
});

// GET /api/providers?category=Plumbing&q=leak&city=Atlanta
router.get('/providers', (req, res) => {
  const { category, q, city } = req.query;
  // Only verified providers appear in the public directory — showing an
  // unverified provider here (even briefly, while their documents are in
  // review) would contradict the "Fully Verified" promise shown on the
  // marketing page and profile badges.
  let providers = db.filter('users', u => u.role === 'provider' && u.verified);
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
  const p = db.find('users', u => u.id === req.params.id && u.role === 'provider' && u.verified);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  const reviews = db.filter('reviews', r => r.providerId === p.id);
  res.json({ provider: publicProvider(p), reviews });
});

// ---- Jobs & AI matching -----------------------------------------------------

// POST /api/jobs — customer posts a job, triggers AI matching immediately
router.post('/jobs', requireAuth, requireRole('customer'), (req, res) => {
  const { category, description, budget } = req.body || {};
  const errors = validate([
    ['category', isNonEmptyString(category), 'Category is required'],
    ['description', isNonEmptyString(description, { min: 5, max: 500 }), 'Description must be between 5 and 500 characters'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const activeCategories = db.filter('categories', c => c.active).map(c => c.name);
  if (!activeCategories.includes(category)) {
    return res.status(400).json({ error: `"${category}" is not a currently bookable category` });
  }
  if (budget && !isNonEmptyString(budget, { max: 40 })) {
    return res.status(400).json({ error: 'Budget must be under 40 characters' });
  }

  const job = {
    id: `job_${nanoid(10)}`,
    customerId: req.user.sub,
    category, description: description.trim(), budget: budget ? budget.trim() : null,
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
  const withJob = matches.map(m => {
    const customer = db.find('users', u => u.id === m.customerId);
    return { ...m, job: db.find('jobs', j => j.id === m.jobId), customerName: customer ? customer.name : 'Customer' };
  });
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
  let escrow = null;
  if (decision === 'accept') {
    const job = db.find('jobs', j => j.id === match.jobId);
    const amount = parseBudgetAmount(job && job.budget, 100);
    contract = {
      id: `ct_${nanoid(10)}`,
      customerId: match.customerId,
      providerId: match.providerId,
      jobId: match.jobId,
      service: job ? job.description : 'Service',
      amount,
      status: 'active',
      signedAt: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    db.insert('contracts', contract);
    // Every accepted contract holds funds in escrow — this was previously only
    // happening for direct bookings (POST /contracts), not AI-matched ones,
    // which meant matched jobs could never be paid out. Fixed here so both
    // paths behave identically.
    escrow = { id: `esc_${nanoid(10)}`, contractId: contract.id, amount, status: 'held', createdAt: new Date().toISOString() };
    db.insert('escrowTransactions', escrow);
    if (job) db.update('jobs', job.id, { status: 'matched' });
  }
  res.json({ match, contract, escrow });
});

// ---- Contracts / bookings ----------------------------------------------------

// POST /api/contracts — direct booking of a specific provider (skips matching)
router.post('/contracts', requireAuth, requireRole('customer'), (req, res) => {
  const { providerId, service, date, time, address, amount } = req.body || {};
  const errors = validate([
    ['providerId', isNonEmptyString(providerId), 'A provider must be selected'],
    ['service', isNonEmptyString(service, { min: 3, max: 200 }), 'Describe the service in at least 3 characters'],
    ['date', isNonEmptyString(date), 'Pick a date for the job'],
    ['time', isNonEmptyString(time), 'Pick a time for the job'],
    ['address', isNonEmptyString(address, { min: 5, max: 200 }), 'Enter a valid address'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  const provider = db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  const contract = {
    id: `ct_${nanoid(10)}`,
    customerId: req.user.sub,
    providerId,
    service: service.trim(),
    date, time, address: address.trim(),
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
