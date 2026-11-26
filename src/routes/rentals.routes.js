// v180: Rentals in the Market (the rules in plain words are in src/rentals.js).
//
//   GET    /api/rentals                         browse (public): ?mode=stay|monthly&q&country&checkIn&checkOut&moveIn&guests&bedrooms&sort
//   GET    /api/rentals/options                 kinds of place, what a place can have, the cancellation rules, the fees
//   GET    /api/rentals/:id                     one place (public): photos, area, what it has, rules, prices, dates taken, reviews
//   GET    /api/rentals/:id/quote               the price for dates, with the fees and the cancellation rule
//   POST   /api/rentals/photo                   a photo for a listing (ID-verified hosts)
//   GET    /api/rentals/hosting/mine            a host's places and their bookings
//   POST   /api/rentals                         list a place (it is checked by the team first)
//   PATCH  /api/rentals/:id                     edit (a new address or new photos are checked again)
//   POST   /api/rentals/:id/status              { status: 'live' | 'paused' }
//   DELETE /api/rentals/:id
//   PUT    /api/rentals/:id/calendar            { blocked: ['YYYY-MM-DD', ...] } the host's own unavailable days
//   POST   /api/rentals/:id/book                pay and request
//   POST   /api/rentals/:id/report
//   GET    /api/rentals/trips/mine              a guest's bookings
//   POST   /api/rentals/bookings/:id/accept     the host accepts
//   POST   /api/rentals/bookings/:id/decline    the host says no (the guest is refunded)
//   GET    /api/rentals/bookings/:id/cancel     what cancelling now would give back
//   POST   /api/rentals/bookings/:id/cancel     guest or host
//   POST   /api/rentals/bookings/:id/all-good   the guest is in and all is well: the money goes to the host now
//   POST   /api/rentals/bookings/:id/review     the guest rates the stay
//   GET    /api/admin/market/rentals            the team: places to check, and every place
//   POST   /api/admin/market/rentals/:id/decide { decision: 'approve' | 'reject' | 'remove' | 'restore', reason }
const express = require('express');
const rateLimit = require('express-rate-limit');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { notify } = require('../notify');
const store = require('../store');
const R = require('../rentals');
const { money } = R;

const router = express.Router();
const listLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many searches at once. Please wait a moment.' } });
const writeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many changes in a short time. Please wait a few minutes.' } });
const firstAndInitial = (n) => { const p = String(n || '').trim().split(/\s+/); const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1); return p.length > 1 ? `${cap(p[0])} ${p[p.length - 1][0].toUpperCase()}.` : (p[0] ? cap(p[0]) : 'Member'); };
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const booking = new Set(); // one booking at a time per place, so two guests can't take the same dates

async function viewer(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { const payload = require('jsonwebtoken').verify(h.slice(7), require('../auth').JWT_SECRET); return await db.find('users', u => u.id === payload.sub); } catch (e) { return null; }
}
async function verifiedHost(req, res) {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me || !['customer', 'provider'].includes(me.role)) { res.status(403).json({ error: 'Listing a place is for customer and pro accounts' }); return null; }
  if (me.verified !== true) { res.status(403).json({ code: 'VERIFY_IDENTITY', error: 'To list a place, verify your identity first (Verification in your menu). Guests only see hosts Trothen has checked.' }); return null; }
  const ban = require('./market-admin.routes').banOf(me);
  if (ban) { res.status(403).json({ code: 'MARKET_STOPPED', error: `The Trothen team has stopped you listing in the Market${ban.until ? ' until ' + new Date(ban.until).toDateString() : ''}: ${ban.reason}` }); return null; }
  if (me.onHold || me.active === false || me.closedAt) { res.status(403).json({ error: 'Your account is paused, so you can\'t list a place right now.' }); return null; }
  return me;
}
const hostOk = (u) => !!(u && u.active !== false && !u.onHold && !u.closedAt && !require('./market-admin.routes').banOf(u));

// What a host shows guests.
async function hostCard(u) {
  if (!u) return null;
  const st = await R.hostStats(u.id);
  return { id: u.id, name: firstAndInitial(u.name), verified: u.verified === true, since: (u.createdAt || '').slice(0, 4), profilePhotoUrl: u.profilePhotoUrl || null, initials: u.initials || null, color: u.color || null, stays: st.stays, isNew: st.isNew };
}
// The pin a guest sees before booking: about 1 kilometre off, so the house can't be found from it.
const roughPin = (p) => (p ? { latitude: Math.round(p.latitude * 100) / 100, longitude: Math.round(p.longitude * 100) / 100 } : null);

async function priceView(l, host, viewerUser) {
  const out = {};
  if (l.stay) { const usd = await R.usdOf(l.stay.price, l.stay.currency, host); out.stay = { nightlyUsd: usd, local: await R.localOf(usd, viewerUser || host), cleaningUsd: await R.usdOf(l.stay.cleaningFee, l.stay.currency, host), minNights: l.stay.minNights, maxNights: l.stay.maxNights, checkInFrom: l.stay.checkInFrom, checkOutBy: l.stay.checkOutBy, cancellation: l.stay.cancellation, cancellationLabel: R.CANCELLATION[l.stay.cancellation].label, cancellationWords: R.CANCELLATION[l.stay.cancellation].words }; }
  if (l.monthly) { const usd = await R.usdOf(l.monthly.price, l.monthly.currency, host); out.monthly = { monthlyUsd: usd, local: await R.localOf(usd, viewerUser || host), minMonths: l.monthly.minMonths, payMonths: l.monthly.payMonths, cancellationWords: R.MONTHLY_CANCEL_WORDS }; }
  return out;
}
async function listingView(l, me, opts = {}) {
  const host = opts.host || await db.find('users', u => u.id === l.hostId);
  const mine = !!(me && me.id === l.hostId);
  const v = {
    id: l.id, title: l.title, description: l.description, propertyType: l.propertyType, propertyLabel: R.PROPERTY_TYPES[l.propertyType] || '',
    bedrooms: l.bedrooms, bathrooms: l.bathrooms, maxGuests: l.maxGuests, amenities: (l.amenities || []).map(k => ({ key: k, label: R.AMENITIES[k] })), rules: l.rules || '',
    community: l.community, city: l.city, country: l.country, photoUrls: l.photoUrls || [], roughPin: roughPin(l.location),
    ...(await priceView(l, host, me)), rating: l.ratingAvg || null, ratingCount: l.ratingCount || 0,
    status: l.status, host: await hostCard(host), mine, ownerDeclared: !!l.ownerDeclaredAt, createdAt: l.createdAt,
  };
  if (mine || opts.full) Object.assign(v, { address: l.address, location: l.location || null, blockedDates: l.blockedDates || [], reviewNote: l.reviewNote || null, reports: (l.reports || []).length, raw: { stay: l.stay, monthly: l.monthly } });
  return v;
}

// ── browse (public) ────────────────────────────────────────────────────
router.get('/rentals/options', async (req, res) => {
  const me = await viewer(req);
  res.json({ propertyTypes: R.PROPERTY_TYPES, amenities: R.AMENITIES, cancellation: R.CANCELLATION, monthlyCancellation: R.MONTHLY_CANCEL_WORDS, feeRefund: R.FEE_REFUND_WORDS, fees: await R.fees(), limits: R.LIMITS, currencies: me ? await store.currenciesFor(me) : [{ code: 'USD', symbol: '$', rate: 1 }] });
});
router.get('/rentals', listLimiter, async (req, res) => {
  const me = await viewer(req);
  const q = req.query || {};
  const mode = q.mode === 'monthly' ? 'monthly' : q.mode === 'stay' ? 'stay' : 'all';
  const country = q.country !== undefined ? String(q.country) : (me ? me.country : '');
  const words = String(q.q || '').trim().toLowerCase().slice(0, 80).split(/\s+/).filter(w => w.length > 1);
  const guests = Number(q.guests) || 0, bedrooms = Number(q.bedrooms) || 0;
  let list = await db.filter('rentalListings', l => l.status === 'live' && (!country || sameText(l.country, country)));
  if (mode !== 'all') list = list.filter(l => !!l[mode]);
  if (guests) list = list.filter(l => l.maxGuests >= guests);
  if (bedrooms) list = list.filter(l => l.bedrooms >= bedrooms);
  // v183: Trothen's search engine: typos in an area ("Sinkr"), other names ("flat" = apartment), best match first
  const SEARCH = require('../../public/app/search-core.js');
  const rank = new Map();
  if (words.length) {
    const found = SEARCH.search(list, String(q.q), (l) => [{ text: `${l.community || ''} ${l.city || ''}`, weight: 3 }, { text: l.title, weight: 2.5 }, { text: R.PROPERTY_TYPES[l.propertyType] || '', weight: 2 }, { text: l.description || '', weight: 1 }], { relax: false });
    list = found.results.map(r => { rank.set(r.item.id, r.score); return r.item; });
  }
  const hosts = new Map();
  for (const l of list) if (!hosts.has(l.hostId)) hosts.set(l.hostId, await db.find('users', u => u.id === l.hostId));
  list = list.filter(l => hostOk(hosts.get(l.hostId)));
  // Dates chosen: only places free for all of them.
  if (R.isDate(q.checkIn) && R.isDate(q.checkOut) && q.checkOut > q.checkIn) { const keep = []; for (const l of list) if (l.stay && await R.isFree(l, q.checkIn, q.checkOut, null)) keep.push(l); list = keep; }
  else if (R.isDate(q.moveIn)) { const keep = []; for (const l of list) if (l.monthly && await R.isFree(l, q.moveIn, R.addMonths(q.moveIn, l.monthly.payMonths), null)) keep.push(l); list = keep; }
  const items = [];
  for (const l of list) {
    const p = await priceView(l, hosts.get(l.hostId), me);
    items.push({ id: l.id, title: l.title, propertyLabel: R.PROPERTY_TYPES[l.propertyType], bedrooms: l.bedrooms, bathrooms: l.bathrooms, maxGuests: l.maxGuests, community: l.community, city: l.city, photo: (l.photoUrls || [])[0] || null, rating: l.ratingAvg || null, ratingCount: l.ratingCount || 0, createdAt: l.createdAt, ...p, sortPrice: mode === 'monthly' ? (p.monthly && p.monthly.monthlyUsd) : (p.stay ? p.stay.nightlyUsd : p.monthly.monthlyUsd / 30), hostVerified: true });
  }
  const sort = q.sort;
  if (sort === 'price_asc') items.sort((a, b) => a.sortPrice - b.sortPrice);
  else if (sort === 'price_desc') items.sort((a, b) => b.sortPrice - a.sortPrice);
  else if (sort === 'rating') items.sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.ratingCount - a.ratingCount);
  else if (rank.size) items.sort((a, b) => (rank.get(b.id) || 0) - (rank.get(a.id) || 0)); // v183: best match first
  else items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const countries = q.countries ? [...new Set((await db.filter('rentalListings', l => l.status === 'live')).map(l => l.country).filter(Boolean))].sort() : undefined;
  res.json({ items: items.slice(0, 120), total: items.length, countries });
});

// ── a host's places ────────────────────────────────────────────────────
let uploader = null;
setImmediate(() => { uploader = require('./store.routes').photoUploader('rental'); });
router.post('/rentals/photo', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedHost(req, res); if (!me) return;
  require('./store.routes').handlePhotoUpload(uploader, req, res);
});
async function bookingView(c, forWho) {
  const r = c.rental;
  const guest = await db.find('users', u => u.id === c.customerId);
  const host = await db.find('users', u => u.id === c.providerId);
  const l = await db.find('rentalListings', x => x.id === r.listingId);
  const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
  const confirmed = ['active', 'completed', 'disputed'].includes(c.status);
  const v = {
    id: c.id, bookingNumber: c.bookingNumber, status: c.status, mode: r.mode, listingId: r.listingId, title: r.title, photo: r.photo, community: r.community, city: r.city,
    checkIn: r.checkIn || null, checkOut: r.checkOut || null, nights: r.nights || null, checkInFrom: r.checkInFrom || null, checkOutBy: r.checkOutBy || null,
    moveIn: r.moveIn || null, endDate: r.endDate || null, months: r.months || null, guests: r.guests,
    lines: r.lines || [], subtotal: r.subtotal, guestFee: r.guestFee, hostFee: r.hostFee, total: money(r.subtotal + r.guestFee), hostGets: money(r.subtotal - r.hostFee),
    cancellationWords: r.cancellationWords, note: r.note || null,
    answerBy: c.status === 'pending_provider_confirmation' ? c.providerResponseDeadline : null,
    releaseAt: c.status === 'active' ? R.releaseAt(c).toISOString() : null, startsAt: R.startOf(c).toISOString(),
    canCancel: !R.cancelPlan(c, forWho === 'host' ? 'host' : 'guest').blocked, canReport: c.status === 'active', canAllGood: forWho === 'guest' && c.status === 'active' && Date.now() >= R.startOf(c).getTime(),
    canReview: forWho === 'guest' && c.status === 'completed' && !r.reviewed && (r.mode === 'monthly' || Date.now() >= R.checkOutAt(c).getTime()),
    reviewed: !!r.reviewed, cancel: r.cancel || null, refundedAmount: c.refundedAmount || null,
    address: confirmed && l ? l.address : null, location: confirmed && l ? l.location || null : null,
    guest: guest ? { id: guest.id, name: firstAndInitial(guest.name), verified: guest.verified === true } : null,
    host: host ? { id: host.id, name: firstAndInitial(host.name) } : null,
    payment: c.status === 'awaiting_payment' && escrow ? require('../customer-payments').publicPayment(escrow) : null,
    createdAt: c.createdAt,
  };
  return v;
}
router.get('/rentals/hosting/mine', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'Account not found' });
  const listings = await db.filter('rentalListings', l => l.hostId === me.id && l.status !== 'deleted');
  const bookings = (await db.filter('contracts', c => c.rental && c.providerId === me.id && c.status !== 'awaiting_payment'))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 100);
  res.json({ listings: await Promise.all(listings.map(l => listingView(l, me))), bookings: await Promise.all(bookings.map(c => bookingView(c, 'host'))), verified: me.verified === true, limit: R.LIMITS.liveListings, currencies: await store.currenciesFor(me), fees: await R.fees() });
});
async function sendForCheck(l, host, again) {
  const managers = await require('../admin-scope').regionalAdminsFor({ city: l.city, country: l.country });
  for (const a of managers) await notify(a.id, '🏠', `A rental place needs checking before it is shown: "${l.title}" (${l.community}, ${l.city}). Admin → Market → Rentals.`, null, { section: 'market' });
  await notify(host.id, '🔎', `"${l.title}" is being checked by the Trothen team before guests can see it${again ? ' again' : ''}, usually within a day. This is a routine safety check for every rental place.`, 'bookingUpdates', { section: 'market' });
}
router.post('/rentals', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedHost(req, res); if (!me) return;
  const open = await db.filter('rentalListings', l => l.hostId === me.id && ['review', 'live', 'paused'].includes(l.status));
  if (open.length >= R.LIMITS.liveListings) return res.status(400).json({ error: `You can have up to ${R.LIMITS.liveListings} places listed at once.` });
  const r = await R.readListing(req.body, me, null);
  if (r.error) return res.status(400).json({ error: r.error });
  const now = new Date().toISOString();
  const l = { id: `rl_${nanoid(10)}`, hostId: me.id, ...r.out, location: r.out.location || null, country: me.country || '', status: 'review', blockedDates: [], reports: [], hostCancels: [], ratingAvg: null, ratingCount: 0, createdAt: now, updatedAt: now };
  await db.insert('rentalListings', l);
  await sendForCheck(l, me, false);
  res.status(201).json({ listing: await listingView(l, me) });
});
router.patch('/rentals/:id', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedHost(req, res); if (!me) return;
  const l = await db.find('rentalListings', x => x.id === req.params.id && x.hostId === me.id && !['deleted', 'removed'].includes(x.status));
  if (!l) return res.status(404).json({ error: 'Place not found' });
  const r = await R.readListing(req.body, me, l);
  if (r.error) return res.status(400).json({ error: r.error });
  // A new address, pin or photos is checked again, as a new listing is (a common scam is to swap them after approval).
  const changed = (k) => r.out[k] !== undefined && JSON.stringify(r.out[k]) !== JSON.stringify(l[k]);
  const recheck = l.status !== 'review' && l.status !== 'rejected' && ['address', 'photoUrls', 'location', 'community'].some(changed);
  const patch = { ...r.out, updatedAt: new Date().toISOString() };
  if (recheck || l.status === 'rejected') { patch.status = 'review'; patch.reviewNote = null; }
  const updated = await db.update('rentalListings', l.id, patch);
  if (patch.status === 'review') await sendForCheck(updated, me, true);
  res.json({ listing: await listingView(updated, me), recheck: patch.status === 'review' });
});
router.post('/rentals/:id/status', requireAuth, writeLimiter, async (req, res) => {
  const me = await verifiedHost(req, res); if (!me) return;
  const l = await db.find('rentalListings', x => x.id === req.params.id && x.hostId === me.id);
  if (!l) return res.status(404).json({ error: 'Place not found' });
  const want = (req.body || {}).status;
  if (!['live', 'paused'].includes(want)) return res.status(400).json({ error: 'Choose show or pause' });
  if (!['live', 'paused'].includes(l.status)) return res.status(400).json({ error: l.status === 'review' ? 'This place is still being checked by the Trothen team.' : 'This place can\'t be changed now.' });
  const updated = await db.update('rentalListings', l.id, { status: want, updatedAt: new Date().toISOString() });
  res.json({ listing: await listingView(updated, me) });
});
router.delete('/rentals/:id', requireAuth, async (req, res) => {
  const l = await db.find('rentalListings', x => x.id === req.params.id && x.hostId === req.user.sub && x.status !== 'deleted');
  if (!l) return res.status(404).json({ error: 'Place not found' });
  const coming = (await R.bookingsFor(l.id)).length;
  if (coming) return res.status(409).json({ error: `This place has ${coming} booking${coming === 1 ? '' : 's'} still open. Pause it instead, so no new guests can book; you can delete it when those are finished.` });
  await db.update('rentalListings', l.id, { status: 'deleted', deletedAt: new Date().toISOString() });
  res.json({ ok: true });
});
router.put('/rentals/:id/calendar', requireAuth, writeLimiter, async (req, res) => {
  const l = await db.find('rentalListings', x => x.id === req.params.id && x.hostId === req.user.sub && !['deleted', 'removed'].includes(x.status));
  if (!l) return res.status(404).json({ error: 'Place not found' });
  const list = (req.body || {}).blocked;
  if (!Array.isArray(list) || list.length > R.LIMITS.blockedMax || list.some(d => !R.isDate(d))) return res.status(400).json({ error: `Send up to ${R.LIMITS.blockedMax} dates (YYYY-MM-DD)` });
  const today = R.todayIn(l.country);
  const blocked = [...new Set(list)].filter(d => d >= today).sort();
  const updated = await db.update('rentalListings', l.id, { blockedDates: blocked, updatedAt: new Date().toISOString() });
  res.json({ blockedDates: updated.blockedDates, unavailable: await R.unavailableDates(updated) });
});

// ── one place (public) ─────────────────────────────────────────────────
router.get('/rentals/trips/mine', requireAuth, async (req, res) => {
  const list = (await db.filter('contracts', c => c.rental && c.customerId === req.user.sub)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 100);
  res.json({ trips: await Promise.all(list.map(c => bookingView(c, 'guest'))) });
});
router.get('/rentals/:id', listLimiter, async (req, res) => {
  const me = await viewer(req);
  const l = await db.find('rentalListings', x => x.id === req.params.id);
  const host = l && await db.find('users', u => u.id === l.hostId);
  const isTeam = me && me.role === 'admin';
  if (!l || (!(me && me.id === l.hostId) && !isTeam && (l.status !== 'live' || !hostOk(host)))) return res.status(404).json({ error: 'This place is not available.' });
  const reviews = (await db.filter('rentalReviews', r => r.listingId === l.id)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30);
  res.json({ listing: { ...(await listingView(l, me, { host })), unavailable: await R.unavailableDates(l), today: R.todayIn(l.country), reviews: reviews.map(r => ({ stars: r.stars, text: r.text || '', name: r.guestName, at: r.createdAt })) } });
});
router.get('/rentals/:id/quote', listLimiter, async (req, res) => {
  const me = await viewer(req);
  const l = await db.find('rentalListings', x => x.id === req.params.id && x.status === 'live');
  if (!l) return res.status(404).json({ error: 'This place is not available.' });
  const q = await R.quote(l, req.query || {}, me);
  if (q.error) return res.status(400).json({ code: q.code, error: q.error });
  res.json({ quote: q });
});
router.post('/rentals/:id/report', requireAuth, writeLimiter, async (req, res) => {
  const l = await db.find('rentalListings', x => x.id === req.params.id && ['live', 'review', 'paused'].includes(x.status));
  if (!l) return res.status(404).json({ error: 'Place not found' });
  if (l.hostId === req.user.sub) return res.status(400).json({ error: 'This is your own place.' });
  const reason = String((req.body || {}).reason || '').trim();
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ error: 'Say what is wrong in 5 to 500 characters' });
  const reports = (l.reports || []).filter(r => r.userId !== req.user.sub).concat([{ userId: req.user.sub, reason, at: new Date().toISOString() }]);
  const patch = { reports };
  if (l.status === 'live' && reports.length >= R.REPORTS_TO_HIDE) { patch.status = 'review'; patch.reviewNote = 'Hidden after several reports, until the team has looked.'; }
  await db.update('rentalListings', l.id, patch);
  if (patch.status === 'review') { const host = await db.find('users', u => u.id === l.hostId); if (host) await sendForCheck({ ...l, ...patch }, host, true); }
  res.json({ ok: true });
});

// ── booking ────────────────────────────────────────────────────────────
router.post('/rentals/:id/book', requireAuth, require('../terms').requireCurrentTerms, async (req, res) => {
  if (!['customer', 'provider'].includes(req.user.role)) return res.status(403).json({ error: 'Booking is for customer and pro accounts' });
  const guest = await require('./orders.routes').customerCanBuy(req, res); if (!guest) return;
  if (booking.has(req.params.id)) return res.status(409).json({ error: 'Someone is booking this place right now. Try again in a moment.' });
  booking.add(req.params.id);
  try {
    const l = await db.find('rentalListings', x => x.id === req.params.id);
    const host = l && await db.find('users', u => u.id === l.hostId);
    if (!l || l.status !== 'live' || !hostOk(host)) return res.status(409).json({ code: 'GONE', error: 'This place can\'t be booked right now.' });
    if (l.hostId === guest.id) return res.status(400).json({ error: 'This is your own place.' });
    const digits = (p) => String(p || '').replace(/\D/g, '').slice(-9);
    if (digits(guest.phone).length >= 7 && digits(guest.phone) === digits(host.phone)) {
      try { await require('../fraud-detection').createFlag({ type: 'rental_self_booking', severity: 'medium', userId: guest.id, relatedUserId: host.id, details: `${guest.name} tried to book "${l.title}" from ${host.name}; both accounts have the same phone number` }); } catch (e) { /* refused anyway */ }
      return res.status(403).json({ code: 'SAME_PERSON', error: 'This host\'s account shares your phone number, so this booking can\'t go through Trothen.' });
    }
    const b = req.body || {};
    const q = await R.quote(l, b, guest);
    if (q.error) return res.status(q.code === 'NOT_FREE' ? 409 : 400).json({ code: q.code, error: q.error });
    if (b.expectedTotal !== undefined && Math.abs(Number(b.expectedTotal) - q.total) > 0.009) return res.status(409).json({ code: 'PRICE_CHANGED', total: q.total, error: `The total is now $${q.total.toFixed(2)}. Check it and book again.` });
    const note = String(b.note || '').trim();
    if (note.length > 500) return res.status(400).json({ error: 'Keep the message to the host under 500 characters' });
    const { generateBookingNumber, fundEscrowForContract } = require('./marketplace.routes');
    const nowIso = new Date().toISOString();
    const stats = await R.hostStats(host.id);
    const deadlineMs = Math.min(Date.now() + R.ANSWER_HOURS * 3600e3, Math.max(Date.now() + 2 * 3600e3, R.startOf({ rental: { ...q, country: l.country } }).getTime() - 3600e3));
    const order = {
      id: `ct_${nanoid(10)}`, bookingNumber: await generateBookingNumber(),
      customerId: guest.id, providerId: host.id,
      service: `${q.mode === 'monthly' ? 'Rent' : 'Stay'}: ${l.title}`.slice(0, 200),
      date: q.mode === 'monthly' ? q.moveIn : q.checkIn, time: q.mode === 'monthly' ? '09:00' : q.checkInFrom,
      address: `${l.community}, ${l.city}`.slice(0, 200),
      amount: q.hostGets, serviceFee: money(q.guestFee + q.hostFee), laborAmount: q.hostGets, materialsCost: 0, materialsAdvance: 0, photoUrls: [],
      payMethod: 'protected', payCurrency: b.payCurrency === 'local' ? 'local' : 'usd', loyaltyPointsRedeemed: 0,
      newSellerReserve: stats.isNew,
      rental: {
        listingId: l.id, mode: q.mode, title: l.title, photo: (l.photoUrls || [])[0] || null, community: l.community, city: l.city, country: l.country, guests: q.guests,
        checkIn: q.checkIn || null, checkOut: q.checkOut || null, nights: q.nights || null, nightlyUsd: q.nightlyUsd || null, cleaningUsd: q.cleaningUsd || 0, checkInFrom: q.checkInFrom || null, checkOutBy: q.checkOutBy || null, cancellation: q.cancellation || null,
        moveIn: q.moveIn || null, endDate: q.endDate || null, months: q.months || null, monthlyUsd: q.monthlyUsd || null,
        lines: q.lines, subtotal: q.subtotal, guestFee: q.guestFee, hostFee: q.hostFee, hostFeePercent: q.hostFeePercent, guestFeePercent: q.feePercent,
        cancellationWords: q.cancellationWords, note: note || null,
      },
      status: 'pending_provider_confirmation', providerResponseDeadline: new Date(deadlineMs).toISOString(), signedAt: null,
      createdAt: nowIso,
    };
    let escrow = null;
    try {
      escrow = await fundEscrowForContract(order, guest.id, order.payCurrency);
      if (escrow && escrow.status === 'awaiting_payment') { order.status = 'awaiting_payment'; order.statusAfterPayment = 'pending_provider_confirmation'; }
      await db.insert('contracts', order);
      if (escrow) await db.update('escrowTransactions', escrow.id, { noCommissionAmount: order.amount, rental: true });
    } catch (e) {
      console.error('[rentals book] payment or save failed:', e.message);
      if (e.code === 'PROTECTED_UNAVAILABLE') return res.status(400).json({ code: 'PAY_UNAVAILABLE', error: 'Paying through Trothen isn\'t switched on in your country yet, so this place can\'t be booked here yet.' });
      return res.status(402).json({ code: 'PAYMENT_FAILED', error: 'Your payment could not be completed, so you were not charged. Please try again or use another payment method.' });
    }
    if (order.status === 'pending_provider_confirmation') { order.paidAt = nowIso; await db.update('contracts', order.id, { paidAt: nowIso }); await R.afterPaid(order); }
    try { await require('../fraud-detection').checkNewAccountHighValue(guest.id, q.total); } catch (e) { /* the booking stands */ }
    const fresh = await db.find('contracts', c => c.id === order.id);
    res.status(201).json({ booking: await bookingView(fresh, 'guest'), payment: fresh.status === 'awaiting_payment' ? require('../customer-payments').publicPayment(escrow) : null });
  } finally { booking.delete(req.params.id); }
});

async function myBooking(req, res, as) {
  const c = await db.find('contracts', x => x.id === req.params.id && x.rental && (as === 'host' ? x.providerId === req.user.sub : as === 'guest' ? x.customerId === req.user.sub : (x.providerId === req.user.sub || x.customerId === req.user.sub)));
  if (!c) { res.status(404).json({ error: 'Booking not found' }); return null; }
  return c;
}
const locked = (id, fn) => require('../contract-locks').whenFree(id, fn);
router.post('/rentals/bookings/:id/accept', requireAuth, async (req, res) => {
  const c0 = await myBooking(req, res, 'host'); if (!c0) return;
  await locked(c0.id, async () => {
    const c = await db.find('contracts', x => x.id === c0.id);
    if (c.status !== 'pending_provider_confirmation') return res.status(400).json({ error: c.status === 'active' ? 'You already accepted this booking.' : `This booking is ${String(c.status).replace(/_/g, ' ')}.` });
    if (c.providerResponseDeadline && Date.parse(c.providerResponseDeadline) < Date.now()) return res.status(400).json({ error: 'The time to answer has passed, so the guest has been refunded.' });
    res.json({ booking: await bookingView(await R.accept(c), 'host') });
  });
});
router.post('/rentals/bookings/:id/decline', requireAuth, async (req, res) => {
  const c0 = await myBooking(req, res, 'host'); if (!c0) return;
  await locked(c0.id, async () => {
    const c = await db.find('contracts', x => x.id === c0.id);
    if (c.status !== 'pending_provider_confirmation') return res.status(400).json({ error: `This booking is ${String(c.status).replace(/_/g, ' ')}. To cancel an accepted booking, use Cancel.` });
    res.json({ booking: await bookingView(await R.decline(c), 'host') });
  });
});
router.get('/rentals/bookings/:id/cancel', requireAuth, async (req, res) => {
  const c = await myBooking(req, res, 'any'); if (!c) return;
  res.json({ plan: R.cancelPlan(c, c.providerId === req.user.sub ? 'host' : 'guest') });
});
router.post('/rentals/bookings/:id/cancel', requireAuth, async (req, res) => {
  const c0 = await myBooking(req, res, 'any'); if (!c0) return;
  const role = c0.providerId === req.user.sub ? 'host' : 'guest';
  await require('../contract-locks').freeOfPayment(c0.id);
  await locked(c0.id, async () => {
    const c = await db.find('contracts', x => x.id === c0.id);
    if (role === 'host' && c.status === 'awaiting_payment') return res.status(400).json({ error: 'The guest hasn\'t paid yet.' });
    const plan = await R.cancelBooking(c, role, req.user.sub);
    if (plan.blocked) return res.status(409).json({ code: 'USE_DISPUTE', error: plan.words });
    const other = role === 'host' ? c.customerId : c.providerId;
    const t = (c.rental && c.rental.title) || c.service;
    if (plan.kind !== 'unpaid') {
      await notify(other, '🚫', role === 'host' ? `The host cancelled your booking for "${t}". You get everything back ($${plan.refundUsd.toFixed(2)}). We're sorry: have a look at other places in Market → Rentals.` : `The guest cancelled their booking for "${t}". ${plan.hostKeepsUsd > 0 ? `Under your cancellation rule you keep $${plan.hostKeepsUsd.toFixed(2)} of the price (less the host fee).` : 'They were refunded under your cancellation rule.'} The dates are free again.`, 'bookingUpdates', { section: 'market' });
      await notify(req.user.sub, '🚫', role === 'host' ? `You cancelled the booking for "${t}". The guest gets everything back, and those dates are now closed in your calendar.` : `You cancelled "${t}". ${plan.refundUsd > 0 ? `$${plan.refundUsd.toFixed(2)} is refunded to you.` : 'Under the cancellation rule, nothing is refunded.'} ${plan.words}`, 'bookingUpdates', { section: 'market' });
    }
    const fresh = await db.find('contracts', x => x.id === c.id);
    res.json({ booking: await bookingView(fresh, role), plan });
  });
});
router.post('/rentals/bookings/:id/all-good', requireAuth, async (req, res) => {
  const c0 = await myBooking(req, res, 'guest'); if (!c0) return;
  await locked(c0.id, async () => {
    const c = await db.find('contracts', x => x.id === c0.id);
    if (c.status !== 'active') return res.status(400).json({ error: `This booking is ${String(c.status).replace(/_/g, ' ')}.` });
    if (Date.now() < R.startOf(c).getTime()) return res.status(400).json({ error: 'You can confirm once check-in time has come.' });
    await R.complete(c, 'guest');
    res.json({ booking: await bookingView(await db.find('contracts', x => x.id === c.id), 'guest') });
  });
});
router.post('/rentals/bookings/:id/review', requireAuth, writeLimiter, async (req, res) => {
  const c = await myBooking(req, res, 'guest'); if (!c) return;
  const v = await bookingView(c, 'guest');
  if (!v.canReview) return res.status(400).json({ error: c.rental.reviewed ? 'You already rated this stay.' : 'You can rate the place after your stay.' });
  const stars = Number((req.body || {}).stars), text = String((req.body || {}).text || '').trim();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: 'Choose 1 to 5 stars' });
  if (text.length > 1000) return res.status(400).json({ error: 'Keep the review under 1,000 characters' });
  const me = await db.find('users', u => u.id === req.user.sub);
  await db.insert('rentalReviews', { id: `rr_${nanoid(10)}`, listingId: c.rental.listingId, bookingId: c.id, guestId: me.id, guestName: firstAndInitial(me.name), hostId: c.providerId, stars, text, createdAt: new Date().toISOString() });
  await db.update('contracts', c.id, { rental: { ...c.rental, reviewed: true } });
  const r = await R.refreshRating(c.rental.listingId);
  await notify(c.providerId, '⭐', `A guest rated "${c.rental.title}" ${stars} out of 5.`, 'bookingUpdates', { section: 'market' });
  res.status(201).json({ ok: true, rating: r });
});

// ── the team (Admin → Market → Rentals) ────────────────────────────────
async function teamGate(req, res, next) {
  const m = await db.find('users', u => u.id === req.user.sub);
  if (!m || m.active === false) return res.status(403).json({ error: 'This account has been suspended. Contact a super admin for access.' });
  if (!m.isSuperAdmin && m.adminDepartment && !['verification', 'customer_service'].includes(m.adminDepartment) && !require('../admin-permissions').gatePassed(req, m)) return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  req.adminUser = m; req.covers = require('../admin-scope').adminScopeFor(m); next();
}
const team = [requireAuth, requireRole('admin'), teamGate];
router.get('/admin/market/rentals', team, async (req, res) => {
  const want = ['review', 'live', 'paused', 'rejected', 'removed'].includes(req.query.status) ? req.query.status : 'all';
  const list = await db.filter('rentalListings', l => l.status !== 'deleted' && (want === 'all' || l.status === want));
  const out = [];
  for (const l of list.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))) {
    const host = await db.find('users', u => u.id === l.hostId);
    if (!req.covers(host || { city: l.city, country: l.country })) continue;
    const v = await listingView(l, null, { full: true, host });
    out.push({ ...v, hostDetails: host ? { id: host.id, name: host.name, phone: host.phone || null, email: host.email || null, verified: host.verified === true, createdAt: host.createdAt } : null, reportList: l.reports || [], ownerDeclaredAt: l.ownerDeclaredAt || null, hostCancels: (l.hostCancels || []).length });
    if (out.length >= 200) break;
  }
  const counts = {}; for (const l of await db.filter('rentalListings', x => x.status !== 'deleted')) counts[l.status] = (counts[l.status] || 0) + 1;
  res.json({ listings: out, counts });
});
router.post('/admin/market/rentals/:id/decide', team, async (req, res) => {
  const l = await db.find('rentalListings', x => x.id === req.params.id && x.status !== 'deleted');
  if (!l) return res.status(404).json({ error: 'Place not found' });
  const host = await db.find('users', u => u.id === l.hostId);
  if (!req.covers(host || { city: l.city, country: l.country })) return res.status(403).json({ error: 'This place is outside the area you look after.' });
  const { decision } = req.body || {};
  const reason = String((req.body || {}).reason || '').trim();
  const allowed = { approve: ['review', 'rejected'], reject: ['review'], remove: ['live', 'paused', 'review'], restore: ['removed'] };
  if (!allowed[decision]) return res.status(400).json({ error: 'Choose approve, reject, remove or restore' });
  if (!allowed[decision].includes(l.status)) return res.status(400).json({ error: `This place is ${l.status}, so it can't be ${decision === 'approve' ? 'approved' : decision + 'd'}.` });
  if (['reject', 'remove'].includes(decision) && (reason.length < 10 || reason.length > 500)) return res.status(400).json({ error: 'Give the host the reason, in 10 to 500 characters. They see it.' });
  const next = { approve: 'live', reject: 'rejected', remove: 'removed', restore: 'live' }[decision];
  const updated = await db.update('rentalListings', l.id, { status: next, reviewNote: reason || null, reviewedBy: req.adminUser.id, reviewedByName: req.adminUser.name, reviewedAt: new Date().toISOString(), ...(decision === 'approve' || decision === 'restore' ? { reports: [] } : {}) });
  try { await db.insert('accessLogs', { id: `al_${nanoid(10)}`, adminId: req.adminUser.id, resourceType: `rental_${decision}`, resourceId: `${l.id} ${l.title}`.slice(0, 300), ipAddress: req.ip, createdAt: new Date().toISOString() }); } catch (e) { /* the decision stands */ }
  const words = { approve: `Good news: "${l.title}" has been checked and guests can now find and book it in Market → Rentals.`, reject: `"${l.title}" was not approved: ${reason} Change it in Market → Rentals → Hosting and it will be checked again.`, remove: `"${l.title}" was taken down by the Trothen team: ${reason}`, restore: `"${l.title}" is shown to guests again.` }[decision];
  if (host) await notify(host.id, decision === 'approve' || decision === 'restore' ? '✅' : '⚠️', words, 'bookingUpdates', { section: 'market' });
  res.json({ listing: await listingView(updated, null, { full: true, host }) });
});

module.exports = router;
