// v141: how a pro charges. In Liberia and much of Africa most work is priced
// per job, from what the customer describes, not by the hour. Pros now
// choose, the way Thumbtack, Bark, Lynk (Kenya) and SweepSouth (South
// Africa) do it:
//
//   unit 'job'  Priced per job. The customer describes the job and the pro
//               sends a price (or the customer offers one). An optional
//               "from" price gives a rough idea ("From $20").
//   unit 'hour' A rate per hour; the customer says how many hours.
//   unit 'day'  A rate per day (masons, labourers, a car with a driver...).
//   unit 'trip' A price per trip (pick-and-drop, moving a load).
//
//   list        Up to 20 fixed prices the customer can book straight away
//               ("Fix a leaking tap $15", "Install a ceiling fan $25").
//   offers      Customers may offer their own price.
//   minUnits    The fewest hours / days / trips a booking can be.
//
// Older accounts keep working: pricingModel 'hourly' reads as per hour,
// 'negotiable' as per job, 'both' as per hour with offers allowed.
const { nanoid } = require('nanoid');

const UNITS = {
  job: { label: 'per job', short: 'per job', noun: 'job', max: 1 },
  hour: { label: 'per hour', short: '/hr', noun: 'hour', max: 24 },
  day: { label: 'per day', short: '/day', noun: 'day', max: 30 },
  trip: { label: 'per trip', short: '/trip', noun: 'trip', max: 20 },
};
const MAX_LIST = 20;
const money = (n) => Math.round(Number(n) * 100) / 100;

function pricingOf(u) {
  if (!u) return { unit: 'job', rate: null, from: null, minUnits: 1, list: [], offers: true };
  const p = u.pricing;
  if (p && UNITS[p.unit]) {
    return {
      unit: p.unit,
      rate: p.unit === 'job' ? null : (Number(p.rate) > 0 ? money(p.rate) : null),
      from: Number(p.from) > 0 ? money(p.from) : null,
      minUnits: Number.isInteger(p.minUnits) && p.minUnits >= 1 ? p.minUnits : 1,
      list: Array.isArray(p.list) ? p.list.filter(x => x && x.id && x.name && Number(x.price) > 0).slice(0, MAX_LIST) : [],
      offers: p.unit === 'job' ? true : p.offers === true,
    };
  }
  // older accounts
  const price = Number(u.price) > 0 ? money(u.price) : null;
  if (u.pricingModel === 'negotiable') return { unit: 'job', rate: null, from: null, minUnits: 1, list: [], offers: true };
  return { unit: 'hour', rate: price, from: null, minUnits: 1, list: [], offers: u.pricingModel === 'both' };
}

// What the price looks like on a pro's card: { amount, prefix, unit, text }
function priceLabel(u) {
  const p = pricingOf(u);
  const listMin = p.list.length ? Math.min(...p.list.map(x => Number(x.price))) : null;
  if (p.unit === 'job') {
    const from = [p.from, listMin].filter(x => x != null).reduce((a, b) => (a == null ? b : Math.min(a, b)), null);
    return from != null ? { prefix: 'From', amount: from, unit: 'per job', text: `From $${from} per job` } : { prefix: '', amount: null, unit: 'Price per job', text: 'Price per job' };
  }
  if (p.rate != null) return { prefix: '', amount: p.rate, unit: UNITS[p.unit].short, text: `$${p.rate}${UNITS[p.unit].short}` };
  return listMin != null ? { prefix: 'From', amount: listMin, unit: '', text: `From $${listMin}` } : { prefix: '', amount: null, unit: 'Price per job', text: 'Price per job' };
}

// Cleans what a pro saves in Settings → Pricing. Returns { pricing } or { error }.
function cleanPricing(input, current) {
  const b = input || {};
  if (!UNITS[b.unit]) return { error: 'Choose how you charge: per job, per hour, per day or per trip' };
  const out = { unit: b.unit, minUnits: 1, offers: b.unit === 'job' ? true : b.offers === true, list: [], rate: null, from: null };
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  if (b.unit !== 'job') {
    const rate = num(b.rate);
    if (!(rate > 0 && rate <= 100000)) return { error: `Enter your price ${UNITS[b.unit].label}` };
    out.rate = money(rate);
    const mu = num(b.minUnits);
    if (mu !== null) {
      if (!Number.isInteger(mu) || mu < 1 || mu > UNITS[b.unit].max) return { error: `The minimum must be 1 to ${UNITS[b.unit].max} ${UNITS[b.unit].noun}s` };
      out.minUnits = mu;
    }
  } else {
    const from = num(b.from);
    if (from !== null) {
      if (!(from > 0 && from <= 100000)) return { error: 'The "from" price must be more than $0' };
      out.from = money(from);
    }
  }
  if (b.list !== undefined) {
    if (!Array.isArray(b.list)) return { error: 'The price list must be a list' };
    if (b.list.length > MAX_LIST) return { error: `Up to ${MAX_LIST} fixed prices` };
    const keep = new Map(((current && current.pricing && current.pricing.list) || []).map(x => [x.id, x]));
    for (const it of b.list) {
      const name = String((it && it.name) || '').trim();
      const price = num(it && it.price);
      if (name.length < 3 || name.length > 80) return { error: 'Each fixed price needs a name of 3 to 80 characters' };
      if (!(price > 0 && price <= 100000)) return { error: `Enter a price for "${name}"` };
      const note = String((it && it.note) || '').trim().slice(0, 140);
      const id = it && typeof it.id === 'string' && keep.has(it.id) ? it.id : `pi_${nanoid(8)}`;
      out.list.push({ id, name, price: money(price), note });
    }
  } else if (current && current.pricing && Array.isArray(current.pricing.list)) out.list = current.pricing.list;
  return { pricing: out };
}

// The old fields other screens still read, kept in step.
function legacyFields(p, current) {
  const lab = priceLabel({ pricing: p });
  return {
    price: lab.amount != null ? lab.amount : (Number(current && current.price) > 0 ? current.price : 0),
    pricingModel: p.unit === 'job' ? 'negotiable' : (p.offers ? 'both' : 'hourly'),
  };
}

// What a booking costs, worked out on the server from the pro's own prices.
// The customer chooses one of:
//   { priceItemId }           a fixed price from the pro's list
//   { units }                 hours / days / trips at the pro's rate
//   { isOffer, amount }       their own offer (the pro accepts or answers)
// Returns { amount, isOffer, detail } or { error }.
function bookingAmount(provider, body) {
  const p = pricingOf(provider);
  const b = body || {};
  if (b.priceItemId) {
    const it = p.list.find(x => x.id === b.priceItemId);
    if (!it) return { error: 'That price is no longer on this pro\'s list. Choose again.' };
    return { amount: it.price, isOffer: false, detail: { kind: 'item', itemId: it.id, name: it.name, price: it.price } };
  }
  const offerWanted = b.isOffer === true || (p.unit === 'job' && b.units === undefined);
  if (offerWanted) {
    if (!p.offers) return { error: 'This pro doesn\'t take offers. Choose one of their prices.' };
    const a = Number(b.amount);
    if (!(a > 0 && a <= 100000)) return { error: 'Enter your offer amount for this provider' };
    return { amount: money(a), isOffer: true, detail: { kind: 'offer' } };
  }
  if (p.unit === 'job') return { error: 'This pro prices each job. Ask for a price, or make an offer.' };
  if (p.rate == null) return { error: 'This pro hasn\'t set a rate yet. Ask for a price instead.' };
  let units = b.units === undefined ? (p.unit === 'hour' ? Math.max(2, p.minUnits) : p.minUnits) : Number(b.units); // older pages sent no hours: 2, as they always assumed
  if (!Number.isFinite(units)) return { error: `Say how many ${UNITS[p.unit].noun}s` };
  units = p.unit === 'hour' ? Math.round(units * 2) / 2 : Math.round(units);
  if (units < p.minUnits || units > UNITS[p.unit].max || units <= 0) return { error: `Choose ${p.minUnits} to ${UNITS[p.unit].max} ${UNITS[p.unit].noun}s` };
  return { amount: money(p.rate * units), isOffer: false, detail: { kind: 'units', unit: p.unit, units, rate: p.rate } };
}

module.exports = { UNITS, MAX_LIST, pricingOf, priceLabel, cleanPricing, legacyFields, bookingAmount };
