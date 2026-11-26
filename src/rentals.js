// v180: Rentals in the Market — short stays booked by the night (like
// Airbnb) and homes rented by the month. The routes are in
// src/routes/rentals.routes.js; the screens in public/app/rentals.js.
//
// How it works, in plain words:
//   - A host with a verified ID lists a place: photos, the area, what it
//     has, the house rules, and a price by the night, by the month, or both.
//     The exact address and pin are private: guests see them once the host
//     has accepted their booking.
//   - Every new listing is checked by the Trothen team before it is shown,
//     because fake rental listings are the most common rental scam.
//   - A guest (ID verified) chooses dates and pays through Trothen. The host
//     has 24 hours to accept; if they don't, or they say no, the guest is
//     refunded in full.
//   - The money is held by Trothen. It goes to the host 24 hours after
//     check-in for a stay (48 hours after move-in for a monthly rental),
//     unless the guest reports a problem first (the money then waits for
//     the Disputes team). A guest who checks in and finds all is well can
//     release it straight away.
//   - Cancelling follows the listing's cancellation rule, shown before the
//     guest pays (see cancelPlan below). A host who cancels always refunds
//     the guest in full.
//   - The guest pays Trothen's guest service fee on top of the price; the
//     host fee is taken from the price at booking. Both are percentages the
//     team can change (platform settings rentalGuestFeePercent and
//     rentalHostFeePercent). Nothing else is taken at payout.
//   - A host's first 3 completed bookings are paid out 3 days after they
//     complete, giving a guest time to report a fake listing (the same
//     reserve new Market sellers have).
const db = require('./db');
const store = require('./store');
const { notify } = require('./notify');
const { getSetting } = require('./platform-settings');
const rules = require('./booking-rules');

const DAY = 24 * 3600 * 1000;
const money = store.money;

const PROPERTY_TYPES = { apartment: 'Apartment', house: 'House', room: 'Room in a home', studio: 'Studio', guesthouse: 'Guesthouse', duplex: 'Duplex' };
const AMENITIES = {
  electricity: 'Electricity (LEC)', generator: 'Generator', solar: 'Solar power',
  running_water: 'Running water', water_tank: 'Water tank', hot_water: 'Hot water',
  air_conditioning: 'Air conditioning', fan: 'Fan', wifi: 'Wi-Fi', television: 'Television',
  kitchen: 'Kitchen', refrigerator: 'Refrigerator', washing_machine: 'Washing machine',
  security_guard: 'Security guard', fenced: 'Fenced compound', parking: 'Parking',
  furnished: 'Furnished', balcony: 'Balcony', workspace: 'Workspace',
};
// The cancellation rules for stays, in the words the guest sees before paying.
const CANCELLATION = {
  flexible: { label: 'Flexible', words: 'Free cancellation until 24 hours before check-in. After that, the first night is not refunded; the other nights are.' },
  moderate: { label: 'Moderate', words: 'Free cancellation until 5 days before check-in. After that, half of the price of the nights is refunded.' },
  strict: { label: 'Strict', words: 'Free cancellation until 14 days before check-in. From 14 to 7 days before, half is refunded. Less than 7 days before, nothing is refunded.' },
};
const MONTHLY_CANCEL_WORDS = 'Free cancellation until 7 days before move-in. After that, the first month is not refunded; the other months are.';
const FEE_REFUND_WORDS = 'Trothen\'s service fee is refunded when you cancel for free. The cleaning fee is always refunded if you cancel before check-in.';

const LIMITS = { photosMin: 3, photosMax: 12, liveListings: 20, maxNights: 90, maxMonths: 24, maxPayMonths: 12, maxAheadDays: 365, blockedMax: 400 };
const HOLDING = ['awaiting_payment', 'pending_provider_confirmation', 'active', 'disputed']; // a booking that keeps its dates
const ANSWER_HOURS = 24;          // the host has this long to accept a paid request
const RELEASE_STAY_HOURS = 24;    // after check-in
const RELEASE_MONTHLY_HOURS = 48; // after move-in
const NEW_HOST_BOOKINGS = 3;      // a host's first bookings wait 3 days after completing
const REPORTS_TO_HIDE = 3;

const isDate = (s) => rules.isRealDate(s);
const dayMs = (s) => Date.parse(String(s) + 'T00:00:00Z');
const addDays = (s, n) => new Date(dayMs(s) + n * DAY).toISOString().slice(0, 10);
function addMonths(s, n) { const d = new Date(dayMs(s)); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10); }
const nightsBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / DAY);
const hm = (s, dflt) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')) ? String(s) : dflt);
const zoneFor = (country) => rules.COUNTRY_ZONE[country] || null;
// Today's date where the place is.
function todayIn(country) {
  const z = zoneFor(country);
  try { if (z) return new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { /* fall through */ }
  return new Date().toISOString().slice(0, 10);
}

async function fees() {
  const g = Number(await getSetting('rentalGuestFeePercent'));
  const h = Number(await getSetting('rentalHostFeePercent'));
  return { guestPercent: Number.isFinite(g) && g >= 0 && g <= 30 ? g : 5, hostPercent: Number.isFinite(h) && h >= 0 && h <= 30 ? h : 3 };
}

// A price stored in the host's currency, in US dollars today.
async function usdOf(amount, currency, host) {
  if (!(Number(amount) > 0)) return 0;
  if (!currency || currency === 'USD') return money(amount);
  const cur = (await store.currenciesFor(host || {})).find(c => c.code === currency);
  return cur ? store.usdFromLocal(amount, cur.rate) : money(amount);
}
// The same amount in the viewer's local money, for showing beside US dollars.
async function localOf(usd, person) {
  const list = await store.currenciesFor(person || {});
  const cur = list.find(c => c.code !== 'USD');
  if (!cur || !(usd > 0)) return null;
  return { amount: Math.round(usd * cur.rate), code: cur.code, symbol: cur.symbol || '' };
}

// ── reading a listing from the form ────────────────────────────────────
function readPrice(raw, label, currencies, required) {
  if (raw === undefined || raw === null || raw === '') return required ? { error: `Enter the price ${label}` } : { value: null };
  const price = Number(raw.price !== undefined ? raw.price : raw);
  const code = raw.currency || 'USD';
  const cur = currencies.find(c => c.code === code);
  if (!cur) return { error: `The price can be in ${currencies.map(c => c.code).join(' or ')}` };
  const usd = code === 'USD' ? price : store.usdFromLocal(price, cur.rate);
  if (!Number.isFinite(price) || price <= 0 || usd < 1 || usd > 100000) return { error: `Enter a price ${label} between $1 and $100,000 (or the same in your local money)` };
  return { value: { price: money(price), currency: code } };
}
async function readListing(b, me, existing) {
  b = b || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const need = (k) => !existing || has(k);
  const out = {};
  const text = (k, min, max, msg) => { const v = String(b[k] == null ? '' : b[k]).trim(); if (v.length < min || v.length > max) return msg; out[k] = v; return null; };
  let err;
  if (need('title') && (err = text('title', 5, 80, 'Give the place a title of 5 to 80 characters, for example "2-bedroom apartment in Sinkor"'))) return { error: err };
  if (need('description') && (err = text('description', 30, 3000, 'Describe the place in 30 to 3,000 characters: the rooms, the area, and what is nearby'))) return { error: err };
  if (need('propertyType')) { if (!PROPERTY_TYPES[b.propertyType]) return { error: 'Choose what kind of place it is' }; out.propertyType = b.propertyType; }
  const int = (k, lo, hi, msg) => { const n = Number(b[k]); if (!Number.isInteger(n) || n < lo || n > hi) return msg; out[k] = n; return null; };
  if (need('bedrooms') && (err = int('bedrooms', 0, 20, 'Enter the number of bedrooms, from 0 (a studio) to 20'))) return { error: err };
  if (need('bathrooms') && (err = int('bathrooms', 0, 20, 'Enter the number of bathrooms, from 0 to 20'))) return { error: err };
  if (need('maxGuests') && (err = int('maxGuests', 1, 30, 'Enter how many people can stay, from 1 to 30'))) return { error: err };
  if (need('amenities')) {
    const list = Array.isArray(b.amenities) ? [...new Set(b.amenities)] : [];
    if (list.some(a => !AMENITIES[a])) return { error: 'Choose what the place has from the list' };
    out.amenities = list;
  }
  if (need('rules')) { const v = String(b.rules || '').trim(); if (v.length > 1000) return { error: 'Keep the house rules under 1,000 characters' }; out.rules = v; }
  if (need('community') && (err = text('community', 2, 80, 'Enter the community or area, for example "Sinkor" or "Paynesville, ELWA Junction"'))) return { error: err };
  if (need('city')) { const v = String(b.city || me.city || '').trim(); if (v.length < 2 || v.length > 60) return { error: 'Enter the city or town' }; out.city = v; }
  if (need('address') && (err = text('address', 5, 200, 'Enter the full address or clear directions. Only guests whose booking you accept see it.'))) return { error: err };
  if (has('location')) {
    const { isValidCoordinate } = require('./geo-distance');
    const p = b.location;
    out.location = p && isValidCoordinate(p.latitude, p.longitude) && !(p.latitude === 0 && p.longitude === 0) ? { latitude: Math.round(p.latitude * 1e6) / 1e6, longitude: Math.round(p.longitude * 1e6) / 1e6 } : null;
  }
  if (need('photoUrls')) {
    const list = Array.isArray(b.photoUrls) ? b.photoUrls.filter(u => typeof u === 'string' && new RegExp(`^/uploads/rental_${String(me.id).replace(/[^\w-]/g, '')}_[\\w-]+\\.(jpe?g|png|webp|gif)$`, 'i').test(u)) : [];
    if ((Array.isArray(b.photoUrls) ? b.photoUrls.length : 0) !== list.length) return { error: 'Use photos you uploaded yourself' };
    if (list.length < LIMITS.photosMin) return { error: `Add at least ${LIMITS.photosMin} photos: the outside, the main room and a bedroom` };
    if (list.length > LIMITS.photosMax) return { error: `Up to ${LIMITS.photosMax} photos` };
    out.photoUrls = list;
  }
  const currencies = await store.currenciesFor(me);
  if (need('stay')) {
    if (!b.stay) out.stay = null;
    else {
      const s = b.stay;
      const p = readPrice(s.price === undefined ? null : { price: s.price, currency: s.currency }, 'per night', currencies, true); if (p.error) return { error: p.error };
      const c = s.cleaningFee ? readPrice({ price: s.cleaningFee, currency: s.currency }, 'for cleaning', currencies, false) : { value: null }; if (c.error) return { error: c.error };
      const minN = Number(s.minNights || 1), maxN = Number(s.maxNights || 30);
      if (!Number.isInteger(minN) || minN < 1 || minN > 30) return { error: 'The shortest stay must be 1 to 30 nights' };
      if (!Number.isInteger(maxN) || maxN < minN || maxN > LIMITS.maxNights) return { error: `The longest stay must be from the shortest stay up to ${LIMITS.maxNights} nights` };
      if (!CANCELLATION[s.cancellation]) return { error: 'Choose a cancellation rule: flexible, moderate or strict' };
      out.stay = { price: p.value.price, currency: p.value.currency, cleaningFee: c.value ? c.value.price : 0, minNights: minN, maxNights: maxN, checkInFrom: hm(s.checkInFrom, '14:00'), checkOutBy: hm(s.checkOutBy, '11:00'), cancellation: s.cancellation };
    }
  }
  if (need('monthly')) {
    if (!b.monthly) out.monthly = null;
    else {
      const m = b.monthly;
      const p = readPrice({ price: m.price, currency: m.currency }, 'per month', currencies, true); if (p.error) return { error: p.error };
      const minM = Number(m.minMonths || 1), pay = Number(m.payMonths || 1);
      if (!Number.isInteger(minM) || minM < 1 || minM > LIMITS.maxMonths) return { error: `The shortest rental must be 1 to ${LIMITS.maxMonths} months` };
      if (!Number.isInteger(pay) || pay < 1 || pay > LIMITS.maxPayMonths) return { error: `The months paid at the start must be 1 to ${LIMITS.maxPayMonths}` };
      out.monthly = { price: p.value.price, currency: p.value.currency, minMonths: minM, payMonths: Math.max(pay, 1) };
    }
  }
  const stay = has('stay') || !existing ? out.stay : existing.stay;
  const monthly = has('monthly') || !existing ? out.monthly : existing.monthly;
  if (!stay && !monthly) return { error: 'Offer the place by the night, by the month, or both' };
  if (!existing || has('ownerDeclared')) {
    if (b.ownerDeclared !== true) return { error: 'Confirm that you own the place, or have the owner\'s written permission to rent it out' };
    out.ownerDeclaredAt = new Date().toISOString();
  }
  // The words the Market refuses (weapons, drugs and so on), and the signs of a scam.
  const why = await require('./routes/store.routes').bannedReason(out.title || (existing && existing.title), out.description || (existing && existing.description), out.rules || '');
  if (why) return { error: `This can't be listed on Trothen (${why}).` };
  return { out };
}

// ── dates and availability ─────────────────────────────────────────────
// The nights (or days) a booking keeps: [from, to).
function rangeOf(c) {
  const r = c && c.rental; if (!r) return null;
  return r.mode === 'monthly' ? [r.moveIn, r.endDate] : [r.checkIn, r.checkOut];
}
async function bookingsFor(listingId) {
  return db.filter('contracts', c => c.rental && c.rental.listingId === listingId && HOLDING.includes(c.status));
}
const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];
// The dates that can't be chosen in the next year: the host's blocked days and booked nights.
async function unavailableDates(listing) {
  const out = new Set(listing.blockedDates || []);
  const today = todayIn(listing.country), until = addDays(today, LIMITS.maxAheadDays);
  for (const c of await bookingsFor(listing.id)) {
    const [a, b] = rangeOf(c);
    for (let d = a < today ? today : a; d < b && d <= until; d = addDays(d, 1)) out.add(d);
  }
  return [...out].filter(d => d >= today).sort();
}
async function isFree(listing, from, to, ignoreId) {
  for (let d = from; d < to; d = addDays(d, 1)) if ((listing.blockedDates || []).includes(d)) return false;
  return !(await bookingsFor(listing.id)).some(c => c.id !== ignoreId && overlaps(rangeOf(c), [from, to]));
}

// ── a price for chosen dates ───────────────────────────────────────────
// The answer is in US dollars (the amount of record), with the guest's
// local money beside it. Errors are plain words for the guest.
async function quote(listing, q, guest) {
  const host = await db.find('users', u => u.id === listing.hostId);
  const f = await fees();
  const mode = q.mode === 'monthly' ? 'monthly' : 'stay';
  const today = todayIn(listing.country);
  const guests = Number(q.guests || 1);
  if (!Number.isInteger(guests) || guests < 1) return { error: 'Choose how many people are staying' };
  if (guests > listing.maxGuests) return { error: `This place is for up to ${listing.maxGuests} ${listing.maxGuests === 1 ? 'person' : 'people'}` };
  let lines = [], subtotal, from, to, extra = {};
  if (mode === 'stay') {
    const s = listing.stay; if (!s) return { error: 'This place is not offered by the night' };
    if (!isDate(q.checkIn) || !isDate(q.checkOut)) return { error: 'Choose the check-in and check-out dates' };
    if (q.checkIn < today) return { error: 'The check-in date has passed' };
    if (q.checkIn > addDays(today, LIMITS.maxAheadDays)) return { error: 'You can book up to a year ahead' };
    const nights = nightsBetween(q.checkIn, q.checkOut);
    if (nights < 1) return { error: 'Check-out must be after check-in' };
    if (nights < s.minNights) return { error: `The shortest stay here is ${s.minNights} ${s.minNights === 1 ? 'night' : 'nights'}` };
    if (nights > s.maxNights) return { error: `The longest stay here is ${s.maxNights} nights. For longer, ${listing.monthly ? 'rent it by the month' : 'ask the host'}.` };
    const nightly = await usdOf(s.price, s.currency, host), cleaning = await usdOf(s.cleaningFee, s.currency, host);
    lines.push({ label: `${nights} ${nights === 1 ? 'night' : 'nights'} × $${nightly.toFixed(2)}`, usd: money(nightly * nights) });
    if (cleaning > 0) lines.push({ label: 'Cleaning fee', usd: cleaning });
    subtotal = money(nightly * nights + cleaning);
    from = q.checkIn; to = q.checkOut;
    extra = { checkIn: q.checkIn, checkOut: q.checkOut, nights, nightlyUsd: nightly, cleaningUsd: cleaning, checkInFrom: s.checkInFrom, checkOutBy: s.checkOutBy, cancellation: s.cancellation };
  } else {
    const m = listing.monthly; if (!m) return { error: 'This place is not offered by the month' };
    if (!isDate(q.moveIn)) return { error: 'Choose the move-in date' };
    if (q.moveIn < today) return { error: 'The move-in date has passed' };
    if (q.moveIn > addDays(today, LIMITS.maxAheadDays)) return { error: 'You can book up to a year ahead' };
    const months = Number(q.months || m.payMonths);
    if (!Number.isInteger(months) || months < Math.max(m.payMonths, 1) || months > LIMITS.maxPayMonths) return { error: `Pay for ${m.payMonths} to ${LIMITS.maxPayMonths} months at the start` };
    const monthly = await usdOf(m.price, m.currency, host);
    lines.push({ label: `${months} ${months === 1 ? 'month' : 'months'} × $${monthly.toFixed(2)}`, usd: money(monthly * months) });
    subtotal = money(monthly * months);
    from = q.moveIn; to = addMonths(q.moveIn, months);
    extra = { moveIn: q.moveIn, endDate: to, months, monthlyUsd: monthly, minMonths: m.minMonths };
  }
  if (!(await isFree(listing, from, to, null))) return { code: 'NOT_FREE', error: 'Some of those dates are already taken. Choose other dates.' };
  const guestFee = money(subtotal * f.guestPercent / 100), hostFee = money(subtotal * f.hostPercent / 100);
  const total = money(subtotal + guestFee);
  return {
    mode, guests, lines, subtotal, guestFee, hostFee, total, hostGets: money(subtotal - hostFee), feePercent: f.guestPercent, hostFeePercent: f.hostPercent,
    local: await localOf(total, guest || host), ...extra,
    cancellationWords: mode === 'stay' ? CANCELLATION[extra.cancellation].words : MONTHLY_CANCEL_WORDS, feeRefundWords: FEE_REFUND_WORDS,
  };
}

// When the guest can be in the place (the start of check-in or move-in), and when the money goes to the host.
function startOf(c) {
  const r = c.rental;
  return r.mode === 'monthly' ? rules.jobStart(r.moveIn, '09:00', zoneFor(r.country)) : rules.jobStart(r.checkIn, r.checkInFrom || '14:00', zoneFor(r.country));
}
function releaseAt(c) { return new Date(startOf(c).getTime() + (c.rental.mode === 'monthly' ? RELEASE_MONTHLY_HOURS : RELEASE_STAY_HOURS) * 3600 * 1000); }
function checkOutAt(c) { const r = c.rental; return r.mode === 'monthly' ? rules.jobStart(r.endDate, '09:00', zoneFor(r.country)) : rules.jobStart(r.checkOut, r.checkOutBy || '11:00', zoneFor(r.country)); }

// ── cancelling ─────────────────────────────────────────────────────────
// What a cancellation gives back, worked out from the rule the guest saw
// when they paid (kept on the booking). Amounts in US dollars.
//   kind 'full'    — the whole payment, Trothen's fee too
//   kind 'partial' — part of the price; the host keeps the rest (less the host fee)
//   kind 'none'    — nothing is refunded (the host is paid, less the host fee)
//   blocked        — not possible here (after check-in: report a problem instead)
function cancelPlan(c, byRole, now = Date.now()) {
  const r = c.rental;
  const subtotal = money(r.subtotal);
  const full = { kind: 'full', refundUsd: money(subtotal + r.guestFee), hostKeepsUsd: 0 };
  if (c.status === 'awaiting_payment') return { kind: 'unpaid', refundUsd: 0, hostKeepsUsd: 0, words: 'Nothing has been paid, so the booking is simply cancelled.' };
  if (c.status === 'pending_provider_confirmation') return { ...full, words: 'The host hasn\'t accepted yet, so you get everything back.' };
  if (c.status !== 'active') return { blocked: true, words: `This booking is ${String(c.status).replace(/_/g, ' ')}.` };
  const start = startOf(c).getTime();
  if (now >= start) return { blocked: true, words: r.mode === 'monthly' ? 'The move-in date has come, so it can\'t be cancelled here. If something is wrong, report a problem and the Trothen team will decide.' : 'Check-in time has passed, so it can\'t be cancelled here. If something is wrong, report a problem and the Trothen team will decide.' };
  if (byRole === 'host') return { ...full, words: 'When the host cancels, the guest gets everything back.' };
  const hours = (start - now) / 3600e3, days = hours / 24;
  // A change of mind soon after booking, well before arrival, is free (as on Airbnb).
  const bookedAt = Date.parse(c.paidAt || c.createdAt || 0);
  if (now - bookedAt <= 48 * 3600e3 && days >= 14) return { ...full, words: 'You booked less than 48 hours ago and the stay is at least 14 days away, so you get everything back.' };
  let keptRent;
  if (r.mode === 'monthly') {
    if (days >= 7) return { ...full, words: 'You cancelled 7 or more days before move-in, so you get everything back.' };
    keptRent = Math.min(r.monthlyUsd, subtotal);
  } else {
    const nightsUsd = money(r.nightlyUsd * r.nights);
    if (r.cancellation === 'flexible') {
      if (hours >= 24) return { ...full, words: 'You cancelled 24 hours or more before check-in, so you get everything back.' };
      keptRent = Math.min(r.nightlyUsd, nightsUsd);
    } else if (r.cancellation === 'moderate') {
      if (days >= 5) return { ...full, words: 'You cancelled 5 or more days before check-in, so you get everything back.' };
      keptRent = money(nightsUsd / 2);
    } else {
      if (days >= 14) return { ...full, words: 'You cancelled 14 or more days before check-in, so you get everything back.' };
      keptRent = days >= 7 ? money(nightsUsd / 2) : nightsUsd;
    }
  }
  keptRent = money(keptRent);
  const refund = money(subtotal - keptRent);
  const words = r.mode === 'monthly' ? 'Less than 7 days before move-in, the first month is not refunded.'
    : r.cancellation === 'flexible' ? 'Less than 24 hours before check-in, the first night is not refunded.'
      : r.cancellation === 'moderate' ? 'Less than 5 days before check-in, half of the price of the nights is refunded.'
        : days >= 7 ? 'From 14 to 7 days before check-in, half of the price of the nights is refunded.' : 'Less than 7 days before check-in, the nights are not refunded.';
  return { kind: refund > 0 ? 'partial' : 'none', refundUsd: refund, hostKeepsUsd: keptRent, words: `${words}${r.cleaningUsd > 0 ? ' The cleaning fee is refunded.' : ''} Trothen's service fee is not refunded.` };
}

// Carries out a cancellation on a booking whose money is held. Returns the plan used.
async function cancelBooking(c, byRole, byUserId) {
  const plan = cancelPlan(c, byRole);
  if (plan.blocked) return plan;
  const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
  const now = new Date().toISOString();
  if (plan.kind === 'unpaid') {
    if (escrow && escrow.customerSaysPaidAt) return { blocked: true, words: 'You told us you have sent the payment, so this can\'t be cancelled here. Contact support: if the money arrived, it is refunded.' };
    if (escrow && escrow.status === 'awaiting_payment') {
      await db.update('escrowTransactions', escrow.id, { status: 'payment_cancelled' });
      if (escrow.paidBy === 'card' && escrow.cardSessionId) { try { await require('./stripe-pay').expireSession(escrow.cardSessionId); } catch (x) { /* already closed; a late payment is refunded automatically */ } }
    }
    await db.update('contracts', c.id, { status: 'cancelled', cancelledByRole: 'customer', cancelReasonCategory: 'not_paid', cancelledAt: now });
    return plan;
  }
  if (escrow && escrow.status === 'held') {
    if (plan.kind === 'full') await db.update('escrowTransactions', escrow.id, { status: 'refunded', refundReason: byRole === 'host' ? 'the host cancelled' : 'cancelled by the guest' });
    else {
      const r = c.rental, f = r.hostFeePercent != null ? r.hostFeePercent : (await fees()).hostPercent;
      const hostFeeKept = money(plan.hostKeepsUsd * f / 100);
      await db.update('escrowTransactions', escrow.id, { status: 'released', originalAmount: escrow.amount, refundedAmount: plan.refundUsd, amount: money(plan.hostKeepsUsd - hostFeeKept), serviceFee: money(r.guestFee + hostFeeKept), splitByRentalCancel: true, noCommissionAmount: money(plan.hostKeepsUsd - hostFeeKept), refundReason: 'cancelled by the guest (part refund under the cancellation rule)' });
    }
  }
  await db.update('contracts', c.id, {
    status: 'cancelled', cancelledAt: now, cancelledByRole: byRole === 'host' ? 'provider' : 'customer', cancelReasonCategory: byRole === 'host' ? 'host_cancelled' : 'guest_cancelled',
    refundedAmount: plan.kind === 'partial' || plan.kind === 'none' ? plan.refundUsd : null,
    rental: { ...c.rental, cancel: { by: byRole, userId: byUserId, at: now, kind: plan.kind, refundUsd: plan.refundUsd, hostKeepsUsd: plan.hostKeepsUsd } },
  });
  try { await require('./loyalty').givePointsBack(c); } catch (e) { /* none spent */ }
  if (byRole === 'host') {
    // The host can't let the same dates to someone else, and repeated cancelling is looked at.
    const l = await db.find('rentalListings', x => x.id === c.rental.listingId);
    if (l) {
      const [a, b] = rangeOf(c), add = [];
      for (let d = a; d < b && add.length < 400; d = addDays(d, 1)) add.push(d);
      const blocked = [...new Set([...(l.blockedDates || []), ...add])].filter(d => d >= todayIn(l.country)).sort().slice(0, LIMITS.blockedMax);
      const cancels = [...(l.hostCancels || []), now].filter(t => Date.now() - Date.parse(t) < 90 * DAY);
      await db.update('rentalListings', l.id, { blockedDates: blocked, hostCancels: cancels });
      if (cancels.length >= 3) { try { await require('./fraud-detection').createFlag({ type: 'rental_host_cancels', severity: 'medium', userId: c.providerId, details: `The host of "${l.title}" has cancelled ${cancels.length} accepted bookings in 90 days.` }); } catch (e) { /* the cancellation stands */ } }
    }
  }
  return plan;
}

// ── money arrived, host answers, check-in, completion ──────────────────
const titleOf = (c) => (c.rental && c.rental.title) || c.service;
const whenWords = (c) => (c.rental.mode === 'monthly' ? `moving in on ${c.rental.moveIn}` : `${c.rental.checkIn} to ${c.rental.checkOut}`);
async function afterPaid(c) {
  await notify(c.customerId, '✅', `We received your payment for "${titleOf(c)}" (${whenWords(c)}). Trothen holds it. The host has ${ANSWER_HOURS} hours to accept; if they don't, you get everything back.`, 'bookingUpdates', { section: 'market' });
  await notify(c.providerId, '🏠', `New booking request: "${titleOf(c)}", ${whenWords(c)}, ${c.rental.guests} ${c.rental.guests === 1 ? 'guest' : 'guests'}. The guest has paid and Trothen holds the money. Accept or decline in Market → Rentals → Hosting within ${ANSWER_HOURS} hours.`, null, { section: 'market' });
}
async function accept(c) {
  const updated = await db.update('contracts', c.id, { status: 'active', signedAt: new Date().toISOString().slice(0, 10), rental: { ...c.rental, acceptedAt: new Date().toISOString() } });
  const l = await db.find('rentalListings', x => x.id === c.rental.listingId);
  await notify(c.customerId, '🏠', `Your booking is confirmed: "${titleOf(c)}", ${whenWords(c)}. The address is ${l ? l.address : 'in your booking'}. ${c.rental.mode === 'monthly' ? '' : `Check-in from ${c.rental.checkInFrom}. `}You can message the host in Messages.`, 'bookingUpdates', { section: 'market' });
  return updated;
}
async function decline(c) {
  const escrow = await db.find('escrowTransactions', e => e.contractId === c.id);
  if (escrow && escrow.status === 'held') await db.update('escrowTransactions', escrow.id, { status: 'refunded', refundReason: 'the host declined' });
  const updated = await db.update('contracts', c.id, { status: 'declined', cancelledAt: new Date().toISOString(), cancelledByRole: 'provider' });
  await notify(c.customerId, '↩️', `The host can't take your booking for "${titleOf(c)}" (${whenWords(c)}). You get everything back. Have a look at other places in Market → Rentals.`, 'bookingUpdates', { section: 'market' });
  return updated;
}
async function complete(c, how) {
  const { completeContractCore } = require('./routes/payments.routes');
  const done = await completeContractCore(c, 0, c.customerId);
  await db.update('contracts', c.id, { rental: { ...c.rental, releasedAt: new Date().toISOString(), releasedHow: how } });
  const reserve = c.newSellerReserve ? ' Because you are a new host, it can be cashed out 3 days from now.' : '';
  await notify(c.providerId, '💸', `The money for "${titleOf(c)}" (${whenWords(c)}) is now yours.${reserve} Cash it out in Market → Sell → Earnings.`, 'payoutAlerts', { section: 'market' });
  if (how === 'auto') await notify(c.customerId, '🏠', `The payment for "${titleOf(c)}" has gone to the host, as no problem was reported in time. You can still rate your stay in Market → Rentals → My trips.`, 'bookingUpdates', { section: 'market' });
  return done;
}

// Every 10 minutes: money is released after check-in; reminders the day before; a nudge to rate the stay.
async function sweep() {
  const now = Date.now();
  for (const c of await db.filter('contracts', x => x.rental && x.status === 'active')) {
    try {
      const start = startOf(c).getTime();
      if (!c.rental.remindedAt && start - now < DAY && start > now) {
        const l = await db.find('rentalListings', x => x.id === c.rental.listingId);
        await db.update('contracts', c.id, { rental: { ...c.rental, remindedAt: new Date().toISOString() } });
        await notify(c.customerId, '🧳', `Tomorrow: "${titleOf(c)}". Address: ${l ? l.address : 'in your booking'}. ${c.rental.mode === 'monthly' ? 'Move-in day.' : `Check-in from ${c.rental.checkInFrom}.`} If the place is not as described when you arrive, report a problem from My trips before the payment goes to the host.`, 'bookingUpdates', { section: 'market' });
        await notify(c.providerId, '🧳', `Tomorrow your guest arrives at "${titleOf(c)}" (${whenWords(c)}). Have it clean and ready.`, 'bookingUpdates', { section: 'market' });
        continue;
      }
      if (releaseAt(c).getTime() <= now) {
        if (await db.find('disputes', d => d.contractId === c.id && !['resolved', 'closed', 'dismissed', 'rejected'].includes(d.status))) continue;
        await require('./contract-locks').whenFree(c.id, async () => {
          const fresh = await db.find('contracts', x => x.id === c.id);
          if (fresh && fresh.status === 'active') await complete(fresh, 'auto');
        });
      }
    } catch (e) { console.error('[rentals] sweep', c.id, e.message); }
  }
  // After check-out, one nudge to rate the stay.
  for (const c of await db.filter('contracts', x => x.rental && x.status === 'completed' && !x.rental.reviewAskedAt && !x.rental.reviewed)) {
    try {
      if (checkOutAt(c).getTime() > now && c.rental.mode !== 'monthly') continue;
      await db.update('contracts', c.id, { rental: { ...c.rental, reviewAskedAt: new Date().toISOString() } });
      await notify(c.customerId, '⭐', `How was "${titleOf(c)}"? Rate it in Market → Rentals → My trips. It helps other guests, and the host.`, 'bookingUpdates', { section: 'market' });
    } catch (e) { console.error('[rentals] review ask', c.id, e.message); }
  }
}
let timer = null;
function startScheduler() {
  if (timer) return;
  timer = setInterval(() => { sweep().catch(e => console.error('[rentals] sweep', e.message)); }, Number(process.env.RENTALS_SWEEP_MS) || Number(process.env.MARKET_SWEEP_MS) || 10 * 60 * 1000);
  timer.unref();
  setTimeout(() => sweep().catch(() => {}), 25000).unref();
}

async function hostStats(hostId) {
  const done = await db.filter('contracts', c => c.providerId === hostId && c.rental && c.status === 'completed');
  return { stays: done.length, isNew: done.length < NEW_HOST_BOOKINGS };
}
async function refreshRating(listingId) {
  const all = await db.filter('rentalReviews', r => r.listingId === listingId);
  const avg = all.length ? Math.round(all.reduce((s, r) => s + r.stars, 0) / all.length * 10) / 10 : null;
  await db.update('rentalListings', listingId, { ratingAvg: avg, ratingCount: all.length });
  return { avg, count: all.length };
}

module.exports = {
  PROPERTY_TYPES, AMENITIES, CANCELLATION, MONTHLY_CANCEL_WORDS, FEE_REFUND_WORDS, LIMITS, HOLDING, ANSWER_HOURS, RELEASE_STAY_HOURS, RELEASE_MONTHLY_HOURS, NEW_HOST_BOOKINGS, REPORTS_TO_HIDE, DAY,
  money, fees, usdOf, localOf, readListing, todayIn, addDays, addMonths, nightsBetween, isDate,
  rangeOf, bookingsFor, unavailableDates, isFree, quote, startOf, releaseAt, checkOutAt,
  cancelPlan, cancelBooking, afterPaid, accept, decline, complete, sweep, startScheduler, hostStats, refreshRating,
};
