// v111: a driver's phone can lose signal for a few minutes. It keeps the
// positions it could not send and sends them together when it is back online.
// This turns that batch into a clean route and finds the newest position.
// Old points (over 6 hours), future points and bad coordinates are dropped.
const { isValidCoordinate } = require('./geo-distance');
const MAX_POINTS = 50, MAX_AGE_MS = 6 * 3600 * 1000;

function cleanBatch(points, now = Date.now()) {
  if (!Array.isArray(points)) return [];
  const out = [];
  for (const p of points.slice(0, MAX_POINTS)) {
    if (!p || !isValidCoordinate(p.latitude, p.longitude) || (p.latitude === 0 && p.longitude === 0)) continue;
    const t = typeof p.at === 'string' && !/^\d+$/.test(p.at.trim()) ? Date.parse(p.at) : Number(p.at); // milliseconds or an ISO date
    if (!Number.isFinite(t) || t > now + 60000 || now - t > MAX_AGE_MS) continue;
    const acc = Number(p.accuracyM);
    out.push({ latitude: Math.round(p.latitude * 1e6) / 1e6, longitude: Math.round(p.longitude * 1e6) / 1e6, accuracyM: Number.isFinite(acc) && acc > 0 && acc < 100000 ? Math.round(acc) : null, speedKmh: Number.isFinite(Number(p.speedMps)) && Number(p.speedMps) >= 0 ? Math.round(Number(p.speedMps) * 3.6) : null, t });
  }
  return out.sort((a, b) => a.t - b.t);
}
// Adds the batch to a stored route ([lat, lng, ms] rows), oldest first, 15 s apart at most.
function mergeTrack(track, batch) {
  let next = Array.isArray(track) ? track.slice() : [];
  for (const p of batch) {
    const last = next[next.length - 1];
    if (last && p.t <= last[2]) continue; // never go back in time
    if (!last || p.t - last[2] >= 15000) next.push([Math.round(p.latitude * 1e5) / 1e5, Math.round(p.longitude * 1e5) / 1e5, p.t]);
  }
  if (next.length > 400) next = next.filter((_, i) => i === 0 || i % 2 === 0 || i === next.length - 1);
  return next;
}
// The newest point as a "live" record, only if it is newer than the one already stored.
function newestLive(batch, current) {
  const p = batch[batch.length - 1];
  if (!p) return current || null;
  if (current && new Date(current.at).getTime() >= p.t) return current;
  return { latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracyM, speedKmh: p.speedKmh, at: new Date(p.t).toISOString() };
}
module.exports = { cleanBatch, mergeTrack, newestLive };
