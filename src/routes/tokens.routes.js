// v115/v118: Trothen Tokens — what pros and admins can do with them.
// The rules themselves live in src/tokens.js.
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { getSetting, setSetting } = require('../platform-settings');
const { currencyForCountry, convertFromUSD } = require('../currency-data');
const { resolveRate } = require('../plan-pricing');
const tokens = require('../tokens');

const router = express.Router();
const buyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many tries. Please wait a minute.' } });

async function localFor(country) {
  const c = currencyForCountry(country || 'United States');
  if (c.code === 'USD') return { currency: c, rate: 1, convert: () => null };
  const rate = resolveRate(c.code, await db.all('exchangeRates'));
  return { currency: c, rate, convert: (usd) => convertFromUSD(usd, c.code, rate) };
}

// GET /api/tokens/me — balance, packs (priced for this customer's
// country, in their own money), limits and history.
router.get('/tokens/me', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  try { await tokens.checkPendingPurchases(me.id); } catch (e) { /* shown as waiting */ }
  try { await tokens.sweep(me.id); } catch (e) { /* the 5-minute sweep will catch it */ }
  const s = await tokens.settingsFor(me.country);
  const loc = await localFor(me.country);
  const bal = await tokens.balance(me.id);
  const lines = await tokens.ledgerOf(me.id);
  const pending = await db.filter('tokenPurchases', p => p.userId === me.id && p.status === 'requested');
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const boughtToday = (await db.filter('tokenPurchases', p => p.userId === me.id && ['paid', 'requested'].includes(p.status) && new Date(p.createdAt).getTime() > dayAgo)).reduce((t, p) => t + (p.priceUsd || 0), 0);
  res.json({
    enabled: s.enabled,
    feeOnlyEnabled: s.feeOnlyEnabled,
    maxBalance: s.maxBalance,
    dailyLimitUsd: s.dailyLimitUsd,
    boughtTodayUsd: tokens.money(boughtToday),
    balance: bal,
    balanceLocal: loc.convert(bal),
    tokenLocal: loc.convert(1), // what 1 token is worth in local money today
    currency: { code: loc.currency.code, symbol: loc.currency.symbol, name: loc.currency.name, approximate: loc.currency.code !== 'USD' },
    packs: s.packs.map(p => ({ id: p.id, label: p.label, tokens: p.tokens, bonus: p.bonus, priceUsd: p.priceUsd, priceLocal: p.priceLocal })),
    pending: pending.map(p => ({ id: p.id, packLabel: p.packLabel, tokens: p.tokens, priceUsd: p.priceUsd, priceLocal: p.priceLocal ?? null, createdAt: p.createdAt })),
    history: lines.slice(-50).reverse().map(tokens.publicLine),
    verified: me.verified === true,
    // v118: what this pro pays with tokens
    autopay: tokens.autopayOf(me),
    jobFee: s.jobFee && s.jobFee.enabled ? s.jobFee : null,
    planInvoices: (await db.filter('planInvoices', i => i.providerId === me.id && i.status === 'open')).map(i => ({ id: i.id, period: i.period, plan: i.plan, amountUsd: i.amountUsd, paidUsd: i.paidUsd || 0, owedUsd: tokens.money(i.amountUsd - (i.paidUsd || 0)), localPrice: i.localPrice, currencyCode: i.currencyCode, currencySymbol: i.currencySymbol })),
    // v117: pay by sending mobile money yourself, with a code from Trothen
    canPayByCode: s.momoAccounts.length > 0,
    payTo: s.momoAccounts,
    codes: (await db.filter('tokenPurchases', p => p.userId === me.id && p.method === 'mobile_money_code' && (tokens.OPEN_STATUSES.includes(p.status) || Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000)))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10).map(tokens.publicCode),
  });
});

// PUT /api/tokens/autopay { commission, plan, ad, pass } — which bills this pro pays from tokens first.
router.put('/tokens/autopay', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const b = req.body || {};
  const next = { ...tokens.autopayOf(me) };
  for (const k of tokens.AUTOPAY_KEYS) if (b[k] !== undefined) next[k] = b[k] === true;
  await db.update('users', me.id, { tokenAutoPay: next });
  res.json({ autopay: next });
});
// POST /api/tokens/plan-invoices/:id/pay — pay an open plan fee from tokens now.
router.post('/tokens/plan-invoices/:id/pay', requireAuth, requireRole('provider'), buyLimiter, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const r = await tokens.payPlanInvoice(me, req.params.id);
  if (!r.ok) return res.status(r.status || 400).json({ code: r.code, error: r.error });
  res.json({ paid: r.paid, left: r.left, balance: await tokens.balance(me.id) });
});

// POST /api/tokens/payment-code { packId, expectedPrice, agree, requestId }
router.post('/tokens/payment-code', requireAuth, requireRole('provider'), buyLimiter, async (req, res) => {
  const b = req.body || {};
  if (b.agree !== true) return res.status(400).json({ error: 'Please tick the box to say you have read how tokens work.' });
  const me = await db.find('users', u => u.id === req.user.sub);
  const r = await tokens.createPaymentCode(me, b.packId, b.expectedPrice, b.requestId);
  if (!r.ok) return res.status(r.status || 400).json({ code: r.code, price: r.price, error: r.error });
  res.status(r.repeated ? 200 : 201).json({ paymentCode: tokens.publicCode(r.purchase), repeated: !!r.repeated });
});
router.post('/tokens/payment-code/:id/paid', requireAuth, requireRole('provider'), buyLimiter, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const r = await tokens.customerReportsPaid(me, req.params.id, (req.body || {}).transactionId);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  res.json({ paymentCode: tokens.publicCode(r.purchase) });
});
router.post('/tokens/payment-code/:id/cancel', requireAuth, requireRole('provider'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const r = await tokens.customerCancelsCode(me, req.params.id);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  res.json({ paymentCode: tokens.publicCode(r.purchase) });
});

// POST /api/tokens/buy { packId, expectedPrice, agree, requestId }
// expectedPrice is the amount the customer saw: local money where they
// have one, otherwise US dollars. requestId makes a retry safe.
router.post('/tokens/buy', requireAuth, requireRole('provider'), buyLimiter, async (req, res) => {
  const b = req.body || {};
  if (b.agree !== true) return res.status(400).json({ error: 'Please tick the box to say you have read how tokens work.' });
  const me = await db.find('users', u => u.id === req.user.sub);
  const r = await tokens.buy(me, b.packId, b.expectedPrice, b.requestId);
  if (!r.ok) return res.status(r.status || 400).json({ code: r.code, price: r.price, error: r.error });
  res.status(r.repeated ? 200 : 201).json({ purchase: { id: r.purchase.id, status: r.purchase.status, tokens: r.purchase.tokens, priceUsd: r.purchase.priceUsd, priceLocal: r.purchase.priceLocal ?? null }, repeated: !!r.repeated, balance: await tokens.balance(me.id) });
});

// ── ADMIN ──────────────────────────────────────────────────────────────
// Looking: super admins, customer service (to answer a pro's
// question about their balance) and the finance team. Changing settings or a
// balance: super admins only, and every change is logged.
const TOKEN_VIEW_DEPARTMENTS = ['customer_service', 'financial', 'accountant', 'controller'];
async function adminGate(req, res, next) {
  const m = await db.find('users', u => u.id === req.user.sub);
  if (!m || m.active === false) return res.status(403).json({ error: 'This account has been suspended.' });
  if (!m.isSuperAdmin && !TOKEN_VIEW_DEPARTMENTS.includes(m.adminDepartment)) return res.status(403).json({ error: 'Only a super admin, customer service or the finance team can see tokens.' });
  req.adminUser = m; next();
}
const gate = [requireAuth, requireRole('admin'), adminGate];
const superOnly = (req, res, next) => (req.adminUser && req.adminUser.isSuperAdmin ? next() : res.status(403).json({ error: 'This action requires a super admin account' }));
async function logIt(req, what, id) {
  try { await require('../access-log').logAccess(req, what, id); } catch (e) { /* never block on the log */ }
}

router.get('/admin/tokens', gate, async (req, res) => {
  await logIt(req, 'tokens_overview');
  const st = await tokens.stats();
  const userIds = [...new Set(st.recent.map(l => l.userId))];
  const users = await db.filter('users', u => userIds.includes(u.id));
  const nameOf = (id) => { const u = users.find(x => x.id === id); return u ? u.name : 'Unknown'; };
  res.json({
    settings: await tokens.settings(),
    canEdit: req.adminUser.isSuperAdmin === true,
    canRecordPayments: req.adminUser.isSuperAdmin === true || ['financial', 'accountant', 'controller'].includes(req.adminUser.adminDepartment),
    offlineMethods: tokens.OFFLINE_METHODS,
    countryList: Object.keys(require('../currency-data').CURRENCY_BY_COUNTRY).sort(),
    stats: { ...st, recent: st.recent.map(l => ({ ...tokens.publicLine(l), userId: l.userId, customer: nameOf(l.userId), actorName: l.actorName || null })) },
  });
});

router.patch('/admin/tokens/settings', gate, superOnly, async (req, res) => {
  const b = req.body || {};
  const before = await tokens.settings();
  if (b.packs !== undefined) {
    const list = Array.isArray(b.packs) ? b.packs.map(p => ({ id: String(p.id || '').trim().toLowerCase(), label: String(p.label || '').trim(), priceUsd: tokens.money(p.priceUsd), tokens: tokens.money(p.tokens) })) : null;
    if (!list || list.length < 1 || list.length > 8 || list.some(p => !tokens.cleanPack(p)) || new Set(list.map(p => p.id)).size !== list.length) {
      return res.status(400).json({ error: 'Packs: between 1 and 8. Each needs a short code (letters, numbers, - or _), a name (2 to 30 characters), a price from US$0.50 to $1,000, and at least as many tokens as dollars (more = bonus), up to 2,000. No two codes the same.' });
    }
    await setSetting('tokenPacks', list);
  }
  if (b.enabled !== undefined) await setSetting('tokensEnabled', b.enabled === true);
  if (b.feeOnlyEnabled !== undefined) await setSetting('tokensFeeOnlyEnabled', b.feeOnlyEnabled === true);
  if (b.jobFeeDefault !== undefined) {
    const f = tokens.cleanJobFee(b.jobFeeDefault);
    if (!f) return res.status(400).json({ error: 'Job fee: a flat amount from 0 to 100 tokens, a percent of the job from 0 to 20, and a most-per-job from 0 to 200 (0 = no cap).' });
    await setSetting('tokenJobFeeDefault', f);
  }
  if (b.dailyLimitUsd !== undefined) {
    const n = Number(b.dailyLimitUsd);
    if (!Number.isFinite(n) || n < 1 || n > 10000) return res.status(400).json({ error: 'The daily buying limit must be from $1 to $10,000.' });
    await setSetting('tokenDailyLimitUsd', Math.round(n * 100) / 100);
  }
  if (b.countries !== undefined) {
    const { CURRENCY_BY_COUNTRY } = require('../currency-data');
    const list = Array.isArray(b.countries) ? [...new Set(b.countries.map(c => String(c).trim()).filter(Boolean))] : null;
    if (!list || list.some(c => c.length > 60)) return res.status(400).json({ error: 'Countries must be a list of country names (empty = every country).' });
    const unknown = list.filter(c => !CURRENCY_BY_COUNTRY[c]);
    if (unknown.length) return res.status(400).json({ error: `Not a country Trothen knows: ${unknown.join(', ')}` });
    await setSetting('tokenCountries', list);
  }
  if (b.countryRule !== undefined) {
    // One country's rule at a time: { country, enabled, maxBalance, dailyLimitUsd, packs } or { country, remove: true }
    const r = b.countryRule || {};
    const country = String(r.country || '').trim();
    const { CURRENCY_BY_COUNTRY } = require('../currency-data');
    if (!CURRENCY_BY_COUNTRY[country]) return res.status(400).json({ error: 'Choose a country.' });
    const rules = { ...(before.countryRules || {}) };
    if (r.remove === true) delete rules[country];
    else {
      // Anything not sent is kept as it was, so saving one part (say the
      // mobile money numbers) never wipes the packs or limits.
      const prev = before.countryRules[country] || {};
      const rule = {};
      if (r.enabled === false || (r.enabled === undefined && prev.enabled === false)) rule.enabled = false;
      if (r.maxBalance === undefined && prev.maxBalance != null) rule.maxBalance = prev.maxBalance;
      if (r.dailyLimitUsd === undefined && prev.dailyLimitUsd != null) rule.dailyLimitUsd = prev.dailyLimitUsd;
      if (r.packs === undefined && Array.isArray(prev.packs)) rule.packs = prev.packs;
      if (r.jobFee === undefined && prev.jobFee) rule.jobFee = prev.jobFee;
      if (r.jobFee !== undefined && r.jobFee !== null) {
        const f = tokens.cleanJobFee(r.jobFee);
        if (!f) return res.status(400).json({ error: `${country} job fee: a flat amount from 0 to 100 tokens, a percent of the job from 0 to 20, and a most-per-job from 0 to 200 (0 = no cap).` });
        rule.jobFee = f;
      }
      if (r.maxBalance !== undefined && r.maxBalance !== null && r.maxBalance !== '') {
        const n = Number(r.maxBalance);
        if (!Number.isInteger(n) || n < 10 || n > 10000) return res.status(400).json({ error: `${country}: the most one pro can hold must be a whole number from 10 to 10,000 tokens.` });
        rule.maxBalance = n;
      }
      if (r.dailyLimitUsd !== undefined && r.dailyLimitUsd !== null && r.dailyLimitUsd !== '') {
        const n = Number(r.dailyLimitUsd);
        if (!Number.isFinite(n) || n < 1 || n > 10000) return res.status(400).json({ error: `${country}: the daily limit must be from $1 to $10,000.` });
        rule.dailyLimitUsd = Math.round(n * 100) / 100;
      }
      if (Array.isArray(r.momoAccounts)) {
        const accs = r.momoAccounts.map(a => ({ network: String(a.network || '').trim(), number: String(a.number || '').trim(), accountName: String(a.accountName || '').trim() })).filter(a => a.network || a.number || a.accountName);
        if (accs.length > 4 || accs.some(a => a.network.length < 2 || a.network.length > 40 || !/^[0-9+ ()-]{6,20}$/.test(a.number) || a.accountName.length < 2 || a.accountName.length > 60)) {
          return res.status(400).json({ error: `${country}: up to 4 mobile money numbers, each with a network (e.g. MTN MoMo), a number (digits only, 6 to 20) and the account name pros will see when they send.` });
        }
        rule.momoAccounts = accs;
      } else if (before.countryRules[country] && before.countryRules[country].momoAccounts) rule.momoAccounts = before.countryRules[country].momoAccounts;
      if (Array.isArray(r.packs) && r.packs.length) {
        const list = r.packs.map(p => ({ id: String(p.id || '').trim().toLowerCase(), label: String(p.label || '').trim(), priceUsd: tokens.money(p.priceUsd), tokens: tokens.money(p.tokens), ...(p.localPrice !== undefined && p.localPrice !== null && p.localPrice !== '' ? { localPrice: Number(p.localPrice) } : {}) }));
        if (list.length > 8 || list.some(p => !tokens.cleanCountryPack(p)) || new Set(list.map(p => p.id)).size !== list.length) {
          return res.status(400).json({ error: `${country} packs: up to 8. Each needs a short code, a name, a US$ price from 0.50 to 1,000, at least as many tokens as dollars, and (optional) a fixed local price above 0. No two codes the same.` });
        }
        rule.packs = list;
      }
      rules[country] = rule;
    }
    await setSetting('tokenCountryRules', rules);
  }
  if (b.maxBalance !== undefined) {
    const n = Number(b.maxBalance);
    if (!Number.isInteger(n) || n < 10 || n > 10000) return res.status(400).json({ error: 'The most one pro can hold must be a whole number from 10 to 10,000 tokens.' });
    await setSetting('tokenMaxBalance', n);
  }
  const after = await tokens.settings();
  await logIt(req, 'tokens_settings_change', JSON.stringify({ before: { enabled: before.enabled, feeOnly: before.feeOnlyEnabled, max: before.maxBalance, day: before.dailyLimitUsd, countries: before.countries, rules: Object.keys(before.countryRules || {}), packs: before.packs.map(p => `${p.id}:${p.priceUsd}/${p.tokens}`) }, after: { enabled: after.enabled, feeOnly: after.feeOnlyEnabled, max: after.maxBalance, day: after.dailyLimitUsd, countries: after.countries, rules: Object.keys(after.countryRules || {}), packs: after.packs.map(p => `${p.id}:${p.priceUsd}/${p.tokens}`) } }).slice(0, 250));
  res.json({ settings: after });
});

// GET /api/admin/tokens/customer?q=email-or-name — one pro's balance and history.
router.get('/admin/tokens/customer', gate, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 3) return res.status(400).json({ error: 'Type at least 3 letters of the pro\'s email or name.' });
  const matches = (await db.filter('users', u => u.role === 'provider' && ((u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)))).slice(0, 10);
  const out = [];
  for (const u of matches) {
    const lines = await tokens.ledgerOf(u.id);
    const cs = await tokens.settingsFor(u.country);
    out.push({ id: u.id, name: u.name, email: u.email, country: u.country || null, verified: u.verified === true, currency: cs.currency, packs: cs.packs.map(p => ({ id: p.id, label: p.label, tokens: p.tokens, priceUsd: p.priceUsd, priceLocal: p.priceLocal })), balance: await tokens.balance(u.id), shownBalance: u.tokenBalance ?? null, history: lines.slice(-30).reverse().map(l => ({ ...tokens.publicLine(l), actorName: l.actorName || null })) });
    await logIt(req, 'tokens_customer_view', u.id);
  }
  res.json({ customers: out });
});

// POST /api/admin/tokens/adjust { userId, tokens, reason } — super admin only.
router.post('/admin/tokens/adjust', gate, superOnly, async (req, res) => {
  const b = req.body || {};
  const r = await tokens.adminAdjust(req.adminUser, b.userId, Number(b.tokens), b.reason);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  await logIt(req, 'tokens_adjust', `${b.userId} ${r.line.tokens}`.slice(0, 250));
  res.status(201).json({ line: tokens.publicLine(r.line) });
});


// GET /api/admin/tokens/country?country=Liberia — what pros in one
// country see: packs in local money, and whether a fixed local price has
// drifted from today's exchange rate (it then gives too much or too little).
router.get('/admin/tokens/country', gate, async (req, res) => {
  const country = String(req.query.country || '').trim();
  const { CURRENCY_BY_COUNTRY } = require('../currency-data');
  if (!CURRENCY_BY_COUNTRY[country]) return res.status(400).json({ error: 'Choose a country.' });
  const all = await tokens.settings();
  const s = await tokens.settingsFor(country);
  const rule = all.countryRules[country] || null;
  res.json({
    country, currency: s.currency, rate: s.rate, enabled: s.enabled, maxBalance: s.maxBalance, dailyLimitUsd: s.dailyLimitUsd, jobFee: s.jobFee,
    hasOwnRule: !!rule, rule,
    packs: s.packs.map(p => {
      const driftPct = p.listUsd > 0 ? Math.round(((p.priceUsd - p.listUsd) / p.listUsd) * 1000) / 10 : 0;
      return { ...p, driftPct, drifted: p.fixedLocal && Math.abs(driftPct) >= 5 };
    }),
  });
});

// POST /api/admin/tokens/offline-topup — a payment made outside the app
// (cash at an office or agent, a bank deposit, mobile money sent to
// Trothen's own number). Super admins and the finance team only.
const FINANCE_DEPARTMENTS = ['financial', 'accountant', 'controller'];
const financeOnly = (req, res, next) => (req.adminUser && (req.adminUser.isSuperAdmin || FINANCE_DEPARTMENTS.includes(req.adminUser.adminDepartment)) ? next() : res.status(403).json({ error: 'Only a super admin or the finance team can record a payment.' }));
router.post('/admin/tokens/offline-topup', gate, financeOnly, async (req, res) => {
  const b = req.body || {};
  const r = await tokens.recordOfflineTopUp(req.adminUser, { userId: b.userId, packId: b.packId || null, amountPaid: b.amountPaid, method: b.method, receipt: b.receipt, note: b.note });
  if (!r.ok) return res.status(r.status || 400).json({ code: r.code, error: r.error });
  await logIt(req, 'tokens_offline_topup', `${b.userId} ${r.purchase.tokens} ${b.method} ${r.purchase.receipt}`.slice(0, 250));
  res.status(201).json({ purchase: r.purchase, line: tokens.publicLine(r.line) });
});


// ── v117: mobile money payment codes (finance team) ────────────────────
// GET /api/admin/tokens/codes?status=open|all&q=CODE — codes to check.
router.get('/admin/tokens/codes', gate, async (req, res) => {
  const q = String(req.query.q || '').trim().toUpperCase();
  const all = await db.filter('tokenPurchases', p => p.method === 'mobile_money_code');
  let rows = q ? all.filter(p => p.paymentCode === q || (p.customerTransactionId || '').toUpperCase() === q) : (req.query.status === 'all' ? all : all.filter(p => ['customer_says_paid', 'awaiting_payment'].includes(p.status)));
  // the ones a customer says they've paid come first, oldest first
  rows = rows.sort((a, b) => (a.status === 'customer_says_paid' ? 0 : 1) - (b.status === 'customer_says_paid' ? 0 : 1) || String(a.createdAt).localeCompare(String(b.createdAt))).slice(0, 100);
  const users = await db.filter('users', u => rows.some(r => r.userId === u.id));
  await logIt(req, 'tokens_codes_view');
  res.json({ codes: rows.map(p => { const u = users.find(x => x.id === p.userId) || {}; return { ...tokens.publicCode(p), customer: u.name || 'Unknown', email: u.email || null, phone: u.phone || null, country: u.country || null, receipt: p.receipt || null, amountReceived: p.amountReceived ?? null, recordedByName: p.recordedByName || null }; }) });
});
router.post('/admin/tokens/codes/confirm', gate, financeOnly, async (req, res) => {
  const b = req.body || {};
  const r = await tokens.confirmPaymentCode(req.adminUser, b.code, b.transactionId, b.amountReceived);
  if (!r.ok) return res.status(r.status || 400).json({ code: r.code, error: r.error });
  await logIt(req, 'tokens_code_confirm', `${r.purchase.paymentCode} ${r.purchase.receipt} ${r.purchase.amountReceived}`.slice(0, 250));
  res.json({ paymentCode: tokens.publicCode(r.purchase), line: tokens.publicLine(r.line) });
});
router.post('/admin/tokens/codes/reject', gate, financeOnly, async (req, res) => {
  const b = req.body || {};
  const r = await tokens.rejectPaymentCode(req.adminUser, b.code, b.reason);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  await logIt(req, 'tokens_code_reject', String(b.code).slice(0, 40));
  res.json({ paymentCode: tokens.publicCode(r.purchase) });
});

module.exports = router;
