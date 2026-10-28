// v113: the Driver Pass. A driver pays a flat price for a day, a week or a
// month. While a pass is active:
//   - rides carry no commission (the driver keeps the whole fare), and
//   - the driver may take cash rides (Trothen has nothing to collect per ride).
// Without a pass, digital rides pay the normal ride commission at payout.
//
// How the pass is paid for:
//   - If Liberian mobile money (MTN MoMo) is configured on the server and the
//     driver has a mobile-money number on file, a real collection request is
//     made. MoMo is asynchronous: "accepted" is not "paid", exactly as for
//     ride payments, so the record says paymentStatus "requested".
//   - Otherwise it is recorded as "simulated", like every other payment in the
//     app until real payments are switched on.
// Passes stack: buying another while one is running starts it when the first ends.
const db = require('./db');
const { nanoid } = require('nanoid');
const { getSetting } = require('./platform-settings');
const { notify } = require('./notify');

const DAY = 24 * 60 * 60 * 1000;
const money = (n) => Math.round(Number(n) * 100) / 100;
const inFlight = new Set();

function cleanPlan(p) {
  return p && typeof p.id === 'string' && /^[a-z0-9_-]{2,20}$/.test(p.id) && typeof p.label === 'string' && p.label.trim().length >= 2 && p.label.length <= 30
    && Number.isInteger(p.days) && p.days >= 1 && p.days <= 366 && typeof p.priceUsd === 'number' && p.priceUsd >= 0.5 && p.priceUsd <= 1000;
}
async function plans() {
  const list = await getSetting('ridePassPlans');
  return Array.isArray(list) ? list.filter(cleanPlan).map(p => ({ id: p.id, label: p.label.trim(), days: p.days, priceUsd: money(p.priceUsd) })) : [];
}
const isActive = (p, at) => new Date(p.startsAt).getTime() <= at && at < new Date(p.endsAt).getTime();
async function passesOf(userId) { return (await db.filter('ridePasses', p => p.userId === userId)).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))); }
async function activePass(userId, at = Date.now()) { return (await passesOf(userId)).find(p => isActive(p, at)) || null; }

async function summary(userId) {
  const all = await passesOf(userId), now = Date.now();
  const active = all.find(p => isActive(p, now)) || null;
  const lastEnd = all.length ? Math.max(...all.map(p => new Date(p.endsAt).getTime())) : null;
  const queued = all.filter(p => new Date(p.startsAt).getTime() > now);
  return {
    active: active ? { label: active.label, endsAt: active.endsAt, hoursLeft: Math.max(0, Math.round((new Date(active.endsAt).getTime() - now) / 3600000)) } : null,
    coveredUntil: lastEnd && lastEnd > now ? new Date(lastEnd).toISOString() : null,
    queued: queued.map(p => ({ label: p.label, startsAt: p.startsAt, endsAt: p.endsAt })),
    history: all.slice(-5).reverse().map(p => ({ label: p.label, priceUsd: p.priceUsd, startsAt: p.startsAt, endsAt: p.endsAt, paymentStatus: p.paymentStatus })),
  };
}

async function buy(driver, planId, expectedPrice) {
  if ((await getSetting('ridePassEnabled')) === false) return { status: 403, error: 'Driver passes are not on right now.' };
  const plan = (await plans()).find(p => p.id === planId);
  if (!plan) return { status: 400, error: 'Choose one of the passes on the list.' };
  if (expectedPrice === undefined || Math.abs(Number(expectedPrice) - plan.priceUsd) > 0.009) return { status: 409, code: 'PRICE_CHANGED', price: plan.priceUsd, error: `The ${plan.label} now costs $${plan.priceUsd.toFixed(2)}. Check it and confirm again.` };
  if (inFlight.has(driver.id)) return { status: 409, error: 'Your purchase is already being processed. Please wait a moment.' };
  inFlight.add(driver.id);
  try {
    const id = `rp_${nanoid(10)}`;
    let paymentRef = null, paymentStatus = 'simulated';
    // v118: a driver who chose "pay for driver passes with tokens" pays from
    // tokens when the balance covers the whole price; otherwise as before.
    const tokens = require('./tokens');
    if (tokens.autopayOf(driver).pass && (await tokens.settingsFor(driver.country)).enabled) {
      try { await tokens.spend(driver.id, plan.priceUsd, `pass:${id}`, plan.label); paymentStatus = 'tokens'; }
      catch (e) { if (e.code !== 'TOKENS_SHORT') throw e; }
    }
    if (paymentStatus !== 'tokens' && driver.country === 'Liberia') {
      const { isLiberiaMoMoConfigured, requestMobileMoneyCollection } = require('./liberia-momo');
      if (isLiberiaMoMoConfigured()) {
        const method = await db.find('paymentMethods', m => m.userId === driver.id && m.isDefault && m.type === 'mobile_money');
        if (!method) return { status: 400, code: 'ADD_MOMO', error: 'Add a mobile money number in your payment methods first, then buy the pass.' };
        const r = await requestMobileMoneyCollection(method.mobileMoneyNumber, plan.priceUsd, id, null);
        if (!r.success) return { status: 402, code: 'PAYMENT_FAILED', error: `Your payment could not be started: ${r.message}. You were not charged.` };
        paymentRef = r.referenceId; paymentStatus = 'requested';
      }
    }
    const all = await passesOf(driver.id);
    const lastEnd = all.length ? Math.max(...all.map(p => new Date(p.endsAt).getTime())) : 0;
    const start = Math.max(Date.now(), lastEnd);
    const row = { id, userId: driver.id, planId: plan.id, label: plan.label, days: plan.days, priceUsd: plan.priceUsd, startsAt: new Date(start).toISOString(), endsAt: new Date(start + plan.days * DAY).toISOString(), paymentRef, paymentStatus, createdAt: new Date().toISOString() };
    try { await db.insert('ridePasses', row); }
    catch (e) { if (paymentStatus === 'tokens') await tokens.refundRef(`pass:${id}`, 'the pass could not be saved'); throw e; }
    const later = start > Date.now() + 1000;
    await notify(driver.id, '🎟️', `Your ${plan.label} is ${later ? 'booked. It starts when your current pass ends' : 'active'} and runs until ${row.endsAt.slice(0, 16).replace('T', ' ')} UTC. You keep the whole fare on every ride while it runs.`, 'bookingUpdates', { section: 'rides' });
    return { ok: true, pass: row };
  } finally { inFlight.delete(driver.id); }
}

async function stats() {
  const since = Date.now() - 30 * DAY, now = Date.now();
  const all = await db.all('ridePasses');
  const recent = all.filter(p => new Date(p.createdAt).getTime() >= since);
  return {
    activeDrivers: new Set(all.filter(p => isActive(p, now)).map(p => p.userId)).size,
    soldLast30Days: recent.length,
    revenueLast30Days: money(recent.reduce((s, p) => s + (p.priceUsd || 0), 0)),
    recent: all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10).map(p => ({ id: p.id, userId: p.userId, label: p.label, priceUsd: p.priceUsd, createdAt: p.createdAt, endsAt: p.endsAt, paymentStatus: p.paymentStatus })),
  };
}
module.exports = { plans, cleanPlan, activePass, summary, buy, stats, passesOf };
