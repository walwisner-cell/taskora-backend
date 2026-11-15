// v166: a small map with the pin, printed on receipts and invoices, so the
// exact place can be seen at a glance (as Uber and Bolt receipts show the
// trip on a map). Made from the same map pictures ("tiles") the app shows:
//  - MAPBOX_TOKEN set: Mapbox streets;
//  - or MAP_TILE_URL, any provider with {z}/{x}/{y};
//  - otherwise OpenStreetMap's own tiles, with the credit line they require.
// Tiles are kept in memory, so a receipt opened again asks for nothing.
// If the tiles can't be fetched in a few seconds, the receipt simply has no
// map picture: the address, Plus Code and map link are still there.
const ZOOM = 17;
const cache = new Map();

function source() {
  const mb = (process.env.MAPBOX_TOKEN || '').trim();
  if (mb) return { url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${encodeURIComponent(mb)}`, credit: '© Mapbox © OpenStreetMap' };
  if (process.env.MAP_TILE_URL) return { url: process.env.MAP_TILE_URL.replace('{s}', 'a').replace('{r}', ''), credit: process.env.MAP_TILE_CREDIT || '© OpenStreetMap contributors' };
  return { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', credit: '© OpenStreetMap contributors' };
}

async function tile(url) {
  if (cache.has(url)) return cache.get(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Trothen/1.0 (trothenpro.com; receipts)' } });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const png = buf[0] === 0x89 && buf[1] === 0x50, jpg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!png && !jpg) return null;
    if (cache.size > 400) cache.clear();
    cache.set(url, buf);
    return buf;
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

// The tiles around a pin for a box of widthPt × heightPt, drawn at `scale`
// points per tile pixel. Returns null when any tile is missing.
async function forPin(pin, widthPt, heightPt, scale = 0.7) {
  if (!pin || !Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) return null;
  const n = 256 * 2 ** ZOOM;
  const lat = Math.max(Math.min(pin.latitude, 85), -85) * Math.PI / 180;
  const px = (pin.longitude + 180) / 360 * n;
  const py = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n;
  const halfW = widthPt / scale / 2, halfH = heightPt / scale / 2;
  const x0 = Math.floor((px - halfW) / 256), x1 = Math.floor((px + halfW) / 256);
  const y0 = Math.floor((py - halfH) / 256), y1 = Math.floor((py + halfH) / 256);
  const src = source();
  const jobs = [];
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
    const url = src.url.replace('{z}', ZOOM).replace('{x}', ((tx % 2 ** ZOOM) + 2 ** ZOOM) % 2 ** ZOOM).replace('{y}', ty);
    jobs.push(tile(url).then(buf => ({ buf, dx: (tx * 256 - (px - halfW)) * scale, dy: (ty * 256 - (py - halfH)) * scale })));
  }
  const tiles = await Promise.all(jobs);
  if (tiles.some(t => !t.buf)) return null;
  return { tiles, size: 256 * scale, widthPt, heightPt, credit: src.credit };
}

module.exports = { forPin, ZOOM };
