// v162: the shopping cart.
//
// Before, goods picked in a store were kept only in the open page: a refresh,
// closing the store, or opening Trothen on another phone lost them, and each
// store had its own basket with nothing showing what was in the others.
//
// The cart works the way Etsy, Jumia and Amazon's marketplace do it:
//   - One cart across every store, kept on the account (so on any device), and
//     kept in the browser for someone not signed in yet, then added to their
//     account when they sign in.
//   - Grouped by store, and checked out one store at a time: each store has
//     its own delivery, discount codes and held money (Etsy works this way).
//   - Each line shows today's price and stock. A price that went up or down
//     since it was added is pointed out once. A good that sold out or left the
//     shelf stays in the cart, marked, and is left out of checkout. An amount
//     above what's left is brought down to what's left.
//   - Lines can be saved for later, which keeps them out of the total.
//   - Stock is not held by the cart, only when an order is placed (as
//     everywhere): a cart is a list, not a promise.
//   - Goods leave the cart when they're ordered (on their own or with a
//     booking). Lines nobody has touched for 90 days are cleared.
//
// Private sellers' Market listings (one used item, with its own Buy button)
// are not cart goods, as on Jiji and Facebook Marketplace.

const db = require('./db');
const store = require('./store');

const MAX_LINES = 60;           // in the cart, saved ones included
const MAX_PER_STORE = 20;       // what one order can hold (store.priceBasket)
const MAX_QTY = store.MAX_QTY_PER_LINE; // 99
const STALE_MS = 90 * 86400e3;

const keyOf = (goodId, variantId) => `${goodId}::${variantId || ''}`;

// v164: one person's cart changes are made one at a time. Each change reads
// the whole cart and writes it back, so two at the same moment (two quick
// "Add to cart" taps in the Market, or two tabs) could each miss the other's
// good. Trothen runs as one server, so a queue per person is enough.
const queues = new Map();
function oneAtATime(userId, fn) {
  const prev = queues.get(userId) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  queues.set(userId, tail);
  tail.then(() => { if (queues.get(userId) === tail) queues.delete(userId); });
  return run;
}
const now = () => new Date().toISOString();

async function cartOf(userId) {
  let c = await db.find('carts', x => x.userId === userId);
  if (!c) return { id: null, userId, lines: [] };
  const fresh = (c.lines || []).filter(l => Date.now() - Date.parse(l.touchedAt || l.addedAt || 0) < STALE_MS);
  if (fresh.length !== (c.lines || []).length) { await db.update('carts', c.id, { lines: fresh, updatedAt: now() }); c = { ...c, lines: fresh }; }
  return c;
}
async function saveLines(cart, lines) {
  if (cart.id) { await db.update('carts', cart.id, { lines, updatedAt: now() }); return { ...cart, lines }; }
  const doc = { id: `cart_${cart.userId}`, userId: cart.userId, lines, createdAt: now(), updatedAt: now() };
  await db.insert('carts', doc);
  return doc;
}

// Everything about one good, as the cart needs it, or why it can't be bought.
async function goodState(providerId, goodId, variantId, buyer, cache) {
  cache = cache || new Map();
  if (!cache.has(providerId)) {
    const p = await db.find('users', u => u.id === providerId && u.role === 'provider');
    const live = !!(p && p.verified && store.storeIsLive(p));
    cache.set(providerId, { p, live, goods: live ? await db.filter('storeGoods', g => g.providerId === providerId) : [], currencies: live ? await store.currenciesFor(p) : [] });
  }
  const s = cache.get(providerId);
  if (!s.p) return { status: 'gone', why: 'This store is no longer on Trothen.' };
  if (!s.live) return { status: 'store_closed', why: 'This store is closed at the moment.', store: s.p };
  const g = s.goods.find(x => x.id === goodId);
  if (!g || !store.isOnShelf(g)) return { status: 'gone', why: 'No longer in the store.', store: s.p };
  const hasV = Array.isArray(g.variants) && g.variants.length > 0;
  const v = store.variantOf(g, variantId);
  if (hasV && !variantId) return { status: 'choose', why: `Choose the ${(g.variantName || 'option').toLowerCase()} you want first.`, store: s.p, good: g };
  if (hasV && !v) return { status: 'gone', why: 'This option is no longer sold.', store: s.p, good: g };
  if (!hasV && variantId) return { status: 'gone', why: 'This good has changed. Open the store and add it again.', store: s.p, good: g };
  const pf = store.goodPriceFields(g, s.currencies, variantId);
  let price = pf.price, trade = false;
  const tp = Number(g.tradePrice);
  if (buyer && buyer.role === 'provider' && buyer.verified === true && buyer.id !== providerId && !v && Number.isFinite(tp) && tp > 0 && tp < pf.price) { price = store.money(tp); trade = true; }
  const left = store.stockOf(g, variantId); // null when the seller doesn't count stock
  const status = left !== null && left !== undefined && left <= 0 ? 'sold_out' : 'ok';
  return { status, store: s.p, good: g, variant: v, price, trade, pf, left: left === undefined ? null : left };
}

// Add goods (or set how many). Returns { cart, notice } or { error, status }.
async function putNow(user, { providerId, goodId, variantId, qty, mode }) {
  if (!['customer', 'provider'].includes(user.role)) return { status: 403, error: 'The cart is for customer and pro accounts.' };
  if (typeof providerId !== 'string' || typeof goodId !== 'string' || (variantId != null && typeof variantId !== 'string')) return { status: 400, error: 'Choose a good from a store.' };
  const n = qty === undefined ? 1 : Number(qty);
  if (!Number.isInteger(n) || n < 0 || n > MAX_QTY) return { status: 400, error: `Choose an amount between 1 and ${MAX_QTY}.` };
  if (providerId === user.id) return { status: 400, error: 'You can\'t buy from your own store.' };
  const settings = await store.storeSettings();
  if (!settings.enabled) return { status: 400, error: 'Stores are switched off at the moment.' };
  const cart = await cartOf(user.id);
  const key = keyOf(goodId, variantId);
  const lines = cart.lines.slice();
  const i = lines.findIndex(l => l.key === key);
  const target = mode === 'set' ? n : ((i >= 0 && !lines[i].saved ? lines[i].qty : 0) + n);
  if (target === 0) { if (i >= 0) lines.splice(i, 1); return { cart: await saveLines(cart, lines) }; }
  const st = await goodState(providerId, goodId, variantId || null, user);
  if (st.status === 'choose') return { status: 400, code: 'CHOOSE_OPTION', error: st.why };
  if (st.status === 'gone' || st.status === 'store_closed') return { status: 400, error: st.why };
  if (st.status === 'sold_out') return { status: 400, error: 'That is sold out.' };
  let q = target, notice = null;
  if (st.left !== null && q > st.left) { q = st.left; notice = `Only ${st.left} left, so your cart has ${st.left}.`; }
  if (i < 0) {
    if (lines.length >= MAX_LINES) return { status: 400, error: `Your cart is full (${MAX_LINES} goods). Buy or remove some first.` };
    if (lines.filter(l => l.providerId === providerId && !l.saved).length >= MAX_PER_STORE) return { status: 400, error: `One order can hold up to ${MAX_PER_STORE} different goods from a store. Check out these first.` };
    lines.push({ key, providerId, goodId, variantId: variantId || null, qty: q, priceSeen: st.price, saved: false, addedAt: now(), touchedAt: now() });
  } else {
    if (lines[i].saved && lines.filter(l => l.providerId === providerId && !l.saved).length >= MAX_PER_STORE) return { status: 400, error: `One order can hold up to ${MAX_PER_STORE} different goods from a store. Check out these first.` };
    lines[i] = { ...lines[i], qty: q, saved: false, touchedAt: now() };
  }
  return { cart: await saveLines(cart, lines), notice };
}

async function removeNow(user, key) {
  const cart = await cartOf(user.id);
  return saveLines(cart, cart.lines.filter(l => l.key !== key));
}

async function setSavedNow(user, key, saved) {
  const cart = await cartOf(user.id);
  const l = cart.lines.find(x => x.key === key);
  if (!l) return { status: 404, error: 'That isn\'t in your cart any more.' };
  if (!saved && cart.lines.filter(x => x.providerId === l.providerId && !x.saved).length >= MAX_PER_STORE) return { status: 400, error: `One order can hold up to ${MAX_PER_STORE} different goods from a store. Check out the others first.` };
  return { cart: await saveLines(cart, cart.lines.map(x => x.key === key ? { ...x, saved: !!saved, touchedAt: now() } : x)) };
}

async function clearStoreNow(user, providerId) {
  const cart = await cartOf(user.id);
  return saveLines(cart, cart.lines.filter(l => l.providerId !== providerId || l.saved));
}

// A guest's cart (kept in their browser) joins their account when they sign
// in. Goods already in the account keep the larger amount.
async function mergeNow(user, incoming) {
  if (!Array.isArray(incoming)) return { status: 400, error: 'The cart could not be read.' };
  let skipped = 0, notice = null;
  for (const it of incoming.slice(0, MAX_LINES)) {
    if (!it || typeof it.goodId !== 'string' || typeof it.providerId !== 'string') { skipped++; continue; }
    const cart = await cartOf(user.id);
    const have = cart.lines.find(l => l.key === keyOf(it.goodId, it.variantId));
    const want = Math.max(Math.max(1, Math.floor(Number(it.qty)) || 1), have && !have.saved ? have.qty : 0);
    const r = await putNow(user, { providerId: it.providerId, goodId: it.goodId, variantId: it.variantId || null, qty: Math.min(MAX_QTY, want), mode: 'set' });
    if (r.error) skipped++; else if (r.notice) notice = r.notice;
  }
  return { cart: await cartOf(user.id), skipped, notice };
}

// What the cart page shows: lines grouped by store, with today's prices and
// stock, and the subtotal that store's checkout will start from.
async function viewNow(user) {
  const cart = await cartOf(user.id);
  const cache = new Map();
  const groups = new Map(); const saved = [];
  let changed = false;
  const lines = [];
  for (const l of cart.lines) {
    const st = await goodState(l.providerId, l.goodId, l.variantId, user, cache);
    const g = st.good, v = st.variant;
    const out = {
      key: l.key, providerId: l.providerId, goodId: l.goodId, variantId: l.variantId, qty: l.qty, saved: !!l.saved,
      name: g ? g.name : 'A good no longer sold', variantName: g && g.variantName || null, variantLabel: v ? v.label : null,
      photo: g && (g.photoUrls || [])[0] || null, unit: g && g.unit || null,
      status: st.status, why: st.why || null, left: st.left === undefined ? null : st.left,
      unitPrice: st.price != null ? st.price : null, trade: !!st.trade,
      salePercent: st.pf && st.pf.salePercent || null, wasUnitPrice: st.pf && st.pf.wasPrice || null,
      priceCurrency: st.pf && st.pf.priceCurrency !== 'USD' ? st.pf.priceCurrency : null, priceSymbol: st.pf && st.pf.priceSymbol || null, priceLocal: st.pf && st.pf.priceCurrency !== 'USD' ? st.pf.priceLocal : null,
      priceChange: null, reduced: null,
    };
    const next = { ...l };
    if (st.status === 'ok') {
      if (l.priceSeen != null && st.price != null && Math.abs(st.price - l.priceSeen) >= 0.01) { out.priceChange = { from: l.priceSeen, to: st.price, way: st.price > l.priceSeen ? 'up' : 'down' }; next.priceSeen = st.price; changed = true; }
      if (st.left !== null && l.qty > st.left && !l.saved) { out.reduced = { from: l.qty, to: st.left }; out.qty = st.left; next.qty = st.left; changed = true; }
      out.lineTotal = store.money(st.price * out.qty);
    }
    lines.push(next);
    if (l.saved) { saved.push(out); continue; }
    if (!groups.has(l.providerId)) {
      const p = st.store;
      groups.set(l.providerId, { providerId: l.providerId, storeName: p && p.store && p.store.name || 'Store', sellerName: p ? p.name : '', city: p && p.city || '', country: p && p.country || '', closed: st.status === 'store_closed' || !p, lines: [] });
    }
    groups.get(l.providerId).lines.push(out);
  }
  if (changed) await saveLines(cart, lines);
  // each store's subtotal, worked out exactly as its checkout will (sales,
  // trade prices and local money included)
  const stores = [];
  for (const gr of groups.values()) {
    const ok = gr.lines.filter(x => x.status === 'ok');
    let subtotal = 0, error = null;
    if (ok.length) {
      const priced = await store.priceBasket(gr.providerId, ok.map(x => ({ goodId: x.goodId, variantId: x.variantId || undefined, qty: x.qty })), { trade: user.role === 'provider' && user.verified === true });
      if (priced.error) error = priced.error; else subtotal = priced.total;
    }
    stores.push({ ...gr, subtotal, count: ok.reduce((s, x) => s + x.qty, 0), canCheckout: ok.length > 0 && !error, error, unavailable: gr.lines.length - ok.length });
  }
  const count = stores.reduce((s, x) => s + x.count, 0);
  return { stores, saved, count, subtotal: store.money(stores.reduce((s, x) => s + x.subtotal, 0)), limits: { lines: MAX_LINES, perStore: MAX_PER_STORE, qty: MAX_QTY } };
}

async function count(userId) {
  const c = await db.find('carts', x => x.userId === userId);
  return (c && c.lines || []).filter(l => !l.saved).reduce((s, l) => s + (l.qty || 0), 0);
}

// After an order (or a booking with goods) is placed: those goods leave the
// cart. Anything else from that store stays.
async function removeOrderedNow(userId, providerId, items) {
  try {
    const c = await db.find('carts', x => x.userId === userId);
    if (!c || !Array.isArray(items) || !items.length) return;
    const bought = new Set(items.map(i => keyOf(i.goodId, i.variantId)));
    const lines = (c.lines || []).filter(l => !(l.providerId === providerId && !l.saved && bought.has(l.key)));
    if (lines.length !== (c.lines || []).length) await db.update('carts', c.id, { lines, updatedAt: now() });
  } catch (e) { console.error('[cart] removeOrdered', e.message); }
}

const put = (user, a) => oneAtATime(user.id, () => putNow(user, a));
const remove = (user, key) => oneAtATime(user.id, () => removeNow(user, key));
const setSaved = (user, key, saved) => oneAtATime(user.id, () => setSavedNow(user, key, saved));
const clearStore = (user, providerId) => oneAtATime(user.id, () => clearStoreNow(user, providerId));
const merge = (user, incoming) => oneAtATime(user.id, () => mergeNow(user, incoming));
const view = (user) => oneAtATime(user.id, () => viewNow(user));
const removeOrdered = (userId, providerId, items) => oneAtATime(userId, () => removeOrderedNow(userId, providerId, items));

module.exports = { put, remove, setSaved, clearStore, merge, view, count, removeOrdered, keyOf, MAX_LINES, MAX_PER_STORE };
