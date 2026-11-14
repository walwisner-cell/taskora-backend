// v105: the pro store.
//
// A pro can choose to open a store and sell goods to their customers: a
// salon puts hair and wave on the shelf, a plumber puts fittings. It is
// optional. The rules, in one place:
//
//   - Goods are checked by a manager before customers can see them.
//   - Outside the store, customers only see the STORE NAME under the pro.
//     The goods and their prices are only shown once someone opens the store.
//   - What a customer picks is added to the booking as the materials cost
//     and is paid for when they book.
//   - Trothen takes a flat fee per store purchase (set by the super admin,
//     $5 to begin with). No commission is taken on goods.
//
// This file holds the parts other files need: pricing a basket, holding
// and giving back stock, and the store settings. The web addresses are in
// src/routes/store.routes.js.
const db = require('./db');

const STORE_DEFAULTS = {
  enabled: true,        // one switch to turn every store off
  purchaseFee: 5,       // flat fee in US dollars added to a booking that includes goods
  maxGoodsPerStore: 60,
  // v106: who pays the purchase fee. 'customer' = added at checkout.
  // 'pro' = the customer pays nothing extra and the fee comes out of the
  // pro's money when they are paid.
  feePaidBy: 'customer',
  // v106: extra words a super admin has banned, on top of the built-in list.
  bannedWords: [],
  // v106: the rules a pro agrees to before opening a store. A new
  // rulesVersion makes every pro agree again the next time they save.
  rulesVersion: 1,
  rulesText: '',
  // v108: Trothen's share of a delivery charge, as a percentage. It is
  // added for the customer at checkout, on a seller's own delivery charge
  // and on a pick-and-drop driver's price. Never on the goods.
  deliveryFeePercent: 9,
  // v110: days a seller has to pack a paid order. After that the customer is refunded automatically.
  sellerPackDays: 3, // v148: 3 days to get an order ready (Jumia and Amazon expect 1 to 3), with a reminder after 1
  // v139: how Trothen earns on goods. 'percent' (the marketplace standard,
  // like Jumia or Amazon's referral fee): a share of the goods total, with a
  // minimum, paid by the seller from their money at payout. The buyer sees
  // the shelf price and pays nothing extra. 'flat': the old flat fee above.
  feeMode: 'percent',
  goodsFeePercent: 8,
  goodsFeeMin: 0.5,
  // v139: personal listings (anyone selling their own item) bought "with
  // Trothen protection": the buyer pays a small protection fee, the seller
  // gets their full price. Meeting in person and paying cash costs nothing.
  protectionFeePercent: 5,
  protectionFeeMin: 0.5,
  // v139: an order that has been handed over completes by itself after these
  // days unless the buyer reports a problem (collected / delivered).
  autoReleasePickupDays: 3,
  autoReleaseDeliveryDays: 7,
  // v143: every business store accepts returns of faulty, wrong, damaged or
  // not-as-described goods for at least this many days after the order is
  // complete (Jumia: 7 days). The seller's money for the order waits until
  // then, so a refund is always possible. A store can offer longer, and
  // change-of-mind returns too. 0 = no returns after the order completes.
  storeMinReturnDays: 7,
};
// v108: how goods can reach the customer.
const DELIVERY_METHODS = ['pickup', 'seller', 'driver'];
const DELIVERY_LABELS = { pickup: 'I collect it myself', seller: 'The seller brings it', driver: 'A pick-and-drop driver brings it' };
const DRIVER_SKILL = 'Pick & Drop';
const VEHICLES = ['motorbike', 'bicycle', 'keke', 'car', 'van', 'truck', 'on foot']; // v164: bicycle second, after the motorbike
// v164: how far each kind of vehicle goes on one delivery (straight line from
// the pick-up), as courier companies set it: on foot and by bicycle for short
// trips across a town (Glovo, Uber Eats and Deliveroo keep bicycles to a few
// kilometres), a motorbike or keke across a city, a car, van or truck further.
// Each driver can narrow their own range ("from 2 km, up to 8 km"); they are
// only offered deliveries inside it.
const VEHICLE_MAX_KM = { 'on foot': 3, bicycle: 10, motorbike: 50, keke: 30, car: 200, van: 300, truck: 500 };
// The built-in store rules, used until a super admin writes their own.
// Plain commitments, not a contract an attorney has approved.
const DEFAULT_STORE_RULES = [
  'I am the seller of everything in my store. Trothen shows my goods and holds the customer\'s money; it does not own, stock or deliver them.',
  'My photos and descriptions show the real goods, and I will hand over exactly what the customer paid for.',
  'I will only sell goods I am allowed to sell where I live, and never weapons, drugs, medicines, alcohol, tobacco, fake or stolen goods.',
  'If goods are missing, wrong, damaged or unsafe, the customer can report a problem on the booking and Trothen can refund them from the money it is holding.',
  'Any tax due on what I sell is mine to declare and pay.',
  'Trothen can take down a good or close my store if these rules are broken.',
].join('\n');
const MAX_PHOTOS_PER_GOOD = 4;
const MAX_QTY_PER_LINE = 99;
const MAX_LINES_PER_ORDER = 20;
const MAX_EXTRA_SKILLS = 10; // v148: was 4. Thumbtack, TaskRabbit and Upwork let a pro list every service they really offer (Upwork: 15 skills).
// A business or company (a business name, or part of an organisation) runs a team and offers more.
const MAX_EXTRA_SKILLS_BUSINESS = 25;
const maxExtraSkillsFor = (u) => (u && (String(u.businessName || '').trim() || u.organizationId) ? MAX_EXTRA_SKILLS_BUSINESS : MAX_EXTRA_SKILLS);

const money = (n) => Math.round(Number(n) * 100) / 100;

const pctOr = (v, d, max) => (Number.isFinite(Number(v)) && v !== null && v !== '' && Number(v) >= 0 && Number(v) <= max ? Math.round(Number(v) * 100) / 100 : d);
const dollarsOr = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' && Number(v) >= 0 && Number(v) <= 100 ? money(v) : d);
const daysOr = (v, d) => (Number.isInteger(v) && v >= 1 && v <= 30 ? v : d);
let cached = { ...STORE_DEFAULTS, rulesText: DEFAULT_STORE_RULES };
async function storeSettings() {
  try {
    const row = await db.find('platformSettings', s => s.key === 'storeSettings');
    const v = (row && row.value) || {};
    cached = {
      enabled: v.enabled !== false,
      purchaseFee: Number.isFinite(Number(v.purchaseFee)) && Number(v.purchaseFee) >= 0 ? money(v.purchaseFee) : STORE_DEFAULTS.purchaseFee,
      maxGoodsPerStore: Number.isInteger(v.maxGoodsPerStore) && v.maxGoodsPerStore > 0 ? v.maxGoodsPerStore : STORE_DEFAULTS.maxGoodsPerStore,
      feePaidBy: v.feePaidBy === 'pro' ? 'pro' : 'customer',
      bannedWords: Array.isArray(v.bannedWords) ? v.bannedWords.filter(w => typeof w === 'string' && w.trim()).map(w => w.trim().toLowerCase()).slice(0, 200) : [],
      rulesVersion: Number.isInteger(v.rulesVersion) && v.rulesVersion > 0 ? v.rulesVersion : 1,
      rulesText: typeof v.rulesText === 'string' && v.rulesText.trim() ? v.rulesText.trim() : DEFAULT_STORE_RULES,
      deliveryFeePercent: Number.isFinite(Number(v.deliveryFeePercent)) && Number(v.deliveryFeePercent) >= 0 && Number(v.deliveryFeePercent) <= 30 ? Math.round(Number(v.deliveryFeePercent) * 100) / 100 : STORE_DEFAULTS.deliveryFeePercent,
      sellerPackDays: Number.isInteger(v.sellerPackDays) && v.sellerPackDays >= 1 && v.sellerPackDays <= 60 ? v.sellerPackDays : STORE_DEFAULTS.sellerPackDays,
      feeMode: v.feeMode === 'flat' ? 'flat' : 'percent',
      goodsFeePercent: pctOr(v.goodsFeePercent, STORE_DEFAULTS.goodsFeePercent, 30),
      goodsFeeMin: dollarsOr(v.goodsFeeMin, STORE_DEFAULTS.goodsFeeMin),
      protectionFeePercent: pctOr(v.protectionFeePercent, STORE_DEFAULTS.protectionFeePercent, 20),
      protectionFeeMin: dollarsOr(v.protectionFeeMin, STORE_DEFAULTS.protectionFeeMin),
      autoReleasePickupDays: daysOr(v.autoReleasePickupDays, STORE_DEFAULTS.autoReleasePickupDays),
      autoReleaseDeliveryDays: daysOr(v.autoReleaseDeliveryDays, STORE_DEFAULTS.autoReleaseDeliveryDays),
      storeMinReturnDays: Number.isInteger(v.storeMinReturnDays) && v.storeMinReturnDays >= 0 && v.storeMinReturnDays <= 30 ? v.storeMinReturnDays : STORE_DEFAULTS.storeMinReturnDays, // v143
    };
  } catch (e) { /* keep the last known settings */ }
  return cached;
}
function storeSettingsCached() { return cached; }
async function saveStoreSettings(patch) {
  const cur = await storeSettings();
  const next = { ...cur, ...patch };
  const existing = await db.find('platformSettings', s => s.key === 'storeSettings');
  const row = { key: 'storeSettings', value: next, updatedAt: new Date().toISOString() };
  if (existing) await db.update('platformSettings', existing.id, row);
  else await db.insert('platformSettings', { id: 'ps_storeSettings', ...row });
  return storeSettings();
}
storeSettings().catch(() => {});

// v139: Trothen's fee on goods, and who pays it.
//   percent: a share of the goods total with a minimum, from the seller at
//            payout (never more than the goods came to). Buyer pays nothing extra.
//   flat:    the flat fee per purchase, paid by whoever the setting says.
function goodsFeeFor(goodsTotal, s) {
  s = s || cached;
  const total = money(goodsTotal || 0);
  if (!(total > 0)) return { fee: 0, paidBy: 'pro', mode: s.feeMode };
  if (s.feeMode === 'flat') return { fee: s.purchaseFee, paidBy: s.feePaidBy === 'pro' ? 'pro' : 'customer', mode: 'flat' };
  return { fee: Math.min(total, Math.max(s.goodsFeeMin, money(total * s.goodsFeePercent / 100))), paidBy: 'pro', mode: 'percent' };
}
// v139: the buyer's protection fee on a personal listing bought through Trothen.
function protectionFeeFor(price, s) {
  s = s || cached;
  const p = money(price || 0);
  if (!(p > 0)) return 0;
  return Math.max(s.protectionFeeMin, money(p * s.protectionFeePercent / 100));
}

// A good is on the shelf when a manager approved it, the pro hasn't
// hidden it, and it isn't sold out.
function isOnShelf(g) {
  return g.forSale !== false && g.status === 'approved' && g.hidden !== true;
}
function inStock(g, qty = 1, variantId) {
  const st = stockOf(g, variantId);
  return st === null || st >= qty;
}
// v162: a good with sizes or colours is in stock when any of them is. (Asking
// inStock() without choosing one always said "none", which hid every such
// good from the Market.)
function anyInStock(g) {
  if (Array.isArray(g.variants) && g.variants.length) return g.variants.some(v => v.stock === null || v.stock === undefined || v.stock > 0);
  return inStock(g, 1);
}

// v108: a manager approves the STORE itself (its name and what it says it
// sells), as well as each good. Stores made before this are 'pending'.
function storeApproval(user) {
  const a = user && user.store && user.store.approval;
  return a && ['approved', 'rejected', 'pending'].includes(a.status) ? a.status : 'pending';
}
// Why a store is not showing to customers, as one short code, or null when
// it is live. In the order a person would fix them.
function whyNotLive(user) {
  const s = user && user.store;
  if (!cached.enabled) return 'stores_off';
  if (!s || !s.name) return 'not_set_up';
  if (user.active === false || user.onHold === true) return 'account_paused';
  if (s.closedByAdmin === true) return 'closed_by_team';
  if (!user.verified) return 'id_not_verified';
  if (storeApproval(user) === 'rejected') return 'store_turned_down';
  if (storeApproval(user) !== 'approved') return 'store_waiting';
  if (!((s.liveGoods || 0) > 0)) return 'no_approved_goods';
  if (s.open !== true) return 'switched_off';
  return null;
}
const WHY_NOT_LIVE_WORDS = {
  stores_off: 'Stores are switched off for everyone',
  not_set_up: 'The store has no name yet',
  account_paused: 'The pro\'s account is paused or closed',
  closed_by_team: 'Closed by the Trothen team',
  id_not_verified: 'The pro\'s ID is not verified yet',
  store_turned_down: 'The store was turned down by a manager',
  store_waiting: 'Waiting for a manager to approve the store',
  no_approved_goods: 'No approved goods on the shelf yet',
  switched_off: 'The pro has switched the store off',
};
// The store is live (its name shows under the pro) when a manager approved
// it, the pro switched it on, a manager hasn't closed it, and at least one
// good is approved. A closed or paused account's store is never live.
function storeIsLive(user) {
  return whyNotLive(user) === null;
}

// v108: store options, read with safe defaults. A store with no options
// saved offers self pick-up and a pick-and-drop driver.
function storeOptions(user) {
  const o = (user && user.store && user.store.options) || {};
  let methods = Array.isArray(o.deliveryMethods) ? o.deliveryMethods.filter(m => DELIVERY_METHODS.includes(m)) : ['pickup', 'driver'];
  if (!methods.length) methods = ['pickup'];
  const fee = Number(o.deliveryFee);
  const loc = o.pickupLocation && typeof o.pickupLocation.latitude === 'number' && typeof o.pickupLocation.longitude === 'number' ? { latitude: o.pickupLocation.latitude, longitude: o.pickupLocation.longitude } : null;
  return {
    deliveryMethods: [...new Set(methods)],
    deliveryFee: Number.isFinite(fee) && fee >= 0 ? money(fee) : 0,
    pickupPlace: typeof o.pickupPlace === 'string' ? o.pickupPlace : '',
    pickupLocation: loc,
    hours: typeof o.hours === 'string' ? o.hours : '',
    orderNote: typeof o.orderNote === 'string' ? o.orderNote : '',
    returnPolicy: returnPolicyOf(o.returnPolicy), // v143
    deliveryPricing: o.deliveryPricing === 'distance' ? 'distance' : 'flat', // v143: the seller's delivery by distance (Trothen's per-km fares) or one flat charge
  };
}
// v143: a store's returns policy. Every store takes back faulty, wrong,
// damaged or not-as-described goods for at least the platform minimum.
// A store may give longer, and may accept change-of-mind returns.
function returnPolicyOf(p) {
  p = p || {};
  const min = cached.storeMinReturnDays;
  const days = Number.isInteger(p.days) && p.days >= 0 && p.days <= 30 ? Math.max(min, p.days) : min;
  return { days, changeOfMind: p.changeOfMind === true && days > 0, conditions: typeof p.conditions === 'string' ? p.conditions.slice(0, 300) : '', returnShipping: p.returnShipping === 'seller' ? 'seller' : 'buyer' };
}
function returnPolicyWords(p) {
  if (!p || !(p.days > 0)) return 'No returns after you confirm you have your goods. Check them when they arrive, and use "Report a Problem" before confirming if something is wrong.';
  return `${p.changeOfMind ? `Returns within ${p.days} days for any reason` : `Returns within ${p.days} days if an item is faulty, wrong, damaged or not as described`}, counted from the day you confirm you have it.${p.conditions ? ' ' + p.conditions : ''} ${p.returnShipping === 'seller' ? 'The seller pays to get it back.' : 'You bring or send it back at your own cost, unless the seller sent the wrong or a faulty item.'}`;
}

// v108: prices in more than one currency. A good is priced in US dollars
// or in the currency of the pro's own country. Money on Trothen is always
// held in US dollars, so a local price is turned into dollars with the
// exchange rate at the moment someone buys.
const { currencyForCountry } = require('./currency-data');
const { resolveRate } = require('./plan-pricing');
async function currenciesFor(user) {
  const local = currencyForCountry((user && user.country) || 'United States');
  const out = [{ code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 }];
  if (local.code !== 'USD') out.push({ code: local.code, symbol: local.symbol, name: local.name, rate: resolveRate(local.code, await db.all('exchangeRates')) });
  return out;
}
function usdFromLocal(amount, rate) { return money(Number(amount) / (rate > 0 ? rate : 1)); }
// v143: a sale (a percentage off, until an optional end date) and sizes or
// colours ("variants"), each of which may have its own price and stock.
function saleOn(g, now) {
  const p = Number(g && g.salePercent);
  if (!(p >= 1 && p <= 90)) return 0;
  if (g.saleEndsAt && Date.parse(g.saleEndsAt) <= (now || Date.now())) return 0;
  return p;
}
function variantOf(g, variantId) {
  return Array.isArray(g && g.variants) && variantId ? g.variants.find(v => v && v.id === variantId) || null : null;
}
// The full price of a good (or one of its variants) in its own currency, before any sale.
function listAmount(g, v) {
  if (v && Number(v.price) > 0) return Number(v.price);
  return g.priceCurrency && g.priceCurrency !== 'USD' && Number(g.priceLocal) > 0 ? Number(g.priceLocal) : Number(g.price);
}
const cutBy = (amount, pct) => money(amount * (1 - pct / 100));
// The price of a good in US dollars right now (with the sale, if one is on).
function goodUsdPrice(g, currencies, variantId) {
  return goodPriceFields(g, currencies, variantId).price;
}
function goodPriceFields(g, currencies, variantId) {
  const v = variantOf(g, variantId);
  const sale = saleOn(g);
  const full = listAmount(g, v);
  const now = sale ? cutBy(full, sale) : full;
  const c = g.priceCurrency && g.priceCurrency !== 'USD' ? (currencies || []).find(x => x.code === g.priceCurrency) : null;
  if (c && Number(g.priceLocal) > 0) {
    const out = { price: Math.max(0.01, usdFromLocal(now, c.rate)), priceCurrency: c.code, priceLocal: now, priceSymbol: c.symbol };
    if (sale) Object.assign(out, { salePercent: sale, wasPrice: Math.max(0.01, usdFromLocal(full, c.rate)), wasLocal: full, saleEndsAt: g.saleEndsAt || null });
    return out;
  }
  const out = { price: Math.max(0.01, money(now)), priceCurrency: 'USD', priceLocal: null, priceSymbol: '$' };
  if (sale) Object.assign(out, { salePercent: sale, wasPrice: money(full), saleEndsAt: g.saleEndsAt || null });
  return out;
}
// Stock of a good, or of the variant chosen when the good has variants.
function stockOf(g, variantId) {
  const v = variantOf(g, variantId);
  if (Array.isArray(g.variants) && g.variants.length) return v ? (v.stock === undefined ? null : v.stock) : 0;
  return g.stock === undefined ? null : g.stock;
}
function publicStore(user) {
  return storeIsLive(user) ? { name: user.store.name } : null;
}

// Keeps the count of approved goods on the pro's own record, so the
// public list of pros can show a store name without reading every good.
async function refreshStoreLive(providerId) {
  const user = await db.find('users', u => u.id === providerId);
  if (!user || !user.store) return;
  const goods = await db.filter('storeGoods', g => g.providerId === providerId);
  const liveGoods = goods.filter(isOnShelf).length;
  if ((user.store.liveGoods || 0) !== liveGoods) await db.update('users', providerId, { store: { ...user.store, liveGoods } });
}

// Prices a basket from the server's own records. Nothing the customer's
// browser says about names or prices is used: only which good and how many.
// Returns { items, total } or { error }.
// v140: opts.trade = the buyer is a verified pro, who pays the store's trade price where it has one.
async function priceBasket(providerId, rawItems, opts = {}) {
  if (rawItems === undefined || rawItems === null) return { items: [], total: 0 };
  if (!Array.isArray(rawItems)) return { error: 'The basket could not be read. Please pick your goods again.' };
  if (!rawItems.length) return { items: [], total: 0 };
  if (rawItems.length > MAX_LINES_PER_ORDER) return { error: `A booking can include at most ${MAX_LINES_PER_ORDER} different goods.` };
  const settings = await storeSettings();
  if (!settings.enabled) return { error: 'Stores are switched off at the moment, so goods can\'t be added to a booking.' };
  const provider = await db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider || !storeIsLive(provider)) return { error: 'This pro\'s store isn\'t open right now. Remove the goods to carry on with the booking.' };
  const goods = await db.filter('storeGoods', g => g.providerId === providerId);
  const currencies = await currenciesFor(provider); // v108
  const merged = new Map();
  for (const it of rawItems) {
    if (!it || typeof it.goodId !== 'string' || (it.variantId !== undefined && it.variantId !== null && typeof it.variantId !== 'string')) return { error: 'The basket could not be read. Please pick your goods again.' };
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return { error: `Choose a quantity between 1 and ${MAX_QTY_PER_LINE} for each good.` };
    const key = `${it.goodId}|${it.variantId || ''}`; // v143: each size or colour is its own line
    merged.set(key, (merged.get(key) || 0) + qty);
  }
  const items = [];
  for (const [key, qty] of merged) {
    const [goodId, variantRaw] = key.split('|'); const variantId = variantRaw || null;
    if (qty > MAX_QTY_PER_LINE) return { error: `Choose a quantity between 1 and ${MAX_QTY_PER_LINE} for each good.` };
    const g = goods.find(x => x.id === goodId);
    if (!g || !isOnShelf(g)) return { error: 'One of the goods you picked is no longer in the store. Open the store and pick again.' };
    const hasVariants = Array.isArray(g.variants) && g.variants.length > 0;
    const v = variantOf(g, variantId);
    if (hasVariants && !v) return { error: `Choose the ${g.variantName || 'option'} you want for "${g.name}".` };
    if (!hasVariants && variantId) return { error: 'One of the goods you picked has changed. Open the store and pick again.' };
    const label = v ? `${g.name} (${v.label})` : g.name;
    const st = stockOf(g, variantId);
    if (!inStock(g, qty, variantId)) return { error: st > 0 ? `Only ${st} of "${label}" left in the store.` : `"${label}" is sold out.` };
    const pf = goodPriceFields(g, currencies, variantId);
    // v109: a local-money good is worked out from the whole line in local
    // money, not from a unit price already rounded to cents. A ₦100 good
    // bought 99 times used to come to ₦9,207 instead of ₦9,900.
    const cur = pf.priceCurrency !== 'USD' ? currencies.find(x => x.code === pf.priceCurrency) : null;
    const lineTotal = cur ? Math.max(0.01, money(Number(pf.priceLocal) * qty / (cur.rate > 0 ? cur.rate : 1))) : money(pf.price * qty);
    const line = { goodId: g.id, name: label, unit: g.unit || null, unitPrice: pf.price, qty, lineTotal };
    if (v) { line.variantId = v.id; line.variantLabel = v.label; }
    if (pf.salePercent) { line.salePercent = pf.salePercent; line.wasUnitPrice = pf.wasPrice; }
    const tp = Number(g.tradePrice);
    if (opts.trade && !v && Number.isFinite(tp) && tp > 0 && tp < pf.price) { // v140: trade price for pros, in US dollars (not on a size or colour with its own price)
      line.unitPrice = money(tp); line.lineTotal = money(tp * qty); line.tradePrice = true; line.shelfUnitPrice = pf.price;
      items.push(line); continue;
    }
    // v108: a good priced in local money keeps that price on the order, next to the dollars charged.
    if (pf.priceCurrency !== 'USD') { line.priceCurrency = pf.priceCurrency; line.priceSymbol = pf.priceSymbol; line.unitPriceLocal = pf.priceLocal; line.lineTotalLocal = money(pf.priceLocal * qty); }
    items.push(line);
  }
  return { items, total: money(items.reduce((s, i) => s + i.lineTotal, 0)) };
}

// v143: changes the stock of a good, or of one size or colour of it, by
// delta (negative = sold). Returns { before, after } (null when not counted).
async function adjustStock(goodId, variantId, delta, soldDelta) {
  const g = await db.find('storeGoods', x => x.id === goodId);
  if (!g) return null;
  const patch = { sold: Math.max(0, (g.sold || 0) + (soldDelta || 0)) };
  let before = null, after = null, label = g.name;
  if (variantId && Array.isArray(g.variants) && g.variants.some(v => v.id === variantId)) {
    patch.variants = g.variants.map(v => {
      if (v.id !== variantId) return v;
      label = `${g.name} (${v.label})`;
      if (v.stock === null || v.stock === undefined) return v;
      before = v.stock; after = Math.max(0, v.stock + delta);
      return { ...v, stock: after };
    });
  } else if (g.stock !== null && g.stock !== undefined) {
    before = g.stock; after = Math.max(0, g.stock + delta); patch.stock = after;
  }
  await db.update('storeGoods', g.id, patch);
  if (before !== null && before === 0 && after > 0) { try { await notifyBackInStock(g.id); } catch (e) { /* the change still stands */ } }
  return { good: g, before, after, label };
}
// v143: people who saved a good and asked to be told are told when it's back.
async function notifyBackInStock(goodId) {
  const g = await db.find('storeGoods', x => x.id === goodId);
  if (!g || !isOnShelf(g)) return 0;
  const savers = await db.filter('savedGoods', s => s.goodId === goodId && s.notifyRestock === true && !s.notifiedAt);
  const owner = await db.find('users', u => u.id === g.providerId);
  const { notify } = require('./notify');
  for (const s of savers) {
    await notify(s.userId, '🔔', `"${g.name}" is back in stock${owner && owner.store && owner.store.name ? ` at ${owner.store.name}` : ''}.`, null, { section: 'saved' });
    await db.update('savedGoods', s.id, { notifiedAt: new Date().toISOString() });
  }
  return savers.length;
}
// Stock is held the moment a booking is made, so two customers can't
// both buy the last one, and given back if the booking doesn't go ahead.
async function holdStock(items) {
  for (const it of items || []) {
    const r = await adjustStock(it.goodId, it.variantId || null, -it.qty, it.qty);
    // v106: tell the pro when a sale takes a good down to its warning level.
    if (r && r.before !== null) {
      const warnAt = (r.good.lowStockAt === null || r.good.lowStockAt === undefined) ? 0 : r.good.lowStockAt;
      if (r.after <= warnAt && r.before > warnAt) {
        try { await require('./notify').notify(r.good.providerId, '📦', r.after === 0 ? `"${r.label}" is now sold out in your store.` : `"${r.label}" is running low: ${r.after} left.`, null, { section: 'store' }); } catch (e) { /* the sale still stands */ }
      }
    }
  }
}
// v110: reserve BEFORE charging. Two customers buying the last unit at the
// same moment used to both pass the "in stock" check, both get charged, and
// only then was stock taken off. Now the check and the take-off happen as one
// step behind a queue (one at a time), and the charge comes after. If the
// charge fails the stock is put straight back (releaseStock).
let reserveQueue = Promise.resolve();
function reserveStock(items) {
  const run = async () => {
    for (const it of items || []) {
      const g = await db.find('storeGoods', x => x.id === it.goodId);
      if (!g || !isOnShelf(g)) return { error: 'One of the goods you picked is no longer in the store. Open the store and pick again.' };
      if (!inStock(g, it.qty, it.variantId || null)) { const st = stockOf(g, it.variantId || null); return { error: st > 0 ? `Only ${st} of "${it.name || g.name}" left in the store.` : `"${it.name || g.name}" is sold out.` }; }
    }
    await holdStock(items);
    return { ok: true };
  };
  const result = reserveQueue.then(run, run);
  reserveQueue = result.catch(() => {});
  return result;
}
// Undo a reservation that never became an order (payment failed).
async function releaseStock(items) {
  for (const it of items || []) await adjustStock(it.goodId, it.variantId || null, it.qty, -it.qty);
}
async function giveBackStock(contract) {
  if (!contract || !Array.isArray(contract.storeItems) || !contract.storeItems.length) return false;
  const fresh = await db.find('contracts', c => c.id === contract.id);
  if (!fresh || fresh.storeStockHeld !== true || fresh.storeStockGivenBack === true) return false;
  // Goods already handed over stay sold; a refund after that is a dispute matter.
  const h = fresh.handover || {};
  if ((h.dropoff && h.dropoff.length) || (h.pickup && h.pickup.length)) return false;
  // v108: the same when a driver has already collected them.
  if (fresh.deliveryContractId) {
    const d = await db.find('contracts', c => c.id === fresh.deliveryContractId);
    const dh = (d && d.handover) || {};
    if ((dh.pickup && dh.pickup.length) || (dh.dropoff && dh.dropoff.length)) return false;
  }
  await db.update('contracts', fresh.id, { storeStockGivenBack: true });
  for (const it of fresh.storeItems) await adjustStock(it.goodId, it.variantId || null, it.qty, -it.qty);
  return true;
}

// Which of a pro's skills customers can find them under: the main one,
// plus every extra one a manager has approved (or that needed no check).
function approvedSkills(user) {
  const out = [];
  if (user && user.category) out.push(user.category);
  for (const s of (user && Array.isArray(user.extraSkills) ? user.extraSkills : [])) {
    if (s && s.status === 'approved' && s.category && !out.includes(s.category)) out.push(s.category);
  }
  return out;
}
function hasSkill(user, category) {
  return approvedSkills(user).includes(category);
}

module.exports = {
  goodsFeeFor, protectionFeeFor,
  STORE_DEFAULTS, DEFAULT_STORE_RULES, MAX_PHOTOS_PER_GOOD, MAX_QTY_PER_LINE, MAX_EXTRA_SKILLS, MAX_EXTRA_SKILLS_BUSINESS, maxExtraSkillsFor, money,
  storeSettings, storeSettingsCached, saveStoreSettings,
  isOnShelf, inStock, anyInStock, storeIsLive, publicStore, refreshStoreLive,
  DELIVERY_METHODS, DELIVERY_LABELS, DRIVER_SKILL, VEHICLES, VEHICLE_MAX_KM, storeApproval, whyNotLive, WHY_NOT_LIVE_WORDS, storeOptions,
  currenciesFor, usdFromLocal, goodUsdPrice, goodPriceFields,
  priceBasket, holdStock, reserveStock, releaseStock, giveBackStock,
  saleOn, variantOf, stockOf, adjustStock, notifyBackInStock, returnPolicyOf, returnPolicyWords, // v143
  approvedSkills, hasSkill,
};
