// v132: how Trothen's commission is worked out and how it is paid.
//
// There are three ways a pro pays commission:
//   1. Jobs paid through Trothen (escrow): the commission is taken from the
//      payout when the pro requests it. If the pro chose "pay my commission
//      with tokens", tokens cover as much of it as their balance allows and
//      the pro keeps that much more of the payout.
//   2. Cash jobs (the customer pays the pro directly): the commission is paid
//      with tokens when the pro accepts the job (see chargeCashCommission in
//      src/tokens.js), and corrected or given back later if needed.
//   3. A top-scorer free-commission credit makes one payout commission-free.
// Tips and goods sold from a pro's store never carry commission. Rides carry
// the lower ride rate, and none at all while the driver has a Driver Pass.
//
// calcPayout() is the single calculation used both to preview a payout on the
// Earnings page and to make the real payout, so the two can never disagree.
// It reads only; it changes nothing.
const db = require('./db');
const { effectiveCommissionRate } = require('./commission');

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;

function rateSourceOf(provider, organization) {
  if (provider && provider.commissionRateOverrideStatus === 'approved' && provider.commissionRateOverride != null) return 'override';
  if (organization && organization.commissionRate != null) return 'organization';
  return 'plan';
}

async function ratesFor(provider) {
  const organization = provider && provider.organizationId ? await db.find('organizations', o => o.id === provider.organizationId && o.status !== 'suspended') : null;
  const baseRate = effectiveCommissionRate(provider, organization);
  const freeCredit = ((provider && provider.freeCommissionCredits) || 0) > 0;
  const commissionRate = freeCredit ? 0 : baseRate;
  const rideSharePct = Number(await require('./platform-settings').getSetting('rideCommissionPercent'));
  const rideRate = freeCredit ? 0 : Math.min(commissionRate, (Number.isFinite(rideSharePct) ? rideSharePct : 5) / 100);
  const baseRideRate = Math.min(baseRate, (Number.isFinite(rideSharePct) ? rideSharePct : 5) / 100);
  return { organization, baseRate, baseRideRate, commissionRate, rideRate, freeCredit, rateSource: rateSourceOf(provider, organization) };
}

// The commission on one escrow record, before rounding is balanced.
function escrowLineCommission(e, contract, rates) {
  const base = Math.max(0, (e.amount || 0) - (e.materialsAdvanceAmount || 0));
  const goods = Math.min(e.storeGoodsAmount || 0, base);
  const ride = !!(contract && contract.ride);
  const passFree = ride && contract.ride.commissionFree === true;
  const rate = passFree ? 0 : ride ? rates.rideRate : rates.commissionRate;
  let note = null;
  if (rates.freeCredit) note = 'Free-commission credit';
  else if (passFree) note = 'Driver Pass: no commission';
  else if (ride) note = 'Ride rate';
  if (goods > 0) note = (note ? note + '. ' : '') + `Store goods ($${cents(goods)}) carry no commission`;
  return { base: cents(base), goods: cents(goods), rate, raw: (base - goods) * rate, storeFee: cents(Math.min(e.storeFeeFromPro || 0, base)), note };
}

// Makes the per-job amounts add up exactly to the payout total.
function balanceLines(lines, total) {
  lines.forEach(l => { l.commission = cents(l.raw || 0); delete l.raw; });
  const diff = cents(total - lines.reduce((s, l) => s + l.commission, 0));
  if (Math.abs(diff) >= 0.01) {
    const biggest = lines.filter(l => l.commission > 0).sort((a, b) => b.commission - a.commission)[0];
    if (biggest) biggest.commission = cents(biggest.commission + diff);
  }
  lines.forEach(l => { l.youReceive = cents(l.amount - l.commission - (l.storeFee || 0)); });
  return lines;
}

async function calcPayout(provider) {
  const providerId = provider.id;
  const releasedEscrow = await db.filter('escrowTransactions', e => e.status === 'released' && !e.payoutId);
  const contracts = await db.filter('contracts', c => c.providerId === providerId);
  const contractIds = new Set(contracts.map(c => c.id));
  // v119: once "only pay out money Trothen really received" is on, a payout
  // only includes bookings whose money truly arrived.
  const realOnly = (await require('./platform-settings').getSetting('payoutsRequireRealPayment')) === true;
  const reallyPaid = (e) => !realOnly || e.paidBy === 'code' || e.paidBy === 'card' || !!e.liberiaMoMoReference; // v125: card payments are real money too
  const payableEscrow = releasedEscrow.filter(e => contractIds.has(e.contractId) && reallyPaid(e));
  // Materials advances are released as soon as they are agreed, so they are
  // tracked with their own payout field.
  const allEscrowForProvider = await db.filter('escrowTransactions', e => contractIds.has(e.contractId));
  const payableAdvances = allEscrowForProvider.filter(e =>
    e.materialsAdvanceReleased && e.materialsAdvanceAmount > 0 && !e.materialsAdvancePayoutId && e.status !== 'refunded' && reallyPaid(e)
  );
  const grossAmount = cents(payableEscrow.reduce((sum, e) => sum + (e.amount - (e.materialsAdvanceAmount || 0)), 0)
    + payableAdvances.reduce((sum, e) => sum + e.materialsAdvanceAmount, 0));
  // Tips are added after commission is worked out, so a tip never carries commission.
  const unpaidTipContracts = contracts.filter(c => c.tipAmount > 0 && !c.tipPaid);
  const totalTips = cents(unpaidTipContracts.reduce((sum, c) => sum + c.tipAmount, 0));

  const rates = await ratesFor(provider);
  const { commissionRate, rideRate } = rates;
  // v105: goods from the pro's store carry no commission.
  const storeGoodsAmount = cents(payableEscrow.reduce((sum, e) => sum + Math.min(e.storeGoodsAmount || 0, Math.max(0, e.amount - (e.materialsAdvanceAmount || 0))), 0));
  const commissionableAmount = Math.max(0, cents(grossAmount - storeGoodsAmount));
  // v111: rides carry their own, lower commission. v113: none with a Driver Pass.
  const rideGross = cents(payableEscrow.reduce((sum, e) => {
    const c = contracts.find(x => x.id === e.contractId);
    return c && c.ride ? sum + Math.max(0, e.amount - (e.materialsAdvanceAmount || 0)) : sum;
  }, 0));
  const ridePassFree = cents(payableEscrow.reduce((sum, e) => {
    const c = contracts.find(x => x.id === e.contractId);
    return c && c.ride && c.ride.commissionFree === true ? sum + Math.max(0, e.amount - (e.materialsAdvanceAmount || 0)) : sum;
  }, 0));
  const rideCommission = cents(Math.min(Math.max(0, rideGross - ridePassFree), commissionableAmount) * rideRate);
  const commissionAmount = cents(Math.max(0, commissionableAmount - rideGross) * commissionRate + rideCommission);
  // v106: store purchase fees the pro pays.
  const storeFeeAmount = cents(payableEscrow.reduce((sum, e) => sum + Math.min(e.storeFeeFromPro || 0, Math.max(0, e.amount - (e.materialsAdvanceAmount || 0))), 0));

  // Which jobs and customers make up the payout, with the commission on each.
  const lineItems = [];
  const customerOf = async (c) => db.find('users', u => u.id === c.customerId);
  for (const e of payableEscrow) {
    const contract = contracts.find(c => c.id === e.contractId);
    if (!contract) continue;
    const newlyPayable = e.amount - (e.materialsAdvanceAmount || 0);
    if (newlyPayable <= 0) continue; // the whole amount was already an advance
    const customer = await customerOf(contract);
    const review = await db.find('reviews', r => r.contractId === contract.id);
    const lc = escrowLineCommission(e, contract, rates);
    lineItems.push({
      contractId: contract.id,
      bookingNumber: contract.bookingNumber || contract.id,
      customerName: customer ? customer.name : 'Unknown customer',
      customerEmail: customer ? customer.email : null,
      customerPhone: customer ? customer.phone : null,
      service: contract.service,
      jobDate: contract.date || null,
      jobTime: contract.time || null,
      address: contract.address || null,
      contractStatus: contract.status,
      signedAt: contract.signedAt || (contract.createdAt || '').slice(0, 10),
      review: review ? { stars: review.stars, text: review.text || null } : null,
      amount: newlyPayable,
      kind: contract.ride ? 'ride' : 'job',
      commissionRate: lc.rate, raw: lc.raw, storeFee: lc.storeFee, commissionNote: lc.note,
    });
  }
  for (const e of payableAdvances) {
    const contract = contracts.find(c => c.id === e.contractId);
    if (!contract) continue;
    const customer = await customerOf(contract);
    lineItems.push({
      contractId: contract.id,
      bookingNumber: contract.bookingNumber || contract.id,
      customerName: customer ? customer.name : 'Unknown customer',
      customerEmail: customer ? customer.email : null,
      customerPhone: customer ? customer.phone : null,
      service: `${contract.service} (materials advance)`,
      jobDate: contract.date || null,
      jobTime: contract.time || null,
      address: contract.address || null,
      contractStatus: contract.status,
      signedAt: contract.signedAt || (contract.createdAt || '').slice(0, 10),
      review: null,
      amount: e.materialsAdvanceAmount,
      kind: 'advance',
      commissionRate, raw: e.materialsAdvanceAmount * commissionRate, storeFee: 0, commissionNote: rates.freeCredit ? 'Free-commission credit' : null,
    });
  }
  balanceLines(lineItems, commissionAmount);
  for (const c of unpaidTipContracts) {
    const customer = await customerOf(c);
    lineItems.push({
      contractId: c.id,
      bookingNumber: c.bookingNumber || c.id,
      customerName: customer ? customer.name : 'Unknown customer',
      customerEmail: customer ? customer.email : null,
      customerPhone: customer ? customer.phone : null,
      service: `${c.service} (tip, no commission)`,
      jobDate: c.date || null,
      jobTime: c.time || null,
      address: c.address || null,
      contractStatus: c.status,
      signedAt: c.signedAt || (c.createdAt || '').slice(0, 10),
      review: null,
      amount: c.tipAmount,
      kind: 'tip',
      commissionRate: 0, commission: 0, storeFee: 0, youReceive: c.tipAmount, commissionNote: 'Tips carry no commission',
    });
  }

  return {
    contracts, payableEscrow, payableAdvances, unpaidTipContracts,
    grossAmount, totalTips, storeGoodsAmount, commissionableAmount,
    rideGross, ridePassFree, rideRate, commissionRate, rates,
    usedFreeCommissionCredit: rates.freeCredit,
    commissionAmount, storeFeeAmount, lineItems,
  };
}

// What a payout would look like if the pro requested it now, including how
// much of the commission tokens would cover and any plan fee.
async function previewPayout(provider) {
  const calc = await calcPayout(provider);
  const tokens = require('./tokens');
  let tokensWouldCover = 0, tokensEnabled = false, balance = 0;
  const autopay = tokens.autopayOf(provider).commission;
  try {
    tokensEnabled = !!(await tokens.settingsFor(provider.country)).enabled;
    balance = await tokens.balance(provider.id);
  } catch (e) { /* tokens are optional */ }
  if (autopay && tokensEnabled && calc.commissionAmount > 0) tokensWouldCover = cents(Math.max(0, Math.min(balance, calc.commissionAmount))); // spendUpTo never takes a balance below zero
  let net = cents(calc.grossAmount - calc.commissionAmount + tokensWouldCover - calc.storeFeeAmount + calc.totalTips);
  const planFee = await require('./plan-billing').planDeduction(provider.id, net);
  net = cents(net - planFee.amount);
  return {
    calc,
    summary: {
      grossAmount: calc.grossAmount, tips: calc.totalTips, commissionRate: calc.commissionRate, commissionAmount: calc.commissionAmount,
      commissionWithTokens: tokensWouldCover, commissionFromPayout: cents(calc.commissionAmount - tokensWouldCover),
      storeFeeAmount: calc.storeFeeAmount, planFeeAmount: planFee.amount, net, freeCreditApplies: calc.usedFreeCommissionCredit,
      lines: calc.lineItems.map(l => ({ contractId: l.contractId, bookingNumber: l.bookingNumber, service: l.service, customerName: l.customerName, kind: l.kind, amount: l.amount, commissionRate: l.commissionRate, commission: l.commission, storeFee: l.storeFee || 0, youReceive: l.youReceive, note: l.commissionNote || null })),
    },
    tokens: { enabled: tokensEnabled, autopayCommission: autopay, balance },
  };
}

// Everything the pro's "How Your Commission Is Paid" section needs.
async function providerCommissionSummary(provider) {
  const { calc, summary, tokens: tok } = await previewPayout(provider);
  const { rates } = calc;
  const contracts = calc.contracts;
  const rows = [];

  // Jobs waiting for the customer to confirm: commission is due once released.
  const held = await db.filter('escrowTransactions', e => e.status === 'held' && contracts.some(c => c.id === e.contractId));
  for (const e of held) {
    const c = contracts.find(x => x.id === e.contractId);
    const lc = escrowLineCommission(e, c, rates);
    rows.push({ date: (c.signedAt || c.createdAt || '').slice(0, 10), bookingNumber: c.bookingNumber || c.id, contractId: c.id, service: c.service, amount: lc.base, commissionRate: lc.rate, commission: cents(lc.raw), how: 'payout', status: 'pending', note: lc.note });
  }
  // Released and waiting for the next payout.
  for (const l of summary.lines) {
    if (l.kind === 'tip') continue;
    const c = contracts.find(x => x.id === l.contractId);
    rows.push({ date: c ? (c.completedAt || c.signedAt || c.createdAt || '').slice(0, 10) : '', bookingNumber: l.bookingNumber, contractId: l.contractId, service: l.service, amount: l.amount, commissionRate: l.commissionRate, commission: l.commission, how: summary.commissionWithTokens > 0 ? (summary.commissionWithTokens >= summary.commissionAmount ? 'tokens-at-payout' : 'payout-tokens') : 'payout', status: 'due', note: l.note });
  }
  // Paid in past payouts.
  const payouts = await db.filter('payouts', p => p.providerId === provider.id);
  let fromPayouts = 0, withTokensAtPayout = 0;
  for (const p of payouts) {
    const com = p.commissionAmount || 0;
    const tokPart = p.commissionPaidWithTokens || 0;
    fromPayouts += com - tokPart; withTokensAtPayout += tokPart;
    const items = (p.lineItems || []).filter(li => li.kind !== 'tip' && typeof li.commission === 'number');
    if (items.length) {
      for (const li of items) rows.push({ date: p.date, bookingNumber: li.bookingNumber, contractId: li.contractId, service: li.service, amount: li.amount, commissionRate: li.commissionRate, commission: li.commission, how: tokPart > 0 ? (tokPart >= com ? 'tokens-at-payout' : 'payout-tokens') : 'payout', status: 'paid', payoutId: p.id, note: li.commissionNote || null });
    } else if (com > 0 || p.grossAmount) {
      // Payouts made before v132 kept only the total.
      rows.push({ date: p.date, bookingNumber: null, service: `Payout ${p.id} (${(p.lineItems || []).length || 'several'} job${(p.lineItems || []).length === 1 ? '' : 's'})`, amount: p.grossAmount != null ? p.grossAmount : null, commissionRate: p.commissionRate != null ? p.commissionRate : null, commission: com, how: tokPart > 0 ? (tokPart >= com ? 'tokens-at-payout' : 'payout-tokens') : 'payout', status: 'paid', payoutId: p.id, note: com > 0 ? null : 'No commission on this payout' });
    }
  }
  // Cash jobs: paid with tokens when the job was accepted.
  const ledger = await db.filter('tokenLedger', l => l.userId === provider.id && l.refKind === 'cashjob');
  let cashJobTokens = 0;
  for (const c of contracts.filter(x => x.payMethod === 'cash' && x.cashCommission)) {
    const ref = `cashjob:${c.id}`;
    const lines = ledger.filter(l => l.ref === ref);
    const taken = cents(-lines.filter(l => l.kind === 'spend').reduce((s, l) => s + (Number(l.tokens) || 0), 0));
    const back = cents(lines.filter(l => l.kind === 'refund').reduce((s, l) => s + (Number(l.tokens) || 0), 0));
    const net = cents(taken - back);
    cashJobTokens += net;
    const free = !!c.cashCommission.freeCredit;
    rows.push({
      date: (c.cashCommission.takenAt || c.signedAt || c.createdAt || '').slice(0, 10), bookingNumber: c.bookingNumber || c.id, contractId: c.id, service: c.service,
      amount: c.amount, commissionRate: free ? 0 : c.cashCommission.rate, commission: net, tokens: net, how: free ? 'free-credit' : 'cash-tokens',
      status: free ? 'free' : (taken > 0 && net <= 0.004 ? 'returned' : 'paid'),
      note: free ? 'Free-commission credit' : back > 0 && net > 0 ? `${back} tokens were given back after the price changed` : (taken > 0 && net <= 0.004 ? 'Given back because the job did not go ahead' : null),
    });
  }
  // The debt line (commission owed from an earlier cash job) is part of cashJobTokens through the ledger above only when it carries the job ref, so add what was paid off separately.
  const debtPaid = cents(-ledger.filter(l => String(l.ref || '').startsWith('debt:')).reduce((s, l) => s + (Number(l.tokens) || 0), 0));
  cashJobTokens = cents(cashJobTokens + debtPaid);

  const order = { pending: 0, due: 1, paid: 2, free: 2, returned: 2 };
  rows.sort((a, b) => (order[a.status] - order[b.status]) || String(b.date).localeCompare(String(a.date)));
  return {
    rate: rates.baseRate, rideRate: rates.baseRideRate, rateSource: rates.rateSource, plan: provider.plan || 'starter',
    organizationName: rates.rateSource === 'organization' && rates.organization ? rates.organization.name : null,
    freeCommissionCredits: provider.freeCommissionCredits || 0,
    tokens: tok,
    tokenDebt: cents(provider.tokenDebt || 0),
    available: summary,
    totals: { fromPayouts: cents(fromPayouts), withTokensAtPayout: cents(withTokensAtPayout), cashJobTokens, all: cents(fromPayouts + withTokensAtPayout + cashJobTokens), dueNow: summary.commissionAmount, pending: cents(rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission, 0)) },
    rows,
  };
}

// For admins: every commission Trothen has received, and how it was paid.
// `inScope(provider)` limits it to an admin's region.
async function commissionLedger(inScope, { from, to } = {}) {
  const providers = new Map((await db.filter('users', u => u.role === 'provider')).map(u => [u.id, u]));
  const ok = (id) => { const p = providers.get(id); return !!p && inScope(p); };
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const rows = [];
  for (const p of await db.all('payouts')) {
    if (!ok(p.providerId) || !inRange(p.date || '')) continue;
    const com = p.commissionAmount || 0, tokPart = p.commissionPaidWithTokens || 0;
    if (!(com > 0) && !(p.storeFeeAmount > 0) && !p.freeCommissionCreditUsed) continue;
    const jobs = (p.lineItems || []).filter(li => li.kind !== 'tip' && !/\(tip/.test(li.service || ''));
    rows.push({
      date: p.date, kind: 'payout', providerId: p.providerId, providerName: providers.get(p.providerId).name, reference: p.id,
      bookings: [...new Set(jobs.map(li => li.bookingNumber).filter(Boolean))],
      earned: p.grossAmount != null ? p.grossAmount : null, commissionRate: p.commissionRate != null ? p.commissionRate : null,
      commission: cents(com), fromPayout: cents(com - tokPart), withTokens: cents(tokPart), storeFee: cents(p.storeFeeAmount || 0),
      freeCredit: !!p.freeCommissionCreditUsed, status: p.status || 'processing',
    });
  }
  const ledger = await db.filter('tokenLedger', l => l.refKind === 'cashjob' || (l.refKind === 'debt'));
  const byRef = new Map();
  for (const l of ledger) { if (!ok(l.userId)) continue; const k = l.ref; if (!byRef.has(k)) byRef.set(k, []); byRef.get(k).push(l); }
  const contractsById = new Map((await db.all('contracts')).map(c => [c.id, c]));
  for (const [ref, lines] of byRef) {
    const first = lines.find(l => l.kind === 'spend') || lines[0];
    const d = (first.createdAt || '').slice(0, 10);
    if (!inRange(d)) continue;
    const taken = cents(-lines.filter(l => l.kind === 'spend').reduce((s, l) => s + (Number(l.tokens) || 0), 0));
    const back = cents(lines.filter(l => l.kind === 'refund').reduce((s, l) => s + (Number(l.tokens) || 0), 0));
    const isDebt = String(ref).startsWith('debt:');
    const c = isDebt ? null : contractsById.get(String(ref).slice(String(ref).indexOf(':') + 1));
    rows.push({
      date: d, kind: isDebt ? 'debt' : 'cashjob', providerId: first.userId, providerName: providers.get(first.userId).name,
      reference: c ? (c.bookingNumber || c.id) : null, bookings: c ? [c.bookingNumber || c.id] : [],
      earned: c ? c.amount : null, commissionRate: c && c.cashCommission ? c.cashCommission.rate : null,
      commission: cents(taken - back), fromPayout: 0, withTokens: cents(taken - back), tokensReturned: back, storeFee: 0, freeCredit: false,
      status: taken - back > 0.004 ? 'paid' : 'returned',
    });
  }
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const sum = (k) => cents(rows.reduce((s, r) => s + (r[k] || 0), 0));
  return { rows, totals: { commission: sum('commission'), fromPayout: sum('fromPayout'), withTokens: sum('withTokens'), storeFee: sum('storeFee') } };
}

module.exports = { calcPayout, previewPayout, providerCommissionSummary, commissionLedger, escrowLineCommission, ratesFor, rateSourceOf, cents };
