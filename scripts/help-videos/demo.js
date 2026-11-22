// v178: the demo world the help videos are recorded in (a throw-away copy, never real data):
// people in Monrovia, Liberia, a store with goods, a driver online, a job, a chat.
'use strict';
const path = require('path');
const fs = require('fs');

const MONROVIA = { latitude: 6.3007, longitude: -10.7969, accuracy: 15 };

let ROOTDIR;
const R = (p) => require(path.join(ROOTDIR, 'src', p));

async function token(uid) {
  const db = R('db.js');
  const u = await db.find('users', x => x.id === uid);
  return R('auth.js').signToken(u, 'film');
}

// A simple picture of a good (a coloured card with an icon), so goods have photos.
function productPng(color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#F2F4F7"/><rect x="90" y="90" width="420" height="420" rx="40" fill="${color}"/><text x="300" y="330" font-family="Arial" font-size="56" font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  try { return require('sharp')(Buffer.from(svg)).png().toBuffer(); } catch (e) { return null; }
}

async function prepare(root) {
  ROOTDIR = root;
  const db = R('db.js');
  const { CURRENT_TERMS_VERSION } = R('terms.js');
  const { setSetting, getSetting } = R('platform-settings.js');
  const now = new Date().toISOString();
  await setSetting('rideEnabledCountries', ['Liberia']).catch(() => {});
  const ver = await getSetting('rideRulesVersion').catch(() => null);
  const rr = { rider: { version: ver, at: now }, driver: { version: ver, at: now } };
  const L = { verified: true, termsVersion: CURRENT_TERMS_VERSION, onHold: false, active: true, country: 'Liberia', city: 'Monrovia', rideRules: rr };
  // customers
  await db.update('users', 'u_jordan', { ...L, name: 'Jordan Diaz', latitude: MONROVIA.latitude, longitude: MONROVIA.longitude });
  // a pro with a store (clothes, phones and building goods)
  await db.update('users', 'u_james', { ...L, name: 'James Roberts', proMode: 'both', extraSkills: [{ category: 'Pick & Drop', status: 'approved', requestedAt: now, decidedAt: now }],
    store: { name: 'James Phones & Hardware', description: 'Phones, clothes and building materials in Sinkor', open: true, approval: { status: 'approved' }, liveGoods: 3, rulesVersion: 1, options: { deliveryMethods: ['pickup', 'driver'], pickupPlace: 'Sinkor, 12th Street', pickupLocation: { latitude: 6.2860, longitude: -10.7650 } } } });
  // a driver, online near the rider
  await db.update('users', 'u_emeka', { ...L, name: 'Emeka Nimely', rideDriver: { status: 'approved', vehicle: 'motorbike', plate: 'MC-4471', make: 'Haojue 150', licenceExpiry: '2030-01-01', insuranceExpiry: '2030-01-01', helmet: true, cash: true, online: true, onlineUntil: new Date(Date.now() + 8 * 3600e3).toISOString(), lastLocation: { latitude: 6.3035, longitude: -10.7930, at: now } } });
  for (const id of ['u_marcus', 'u_sofia', 'u_aisha', 'u_tom']) await db.update('users', id, { ...L }).catch(() => {});
  // someone who has not sent their ID yet (for the verification video)
  await db.update('users', 'u_chioma', { ...L, verified: false, name: 'Chioma Kollie' }).catch(() => {});
  await db.update('users', 'u_superadmin', { termsVersion: CURRENT_TERMS_VERSION }).catch(() => {});
  // photos and goods
  const up = process.env.UPLOADS_DIR; fs.mkdirSync(up, { recursive: true });
  const pics = [['phone', '#1F5FBF', 'Galaxy A15'], ['dress', '#C1554D', 'Maxi dress'], ['cement', '#5B6B80', 'Cement 50kg']];
  for (const [n, c, l] of pics) { const b = await productPng(c, l); if (b) fs.writeFileSync(path.join(up, `store_u_james_${n}.png`), b); }
  const goods = [
    { id: 'good_phone', name: 'Samsung Galaxy A15, 128 GB, Black', description: 'Brand new, sealed in the box.\nDual SIM, 4G.\n1 year warranty.', price: 150, marketCategory: 'Phones & Tablets', photoUrls: ['/uploads/store_u_james_phone.png'], stock: 6, size: 'small',
      specs: { model: 'Galaxy A15', storage: '128 GB', ram: '4 GB', colour: 'Black', network: '4G LTE', sim: 'Dual SIM', locked: 'Unlocked (any network)', warranty: '1 year' } },
    { id: 'good_dress', name: "Women's floral maxi dress", description: 'Material: 100% cotton.\nFit: true to size.\nCare: hand wash cold.', price: 25, marketCategory: 'Fashion & Clothing', photoUrls: ['/uploads/store_u_james_dress.png'], variantName: 'Size', size: 'small',
      variants: [{ id: 'v_s', label: 'S', stock: 3 }, { id: 'v_m', label: 'M', stock: 4 }, { id: 'v_l', label: 'L', stock: 5 }],
      sizeChart: { unit: 'cm', measures: ['bust', 'waist', 'length'], rows: [{ size: 'S', values: { bust: 86, waist: 66, length: 140 } }, { size: 'M', values: { bust: 91, waist: 71, length: 141 } }, { size: 'L', values: { bust: 96, waist: 76, length: 142 } }] } },
    { id: 'good_cement', name: 'Portland cement, 50 kg bag', description: 'Grade 42.5N. Delivered by truck for 20 bags or more.', price: 9, marketCategory: 'Building & Hardware', photoUrls: ['/uploads/store_u_james_cement.png'], stock: 200, size: 'medium',
      specs: { material: 'Portland cement', grade: 'Cement 42.5N (EN 197-1)', saleUnit: 'Bag', weight: '50 kg' } },
  ];
  for (const g of goods) {
    const have = await db.find('storeGoods', x => x.id === g.id);
    const rec = { providerId: 'u_james', priceCurrency: 'USD', status: 'approved', forSale: true, condition: 'new', createdAt: now, ...g };
    if (have) await db.update('storeGoods', g.id, rec); else await db.insert('storeGoods', rec);
  }
  try { await R('store.js').refreshStoreLive('u_james'); } catch (e) {}
  // for the Admin videos: a good waiting to be checked, and a Market listing held for a check
  const b = await productPng('#2E8C6F', 'Spark 20'); if (b) fs.writeFileSync(path.join(up, 'store_u_james_spark.png'), b);
  if (!(await db.find('storeGoods', x => x.id === 'good_spark'))) await db.insert('storeGoods', { id: 'good_spark', providerId: 'u_james', name: 'Tecno Spark 20, 256 GB', description: 'New, sealed. Dual SIM.', price: 135, priceCurrency: 'USD', status: 'pending', forSale: true, condition: 'new', marketCategory: 'Phones & Tablets', photoUrls: ['/uploads/store_u_james_spark.png'], stock: 4, specs: { model: 'Spark 20', storage: '256 GB', ram: '8 GB', network: '4G LTE', sim: 'Dual SIM', locked: 'Unlocked (any network)' }, createdAt: now, updatedAt: now });
  const c = await productPng('#8C6423', 'Drill'); if (c) fs.writeFileSync(path.join(up, 'market_u_jordan_drill.png'), c);
  if (!(await db.find('marketListings', x => x.id === 'ml_drill'))) await db.insert('marketListings', { id: 'ml_drill', sellerId: 'u_jordan', title: 'Bosch drill, 650 W, with case', description: 'Used twice. Works perfectly.', category: 'Tools & Equipment', condition: 'like_new', price: 45, currency: 'USD', priceUsd: 45, photoUrls: ['/uploads/market_u_jordan_drill.png'], pickupPlace: 'Sinkor', protected: true, cash: true, driver: true, status: 'review', reviewReasons: ['A new seller with a high price for the category'], reports: [], views: 3, city: 'Monrovia', country: 'Liberia', ownerAttestedAt: now, createdAt: now, expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), specs: { model: 'GSB 650', powerSource: 'Mains (corded)', power: 650 } });
}

module.exports = { prepare, token, MONROVIA };
