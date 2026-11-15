// v162: the shopping cart (see src/cart.js for how it works).
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const cart = require('../cart');

const requireBuyer = (req, res, next) => (['customer', 'provider'].includes(req.user && req.user.role) ? next() : res.status(403).json({ error: 'The cart is for customer and pro accounts.' }));
const me = (req) => db.find('users', u => u.id === req.user.sub);

// a few hundred changes a minute is far above any person tapping + and −
const rateLimit = require('express-rate-limit');
const cartLimiter = rateLimit({ windowMs: 60 * 1000, max: 240, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => (req.user && req.user.sub) || 'anon', validate: false, message: { error: 'Too many changes to your cart. Wait a moment and try again.' } });

async function answer(req, res, extra) {
  const user = await me(req);
  res.json({ ...(await cart.view(user)), ...(extra || {}) });
}

// GET /api/cart  -> { stores:[{providerId, storeName, lines:[...], subtotal, count, canCheckout}], saved:[...], count, subtotal }
router.get('/cart', requireAuth, requireBuyer, async (req, res) => answer(req, res));

// GET /api/cart/count  -> { count }  (for the cart icon)
router.get('/cart/count', requireAuth, requireBuyer, async (req, res) => res.json({ count: await cart.count(req.user.sub) }));

// POST /api/cart/items  { providerId, goodId, variantId?, qty?, mode?: 'add'|'set' }
router.post('/cart/items', requireAuth, requireBuyer, cartLimiter, async (req, res) => {
  const user = await me(req);
  if (!user || user.active === false || user.closedAt) return res.status(403).json({ error: 'Your account isn\'t open.' });
  const r = await cart.put(user, req.body || {});
  if (r.error) return res.status(r.status || 400).json({ error: r.error, code: r.code });
  return answer(req, res, { notice: r.notice || null });
});

// PATCH /api/cart/items/:key  { qty } or { saved: true|false }
router.patch('/cart/items/:key', requireAuth, requireBuyer, cartLimiter, async (req, res) => {
  const user = await me(req);
  const b = req.body || {};
  const [goodId, variantId] = String(req.params.key).split('::');
  if (typeof b.saved === 'boolean') {
    const r = await cart.setSaved(user, req.params.key, b.saved);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    return answer(req, res);
  }
  const existing = (await db.find('carts', c => c.userId === user.id) || { lines: [] }).lines.find(l => l.key === req.params.key);
  if (!existing) return res.status(404).json({ error: 'That isn\'t in your cart any more.' });
  const r = await cart.put(user, { providerId: existing.providerId, goodId, variantId: variantId || null, qty: b.qty, mode: 'set' });
  if (r.error) return res.status(r.status || 400).json({ error: r.error, code: r.code });
  return answer(req, res, { notice: r.notice || null });
});

// DELETE /api/cart/items/:key
router.delete('/cart/items/:key', requireAuth, requireBuyer, cartLimiter, async (req, res) => {
  await cart.remove(await me(req), req.params.key);
  return answer(req, res);
});

// DELETE /api/cart/stores/:providerId  (empties that store's goods, keeps saved ones)
router.delete('/cart/stores/:providerId', requireAuth, requireBuyer, cartLimiter, async (req, res) => {
  await cart.clearStore(await me(req), req.params.providerId);
  return answer(req, res);
});

// POST /api/cart/merge  { lines:[{providerId, goodId, variantId?, qty}] }  (a guest's cart, at sign-in)
router.post('/cart/merge', requireAuth, requireBuyer, cartLimiter, async (req, res) => {
  const user = await me(req);
  const r = await cart.merge(user, (req.body || {}).lines);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  return answer(req, res, { skipped: r.skipped, notice: r.notice || null });
});

module.exports = router;
