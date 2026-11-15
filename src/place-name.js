// v166: "the location should show the exact location". A pin on a receipt
// showed only a Plus Code and coordinates, which a person can't read. Ride
// and delivery apps (Uber, Bolt, Glovo, Jumia) print the street address of
// the pin. This turns a pin into words:
//
//  - The street address of the pin, from OpenStreetMap's free address
//    lookup ("reverse geocoding"), e.g. "14 Tubman Boulevard, Sinkor,
//    Monrovia, Liberia". Asked from the server, at most one question a
//    second, with a name for Trothen and a cache, as that service asks.
//    REVERSE_GEOCODE_URL points it at another provider with the same answers
//    (for example LocationIQ: https://us1.locationiq.com/v1/reverse?key=YOUR_KEY).
//  - The nearest place on Trothen's own list (Admin → Rides → Places) when it
//    is close, e.g. "120 m from ELWA Junction". Free maps know few Liberian
//    landmarks, and that is how people there give directions.
//
// The answer is saved on the pin itself (placeName), so a receipt always
// says the same thing and the lookup is done once. It goes when the pin
// goes (the location retention clean-up and account deletion remove the pin).
// If the lookup service can't be reached, nothing breaks: the Plus Code,
// coordinates and map link are still there.
const db = require('./db');

const URL_BASE = () => process.env.REVERSE_GEOCODE_URL || 'https://nominatim.openstreetmap.org/reverse';
const cache = new Map();
let queue = Promise.resolve();
let lastCallAt = 0;
const okPin = (p) => !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && !(p.latitude === 0 && p.longitude === 0);

// Distance in metres between two points.
function metres(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r, dLng = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// OpenStreetMap's address parts, most precise first, as people write them.
function addressWords(a, fallback) {
  if (!a || typeof a !== 'object') return String(fallback || '').slice(0, 160);
  const street = [a.house_number, a.road || a.pedestrian || a.footway || a.path || a.residential].filter(Boolean).join(' ');
  const area = a.neighbourhood || a.quarter || a.suburb || a.hamlet || a.city_district;
  const town = a.city || a.town || a.village || a.municipality || a.county;
  const parts = [a.amenity || a.shop || a.building && a.building !== 'yes' && a.building || '', street, area, town, a.state && a.state !== town ? a.state : '', a.country];
  const seen = new Set();
  const out = parts.map(s => String(s || '').trim()).filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  return (out.join(', ') || String(fallback || '')).slice(0, 160);
}

async function lookUp(lat, lng) {
  const key = lat.toFixed(5) + ',' + lng.toFixed(5);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const run = async () => {
    const wait = 1100 - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCallAt = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(`${URL_BASE()}${URL_BASE().includes('?') ? '&' : '?'}format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`, { signal: ctrl.signal, headers: { 'User-Agent': 'Trothen/1.0 (trothenpro.com; receipts)', 'Accept-Language': 'en' } });
      if (!r.ok) throw new Error('address lookup answered ' + r.status);
      const x = await r.json();
      return x && !x.error ? { words: addressWords(x.address, x.display_name), cc: String((x.address && x.address.country_code) || '').toUpperCase().slice(0, 2) } : { words: '', cc: '' };
    } finally { clearTimeout(timer); }
  };
  try {
    const job = queue.then(run, run);
    queue = job.catch(() => {});
    const words = await job;
    if (cache.size > 5000) cache.clear();
    cache.set(key, words);
    return words;
  } catch (e) {
    return null; // not cached: try again next time
  }
}

// The nearest pinned place on Trothen's own list, if within 600 m.
async function nearestOwnPlace(pin) {
  try {
    const list = await db.filter('places', p => p.status === 'live' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    let best = null;
    for (const p of list) { const m = metres(pin, p); if (m <= 600 && (!best || m < best.m)) best = { m, p }; }
    if (!best) return '';
    const m = Math.round(best.m / 10) * 10;
    const name = [best.p.name, best.p.area].filter(Boolean).join(', ');
    return m < 30 ? `At ${name}` : `${m} m from ${name}`;
  } catch (e) { return ''; }
}

// Words for a pin: { address, near }. Uses what is saved on the pin if there is.
async function describe(pin) {
  if (!okPin(pin)) return null;
  if (pin.placeName && typeof pin.placeName === 'object') return pin.placeName;
  const [found, near] = await Promise.all([lookUp(pin.latitude, pin.longitude), nearestOwnPlace(pin)]);
  if (found === null && !near) return null; // the lookup failed: don't save, try again next time
  return { address: (found && found.words) || '', near: near || '', ...(found && found.cc ? { cc: found.cc } : {}), at: new Date().toISOString() };
}

// Fills placeName on the pins of a saved record and stores it, so it is
// looked up once. paths: e.g. ['jobLocation', 'delivery.pickupLocation'].
async function fillRecord(collection, rec, paths) {
  if (!rec) return rec;
  const patch = {};
  for (const path of paths) {
    const [top, sub] = path.split('.');
    const pin = sub ? rec[top] && rec[top][sub] : rec[top];
    if (!okPin(pin) || pin.placeName) continue;
    const words = await describe(pin);
    if (!words) continue;
    if (sub) { rec[top] = { ...rec[top], [sub]: { ...pin, placeName: words } }; patch[top] = rec[top]; }
    else { rec[top] = { ...pin, placeName: words }; patch[top] = rec[top]; }
  }
  if (Object.keys(patch).length && rec.id) { try { await db.update(collection, rec.id, patch); } catch (e) { /* the receipt still shows it */ } }
  return rec;
}

// v166: a country's two-letter code from its English name ("Liberia" → "LR"),
// from the names the JavaScript engine itself knows. No list to keep up to date.
let CODES = null;
function countryCode(name) {
  if (!CODES) {
    CODES = new Map();
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) {
        const c = String.fromCharCode(65 + i, 65 + j);
        try { const n = dn.of(c); if (n && n !== c) CODES.set(n.toLowerCase(), c); } catch (e) {}
      }
      // Names Trothen's country list writes differently.
      [['united states', 'US'], ['united kingdom', 'GB'], ['democratic republic of the congo', 'CD'], ['republic of the congo', 'CG'], ['ivory coast', 'CI'], ["cote d'ivoire", 'CI'], ['eswatini', 'SZ'], ['czech republic', 'CZ'], ['south korea', 'KR'], ['north korea', 'KP'], ['russia', 'RU'], ['vietnam', 'VN'], ['laos', 'LA'], ['syria', 'SY'], ['iran', 'IR'], ['tanzania', 'TZ'], ['bolivia', 'BO'], ['venezuela', 'VE'], ['moldova', 'MD'], ['palestine', 'PS'], ['micronesia', 'FM'], ['cape verde', 'CV'], ['east timor', 'TL'], ['vatican city', 'VA'], ['burma', 'MM'], ['myanmar', 'MM']].forEach(([n, c]) => CODES.set(n, c));
    } catch (e) { /* no Intl names: the checks that use this are skipped */ }
  }
  return CODES.get(String(name || '').trim().toLowerCase()) || '';
}

module.exports = { describe, fillRecord, addressWords, metres, okPin, countryCode };
