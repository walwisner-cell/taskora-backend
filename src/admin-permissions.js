// v135: custom admin permissions.
//
// Besides the fixed roles (regional admin, Verification Team, Finance, ...),
// a super admin can create an admin with "Custom permissions": for each
// section of the admin area they choose Off, View or Manage, and the area
// the admin covers (one city, one country, or all regions).
//
//   View   = can open the section and see its records (GET requests).
//   Manage = can also act in it (approve, resolve, edit...: everything else).
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

// The sections, in the order they appear in the admin menu.
const AREAS = [
  { key: 'overview', label: 'Overview', help: 'Dashboard numbers for their area.' },
  { key: 'approvals', label: 'User Approvals', help: 'Approve or reject new accounts.' },
  { key: 'people', label: 'Customers & Providers', help: 'Look up people, see contact details, pause or suspend accounts.' },
  { key: 'verification', label: 'Verification Queue', help: 'ID documents and guarantors.' },
  { key: 'stores', label: 'Stores & Skills', help: 'Review pros\' stores, goods and extra skills.' },
  { key: 'rides', label: 'Rides', help: 'Driver applications and ride alerts.' },
  { key: 'providerscores', label: 'Provider Scores', help: 'Trust scores and the leaderboard.' },
  { key: 'disputes', label: 'Disputes', help: 'Read and resolve disputes.' },
  { key: 'fraud', label: 'Fraud & Safety', help: 'Fraud flags.' },
  { key: 'payments', label: 'Payments', help: 'Escrow, transactions and commission.' },
  { key: 'tokens', label: 'Tokens', help: 'Pros\' token balances; Manage can confirm token payments.' },
  { key: 'custpay', label: 'Customer Payments', help: 'Payment codes; Manage can confirm or reject payments.' },
  { key: 'pricing', label: 'Plans & Pricing', help: 'Plan prices; Manage can set local prices for their own country.' },
  { key: 'advertising', label: 'Advertising', help: 'Ad requests.' },
  { key: 'promotions', label: 'Promotions', help: 'Homepage promotions.' },
  { key: 'careers', label: 'Job Applications', help: 'People applying to work at Trothen.' },
  { key: 'contact', label: 'Contact Us Messages', help: 'Messages from the Contact Us form.' },
  { key: 'reports', label: 'Reports', help: 'Reports and the report builder.' },
  { key: 'sales', label: 'Sales Inquiries', help: 'Custom plan leads.' },
  { key: 'organizations', label: 'Organizations', help: 'Multi-seat organization accounts.' },
  { key: 'accesslogs', label: 'Access Logs', help: 'Who viewed sensitive information.' },
];
const AREA_KEYS = AREAS.map(a => a.key);
const LEVELS = ['view', 'manage'];

// Which section each admin address belongs to. Paths are relative to /api.
// [method or '*', pattern, area]. First match wins.
const P = (s) => new RegExp('^' + s.replace(/:[a-zA-Z]+/g, '[^/]+') + '/?$');
const ROUTES = [
  ['GET', '/admin/stats', 'overview'],
  ['GET', '/admin/reports/analytics', 'reports'],
  ['GET', '/admin/report-builder', 'reports'],
  ['GET', '/admin/users/pending', 'approvals'],
  ['POST', '/admin/users/:id/decide', 'approvals'],
  ['GET', '/admin/users/all', 'people'],
  ['GET', '/admin/users/:id/contact', 'people'],
  ['PATCH', '/admin/users/:id/status', 'people'],
  ['PATCH', '/admin/users/:id/hold', 'people'],
  ['POST', '/admin/providers/:id/hold', 'people'],
  ['POST', '/admin/providers/:id/propose-commission-rate', 'people'],
  ['GET', '/admin/providers/leaderboard', 'providerscores'],
  ['GET', '/admin/providers/:id/score', 'providerscores'],
  ['GET', '/admin/providers-with-guarantors', 'verification'],
  ['PATCH', '/admin/providers/:id/guarantors/:index', 'verification'],
  ['GET', '/admin/verification-queue', 'verification'],
  ['POST', '/admin/verification-gaps-ask-all', 'verification'],
  ['GET', '/admin/verification-history', 'verification'],
  ['GET', '/admin/verification-gaps', 'verification'],
  ['GET', '/admin/verification-waiting', 'verification'],
  ['POST', '/admin/verification-gaps/:userId', 'verification'],
  ['GET', '/admin/verification/:id/back', 'verification'],
  ['GET', '/admin/verification/:id/selfie', 'verification'],
  ['GET', '/admin/verification/:id/document', 'verification'],
  ['POST', '/admin/verification/:id/decide', 'verification'],
  ['GET', '/admin/disputes', 'disputes'],
  ['GET', '/admin/disputes/pdf', 'disputes'],
  ['GET', '/admin/disputes/:id/audit-log', 'disputes'],
  ['POST', '/admin/disputes/:id/resolve', 'disputes'],
  ['GET', '/admin/fraud-flags', 'fraud'],
  ['POST', '/admin/fraud-flags/:id/resolve', 'fraud'],
  ['GET', '/admin/transactions', 'payments'],
  ['GET', '/admin/transactions/pdf', 'payments'],
  ['GET', '/admin/commission-ledger', 'payments'],
  ['GET', '/admin/financial-by-region', 'payments'],
  ['GET', '/escrow/summary', 'payments'],
  ['GET', '/admin/contact-submissions', 'contact'],
  ['PATCH', '/admin/contact-submissions/:id/status', 'contact'],
  ['GET', '/admin/careers-inquiries', 'careers'],
  ['PATCH', '/admin/careers-inquiries/:id/status', 'careers'],
  ['GET', '/admin/promotions', 'promotions'],
  ['POST', '/admin/promotions/image', 'promotions'],
  ['POST', '/admin/promotions', 'promotions'],
  ['PATCH', '/admin/promotions/:id', 'promotions'],
  ['DELETE', '/admin/promotions/:id', 'promotions'],
  ['GET', '/admin/access-logs', 'accesslogs'],
  ['GET', '/admin/advertising-inquiries', 'advertising'],
  ['PATCH', '/admin/advertising-inquiries/:id/status', 'advertising'],
  ['PATCH', '/admin/advertising-inquiries/:id/live', 'advertising'],
  ['GET', '/admin/plan-pricing', 'pricing'],
  ['PATCH', '/admin/plan-pricing/override', 'pricing'],
  ['DELETE', '/admin/plan-pricing/override/:country/:plan', 'pricing'],
  ['*', '/admin/sales-inquiries(/.*)?', 'sales'],
  ['*', '/admin/organizations(/.*)?', 'organizations'],
  ['GET', '/admin/store/review', 'stores'],
  ['POST', '/admin/store/goods/:id/decide', 'stores'],
  ['POST', '/admin/store/stores/:providerId/decide', 'stores'],
  ['POST', '/admin/store/stores/:providerId/close', 'stores'],
  ['POST', '/admin/skills/:providerId/decide', 'stores'],
  ['GET', '/admin/skills/:providerId/licence', 'stores'],
  ['GET', '/admin/rides/overview', 'rides'],
  ['GET', '/admin/rides/applications/:userId/doc/:kind', 'rides'],
  ['POST', '/admin/rides/applications/:userId/decision', 'rides'],
  ['POST', '/admin/rides/alerts/:id/resolve', 'rides'],
  ['GET', '/admin/tokens', 'tokens'],
  ['GET', '/admin/tokens/customer', 'tokens'],
  ['GET', '/admin/tokens/country', 'tokens'],
  ['GET', '/admin/tokens/codes', 'tokens'],
  ['POST', '/admin/tokens/offline-topup', 'tokens'],
  ['POST', '/admin/tokens/codes/confirm', 'tokens'],
  ['POST', '/admin/tokens/codes/reject', 'tokens'],
  ['GET', '/admin/customer-payments', 'custpay'],
  ['POST', '/admin/customer-payments/confirm', 'custpay'],
  ['POST', '/admin/customer-payments/reject', 'custpay'],
  ['POST', '/admin/customer-payments/refund-sent', 'custpay'],
].map(([m, p, a]) => [m, P(p), a]);

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

// Cleans what a super admin sent: { area: 'view' | 'manage' }, unknown keys dropped.
function cleanPermissions(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of AREA_KEYS) if (LEVELS.includes(input[k])) out[k] = input[k];
  return out;
}

// May this admin do this? level: 'view' or 'manage'.
function adminCan(u, area, level) {
  if (!u || u.role !== 'admin' || u.active === false) return false;
  if (u.isSuperAdmin) return true;
  if (!isCustom(u)) return false; // fixed roles keep their own rules
  const have = (u.adminPermissions || {})[area];
  if (!have) return false;
  return level === 'view' ? (have === 'view' || have === 'manage') : have === 'manage';
}

// Only custom admins (for adding them to notification lists; fixed roles keep their own rules).
const customCan = (u, area, level = 'view') => isCustom(u) && u.active !== false && adminCan(u, area, level);

function areaFor(method, path) {
  const hit = ROUTES.find(([m, re]) => (m === '*' || m === method) && re.test(path));
  return hit ? hit[2] : null;
}

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
  const area = areaFor(method, path);
  if (!area) return res.status(403).json({ code: 'NOT_PERMITTED', error: 'Your admin account does not have access to this. Ask a super admin to add it to your permissions.' });
  const level = method === 'GET' ? 'view' : 'manage';
  if (!adminCan(u, area, level)) {
    const label = (AREAS.find(a => a.key === area) || {}).label || area;
    return res.status(403).json({ code: 'NOT_PERMITTED', error: level === 'manage' && adminCan(u, area, 'view') ? `You can view ${label} but not make changes there. Ask a super admin for Manage access.` : `Your admin account does not have access to ${label}. Ask a super admin to add it to your permissions.` });
  }
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

module.exports = { AREAS, AREA_KEYS, LEVELS, ROUTES, isCustom, cleanPermissions, adminCan, customCan, areaFor, customAdminGate, gatePassed, requireGateForCustom, customAdminsWith };
