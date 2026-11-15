// v142: how far a trip really is by road, and how long it takes.
//
// With ROUTING_URL set to an OSRM routing service (built on OpenStreetMap),
// the distance and time come from the real roads. OSRM is free and open
// source: run your own copy, or use a hosted one. The public demo server
// (https://router.project-osrm.org) is fine for testing but not for a
// live app, by its own usage policy.
//
// Without it (or if the service doesn't answer within 3 seconds), the
// trip is estimated: the straight line × 1.3, at a typical city speed for
// the vehicle. Answers are remembered for 10 minutes.
const { distanceInMiles } = require('./geo-distance');
const KM_PER_MILE = 1.609344;
const ROAD_FACTOR = 1.3;
// Typical speeds in a busy African city (km/h), for estimates and to adjust car times for bikes.
const CITY_KMH = { motorbike: 24, keke: 18, car: 20, van: 18 };
const cache = new Map();

function straightKm(a, b) {
  return distanceInMiles(a.latitude, a.longitude, b.latitude, b.longitude) * KM_PER_MILE;
}
function estimate(a, b, vehicle) {
  const km = Math.round(straightKm(a, b) * ROAD_FACTOR * 10) / 10;
  const kmh = CITY_KMH[vehicle] || CITY_KMH.car;
  return { km, minutes: Math.max(1, Math.round(km / kmh * 60)), source: 'estimate' };
}

async function routeTrip(a, b, vehicle) {
  const base = (process.env.ROUTING_URL || '').trim().replace(/\/+$/, '');
  if (!base) return estimate(a, b, vehicle);
  const key = [a.latitude, a.longitude, b.latitude, b.longitude].map(n => Number(n).toFixed(4)).join(',');
  let road = cache.get(key);
  if (!road || road.until < Date.now()) {
    road = null;
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch(`${base}/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=false`, { signal: ctl.signal });
      clearTimeout(timer);
      const j = await r.json();
      const best = j && j.code === 'Ok' && j.routes && j.routes[0];
      if (best && best.distance > 0) road = { km: best.distance / 1000, carMinutes: best.duration / 60, until: Date.now() + 10 * 60 * 1000 };
    } catch (e) { road = null; }
    if (road) { cache.set(key, road); if (cache.size > 2000) cache.delete(cache.keys().next().value); }
  }
  if (!road) return estimate(a, b, vehicle);
  // Car times on open roads are faster than a city really is; use the slower of the two.
  const kmh = CITY_KMH[vehicle] || CITY_KMH.car;
  const cityMinutes = road.km / kmh * 60;
  const minutes = Math.max(1, Math.round(Math.max(road.carMinutes * (vehicle === 'motorbike' ? 0.85 : 1), cityMinutes * 0.75)));
  return { km: Math.round(road.km * 10) / 10, minutes, source: 'road' };
}

// v148: the road itself, to draw on a map (as Uber and Bolt show the route).
// [[lat, lng], ...] along the roads, or null (then the app draws a straight
// dashed line). Remembered for 10 minutes.
const shapes = new Map();
async function routeShape(a, b) {
  const base = (process.env.ROUTING_URL || '').trim().replace(/\/+$/, '');
  if (!base) return null;
  const key = [a.latitude, a.longitude, b.latitude, b.longitude].map(n => Number(n).toFixed(4)).join(',');
  const hit = shapes.get(key);
  if (hit && hit.until > Date.now()) return hit.shape;
  let shape = null;
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`${base}/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson`, { signal: ctl.signal });
    clearTimeout(timer);
    const j = await r.json();
    const best = j && j.code === 'Ok' && j.routes && j.routes[0];
    if (best && best.geometry && Array.isArray(best.geometry.coordinates)) {
      const pts = best.geometry.coordinates.map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
      const step = Math.max(1, Math.ceil(pts.length / 400)); // at most about 400 points
      shape = { points: pts.filter((p, i) => i % step === 0 || i === pts.length - 1), km: Math.round(best.distance / 100) / 10, carMinutes: Math.round(best.duration / 60) };
    }
  } catch (e) { shape = null; }
  shapes.set(key, { shape, until: Date.now() + 10 * 60 * 1000 });
  if (shapes.size > 1000) shapes.delete(shapes.keys().next().value);
  return shape;
}

module.exports = { routeTrip, routeShape, estimate, ROAD_FACTOR, CITY_KMH };
