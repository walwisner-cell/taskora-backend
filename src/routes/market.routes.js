// v139: the Trothen Market (see src/market.js for the rules in plain words).
//
//   GET    /api/market/items                  browse: store goods + personal listings (public)
//   GET    /api/market/categories
//   GET    /api/market/listings/:id            one personal listing (public)
//   POST   /api/market/photo                  a photo for a listing (any verified user)
//   GET    /api/market/listings/mine
//   POST   /api/market/listings               sell an item
//   PATCH  /api/market/listings/:id            edit
//   POST   /api/market/listings/:id/status     { status: 'live' | 'hidden' | 'sold' } (renew, pause, mark sold)
//   DELETE /api/market/listings/:id
//   POST   /api/market/listings/:id/report
//   GET    /api/market/listings/:id/drivers    drivers for a protected purchase
//   POST   /api/market/listings/:id/buy        buy with Trothen protection
//   POST   /api/store/orders/:id/handed-over   the seller says the buyer has it (starts the countdown)
//   POST   /api/market/orders/:id/review       the buyer rates the seller
//   GET    /api/market/earnings                what a seller has to cash out (customers too)
//   PUT    /api/market/store-categories        a store's Market categories
//   GET    /api/admin/market/listings          the team: listings and reports
//   POST   /api/admin/market/listings/:id/decide
const express = require('express');
const rateLimit = require('express-rate-limit');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { notify } = require('../notify');
const { isNonEmptyString } = require('../validators');
const store = require('../store');
const market = require('../market');
const { money, sameText } = market;

const router = express.Router();
const listLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many searches at once. Please wait a moment.' } });
const writeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many changes in a short time. Please wait a few minutes.' } });
const firstAndInitial = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : (p[0] || 'Member'); };

// Who is looking (optional on public pages).
async function viewer(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { const payload = require('jsonwebtoken').verify(h.slice(7), require('../auth').JWT_SECRET); return await db.find('users', u => u.id === payload.sub); } catch (e) { return null; }
}
const sellerCard = (u) => (u ? {
  id: u.id, name: firstAndInitial(u.name), verified: u.verified === true, rating: u.sellerRating || null, ratingCount: u.sellerRatingCount || 0,
  since: (u.createdAt || '').slice(0, 4), profilePhotoUrl: u.profilePhotoUrl || null, initials: u.initials || null, color: u.color || null,
  isPro: u.role === 'provider', storeName: (u.store && u.store.name) || null,
} : null);

// v140: what buyers are told about a seller, as consumer rules ask (the EU
// Digital Services Act and similar): a business seller (a pro with a store)
// or a private person, how many sales they have completed, and "New seller".
async function sellerInfo(u, cache) {
  if (!u) return null;
  if (cache && cache.has(u.id)) return cache.get(u.id);
  const st = await market.sellerStats(u.id);
  const out = { ...sellerCard(u), sellerType: u.role === 'provider' && u.store && u.store.name ? 'business' : 'private', businessName: (u.role === 'provider' && (u.businessName || (u.store && u.store.name))) || null, sales: st.sales, isNew: st.isNew };
  if (cache) cache.set(u.id, out);
  return out;
}
const isTradeBuyer = (me, sellerId) => !!(me && me.role === 'provider' && me.verified === true && me.id !== sellerId);

async function listingView(l, me, currencies, cache) {
  const seller = await db.find('users', u => u.id === l.sellerId);
  currencies = currencies || await store.currenciesFor(seller || { country: l.country });
  const cur = currencies.find(c => c.code === l.currency) || currencies[0];
  const usd = l.currency === 'USD' ? money(l.price) : store.usdFromLocal(l.price, cur.rate);
  const s = await store.storeSettings();
  return {
    kind: 'listing', id: l.id, title: l.title, description: l.description || '', category: l.category, condition: l.condition, conditionLabel: market.CONDITIONS[l.condition] || '',
    price: usd, localPrice: l.currency !== 'USD' ? { amount: l.price, code: cur.code, symbol: cur.symbol } : null,
    photoUrls: l.photoUrls || [], city: l.city || '', country: l.country || '', pickupPlace: l.pickupPlace || '', hasPin: !!l.pickupLocation,
    protected: l.protected !== false, cash: l.cash !== false, driver: l.driver !== false,
    serialLast4: l.serialLast4 || null, isPart: l.isPart === true, proofGiven: !!l.proofUrl, ownerDeclared: !!l.ownerAttestedAt, // v143
    protectionFee: l.protected !== false ? store.protectionFeeFor(usd, s) : 0,
    status: l.status, createdAt: l.createdAt, expiresAt: l.expiresAt || null,
    seller: await sellerInfo(seller, cache), mine: !!(me && me.id === l.sellerId),
    ...(me && me.id === l.sellerId ? { proofUrl: l.proofUrl || null, reports: (l.reports || []).length, views: l.views || 0, price_raw: l.price, currency: l.currency, pickupLocation: l.pickupLocation || null, removedReason: l.removedReason || null } : {}),
  };
}

// ── browse ─────────────────────────────────────────────────────────────
router.get('/market/categories', (req, res) => res.json({ categories: market.MARKET_CATEGORIES, conditions: market.CONDITIONS }));

router.get('/market/items', listLimiter, async (req, res) => {
  const me = await viewer(req);
  const country = String(req.query.country || (me && me.country) || '').trim();
  const q = String(req.query.q || '').trim().toLowerCase().slice(0, 80);
  const words = q.split(/\s+/).filter(w => w.length > 1);
  const category = market.MARKET_CATEGORIES.includes(req.query.category) ? req.query.category : null;
  const type = ['stores', 'people'].includes(req.query.type) ? req.query.type : 'all';
  const sort = ['newest', 'price_asc', 'price_desc', 'rating'].includes(req.query.sort) ? req.query.sort : 'newest';
  const matches = (text) => !words.length || words.every(w => String(text).toLowerCase().includes(w));
  const items = [];
  const cache = new Map();
  const settings = await store.storeSettings();
  if (type !== 'people' && settings.enabled) {
    const sellers = await db.filter('users', u => u.role === 'provider' && u.store && store.storeIsLive(u) && (!country || sameText(u.country, country)));
    for (const sel of sellers) {
      const cats = Array.isArray(sel.store.marketCategories) && sel.store.marketCategories.length ? sel.store.marketCategories : ['Other'];
      if (category && !cats.includes(category)) continue;
      const currencies = await store.currenciesFor(sel);
      for (const g of await db.filter('storeGoods', x => x.providerId === sel.id)) {
        if (!store.isOnShelf(g) || !store.inStock(g, 1)) continue;
        if (!matches(`${g.name} ${g.description || ''} ${sel.store.name} ${cats.join(' ')}`)) continue;
        const pf = store.goodPriceFields(g, currencies);
        items.push({
          kind: 'store', id: g.id, title: g.name, description: (g.description || '').slice(0, 140), category: cats[0], price: store.goodUsdPrice(g, currencies),
          localPrice: pf.priceCurrency && pf.priceCurrency !== 'USD' ? { amount: pf.priceLocal, code: pf.priceCurrency, symbol: pf.priceSymbol || '' } : null,
          unit: g.unit || '', photo: (g.photoUrls || [])[0] || null, city: sel.city || '', country: sel.country || '',
          providerId: sel.id, storeName: sel.store.name, seller: await sellerInfo(sel, cache), createdAt: g.updatedAt || g.createdAt,
          ...(isTradeBuyer(me, sel.id) && Number(g.tradePrice) > 0 && Number(g.tradePrice) < store.goodUsdPrice(g, currencies) ? { tradePrice: money(g.tradePrice) } : {}), // v140
        });
      }
    }
  }
  if (type !== 'stores') {
    const listings = await db.filter('marketListings', l => l.status === 'live' && (!country || sameText(l.country, country)) && (!category || l.category === category));
    const curCache = new Map();
    for (const l of listings) {
      if (!matches(`${l.title} ${l.description || ''} ${l.category}`)) continue;
      const seller = await db.find('users', u => u.id === l.sellerId);
      if (!seller || seller.active === false || seller.closedAt) continue;
      if (!curCache.has(l.country)) curCache.set(l.country, await store.currenciesFor(seller));
      const v = await listingView(l, me, curCache.get(l.country), cache);
      items.push({ ...v, description: v.description.slice(0, 140), photo: v.photoUrls[0] || null });
    }
  }
  const by = {
    newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    rating: (a, b) => ((b.seller && b.seller.rating) || 0) - ((a.seller && a.seller.rating) || 0) || String(b.createdAt).localeCompare(String(a.createdAt)),
  }[sort];
  items.sort(by);
  const page = Math.max(1, Number(req.query.page) || 1), per = 40;
  res.set('Cache-Control', 'no-store');
  res.json({ items: items.slice((page - 1) * per, page * per), total: items.length, page, perPage: per, country: country || null });
});

router.get('/market/listings/mine', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const mine = (await db.filter('marketListings', l => l.sellerId === me.id && l.status !== 'deleted')).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const currencies = await store.currenciesFor(me);
  res.json({ listings: await Promise.all(mine.map(l => listingView(l, me, currencies))), limit: market.MAX_LIVE_LISTINGS, currencies: currencies.map(c => ({ code: c.code, symbol: c.symbol, name: c.name })) });
});

router.get('/market/listings/:id', listLimiter, async (req, res) => {
  const me = await viewer(req);
  const l = await db.find('marketListings', x => x.id === req.params.id && x.status !== 'deleted');
  if (!l || (!['live', 'reserved', 'sold'].includes(l.status) && !(me && me.id === l.sellerId))) return res.status(404).json({ error: 'This item is no longer listed.' });
  if (!(me && me.id === l.sellerId)) db.update('marketListings', l.id, { views: (l.views || 0) + 1 }).catch(() => {});
  res.json({ listing: await listingView(l, me) });
});

// ── selling ────────────────────────────────────────────────────────────
async function verifiedSeller(req, res) {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me || !['customer', 'provider'].includes(me.role)) { res.status(403).json({ error: 'Selling is for customer and pro accounts' }); return null; }
  if (me.verified !== true) { res.status(403).json({ code: 'VERIFY_IDENTITY', error: 'To sell in the Market, verify your identity first (Verification in your menu). Buyers only see sellers Trothen has checked.' }); return null; }
  if (me.onHold || me.active === false) { res.status(403).json({ error: 'Your account is paused, so you can\'t sell right now.' }); return null; }
  return me;
}
router.post('/market/photo', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedSeller(req, res); if (!me) return;
  const sr = require('./store.routes');
  sr.handlePhotoUpload(marketUploader, req, res);
});
let marketUploader = null;
setImmediate(() => { marketUploader = require('./store.routes').photoUploader('market'); });

async function readListing(b, me, existing) {
  b = b || {};
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  if (!existing || has('title')) {
    if (!isNonEmptyString(b.title, { min: 3, max: 80 })) return { error: 'Give the item a title of 3 to 80 characters' };
    out.title = b.title.trim();
  }
  if (!existing || has('description')) {
    if (b.description && !isNonEmptyString(b.description, { max: 1000 })) return { error: 'The description must be under 1,000 characters' };
    out.description = b.description ? String(b.description).trim() : '';
  }
  if (!existing || has('category')) {
    if (!market.MARKET_CATEGORIES.includes(b.category)) return { error: 'Choose a category' };
    out.category = b.category;
  }
  if (!existing || has('condition')) {
    if (!market.CONDITIONS[b.condition]) return { error: 'Choose the condition: new, like new, good or fair' };
    out.condition = b.condition;
  }
  if (!existing || has('price') || has('currency')) {
    const currencies = await store.currenciesFor(me);
    const code = has('currency') ? b.currency : (existing ? existing.currency : 'USD');
    if (!currencies.some(c => c.code === code)) return { error: `The price can be in ${currencies.map(c => c.code).join(' or ')}` };
    const price = Number(has('price') ? b.price : existing.price);
    const cur = currencies.find(c => c.code === code);
    const usd = code === 'USD' ? price : store.usdFromLocal(price, cur.rate);
    if (!Number.isFinite(price) || price <= 0 || usd < 0.5 || usd > 50000) return { error: 'Enter a price between $0.50 and $50,000 (or the same in your local money)' };
    out.price = money(price); out.currency = code; out.priceUsd = money(usd); // v140: kept for the "too cheap to be true" check
  }
  if (!existing || has('photoUrls')) {
    const list = Array.isArray(b.photoUrls) ? b.photoUrls.filter(u => typeof u === 'string' && /^\/uploads\/market_[A-Za-z0-9_-]+\.(jpe?g|png|webp|gif)$/i.test(u)) : [];
    if (!list.length) return { error: 'Add at least one photo of the item' };
    if (list.length > market.MAX_PHOTOS) return { error: `Up to ${market.MAX_PHOTOS} photos` };
    if (list.some(u => !u.includes(`market_${me.id}_`))) return { error: 'Use photos you uploaded yourself' };
    out.photoUrls = list;
  }
  if (!existing || has('pickupPlace')) {
    if (b.pickupPlace && !isNonEmptyString(b.pickupPlace, { max: 120 })) return { error: 'The pick-up area must be under 120 characters' };
    out.pickupPlace = b.pickupPlace ? String(b.pickupPlace).trim() : '';
  }
  if (has('pickupLocation')) {
    const { isValidCoordinate } = require('../geo-distance');
    const p = b.pickupLocation;
    out.pickupLocation = p && isValidCoordinate(p.latitude, p.longitude) && !(p.latitude === 0 && p.longitude === 0) ? { latitude: Math.round(p.latitude * 1e6) / 1e6, longitude: Math.round(p.longitude * 1e6) / 1e6 } : null;
  }
  for (const k of ['protected', 'cash', 'driver']) if (!existing || has(k)) out[k] = has(k) ? b[k] !== false : true;
  if (out.protected === false && out.cash === false) return { error: 'Allow at least one way to buy: through Trothen, or in person with cash' };
  const why = await require('./store.routes').bannedReason(out.title || (existing && existing.title), out.description);
  if (why) return { error: `This can't be sold on Trothen (${why}).` };
  // v143: ownership, IMEI / serial numbers and proof of ownership (src/stolen-goods.js)
  const own = require('../stolen-goods').readOwnership(b, existing, out.category, out.priceUsd !== undefined ? out.priceUsd : existing && existing.priceUsd, me.id);
  if (own.error) return { error: own.error };
  Object.assign(out, own.out);
  return { out };
}

// v140: a fingerprint of each photo (SHA-256 of the file), so the same photo
// used by two different sellers (a common scam: stolen photos) is noticed.
function photoHashes(urls) {
  const { UPLOADS_DIR } = require('../uploads');
  const fs = require('fs'), path = require('path'), crypto = require('crypto');
  return (urls || []).map(u => { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(UPLOADS_DIR, path.basename(String(u))))).digest('hex'); } catch (e) { return null; } });
}
async function rememberPhotoHashes(hashes, userId, listingId) {
  for (const hash of (hashes || []).filter(Boolean)) {
    if (!(await db.find('marketPhotoHashes', h => h.hash === hash && h.userId === userId))) await db.insert('marketPhotoHashes', { id: `mph_${nanoid(10)}`, hash, userId, listingId, createdAt: new Date().toISOString() });
  }
}
// v143: a listing whose number is registered as stolen: a high-priority flag for the team.
async function stolenAlert(listing, seller) {
  try { await require('../fraud-detection').createFlag({ type: 'stolen_item_listed', severity: 'high', userId: seller.id, details: `"${listing.title}" by ${seller.name} (${seller.phone || 'no phone'}) has a number (ending ${listing.serialLast4}) registered as stolen. The listing is held. Do not tell the seller why; contact the person who registered it and, if they wish, the police.` }); } catch (e) { /* the hold stands */ }
  const supers = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin && u.active !== false);
  for (const a of supers) await notify(a.id, '🚨', `A Market listing matches an item registered as STOLEN: "${listing.title}". It is held. Fraud & Safety has the details.`, null, { section: 'fraud' });
}
async function sendForReview(listing, seller, reasons) {
  try { await require('../fraud-detection').createFlag({ type: 'market_listing_risk', severity: 'medium', userId: seller.id, details: `Market listing "${listing.title}" by ${seller.name} held for review: ${reasons.join('; ')}` }); } catch (e) { /* the hold still stands */ }
  await notify(seller.id, '🔎', `"${listing.title}" is being checked by the Trothen team before it goes on sale, usually within a day. This is a routine safety check.`, 'bookingUpdates', { section: 'market' });
  const managers = await require('../admin-scope').regionalAdminsFor({ city: listing.city, country: listing.country });
  for (const a of managers) await notify(a.id, '🔎', `A Market listing needs checking before it goes on sale: "${listing.title}". Stores & Skills → Market listings.`, null, { section: 'stores' });
}

router.post('/market/listings', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedSeller(req, res); if (!me) return;
  const live = await db.filter('marketListings', l => l.sellerId === me.id && ['live', 'reserved', 'hidden'].includes(l.status));
  if (live.length >= market.MAX_LIVE_LISTINGS) return res.status(400).json({ error: `You can have up to ${market.MAX_LIVE_LISTINGS} items for sale at once. Mark sold items as sold, or remove some.` });
  const r = await readListing(req.body, me, null);
  if (r.error) return res.status(400).json({ error: r.error });
  const now = new Date();
  const listing = { id: `ml_${nanoid(10)}`, sellerId: me.id, ...r.out, city: me.city || '', country: me.country || '', status: 'live', reports: [], views: 0, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + market.LISTING_DAYS * market.DAY).toISOString() };
  listing.photoHashes = photoHashes(listing.photoUrls);
  // v140: signs of a scam listing send it to the team before it goes live.
  const risk = [...await market.listingRisk(listing, me, listing.priceUsd), ...await require('../stolen-goods').stolenRisk(listing, me)]; // v143: stolen-goods checks too
  if (risk.length) { listing.status = 'review'; listing.reviewReasons = risk; }
  await db.insert('marketListings', listing);
  if (risk.some(x => /STOLEN/.test(x))) await stolenAlert(listing, me);
  await rememberPhotoHashes(listing.photoHashes, me.id, listing.id);
  if (risk.length) await sendForReview(listing, me, risk);
  res.status(201).json({ listing: await listingView(listing, me), review: risk.length > 0 });
});

router.patch('/market/listings/:id', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedSeller(req, res); if (!me) return;
  const l = await db.find('marketListings', x => x.id === req.params.id && x.sellerId === me.id && x.status !== 'deleted');
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  if (['reserved', 'sold'].includes(l.status)) return res.status(400).json({ error: l.status === 'reserved' ? 'Someone is buying this right now, so it can\'t be changed.' : 'This item is sold.' });
  if (l.status === 'removed') return res.status(400).json({ error: 'The Trothen team took this listing down, so it can\'t be changed. Contact support if you think that was a mistake.' });
  const r = await readListing(req.body, me, l);
  if (r.error) return res.status(400).json({ error: r.error });
  if (r.out.photoUrls) r.out.photoHashes = photoHashes(r.out.photoUrls);
  let updated = await db.update('marketListings', l.id, r.out);
  if (r.out.photoHashes) await rememberPhotoHashes(r.out.photoHashes, me.id, l.id);
  // v140: a changed price or photos is checked again.
  if ((r.out.priceUsd !== undefined || r.out.photoUrls || r.out.serialHash !== undefined) && updated.status === 'live') {
    const risk = [...await market.listingRisk(updated, me, updated.priceUsd), ...await require('../stolen-goods').stolenRisk(updated, me)];
    if (risk.length) { updated = await db.update('marketListings', l.id, { status: 'review', reviewReasons: risk }); await sendForReview(updated, me, risk); if (risk.some(x => /STOLEN/.test(x))) await stolenAlert(updated, me); }
  }
  res.json({ listing: await listingView(updated, me) });
});

router.post('/market/listings/:id/status', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedSeller(req, res); if (!me) return;
  const l = await db.find('marketListings', x => x.id === req.params.id && x.sellerId === me.id && x.status !== 'deleted');
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  const want = (req.body || {}).status;
  if (!['live', 'hidden', 'sold'].includes(want)) return res.status(400).json({ error: 'Choose: put on sale, pause, or mark sold' });
  if (l.status === 'reserved') return res.status(400).json({ error: 'Someone is buying this through Trothen. It is marked sold by itself when they have it.' });
  if (l.status === 'removed') return res.status(400).json({ error: 'The Trothen team took this listing down.' });
  if (l.status === 'review') return res.status(400).json({ error: 'The Trothen team is checking this listing. It goes on sale once they have.' });
  if (l.status === 'hidden' && (l.reports || []).length >= market.REPORTS_TO_HIDE && want === 'live') return res.status(400).json({ error: 'This listing was reported and is waiting for the Trothen team to look at it.' });
  const patch = { status: want };
  if (want === 'live') {
    const live = await db.filter('marketListings', x => x.sellerId === me.id && x.id !== l.id && ['live', 'reserved', 'hidden'].includes(x.status));
    if (live.length >= market.MAX_LIVE_LISTINGS) return res.status(400).json({ error: `You can have up to ${market.MAX_LIVE_LISTINGS} items for sale at once.` });
    patch.expiresAt = new Date(Date.now() + market.LISTING_DAYS * market.DAY).toISOString(); // renewing starts a new 60 days
  }
  if (want === 'sold') patch.soldAt = new Date().toISOString();
  const updated = await db.update('marketListings', l.id, patch);
  res.json({ listing: await listingView(updated, me) });
});

router.delete('/market/listings/:id', requireAuth, async (req, res) => {
  const l = await db.find('marketListings', x => x.id === req.params.id && x.sellerId === req.user.sub && x.status !== 'deleted');
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  if (l.status === 'reserved') return res.status(400).json({ error: 'Someone is buying this through Trothen, so it can\'t be removed now.' });
  await db.update('marketListings', l.id, { status: 'deleted', deletedAt: new Date().toISOString() });
  res.json({ ok: true });
});

router.post('/market/listings/:id/report', requireAuth, writeLimiter, async (req, res) => {
  const l = await db.find('marketListings', x => x.id === req.params.id && ['live', 'hidden'].includes(x.status));
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  if (l.sellerId === req.user.sub) return res.status(400).json({ error: 'You can\'t report your own listing.' });
  const reason = String((req.body || {}).reason || '').trim();
  if (reason.length < 5 || reason.length > 300) return res.status(400).json({ error: 'Say what is wrong in a few words (up to 300 characters).' });
  const reports = (l.reports || []).filter(r => r.byId !== req.user.sub).concat([{ byId: req.user.sub, reason, at: new Date().toISOString() }]);
  const hide = reports.length >= market.REPORTS_TO_HIDE && l.status === 'live';
  await db.update('marketListings', l.id, { reports, ...(hide ? { status: 'hidden', hiddenByReports: true } : {}) });
  if (hide) {
    await notify(l.sellerId, '⚠️', `Your listing "${l.title}" was reported by several people and is hidden while the Trothen team looks at it.`, 'bookingUpdates', { section: 'market' });
    const supers = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin && u.active !== false);
    const managers = await require('../admin-scope').regionalAdminsFor({ city: l.city, country: l.country });
    const seen = new Set();
    for (const a of [...managers, ...supers]) { if (seen.has(a.id)) continue; seen.add(a.id); await notify(a.id, '🚩', `A Market listing was reported ${reports.length} times and hidden: "${l.title}". Review it in Stores & Skills → Market listings.`, null, { section: 'stores' }); }
  }
  res.json({ ok: true, hidden: hide });
});

// ── buying with Trothen protection ─────────────────────────────────────
router.get('/market/listings/:id/drivers', requireAuth, listLimiter, async (req, res) => {
  const l = await db.find('marketListings', x => x.id === req.params.id && x.status === 'live');
  if (!l || l.driver === false || l.protected === false) return res.json({ drivers: [], distanceKm: null, totalFound: 0, notOffered: true });
  const seller = await db.find('users', u => u.id === l.sellerId);
  const lat = Number(req.query.latitude), lng = Number(req.query.longitude);
  const { isValidCoordinate } = require('../geo-distance');
  const dropoff = (req.query.latitude !== undefined && isValidCoordinate(lat, lng) && !(lat === 0 && lng === 0)) ? { latitude: lat, longitude: lng } : null;
  const so = require('../store-orders');
  const out = await so.suggestDrivers({ seller, dropoff, customerId: req.user.sub, pickup: l.pickupLocation || null });
  const s = await store.storeSettings();
  res.json({ ...out, feePercent: s.deliveryFeePercent, storeHasPin: !!l.pickupLocation, answerMinutes: so.DELIVERY_RESPONSE_MINUTES });
});

const buying = new Set();
router.post('/market/listings/:id/buy', requireAuth, require('../terms').requireCurrentTerms, async (req, res) => {
  if (!['customer', 'provider'].includes(req.user.role)) return res.status(403).json({ error: 'Buying is for customer and pro accounts' });
  const orders = require('./orders.routes');
  const buyer = await orders.customerCanBuy(req, res); if (!buyer) return;
  if (buying.has(req.params.id)) return res.status(409).json({ error: 'Someone is buying this right now. Try again in a moment.' });
  buying.add(req.params.id);
  try {
    const l = await db.find('marketListings', x => x.id === req.params.id);
    if (!l || l.status !== 'live') return res.status(409).json({ code: 'GONE', error: l && l.status === 'reserved' ? 'Someone else is buying this right now.' : 'This item is no longer for sale.' });
    if (l.sellerId === buyer.id) return res.status(400).json({ error: 'This is your own item.' });
    if (l.protected === false) return res.status(400).json({ error: 'This seller only sells in person. Message them to arrange it.' });
    const seller = await db.find('users', u => u.id === l.sellerId);
    if (!seller || seller.active === false || seller.onHold || seller.closedAt) return res.status(409).json({ error: 'This seller can\'t sell right now.' });
    // v140: buying from a second account of your own (same phone) is how fake
    // sales and fake ratings are made.
    const digits = (p) => String(p || '').replace(/\D/g, '').slice(-9);
    if (digits(buyer.phone).length >= 7 && digits(buyer.phone) === digits(seller.phone)) {
      try { await require('../fraud-detection').createFlag({ type: 'market_self_dealing', severity: 'medium', userId: buyer.id, relatedUserId: seller.id, details: `${buyer.name} tried to buy "${l.title}" from ${seller.name}; both accounts have the same phone number` }); } catch (e) {}
      return res.status(403).json({ code: 'SAME_PERSON', error: 'This seller\'s account shares your phone number, so this purchase can\'t go through Trothen.' });
    }
    const b = req.body || {};
    const method = b.deliveryMethod === 'driver' ? 'driver' : 'pickup';
    if (method === 'driver' && l.driver === false) return res.status(400).json({ error: 'This seller doesn\'t offer delivery by a driver. Collect it instead.' });
    const so = require('../store-orders');
    let where = null, driver = null;
    if (method === 'driver') {
      where = orders.readDropoff(b);
      if (where.error) return res.status(400).json({ error: where.error });
      driver = await db.find('users', u => u.id === b.driverId);
      if (!driver || !so.isDriver(driver) || driver.id === seller.id || driver.id === buyer.id || !sameText(driver.country, seller.country)) return res.status(400).json({ code: 'PICK_DRIVER', error: 'Choose a driver from the list. The one you picked isn\'t available any more.' });
      if (b.driverPrice === undefined) return res.status(400).json({ error: 'Approve the driver\'s price first.' });
    }
    if (b.note !== undefined && b.note !== null && b.note !== '' && !isNonEmptyString(b.note, { max: 300 })) return res.status(400).json({ error: 'The note to the seller must be under 300 characters' });
    const view = await listingView(l, buyer);
    if (b.expectedPrice !== undefined && Math.abs(Number(b.expectedPrice) - view.price) > 0.009) return res.status(409).json({ code: 'PRICE_CHANGED', price: view.price, error: `The price is now $${view.price.toFixed(2)}. Check it and buy again.` });
    const { generateBookingNumber, fundEscrowForContract } = require('./marketplace.routes');
    const s = await store.storeSettings();
    const price = view.price;
    const pickupPlace = l.pickupPlace || [l.city, l.country].filter(Boolean).join(', ');
    const order = {
      id: `ct_${nanoid(10)}`, bookingNumber: await generateBookingNumber(),
      customerId: buyer.id, providerId: seller.id,
      service: `Market: ${l.title}`.slice(0, 200), date: new Date().toISOString().slice(0, 10), time: 'Market order',
      address: method === 'pickup' ? `Collect from ${firstAndInitial(seller.name)}: ${pickupPlace}`.slice(0, 200) : where.address,
      jobLocation: where ? (where.jobLocation || null) : null, landmark: where ? (where.landmark || null) : null,
      amount: price,
      // The buyer's protection fee is Trothen's; the seller gets their full price.
      serviceFee: store.protectionFeeFor(price, s),
      laborAmount: 0,
      storeItems: [{ goodId: null, listingId: l.id, name: l.title, qty: 1, price, lineTotal: price }], storeGoodsTotal: price, storeFee: 0, storeFeePaidBy: 'pro',
      goodsOnly: true, storeOrder: true, materialsCost: price, storeStockHeld: false,
      marketListingId: l.id, listingTitle: l.title, listingPhoto: (l.photoUrls || [])[0] || null,
      newSellerReserve: (await market.sellerStats(seller.id)).sales < market.NEW_SELLER_SALES, // v140: payout waits 3 days after completion
      deliveryMethod: method, sellerDeliveryFee: 0, pickupPlace, pickupLocation: l.pickupLocation || null,
      orderNote: b.note ? String(b.note).trim() : null,
      loyaltyPointsRedeemed: 0, materialsAdvance: 0, materialsOnHand: null, photoUrls: [],
      status: 'active', signedAt: new Date().toISOString().slice(0, 10), providerResponseDeadline: null,
      payCurrency: b.payCurrency === 'local' ? 'local' : 'usd',
      createdAt: new Date().toISOString(),
    };
    if (driver) {
      // Checked before anything is charged, so a changed driver price never leaves a half-made order.
      const km = so.kmBetween(l.pickupLocation || null, where.jobLocation);
      const quoted = await so.deliveryPrice(driver, km); // v143
      if (Math.abs(Number(b.driverPrice) - quoted) > 0.009) return res.status(409).json({ code: 'PRICE_CHANGED', price: quoted, error: `${driver.name}'s price is now $${quoted.toFixed(2)}. Check it and approve again.` });
    }
    try {
      await fundEscrowForContract(order, buyer.id, order.payCurrency);
      await db.insert('contracts', order);
    } catch (e) {
      console.error('[market buy] payment or save failed:', e.message);
      return res.status(402).json({ code: 'PAYMENT_FAILED', error: 'Your payment could not be completed, so you were not charged. Please try again or use another payment method.' });
    }
    await db.update('marketListings', l.id, { status: 'reserved', reservedForOrderId: order.id });
    try { await require('../fraud-detection').checkNewAccountHighValue(buyer.id, price); } catch (e) { /* the order stands */ }
    if (driver) await orders.createDelivery({ order, seller, driver, where, payCurrency: order.payCurrency });
    const how = method === 'pickup' ? `${firstAndInitial(buyer.name)} will collect it from ${pickupPlace}. Agree a time in Messages.` : `A driver (${driver.name}) has been asked to collect it from you.`;
    await notify(seller.id, '🏷️', `Sold through Trothen: "${l.title}" for $${price.toFixed(2)}. ${how} The money is held and is yours when the buyer has the item.`, 'bookingUpdates', { section: 'market' });
    const fresh = await db.find('contracts', c => c.id === order.id);
    res.status(201).json({ order: await orders.orderView(fresh, buyer.id) });
  } finally { buying.delete(req.params.id); }
});

// The seller hands it over (collected, or brought by them): the countdown starts.
router.post('/store/orders/:id/handed-over', requireAuth, async (req, res) => {
  const order = await db.find('contracts', c => c.id === req.params.id && c.providerId === req.user.sub && c.storeOrder === true);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'active') return res.status(400).json({ error: `This order is ${String(order.status).replace(/_/g, ' ')}.` });
  if ((order.deliveryMethod || 'pickup') === 'driver') return res.status(400).json({ error: 'The driver records the hand-over for this order.' });
  if (order.handedOverAt) return res.json({ ok: true, handedOverAt: order.handedOverAt });
  const updated = await db.update('contracts', order.id, { handedOverAt: new Date().toISOString(), readyAt: order.readyAt || new Date().toISOString() });
  const at = await market.autoCompleteAt(updated);
  await notify(order.customerId, '📦', `The seller says you have order #${order.bookingNumber}. If all is well, press "I have my goods". If something is wrong, report a problem before ${new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}; after that the order completes by itself and the seller is paid.`, 'bookingUpdates', { section: 'market' });
  res.json({ ok: true, handedOverAt: updated.handedOverAt, autoCompleteAt: at });
});

// The buyer rates the seller, once, after the order is complete.
router.post('/market/orders/:id/review', requireAuth, writeLimiter, async (req, res) => {
  const order = await db.find('contracts', c => c.id === req.params.id && c.customerId === req.user.sub && c.storeOrder === true);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'completed') return res.status(400).json({ error: 'You can rate the seller once the order is complete.' });
  if (await db.find('marketReviews', r => r.orderId === order.id)) return res.status(409).json({ error: 'You already rated this order.' });
  const stars = Number((req.body || {}).stars), text = String((req.body || {}).text || '').trim();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: 'Choose 1 to 5 stars' });
  if (text.length > 500) return res.status(400).json({ error: 'Keep the review under 500 characters' });
  const me = await db.find('users', u => u.id === req.user.sub);
  const review = { id: `mr_${nanoid(10)}`, orderId: order.id, sellerId: order.providerId, buyerId: me.id, buyerName: firstAndInitial(me.name), stars, text, listingId: order.marketListingId || null, createdAt: new Date().toISOString() };
  await db.insert('marketReviews', review);
  const r = await market.refreshSellerRating(order.providerId);
  await notify(order.providerId, '⭐', `New ${stars}-star rating for order #${order.bookingNumber}${text ? `: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"` : ''}. Your seller rating is ${r.avg} from ${r.count} order${r.count === 1 ? '' : 's'}.`, null, { section: 'market' });
  res.status(201).json({ review, sellerRating: r });
});

router.get('/sellers/:id/reviews', listLimiter, async (req, res) => {
  const u = await db.find('users', x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Seller not found' });
  const list = (await db.filter('marketReviews', r => r.sellerId === u.id)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30);
  res.json({ seller: sellerCard(u), reviews: list.map(r => ({ stars: r.stars, text: r.text, buyerName: r.buyerName, createdAt: r.createdAt })) });
});

// What a seller has earned in the Market and can cash out (customers and pros).
router.get('/market/earnings', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const { previewPayout } = require('../commission-statement');
  const p = await previewPayout(me);
  const held = (await db.filter('contracts', c => c.providerId === me.id && c.storeOrder === true && ['active', 'disputed'].includes(c.status))).reduce((s, c) => s + (c.amount || 0), 0);
  // v140: a new seller's personal sales wait 3 days after completing
  const now = Date.now();
  const ex = require('../store-extras'); // v143: store orders also wait out their return window
  const untilOf = (c) => Math.max(c.newSellerReserve && c.completedAt ? Date.parse(c.completedAt) + 3 * market.DAY : 0, ex.returnUntil(c) ? Date.parse(ex.returnUntil(c)) : 0);
  const reservedList = (await db.filter('contracts', c => c.providerId === me.id && c.status === 'completed' && c.completedAt && ((c.newSellerReserve && now - Date.parse(c.completedAt) < 3 * market.DAY) || ex.returnHold(c))));
  const reserved = { amount: money(reservedList.reduce((s, c) => s + (c.amount || 0), 0)), until: reservedList.length ? new Date(Math.max(...reservedList.map(untilOf))).toISOString() : null };
  const payouts = (await db.filter('payouts', x => x.providerId === me.id)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
  res.json({ available: p.summary || null, net: p.summary ? p.summary.net : 0, held: money(held), reserved, payoutMethod: me.payoutMethod || null, payoutPaypalEmail: me.payoutPaypalEmail || null,
    // v141: the ways this person can be paid in their country, and what they saved (last 4 digits only)
    payoutOptions: (() => { const pm = require('../payout-methods'); return { methods: pm.methodsFor(me.country), networks: pm.networksFor(me.country), mobile: pm.publicMobile(me.payoutMobile), bank: pm.publicBank(me.payoutBank) }; })(),
    payouts: payouts.map(x => ({ id: x.id, date: x.date, amount: x.amount, status: x.status, method: x.method })) });
});

// A store's Market categories (up to three), so its goods show in the right aisle.
router.put('/market/store-categories', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me.store || !me.store.name) return res.status(400).json({ error: 'Open your store first (My Store).' });
  const cats = Array.isArray((req.body || {}).categories) ? [...new Set(req.body.categories)].filter(c => market.MARKET_CATEGORIES.includes(c)).slice(0, 3) : [];
  if (!cats.length) return res.status(400).json({ error: 'Choose one to three Market categories for your store' });
  await db.update('users', me.id, { store: { ...me.store, marketCategories: cats } });
  res.json({ categories: cats });
});

// v140: "Materials for this job": goods from nearby stores in the aisles
// that go with the job's kind of work. The pro on the job's own store first.
router.get('/market/suggest', listLimiter, async (req, res) => {
  const me = await viewer(req);
  let category = String(req.query.category || '').slice(0, 80), country = String(req.query.country || (me && me.country) || '');
  let preferId = typeof req.query.providerId === 'string' ? req.query.providerId : null;
  if (req.query.jobId && me) {
    const job = await db.find('jobs', j => j.id === req.query.jobId && j.customerId === me.id);
    if (job) {
      category = job.category || category; country = job.country || country;
      const hired = await db.find('contracts', c => c.jobId === job.id && !['cancelled', 'declined', 'refunded'].includes(c.status));
      if (hired) preferId = hired.providerId;
    }
  }
  const aisles = market.marketAislesFor(category);
  if (!aisles.length || !(await store.storeSettings()).enabled) return res.json({ aisles, items: [] });
  const sellers = await db.filter('users', u => u.role === 'provider' && u.store && store.storeIsLive(u) && (!country || sameText(u.country, country)) && (u.id === preferId || (u.store.marketCategories || []).some(c => aisles.includes(c))));
  const cache = new Map(), items = [];
  for (const sel of sellers) {
    const currencies = await store.currenciesFor(sel);
    for (const g of await db.filter('storeGoods', x => x.providerId === sel.id)) {
      if (!store.isOnShelf(g) || !store.inStock(g, 1)) continue;
      items.push({ kind: 'store', id: g.id, title: g.name, price: store.goodUsdPrice(g, currencies), unit: g.unit || '', photo: (g.photoUrls || [])[0] || null, providerId: sel.id, storeName: sel.store.name, city: sel.city || '', seller: await sellerInfo(sel, cache), yourPro: sel.id === preferId, ...(isTradeBuyer(me, sel.id) && Number(g.tradePrice) > 0 ? { tradePrice: money(g.tradePrice) } : {}) });
    }
  }
  items.sort((a, b) => (b.yourPro - a.yourPro) || (((b.seller && b.seller.rating) || 0) - ((a.seller && a.seller.rating) || 0)) || a.price - b.price);
  res.json({ aisles, items: items.slice(0, 12) });
});

// v140: trade prices: a lower price a store gives verified pros.
router.get('/market/my-goods', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const currencies = await store.currenciesFor(me);
  const goods = (await db.filter('storeGoods', g => g.providerId === me.id)).filter(g => g.forSale !== false && g.status !== 'rejected');
  res.json({ goods: goods.map(g => ({ id: g.id, name: g.name, price: store.goodUsdPrice(g, currencies), tradePrice: Number(g.tradePrice) > 0 ? money(g.tradePrice) : null, status: g.status })) });
});
router.put('/market/trade-prices', requireAuth, requireRole('provider'), writeLimiter, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const prices = (req.body || {}).prices;
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) return res.status(400).json({ error: 'Send the trade prices' });
  const currencies = await store.currenciesFor(me);
  let changed = 0;
  for (const [id, v] of Object.entries(prices).slice(0, 200)) {
    const g = await db.find('storeGoods', x => x.id === id && x.providerId === me.id);
    if (!g) return res.status(404).json({ error: 'One of those goods is not in your store' });
    if (v === null || v === '' || v === 0) { await db.update('storeGoods', g.id, { tradePrice: null }); changed++; continue; }
    const n = Number(v), shelf = store.goodUsdPrice(g, currencies);
    if (!Number.isFinite(n) || n <= 0 || n >= shelf) return res.status(400).json({ error: `The trade price of "${g.name}" must be more than $0 and less than its shelf price ($${shelf.toFixed(2)})` });
    await db.update('storeGoods', g.id, { tradePrice: money(n) }); changed++;
  }
  res.json({ ok: true, changed });
});

// ── the team ───────────────────────────────────────────────────────────
async function teamGate(req, res, next) {
  const m = await db.find('users', u => u.id === req.user.sub);
  if (!m || m.active === false) return res.status(403).json({ error: 'This account has been suspended. Contact a super admin for access.' });
  if (!m.isSuperAdmin && m.adminDepartment && !['verification', 'customer_service'].includes(m.adminDepartment) && !require('../admin-permissions').gatePassed(req, m)) {
    return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  }
  req.adminUser = m; req.covers = require('../admin-scope').adminScopeFor(m); next();
}
const adminOnly = [requireAuth, requireRole('admin'), teamGate];
// v143: register a stolen item (phone, laptop, motorbike...). Listings with the number are held at once.
router.post('/market/stolen', requireAuth, writeLimiter, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me || me.verified !== true) return res.status(403).json({ code: 'VERIFY_IDENTITY', error: 'Please verify your identity first, so a stolen-item report can be trusted.' });
  const r = await require('../stolen-goods').registerStolen(me, req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  for (const l of r.hits) {
    const seller = await db.find('users', u => u.id === l.sellerId);
    const reasons = [...(l.reviewReasons || []), `its number (ending ${l.serialLast4}) was just registered as STOLEN (report ${r.report.id})`];
    const held = await db.update('marketListings', l.id, { status: 'review', reviewReasons: reasons });
    if (seller) { await sendForReview(held, seller, reasons); await stolenAlert(held, seller); }
  }
  res.status(201).json({ report: { id: r.report.id, what: r.report.what, serialLast4: r.report.serialLast4, createdAt: r.report.createdAt }, message: r.hits.length ? 'Registered. A listing with this number was found and is held; the Trothen team will contact you.' : 'Registered. If anyone tries to sell it on Trothen, the listing is held and the team contacts you.' });
});
router.get('/market/stolen/mine', requireAuth, async (req, res) => {
  const rows = (await db.filter('stolenReports', r => r.userId === req.user.sub)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ reports: rows.map(r => ({ id: r.id, what: r.what, serialLast4: r.serialLast4, policeReport: r.policeReport, status: r.status, createdAt: r.createdAt })) });
});
router.post('/market/stolen/:id/found', requireAuth, async (req, res) => {
  const r = await db.find('stolenReports', x => x.id === req.params.id && x.userId === req.user.sub);
  if (!r) return res.status(404).json({ error: 'Report not found' });
  await db.update('stolenReports', r.id, { status: 'recovered', recoveredAt: new Date().toISOString() });
  res.json({ ok: true });
});

router.get('/admin/market/listings', adminOnly, async (req, res) => {
  const want = ['reported', 'hidden', 'removed', 'live', 'all'].includes(req.query.show) ? req.query.show : 'reported';
  let list = await db.filter('marketListings', l => l.status !== 'deleted');
  if (want === 'reported') list = list.filter(l => l.status === 'review' || ((l.reports || []).length > 0 && ['live', 'hidden'].includes(l.status))); // v140: and listings held for a safety check
  else if (want !== 'all') list = list.filter(l => l.status === want);
  const out = [];
  for (const l of list.sort((a, b) => ((b.reports || []).length - (a.reports || []).length) || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200)) {
    const seller = await db.find('users', u => u.id === l.sellerId);
    if (seller && !req.covers(seller)) continue;
    out.push({ id: l.id, title: l.title, description: l.description, category: l.category, price: l.price, currency: l.currency, photoUrls: l.photoUrls || [], status: l.status, reviewReasons: l.reviewReasons || [], serialLast4: l.serialLast4 || null, isPart: l.isPart === true, proofUrl: l.proofUrl || null, ownerAttestedAt: l.ownerAttestedAt || null, city: l.city, country: l.country, createdAt: l.createdAt, reports: (l.reports || []).map(r => ({ reason: r.reason, at: r.at })), seller: seller ? { id: seller.id, name: seller.name, verified: seller.verified === true } : null, removedReason: l.removedReason || null });
  }
  res.json({ listings: out });
});
router.post('/admin/market/listings/:id/decide', adminOnly, async (req, res) => {
  const l = await db.find('marketListings', x => x.id === req.params.id && x.status !== 'deleted');
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  const seller = await db.find('users', u => u.id === l.sellerId);
  if (seller && !req.covers(seller)) return res.status(403).json({ error: 'That seller is outside the area you look after.' });
  const { decision, reason } = req.body || {};
  if (decision === 'remove') {
    if (!isNonEmptyString(reason, { min: 5, max: 300 })) return res.status(400).json({ error: 'Give the seller a reason (5 to 300 characters)' });
    if (l.status === 'reserved') return res.status(400).json({ error: 'Someone is buying this item. Resolve the order first (Disputes).' });
    await db.update('marketListings', l.id, { status: 'removed', removedReason: reason.trim(), removedBy: req.adminUser.id, removedAt: new Date().toISOString() });
    await notify(l.sellerId, '🚫', `The Trothen team took down your Market listing "${l.title}": ${reason.trim()}`, 'bookingUpdates', { section: 'market' });
  } else if (decision === 'restore') {
    await db.update('marketListings', l.id, { status: 'live', reports: [], hiddenByReports: false, removedReason: null, reviewReasons: [], reviewedBy: req.adminUser.id, expiresAt: new Date(Date.now() + market.LISTING_DAYS * market.DAY).toISOString() });
    await notify(l.sellerId, '✅', `Your Market listing "${l.title}" is ${l.status === 'review' ? 'checked and now on sale' : 'back on sale after the Trothen team looked at it'}.`, 'bookingUpdates', { section: 'market' });
  } else return res.status(400).json({ error: 'Choose remove or restore' });
  try { await db.insert('accessLogs', { id: `al_${nanoid(10)}`, adminId: req.adminUser.id, resourceType: 'market_listing', resourceId: `${l.id} ${decision}`, ipAddress: req.ip, createdAt: new Date().toISOString() }); } catch (e) { /* the decision stands */ }
  res.json({ ok: true });
});

module.exports = router;
