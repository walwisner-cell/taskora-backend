// v139: the Trothen Market.
//
// One place to buy goods, with two kinds of sellers:
//   - Stores: a pro's store (a pro who offers services and sells, or a pro
//     who only sells goods: proMode 'goods'). Goods are approved by a
//     manager, as before (src/store.js).
//   - People: any ID-verified customer or pro selling their own item, new
//     or used ("personal listings", like Jiji or Facebook Marketplace).
//
// Buying a personal listing, two ways:
//   - With Trothen protection (shown first): the buyer pays through Trothen,
//     the money is held until they have the item (collected, or brought by
//     a pick-and-drop driver), and the buyer pays a small protection fee.
//     The seller gets their full price.
//   - Meet in person and pay cash: Trothen only connects them (messages,
//     calls), shows safety tips, and holds nothing.
//
// Every order, from a store or a person, completes by itself a few days
// after it is handed over unless the buyer reports a problem (a dispute,
// which holds the money for the Disputes team). Buyers rate the seller once
// the order is complete.
const db = require('./db');
const store = require('./store');
const { notify } = require('./notify');

// Market categories, close to the international marketplaces (Jiji, Jumia,
// Facebook Marketplace) with the trade supplies Trothen's pros need first.
const MARKET_CATEGORIES = [
  'Building & Hardware', 'Plumbing Supplies', 'Electrical Supplies', 'Tools & Equipment', 'Paint & Finishes',
  'Home & Furniture', 'Appliances', 'Phones & Tablets', 'Computers & Electronics', 'Vehicles & Parts',
  'Garden & Outdoor', 'Cleaning Supplies', 'Health & Beauty', 'Fashion & Clothing', 'Baby & Kids',
  'Sports & Hobbies', 'Books & Education', 'Food & Groceries', 'Agriculture & Farm', 'Other',
];
const CONDITIONS = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };
const MAX_LIVE_LISTINGS = 30;
const MAX_PHOTOS = 6;
const LISTING_DAYS = 60;          // a listing ends after this; the seller can renew it
const REPORTS_TO_HIDE = 3;        // different people reporting a listing hides it until the team looks
const DAY = 24 * 3600 * 1000;
const money = store.money;
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// v140: which Market aisles go with each kind of job, for "Materials for
// this job". A service not listed here shows nothing rather than a guess.
const SERVICE_TO_MARKET = {
  'Plumbing': ['Plumbing Supplies', 'Building & Hardware', 'Tools & Equipment'],
  'Electrical': ['Electrical Supplies', 'Tools & Equipment'],
  'Painting': ['Paint & Finishes', 'Tools & Equipment'],
  'Landscaping': ['Garden & Outdoor', 'Agriculture & Farm', 'Tools & Equipment'],
  'Gardening': ['Garden & Outdoor', 'Agriculture & Farm'],
  'Cleaning': ['Cleaning Supplies'],
  'House Cleaning': ['Cleaning Supplies'],
  'Carpentry': ['Building & Hardware', 'Tools & Equipment'],
  'Construction': ['Building & Hardware', 'Tools & Equipment', 'Paint & Finishes'],
  'Masonry': ['Building & Hardware', 'Tools & Equipment'],
  'Roofing': ['Building & Hardware', 'Tools & Equipment'],
  'Tiling': ['Building & Hardware', 'Tools & Equipment'],
  'Welding': ['Building & Hardware', 'Tools & Equipment'],
  'HVAC & Air Conditioning': ['Electrical Supplies', 'Appliances', 'Tools & Equipment'],
  'Appliance Repair': ['Appliances', 'Electrical Supplies'],
  'Auto Repair': ['Vehicles & Parts', 'Tools & Equipment'],
  'Mechanic': ['Vehicles & Parts', 'Tools & Equipment'],
  'Phone Repair': ['Phones & Tablets'],
  'Computer Repair': ['Computers & Electronics'],
  'Hair & Beauty': ['Health & Beauty'],
  'Barber': ['Health & Beauty'],
  'Tailoring': ['Fashion & Clothing'],
  'Moving': ['Home & Furniture'],
  'Furniture Assembly': ['Home & Furniture', 'Tools & Equipment'],
  'Handyman': ['Building & Hardware', 'Tools & Equipment', 'Plumbing Supplies', 'Electrical Supplies'],
  'Pest Control': ['Cleaning Supplies', 'Agriculture & Farm'],
  'Catering': ['Food & Groceries'],
  'Farming': ['Agriculture & Farm'],
  'Tutoring': ['Books & Education'],
};
function marketAislesFor(category) {
  if (!category) return [];
  if (SERVICE_TO_MARKET[category]) return SERVICE_TO_MARKET[category];
  const k = Object.keys(SERVICE_TO_MARKET).find(x => x.toLowerCase() === String(category).toLowerCase());
  return k ? SERVICE_TO_MARKET[k] : [];
}

// v140: how established a seller is. "New seller" for under 3 completed
// Market sales or an account under 30 days old (shown to buyers; their
// payouts from personal sales wait a few extra days, see below).
const NEW_SELLER_SALES = 3;
const NEW_SELLER_DAYS = 30;
const NEW_SELLER_RESERVE_DAYS = 3;
async function sellerStats(userId) {
  const u = await db.find('users', x => x.id === userId);
  const sales = (await db.filter('contracts', c => c.providerId === userId && c.storeOrder === true && c.status === 'completed')).length;
  const ageDays = u && u.createdAt ? (Date.now() - Date.parse(u.createdAt)) / DAY : 0;
  return { sales, isNew: sales < NEW_SELLER_SALES || ageDays < NEW_SELLER_DAYS };
}
// The payout reserve (as eBay and PayPal do for new sellers): money from a
// personal sale by a seller with fewer than 3 completed Market sales becomes
// payable 3 days after the order completes, giving a buyer time to report a
// fake or a swap after the fact.
function reserveUntil(contract, completedSalesBefore) {
  if (!contract || !contract.marketListingId || !contract.completedAt) return null;
  if ((contract.newSellerReserve !== true) && completedSalesBefore >= NEW_SELLER_SALES) return null;
  const until = Date.parse(contract.completedAt) + NEW_SELLER_RESERVE_DAYS * DAY;
  return until > Date.now() ? new Date(until).toISOString() : null;
}

// v140: words that go with the most common marketplace scams: paying
// outside the platform, untraceable money, advance fees, fake "overpayment"
// and fake delivery agents. A match never blocks a message (people may
// mention these innocently); the person who receives it sees a warning,
// and repeated matches from one sender raise a fraud flag.
const SCAM_PATTERNS = [
  [/\b(western ?union|money ?gram|world ?remit|ria money)\b/i, 'money transfer service'],
  [/\b(gift ?cards?|itunes ?cards?|google ?play ?cards?|steam ?cards?|amazon ?cards?|vouchers? code)\b/i, 'gift cards'],
  [/\b(bitcoin|btc|usdt|crypto|ethereum|binance|tether)\b/i, 'crypto'],
  [/\b(pay|send|transfer)\b.{0,30}\b(outside|off|directly|direct to me|before (delivery|i (send|ship|bring)))\b/i, 'paying outside Trothen'],
  [/\b(outside|off)\s+(trothen|the app|the platform|this app)\b/i, 'paying outside Trothen'],
  [/\b(advance|upfront|up-front)\s+(fee|payment|deposit)\b/i, 'advance fee'],
  [/\b(overpa(y|id|yment)|refund the (difference|balance|extra))\b/i, 'overpayment'],
  [/\b(customs|clearance|shipping agent|courier agent)\s+(fee|charge)\b/i, 'fake delivery fee'],
  [/\b(verification code|otp|one[- ]time code|pin code)\b.{0,30}\b(send|share|give|tell)\b|\b(send|share|give|tell)\b.{0,30}\b(verification code|otp|one[- ]time code)\b/i, 'asking for a code'],
];
function scamSignals(text) {
  const t = String(text || '');
  const out = [];
  for (const [re, label] of SCAM_PATTERNS) if (re.test(t) && !out.includes(label)) out.push(label);
  return out;
}

// v140: checks a new personal listing for the signs of a scam listing. Any
// sign sends it to the Trothen team before it goes live (as Jiji and OLX
// do), and records a fraud flag:
//   - priced far below what the same kind of item sells for here;
//   - photos another seller has already used (stolen photos);
//   - a high-value item from a seller with no completed sales;
//   - too many new listings from a brand-new account.
async function listingRisk(listing, seller, usdPrice) {
  const reasons = [];
  const same = await db.filter('marketListings', l => l.id !== listing.id && l.category === listing.category && sameText(l.country, listing.country) && ['live', 'sold', 'reserved'].includes(l.status) && Number(l.priceUsd) > 0);
  if (same.length >= 5) {
    const prices = same.map(l => Number(l.priceUsd)).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    if (usdPrice < median * 0.25) reasons.push(`priced at $${usdPrice.toFixed(2)}, far below the usual $${median.toFixed(2)} for ${listing.category} here`);
  }
  const hashes = (listing.photoHashes || []).filter(Boolean);
  if (hashes.length) {
    const reused = await db.find('marketPhotoHashes', h => hashes.includes(h.hash) && h.userId !== seller.id);
    if (reused) reasons.push('uses a photo another seller already uploaded');
  }
  const stats = await sellerStats(seller.id);
  if (usdPrice >= 500 && stats.sales === 0) reasons.push(`a $${usdPrice.toFixed(0)} item from a seller with no completed sales yet`);
  const ageDays = seller.createdAt ? (Date.now() - Date.parse(seller.createdAt)) / DAY : 0;
  if (ageDays < 7) {
    const recent = await db.filter('marketListings', l => l.sellerId === seller.id && l.id !== listing.id && Date.now() - Date.parse(l.createdAt) < 7 * DAY);
    if (recent.length >= 5) reasons.push('more than 5 listings from an account under a week old');
  }
  return reasons;
}

// When an open order completes by itself, or null if it isn't counting down yet.
//   collect / seller brings it: from when the seller marked it handed over
//   driver: from when the driver recorded the drop-off
async function autoCompleteAt(order) {
  if (!order || !order.storeOrder || order.status !== 'active') return null;
  const s = await store.storeSettings();
  const method = order.deliveryMethod || 'pickup';
  let from = order.handedOverAt || null;
  if (method === 'driver' && order.deliveryContractId) {
    const d = await db.find('contracts', c => c.id === order.deliveryContractId);
    const drop = d && d.handover && d.handover.dropoff && d.handover.dropoff[0] && d.handover.dropoff[0].at;
    from = drop || from;
  }
  if (!from) return null;
  const days = method === 'pickup' ? s.autoReleasePickupDays : s.autoReleaseDeliveryDays;
  return new Date(Date.parse(from) + days * DAY).toISOString();
}

// The order completes: the money goes to the seller (and the driver), and a
// personal listing is marked sold.
async function completeOrder(order, how) {
  const { completeContractCore } = require('./routes/payments.routes');
  const so = require('./store-orders');
  const done = await completeContractCore(order, 0, order.customerId);
  await so.afterComplete(order, order.customerId);
  await afterOrderEnds(done.contract || order);
  if (how === 'auto') {
    await db.update('contracts', order.id, { autoCompleted: true });
    await notify(order.customerId, '📦', `Order #${order.bookingNumber} completed by itself, because no problem was reported in time. You can still rate the seller.`, 'bookingUpdates', { section: 'market' });
    await notify(order.providerId, '💸', `Order #${order.bookingNumber} is complete. The money is now yours to cash out.`, 'bookingUpdates', { section: 'market' });
  }
  return done;
}

// A personal listing follows its order: sold when the order completes, back
// on sale if the order was cancelled or refunded.
async function afterOrderEnds(order) {
  if (!order || !order.marketListingId) return;
  const l = await db.find('marketListings', x => x.id === order.marketListingId);
  if (!l || l.reservedForOrderId !== order.id) return;
  if (order.status === 'completed') await db.update('marketListings', l.id, { status: 'sold', soldAt: new Date().toISOString(), reservedForOrderId: null });
  else if (['cancelled', 'refunded', 'declined', 'expired'].includes(order.status)) {
    await db.update('marketListings', l.id, { status: l.status === 'reserved' ? 'live' : l.status, reservedForOrderId: null });
    await notify(l.sellerId, '🏷️', `"${l.title}" is back on sale: the order for it was ${order.status}.`, 'bookingUpdates', { section: 'market' });
  }
}

// Ratings for sellers (stores and people), kept apart from service ratings.
async function refreshSellerRating(sellerId) {
  const all = await db.filter('marketReviews', r => r.sellerId === sellerId);
  const avg = all.length ? Math.round(all.reduce((s, r) => s + r.stars, 0) / all.length * 10) / 10 : null;
  await db.update('users', sellerId, { sellerRating: avg, sellerRatingCount: all.length });
  return { avg, count: all.length };
}

// Every 10 minutes: orders past their date complete; buyers get one
// reminder the day before; listings past their end date end.
async function sweep() {
  const now = Date.now();
  for (const order of await db.filter('contracts', c => c.storeOrder === true && c.status === 'active' && (c.handedOverAt || c.deliveryContractId))) {
    try {
      const at = await autoCompleteAt(order);
      if (!at) continue;
      const t = Date.parse(at);
      if (t <= now) { await completeOrder(order, 'auto'); continue; }
      if (t - now < DAY && !order.autoReminderSent) {
        await db.update('contracts', order.id, { autoReminderSent: true });
        await notify(order.customerId, '⏰', `Order #${order.bookingNumber} completes by itself on ${new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} (UTC) and the seller is paid. If something is wrong, report a problem before then.`, 'bookingUpdates', { section: 'market' });
      }
    } catch (e) { console.error('[market] auto-complete', order.id, e.message); }
  }
  // Reserved listings whose order fell through go back on sale.
  for (const l of await db.filter('marketListings', x => x.status === 'reserved' && x.reservedForOrderId)) {
    const o = await db.find('contracts', c => c.id === l.reservedForOrderId);
    if (!o || ['cancelled', 'refunded', 'declined', 'expired', 'completed'].includes(o.status)) await afterOrderEnds(o || { marketListingId: l.id, id: l.reservedForOrderId, status: 'cancelled' });
  }
  for (const l of await db.filter('marketListings', x => x.status === 'live' && x.expiresAt && Date.parse(x.expiresAt) < now)) {
    await db.update('marketListings', l.id, { status: 'expired' });
    await notify(l.sellerId, '🏷️', `Your Market listing "${l.title}" has ended after ${LISTING_DAYS} days. Renew it from Market → Sell if it's still for sale.`, 'bookingUpdates', { section: 'market' });
  }
}
let timer = null;
function startMarketScheduler() {
  if (timer) return;
  timer = setInterval(() => { sweep().catch(e => console.error('[market] sweep', e.message)); }, Number(process.env.MARKET_SWEEP_MS) || 10 * 60 * 1000);
  timer.unref();
  setTimeout(() => sweep().catch(() => {}), 20000).unref();
}

module.exports = { SERVICE_TO_MARKET, marketAislesFor, sellerStats, reserveUntil, scamSignals, listingRisk, NEW_SELLER_SALES, NEW_SELLER_RESERVE_DAYS, MARKET_CATEGORIES, CONDITIONS, MAX_LIVE_LISTINGS, MAX_PHOTOS, LISTING_DAYS, REPORTS_TO_HIDE, DAY, money, sameText, autoCompleteAt, completeOrder, afterOrderEnds, refreshSellerRating, sweep, startMarketScheduler };
