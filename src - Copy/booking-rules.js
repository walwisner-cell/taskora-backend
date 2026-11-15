// v156: the rules every booking follows, in one place.
//
// I wrote these after going through bookings from start to finish. Before,
// each route checked things its own way, and some checks were missing:
//   - a booking could be made for a day that had already passed, or for a
//     "date" like "next week";
//   - a suspended, closed or paused pro could still be booked, and still
//     showed in search;
//   - the time was stored as the page sent it ("9:00 AM", "14:30" or
//     "Morning"), so the arrival reminders misread "9:00 AM" and "10:00 PM";
//   - a tip or extra work on a booking paid by card, code or wallet was added
//     to the pro's payout although nothing ever collected it from the customer.

const DAY = 24 * 3600 * 1000;

// "14:30", "9:00 AM", "9am", "12:15 pm", "Morning (8-12pm)" -> "HH:MM" (24 hour), or null.
function timeHM(t) {
  const s = String(t == null ? '' : t).trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (m) {
    let h = Number(m[1]); const min = Number(m[2] || 0); const ap = m[3] ? m[3][0] : null;
    if (min > 59) return null;
    if (ap) { if (h < 1 || h > 12) return null; if (ap === 'p' && h !== 12) h += 12; if (ap === 'a' && h === 12) h = 0; }
    else if (!m[2] || h > 23) return null; // a bare "9" isn't a time
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  // a part of the day: the start of it
  if (/morning/.test(s)) return '08:00';
  if (/afternoon|midday|noon/.test(s)) return '12:00';
  if (/evening/.test(s)) return '17:00';
  if (/night/.test(s)) return '19:00';
  return null;
}

// "14:30" -> "2:30 PM" for people to read.
// v159 review: only a clock time ("14:30", "9:00 AM") -> "HH:MM"; a part of the
// day ("Morning") stays as words, so it is never saved or used as an exact time.
function clockHM(t) {
  const s = String(t == null ? '' : t).trim().toLowerCase();
  return /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.test(s) ? timeHM(s) : null;
}

function time12(hm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hm || ''));
  if (!m) return String(hm || '');
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

function isRealDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return false;
  const t = Date.parse(d + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
}

// A booking's date: a real date, from today (a day of slack for time zones
// west of the server) up to a year ahead.
function bookingDateError(d) {
  if (!isRealDate(d)) return 'Pick the date for the job from the calendar.';
  const t = Date.parse(d + 'T00:00:00Z');
  const today = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  if (t < today - DAY) return 'That date has already passed. Pick today or a later day.';
  if (t > today + 366 * DAY) return 'Pick a date within the next 12 months.';
  return null;
}

// The moment a job starts, read in the given time zone (UTC when unknown).
function jobStart(date, time, tz) {
  if (!isRealDate(date)) return null;
  const hm = timeHM(time) || '08:00';
  const guess = Date.parse(`${date}T${hm}:00Z`);
  if (!tz) return new Date(guess);
  try {
    // the zone's offset at that moment
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
    const g = (k) => Number((parts.find(p => p.type === k) || {}).value);
    const asIfUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
    return new Date(guess - (asIfUtc - guess));
  } catch (e) { return new Date(guess); }
}

// Why a pro can't be booked right now, or null when they can.
function whyNotBookable(p) {
  if (!p || p.role !== 'provider') return 'This pro was not found.';
  const first = String(p.name || 'This pro').split(' ')[0];
  if (p.active === false || p.closedAt) return `${first}'s account isn't open at the moment, so they can't be booked. Choose another pro.`;
  if (p.onHold) return `${first}'s account is paused for a short review, so they can't be booked just now. Choose another pro, or check back shortly.`;
  if (!p.verified) return `${first} hasn't finished Trothen's ID check yet, so they can't be booked. Choose another pro.`;
  if (p.acceptingBookings === false) return `${p.name} isn't currently accepting new bookings. Try another provider, or check back later.`;
  return null;
}

// True when the customer's money was really paid (card, payment code, mobile
// money wallet, or together with a paid order). In a test-mode country
// nothing real is paid, so tips and extra work can be added there.
function paidForReal(escrow) {
  if (!escrow) return false;
  const by = escrow.paidBy === 'order' ? escrow.parentPaidBy : escrow.paidBy;
  return ['code', 'card', 'momo'].includes(by);
}

// The date and time a posted job carries onto its booking.
function jobWhen(job) {
  if (job && job.when === 'date' && isRealDate(job.preferredDate)) return { date: job.preferredDate, time: clockHM(job.preferredTime) || job.preferredTime || null };
  if (job && isRealDate(job.preferredDate) && !job.when) return { date: job.preferredDate, time: clockHM(job.preferredTime) || job.preferredTime || null };
  return { date: null, time: null };
}

function jobStartOf(job) { const w = jobWhen(job); return w.date ? jobStart(w.date, w.time, null) : null; }

// v158: a booking that counts in GMV (gross bookings): one that went ahead
// (paid or confirmed, in progress, done, or under dispute), not one that was
// declined, expired, cancelled or never paid. Paid extra work is already in
// its booking's amount, so its own record isn't counted again.
const GMV_STATUSES = ['pending_provider_confirmation', 'active', 'completed', 'disputed', 'topup_paid', 'topup_released'];
function countsForGmv(c) { return !!c && GMV_STATUSES.includes(c.status) && c.topUpKind !== 'extra'; }

// v158: a moment written for one person, in their own time zone with its
// short name ("Nov 10, 2:00 PM EST"). Notices used to print the server's
// clock (UTC) with no zone, which was 5 hours off for a customer in New York.
const COUNTRY_ZONE = { Liberia: 'Africa/Monrovia', Ghana: 'Africa/Accra', Nigeria: 'Africa/Lagos', 'Sierra Leone': 'Africa/Freetown', Guinea: 'Africa/Conakry', "Côte d'Ivoire": 'Africa/Abidjan', 'Ivory Coast': 'Africa/Abidjan', Kenya: 'Africa/Nairobi', Uganda: 'Africa/Kampala', Rwanda: 'Africa/Kigali', Tanzania: 'Africa/Dar_es_Salaam', 'South Africa': 'Africa/Johannesburg', Cameroon: 'Africa/Douala', Senegal: 'Africa/Dakar', Gambia: 'Africa/Banjul', Zambia: 'Africa/Lusaka', 'United Kingdom': 'Europe/London' };
function zoneOf(user) {
  const ok = (tz) => { if (typeof tz !== 'string' || !tz) return null; try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch (e) { return null; } };
  return ok(user && user.timeZone) || COUNTRY_ZONE[(user && user.country) || ''] || 'UTC';
}
function whenFor(iso, user, opts) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const o = opts || { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  try { return d.toLocaleString('en-US', { ...o, timeZone: zoneOf(user), timeZoneName: o.hour ? 'short' : undefined }); } catch (e) { return d.toUTCString(); }
}

module.exports = { clockHM, zoneOf, whenFor, COUNTRY_ZONE, countsForGmv, jobStartOf, jobWhen, timeHM, time12, isRealDate, bookingDateError, jobStart, whyNotBookable, paidForReal };
