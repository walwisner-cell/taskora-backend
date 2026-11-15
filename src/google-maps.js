// v166: Google Maps Platform, when GOOGLE_MAPS_API_KEY is set on Render.
//
// Walter asked how to use Google Maps Platform, and for the best. Google
// knows far more places, streets and addresses in Liberia than the free maps,
// and it is what most ride and delivery apps in Africa use. With the key set,
// Trothen uses Google for all four map jobs:
//   - the map pictures (Map Tiles API, 2D roadmap and satellite tiles), shown
//     in Trothen's maps with Google's credit, as Google requires;
//   - finding places by name (Places API, Text Search);
//   - the street address of a pin, on receipts (Geocoding API);
//   - the route along the roads, its distance and its time (Routes API).
// Google's terms say Google results are shown on a Google map, which is why
// it is all four or none: one key switches them all.
//
// Without the key, Trothen keeps what it had: Mapbox (MAPBOX_TOKEN) or
// OpenStreetMap. If Google doesn't answer, each job falls back the same way.
//
// Costs are kept down the way Google recommends: answers are kept in memory
// (routes 10 minutes, addresses and searches a day), searches only start after
// a pause in typing, and only the fields needed are asked for.
const KEY = () => (process.env.GOOGLE_MAPS_API_KEY || '').trim();
const on = () => !!KEY();
const base = (name, dflt) => (process.env[name] || dflt).replace(/\/+$/, ''); // the *_URL settings are for tests

async function getJson(url, init, ms = 4000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...(init || {}), signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}

// ── map pictures: a session per kind of map, renewed before it runs out ──
const sessions = {};
async function tileSession(mapType) {
  const s = sessions[mapType];
  if (s && s.until > Date.now() + 3600 * 1000) return s;
  const body = { mapType, language: 'en-US', region: 'US', ...(mapType === 'satellite' ? { layerTypes: ['layerRoadmap'] } : {}) };
  const j = await getJson(`${base('GMP_TILES_URL', 'https://tile.googleapis.com')}/v1/createSession?key=${encodeURIComponent(KEY())}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!j || !j.session) return s || null;
  const until = j.expiry ? Number(j.expiry) * 1000 : Date.now() + 13 * 24 * 3600 * 1000;
  return (sessions[mapType] = { id: j.session, until });
}
// The tile layers for the app's maps, as /api/geo/map-config gives them.
async function mapLayers() {
  if (!on()) return null;
  const [road, sat] = await Promise.all([tileSession('roadmap'), tileSession('satellite')]);
  if (!road) return null;
  const tiles = base('GMP_TILES_URL', 'https://tile.googleapis.com');
  const credit = `Map data &copy;${new Date().getFullYear()} Google`;
  const layer = (sess) => ({ url: `${tiles}/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(sess.id)}&key=${encodeURIComponent(KEY())}`, maxZoom: 22, maxNativeZoom: 22, attribution: credit, google: true, viewportUrl: `${tiles}/tile/v1/viewport?session=${encodeURIComponent(sess.id)}&key=${encodeURIComponent(KEY())}` });
  return { street: layer(road), satellite: sat ? layer(sat) : null };
}

// ── finding places by name ──
async function searchPlaces(q, countryCode, near) {
  if (!on()) return null;
  const body = { textQuery: q, maxResultCount: 5, languageCode: 'en', ...(countryCode ? { regionCode: countryCode.toLowerCase() } : {}),
    ...(near ? { locationBias: { circle: { center: { latitude: near.latitude, longitude: near.longitude }, radius: 50000 } } } : {}) };
  const j = await getJson(`${base('GMP_PLACES_URL', 'https://places.googleapis.com')}/v1/places:searchText`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': KEY(), 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.addressComponents' }, body: JSON.stringify(body) });
  if (!j) return null;
  return (j.places || []).filter(p => p.location && (!countryCode || !Array.isArray(p.addressComponents) || p.addressComponents.some(c => (c.types || []).includes('country') && String(c.shortText || '').toUpperCase() === countryCode.toUpperCase())))
    .map(p => ({ name: [p.displayName && p.displayName.text, p.formattedAddress].filter(Boolean).join(', ').slice(0, 140), latitude: Math.round(p.location.latitude * 1e6) / 1e6, longitude: Math.round(p.location.longitude * 1e6) / 1e6, google: true })).slice(0, 5);
}

// ── the street address of a pin ──
async function reverseGeocode(lat, lng) {
  if (!on()) return null;
  const j = await getJson(`${base('GMP_GEOCODE_URL', 'https://maps.googleapis.com')}/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${encodeURIComponent(KEY())}`);
  if (!j || j.status !== 'OK' || !Array.isArray(j.results) || !j.results.length) return j && j.status === 'ZERO_RESULTS' ? { words: '', cc: '' } : null;
  const best = j.results.find(r => (r.types || []).some(t => ['street_address', 'premise', 'route', 'establishment', 'point_of_interest'].includes(t))) || j.results[0];
  const cc = ((best.address_components || []).find(c => (c.types || []).includes('country')) || {}).short_name || '';
  return { words: String(best.formatted_address || '').replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,3},?\s*/, '').slice(0, 160), cc: String(cc).toUpperCase() };
}

// ── the route along the roads ──
function decodePolyline(str) {
  const pts = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
      const d = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (which === 0) lat += d; else lng += d;
    }
    pts.push([Math.round(lat) / 1e5, Math.round(lng) / 1e5]);
  }
  return pts;
}
async function route(a, b, full) {
  if (!on()) return null;
  const body = { origin: { location: { latLng: { latitude: a.latitude, longitude: a.longitude } } }, destination: { location: { latLng: { latitude: b.latitude, longitude: b.longitude } } }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' };
  const j = await getJson(`${base('GMP_ROUTES_URL', 'https://routes.googleapis.com')}/directions/v2:computeRoutes`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': KEY(), 'X-Goog-FieldMask': full ? 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline' : 'routes.distanceMeters,routes.duration' }, body: JSON.stringify(body) });
  const r = j && j.routes && j.routes[0];
  if (!r || !(r.distanceMeters > 0)) return null;
  const minutes = Number(String(r.duration || '0s').replace('s', '')) / 60;
  return { km: r.distanceMeters / 1000, carMinutes: minutes, points: full && r.polyline && r.polyline.encodedPolyline ? decodePolyline(r.polyline.encodedPolyline) : null };
}

// The copyright line Google requires under its map, for the part of the world shown.
const credits = new Map();
async function viewportCredit(zoom, n, s, e, w) {
  if (!on()) return null;
  const road = await tileSession('roadmap'); if (!road) return null;
  const r = (x) => Math.round(x * 10) / 10;
  const key = [zoom, r(n), r(s), r(e), r(w)].join(',');
  const hit = credits.get(key); if (hit && hit.until > Date.now()) return hit.text;
  const j = await getJson(`${base('GMP_TILES_URL', 'https://tile.googleapis.com')}/tile/v1/viewport?session=${encodeURIComponent(road.id)}&key=${encodeURIComponent(KEY())}&zoom=${zoom}&north=${n}&south=${s}&east=${e}&west=${w}`);
  const text = j && j.copyright ? String(j.copyright).slice(0, 200) : `Map data ©${new Date().getFullYear()} Google`;
  if (credits.size > 3000) credits.clear();
  credits.set(key, { text, until: Date.now() + 24 * 3600 * 1000 });
  return text;
}

module.exports = { on, mapLayers, searchPlaces, reverseGeocode, route, decodePolyline, viewportCredit };
