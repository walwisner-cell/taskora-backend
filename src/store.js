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
};
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
const MAX_EXTRA_SKILLS = 4;

const money = (n) => Math.round(Number(n) * 100) / 100;

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

// A good is on the shelf when a manager approved it, the pro hasn't
// hidden it, and it isn't sold out.
function isOnShelf(g) {
  return g.forSale !== false && g.status === 'approved' && g.hidden !== true;
}
function inStock(g, qty = 1) {
  return g.stock === null || g.stock === undefined || g.stock >= qty;
}

// The store is live (its name shows under the pro) when the pro opened
// it, a manager hasn't closed it, and at least one good is approved.
// A closed or paused account's store is never live.
function storeIsLive(user) {
  const s = user && user.store;
  return !!(cached.enabled && s && s.open === true && s.closedByAdmin !== true && s.name && (s.liveGoods || 0) > 0 && user.verified && user.active !== false && user.onHold !== true);
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
async function priceBasket(providerId, rawItems) {
  if (rawItems === undefined || rawItems === null) return { items: [], total: 0 };
  if (!Array.isArray(rawItems)) return { error: 'The basket could not be read. Please pick your goods again.' };
  if (!rawItems.length) return { items: [], total: 0 };
  if (rawItems.length > MAX_LINES_PER_ORDER) return { error: `A booking can include at most ${MAX_LINES_PER_ORDER} different goods.` };
  const settings = await storeSettings();
  if (!settings.enabled) return { error: 'Stores are switched off at the moment, so goods can\'t be added to a booking.' };
  const provider = await db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider || !storeIsLive(provider)) return { error: 'This pro\'s store isn\'t open right now. Remove the goods to carry on with the booking.' };
  const goods = await db.filter('storeGoods', g => g.providerId === providerId);
  const merged = new Map();
  for (const it of rawItems) {
    if (!it || typeof it.goodId !== 'string') return { error: 'The basket could not be read. Please pick your goods again.' };
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) return { error: `Choose a quantity between 1 and ${MAX_QTY_PER_LINE} for each good.` };
    merged.set(it.goodId, (merged.get(it.goodId) || 0) + qty);
  }
  const items = [];
  for (const [goodId, qty] of merged) {
    if (qty > MAX_QTY_PER_LINE) return { error: `Choose a quantity between 1 and ${MAX_QTY_PER_LINE} for each good.` };
    const g = goods.find(x => x.id === goodId);
    if (!g || !isOnShelf(g)) return { error: 'One of the goods you picked is no longer in the store. Open the store and pick again.' };
    if (!inStock(g, qty)) return { error: g.stock > 0 ? `Only ${g.stock} of "${g.name}" left in the store.` : `"${g.name}" is sold out.` };
    items.push({ goodId: g.id, name: g.name, unit: g.unit || null, unitPrice: g.price, qty, lineTotal: money(g.price * qty) });
  }
  return { items, total: money(items.reduce((s, i) => s + i.lineTotal, 0)) };
}

// Stock is held the moment a booking is made, so two customers can't
// both buy the last one, and given back if the booking doesn't go ahead.
async function holdStock(items) {
  for (const it of items || []) {
    const g = await db.find('storeGoods', x => x.id === it.goodId);
    if (g && g.stock !== null && g.stock !== undefined) {
      const left = Math.max(0, g.stock - it.qty);
      await db.update('storeGoods', g.id, { stock: left, sold: (g.sold || 0) + it.qty });
      // v106: tell the pro when a sale takes a good down to its warning level.
      const warnAt = (g.lowStockAt === null || g.lowStockAt === undefined) ? 0 : g.lowStockAt;
      if (left <= warnAt && g.stock > warnAt) {
        try { await require('./notify').notify(g.providerId, '📦', left === 0 ? `"${g.name}" is now sold out in your store.` : `"${g.name}" is running low: ${left} left.`, null, { section: 'store' }); } catch (e) { /* the sale still stands */ }
      }
    } else if (g) {
      await db.update('storeGoods', g.id, { sold: (g.sold || 0) + it.qty });
    }
  }
}
async function giveBackStock(contract) {
  if (!contract || !Array.isArray(contract.storeItems) || !contract.storeItems.length) return false;
  const fresh = await db.find('contracts', c => c.id === contract.id);
  if (!fresh || fresh.storeStockHeld !== true || fresh.storeStockGivenBack === true) return false;
  // Goods already handed over stay sold; a refund after that is a dispute matter.
  const h = fresh.handover || {};
  if ((h.dropoff && h.dropoff.length) || (h.pickup && h.pickup.length)) return false;
  await db.update('contracts', fresh.id, { storeStockGivenBack: true });
  for (const it of fresh.storeItems) {
    const g = await db.find('storeGoods', x => x.id === it.goodId);
    if (!g) continue;
    const patch = { sold: Math.max(0, (g.sold || 0) - it.qty) };
    if (g.stock !== null && g.stock !== undefined) patch.stock = g.stock + it.qty;
    await db.update('storeGoods', g.id, patch);
  }
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
  STORE_DEFAULTS, DEFAULT_STORE_RULES, MAX_PHOTOS_PER_GOOD, MAX_QTY_PER_LINE, MAX_EXTRA_SKILLS, money,
  storeSettings, storeSettingsCached, saveStoreSettings,
  isOnShelf, inStock, storeIsLive, publicStore, refreshStoreLive,
  priceBasket, holdStock, giveBackStock,
  approvedSkills, hasSkill,
};
