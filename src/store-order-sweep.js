// v110: a paid store order the seller never packs is refunded automatically.
// Without this the customer's money sat held forever. The window is the
// "sellerPackDays" store setting (default 7). Orders already packed, handed
// over, or with a driver who has collected them are never touched.
const db = require('./db');
const store = require('./store');
const { contractStatusLocks } = require('./contract-locks');

async function refundOne(order) {
  if (contractStatusLocks.has(order.id)) return false;
  contractStatusLocks.add(order.id);
  try {
    const fresh = await db.find('contracts', c => c.id === order.id);
    if (!fresh || fresh.status !== 'active' || fresh.readyAt) return false;
    const h = fresh.handover || {};
    if ((h.pickup && h.pickup.length) || (h.dropoff && h.dropoff.length)) return false;
    const escrow = await db.find('escrowTransactions', e => e.contractId === fresh.id);
    if (escrow && escrow.status === 'held') await db.update('escrowTransactions', escrow.id, { status: 'refunded' }); await require('./tokens').refundEscrow(escrow && escrow.id); // v115: tokens back
    const updated = await db.update('contracts', fresh.id, { status: 'cancelled', cancelReasonCategory: 'seller_no_response', cancelledByRole: 'system', protectedCancellation: false });
    await store.giveBackStock(fresh);
    try { await require('./store-orders').afterCancel(updated, null); } catch (e) { console.error('[store-order-sweep] after cancel:', e.message); }
    const { notify } = require('./notify');
    await notify(fresh.customerId, '↩️', `Your store order #${fresh.bookingNumber} wasn't packed in time, so it was cancelled and your money was refunded.`, 'bookingUpdates', { section: 'orders' });
    await notify(fresh.providerId, '⚠️', `Store order #${fresh.bookingNumber} was cancelled and refunded because it wasn't marked packed in time.`, 'bookingUpdates', { section: 'store' });
    return true;
  } finally {
    contractStatusLocks.delete(order.id);
  }
}

async function sweepUnpackedStoreOrders() {
  const { sellerPackDays } = await store.storeSettings();
  const cutoff = Date.now() - sellerPackDays * 24 * 60 * 60 * 1000;
  const orders = await db.filter('contracts', c => c.storeOrder === true && c.status === 'active' && !c.readyAt && new Date(c.createdAt).getTime() < cutoff);
  let n = 0;
  for (const o of orders) {
    try { if (await refundOne(o)) n++; } catch (e) { console.error('[store-order-sweep] one order failed:', o.id, e.message); }
  }
  return n;
}
module.exports = { sweepUnpackedStoreOrders, refundOne };
