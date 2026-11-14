// v108: store orders (goods bought with no job), delivery by a driver,
// and receipts. The rules are in plain words in src/store-orders.js.
const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { requireCurrentTerms } = require('../terms');
const { notify } = require('../notify');
const { isNonEmptyString } = require('../validators');
const { contractStatusLocks } = require('../contract-locks');
const store = require('../store');
const so = require('../store-orders');
const { money } = store;

const router = express.Router();
// v139: customers and pros can both buy in the Market.
const requireBuyer = (req, res, next) => (['customer', 'provider'].includes(req.user && req.user.role) ? next() : res.status(403).json({ error: 'Buying is for customer and pro accounts' }));
const today = () => new Date().toISOString().slice(0, 10);
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Customer';
const itemsLine = (items) => (items || []).map(i => `${i.qty} x ${i.name}`).join(', ');
const pct = (amount, percent) => money(Number(amount) * Number(percent) / 100);

// The same checks every booking makes of the customer.
async function customerCanBuy(req, res) {
  const customer = await db.find('users', u => u.id === req.user.sub);
  if (!customer || customer.verified !== true) {
    const openId = customer && await db.find('verifications', v => v.userId === customer.id && ['pending', 'review_required'].includes(v.status));
    if (openId) { res.status(403).json({ error: 'Your ID is being reviewed. You\'ll be able to buy as soon as it\'s approved, usually within 48 hours.' }); return null; }
    res.status(403).json({ code: 'VERIFY_IDENTITY', error: 'Please verify your identity first. Upload a government ID in the Verification section, and you can buy once it\'s been reviewed.' }); return null;
  }
  if (customer.onHold) { res.status(403).json({ error: 'Your account is temporarily paused pending a quick review. You\'ll be able to buy again shortly.' }); return null; }
  return customer;
}

// Where the goods are going. A pin, a landmark or an address: at least one.
function readDropoff(body) {
  const { readJobLocation } = require('./marketplace.routes');
  const where = readJobLocation(body || {});
  if (where.error) return { error: where.error };
  let address = typeof (body || {}).address === 'string' ? body.address.trim() : '';
  if (address.length > 200) return { error: 'The address must be under 200 characters' };
  if (address.length < 5 && (where.landmark || where.jobLocation)) address = where.landmark || 'Location pinned on the map';
  if (address.length < 5) return { error: 'Say where the goods should be brought: pin the place, describe a landmark, or type an address.' };
  return { address, landmark: where.landmark, jobLocation: where.jobLocation };
}

// Makes the booking with the driver for one order, and holds the money for it.
async function createDelivery({ order, seller, driver, where, payCurrency, expectedPrice, paidWith, fixedPrice }) {
  const { generateBookingNumber, fundEscrowForContract } = require('./marketplace.routes');
  const opt = store.storeOptions(seller);
  // v139: a personal listing has its own pick-up place and no store name.
  if (order.marketListingId) { opt.pickupLocation = order.pickupLocation || null; opt.pickupPlace = order.pickupPlace || ''; }
  const sellerLabel = (seller.store && seller.store.name) || seller.name;
  const settings = await store.storeSettings();
  const km = so.kmBetween(opt.pickupLocation, where.jobLocation);
  if (!so.inRange(so.driverRates(driver), km)) { const rr = so.driverRates(driver); return { error: `${driver.name} delivers ${rr.minKm > 0 ? `from ${so.distWords(rr.minKm, seller.country)} ` : ''}up to ${so.distWords(rr.maxKm, seller.country)}, and this trip is about ${so.distWords(km, seller.country)}. Choose another driver.`, code: 'OUT_OF_RANGE' }; } // v164
  const price = fixedPrice !== undefined ? money(fixedPrice) : await so.deliveryPrice(driver, km); // v143; v148: the price already paid with the order
  // The customer approved one price. If the driver changed their rates in
  // between, they are shown the new price instead of being charged it.
  if (expectedPrice !== undefined && Math.abs(Number(expectedPrice) - price) > 0.009) {
    return { error: `${driver.name}'s price is now $${price.toFixed(2)}. Check it and approve again.`, code: 'PRICE_CHANGED', price };
  }
  const rates = so.driverRates(driver);
  const delivery = {
    id: `ct_${nanoid(10)}`,
    bookingNumber: await generateBookingNumber(),
    customerId: order.customerId,
    providerId: driver.id,
    service: `Delivery: ${order.marketListingId ? 'Market' : 'store'} order #${order.bookingNumber} from ${sellerLabel}`.slice(0, 200),
    date: today(), time: 'As soon as possible',
    address: where.address, jobLocation: where.jobLocation || null, landmark: where.landmark || null,
    amount: price,
    serviceFee: pct(price, settings.deliveryFeePercent),
    laborAmount: price,
    storeItems: [], storeGoodsTotal: 0, storeFee: 0, storeFeePaidBy: null, goodsOnly: false, materialsCost: null, storeStockHeld: false,
    loyaltyPointsRedeemed: 0, materialsAdvance: 0, materialsOnHand: null, photoUrls: [],
    status: 'pending_provider_confirmation',
    payCurrency: payCurrency === 'local' ? 'local' : 'usd',
    signedAt: null,
    providerResponseDeadline: new Date(Date.now() + so.DELIVERY_RESPONSE_MINUTES * 60 * 1000).toISOString(),
    delivery: {
      forContractId: order.id, orderNumber: order.bookingNumber, sellerId: seller.id, storeName: sellerLabel,
      pickupPlace: opt.pickupPlace || [seller.city, seller.country].filter(Boolean).join(', '), pickupLocation: opt.pickupLocation,
      distanceKm: km, vehicle: rates.vehicle, items: itemsLine(order.storeItems).slice(0, 300), itemCount: (order.storeItems || []).reduce((n, i) => n + i.qty, 0),
    },
    createdAt: new Date().toISOString(),
  };
  // Same ordering fix as the main store order above: charge the driver's
  // delivery fee BEFORE the delivery contract exists on record, so a
  // failed charge never leaves an un-paid-for delivery request sitting
  // in the database (or reaching the driver's notification below).
  if (paidWith) delivery.prepaidBy = { escrow: paidWith }; // v148: paid together with the goods
  const escrow = await fundEscrowForContract(delivery, order.customerId, payCurrency);
  const waiting = escrow && escrow.status === 'awaiting_payment';
  if (waiting) { delivery.status = 'awaiting_payment'; delivery.statusAfterPayment = 'pending_provider_confirmation'; } // v148: the driver is asked once it is paid
  await db.insert('contracts', delivery);
  // v111: two 4-digit codes. The customer's is given to the driver when the goods arrive; the driver's is shown to the seller when the goods are collected. Kept apart from the contract so no booking list can leak them.
  await db.insert('deliveryCodes', { id: `dc_${nanoid(8)}`, contractId: delivery.id, pickupCode: String(crypto.randomInt(1000, 10000)), dropoffCode: String(crypto.randomInt(1000, 10000)), attempts: 0, lockedUntil: null, createdAt: new Date().toISOString() });
  await db.update('contracts', order.id, { deliveryMethod: 'driver', deliveryContractId: delivery.id, address: where.address, jobLocation: where.jobLocation || null, landmark: where.landmark || null });
  if (waiting) return { delivery, payment: require('../customer-payments').publicPayment(escrow) };
  await askDriver(delivery);
  return { delivery };
}
async function askDriver(delivery) {
  const driver = await db.find('users', u => u.id === delivery.providerId);
  const km = delivery.delivery.distanceKm;
  const by = require('../booking-rules').whenFor(delivery.providerResponseDeadline, driver, { hour: 'numeric', minute: '2-digit' }); // v158: the driver's own time zone
  await notify(delivery.providerId, '🚚', `Delivery request: collect order #${delivery.delivery.orderNumber} (${delivery.delivery.items.slice(0, 80)}) from ${delivery.delivery.storeName}, ${delivery.delivery.pickupPlace}, and take it to the customer${km ? `, about ${so.distWords(km, driver && driver.country)}` : ''}. You are paid $${Number(delivery.amount).toFixed(2)}. Accept or decline within ${so.DELIVERY_RESPONSE_MINUTES} minutes (by ${by}).`, 'bookingUpdates', { section: 'bookings' });
}

// v148: a goods order, or a delivery, has just been paid (a code confirmed
// by finance, a card page, or an MTN PIN). Only now is the seller told to
// pack and the driver asked to collect.
async function afterPaid(c, e) {
  const paidWords = e.paidBy === 'card' ? `$${Number(e.amountReceived).toFixed(2)} by card` : `${e.dueCurrency} ${Number(e.amountReceived).toLocaleString()}`;
  if (c.storeOrder) {
    await notify(c.customerId, '✅', `We received your payment for order #${c.bookingNumber} (${paidWords}). Trothen holds it until you have your goods. The seller has been told to get it ready.`, 'bookingUpdates', { section: 'orders' });
    if (c.sellerNotice) await notify(c.providerId, c.marketListingId ? '🏷️' : '🛍️', c.sellerNotice, 'bookingUpdates', { section: c.marketListingId ? 'market' : 'store' });
    if (c.pendingDelivery) {
      const pd = c.pendingDelivery;
      const seller = await db.find('users', u => u.id === c.providerId), driver = await db.find('users', u => u.id === pd.driverId);
      await db.update('contracts', c.id, { pendingDelivery: null });
      try {
        if (seller && driver) await createDelivery({ order: c, seller, driver, where: pd.where, payCurrency: c.payCurrency, paidWith: { ...e, id: e.id }, fixedPrice: pd.price });
      } catch (x) { console.error('[orders] delivery after payment:', c.id, x.message); }
    }
    return;
  }
  if (c.delivery) {
    const deadline = new Date(Date.now() + so.DELIVERY_RESPONSE_MINUTES * 60 * 1000).toISOString();
    const d = await db.update('contracts', c.id, { providerResponseDeadline: deadline });
    await notify(c.customerId, '✅', `We received your payment for the delivery of order #${c.delivery.orderNumber} (${paidWords}). The driver has been asked.`, 'bookingUpdates', { section: 'orders' });
    await askDriver(d);
  }
}

// One order, as the person asking is allowed to see it.
async function orderView(order, viewerId) {
  const seller = await db.find('users', u => u.id === order.providerId);
  const customer = await db.find('users', u => u.id === order.customerId);
  const escrow = await db.find('escrowTransactions', e => e.contractId === order.id);
  const d = await so.deliveryOf(order);
  const iAmSeller = viewerId === order.providerId;
  const opt = seller ? store.storeOptions(seller) : { pickupPlace: '', pickupLocation: null, hours: '' };
  let delivery = null;
  if (d) {
    const driver = await db.find('users', u => u.id === d.providerId);
    const h = d.handover || {};
    delivery = {
      contractId: d.id, number: d.bookingNumber, status: d.status, price: d.amount, serviceFee: d.serviceFee || 0,
      distanceKm: (d.delivery && d.delivery.distanceKm) || null, answerBy: d.status === 'pending_provider_confirmation' ? d.providerResponseDeadline : null,
      driver: driver ? { id: driver.id, name: driver.name, vehicle: so.driverRates(driver).vehicle, rating: driver.rating || null, profilePhotoUrl: driver.profilePhotoUrl || null, initials: driver.initials || null, color: driver.color || null } : null,
      pickedUpAt: (h.pickup && h.pickup[0] && h.pickup[0].at) || null, droppedOffAt: (h.dropoff && h.dropoff[0] && h.dropoff[0].at) || null,
      // v111: only the customer sees this code, and only until the goods are dropped off
      dropoffCode: (viewerId === order.customerId && ['active', 'pending_provider_confirmation'].includes(d.status) && !(h.dropoff && h.dropoff.length)) ? ((await db.find('deliveryCodes', x => x.contractId === d.id)) || {}).dropoffCode || null : null,
      // enough of the delivery booking for the hand-over window to open on it
      raw: { id: d.id, service: d.service, status: d.status, handover: d.handover || null, delivery: d.delivery, providerId: d.providerId, customerId: d.customerId },
    };
  }
  const live = so.isLive(d);
  const method = order.deliveryMethod || 'pickup';
  return {
    id: order.id, number: order.bookingNumber, createdAt: order.createdAt, status: order.status, completedAt: order.completedAt || null,
    items: order.storeItems || [], goodsTotal: order.storeGoodsTotal || 0,
    deliveryMethod: method, sellerDeliveryFee: order.sellerDeliveryFee || 0,
    storeFee: order.storeFeePaidBy === 'customer' ? (order.storeFee || 0) : 0, storeFeeFromSeller: order.storeFeePaidBy === 'pro' ? (order.storeFee || 0) : 0,
    serviceFee: order.serviceFee || 0, amount: order.amount, totalPaid: money((order.amount || 0) + (order.serviceFee || 0)),
    paidCurrency: escrow ? escrow.paidCurrency : 'USD', paidAmountLocal: escrow ? escrow.paidAmountLocal : null, moneyStatus: escrow ? escrow.status : 'none',
    payment: order.status === 'awaiting_payment' && escrow && viewerId === order.customerId ? require('../customer-payments').publicPayment(escrow) : null, // v148
    alsoPaysUsd: order.alsoPaysUsd || 0, bookingNumber: order.bookingNumber, service: order.service, // v148: the delivery paid with it, and what the pay screen needs
    readyAt: order.readyAt || null, note: order.orderNote || null,
    // v143: discount, returns and reviews
    discount: order.discount || 0, discountCode: order.discountCode || null, goodsBeforeDiscount: order.goodsBeforeDiscount || order.storeGoodsTotal || 0, refundedAmount: order.refundedAmount || 0,
    returnPolicy: order.returnPolicy ? { ...order.returnPolicy, words: store.returnPolicyWords(order.returnPolicy) } : null,
    returnUntil: require('../store-extras').returnUntil(order), returnRequest: order.returnRequest || null,
    canReturn: (() => { const u = require('../store-extras').returnUntil(order); return viewerId === order.customerId && !order.marketListingId && !!u && Date.parse(u) > Date.now() && !order.returnRequest; })(),
    reviewedGoods: viewerId === order.customerId ? (await db.filter('goodReviews', r => r.orderId === order.id)).map(r => r.goodId) : [],
    store: seller ? { providerId: seller.id, name: (seller.store && seller.store.name) || seller.name, sellerName: seller.name, hours: opt.hours } : null,
    pickup: { place: order.pickupPlace || opt.pickupPlace || '', location: order.pickupLocation || opt.pickupLocation || null },
    // Where it is going: shown to the seller only when the seller is the one bringing it.
    dropoff: method === 'pickup' ? null : (!iAmSeller || method === 'seller') ? { address: order.address, landmark: order.landmark || null, location: order.jobLocation || null } : { address: null, landmark: null, location: null },
    customer: customer ? { name: iAmSeller ? `${firstName(customer.name)} ${String(customer.name || '').trim().split(/\s+/).slice(-1)[0][0] || ''}.`.replace(/ \.$/, '') : customer.name } : null,
    delivery,
    contacts: contactsFor(order, d, d ? await db.find('users', u => u.id === d.providerId) : null, seller, viewerId, customer), // v111
    // The customer can pick a driver (or switch to collecting) while the order is open and nobody is on the way.
    canArrangeDelivery: order.status === 'active' && method !== 'seller' && !live,
    // v139: the Market
    listing: order.marketListingId ? { id: order.marketListingId, title: order.listingTitle || null, photo: order.listingPhoto || null } : null,
    handedOverAt: order.handedOverAt || null,
    autoCompleteAt: order.status === 'active' ? (await require('../market').autoCompleteAt(order)) : null,
    iAmSeller,
    review: order.status === 'completed' ? await db.find('marketReviews', r => r.orderId === order.id) || null : null,
    handover: order.handover || null,
  };
}

// ── DRIVERS ────────────────────────────────────────────────────────────
// GET /api/delivery/rates — a pro's own delivery prices.
router.get('/delivery/rates', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const settings = await store.storeSettings();
  res.json({ hasSkill: store.hasSkill(me, store.DRIVER_SKILL) || so.rideDeliverer(me), viaRides: so.rideDeliverer(me), offered: so.isDriver(me), rates: so.driverRates(me), vehicles: store.VEHICLES, vehicleMaxKm: store.VEHICLE_MAX_KM, skill: store.DRIVER_SKILL, feePercent: settings.deliveryFeePercent, hasLocation: typeof me.latitude === 'number' });
});
router.put('/delivery/rates', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!store.hasSkill(me, store.DRIVER_SKILL)) return res.status(403).json({ error: `Add "${store.DRIVER_SKILL}" to your skills first. Delivery prices are for pros who do pick-and-drop.` });
  const { vehicle, baseFee, perKm, minKm, maxKm } = req.body || {};
  if (!store.VEHICLES.includes(vehicle)) return res.status(400).json({ error: 'Choose what you deliver with' });
  if (typeof baseFee !== 'number' || !(baseFee >= 1) || baseFee > 500) return res.status(400).json({ error: 'Your starting price must be between $1 and $500' });
  if (typeof perKm !== 'number' || perKm < 0 || perKm > 50) return res.status(400).json({ error: 'Your price per kilometre must be between $0 and $50' });
  const range = readRange(vehicle, minKm, maxKm, me.country); if (range.error) return res.status(400).json({ error: range.error });
  await db.update('users', me.id, { deliveryRates: { vehicle, baseFee: money(baseFee), perKm: Math.round(perKm * 10000) / 10000, updatedAt: new Date().toISOString() }, ...(range.value ? { deliveryRange: range.value } : {}) });
  const after = await db.find('users', u => u.id === me.id);
  res.json({ rates: so.driverRates(after), offered: so.isDriver(after) });
});

// v164: the distances a driver goes, inside what their vehicle can do.
// Not sent = keep what is saved (or the vehicle's own range).
function readRange(vehicle, minKm, maxKm, country) {
  if (minKm === undefined && maxKm === undefined) return {};
  const cap = store.VEHICLE_MAX_KM[vehicle] || 50;
  const min = minKm === null || minKm === '' || minKm === undefined ? 0 : Number(minKm);
  const max = maxKm === null || maxKm === '' || maxKm === undefined ? cap : Number(maxKm);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= 0) return { error: 'Enter the distances as numbers.' };
  if (max > cap + 0.05) return { error: `By ${vehicle}, deliveries go up to ${so.distWords(cap, country)}.` };
  if (min >= max) return { error: 'The shortest trip must be less than the longest.' };
  return { value: { minKm: Math.round(min * 10) / 10, maxKm: Math.round(Math.min(max, cap) * 10) / 10, updatedAt: new Date().toISOString() } };
}
// PUT /api/delivery/range { minKm, maxKm } — for any driver, including ride drivers who also deliver.
router.put('/delivery/range', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!store.hasSkill(me, store.DRIVER_SKILL) && !so.rideDeliverer(me)) return res.status(403).json({ error: `Add "${store.DRIVER_SKILL}" to your skills first, or carry deliveries as a ride driver.` });
  const vehicle = so.driverRates(me).vehicle || 'motorbike';
  const range = readRange(vehicle, (req.body || {}).minKm, (req.body || {}).maxKm, me.country);
  if (range.error || !range.value) return res.status(400).json({ error: range.error || 'Enter the distances you go.' });
  await db.update('users', me.id, { deliveryRange: range.value });
  const after = await db.find('users', u => u.id === me.id);
  res.json({ rates: so.driverRates(after) });
});

// GET /api/store/drivers?providerId=&latitude=&longitude= — drivers for one store's orders.
const driverLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait a moment.' } });
router.get('/store/drivers', requireAuth, driverLimiter, async (req, res) => {
  const seller = await db.find('users', u => u.id === req.query.providerId && u.role === 'provider');
  if (!seller || !store.storeIsLive(seller)) return res.status(404).json({ error: 'This store isn\'t open right now.' });
  if (!store.storeOptions(seller).deliveryMethods.includes('driver')) return res.json({ drivers: [], distanceKm: null, totalFound: 0, notOffered: true });
  const lat = Number(req.query.latitude), lng = Number(req.query.longitude);
  const { isValidCoordinate } = require('../geo-distance');
  const dropoff = (req.query.latitude !== undefined && isValidCoordinate(lat, lng) && !(lat === 0 && lng === 0)) ? { latitude: lat, longitude: lng } : null;
  const out = await so.suggestDrivers({ seller, dropoff, customerId: req.user.sub });
  const settings = await store.storeSettings();
  res.json({ ...out, feePercent: settings.deliveryFeePercent, storeHasPin: !!store.storeOptions(seller).pickupLocation, answerMinutes: so.DELIVERY_RESPONSE_MINUTES });
});

// ── BUYING ─────────────────────────────────────────────────────────────
const buyInFlight = new Set(); // v110: one purchase at a time per customer (double-tap guard)
// POST /api/store/orders { providerId, items, deliveryMethod, driverId, driverPrice, jobLocation, landmark, address, note, payCurrency }
// v139: pros can buy too (a plumber buying fittings from a supplier).
// v143: what the seller charges to bring an order: their flat charge, or by
// distance at Trothen's motorbike fare for the country (never less than
// their flat charge when one is set... unless no pin was given: then the flat one).
async function sellerDeliveryCharge(seller, opt, dropPin) {
  if (opt.deliveryPricing !== 'distance' || !dropPin || !opt.pickupLocation) return opt.deliveryFee;
  const q = await so.tableQuote(seller.country, 'motorbike', so.kmBetween(opt.pickupLocation, dropPin), 0);
  return q ? q.price : opt.deliveryFee;
}
router.get('/store/seller-delivery', requireAuth, async (req, res) => {
  const seller = await db.find('users', u => u.id === req.query.providerId && u.role === 'provider');
  if (!seller || !store.storeIsLive(seller)) return res.status(404).json({ error: 'Store not found' });
  const opt = store.storeOptions(seller);
  const lat = Number(req.query.latitude), lng = Number(req.query.longitude);
  const pin = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { latitude: lat, longitude: lng } : null;
  const fee = await sellerDeliveryCharge(seller, opt, pin);
  const q = pin && opt.pickupLocation && opt.deliveryPricing === 'distance' ? await so.tableQuote(seller.country, 'motorbike', so.kmBetween(opt.pickupLocation, pin), 0) : null;
  res.json({ fee, byDistance: opt.deliveryPricing === 'distance', local: q ? q.local : null, symbol: q ? q.symbol : null, distanceKm: pin && opt.pickupLocation ? so.kmBetween(opt.pickupLocation, pin) : null });
});
router.post('/store/orders', requireAuth, requireBuyer, requireCurrentTerms, async (req, res) => {
  const customer = await customerCanBuy(req, res);
  if (!customer) return;
  const b = req.body || {};
  const seller = await db.find('users', u => u.id === b.providerId && u.role === 'provider');
  if (!seller) return res.status(404).json({ error: 'Store not found' });
  if (seller.id === customer.id) return res.status(400).json({ error: 'You can\'t buy from your own store.' });
  const basket = await store.priceBasket(seller.id, b.items, { trade: customer.role === 'provider' && customer.verified === true }); // v140: trade prices for pros
  if (basket.error) return res.status(400).json({ error: basket.error });
  if (!basket.items.length) return res.status(400).json({ error: 'Pick at least one good from the store.' });
  const opt = store.storeOptions(seller);
  const method = b.deliveryMethod;
  if (!store.DELIVERY_METHODS.includes(method)) return res.status(400).json({ error: 'Choose how you want to get your goods.' });
  if (!opt.deliveryMethods.includes(method)) return res.status(400).json({ error: `This store doesn't offer that. Choose one of: ${opt.deliveryMethods.map(m => store.DELIVERY_LABELS[m].toLowerCase()).join('; ')}.` });
  if (b.note !== undefined && b.note !== null && b.note !== '' && !isNonEmptyString(b.note, { max: 300 })) return res.status(400).json({ error: 'The note to the seller must be under 300 characters' });
  let where = null, driver = null;
  if (method !== 'pickup') {
    where = readDropoff(b);
    if (where.error) return res.status(400).json({ error: where.error });
  }
  if (method === 'driver') {
    driver = await db.find('users', u => u.id === b.driverId);
    if (!driver || !so.isDriver(driver) || driver.id === seller.id || driver.id === customer.id || String(driver.country || '').toLowerCase() !== String(seller.country || '').toLowerCase()) {
      return res.status(400).json({ code: 'PICK_DRIVER', error: 'Choose a driver from the list. The one you picked isn\'t available any more.' });
    }
    // Checked before anything is charged, so a changed price never leaves a half-made order.
    const tripKm = so.kmBetween(opt.pickupLocation, where.jobLocation);
    if (!so.inRange(so.driverRates(driver), tripKm)) return res.status(400).json({ code: 'OUT_OF_RANGE', error: `${driver.name} doesn't go that far (about ${so.distWords(tripKm, seller.country)}). Choose another driver.` }); // v164
    const price = await so.deliveryPrice(driver, tripKm); // v143
    if (b.driverPrice === undefined || Math.abs(Number(b.driverPrice) - price) > 0.009) {
      return res.status(409).json({ code: 'PRICE_CHANGED', price, error: `${driver.name}'s price for this trip is $${price.toFixed(2)}. Check it and approve again.` });
    }
  }
  const settings = await store.storeSettings();
  const { generateBookingNumber, fundEscrowForContract } = require('./marketplace.routes');
  // v143: the seller's delivery, flat or by distance (Trothen's per-km fares on a motorbike)
  const sellerDeliveryFee = method === 'seller' ? await sellerDeliveryCharge(seller, opt, where && where.jobLocation) : 0;
  // v143: a store discount code
  let discount = 0, discountCode = null;
  if (b.discountCode) {
    const d = await require('../store-extras').applyDiscount(seller, b.discountCode, basket.total, customer.id);
    if (d.error) return res.status(400).json({ code: 'BAD_CODE', error: d.error });
    discount = d.discount; discountCode = d.code;
  }
  const goodsTotal = money(basket.total - discount);
  // v109: what is charged must be what the customer saw. If the seller
  // changed a price or their delivery charge, or the exchange rate moved,
  // between the customer opening the checkout and paying, nothing is
  // charged and the new figures are sent back to approve.
  if (b.expectedGoodsTotal !== undefined && Math.abs(Number(b.expectedGoodsTotal) - goodsTotal) > 0.009) {
    return res.status(409).json({ code: 'PRICE_CHANGED', goodsTotal, error: `The goods now come to $${goodsTotal.toFixed(2)}. A price changed since you opened the checkout. Check it and approve again.` });
  }
  if (b.expectedDeliveryFee !== undefined && Math.abs(Number(b.expectedDeliveryFee) - sellerDeliveryFee) > 0.009) {
    return res.status(409).json({ code: 'PRICE_CHANGED', deliveryFee: sellerDeliveryFee, error: `The seller's delivery charge is now $${sellerDeliveryFee.toFixed(2)}. Check it and approve again.` });
  }
  // v140: materials for one of the buyer's own jobs.
  let linkedJob = null;
  if (b.jobId) { linkedJob = await db.find('jobs', j => j.id === b.jobId && j.customerId === customer.id); if (!linkedJob) return res.status(404).json({ error: 'That job was not found.' }); }
  const gf = store.goodsFeeFor(goodsTotal, settings); // v139: a share of the goods (seller pays at payout), or the flat fee; v143: after any discount
  const storeFee = gf.fee;
  const storeFeePaidBy = gf.paidBy;
  const pickupPlace = opt.pickupPlace || [seller.city, seller.country].filter(Boolean).join(', ');
  const order = {
    id: `ct_${nanoid(10)}`,
    bookingNumber: await generateBookingNumber(),
    customerId: customer.id,
    providerId: seller.id,
    service: ('Store order: ' + itemsLine(basket.items)).slice(0, 200),
    date: today(), time: 'Store order',
    address: method === 'pickup' ? `Collect from ${seller.store.name}: ${pickupPlace}`.slice(0, 200) : where.address,
    jobLocation: where ? (where.jobLocation || null) : null,
    landmark: where ? (where.landmark || null) : null,
    amount: money(goodsTotal + sellerDeliveryFee),
    // What the customer pays on top: the flat store fee (if the customer pays it) and Trothen's share of the seller's delivery charge.
    serviceFee: money((storeFeePaidBy === 'customer' ? storeFee : 0) + pct(sellerDeliveryFee, settings.deliveryFeePercent)),
    laborAmount: sellerDeliveryFee, // delivery is a service; the goods are not
    storeItems: basket.items, storeGoodsTotal: goodsTotal, storeFee, storeFeePaidBy,
    goodsBeforeDiscount: basket.total, discount, discountCode, // v143
    returnPolicy: opt.returnPolicy, // v143: the store's returns policy when the order was made
    goodsOnly: true, storeOrder: true, materialsCost: goodsTotal, storeStockHeld: true,
    deliveryMethod: method, sellerDeliveryFee, pickupPlace, pickupLocation: opt.pickupLocation,
    orderNote: b.note ? String(b.note).trim() : null,
    jobId: linkedJob ? linkedJob.id : null, // v140: materials bought for one of the buyer's jobs
    loyaltyPointsRedeemed: 0, materialsAdvance: 0, materialsOnHand: null, photoUrls: [],
    // A store order is confirmed the moment it is paid for: the seller put
    // the goods on the shelf at that price. There is nothing to accept.
    status: 'active', signedAt: today(), providerResponseDeadline: null,
    payCurrency: b.payCurrency === 'local' ? 'local' : 'usd',
    createdAt: new Date().toISOString(),
  };
  // Charging the customer happens FIRST, before anything else is
  // committed. fundEscrowForContract can genuinely fail (today, only a
  // Liberian mobile-money collection request that MTN's own API
  // rejects) — if it throws, nothing about this order should exist yet:
  // no contract on record, and no stock taken off the shelf for goods
  // that were never actually paid for. Inserting the contract and
  // holding stock BEFORE this call (the order this used to run in)
  // would leave exactly that broken, un-paid-for "active" order sitting
  // in the database the moment the charge failed.
  // v110: stock is reserved first (one buyer at a time), then the charge is
  // made; if the charge or the save fails, the reservation is undone.
  // v148: the buyer pays once: the goods, and the driver's delivery with them.
  let escrow = null, driverPrice = 0;
  if (driver) { driverPrice = await so.deliveryPrice(driver, so.kmBetween(opt.pickupLocation, where.jobLocation)); order.alsoPaysUsd = money(driverPrice + pct(driverPrice, settings.deliveryFeePercent)); }
  if (buyInFlight.has(customer.id)) return res.status(409).json({ error: 'Your order is already being processed. Please wait a moment.' });
  buyInFlight.add(customer.id);
  try {
    const held = await store.reserveStock(basket.items);
    if (held.error) return res.status(400).json({ error: held.error });
    try {
      escrow = await fundEscrowForContract(order, customer.id, order.payCurrency);
      if (escrow && escrow.status === 'awaiting_payment') { // v148: nothing goes to the seller until it is paid
        order.status = 'awaiting_payment'; order.statusAfterPayment = 'active'; order.signedAt = null;
        if (driver) order.pendingDelivery = { driverId: driver.id, where, price: driverPrice };
      }
      await db.insert('contracts', order);
    } catch (e) {
      await store.releaseStock(basket.items);
      console.error('[store order] payment or save failed, stock put back:', e.message);
      return res.status(e.code === 'PROTECTED_UNAVAILABLE' ? 400 : 402).json({ code: e.code === 'PROTECTED_UNAVAILABLE' ? 'PAY_UNAVAILABLE' : 'PAYMENT_FAILED', error: e.code === 'PROTECTED_UNAVAILABLE' ? 'Paying for goods through Trothen isn\'t switched on in your country yet, so this can\'t be bought in the app. Message the seller instead.' : 'Your payment could not be completed, so you were not charged and nothing was ordered. Please try again or use another payment method.' });
    }
  } finally {
    buyInFlight.delete(customer.id);
  }
  const waiting = order.status === 'awaiting_payment';
  if (discountCode) { try { await require('../store-extras').useDiscount(seller.id, discountCode); } catch (e) { /* the order stands */ } }
  try { await require('../fraud-detection').checkNewAccountHighValue(customer.id, order.amount); } catch (e) { /* the order stands */ }
  const count = basket.items.reduce((n, i) => n + i.qty, 0);
  const how = method === 'pickup' ? 'The customer will collect it.' : method === 'seller' ? `Bring it to the customer: ${where.address}. Your delivery charge of $${sellerDeliveryFee.toFixed(2)} is included.` : `A driver (${driver.name}) has been asked to collect it.`;
  const sellerNotice = `New store order #${order.bookingNumber} from ${firstName(customer.name)}: ${count} good${count === 1 ? '' : 's'} ($${basket.total.toFixed(2)}). ${how} The money is held and is released to you when the customer confirms they have the goods.`;
  if (waiting) await db.update('contracts', order.id, { sellerNotice });
  else {
    await notify(seller.id, '🛍️', sellerNotice, 'bookingUpdates', { section: 'store' });
    if (driver) await createDelivery({ order, seller, driver, where, payCurrency: order.payCurrency });
  }
  if (linkedJob && !waiting) { // v140: the pro doing that job is told the materials are coming
    const hired = await db.find('contracts', c => c.jobId === linkedJob.id && !c.storeOrder && !['cancelled', 'declined', 'refunded'].includes(c.status));
    if (hired && hired.providerId !== seller.id) await notify(hired.providerId, '🧰', `${firstName(customer.name)} bought materials for "${String(linkedJob.description || '').slice(0, 50)}": ${itemsLine(basket.items).slice(0, 120)} from ${seller.store.name} (${method === 'pickup' ? 'they will collect them' : 'being delivered'}).`, 'bookingUpdates', { section: 'contracts' });
  }
  await require('../cart').removeOrdered(customer.id, seller.id, basket.items); // v162: ordered goods leave the cart
  const fresh = await db.find('contracts', c => c.id === order.id);
  res.status(201).json({ order: await orderView(fresh, customer.id), payment: waiting ? require('../customer-payments').publicPayment(escrow) : null });
});

// ── v111: CONTACTS AND LIVE TRACKING ───────────────────────────────────
// A phone number is shown to the other people on an order only while the
// order is open. It is what lets them call, text or WhatsApp each other.
const contactOf = (u) => (u && u.phone && String(u.phone).trim()) ? { name: u.name, phone: String(u.phone).trim() } : (u ? { name: u.name, phone: null } : null);
const SPEED_KMH = { motorbike: 25, keke: 20, car: 30, van: 25, truck: 25, bicycle: 12, 'on foot': 5 };
const { distanceInMiles, isValidCoordinate } = require('../geo-distance');
function kmOf(a, b) {
  if (!a || !b || !isValidCoordinate(a.latitude, a.longitude) || !isValidCoordinate(b.latitude, b.longitude)) return null;
  return Math.round(distanceInMiles(a.latitude, a.longitude, b.latitude, b.longitude) * 1.609344 * 10) / 10;
}
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Location updates are arriving too quickly.' } });
// The driver's phone sends its position here while a delivery is open.
router.post('/deliveries/:id/location', requireAuth, requireRole('provider'), trackLimiter, async (req, res) => {
  const d = await db.find('contracts', c => c.id === req.params.id && c.providerId === req.user.sub && c.delivery);
  if (!d) return res.status(404).json({ error: 'Delivery not found' });
  if (d.status !== 'active') return res.status(409).json({ code: 'TRACK_CLOSED', error: 'This delivery is not open, so your position is not being shared.' });
  // v111: positions kept while the phone had no signal arrive together
  if (Array.isArray((req.body || {}).points)) {
    const tm = require('../track-merge');
    const batch = tm.cleanBatch(req.body.points);
    if (!batch.length) return res.status(400).json({ error: 'None of those positions could be used' });
    await db.update('contracts', d.id, { liveLocation: tm.newestLive(batch, d.liveLocation), track: tm.mergeTrack(d.track, batch) });
    return res.json({ ok: true, kept: batch.length });
  }
  const { latitude, longitude, accuracyM, speedMps } = req.body || {};
  if (!isValidCoordinate(latitude, longitude) || (latitude === 0 && longitude === 0)) return res.status(400).json({ error: 'That is not a valid position' });
  const now = Date.now();
  const prev = d.liveLocation;
  if (prev && now - new Date(prev.at).getTime() < 5000) return res.json({ ok: true, kept: false });
  const acc = Number(accuracyM);
  const live = { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6, accuracyM: Number.isFinite(acc) && acc > 0 && acc < 100000 ? Math.round(acc) : null, speedKmh: Number.isFinite(Number(speedMps)) && Number(speedMps) >= 0 ? Math.round(Number(speedMps) * 3.6) : null, at: new Date(now).toISOString() };
  const track = Array.isArray(d.track) ? d.track : [];
  const last = track[track.length - 1];
  let next = (!last || now - last[2] >= 15000) ? [...track, [Math.round(latitude * 1e5) / 1e5, Math.round(longitude * 1e5) / 1e5, now]] : track;
  if (next.length > 400) next = next.filter((_, i) => i === 0 || i % 2 === 0 || i === next.length - 1);
  await db.update('contracts', d.id, { liveLocation: live, track: next });
  res.json({ ok: true, kept: true });
});
// The customer or the seller watching an order's delivery.
router.get('/store/orders/:id/track', requireAuth, trackLimiter, async (req, res) => {
  const order = await db.find('contracts', c => c.id === req.params.id && c.storeOrder === true && (c.customerId === req.user.sub || c.providerId === req.user.sub));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const d = await so.deliveryOf(order);
  const iAmCustomer = order.customerId === req.user.sub;
  const seller = await db.find('users', u => u.id === order.providerId);
  const opt = seller ? store.storeOptions(seller) : {};
  const pickup = order.pickupLocation || opt.pickupLocation || null;
  const dropoff = order.jobLocation || null;
  const driverUser = d ? await db.find('users', u => u.id === d.providerId) : null;
  const h = (d && d.handover) || {};
  const pickedUp = !!(h.pickup && h.pickup.length), droppedOff = !!(h.dropoff && h.dropoff.length);
  let phase = 'none';
  if (order.status === 'completed' || droppedOff) phase = 'delivered';
  else if (order.status === 'cancelled') phase = 'cancelled';
  else if (d && d.status === 'pending_provider_confirmation') phase = 'waiting_driver';
  else if (d && d.status === 'active') phase = pickedUp ? 'to_customer' : 'to_store';
  const live = d && d.status === 'active' && d.liveLocation ? d.liveLocation : null;
  const ageS = live ? Math.max(0, Math.round((Date.now() - new Date(live.at).getTime()) / 1000)) : null;
  const target = phase === 'to_store' ? pickup : phase === 'to_customer' ? dropoff : null;
  const remaining = live && target ? kmOf(live, target) : null;
  const vehicle = driverUser ? so.driverRates(driverUser).vehicle : null;
  const speed = Math.max(8, Math.min(60, live && live.speedKmh && live.speedKmh > 3 ? live.speedKmh : (SPEED_KMH[vehicle] || 20)));
  const viewerIsSeller = !iAmCustomer;
  res.set('Cache-Control', 'no-store');
  res.json({
    phase, driver: driverUser ? { name: driverUser.name, vehicle, profilePhotoUrl: driverUser.profilePhotoUrl || null, initials: driverUser.initials || null } : null,
    live: live ? { latitude: live.latitude, longitude: live.longitude, accuracyM: live.accuracyM, speedKmh: live.speedKmh, secondsAgo: ageS } : null,
    stale: ageS != null && ageS > 120,
    pickup: pickup ? { latitude: pickup.latitude, longitude: pickup.longitude, place: order.pickupPlace || opt.pickupPlace || '' } : null,
    // the seller only sees where it is going when the seller is the one bringing it
    dropoff: dropoff && (iAmCustomer || order.deliveryMethod === 'seller' || phase === 'to_customer' || phase === 'delivered') ? { latitude: dropoff.latitude, longitude: dropoff.longitude, place: order.landmark || order.address || '' } : null,
    remainingKm: remaining, etaMinutes: remaining != null ? Math.max(1, Math.round(remaining * 1.3 / speed * 60)) : null,
    trail: d && d.status === 'active' && Array.isArray(d.track) ? d.track.slice(-120).map(p => [p[0], p[1]]) : [],
    contacts: contactsFor(order, d, driverUser, seller, req.user.sub),
    orderNumber: order.bookingNumber, viewer: viewerIsSeller ? 'seller' : 'customer',
  });
});
// Who each person may call: only while the order is open.
function contactsFor(order, d, driverUser, seller, viewerId, customerUser) {
  if (order.status !== 'active') return {};
  const out = {};
  const driverOpen = d && d.status === 'active';
  if (viewerId === order.customerId) { if (seller) out.seller = contactOf(seller); if (driverOpen && driverUser) out.driver = contactOf(driverUser); }
  else if (viewerId === order.providerId) { if (driverOpen && driverUser) out.driver = contactOf(driverUser); if (order.deliveryMethod === 'seller' && customerUser) out.customer = contactOf(customerUser); }
  return out;
}

// GET /api/store/orders/mine
// v148: sellers and drivers only see orders that were paid for.
const paidForSeller = (c) => c.status !== 'awaiting_payment' && !(c.cancelReason === 'Not paid' && !c.paidAt);
router.get('/store/orders/mine', requireAuth, async (req, res) => {
  const me = req.user.sub;
  const newest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));
  // v139: everyone can buy and sell in the Market, so both lists are for everyone.
  const bought = (await db.filter('contracts', c => c.customerId === me && c.storeOrder === true)).sort(newest);
  const buying = await Promise.all(bought.slice(0, 100).map(o => orderView(o, me)));
  if (req.user.role === 'customer') {
    const sold = (await db.filter('contracts', c => c.providerId === me && c.storeOrder === true && paidForSeller(c))).sort(newest);
    return res.json({ orders: buying, buying, selling: await Promise.all(sold.slice(0, 100).map(o => orderView(o, me))) });
  }
  if (req.user.role !== 'provider') return res.status(403).json({ error: 'Store orders are for customers and pros' });
  const selling = (await db.filter('contracts', c => c.providerId === me && c.storeOrder === true && paidForSeller(c))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const mine = (await db.filter('contracts', c => c.providerId === me && c.delivery && paidForSeller(c))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const delivering = [];
  for (const d of mine.slice(0, 100)) {
    const order = await db.find('contracts', c => c.id === d.delivery.forContractId);
    const h = d.handover || {};
    delivering.push({
      contractId: d.id, number: d.bookingNumber, status: d.status, price: d.amount, createdAt: d.createdAt, answerBy: d.status === 'pending_provider_confirmation' ? d.providerResponseDeadline : null,
      orderNumber: d.delivery.orderNumber, storeName: d.delivery.storeName, items: d.delivery.items, itemCount: d.delivery.itemCount, distanceKm: d.delivery.distanceKm,
      pickup: { place: d.delivery.pickupPlace, location: d.delivery.pickupLocation || null },
      dropoff: { address: d.address, landmark: d.landmark || null, location: d.jobLocation || null },
      orderStatus: order ? order.status : null, orderReadyAt: order ? (order.readyAt || null) : null,
      pickedUpAt: (h.pickup && h.pickup[0] && h.pickup[0].at) || null, droppedOffAt: (h.dropoff && h.dropoff[0] && h.dropoff[0].at) || null,
      contacts: d.status === 'active' ? { customer: contactOf(await db.find('users', u => u.id === d.customerId)), seller: contactOf(await db.find('users', u => u.id === d.delivery.sellerId)) } : {}, // v111
      customerFirstName: undefined,
      pickupCode: (d.status === 'active' && !(h.pickup && h.pickup.length)) ? ((await db.find('deliveryCodes', x => x.contractId === d.id)) || {}).pickupCode || null : null, // v111: show this to the seller
    });
  }
  res.json({ selling: await Promise.all(selling.slice(0, 100).map(o => orderView(o, me))), delivering, buying, orders: buying });
});

// POST /api/store/orders/:id/ready — the seller says the goods are packed.
router.post('/store/orders/:id/ready', requireAuth, async (req, res) => { // v139: personal sellers too
  const order = await db.find('contracts', c => c.id === req.params.id && c.providerId === req.user.sub && c.storeOrder === true);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'active') return res.status(400).json({ error: `This order is ${String(order.status).replace(/_/g, ' ')}.` });
  if (order.readyAt) return res.json({ order: await orderView(order, req.user.sub) });
  const updated = await db.update('contracts', order.id, { readyAt: new Date().toISOString() });
  const seller = await db.find('users', u => u.id === order.providerId);
  const name = (seller && seller.store && seller.store.name) || 'The store';
  const method = order.deliveryMethod || 'pickup';
  await notify(order.customerId, '📦', method === 'pickup' ? `Your store order #${order.bookingNumber} is ready to collect from ${name}: ${order.pickupPlace || 'see the order for the place'}.` : method === 'seller' ? `Your store order #${order.bookingNumber} is packed. ${name} will bring it to you.` : `Your store order #${order.bookingNumber} is packed and waiting for the driver.`, 'bookingUpdates', { section: 'orders' });
  const d = await so.deliveryOf(order);
  if (d && d.status === 'active') await notify(d.providerId, '📦', `Store order #${order.bookingNumber} is packed and ready for you to collect from ${name}.`, 'bookingUpdates', { section: 'bookings' });
  res.json({ order: await orderView(updated, req.user.sub) });
});

// POST /api/store/orders/:id/delivery — the customer picks a driver after
// the first one fell through, changes from collecting to a driver, or the
// other way round. { deliveryMethod: 'driver'|'pickup', driverId, driverPrice, jobLocation, landmark, address }
router.post('/store/orders/:id/delivery', requireAuth, requireBuyer, requireCurrentTerms, async (req, res) => {
  if (contractStatusLocks.has(req.params.id)) return res.status(409).json({ error: 'This order is already being updated. Please try again in a moment.' });
  contractStatusLocks.add(req.params.id);
  try {
    const order = await db.find('contracts', c => c.id === req.params.id && c.customerId === req.user.sub && c.storeOrder === true);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'active') return res.status(400).json({ error: `This order is ${String(order.status).replace(/_/g, ' ')}, so its delivery can't be changed.` });
    if (order.deliveryMethod === 'seller') return res.status(400).json({ error: 'The seller is bringing this order, and you have paid them for that. To change it, cancel the order and buy again.' });
    if (so.isLive(await so.deliveryOf(order))) return res.status(409).json({ error: 'A driver is already on this order. Cancel that delivery first if you want a different one.' });
    const seller = await db.find('users', u => u.id === order.providerId);
    const opt = store.storeOptions(seller);
    const b = req.body || {};
    if (b.deliveryMethod === 'pickup') {
      if (!opt.deliveryMethods.includes('pickup')) return res.status(400).json({ error: 'This store doesn\'t offer collection.' });
      const pickupPlace = order.pickupPlace || opt.pickupPlace || [seller.city, seller.country].filter(Boolean).join(', ');
      const updated = await db.update('contracts', order.id, { deliveryMethod: 'pickup', address: `Collect from ${(seller.store && seller.store.name) || seller.name}: ${pickupPlace}`.slice(0, 200), jobLocation: null, landmark: null });
      await notify(seller.id, '🛍️', `The customer will now collect store order #${order.bookingNumber} themselves.`, 'bookingUpdates', { section: 'store' });
      return res.json({ order: await orderView(updated, req.user.sub) });
    }
    if (b.deliveryMethod !== 'driver') return res.status(400).json({ error: 'Choose a driver, or choose to collect it yourself.' });
    if (!opt.deliveryMethods.includes('driver')) return res.status(400).json({ error: 'This store doesn\'t offer delivery by a driver.' });
    // Use the place already on the order unless a new one was sent.
    const sentPlace = b.jobLocation || b.landmark || b.address;
    const where = sentPlace || order.deliveryMethod === 'pickup' || !order.address ? readDropoff(b) : { address: order.address, landmark: order.landmark, jobLocation: order.jobLocation };
    if (where.error) return res.status(400).json({ error: where.error });
    const driver = await db.find('users', u => u.id === b.driverId);
    if (!driver || !so.isDriver(driver) || driver.id === seller.id || driver.id === req.user.sub || String(driver.country || '').toLowerCase() !== String(seller.country || '').toLowerCase()) {
      return res.status(400).json({ code: 'PICK_DRIVER', error: 'Choose a driver from the list. The one you picked isn\'t available any more.' });
    }
    if (b.driverPrice === undefined) return res.status(400).json({ error: 'Approve the driver\'s price first.' });
    const made = await createDelivery({ order, seller, driver, where, payCurrency: order.payCurrency, expectedPrice: b.driverPrice });
    if (made.error) return res.status(409).json({ code: made.code, price: made.price, error: made.error });
    if (!made.payment) await notify(seller.id, '🚚', `A driver (${driver.name}) has been asked to collect store order #${order.bookingNumber}.`, 'bookingUpdates', { section: 'store' });
    const fresh = await db.find('contracts', c => c.id === order.id);
    res.json({ order: await orderView(fresh, req.user.sub), payment: made.payment || null, delivery: made.payment ? { id: made.delivery.id, bookingNumber: made.delivery.bookingNumber, service: made.delivery.service } : undefined });
  } finally { contractStatusLocks.delete(req.params.id); }
});

// POST /api/store/orders/:id/received — "I have my goods". Releases the
// seller's money, and the driver's if a driver brought them.
router.post('/store/orders/:id/received', requireAuth, requireBuyer, async (req, res) => {
  if (contractStatusLocks.has(req.params.id)) return res.status(409).json({ error: 'This order is already being updated. Please try again in a moment.' });
  contractStatusLocks.add(req.params.id);
  try {
    const order = await db.find('contracts', c => c.id === req.params.id && c.customerId === req.user.sub && c.storeOrder === true);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'active') return res.status(400).json({ error: `This order is already ${String(order.status).replace(/_/g, ' ')}.` });
    const { completeContractCore } = require('./payments.routes');
    const done = await completeContractCore(order, 0, req.user.sub);
    await so.afterComplete(order, req.user.sub);
    await require('../market').afterOrderEnds(done.contract); // v139: a personal listing is marked sold
    res.json({ order: await orderView(done.contract, req.user.sub) });
  } finally { contractStatusLocks.delete(req.params.id); }
});

// ── RECEIPTS ───────────────────────────────────────────────────────────
// GET /api/store/orders/:id/receipt — a PDF receipt for any booking that
// includes goods from a store, for the customer and for the seller. For a
// delivery booking, a receipt for the customer and the driver.
router.get('/store/orders/:id/receipt', requireAuth, async (req, res) => {
  const c = await db.find('contracts', x => x.id === req.params.id && (x.customerId === req.user.sub || x.providerId === req.user.sub));
  if (!c) return res.status(404).json({ error: 'Not found' });
  const hasGoods = Array.isArray(c.storeItems) && c.storeItems.length > 0;
  if (!hasGoods && !c.delivery) return res.status(404).json({ error: 'There is no store receipt for this booking.' });
  const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
  if (!escrow) return res.status(409).json({ error: 'Nothing has been paid on this yet, so there is no receipt.' });
  const seller = await db.find('users', u => u.id === c.providerId);
  const customer = await db.find('users', u => u.id === c.customerId);
  const iAmCustomer = c.customerId === req.user.sub;
  const { createReportDoc } = require('../pdf-report-builder');
  const number = `R-${c.bookingNumber || c.id}`;
  const $ = (n) => `$${Number(n || 0).toFixed(2)}`;
  const storeName = c.delivery ? (seller ? seller.name : 'Driver') : ((seller && seller.store && seller.store.name) || (seller && seller.name) || 'Store');
  const r = createReportDoc({ res, filename: `Receipt-${number}.pdf`, title: c.delivery ? 'Delivery Receipt' : 'Store Receipt', subtitle: `From ${storeName}`.slice(0, 90), docId: number, verificationSeed: `receipt|${c.id}|${c.amount}|${escrow.status}` });
  r.sectionHeader(c.delivery ? 'Delivered by' : 'Sold by');
  r.row(storeName, c.delivery ? [so.driverRates(seller || {}).vehicle, seller && seller.city].filter(Boolean).join('  ·  ') : [seller && seller.name, seller && [seller.city, seller.country].filter(Boolean).join(', ')].filter(Boolean).join('  ·  '));
  r.sectionHeader(c.delivery ? 'Delivered to' : 'Sold to');
  // v164: the place, in full: the address and landmark the customer gave or
  // picked, and the pin as a Plus Code with a map link. Only the customer,
  // and whoever carries the goods there, see where they are going.
  const { placeLines } = require('../plus-code');
  const seesDropoff = c.deliveryMethod !== 'pickup' && (iAmCustomer || c.deliveryMethod === 'seller' || !!c.delivery);
  r.row(customer ? customer.name : 'Customer', seesDropoff && !c.jobLocation && !c.landmark ? String(c.address || '').slice(0, 90) : '');
  if (seesDropoff && (c.jobLocation || c.landmark)) r.placeBlock(placeLines({ address: c.address, landmark: c.landmark, pin: c.jobLocation }));
  if (!c.delivery && c.deliveryMethod === 'pickup') {
    const opt = store.storeOptions(seller || {});
    const from = c.marketListingId ? { place: c.pickupPlace, pin: c.pickupLocation } : { place: opt.pickupPlace, pin: opt.pickupLocation };
    const lines = placeLines({ address: from.place, pin: from.pin });
    if (lines.length) { r.sectionHeader('Collect from'); r.placeBlock(lines); }
  }
  r.twoColumnRow('Receipt number', number, 'Date', String(c.createdAt || '').slice(0, 10));
  const moneyLine = escrow.status === 'held' ? 'Paid. Held by Trothen until the customer confirms they have the goods.'
    : escrow.status === 'released' ? `Paid${c.completedAt ? ' and received on ' + String(c.completedAt).slice(0, 10) : ''}. Released to the ${c.delivery ? 'driver' : 'seller'}.`
    : escrow.status === 'refunded' ? 'Refunded to the customer.' : String(escrow.status);
  r.row('Payment', moneyLine);
  let driverPart = 0;
  if (c.delivery) {
    r.sectionHeader('Delivery');
    r.row('For', `Store order #${c.delivery.orderNumber} from ${c.delivery.storeName}`);
    r.row('Collected from', String(c.delivery.pickupPlace || '').slice(0, 90));
    if (c.delivery.pickupLocation) r.placeBlock(placeLines({ pin: c.delivery.pickupLocation }));
    if (c.delivery.distanceKm) r.row('Distance', `About ${so.distWords(c.delivery.distanceKm, seller && seller.country)}`);
    r.twoColumnRow('Delivery price', $(c.amount), iAmCustomer ? 'Trothen service fee' : ' ', iAmCustomer ? $(c.serviceFee) : ' ');
    if (iAmCustomer) r.twoColumnRow('Total paid', $(money(c.amount + (c.serviceFee || 0))), escrow.paidAmountLocal ? `Paid in ${escrow.paidCurrency}` : ' ', escrow.paidAmountLocal ? String(escrow.paidAmountLocal) : ' ');
  } else {
    r.sectionHeader('Goods');
    r.table(
      [{ label: 'Good', width: 230 }, { label: 'Qty', width: 50, align: 'right' }, { label: 'Each', width: 110, align: 'right' }, { label: 'Total', width: 90, align: 'right' }],
      c.storeItems.map(i => [String(i.name).slice(0, 44) + (i.unit ? ` (${String(i.unit).slice(0, 12)})` : ''), String(i.qty), i.priceCurrency ? `${i.priceCurrency} ${Number(i.unitPriceLocal).toFixed(2)} = ${$(i.unitPrice)}` : $(i.unitPrice), $(i.lineTotal)])
    );
    r.y += 14;
    const labour = money((c.amount || 0) - (c.storeGoodsTotal || 0));
    const customerStoreFee = c.storeFeePaidBy === 'customer' ? (c.storeFee || 0) : 0;
    r.twoColumnRow('Goods total', $(c.storeGoodsTotal), c.storeOrder ? (c.sellerDeliveryFee > 0 ? 'Seller\'s delivery charge' : 'Delivery') : 'Job amount', c.storeOrder ? (c.sellerDeliveryFee > 0 ? $(c.sellerDeliveryFee) : (store.DELIVERY_LABELS[c.deliveryMethod || 'pickup'] || '').replace(/^I collect it myself$/, 'Collected by the customer')) : $(labour));
    if (iAmCustomer) {
      r.twoColumnRow('Store purchase fee', customerStoreFee > 0 ? $(customerStoreFee) : 'None', 'Trothen service fee', $(money((c.serviceFee || 0) - customerStoreFee)));
      // A driver's delivery is a separate payment; show it so the customer has one piece of paper.
      const d = await so.deliveryOf(c);
      if (d && ['active', 'completed'].includes(d.status)) {
        const driver = await db.find('users', u => u.id === d.providerId);
        driverPart = money(d.amount + (d.serviceFee || 0));
        r.twoColumnRow(`Delivery by ${driver ? driver.name : 'a driver'}`.slice(0, 40), $(d.amount), 'Service fee on delivery', $(d.serviceFee));
      }
      r.twoColumnRow('Total paid', $(money((c.amount || 0) + (c.serviceFee || 0) + driverPart)), escrow.paidAmountLocal ? `Goods paid in ${escrow.paidCurrency}` : ' ', escrow.paidAmountLocal ? String(escrow.paidAmountLocal) : ' ');
    } else {
      r.twoColumnRow('Customer paid you', $(c.amount), c.storeFeePaidBy === 'pro' ? 'Store purchase fee (taken at payout)' : ' ', c.storeFeePaidBy === 'pro' ? `- ${$(Math.min(c.storeFee || 0, c.storeGoodsTotal || 0))}` : ' ');
    }
    if (c.orderNote && (iAmCustomer || c.storeOrder)) { r.sectionHeader('Note from the customer'); r.paragraph(String(c.orderNote), { size: 10, color: '#12161F' }); }
  }
  const simulated = process.env.PAYMENTS_LIVE === 'true' ? '' : ' Payments are simulated during early access: no real money moved.';
  r.finish({ closingNote: c.delivery
    ? 'This delivery was booked and paid for through Trothen. The driver named above carried the goods; Trothen held the payment. Amounts are in US dollars.' + simulated
    : 'These goods were sold by the seller named above, not by Trothen. Trothen held the payment and released it when the customer confirmed they had the goods. Amounts are in US dollars.' + simulated + ' If something is missing, wrong or damaged, use "Report a Problem" on the order.' });
});

// ── v143: RETURNS ────────────────────────────────────────────────────
// The buyer asks within the store's return window (counted from the day the
// order completed). Faulty, wrong, damaged or not-as-described goods can
// always be returned in the window; "changed my mind" only where the store
// accepts it. The seller accepts or declines within 3 days (no answer =
// accepted). The buyer brings or sends the goods back and says so; the
// seller confirms they have them, and the buyer is refunded from the money
// Trothen still holds. A declined return, or one the seller doesn't confirm
// within 7 days of it being sent back, goes to the Trothen team to decide.
const extras = require('../store-extras');
const returnLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Please wait a little and try again.' } });
async function withOrder(req, res, who, fn) {
  if (contractStatusLocks.has(req.params.id)) return res.status(409).json({ error: 'This order is being updated. Please try again in a moment.' });
  contractStatusLocks.add(req.params.id);
  try {
    const o = await db.find('contracts', c => c.id === req.params.id && c.storeOrder === true && (who === 'buyer' ? c.customerId === req.user.sub : c.providerId === req.user.sub));
    if (!o) return res.status(404).json({ error: 'Order not found' });
    return await fn(o);
  } finally { contractStatusLocks.delete(req.params.id); }
}
const returnWords = (rr) => rr.items.map(i => `${i.qty} × ${i.name}`).join(', ');
router.post('/store/orders/:id/return', requireAuth, returnLimiter, (req, res) => withOrder(req, res, 'buyer', async (o) => {
  const b = req.body || {};
  if (o.marketListingId) return res.status(400).json({ error: 'Private sales can\'t be returned. If the item wasn\'t as described, contact support.' });
  const until = extras.returnUntil(o);
  if (o.status !== 'completed' || !until || Date.parse(until) <= Date.now()) return res.status(400).json({ error: o.status === 'active' ? 'This order isn\'t complete yet. If something is wrong, use "Report a Problem" on it before confirming you have your goods.' : 'The return window for this order has ended.' });
  if (o.returnRequest && o.returnRequest.status !== 'declined_final') return res.status(409).json({ error: 'A return was already asked for on this order.' });
  if (!extras.REASONS[b.reason]) return res.status(400).json({ error: 'Choose why you are returning it' });
  if (b.reason === 'changed_mind' && !(o.returnPolicy && o.returnPolicy.changeOfMind)) return res.status(400).json({ error: 'This store only takes back goods that are faulty, wrong, damaged or not as described.' });
  if (!Array.isArray(b.items) || !b.items.length) return res.status(400).json({ error: 'Choose what you are returning' });
  const items = [];
  for (const it of b.items) {
    const line = (o.storeItems || []).find(l => l.goodId === (it && it.goodId) && (l.variantId || null) === ((it && it.variantId) || null));
    const qty = Number(it && it.qty);
    if (!line || !Number.isInteger(qty) || qty < 1 || qty > line.qty) return res.status(400).json({ error: 'Choose goods and quantities from this order' });
    items.push({ goodId: line.goodId, variantId: line.variantId || null, name: line.name, qty, amount: money(line.lineTotal * qty / line.qty) });
  }
  // A discount is shared out over the goods, so the refund is what was really paid for them.
  const share = (o.goodsBeforeDiscount || 0) > 0 ? (o.storeGoodsTotal || 0) / o.goodsBeforeDiscount : 1;
  const amount = money(Math.min(o.storeGoodsTotal || 0, items.reduce((n, i) => n + i.amount, 0) * share));
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) : '';
  const photos = Array.isArray(b.photoUrls) ? b.photoUrls.filter(u => typeof u === 'string' && /^\/(uploads|handover)\//.test(u)).slice(0, 4) : [];
  if (b.reason !== 'changed_mind' && note.length < 10) return res.status(400).json({ error: 'Say what is wrong in a few words, so the seller can check it.' });
  const rr = { status: 'requested', reason: b.reason, reasonWords: extras.REASONS[b.reason], note, photoUrls: photos, items, amount, requestedAt: new Date().toISOString(), answerBy: new Date(Date.now() + 3 * extras.DAY).toISOString() };
  await db.update('contracts', o.id, { returnRequest: rr });
  await notify(o.providerId, '↩️', `Return asked on store order #${o.bookingNumber}: ${returnWords(rr)} (${rr.reasonWords}). Accept or decline by ${new Date(rr.answerBy).toDateString()}, or it is accepted automatically. The money for this order is held until it is settled.`, 'bookingUpdates', { section: 'store' });
  res.status(201).json({ returnRequest: rr });
}));
router.post('/store/orders/:id/return/answer', requireAuth, requireRole('provider'), (req, res) => withOrder(req, res, 'seller', async (o) => {
  const rr = o.returnRequest; const { decision, note } = req.body || {};
  if (!rr || rr.status !== 'requested') return res.status(400).json({ error: 'There is no return waiting for your answer.' });
  if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ error: 'Accept or decline the return' });
  const why = typeof note === 'string' ? note.trim().slice(0, 300) : '';
  if (decision === 'decline' && why.length < 10) return res.status(400).json({ error: 'Say why you decline, in a few words. The buyer can ask the Trothen team to decide.' });
  const opt = store.storeOptions(await db.find('users', u => u.id === o.providerId));
  const next = decision === 'accept'
    ? { ...rr, status: 'accepted', answeredAt: new Date().toISOString(), sellerNote: why || null, returnTo: opt.pickupPlace || null }
    : { ...rr, status: 'declined', answeredAt: new Date().toISOString(), sellerNote: why };
  await db.update('contracts', o.id, { returnRequest: next });
  await notify(o.customerId, '↩️', decision === 'accept' ? `The seller accepted your return on order #${o.bookingNumber}. Bring or send back ${returnWords(rr)}${opt.pickupPlace ? ` to ${opt.pickupPlace}` : ''}, then press "I've sent it back". You're refunded when the seller has it.` : `The seller declined your return on order #${o.bookingNumber}: "${why}". If you disagree, press "Ask Trothen to decide" on the order.`, 'bookingUpdates', { section: 'orders' });
  res.json({ returnRequest: next });
}));
router.post('/store/orders/:id/return/sent', requireAuth, (req, res) => withOrder(req, res, 'buyer', async (o) => {
  const rr = o.returnRequest;
  if (!rr || rr.status !== 'accepted') return res.status(400).json({ error: 'The seller hasn\'t accepted a return on this order.' });
  const photos = Array.isArray((req.body || {}).photoUrls) ? req.body.photoUrls.filter(u => typeof u === 'string' && /^\/(uploads|handover)\//.test(u)).slice(0, 4) : [];
  const next = { ...rr, status: 'sent', sentAt: new Date().toISOString(), sentPhotoUrls: photos, sentNote: typeof (req.body || {}).note === 'string' ? req.body.note.trim().slice(0, 300) : '', confirmBy: new Date(Date.now() + 7 * extras.DAY).toISOString() };
  await db.update('contracts', o.id, { returnRequest: next });
  await notify(o.providerId, '📦', `The buyer says they've sent back ${returnWords(rr)} (order #${o.bookingNumber}). When you have it, press "I have it back" so they are refunded.`, 'bookingUpdates', { section: 'store' });
  res.json({ returnRequest: next });
}));
router.post('/store/orders/:id/return/received', requireAuth, requireRole('provider'), (req, res) => withOrder(req, res, 'seller', async (o) => {
  const rr = o.returnRequest;
  if (!rr || !['sent', 'accepted'].includes(rr.status)) return res.status(400).json({ error: 'There is no return on its way back to you.' });
  const out = await extras.refundReturn(o, (req.body || {}).restock !== false);
  if (out.error) return res.status(400).json({ error: out.error });
  await notify(o.customerId, '💸', `The seller has your return from order #${o.bookingNumber}. $${out.refunded.toFixed(2)} is refunded to you.`, 'bookingUpdates', { section: 'orders' });
  res.json({ refunded: out.refunded });
}));
router.post('/store/orders/:id/return/escalate', requireAuth, (req, res) => withOrder(req, res, 'buyer', async (o) => {
  const rr = o.returnRequest;
  if (!rr || !['declined', 'sent'].includes(rr.status)) return res.status(400).json({ error: 'There is nothing to ask the Trothen team about on this order.' });
  if (rr.status === 'sent' && Date.parse(rr.sentAt) > Date.now() - 3 * extras.DAY) return res.status(400).json({ error: 'Give the seller a few days to confirm they have it back first.' });
  const next = { ...rr, status: 'escalated', escalatedAt: new Date().toISOString(), escalatedFrom: rr.status };
  await db.update('contracts', o.id, { returnRequest: next });
  await tellReturnsTeam(o, next);
  res.json({ returnRequest: next });
}));
async function tellReturnsTeam(o, rr) {
  const admins = (await db.filter('users', u => u.role === 'admin' && u.active !== false && (u.isSuperAdmin || !u.adminDepartment || ['customer_service', 'legal'].includes(u.adminDepartment)))).slice(0, 25);
  for (const a of admins) await notify(a.id, '↩️', `A store return needs a decision: order #${o.bookingNumber}, ${returnWords(rr)} ($${Number(rr.amount).toFixed(2)}). Open Stores & Skills → Returns.`, null, { section: 'stores' });
}
// The team decides an escalated return.
const returnsAdmin = [requireAuth, requireRole('admin')]; // custom admins: the "returns" actions in Stores & Skills (src/admin-permissions.js)
router.get('/admin/store/returns', ...returnsAdmin, async (req, res) => {
  const rows = (await db.filter('contracts', c => c.storeOrder && c.returnRequest && ['escalated', 'requested', 'accepted', 'sent', 'declined'].includes(c.returnRequest.status)))
    .sort((a, b) => String(a.returnRequest.requestedAt).localeCompare(String(b.returnRequest.requestedAt)));
  const out = [];
  for (const o of rows) {
    const seller = await db.find('users', u => u.id === o.providerId), buyer = await db.find('users', u => u.id === o.customerId);
    out.push({ id: o.id, number: o.bookingNumber, store: seller && seller.store ? seller.store.name : '', seller: seller ? seller.name : '', buyer: buyer ? buyer.name : '', completedAt: o.completedAt, returnRequest: o.returnRequest });
  }
  res.json({ returns: out });
});
router.post('/admin/store/returns/:id/decide', ...returnsAdmin, async (req, res) => {
  const o = await db.find('contracts', c => c.id === req.params.id && c.storeOrder && c.returnRequest);
  if (!o) return res.status(404).json({ error: 'Return not found' });
  const { decision, note } = req.body || {};
  if (!['refund', 'refuse'].includes(decision)) return res.status(400).json({ error: 'Refund the buyer, or refuse the return' });
  const why = typeof note === 'string' ? note.trim().slice(0, 300) : '';
  if (why.length < 5) return res.status(400).json({ error: 'Add a short note for both sides' });
  const admin = await db.find('users', u => u.id === req.user.sub);
  if (decision === 'refund') {
    const out = await extras.refundReturn(o, false);
    if (out.error) return res.status(400).json({ error: out.error });
    const after = await db.find('contracts', c => c.id === o.id);
    await db.update('contracts', o.id, { returnRequest: { ...after.returnRequest, decidedBy: admin.name, decidedNote: why } });
    await notify(o.customerId, '⚖️', `Trothen decided your return on order #${o.bookingNumber}: $${out.refunded.toFixed(2)} is refunded to you. ${why}`, 'bookingUpdates', { section: 'orders' });
    await notify(o.providerId, '⚖️', `Trothen decided the return on order #${o.bookingNumber}: the buyer is refunded $${out.refunded.toFixed(2)}. ${why}`, 'bookingUpdates', { section: 'store' });
  } else {
    await db.update('contracts', o.id, { returnRequest: { ...o.returnRequest, status: 'declined_final', decidedBy: admin.name, decidedNote: why, decidedAt: new Date().toISOString() } });
    await notify(o.customerId, '⚖️', `Trothen decided your return on order #${o.bookingNumber}: it is not refunded. ${why}`, 'bookingUpdates', { section: 'orders' });
    await notify(o.providerId, '⚖️', `Trothen decided the return on order #${o.bookingNumber} in your favour. The money for the order is released to you. ${why}`, 'bookingUpdates', { section: 'store' });
  }
  try { await db.insert('accessLogs', { id: `al_${nanoid(10)}`, adminId: admin.id, resourceType: 'store_return', resourceId: o.id, ipAddress: req.ip, createdAt: new Date().toISOString() }); } catch (e) {}
  res.json({ ok: true });
});
// Runs with the store sweeps: unanswered returns are accepted; returns not confirmed in time go to the team.
async function sweepReturns() {
  const now = Date.now(); let n = 0;
  for (const o of await db.filter('contracts', c => c.storeOrder && c.returnRequest && ['requested', 'sent'].includes(c.returnRequest.status))) {
    const rr = o.returnRequest;
    if (rr.status === 'requested' && Date.parse(rr.answerBy) <= now) {
      const opt = store.storeOptions(await db.find('users', u => u.id === o.providerId));
      await db.update('contracts', o.id, { returnRequest: { ...rr, status: 'accepted', answeredAt: new Date().toISOString(), autoAccepted: true, returnTo: opt.pickupPlace || null } });
      await notify(o.customerId, '↩️', `The seller didn't answer in time, so your return on order #${o.bookingNumber} is accepted. Bring or send it back${opt.pickupPlace ? ` to ${opt.pickupPlace}` : ''}, then press "I've sent it back".`, 'bookingUpdates', { section: 'orders' });
      await notify(o.providerId, '↩️', `You didn't answer the return on order #${o.bookingNumber} in time, so it was accepted.`, 'bookingUpdates', { section: 'store' }); n++;
    } else if (rr.status === 'sent' && rr.confirmBy && Date.parse(rr.confirmBy) <= now) {
      const next = { ...rr, status: 'escalated', escalatedAt: new Date().toISOString(), escalatedFrom: 'sent', autoEscalated: true };
      await db.update('contracts', o.id, { returnRequest: next }); await tellReturnsTeam(o, next); n++;
    }
  }
  return n;
}

module.exports = router;
module.exports.sweepReturns = sweepReturns;
module.exports.createDelivery = createDelivery; // v139: the Market's personal listings
module.exports.orderView = orderView;
module.exports.afterPaid = afterPaid; // v148
module.exports.readDropoff = readDropoff;
module.exports.customerCanBuy = customerCanBuy;
