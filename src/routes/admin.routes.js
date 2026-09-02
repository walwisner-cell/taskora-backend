const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole, hashPassword } = require('../auth');
const { isValidEmail, isNonEmptyString, isValidPassword, isValidName, isValidLabel, validate } = require('../validators');
const { notify } = require('../notify');
const { effectiveCommissionRate } = require('../commission');
const { effectivePlanPricing, PLAN_KEYS, DEFAULT_USD_PRICES } = require('../plan-pricing');
const { currencyForCountry, APPROX_USD_RATE, CURRENCY_BY_COUNTRY } = require('../currency-data');
const { UPLOADS_DIR, verifyImageMagicBytes, verifyPdfMagicBytes } = require('../uploads');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// A suspended admin's existing token would otherwise keep working for up to
// 7 days (tokens aren't re-checked against the DB by requireAuth itself).
// This re-fetches the fresh record on every admin request so a suspension
// takes effect immediately, not whenever the token happens to expire.
router.use(async (req, res, next) => {
  const current = await db.find('users', u => u.id === req.user.sub);
  if (!current || current.active === false) {
    return res.status(403).json({ error: 'This account has been suspended. Contact a super admin for access.' });
  }
  next();
});

// Every route below runs as an admin (super admin or a location admin).
// `me` is the fresh DB record (not just the JWT payload) so a change to an
// admin's region or active status takes effect immediately, without needing
// a new token.
async function me(req) {
  return db.find('users', u => u.id === req.user.sub);
}

// null region = super admin = sees everything. A non-null region scopes
// every query below to that one city.
// A department admin (Verification, Disputes, Financial, HR, etc.) is
// global by default — but can now be scoped to their own city too, via
// the explicit regionScoped flag set at creation (see POST
// /admin/sub-admins). Defaults to false/unset, so every admin account
// created before this existed keeps behaving exactly as it does today —
// nothing silently changes for anyone already set up.
//
// 'sales' deliberately never regionalizes even if the flag is somehow
// set: sales leads are about custom multi-seat organization deals, which
// aren't really a per-city concept the way disputes or verification
// queues are.
async function myRegion(req) {
  const m = await me(req);
  if (!m) return null;
  if (m.isSuperAdmin) return null;
  if (!m.adminDepartment) return m.region; // plain regional admin — unchanged, always scoped
  if (m.adminDepartment !== 'sales' && m.regionScoped) return m.city;
  return null;
}

async function requireSuperAdmin(req, res, next) {
  const m = await me(req);
  if (!m || !m.isSuperAdmin) return res.status(403).json({ error: 'This action requires a super admin account' });
  next();
}

// Stricter than requireDepartment: gates a genuinely company-wide business
// function (Sales Inquiries, Organizations) that a plain regional admin
// should NOT see just because they have no department set — unlike
// requireDepartment, only a super admin or an admin explicitly scoped to
// this exact department passes. A dispute or verification request can come
// from any city, so those stay open to unscoped regional admins by
// default; a Custom-plan sales deal or a multi-seat organization account
// is a different kind of thing entirely, closer to Locations & Admins.
function requireSuperAdminOrDepartment(dept) {
  return async (req, res, next) => {
    const m = await me(req);
    if (!m) return res.status(403).json({ error: 'Not authorized' });
    if (m.isSuperAdmin) return next();
    if (m.adminDepartment === dept) return next();
    return res.status(403).json({ error: `This requires a super admin account or ${dept === 'sales' ? 'Sales team' : dept} access.` });
  };
}

// Gates access to one functional department's endpoints (verification,
// disputes, financial). A super admin always passes. A regular admin with
// no department set (a regional admin, the original role) also passes —
// they still have full access to their own city's data, unchanged. A
// department-scoped admin only passes for THEIR department; scoped admins
// see data across all regions for that one function, not just one city,
// since a dispute or a verification request can come from anywhere.
function requireDepartment(deptOrDepts) {
  const allowed = Array.isArray(deptOrDepts) ? deptOrDepts : [deptOrDepts];
  return async (req, res, next) => {
    const m = await me(req);
    if (!m) return res.status(403).json({ error: 'Not authorized' });
    if (m.isSuperAdmin) return next();
    if (!m.adminDepartment) return next(); // regular regional admin — unchanged access
    if (allowed.includes(m.adminDepartment)) return next();
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  };
}

// Resolve which city a dispute "belongs to" via its contract's customer.
async function disputeCity(dispute) {
  const contract = await db.find('contracts', c => c.id === dispute.contractId);
  if (!contract) return null;
  const customer = await db.find('users', u => u.id === contract.customerId);
  return customer ? customer.city : null;
}

function publicAdmin(u, options = {}) {
  const { passwordHash, ...rest } = u;
  // Masked by default for any customer or provider record — this is the
  // one function nearly every admin endpoint in this file routes a user
  // record through, so fixing it here closes the gap everywhere at
  // once, not just in the one list view it was first caught in. Admin
  // accounts themselves aren't masked (their own contact info isn't the
  // "customer/provider sensitive data" concern here), and the explicit
  // `unmasked: true` passed only by GET /users/:id/contact below is the
  // one deliberate, logged exception.
  if (!options.unmasked && (rest.role === 'customer' || rest.role === 'provider')) {
    return {
      ...rest,
      email: maskEmail(rest.email),
      phone: maskPhone(rest.phone),
      address: rest.address ? '••••• (hidden — use Reveal Contact Info)' : rest.address,
    };
  }
  return rest;
}

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const region = await myRegion(req);
  const users = (await db.all('users')).filter(u => !region || u.city === region);
  const allDisputes = await db.all('disputes');
  const disputes = [];
  for (const d of allDisputes) {
    if (!region || (await disputeCity(d)) === region) disputes.push(d);
  }
  const allContracts = await db.all('contracts');
  const contracts = [];
  for (const c of allContracts) {
    if (!region) { contracts.push(c); continue; }
    const customer = await db.find('users', u => u.id === c.customerId);
    if (customer && customer.city === region) contracts.push(c);
  }
  const pendingUsers = users.filter(u => u.role !== 'admin' && u.verified === false).length;
  const gmv = contracts.reduce((s, c) => s + (c.amount || 0), 0);
  res.json({
    totalUsers: users.length,
    pendingApprovals: pendingUsers,
    openDisputes: disputes.filter(d => d.status !== 'resolved').length,
    gmv,
    region: region || 'All Locations',
  });
});

// GET /api/admin/reports/analytics — the real data behind Reports &
// Analytics. Everything here is computed from actual contracts, not
// stored counters — notably this replaces what the "Demand by Category"
// chart used to show (verified PROVIDER count per category — supply, not
// demand) with genuine booking counts, and computes each provider's
// "jobs completed" from real completed contracts rather than the static
// `jobs` field on their user record, which is seed data that nothing in
// this codebase ever increments (worth fixing on provider profile pages
// too — flagged separately, out of scope for this endpoint).
router.get('/reports/analytics', async (req, res) => {
  const region = await myRegion(req);
  const [allCategories, allProviders, allContracts, allCustomers] = await Promise.all([
    db.all('categories'),
    db.filter('users', u => u.role === 'provider'),
    db.all('contracts'),
    db.filter('users', u => u.role === 'customer'),
  ]);
  const customerById = new Map(allCustomers.map(c => [c.id, c]));
  const providerById = new Map(allProviders.map(p => [p.id, p]));

  // Scope contracts to this admin's city (via the CUSTOMER's city, same
  // convention as /stats and everywhere else a region is derived) — a
  // regional admin's reports should reflect their own city's activity,
  // not the whole platform's.
  const contracts = region
    ? allContracts.filter(c => { const cust = customerById.get(c.customerId); return cust && cust.city === region; })
    : allContracts;
  const providers = region ? allProviders.filter(p => p.city === region) : allProviders;

  // ── Category performance: REAL demand (bookings), not provider supply ──
  const catStats = new Map(); // category -> { jobsBooked, gmv, ratings: [] }
  for (const c of contracts) {
    const provider = providerById.get(c.providerId);
    const category = provider ? (provider.category || 'Uncategorized') : 'Uncategorized';
    if (!catStats.has(category)) catStats.set(category, { jobsBooked: 0, gmv: 0 });
    const s = catStats.get(category);
    s.jobsBooked += 1;
    s.gmv += c.amount || 0;
  }
  const providerCountByCategory = new Map();
  const ratingsByCategory = new Map();
  for (const p of providers) {
    if (!p.category) continue;
    providerCountByCategory.set(p.category, (providerCountByCategory.get(p.category) || 0) + 1);
    if (p.rating) {
      if (!ratingsByCategory.has(p.category)) ratingsByCategory.set(p.category, []);
      ratingsByCategory.get(p.category).push(p.rating);
    }
  }
  const categoryPerformance = Array.from(catStats.entries()).map(([category, s]) => {
    const ratings = ratingsByCategory.get(category) || [];
    return {
      category,
      jobsBooked: s.jobsBooked,
      gmv: Math.round(s.gmv * 100) / 100,
      avgJobValue: s.jobsBooked ? Math.round((s.gmv / s.jobsBooked) * 100) / 100 : 0,
      providerCount: providerCountByCategory.get(category) || 0,
      avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    };
  }).sort((a, b) => b.jobsBooked - a.jobsBooked);

  // ── Jobs over time: last 30 days, real daily counts, zero-filled so a
  // quiet day shows as a real zero rather than just being absent ──
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const countByDay = new Map(days.map(d => [d, 0]));
  for (const c of contracts) {
    const day = (c.createdAt || '').slice(0, 10);
    if (countByDay.has(day)) countByDay.set(day, countByDay.get(day) + 1);
  }
  const jobsOverTime = days.map(d => ({ date: d, count: countByDay.get(d) }));

  // ── Top providers by REAL completed jobs (not the static `jobs` field
  // on their profile, which is unmaintained seed data) ──
  const topProviders = providers.map(p => {
    const theirContracts = contracts.filter(c => c.providerId === p.id);
    const completed = theirContracts.filter(c => c.status === 'completed');
    return {
      id: p.id,
      name: p.name,
      category: p.category || null,
      city: p.city || null,
      jobsCompleted: completed.length,
      jobsBooked: theirContracts.length,
      gmv: Math.round(completed.reduce((s, c) => s + (c.amount || 0), 0) * 100) / 100,
      rating: p.rating || null,
    };
  }).sort((a, b) => b.jobsCompleted - a.jobsCompleted || b.jobsBooked - a.jobsBooked).slice(0, 10);

  res.json({
    region: region || 'All Locations',
    categoryPerformance,
    totalCategories: allCategories.length,
    jobsOverTime,
    topProviders,
  });
});

// GET /api/admin/users/pending
router.get('/users/pending', async (req, res) => {
  const region = await myRegion(req);
  const pending = (await db.filter('users', u => u.role !== 'admin' && u.verified === false && (!region || u.city === region)))
    .map(publicAdmin);
  res.json({ users: pending });
});

// GET /api/admin/users/all?role=customer|provider — the full customer/provider
// directory. A location admin only ever sees people in their own assigned
// city — that's the whole point of location admins existing. A super admin
// passes no region filter here, so they always see (and can act on)
// everyone, everywhere, regardless of what any location admin's scope is.
router.get('/users/all', async (req, res) => {
  const { logAccess } = require('../access-log');
  await logAccess(req, 'people_list');
  const region = await myRegion(req);
  const { role } = req.query;
  let users = await db.filter('users', u => u.role === 'customer' || u.role === 'provider');
  if (region) users = users.filter(u => u.city === region);
  if (role && ['customer', 'provider'].includes(role)) users = users.filter(u => u.role === role);
  // publicAdmin() masks contact info by default for any customer/provider
  // record — see its definition above for the full reasoning. This was
  // the endpoint the original gap was caught in; the masking itself now
  // lives at the source so every other endpoint that returns a person's
  // record is covered too, not just this one.
  res.json({ users: users.map(u => publicAdmin(u)) });
});

// Masks all but the first character of the local part and keeps the
// domain visible (e.g. "jordan@example.com" -> "j*****@example.com") —
// enough to visually distinguish rows in a list without exposing the
// real address.
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}
// Keeps only the last 2 digits visible.
function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone;
  const digitsOnly = phone.replace(/\D/g, '');
  const last2 = digitsOnly.slice(-2);
  return `•••-•••-••${last2}`;
}

// GET /api/admin/users/:id/contact — the real, unmasked email and phone
// for one specific person, on demand. Every call is logged (see
// src/access-log.js) with who looked and when — this is the
// accountability half of masking-by-default: contact info stays
// reachable for a real reason, but browsing it casually no longer
// happens silently.
router.get('/users/:id/contact', async (req, res) => {
  const m = await me(req);
  // Customer service specifically should never need this — everything
  // they do (responding to a message, helping with a booking) already
  // works through the app's own messaging and booking systems without
  // knowing someone's personal phone or email. Sales and HR deal with
  // entirely different people (org leads, job applicants) and have no
  // legitimate reason to be looking up a marketplace customer or
  // provider's contact info at all.
  const blockedDepartments = ['customer_service', 'sales', 'hr'];
  if (m.adminDepartment && blockedDepartments.includes(m.adminDepartment)) {
    return res.status(403).json({ error: `The ${m.adminDepartment.replace('_', ' ')} team doesn't have access to personal contact info.` });
  }
  const region = await myRegion(req);
  const target = await db.find('users', u => u.id === req.params.id && (u.role === 'customer' || u.role === 'provider'));
  if (!target) return res.status(404).json({ error: 'Person not found' });
  if (region && target.city !== region) return res.status(403).json({ error: 'That person is outside your assigned city' });
  const { logAccess } = require('../access-log');
  await logAccess(req, 'contact_info_reveal', target.id);
  res.json({ email: target.email, phone: target.phone, address: [target.address, target.zipCode].filter(Boolean).join(', ') || null });
});

// POST /api/admin/customers/:id/vip — grant or revoke VIP membership.
// Super admin only, and deliberately the only way VIP is ever assigned —
// see src/membership.js for why it's not something a customer can buy
// at any price ("Invitation/eligibility" was explicit about this).
router.post('/customers/:id/vip', requireSuperAdmin, async (req, res) => {
  const target = await db.find('users', u => u.id === req.params.id && u.role === 'customer');
  if (!target) return res.status(404).json({ error: 'Customer not found' });
  const { grant } = req.body || {};
  if (typeof grant !== 'boolean') return res.status(400).json({ error: 'grant must be true or false' });
  const updated = await db.update('users', target.id, grant
    ? { membershipTier: 'vip', membershipStartedAt: new Date().toISOString(), membershipPrice: null }
    : { membershipTier: 'free', membershipCancelledAt: new Date().toISOString(), membershipPrice: null });
  await notify(target.id, grant ? '💎' : '👋', grant
    ? 'You\'ve been invited to Trothen VIP — our top membership tier, including concierge support.'
    : 'Your Trothen VIP membership has ended. You\'re now on the Free tier.', null, { section: 'settings' });
  res.json({ user: publicAdmin(updated) });
});

// GET /api/admin/providers/:id/score — a live, freshly-computed trust
// score for one provider (not just whatever was last saved by the daily
// sweep) — useful when reviewing a specific account right now rather
// than waiting for the next scheduled run.
router.get('/providers/:id/score', async (req, res) => {
  const region = await myRegion(req);
  const provider = await db.find('users', u => u.id === req.params.id && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  if (region && provider.city !== region) return res.status(403).json({ error: 'That provider is outside your assigned city' });
  const { computeProviderScore, recommendedActionForScore } = require('../provider-score');
  const result = await computeProviderScore(provider.id);
  res.json({ ...result, recommendedAction: recommendedActionForScore(result.total) });
});

// GET /api/admin/providers/leaderboard — every provider ranked by trust
// score, highest first. Uses whatever was last computed by the daily
// sweep (see src/provider-score-scheduler.js) rather than recomputing
// everyone live on every request — a ranked list doesn't need to be
// second-by-second fresh the way reviewing one specific account does.
router.get('/providers/leaderboard', async (req, res) => {
  const region = await myRegion(req);
  const { recommendedActionForScore } = require('../provider-score');
  let providers = await db.filter('users', u => u.role === 'provider' && u.trustScore != null);
  if (region) providers = providers.filter(p => p.city === region);
  providers.sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));
  res.json({
    providers: providers.map(p => ({
      id: p.id, name: p.name, city: p.city, category: p.category,
      trustScore: p.trustScore, plan: p.plan, rating: p.rating, jobs: p.jobs,
      trustScoreUpdatedAt: p.trustScoreUpdatedAt,
      onHold: p.onHold, holdUntil: p.holdUntil,
      recommendedAction: recommendedActionForScore(p.trustScore),
    })),
  });
});

// POST /api/admin/providers/:id/apply-score-pause — the real, human
// action behind a score-based pause recommendation. Pre-fills from
// recommendedActionForScore if no duration is given, but always requires
// a real click from a real admin — nothing pauses a provider's account
// on its own. Reuses the existing onHold mechanism (same one manual
// holds already use) with a new holdUntil so it auto-expires — see
// src/document-expiry-scheduler.js-style daily sweep pattern; the
// hold-expiry sweep itself is in provider-score-scheduler's neighbor,
// wired in server.js.
router.post('/providers/:id/apply-score-pause', async (req, res) => {
  const region = await myRegion(req);
  const provider = await db.find('users', u => u.id === req.params.id && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  if (region && provider.city !== region) return res.status(403).json({ error: 'That provider is outside your assigned city' });

  const { recommendedActionForScore } = require('../provider-score');
  const recommended = recommendedActionForScore(provider.trustScore);
  const months = typeof req.body.months === 'number' && req.body.months > 0 ? req.body.months : (recommended ? recommended.months : null);
  if (!months) return res.status(400).json({ error: 'No recommended pause for this provider\'s current score, and no custom duration was given' });

  const holdUntil = new Date();
  holdUntil.setMonth(holdUntil.getMonth() + months);

  const updated = await db.update('users', provider.id, {
    onHold: true,
    holdReason: `Trust score-based pause (score: ${provider.trustScore}/99) — ${months} month${months === 1 ? '' : 's'}`,
    holdSince: new Date().toISOString(),
    holdUntil: holdUntil.toISOString(),
  });
  await notify(provider.id, '⏸️', `Your account has been paused for ${months} month${months === 1 ? '' : 's'} based on your current trust score (${provider.trustScore}/99). It will automatically reactivate on ${holdUntil.toLocaleDateString()}. Contact support if you have questions.`, null, { section: 'settings' });
  res.json({ user: publicAdmin(updated) });
});

// PATCH /api/admin/users/:id/status  { active: true|false } — suspend or
// reactivate a customer or provider account. Location admins can only do
// this to people in their own city; a super admin can do it to anyone,
// anytime, overriding whatever a location admin has set.
router.patch('/users/:id/status', async (req, res) => {
  const { active } = req.body || {};
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active must be true or false' });
  const region = await myRegion(req);
  const target = await db.find('users', u => u.id === req.params.id && (u.role === 'customer' || u.role === 'provider'));
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (region && target.city !== region) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const updated = await db.update('users', target.id, { active });
  await notify(target.id, active ? '✅' : '⛔', active ? 'Your account has been reactivated.' : 'Your account has been suspended. Contact support for details.', null, { section: 'settings' });

  // A suspended provider's in-progress jobs don't resolve themselves —
  // previously nothing happened to them at all, and a customer with real
  // money already in escrow would have no idea anything was wrong. This
  // doesn't auto-refund (the right call depends on why the suspension
  // happened, which this endpoint has no way to know) — it makes sure a
  // real person sees it and the affected customer isn't left in the dark.
  if (!active && target.role === 'provider') {
    const activeContracts = await db.filter('contracts', c => c.providerId === target.id && ['active', 'pending_agreement', 'pending_provider_confirmation'].includes(c.status));
    for (const contract of activeContracts) {
      await notify(contract.customerId, '⚠️', `Your provider for "${contract.service}" has had their account suspended. Our team is reviewing your booking and will follow up shortly — contact support if you need this resolved sooner.`, 'bookingUpdates', { section: 'bookings' });
    }
    if (activeContracts.length) {
      const supers = await db.filter('users', u => u.isSuperAdmin === true);
      for (const admin of supers) {
        await notify(admin.id, '⚠️', `${target.name} was just suspended with ${activeContracts.length} active booking${activeContracts.length === 1 ? '' : 's'} still in progress — these need a real decision (refund, reassign, etc.).`, null, { section: 'disputes' });
      }
    }
  }

  res.json({ user: publicAdmin(updated) });
});

// POST /api/admin/providers/:id/propose-commission-rate — a regional
// admin's way to reward a specific provider's excellent performance with
// a better individual commission rate, outside the normal Starter/Pro/
// Super-Pro tier ladder. This only ever proposes — it takes effect
// nowhere until a super admin approves it below. A regional admin can
// only propose this for a provider in their own city; a super admin can
// propose (and approve their own proposal) for anyone.
router.post('/providers/:id/propose-commission-rate', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const { rate, reason } = req.body || {};
  if (typeof rate !== 'number' || rate < 0 || rate > 0.5) {
    return res.status(400).json({ error: 'Rate must be a number between 0 and 0.5 (e.g. 0.08 for 8%)' });
  }
  if (!isNonEmptyString(reason, { min: 10, max: 500 })) {
    return res.status(400).json({ error: 'Explain why this provider has earned a custom rate (at least 10 characters) — a super admin needs this to actually decide' });
  }
  const region = await myRegion(req);
  const provider = await db.find('users', u => u.id === req.params.id && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  if (region && provider.city !== region) return res.status(403).json({ error: 'That provider is outside your assigned city' });
  if (provider.commissionRateOverrideStatus === 'pending') {
    return res.status(400).json({ error: 'This provider already has a proposal awaiting approval' });
  }

  const updated = await db.update('users', provider.id, {
    commissionRateOverride: rate,
    commissionRateOverrideStatus: 'pending',
    commissionRateOverrideReason: reason.trim(),
    commissionRateOverrideProposedBy: m.id,
  });

  const supers = await db.filter('users', u => u.isSuperAdmin === true);
  for (const admin of supers) {
    await notify(admin.id, '💲', `${m.name} proposed a custom ${(rate * 100).toFixed(1)}% commission rate for ${provider.name}: "${reason.trim().slice(0, 80)}${reason.length > 80 ? '…' : ''}" — needs your approval.`, null, { section: 'people' });
  }

  res.json({ user: publicAdmin(updated) });
});

// POST /api/admin/providers/:id/commission-rate/:decision — super admin
// only. Approving actually activates the rate (see
// effectiveCommissionRate in src/commission.js); rejecting clears the
// proposal entirely rather than leaving a rejected rate sitting on the
// record.
router.post('/providers/:id/commission-rate/:decision', requireSuperAdmin, async (req, res) => {
  const { decision } = req.params;
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  const provider = await db.find('users', u => u.id === req.params.id && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  if (provider.commissionRateOverrideStatus !== 'pending') {
    return res.status(400).json({ error: 'This provider has no pending commission rate proposal' });
  }

  if (decision === 'approve') {
    const updated = await db.update('users', provider.id, { commissionRateOverrideStatus: 'approved' });
    await notify(provider.id, '🎉', `You've been approved for a custom ${(provider.commissionRateOverride * 100).toFixed(1)}% commission rate, effective immediately — recognition for your excellent performance.`, null, { section: 'settings' });
    if (provider.commissionRateOverrideProposedBy) {
      await notify(provider.commissionRateOverrideProposedBy, '✅', `Your proposed commission rate for ${provider.name} was approved.`, null, { section: 'people' });
    }
    return res.json({ user: publicAdmin(updated) });
  }

  const updated = await db.update('users', provider.id, {
    commissionRateOverride: null,
    commissionRateOverrideStatus: null,
    commissionRateOverrideReason: null,
  });
  if (provider.commissionRateOverrideProposedBy) {
    await notify(provider.commissionRateOverrideProposedBy, '❌', `Your proposed commission rate for ${provider.name} was not approved.`, null, { section: 'people' });
  }
  res.json({ user: publicAdmin(updated) });
});
// no longer set their own plan (that was the actual bug: anyone could
// click a button and set themselves to Pro or Super-Pro with zero check
// on whether they'd earned it). Pro now advances automatically once real
// stats qualify (see checkAndAdvanceProviderTier); Super-Pro is
// explicitly "reviewed, not automatic" per policy, so this is the real
// approval action an admin takes after that automatic check flags
// someone as eligible.
// PATCH /api/admin/users/:id/hold — release an account from a temporary
// hold (or place one manually, for cases a real admin wants to pause
// without waiting for an automatic flag). This is the actual human
// decision every hold ultimately routes to — nothing about the hold
// system can resolve itself.
router.patch('/users/:id/hold', async (req, res) => {
  const { onHold, reason } = req.body || {};
  if (typeof onHold !== 'boolean') return res.status(400).json({ error: 'onHold must be true or false' });
  const region = await myRegion(req);
  const target = await db.find('users', u => u.id === req.params.id && (u.role === 'customer' || u.role === 'provider'));
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (region && target.city !== region) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const updated = await db.update('users', target.id, {
    onHold,
    holdReason: onHold ? (reason || 'Placed on hold by an admin') : null,
    holdSince: onHold ? new Date().toISOString() : null,
  });
  await notify(target.id, onHold ? '⏸️' : '✅', onHold
    ? `Your account has been temporarily paused${reason ? `: ${reason}` : ''}. Contact support if you have questions.`
    : 'Your account hold has been cleared — you can book and accept jobs normally again.', null, { section: 'settings' });
  res.json({ user: publicAdmin(updated) });
});

router.patch('/users/:id/plan', requireSuperAdmin, async (req, res) => {
  const { plan } = req.body || {};
  if (!['starter', 'pro', 'superpro'].includes(plan)) return res.status(400).json({ error: 'plan must be starter, pro, or superpro' });
  const target = await db.find('users', u => u.id === req.params.id && u.role === 'provider');
  if (!target) return res.status(404).json({ error: 'Provider not found' });
  const updated = await db.update('users', target.id, { plan, superProEligibleSince: plan === 'superpro' ? target.superProEligibleSince : null });
  await notify(target.id, '🏆', `Your plan has been updated to ${plan === 'superpro' ? 'Super-Pro' : plan === 'pro' ? 'Pro' : 'Starter'} by an admin.`, null, { section: 'settings' });
  res.json({ user: publicAdmin(updated) });
});

// POST /api/admin/users/:id/decide  { decision: 'approve' | 'reject' }
router.post('/users/:id/decide', requireDepartment(['verification', 'customer_service']), async (req, res) => {
  const { decision } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  const region = await myRegion(req);
  const target = await db.find('users', u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (region && target.city !== region) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const updated = await db.update('users', req.params.id, { verified: decision === 'approve', status: decision === 'approve' ? 'approved' : 'rejected' });
  await notify(target.id, decision === 'approve' ? '✅' : '❌', decision === 'approve' ? 'Your account has been approved.' : 'Your account application was not approved. Contact support for details.', null, { section: 'overview' });
  res.json({ user: publicAdmin(updated) });
});

// GET /api/admin/verification-queue
// GET /api/admin/providers-with-guarantors — every provider who's
// actually submitted guarantors, for the verification team to work
// through and call. Verification-department only, matching the same
// access as the rest of the identity-verification workflow.
router.get('/providers-with-guarantors', requireDepartment(['verification']), async (req, res) => {
  const region = await myRegion(req);
  let providers = await db.filter('users', u => u.role === 'provider' && u.guarantors && u.guarantors.length > 0);
  if (region) providers = providers.filter(p => p.city === region);
  res.json({ providers: providers.map(p => ({ id: p.id, name: p.name, city: p.city, category: p.category, guarantors: p.guarantors })) });
});

// PATCH /api/admin/providers/:id/guarantors/:index — mark one specific
// guarantor as contacted or verified, after the verification team has
// actually called them. :index refers to the guarantor's position in
// the provider's own guarantors list (0, 1, or 2).
router.patch('/providers/:id/guarantors/:index', requireDepartment(['verification']), async (req, res) => {
  const region = await myRegion(req);
  const provider = await db.find('users', u => u.id === req.params.id && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  if (region && provider.city !== region) return res.status(403).json({ error: 'That provider is outside your assigned city' });
  const idx = parseInt(req.params.index, 10);
  const guarantors = provider.guarantors || [];
  if (!Number.isInteger(idx) || idx < 0 || idx >= guarantors.length) {
    return res.status(404).json({ error: 'That guarantor was not found on this provider\'s account' });
  }
  const { status } = req.body || {};
  if (!['contacted', 'verified'].includes(status)) return res.status(400).json({ error: 'status must be contacted or verified' });
  guarantors[idx] = { ...guarantors[idx], status, contactedAt: new Date().toISOString() };
  const updated = await db.update('users', provider.id, { guarantors });
  if (status === 'verified') {
    await notify(provider.id, '✅', `Your guarantor "${guarantors[idx].name}" has been contacted and verified — thank you for helping us keep Trothen trustworthy.`, null, { section: 'verification' });
  }
  res.json({ user: publicAdmin(updated) });
});

router.get('/verification-queue', requireDepartment(['verification']), async (req, res) => {
  const region = await myRegion(req);
  const inReview = await db.filter('verifications', v => v.status === 'in review');
  const queue = [];
  for (const v of inReview) {
    const user = await db.find('users', u => u.id === v.userId);
    const entry = { ...v, userName: user ? user.name : 'Unknown', country: user ? user.country : '', city: user ? user.city : null };
    if (!region || entry.city === region) queue.push(entry);
  }
  res.json({ queue });
});

// POST /api/admin/verification/:id/decide  { decision: 'approve' | 'reject' }
router.post('/verification/:id/decide', requireDepartment(['verification']), async (req, res) => {
  const { decision } = req.body || {};
  const record = await db.find('verifications', v => v.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Verification record not found' });
  const region = await myRegion(req);
  const user = await db.find('users', u => u.id === record.userId);
  if (region && (!user || user.city !== region)) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const status = decision === 'approve' ? 'approved' : 'rejected';
  await db.update('verifications', record.id, { status });
  if (decision === 'approve') await db.update('users', record.userId, { verified: true });
  await notify(record.userId, decision === 'approve' ? '✅' : '❌', decision === 'approve' ? 'Your identity verification was approved.' : 'Your identity verification was rejected — please resubmit your documents.', null, { section: 'verification' });
  res.json({ verification: { ...record, status } });
});

// GET /api/admin/disputes
router.get('/disputes', requireDepartment(['disputes', 'customer_service', 'legal']), async (req, res) => {
  const { logAccess } = require('../access-log');
  await logAccess(req, 'disputes_list');
  const region = await myRegion(req);
  const { from, to } = req.query;
  const all = await db.all('disputes');
  const disputes = [];
  for (const d of all) {
    if (from && (d.createdAt || '').slice(0, 10) < from) continue;
    if (to && (d.createdAt || '').slice(0, 10) > to) continue;
    if (!region || (await disputeCity(d)) === region) disputes.push(d);
  }
  res.json({ disputes });
});

// GET /api/admin/disputes/pdf — a real downloadable dispute report,
// respecting the same region/department scope as the on-screen list.
// GET /api/admin/fraud-flags — every real flag raised by the rule-based
// fraud/safety checks, newest first. This is what actually backs the "every
// job screened automatically" claim — a real, reviewable queue, not just a
// marketing line.
router.get('/fraud-flags', requireDepartment('disputes'), async (req, res) => {
  const flags = await db.all('fraudFlags');
  const withNames = await Promise.all(flags.map(async f => {
    const user = f.userId ? await db.find('users', u => u.id === f.userId) : null;
    const relatedUser = f.relatedUserId ? await db.find('users', u => u.id === f.relatedUserId) : null;
    return {
      id: f.id, type: f.type, severity: f.severity, details: f.details, status: f.status,
      userName: user ? user.name : null, userEmail: user ? user.email : null,
      relatedUserName: relatedUser ? relatedUser.name : null,
      contractId: f.contractId, createdAt: f.createdAt,
    };
  }));
  withNames.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ flags: withNames });
});

// POST /api/admin/fraud-flags/:id/resolve — mark a flag reviewed or
// dismissed after a human has actually looked at it.
router.post('/fraud-flags/:id/resolve', requireDepartment('disputes'), async (req, res) => {
  const { decision } = req.body || {}; // 'reviewed' or 'dismissed'
  if (!['reviewed', 'dismissed'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be reviewed or dismissed' });
  }
  const flag = await db.find('fraudFlags', f => f.id === req.params.id);
  if (!flag) return res.status(404).json({ error: 'Flag not found' });
  const updated = await db.update('fraudFlags', flag.id, { status: decision, reviewedAt: new Date().toISOString() });
  res.json({ flag: updated });
});

router.get('/disputes/pdf', requireDepartment(['disputes', 'customer_service', 'legal']), async (req, res) => {
  const region = await myRegion(req);
  const { from, to } = req.query;
  const all = await db.all('disputes');
  const disputes = [];
  for (const d of all) {
    if (from && (d.createdAt || '').slice(0, 10) < from) continue;
    if (to && (d.createdAt || '').slice(0, 10) > to) continue;
    if (!region || (await disputeCity(d)) === region) disputes.push(d);
  }
  disputes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const me_ = await me(req);
  const { createReportDoc } = require('../pdf-report-builder');
  const rangeLabel = from || to ? `${from || 'earliest'} to ${to || 'today'}` : 'All time';
  const { sectionHeader, row, twoColumnRow, table, finish } = createReportDoc({
    res,
    filename: `Trothen-Disputes-Report.pdf`,
    title: 'Disputes Report',
    subtitle: region ? `Scoped to ${region}` : 'All locations',
    docId: rangeLabel,
    verificationSeed: `disputes|${me_.id}|${region || 'all'}|${from || ''}|${to || ''}|${disputes.length}`,
  });

  sectionHeader('Report Summary');
  twoColumnRow('Scope', region || 'All locations', 'Date Range', rangeLabel);
  const open = disputes.filter(d => d.status === 'open').length;
  const resolved = disputes.filter(d => d.status === 'resolved').length;
  twoColumnRow('Total Disputes', String(disputes.length), 'Open / Resolved', `${open} open, ${resolved} resolved`);

  sectionHeader('Disputes');
  if (disputes.length === 0) {
    row('No disputes', 'No disputes were found in this date range.');
  } else {
    table(
      [{ label: 'Dispute', width: 75 }, { label: 'Parties', width: 140 }, { label: 'Reason', width: 150 }, { label: 'Amount', width: 55, align: 'right' }, { label: 'Status', width: 60 }],
      disputes.map(d => [d.id, d.parties, d.reason, `$${d.amount}`, d.status])
    );
  }

  finish({ closingNote: 'This report reflects Trothen\'s dispute records within the scope and date range shown, as of the moment it was generated.' });
});

// GET /api/admin/transactions — every real contract on the platform (or
// within an admin's assigned city), with escrow and payout status. This is
// what the admin Payments page actually needs — previously it was showing
// unrelated demo data, not real platform transactions.
router.get('/transactions', requireDepartment(['financial', 'accountant', 'controller', 'legal']), async (req, res) => {
  const { logAccess } = require('../access-log');
  await logAccess(req, 'transactions_list');
  const region = await myRegion(req);
  const { from, to } = req.query;
  let contracts = await db.all('contracts');
  if (from) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) >= from);
  if (to) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) <= to);
  contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const rows = await Promise.all(contracts.map(async c => {
    const customer = await db.find('users', u => u.id === c.customerId);
    const provider = await db.find('users', u => u.id === c.providerId);
    const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
    return { c, customer, provider, escrow };
  }));
  const orgsById = new Map((await db.all('organizations')).map(o => [o.id, o]));

  const scoped = region ? rows.filter(r => r.customer && r.customer.city === region) : rows;
  const transactions = scoped.map(({ c, customer, provider, escrow }) => {
    const materialsAdvanceAmount = (escrow && escrow.materialsAdvanceAmount) || 0;
    // Real commission is only recorded on the payout itself, once it's
    // actually paid out (see payments.routes.js). Until then, this is a
    // clearly-labeled *estimate* — amount x the provider's effective rate
    // (their org's volume-discount rate if they're on a Custom-plan org,
    // otherwise their individual plan rate) — so admins aren't left
    // guessing what a job will net the platform before payout happens.
    const commissionRate = provider ? effectiveCommissionRate(provider, orgsById.get(provider.organizationId)) : null;
    const estCommission = commissionRate != null ? Math.round(c.amount * commissionRate * 100) / 100 : null;
    return {
      contractId: c.id,
      bookingNumber: c.bookingNumber || c.id,
      date: (c.createdAt || '').slice(0, 10),
      customerName: customer ? customer.name : 'Unknown',
      customerEmail: customer ? customer.email : null,
      providerName: provider ? provider.name : 'Unknown',
      category: provider ? (provider.category || null) : null,
      city: customer ? (customer.city || null) : null,
      country: customer ? (customer.country || null) : null,
      service: c.service,
      amount: c.amount,
      materialsAdvanceAmount,
      status: c.status,
      escrowStatus: escrow ? escrow.status : 'none',
      paidOut: !!(escrow && escrow.payoutId),
      commissionRate,
      estCommission,
    };
  });
  res.json({ transactions });
});

// GET /api/admin/transactions/pdf — a real, downloadable platform
// transactions report, same scoping and date range as the JSON endpoint.
router.get('/transactions/pdf', requireDepartment(['financial', 'accountant', 'controller', 'legal']), async (req, res) => {
  const { logAccess } = require('../access-log');
  await logAccess(req, 'transactions_pdf_download');
  const region = await myRegion(req);
  const { from, to } = req.query;
  let contracts = await db.all('contracts');
  if (from) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) >= from);
  if (to) contracts = contracts.filter(c => (c.createdAt || '').slice(0, 10) <= to);

  const rows = await Promise.all(contracts.map(async c => {
    const customer = await db.find('users', u => u.id === c.customerId);
    const provider = await db.find('users', u => u.id === c.providerId);
    const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
    return { c, customer, provider, escrow };
  }));
  const scoped = (region ? rows.filter(r => r.customer && r.customer.city === region) : rows)
    .sort((a, b) => new Date(a.c.createdAt) - new Date(b.c.createdAt));

  const me_ = await me(req);
  const { createReportDoc } = require('../pdf-report-builder');
  const rangeLabel = from || to ? `${from || 'earliest'} to ${to || 'today'}` : 'All time';

  // Realized commission = what's actually been deducted on real payouts,
  // scoped to the same region and date range as the transactions above —
  // distinct from the estimate, which projects commission on jobs that
  // haven't paid out yet.
  let payoutsInScope = await db.all('payouts');
  if (from) payoutsInScope = payoutsInScope.filter(p => (p.date || '').slice(0, 10) >= from);
  if (to) payoutsInScope = payoutsInScope.filter(p => (p.date || '').slice(0, 10) <= to);
  if (region) {
    const regionalProviderIds = new Set((await db.filter('users', u => u.role === 'provider' && u.city === region)).map(u => u.id));
    payoutsInScope = payoutsInScope.filter(p => regionalProviderIds.has(p.providerId));
  }
  const payoutsCommissionInScope = payoutsInScope.reduce((s, p) => s + (p.commissionAmount || 0), 0);
  const orgsById = new Map((await db.all('organizations')).map(o => [o.id, o]));

  const { sectionHeader, row, twoColumnRow, table, finish } = createReportDoc({
    res,
    filename: `Trothen-Platform-Transactions-Report.pdf`,
    title: 'Platform Transactions Report',
    subtitle: region ? `Scoped to ${region}` : 'All locations',
    docId: rangeLabel,
    verificationSeed: `transactions|${me_.id}|${region || 'all'}|${from || ''}|${to || ''}|${scoped.length}`,
  });

  sectionHeader('Report Summary');
  twoColumnRow('Scope', region || 'All locations', 'Date Range', rangeLabel);
  const totalGMV = scoped.reduce((s, r) => s + r.c.amount, 0);
  const totalHeld = scoped.filter(r => r.escrow && r.escrow.status === 'held').reduce((s, r) => s + r.escrow.amount, 0);
  const totalReleased = scoped.filter(r => r.escrow && r.escrow.status === 'released').reduce((s, r) => s + r.escrow.amount, 0);
  const totalEstCommission = scoped.reduce((s, r) => s + r.c.amount * effectiveCommissionRate(r.provider, orgsById.get(r.provider && r.provider.organizationId)), 0);
  twoColumnRow('Total GMV', `$${totalGMV.toFixed(2)}`, 'Transactions', String(scoped.length));
  twoColumnRow('Escrow Held', `$${totalHeld.toFixed(2)}`, 'Escrow Released', `$${totalReleased.toFixed(2)}`);
  twoColumnRow('Est. Commission (unpaid + paid)', `$${totalEstCommission.toFixed(2)}`, 'Realized Commission (paid out)', `$${payoutsCommissionInScope.toFixed(2)}`);

  sectionHeader('Transactions');
  if (scoped.length === 0) {
    row('No transactions', 'No transactions were found in this date range.');
  } else {
    table(
      [{ label: 'Date', width: 45 }, { label: 'Customer', width: 75 }, { label: 'Provider', width: 75 }, { label: 'Category', width: 55 }, { label: 'Service', width: 75 }, { label: 'Amount', width: 45, align: 'right' }, { label: 'Est. Comm.', width: 50, align: 'right' }, { label: 'Status', width: 45 }],
      scoped.map(({ c, customer, provider }) => [
        (c.createdAt || '').slice(0, 10),
        customer ? customer.name : 'Unknown',
        provider ? provider.name : 'Unknown',
        (provider && provider.category) || '—',
        c.service,
        `$${c.amount}`,
        `$${(c.amount * effectiveCommissionRate(provider, orgsById.get(provider && provider.organizationId))).toFixed(2)}`,
        c.status,
      ])
    );
  }

  finish({ closingNote: 'This report reflects Trothen\'s transaction records within the scope and date range shown, as of the moment it was generated. GMV figures are gross booking values, not net of commission.' });
});

router.post('/disputes/:id/resolve', requireDepartment(['disputes', 'customer_service']), async (req, res) => {
  const region = await myRegion(req);
  const dispute = await db.find('disputes', d => d.id === req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
  if (region && (await disputeCity(dispute)) !== region) return res.status(403).json({ error: 'That dispute is outside your assigned city' });

  // Previously this only ever had one outcome: release escrow to the
  // provider, no matter what the dispute was actually about. If a
  // customer's complaint was legitimate — the provider never showed up,
  // did damage, didn't finish the job — there was no way to refund them
  // instead. Now the admin picks: release to the provider (defaults to
  // this when no decision is given, so nothing about existing behavior
  // silently changes for a request that doesn't specify one) or refund
  // the customer.
  const { decision } = req.body || {};
  const outcome = decision === 'refund_customer' ? 'refund_customer' : 'release_to_provider';

  const updated = await db.update('disputes', dispute.id, { status: 'resolved', resolvedAt: new Date().toISOString(), resolution: outcome });
  const escrow = await db.find('escrowTransactions', e => e.contractId === updated.contractId);
  const contract = await db.find('contracts', c => c.id === updated.contractId);

  if (outcome === 'refund_customer') {
    const wasRefunded = escrow && escrow.status === 'refunded';
    if (escrow && !wasRefunded) await db.update('escrowTransactions', escrow.id, { status: 'refunded' });
    if (contract) {
      await notify(contract.customerId, '⚖️', `Your dispute (${dispute.reason}) has been resolved in your favor — ${wasRefunded ? 'your payment was already refunded.' : 'your payment has been refunded.'}`, 'bookingUpdates', { section: 'bookings' });
      await notify(contract.providerId, '⚖️', `A dispute on one of your jobs (${dispute.reason}) has been resolved — the customer was refunded, so this booking's escrow will not be released to you.`, 'bookingUpdates', { section: 'bookings' });
    }
    return res.json({ dispute: updated });
  }

  const wasReleased = escrow && escrow.status !== 'released';
  if (escrow) await db.update('escrowTransactions', escrow.id, { status: 'released' });
  if (contract) {
    await notify(contract.customerId, '⚖️', `Your dispute (${dispute.reason}) has been resolved.`, 'bookingUpdates', { section: 'bookings' });
    if (wasReleased) {
      const providerContracts = await db.filter('contracts', c => c.providerId === contract.providerId);
      const providerContractIds = new Set(providerContracts.map(c => c.id));
      const releasedUnpaid = (await db.filter('escrowTransactions', e => e.status === 'released' && !e.payoutId))
        .filter(e => providerContractIds.has(e.contractId));
      const totalAvailable = releasedUnpaid.reduce((s, e) => s + e.amount, 0);
      await notify(contract.providerId, '⚖️', `A dispute on one of your jobs (${dispute.reason}) has been resolved — escrow released. You now have $${totalAvailable} available to request as a payout.`, 'bookingUpdates', { section: 'earnings' });
    } else {
      await notify(contract.providerId, '⚖️', `A dispute on one of your jobs (${dispute.reason}) has been resolved.`, 'bookingUpdates', { section: 'bookings' });
    }
  }
  res.json({ dispute: updated });
});

// ---- Global config: categories & countries (super admin only) --------------
router.get('/categories', async (req, res) => {
  const cats = await db.all('categories');
  const categories = await Promise.all(cats.map(async c => ({
    ...c,
    pros: (await db.filter('users', u => u.role === 'provider' && u.verified && u.category === c.name)).length,
  })));
  res.json({ categories });
});

// GET /api/admin/category-requests — the real approval queue for custom
// categories providers typed in at signup. Includes real elapsed time
// since request, so an overdue-for-24-hours request is actually visible,
// not just implied.
// POST /api/admin/sync-reference-data — safely adds any countries or
// categories that exist in the current codebase but are missing from this
// specific database (common after deploying new code to a database that
// was already seeded a while ago — new code alone doesn't retroactively
// add new reference data to an existing database). Never touches real
// users, bookings, or any existing country/category's settings.
// GET /api/admin/settings/booking-window — super admin only: the tiered
// defaults for how long a provider has to accept or decline a new
// booking, scaled by how soon the job actually is.
router.get('/settings/booking-window', requireSuperAdmin, async (req, res) => {
  const { getSetting, DEFAULTS } = require('../platform-settings');
  const tiers = await getSetting('bookingResponseTiers');
  res.json({ tiers, isDefault: JSON.stringify(tiers) === JSON.stringify(DEFAULTS.bookingResponseTiers) });
});

// PATCH /api/admin/settings/booking-window — super admin only: change the
// tiers. Takes effect immediately for every new booking; doesn't
// retroactively change the deadline on bookings already awaiting a
// response.
router.patch('/settings/booking-window', requireSuperAdmin, async (req, res) => {
  const { within24h, within7d, beyond7d } = req.body || {};
  for (const [label, val] of [['within24h', within24h], ['within7d', within7d], ['beyond7d', beyond7d]]) {
    if (typeof val !== 'number' || val < 0.25 || val > 168) {
      return res.status(400).json({ error: `${label} must be a number of hours between 0.25 and 168 (one week)` });
    }
  }
  const { setSetting } = require('../platform-settings');
  await setSetting('bookingResponseTiers', { within24h, within7d, beyond7d });
  res.json({ ok: true, tiers: { within24h, within7d, beyond7d } });
});

// GET /api/admin/settings/support-contact — the current WhatsApp/phone
// numbers behind the support chat. A super admin sees and edits the
// platform-wide fallback number. A plain regional admin sees and edits
// their own city's number instead — same "own city, not the whole
// platform" pattern already used for ad pricing and advertising
// inquiries. Falls back to the platform-wide number (isPlaceholder still
// computed honestly) if this city hasn't set its own yet.
router.get('/settings/support-contact', requireAuth, requireRole('admin'), async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const { getSetting, DEFAULTS } = require('../platform-settings');
  const region = await myRegion(req);
  const global = await getSetting('supportContact');
  if (!region) {
    return res.json({ ...global, isPlaceholder: global.whatsapp === DEFAULTS.supportContact.whatsapp, region: null });
  }
  const regionalContacts = (await getSetting('regionalSupportContacts')) || {};
  const own = regionalContacts[region];
  if (own) return res.json({ ...own, isPlaceholder: false, region, usingPlatformFallback: false });
  return res.json({ ...global, isPlaceholder: global.whatsapp === DEFAULTS.supportContact.whatsapp, region, usingPlatformFallback: true });
});

// PATCH /api/admin/settings/support-contact — a super admin sets the
// platform-wide fallback; a regional admin sets their own city's real
// number, stored separately so one region's number never overwrites
// another's or the global fallback.
router.patch('/settings/support-contact', requireAuth, requireRole('admin'), async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const { whatsapp, phoneDisplay } = req.body || {};
  if (!isNonEmptyString(whatsapp) || !/^\d{7,15}$/.test(whatsapp)) {
    return res.status(400).json({ error: 'WhatsApp number must be digits only, with country code and no +/spaces/dashes — e.g. 15551234567' });
  }
  if (!isNonEmptyString(phoneDisplay, { min: 5, max: 30 })) {
    return res.status(400).json({ error: 'Enter a valid display phone number' });
  }
  const { getSetting, setSetting } = require('../platform-settings');
  const region = await myRegion(req);
  if (!region) {
    await setSetting('supportContact', { whatsapp, phoneDisplay });
    return res.json({ ok: true, whatsapp, phoneDisplay, region: null });
  }
  const regionalContacts = (await getSetting('regionalSupportContacts')) || {};
  regionalContacts[region] = { whatsapp, phoneDisplay };
  await setSetting('regionalSupportContacts', regionalContacts);
  res.json({ ok: true, whatsapp, phoneDisplay, region });
});

// DELETE /api/admin/settings/support-contact — a regional admin can remove
// their own city's number to fall back to the platform-wide one again
// (e.g. their staff line changed and isn't set up yet). Not available to
// a super admin, who has no "fallback" of their own to fall back to.
router.delete('/settings/support-contact', requireAuth, requireRole('admin'), async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const region = await myRegion(req);
  if (!region) return res.status(400).json({ error: 'The platform-wide number can be changed, but not removed — set a new one instead.' });
  const { getSetting, setSetting } = require('../platform-settings');
  const regionalContacts = (await getSetting('regionalSupportContacts')) || {};
  delete regionalContacts[region];
  await setSetting('regionalSupportContacts', regionalContacts);
  res.json({ ok: true, region });
});

// GET /api/admin/settings/homepage-content — super admin only: the current
// homepage copy, for editing.
router.get('/settings/homepage-content', requireSuperAdmin, async (req, res) => {
  const { getSetting } = require('../platform-settings');
  const content = await getSetting('homepageContent');
  res.json(content);
});

// PATCH /api/admin/settings/homepage-content — super admin only: update
// the homepage copy. Takes effect immediately for every visitor — no
// deploy needed.
router.patch('/settings/homepage-content', requireSuperAdmin, async (req, res) => {
  const { heroPrefix, heroRotatingWords, heroSuffix, heroSubheadline, missionHeadline, missionBody } = req.body || {};
  if (!isNonEmptyString(heroPrefix, { min: 2, max: 60 })) return res.status(400).json({ error: 'Enter a hero headline prefix' });
  if (!Array.isArray(heroRotatingWords) || heroRotatingWords.length === 0 || heroRotatingWords.some(w => typeof w !== 'string' || !w.trim())) {
    return res.status(400).json({ error: 'Enter at least one rotating word (comma-separated)' });
  }
  if (!isNonEmptyString(heroSuffix, { min: 1, max: 40 })) return res.status(400).json({ error: 'Enter a hero headline suffix' });
  if (!isNonEmptyString(heroSubheadline, { min: 10, max: 400 })) return res.status(400).json({ error: 'Enter a hero subheadline (10-400 characters)' });
  if (!isNonEmptyString(missionHeadline, { min: 5, max: 150 })) return res.status(400).json({ error: 'Enter a mission headline' });
  if (!isNonEmptyString(missionBody, { min: 20, max: 1200 })) return res.status(400).json({ error: 'Enter mission body text (20-1200 characters)' });
  const { setSetting } = require('../platform-settings');
  const content = {
    heroPrefix: heroPrefix.trim(),
    heroRotatingWords: heroRotatingWords.map(w => w.trim()).filter(Boolean),
    heroSuffix: heroSuffix.trim(),
    heroSubheadline: heroSubheadline.trim(),
    missionHeadline: missionHeadline.trim(),
    missionBody: missionBody.trim(),
  };
  await setSetting('homepageContent', content);
  res.json({ ok: true, ...content });
});

// ── ABOUT US & TERMS OF SERVICE ──────────────────────────────────────────
// Real, admin-editable long-form pages — previously both were hardcoded
// directly in the HTML with no way to change them without a code deploy.
// Deliberately generous length limit: this is meant for genuinely
// substantial content (a real About page, a real Terms of Service), not a
// short marketing blurb like the homepage copy above.
router.get('/settings/about-us', requireSuperAdmin, async (req, res) => {
  const { getSetting } = require('../platform-settings');
  res.json({ content: await getSetting('aboutUsContent') });
});

router.patch('/settings/about-us', requireSuperAdmin, async (req, res) => {
  const { content } = req.body || {};
  if (!isNonEmptyString(content, { min: 10, max: 50000 })) {
    return res.status(400).json({ error: 'Enter some content (up to 50,000 characters)' });
  }
  const { setSetting } = require('../platform-settings');
  await setSetting('aboutUsContent', content.trim());
  res.json({ ok: true, content: content.trim() });
});

router.get('/settings/terms-of-service-customer', requireSuperAdmin, async (req, res) => {
  const { getSetting } = require('../platform-settings');
  res.json({ content: await getSetting('termsOfServiceCustomerContent') });
});

router.patch('/settings/terms-of-service-customer', requireSuperAdmin, async (req, res) => {
  const { content } = req.body || {};
  if (!isNonEmptyString(content, { min: 10, max: 50000 })) {
    return res.status(400).json({ error: 'Enter some content (up to 50,000 characters)' });
  }
  const { setSetting } = require('../platform-settings');
  await setSetting('termsOfServiceCustomerContent', content.trim());
  res.json({ ok: true, content: content.trim() });
});

router.get('/settings/terms-of-service-provider', requireSuperAdmin, async (req, res) => {
  const { getSetting } = require('../platform-settings');
  res.json({ content: await getSetting('termsOfServiceProviderContent') });
});

router.patch('/settings/terms-of-service-provider', requireSuperAdmin, async (req, res) => {
  const { content } = req.body || {};
  if (!isNonEmptyString(content, { min: 10, max: 50000 })) {
    return res.status(400).json({ error: 'Enter some content (up to 50,000 characters)' });
  }
  const { setSetting } = require('../platform-settings');
  await setSetting('termsOfServiceProviderContent', content.trim());
  res.json({ ok: true, content: content.trim() });
});

// ── HOMEPAGE IMAGES ──────────────────────────────────────────────────────
// Real photo uploads for the marketing homepage — the hero and mission
// sections previously had no photo at all, just icons/gradients. One slot
// per named position on the page; uploading again for the same slot
// replaces whatever was there. Same multer/disk-storage approach already
// proven for provider portfolio photos, just scoped to super admin and
// keyed by slot instead of by provider.
const HOMEPAGE_IMAGE_SLOTS = ['hero', 'mission'];
const homepageImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `homepage_${req.params.slot}_${nanoid(10)}${ext}`);
  },
});
function homepageImageFileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  cb(null, true);
}
const uploadHomepageImage = multer({ storage: homepageImageStorage, fileFilter: homepageImageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/admin/homepage-images/:slot/upload — super admin only.
router.post('/homepage-images/:slot/upload', requireSuperAdmin, (req, res) => {
  if (!HOMEPAGE_IMAGE_SLOTS.includes(req.params.slot)) {
    return res.status(400).json({ error: `slot must be one of: ${HOMEPAGE_IMAGE_SLOTS.join(', ')}` });
  }
  uploadHomepageImage.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No image file was provided' });

    // Same "confirm it actually landed" discipline as portfolio uploads —
    // reporting success on a write that silently didn't stick is the
    // failure mode that's hardest to notice until someone reports a
    // missing homepage image days later.
    if (!fs.existsSync(req.file.path)) {
      console.error(`Homepage image upload reported success but file is missing at ${req.file.path} — check UPLOADS_DIR points to a writable, persistent location.`);
      return res.status(500).json({ error: 'The image could not be saved to disk. Please try again.' });
    }

    if (!verifyImageMagicBytes(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'This file does not appear to be a genuine image — please upload a real photo.' });
    }

    const url = `/uploads/${req.file.filename}`;
    const existing = await db.find('homepageImages', h => h.slot === req.params.slot);
    if (existing) {
      // Clean up the old file on disk now that it's being replaced —
      // otherwise every re-upload just accumulates orphaned files forever.
      const oldPath = path.join(UPLOADS_DIR, existing.filename);
      if (existing.filename && fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
      await db.update('homepageImages', existing.id, { filename: req.file.filename, url, updatedAt: new Date().toISOString() });
    } else {
      await db.insert('homepageImages', { id: `hi_${req.params.slot}`, slot: req.params.slot, filename: req.file.filename, url, createdAt: new Date().toISOString() });
    }
    res.status(201).json({ ok: true, slot: req.params.slot, url });
  });
});

// DELETE /api/admin/homepage-images/:slot — super admin only: removes the
// image, reverting that section back to its icon/gradient look.
router.delete('/homepage-images/:slot', requireSuperAdmin, async (req, res) => {
  const existing = await db.find('homepageImages', h => h.slot === req.params.slot);
  if (!existing) return res.json({ ok: true }); // nothing to remove
  const filePath = path.join(UPLOADS_DIR, existing.filename);
  if (existing.filename && fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  await db.remove('homepageImages', existing.id);
  res.json({ ok: true });
});

// ── CATEGORY IMAGES (Popular Projects section) ──────────────────────────
// GET /api/admin/category-images — super admin only: every category's
// current photo, as a { categoryId: url } map, for the settings panel.
router.get('/category-images', requireSuperAdmin, async (req, res) => {
  const images = await db.all('categoryImages');
  const bySlot = {};
  for (const img of images) bySlot[img.categoryId] = img.url;
  res.json(bySlot);
});

const categoryImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `category_${req.params.categoryId}_${nanoid(10)}${ext}`);
  },
});
const uploadCategoryImage = multer({ storage: categoryImageStorage, fileFilter: homepageImageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/admin/category-images/:categoryId/upload — super admin only.
router.post('/category-images/:categoryId/upload', requireSuperAdmin, (req, res) => {
  uploadCategoryImage.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No image file was provided' });
    const category = await db.find('categories', c => c.id === req.params.categoryId);
    if (!category) { fs.unlink(req.file.path, () => {}); return res.status(404).json({ error: 'Category not found' }); }

    if (!fs.existsSync(req.file.path)) {
      console.error(`Category image upload reported success but file is missing at ${req.file.path} — check UPLOADS_DIR points to a writable, persistent location.`);
      return res.status(500).json({ error: 'The image could not be saved to disk. Please try again.' });
    }

    if (!verifyImageMagicBytes(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'This file does not appear to be a genuine image — please upload a real photo.' });
    }

    const url = `/uploads/${req.file.filename}`;
    const existing = await db.find('categoryImages', h => h.categoryId === req.params.categoryId);
    if (existing) {
      const oldPath = path.join(UPLOADS_DIR, existing.filename);
      if (existing.filename && fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
      await db.update('categoryImages', existing.id, { filename: req.file.filename, url, updatedAt: new Date().toISOString() });
    } else {
      await db.insert('categoryImages', { id: `ci_${req.params.categoryId}`, categoryId: req.params.categoryId, filename: req.file.filename, url, createdAt: new Date().toISOString() });
    }
    res.status(201).json({ ok: true, categoryId: req.params.categoryId, url });
  });
});

// DELETE /api/admin/category-images/:categoryId — super admin only.
router.delete('/category-images/:categoryId', requireSuperAdmin, async (req, res) => {
  const existing = await db.find('categoryImages', h => h.categoryId === req.params.categoryId);
  if (!existing) return res.json({ ok: true });
  const filePath = path.join(UPLOADS_DIR, existing.filename);
  if (existing.filename && fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  await db.remove('categoryImages', existing.id);
  res.json({ ok: true });
});

router.post('/sync-reference-data', requireSuperAdmin, async (req, res) => {
  const { syncReferenceData } = require('../sync-reference-data');
  const result = await syncReferenceData();
  res.json(result);
});

// POST /api/admin/backfill-notification-links — same "new code doesn't
// retroactively fix old data" situation as the jobs-completed backfill:
// category-request, sales-inquiry, and advertising-inquiry notifications
// only started carrying a real linkTo destination once that was added to
// their notify() calls. Any notification created before that still has
// linkTo: null stored forever — new code doesn't rewrite already-saved
// rows on its own. This scans existing notifications and infers the
// correct destination from their own text (the same text each notify()
// call already writes), so old notifications become clickable too instead
// of only new ones going forward.
router.post('/backfill-notification-links', requireSuperAdmin, async (req, res) => {
  const patterns = [
    { match: t => t.includes('not a current category'), linkTo: { section: 'categories' } },
    { match: t => t.includes('New Custom plan sales inquiry'), linkTo: { section: 'sales' } },
    { match: t => t.includes('New advertising inquiry'), linkTo: { section: 'advertising' } },
    { match: t => t.includes('job match:') || t.includes('new AI job matches') || t.includes('new job matches'), linkTo: { section: 'matches' } },
    { match: t => t.includes('Escrow released —') || t.startsWith('Payout of '), linkTo: { section: 'earnings' } },
  ];
  const all = await db.all('notifications');
  let updated = 0;
  for (const n of all) {
    if (n.linkTo) continue; // already has a real destination — don't touch it

    // "New message from X: ..." needs a contactId, not just a section — the
    // notification text only ever recorded the sender's NAME, never their
    // ID, so this is a best-effort match: find a user with that exact name
    // and use them as the contact. Rare-but-possible duplicate names could
    // match the wrong person; still strictly better than staying dead.
    const messageMatch = /^New message from (.+?):/.exec(n.text || '');
    if (messageMatch) {
      const sender = await db.find('users', u => u.name === messageMatch[1]);
      if (sender) {
        await db.update('notifications', n.id, { linkTo: { section: 'messages', contactId: sender.id } });
        updated += 1;
      }
      continue;
    }

    const rule = patterns.find(p => p.match(n.text || ''));
    if (rule) {
      await db.update('notifications', n.id, { linkTo: rule.linkTo });
      updated += 1;
    }
  }
  res.json({ ok: true, checked: all.length, updated });
});

// POST /api/admin/backfill-jobs-completed — one-time correction tool, same
// spirit as sync-reference-data: "new code doesn't retroactively fix old
// data" applies here too. The jobs-completed count is now genuinely
// incremented on every real job completion (see POST
// /contracts/:id/complete), but that only affects jobs completed AFTER
// this fix shipped — any provider's existing count is still whatever
// static seed number they started with. This recomputes every provider's
// count from their actual completed contracts, once, on demand.
//
// Fair warning built into the response, not hidden: for providers with
// little or no real contract history yet, this will show as a large drop
// from an impressive-looking seed number down to an honest small one.
// That's the point — it's real deployments this matters for.
router.post('/backfill-jobs-completed', requireSuperAdmin, async (req, res) => {
  const providers = await db.filter('users', u => u.role === 'provider');
  const contracts = await db.all('contracts');
  let updated = 0;
  const changes = [];
  for (const p of providers) {
    const realCount = contracts.filter(c => c.providerId === p.id && c.status === 'completed').length;
    if (realCount !== (p.jobs || 0)) {
      changes.push({ providerId: p.id, name: p.name, before: p.jobs || 0, after: realCount });
      await db.update('users', p.id, { jobs: realCount });
      updated += 1;
    }
  }
  res.json({ ok: true, providersChecked: providers.length, providersUpdated: updated, changes });
});

router.get('/category-requests', requireSuperAdmin, async (req, res) => {
  const requests = await db.all('categoryRequests');
  const withDetails = await Promise.all(requests.map(async r => {
    const provider = await db.find('users', u => u.id === r.providerId);
    const hoursElapsed = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
    return {
      id: r.id,
      providerId: r.providerId,
      providerName: provider ? provider.name : 'Unknown provider',
      providerEmail: provider ? provider.email : null,
      requestedCategory: r.requestedCategory,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      overdue: r.status === 'pending' && hoursElapsed > 24,
    };
  }));
  res.json({ requests: withDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// POST /api/admin/category-requests/:id/approve — formally adds the
// requested category (if it doesn't already exist) and marks the
// provider's account as approved for it.
// Normalizes a category name for COMPARISON only (never for storage/
// display) — strips punctuation like "&", collapses whitespace, lowercases.
// This is what catches "pick and drop" as the same real category as
// "Pick & Drop" rather than letting a near-duplicate get created just
// because the punctuation or casing differs.
function normalizeCategoryForComparison(name) {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function titleCase(name) {
  return name.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

router.post('/category-requests/:id/approve', requireSuperAdmin, async (req, res) => {
  const request = await db.find('categoryRequests', r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Category request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: `This request is already ${request.status}` });

  const allCategories = await db.all('categories');
  const requestedNormalized = normalizeCategoryForComparison(request.requestedCategory);
  const existingCategory = allCategories.find(c => normalizeCategoryForComparison(c.name) === requestedNormalized);

  // If this really is the same category under different punctuation or
  // casing (e.g. "pick and drop" vs the existing "Pick & Drop"), the
  // provider gets assigned to the REAL existing category rather than a
  // near-duplicate being created — and their account's category field is
  // corrected to match it.
  let finalCategoryName = request.requestedCategory;
  if (existingCategory) {
    finalCategoryName = existingCategory.name;
    await db.update('users', request.providerId, { category: finalCategoryName });
  } else {
    finalCategoryName = titleCase(request.requestedCategory);
    await db.insert('categories', { id: `cat_${nanoid(8)}`, name: finalCategoryName, icon: '🛠️', active: true });
    await db.update('users', request.providerId, { category: finalCategoryName });
  }
  await db.update('users', request.providerId, { categoryApprovalStatus: 'approved' });
  await db.update('categoryRequests', request.id, { status: 'approved', resolvedAt: new Date().toISOString() });
  await notify(request.providerId, '✅', `Your category "${finalCategoryName}" was approved — you're now fully listed and bookable.`, null, { section: 'settings' });
  res.json({ ok: true, matchedExisting: !!existingCategory, finalCategoryName });
});

// POST /api/admin/category-requests/:id/reject — declines the custom
// category; the provider keeps their account (never blocked), but their
// category needs to change before they're fully listed.
router.post('/category-requests/:id/reject', requireSuperAdmin, async (req, res) => {
  const request = await db.find('categoryRequests', r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Category request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: `This request is already ${request.status}` });

  await db.update('users', request.providerId, { categoryApprovalStatus: 'rejected' });
  await db.update('categoryRequests', request.id, { status: 'rejected', resolvedAt: new Date().toISOString() });
  await notify(request.providerId, '❌', `Your category "${request.requestedCategory}" wasn't approved. Please update your category in Settings to one of our current listed categories.`, null, { section: 'settings' });
  res.json({ ok: true });
});

// POST /api/admin/categories — add a new bookable service category
router.post('/categories', requireSuperAdmin, async (req, res) => {
  const { name, icon } = req.body || {};
  if (!isValidLabel(name, { min: 2, max: 40 })) {
    return res.status(400).json({ error: 'Enter a real category name (2-40 characters)' });
  }
  const trimmed = name.trim();
  const existing = await db.find('categories', c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return res.status(409).json({ error: `"${trimmed}" already exists as a category` });

  // A real emoji/icon chosen at creation time instead of every category
  // silently falling back to the same generic wrench — falls back to that
  // wrench only if nothing valid was actually provided.
  const safeIcon = (typeof icon === 'string' && icon.trim().length > 0 && icon.trim().length <= 8) ? icon.trim() : '🛠️';

  const category = { id: `cat_${nanoid(8)}`, name: trimmed, icon: safeIcon, active: true };
  await db.insert('categories', category);
  res.status(201).json({ category });
});

router.patch('/categories/:id', requireSuperAdmin, async (req, res) => {
  const cat = await db.find('categories', c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const updated = await db.update('categories', cat.id, { active: !cat.active });
  res.json({ category: updated });
});

// PATCH /api/admin/categories/:id/response-window — sets (or clears, with
// hours: null) this category's own booking-confirmation window, overriding
// the tiered lead-time default for every booking in this category
// regardless of how soon the job is. Useful for categories with very
// different urgency profiles than the platform average — e.g. an
// "Emergency Plumbing" category might always need a fast response, while
// "Wedding Photography" bookings are usually planned weeks out and don't
// need one at all.
router.patch('/categories/:id/response-window', requireSuperAdmin, async (req, res) => {
  const cat = await db.find('categories', c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const { hours } = req.body || {};
  if (hours !== null && (typeof hours !== 'number' || hours < 0.25 || hours > 168)) {
    return res.status(400).json({ error: 'Enter a number of hours between 0.25 and 168, or null to clear the override' });
  }
  const updated = await db.update('categories', cat.id, { responseWindowOverrideHours: hours });
  res.json({ category: updated });
});

// DELETE /api/admin/categories/:id — real delete, guarded the same way as
// countries: a category with providers actually listed under it can't be
// deleted outright, since that would silently strand their accounts with a
// category that no longer exists anywhere in the system. Deactivating (the
// PATCH above) is the right move for "stop taking new bookings in this
// category" — delete is for one that was never actually adopted.
router.delete('/categories/:id', requireSuperAdmin, async (req, res) => {
  const cat = await db.find('categories', c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const providersHere = await db.filter('users', u => u.role === 'provider' && u.category === cat.name);
  if (providersHere.length > 0) {
    return res.status(409).json({ error: `Can't delete — ${providersHere.length} provider(s) are listed under "${cat.name}". Deactivate it instead to stop new bookings.` });
  }

  // category_images.category_id has a foreign-key reference to this
  // table with no cascade — on real Postgres, deleting a category that
  // still has an uploaded image would fail with a foreign-key violation
  // instead of a clean success. Clean up the image (row + file on disk)
  // first, same as the dedicated DELETE /category-images/:categoryId
  // endpoint does, so deleting a category always succeeds regardless of
  // whether a photo was ever uploaded for it.
  const existingImage = await db.find('categoryImages', h => h.categoryId === cat.id);
  if (existingImage) {
    const imgPath = path.join(UPLOADS_DIR, existingImage.filename);
    if (existingImage.filename && fs.existsSync(imgPath)) fs.unlink(imgPath, () => {});
    await db.remove('categoryImages', existingImage.id);
  }

  await db.remove('categories', cat.id);
  res.json({ ok: true });
});

router.get('/countries', async (req, res) => res.json({ countries: await db.all('countries') }));

// POST /api/admin/countries — add a new country (starts as 'planned' until
// a super admin flips it live, same two-step pattern as everything else that
// goes live on the platform)
router.post('/countries', requireSuperAdmin, async (req, res) => {
  const { name, status } = req.body || {};
  if (!isValidLabel(name, { min: 2, max: 60 })) {
    return res.status(400).json({ error: 'Enter a real country name (2-60 characters)' });
  }
  const trimmed = name.trim();
  const existing = await db.find('countries', c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return res.status(409).json({ error: `"${trimmed}" already exists as a country` });

  const country = { id: `cty_${nanoid(8)}`, name: trimmed, status: status === 'live' ? 'live' : 'planned' };
  await db.insert('countries', country);
  res.status(201).json({ country });
});

router.patch('/countries/:id', requireSuperAdmin, async (req, res) => {
  const c = await db.find('countries', x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Country not found' });
  const updated = await db.update('countries', c.id, { status: c.status === 'live' ? 'planned' : 'live' });
  res.json({ country: updated });
});

// DELETE /api/admin/countries/:id — real delete, but only when it's actually
// safe: a country with real users registered under it can't be deleted,
// since that would silently orphan every one of their accounts (dangling
// references with no country data, breaking admin location scoping,
// reporting, etc). Deactivating (the PATCH above) is the right tool for
// "stop accepting new signups here" — deleting is for a country that was
// added by mistake or never actually launched.
router.delete('/countries/:id', requireSuperAdmin, async (req, res) => {
  const c = await db.find('countries', x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Country not found' });
  const usersHere = await db.filter('users', u => u.country === c.name);
  if (usersHere.length > 0) {
    return res.status(409).json({ error: `Can't delete — ${usersHere.length} account(s) are registered under ${c.name}. Set it to "Planned" instead to stop new signups there.` });
  }
  await db.remove('countries', c.id);
  res.json({ ok: true });
});

// ---- Locations & sub-admins (super admin only) ------------------------------

// GET /api/admin/cities — every open city and who administers it
router.get('/cities', requireSuperAdmin, async (req, res) => {
  const allCities = await db.all('cities');
  const cities = await Promise.all(allCities.map(async c => {
    const admin = await db.find('users', u => u.id === c.adminId);
    const userCount = (await db.filter('users', u => u.city === c.name && u.role !== 'admin')).length;
    return { ...c, adminName: admin ? admin.name : null, adminEmail: admin ? admin.email : null, adminActive: admin ? admin.active !== false : null, userCount };
  }));
  res.json({ cities });
});

// GET /api/admin/sub-admins — every location admin (not super admins)
router.get('/sub-admins', requireSuperAdmin, async (req, res) => {
  const admins = (await db.filter('users', u => u.role === 'admin' && !u.isSuperAdmin)).map(publicAdmin);
  res.json({ admins });
});

// POST /api/admin/sub-admins — create a new location admin for a city
router.post('/sub-admins', requireSuperAdmin, async (req, res) => {
  const { name, email, password, city, country, department, regionScoped } = req.body || {};
  const errors = validate([
    ['name', isValidName(name), 'Enter a real name — letters, spaces, hyphens, and apostrophes only'],
    ['email', isValidEmail(email), 'Enter a valid email address'],
    ['password', isValidPassword(password), 'Password must be at least 9 characters with at least 6 numbers, 2 letters, and 1 symbol'],
    ['city', isNonEmptyString(city), 'City is required'],
    ['country', isNonEmptyString(country), 'Country is required'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  if (department && !['verification', 'disputes', 'financial', 'accountant', 'controller', 'customer_service', 'legal', 'sales', 'hr'].includes(department)) {
    return res.status(400).json({ error: 'department must be verification, disputes, financial, accountant, controller, customer_service, legal, sales, or hr' });
  }

  const existing = await db.find('users', u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const admin = {
    id: `u_${nanoid(10)}`,
    name: name.trim(), email: email.trim(), city, country,
    role: 'admin',
    region: city,
    isSuperAdmin: false,
    adminDepartment: department || null,
    active: true,
    verified: true,
    initials: name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    passwordHash: hashPassword(password),
    // Whoever created this account chose the starting password (visible
    // to them on-screen), not this admin — requireAuth blocks every other
    // request until they set their own real password via
    // /auth/change-password, the same enforcement point already used for
    // suspended accounts and stale tokens.
    mustChangePassword: true,
    twoFactorEnabled: true,
    createdAt: new Date().toISOString(),
  };
  await db.insert('users', admin);

  // Register (or update) the city's entry in the cities registry
  const existingCity = await db.find('cities', c => c.name.toLowerCase() === city.toLowerCase());
  if (existingCity) {
    await db.update('cities', existingCity.id, { adminId: admin.id, country });
  } else {
    await db.insert('cities', { id: `city_${nanoid(8)}`, name: city, country, adminId: admin.id });
  }

  res.status(201).json({ admin: publicAdmin(admin) });
});

// PATCH /api/admin/sub-admins/:id — toggle active/suspended, or reassign city
router.patch('/sub-admins/:id', requireSuperAdmin, async (req, res) => {
  const target = await db.find('users', u => u.id === req.params.id && u.role === 'admin' && !u.isSuperAdmin);
  if (!target) return res.status(404).json({ error: 'Sub-admin not found' });
  const patch = {};
  if ('active' in (req.body || {})) {
    if (typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'active must be true or false' });
    patch.active = req.body.active;
  }
  if ('city' in (req.body || {})) {
    if (!isNonEmptyString(req.body.city, { min: 2, max: 100 })) return res.status(400).json({ error: 'Enter a valid city' });
    patch.city = req.body.city.trim();
    patch.region = patch.city;
  }
  if (!Object.keys(patch).length && req.body && req.body.toggleActive) patch.active = !target.active;
  const updated = await db.update('users', target.id, patch);
  res.json({ admin: publicAdmin(updated) });
});

// DELETE /api/admin/sub-admins/:id — real delete, guarded: a city currently
// pointing at this admin as its manager can't be left with a dangling
// reference, so this requires the city be reassigned to someone else first
// (via POST /sub-admins with the same city, which reassigns automatically —
// see that route). Suspending (PATCH above) is the right tool for "this
// person shouldn't have access right now" — delete is for removing the
// account entirely once no city depends on it.
router.delete('/sub-admins/:id', requireSuperAdmin, async (req, res) => {
  const target = await db.find('users', u => u.id === req.params.id && u.role === 'admin' && !u.isSuperAdmin);
  if (!target) return res.status(404).json({ error: 'Sub-admin not found' });
  const managedCity = await db.find('cities', c => c.adminId === target.id);
  if (managedCity) {
    return res.status(409).json({ error: `Can't delete — ${target.name} is still the assigned admin for ${managedCity.name}. Assign a new admin to that city first.` });
  }

  // notifications.user_id (and a few other tables) have a foreign-key
  // reference to this user with no cascade — on real Postgres, deleting
  // this account while it still has ANY notification history would fail
  // with a foreign-key violation instead of a clean success. Given every
  // admin gets notified constantly (every sales inquiry, advertising
  // inquiry, category request), this was true for essentially every real
  // admin account, not an edge case. Clean up every table that could
  // reference this user first, same principle as the category-image
  // cleanup before a category delete.
  await db.filter('notifications', n => n.userId === target.id).then(rows =>
    Promise.all(rows.map(r => db.remove('notifications', r.id)))
  );
  await db.filter('passwordResets', r => r.userId === target.id).then(rows =>
    Promise.all(rows.map(r => db.remove('passwordResets', r.id)))
  );
  await db.filter('phoneVerifications', r => r.userId === target.id).then(rows =>
    Promise.all(rows.map(r => db.remove('phoneVerifications', r.id)))
  );

  await db.remove('users', target.id);
  res.json({ ok: true });
});

// GET /api/admin/careers-inquiries — every job application on file.
// Scoped to HR-department admins and super admins only — this is company
// hiring, not a per-city customer/provider concern, so it doesn't follow
// the regional-scoping pattern the way disputes or ad inquiries do.
router.get('/careers-inquiries', async (req, res) => {
  const m = await me(req);
  const isPlainRegionalManager = !m.isSuperAdmin && !m.adminDepartment;
  const isGlobalHr = m.adminDepartment === 'hr' && !m.regionScoped;
  const isRegionalHr = m.adminDepartment === 'hr' && m.regionScoped;
  if (!m.isSuperAdmin && !isPlainRegionalManager && !isGlobalHr && !isRegionalHr) {
    return res.status(403).json({ error: 'Only HR, a regional manager, or a super admin can view job applications.' });
  }
  let inquiries = (await db.all('careersInquiries')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (isPlainRegionalManager || isRegionalHr) {
    inquiries = inquiries.filter(i => i.city === m.city);
  }
  res.json({ inquiries });
});

// PATCH /api/admin/careers-inquiries/:id/status — track an application
// through new -> reviewed -> contacted -> rejected, same lightweight
// tracking every other admin queue on this platform already has.
router.patch('/careers-inquiries/:id/status', async (req, res) => {
  const m = await me(req);
  const isPlainRegionalManager = !m.isSuperAdmin && !m.adminDepartment;
  const isGlobalHr = m.adminDepartment === 'hr' && !m.regionScoped;
  const isRegionalHr = m.adminDepartment === 'hr' && m.regionScoped;
  if (!m.isSuperAdmin && !isPlainRegionalManager && !isGlobalHr && !isRegionalHr) {
    return res.status(403).json({ error: 'Only HR, a regional manager, or a super admin can update job applications.' });
  }
  const { status } = req.body || {};
  if (!['new', 'reviewed', 'contacted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be new, reviewed, contacted, or rejected' });
  }
  const target = await db.find('careersInquiries', i => i.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Application not found' });
  if ((isPlainRegionalManager || isRegionalHr) && target.city !== m.city) {
    return res.status(403).json({ error: 'That application is outside your assigned city' });
  }
  const updated = await db.update('careersInquiries', target.id, { status });
  res.json({ inquiry: updated });
});

// GET /api/admin/referrals-overview — super admin only: real, platform-
// wide visibility into the referral system. Previously an admin had
// zero way to see this at all — referrals were entirely
// customer/provider-facing (their own code, their own referred list),
// with no admin-side view of who's actually driving signups. This
// doesn't change what any individual sees on their own referral panel —
// it's a separate, aggregate view for the team running the platform.
router.get('/referrals-overview', requireSuperAdmin, async (req, res) => {
  const allReferrals = await db.all('referrals');
  const byReferrer = new Map();
  for (const r of allReferrals) {
    if (!byReferrer.has(r.referrerId)) byReferrer.set(r.referrerId, []);
    byReferrer.get(r.referrerId).push(r);
  }
  const topReferrers = await Promise.all(
    [...byReferrer.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 25)
      .map(async ([referrerId, refs]) => {
        const referrer = await db.find('users', u => u.id === referrerId);
        return {
          referrerId,
          referrerName: referrer ? referrer.name : 'Unknown (deleted account)',
          referrerRole: referrer ? referrer.role : null,
          referralCode: referrer ? referrer.referralCode : null,
          totalReferred: refs.length,
        };
      })
  );
  const recent = (await Promise.all(allReferrals
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50)
    .map(async r => {
      const referrer = await db.find('users', u => u.id === r.referrerId);
      const referred = await db.find('users', u => u.id === r.referredUserId);
      return {
        id: r.id,
        referrerName: referrer ? referrer.name : 'Unknown',
        referredName: referred ? referred.name : 'Unknown',
        referredRole: r.referredRole,
        createdAt: r.createdAt,
      };
    })));
  res.json({
    totalReferrals: allReferrals.length,
    totalReferrers: byReferrer.size,
    topReferrers,
    recent,
  });
});

// GET /api/admin/promotions — every promotion this admin has a real
// reason to manage: a super admin sees all of them; a regional manager
// sees their own city's plus any platform-wide ones (for visibility, not
// editing — see the ownership check in PATCH/DELETE below).
router.get('/promotions', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  let promos = (await db.all('promotions')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!m.isSuperAdmin) promos = promos.filter(p => !p.region || p.region === m.city);
  res.json({ promotions: promos });
});

// POST /api/admin/promotions — a regional manager's promo is always
// scoped to their own city (no way to post platform-wide from here,
// same "own city, not the whole platform" boundary already used for ad
// pricing and regional support contacts). A super admin can post
// platform-wide (leave region blank) or target a specific city.
const promoImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `promo_${req.user.sub}_${nanoid(10)}${ext}`);
  },
});
function promoImageFileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  cb(null, true);
}
const uploadPromoImage = multer({ storage: promoImageStorage, fileFilter: promoImageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/admin/promotions/image — upload a real image for a promotion
// banner. Open to any admin who can post a promotion at all (super admin
// or a plain regional admin — matches the same access as POST
// /promotions below, not restricted to super admin the way homepage
// images are). Returns just the URL; the actual promotion is created or
// updated separately with that URL as imageUrl.
const handbookStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `handbook_${nanoid(10)}.pdf`),
});
function handbookFileFilter(req, file, cb) {
  if (file.mimetype !== 'application/pdf') return cb(new Error('The platform handbook must be a PDF file'));
  cb(null, true);
}
const uploadHandbook = multer({ storage: handbookStorage, fileFilter: handbookFileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/admin/platform-handbook — super admin uploads (or replaces)
// the real getting-started guide PDF offered to every new customer and
// provider right after they sign up (see GET /platform-handbook below,
// which is what actually serves it publicly).
router.post('/platform-handbook', requireSuperAdmin, (req, res) => {
  uploadHandbook.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file was provided' });
    if (!fs.existsSync(req.file.path)) {
      console.error(`Platform handbook upload reported success but file is missing at ${req.file.path} — check UPLOADS_DIR points to a writable, persistent location.`);
      return res.status(500).json({ error: 'The file could not be saved to disk. Please try again.' });
    }
    if (!verifyPdfMagicBytes(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'That file doesn\'t look like a real PDF — please upload an actual PDF.' });
    }
    const { setSetting } = require('../platform-settings');
    await setSetting('platformHandbookUrl', `/uploads/${req.file.filename}`);
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

router.post('/promotions/image', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  uploadPromoImage.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No image file was provided' });
    if (!fs.existsSync(req.file.path)) {
      console.error(`Promotion image upload reported success but file is missing at ${req.file.path} — check UPLOADS_DIR points to a writable, persistent location.`);
      return res.status(500).json({ error: 'The image could not be saved to disk. Please try again.' });
    }
    if (!verifyImageMagicBytes(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'This file does not appear to be a genuine image — please upload a real photo.' });
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

router.post('/promotions', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const { title, message, imageUrl, audience, region, expiresAt } = req.body || {};
  const errors = validate([
    ['title', isNonEmptyString(title, { min: 2, max: 120 }), 'Enter a short title'],
    ['message', isNonEmptyString(message, { min: 5, max: 500 }), 'Enter the promotion message'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  if (audience && !['customers', 'providers', 'both'].includes(audience)) {
    return res.status(400).json({ error: 'audience must be customers, providers, or both' });
  }

  const promo = {
    id: `promo_${nanoid(10)}`,
    title: title.trim(),
    message: message.trim(),
    imageUrl: imageUrl || null,
    createdBy: m.id,
    region: m.isSuperAdmin ? (region || null) : m.city,
    audience: audience || 'both',
    active: true,
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString(),
  };
  await db.insert('promotions', promo);
  res.status(201).json({ promotion: promo });
});

// PATCH /api/admin/promotions/:id — toggle active/inactive, or edit.
// Only the admin who created it, or a super admin, can touch it — a
// regional manager can see a platform-wide promo (GET above) but can't
// edit or remove something they didn't post.
router.patch('/promotions/:id', async (req, res) => {
  const m = await me(req);
  const promo = await db.find('promotions', p => p.id === req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promotion not found' });
  if (!m.isSuperAdmin && promo.createdBy !== m.id) {
    return res.status(403).json({ error: 'You can only edit promotions you created' });
  }
  const patch = {};
  if ('active' in req.body) patch.active = !!req.body.active;
  if ('title' in req.body && isNonEmptyString(req.body.title, { min: 2, max: 120 })) patch.title = req.body.title.trim();
  if ('message' in req.body && isNonEmptyString(req.body.message, { min: 5, max: 500 })) patch.message = req.body.message.trim();
  const updated = await db.update('promotions', promo.id, patch);
  res.json({ promotion: updated });
});

// DELETE /api/admin/promotions/:id — same ownership rule as PATCH.
router.delete('/promotions/:id', async (req, res) => {
  const m = await me(req);
  const promo = await db.find('promotions', p => p.id === req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promotion not found' });
  if (!m.isSuperAdmin && promo.createdBy !== m.id) {
    return res.status(403).json({ error: 'You can only remove promotions you created' });
  }
  await db.remove('promotions', promo.id);
  res.json({ ok: true });
});

// GET /api/admin/access-logs — who on the admin team has actually viewed
// sensitive data, and when. Super admin and Legal only — this log is
// itself sensitive (it's a record of admin activity), so it gets the
// same tight scoping as everything it's tracking.
router.get('/access-logs', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment !== 'legal') {
    return res.status(403).json({ error: 'Only Legal or a super admin can view access logs.' });
  }
  const logs = (await db.all('accessLogs')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 500);
  const withAdminNames = await Promise.all(logs.map(async l => {
    const admin = await db.find('users', u => u.id === l.adminId);
    return { ...l, adminName: admin ? admin.name : 'Unknown', adminEmail: admin ? admin.email : null };
  }));
  res.json({ logs: withAdminNames });
});
// this admin has a claim to. A super admin sees all of them, everywhere. A
// regional admin sees only the ones targeting their own city — this is the
// regional-autonomy piece: a city's ad inventory belongs to that city's
// admin, the same way its disputes and verification queue already do.
// Department-scoped functional admins (Verification, Disputes, Financial,
// etc.) aren't tied to this at all, so they're blocked, same as elsewhere.
router.get('/advertising-inquiries', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const region = await myRegion(req); // null for a super admin
  let inquiries = await db.all('advertisingInquiries');
  if (region) inquiries = inquiries.filter(i => i.targetCity === region);
  inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ inquiries });
});

// PATCH /api/admin/advertising-inquiries/:id/status — move an inquiry
// through new -> contacted -> closed as the sales team works it. This is
// the same lightweight "worked it or not" tracking every other admin queue
// on the platform already has (disputes, verification, category requests).
router.patch('/advertising-inquiries/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!['new', 'contacted', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be new, contacted, or closed' });
  const target = await db.find('advertisingInquiries', i => i.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Inquiry not found' });
  const m = await me(req);
  if (!m.isSuperAdmin) {
    if (m.adminDepartment) return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
    const region = await myRegion(req);
    if (target.targetCity !== region) return res.status(403).json({ error: 'This inquiry targets a different city than the one you manage.' });
  }
  const updated = await db.update('advertisingInquiries', target.id, { status });
  res.json({ inquiry: updated });
});

// PATCH /api/admin/advertising-inquiries/:id/live — the actual regional
// self-service piece: approve an inquiry into a real, currently-displaying
// paid ad slot (or take one down), and set what it costs. A regional admin
// can do this for their own city without ever involving a super admin; a
// super admin can do it for any city, or for a platform-wide ad (one whose
// targetCity is null, which only a super admin can approve — that's not
// any one region's call to make).
router.patch('/advertising-inquiries/:id/live', async (req, res) => {
  const { isLive, price, currencyCode, displayHeadline, displaySubtext, displayLink } = req.body || {};
  const target = await db.find('advertisingInquiries', i => i.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Inquiry not found' });
  const m = await me(req);
  if (!m.isSuperAdmin) {
    if (m.adminDepartment) return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
    const region = await myRegion(req);
    if (!target.targetCity) return res.status(403).json({ error: 'Platform-wide ads can only be approved by a super admin.' });
    if (target.targetCity !== region) return res.status(403).json({ error: 'This inquiry targets a different city than the one you manage.' });
  }
  if (isLive && (typeof price !== 'number' || price < 0)) return res.status(400).json({ error: 'Enter a valid price to go live' });

  const patch = { isLive: !!isLive };
  if (isLive) {
    patch.price = price;
    patch.currencyCode = currencyCode || currencyForCountry(m.country || 'United States').code;
    patch.approvedBy = m.id;
    patch.approvedAt = new Date().toISOString();
  }
  if (displayHeadline !== undefined) patch.displayHeadline = (displayHeadline || '').trim() || null;
  if (displaySubtext !== undefined) patch.displaySubtext = (displaySubtext || '').trim() || null;
  if (displayLink !== undefined) {
    const trimmedLink = (displayLink || '').trim();
    if (trimmedLink && !/^https?:\/\//i.test(trimmedLink)) {
      return res.status(400).json({ error: 'Link must start with http:// or https://' });
    }
    patch.displayLink = trimmedLink || null;
  }

  const updated = await db.update('advertisingInquiries', target.id, patch);
  res.json({ inquiry: updated });
});

// GET /api/admin/plan-pricing — pricing oversight, scoped to what this
// admin can actually see/edit. A super admin gets everything: the global
// USD base for each plan, every country's override, and (implicitly, via
// /exchange-rates) the full rate table. A regional admin gets just their
// own country's current effective pricing — base plus their own override
// if they've set one — so they can decide whether to set or change it.
router.get('/plan-pricing', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const [baseRows, overrideRows, rateRows] = await Promise.all([
    db.all('planPricingBase'), db.all('planPricingOverrides'), db.all('exchangeRates'),
  ]);
  if (m.isSuperAdmin) {
    const usdBase = PLAN_KEYS.map(plan => ({ plan, usdPrice: baseRows.find(r => r.plan === plan)?.usdPrice ?? DEFAULT_USD_PRICES[plan] }));
    return res.json({ usdBase, overrides: overrideRows });
  }
  const country = m.country;
  const plans = effectivePlanPricing(country, { baseRows, overrideRows, rateRows });
  res.json({ country, plans });
});

// PATCH /api/admin/plan-pricing/base — super admin only: edits the global
// USD starting price for one plan. Every country without its own override
// automatically reflects this change, converted to their local currency.
router.patch('/plan-pricing/base', requireSuperAdmin, async (req, res) => {
  const { plan, usdPrice } = req.body || {};
  if (!PLAN_KEYS.includes(plan)) return res.status(400).json({ error: 'plan must be starter, pro, or superpro' });
  if (typeof usdPrice !== 'number' || usdPrice < 0) return res.status(400).json({ error: 'Enter a valid non-negative USD price' });
  const existing = await db.find('planPricingBase', r => r.plan === plan);
  if (existing) await db.update('planPricingBase', existing.id, { usdPrice, updatedAt: new Date().toISOString() });
  else await db.insert('planPricingBase', { id: `ppb_${plan}`, plan, usdPrice, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

// PATCH /api/admin/plan-pricing/override — set (or update) one country's
// real local-currency price for one plan. A regional admin can only do
// this for their own assigned country; a super admin can do it for any
// country. The USD-equivalent side-by-side figure is computed on read
// (see effectivePlanPricing), not stored here.
router.patch('/plan-pricing/override', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const { country, plan, localPrice } = req.body || {};
  if (!PLAN_KEYS.includes(plan)) return res.status(400).json({ error: 'plan must be starter, pro, or superpro' });
  if (typeof localPrice !== 'number' || localPrice < 0) return res.status(400).json({ error: 'Enter a valid non-negative price' });
  if (!isNonEmptyString(country)) return res.status(400).json({ error: 'country is required' });
  if (!m.isSuperAdmin && country !== m.country) {
    return res.status(403).json({ error: `Your admin account is scoped to ${m.country} — you can't set pricing for other countries.` });
  }
  const currency = currencyForCountry(country);
  const existing = await db.find('planPricingOverrides', r => r.country === country && r.plan === plan);
  const patch = { country, plan, localPrice, currencyCode: currency.code, setBy: m.id, updatedAt: new Date().toISOString() };
  if (existing) await db.update('planPricingOverrides', existing.id, patch);
  else await db.insert('planPricingOverrides', { id: `ppo_${nanoid(8)}`, ...patch });
  res.json({ ok: true });
});

// DELETE /api/admin/plan-pricing/override/:country/:plan — clear an
// override, reverting that country's plan back to the auto-converted USD
// base price. Same scoping rule as setting one.
router.delete('/plan-pricing/override/:country/:plan', async (req, res) => {
  const m = await me(req);
  if (!m.isSuperAdmin && m.adminDepartment) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  const { country, plan } = req.params;
  if (!m.isSuperAdmin && country !== m.country) {
    return res.status(403).json({ error: `Your admin account is scoped to ${m.country} — you can't edit pricing for other countries.` });
  }
  const existing = await db.find('planPricingOverrides', r => r.country === country && r.plan === plan);
  if (existing) await db.remove('planPricingOverrides', existing.id);
  res.json({ ok: true });
});

// GET /api/admin/exchange-rates — super admin only: every currency
// Trothen operates in, with its effective rate and where it came from —
// a live daily fetch, a manual admin correction, or (if neither has ever
// run) the static approximate default from src/currency-data.js.
router.get('/exchange-rates', requireSuperAdmin, async (req, res) => {
  const rateRows = await db.all('exchangeRates');
  const codes = new Set(Object.values(CURRENCY_BY_COUNTRY).map(c => c.code));
  codes.add('USD');
  const rates = Array.from(codes).sort().map(code => {
    const row = rateRows.find(r => r.currencyCode === code);
    return {
      currencyCode: code,
      rateToUsd: row ? row.rateToUsd : (APPROX_USD_RATE[code] ?? 1),
      isOverride: !!row,
      source: row ? (row.source || 'manual') : 'default', // rows written before the source column existed are treated as manual
      fetchedAt: row ? (row.fetchedAt || null) : null,
      updatedAt: row ? row.updatedAt : null,
    };
  });
  res.json({ rates });
});

// PATCH /api/admin/exchange-rates — super admin only: manually overrides
// the rate for one currency. This feeds every conversion in the app that
// touches that currency — job payments, provider payouts, AND plan
// pricing alike, not just the pricing page. Marked source: 'manual' so the
// daily live-rate refresh (see src/fx-scheduler.js) never silently
// overwrites this intentional correction — a human decision always wins
// over automation here.
router.patch('/exchange-rates', requireSuperAdmin, async (req, res) => {
  const { currencyCode, rateToUsd } = req.body || {};
  if (!isNonEmptyString(currencyCode)) return res.status(400).json({ error: 'currencyCode is required' });
  if (typeof rateToUsd !== 'number' || rateToUsd <= 0) return res.status(400).json({ error: 'Enter a valid positive rate' });
  const existing = await db.find('exchangeRates', r => r.currencyCode === currencyCode);
  const patch = { rateToUsd, source: 'manual', updatedAt: new Date().toISOString() };
  if (existing) await db.update('exchangeRates', existing.id, patch);
  else await db.insert('exchangeRates', { id: `xr_${currencyCode}`, currencyCode, ...patch });
  res.json({ ok: true });
});

// PATCH /api/admin/exchange-rates/:currencyCode/reset-to-live — clears a
// manual override so this currency goes back to following the daily live
// refresh again, instead of staying pinned to a one-time manual correction
// forever.
router.patch('/exchange-rates/:currencyCode/reset-to-live', requireSuperAdmin, async (req, res) => {
  const existing = await db.find('exchangeRates', r => r.currencyCode === req.params.currencyCode);
  if (!existing) return res.json({ ok: true }); // nothing to reset — already following live/default
  await db.remove('exchangeRates', existing.id);
  const { refreshLiveExchangeRates } = require('../fx-scheduler');
  await refreshLiveExchangeRates(); // immediately re-fetch so it doesn't sit on the static default until the next scheduled run
  res.json({ ok: true });
});

// POST /api/admin/exchange-rates/refresh — super admin only: triggers an
// immediate live-rate refresh instead of waiting for the daily schedule.
// Useful right after deploying (to confirm the live provider is actually
// reachable from production) or any time a rate looks stale.
router.post('/exchange-rates/refresh', requireSuperAdmin, async (req, res) => {
  const { refreshLiveExchangeRates } = require('../fx-scheduler');
  const result = await refreshLiveExchangeRates();
  if (!result.ok) return res.status(502).json({ error: `Could not reach the live exchange rate provider: ${result.error}` });
  res.json(result);
});

// GET /api/admin/sales-inquiries — every Custom Plan "Contact Sales"
// submission, newest first. Super admin, or an admin scoped to the Sales
// department — an enterprise-sales function, not tied to any one city.
router.get('/sales-inquiries', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const inquiries = await db.all('salesInquiries');
  inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ inquiries });
});

// PATCH /api/admin/sales-inquiries/:id/status
router.patch('/sales-inquiries/:id/status', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const { status } = req.body || {};
  if (!['new', 'contacted', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be new, contacted, or closed' });
  const target = await db.find('salesInquiries', i => i.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Inquiry not found' });
  const updated = await db.update('salesInquiries', target.id, { status });
  res.json({ inquiry: updated });
});

// PATCH /api/admin/sales-inquiries/:id/deal — records what was actually
// negotiated once a human has talked to this lead. This is deliberately
// just a record, not automation: saving an agreed price here does NOT
// create an account, set up billing, or provision anything — there's no
// multi-seat/organization account system yet for it to attach to (that's
// bigger future work). What this gives you now is an honest place to
// write down "we agreed to $X/seat" so it isn't lost in someone's email
// inbox, without pretending the system did more than it did.
router.patch('/sales-inquiries/:id/deal', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const { agreedPrice, agreedCurrency, internalNotes } = req.body || {};
  if (agreedPrice !== undefined && agreedPrice !== null && (typeof agreedPrice !== 'number' || agreedPrice < 0)) {
    return res.status(400).json({ error: 'Enter a valid non-negative price, or leave it blank' });
  }
  const target = await db.find('salesInquiries', i => i.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Inquiry not found' });
  const patch = { updatedAt: new Date().toISOString() };
  if (agreedPrice !== undefined) patch.agreedPrice = agreedPrice;
  if (agreedCurrency !== undefined) patch.agreedCurrency = (agreedCurrency || 'USD').toUpperCase();
  if (internalNotes !== undefined) patch.internalNotes = (internalNotes || '').trim() || null;
  const updated = await db.update('salesInquiries', target.id, patch);
  res.json({ inquiry: updated });
});

// ── ORGANIZATIONS (Custom-plan multi-seat accounts) ─────────────────────
// Super admin or Sales-department admin only — creating a company-wide
// account with its own commission rate is a genuine business decision,
// closed off to ordinary regional admins (unlike disputes/verification,
// which stay open to any regional admin with no department set).

// POST /api/admin/sales-inquiries/:id/convert-to-org — the actual "create
// the account" step once a Custom-plan deal is agreed. Requires deal terms
// (agreed price) to already be set via /deal — this endpoint doesn't
// invent a price, it turns an already-negotiated deal into a real account.
// Closes the originating inquiry and links back to it either direction,
// so there's always a paper trail from lead to account.
router.post('/sales-inquiries/:id/convert-to-org', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const inquiry = await db.find('salesInquiries', i => i.id === req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
  if (inquiry.convertedToOrgId) return res.status(400).json({ error: 'This inquiry has already been converted to an organization' });
  if (inquiry.agreedPrice == null) return res.status(400).json({ error: 'Set agreed deal terms (Deal Notes) before converting to an account' });

  const { commissionRate, seatLimit, accountManagerId } = req.body || {};
  if (commissionRate != null && (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 1)) {
    return res.status(400).json({ error: 'commissionRate must be a decimal between 0 and 1 (e.g. 0.04 for 4%), or omitted' });
  }
  const me_ = await me(req);
  const parsedSeatLimit = seatLimit != null ? parseInt(seatLimit, 10) : (parseInt(inquiry.teamSize, 10) || null);

  const org = {
    id: `org_${nanoid(10)}`,
    name: inquiry.companyName,
    salesInquiryId: inquiry.id,
    agreedPrice: inquiry.agreedPrice,
    agreedCurrency: inquiry.agreedCurrency || 'USD',
    commissionRate: commissionRate ?? null,
    seatLimit: (parsedSeatLimit && parsedSeatLimit > 0) ? parsedSeatLimit : null,
    accountManagerId: accountManagerId || me_.id,
    billingContactName: inquiry.contactName,
    billingContactEmail: inquiry.email,
    status: 'active',
    createdBy: me_.id,
    createdAt: new Date().toISOString(),
  };
  await db.insert('organizations', org);
  await db.update('salesInquiries', inquiry.id, { convertedToOrgId: org.id, status: 'closed', updatedAt: new Date().toISOString() });
  res.status(201).json({ organization: org });
});

// GET /api/admin/organizations — every Custom-plan account, with real
// seat counts (not a stored counter — counted from actual attached users).
router.get('/organizations', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const orgs = await db.all('organizations');
  const providers = await db.filter('users', u => u.role === 'provider' && !!u.organizationId);
  const admins = await db.filter('users', u => u.role === 'admin');
  const adminById = new Map(admins.map(a => [a.id, a]));
  const result = orgs.map(o => ({
    ...o,
    seatCount: providers.filter(p => p.organizationId === o.id).length,
    accountManagerName: (adminById.get(o.accountManagerId) || {}).name || null,
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ organizations: result });
});

// GET /api/admin/organizations/:id — full detail: the org record, its real
// attached seats, active invite links, and combined performance across
// every seat (the "centralized reporting" promised on the Custom card) —
// computed the same honest way as the platform-wide Reports & Analytics
// (real contracts, not stored counters).
router.get('/organizations/:id', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const org = await db.find('organizations', o => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const seats = await db.filter('users', u => u.role === 'provider' && u.organizationId === org.id);
  const seatIds = new Set(seats.map(s => s.id));
  const allContracts = await db.all('contracts');
  const orgContracts = allContracts.filter(c => seatIds.has(c.providerId));
  const completed = orgContracts.filter(c => c.status === 'completed');
  const gmv = Math.round(orgContracts.reduce((s, c) => s + (c.amount || 0), 0) * 100) / 100;
  const commissionRate = effectiveCommissionRate(null, org) ?? null;
  const invites = (await db.filter('organizationInvites', i => i.organizationId === org.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const admins = await db.filter('users', u => u.role === 'admin');
  const accountManager = admins.find(a => a.id === org.accountManagerId) || null;

  res.json({
    organization: { ...org, accountManagerName: accountManager ? accountManager.name : null },
    seats: seats.map(s => ({ id: s.id, name: s.name, email: s.email, category: s.category, city: s.city, rating: s.rating, verified: s.verified, active: s.active })),
    invites,
    performance: {
      seatCount: seats.length,
      jobsBooked: orgContracts.length,
      jobsCompleted: completed.length,
      gmv,
      commissionRate,
      estCommission: commissionRate != null ? Math.round(gmv * commissionRate * 100) / 100 : null,
    },
  });
});

// PATCH /api/admin/organizations/:id — edit the account: commission rate,
// seat limit, account manager, billing contact, or suspend/reactivate it.
router.patch('/organizations/:id', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const org = await db.find('organizations', o => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  const { commissionRate, seatLimit, accountManagerId, billingContactName, billingContactEmail, status } = req.body || {};
  const patch = { updatedAt: new Date().toISOString() };
  if (commissionRate !== undefined) {
    if (commissionRate !== null && (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 1)) {
      return res.status(400).json({ error: 'commissionRate must be a decimal between 0 and 1, or null to clear it' });
    }
    patch.commissionRate = commissionRate;
  }
  if (seatLimit !== undefined) patch.seatLimit = seatLimit === null ? null : parseInt(seatLimit, 10);
  if (accountManagerId !== undefined) patch.accountManagerId = accountManagerId;
  if (billingContactName !== undefined) patch.billingContactName = billingContactName;
  if (billingContactEmail !== undefined) patch.billingContactEmail = billingContactEmail;
  if (status !== undefined) {
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'status must be active or suspended' });
    patch.status = status;
  }
  const updated = await db.update('organizations', org.id, patch);
  res.json({ organization: updated });
});

// POST /api/admin/organizations/:id/seats — admin-provisioned seat
// addition: attach an EXISTING provider account to this org directly
// (e.g. someone who signed up individually before the org existed).
// Complements invite links, which are for new/existing providers joining
// themselves.
router.post('/organizations/:id/seats', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const org = await db.find('organizations', o => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  const { providerId } = req.body || {};
  const provider = await db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  if (provider.organizationId) return res.status(400).json({ error: `This provider already belongs to an organization${provider.organizationId === org.id ? ' (this one)' : ''}.` });
  if (org.seatLimit != null) {
    const currentSeats = (await db.filter('users', u => u.role === 'provider' && u.organizationId === org.id)).length;
    if (currentSeats >= org.seatLimit) return res.status(400).json({ error: `This organization is at its ${org.seatLimit}-seat limit.` });
  }
  const updated = await db.update('users', provider.id, { organizationId: org.id });
  res.json({ provider: publicAdmin(updated) });
});

// DELETE /api/admin/organizations/:id/seats/:userId — remove a provider
// from the org. They revert to their own individual plan rate immediately
// — nothing else about their account changes.
router.delete('/organizations/:id/seats/:userId', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const provider = await db.find('users', u => u.id === req.params.userId && u.organizationId === req.params.id);
  if (!provider) return res.status(404).json({ error: 'This provider is not a seat in this organization' });
  await db.update('users', provider.id, { organizationId: null });
  res.json({ ok: true });
});

// POST /api/admin/organizations/:id/invites — generate a new self-serve
// join link. A provider (new signup or existing account) who enters this
// code gets attached to the org automatically — see POST
// /api/org-invites/:code/redeem in marketplace.routes.js for the
// redemption side, and the signup flow for how a brand-new provider uses
// one during signup.
router.post('/organizations/:id/invites', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const org = await db.find('organizations', o => o.id === req.params.id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  const { maxUses, expiresInDays } = req.body || {};
  if (maxUses != null && (typeof maxUses !== 'number' || !Number.isInteger(maxUses) || maxUses < 1)) {
    return res.status(400).json({ error: 'maxUses must be a positive whole number, or omitted for unlimited' });
  }
  if (expiresInDays != null && (typeof expiresInDays !== 'number' || expiresInDays <= 0 || expiresInDays > 365)) {
    return res.status(400).json({ error: 'expiresInDays must be a positive number of days (365 max), or omitted for no expiry' });
  }
  const me_ = await me(req);
  const invite = {
    id: `oi_${nanoid(8)}`,
    organizationId: org.id,
    code: nanoid(10).replace(/[_-]/g, '').toUpperCase().slice(0, 8),
    createdBy: me_.id,
    maxUses: maxUses != null ? maxUses : null,
    usesCount: 0,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  await db.insert('organizationInvites', invite);
  res.status(201).json({ invite });
});

// PATCH /api/admin/organizations/:id/invites/:inviteId/revoke — disable a
// join link immediately without deleting its usage history.
router.patch('/organizations/:id/invites/:inviteId/revoke', requireSuperAdminOrDepartment('sales'), async (req, res) => {
  const invite = await db.find('organizationInvites', i => i.id === req.params.inviteId && i.organizationId === req.params.id);
  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  const updated = await db.update('organizationInvites', invite.id, { status: 'revoked' });
  res.json({ invite: updated });
});

module.exports = router;
