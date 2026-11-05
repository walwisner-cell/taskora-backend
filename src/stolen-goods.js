// v143: keeping stolen goods out of the Market.
//
// What the big classified marketplaces do (eBay, Jiji, OLX, Gumtree,
// Facebook Marketplace), and the phone-theft registries used in Africa and
// the UK (Kenya's and Nigeria's IMEI registers, CheckMEND):
//
//  1. Everyone who sells is ID-checked, and every sale is linked to that
//     person, so a stolen item sold here can be traced to the seller.
//  2. The seller declares they own the item and may sell it.
//  3. Phones, tablets, computers and vehicles need their IMEI, serial or
//     chassis number (only the last 4 are ever shown). Parts and
//     accessories are exempt when the seller says so.
//  4. Such an item worth $200 or more also needs a photo proving ownership
//     (a receipt, the box with the same IMEI, or registration papers). Only
//     the Trothen team sees it; buyers see "Proof of ownership given".
//  5. Anyone whose item was stolen can register its number. A listing with
//     a registered number is held for the team at once, with a high-priority
//     flag (the seller is only told it is being checked), and so is any
//     listing already on sale when the theft is registered.
//  6. The same number listed by two different people is held.
//  7. A private seller listing more than 3 such devices in 30 days is held
//     (a pattern of reselling stolen goods).
// Numbers are stored as a fingerprint (SHA-256), never in readable form,
// except the last 4 characters.
const crypto = require('crypto');
const db = require('./db');

const SERIAL_REQUIRED = {
  'Phones & Tablets': 'IMEI (dial *#06# on the phone to see it)',
  'Computers & Electronics': 'serial number (on a sticker underneath, or in the settings)',
  'Vehicles & Parts': 'chassis (VIN) or engine number',
};
const SERIAL_OPTIONAL = { Appliances: 'serial number', 'Tools & Equipment': 'serial number (generators, power tools)' };
const PROOF_FROM_USD = 200;
const DEVICES_PER_30_DAYS = 3;
const DAY = 24 * 3600 * 1000;

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fingerprint = (s) => crypto.createHash('sha256').update('trothen-serial:' + norm(s)).digest('hex');

// Reads the serial, accessory flag, ownership declaration and proof photo
// from a listing form. Returns { out } or { error }.
function readOwnership(b, existing, category, priceUsd, sellerId) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b || {}, k);
  if (!existing || has('ownsIt')) {
    if (b.ownsIt !== true) return { error: 'Confirm that you own this item and have the right to sell it' };
    out.ownerAttestedAt = new Date().toISOString();
  }
  const isPart = has('isPart') ? b.isPart === true : !!(existing && existing.isPart);
  out.isPart = isPart;
  const cat = category || (existing && existing.category);
  if (has('serial') || !existing || has('category') || has('isPart')) {
    const raw = has('serial') ? b.serial : null;
    const n = norm(raw);
    if (raw && (n.length < 5 || n.length > 40)) return { error: 'The IMEI, serial or chassis number should be 5 to 40 letters and numbers' };
    if (n) { out.serialHash = fingerprint(n); out.serialLast4 = n.slice(-4); }
    else if (!has('serial') && existing && existing.serialHash) { /* unchanged */ }
    else { out.serialHash = null; out.serialLast4 = null; }
    const need = SERIAL_REQUIRED[cat] && !isPart;
    const hasSerial = out.serialHash !== undefined ? !!out.serialHash : !!(existing && existing.serialHash);
    if (need && !hasSerial) return { error: `Add the ${SERIAL_REQUIRED[cat]}. It helps keep stolen goods off Trothen; buyers only see the last 4. If this is a part or an accessory, tick that box instead.` };
  }
  if (has('proofUrl')) {
    const u = b.proofUrl;
    if (u && !(typeof u === 'string' && new RegExp(`^/uploads/market_${String(sellerId).replace(/[^\w-]/g, '')}_[\\w-]+\\.(jpe?g|png|webp|gif)$`, 'i').test(u))) return { error: 'Upload the proof of ownership photo again' };
    out.proofUrl = u || null;
  }
  const needsProof = SERIAL_REQUIRED[cat] && !isPart && Number(priceUsd) >= PROOF_FROM_USD;
  const proof = out.proofUrl !== undefined ? out.proofUrl : existing && existing.proofUrl;
  if (needsProof && !proof) return { error: `For a ${cat.toLowerCase()} item of $${PROOF_FROM_USD} or more, add a photo proving it is yours: the receipt, the box showing the same number, or the registration papers. Only the Trothen team sees it.` };
  return { out };
}

// Reasons to hold a listing for the team (added to the existing scam checks).
async function stolenRisk(listing, seller) {
  const reasons = [];
  if (listing.serialHash) {
    const reported = await db.find('stolenReports', r => r.serialHash === listing.serialHash && r.status === 'open');
    if (reported) reasons.push(`its number (ending ${listing.serialLast4}) is registered as STOLEN (report ${reported.id})`);
    const other = await db.find('marketListings', l => l.id !== listing.id && l.serialHash === listing.serialHash && l.sellerId !== seller.id && l.status !== 'deleted' && Date.now() - Date.parse(l.createdAt) < 365 * DAY);
    if (other) reasons.push(`the same number (ending ${listing.serialLast4}) was listed by another seller`);
  }
  if (SERIAL_REQUIRED[listing.category] && !listing.isPart && !(seller.store && seller.store.name)) {
    const recent = await db.filter('marketListings', l => l.sellerId === seller.id && l.id !== listing.id && SERIAL_REQUIRED[l.category] && !l.isPart && l.status !== 'deleted' && Date.now() - Date.parse(l.createdAt) < 30 * DAY);
    if (recent.length >= DEVICES_PER_30_DAYS) reasons.push(`more than ${DEVICES_PER_30_DAYS} ${listing.category.toLowerCase()} items listed in 30 days by a private seller`);
  }
  return reasons;
}

// Someone registers their stolen item. Listings already on sale with that number are held.
async function registerStolen(user, b) {
  const n = norm(b && b.serial);
  if (n.length < 5 || n.length > 40) return { error: 'Enter the IMEI, serial or chassis number (5 to 40 letters and numbers)' };
  const what = String((b && b.what) || '').trim();
  if (what.length < 3 || what.length > 120) return { error: 'Say what was stolen, for example "Tecno Spark 10, blue"' };
  const police = String((b && b.policeReport) || '').trim().slice(0, 60);
  const serialHash = fingerprint(n);
  if (await db.find('stolenReports', r => r.serialHash === serialHash && r.userId === user.id && r.status === 'open')) return { error: 'You have already registered this number.' };
  const mine = await db.filter('stolenReports', r => r.userId === user.id && r.status === 'open');
  if (mine.length >= 10) return { error: 'You can register up to 10 stolen items. Mark recovered ones as found first.' };
  const report = { id: `st_${require('nanoid').nanoid(10)}`, userId: user.id, serialHash, serialLast4: n.slice(-4), what, policeReport: police || null, country: user.country || '', status: 'open', createdAt: new Date().toISOString() };
  await db.insert('stolenReports', report);
  const hits = await db.filter('marketListings', l => l.serialHash === serialHash && ['live', 'hidden', 'review'].includes(l.status));
  return { report, hits };
}

module.exports = { SERIAL_REQUIRED, SERIAL_OPTIONAL, PROOF_FROM_USD, DEVICES_PER_30_DAYS, norm, fingerprint, readOwnership, stolenRisk, registerStolen };
