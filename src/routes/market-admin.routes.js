// v164: Admin → Market. One place for the team to look after the Market,
// as marketplaces do (eBay, Jumia, Facebook Marketplace), following the EU
// Digital Services Act's "notice and action" rules (articles 16, 17 and 23):
//   - see the whole Market at a glance: listings, store goods, orders,
//     reports, returns and stolen-goods reports;
//   - find any listing, store good, seller or order, and act on it;
//   - every take-down gives the seller the reason (a "statement of
//     reasons"), and a seller who keeps breaking the rules can be stopped
//     from selling, for a time or until lifted, again with the reason;
//   - every action is written to the access log, and shown on the page.
// An admin only sees and acts on sellers in the area they look after.
const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const store = require('../store');
const market = require('../market');
const { requireAuth, requireRole } = require('../auth');
const { notify } = require('../notify');
const { isNonEmptyString } = require('../validators');
const { adminScopeFor } = require('../admin-scope');

const router = express.Router();
const DAY = 24 * 60 * 60 * 1000;
const money = (n) => Math.round(Number(n) * 100) / 100;
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Same team as Stores & Skills: super admins, regional admins, and the
// verification and customer service teams.
async function teamGate(req, res, next) {
  const m = await db.find('users', u => u.id === req.user.sub);
  if (!m || m.active === false) return res.status(403).json({ error: 'This account has been suspended. Contact a super admin for access.' });
  if (!m.isSuperAdmin && m.adminDepartment && !['verification', 'customer_service'].includes(m.adminDepartment) && !require('../admin-permissions').gatePassed(req, m)) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  req.adminUser = m; req.covers = adminScopeFor(m); next();
}
const team = [requireAuth, requireRole('admin'), teamGate];

async function log(req, type, what) {
  try { await db.insert('accessLogs', { id: `al_${nanoid(10)}`, adminId: req.adminUser.id, resourceType: type, resourceId: String(what).slice(0, 300), ipAddress: req.ip, createdAt: new Date().toISOString() }); } catch (e) { /* the action stands */ }
}

// A seller stopped from selling in the Market (for a time, or until lifted).
function banOf(u) {
  const b = u && u.marketBan;
  if (!b || !b.at) return null;
  if (b.until && Date.parse(b.until) <= Date.now()) return null;
  return b;
}

const isMarketOrder = (c) => c && (c.storeOrder === true || !!c.marketListingId || (Array.isArray(c.storeItems) && c.storeItems.length > 0));
const words = (q) => String(q || '').trim().toLowerCase().slice(0, 80).split(/\s+/).filter(w => w.length > 1);
const hits = (text, ws) => !ws.length || ws.every(w => String(text).toLowerCase().includes(w));

// ── at a glance ───────────────────────────────────────────────────────
router.get('/admin/market/overview', team, async (req, res) => {
  const users = await db.all('users');
  const byId = new Map(users.map(u => [u.id, u]));
  const mine = (id) => { const u = byId.get(id); return !!u && req.covers(u); };
  const listings = (await db.filter('marketListings', l => l.status !== 'deleted')).filter(l => mine(l.sellerId));
  const goods = (await db.all('storeGoods')).filter(g => mine(g.providerId) && g.forSale !== false);
  const orders = (await db.filter('contracts', isMarketOrder)).filter(c => mine(c.providerId));
  const disputes = await db.filter('disputes', d => d.status !== 'resolved');
  const disputed = new Set(disputes.map(d => d.contractId));
  const monthAgo = Date.now() - 30 * DAY;
  const count = (arr, f) => arr.filter(f).length;
  const stolen = (await db.filter('stolenReports', r => r.status === 'open')).filter(r => mine(r.userId));
  const sellersWithBan = users.filter(u => banOf(u) && req.covers(u));
  const sold30 = orders.filter(c => c.status === 'completed' && Date.parse(c.completedAt || c.createdAt) > monthAgo);
  res.json({
    listings: {
      live: count(listings, l => l.status === 'live'),
      toCheck: count(listings, l => l.status === 'review' || ((l.reports || []).length > 0 && ['live', 'hidden'].includes(l.status))),
      hidden: count(listings, l => l.status === 'hidden'),
      removed: count(listings, l => l.status === 'removed'),
      sold: count(listings, l => l.status === 'sold'),
    },
    goods: { live: count(goods, g => store.isOnShelf(g)), waiting: count(goods, g => g.status === 'pending'), turnedDown: count(goods, g => g.status === 'rejected') },
    stores: { live: count(users, u => u.role === 'provider' && u.store && u.store.name && req.covers(u) && store.storeIsLive(u)), waiting: count(users, u => u.role === 'provider' && u.store && u.store.name && req.covers(u) && store.storeApproval(u) === 'pending'), closedByTeam: count(users, u => u.store && u.store.closedByAdmin && req.covers(u)) },
    orders: {
      open: count(orders, c => ['awaiting_payment', 'pending_provider_confirmation', 'active'].includes(c.status)),
      problems: count(orders, c => disputed.has(c.id)),
      returnsForTeam: count(orders, c => c.returnRequest && c.returnRequest.status === 'escalated'),
      completed30: sold30.length,
      value30: money(sold30.reduce((t, c) => t + (c.storeGoodsTotal || c.amount || 0), 0)),
    },
    stolenOpen: stolen.length,
    sellersStopped: sellersWithBan.length,
  });
});

// ── personal listings: every status, with search ──────────────────────
router.get('/admin/market/all-listings', team, async (req, res) => {
  const want = ['check', 'live', 'review', 'hidden', 'removed', 'sold', 'all'].includes(req.query.show) ? req.query.show : 'live';
  const ws = words(req.query.q);
  let list = await db.filter('marketListings', l => l.status !== 'deleted');
  if (want === 'check') list = list.filter(l => l.status === 'review' || ((l.reports || []).length > 0 && ['live', 'hidden'].includes(l.status)));
  else if (want !== 'all') list = list.filter(l => l.status === want);
  const out = [];
  for (const l of list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) {
    const seller = await db.find('users', u => u.id === l.sellerId);
    if (seller && !req.covers(seller)) continue;
    if (!hits(`${l.title} ${l.description || ''} ${l.category} ${seller ? seller.name : ''} ${l.city} ${l.id}`, ws)) continue;
    out.push({ id: l.id, title: l.title, description: String(l.description || '').slice(0, 300), category: l.category, price: l.price, currency: l.currency, priceUsd: l.priceUsd, photoUrls: (l.photoUrls || []).slice(0, 3), status: l.status, condition: l.condition || null, reviewReasons: l.reviewReasons || [], reports: (l.reports || []).map(r => ({ reason: r.reason, at: r.at })), removedReason: l.removedReason || null, city: l.city, country: l.country, createdAt: l.createdAt, views: l.views || 0, seller: seller ? { id: seller.id, name: seller.name, verified: seller.verified === true, stopped: !!banOf(seller) } : null });
    if (out.length >= 100) break;
  }
  res.json({ listings: out, show: want });
});

// ── store goods: every good on sale, with search ──────────────────────
router.get('/admin/market/goods', team, async (req, res) => {
  const want = ['live', 'pending', 'rejected', 'all'].includes(req.query.show) ? req.query.show : 'live';
  const ws = words(req.query.q);
  const users = await db.filter('users', u => u.role === 'provider' && u.store);
  const byId = new Map(users.map(u => [u.id, u]));
  const cur = new Map();
  const out = [];
  const goods = (await db.all('storeGoods')).filter(g => g.forSale !== false).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  for (const g of goods) {
    const p = byId.get(g.providerId);
    if (!p || !req.covers(p)) continue;
    const live = store.isOnShelf(g);
    if (want === 'live' && !live) continue;
    if (want === 'pending' && g.status !== 'pending') continue;
    if (want === 'rejected' && g.status !== 'rejected') continue;
    if (!hits(`${g.name} ${g.description || ''} ${p.name} ${(p.store && p.store.name) || ''} ${g.id}`, ws)) continue;
    if (!cur.has(p.country || '')) cur.set(p.country || '', await store.currenciesFor(p));
    out.push({ id: g.id, name: g.name, description: String(g.description || '').slice(0, 300), price: store.goodUsdPrice(g, cur.get(p.country || '')), unit: g.unit || '', photoUrls: (g.photoUrls || []).slice(0, 3), status: g.status, live, inStock: store.anyInStock(g), reviewNote: g.reviewNote || null, reviewedByName: g.reviewedByName || null, storeName: (p.store && p.store.name) || p.name, seller: { id: p.id, name: p.name, city: p.city || '', country: p.country || '', stopped: !!banOf(p) } });
    if (out.length >= 100) break;
  }
  res.json({ goods: out, show: want });
});

// ── sellers: stores and people, with what they sell and how it goes ──
router.get('/admin/market/sellers', team, async (req, res) => {
  const ws = words(req.query.q);
  const onlyStopped = req.query.show === 'stopped';
  const listings = await db.filter('marketListings', l => l.status !== 'deleted');
  const goods = (await db.all('storeGoods')).filter(g => g.forSale !== false);
  const orders = await db.filter('contracts', isMarketOrder);
  const disputes = new Set((await db.all('disputes')).map(d => d.contractId));
  const ids = new Set([...listings.map(l => l.sellerId), ...goods.map(g => g.providerId)]);
  const out = [];
  for (const id of ids) {
    const u = await db.find('users', x => x.id === id);
    if (!u || !req.covers(u)) continue;
    const ban = banOf(u);
    if (onlyStopped && !ban) continue;
    if (!hits(`${u.name} ${u.email} ${(u.store && u.store.name) || ''} ${u.city || ''} ${u.id}`, ws)) continue;
    const mineL = listings.filter(l => l.sellerId === id), mineO = orders.filter(c => c.providerId === id);
    out.push({
      id, name: u.name, email: u.email, city: u.city || '', country: u.country || '', role: u.role, verified: u.verified === true,
      storeName: (u.store && u.store.name) || null, storeLive: u.role === 'provider' && store.storeIsLive(u), storeClosedByTeam: !!(u.store && u.store.closedByAdmin),
      listingsLive: mineL.filter(l => l.status === 'live').length, listingsRemoved: mineL.filter(l => l.status === 'removed').length,
      reports: mineL.reduce((n, l) => n + (l.reports || []).length, 0),
      goodsLive: goods.filter(g => g.providerId === id && store.isOnShelf(g)).length,
      orders: mineO.filter(c => ['active', 'completed'].includes(c.status)).length,
      problems: mineO.filter(c => disputes.has(c.id) || !!c.returnRequest).length,
      sellerRating: u.sellerRating || null,
      stopped: ban ? { reason: ban.reason, at: ban.at, until: ban.until || null, byName: ban.byName || null } : null,
    });
  }
  out.sort((a, b) => (b.stopped ? 1 : 0) - (a.stopped ? 1 : 0) || (b.reports + b.problems) - (a.reports + a.problems) || a.name.localeCompare(b.name));
  res.json({ sellers: out.slice(0, 100) });
});

// Stop a seller from selling in the Market: their listings come off sale,
// their store closes, and they can't list anything until it is lifted (or
// the time runs out). Orders already paid for carry on, so no buyer loses
// out.
router.post('/admin/market/sellers/:id/stop', team, async (req, res) => {
  const u = await db.find('users', x => x.id === req.params.id && ['customer', 'provider'].includes(x.role));
  if (!u || !req.covers(u)) return res.status(404).json({ error: 'Seller not found' });
  const { reason, days } = req.body || {};
  if (!isNonEmptyString(reason, { min: 10, max: 300 })) return res.status(400).json({ error: 'Say why, in a few words (10 to 300 characters). The seller sees this.' });
  const d = days === undefined || days === null || days === '' ? null : Number(days);
  if (d !== null && !(Number.isInteger(d) && d >= 1 && d <= 365)) return res.status(400).json({ error: 'Choose how long: 1 to 365 days, or until the team lifts it.' });
  const now = new Date();
  const ban = { reason: String(reason).trim(), at: now.toISOString(), until: d ? new Date(now.getTime() + d * DAY).toISOString() : null, by: req.adminUser.id, byName: req.adminUser.name };
  const patch = { marketBan: ban };
  if (u.store && u.store.name) patch.store = { ...u.store, open: false, closedByAdmin: true, closedReason: ban.reason, closedAt: now.toISOString(), closedBy: req.adminUser.id, closedByMarketStop: true };
  await db.update('users', u.id, patch);
  let hidden = 0;
  for (const l of await db.filter('marketListings', x => x.sellerId === u.id && x.status === 'live')) { await db.update('marketListings', l.id, { status: 'hidden', hiddenByStop: true }); hidden += 1; }
  if (u.store) await store.refreshStoreLive(u.id).catch(() => {});
  await notify(u.id, '🚫', `The Trothen team has stopped you selling in the Market${ban.until ? ' until ' + new Date(ban.until).toDateString() : ''}: ${ban.reason} Orders already paid for carry on as normal. If you think this is a mistake, contact support.`, 'bookingUpdates', { section: 'market' });
  await log(req, 'market_seller_stop', `${u.id}: ${ban.until ? d + ' days' : 'until lifted'} - ${ban.reason}`);
  res.json({ ok: true, hidden, until: ban.until });
});
router.post('/admin/market/sellers/:id/lift', team, async (req, res) => {
  const u = await db.find('users', x => x.id === req.params.id);
  if (!u || !req.covers(u)) return res.status(404).json({ error: 'Seller not found' });
  if (!u.marketBan) return res.status(400).json({ error: 'This seller isn\'t stopped.' });
  const patch = { marketBan: null };
  if (u.store && u.store.closedByMarketStop) patch.store = { ...u.store, closedByAdmin: false, closedReason: null, closedByMarketStop: false };
  await db.update('users', u.id, patch);
  let back = 0;
  for (const l of await db.filter('marketListings', x => x.sellerId === u.id && x.status === 'hidden' && x.hiddenByStop)) {
    const expired = l.expiresAt && Date.parse(l.expiresAt) < Date.now();
    await db.update('marketListings', l.id, { status: expired ? 'hidden' : 'live', hiddenByStop: false }); if (!expired) back += 1;
  }
  await notify(u.id, '✅', `You can sell in the Market again.${back ? ` ${back} of your listings ${back === 1 ? 'is' : 'are'} back on sale.` : ''}${patch.store ? ' Switch your store back on in My Store.' : ''}`, 'bookingUpdates', { section: 'market' });
  await log(req, 'market_seller_lift', u.id);
  res.json({ ok: true, back });
});

// ── orders: every store and Market order ──────────────────────────────
router.get('/admin/market/orders', team, async (req, res) => {
  const want = ['open', 'problems', 'completed', 'cancelled', 'all'].includes(req.query.show) ? req.query.show : 'open';
  const ws = words(req.query.q);
  const disputes = await db.all('disputes');
  const dispByContract = new Map(disputes.map(d => [d.contractId, d]));
  const all = (await db.filter('contracts', isMarketOrder)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const out = [];
  for (const c of all) {
    const dsp = dispByContract.get(c.id);
    const problem = (dsp && dsp.status !== 'resolved') || (c.returnRequest && !['refunded', 'declined_final'].includes(c.returnRequest.status));
    if (want === 'open' && !['awaiting_payment', 'pending_provider_confirmation', 'active'].includes(c.status)) continue;
    if (want === 'problems' && !problem) continue;
    if (want === 'completed' && c.status !== 'completed') continue;
    if (want === 'cancelled' && !['cancelled', 'declined', 'expired', 'refunded'].includes(c.status)) continue;
    const seller = await db.find('users', u => u.id === c.providerId);
    if (!seller || !req.covers(seller)) continue;
    const buyer = await db.find('users', u => u.id === c.customerId);
    if (!hits(`${c.bookingNumber || ''} ${c.id} ${seller.name} ${(seller.store && seller.store.name) || ''} ${buyer ? buyer.name : ''} ${(c.storeItems || []).map(i => i.name).join(' ')}`, ws)) continue;
    out.push({
      id: c.id, number: c.bookingNumber || c.id, status: c.status, createdAt: c.createdAt, completedAt: c.completedAt || null,
      kind: c.marketListingId ? 'person' : c.storeOrder ? 'store' : 'with a job',
      items: (c.storeItems || []).map(i => `${i.qty} × ${i.name}`).join(', ').slice(0, 200),
      goodsTotal: money(c.storeGoodsTotal || 0), amount: money(c.amount || 0), delivery: c.deliveryMethod || null,
      seller: { id: seller.id, name: (seller.store && seller.store.name) || seller.name }, buyer: buyer ? { id: buyer.id, name: buyer.name } : null,
      dispute: dsp ? { id: dsp.id, status: dsp.status } : null, returnStatus: c.returnRequest ? c.returnRequest.status : null,
    });
    if (out.length >= 100) break;
  }
  res.json({ orders: out, show: want });
});

// ── stolen-goods reports ──────────────────────────────────────────────
router.get('/admin/market/stolen', team, async (req, res) => {
  const want = req.query.show === 'all' ? 'all' : 'open';
  const rows = (await db.filter('stolenReports', r => want === 'all' || r.status === 'open')).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const out = [];
  for (const r of rows) {
    const owner = await db.find('users', u => u.id === r.userId);
    if (!owner || !req.covers(owner)) continue;
    const held = await db.filter('marketListings', l => r.serialHash && l.serialHash === r.serialHash && l.status !== 'deleted');
    out.push({ id: r.id, what: r.what, serialLast4: r.serialLast4, policeReport: r.policeReport || null, status: r.status, country: r.country, createdAt: r.createdAt, closedNote: r.closedNote || null, owner: { id: owner.id, name: owner.name, phone: owner.phone || null }, listings: held.map(l => ({ id: l.id, title: l.title, status: l.status, sellerId: l.sellerId })) });
    if (out.length >= 100) break;
  }
  res.json({ reports: out });
});
router.post('/admin/market/stolen/:id/close', team, async (req, res) => {
  const r = await db.find('stolenReports', x => x.id === req.params.id && x.status === 'open');
  const owner = r && await db.find('users', u => u.id === r.userId);
  if (!r || !owner || !req.covers(owner)) return res.status(404).json({ error: 'Report not found' });
  const note = String((req.body || {}).note || '').trim();
  if (note.length < 5 || note.length > 300) return res.status(400).json({ error: 'Say what was found or done (5 to 300 characters).' });
  await db.update('stolenReports', r.id, { status: 'closed', closedNote: note, closedAt: new Date().toISOString(), closedBy: req.adminUser.id });
  await notify(r.userId, '🔎', `The Trothen team closed your stolen-item report (${r.what}): ${note}`, null, { section: 'market' });
  await log(req, 'market_stolen_close', `${r.id}: ${note}`);
  res.json({ ok: true });
});

// ── what the team did ─────────────────────────────────────────────────
const LOG_TYPES = { market_listing: 'Listing', market_seller_stop: 'Seller stopped', market_seller_lift: 'Seller allowed again', market_stolen_close: 'Stolen report closed', store_decision: 'Store decided', market_good: 'Store good' };
router.get('/admin/market/activity', team, async (req, res) => {
  const rows = (await db.filter('accessLogs', l => LOG_TYPES[l.resourceType])).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 80);
  const names = new Map();
  const out = [];
  for (const l of rows) {
    if (!names.has(l.adminId)) { const a = await db.find('users', u => u.id === l.adminId); names.set(l.adminId, a ? a.name : 'Someone'); }
    out.push({ at: l.createdAt, what: LOG_TYPES[l.resourceType], detail: l.resourceId, by: names.get(l.adminId) });
  }
  res.json({ activity: out });
});

module.exports = router;
module.exports.banOf = banOf;
