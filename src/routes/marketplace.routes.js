const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { isNonEmptyString, validate } = require('../validators');
const { notify } = require('../notify');

const router = express.Router();

function publicProvider(u) {
  return {
    id: u.id, name: u.name, initials: u.initials, role: u.providerRole, category: u.category,
    rating: u.rating, jobs: u.jobs, price: u.price, tags: u.tags, color: u.color, since: u.since,
    verified: u.verified, country: u.country, city: u.city, zipCode: u.zipCode,
    availability: u.availability && u.availability.length ? u.availability : ['Morning (8–12pm)', 'Afternoon (12–5pm)', 'Evening (5–8pm)'],
    pricingModel: u.pricingModel || 'hourly',
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
router.get('/categories', async (req, res) => {
  const categories = await db.filter('categories', c => c.active);
  const withCounts = await Promise.all(categories.map(async c => ({
    id: c.id,
    name: c.name,
    proCount: (await db.filter('users', u => u.role === 'provider' && u.verified && u.category === c.name)).length,
  })));
  res.json({ categories: withCounts });
});

// GET /api/providers?category=Plumbing&q=leak&city=Atlanta
router.get('/providers', async (req, res) => {
  const { category, q, city } = req.query;
  // Only verified providers appear in the public directory — showing an
  // unverified provider here (even briefly, while their documents are in
  // review) would contradict the "Fully Verified" promise shown on the
  // marketing page and profile badges.
  let providers = await db.filter('users', u => u.role === 'provider' && u.verified);
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
router.get('/providers/:id', async (req, res) => {
  const p = await db.find('users', u => u.id === req.params.id && u.role === 'provider' && u.verified);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  const reviews = await db.filter('reviews', r => r.providerId === p.id);
  res.json({ provider: publicProvider(p), reviews });
});

// ---- Jobs & AI matching -----------------------------------------------------

// POST /api/jobs — customer posts a job, triggers AI matching immediately
router.post('/jobs', requireAuth, requireRole('customer'), async (req, res) => {
  const { category, description, budget } = req.body || {};
  const errors = validate([
    ['category', isNonEmptyString(category), 'Category is required'],
    ['description', isNonEmptyString(description, { min: 5, max: 500 }), 'Description must be between 5 and 500 characters'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const activeCategories = (await db.filter('categories', c => c.active)).map(c => c.name);
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
  await db.insert('jobs', job);

  // --- AI matching (deterministic scoring stand-in for a real ranking model) ---
  // Score = base 70 + rating weight + experience weight + community-proximity
  // boost + small deterministic jitter derived from the job id, so results
  // are stable but vary per job.
  //
  // "Community" here means zip/postal code: a provider in the customer's
  // exact zip code is a tighter geographic match than merely being in the
  // same city, so they get ranked higher. This is a real, honest proximity
  // signal — not simulated geolocation — using data the account already
  // has (no third-party geocoding API required). If real lat/long-based
  // radius search is wanted later, this is the function to replace.
  const customer = await db.find('users', u => u.id === req.user.sub);
  const candidates = await db.filter('users', u => u.role === 'provider' && u.category === category && u.verified && (!customer || u.city === customer.city));
  const scored = candidates.map(p => {
    const jitter = (parseInt(job.id.slice(-4), 36) % 7);
    const sameCommunity = customer && p.zipCode && customer.zipCode && p.zipCode === customer.zipCode;
    const communityBoost = sameCommunity ? 8 : 0;
    const score = Math.min(99, Math.round(70 + p.rating * 4 + Math.min(p.jobs, 300) / 30 + communityBoost + jitter));
    return { provider: p, score, sameCommunity };
  }).sort((a, b) => b.score - a.score).slice(0, 3);

  const matches = [];
  for (const { provider, score, sameCommunity } of scored) {
    const match = {
      id: `match_${nanoid(10)}`,
      jobId: job.id,
      providerId: provider.id,
      customerId: req.user.sub,
      score,
      sameCommunity,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await db.insert('matches', match);
    await notify(provider.id, '🎯', `New AI job match: ${job.description.slice(0, 50)}${job.description.length > 50 ? '…' : ''} (${score}% fit)`, 'newMatches');
    matches.push({ ...match, provider: publicProvider(provider) });
  }

  res.status(201).json({ job, matches });
});

// GET /api/jobs/mine — customer's posted jobs
router.get('/jobs/mine', requireAuth, requireRole('customer'), async (req, res) => {
  const jobs = await db.filter('jobs', j => j.customerId === req.user.sub);
  res.json({ jobs });
});

// GET /api/matches/mine — provider's pending AI matches
router.get('/matches/mine', requireAuth, requireRole('provider'), async (req, res) => {
  const matches = await db.filter('matches', m => m.providerId === req.user.sub && m.status === 'pending');
  const withJob = await Promise.all(matches.map(async m => {
    const customer = await db.find('users', u => u.id === m.customerId);
    const job = await db.find('jobs', j => j.id === m.jobId);
    return { ...m, job, customerName: customer ? customer.name : 'Customer' };
  }));
  res.json({ matches: withJob });
});

// POST /api/matches/:id/respond  { decision: 'accept' | 'decline' }
router.post('/matches/:id/respond', requireAuth, requireRole('provider'), async (req, res) => {
  const { decision } = req.body || {};
  const match = await db.find('matches', m => m.id === req.params.id && m.providerId === req.user.sub);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ error: 'decision must be accept or decline' });

  await db.update('matches', match.id, { status: decision === 'accept' ? 'accepted' : 'declined' });

  let contract = null;
  let escrow = null;
  if (decision === 'accept') {
    const job = await db.find('jobs', j => j.id === match.jobId);
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
    await db.insert('contracts', contract);
    // Every accepted contract holds funds in escrow — this was previously only
    // happening for direct bookings (POST /contracts), not AI-matched ones,
    // which meant matched jobs could never be paid out. Fixed here so both
    // paths behave identically.
    escrow = { id: `esc_${nanoid(10)}`, contractId: contract.id, amount, status: 'held', createdAt: new Date().toISOString() };
    await db.insert('escrowTransactions', escrow);
    if (job) await db.update('jobs', job.id, { status: 'matched' });
    const provider = await db.find('users', u => u.id === match.providerId);
    await notify(match.customerId, '🤝', `${provider ? provider.name : 'Your matched pro'} accepted your job — contract signed and escrow funded.`, 'bookingUpdates');
  }
  res.json({ match, contract, escrow });
});

// ---- Contracts / bookings ----------------------------------------------------

// POST /api/contracts — direct booking of a specific provider (skips matching)
router.post('/contracts', requireAuth, requireRole('customer'), async (req, res) => {
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

  const provider = await db.find('users', u => u.id === providerId && u.role === 'provider');
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
  await db.insert('contracts', contract);
  const escrow = { id: `esc_${nanoid(10)}`, contractId: contract.id, amount: contract.amount, status: 'held', createdAt: new Date().toISOString() };
  await db.insert('escrowTransactions', escrow);
  res.status(201).json({ contract, escrow });
});

// GET /api/contracts/mine — works for both customers and providers
router.get('/contracts/mine', requireAuth, async (req, res) => {
  const field = req.user.role === 'provider' ? 'providerId' : 'customerId';
  const contracts = await db.filter('contracts', c => c[field] === req.user.sub);
  const withNames = await Promise.all(contracts.map(async c => {
    const customer = await db.find('users', u => u.id === c.customerId);
    const provider = await db.find('users', u => u.id === c.providerId);
    const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
    const reviewed = !!(await db.find('reviews', r => r.contractId === c.id));
    return { ...c, customerName: customer ? customer.name : 'Customer', providerName: provider ? provider.name : 'Provider', escrow, reviewed };
  }));
  res.json({ contracts: withNames });
});

// POST /api/reviews — leave a review for a completed contract (customer only,
// once per contract). Recomputes the provider's average rating from every
// real review on file, so the rating shown across the app becomes genuine
// customer feedback instead of a static seeded number.
router.post('/reviews', requireAuth, requireRole('customer'), async (req, res) => {
  const { contractId, stars, text } = req.body || {};
  const errors = validate([
    ['stars', Number.isInteger(stars) && stars >= 1 && stars <= 5, 'Rating must be between 1 and 5 stars'],
    ['text', isNonEmptyString(text, { min: 5, max: 500 }), 'Review must be between 5 and 500 characters'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const contract = await db.find('contracts', c => c.id === contractId && c.customerId === req.user.sub);
  if (!contract) return res.status(404).json({ error: 'Contract not found' });
  if (contract.status !== 'completed') {
    return res.status(400).json({ error: 'You can only review a job after it is marked complete' });
  }
  const existing = await db.find('reviews', r => r.contractId === contractId);
  if (existing) return res.status(409).json({ error: "You've already reviewed this job" });

  const customer = await db.find('users', u => u.id === req.user.sub);
  const review = {
    id: `rev_${nanoid(10)}`,
    contractId,
    providerId: contract.providerId,
    authorName: customer ? customer.name : 'Customer',
    stars,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  await db.insert('reviews', review);

  // Recompute the provider's average rating from every review on file.
  const allReviews = await db.filter('reviews', r => r.providerId === contract.providerId);
  const avg = allReviews.reduce((s, r) => s + r.stars, 0) / allReviews.length;
  await db.update('users', contract.providerId, { rating: Math.round(avg * 10) / 10 });

  await notify(contract.providerId, '⭐', `New ${stars}-star review: "${text.trim().slice(0, 60)}${text.length > 60 ? '…' : ''}"`);

  res.status(201).json({ review });
});

// POST /api/disputes — customer or provider raises a real dispute against a
// contract they're actually party to. Previously the UI claimed "customer/
// provider-raised disputes" but no such endpoint existed at all — only
// admins could resolve pre-existing (seeded) disputes.
router.post('/disputes', requireAuth, async (req, res) => {
  const { contractId, reason } = req.body || {};
  const errors = validate([
    ['contractId', isNonEmptyString(contractId), 'A booking must be selected'],
    ['reason', isNonEmptyString(reason, { min: 10, max: 500 }), 'Describe the issue in at least 10 characters'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const contract = await db.find('contracts', c =>
    c.id === contractId && (c.customerId === req.user.sub || c.providerId === req.user.sub)
  );
  if (!contract) return res.status(404).json({ error: 'Booking not found' });
  if (contract.status === 'disputed') {
    return res.status(409).json({ error: 'There is already an open dispute on this booking' });
  }
  if (contract.status !== 'active') {
    return res.status(400).json({ error: `This booking is ${contract.status} and can no longer be disputed` });
  }
  const existing = await db.find('disputes', d => d.contractId === contractId && d.status !== 'resolved');
  if (existing) return res.status(409).json({ error: 'There is already an open dispute on this booking' });

  const customer = await db.find('users', u => u.id === contract.customerId);
  const provider = await db.find('users', u => u.id === contract.providerId);
  const dispute = {
    id: `dp_${nanoid(10)}`,
    contractId,
    reason: reason.trim(),
    amount: contract.amount,
    status: 'open',
    parties: `${provider ? provider.name : 'Provider'} ↔ ${customer ? customer.name : 'Customer'}`,
    createdAt: new Date().toISOString(),
  };
  await db.insert('disputes', dispute);
  await db.update('contracts', contractId, { status: 'disputed' });

  // Notify whichever party didn't raise the dispute.
  const otherPartyId = req.user.sub === contract.customerId ? contract.providerId : contract.customerId;
  await notify(otherPartyId, '⚠️', `A dispute was opened on "${contract.service}" — our team is reviewing it.`, 'bookingUpdates');

  res.status(201).json({ dispute });
});

module.exports = router;
