// v129: AGREEING AN ARRIVAL TIME, AND REMINDERS WHEN IT'S TIME.
//
// The customer and the pro agree when the pro will arrive. Either one
// proposes a time; the other accepts it or proposes another. Once a time is
// agreed, Trothen reminds both of them:
//   - 1 hour before:      both get a reminder;
//   - time to leave:      the pro is told to leave now (30 minutes before,
//                         or earlier if the job pin is far from where the pro
//                         last was), and the customer that the pro should be
//                         setting off;
//   - at the agreed time: if the pro hasn't tapped "Leave Now", both are told;
//   - 30 minutes late:    the customer is told and offered their options.
// Reminders go through notify(), so they also arrive as phone notifications
// for anyone who switched those on. Each reminder is sent once.
//
// Times are stored as one exact moment (UTC). Each person sees them in their
// own time zone: the page sends its time zone with every proposal, and it is
// saved on the person's account so reminders read correctly for them.
const db = require('./db');
const { notify } = require('./notify');

const OPEN = ['pending_agreement', 'pending_provider_confirmation', 'awaiting_payment', 'active'];
const MIN_AHEAD_MS = 5 * 60 * 1000;
const MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_LEAD_MIN = 30;

function validTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch (e) { return null; }
}
// "JAMES DOE" and "james doe" read as "James Doe". Names already in mixed case are left alone.
function personName(u, fallback) {
  const n = String((u && u.name) || fallback || '').trim();
  if (!n) return fallback || '';
  if (n !== n.toUpperCase() && n !== n.toLowerCase()) return n;
  return n.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}
// "Tue, Nov 4, 3:00 PM EST" in that person's time zone.
function formatWhen(iso, tz) {
  const d = new Date(iso);
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  try { return d.toLocaleString('en-US', { ...opts, timeZone: validTimeZone(tz) || 'UTC' }); } catch (e) { return d.toUTCString(); }
}
function clock(iso, tz) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: validTimeZone(tz) || 'UTC' }); } catch (e) { return new Date(iso).toUTCString(); }
}

function roleIn(contract, userId) {
  return contract.customerId === userId ? 'customer' : contract.providerId === userId ? 'provider' : null;
}
function canSchedule(contract) {
  return OPEN.includes(contract.status) && !contract.onMyWayAt && !contract.arrivedAt && !contract.ride && !contract.delivery;
}

async function rememberTimeZone(userId, tz) {
  const ok = validTimeZone(tz);
  if (!ok) return null;
  const u = await db.find('users', x => x.id === userId);
  if (u && u.timeZone !== ok) await db.update('users', userId, { timeZone: ok });
  return ok;
}

function checkTime(at) {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return { error: 'Choose a date and time.' };
  if (t < Date.now() + MIN_AHEAD_MS) return { error: 'Choose a time at least 5 minutes from now.' };
  if (t > Date.now() + MAX_AHEAD_MS) return { error: 'Choose a time within the next 90 days.' };
  return { iso: new Date(t).toISOString() };
}

// Either side proposes a time (or a new one).
async function propose(contract, userId, at, tz, note) {
  const role = roleIn(contract, userId);
  if (!role) return { status: 404, error: 'Booking not found' };
  if (!canSchedule(contract)) return { status: 400, error: contract.onMyWayAt ? 'The pro is already on the way, so the arrival time can no longer be changed.' : 'The arrival time can only be set while the booking is open.' };
  const t = checkTime(at);
  if (t.error) return { status: 400, error: t.error };
  await rememberTimeZone(userId, tz);
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 200) : null;
  const prev = contract.arrival || {};
  const arrival = {
    agreed: prev.agreed || null,
    proposal: { at: t.iso, byRole: role, byId: userId, note: cleanNote, proposedAt: new Date().toISOString() },
    sent: prev.sent || {},
    history: [...(prev.history || []).slice(-19), { action: 'proposed', at: t.iso, byRole: role, when: new Date().toISOString() }],
  };
  const updated = await db.update('contracts', contract.id, { arrival });
  const me = await db.find('users', u => u.id === userId);
  const otherId = role === 'customer' ? contract.providerId : contract.customerId;
  const other = await db.find('users', u => u.id === otherId);
  const tzOther = (other && other.timeZone) || validTimeZone(tz);
  await notify(otherId, '🕒', `${personName(me, role === 'customer' ? 'The customer' : 'The pro')} proposed an arrival time for "${contract.service}": ${formatWhen(t.iso, tzOther)}. Please accept it or propose another time.${cleanNote ? ` Note: "${cleanNote}"` : ''}`, 'bookingUpdates', { section: role === 'customer' ? 'contracts' : 'bookings' });
  return { status: 200, contract: updated };
}

// The other side accepts the proposed time.
async function accept(contract, userId, tz) {
  const role = roleIn(contract, userId);
  if (!role) return { status: 404, error: 'Booking not found' };
  const p = contract.arrival && contract.arrival.proposal;
  if (!p) return { status: 400, error: 'There is no proposed time to accept.' };
  if (p.byId === userId) return { status: 400, error: 'Waiting for the other person to accept your proposed time.' };
  if (!canSchedule(contract)) return { status: 400, error: 'The arrival time can no longer be changed for this booking.' };
  if (Date.parse(p.at) < Date.now()) return { status: 400, error: 'That time has already passed. Please propose a new time.' };
  await rememberTimeZone(userId, tz);
  const arrival = {
    agreed: { at: p.at, agreedAt: new Date().toISOString(), proposedBy: p.byRole },
    proposal: null,
    sent: {}, // a new time gets its own reminders
    history: [...(contract.arrival.history || []).slice(-19), { action: 'agreed', at: p.at, byRole: role, when: new Date().toISOString() }],
  };
  // v156: the booking's own date and time follow the agreed time (in the
  // customer's time zone), so every list, the PDF and "the booking day" agree.
  const patch = { arrival };
  try {
    const cust = await db.find('users', u => u.id === contract.customerId);
    const zone = (cust && cust.timeZone) || validTimeZone(tz) || 'UTC';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(p.at));
    const get = (k) => (parts.find(x => x.type === k) || {}).value;
    patch.date = `${get('year')}-${get('month')}-${get('day')}`;
    patch.time = `${get('hour')}:${get('minute')}`;
  } catch (e) { /* the arrival time is what counts */ }
  const updated = await db.update('contracts', contract.id, patch);
  const me = await db.find('users', u => u.id === userId);
  const proposer = await db.find('users', u => u.id === p.byId);
  await notify(p.byId, '✅', `${personName(me, role === 'customer' ? 'The customer' : 'The pro')} accepted the arrival time for "${contract.service}": ${formatWhen(p.at, (proposer && proposer.timeZone) || tz)}.`, 'bookingUpdates', { section: role === 'customer' ? 'contracts' : 'bookings' });
  return { status: 200, contract: updated };
}

// A direct booking already carries the date and time the customer chose and
// the pro confirmed. The customer's page turns that into an exact moment in
// the customer's own time zone, so the reminders can run. Only the customer
// can do this, only once, and only when no time has been agreed yet.
async function adoptBookedTime(contract, userId, at, tz) {
  if (contract.customerId !== userId) return { status: 404, error: 'Booking not found' };
  if (!contract.date || !contract.time) return { status: 400, error: 'This booking has no booked date and time.' };
  if (contract.arrival && (contract.arrival.agreed || contract.arrival.proposal)) return { status: 200, contract, unchanged: true };
  if (!canSchedule(contract)) return { status: 400, error: 'The arrival time can no longer be changed for this booking.' };
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return { status: 400, error: 'Invalid time' };
  const zone = await rememberTimeZone(userId, tz);
  // It must be the booked date and time, read in the customer's time zone.
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t));
    const get = (k) => (parts.find(x => x.type === k) || {}).value;
    const dateOk = `${get('year')}-${get('month')}-${get('day')}` === String(contract.date).slice(0, 10);
    const timeOk = `${get('hour')}:${get('minute')}` === (require('./booking-rules').timeHM(contract.time) || String(contract.time).slice(0, 5)); // v156: "9:00 AM" and "10:00 PM" read correctly
    if (!dateOk || !timeOk) return { status: 400, error: 'That is not the booked date and time.' };
  } catch (e) { return { status: 400, error: 'Invalid time zone' }; }
  if (t < Date.now()) return { status: 400, error: 'The booked time has passed.' };
  const arrival = { agreed: { at: new Date(t).toISOString(), agreedAt: new Date().toISOString(), proposedBy: 'booking' }, proposal: null, sent: {}, history: [{ action: 'booked', at: new Date(t).toISOString(), byRole: 'customer', when: new Date().toISOString() }] };
  const updated = await db.update('contracts', contract.id, { arrival });
  return { status: 200, contract: updated };
}

// How long before the agreed time the pro should leave. 30 minutes, or more
// when the pro's last known position is far from the job pin (straight line
// times 1.4 for roads, at 25 km/h, plus 10 minutes), up to 2 hours.
function leadMinutes(contract, pro) {
  try {
    const { distanceInMiles, isValidCoordinate } = require('./geo-distance');
    const from = pro && pro.lastKnownLocation;
    const to = contract.jobLocation;
    if (from && to && isValidCoordinate(from.latitude, from.longitude) && isValidCoordinate(to.latitude, to.longitude)
      && Date.now() - new Date(from.at).getTime() < 12 * 3600 * 1000) {
      const km = distanceInMiles(from.latitude, from.longitude, to.latitude, to.longitude) * 1.609344;
      return Math.max(DEFAULT_LEAD_MIN, Math.min(120, Math.round(km * 1.4 / 25 * 60 + 10)));
    }
  } catch (e) { /* fall back to the default */ }
  return DEFAULT_LEAD_MIN;
}

// v158: a confirmed booking with a booked clock time gets its arrival time
// set on the server, so the reminders run even if nobody opens the booking.
// Before, this only happened when the customer's page opened the booking,
// so a customer who booked and then didn't come back got no reminders, and
// neither did the pro. The time is read in the customer's time zone (saved
// when they booked or used the app), else the pro's, else the country's own
// single time zone; with none of these it waits for the page, as before.
const COUNTRY_ZONE = require('./booking-rules').COUNTRY_ZONE;
async function adoptOnServer(nowMs = Date.now()) {
  const rules = require('./booking-rules');
  const list = await db.filter('contracts', c => c.status === 'active' && !c.ride && !c.delivery && !c.storeOrder && !c.topUpFor && !c.onMyWayAt && !c.arrivedAt
    && !(c.arrival && (c.arrival.agreed || c.arrival.proposal)) && rules.isRealDate(c.date) && /^\s*\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.test(String(c.time || '')) && rules.timeHM(c.time));
  let n = 0;
  for (const c of list) {
    try {
      const cust = await db.find('users', u => u.id === c.customerId), pro = await db.find('users', u => u.id === c.providerId);
      const zone = validTimeZone(cust && cust.timeZone) || validTimeZone(pro && pro.timeZone) || COUNTRY_ZONE[(cust && cust.country) || ''] || null;
      if (!zone) continue;
      const at = rules.jobStart(c.date, c.time, zone);
      if (!at || at.getTime() <= nowMs) continue;
      const arrival = { agreed: { at: at.toISOString(), agreedAt: new Date(nowMs).toISOString(), proposedBy: 'booking' }, proposal: null, sent: {}, history: [{ action: 'booked', at: at.toISOString(), byRole: 'system', zone, when: new Date(nowMs).toISOString() }] };
      await db.update('contracts', c.id, { arrival });
      n++;
    } catch (e) { console.error('[arrival] adopt:', c.id, e.message); }
  }
  return n;
}

// Runs every minute. Sends each reminder once.
async function sweepArrivalReminders(nowMs = Date.now()) {
  let sent = 0;
  try { await adoptOnServer(nowMs); } catch (e) { console.error('[arrival] adopt sweep:', e.message); } // v158
  const list = await db.filter('contracts', c => c.status === 'active' && c.arrival && c.arrival.agreed && !c.onMyWayAt && !c.arrivedAt);
  for (const c of list) {
    const at = Date.parse(c.arrival.agreed.at);
    if (!Number.isFinite(at)) continue;
    const s = { ...(c.arrival.sent || {}) };
    const pro = await db.find('users', u => u.id === c.providerId);
    const cust = await db.find('users', u => u.id === c.customerId);
    const proName = personName(pro, 'Your pro'), custName = personName(cust, 'the customer');
    const lead = leadMinutes(c, pro);
    const minsTo = (at - nowMs) / 60000;
    const tell = async (key, fn) => { if (s[key]) return; s[key] = new Date(nowMs).toISOString(); await fn(); sent++; };
    try {
      // v158: a reminder the day before (common practice), unless the time was only agreed in the last few hours
      if (minsTo <= 24 * 60 && minsTo > 120 && nowMs - Date.parse(c.arrival.agreed.agreedAt || 0) > 6 * 3600e3) {
        await tell('day', async () => {
          await notify(c.providerId, '📅', `Coming up: "${c.service}" at ${custName}'s, ${formatWhen(c.arrival.agreed.at, pro && pro.timeZone)}. If anything has changed, agree a new time in My Contracts.`, 'bookingUpdates', { section: 'contracts' });
          await notify(c.customerId, '📅', `Coming up: ${proName} is coming for "${c.service}", ${formatWhen(c.arrival.agreed.at, cust && cust.timeZone)}. If anything has changed, agree a new time in My Bookings.`, 'bookingUpdates', { section: 'bookings' });
        });
      }
      if (minsTo <= 120) s.day = s.day || new Date(nowMs).toISOString(); // too close for a "tomorrow" message
      if (minsTo <= 60 && minsTo > lead && minsTo > 0) {
        await tell('hour', async () => {
          await notify(c.providerId, '🕒', `Reminder: you are due at ${custName}'s for "${c.service}" at ${clock(c.arrival.agreed.at, pro && pro.timeZone)}.`, 'bookingUpdates', { section: 'contracts' });
          await notify(c.customerId, '🕒', `Reminder: ${proName} is due for "${c.service}" at ${clock(c.arrival.agreed.at, cust && cust.timeZone)}.`, 'bookingUpdates', { section: 'bookings' });
        });
      }
      if (minsTo <= lead && minsTo > 0) {
        s.hour = s.hour || new Date(nowMs).toISOString(); // no separate 1-hour reminder once it's already time to leave
        await tell('leave', async () => {
          await notify(c.providerId, '🚗', `Time to leave for "${c.service}" at ${custName}'s (due ${clock(c.arrival.agreed.at, pro && pro.timeZone)}). Open Trothen and tap "Leave Now" so the customer can follow your arrival.`, 'bookingUpdates', { section: 'contracts' });
          await notify(c.customerId, '🚗', `${proName} should be leaving now to arrive at ${clock(c.arrival.agreed.at, cust && cust.timeZone)}. You will be able to follow their arrival once they set off.`, 'bookingUpdates', { section: 'bookings' });
        });
      }
      if (minsTo <= 0 && minsTo > -30) {
        s.hour = s.hour || new Date(nowMs).toISOString(); s.leave = s.leave || new Date(nowMs).toISOString();
        await tell('due', async () => {
          await notify(c.providerId, '⏰', `You are due now for "${c.service}" and have not set off. Tap "Leave Now" when you leave, or message ${custName} if you are running late.`, 'bookingUpdates', { section: 'contracts' });
          await notify(c.customerId, '⏰', `${proName} was due at ${clock(c.arrival.agreed.at, cust && cust.timeZone)} and has not set off yet. You can message them from Messages.`, 'bookingUpdates', { section: 'bookings' });
        });
      }
      if (minsTo <= -30 && minsTo > -24 * 60) {
        s.hour = s.hour || new Date(nowMs).toISOString(); s.leave = s.leave || new Date(nowMs).toISOString(); s.due = s.due || new Date(nowMs).toISOString();
        await tell('late', async () => {
          await notify(c.customerId, '⚠️', `${proName} is more than 30 minutes late for "${c.service}" and has not set off. You can message them, agree a new time, or cancel the booking from My Bookings.`, 'bookingUpdates', { section: 'bookings' });
          await notify(c.providerId, '⚠️', `You are more than 30 minutes late for "${c.service}". Please message ${custName} now and agree a new time.`, 'bookingUpdates', { section: 'contracts' });
          // Recorded for the team; lateness is part of how reliable a pro is.
          try { await db.insert('fraudFlags', { id: `ff_late_${c.id}_${Date.parse(c.arrival.agreed.at)}`, type: 'late_arrival', severity: 'low', contractId: c.id, userId: c.providerId, details: `Did not set off within 30 minutes of the agreed arrival time (${c.arrival.agreed.at}).`, status: 'open', createdAt: new Date(nowMs).toISOString() }); } catch (e) { /* already recorded */ }
        });
      }
    } catch (e) {
      console.error(`[arrival-reminders] ${c.id}:`, e.message);
    }
    if (JSON.stringify(s) !== JSON.stringify(c.arrival.sent || {})) {
      try { await db.update('contracts', c.id, { arrival: { ...c.arrival, sent: s } }); } catch (e) { /* tried again next minute; flags prevent repeats once saved */ }
    }
  }
  return sent;
}

module.exports = { adoptOnServer, propose, accept, adoptBookedTime, sweepArrivalReminders, personName, formatWhen, leadMinutes, validTimeZone, DEFAULT_LEAD_MIN };
