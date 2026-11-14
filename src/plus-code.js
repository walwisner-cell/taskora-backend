// v164: Plus Codes (Open Location Code) on the server, for receipts and
// invoices. The same arithmetic the page uses (public/app/trothen.js,
// plusCodeFor): a 10-digit code, about 14 metres square, that Google Maps
// understands, so a place with no street address can be read out over the
// phone or found from a printed receipt.
const ALPHABET = '23456789CFGHJMPQRVWX';
const PLACEHOLDER = 'Location pinned on the map';

function plusCodeFor(lat, lng) {
  let a = Math.floor((Math.min(Math.max(lat, -90), 90 - 1e-9) + 90) * 8000);
  let b = Math.floor(((((lng + 180) % 360) + 360) % 360) * 8000);
  let code = '';
  for (let i = 0; i < 5; i++) { code = ALPHABET[a % 20] + ALPHABET[b % 20] + code; a = Math.floor(a / 20); b = Math.floor(b / 20); }
  return code.slice(0, 8) + '+' + code.slice(8);
}
const isPin = (p) => !!p && typeof p.latitude === 'number' && typeof p.longitude === 'number' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude);

// The lines that say where a place is: the address and landmark people typed
// or picked, then the pin as a Plus Code with its coordinates and a map link.
function placeLines({ address, landmark, pin }) {
  const out = [];
  const addr = String(address || '').trim(), lm = String(landmark || '').trim();
  if (addr && addr !== PLACEHOLDER && addr !== lm) out.push(['Address', addr.slice(0, 200)]);
  if (lm) out.push(['Landmark', lm.slice(0, 200)]);
  if (isPin(pin)) {
    out.push(['Pinned location', `${plusCodeFor(pin.latitude, pin.longitude)}  (${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)})`]);
    out.push(['Map', `https://www.google.com/maps/search/?api=1&query=${pin.latitude.toFixed(6)},${pin.longitude.toFixed(6)}`]);
  }
  return out;
}

// A ride or trip: where it started and where it ended, each in full.
function tripLines(pickup, dropoff) {
  const part = (name, pt) => pt ? placeLines({ address: pt.address, landmark: pt.landmark, pin: pt }).map(([l, v]) => [l === 'Map' ? `${name} map` : l === 'Address' ? name : `${name}: ${l.toLowerCase()}`, v]) : [];
  return [...part('Pick-up', pickup), ...part('Drop-off', dropoff)];
}

module.exports = { plusCodeFor, placeLines, tripLines, isPin, PLACEHOLDER };
