const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole, hashPassword } = require('../auth');
const { isValidEmail, isNonEmptyString, isValidPassword, isValidName, isValidLabel, validate } = require('../validators');
const { notify } = require('../notify');
const { commissionRateForPlan } = require('../commission');
const { effectivePlanPricing, PLAN_KEYS, DEFAULT_USD_PRICES } = require('../plan-pricing');
const { currencyForCountry, APPROX_USD_RATE, CURRENCY_BY_COUNTRY } = require('../currency-data');

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
  return m && !m.isSuperAdmin && !m.adminDepartment ? m.region : null;
}

// Same idea as myRegion, but at country granularity — used for plan
// pricing overrides, since currency (and therefore price) is a
// country-level concept, not a city-level one. A regional admin can only
// set pricing for their own assigned country; a super admin (null here)
// can set it for any country.
async function myCountry(req) {
  const m = await me(req);
  return m && !m.isSuperAdmin && !m.adminDepartment ? m.country : null;
}

async function requireSuperAdmin(req, res, next) {
  const m = await me(req);
  if (!m || !m.isSuperAdmin) return res.status(403).json({ error: 'This action requires a super admin account' });
  next();
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
  await notify(target.id, active ? '✅' : '⛔', active ? 'Your account has been reactivated.' : 'Your account has been suspended. Contact support for details.', null, { section: 'settings' });
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
router.get('/verification-queue', requireDepartment(['verification', 'customer_service']), async (req, res) => {
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
router.post('/verification/:id/decide', requireDepartment(['verification', 'customer_service']), async (req, res) => {
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
    filename: `Taskora-Disputes-Report.pdf`,
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

  finish({ closingNote: 'This report reflects Taskora\'s dispute records within the scope and date range shown, as of the moment it was generated.' });
});

// GET /api/admin/transactions — every real contract on the platform (or
// within an admin's assigned city), with escrow and payout status. This is
// what the admin Payments page actually needs — previously it was showing
// unrelated demo data, not real platform transactions.
router.get('/transactions', requireDepartment(['financial', 'legal']), async (req, res) => {
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

  const scoped = region ? rows.filter(r => r.customer && r.customer.city === region) : rows;
  const transactions = scoped.map(({ c, customer, provider, escrow }) => {
    const materialsAdvanceAmount = (escrow && escrow.materialsAdvanceAmount) || 0;
    // Real commission is only recorded on the payout itself, once it's
    // actually paid out (see payments.routes.js). Until then, this is a
    // clearly-labeled *estimate* — amount x the provider's current plan
    // rate — so admins aren't left guessing what a job will net the
    // platform before payout happens.
    const commissionRate = provider ? commissionRateForPlan(provider.plan) : null;
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
router.get('/transactions/pdf', requireDepartment(['financial', 'legal']), async (req, res) => {
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

  const { sectionHeader, row, twoColumnRow, table, finish } = createReportDoc({
    res,
    filename: `Taskora-Platform-Transactions-Report.pdf`,
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
  const totalEstCommission = scoped.reduce((s, r) => s + r.c.amount * commissionRateForPlan(r.provider && r.provider.plan), 0);
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
        `$${(c.amount * commissionRateForPlan(provider && provider.plan)).toFixed(2)}`,
        c.status,
      ])
    );
  }

  finish({ closingNote: 'This report reflects Taskora\'s transaction records within the scope and date range shown, as of the moment it was generated. GMV figures are gross booking values, not net of commission.' });
});

router.post('/disputes/:id/resolve', requireDepartment(['disputes', 'customer_service']), async (req, res) => {
  const region = await myRegion(req);
  const dispute = await db.find('disputes', d => d.id === req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
  if (region && (await disputeCity(dispute)) !== region) return res.status(403).json({ error: 'That dispute is outside your assigned city' });
  const updated = await db.update('disputes', dispute.id, { status: 'resolved', resolvedAt: new Date().toISOString() });
  const escrow = await db.find('escrowTransactions', e => e.contractId === updated.contractId);
  const wasReleased = escrow && escrow.status !== 'released';
  if (escrow) await db.update('escrowTransactions', escrow.id, { status: 'released' });
  const contract = await db.find('contracts', c => c.id === updated.contractId);
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
  const { name, email, password, city, country, department } = req.body || {};
  const errors = validate([
    ['name', isValidName(name), 'Enter a real name — letters, spaces, hyphens, and apostrophes only'],
    ['email', isValidEmail(email), 'Enter a valid email address'],
    ['password', isValidPassword(password), 'Password must be at least 9 characters with at least 6 numbers, 2 letters, and 1 symbol'],
    ['city', isNonEmptyString(city), 'City is required'],
    ['country', isNonEmptyString(country), 'Country is required'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  if (department && !['verification', 'disputes', 'financial', 'customer_service', 'legal'].includes(department)) {
    return res.status(400).json({ error: 'department must be verification, disputes, or financial' });
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

// GET /api/admin/advertising-inquiries — every "Advertise Here" submission
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
  if (displayLink !== undefined) patch.displayLink = (displayLink || '').trim() || null;

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

// GET /api/admin/exchange-rates — super admin only: every currency Taskora
// operates in, with its effective rate (an edit if one exists, otherwise
// the static approximate default from src/currency-data.js).
router.get('/exchange-rates', requireSuperAdmin, async (req, res) => {
  const rateRows = await db.all('exchangeRates');
  const codes = new Set(Object.values(CURRENCY_BY_COUNTRY).map(c => c.code));
  codes.add('USD');
  const rates = Array.from(codes).sort().map(code => {
    const row = rateRows.find(r => r.currencyCode === code);
    return { currencyCode: code, rateToUsd: row ? row.rateToUsd : (APPROX_USD_RATE[code] ?? 1), isOverride: !!row };
  });
  res.json({ rates });
});

// PATCH /api/admin/exchange-rates — super admin only: overrides the static
// approximate rate for one currency. This feeds every conversion in the
// app that touches that currency — job payments, provider payouts, AND
// plan pricing alike — not just the pricing page, since they all resolve
// through the same resolveRate() helper now.
router.patch('/exchange-rates', requireSuperAdmin, async (req, res) => {
  const { currencyCode, rateToUsd } = req.body || {};
  if (!isNonEmptyString(currencyCode)) return res.status(400).json({ error: 'currencyCode is required' });
  if (typeof rateToUsd !== 'number' || rateToUsd <= 0) return res.status(400).json({ error: 'Enter a valid positive rate' });
  const existing = await db.find('exchangeRates', r => r.currencyCode === currencyCode);
  if (existing) await db.update('exchangeRates', existing.id, { rateToUsd, updatedAt: new Date().toISOString() });
  else await db.insert('exchangeRates', { id: `xr_${currencyCode}`, currencyCode, rateToUsd, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

// GET /api/admin/sales-inquiries — every Custom Plan "Contact Sales"
// submission, newest first. Same super-admin-only reasoning as
// advertising-inquiries: an enterprise-sales function, not tied to a city
// or existing department.
router.get('/sales-inquiries', requireSuperAdmin, async (req, res) => {
  const inquiries = await db.all('salesInquiries');
  inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ inquiries });
});

// PATCH /api/admin/sales-inquiries/:id/status
router.patch('/sales-inquiries/:id/status', requireSuperAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['new', 'contacted', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be new, contacted, or closed' });
  const target = await db.find('salesInquiries', i => i.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Inquiry not found' });
  const updated = await db.update('salesInquiries', target.id, { status });
  res.json({ inquiry: updated });
});

module.exports = router;
