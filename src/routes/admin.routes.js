const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole, hashPassword } = require('../auth');
const { isValidEmail, isNonEmptyString, isValidPassword, isValidName, isValidLabel, validate } = require('../validators');
const { notify } = require('../notify');

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
async function myRegion(req) {
  const m = await me(req);
  return m && !m.isSuperAdmin ? m.region : null;
}

async function requireSuperAdmin(req, res, next) {
  const m = await me(req);
  if (!m || !m.isSuperAdmin) return res.status(403).json({ error: 'This action requires a super admin account' });
  next();
}

// Resolve which city a dispute "belongs to" via its contract's customer.
async function disputeCity(dispute) {
  const contract = await db.find('contracts', c => c.id === dispute.contractId);
  if (!contract) return null;
  const customer = await db.find('users', u => u.id === contract.customerId);
  return customer ? customer.city : null;
}

function publicAdmin(u) {
  const { passwordHash, ...rest } = u;
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
  const region = await myRegion(req);
  const { role } = req.query;
  let users = await db.filter('users', u => u.role === 'customer' || u.role === 'provider');
  if (region) users = users.filter(u => u.city === region);
  if (role && ['customer', 'provider'].includes(role)) users = users.filter(u => u.role === role);
  res.json({ users: users.map(publicAdmin) });
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
  await notify(target.id, active ? '✅' : '⛔', active ? 'Your account has been reactivated.' : 'Your account has been suspended. Contact support for details.');
  res.json({ user: publicAdmin(updated) });
});

// POST /api/admin/users/:id/decide  { decision: 'approve' | 'reject' }
router.post('/users/:id/decide', async (req, res) => {
  const { decision } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  const region = await myRegion(req);
  const target = await db.find('users', u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (region && target.city !== region) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const updated = await db.update('users', req.params.id, { verified: decision === 'approve', status: decision === 'approve' ? 'approved' : 'rejected' });
  await notify(target.id, decision === 'approve' ? '✅' : '❌', decision === 'approve' ? 'Your account has been approved.' : 'Your account application was not approved. Contact support for details.');
  res.json({ user: publicAdmin(updated) });
});

// GET /api/admin/verification-queue
router.get('/verification-queue', async (req, res) => {
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
router.post('/verification/:id/decide', async (req, res) => {
  const { decision } = req.body || {};
  const record = await db.find('verifications', v => v.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Verification record not found' });
  const region = await myRegion(req);
  const user = await db.find('users', u => u.id === record.userId);
  if (region && (!user || user.city !== region)) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const status = decision === 'approve' ? 'approved' : 'rejected';
  await db.update('verifications', record.id, { status });
  if (decision === 'approve') await db.update('users', record.userId, { verified: true });
  await notify(record.userId, decision === 'approve' ? '✅' : '❌', decision === 'approve' ? 'Your identity verification was approved.' : 'Your identity verification was rejected — please resubmit your documents.');
  res.json({ verification: { ...record, status } });
});

// GET /api/admin/disputes
router.get('/disputes', async (req, res) => {
  const region = await myRegion(req);
  const all = await db.all('disputes');
  const disputes = [];
  for (const d of all) {
    if (!region || (await disputeCity(d)) === region) disputes.push(d);
  }
  res.json({ disputes });
});

// POST /api/admin/disputes/:id/resolve
router.post('/disputes/:id/resolve', async (req, res) => {
  const region = await myRegion(req);
  const dispute = await db.find('disputes', d => d.id === req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
  if (region && (await disputeCity(dispute)) !== region) return res.status(403).json({ error: 'That dispute is outside your assigned city' });
  const updated = await db.update('disputes', dispute.id, { status: 'resolved', resolvedAt: new Date().toISOString() });
  const escrow = await db.find('escrowTransactions', e => e.contractId === updated.contractId);
  if (escrow) await db.update('escrowTransactions', escrow.id, { status: 'released' });
  const contract = await db.find('contracts', c => c.id === updated.contractId);
  if (contract) {
    await notify(contract.customerId, '⚖️', `Your dispute (${dispute.reason}) has been resolved.`, 'bookingUpdates');
    await notify(contract.providerId, '⚖️', `A dispute on one of your jobs (${dispute.reason}) has been resolved.`, 'bookingUpdates');
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
router.post('/sync-reference-data', requireSuperAdmin, async (req, res) => {
  const { syncReferenceData } = require('../sync-reference-data');
  const result = await syncReferenceData();
  res.json(result);
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
router.post('/category-requests/:id/approve', requireSuperAdmin, async (req, res) => {
  const request = await db.find('categoryRequests', r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Category request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: `This request is already ${request.status}` });

  const existingCategory = await db.find('categories', c => c.name.toLowerCase() === request.requestedCategory.toLowerCase());
  if (!existingCategory) {
    await db.insert('categories', { id: `cat_${nanoid(8)}`, name: request.requestedCategory, icon: '🛠️', active: true });
  }
  await db.update('users', request.providerId, { categoryApprovalStatus: 'approved' });
  await db.update('categoryRequests', request.id, { status: 'approved', resolvedAt: new Date().toISOString() });
  await notify(request.providerId, '✅', `Your category "${request.requestedCategory}" was approved — you're now fully listed and bookable.`);
  res.json({ ok: true });
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
  await notify(request.providerId, '❌', `Your category "${request.requestedCategory}" wasn't approved. Please update your category in Settings to one of our current listed categories.`);
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
  const { name, email, password, city, country } = req.body || {};
  const errors = validate([
    ['name', isValidName(name), 'Enter a real name — letters, spaces, hyphens, and apostrophes only'],
    ['email', isValidEmail(email), 'Enter a valid email address'],
    ['password', isValidPassword(password), 'Password must be at least 9 characters with at least 6 numbers, 2 letters, and 1 symbol'],
    ['city', isNonEmptyString(city), 'City is required'],
    ['country', isNonEmptyString(country), 'Country is required'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const existing = await db.find('users', u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const admin = {
    id: `u_${nanoid(10)}`,
    name: name.trim(), email: email.trim(), city, country,
    role: 'admin',
    region: city,
    isSuperAdmin: false,
    active: true,
    verified: true,
    initials: name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    passwordHash: hashPassword(password),
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
  if ('active' in (req.body || {})) patch.active = req.body.active;
  if ('city' in (req.body || {})) { patch.city = req.body.city; patch.region = req.body.city; }
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
  await db.remove('users', target.id);
  res.json({ ok: true });
});

module.exports = router;
