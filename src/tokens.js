// v115: Trothen Tokens — a prepaid balance customers can buy and spend.
//
// How it works, in plain words:
//   - 1 token is always worth US$1.00 when it is spent (shown in the
//     customer's own currency too). Packs can include bonus tokens, so a
//     bigger pack is better value. The token value itself never changes,
//     so nobody's balance is ever worth less tomorrow than today.
//   - A customer can spend tokens two ways at checkout:
//       "tokens"      – pay the whole booking (job + Trothen fee) with tokens
//       "tokens_fee"  – pay only the Trothen fee with tokens, and the job
//                       price the normal way
//   - Tokens are taken BEFORE anything is booked (the same "charge first"
//     rule every other payment follows since v110). Not enough tokens means
//     nothing is booked and nothing is taken.
//   - When a booking paid with tokens is refunded (cancelled, declined,
//     expired, refunded in a dispute, or the refunded part of a split),
//     the tokens go back to the customer's balance automatically — once,
//     and never more than were taken.
//   - Every change is a line in the "tokenLedger" collection. The balance
//     is the sum of a person's ledger lines; users.tokenBalance is only a
//     copy for showing on screen.
//   - Buying tokens is simulated like every other payment in the app until
//     real payments are switched on. With Liberian mobile money (MTN MoMo)
//     configured, a real collection request is made and the tokens are only
//     added once MTN says the payment succeeded.
const db = require('./db');
const { nanoid } = require('nanoid');
const { getSetting } = require('./platform-settings');
const { notify } = require('./notify');

const money = (n) => Math.round(Number(n) * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;
const PAY_WITH = ['tokens', 'tokens_fee'];

function cleanPayWith(v) { return PAY_WITH.includes(v) ? v : null; }

// ── per-customer lock: two spends (or a spend and a refund) for the same
// person are done one after the other, never at the same time, so a
// balance can't be spent twice by two quick taps.
const locks = new Map();
function withUserLock(userId, fn) {
  const prev = locks.get(userId) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(userId, tail);
  tail.then(() => { if (locks.get(userId) === tail) locks.delete(userId); });
  return run;
}

// An error the page can show as it is (see the error handler in server.js).
function tokenError(status, code, message, extra) {
  const e = new Error(message);
  e.status = status; e.code = code; e.expose = true; e.extra = extra || {};
  return e;
}

// ── settings ────────────────────────────────────────────────────────────
function cleanPack(p) {
  return !!p && typeof p.id === 'string' && /^[a-z0-9_-]{2,20}$/.test(p.id)
    && typeof p.label === 'string' && p.label.trim().length >= 2 && p.label.trim().length <= 30
    && typeof p.priceUsd === 'number' && p.priceUsd >= 0.5 && p.priceUsd <= 1000
    && typeof p.tokens === 'number' && p.tokens >= p.priceUsd && p.tokens <= 2000;
}
// A pack can be priced in US dollars (the local price is then worked out
// from the exchange rate and rounded to a sensible amount) or, per
// country, given a fixed local price (localPrice, in that country's money)
// so people see a round, stable number like L$950 or ₦7,500.
function cleanCountryPack(p) {
  if (!p || typeof p.id !== 'string' || !/^[a-z0-9_-]{2,20}$/.test(p.id)) return false;
  if (typeof p.label !== 'string' || p.label.trim().length < 2 || p.label.trim().length > 30) return false;
  if (typeof p.tokens !== 'number' || p.tokens < 0.5 || p.tokens > 2000) return false;
  const hasUsd = typeof p.priceUsd === 'number' && p.priceUsd >= 0.5 && p.priceUsd <= 1000;
  const hasLocal = p.localPrice === undefined || p.localPrice === null || (typeof p.localPrice === 'number' && p.localPrice > 0 && p.localPrice <= 100000000);
  return hasUsd && hasLocal && p.tokens >= p.priceUsd;
}

// Rounds a local price to an amount people actually pay with: whole
// tens of Liberian dollars, fifties of naira, half-cedis, and so on.
const ROUND_STEP = { LRD: 10, NGN: 50, GHS: 0.5, KES: 10, UGX: 500, TZS: 500, RWF: 50, ZMW: 1, ZAR: 1, XOF: 50, XAF: 50, SLL: 500, SLE: 1, GMD: 5, ETB: 5, EGP: 1, MAD: 1 };
function niceLocal(amount, code) {
  const step = ROUND_STEP[code] || 0.01;
  const v = Math.round(amount / step) * step;
  return step >= 1 ? Math.round(v) : money(v);
}

async function settings() {
  const packs = await getSetting('tokenPacks');
  const rules = await getSetting('tokenCountryRules');
  const countries = await getSetting('tokenCountries');
  return {
    enabled: (await getSetting('tokensEnabled')) !== false,
    feeOnlyEnabled: (await getSetting('tokensFeeOnlyEnabled')) !== false,
    maxBalance: Number(await getSetting('tokenMaxBalance')) || 500,
    dailyLimitUsd: Number(await getSetting('tokenDailyLimitUsd')) || 200,
    countries: Array.isArray(countries) && countries.length ? countries : null, // null = every country
    countryRules: rules && typeof rules === 'object' ? rules : {},
    packs: Array.isArray(packs) ? packs.filter(cleanPack).map(p => ({ id: p.id, label: p.label.trim(), priceUsd: money(p.priceUsd), tokens: money(p.tokens), bonus: money(p.tokens - p.priceUsd) })) : [],
  };
}

// Everything that applies to one customer's country: on or off, limits,
// and the packs with the exact local amount they will be charged.
async function settingsFor(country) {
  const s = await settings();
  const { currencyForCountry } = require('./currency-data');
  const { resolveRate } = require('./plan-pricing');
  const cur = currencyForCountry(country || 'United States');
  const rate = cur.code === 'USD' ? 1 : resolveRate(cur.code, await db.all('exchangeRates'));
  const rule = (country && s.countryRules[country]) || {};
  const countryOn = !s.countries || s.countries.includes(country);
  const basePacks = Array.isArray(rule.packs) && rule.packs.filter(cleanCountryPack).length ? rule.packs.filter(cleanCountryPack) : s.packs;
  const packs = basePacks.map(p => {
    const fixed = cur.code !== 'USD' && typeof p.localPrice === 'number' && p.localPrice > 0;
    const priceLocal = cur.code === 'USD' ? null : (fixed ? p.localPrice : niceLocal(p.priceUsd * rate, cur.code));
    // What the customer is really charged, in dollars, at today's rate.
    const chargedUsd = cur.code === 'USD' ? money(p.priceUsd) : money(priceLocal / rate);
    return { id: p.id, label: String(p.label).trim(), tokens: money(p.tokens), bonus: money(Math.max(0, p.tokens - p.priceUsd)), priceUsd: chargedUsd, listUsd: money(p.priceUsd), priceLocal, fixedLocal: fixed };
  });
  return {
    enabled: s.enabled && countryOn && rule.enabled !== false,
    feeOnlyEnabled: s.feeOnlyEnabled,
    maxBalance: Number(rule.maxBalance) || s.maxBalance,
    dailyLimitUsd: Number(rule.dailyLimitUsd) || s.dailyLimitUsd,
    currency: cur, rate,
    packs,
  };
}

// ── balance and history ─────────────────────────────────────────────────
async function ledgerOf(userId) {
  return (await db.filter('tokenLedger', l => l.userId === userId)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
async function balance(userId) {
  return money((await ledgerOf(userId)).reduce((s, l) => s + (Number(l.tokens) || 0), 0));
}
// Writes one ledger line and keeps the on-screen copy in step. Must be
// called inside withUserLock for that person.
async function addLine(userId, line) {
  const before = await balance(userId);
  const after = money(before + line.tokens);
  const row = { id: `tkl_${nanoid(10)}`, userId, ...line, tokens: money(line.tokens), balanceAfter: after, createdAt: new Date().toISOString() };
  await db.insert('tokenLedger', row);
  try { await db.update('users', userId, { tokenBalance: after }); } catch (e) { /* the ledger is what counts */ }
  return row;
}

const KIND_WORDS = {
  purchase: 'Bought tokens',
  spend: 'Paid with tokens',
  refund: 'Tokens given back',
  admin_add: 'Added by Trothen',
  admin_remove: 'Removed by Trothen',
};
function publicLine(l) {
  return { id: l.id, kind: l.kind, what: KIND_WORDS[l.kind] || l.kind, tokens: l.tokens, balanceAfter: l.balanceAfter, bookingNumber: l.bookingNumber || null, note: l.note || null, packLabel: l.packLabel || null, priceUsd: l.priceUsd ?? null, priceLocal: l.priceLocal ?? null, currency: l.currency || null, reference: l.purchaseId || null, createdAt: l.createdAt };
}

// ── buying ──────────────────────────────────────────────────────────────
const buyInFlight = new Set();
const DAY_MS = 24 * 60 * 60 * 1000;

// Shared checks for any way of adding bought tokens (in the app, or a cash
// or manual mobile-money top-up recorded by staff).
async function purchaseChecks(customer, s, tokensToAdd, usd) {
  if (!s.enabled) return { status: 403, error: 'Tokens are not available in your country right now.' };
  if (!customer || customer.role !== 'customer') return { status: 403, error: 'Only customer accounts can buy tokens.' };
  if (customer.onHold) return { status: 403, error: 'This account is paused for a quick review, so tokens can\'t be added right now.' };
  if (customer.verified !== true) return { status: 403, code: 'VERIFY_IDENTITY', error: 'Please verify your identity first. Tokens are a stored balance, so we need to know who holds it.' };
  const have = await balance(customer.id);
  const recent = await db.filter('tokenPurchases', p => p.userId === customer.id && ['paid', 'requested'].includes(p.status) && Date.now() - new Date(p.createdAt).getTime() < DAY_MS);
  const pendingTokens = recent.filter(p => p.status === 'requested').reduce((t, p) => t + p.tokens, 0);
  if (have + pendingTokens + tokensToAdd > s.maxBalance + 0.001) {
    return { status: 400, code: 'OVER_LIMIT', error: `A balance can hold up to ${s.maxBalance} tokens. ${customer.name ? 'This account has' : 'You have'} ${money(have + pendingTokens)}, so this would go over. Spend some first or pick a smaller pack.` };
  }
  const spentToday = recent.reduce((t, p) => t + (p.priceUsd || 0), 0);
  if (spentToday + usd > s.dailyLimitUsd + 0.001) {
    return { status: 400, code: 'DAILY_LIMIT', error: `Tokens worth up to $${s.dailyLimitUsd} can be bought in 24 hours. $${money(spentToday)} has been bought already, so this would go over. Try a smaller pack, or again tomorrow.` };
  }
  return { ok: true, recentCount: recent.length };
}

// Several purchases in a day is unusual: tell the team (never blocks).
async function velocityCheck(customer, recentCount) {
  if (recentCount + 1 < 4) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const already = await db.find('fraudFlags', f => f.type === 'token_purchase_velocity' && f.userId === customer.id && String(f.createdAt).slice(0, 10) === today);
    if (already) return;
    // medium: a person reviews it; the account is not paused automatically
    await require('./fraud-detection').createFlag({ type: 'token_purchase_velocity', severity: 'medium', userId: customer.id, details: `${customer.name || customer.id} has bought tokens ${recentCount + 1} times in 24 hours. Check the payments are genuinely theirs (a stolen phone or mobile money account is the usual cause).` });
  } catch (e) { /* never block a purchase on this */ }
}

// requestId: made by the page once per purchase attempt. If the network
// drops and the page sends the same purchase again, the first one is
// returned instead of charging twice.
async function buy(customer, packId, expectedPrice, requestId) {
  if (!customer || customer.role !== 'customer') return { status: 403, error: 'Only customer accounts can buy tokens.' };
  const rid = typeof requestId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(requestId) ? requestId : null;
  if (rid) {
    const same = await db.find('tokenPurchases', p => p.userId === customer.id && p.requestId === rid);
    if (same) return { ok: true, purchase: same, repeated: true };
  }
  const s = await settingsFor(customer.country);
  const pack = s.packs.find(p => p.id === packId);
  if (!s.enabled) return { status: 403, error: 'Tokens are not available in your country right now.' };
  if (!pack) return { status: 400, error: 'Choose one of the packs on the list.' };
  const shown = pack.priceLocal != null ? pack.priceLocal : pack.priceUsd;
  if (expectedPrice === undefined || Math.abs(Number(expectedPrice) - shown) > 0.009) {
    return { status: 409, code: 'PRICE_CHANGED', price: shown, error: `The ${pack.label} pack now costs ${pack.priceLocal != null ? `${s.currency.symbol}${pack.priceLocal.toLocaleString()}` : `$${pack.priceUsd.toFixed(2)}`}. Check it and confirm again.` };
  }
  if (buyInFlight.has(customer.id)) return { status: 409, error: 'Your purchase is already being processed. Please wait a moment.' };
  buyInFlight.add(customer.id);
  try {
    const chk = await purchaseChecks(customer, s, pack.tokens, pack.priceUsd);
    if (!chk.ok) return chk;
    const id = `tkp_${nanoid(10)}`;
    let paymentRef = null, status = 'paid', paymentStatus = 'simulated';
    if (customer.country === 'Liberia') {
      const { isLiberiaMoMoConfigured, requestMobileMoneyCollection } = require('./liberia-momo');
      if (isLiberiaMoMoConfigured()) {
        const method = await db.find('paymentMethods', m => m.userId === customer.id && m.isDefault && m.type === 'mobile_money');
        if (!method) return { status: 400, code: 'ADD_MOMO', error: 'Add a mobile money number in Payments first, then buy tokens.' };
        // Charge exactly the local amount shown (L$), not a re-converted figure.
        const r = await requestMobileMoneyCollection(method.mobileMoneyNumber, pack.priceLocal != null ? pack.priceLocal / s.rate : pack.priceUsd, id, s.rate);
        if (!r.success) return { status: 402, code: 'PAYMENT_FAILED', error: `Your payment could not be started: ${r.message}. You were not charged.` };
        paymentRef = r.referenceId; status = 'requested'; paymentStatus = 'requested';
      }
    }
    const purchase = { id, requestId: rid, userId: customer.id, packId: pack.id, packLabel: pack.label, priceUsd: pack.priceUsd, priceLocal: pack.priceLocal, currency: s.currency.code, tokens: pack.tokens, bonus: pack.bonus, method: 'app', status, paymentStatus, paymentRef, createdAt: new Date().toISOString() };
    await db.insert('tokenPurchases', purchase);
    if (status === 'paid') await creditPurchase(purchase);
    else await notify(customer.id, '🪙', `Approve the payment of ${pack.priceLocal != null ? `${s.currency.symbol}${pack.priceLocal.toLocaleString()}` : `$${pack.priceUsd.toFixed(2)}`} on your phone. Your ${pack.tokens} tokens are added as soon as MTN confirms it. Reference: ${id}.`, null, { section: 'tokens' });
    await velocityCheck(customer, chk.recentCount);
    return { ok: true, purchase };
  } finally { buyInFlight.delete(customer.id); }
}

// A top-up paid outside the app (cash at an office or agent, a bank
// deposit, or mobile money sent to Trothen's own number), recorded by
// staff. Tokens are worked out from what was paid; staff can't type in a
// number of tokens here. The receipt or transaction number must be new,
// so the same payment can never be recorded twice.
const OFFLINE_METHODS = { cash: 'Cash', agent: 'Trothen agent', bank: 'Bank deposit', mobile_money: 'Mobile money to Trothen' };
async function recordOfflineTopUp(admin, { userId, packId, amountPaid, method, receipt, note }) {
  const customer = await db.find('users', u => u.id === userId && u.role === 'customer');
  if (!customer) return { status: 404, error: 'Customer not found.' };
  if (!OFFLINE_METHODS[method]) return { status: 400, error: 'Choose how they paid: cash, agent, bank deposit or mobile money.' };
  const rc = typeof receipt === 'string' ? receipt.trim() : '';
  if (rc.length < 3 || rc.length > 60) return { status: 400, error: 'Enter the receipt or transaction number (3 to 60 characters).' };
  if (await db.find('tokenPurchases', p => p.receipt && p.receipt.toLowerCase() === rc.toLowerCase() && p.method === method)) return { status: 409, error: `Receipt ${rc} has already been recorded. The same payment can't be added twice.` };
  const s = await settingsFor(customer.country);
  let tokensToAdd, usd, local = null, label, bonus = 0;
  if (packId) {
    const pack = s.packs.find(p => p.id === packId);
    if (!pack) return { status: 400, error: 'Choose one of the packs on the list.' };
    tokensToAdd = pack.tokens; usd = pack.priceUsd; local = pack.priceLocal; label = pack.label; bonus = pack.bonus;
  } else {
    const paid = Number(amountPaid);
    if (!Number.isFinite(paid) || paid <= 0) return { status: 400, error: `Enter the amount paid in ${s.currency.code}, or choose a pack.` };
    usd = s.currency.code === 'USD' ? money(paid) : money(paid / s.rate);
    local = s.currency.code === 'USD' ? null : paid;
    tokensToAdd = Math.floor(usd * 100) / 100; // no bonus on a custom amount
    if (tokensToAdd < 0.5) return { status: 400, error: 'That amount is too small to turn into tokens.' };
    label = 'Custom amount';
  }
  const chk = await purchaseChecks(customer, s, tokensToAdd, usd);
  if (!chk.ok) return chk;
  const purchase = { id: `tkp_${nanoid(10)}`, userId: customer.id, packId: packId || null, packLabel: `${label} (${OFFLINE_METHODS[method]})`, priceUsd: usd, priceLocal: local, currency: s.currency.code, tokens: tokensToAdd, bonus, method, receipt: rc, note: typeof note === 'string' ? note.trim().slice(0, 200) : null, recordedBy: admin.id, recordedByName: admin.name, status: 'paid', paymentStatus: method, createdAt: new Date().toISOString() };
  await db.insert('tokenPurchases', purchase);
  const line = await creditPurchase(purchase);
  await velocityCheck(customer, chk.recentCount);
  return { ok: true, purchase, line };
}

async function creditPurchase(purchase) {
  return withUserLock(purchase.userId, async () => {
    // once per purchase, however many times this is reached
    if (await db.find('tokenLedger', l => l.purchaseId === purchase.id)) return null;
    const line = await addLine(purchase.userId, { kind: 'purchase', tokens: purchase.tokens, purchaseId: purchase.id, packLabel: purchase.packLabel, priceUsd: purchase.priceUsd, priceLocal: purchase.priceLocal ?? null, currency: purchase.currency || 'USD', bonus: purchase.bonus || 0, paymentStatus: purchase.paymentStatus, note: purchase.receipt ? `Receipt ${purchase.receipt}` : null, actorName: purchase.recordedByName || null });
    await db.update('tokenPurchases', purchase.id, { status: 'paid', creditedAt: new Date().toISOString() });
    await notify(purchase.userId, '🪙', `${purchase.tokens} tokens added${purchase.bonus > 0 ? ` (including ${purchase.bonus} bonus)` : ''}${purchase.receipt ? ` for your payment with receipt ${purchase.receipt}` : ''}. Your balance is now ${line.balanceAfter} tokens. Reference: ${purchase.id}.`, null, { section: 'tokens' });
    return line;
  });
}

// MoMo purchases waiting for MTN: asks MTN how each one went.
async function checkPendingPurchases(userId) {
  const waiting = await db.filter('tokenPurchases', p => p.status === 'requested' && p.paymentRef && (!userId || p.userId === userId));
  if (!waiting.length) return 0;
  const { isLiberiaMoMoConfigured, checkCollectionStatus } = require('./liberia-momo');
  if (!isLiberiaMoMoConfigured()) return 0;
  let changed = 0;
  for (const p of waiting) {
    try {
      const r = await checkCollectionStatus(p.paymentRef);
      const st = r && r.status;
      if (st === 'SUCCESSFUL') { await db.update('tokenPurchases', p.id, { paymentStatus: 'successful' }); await creditPurchase({ ...p, paymentStatus: 'successful' }); changed++; }
      else if (st === 'FAILED' || (Date.now() - new Date(p.createdAt).getTime() > 2 * DAY)) {
        await db.update('tokenPurchases', p.id, { status: 'failed', paymentStatus: st === 'FAILED' ? 'failed' : 'timed_out' });
        await notify(p.userId, '⚠️', `Your payment for ${p.tokens} tokens did not go through, so no tokens were added and you were not charged.`, null, { section: 'tokens' });
        changed++;
      }
    } catch (e) { console.error('[tokens] status check failed for', p.id, e.message); }
  }
  return changed;
}

// ── spending (called from fundEscrowForContract) ────────────────────────
// Takes the tokens for one payment. Throws a TOKENS_SHORT error the page
// can show if the balance is too small; nothing is taken in that case.
async function spendForEscrow({ customerId, escrowId, contract, forAmount, forFee }) {
  const who = await db.find('users', u => u.id === customerId);
  const s = await settingsFor(who && who.country);
  if (!s.enabled) throw tokenError(403, 'TOKENS_OFF', 'Paying with tokens is not on right now. Choose another way to pay.');
  if (contract.payWith === 'tokens_fee' && !s.feeOnlyEnabled) throw tokenError(403, 'TOKENS_OFF', 'Using tokens for the fee only is not on right now. Pay the whole amount with tokens, or choose another way to pay.');
  const need = money((forAmount || 0) + (forFee || 0));
  if (need <= 0) return null;
  return withUserLock(customerId, async () => {
    const have = await balance(customerId);
    if (have + 0.001 < need) {
      throw tokenError(402, 'TOKENS_SHORT', `This needs ${need} tokens and you have ${have}. Buy ${money(need - have)} more tokens, or choose another way to pay. Nothing was booked and nothing was taken.`, { need, have, short: money(need - have) });
    }
    return addLine(customerId, { kind: 'spend', tokens: -need, escrowId, contractId: contract.id, bookingNumber: contract.bookingNumber || null, forAmount: money(forAmount || 0), forFee: money(forFee || 0), note: String(contract.service || '').slice(0, 120) });
  });
}

// For an extra-payment approval on a booking already paid with tokens.
// Returns the line, or null if the balance is too small (the caller then
// takes the extra the normal way).
async function trySpendExtra({ customerId, escrowId, contract, forAmount, forFee }) {
  const need = money((forAmount || 0) + (forFee || 0));
  if (need <= 0) return null;
  return withUserLock(customerId, async () => {
    if ((await balance(customerId)) + 0.001 < need) return null;
    return addLine(customerId, { kind: 'spend', tokens: -need, escrowId, contractId: contract.id, bookingNumber: contract.bookingNumber || null, forAmount: money(forAmount || 0), forFee: money(forFee || 0), note: 'Extra work approved' });
  });
}

// Gives back one extra-work spend whose other half of the payment failed.
async function addBackExtra(spendLine) {
  if (!spendLine || !(spendLine.tokens < 0)) return null;
  return withUserLock(spendLine.userId, () => addLine(spendLine.userId, { kind: 'refund', tokens: -spendLine.tokens, escrowId: spendLine.escrowId, contractId: spendLine.contractId, bookingNumber: spendLine.bookingNumber || null, note: 'Extra work not paid' }));
}

// ── refunds ─────────────────────────────────────────────────────────────
// Gives back the tokens owed on one escrow, given what has already been
// given back. Safe to call any number of times. Never throws.
async function refundEscrow(escrowOrId) {
  try {
    const id = typeof escrowOrId === 'string' ? escrowOrId : escrowOrId && escrowOrId.id;
    if (!id) return null;
    const lines = await db.filter('tokenLedger', l => l.escrowId === id);
    const spends = lines.filter(l => l.kind === 'spend');
    if (!spends.length) return null;
    const customerId = spends[0].userId;
    return await withUserLock(customerId, async () => {
      const esc = await db.find('escrowTransactions', e => e.id === id);
      if (!esc) return null;
      const fresh = await db.filter('tokenLedger', l => l.escrowId === id);
      const spentAmount = money(fresh.filter(l => l.kind === 'spend').reduce((s, l) => s + (l.forAmount || 0), 0));
      const spentFee = money(fresh.filter(l => l.kind === 'spend').reduce((s, l) => s + (l.forFee || 0), 0));
      const given = money(fresh.filter(l => l.kind === 'refund').reduce((s, l) => s + l.tokens, 0));
      let owed = 0, why = '';
      if (esc.status === 'refunded') { owed = money(spentAmount + spentFee); why = 'Booking refunded'; }
      else if ((esc.refundedAmount || 0) > 0) { owed = money(Math.min(esc.refundedAmount, spentAmount)); why = 'Part refunded after a dispute'; }
      const toGive = money(owed - given);
      if (toGive <= 0.004) return null;
      const contract = await db.find('contracts', c => c.id === esc.contractId);
      const line = await addLine(customerId, { kind: 'refund', tokens: toGive, escrowId: id, contractId: esc.contractId, bookingNumber: contract ? contract.bookingNumber : null, note: why });
      await notify(customerId, '🪙', `${toGive} tokens are back in your balance (${why.toLowerCase()}${contract && contract.bookingNumber ? `, booking #${contract.bookingNumber}` : ''}). Balance: ${line.balanceAfter} tokens.`, null, { section: 'tokens' });
      return line;
    });
  } catch (e) { console.error('[tokens] refund failed:', e.message); return null; }
}

// Gives back every token taken for a payment that never became a booking
// (the payment record or the booking itself could not be saved). Keyed on
// the payment id, so it can only happen once. Never throws.
async function voidSpend(escrowId, why = 'Payment not completed') {
  try {
    const spends = await db.filter('tokenLedger', l => l.escrowId === escrowId && l.kind === 'spend');
    if (!spends.length) return null;
    const customerId = spends[0].userId;
    return await withUserLock(customerId, async () => {
      const fresh = await db.filter('tokenLedger', l => l.escrowId === escrowId);
      const taken = money(-fresh.filter(l => l.kind === 'spend').reduce((s, l) => s + l.tokens, 0));
      const given = money(fresh.filter(l => l.kind === 'refund').reduce((s, l) => s + l.tokens, 0));
      const toGive = money(taken - given);
      if (toGive <= 0.004) return null;
      return addLine(customerId, { kind: 'refund', tokens: toGive, escrowId, contractId: spends[0].contractId, bookingNumber: spends[0].bookingNumber || null, note: why });
    });
  } catch (e) { console.error('[tokens] void failed:', e.message); return null; }
}

// Called when a booking was paid for but could not be saved: gives the
// tokens back if the payment record exists and has none of the booking
// behind it. Used by the booking routes' failure paths.
async function undoIfOrphan(escrow) {
  if (!escrow || !(escrow.tokensSpent > 0)) return null;
  const contract = await db.find('contracts', c => c.id === escrow.contractId);
  if (contract) return null; // the booking exists: normal refund rules apply
  try { await db.update('escrowTransactions', escrow.id, { status: 'refunded', voidedBeforeBooking: true }); } catch (e) { /* still give the tokens back */ }
  return voidSpend(escrow.id);
}

// Safety net: finds any refunded token payment whose tokens weren't given
// back yet (for example a refund path added later that doesn't call
// refundEscrow) and gives them back. Runs on a timer from server.js.
async function sweep() {
  let n = 0;
  try {
    const spendEscrowIds = new Set((await db.filter('tokenLedger', l => l.kind === 'spend' && l.escrowId)).map(l => l.escrowId));
    if (spendEscrowIds.size) {
      const due = await db.filter('escrowTransactions', e => spendEscrowIds.has(e.id) && (e.status === 'refunded' || (e.refundedAmount || 0) > 0));
      for (const e of due) { try { if (await refundEscrow(e.id)) n++; } catch (x) { /* next one */ } }
    }
  } catch (e) { console.error('[tokens] sweep failed:', e.message); }
  try { n += await checkPendingPurchases(); } catch (e) { console.error('[tokens] pending check failed:', e.message); }
  return n;
}

// ── admin ───────────────────────────────────────────────────────────────
async function adminAdjust(admin, userId, tokens, reason) {
  const user = await db.find('users', u => u.id === userId && u.role === 'customer');
  if (!user) return { status: 404, error: 'Customer not found.' };
  const t = money(tokens);
  if (!Number.isFinite(t) || t === 0 || Math.abs(t) > 2000) return { status: 400, error: 'Enter a number of tokens between -2000 and 2000 (not 0).' };
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 300) return { status: 400, error: 'Say why, in at least 5 characters. The customer sees this.' };
  const line = await withUserLock(user.id, async () => {
    const have = await balance(user.id);
    if (have + t < -0.001) return null;
    return addLine(user.id, { kind: t > 0 ? 'admin_add' : 'admin_remove', tokens: t, note: reason.trim(), actorId: admin.id, actorName: admin.name });
  });
  if (!line) return { status: 400, error: 'That would take the balance below zero.' };
  await notify(user.id, '🪙', `${t > 0 ? `${t} tokens were added to` : `${-t} tokens were removed from`} your balance by the Trothen team: ${reason.trim()}. Balance: ${line.balanceAfter} tokens.`, null, { section: 'tokens' });
  return { ok: true, line };
}

async function stats() {
  const all = await db.all('tokenLedger');
  const since = Date.now() - 30 * DAY;
  const recent = all.filter(l => new Date(l.createdAt).getTime() >= since);
  const sum = (rows, f) => money(rows.reduce((s, l) => s + f(l), 0));
  const holders = new Map();
  for (const l of all) holders.set(l.userId, money((holders.get(l.userId) || 0) + l.tokens));
  const purchases = await db.all('tokenPurchases');
  return {
    outstandingTokens: sum(all, l => l.tokens),
    customersWithBalance: [...holders.values()].filter(v => v > 0.004).length,
    last30: {
      soldUsd: sum(recent.filter(l => l.kind === 'purchase'), l => l.priceUsd || 0),
      tokensSold: sum(recent.filter(l => l.kind === 'purchase'), l => l.tokens),
      bonusGiven: sum(recent.filter(l => l.kind === 'purchase'), l => l.bonus || 0),
      tokensSpent: sum(recent.filter(l => l.kind === 'spend'), l => -l.tokens),
      tokensRefunded: sum(recent.filter(l => l.kind === 'refund'), l => l.tokens),
      adminChanges: sum(recent.filter(l => l.kind === 'admin_add' || l.kind === 'admin_remove'), l => l.tokens),
    },
    allTime: {
      soldUsd: sum(all.filter(l => l.kind === 'purchase'), l => l.priceUsd || 0),
      tokensSpent: sum(all.filter(l => l.kind === 'spend'), l => -l.tokens),
    },
    pendingPurchases: purchases.filter(p => p.status === 'requested').length,
    recent: all.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 25),
  };
}

module.exports = { PAY_WITH, cleanPayWith, cleanPack, cleanCountryPack, niceLocal, settings, settingsFor, recordOfflineTopUp, OFFLINE_METHODS, balance, ledgerOf, publicLine, buy, creditPurchase, checkPendingPurchases, spendForEscrow, trySpendExtra, addBackExtra, refundEscrow, voidSpend, undoIfOrphan, sweep, adminAdjust, stats, tokenError, money };
