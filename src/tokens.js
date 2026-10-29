// Trothen Tokens for PROS (v118; first built for customers in v115-v117).
//
// How it works, in plain words:
//   - Pros buy tokens (in the app, with a mobile money payment code, or in
//     cash/at an agent recorded by staff). 1 token is always worth US$1.00.
//   - Pros spend tokens ONLY on what they owe Trothen:
//       job fee      - a small fee per job accepted (off until an admin sets it)
//       commission   - Trothen's commission at payout, so the pro keeps the
//                      full job price (pro's choice, on the Tokens page)
//       plan fee     - the monthly plan fee (pro's choice)
//       ads          - a self-serve ad (pro's choice)
//       driver pass  - a daily/weekly/monthly driver pass (pro's choice)
//   - Tokens NEVER touch the customer's money. The customer still pays for
//     the job into escrow, and escrow is released to the pro only when the
//     customer confirms (or a dispute is decided), exactly as before.
//   - Every token movement is a line in "tokenLedger" with a reference
//     (ref) saying what it was for. Refunds are keyed on that reference, so
//     they happen once and never give back more than was taken.
const db = require('./db');
const { nanoid } = require('nanoid');
const { getSetting } = require('./platform-settings');
const { notify } = require('./notify');

const money = (n) => Math.round(Number(n) * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;

// ── per-person lock: two spends (or a spend and a refund) for the same
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

// Everything that applies to one pro's country: on or off, limits,
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
    // What the pro is really charged, in dollars, at today's rate.
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
    momoAccounts: Array.isArray(rule.momoAccounts) ? rule.momoAccounts.filter(a => a && a.number) : [], // v117: Trothen's own numbers customers send to
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
  const what = l.kind === 'spend' && l.refKind && SPEND_WORDS[l.refKind] ? `Paid with tokens: ${SPEND_WORDS[l.refKind].toLowerCase()}` : (KIND_WORDS[l.kind] || l.kind);
  return { id: l.id, kind: l.kind, refKind: l.refKind || null, what, tokens: l.tokens, balanceAfter: l.balanceAfter, bookingNumber: l.bookingNumber || null, note: l.note || null, packLabel: l.packLabel || null, priceUsd: l.priceUsd ?? null, priceLocal: l.priceLocal ?? null, currency: l.currency || null, reference: l.purchaseId || null, createdAt: l.createdAt };
}

// ── buying ──────────────────────────────────────────────────────────────
const buyInFlight = new Set();
const DAY_MS = 24 * 60 * 60 * 1000;
// v117: a purchase is "open" while its money hasn't been confirmed yet.
const OPEN_STATUSES = ['requested', 'awaiting_payment', 'customer_says_paid'];

// Shared checks for any way of adding bought tokens (in the app, or a cash
// or manual mobile-money top-up recorded by staff).
async function purchaseChecks(customer, s, tokensToAdd, usd) {
  if (!s.enabled) return { status: 403, error: 'Tokens are not available in your country right now.' };
  if (!customer || customer.role !== 'provider') return { status: 403, error: 'Only pro accounts can buy tokens.' };
  if (customer.onHold) return { status: 403, error: 'This account is paused for a quick review, so tokens can\'t be added right now.' };
  if (customer.verified !== true) return { status: 403, code: 'VERIFY_IDENTITY', error: 'Please verify your identity first. Tokens are a stored balance, so we need to know who holds it.' };
  const have = await balance(customer.id);
  const mine = await db.filter('tokenPurchases', p => p.userId === customer.id);
  const recent = mine.filter(p => (p.status === 'paid' || OPEN_STATUSES.includes(p.status)) && Date.now() - new Date(p.createdAt).getTime() < DAY_MS);
  // Purchases still waiting for their money count as if already bought.
  const pendingTokens = mine.filter(p => OPEN_STATUSES.includes(p.status)).reduce((t, p) => t + p.tokens, 0);
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

// v119: can a pro in this country pay for tokens inside the app right now?
// Only when real mobile money collection is set up for their country
// (Liberia, once MTN is connected), or a super admin has switched on test
// purchases for a test site.
async function inAppPaymentAvailable(country) {
  if ((await getSetting('tokenTestPurchases')) === true) return true;
  if (country === 'Liberia') { try { return require('./liberia-momo').isLiberiaMoMoConfigured(); } catch (e) { return false; } }
  return false;
}

// requestId: made by the page once per purchase attempt. If the network
// drops and the page sends the same purchase again, the first one is
// returned instead of charging twice.
async function buy(customer, packId, expectedPrice, requestId) {
  if (!customer || customer.role !== 'provider') return { status: 403, error: 'Only pro accounts can buy tokens.' };
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
    // v119: with no real in-app payment for this country, buying "in the app"
    // would hand out tokens for nothing. It is refused unless a super admin
    // has switched on test purchases (for a test site only).
    if (!(await inAppPaymentAvailable(customer.country))) {
      return { status: 403, code: 'NO_INAPP_PAYMENT', error: 'Paying in the app isn\'t available in your country yet. Use "Send mobile money myself" to get a payment code, or pay at a Trothen office or agent.' };
    }
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
  const customer = await db.find('users', u => u.id === userId && u.role === 'provider');
  if (!customer) return { status: 404, error: 'Pro not found.' };
  if (!OFFLINE_METHODS[method]) return { status: 400, error: 'Choose how they paid: cash, agent, bank deposit or mobile money.' };
  const rc = typeof receipt === 'string' ? receipt.trim() : '';
  if (rc.length < 3 || rc.length > 60) return { status: 400, error: 'Enter the receipt or transaction number (3 to 60 characters).' };
  if (await db.find('tokenPurchases', p => p.receipt && p.receipt.toLowerCase() === rc.toLowerCase() && (p.method === method || (method === 'mobile_money' && p.method === 'mobile_money_code')))) return { status: 409, error: `Receipt ${rc} has already been recorded. The same payment can't be added twice.` };
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
  }).then(async (line) => { if (line) { try { await settleDebtAfterCredit(purchase.userId); } catch (e) { console.error('[tokens] debt settle failed:', e.message); } } return line; }); // v119: commission owed is taken first
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

// ── spending ────────────────────────────────────────────────────────────
// What a pro can spend tokens on. ref ties a spend to the thing it paid
// for, e.g. "job:ct_x", "commission:po_x", "plan:pinv_x", "ad:ad_x", "pass:rp_x".
const SPEND_WORDS = { cashjob: 'Commission on a cash job', commission: 'Commission', plan: 'Plan fee', ad: 'Ad', pass: 'Driver pass' };
function refKind(ref) { return String(ref || '').split(':')[0]; }

// Takes exactly `amount` tokens, or throws TOKENS_SHORT (nothing taken).
async function spend(userId, amount, ref, note, extra) {
  const need = money(amount);
  if (!(need > 0)) return null;
  return withUserLock(userId, async () => {
    const have = await balance(userId);
    if (have + 0.001 < need) {
      throw tokenError(402, 'TOKENS_SHORT', `This needs ${need} tokens and you have ${have}. Buy ${money(need - have)} more tokens on your Tokens page.`, { need, have, short: money(need - have) });
    }
    return addLine(userId, { kind: 'spend', tokens: -need, ref, refKind: refKind(ref), note: note || SPEND_WORDS[refKind(ref)] || null, ...(extra || {}) });
  });
}
// Takes up to `amount` tokens (whatever the balance allows). Returns the line or null.
async function spendUpTo(userId, amount, ref, note, extra) {
  const want = money(amount);
  if (!(want > 0)) return null;
  return withUserLock(userId, async () => {
    const take = money(Math.min(want, await balance(userId)));
    if (!(take > 0.004)) return null;
    return addLine(userId, { kind: 'spend', tokens: -take, ref, refKind: refKind(ref), note: note || SPEND_WORDS[refKind(ref)] || null, ...(extra || {}) });
  });
}
// Gives back what was taken for `ref` and not yet given back. Safe to call
// any number of times. Never throws.
async function refundRef(ref, why) {
  try {
    const first = await db.find('tokenLedger', l => l.ref === ref && l.kind === 'spend');
    if (!first) return null;
    return await withUserLock(first.userId, async () => {
      const lines = await db.filter('tokenLedger', l => l.ref === ref);
      const taken = money(-lines.filter(l => l.kind === 'spend').reduce((t, l) => t + l.tokens, 0));
      const given = money(lines.filter(l => l.kind === 'refund').reduce((t, l) => t + l.tokens, 0));
      const due = money(taken - given);
      if (due <= 0.004) return null;
      const line = await addLine(first.userId, { kind: 'refund', tokens: due, ref, refKind: refKind(ref), bookingNumber: first.bookingNumber || null, note: why });
      await notify(first.userId, '🪙', `${due} tokens are back in your balance: ${why}. Balance: ${line.balanceAfter} tokens.`, null, { section: 'tokens' });
      return line;
    });
  } catch (e) { console.error('[tokens] refund failed:', ref, e.message); return null; }
}

// The pro's own choices: which bills to pay from tokens first.
const AUTOPAY_KEYS = ['commission', 'plan', 'ad', 'pass'];
function autopayOf(u) {
  const a = (u && u.tokenAutoPay) || {};
  return Object.fromEntries(AUTOPAY_KEYS.map(k => [k, a[k] === true]));
}

// ── v119: commission on CASH jobs, paid from tokens ─────────────────────
// On a cash job the customer pays the pro directly, so Trothen never holds
// the money and can't take its commission from a payout. Instead:
//   1. When the pro accepts, the commission (their plan rate x the job
//      price) is taken from their tokens. No tokens, no accepting.
//   2. When the customer marks the job done they confirm the cash they
//      paid; the commission is corrected to that amount (more taken, or
//      some given back). Anything the pro can't cover is recorded as owed
//      (users.tokenDebt) and taken from their next token purchase; they
//      can't accept new cash jobs while they owe.
//   3. If the job doesn't happen and it isn't the pro's doing, the
//      commission goes back (see commissionRefundReason).
const cashRef = (contractId) => `cashjob:${contractId}`;
async function cashCommissionRate(provider) {
  const { effectiveCommissionRate } = require('./commission');
  const org = provider.organizationId ? await db.find('organizations', o => o.id === provider.organizationId && o.status !== 'suspended') : null;
  return effectiveCommissionRate(provider, org);
}
function jobPriceOf(contract) {
  return Number(contract.laborAmount !== undefined && contract.laborAmount !== null ? contract.laborAmount : contract.amount) || 0;
}
async function takenFor(ref) {
  const lines = await db.filter('tokenLedger', l => l.ref === ref);
  return money(-lines.reduce((t, l) => t + (Number(l.tokens) || 0), 0)); // net tokens taken so far
}

// Called when a pro accepts a cash job. Throws TOKENS_SHORT (or OWES_TOKENS)
// with a message the page shows; nothing changes in that case.
async function chargeCashCommission(provider, contract) {
  if (!contract || contract.payMethod !== 'cash') return null;
  const ref = cashRef(contract.id);
  if (await db.find('tokenLedger', l => l.ref === ref && l.kind === 'spend')) return null; // already taken for this job
  const debt = money(provider.tokenDebt || 0);
  if (debt > 0) throw tokenError(402, 'OWES_TOKENS', `You still owe ${debt} tokens of commission from an earlier cash job. Buy tokens on your Tokens page (what you owe is taken first), then accept this job.`, { debt });
  // A top-scorer free-commission credit covers one cash job.
  if ((provider.freeCommissionCredits || 0) > 0) {
    await db.update('users', provider.id, { freeCommissionCredits: provider.freeCommissionCredits - 1 });
    await db.update('contracts', contract.id, { cashCommission: { rate: 0, tokens: 0, freeCredit: true } });
    return { free: true };
  }
  const rate = await cashCommissionRate(provider);
  const due = money(jobPriceOf(contract) * rate);
  if (!(due > 0)) return null;
  try {
    const line = await spend(provider.id, due, ref, `Commission ${Math.round(rate * 1000) / 10}% on cash job: ${String(contract.service || '').slice(0, 70)}`, { bookingNumber: contract.bookingNumber || null });
    await db.update('contracts', contract.id, { cashCommission: { rate, tokens: due, takenAt: new Date().toISOString() } });
    return line;
  } catch (e) {
    if (e.code === 'TOKENS_SHORT') e.message = `This is a cash job: the customer pays you directly, so Trothen's ${Math.round(rate * 1000) / 10}% commission (${due} token${due === 1 ? '' : 's'}) is paid from your tokens when you accept. You have ${e.extra.have}. Buy tokens on your Tokens page, then accept it. The booking stays open until the answer deadline.`;
    throw e;
  }
}

// Called when the customer confirms a cash job is done and how much they paid.
async function settleCashCommission(contract, paidAmount) {
  const c = await db.find('contracts', x => x.id === contract.id);
  if (!c || c.payMethod !== 'cash' || !c.cashCommission || c.cashCommission.freeCredit) return null;
  const ref = cashRef(c.id);
  const rate = c.cashCommission.rate;
  // The job part of what was paid (store goods are never in a cash job).
  const due = money(Math.max(0, Number(paidAmount) || 0) * rate);
  const taken = await takenFor(ref);
  const diff = money(due - taken);
  const result = { due, taken, extra: 0, back: 0, owed: 0 };
  if (diff > 0.004) {
    const line = await spendUpTo(c.providerId, diff, ref, 'Commission on extra cash paid', { bookingNumber: c.bookingNumber || null });
    result.extra = line ? money(-line.tokens) : 0;
    result.owed = money(diff - result.extra);
    if (result.owed > 0) {
      const pro = await db.find('users', u => u.id === c.providerId);
      await db.update('users', c.providerId, { tokenDebt: money((pro.tokenDebt || 0) + result.owed) });
    }
  } else if (diff < -0.004) {
    await withUserLock(c.providerId, () => addLine(c.providerId, { kind: 'refund', tokens: -diff, ref, refKind: 'cashjob', bookingNumber: c.bookingNumber || null, note: 'Commission corrected: the customer paid less than the booking price' }));
    result.back = money(-diff);
  }
  await db.update('contracts', c.id, { cashCommission: { ...c.cashCommission, settledTokens: due, settledAt: new Date().toISOString(), owed: result.owed } });
  const words = result.extra > 0 || result.owed > 0
    ? `The customer confirmed paying more than the booking price, so ${result.extra} more tokens of commission were taken${result.owed > 0 ? ` and ${result.owed} are owed (taken from your next token purchase; you can't accept cash jobs until then)` : ''}.`
    : result.back > 0 ? `The customer confirmed paying less than the booking price, so ${result.back} tokens of commission came back to you.` : 'The commission already taken was right.';
  await notify(c.providerId, '💵', `Cash job #${c.bookingNumber || ''} is complete. ${words}`, 'bookingUpdates', { section: 'tokens' });
  return result;
}

// Owed commission is taken first from any tokens a pro buys.
async function settleDebtAfterCredit(userId) {
  const pro = await db.find('users', u => u.id === userId);
  const debt = money((pro && pro.tokenDebt) || 0);
  if (!(debt > 0)) return 0;
  const line = await spendUpTo(userId, debt, `debt:${Date.now()}`, 'Commission you owed from a cash job', { refKind: 'cashjob' });
  const paid = line ? money(-line.tokens) : 0;
  if (paid > 0) {
    await db.update('users', userId, { tokenDebt: money(debt - paid) });
    await notify(userId, '🪙', `${paid} tokens paid the commission you owed${debt - paid > 0.004 ? `; ${money(debt - paid)} is still owed` : '. You can accept cash jobs again'}.`, null, { section: 'tokens' });
  }
  return paid;
}

// When does a cash job's commission come back? When the job didn't happen
// and it wasn't the pro's doing: the customer cancelled, the pro cancelled
// for a reason that doesn't count against them (unsafe, wrong category,
// etc.), or Trothen cancelled it. Ordinary pro cancellations keep it (that
// is what stops accept-then-drop). After a dispute it is not given back by
// itself; the team can give it back with "Change balance".
function commissionRefundReason(c) {
  if (!c) return null;
  if (c.status === 'cancelled' && c.cancelledByRole === 'customer') return 'the customer cancelled the job';
  if (c.status === 'cancelled' && c.cancelledByRole === 'provider' && c.protectedCancellation) return 'the job was cancelled for a reason that doesn\'t count against you';
  if (c.status === 'cancelled' && c.cancelledByRole === 'system') return 'the job was cancelled by Trothen';
  return null;
}

// ── commission at payout ────────────────────────────────────────────────
// Called while a payout is worked out. Returns how much commission tokens
// covered (0 if the pro hasn't chosen this or has no tokens).
async function payCommission(provider, payoutId, commissionUsd) {
  if (!autopayOf(provider).commission || !(commissionUsd > 0)) return 0;
  const s = await settingsFor(provider.country);
  if (!s.enabled) return 0;
  const line = await spendUpTo(provider.id, commissionUsd, `commission:${payoutId}`, 'Commission on a payout');
  return line ? money(-line.tokens) : 0;
}

// ── plan fee ────────────────────────────────────────────────────────────
// Pays one open plan invoice (or as much of it as the balance allows).
async function payPlanInvoice(provider, invoiceId, { auto } = {}) {
  const inv = await db.find('planInvoices', i => i.id === invoiceId && i.providerId === provider.id);
  if (!inv) return { status: 404, error: 'Invoice not found.' };
  if (inv.status !== 'open') return { status: 400, error: 'This invoice is already paid.' };
  const owed = money(inv.amountUsd - (inv.paidUsd || 0));
  const line = await spendUpTo(provider.id, owed, `plan:${inv.id}:${Date.now()}`, `Plan fee ${inv.period}`);
  if (!line) return { status: 400, code: 'TOKENS_SHORT', error: 'You have no tokens to pay this with. Buy tokens first.' };
  const paid = money(-line.tokens);
  const paidUsd = money((inv.paidUsd || 0) + paid);
  await db.update('planInvoices', inv.id, {
    paidUsd, status: paidUsd >= inv.amountUsd - 0.004 ? 'paid' : 'open',
    payments: [...(inv.payments || []), { tokens: paid, ledgerId: line.id, amountUsd: paid, at: new Date().toISOString(), auto: !!auto }],
    paidAt: paidUsd >= inv.amountUsd - 0.004 ? new Date().toISOString() : null,
  });
  return { ok: true, paid, left: money(inv.amountUsd - paidUsd) };
}
// Run right after a month's invoices are made: pros who chose "plan fee
// from tokens" have it paid straight away.
async function autoPayPlanInvoices() {
  let n = 0;
  for (const inv of await db.filter('planInvoices', i => i.status === 'open')) {
    try {
      const pro = await db.find('users', u => u.id === inv.providerId);
      if (!pro || !autopayOf(pro).plan || !(await settingsFor(pro.country)).enabled) continue;
      const r = await payPlanInvoice(pro, inv.id, { auto: true });
      if (r.ok) { n++; await notify(pro.id, '🧾', `${r.paid} tokens paid your ${inv.period} plan fee${r.left > 0 ? `; $${r.left} is still owed and will come from your next payout` : ''}.`, null, { section: 'tokens' }); }
    } catch (e) { console.error('[tokens] plan auto-pay failed:', inv.id, e.message); }
  }
  return n;
}

// ── v117: pay by mobile money yourself, with a code from Trothen ────────
// For customers who send mobile money to Trothen's own number (no in-app
// MoMo connection needed). Trothen makes a one-time code; the customer
// puts it in the reference/note of the transfer; the finance team finds
// the payment on Trothen's mobile money statement by that code and
// confirms it. Rules:
//   - The code is made by the system, never typed by the customer.
//   - It is for one pack and one exact amount, and runs out (48 hours by
//     default) if no payment is reported.
//   - The tokens it would add count against the balance and daily limits
//     from the moment it is made, so codes can't be stacked past them.
//   - Confirming needs Trothen's own mobile money transaction ID, which
//     can only ever be used once, and the amount actually received.
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: easy to read out and type
async function newPaymentCode() {
  const crypto = require('crypto');
  for (let i = 0; i < 10; i++) {
    let c = 'TK';
    for (let j = 0; j < 6; j++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!(await db.find('tokenPurchases', p => p.paymentCode === c)) && !(await db.find('escrowTransactions', e => e.paymentCode === c))) return c; // v119: unique across token and booking codes
  }
  throw new Error('Could not make a unique payment code');
}
function momoAccountsFor(s) {
  return (s.momoAccounts || []).filter(a => a && a.number);
}
async function codeHours() { return Number(await getSetting('tokenPaymentCodeHours')) || 48; }

async function createPaymentCode(customer, packId, expectedPrice, requestId) {
  if (!customer || customer.role !== 'provider') return { status: 403, error: 'Only pro accounts can buy tokens.' };
  const rid = typeof requestId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(requestId) ? requestId : null;
  if (rid) {
    const same = await db.find('tokenPurchases', p => p.userId === customer.id && p.requestId === rid);
    if (same) return { ok: true, purchase: same, repeated: true };
  }
  const s = await settingsFor(customer.country);
  if (!s.enabled) return { status: 403, error: 'Tokens are not available in your country right now.' };
  const accounts = momoAccountsFor(s);
  if (!accounts.length) return { status: 400, code: 'NO_MOMO_ACCOUNT', error: 'Paying by sending mobile money yourself is not set up in your country yet. Please use another way to pay.' };
  const pack = s.packs.find(p => p.id === packId);
  if (!pack) return { status: 400, error: 'Choose one of the packs on the list.' };
  const shown = pack.priceLocal != null ? pack.priceLocal : pack.priceUsd;
  if (expectedPrice === undefined || Math.abs(Number(expectedPrice) - shown) > 0.009) {
    return { status: 409, code: 'PRICE_CHANGED', price: shown, error: 'The price of this pack has changed. Check it and confirm again.' };
  }
  if (buyInFlight.has(customer.id)) return { status: 409, error: 'Your request is already being processed. Please wait a moment.' };
  buyInFlight.add(customer.id);
  try {
    const open = await db.filter('tokenPurchases', p => p.userId === customer.id && p.status === 'awaiting_payment');
    if (open.length >= 3) return { status: 400, code: 'TOO_MANY_CODES', error: 'You already have 3 payment codes waiting. Pay one of them, or cancel one you no longer need, before making another.' };
    const chk = await purchaseChecks(customer, s, pack.tokens, pack.priceUsd);
    if (!chk.ok) return chk;
    const hours = await codeHours();
    const purchase = {
      id: `tkp_${nanoid(10)}`, requestId: rid, userId: customer.id,
      packId: pack.id, packLabel: pack.label, priceUsd: pack.priceUsd, priceLocal: pack.priceLocal, currency: s.currency.code,
      amountDue: shown, tokens: pack.tokens, bonus: pack.bonus,
      method: 'mobile_money_code', paymentCode: await newPaymentCode(), payTo: accounts,
      status: 'awaiting_payment', paymentStatus: 'awaiting_payment',
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    await db.insert('tokenPurchases', purchase);
    const amt = pack.priceLocal != null ? `${s.currency.symbol}${Number(pack.priceLocal).toLocaleString()}` : `$${pack.priceUsd.toFixed(2)}`;
    await notify(customer.id, '🪙', `Your payment code is ${purchase.paymentCode}. Send exactly ${amt} by mobile money to ${accounts.map(a => `${a.network} ${a.number} (${a.accountName})`).join(' or ')} and write ${purchase.paymentCode} in the reference. Your ${pack.tokens} tokens are added once we see the payment. The code runs out in ${hours} hours.`, null, { section: 'tokens' });
    await velocityCheck(customer, chk.recentCount);
    return { ok: true, purchase };
  } finally { buyInFlight.delete(customer.id); }
}

// The customer says they have sent the money, and (optionally) gives the
// transaction ID from their own SMS. This only tells the team to look;
// it never adds tokens by itself.
async function customerReportsPaid(customer, purchaseId, transactionId) {
  const p = await db.find('tokenPurchases', x => x.id === purchaseId && x.userId === customer.id && x.method === 'mobile_money_code');
  if (!p) return { status: 404, error: 'Payment code not found.' };
  if (p.status !== 'awaiting_payment') return { status: 400, error: p.status === 'customer_says_paid' ? 'You have already told us. The team is checking it.' : `This code is ${p.status.replace(/_/g, ' ')}.` };
  const tx = typeof transactionId === 'string' ? transactionId.trim() : '';
  if (tx && (tx.length < 4 || tx.length > 60)) return { status: 400, error: 'The transaction ID should be 4 to 60 characters, as shown in your mobile money message.' };
  const updated = await db.update('tokenPurchases', p.id, { status: 'customer_says_paid', customerTransactionId: tx || null, customerSaysPaidAt: new Date().toISOString() });
  const team = await db.filter('users', u => u.role === 'admin' && u.active !== false && (u.isSuperAdmin || ['financial', 'accountant', 'controller'].includes(u.adminDepartment)));
  for (const a of team) await notify(a.id, '🪙', `${customer.name} says they paid token code ${p.paymentCode} (${p.priceLocal != null ? `${p.currency} ${p.priceLocal}` : `$${p.priceUsd}`}${tx ? `, their transaction ID ${tx}` : ''}). Check Trothen's mobile money statement and confirm it in Admin → Tokens.`, null, { section: 'tokens' });
  return { ok: true, purchase: updated };
}

async function customerCancelsCode(customer, purchaseId) {
  const p = await db.find('tokenPurchases', x => x.id === purchaseId && x.userId === customer.id && x.method === 'mobile_money_code');
  if (!p) return { status: 404, error: 'Payment code not found.' };
  if (p.status !== 'awaiting_payment') return { status: 400, error: p.status === 'customer_says_paid' ? 'You said you have paid this one, so it can\'t be cancelled here. Contact support if that was a mistake.' : `This code is already ${p.status.replace(/_/g, ' ')}.` };
  return { ok: true, purchase: await db.update('tokenPurchases', p.id, { status: 'cancelled', cancelledAt: new Date().toISOString() }) };
}

// Finance team: the payment is on Trothen's statement. transactionId is
// the ID on TROTHEN's side (from its statement, not what the customer
// typed); amountReceived is what actually arrived.
async function confirmPaymentCode(admin, code, transactionId, amountReceived) {
  const c = String(code || '').trim().toUpperCase();
  const p = await db.find('tokenPurchases', x => x.paymentCode === c);
  if (!p) return { status: 404, error: `No payment code ${c}.` };
  if (p.status === 'paid') return { status: 409, error: `Code ${c} was already confirmed${p.receipt ? ` (transaction ${p.receipt})` : ''}.` };
  if (!['awaiting_payment', 'customer_says_paid', 'expired'].includes(p.status)) return { status: 400, error: `Code ${c} is ${p.status.replace(/_/g, ' ')} and can't be confirmed. If money arrived anyway, use "Record a payment" for a custom amount.` };
  const tx = typeof transactionId === 'string' ? transactionId.trim() : '';
  if (tx.length < 4 || tx.length > 60) return { status: 400, error: 'Enter the transaction ID shown on Trothen\'s mobile money statement.' };
  if (await db.find('tokenPurchases', x => x.receipt && x.receipt.toLowerCase() === tx.toLowerCase() && ['mobile_money', 'mobile_money_code'].includes(x.method))) return { status: 409, error: `Transaction ${tx} has already been used for another top-up.` };
  const got = Number(amountReceived);
  if (!Number.isFinite(got) || got <= 0) return { status: 400, error: `Enter the amount that arrived (${p.currency || 'USD'}).` };
  if (got + 0.009 < p.amountDue) return { status: 400, code: 'UNDERPAID', error: `Only ${got} arrived but the code is for ${p.amountDue}. Don't confirm it: either ask the pro to send the rest, or reject the code and use "Record a payment" for the amount that arrived.` };
  const customer = await db.find('users', u => u.id === p.userId);
  if (!customer || customer.role !== 'provider') return { status: 404, error: 'The pro account no longer exists.' };
  // The limits were checked when the code was made; only the balance cap is
  // checked again, in case they bought more since.
  const s = await settingsFor(customer.country);
  const have = await balance(customer.id);
  if (have + p.tokens > s.maxBalance + 0.001) return { status: 400, code: 'OVER_LIMIT', error: `Adding ${p.tokens} tokens would take ${customer.name} over the ${s.maxBalance}-token limit (they have ${have}). Refund the payment to them instead, or confirm after they spend some.` };
  const updated = await db.update('tokenPurchases', p.id, { status: 'paid', paymentStatus: 'mobile_money_code', receipt: tx, amountReceived: got, overpaid: got > p.amountDue + 0.009 ? money(got - p.amountDue) : 0, recordedBy: admin.id, recordedByName: admin.name, confirmedAt: new Date().toISOString() });
  const line = await creditPurchase({ ...updated, packLabel: `${p.packLabel} (code ${p.paymentCode})` });
  return { ok: true, purchase: updated, line };
}

async function rejectPaymentCode(admin, code, reason) {
  const c = String(code || '').trim().toUpperCase();
  const p = await db.find('tokenPurchases', x => x.paymentCode === c);
  if (!p) return { status: 404, error: `No payment code ${c}.` };
  if (!['awaiting_payment', 'customer_says_paid', 'expired'].includes(p.status)) return { status: 400, error: `Code ${c} is ${p.status.replace(/_/g, ' ')}.` };
  if (typeof reason !== 'string' || reason.trim().length < 5) return { status: 400, error: 'Say why, in at least 5 characters. The pro sees this.' };
  const updated = await db.update('tokenPurchases', p.id, { status: 'rejected', rejectReason: reason.trim().slice(0, 300), recordedBy: admin.id, recordedByName: admin.name, rejectedAt: new Date().toISOString() });
  await notify(p.userId, '⚠️', `We couldn't match a payment to your token code ${p.paymentCode}: ${reason.trim()}. No tokens were added. If you did send money, contact support with your transaction ID.`, null, { section: 'tokens' });
  return { ok: true, purchase: updated };
}

// Codes nobody reported paying for run out. One the customer says they paid
// never runs out by itself: a person has to confirm or reject it.
async function expirePaymentCodes() {
  const now = Date.now();
  const due = await db.filter('tokenPurchases', p => p.status === 'awaiting_payment' && p.expiresAt && new Date(p.expiresAt).getTime() < now);
  for (const p of due) {
    try {
      await db.update('tokenPurchases', p.id, { status: 'expired' });
      await notify(p.userId, '⌛', `Your token payment code ${p.paymentCode} ran out without a payment. If you already sent the money, contact support with your transaction ID; otherwise make a new code when you're ready.`, null, { section: 'tokens' });
    } catch (e) { console.error('[tokens] expire code failed:', p.id, e.message); }
  }
  return due.length;
}

function publicCode(p) {
  return { id: p.id, code: p.paymentCode, packLabel: p.packLabel, tokens: p.tokens, amountDue: p.amountDue, currency: p.currency, priceUsd: p.priceUsd, payTo: p.payTo || [], status: p.status, customerTransactionId: p.customerTransactionId || null, expiresAt: p.expiresAt, createdAt: p.createdAt, rejectReason: p.rejectReason || null };
}

// ── refunds and sweeps ──────────────────────────────────────────────────
// Every 5 minutes (and when a pro opens their Tokens page): job fees owed
// back, ads that never ran, codes that ran out, mobile money purchases
// waiting for MTN, and plan fees for pros who chose to pay them with tokens.
async function sweep(onlyUserId) {
  let n = 0;
  try {
    const spends = await db.filter('tokenLedger', l => l.kind === 'spend' && l.ref && (!onlyUserId || l.userId === onlyUserId) && (l.refKind === 'cashjob' || l.refKind === 'ad') && !String(l.ref).startsWith('debt:'));
    const refunded = new Set((await db.filter('tokenLedger', l => l.kind === 'refund' && l.ref)).map(l => l.ref));
    for (const sp of spends) {
      if (refunded.has(sp.ref)) continue;
      const id = sp.ref.slice(sp.ref.indexOf(':') + 1);
      if (sp.refKind === 'cashjob') {
        const why = commissionRefundReason(await db.find('contracts', c => c.id === id));
        if (why && await refundRef(sp.ref, `commission back: ${why}`)) n++;
      } else if (sp.refKind === 'ad') {
        const ad = await db.find('advertisingInquiries', a => a.id === id);
        if (ad && ad.status === 'closed' && !ad.approvedAt && await refundRef(sp.ref, 'your ad was not run')) n++;
      }
    }
  } catch (e) { console.error('[tokens] refund sweep failed:', e.message); }
  if (!onlyUserId) {
    try { n += await checkPendingPurchases(); } catch (e) { console.error('[tokens] pending check failed:', e.message); }
    try { n += await expirePaymentCodes(); } catch (e) { console.error('[tokens] code expiry failed:', e.message); }
    try { n += await autoPayPlanInvoices(); } catch (e) { console.error('[tokens] plan auto-pay failed:', e.message); }
  }
  return n;
}

// ── admin ───────────────────────────────────────────────────────────────
async function adminAdjust(admin, userId, tokens, reason) {
  const user = await db.find('users', u => u.id === userId && u.role === 'provider');
  if (!user) return { status: 404, error: 'Pro not found.' };
  const t = money(tokens);
  if (!Number.isFinite(t) || t === 0 || Math.abs(t) > 2000) return { status: 400, error: 'Enter a number of tokens between -2000 and 2000 (not 0).' };
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 300) return { status: 400, error: 'Say why, in at least 5 characters. The pro sees this.' };
  const line = await withUserLock(user.id, async () => {
    const have = await balance(user.id);
    if (have + t < -0.001) return null;
    return addLine(user.id, { kind: t > 0 ? 'admin_add' : 'admin_remove', tokens: t, note: reason.trim(), actorId: admin.id, actorName: admin.name });
  });
  if (!line) return { status: 400, error: 'That would take the balance below zero.' };
  if (t > 0) { try { await settleDebtAfterCredit(user.id); } catch (e) { /* stays owed */ } } // v119: tokens added pay what is owed first
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
    codesWaiting: purchases.filter(p => p.status === 'awaiting_payment').length,
    codesToCheck: purchases.filter(p => p.status === 'customer_says_paid').length,
    recent: all.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 25),
  };
}

module.exports = { inAppPaymentAvailable, newPaymentCode, OPEN_STATUSES, createPaymentCode, customerReportsPaid, customerCancelsCode, confirmPaymentCode, rejectPaymentCode, expirePaymentCodes, publicCode, cleanPack, cleanCountryPack, niceLocal, settings, settingsFor, recordOfflineTopUp, OFFLINE_METHODS, balance, ledgerOf, publicLine, buy, creditPurchase, checkPendingPurchases, spend, spendUpTo, refundRef, AUTOPAY_KEYS, autopayOf, chargeCashCommission, settleCashCommission, settleDebtAfterCredit, commissionRefundReason, cashCommissionRate, payCommission, payPlanInvoice, autoPayPlanInvoices, SPEND_WORDS, sweep, adminAdjust, stats, tokenError, money };
