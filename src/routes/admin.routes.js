const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole, hashPassword } = require('../auth');
const { isValidEmail, isNonEmptyString, isValidPassword, validate } = require('../validators');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// A suspended admin's existing token would otherwise keep working for up to
// 7 days (tokens aren't re-checked against the DB by requireAuth itself).
// This re-fetches the fresh record on every admin request so a suspension
// takes effect immediately, not whenever the token happens to expire.
router.use((req, res, next) => {
  const current = db.find('users', u => u.id === req.user.sub);
  if (!current || current.active === false) {
    return res.status(403).json({ error: 'This account has been suspended. Contact a super admin for access.' });
  }
  next();
});

// Every route below runs as an admin (super admin or a location admin).
// `me` is the fresh DB record (not just the JWT payload) so a change to an
// admin's region or active status takes effect immediately, without needing
// a new token.
function me(req) {
  return db.find('users', u => u.id === req.user.sub);
}

// null region = super admin = sees everything. A non-null region scopes
// every query below to that one city.
function myRegion(req) {
  const m = me(req);
  return m && !m.isSuperAdmin ? m.region : null;
}

function requireSuperAdmin(req, res, next) {
  const m = me(req);
  if (!m || !m.isSuperAdmin) return res.status(403).json({ error: 'This action requires a super admin account' });
  next();
}

// Resolve which city a dispute "belongs to" via its contract's customer.
function disputeCity(dispute) {
  const contract = db.find('contracts', c => c.id === dispute.contractId);
  if (!contract) return null;
  const customer = db.find('users', u => u.id === contract.customerId);
  return customer ? customer.city : null;
}

function publicAdmin(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const region = myRegion(req);
  const users = db.all('users').filter(u => !region || u.city === region);
  const disputes = db.all('disputes').filter(d => !region || disputeCity(d) === region);
  const contracts = db.all('contracts').filter(c => {
    if (!region) return true;
    const customer = db.find('users', u => u.id === c.customerId);
    return customer && customer.city === region;
  });
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
router.get('/users/pending', (req, res) => {
  const region = myRegion(req);
  const pending = db.filter('users', u => u.role !== 'admin' && u.verified === false && (!region || u.city === region))
    .map(publicAdmin);
  res.json({ users: pending });
});

// POST /api/admin/users/:id/decide  { decision: 'approve' | 'reject' }
router.post('/users/:id/decide', (req, res) => {
  const { decision } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  const region = myRegion(req);
  const target = db.find('users', u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (region && target.city !== region) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const updated = db.update('users', req.params.id, { verified: decision === 'approve', status: decision === 'approve' ? 'approved' : 'rejected' });
  res.json({ user: publicAdmin(updated) });
});

// GET /api/admin/verification-queue
router.get('/verification-queue', (req, res) => {
  const region = myRegion(req);
  const queue = db.filter('verifications', v => v.status === 'in review').map(v => {
    const user = db.find('users', u => u.id === v.userId);
    return { ...v, userName: user ? user.name : 'Unknown', country: user ? user.country : '', city: user ? user.city : null };
  }).filter(v => !region || v.city === region);
  res.json({ queue });
});

// POST /api/admin/verification/:id/decide  { decision: 'approve' | 'reject' }
router.post('/verification/:id/decide', (req, res) => {
  const { decision } = req.body || {};
  const record = db.find('verifications', v => v.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Verification record not found' });
  const region = myRegion(req);
  const user = db.find('users', u => u.id === record.userId);
  if (region && (!user || user.city !== region)) return res.status(403).json({ error: 'That user is outside your assigned city' });
  const status = decision === 'approve' ? 'approved' : 'rejected';
  db.update('verifications', record.id, { status });
  if (decision === 'approve') db.update('users', record.userId, { verified: true });
  res.json({ verification: { ...record, status } });
});

// GET /api/admin/disputes
router.get('/disputes', (req, res) => {
  const region = myRegion(req);
  const disputes = db.all('disputes').filter(d => !region || disputeCity(d) === region);
  res.json({ disputes });
});

// POST /api/admin/disputes/:id/resolve
router.post('/disputes/:id/resolve', (req, res) => {
  const region = myRegion(req);
  const dispute = db.find('disputes', d => d.id === req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
  if (region && disputeCity(dispute) !== region) return res.status(403).json({ error: 'That dispute is outside your assigned city' });
  const updated = db.update('disputes', dispute.id, { status: 'resolved' });
  const escrow = db.find('escrowTransactions', e => e.contractId === updated.contractId);
  if (escrow) db.update('escrowTransactions', escrow.id, { status: 'released' });
  res.json({ dispute: updated });
});

// ---- Global config: categories & countries (super admin only) --------------
router.get('/categories', (req, res) => {
  const categories = db.all('categories').map(c => ({
    ...c,
    pros: db.filter('users', u => u.role === 'provider' && u.verified && u.category === c.name).length,
  }));
  res.json({ categories });
});

// POST /api/admin/categories — add a new bookable service category
router.post('/categories', requireSuperAdmin, (req, res) => {
  const { name } = req.body || {};
  if (!isNonEmptyString(name, { min: 2, max: 40 })) {
    return res.status(400).json({ error: 'Category name must be between 2 and 40 characters' });
  }
  const trimmed = name.trim();
  const existing = db.find('categories', c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return res.status(409).json({ error: `"${trimmed}" already exists as a category` });

  const category = { id: `cat_${nanoid(8)}`, name: trimmed, active: true };
  db.insert('categories', category);
  res.status(201).json({ category });
});

router.patch('/categories/:id', requireSuperAdmin, (req, res) => {
  const cat = db.find('categories', c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const updated = db.update('categories', cat.id, { active: !cat.active });
  res.json({ category: updated });
});

router.get('/countries', (req, res) => res.json({ countries: db.all('countries') }));
router.patch('/countries/:id', requireSuperAdmin, (req, res) => {
  const c = db.find('countries', x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Country not found' });
  const updated = db.update('countries', c.id, { status: c.status === 'live' ? 'planned' : 'live' });
  res.json({ country: updated });
});

// ---- Locations & sub-admins (super admin only) ------------------------------

// GET /api/admin/cities — every open city and who administers it
router.get('/cities', requireSuperAdmin, (req, res) => {
  const cities = db.all('cities').map(c => {
    const admin = db.find('users', u => u.id === c.adminId);
    const userCount = db.filter('users', u => u.city === c.name && u.role !== 'admin').length;
    return { ...c, adminName: admin ? admin.name : null, adminEmail: admin ? admin.email : null, adminActive: admin ? admin.active !== false : null, userCount };
  });
  res.json({ cities });
});

// GET /api/admin/sub-admins — every location admin (not super admins)
router.get('/sub-admins', requireSuperAdmin, (req, res) => {
  const admins = db.filter('users', u => u.role === 'admin' && !u.isSuperAdmin).map(publicAdmin);
  res.json({ admins });
});

// POST /api/admin/sub-admins — create a new location admin for a city
router.post('/sub-admins', requireSuperAdmin, (req, res) => {
  const { name, email, password, city, country } = req.body || {};
  const errors = validate([
    ['name', isNonEmptyString(name, { min: 2, max: 100 }), 'Full name must be at least 2 characters'],
    ['email', isValidEmail(email), 'Enter a valid email address'],
    ['password', isValidPassword(password), 'Password must be at least 6 characters'],
    ['city', isNonEmptyString(city), 'City is required'],
    ['country', isNonEmptyString(country), 'Country is required'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const existing = db.find('users', u => u.email.toLowerCase() === email.trim().toLowerCase());
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
  db.insert('users', admin);

  // Register (or update) the city's entry in the cities registry
  const existingCity = db.find('cities', c => c.name.toLowerCase() === city.toLowerCase());
  if (existingCity) {
    db.update('cities', existingCity.id, { adminId: admin.id, country });
  } else {
    db.insert('cities', { id: `city_${nanoid(8)}`, name: city, country, adminId: admin.id });
  }

  res.status(201).json({ admin: publicAdmin(admin) });
});

// PATCH /api/admin/sub-admins/:id — toggle active/suspended, or reassign city
router.patch('/sub-admins/:id', requireSuperAdmin, (req, res) => {
  const target = db.find('users', u => u.id === req.params.id && u.role === 'admin' && !u.isSuperAdmin);
  if (!target) return res.status(404).json({ error: 'Sub-admin not found' });
  const patch = {};
  if ('active' in (req.body || {})) patch.active = req.body.active;
  if ('city' in (req.body || {})) { patch.city = req.body.city; patch.region = req.body.city; }
  if (!Object.keys(patch).length && req.body && req.body.toggleActive) patch.active = !target.active;
  const updated = db.update('users', target.id, patch);
  res.json({ admin: publicAdmin(updated) });
});

module.exports = router;
