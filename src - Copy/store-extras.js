// v143: what international marketplaces have that the store was missing.
//
//   Discount codes  A store's own codes: a percentage or an amount off the
//                   goods, with an optional minimum order, end date and
//                   number of uses. Each customer can use a code once.
//                   The seller gives the discount; Trothen's fee is worked
//                   out on what the customer actually pays.
//   Product reviews Stars and words for a good, only from someone who
//                   bought it (a completed order), once per order.
//   Returns         See returnables() and refundReturn() below, and the
//                   addresses in src/routes/orders.routes.js.
const db = require('./db');
const store = require('./store');
const money = store.money;

const MAX_CODES = 20;
const CODE_RX = /^[A-Z0-9]{3,16}$/;

function cleanDiscount(b, existing) {
  b = b || {};
  const code = String(b.code || '').trim().toUpperCase();
  if (!CODE_RX.test(code)) return { error: 'A code is 3 to 16 letters and numbers, like SAVE10' };
  const kind = b.kind === 'amount' ? 'amount' : 'percent';
  const value = Number(b.value);
  if (kind === 'percent' && !(value >= 1 && value <= 90)) return { error: 'A percentage off is 1 to 90' };
  if (kind === 'amount' && !(value > 0 && value <= 100000)) return { error: 'An amount off must be more than 0' };
  const minOrder = b.minOrder === undefined || b.minOrder === null || b.minOrder === '' ? 0 : Number(b.minOrder);
  if (!(minOrder >= 0 && minOrder <= 100000)) return { error: 'The minimum order must be 0 or more' };
  const maxUses = b.maxUses === undefined || b.maxUses === null || b.maxUses === '' ? null : Number(b.maxUses);
  if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= 100000)) return { error: 'The number of uses is a whole number, or blank for no limit' };
  let endsAt = null;
  if (b.endsAt) { const t = Date.parse(b.endsAt); if (!Number.isFinite(t) || t < Date.now()) return { error: 'The end date must be in the future' }; endsAt = new Date(t).toISOString(); }
  // Amounts are in the store's own money choice: US$ (Trothen holds dollars).
  return { discount: { code, kind, value: money(value), minOrder: money(minOrder), maxUses, endsAt, used: existing ? existing.used || 0 : 0, active: b.active !== false, createdAt: existing ? existing.createdAt : new Date().toISOString() } };
}

// What a code takes off this basket, or { error }.
async function applyDiscount(seller, code, goodsTotal, customerId) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { discount: 0 };
  const list = (seller && seller.store && Array.isArray(seller.store.discounts)) ? seller.store.discounts : [];
  const d = list.find(x => x.code === c);
  if (!d || d.active === false) return { error: `"${c}" isn't a code for this store.` };
  if (d.endsAt && Date.parse(d.endsAt) <= Date.now()) return { error: `The code ${c} has ended.` };
  if (d.maxUses !== null && d.maxUses !== undefined && (d.used || 0) >= d.maxUses) return { error: `The code ${c} has been used up.` };
  if (goodsTotal < (d.minOrder || 0)) return { error: `The code ${c} is for orders of $${Number(d.minOrder).toFixed(2)} or more.` };
  if (customerId && await db.find('contracts', o => o.storeOrder && o.customerId === customerId && o.providerId === seller.id && o.discountCode === c && !['cancelled', 'declined', 'expired'].includes(o.status))) return { error: `You've already used the code ${c} at this store.` };
  const off = d.kind === 'percent' ? money(goodsTotal * d.value / 100) : Math.min(goodsTotal, d.value);
  return { discount: Math.min(money(off), money(goodsTotal - 0.01)), code: c, label: d.kind === 'percent' ? `${d.value}% off` : `$${d.value.toFixed(2)} off` };
}
async function useDiscount(sellerId, code) {
  const seller = await db.find('users', u => u.id === sellerId);
  if (!seller || !seller.store || !Array.isArray(seller.store.discounts)) return;
  const discounts = seller.store.discounts.map(d => (d.code === code ? { ...d, used: (d.used || 0) + 1 } : d));
  await db.update('users', seller.id, { store: { ...seller.store, discounts } });
}

// Average stars per good, for the store and the Market.
async function ratingsFor(goodIds) {
  const want = new Set(goodIds);
  const rows = await db.filter('goodReviews', r => want.has(r.goodId) && r.hidden !== true);
  const out = {};
  for (const r of rows) { const o = out[r.goodId] || (out[r.goodId] = { sum: 0, count: 0 }); o.sum += r.stars; o.count += 1; }
  for (const k of Object.keys(out)) out[k] = { avg: Math.round(out[k].sum / out[k].count * 10) / 10, count: out[k].count };
  return out;
}

// ── RETURNS ─────────────────────────────────────────────────────────────
const OPEN_RETURN = ['requested', 'accepted', 'sent', 'escalated'];
const FAULT_REASONS = { faulty: 'Faulty or not working', wrong_item: 'Wrong item sent', damaged: 'Damaged', not_as_described: 'Not as described' };
const REASONS = { ...FAULT_REASONS, changed_mind: 'Changed my mind' };
const DAY = 24 * 3600 * 1000;
// Until when this completed order can be returned (ISO), or null.
function returnUntil(order) {
  const days = Number(order && order.returnPolicy && order.returnPolicy.days) || 0;
  if (!order || !order.storeOrder || order.status !== 'completed' || !order.completedAt || !(days > 0)) return null;
  return new Date(Date.parse(order.completedAt) + days * DAY).toISOString();
}
// Is the seller's money for this order waiting (open return, or still inside the return window)?
function returnHold(order) {
  if (!order || !order.storeOrder) return false;
  if (order.returnRequest && OPEN_RETURN.includes(order.returnRequest.status)) return true;
  const until = returnUntil(order);
  return !!(until && Date.parse(until) > Date.now() && !(order.returnRequest && ['refunded', 'declined_final'].includes(order.returnRequest.status)));
}

// Refunds the returned goods from the money Trothen still holds for the
// order (it isn't paid to the seller until the return window ends). Puts
// the goods back on the shelf when asked. Returns { refunded } or { error }.
async function refundReturn(order, restock) {
  const rr = order.returnRequest;
  const escrow = await db.find('escrowTransactions', e => e.contractId === order.id);
  if (!escrow) return { error: 'There is no payment on this order to refund.' };
  if (escrow.payoutId) return { error: 'This order has already been paid out to the seller, so the refund must be settled by the Trothen team.' };
  if (escrow.status === 'refunded') return { error: 'This order was already refunded.' };
  const amount = money(rr.amount);
  const remaining = money(escrow.amount - amount);
  const goodsLeft = money(Math.max(0, (escrow.storeGoodsAmount || order.storeGoodsTotal || 0) - amount));
  const fee = store.goodsFeeFor(goodsLeft, await store.storeSettings());
  if (remaining <= 0.009) {
    await db.update('escrowTransactions', escrow.id, { status: 'refunded', refundReason: 'returned goods' });
  } else {
    await db.update('escrowTransactions', escrow.id, {
      originalAmount: escrow.originalAmount || escrow.amount, refundedAmount: money((escrow.refundedAmount || 0) + amount), amount: remaining,
      storeGoodsAmount: goodsLeft, ...(fee.paidBy === 'pro' && escrow.storeFeeFromPro !== undefined ? { storeFeeFromPro: fee.fee } : {}),
    });
  }
  await db.update('contracts', order.id, { refundedAmount: money((order.refundedAmount || 0) + amount), returnRequest: { ...rr, status: 'refunded', refundedAt: new Date().toISOString(), restocked: !!restock } });
  if (restock) for (const it of rr.items) await store.adjustStock(it.goodId, it.variantId || null, it.qty, -it.qty);
  return { refunded: amount };
}

module.exports = { MAX_CODES, cleanDiscount, applyDiscount, useDiscount, ratingsFor, OPEN_RETURN, REASONS, FAULT_REASONS, returnUntil, returnHold, refundReturn, DAY };
