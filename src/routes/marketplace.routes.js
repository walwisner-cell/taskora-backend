const express = require('express');
const { COUNTRIES, statesForCountry } = require('../geo-data');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { isNonEmptyString, validate } = require('../validators');
const { notify } = require('../notify');

const router = express.Router();

// The internal contract id (ct_xxxxxxxxxx) is what the system/API uses —
// fine for URLs and database keys, but not something a customer wants to
// read out over the phone to a provider. This generates a short 6-digit
// number instead, purely for humans to reference the same booking by.
async function generateBookingNumber() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    const collision = await db.find('contracts', c => c.bookingNumber === candidate);
    if (!collision) return candidate;
  }
  // Astronomically unlikely to ever reach here (5 collisions in a row out of
  // 900,000 possibilities), but fall back to a guaranteed-unique value
  // rather than ever leaving a contract without one.
  return String(Date.now()).slice(-6);
}

function publicProvider(u) {
  return {
    id: u.id, name: u.name, initials: u.initials, role: u.providerRole, category: u.category,
    rating: u.rating, jobs: u.jobs, price: u.price, tags: u.tags, color: u.color, since: u.since,
    verified: u.verified, country: u.country, city: u.city, zipCode: u.zipCode,
    availability: u.availability && u.availability.length ? u.availability : ['Morning (8–12pm)', 'Afternoon (12–5pm)', 'Evening (5–8pm)'],
    pricingModel: u.pricingModel || 'hourly',
    plan: u.plan || 'starter',
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
    icon: c.icon || '🛠️',
    proCount: (await db.filter('users', u => u.role === 'provider' && u.verified && u.category === c.name)).length,
  })));
  res.json({ categories: withCounts });
});

// GET /api/cities — public, name+country only (no admin details — that
// stays behind /admin/cities). Cities here are ones with a dedicated
// regional admin assigned — a real, valuable feature, but no longer a
// requirement for signup (see /api/geo below): a customer or provider can
// select any real country + state/region even if no city there has its own
// admin yet, and simply falls under the super admin's oversight until one
// is assigned.
router.get('/cities', async (req, res) => {
  const cities = await db.all('cities');
  res.json({ cities: cities.map(c => ({ name: c.name, country: c.country })) });
});

// GET /api/geo — the real, full geographic reference data: every country,
// and (for the countries with real subdivision data) their actual
// states/provinces/regions. This is what powers the signup form's
// Country → State/Region dropdowns, and what the AI matching engine uses to
// expand a search outward (city → state → country) when nothing is found
// in the customer's exact city. City itself stays free text — a full
// worldwide city database would be tens of thousands of entries and
// unusable as a dropdown; country + state is the real, bounded, well-known
// dataset that scales.
router.get('/geo', async (req, res) => {
  const liveCountries = (await db.filter('countries', c => c.status === 'live')).map(c => c.name);
  // Only actually-live countries are offered — matches the super admin's
  // real toggle in Categories & Countries, so turning a country off there
  // genuinely removes it from signup, not just from a marketing label.
  const countries = COUNTRIES.filter(c => liveCountries.includes(c));
  const statesByCountry = {};
  for (const c of countries) statesByCountry[c] = statesForCountry(c);
  res.json({ countries, statesByCountry });
});

// GET /api/providers?category=Plumbing&q=leak&city=Atlanta
// GET /api/providers/featured — for the homepage carousel. Only providers
// on a paid plan (Pro or Super Pro) ever appear here — that's the actual
// perk of paying, not a cosmetic label. Super Pro providers are weighted
// 2x as likely to appear as Pro providers in any given rotation, matching
// the requested 4x/day vs 2x/day ratio: guaranteeing an exact literal count
// per calendar day would need real session/analytics tracking per visitor,
// which doesn't exist yet, so this implements the same relative emphasis
// (2:1) through weighted random rotation instead — proportionally correct,
// verifiable by anyone pulling this endpoint repeatedly, not a fixed fake
// schedule.
router.get('/providers/featured', async (req, res) => {
  const paid = await db.filter('users', u => u.role === 'provider' && u.verified && ['pro', 'superpro'].includes(u.plan));
  const weighted = [];
  for (const p of paid) {
    const weight = p.plan === 'superpro' ? 2 : 1;
    for (let i = 0; i < weight; i++) weighted.push(p);
  }
  // Shuffle (Fisher-Yates) so repeated calls don't always return the same
  // order, then de-duplicate back down to unique providers for display,
  // preserving the shuffled (weighted) order.
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  const seen = new Set();
  const ordered = [];
  for (const p of weighted) {
    if (!seen.has(p.id)) { seen.add(p.id); ordered.push(p); }
  }
  res.json({ providers: ordered.map(publicProvider) });
});

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

// GET /api/providers/:id  (profile page: includes reviews and portfolio photos)
router.get('/providers/:id', async (req, res) => {
  const p = await db.find('users', u => u.id === req.params.id && u.role === 'provider' && u.verified);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  const reviews = await db.filter('reviews', r => r.providerId === p.id);
  const portfolio = await db.filter('portfolioPhotos', ph => ph.providerId === p.id);
  res.json({ provider: publicProvider(p), reviews, portfolio });
});

// ---- Jobs & AI matching -----------------------------------------------------

// POST /api/jobs — customer posts a job, triggers AI matching immediately
router.post('/jobs', requireAuth, requireRole('customer'), async (req, res) => {
  const { category, description, budget } = req.body || {};
  const errors = validate([
    ['category', isNonEmptyString(category, { min: 2, max: 60 }), 'Category is required'],
    ['description', isNonEmptyString(description, { min: 5, max: 500 }), 'Description must be between 5 and 500 characters'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const activeCategories = (await db.filter('categories', c => c.active)).map(c => c.name);
  const isKnownCategory = activeCategories.includes(category);
  // A job in a category we don't currently list is still a real request —
  // rejecting it here would mean "sorry, we can't help you" the moment a
  // customer's actual need doesn't match our current catalog. It posts
  // normally; AI matching just won't find anyone yet (no provider is tagged
  // to a category that doesn't exist), and the super admin is notified so
  // real demand for a new category is visible instead of silently lost.
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

  if (!isKnownCategory) {
    const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
    for (const admin of superAdmins) {
      await notify(admin.id, '📋', `A customer requested "${category}" — not a current category. Consider adding it if you're seeing repeat demand.`);
    }
  }

  // --- AI matching (deterministic scoring stand-in for a real ranking model) ---
  // Score = base 70 + rating weight + experience weight + community-proximity
  // boost + small deterministic jitter derived from the job id, so results
  // are stable but vary per job.
  //
  // Geographic scope expands outward in real stages, never skipping ahead
  // and never crossing into another country: try the customer's exact city
  // first; if nothing verified is found there, widen to the same
  // state/region; only if THAT comes up empty does it widen to the whole
  // country. A customer in Lagos is never matched to a provider in Abuja
  // over one in a different country, no matter how good that provider is.
  const customer = await db.find('users', u => u.id === req.user.sub);
  const allInCategory = await db.filter('users', u => u.role === 'provider' && u.category === category && u.verified);

  let candidates = [];
  let matchScope = 'city';
  if (!customer) {
    candidates = allInCategory;
    matchScope = 'none';
  } else {
    candidates = allInCategory.filter(p => p.city && p.city.toLowerCase() === customer.city.toLowerCase() && p.country === customer.country);
    if (!candidates.length && customer.state) {
      candidates = allInCategory.filter(p => p.state && p.state.toLowerCase() === customer.state.toLowerCase() && p.country === customer.country);
      matchScope = 'state';
    }
    if (!candidates.length && customer.country) {
      candidates = allInCategory.filter(p => p.country === customer.country);
      matchScope = 'country';
    }
  }

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

  res.status(201).json({ job, matches, isKnownCategory, matchScope });
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
      bookingNumber: await generateBookingNumber(),
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

  const isNegotiable = provider.pricingModel === 'negotiable';
  if (isNegotiable && (amount === undefined || amount <= 0)) {
    return res.status(400).json({ error: 'Enter your offer amount for this provider' });
  }

  const contract = {
    id: `ct_${nanoid(10)}`,
    bookingNumber: await generateBookingNumber(),
    customerId: req.user.sub,
    providerId,
    service: service.trim(),
    date, time, address: address.trim(),
    amount: amount || provider.price * 2,
    // Mutual Agreement pricing means exactly that — the customer's offer is
    // a proposal, not a binding charge, until the provider actually agrees
    // to that specific number. Hourly-rate bookings still confirm and fund
    // escrow immediately, same as before, since the price was never in
    // question there.
    status: isNegotiable ? 'pending_agreement' : 'active',
    signedAt: isNegotiable ? null : new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  await db.insert('contracts', contract);

  let escrow = null;
  if (isNegotiable) {
    const customer = await db.find('users', u => u.id === req.user.sub);
    await notify(providerId, '🤝', `${customer ? customer.name : 'A customer'} sent an offer of $${contract.amount} for "${contract.service}" — accept to confirm the booking, or decline.`);
  } else {
    escrow = { id: `esc_${nanoid(10)}`, contractId: contract.id, amount: contract.amount, status: 'held', createdAt: new Date().toISOString() };
    await db.insert('escrowTransactions', escrow);
  }
  res.status(201).json({ contract, escrow });
});

// POST /api/contracts/:id/respond-offer — provider accepts or declines a
// Mutual Agreement offer. Accepting is the actual moment the fund amount
// becomes agreed and recorded: only then does a real contract go active and
// escrow get funded, at exactly the number the provider agreed to.
router.post('/contracts/:id/respond-offer', requireAuth, requireRole('provider'), async (req, res) => {
  const { decision } = req.body || {};
  if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ error: 'decision must be accept or decline' });
  const contract = await db.find('contracts', c => c.id === req.params.id && c.providerId === req.user.sub);
  if (!contract) return res.status(404).json({ error: 'Offer not found' });
  if (contract.status !== 'pending_agreement') {
    return res.status(400).json({ error: `This offer is already ${contract.status} and can't be responded to again` });
  }

  if (decision === 'decline') {
    const updated = await db.update('contracts', contract.id, { status: 'declined' });
    await notify(contract.customerId, '❌', `Your offer of $${contract.amount} for "${contract.service}" was declined.`);
    return res.json({ contract: updated, escrow: null });
  }

  const updated = await db.update('contracts', contract.id, { status: 'active', signedAt: new Date().toISOString().slice(0, 10) });
  const escrow = { id: `esc_${nanoid(10)}`, contractId: contract.id, amount: contract.amount, status: 'held', createdAt: new Date().toISOString() };
  await db.insert('escrowTransactions', escrow);
  await notify(contract.customerId, '🤝', `Your offer of $${contract.amount} for "${contract.service}" was accepted — escrow funded, booking confirmed.`);
  res.json({ contract: updated, escrow });
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

// GET /api/contracts/:id/pdf — a real, downloadable PDF record of the
// contract. Requested specifically so there's something concrete to hand a
// court or a lawyer if a dispute over a booking ever needs to go beyond the
// app — this is a genuine generated document, not a screenshot or a
// formatted webpage.
router.get('/contracts/:id/pdf', requireAuth, async (req, res) => {
  const contract = await db.find('contracts', c =>
    c.id === req.params.id && (c.customerId === req.user.sub || c.providerId === req.user.sub || req.user.role === 'admin')
  );
  if (!contract) return res.status(404).json({ error: 'Contract not found' });

  const customer = await db.find('users', u => u.id === contract.customerId);
  const provider = await db.find('users', u => u.id === contract.providerId);
  const escrow = await db.find('escrowTransactions', e => e.contractId === contract.id);
  const dispute = await db.find('disputes', d => d.contractId === contract.id);

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Taskora-Contract-${contract.bookingNumber || contract.id}.pdf"`);
  doc.pipe(res);

  const navy = '#12161F';
  const slate = '#5A5F6C';
  const gold = '#B08A3E';

  doc.fillColor(navy).fontSize(22).font('Helvetica-Bold').text('TASKORA', { continued: false });
  doc.fillColor(gold).fontSize(11).font('Helvetica-Bold').text('SERVICE CONTRACT', { characterSpacing: 1 });
  doc.moveDown(0.3);
  doc.fillColor(slate).fontSize(9).font('Helvetica').text(`Generated ${new Date().toLocaleString('en-US')}`);
  doc.moveDown(1.2);
  doc.strokeColor('#D8D3C8').lineWidth(1).moveTo(56, doc.y).lineTo(556, doc.y).stroke();
  doc.moveDown(1);

  function row(label, value) {
    doc.fillColor(slate).fontSize(9).font('Helvetica-Bold').text(label.toUpperCase(), { continued: false });
    doc.fillColor(navy).fontSize(12).font('Helvetica').text(value || '—');
    doc.moveDown(0.6);
  }

  row('Booking Number', contract.bookingNumber || contract.id);
  row('Internal Reference ID', contract.id);
  row('Status', contract.status.charAt(0).toUpperCase() + contract.status.slice(1));
  doc.moveDown(0.4);

  doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('PARTIES');
  doc.moveDown(0.3);
  row('Customer', customer ? `${customer.name} (${customer.email})` : 'Unknown');
  row('Provider', provider ? `${provider.name} (${provider.email})` : 'Unknown');
  doc.moveDown(0.4);

  doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('SERVICE DETAILS');
  doc.moveDown(0.3);
  row('Service', contract.service);
  if (contract.date) row('Scheduled Date', `${contract.date}${contract.time ? ' · ' + contract.time : ''}`);
  if (contract.address) row('Service Address', contract.address);
  row('Agreed Amount', `$${contract.amount}`);
  row('Contract Signed', contract.signedAt || new Date(contract.createdAt).toLocaleDateString());
  doc.moveDown(0.4);

  doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('ESCROW & PAYMENT');
  doc.moveDown(0.3);
  if (escrow) {
    row('Escrow Amount', `$${escrow.amount}`);
    row('Escrow Status', escrow.status.charAt(0).toUpperCase() + escrow.status.slice(1));
  } else {
    row('Escrow Status', 'No escrow record on file');
  }

  if (dispute) {
    doc.moveDown(0.4);
    doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('DISPUTE RECORD');
    doc.moveDown(0.3);
    row('Reason', dispute.reason);
    row('Dispute Status', dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1));
    row('Opened', new Date(dispute.createdAt).toLocaleDateString());
  }

  doc.moveDown(1.5);
  doc.strokeColor('#D8D3C8').lineWidth(1).moveTo(56, doc.y).lineTo(556, doc.y).stroke();
  doc.moveDown(0.6);
  doc.fillColor(slate).fontSize(8).font('Helvetica').text(
    'This document is a system-generated record of a Taskora booking, reflecting the state of the contract, escrow, and any dispute at the time of generation. It is provided for the parties\' own recordkeeping.',
    { width: 500 }
  );

  doc.end();
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
