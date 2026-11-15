// v142: Trothen proposes the ride fare, by distance and time, per country
// and vehicle. Built for Liberia first, the way fares already work there:
//
//  - Set in the country's own money (L$ in Liberia), per vehicle:
//    motorbike, keke, car, van. Each has a starting fare, a price per km,
//    a price per minute (Monrovia traffic: time matters as much as
//    distance) and a minimum fare.
//  - Linked to fuel, like the Ministry of Transport's fares: the team
//    enters the pump price. Fares only move once the price has changed by
//    more than a set threshold, and then by the share of a fare that is
//    fuel (not the whole change).
//  - No surge pricing. At most a fixed night extra the team sets.
//  - Each driver may price a little above or below the Trothen fare (the
//    "band", 20% by default), never beyond.
//  - Rounded for cash (L$5 by default), and shown with the US$ amount.
//  - A rider's offer can't be far below the fare (70% by default).
//
// A country with no fare table keeps working as before: each driver's own
// starting fare and price per km.
const { getSetting } = require('./platform-settings');
const { currencyForCountry } = require('./currency-data');

const VEHICLES = ['motorbike', 'keke', 'car', 'van'];
const money = (n) => Math.round(Number(n) * 100) / 100;
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

async function tables() {
  const t = await getSetting('rideFareTables');
  return t && typeof t === 'object' && !Array.isArray(t) ? t : {};
}
async function tableFor(country) {
  const all = await tables();
  const key = Object.keys(all).find(k => sameText(k, country));
  return key ? { country: key, ...all[key] } : null;
}

// How much the fuel price moves fares: nothing until the change passes
// the threshold, then the fuel share of the change.
function fuelFactor(t) {
  const f = (t && t.fuel) || {};
  const ref = Number(f.refPrice), cur = Number(f.currentPrice);
  if (!(ref > 0) || !(cur > 0)) return 1;
  const change = cur / ref - 1;
  if (Math.abs(change) * 100 < (Number(f.threshold) || 0)) return 1;
  return Math.max(0.5, 1 + ((Number(f.share) || 0) / 100) * change);
}
// The night extra, in the country's own time (tzOffset hours from UTC; Liberia is 0).
function nightPct(t, at) {
  const n = (t && t.night) || {};
  if (!(Number(n.pct) > 0)) return 0;
  const h = (new Date(at || Date.now()).getUTCHours() + (Number(t.tzOffset) || 0) + 24) % 24;
  const inside = n.startHour < n.endHour ? h >= n.startHour && h < n.endHour : h >= n.startHour || h < n.endHour;
  return inside ? Number(n.pct) : 0;
}
const roundTo = (v, step) => (step > 0 ? Math.round(v / step) * step : Math.round(v * 100) / 100);

// The fare Trothen proposes for this trip and vehicle, in local money.
function proposeLocal(t, vehicle, km, minutes, at) {
  const v = t && t.vehicles && t.vehicles[vehicle];
  if (!v) return null;
  const raw = Math.max(Number(v.min) || 0, (Number(v.base) || 0) + (Number(v.perKm) || 0) * km + (Number(v.perMin) || 0) * minutes);
  const withFuel = raw * fuelFactor(t);
  const withNight = withFuel * (1 + nightPct(t, at) / 100);
  return Math.max(Number(t.roundTo) || 0, roundTo(withNight, Number(t.roundTo) || 0));
}

function rateFor(code, rows) { return require('./plan-pricing').resolveRate(code, rows); }

// The fare for one driver: { fare (US$, what is charged), local, currency, proposed, proposedLocal, adjust, source, detail }.
async function fareFor(driver, trip, ctx = {}) {
  const t = ctx.table !== undefined ? ctx.table : await tableFor(driver.country);
  const vehicle = driver.rideDriver && driver.rideDriver.vehicle;
  if (t && t.vehicles && t.vehicles[vehicle]) {
    const code = t.currency || currencyForCountry(t.country).code;
    const rate = ctx.rate || (code === 'USD' ? 1 : rateFor(code, ctx.rateRows || await require('./db').all('exchangeRates')));
    const proposedLocal = proposeLocal(t, vehicle, trip.km, trip.minutes, ctx.at);
    const band = Number.isFinite(Number(t.band)) ? Number(t.band) : 20;
    const adjust = Math.max(-band, Math.min(band, Number((driver.rideDriver || {}).fareAdjust) || 0));
    const local = adjust ? Math.max(Number(t.roundTo) || 0, roundTo(proposedLocal * (1 + adjust / 100), Number(t.roundTo) || 0)) : proposedLocal;
    const usd = (x) => Math.max(0.25, money(x / rate));
    return {
      fare: usd(local), local, currency: code, symbol: currencyForCountry(t.country).symbol || code,
      proposed: usd(proposedLocal), proposedLocal, adjust, source: 'trothen', rate,
      detail: { km: trip.km, minutes: trip.minutes, route: trip.source, fuelFactor: Math.round(fuelFactor(t) * 1000) / 1000, nightPct: nightPct(t, ctx.at) },
    };
  }
  // No fare table here: the driver's own starting fare and price per km, as before.
  const r = (driver.rideDriver && driver.rideDriver.rates) || {};
  const base = Number(r.baseFee) > 0 ? Number(r.baseFee) : 1, perKm = Number(r.perKm) >= 0 ? Number(r.perKm) : 0;
  const fare = Math.max(1, money(base + perKm * trip.km));
  return { fare, local: null, currency: 'USD', symbol: '$', proposed: fare, proposedLocal: null, adjust: 0, source: 'driver', detail: { km: trip.km, minutes: trip.minutes, route: trip.source } };
}

// The lowest offer a rider may make (US$), or null when there is no table.
async function offerFloor(country, fareUsd) {
  const t = await tableFor(country);
  if (!t) return null;
  const pct = Number.isFinite(Number(t.offerFloor)) ? Number(t.offerFloor) : 70;
  return money(fareUsd * pct / 100);
}

// Cleans a fare table a super admin saves. Returns { table } or { error }.
function cleanTable(country, b) {
  b = b || {};
  if (typeof country !== 'string' || country.trim().length < 2 || country.length > 60) return { error: 'Choose the country' };
  const code = String(b.currency || currencyForCountry(country.trim()).code).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { error: 'The currency must be a 3-letter code, like LRD or USD' };
  const vehicles = {};
  for (const v of VEHICLES) {
    const x = b.vehicles && b.vehicles[v];
    if (!x) continue;
    const row = { base: num(x.base), perKm: num(x.perKm), perMin: num(x.perMin) || 0, min: num(x.min) || 0 };
    const bad = [row.base, row.perKm, row.perMin, row.min].some(n => !(Number.isFinite(n) && n >= 0 && n <= 1000000));
    if (bad || !(row.base > 0 || row.min > 0)) return { error: `${v}: enter a starting fare (or a minimum fare), a price per km and per minute of 0 or more` };
    vehicles[v] = row;
  }
  if (!Object.keys(vehicles).length) return { error: 'Set the fares for at least one vehicle' };
  const f = b.fuel || {};
  const fuel = { refPrice: num(f.refPrice), currentPrice: num(f.currentPrice), threshold: num(f.threshold) == null ? 10 : num(f.threshold), share: num(f.share) == null ? 40 : num(f.share), unit: String(f.unit || 'gallon').slice(0, 20) };
  if ((fuel.refPrice != null && !(fuel.refPrice > 0)) || (fuel.currentPrice != null && !(fuel.currentPrice > 0))) return { error: 'Fuel prices must be more than 0, or left blank' };
  if (!(fuel.threshold >= 0 && fuel.threshold <= 100) || !(fuel.share >= 0 && fuel.share <= 100)) return { error: 'The fuel threshold and the fuel share are percentages from 0 to 100' };
  if (fuel.currentPrice == null) fuel.currentPrice = fuel.refPrice;
  const n = b.night || {};
  const night = { pct: num(n.pct) || 0, startHour: Number.isInteger(n.startHour) ? n.startHour : 22, endHour: Number.isInteger(n.endHour) ? n.endHour : 5 };
  if (!(night.pct >= 0 && night.pct <= 50) || night.startHour < 0 || night.startHour > 23 || night.endHour < 0 || night.endHour > 23 || night.startHour === night.endHour) return { error: 'The night extra is 0 to 50%, between two different hours from 0 to 23' };
  const band = num(b.band) == null ? 20 : num(b.band);
  const offerFloor = num(b.offerFloor) == null ? 70 : num(b.offerFloor);
  const roundStep = num(b.roundTo) == null ? (code === 'USD' ? 0.25 : 5) : num(b.roundTo);
  const tzOffset = num(b.tzOffset) || 0;
  if (!(band >= 0 && band <= 50)) return { error: 'Drivers can be allowed 0 to 50% above or below the Trothen fare' };
  if (!(offerFloor >= 0 && offerFloor <= 100)) return { error: 'The lowest offer is 0 to 100% of the fare' };
  if (!(roundStep >= 0 && roundStep <= 1000)) return { error: 'Rounding must be 0 to 1000' };
  if (!(Number.isInteger(tzOffset) && tzOffset >= -12 && tzOffset <= 14)) return { error: 'The time zone is a whole number of hours from UTC' };
  return { table: { currency: code, vehicles, fuel, night, band, offerFloor, roundTo: roundStep, tzOffset, updatedAt: new Date().toISOString() } };
}

module.exports = { VEHICLES, tables, tableFor, fuelFactor, nightPct, proposeLocal, fareFor, offerFloor, cleanTable };
