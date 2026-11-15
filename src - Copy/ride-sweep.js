// v112: housekeeping for rides. Without this a ride that goes wrong in a quiet
// way (the rider never taps confirm, the driver's phone dies mid-trip, nobody
// turns up) would leave money held and data kept forever.
//   1. Fare released to the driver if the rider stays silent after the trip ended.
//   2. Accepted ride that never started is cancelled and refunded.
//   3. Trip that started but was never ended is flagged to the Trothen team.
//   4. GPS routes and last-known positions are deleted after a set time.
//   5. Drivers whose licence or insurance has run out are taken offline, and
//      warned a week before.
const db = require('./db');
const { getSetting } = require('./platform-settings');
const { notify } = require('./notify');
const { contractStatusLocks } = require('./contract-locks');

const HOUR = 3600 * 1000, DAY = 24 * HOUR;
const today = () => new Date().toISOString().slice(0, 10);

async function openSosFor(contractId) {
  return !!(await db.find('rideSafetyEvents', e => e.contractId === contractId && e.status === 'open'));
}
async function notifyAdmins(text) {
  const admins = (await db.filter('users', u => u.role === 'admin' && u.active !== false)).slice(0, 25);
  for (const a of admins) { try { await notify(a.id, '🛵', text, null, { section: 'rides' }); } catch (e) { /* best effort */ } }
}
async function locked(id, fn) {
  if (contractStatusLocks.has(id)) return false;
  contractStatusLocks.add(id);
  try { return await fn(); } finally { contractStatusLocks.delete(id); }
}

// 1. The rider never confirmed.
async function releaseUnconfirmed() {
  const hours = Number(await getSetting('rideAutoReleaseHours'));
  if (!(hours > 0)) return 0;
  const cutoff = Date.now() - hours * HOUR;
  const list = await db.filter('contracts', c => c.ride && c.status === 'active' && c.ride.startedAt && c.ride.endedAt && new Date(c.ride.endedAt).getTime() < cutoff);
  let n = 0;
  for (const c of list) {
    try {
      const done = await locked(c.id, async () => {
        const fresh = await db.find('contracts', x => x.id === c.id);
        if (!fresh || fresh.status !== 'active' || !fresh.ride.endedAt) return false;
        if (await openSosFor(fresh.id)) return false; // a safety alert is open: a person decides
        const { completeContractCore } = require('./routes/payments.routes');
        await completeContractCore(fresh, 0, fresh.customerId);
        const after = await db.find('contracts', x => x.id === fresh.id);
        await db.update('contracts', fresh.id, { ride: { ...after.ride, autoReleased: true, autoReleasedAt: new Date().toISOString(), live: null, track: null } });
        await notify(fresh.customerId, '✅', fresh.ride.cash ? `Ride #${fresh.bookingNumber} ended ${hours} hours ago and you did not report a problem, so it was closed as complete.` : `Ride #${fresh.bookingNumber} ended ${hours} hours ago and you did not report a problem, so the fare was released to the driver. If something was wrong, use "Report a Problem" on the booking.`, 'bookingUpdates', { section: 'rides' });
        await notify(fresh.providerId, '💸', fresh.ride.cash ? `Ride #${fresh.bookingNumber}: the rider did not confirm, so it was closed as complete.` : `Ride #${fresh.bookingNumber}: the rider did not confirm, so the fare was released to you automatically.`, 'bookingUpdates', { section: 'rides' });
        return true;
      });
      if (done) n++;
    } catch (e) { console.error('[ride-sweep] release failed for', c.id, e.message); }
  }
  return n;
}

// 2. Accepted but nobody ever started the trip.
async function cancelNeverStarted() {
  const hours = Number(await getSetting('rideNoStartHours'));
  if (!(hours > 0)) return 0;
  const cutoff = Date.now() - hours * HOUR;
  const list = await db.filter('contracts', c => c.ride && c.status === 'active' && !c.ride.startedAt && new Date(c.createdAt).getTime() < cutoff);
  let n = 0;
  for (const c of list) {
    try {
      const done = await locked(c.id, async () => {
        const fresh = await db.find('contracts', x => x.id === c.id);
        if (!fresh || fresh.status !== 'active' || fresh.ride.startedAt) return false;
        if (await openSosFor(fresh.id)) return false;
        const escrow = await db.find('escrowTransactions', e => e.contractId === fresh.id);
        if (escrow && escrow.status === 'held') await db.update('escrowTransactions', escrow.id, { status: 'refunded' });
        try { await require('./loyalty').givePointsBack(fresh); } catch (e) { /* points are best effort */ }
        await db.update('contracts', fresh.id, { status: 'cancelled', cancelReasonCategory: 'ride_not_started', cancelledByRole: 'system', protectedCancellation: false, ride: { ...fresh.ride, live: null, track: null } });
        await notify(fresh.customerId, '↩️', fresh.ride.cash ? `Ride #${fresh.bookingNumber} never started, so it was cancelled. You paid nothing.` : `Ride #${fresh.bookingNumber} never started, so it was cancelled and you were refunded in full.`, 'bookingUpdates', { section: 'rides' });
        await notify(fresh.providerId, '⚠️', `Ride #${fresh.bookingNumber} never started and was cancelled.`, 'bookingUpdates', { section: 'rides' });
        return true;
      });
      if (done) n++;
    } catch (e) { console.error('[ride-sweep] cancel failed for', c.id, e.message); }
  }
  return n;
}

// 3. Started, never ended.
async function flagStuckTrips() {
  const hours = Number(await getSetting('rideStuckHours'));
  if (!(hours > 0)) return 0;
  const cutoff = Date.now() - hours * HOUR;
  const list = await db.filter('contracts', c => c.ride && c.status === 'active' && c.ride.startedAt && !c.ride.endedAt && !c.ride.stuckAlertedAt && new Date(c.ride.startedAt).getTime() < cutoff);
  let n = 0;
  for (const c of list) {
    try {
      await db.update('contracts', c.id, { ride: { ...c.ride, stuckAlertedAt: new Date().toISOString() } });
      await notifyAdmins(`Ride #${c.bookingNumber} started over ${hours} hours ago and has not been ended. Please check on the rider and driver.`);
      await notify(c.customerId, '⚠️', `Ride #${c.bookingNumber} is still open after ${hours} hours. If you have arrived, confirm it in the app. If something is wrong, use the safety button or "Report a Problem".`, 'bookingUpdates', { section: 'rides' });
      await notify(c.providerId, '⚠️', `Ride #${c.bookingNumber} is still open after ${hours} hours. If the trip is over, tap "End trip".`, 'bookingUpdates', { section: 'rides' });
      n++;
    } catch (e) { console.error('[ride-sweep] stuck flag failed for', c.id, e.message); }
  }
  return n;
}

// 4. Location data does not live forever.
async function cleanLocations() {
  const keep = Number(await getSetting('rideTrackKeepDays'));
  let n = 0;
  if (keep > 0) {
    const cutoff = Date.now() - keep * DAY;
    const list = await db.filter('contracts', c => c.ride && !['pending_provider_confirmation', 'active'].includes(c.status)
      && (c.ride.track || c.ride.live || c.ride.startLocation)
      && new Date(c.completedAt || c.ride.endedAt || c.updatedAt || c.createdAt).getTime() < cutoff);
    for (const c of list) { await db.update('contracts', c.id, { ride: { ...c.ride, track: null, live: null, startLocation: null } }); n++; }
  }
  // A driver's last-known position is not kept once they have been offline a day.
  const drivers = await db.filter('users', u => u.rideDriver && u.rideDriver.lastLocation && !(u.rideDriver.online && u.rideDriver.onlineUntil && new Date(u.rideDriver.onlineUntil).getTime() > Date.now())
    && new Date(u.rideDriver.lastLocation.at || 0).getTime() < Date.now() - DAY);
  for (const u of drivers) {
    const busy = await db.find('contracts', c => c.providerId === u.id && c.ride && ['pending_provider_confirmation', 'active'].includes(c.status));
    if (!busy) { await db.update('users', u.id, { rideDriver: { ...u.rideDriver, lastLocation: null } }); n++; }
  }
  return n;
}

// 5. Expired papers.
async function checkDriverPapers() {
  const t = today();
  const soon = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);
  const drivers = await db.filter('users', u => u.rideDriver && u.rideDriver.status === 'approved');
  let n = 0;
  for (const u of drivers) {
    const r = u.rideDriver;
    const items = [['licence', r.licenceExpiry], ['insurance or road permit', r.insuranceExpiry], ['roadworthiness certificate', r.roadworthyExpiry]].filter(([, d]) => d);
    const warned = { ...(r.expiryWarned || {}) };
    let changed = false, patch = {};
    for (const [label, d] of items) {
      if (d < t) {
        if (r.online) { patch.online = false; patch.onlineUntil = null; }
        if (warned[label] !== 'expired:' + d) { warned[label] = 'expired:' + d; changed = true; await notify(u.id, '⛔', `Your ${label} has expired, so you are offline for rides. Update it in Rides and send it for a new check.`, 'bookingUpdates', { section: 'rides' }); n++; }
      } else if (d <= soon && warned[label] !== 'soon:' + d) {
        warned[label] = 'soon:' + d; changed = true;
        await notify(u.id, '⏰', `Your ${label} expires on ${d}. Update it in Rides before then to keep driving.`, 'bookingUpdates', { section: 'rides' }); n++;
      }
    }
    if (changed || Object.keys(patch).length) await db.update('users', u.id, { rideDriver: { ...r, ...patch, expiryWarned: warned } });
  }
  return n;
}

async function runRideSweeps() {
  const out = {};
  for (const [name, fn] of [['released', releaseUnconfirmed], ['cancelled', cancelNeverStarted], ['stuck', flagStuckTrips], ['cleaned', cleanLocations], ['papers', checkDriverPapers]]) {
    try { out[name] = await fn(); } catch (e) { console.error('[ride-sweep]', name, 'failed:', e.message); out[name] = -1; }
  }
  return out;
}
module.exports = { runRideSweeps, releaseUnconfirmed, cancelNeverStarted, flagStuckTrips, cleanLocations, checkDriverPapers };
