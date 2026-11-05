// v135: custom admin permissions.
//
// Besides the fixed roles (regional admin, Verification Team, Finance, ...),
// a super admin can create an admin with "Custom permissions": for each
// section of the admin area they choose Off, View or Manage, and the area
// the admin covers (one city, one country, or all regions).
//
//   View   = can open the section and see its records.
//   Manage = can also act in it (approve, resolve, edit...).
//   Custom = exactly the actions ticked (v137; see AREAS below).
//
// How it is enforced: one gate (customAdminGate, mounted in server.js before
// every route) checks each request a custom admin makes to /api/admin/... or
// /api/escrow/... against the section that address belongs to. Anything not
// listed below is refused (default deny). Once the gate has allowed a request,
// the existing checks in each route treat the custom admin like a team
// member for that section, still limited to their area. Super-admin-only
// actions (creating admins, Go-Live, Data Cleanup, platform settings, the
// legal pages) are never granted: a custom admin is never a super admin.
const jwt = require('jsonwebtoken');

// v137: granular permissions. Each section is split into the separate things
// that can be done in it (its "actions"). A super admin can still pick a
// quick preset per section (Off, View, Manage) or tick exactly the actions
// they want ("Custom"). "See the section" is always included when anything
// else in that section is ticked: nobody can act on records they can't see.
//   read: true  = looking only (lists, documents, downloads);
//   read: false = changing something (approve, resolve, edit...).
// View = every read action of the section; Manage = every action.
const A = (key, label, read = false) => ({ key, label, read });
const SEE = (label) => A('view', label, true);
const AREAS = [
  { key: 'overview', label: 'Overview', help: 'Dashboard numbers for their area.', actions: [SEE('See the dashboard numbers')] },
  { key: 'approvals', label: 'User Approvals', help: 'Approve or reject new accounts.', actions: [SEE('See accounts waiting for approval'), A('decide', 'Approve or reject accounts')] },
  { key: 'people', label: 'Customers & Providers', help: 'Look up people, see contact details, pause or suspend accounts.', actions: [SEE('See the list of people'), A('contact', 'See phone numbers and email addresses', true), A('status', 'Pause, suspend or reactivate accounts'), A('hold', 'Put payouts on hold or release them'), A('commission', 'Propose a pro\'s commission rate')] },
  { key: 'verification', label: 'Verification Queue', help: 'ID documents and guarantors.', actions: [SEE('See the queue and history'), A('documents', 'Open ID documents and selfies', true), A('decide', 'Approve or reject ID documents'), A('guarantors', 'Approve or reject guarantors'), A('ask', 'Ask people for missing documents')] },
  { key: 'stores', label: 'Stores & Skills', help: 'Review pros\' stores, goods and extra skills.', actions: [SEE('See stores, goods and skills waiting'), A('licence', 'Open licence documents', true), A('goods', 'Approve or reject goods'), A('stores', 'Approve, reject or close stores'), A('skills', 'Approve or reject extra skills')] },
  { key: 'rides', label: 'Rides', help: 'Driver applications and ride alerts.', actions: [SEE('See driver applications and alerts'), A('documents', 'Open driver documents', true), A('applications', 'Approve or reject drivers'), A('alerts', 'Resolve ride alerts')] },
  { key: 'providerscores', label: 'Provider Scores', help: 'Trust scores and the leaderboard.', actions: [SEE('See scores and the leaderboard')] },
  { key: 'disputes', label: 'Disputes', help: 'Read and resolve disputes.', actions: [SEE('See disputes and their history'), A('calls', 'See when the two sides called or sent voice messages (times only)', true), A('export', 'Download disputes as PDF', true), A('resolve', 'Resolve disputes')] },
  { key: 'fraud', label: 'Fraud & Safety', help: 'Fraud flags.', actions: [SEE('See fraud flags'), A('resolve', 'Resolve fraud flags')] },
  { key: 'payments', label: 'Payments', help: 'Escrow, transactions and commission.', actions: [SEE('See transactions and escrow totals'), A('commission', 'See the commission ledger and region totals', true), A('export', 'Download transactions as PDF', true)] },
  { key: 'tokens', label: 'Tokens', help: 'Pros\' token balances; Manage can confirm token payments.', actions: [SEE('See token balances and payment codes'), A('confirm', 'Confirm or reject token payments'), A('topup', 'Record a cash token top-up')] },
  { key: 'custpay', label: 'Customer Payments', help: 'Payment codes; Manage can confirm or reject payments.', actions: [SEE('See customer payment codes'), A('confirm', 'Confirm or reject customer payments'), A('refund', 'Mark a refund as sent')] },
  { key: 'pricing', label: 'Plans & Pricing', help: 'Plan prices; Manage can set local prices for their own country.', actions: [SEE('See plan prices'), A('set', 'Set or remove local prices (own country only)')] },
  { key: 'advertising', label: 'Advertising', help: 'Ad requests.', actions: [SEE('See ad requests'), A('status', 'Update an ad request\'s status'), A('live', 'Put ads live or take them down')] },
  { key: 'promotions', label: 'Promotions', help: 'Homepage promotions.', actions: [SEE('See promotions'), A('create', 'Create promotions'), A('edit', 'Edit promotions'), A('delete', 'Delete promotions')] },
  { key: 'careers', label: 'Job Applications', help: 'People applying to work at Trothen.', actions: [SEE('See job applications'), A('status', 'Update an application\'s status')] },
  { key: 'contact', label: 'Contact Us Messages', help: 'Messages from the Contact Us form.', actions: [SEE('See messages'), A('status', 'Mark messages handled')] },
  { key: 'reports', label: 'Reports', help: 'Reports and the report builder.', actions: [SEE('See reports'), A('builder', 'Use the report builder', true)] },
  { key: 'sales', label: 'Sales Inquiries', help: 'Custom plan leads.', actions: [SEE('See sales leads'), A('update', 'Update leads and deals'), A('convert', 'Turn a lead into an organization')] },
  { key: 'organizations', label: 'Organizations', help: 'Multi-seat organization accounts.', actions: [SEE('See organizations'), A('edit', 'Edit organizations'), A('seats', 'Add or remove seats and invites')] },
  { key: 'accesslogs', label: 'Access Logs', help: 'Who viewed sensitive information.', actions: [SEE('See access logs')] },
];
const AREA_KEYS = AREAS.map(a => a.key);
const LEVELS = ['view', 'manage'];
const areaDef = (k) => AREAS.find(a => a.key === k);

// Which section and action each admin address belongs to. Paths are relative
// to /api. [method or '*', pattern, area, action]. First match wins.
const P = (s) => new RegExp('^' + s.replace(/:[a-zA-Z]+/g, '[^/]+') + '/?$');
const ROUTES = [
  ['GET', '/admin/stats', 'overview', 'view'],
  ['GET', '/admin/reports/analytics', 'reports', 'view'],
  ['GET', '/admin/report-builder', 'reports', 'builder'],
  ['GET', '/admin/users/pending', 'approvals', 'view'],
  ['POST', '/admin/users/:id/decide', 'approvals', 'decide'],
  ['GET', '/admin/users/all', 'people', 'view'],
  ['GET', '/admin/users/:id/contact', 'people', 'contact'],
  ['PATCH', '/admin/users/:id/status', 'people', 'status'],
  ['PATCH', '/admin/users/:id/hold', 'people', 'hold'],
  ['POST', '/admin/providers/:id/hold', 'people', 'hold'],
  ['POST', '/admin/providers/:id/propose-commission-rate', 'people', 'commission'],
  ['GET', '/admin/providers/leaderboard', 'providerscores', 'view'],
  ['GET', '/admin/providers/:id/score', 'providerscores', 'view'],
  ['GET', '/admin/providers-with-guarantors', 'verification', 'view'],
  ['PATCH', '/admin/providers/:id/guarantors/:index', 'verification', 'guarantors'],
  ['GET', '/admin/verification-queue', 'verification', 'view'],
  ['POST', '/admin/verification-gaps-ask-all', 'verification', 'ask'],
  ['GET', '/admin/verification-history', 'verification', 'view'],
  ['GET', '/admin/verification-gaps', 'verification', 'view'],
  ['GET', '/admin/verification-waiting', 'verification', 'view'],
  ['POST', '/admin/verification-gaps/:userId', 'verification', 'ask'],
  ['GET', '/admin/verification/:id/back', 'verification', 'documents'],
  ['GET', '/admin/verification/:id/selfie', 'verification', 'documents'],
  ['GET', '/admin/verification/:id/document', 'verification', 'documents'],
  ['POST', '/admin/verification/:id/decide', 'verification', 'decide'],
  ['GET', '/admin/disputes', 'disputes', 'view'],
  ['GET', '/admin/disputes/pdf', 'disputes', 'export'],
  ['GET', '/admin/disputes/:id/audit-log', 'disputes', 'view'],
  ['GET', '/admin/disputes/:id/calls', 'disputes', 'calls'],
  ['POST', '/admin/disputes/:id/resolve', 'disputes', 'resolve'],
  ['GET', '/admin/fraud-flags', 'fraud', 'view'],
  ['POST', '/admin/fraud-flags/:id/resolve', 'fraud', 'resolve'],
  ['GET', '/admin/transactions', 'payments', 'view'],
  ['GET', '/admin/transactions/pdf', 'payments', 'export'],
  ['GET', '/admin/commission-ledger', 'payments', 'commission'],
  ['GET', '/admin/financial-by-region', 'payments', 'commission'],
  ['GET', '/escrow/summary', 'payments', 'view'],
  ['GET', '/admin/contact-submissions', 'contact', 'view'],
  ['PATCH', '/admin/contact-submissions/:id/status', 'contact', 'status'],
  ['GET', '/admin/careers-inquiries', 'careers', 'view'],
  ['PATCH', '/admin/careers-inquiries/:id/status', 'careers', 'status'],
  ['GET', '/admin/promotions', 'promotions', 'view'],
  ['POST', '/admin/promotions/image', 'promotions', 'create'],
  ['POST', '/admin/promotions', 'promotions', 'create'],
  ['PATCH', '/admin/promotions/:id', 'promotions', 'edit'],
  ['DELETE', '/admin/promotions/:id', 'promotions', 'delete'],
  ['GET', '/admin/access-logs', 'accesslogs', 'view'],
  ['GET', '/admin/advertising-inquiries', 'advertising', 'view'],
  ['PATCH', '/admin/advertising-inquiries/:id/status', 'advertising', 'status'],
  ['PATCH', '/admin/advertising-inquiries/:id/live', 'advertising', 'live'],
  ['GET', '/admin/plan-pricing', 'pricing', 'view'],
  ['PATCH', '/admin/plan-pricing/override', 'pricing', 'set'],
  ['DELETE', '/admin/plan-pricing/override/:country/:plan', 'pricing', 'set'],
  ['GET', '/admin/sales-inquiries(/.*)?', 'sales', 'view'],
  ['POST', '/admin/sales-inquiries/:id/convert-to-org', 'sales', 'convert'],
  ['*', '/admin/sales-inquiries(/.*)?', 'sales', 'update'],
  ['GET', '/admin/organizations(/.*)?', 'organizations', 'view'],
  ['*', '/admin/organizations/:id/(seats|invites)(/.*)?', 'organizations', 'seats'],
  ['*', '/admin/organizations(/.*)?', 'organizations', 'edit'],
  ['GET', '/admin/store/review', 'stores', 'view'],
  ['POST', '/admin/store/goods/:id/decide', 'stores', 'goods'],
  ['POST', '/admin/store/stores/:providerId/decide', 'stores', 'stores'],
  ['POST', '/admin/store/stores/:providerId/close', 'stores', 'stores'],
  ['POST', '/admin/skills/:providerId/decide', 'stores', 'skills'],
  ['GET', '/admin/skills/:providerId/licence', 'stores', 'licence'],
  ['GET', '/admin/rides/overview', 'rides', 'view'],
  ['GET', '/admin/rides/applications/:userId/doc/:kind', 'rides', 'documents'],
  ['POST', '/admin/rides/applications/:userId/decision', 'rides', 'applications'],
  ['POST', '/admin/rides/alerts/:id/resolve', 'rides', 'alerts'],
  ['GET', '/admin/tokens', 'tokens', 'view'],
  ['GET', '/admin/tokens/customer', 'tokens', 'view'],
  ['GET', '/admin/tokens/country', 'tokens', 'view'],
  ['GET', '/admin/tokens/codes', 'tokens', 'view'],
  ['POST', '/admin/tokens/offline-topup', 'tokens', 'topup'],
  ['POST', '/admin/tokens/codes/confirm', 'tokens', 'confirm'],
  ['POST', '/admin/tokens/codes/reject', 'tokens', 'confirm'],
  ['GET', '/admin/customer-payments', 'custpay', 'view'],
  ['POST', '/admin/customer-payments/confirm', 'custpay', 'confirm'],
  ['POST', '/admin/customer-payments/reject', 'custpay', 'confirm'],
  ['POST', '/admin/customer-payments/refund-sent', 'custpay', 'refund'],
].map(([m, p, a, act]) => [m, P(p), a, act]);

// Allowed for every custom admin, whatever was ticked: reading the lists
// every admin page needs, and the announcements every admin must read.
const ALWAYS = [
  ['GET', '/admin/categories'],
  ['GET', '/admin/countries'],
  ['GET', '/admin/announcements'],
  ['GET', '/admin/permission-areas'],
  ['POST', '/admin/announcements/:id/acknowledge'],
].map(([m, p]) => [m, P(p)]);

const isCustom = (u) => !!(u && u.role === 'admin' && !u.isSuperAdmin && u.adminDepartment === 'custom');

// The exact set of actions a stored value gives in one section.
// Stored as 'view', 'manage', or a list of action keys (v137).
function actionsIn(areaKey, value) {
  const def = areaDef(areaKey); if (!def || !value) return [];
  if (value === 'manage') return def.actions.map(a => a.key);
  if (value === 'view') return def.actions.filter(a => a.read).map(a => a.key);
  if (Array.isArray(value)) {
    const keys = def.actions.map(a => a.key).filter(k => value.includes(k));
    return keys.length ? (keys.includes('view') ? keys : ['view', ...keys]) : [];
  }
  return [];
}

// Cleans what a super admin sent: { area: 'view' | 'manage' | [actions] },
// unknown sections and actions dropped. A list that equals a preset is stored
// as that preset, so it reads the same way everywhere.
function cleanPermissions(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of AREA_KEYS) {
    const v = input[k];
    if (LEVELS.includes(v)) { out[k] = v; continue; }
    if (!Array.isArray(v)) continue;
    const got = actionsIn(k, v.map(String));
    if (!got.length) continue;
    const def = areaDef(k);
    const all = def.actions.map(a => a.key), reads = def.actions.filter(a => a.read).map(a => a.key);
    const same = (x) => x.length === got.length && x.every(y => got.includes(y));
    out[k] = same(reads) ? 'view' : same(all) ? 'manage' : got; // a section with nothing to change is just View
  }
  return out;
}

// May this admin do this? what: 'view' (see the section), 'manage' (any
// change in it), or one action key ('resolve', 'confirm', ...).
function adminCan(u, area, what) {
  if (!u || u.role !== 'admin' || u.active === false) return false;
  if (u.isSuperAdmin) return true;
  if (!isCustom(u)) return false; // fixed roles keep their own rules
  const have = actionsIn(area, (u.adminPermissions || {})[area]);
  if (!have.length) return false;
  if (what === 'view') return have.includes('view');
  if (what === 'manage') { const def = areaDef(area); return def.actions.some(a => !a.read && have.includes(a.key)); }
  return have.includes(what);
}

// Only custom admins (for adding them to notification lists; fixed roles keep their own rules).
const customCan = (u, area, what = 'view') => isCustom(u) && u.active !== false && adminCan(u, area, what);

function routeFor(method, path) {
  const hit = ROUTES.find(([m, re]) => (m === '*' || m === method) && re.test(path));
  return hit ? { area: hit[2], action: hit[3] } : null;
}
const areaFor = (method, path) => { const r = routeFor(method, path); return r ? r.area : null; };

// Mounted on /api in server.js, before every router.
async function customAdminGate(req, res, next) {
  // Express matches routes without caring about capitals or repeated
  // slashes ("/API/ADMIN//stats" reaches /api/admin/stats), so the check
  // must read the address the same way, or a custom admin could slip past.
  const path = String(req.path || '').toLowerCase().replace(/\/{2,}/g, '/');
  if (!path.startsWith('/admin/') && path !== '/admin' && !path.startsWith('/escrow/')) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(); // the route's own requireAuth answers
  let payload;
  try { payload = jwt.verify(token, require('./auth').JWT_SECRET); } catch (e) { return next(); }
  if (!payload || payload.role !== 'admin') return next();
  let u;
  try { u = await require('./db').find('users', x => x.id === payload.sub); } catch (e) { return next(); }
  if (!isCustom(u)) return next(); // super admins and fixed roles: unchanged
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  if (ALWAYS.some(([m, re]) => m === method && re.test(path))) { req.customAdminArea = '*'; return next(); }
  const hit = routeFor(method, path);
  if (!hit) return res.status(403).json({ code: 'NOT_PERMITTED', error: 'Your admin account does not have access to this. Ask a super admin to add it to your permissions.' });
  const { area, action } = hit;
  if (!adminCan(u, area, action)) {
    const def = areaDef(area) || {};
    const label = def.label || area;
    const what = ((def.actions || []).find(a => a.key === action) || {}).label || action;
    return res.status(403).json({ code: 'NOT_PERMITTED', area, action, error: adminCan(u, area, 'view') ? `You can open ${label}, but "${what}" is not in your permissions. Ask a super admin to add it.` : `Your admin account does not have access to ${label}. Ask a super admin to add it to your permissions.` });
  }
  req.customAdminAction = action;
  req.customAdminArea = area; // the route's own checks let a custom admin through only when this is set
  next();
}

// For the route checks: did the gate allow this custom admin's request?
// ('*' marks the always-allowed reading lists: they never unlock a section.)
const gatePassed = (req, u) => isCustom(u) && !!(req && req.customAdminArea) && req.customAdminArea !== '*';

// Second lock, used inside the admin routes: a custom admin whose request did
// not go through the gate above is refused, whatever the address looked like.
function requireGateForCustom(req, res, next, u) {
  if (isCustom(u) && !(req && req.customAdminArea)) return res.status(403).json({ code: 'NOT_PERMITTED', error: 'Your admin account does not have access to this. Ask a super admin to add it to your permissions.' });
  return next();
}

// Custom admins who should hear about something in an area (notifications).
async function customAdminsWith(area, level = 'view') {
  const db = require('./db');
  return db.filter('users', u => isCustom(u) && u.active !== false && adminCan(u, area, level));
}

module.exports = { AREAS, AREA_KEYS, LEVELS, ROUTES, isCustom, actionsIn, cleanPermissions, adminCan, customCan, areaFor, routeFor, customAdminGate, gatePassed, requireGateForCustom, customAdminsWith };
