// v108: store orders and their delivery.
//
// A store order is goods bought from a pro's store with no job attached.
// The customer chooses how the goods reach them:
//
//   pickup  - the customer collects from the seller
//   seller  - the seller brings them, for the seller's own delivery charge
//   driver  - a pick-and-drop driver brings them. Trothen suggests drivers,
//             the customer picks one and approves that driver's price.
//
// How it is kept: the order is a booking with the seller (so the money is
// held, paid out, refunded and disputed exactly like every other booking).
// A driver's delivery is a second booking, with the driver, tied to the
// order. That way the driver is paid separately from the seller, has to
// accept the job, and records pick-up and drop-off with photos and a route
// using the hand-over tools that already exist.
//
// This file holds what other files call. The web addresses are in
// src/routes/orders.routes.js.
const db = require('./db');
const { notify } = require('./notify');
const store = require('./store');
const { distanceInMiles } = require('./geo-distance');

const KM_PER_MILE = 1.609344;
const DELIVERY_RESPONSE_MINUTES = 10; // v147: how long each driver has to answer (was 30), then the next driver is asked
const DELIVERY_MAX_DRIVERS = 3;      // v147: drivers asked one after another before the customer chooses
const MAX_DRIVERS_SUGGESTED = 6;
const money = store.money;

function kmBetween(a, b) {
  if (!a || !b || typeof a.latitude !== 'number' || typeof b.latitude !== 'number') return null;
  return Math.round(distanceInMiles(a.latitude, a.longitude, b.latitude, b.longitude) * KM_PER_MILE * 10) / 10;
}
// Miles where people use miles (the US, Liberia, the UK), kilometres
// elsewhere: the same rule the page uses.
const MILE_COUNTRIES = ['United States', 'Liberia', 'United Kingdom', 'Myanmar'];
function distWords(km, country) {
  if (km == null) return '';
  if (!country || MILE_COUNTRIES.includes(country)) return `${(km / KM_PER_MILE).toFixed(1).replace(/\.0$/, '')} mi`;
  return `${km < 10 ? km.toFixed(1).replace(/\.0$/, '') : Math.round(km)} km`;
}
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// A driver is a verified pro with the "Pick & Drop" skill who is taking work.
// v143: or a ride driver the team approved (licence and vehicle checked),
// unless they switched deliveries off.
function rideDeliverer(u) {
  const r = u && u.rideDriver;
  return !!(r && r.status === 'approved' && r.delivers !== false && ['motorbike', 'keke', 'car', 'van'].includes(r.vehicle));
}
function isDriver(u) {
  return !!(u && u.role === 'provider' && u.verified === true && u.active !== false && u.onHold !== true && u.acceptingBookings !== false && (store.hasSkill(u, store.DRIVER_SKILL) || rideDeliverer(u)));
}
// What a driver charges: a starting price, plus a price per kilometre.
// A driver who hasn't set these is offered at their listed price, flat.
function driverRates(u) {
  const r = (u && u.deliveryRates) || {};
  const base = Number(r.baseFee), perKm = Number(r.perKm);
  const set = Number.isFinite(base) && base > 0;
  const vehicle = store.VEHICLES.includes(r.vehicle) ? r.vehicle : (rideDeliverer(u) ? u.rideDriver.vehicle : null);
  return {
    vehicle,
    baseFee: set ? money(base) : money(Number(u && u.price) > 0 ? u.price : 5),
    perKm: set && Number.isFinite(perKm) && perKm >= 0 ? Math.round(perKm * 10000) / 10000 : 0, // kept to 4 places so a price per mile converts cleanly
    isSet: set,
    ...rangeOf(u, vehicle),
  };
}
// v164: the distances a driver goes (km, straight line). Their own choice,
// kept inside what their kind of vehicle can do.
function rangeOf(u, vehicle) {
  const cap = store.VEHICLE_MAX_KM[vehicle] || 50;
  const r = (u && u.deliveryRange) || {};
  let min = Number(r.minKm), max = Number(r.maxKm);
  if (!Number.isFinite(max) || max <= 0 || max > cap) max = cap;
  if (!Number.isFinite(min) || min < 0 || min >= max) min = 0;
  return { minKm: Math.round(min * 10) / 10, maxKm: Math.round(max * 10) / 10, vehicleMaxKm: cap };
}
const inRange = (rates, km) => km == null || (km >= rates.minKm - 0.05 && km <= rates.maxKm + 0.05);
function quoteFor(u, km) {
  const r = driverRates(u);
  return Math.max(1, money(r.baseFee + (km ? r.perKm * km : 0)));
}
// v143: where Trothen sets fares for the country (Admin → Rides → Fares, in
// L$), a delivery is priced the same way as a ride of that distance on the
// driver's vehicle, at the driver's own setting above or below. A bicycle,
// a truck or a country without fares keeps the driver's own delivery rates.
async function tableQuote(country, vehicle, km, adjust) {
  if (km == null) return null;
  const rideFares = require('./ride-fares');
  const t = await rideFares.tableFor(country);
  if (!t || !t.vehicles || !t.vehicles[vehicle]) return null;
  const { CITY_KMH } = require('./road-route');
  const roadKm = Math.round(km * 1.3 * 10) / 10;
  const f = await rideFares.fareFor({ country, rideDriver: { vehicle, fareAdjust: adjust || 0 } }, { km: roadKm, minutes: Math.max(1, Math.round(roadKm / (CITY_KMH[vehicle] || 20) * 60)), source: 'estimate' }, { table: t });
  return { price: f.fare, local: f.local, currency: f.currency, symbol: f.symbol };
}
async function deliveryPrice(u, km) {
  const vehicle = driverRates(u).vehicle;
  const q = await tableQuote(u && u.country, vehicle, km, u && u.rideDriver ? u.rideDriver.fareAdjust : 0);
  return q ? q.price : quoteFor(u, km);
}

// The drivers to offer for one order: same country as the seller, the
// seller's own city first, then nearest to the store, then best rated.
async function suggestDrivers({ seller, dropoff, customerId, pickup }) {
  const opt = store.storeOptions(seller);
  if (pickup !== undefined) opt.pickupLocation = pickup; // v139: a personal listing's own pick-up place
  const km = kmBetween(opt.pickupLocation, dropoff);
  const all = (await db.filter('users', u => isDriver(u) && u.id !== seller.id && u.id !== customerId && sameText(u.country, seller.country)));
  const rows = await Promise.all(all.map(async u => {
    const rates = driverRates(u);
    const toStore = (typeof u.latitude === 'number' && typeof u.longitude === 'number') ? kmBetween({ latitude: u.latitude, longitude: u.longitude }, opt.pickupLocation) : null;
    return {
      id: u.id, name: u.name, initials: u.initials || null, color: u.color || null, profilePhotoUrl: u.profilePhotoUrl || null,
      city: u.city || '', rating: u.rating || null, jobs: u.jobs || 0,
      isNewPro: u.trustScoreProvisional === true || u.trustScore == null, trustScore: (u.trustScore != null && u.trustScoreProvisional !== true) ? u.trustScore : null,
      vehicle: rates.vehicle, baseFee: rates.baseFee, perKm: rates.perKm, minKm: rates.minKm, maxKm: rates.maxKm,
      price: await deliveryPrice(u, km), kmFromStore: toStore, sameCity: sameText(u.city, seller.city), fits: inRange(rates, km),
    };
  }));
  const outOfRange = rows.filter(x => !x.fits).length;
  for (let i = rows.length - 1; i >= 0; i--) if (!rows[i].fits) rows.splice(i, 1); else delete rows[i].fits; // v164: only drivers who go that far (or that short)
  rows.sort((a, b) => (b.sameCity - a.sameCity)
    || ((a.kmFromStore === null ? 1e9 : a.kmFromStore) - (b.kmFromStore === null ? 1e9 : b.kmFromStore))
    || ((b.rating || 0) - (a.rating || 0)) || (a.price - b.price));
  return { drivers: rows.slice(0, MAX_DRIVERS_SUGGESTED), distanceKm: km, totalFound: rows.length, outOfRange };
}

const isLive = (c) => !!c && ['pending_provider_confirmation', 'active'].includes(c.status);
async function deliveryOf(order) {
  return order && order.deliveryContractId ? db.find('contracts', c => c.id === order.deliveryContractId) : null;
}

// Something happened to a delivery booking: the driver said yes or no,
// didn't answer, or it was cancelled. Tells the people who need to know.
async function deliveryEvent(delivery, event) {
  const d = delivery.delivery || {};
  const order = await db.find('contracts', c => c.id === d.forContractId);
  const driver = await db.find('users', u => u.id === delivery.providerId);
  const who = driver ? driver.name : 'The driver';
  const n = d.orderNumber || (order && order.bookingNumber) || '';
  if (event === 'accepted') {
    await notify(delivery.customerId, '🚚', `${who} accepted the delivery of your store order #${n} for $${delivery.amount}. They will collect it from ${d.storeName || 'the seller'} and bring it to you.`, 'bookingUpdates', { section: 'orders' });
    if (d.sellerId) await notify(d.sellerId, '🚚', `${who} will collect store order #${n}. When you hand it over, record the pick-up with a photo so there is a record of what left your hands.`, 'bookingUpdates', { section: 'store' });
    return;
  }
  const orderStillOpen = order && order.status === 'active';
  // v147: a driver who declines or doesn't answer: ask the next nearest
  // driver automatically (the way Glovo, Bolt Food and Jumia do it), at a
  // price no higher than the customer paid, up to 3 drivers in all.
  if ((event === 'declined' || event === 'expired') && orderStillOpen && order.deliveryContractId === delivery.id) {
    try {
      const next = await nextDriver(delivery, order);
      if (next) {
        const { createDelivery } = require('./routes/orders.routes');
        const where = { address: delivery.address, jobLocation: delivery.jobLocation || null, landmark: delivery.landmark || null };
        const seller = await db.find('users', u => u.id === d.sellerId);
        const r = await createDelivery({ order, seller, driver: next.user, where, payCurrency: delivery.payCurrency });
        if (r && r.delivery) {
          const tried = [...(d.triedDriverIds || []), delivery.providerId];
          await db.update('contracts', r.delivery.id, { delivery: { ...r.delivery.delivery, triedDriverIds: tried, reassignedFrom: delivery.id } });
          const word = event === 'declined' ? "couldn't take" : "didn't answer in time for";
          await notify(delivery.customerId, '🚚', `${who} ${word} the delivery of your store order #${n}, so Trothen asked ${next.user.name}, the next nearest driver, for $${r.delivery.amount.toFixed(2)}${r.delivery.amount < delivery.amount - 0.009 ? ` (less than before; the difference was refunded)` : ''}. They have ${DELIVERY_RESPONSE_MINUTES} minutes to answer. Nothing for you to do.`, 'bookingUpdates', { section: 'orders' });
          if (d.sellerId) await notify(d.sellerId, '🚚', `The driver for store order #${n} changed: ${next.user.name} has been asked to collect it.`, 'bookingUpdates', { section: 'store' });
          return;
        }
      }
    } catch (e) { console.error('[store-orders] next driver:', e.message); }
  }
  const why = event === 'declined' ? `${who} can't take the delivery of` : event === 'expired' ? `${who} didn't answer in time for the delivery of` : `The delivery was cancelled for`;
  if (orderStillOpen) {
    await notify(delivery.customerId, '🚚', `${why} your store order #${n}. The $${delivery.amount} you paid for delivery was refunded. Choose another driver, or collect it yourself, from Store Orders.`, 'bookingUpdates', { section: 'orders' });
    if (d.sellerId) await notify(d.sellerId, '🚚', `The driver for store order #${n} fell through. The customer has been asked to choose another, or to collect it.`, 'bookingUpdates', { section: 'store' });
  }
}

// v147: the next driver to ask, or null: not one already asked, priced no
// higher than what the customer paid, nearest first (the same order the
// customer saw at checkout).
async function nextDriver(delivery, order) {
  const d = delivery.delivery || {};
  const tried = new Set([...(d.triedDriverIds || []), delivery.providerId]);
  if (tried.size >= DELIVERY_MAX_DRIVERS) return null;
  const seller = await db.find('users', u => u.id === d.sellerId);
  if (!seller) return null;
  const busy = new Set((await db.filter('contracts', c => c.delivery && c.status === 'pending_provider_confirmation')).map(c => c.providerId));
  const out = await suggestDrivers({ seller, dropoff: delivery.jobLocation || null, customerId: delivery.customerId, pickup: d.pickupLocation || undefined });
  const pick = (out.drivers || []).find(x => !tried.has(x.id) && !busy.has(x.id) && x.price <= Number(delivery.amount) + 0.009);
  if (!pick) return null;
  const user = await db.find('users', u => u.id === pick.id);
  return user && isDriver(user) ? { user, price: pick.price } : null;
}

// Runs after any booking is cancelled.
async function afterCancel(contract, byUserId) {
  // The order was cancelled: a delivery that hasn't collected the goods goes with it.
  if (contract.storeOrder && contract.deliveryContractId) {
    const d = await deliveryOf(contract);
    if (isLive(d)) {
      const h = d.handover || {};
      if ((h.pickup || []).length) {
        await notify(d.providerId, '⚠️', `Store order #${contract.bookingNumber} was cancelled after you collected it. Do not deliver it. Take the goods back to the seller and record that with a photo. Contact support if you need help.`, 'bookingUpdates', { section: 'bookings' });
      } else {
        const esc = await db.find('escrowTransactions', e => e.contractId === d.id);
        if (esc && esc.status === 'held') await db.update('escrowTransactions', esc.id, { status: 'refunded' });
        await db.update('contracts', d.id, { status: 'cancelled', cancelledByRole: 'order_cancelled', cancelReasonCategory: 'other' });
        await notify(d.providerId, '🚫', `The store order you were going to deliver (#${contract.bookingNumber}) was cancelled, so the delivery is cancelled too.`, 'bookingUpdates', { section: 'bookings' });
      }
    }
    return;
  }
  // A delivery was cancelled by the driver or the customer.
  if (contract.delivery) {
    const d = contract.delivery;
    const order = await db.find('contracts', c => c.id === d.forContractId);
    if (order && order.status === 'active') {
      if (d.sellerId) await notify(d.sellerId, '🚚', `The delivery for store order #${d.orderNumber || order.bookingNumber} was cancelled. The customer can choose another driver, or collect it.`, 'bookingUpdates', { section: 'store' });
      if (byUserId !== contract.customerId) await notify(contract.customerId, '🚚', `Choose another driver for store order #${d.orderNumber || order.bookingNumber}, or collect it yourself, from Store Orders.`, 'bookingUpdates', { section: 'orders' });
    }
  }
}

// Runs after the customer says they have their goods: the delivery that
// brought them is completed with it, so the driver is paid too.
async function afterComplete(order, customerId) {
  if (!order.storeOrder || !order.deliveryContractId) return null;
  const d = await deliveryOf(order);
  if (!d) return null;
  if (d.status === 'active') {
    const { completeContractCore } = require('./routes/payments.routes');
    return (await completeContractCore(d, 0, customerId)).contract;
  }
  if (d.status === 'pending_provider_confirmation') {
    // The customer already has the goods and the driver never accepted: nothing to deliver.
    const esc = await db.find('escrowTransactions', e => e.contractId === d.id);
    if (esc && esc.status === 'held') await db.update('escrowTransactions', esc.id, { status: 'refunded' });
    await db.update('contracts', d.id, { status: 'cancelled', cancelledByRole: 'order_completed', cancelReasonCategory: 'other' });
    await notify(d.providerId, '🚫', `The delivery request for store order #${order.bookingNumber} is no longer needed. The customer already has the goods.`, 'bookingUpdates', { section: 'bookings' });
  }
  return null;
}

module.exports = {
  DELIVERY_MAX_DRIVERS, nextDriver,
  DELIVERY_RESPONSE_MINUTES, MAX_DRIVERS_SUGGESTED, kmBetween, distWords, isDriver, driverRates, quoteFor, suggestDrivers,
  rideDeliverer, tableQuote, deliveryPrice, // v143
  rangeOf, inRange, // v164
  isLive, deliveryOf, deliveryEvent, afterCancel, afterComplete,
};
