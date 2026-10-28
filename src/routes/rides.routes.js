// v111: passenger rides (Liberia first). A ride is an ordinary booking
// (so the held money, ratings, receipts and "Report a Problem" all work as
// they already do) with a "ride" record on it: pickup, destination, a trip
// PIN, a share link and a safety log. Rules in plain words:
//  - Only drivers an admin has approved (licence + vehicle checked) are offered.
//  - Rides are on per country, switched by a super admin.
//  - The rider pays up front into escrow; it is released when the rider
//    confirms they arrived. The driver cannot start without the rider's PIN.
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { requireCurrentTerms } = require('../terms');
const { notify } = require('../notify');
const { contractStatusLocks } = require('../contract-locks');
const { getSetting, setSetting } = require('../platform-settings');
const { distanceInMiles, isValidCoordinate } = require('../geo-distance');
const ridePass = require('../ride-pass');

const router = express.Router();
const KM_PER_MILE = 1.609344;
const ROAD_FACTOR = 1.3; // roads are longer than the straight line; fares are estimated on this
const RIDE_VEHICLES = { motorbike: 1, keke: 3, car: 4, van: 8 };
const DOC_KINDS = {
  licence: 'Driver\'s licence',
  registration: 'Vehicle registration',
  vehicle: 'Photo of the vehicle with its plate',
  insurance: 'Insurance or road permit',
  roadworthy: 'Roadworthiness or vehicle inspection certificate',
  police: 'Police clearance certificate',
  selfie: 'Photo of you standing next to the vehicle',
  helmet: 'Photo of the helmet you give to passengers',
};
// v114: which papers a driver must upload can differ by country and by vehicle (a super admin sets the list in
// Admin → Rides). The most specific rule wins: country+vehicle, then country, then vehicle, then everyone.
// With no rule the standard list applies: licence, registration, vehicle photo, and insurance unless switched off.
async function requiredDocs(country, vehicle) {
  const rules = await getSetting('rideDocRules');
  if (Array.isArray(rules) && rules.length) {
    const c = String(country || '').trim().toLowerCase(), v = String(vehicle || '').trim().toLowerCase();
    const hit = (cc, vv) => rules.find(r => r && String(r.country).toLowerCase() === cc && String(r.vehicle).toLowerCase() === vv);
    const r = (c && v && hit(c, v)) || (c && hit(c, '*')) || (v && hit('*', v)) || hit('*', '*');
    if (r && Array.isArray(r.docs)) return r.docs.filter(k => DOC_KINDS[k]);
  }
  return ['licence', 'registration', 'vehicle'].concat((await getSetting('rideRequireInsurance')) === false ? [] : ['insurance']);
}
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const money = (n) => Math.round(Number(n) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Rider';
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const OPEN_STATUSES = ['pending_provider_confirmation', 'active'];

function kmBetween(a, b) {
  if (!a || !b || !isValidCoordinate(a.latitude, a.longitude) || !isValidCoordinate(b.latitude, b.longitude)) return null;
  return Math.round(distanceInMiles(a.latitude, a.longitude, b.latitude, b.longitude) * KM_PER_MILE * 10) / 10;
}
async function ridesOnFor(country) {
  const list = await getSetting('rideEnabledCountries');
  return Array.isArray(list) && list.some(c => sameText(c, country));
}
function isApproved(u) {
  const r = u && u.rideDriver;
  return !!(u && u.role === 'provider' && u.verified === true && u.active !== false && u.onHold !== true && u.acceptingBookings !== false
    && r && r.status === 'approved' && r.licenceExpiry && r.licenceExpiry >= today() && (!r.insuranceExpiry || r.insuranceExpiry >= today()) && (!r.roadworthyExpiry || r.roadworthyExpiry >= today()) && RIDE_VEHICLES[r.vehicle]);
}
function isOnline(u) {
  const r = u && u.rideDriver;
  return !!(isApproved(u) && r.online === true && r.onlineUntil && new Date(r.onlineUntil).getTime() > Date.now());
}
function rates(u) {
  const r = (u && u.rideDriver && u.rideDriver.rates) || {};
  const base = Number(r.baseFee), perKm = Number(r.perKm);
  return { baseFee: Number.isFinite(base) && base > 0 ? money(base) : 1, perKm: Number.isFinite(perKm) && perKm >= 0 ? Math.round(perKm * 10000) / 10000 : 0, isSet: Number.isFinite(base) && base > 0 };
}
function quote(u, straightKm) {
  const r = rates(u);
  return Math.max(1, money(r.baseFee + r.perKm * straightKm * ROAD_FACTOR));
}
async function feeFor(fare) {
  const pct = Number(await getSetting('rideFeePercent'));
  return money(Math.max(0.25, fare * (Number.isFinite(pct) ? pct : 9) / 100));
}
async function notifyAdmins(text) {
  const admins = (await db.filter('users', u => u.role === 'admin' && u.active !== false)).slice(0, 25);
  for (const a of admins) { try { await notify(a.id, '🛵', text, null, { section: 'rides' }); } catch (e) { /* best effort */ } }
}
function publicDriver(u, extra = {}) {
  const r = u.rideDriver || {};
  return { id: u.id, name: u.name, initials: u.initials || null, color: u.color || null, profilePhotoUrl: u.profilePhotoUrl || null, rating: u.rating || null, jobs: u.jobs || 0, vehicle: r.vehicle, make: r.make || null, helmet: r.vehicle === 'motorbike' ? r.helmet === true : null, ...extra };
}

// ── RIDE RULES (the agreement riders and drivers accept before their first ride) ──
const roleKey = (u) => (u && u.role === 'provider' ? 'driver' : 'rider');
async function rulesState(u) {
  const key = roleKey(u);
  const version = await getSetting('rideRulesVersion');
  const text = await getSetting(key === 'driver' ? 'rideRulesDriver' : 'rideRulesRider');
  const acc = u && u.rideRules && u.rideRules[key];
  return { role: key, version, text, accepted: !!(acc && acc.version === version) };
}
router.get('/rides/rules', requireAuth, async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  res.json(await rulesState(u));
});
router.post('/rides/rules/accept', requireAuth, async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  const st = await rulesState(u);
  if (Number((req.body || {}).version) !== st.version) return res.status(409).json({ error: 'The rules changed. Please read them again.', ...st });
  await db.update('users', u.id, { rideRules: { ...(u.rideRules || {}), [st.role]: { version: st.version, at: new Date().toISOString() } } });
  res.json({ ...st, accepted: true });
});
async function needRules(u, res) {
  const st = await rulesState(u);
  if (st.accepted) return false;
  res.status(403).json({ code: 'ACCEPT_RIDE_RULES', error: 'Please read and accept the Ride Rules first.', ...st });
  return true;
}
// Optional night rule for motorbikes (off unless a super admin switches it on). Liberia is on UTC.
async function motorbikeBlockedNow() {
  const n = await getSetting('rideMotorbikeNight');
  if (!n || n.enabled !== true) return false;
  const h = new Date().getUTCHours();
  return n.startHour < n.endHour ? (h >= n.startHour && h < n.endHour) : (h >= n.startHour || h < n.endHour);
}

// ── RIDER SIDE ─────────────────────────────────────────────────────────
router.get('/rides/config', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  res.json({
    enabledCountries: await getSetting('rideEnabledCountries'),
    availableHere: await ridesOnFor(me && me.country),
    vehicles: RIDE_VEHICLES,
    maxKm: await getSetting('rideMaxKm'),
    answerMinutes: await getSetting('rideAnswerMinutes'),
    cashEnabled: (await getSetting('rideCashEnabled')) === true,
    autoReleaseHours: await getSetting('rideAutoReleaseHours'),
    waitMinutes: await getSetting('rideWaitMinutes'),
    feePercent: await getSetting('rideFeePercent'),
    docKinds: DOC_KINDS,
    requiredDocs: await requiredDocs(me && me.country),
    motorbikeBlockedNow: await motorbikeBlockedNow(),
    // set MAP_TILE_URL (and MAP_TILE_ATTRIBUTION) on the server to switch map provider without changing code
    tileUrl: process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttribution: process.env.MAP_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors',
  });
});

const lookupLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait a moment.' } });
function readPoint(raw, label) {
  if (!raw || typeof raw !== 'object' || !isValidCoordinate(Number(raw.latitude), Number(raw.longitude)) || (Number(raw.latitude) === 0 && Number(raw.longitude) === 0)) return { error: `${label} isn't a valid position. Please pin it again.` };
  const address = typeof raw.address === 'string' ? raw.address.trim().slice(0, 160) : '';
  return { point: { latitude: Math.round(Number(raw.latitude) * 1e6) / 1e6, longitude: Math.round(Number(raw.longitude) * 1e6) / 1e6, address: address || label } };
}

// GET /api/rides/drivers?pLat=&pLng=&dLat=&dLng=&passengers=
router.get('/rides/drivers', requireAuth, requireRole('customer'), lookupLimiter, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!(await ridesOnFor(me && me.country))) return res.json({ available: false, drivers: [], error: 'Rides are not available in your country yet.' });
  const q = req.query;
  const pickup = { latitude: Number(q.pLat), longitude: Number(q.pLng) }, drop = { latitude: Number(q.dLat), longitude: Number(q.dLng) };
  const passengers = Math.max(1, Math.min(8, parseInt(q.passengers, 10) || 1));
  const km = kmBetween(pickup, drop);
  if (km === null) return res.status(400).json({ error: 'Pin where you are being picked up and where you are going.' });
  const maxKm = await getSetting('rideMaxKm'), searchKm = await getSetting('rideSearchKm');
  if (km * ROAD_FACTOR > maxKm) return res.status(400).json({ error: `Rides can be up to about ${maxKm} km. This trip is further than that.` });
  const noBikes = await motorbikeBlockedNow();
  const cashOn = (await getSetting('rideCashEnabled')) === true;
  const busyIds = new Set((await db.filter('contracts', c => c.ride && OPEN_STATUSES.includes(c.status))).map(c => c.providerId)); // a driver with a ride open is not offered another
  const all = (await db.filter('users', u => isOnline(u) && !busyIds.has(u.id) && u.id !== me.id && sameText(u.country, me.country) && RIDE_VEHICLES[u.rideDriver.vehicle] >= passengers && !(noBikes && u.rideDriver.vehicle === 'motorbike')));
  const rows = [];
  for (const u of all) {
    const loc = u.rideDriver.lastLocation;
    const away = loc ? kmBetween(loc, pickup) : null;
    if (away === null || away > searchKm) continue;
    rows.push({ ...publicDriver(u), awayKm: away, fare: quote(u, km), seats: RIDE_VEHICLES[u.rideDriver.vehicle], cashOk: cashOn && u.rideDriver.acceptsCash === true && !!(await ridePass.activePass(u.id)) });
  }
  rows.sort((a, b) => a.awayKm - b.awayKm || (b.rating || 0) - (a.rating || 0));
  res.json({ available: true, tripKm: Math.round(km * ROAD_FACTOR * 10) / 10, drivers: rows.slice(0, 10), feePercent: await getSetting('rideFeePercent') });
});

const bookInFlight = new Set();
// A rider can ask for a few rides an hour, not dozens (stops spamming drivers).
const requestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, skipFailedRequests: true, keyGenerator: (req) => (req.user && req.user.sub) || 'anon', validate: false, standardHeaders: true, legacyHeaders: false, message: { error: 'You have asked for several rides in the last hour. Please wait a little before trying again.' } });
router.post('/rides', requireAuth, requireRole('customer'), requireCurrentTerms, requestLimiter, async (req, res) => {
  const b = req.body || {};
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me || me.verified !== true) return res.status(403).json({ code: 'VERIFY_IDENTITY', error: 'Please verify your identity first. For everyone\'s safety, rides are for ID-verified riders.' });
  if (me.onHold) return res.status(403).json({ error: 'Your account is temporarily paused pending a quick review.' });
  if (me.rideBlockedUntil && new Date(me.rideBlockedUntil) > new Date()) return res.status(403).json({ code: 'RIDES_PAUSED', error: `Ride requests are paused on your account until ${String(me.rideBlockedUntil).slice(0, 10)} because several drivers waited for you and you did not show up.` });
  if (!(await ridesOnFor(me.country))) return res.status(400).json({ error: 'Rides are not available in your country yet.' });
  if (await needRules(me, res)) return;
  if (bookInFlight.has(me.id)) return res.status(409).json({ error: 'Your ride request is already being processed. Please wait a moment.' });
  bookInFlight.add(me.id);
  try {
    const pk = readPoint(b.pickup, 'Pickup'), dp = readPoint(b.dropoff, 'Destination');
    if (pk.error || dp.error) return res.status(400).json({ error: pk.error || dp.error });
    const passengers = parseInt(b.passengers, 10) || 1;
    if (passengers < 1 || passengers > 8) return res.status(400).json({ error: 'Passengers must be between 1 and 8.' });
    const driver = await db.find('users', u => u.id === b.driverId && u.role === 'provider');
    if (!driver || !isOnline(driver) || driver.id === me.id || !sameText(driver.country, me.country) || RIDE_VEHICLES[driver.rideDriver.vehicle] < passengers) {
      return res.status(400).json({ code: 'PICK_DRIVER', error: 'That driver isn\'t available any more. Choose another from the list.' });
    }
    if (await db.find('contracts', c => c.providerId === driver.id && c.ride && OPEN_STATUSES.includes(c.status))) return res.status(400).json({ code: 'PICK_DRIVER', error: 'That driver has just taken another ride. Choose another from the list.' });
    if (driver.rideDriver.vehicle === 'motorbike' && await motorbikeBlockedNow()) return res.status(400).json({ error: 'Motorbike rides are paused at this hour. Choose another vehicle.' });
    const km = kmBetween(pk.point, dp.point);
    const maxKm = await getSetting('rideMaxKm');
    if (km === null || km * ROAD_FACTOR > maxKm) return res.status(400).json({ error: `Rides can be up to about ${maxKm} km.` });
    if (km < 0.1) return res.status(400).json({ error: 'The pickup and the destination are the same place.' });
    const fare = quote(driver, km);
    if (b.expectedFare === undefined || Math.abs(Number(b.expectedFare) - fare) > 0.009) {
      return res.status(409).json({ code: 'PRICE_CHANGED', fare, error: `${driver.name}'s fare for this trip is now $${fare.toFixed(2)}. Check it and approve again.` });
    }
    // v113: cash rides. Allowed only when a super admin has switched cash on, the driver has said they take
    // cash, and the driver has an active pass (so Trothen has nothing to collect from them per ride).
    const cash = b.payment === 'cash';
    if (cash && !((await getSetting('rideCashEnabled')) === true && driver.rideDriver.acceptsCash === true && await ridePass.activePass(driver.id))) {
      return res.status(400).json({ code: 'CASH_NOT_AVAILABLE', error: 'This driver does not take cash rides right now. Pay in the app, or choose another driver.' });
    }
    // One open ride at a time per rider: stops stacking requests on many drivers.
    const open = await db.find('contracts', c => c.customerId === me.id && c.ride && OPEN_STATUSES.includes(c.status));
    if (open) return res.status(409).json({ code: 'RIDE_OPEN', error: 'You already have a ride in progress or waiting for a driver. Finish or cancel it first.' });
    const { generateBookingNumber, fundEscrowForContract } = require('./marketplace.routes');
    const minutes = await getSetting('rideAnswerMinutes');
    const contract = {
      id: `ct_${nanoid(10)}`, bookingNumber: await generateBookingNumber(),
      customerId: me.id, providerId: driver.id,
      service: `Ride: ${pk.point.address} to ${dp.point.address}`.slice(0, 200),
      date: today(), time: 'Ride now', address: dp.point.address,
      jobLocation: { latitude: pk.point.latitude, longitude: pk.point.longitude, accuracyM: null, source: 'map', capturedAt: new Date().toISOString() },
      landmark: null,
      amount: fare, serviceFee: cash ? 0 : await feeFor(fare), laborAmount: fare,
      storeItems: [], storeGoodsTotal: 0, goodsOnly: false, materialsCost: null, storeStockHeld: false,
      loyaltyPointsRedeemed: 0, materialsAdvance: 0, materialsOnHand: null, photoUrls: [],
      status: 'pending_provider_confirmation', signedAt: null,
      payCurrency: b.payCurrency === 'local' ? 'local' : 'usd',
      payWith: cash ? null : require('../tokens').cleanPayWith(b.payWith), // v115
      providerResponseDeadline: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      ride: {
        pickup: pk.point, dropoff: dp.point, km: Math.round(km * ROAD_FACTOR * 10) / 10, passengers,
        vehicle: driver.rideDriver.vehicle, plate: driver.rideDriver.plate,
        pin: String(crypto.randomInt(1000, 10000)), pinAttempts: 0, pinLockedUntil: null,
        cash, shareToken: nanoid(24), startedAt: null, endedAt: null, driverArrivedAt: null, live: null, sos: [],
      },
    };
    if (!cash) try { await fundEscrowForContract(contract, me.id, contract.payCurrency); }
    catch (e) {
      console.error('[ride] payment failed:', e.message);
      if (e.expose) return res.status(e.status || 402).json({ code: e.code, ...(e.extra || {}), error: e.message }); // v115: e.g. not enough tokens
      return res.status(402).json({ code: 'PAYMENT_FAILED', error: 'Your payment could not be completed, so you were not charged and no ride was requested. Please try again.' });
    }
    await db.insert('contracts', contract);
    await notify(driver.id, '🛵', `Ride request #${contract.bookingNumber} from ${firstName(me.name)}: ${pk.point.address} to ${dp.point.address} (about ${contract.ride.km} km, $${fare.toFixed(2)}${cash ? ', the rider pays you in CASH' : ''}). Answer within ${minutes} minutes.`, 'bookingUpdates', { section: 'rides' });
    res.status(201).json({ ride: await rideView(contract, me.id) });
  } finally {
    bookInFlight.delete(me.id);
  }
});

// What each person is allowed to see of a ride.
async function rideView(c, viewerId) {
  const r = c.ride || {};
  const isRider = c.customerId === viewerId;
  const driver = await db.find('users', u => u.id === c.providerId);
  const rider = await db.find('users', u => u.id === c.customerId);
  const accepted = c.status === 'active' || c.status === 'completed';
  const waitMin = Number(await getSetting('rideWaitMinutes')) || 10, autoHrs = Number(await getSetting('rideAutoReleaseHours')) || 0;
  const live = c.status === 'active' && r.live && (Date.now() - new Date(r.live.at).getTime()) < 10 * 60 * 1000 ? r.live : null;
  return {
    id: c.id, number: c.bookingNumber, status: c.status, createdAt: c.createdAt, role: isRider ? 'rider' : 'driver',
    answerBy: c.status === 'pending_provider_confirmation' ? c.providerResponseDeadline : null,
    pickup: r.pickup, dropoff: r.dropoff, km: r.km, passengers: r.passengers,
    fare: c.amount, fee: c.serviceFee, totalPaid: money((c.amount || 0) + (c.serviceFee || 0)), cash: r.cash === true, payInCash: r.cash === true ? c.amount : null,
    // the PIN is for the rider only, and only until the trip starts
    pin: isRider && c.status === 'active' && !r.startedAt ? r.pin : null,
    pinLocked: !!(r.pinLockedUntil && new Date(r.pinLockedUntil) > new Date()),
    driver: driver ? { ...publicDriver(driver), plate: accepted ? r.plate : null } : null,
    rider: rider ? { name: isRider ? rider.name : firstName(rider.name) } : null,
    driverArrivedAt: r.driverArrivedAt || null, startedAt: r.startedAt || null, endedAt: r.endedAt || null,
    live: live ? { latitude: live.latitude, longitude: live.longitude, accuracyM: live.accuracyM || null, speedKmh: live.speedKmh || null, secondsAgo: Math.round((Date.now() - new Date(live.at).getTime()) / 1000) } : null,
    stale: !!(live && Date.now() - new Date(live.at).getTime() > 120000),
    phase: c.status === 'completed' ? 'delivered' : c.status !== 'active' ? c.status : r.startedAt ? 'to_destination' : 'to_pickup',
    remainingKm: live && c.status === 'active' ? kmBetween(live, r.startedAt ? r.dropoff : r.pickup) : null,
    etaMinutes: live && c.status === 'active' ? (() => { const k = kmBetween(live, r.startedAt ? r.dropoff : r.pickup); if (k == null) return null; const sp = Math.max(8, Math.min(60, live.speedKmh > 3 ? live.speedKmh : ({ motorbike: 25, keke: 20, car: 30, van: 25 }[r.vehicle] || 25))); return Math.max(1, Math.round(k * ROAD_FACTOR / sp * 60)); })() : null,
    trail: c.status === 'active' && Array.isArray(r.track) ? r.track.slice(-120).map(p => [p[0], p[1]]) : [],
    // each person can call, text or WhatsApp the other, only while the ride is open
    contact: c.status === 'active' ? (isRider ? (driver && driver.phone ? { name: driver.name, phone: String(driver.phone).trim() } : null) : (rider && rider.phone ? { name: firstName(rider.name), phone: String(rider.phone).trim() } : null)) : null,
    shareUrl: isRider && c.status === 'active' ? `/ride-share/${r.shareToken}` : null,
    sosCount: (r.sos || []).length,
    canConfirm: isRider && c.status === 'active' && !!r.startedAt,
    canCancel: c.status === 'pending_provider_confirmation' || (c.status === 'active' && !r.startedAt),
    // v112: waiting for a rider who does not come, and money released if the rider says nothing
    noShowOpensAt: !isRider && c.status === 'active' && !r.startedAt && r.driverArrivedAt ? new Date(new Date(r.driverArrivedAt).getTime() + waitMin * 60000).toISOString() : null,
    canNoShow: !isRider && c.status === 'active' && !r.startedAt && !!r.driverArrivedAt && Date.now() >= new Date(r.driverArrivedAt).getTime() + waitMin * 60000,
    waitMinutes: waitMin,
    autoReleaseAt: c.status === 'active' && r.endedAt && autoHrs > 0 ? new Date(new Date(r.endedAt).getTime() + autoHrs * 3600000).toISOString() : null,
    autoReleased: r.autoReleased === true,
  };
}

router.get('/rides/mine', requireAuth, async (req, res) => {
  const mine = (await db.filter('contracts', c => c.ride && (c.customerId === req.user.sub || c.providerId === req.user.sub))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
  res.json({ rides: await Promise.all(mine.map(c => rideView(c, req.user.sub))) });
});
router.get('/rides/:id', requireAuth, async (req, res) => {
  const c = await db.find('contracts', x => x.id === req.params.id && x.ride && (x.customerId === req.user.sub || x.providerId === req.user.sub));
  if (!c) return res.status(404).json({ error: 'Ride not found' });
  res.set('Cache-Control', 'no-store');
  res.json({ ride: await rideView(c, req.user.sub) });
});

// ── DRIVER SIDE ────────────────────────────────────────────────────────
function driverState(u) {
  const r = u.rideDriver || {};
  return {
    status: r.status || 'none', vehicle: r.vehicle || null, make: r.make || '', plate: r.plate || '', licenceNumber: r.licenceNumber || '', licenceExpiry: r.licenceExpiry || '', insuranceExpiry: r.insuranceExpiry || '', roadworthyExpiry: r.roadworthyExpiry || '',
    acceptsCash: r.acceptsCash === true, helmet: r.helmet === true, docs: Object.fromEntries(Object.keys(DOC_KINDS).map(k => [k, !!(r.docs && r.docs[k])])),
    rates: rates(u), online: isOnline(u), onlineUntil: isOnline(u) ? r.onlineUntil : null, rejectReason: r.rejectReason || null,
  };
}
router.get('/rides/driver/me', requireAuth, requireRole('provider'), async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  const byVehicle = {}; for (const v of Object.keys(RIDE_VEHICLES)) byVehicle[v] = await requiredDocs(u.country, v);
  res.json({ ...driverState(u), requiredDocs: await requiredDocs(u.country, u.rideDriver && u.rideDriver.vehicle), requiredByVehicle: byVehicle, rules: await rulesState(u), commissionPercent: await getSetting('rideCommissionPercent'), availableHere: await ridesOnFor(u.country), country: u.country, vehicles: RIDE_VEHICLES, docKinds: DOC_KINDS, feePercent: await getSetting('rideFeePercent'),
    passEnabled: (await getSetting('ridePassEnabled')) !== false, passPlans: await ridePass.plans(), pass: await ridePass.summary(u.id), cashEnabled: (await getSetting('rideCashEnabled')) === true });
});
// v113: buy a Driver Pass. The price the driver saw must still be the price.
const passLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyGenerator: (req) => (req.user && req.user.sub) || 'anon', validate: false, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many purchases. Please wait a little.' } });
router.post('/rides/driver/pass', requireAuth, requireRole('provider'), passLimiter, async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  if (!isApproved(u)) return res.status(403).json({ error: 'You can buy a pass once your driver application is approved and your papers are in date.' });
  if (!(await ridesOnFor(u.country))) return res.status(403).json({ error: 'Rides are not open in your country right now.' });
  const r = await ridePass.buy(u, (req.body || {}).planId, (req.body || {}).expectedPrice);
  if (!r.ok) return res.status(r.status).json({ code: r.code, price: r.price, error: r.error });
  res.status(201).json({ pass: await ridePass.summary(u.id) });
});
// v113: whether this driver takes cash rides (they only get them while a pass is active)
router.put('/rides/driver/cash', requireAuth, requireRole('provider'), async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  if (!u.rideDriver) return res.status(400).json({ error: 'Apply to be a ride driver first.' });
  const on = (req.body || {}).accepts === true;
  if (on && (await getSetting('rideCashEnabled')) !== true) return res.status(403).json({ error: 'Cash rides are not switched on yet.' });
  await db.update('users', u.id, { rideDriver: { ...u.rideDriver, acceptsCash: on } });
  res.json({ acceptsCash: on, hasPass: !!(await ridePass.activePass(u.id)) });
});
router.post('/rides/driver/apply', requireAuth, requireRole('provider'), async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  if (!(await ridesOnFor(u.country))) return res.status(400).json({ error: 'Rides are not open in your country yet.' });
  if (u.verified !== true) return res.status(403).json({ error: 'Your ID must be verified first.' });
  if (await needRules(u, res)) return;
  const cur = u.rideDriver || {};
  if (cur.status === 'pending') return res.status(400).json({ error: 'Your application is already being reviewed.' });
  const { vehicle, make, plate, licenceNumber, licenceExpiry, helmet, insuranceExpiry, roadworthyExpiry } = req.body || {};
  if (!RIDE_VEHICLES[vehicle]) return res.status(400).json({ error: `Choose a vehicle: ${Object.keys(RIDE_VEHICLES).join(', ')}.` });
  const cleanPlate = String(plate || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!/^[A-Z0-9 -]{3,15}$/.test(cleanPlate)) return res.status(400).json({ error: 'Enter the number plate exactly as it is on the vehicle (3 to 15 letters and numbers).' });
  const lic = String(licenceNumber || '').trim();
  if (lic.length < 4 || lic.length > 30) return res.status(400).json({ error: 'Enter your driver\'s licence number.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(licenceExpiry || '')) || licenceExpiry < today()) return res.status(400).json({ error: 'Your licence must not be expired. Enter its expiry date.' });
  const needDocs = await requiredDocs(u.country, vehicle);
  const needIns = needDocs.includes('insurance'), needRw = needDocs.includes('roadworthy');
  const insOk = DATE_RX.test(String(insuranceExpiry || '')), rwOk = DATE_RX.test(String(roadworthyExpiry || ''));
  if (needIns && (!insOk || insuranceExpiry < today())) return res.status(400).json({ error: 'Enter the date your insurance or road permit runs out. It must not be expired.' });
  if (!needIns && insuranceExpiry && (!insOk || insuranceExpiry < today())) return res.status(400).json({ error: 'The insurance or permit date must be a real date that has not passed.' });
  if (needRw && (!rwOk || roadworthyExpiry < today())) return res.status(400).json({ error: 'Enter the date your roadworthiness or inspection certificate runs out. It must not be expired.' });
  if (!needRw && roadworthyExpiry && (!rwOk || roadworthyExpiry < today())) return res.status(400).json({ error: 'The roadworthiness date must be a real date that has not passed.' });
  if (vehicle === 'motorbike' && helmet !== true) return res.status(400).json({ error: 'A motorbike rider must carry a helmet for the passenger. Tick the box to confirm you do.' });
  const rideDriver = { ...cur, status: 'draft', vehicle, make: String(make || '').trim().slice(0, 40), plate: cleanPlate, licenceNumber: lic, licenceExpiry, insuranceExpiry: insOk ? insuranceExpiry : null, roadworthyExpiry: rwOk ? roadworthyExpiry : null, expiryWarned: {}, helmet: helmet === true, online: false, onlineUntil: null, updatedAt: new Date().toISOString() };
  await db.update('users', u.id, { rideDriver });
  res.json(driverState({ ...u, rideDriver }));
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, require('../uploads').PRIVATE_UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `ride_doc_${req.user.sub}_${nanoid(14)}${file.mimetype === 'application/pdf' ? '.pdf' : file.mimetype === 'image/png' ? '.png' : '.jpg'}`),
});
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (req, file, cb) => ['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype) ? cb(null, true) : cb(new Error('Upload a JPEG, PNG or PDF file')) });
router.post('/rides/driver/documents/:kind', requireAuth, requireRole('provider'), (req, res, next) => {
  uploadDoc.single('file')(req, res, (err) => err ? res.status(400).json({ error: err.message || 'Upload failed' }) : next());
}, async (req, res) => {
  const { PRIVATE_UPLOADS_DIR, verifyImageMagicBytes, verifyPdfMagicBytes } = require('../uploads');
  const drop = () => { if (req.file) { try { fs.unlinkSync(path.join(PRIVATE_UPLOADS_DIR, req.file.filename)); } catch (e) {} } };
  if (!DOC_KINDS[req.params.kind]) { drop(); return res.status(400).json({ error: 'Unknown document type' }); }
  if (!req.file) return res.status(400).json({ error: 'A file is required' });
  const u = await db.find('users', x => x.id === req.user.sub);
  if (!u.rideDriver || !['draft', 'rejected', 'approved'].includes(u.rideDriver.status)) { drop(); return res.status(400).json({ error: 'Save your vehicle and licence details first.' }); }
  const fp = path.join(PRIVATE_UPLOADS_DIR, req.file.filename);
  const ok = req.file.mimetype === 'application/pdf' ? verifyPdfMagicBytes(fp) : verifyImageMagicBytes(fp, req.file.mimetype);
  if (!ok) { drop(); return res.status(400).json({ error: 'That file doesn\'t look like a genuine document of the type it claims to be.' }); }
  const fc = require('../file-crypto'); const encrypted = fc.isEnabled() ? fc.encryptFileInPlace(fp) : false;
  const old = u.rideDriver.docs && u.rideDriver.docs[req.params.kind];
  if (old) { try { fs.unlinkSync(path.join(PRIVATE_UPLOADS_DIR, path.basename(old.filename))); } catch (e) {} }
  const docs = { ...(u.rideDriver.docs || {}), [req.params.kind]: { filename: req.file.filename, mimeType: req.file.mimetype, encrypted, at: new Date().toISOString() } };
  // Replacing a document on an approved account sends it back for a fresh check.
  const status = u.rideDriver.status === 'approved' ? 'draft' : u.rideDriver.status;
  const rideDriver = { ...u.rideDriver, docs, status, online: status === 'approved' ? u.rideDriver.online : false };
  await db.update('users', u.id, { rideDriver });
  res.json(driverState({ ...u, rideDriver }));
});
router.post('/rides/driver/submit', requireAuth, requireRole('provider'), async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  const r = u.rideDriver;
  if (!r || !['draft', 'rejected'].includes(r.status)) return res.status(400).json({ error: 'Nothing to submit. Save your details first.' });
  const need = await requiredDocs(u.country, r.vehicle);
  const missing = need.filter(k => !(r.docs && r.docs[k]));
  if (missing.length) return res.status(400).json({ error: 'Upload these first: ' + missing.map(k => DOC_KINDS[k]).join('; ') + '.' });
  if (r.licenceExpiry < today()) return res.status(400).json({ error: 'Your licence has expired.' });
  if (need.includes('insurance') && !(r.insuranceExpiry && r.insuranceExpiry >= today())) return res.status(400).json({ error: 'Add the date your insurance or road permit runs out (it must not be expired), then submit again.' });
  if (need.includes('roadworthy') && !(r.roadworthyExpiry && r.roadworthyExpiry >= today())) return res.status(400).json({ error: 'Add the date your roadworthiness or inspection certificate runs out (it must not be expired), then submit again.' });
  await db.update('users', u.id, { rideDriver: { ...r, status: 'pending', submittedAt: new Date().toISOString(), rejectReason: null } });
  await notifyAdmins(`${u.name} applied to be a ride driver (${r.vehicle}, ${r.plate}). Open Rides to review the documents.`);
  res.json(driverState({ ...u, rideDriver: { ...r, status: 'pending' } }));
});
router.put('/rides/driver/rates', requireAuth, requireRole('provider'), async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  if (!u.rideDriver) return res.status(400).json({ error: 'Apply to be a ride driver first.' });
  const { baseFee, perKm } = req.body || {};
  if (typeof baseFee !== 'number' || !(baseFee >= 0.5) || baseFee > 100) return res.status(400).json({ error: 'Your starting fare must be between $0.50 and $100' });
  if (typeof perKm !== 'number' || perKm < 0 || perKm > 20) return res.status(400).json({ error: 'Your price per kilometre must be between $0 and $20' });
  const rideDriver = { ...u.rideDriver, rates: { baseFee: money(baseFee), perKm: Math.round(perKm * 10000) / 10000 } };
  await db.update('users', u.id, { rideDriver });
  res.json(driverState({ ...u, rideDriver }));
});
router.post('/rides/driver/online', requireAuth, requireRole('provider'), async (req, res) => {
  const u = await db.find('users', x => x.id === req.user.sub);
  if (!isApproved(u)) return res.status(403).json({ error: 'You can go online once your application is approved and your licence is in date.' });
  if (!(await ridesOnFor(u.country))) return res.status(403).json({ error: 'Rides are not open in your country right now.' });
  const { online, latitude, longitude } = req.body || {};
  if (online === true) {
    if (u.rideDriver.vehicle === 'motorbike' && await motorbikeBlockedNow()) return res.status(403).json({ error: 'Motorbike rides are paused at this hour.' });
    if (!isValidCoordinate(latitude, longitude)) return res.status(400).json({ error: 'We need your location to show you to riders nearby. Allow location and try again.' });
    const busy = await db.find('contracts', c => c.providerId === u.id && c.ride && OPEN_STATUSES.includes(c.status));
    const rideDriver = { ...u.rideDriver, online: true, onlineUntil: new Date(Date.now() + 12 * 3600 * 1000).toISOString(), lastLocation: { latitude, longitude, at: new Date().toISOString() } };
    await db.update('users', u.id, { rideDriver });
    return res.json({ ...driverState({ ...u, rideDriver }), busy: !!busy });
  }
  const rideDriver = { ...u.rideDriver, online: false, onlineUntil: null };
  await db.update('users', u.id, { rideDriver });
  res.json(driverState({ ...u, rideDriver }));
});

// ── THE TRIP ───────────────────────────────────────────────────────────
async function withRide(req, res, who, fn) {
  if (contractStatusLocks.has(req.params.id)) return res.status(409).json({ error: 'This ride is being updated. Please try again in a moment.' });
  contractStatusLocks.add(req.params.id);
  try {
    const c = await db.find('contracts', x => x.id === req.params.id && x.ride && (who === 'driver' ? x.providerId === req.user.sub : who === 'rider' ? x.customerId === req.user.sub : (x.customerId === req.user.sub || x.providerId === req.user.sub)));
    if (!c) return res.status(404).json({ error: 'Ride not found' });
    return await fn(c);
  } finally { contractStatusLocks.delete(req.params.id); }
}
const liveLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many location updates.' } });

router.post('/rides/:id/arrived', requireAuth, requireRole('provider'), (req, res) => withRide(req, res, 'driver', async (c) => {
  if (c.status !== 'active') return res.status(400).json({ error: `This ride is ${c.status}.` });
  if (c.ride.startedAt) return res.status(400).json({ error: 'The trip has already started.' });
  const ride = { ...c.ride, driverArrivedAt: c.ride.driverArrivedAt || new Date().toISOString() };
  const u = await db.update('contracts', c.id, { ride });
  await notify(c.customerId, '📍', `Your driver has arrived. Check the plate (${ride.plate}) and give them your PIN to start the trip.`, 'bookingUpdates', { section: 'rides' });
  res.json({ ride: await rideView(u, req.user.sub) });
}));
router.post('/rides/:id/location', requireAuth, requireRole('provider'), liveLimiter, (req, res) => withRide(req, res, 'driver', async (c) => {
  if (Array.isArray((req.body || {}).points) && c.status === 'active') { // v111: positions kept while the phone had no signal
    const tm = require('../track-merge');
    const batch = tm.cleanBatch(req.body.points);
    if (!batch.length) return res.status(400).json({ error: 'None of those positions could be used' });
    const live = tm.newestLive(batch, c.ride.live);
    await db.update('contracts', c.id, { ride: { ...c.ride, live, track: tm.mergeTrack(c.ride.track, batch) } });
    const u = await db.find('users', x => x.id === req.user.sub);
    if (u && u.rideDriver) await db.update('users', u.id, { rideDriver: { ...u.rideDriver, lastLocation: live } });
    return res.json({ ok: true, kept: batch.length });
  }
  const { latitude, longitude, accuracyM, speedMps } = req.body || {};
  if (c.status !== 'active' || !isValidCoordinate(latitude, longitude)) return res.status(400).json({ error: 'Not an active ride or bad position.' });
  const now = Date.now();
  if (c.ride.live && now - new Date(c.ride.live.at).getTime() < 5000) return res.json({ ok: true, kept: false });
  const acc = Number(accuracyM);
  const live = { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6, accuracyM: Number.isFinite(acc) && acc > 0 && acc < 100000 ? Math.round(acc) : null, speedKmh: Number.isFinite(Number(speedMps)) && Number(speedMps) >= 0 ? Math.round(Number(speedMps) * 3.6) : null, at: new Date(now).toISOString() };
  let track = Array.isArray(c.ride.track) ? c.ride.track : [];
  const last = track[track.length - 1];
  if (!last || now - last[2] >= 15000) track = [...track, [Math.round(latitude * 1e5) / 1e5, Math.round(longitude * 1e5) / 1e5, now]];
  if (track.length > 400) track = track.filter((_, i) => i === 0 || i % 2 === 0 || i === track.length - 1);
  await db.update('contracts', c.id, { ride: { ...c.ride, live, track } });
  const u = await db.find('users', x => x.id === req.user.sub);
  if (u && u.rideDriver) await db.update('users', u.id, { rideDriver: { ...u.rideDriver, lastLocation: live } });
  res.json({ ok: true, kept: true });
}));
router.post('/rides/:id/start', requireAuth, requireRole('provider'), (req, res) => withRide(req, res, 'driver', async (c) => {
  if (c.status !== 'active') return res.status(400).json({ error: `This ride is ${c.status}.` });
  if (c.ride.startedAt) return res.status(400).json({ error: 'The trip has already started.' });
  if (c.ride.pinLockedUntil && new Date(c.ride.pinLockedUntil) > new Date()) return res.status(429).json({ error: 'Too many wrong PINs. Wait a few minutes, or ask the rider to cancel.' });
  const pin = String((req.body || {}).pin || '').trim();
  if (pin !== c.ride.pin) {
    const attempts = (c.ride.pinAttempts || 0) + 1;
    const locked = attempts >= 5;
    await db.update('contracts', c.id, { ride: { ...c.ride, pinAttempts: locked ? 0 : attempts, pinLockedUntil: locked ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null } });
    if (locked) await notify(c.customerId, '⚠️', 'Someone entered the wrong trip PIN 5 times. If this is not your driver, do not get in and cancel the ride.', 'bookingUpdates', { section: 'rides' });
    return res.status(400).json({ error: locked ? 'Wrong PIN 5 times. Locked for 10 minutes.' : 'That PIN is not right. Ask the rider for the 4 digits shown in their app.' });
  }
  const { latitude, longitude } = req.body || {};
  const startedAt = new Date().toISOString();
  const passOn = !c.ride.cash && !!(await ridePass.activePass(c.providerId)); // v113: a driver on a pass keeps the whole fare
  const u = await db.update('contracts', c.id, { ride: { ...c.ride, commissionFree: passOn, startedAt, pinAttempts: 0, startLocation: isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null } });
  await notify(c.customerId, '🛵', 'Your trip has started. You can share it with someone you trust from the Rides page.', 'bookingUpdates', { section: 'rides' });
  res.json({ ride: await rideView(u, req.user.sub) });
}));
router.post('/rides/:id/end', requireAuth, requireRole('provider'), (req, res) => withRide(req, res, 'driver', async (c) => {
  if (c.status !== 'active' || !c.ride.startedAt) return res.status(400).json({ error: 'This trip has not started.' });
  const u = await db.update('contracts', c.id, { ride: { ...c.ride, endedAt: c.ride.endedAt || new Date().toISOString(), live: null } });
  await notify(c.customerId, '🏁', 'Your driver says you have arrived. If you are at your destination, confirm in the app so the driver is paid.', 'bookingUpdates', { section: 'rides' });
  res.json({ ride: await rideView(u, req.user.sub) });
}));
// v112: the driver has waited at the pickup and the rider has not come. The rider is
// refunded in full (no money is taken without a person looking), the ride ends, and the
// rider gets a strike; three strikes in 30 days pause ride requests for 7 days.
router.post('/rides/:id/no-show', requireAuth, requireRole('provider'), (req, res) => withRide(req, res, 'driver', async (c) => {
  if (c.status !== 'active' || c.ride.startedAt) return res.status(400).json({ error: 'This ride is not waiting at the pickup.' });
  if (!c.ride.driverArrivedAt) return res.status(400).json({ error: 'Tap "I have arrived" first, then wait for the rider.' });
  const waitMin = Number(await getSetting('rideWaitMinutes')) || 10;
  const opens = new Date(c.ride.driverArrivedAt).getTime() + waitMin * 60000;
  if (Date.now() < opens) return res.status(400).json({ error: `Please wait the full ${waitMin} minutes first. You can report it at ${new Date(opens).toISOString().slice(11, 16)} UTC.` });
  const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
  if (escrow && escrow.status === 'held') await db.update('escrowTransactions', escrow.id, { status: 'refunded' }); await require('../tokens').refundEscrow(escrow && escrow.id); // v115: tokens back
  try { await require('../loyalty').givePointsBack(c); } catch (e) { /* best effort */ }
  const u = await db.update('contracts', c.id, { status: 'cancelled', cancelReasonCategory: 'rider_no_show', cancelledByRole: 'provider', protectedCancellation: false, ride: { ...c.ride, noShow: true, live: null, track: null } });
  const rider = await db.find('users', x => x.id === c.customerId);
  if (rider) {
    const cutoff = Date.now() - 30 * 86400000;
    const strikes = [...(rider.rideNoShows || []).filter(t => new Date(t).getTime() > cutoff), new Date().toISOString()];
    const patch = { rideNoShows: strikes };
    if (strikes.length >= 3) patch.rideBlockedUntil = new Date(Date.now() + 7 * 86400000).toISOString();
    await db.update('users', rider.id, patch);
    await notify(rider.id, '⚠️', strikes.length >= 3 ? `The driver waited ${waitMin} minutes for ride #${c.bookingNumber} and you did not come. This is the third time in 30 days, so ride requests are paused for 7 days.${c.ride.cash ? '' : ' You were refunded.'}` : `The driver waited ${waitMin} minutes for ride #${c.bookingNumber} and you did not come, so the ride was cancelled${c.ride.cash ? '' : ' and you were refunded'}. Repeated no-shows pause ride requests.`, 'bookingUpdates', { section: 'rides' });
  }
  res.json({ ride: await rideView(u, req.user.sub) });
}));
router.post('/rides/:id/confirm', requireAuth, requireRole('customer'), (req, res) => withRide(req, res, 'rider', async (c) => {
  if (c.status !== 'active' || !c.ride.startedAt) return res.status(400).json({ error: 'This trip has not started yet.' });
  const { completeContractCore } = require('./payments.routes');
  await completeContractCore(c, 0, req.user.sub);
  await db.update('contracts', c.id, { ride: { ...c.ride, endedAt: c.ride.endedAt || new Date().toISOString(), live: null, track: null } });
  const fresh = await db.find('contracts', x => x.id === c.id);
  res.json({ ride: await rideView(fresh, req.user.sub) });
}));

// v113: a problem on a ride that has no held money (a cash ride): overcharging, a rude driver,
// anything the rider or driver wants the Trothen team to look at. It goes to the same list as safety alerts.
router.post('/rides/:id/report', requireAuth, rateLimit({ windowMs: 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false, message: { error: 'Please wait a moment.' } }), async (req, res) => {
  const c = await db.find('contracts', x => x.id === req.params.id && x.ride && (x.customerId === req.user.sub || x.providerId === req.user.sub));
  if (!c) return res.status(404).json({ error: 'Ride not found' });
  const note = typeof (req.body || {}).note === 'string' ? req.body.note.trim().slice(0, 500) : '';
  if (note.length < 10) return res.status(400).json({ error: 'Tell us what happened in at least a few words.' });
  const me = await db.find('users', u => u.id === req.user.sub);
  const evt = { id: `sos_${nanoid(10)}`, contractId: c.id, bookingNumber: c.bookingNumber, kind: 'report', raisedBy: me.id, raisedByName: me.name, raisedByRole: me.id === c.customerId ? 'rider' : 'driver', location: null, note, status: 'open', createdAt: new Date().toISOString() };
  await db.insert('rideSafetyEvents', evt);
  await notifyAdmins(`Problem reported on ${c.ride.cash ? 'CASH ' : ''}ride #${c.bookingNumber} by the ${evt.raisedByRole} (${me.name}): ${note.slice(0, 120)}`);
  res.status(201).json({ ok: true, message: 'Thank you. The Trothen team has been told and will look into it.' });
});

// Either person can raise an alarm. It goes to the Trothen team straight away.
const sosLimiter = rateLimit({ windowMs: 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false, message: { error: 'Alert already sent. Please wait a moment.' } });
router.post('/rides/:id/sos', requireAuth, sosLimiter, async (req, res) => {
  const c = await db.find('contracts', x => x.id === req.params.id && x.ride && (x.customerId === req.user.sub || x.providerId === req.user.sub));
  if (!c) return res.status(404).json({ error: 'Ride not found' });
  const { latitude, longitude, note } = req.body || {};
  const me = await db.find('users', u => u.id === req.user.sub);
  const evt = { id: `sos_${nanoid(10)}`, contractId: c.id, bookingNumber: c.bookingNumber, raisedBy: me.id, raisedByName: me.name, raisedByRole: me.id === c.customerId ? 'rider' : 'driver',
    location: isValidCoordinate(latitude, longitude) ? { latitude, longitude } : (c.ride.live || null), note: typeof note === 'string' ? note.trim().slice(0, 300) : '', status: 'open', createdAt: new Date().toISOString() };
  await db.insert('rideSafetyEvents', evt);
  await db.update('contracts', c.id, { ride: { ...c.ride, sos: [...(c.ride.sos || []), { at: evt.createdAt, by: evt.raisedByRole }] } });
  await notifyAdmins(`🚨 SAFETY ALERT on ride #${c.bookingNumber} from the ${evt.raisedByRole} (${me.name}). Open Rides now.`);
  const other = me.id === c.customerId ? c.providerId : c.customerId;
  await notify(other, '🚨', `A safety alert was raised on ride #${c.bookingNumber}. The Trothen team has been told.`, 'bookingUpdates', { section: 'rides' });
  res.status(201).json({ ok: true, message: 'The Trothen team has been alerted. If you are in danger, call your local emergency number now.' });
});

// ── SHARE MY TRIP (public, read-only, no login) ─────────────────────────
const shareLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } });
router.get('/ride-share/:token', shareLimiter, async (req, res) => {
  const t = String(req.params.token || '');
  if (!/^[A-Za-z0-9_-]{24}$/.test(t)) return res.status(404).json({ error: 'This link is not valid.' });
  const c = await db.find('contracts', x => x.ride && x.ride.shareToken === t);
  if (!c) return res.status(404).json({ error: 'This link is not valid.' });
  const driver = await db.find('users', u => u.id === c.providerId);
  const rider = await db.find('users', u => u.id === c.customerId);
  const over = c.status === 'completed' || c.status === 'cancelled' || c.status === 'declined' || c.status === 'expired';
  if (over && c.completedAt && Date.now() - new Date(c.completedAt).getTime() > 3600 * 1000) return res.status(410).json({ error: 'This trip has ended and the link has expired.' });
  const live = c.status === 'active' && c.ride.live && (Date.now() - new Date(c.ride.live.at).getTime()) < 10 * 60 * 1000 ? c.ride.live : null;
  res.set('Cache-Control', 'no-store');
  res.json({
    rider: firstName(rider && rider.name), driver: driver ? firstName(driver.name) : null,
    vehicle: c.ride.vehicle, plate: c.status === 'pending_provider_confirmation' ? null : c.ride.plate,
    from: c.ride.pickup.address, to: c.ride.dropoff.address, destination: { latitude: c.ride.dropoff.latitude, longitude: c.ride.dropoff.longitude },
    status: over ? 'ended' : (c.ride.startedAt ? 'on_trip' : (c.status === 'active' ? 'driver_coming' : 'waiting')),
    live: live ? { latitude: live.latitude, longitude: live.longitude, secondsAgo: Math.round((Date.now() - new Date(live.at).getTime()) / 1000) } : null,
  });
});

// ── ADMIN ──────────────────────────────────────────────────────────────
async function adminGate(req, res, next) {
  const m = await db.find('users', u => u.id === req.user.sub);
  if (!m || m.active === false) return res.status(403).json({ error: 'This account has been suspended.' });
  if (!m.isSuperAdmin && m.adminDepartment && !['verification', 'customer_service'].includes(m.adminDepartment)) return res.status(403).json({ error: `Your admin account is scoped to the ${m.adminDepartment} team and doesn't have access to this.` });
  req.adminUser = m; next();
}
const gate = [requireAuth, requireRole('admin'), adminGate];

router.get('/admin/rides/overview', gate, async (req, res) => {
  const drivers = await db.filter('users', u => u.rideDriver && u.rideDriver.status);
  const by = (s) => drivers.filter(u => u.rideDriver.status === s).length;
  const open = await db.filter('contracts', c => c.ride && OPEN_STATUSES.includes(c.status));
  const sos = (await db.all('rideSafetyEvents')).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30);
  res.json({
    settings: { passEnabled: (await getSetting('ridePassEnabled')) !== false, passPlans: await ridePass.plans(), cashEnabled: (await getSetting('rideCashEnabled')) === true, autoReleaseHours: await getSetting('rideAutoReleaseHours'), noStartHours: await getSetting('rideNoStartHours'), stuckHours: await getSetting('rideStuckHours'), waitMinutes: await getSetting('rideWaitMinutes'), trackKeepDays: await getSetting('rideTrackKeepDays'), enabledCountries: await getSetting('rideEnabledCountries'), maxKm: await getSetting('rideMaxKm'), searchKm: await getSetting('rideSearchKm'), answerMinutes: await getSetting('rideAnswerMinutes'), feePercent: await getSetting('rideFeePercent'), commissionPercent: await getSetting('rideCommissionPercent'), requireInsurance: (await getSetting('rideRequireInsurance')) !== false, motorbikeNight: await getSetting('rideMotorbikeNight'), rulesVersion: await getSetting('rideRulesVersion'), rulesRider: await getSetting('rideRulesRider'), rulesDriver: await getSetting('rideRulesDriver') },
    canEditSettings: req.adminUser.isSuperAdmin === true,
    docKinds: DOC_KINDS, docRules: (await getSetting('rideDocRules')) || [], standardDocs: await requiredDocs('', ''),
    counts: { pending: by('pending'), approved: by('approved'), rejected: by('rejected'), suspended: by('suspended'), openRides: open.length, openAlerts: sos.filter(s => s.status === 'open').length },
    applications: (await Promise.all(drivers.filter(u => ['pending', 'approved', 'suspended'].includes(u.rideDriver.status)).map(async u => ({ u, req1: await requiredDocs(u.country, u.rideDriver.vehicle) })))).sort((a, b) => (a.u.rideDriver.status === 'pending' ? -1 : 1) - (b.u.rideDriver.status === 'pending' ? -1 : 1)).slice(0, 100).map(({ u, req1 }) => ({
      userId: u.id, name: u.name, country: u.country, city: u.city, status: u.rideDriver.status, vehicle: u.rideDriver.vehicle, make: u.rideDriver.make, plate: u.rideDriver.plate,
      licenceNumber: u.rideDriver.licenceNumber, licenceExpiry: u.rideDriver.licenceExpiry, insuranceExpiry: u.rideDriver.insuranceExpiry || null, roadworthyExpiry: u.rideDriver.roadworthyExpiry || null, helmet: u.rideDriver.helmet === true, submittedAt: u.rideDriver.submittedAt || null,
      docs: Object.fromEntries(Object.keys(DOC_KINDS).map(k => [k, !!(u.rideDriver.docs && u.rideDriver.docs[k])])), required: req1, missing: req1.filter(k => !(u.rideDriver.docs && u.rideDriver.docs[k])), jobs: u.jobs || 0, rating: u.rating || null,
    })),
    alerts: sos,
    passes: await ridePass.stats(),
    // the 40 most recent rides, so support can answer "what happened to my ride?"
    recent: await Promise.all((await db.filter('contracts', c => !!c.ride)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 40).map(async c => {
      const rd = await db.find('users', u => u.id === c.customerId), dr = await db.find('users', u => u.id === c.providerId);
      return { id: c.id, number: c.bookingNumber, status: c.status, createdAt: c.createdAt, rider: rd ? rd.name : '', driver: dr ? dr.name : '', vehicle: c.ride.vehicle, km: c.ride.km, fare: c.amount, from: c.ride.pickup && c.ride.pickup.address, to: c.ride.dropoff && c.ride.dropoff.address,
        sos: (c.ride.sos || []).length, note: [c.ride.cash ? 'Cash' : '', c.ride.noShow ? 'Rider did not show' : c.ride.autoReleased ? (c.ride.cash ? 'Closed automatically' : 'Paid automatically') : c.cancelReasonCategory === 'ride_not_started' ? 'Never started' : c.ride.stuckAlertedAt && c.status === 'active' ? 'Stuck: not ended' : ''].filter(Boolean).join(' · ') };
    })),
  });
});
router.get('/admin/rides/applications/:userId/doc/:kind', gate, async (req, res) => {
  const u = await db.find('users', x => x.id === req.params.userId);
  const d = u && u.rideDriver && u.rideDriver.docs && u.rideDriver.docs[req.params.kind];
  if (!d) return res.status(404).json({ error: 'Document not found' });
  const fp = path.join(require('../uploads').PRIVATE_UPLOADS_DIR, path.basename(String(d.filename)));
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File is missing on disk' });
  let buf; try { buf = require('../file-crypto').readPossiblyEncrypted(fp); } catch (e) { return res.status(500).json({ error: e.message }); }
  res.set('Cache-Control', 'no-store, private'); res.set('X-Content-Type-Options', 'nosniff'); res.set('Content-Type', ['image/jpeg', 'image/png', 'application/pdf'].includes(d.mimeType) ? d.mimeType : 'application/octet-stream');
  res.send(buf);
});
router.post('/admin/rides/applications/:userId/decision', gate, async (req, res) => {
  const u = await db.find('users', x => x.id === req.params.userId && x.rideDriver);
  if (!u) return res.status(404).json({ error: 'Application not found' });
  const { decision, reason } = req.body || {};
  if (!['approve', 'reject', 'suspend'].includes(decision)) return res.status(400).json({ error: 'decision must be approve, reject or suspend' });
  const why = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
  if (decision !== 'approve' && why.length < 5) return res.status(400).json({ error: 'Give the driver a short reason.' });
  const r = u.rideDriver;
  if (decision === 'approve') {
    const need = await requiredDocs(u.country, r.vehicle);
    if (r.status !== 'pending' || need.some(k => !(r.docs && r.docs[k]))) return res.status(400).json({ error: 'Only a submitted application with every required document can be approved.' });
  }
  const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'suspended';
  await db.update('users', u.id, { rideDriver: { ...r, status, online: false, onlineUntil: null, rejectReason: decision === 'approve' ? null : why, reviewedBy: req.adminUser.id, reviewedAt: new Date().toISOString() } });
  try { await db.insert('accessLogs', { id: `al_${nanoid(10)}`, adminId: req.adminUser.id, resourceType: 'ride_driver', resourceId: `${decision} ${u.id}`.slice(0, 250), ipAddress: req.ip, createdAt: new Date().toISOString() }); } catch (e) {}
  await notify(u.id, decision === 'approve' ? '✅' : '⚠️', decision === 'approve' ? 'You are approved as a ride driver. Go to Rides and switch to online to get requests.' : `Your ride driver application was ${decision === 'reject' ? 'not approved' : 'paused'}: ${why}`, null, { section: 'rides' });
  res.json({ ok: true, status });
});
router.post('/admin/rides/alerts/:id/resolve', gate, async (req, res) => {
  const e = await db.find('rideSafetyEvents', x => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Alert not found' });
  await db.update('rideSafetyEvents', e.id, { status: 'resolved', resolvedBy: req.adminUser.id, resolvedAt: new Date().toISOString() });
  res.json({ ok: true });
});
router.put('/admin/rides/settings', gate, async (req, res) => {
  if (!req.adminUser.isSuperAdmin) return res.status(403).json({ error: 'This action requires a super admin account' });
  const { docRules, enabledCountries, maxKm, searchKm, answerMinutes, feePercent, commissionPercent, requireInsurance, motorbikeNight, rulesRider, rulesDriver, autoReleaseHours, noStartHours, stuckHours, waitMinutes, trackKeepDays, passEnabled, passPlans, cashEnabled } = req.body || {};
  if (passEnabled !== undefined) await setSetting('ridePassEnabled', passEnabled === true);
  if (cashEnabled !== undefined) await setSetting('rideCashEnabled', cashEnabled === true);
  if (passPlans !== undefined) {
    const list = Array.isArray(passPlans) ? passPlans.map(p => ({ id: String(p && p.id || '').trim().toLowerCase(), label: String(p && p.label || '').trim(), days: Number(p && p.days), priceUsd: Number(p && p.priceUsd) })) : null;
    if (!list || list.length < 1 || list.length > 6 || list.some(p => !ridePass.cleanPlan(p)) || new Set(list.map(p => p.id)).size !== list.length) return res.status(400).json({ error: 'Passes: between 1 and 6, each with a short name, a number of days (1 to 366) and a price (US$0.50 to $1,000), and no two the same.' });
    await setSetting('ridePassPlans', list);
  }
  if (docRules !== undefined) {
    // v114: papers by country and vehicle. Each rule lists every paper required for that country+vehicle ('*' = any).
    const list = Array.isArray(docRules) ? docRules.map(r => ({ country: String((r && r.country) || '').trim(), vehicle: String((r && r.vehicle) || '').trim().toLowerCase(), docs: Array.isArray(r && r.docs) ? [...new Set(r.docs.map(k => String(k).trim().toLowerCase()))] : null })) : null;
    const bad = !list || list.length > 60 || list.some(r => !r.docs || r.country.length < 1 || r.country.length > 60 || !(r.vehicle === '*' || RIDE_VEHICLES[r.vehicle]) || !r.docs.length || r.docs.some(k => !DOC_KINDS[k]) || !['licence', 'registration', 'vehicle'].every(k => r.docs.includes(k)));
    if (bad) return res.status(400).json({ error: 'Each paper rule needs a country (or *), a vehicle (or *), and a list of known papers that includes at least licence, registration and vehicle.' });
    if (new Set(list.map(r => r.country.toLowerCase() + '|' + r.vehicle)).size !== list.length) return res.status(400).json({ error: 'Two paper rules are for the same country and vehicle. Keep one.' });
    await setSetting('rideDocRules', list);
  }
  if (requireInsurance !== undefined) await setSetting('rideRequireInsurance', requireInsurance === true);
  if (motorbikeNight !== undefined) {
    const n = motorbikeNight || {};
    if (!Number.isInteger(n.startHour) || !Number.isInteger(n.endHour) || n.startHour < 0 || n.startHour > 23 || n.endHour < 0 || n.endHour > 23 || n.startHour === n.endHour) return res.status(400).json({ error: 'Night hours must be two different whole hours from 0 to 23' });
    await setSetting('rideMotorbikeNight', { enabled: n.enabled === true, startHour: n.startHour, endHour: n.endHour });
  }
  for (const [k, v, key] of [['rider', rulesRider, 'rideRulesRider'], ['driver', rulesDriver, 'rideRulesDriver']]) {
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim().length < 50 || v.length > 8000) return res.status(400).json({ error: `The ${k} rules must be between 50 and 8,000 characters` });
    if (v.trim() !== String(await getSetting(key)).trim()) { await setSetting(key, v.trim()); await setSetting('rideRulesVersion', Number(await getSetting('rideRulesVersion')) + 1); }
  }
  if (enabledCountries !== undefined) {
    if (!Array.isArray(enabledCountries) || enabledCountries.length > 60 || enabledCountries.some(c => typeof c !== 'string' || c.trim().length < 2 || c.length > 60)) return res.status(400).json({ error: 'Pick the countries where rides are on' });
    await setSetting('rideEnabledCountries', [...new Set(enabledCountries.map(c => c.trim()))]);
  }
  const num = async (key, v, lo, hi, label) => { if (v === undefined) return null; if (typeof v !== 'number' || v < lo || v > hi) return `${label} must be between ${lo} and ${hi}`; await setSetting(key, v); return null; };
  for (const err of [await num('rideMaxKm', maxKm, 2, 200, 'Longest ride (km)'), await num('rideSearchKm', searchKm, 1, 100, 'Driver search distance (km)'), await num('rideAnswerMinutes', answerMinutes, 1, 30, 'Minutes to answer'), await num('rideFeePercent', feePercent, 0, 30, 'Trothen share (%)'), await num('rideCommissionPercent', commissionPercent, 0, 30, 'Driver commission (%)'), await num('rideAutoReleaseHours', autoReleaseHours, 0, 168, 'Hours before the fare is released automatically (0 = never)'), await num('rideNoStartHours', noStartHours, 1, 48, 'Hours before a ride that never started is cancelled'), await num('rideStuckHours', stuckHours, 1, 48, 'Hours before an unfinished trip is flagged'), await num('rideWaitMinutes', waitMinutes, 3, 30, 'Minutes a driver waits for a rider'), await num('rideTrackKeepDays', trackKeepDays, 1, 365, 'Days GPS routes are kept')]) if (err) return res.status(400).json({ error: err });
  try { await db.insert('accessLogs', { id: `al_${nanoid(10)}`, adminId: req.adminUser.id, resourceType: 'ride_settings', resourceId: JSON.stringify(req.body).slice(0, 240), ipAddress: req.ip, createdAt: new Date().toISOString() }); } catch (e) {}
  res.json({ ok: true });
});

module.exports = router;
module.exports.isApproved = isApproved;
