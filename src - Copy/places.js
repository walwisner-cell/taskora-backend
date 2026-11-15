// v147: places people use to say where they are, where there are few street
// addresses (Liberia and much of Africa).
//
// How the ride apps working in Africa do it (Bolt, Yango, inDrive, SafeBoda,
// Gozem): a rider types a landmark ("ELWA Junction", "Red Light") and picks
// it from a list of known pickup points, or taps Home, Work or a recent
// place; they add a short note for the driver ("blue gate, red shirt"); the
// driver navigates to the pin. Free map search (OpenStreetMap) knows very
// few Liberian landmarks, so Trothen keeps its own list:
//
//  - PLACES: kept by the Trothen team per country (Admin → Rides → Places),
//    each with a pin. Only pinned places are offered.
//  - A starter list of well-known Greater Monrovia communities and Liberia's
//    county capitals is added with no pin ("needs a pin"): someone on the
//    team pins each one on the map once. Coordinates are never guessed.
//  - SUGGESTIONS: when riders name a place and pin it, the name is counted;
//    a name used by 3 or more different riders shows to the team as a
//    suggestion to add, with the middle of their pins.
//  - SAVED PLACES: each person can save up to 10 (Home, Work, Mum's house…).
const { nanoid } = require('nanoid');
const db = require('./db');

const KINDS = ['landmark', 'junction', 'market', 'hospital', 'school', 'church', 'mosque', 'hotel', 'airport', 'bus_park', 'community', 'town', 'government', 'shop', 'other'];
const MAX_SAVED = 10;
const SUGGEST_AFTER = 3;
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const sameText = (a, b) => norm(a) === norm(b);

// The starter list for Liberia: names only (no pins), to be pinned by the
// team. Greater Monrovia communities and landmarks people give as
// directions, and the county capitals for rides between counties.
const LIBERIA_STARTER = [
  ['Red Light', 'Paynesville', 'market'], ['ELWA Junction', 'Paynesville', 'junction'], ['Duala Market', 'Bushrod Island', 'market'], ['Broad Street', 'Central Monrovia', 'landmark'],
  ['Waterside Market', 'Central Monrovia', 'market'], ['Capitol Hill', 'Central Monrovia', 'government'], ['Mamba Point', 'Central Monrovia', 'community'], ['Sinkor', 'Monrovia', 'community'],
  ['Congo Town', 'Monrovia', 'community'], ['Old Road', 'Sinkor', 'landmark'], ['Tubman Boulevard', 'Sinkor', 'landmark'], ['JFK Medical Center', 'Sinkor', 'hospital'],
  ['University of Liberia (Capitol Hill campus)', 'Central Monrovia', 'school'], ['University of Liberia (Fendall campus)', 'Louisiana', 'school'], ['Spriggs Payne Airport', 'Sinkor', 'airport'], ['Roberts International Airport (RIA)', 'Harbel', 'airport'],
  ['SKD Boulevard', 'Paynesville', 'landmark'], ['Samuel K. Doe Sports Complex', 'Paynesville', 'landmark'], ['Paynesville Town Hall', 'Paynesville', 'government'], ['Rehab Junction', 'Paynesville', 'junction'],
  ['Duport Road', 'Paynesville', 'community'], ['Joe Bar', 'Paynesville', 'community'], ['Police Academy', 'Paynesville', 'landmark'], ['Soul Clinic', 'Paynesville', 'community'],
  ['72nd', 'Paynesville', 'community'], ['Pipeline', 'Paynesville', 'community'], ['GSA Road', 'Paynesville', 'landmark'], ['Gardnersville', 'Monrovia', 'community'],
  ['Barnersville', 'Monrovia', 'community'], ['New Georgia', 'Monrovia', 'community'], ['Caldwell', 'Monrovia', 'community'], ['Logan Town', 'Bushrod Island', 'community'],
  ['Clara Town', 'Bushrod Island', 'community'], ['New Kru Town', 'Bushrod Island', 'community'], ['Freeport of Monrovia', 'Bushrod Island', 'landmark'], ['West Point', 'Central Monrovia', 'community'],
  ['Vai Town', 'Bushrod Island', 'community'], ['Jamaica Road', 'Bushrod Island', 'landmark'], ['Johnsonville', 'Monrovia', 'community'], ['Brewerville', 'Montserrado', 'town'],
  ['Virginia', 'Montserrado', 'town'], ['Kakata', 'Margibi', 'town'], ['Harbel', 'Margibi', 'town'], ['Buchanan', 'Grand Bassa', 'town'],
  ['Gbarnga', 'Bong', 'town'], ['Ganta', 'Nimba', 'town'], ['Sanniquellie', 'Nimba', 'town'], ['Tubmanburg', 'Bomi', 'town'],
  ['Robertsport', 'Grand Cape Mount', 'town'], ['Bopolu', 'Gbarpolu', 'town'], ['Voinjama', 'Lofa', 'town'], ['Zwedru', 'Grand Gedeh', 'town'],
  ['Harper', 'Maryland', 'town'], ['Greenville', 'Sinoe', 'town'], ['Fish Town', 'River Gee', 'town'], ['Barclayville', 'Grand Kru', 'town'], ['Cestos City', 'River Cess', 'town'],
];

async function seedStarter() {
  const have = await db.filter('places', p => p.country === 'Liberia');
  if (have.length) return 0;
  const now = new Date().toISOString();
  for (const [name, area, kind] of LIBERIA_STARTER) {
    await db.insert('places', { id: `pl_${nanoid(10)}`, country: 'Liberia', name, area, kind, aliases: [], latitude: null, longitude: null, status: 'needs_pin', uses: 0, source: 'starter', createdAt: now });
  }
  return LIBERIA_STARTER.length;
}

const pinned = (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number';
function publicPlace(p) { return { id: p.id, name: p.name, area: p.area || '', kind: p.kind || 'other', latitude: p.latitude, longitude: p.longitude }; }

// Search: whole words and starts of words, in the name, the area or another name it goes by.
function score(p, q) {
  const n = norm(p.name), a = norm(p.area), al = (p.aliases || []).map(norm).join(' ');
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.split(' ').some(w => w.startsWith(q))) return 60;
  if (al.split(' ').some(w => w.startsWith(q))) return 50;
  if (q.split(' ').every(w => (n + ' ' + al + ' ' + a).includes(w))) return 40;
  return 0;
}
async function search(country, q, limit = 8) {
  const query = norm(q);
  if (query.length < 2) return [];
  const list = await db.filter('places', p => sameText(p.country, country) && p.status === 'live' && pinned(p));
  return list.map(p => ({ p, s: score(p, query) })).filter(x => x.s > 0).sort((x, y) => (y.s - x.s) || ((y.p.uses || 0) - (x.p.uses || 0))).slice(0, limit).map(x => publicPlace(x.p));
}

// A rider used a named place with a pin: count it, and suggest it to the
// team once several different riders have used the same name.
async function noteUse(user, point) {
  try {
    if (!user || !point || !point.address || typeof point.latitude !== 'number') return;
    const name = String(point.address).trim();
    if (name.length < 3 || /^(pickup|destination|my location)$/i.test(name)) return;
    const country = user.country || '';
    const known = await db.find('places', p => sameText(p.country, country) && (sameText(p.name, name) || (p.aliases || []).some(a => sameText(a, name))));
    if (known) {
      if (known.status === 'live') await db.update('places', known.id, { uses: (known.uses || 0) + 1 });
      else if (known.status === 'needs_pin') { // the team can use riders' pins to place it
        const pins = (known.riderPins || []).filter(x => x.userId !== user.id).concat([{ userId: user.id, latitude: point.latitude, longitude: point.longitude }]).slice(-20);
        await db.update('places', known.id, { riderPins: pins });
      }
      return;
    }
    const sug = await db.find('placeSuggestions', s => sameText(s.country, country) && sameText(s.name, name));
    if (sug) {
      const pins = (sug.pins || []).filter(x => x.userId !== user.id).concat([{ userId: user.id, latitude: point.latitude, longitude: point.longitude }]).slice(-20);
      await db.update('placeSuggestions', sug.id, { pins, riders: new Set(pins.map(x => x.userId)).size, lastUsedAt: new Date().toISOString() });
    } else {
      await db.insert('placeSuggestions', { id: `ps_${nanoid(10)}`, country, name: name.slice(0, 80), pins: [{ userId: user.id, latitude: point.latitude, longitude: point.longitude }], riders: 1, createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
    }
  } catch (e) { console.error('[places] noteUse:', e.message); }
}

// The middle of several pins, leaving out ones far from the rest (a typo, a
// rider who pinned where they were rather than the place).
function middle(pins) {
  if (!pins || !pins.length) return null;
  const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const mLat = med(pins.map(p => p.latitude)), mLng = med(pins.map(p => p.longitude));
  const near = pins.filter(p => Math.abs(p.latitude - mLat) < 0.01 && Math.abs(p.longitude - mLng) < 0.01); // about 1 km
  const use = near.length ? near : pins;
  const avg = (k) => Math.round((use.reduce((n, p) => n + p[k], 0) / use.length) * 1e6) / 1e6;
  return { latitude: avg('latitude'), longitude: avg('longitude'), agree: near.length, of: pins.length };
}

// Each person's saved places.
function savedOf(user) { return Array.isArray(user && user.savedPlaces) ? user.savedPlaces : []; }
function readSaved(b) {
  const label = String((b && b.label) || '').trim().slice(0, 30);
  const name = String((b && b.name) || '').trim().slice(0, 120);
  const lat = Number(b && b.latitude), lng = Number(b && b.longitude);
  if (label.length < 2) return { error: 'Give the place a short name, for example Home or Work' };
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) || (lat === 0 && lng === 0)) return { error: 'Pin the place first' };
  const note = String((b && b.note) || '').trim().slice(0, 140);
  return { place: { id: `sp_${nanoid(8)}`, label, name: name || label, latitude: Math.round(lat * 1e6) / 1e6, longitude: Math.round(lng * 1e6) / 1e6, note } };
}

module.exports = { KINDS, MAX_SAVED, SUGGEST_AFTER, LIBERIA_STARTER, seedStarter, search, noteUse, middle, publicPlace, pinned, savedOf, readSaved, norm, sameText };
