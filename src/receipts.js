// v166: a receipt for every money movement, sent the moment it happens.
//
// Walter: "how would the receipt be sent if from the ride app and delivery
// and everything that has to do with transactions". Before this, a person
// could download a store receipt or a booking invoice in the app, but no
// receipt was ever sent, and token purchases and refunds had none at all.
//
// What Uber, Bolt, Jumia and Amazon do, and Trothen now does:
//  - A receipt for each money event:
//      payment   the customer paid (a ride, delivery, store order, booking,
//                extra work or a tip), held by Trothen until the work is done;
//      cash      a ride or job paid in cash, when it is completed;
//      refund    money given back (in full, or part of it);
//      tokens    a pro bought tokens;
//      payout    a pro's earnings were sent: the fares, Trothen's commission,
//                tips, fees, and what they received (a remittance statement).
//  - Emailed at once, with a short summary in the email and the PDF attached.
//    A receipt is a record, not a notification: it goes even to people who
//    switched off "Email me updates", and even while they have the app open.
//  - By SMS (one line with the amount, number and link) to people with no
//    email address, once an SMS service is set up (Twilio on Render).
//  - Kept in the app: Account → Receipts lists every one, to download again.
//
// How: a sweep looks at payments, refunds, token purchases and payouts, and
// issues each receipt once (its key, e.g. "pay:esc_123", is unique). It runs
// every half minute, and a few seconds after any notification (most money
// events send one). The first time it runs it only notes the time: nothing
// that happened before this version is emailed out of the blue.
const db = require('./db');
const { nanoid, customAlphabet } = require('nanoid');

const numberId = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);
const SWEEP_MS = Number(process.env.RECEIPTS_SWEEP_MS) || 30 * 1000;
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const usd = (n) => `$${money(n).toFixed(2)}`;

// What a booking is, in words.
function whatFor(c) {
  if (!c) return { kind: 'booking', words: 'Booking' };
  const n = c.bookingNumber ? ` #${c.bookingNumber}` : '';
  if (c.topUpKind === 'tip') return { kind: 'tip', words: `Tip${n}` };
  if (c.topUpKind === 'extra') return { kind: 'extra', words: `Extra work${n}: ${c.service || ''}`.trim() };
  if (c.ride) return { kind: 'ride', words: `Ride${n}` };
  if (c.delivery) return { kind: 'delivery', words: `Delivery${n} for store order #${c.delivery.orderNumber || ''}`.trim() };
  if (c.storeOrder || c.marketListingId) return { kind: 'store', words: `Store order${n}` };
  return { kind: 'booking', words: `Booking${n}: ${c.service || ''}`.trim().replace(/:$/, '') };
}
function methodWords(e) {
  const by = e && e.paidBy;
  if (by === 'card') return 'Card';
  if (by === 'momo') return 'Mobile money';
  if (by === 'code') return `Mobile money (payment code${e.receipt ? ', transaction ' + e.receipt : ''})`;
  return process.env.PAYMENTS_LIVE === 'true' ? 'Trothen payment' : 'Trothen payment (test mode: no real money moved)';
}
const paidLocal = (e) => {
  if (e && e.paidAmountLocal && e.paidCurrency && e.paidCurrency !== 'USD') return `${e.paidCurrency} ${Number(e.paidAmountLocal).toLocaleString('en-US')}`;
  if (e && e.amountReceived && e.dueCurrency && e.dueCurrency !== 'USD') return `${e.dueCurrency} ${Number(e.amountReceived).toLocaleString('en-US')}`;
  return '';
};
// Was money really paid into this record (not a code that ran out unpaid)?
const wasPaid = (e) => !!(e && (e.confirmedAt || e.receipt || e.amountReceived || !['code', 'card', 'momo'].includes(e.paidBy)));

let startedAt = null;
async function startTime() {
  if (startedAt) return startedAt;
  const ps = require('./platform-settings');
  let t = await ps.getSetting('receiptsStartedAt');
  if (!t) { t = new Date().toISOString(); await ps.setSetting('receiptsStartedAt', t); }
  startedAt = t;
  return t;
}

// Everything that should have a receipt, as { key, userId, kind, ... }.
async function dueEvents() {
  const since = await startTime();
  const after = (iso) => !!iso && String(iso) >= since;
  const out = [];
  const escrows = await db.filter('escrowTransactions', e => after(e.updatedAt || e.createdAt));
  const ids = new Set(escrows.map(e => e.contractId));
  const contracts = new Map((await db.filter('contracts', c => ids.has(c.id) || (after(c.completedAt) && (c.payMethod === 'cash' || (c.ride && c.ride.cash))))).map(c => [c.id, c]));
  for (const e of escrows) {
    const c = contracts.get(e.contractId);
    if (!c || e.transferredFrom) continue; // money moved from an earlier booking: that payment already had its receipt
    const paidAt = e.confirmedAt || e.createdAt;
    if (['held', 'released'].includes(e.status) || (e.status === 'refunded' && wasPaid(e))) {
      if (after(paidAt) && e.status !== 'awaiting_payment') out.push({ key: `pay:${e.id}`, userId: c.customerId, kind: 'payment', contractId: c.id, escrowId: e.id, at: paidAt });
    }
    if (e.status === 'refunded' && wasPaid(e) && !e.refundNotNeeded && after(e.updatedAt)) out.push({ key: `refund:${e.id}:full`, userId: c.customerId, kind: 'refund', contractId: c.id, escrowId: e.id, at: e.updatedAt, refundUsd: money((e.originalAmount || e.amount) + (e.serviceFee || 0)) });
    else if (e.refundedAmount > 0 && after(e.updatedAt)) out.push({ key: `refund:${e.id}:${money(e.refundedAmount)}`, userId: c.customerId, kind: 'refund', contractId: c.id, escrowId: e.id, at: e.updatedAt, refundUsd: money(e.refundedAmount), partial: true });
  }
  for (const c of contracts.values()) {
    if (c.status === 'completed' && after(c.completedAt) && (c.payMethod === 'cash' || (c.ride && c.ride.cash))) out.push({ key: `cash:${c.id}`, userId: c.customerId, kind: 'cash', contractId: c.id, at: c.completedAt });
  }
  for (const p of await db.filter('tokenPurchases', p => p.status === 'paid' && after(p.creditedAt || p.updatedAt || p.createdAt))) {
    out.push({ key: `tokens:${p.id}`, userId: p.userId, kind: 'tokens', purchaseId: p.id, at: p.creditedAt || p.updatedAt || p.createdAt });
  }
  for (const p of await db.filter('payouts', p => p.status === 'paid' && after(p.paidAt))) {
    out.push({ key: `payout:${p.id}`, userId: p.providerId, kind: 'payout', payoutId: p.id, at: p.paidAt });
  }
  return out;
}

// The figures of a receipt, fixed when it is issued.
async function snapshot(ev) {
  if (ev.kind === 'payment' || ev.kind === 'refund' || ev.kind === 'cash') {
    const c = await db.find('contracts', x => x.id === ev.contractId);
    const e = ev.escrowId ? await db.find('escrowTransactions', x => x.id === ev.escrowId) : null;
    const pro = c && await db.find('users', u => u.id === c.providerId);
    const w = whatFor(c);
    const base = { for: w.kind, title: w.words, bookingNumber: c && c.bookingNumber, otherName: pro ? (w.kind === 'store' && pro.store && pro.store.name) || pro.name : '', service: c && c.service };
    if (ev.kind === 'payment') {
      const amount = money(e.originalAmount || e.amount);
      return { ...base, amountUsd: money(amount + (e.serviceFee || 0)), lines: [[w.kind === 'ride' ? 'Fare' : w.kind === 'delivery' ? 'Delivery' : w.kind === 'store' ? 'Goods and delivery' : w.kind === 'tip' ? 'Tip' : 'Price', usd(amount)], ['Trothen service fee', usd(e.serviceFee)]], total: ['Total paid', usd(amount + (e.serviceFee || 0))], local: paidLocal(e), method: methodWords(e), status: `Paid. Trothen holds the money safely and pays it out only when ${w.kind === 'ride' ? 'the trip ends' : w.kind === 'store' || w.kind === 'delivery' ? 'you confirm you have your goods' : w.kind === 'tip' ? 'it is passed on to your pro' : 'you confirm the work is done'}.` };
    }
    if (ev.kind === 'refund') return { ...base, amountUsd: ev.refundUsd, lines: [], total: [ev.partial ? 'Refunded (part of the payment)' : 'Refunded', usd(ev.refundUsd)], local: '', method: e && e.paidBy === 'card' ? 'Back to the card you paid with' : e && ['code', 'momo'].includes(e.paidBy) ? 'Back to your mobile money' + (e.refundSentTx ? ` (transaction ${e.refundSentTx})` : ', sent by the Trothen team') : 'Back to how you paid', status: e && e.refundReason ? `Reason: ${e.refundReason}.` : 'The money is on its way back to you.' };
    const amount = money(c.cashPaidAmount || c.amount);
    return { ...base, amountUsd: amount, lines: [[w.kind === 'ride' ? 'Fare' : 'Price', usd(amount)]], total: ['Paid in cash', usd(amount)], local: c.ride && c.ride.fareLocal ? String(c.ride.fareLocal) : '', method: `Cash, to ${pro ? pro.name : 'the driver'}`, status: 'Completed and paid in cash. Nothing was charged through Trothen.' };
  }
  if (ev.kind === 'tokens') {
    const p = await db.find('tokenPurchases', x => x.id === ev.purchaseId);
    return { for: 'tokens', title: `Tokens: ${p.packLabel || 'top-up'}`, amountUsd: money(p.priceUsd), lines: [['Tokens added', String(p.tokens + (p.bonus || 0))]], total: ['Price', usd(p.priceUsd)], local: p.priceLocal != null && p.currency && p.currency !== 'USD' ? `${p.currency} ${Number(p.priceLocal).toLocaleString('en-US')}` : '', method: p.method ? String(p.method).replace(/_/g, ' ') : 'Mobile money', status: 'Paid. The tokens are in your account.' };
  }
  const p = await db.find('payouts', x => x.id === ev.payoutId);
  const lines = [['Earnings released to you', usd(p.grossAmount)]];
  if (p.commissionAmount) lines.push([`Trothen commission${p.commissionRate != null ? ` (${Math.round(p.commissionRate * 1000) / 10}%)` : ''}`, '- ' + usd(p.commissionAmount)]);
  if (p.commissionPaidWithTokens) lines.push(['Commission paid with your tokens', '+ ' + usd(p.commissionPaidWithTokens)]);
  if (p.storeFeeAmount) lines.push(['Store purchase fees', '- ' + usd(p.storeFeeAmount)]);
  if (p.tipsAmount) lines.push(['Tips (no commission)', '+ ' + usd(p.tipsAmount)]);
  if (p.planFeeAmount) lines.push(['Plan fee', '- ' + usd(p.planFeeAmount)]);
  return { for: 'payout', title: `Payout of ${usd(p.amount)}`, amountUsd: money(p.amount), lines, total: ['You received', usd(p.amount)], local: p.payoutAmountLocal ? `${p.payoutCurrency} ${Number(p.payoutAmountLocal).toLocaleString('en-US')}` : '', method: [p.destination || p.method, p.paidReference ? `reference ${p.paidReference}` : ''].filter(Boolean).join(', '), status: 'Sent to you.' };
}

const TITLES = { payment: 'Payment Receipt', cash: 'Receipt', refund: 'Refund Receipt', tokens: 'Receipt', payout: 'Payout Statement' };

// The PDF, as a Buffer.
async function pdfFor(rec) {
  const { createReportDoc } = require('./pdf-report-builder');
  const { PassThrough } = require('stream');
  const sink = new PassThrough(); sink.setHeader = () => {};
  const chunks = []; sink.on('data', d => chunks.push(d));
  const done = new Promise(r => sink.on('end', r));
  const user = await db.find('users', u => u.id === rec.userId);
  const when = require('./booking-rules').whenFor(rec.eventAt, user, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const r = createReportDoc({ res: sink, filename: `${rec.number}.pdf`, title: TITLES[rec.kind] || 'Receipt', subtitle: rec.title.slice(0, 90), docId: rec.number, verificationSeed: `receipt|${rec.id}|${rec.amountUsd}` });
  r.sectionHeader(rec.kind === 'payout' ? 'Paid to' : rec.kind === 'refund' ? 'Refunded to' : 'Paid by');
  r.twoColumnRow('Name', user ? user.name : 'Customer', 'Email', (user && user.email) || ' ');
  r.twoColumnRow('Receipt number', rec.number, 'Date', when);
  r.row(rec.kind === 'payout' ? 'For' : 'What for', rec.title + (rec.otherName && rec.kind !== 'payout' && rec.kind !== 'tokens' ? ` ${rec.for === 'store' ? 'from' : rec.for === 'ride' || rec.for === 'delivery' ? 'by' : 'with'} ${rec.otherName}` : ''));
  if (rec.contractId && (rec.for === 'ride' || rec.for === 'delivery' || rec.for === 'store')) {
    const c = await db.find('contracts', x => x.id === rec.contractId);
    const pc = require('./plus-code');
    const lines = c && c.ride ? pc.tripLines(c.ride.pickup, c.ride.dropoff) : c && (c.jobLocation || c.landmark) ? pc.placeLines({ address: c.address, landmark: c.landmark, pin: c.jobLocation }) : [];
    if (lines.length) { r.sectionHeader(c.ride ? 'The trip' : 'Delivered to'); r.placeBlock(lines); }
  }
  r.sectionHeader(rec.kind === 'payout' ? 'Your earnings' : 'Amount');
  if (rec.lines && rec.lines.length) { r.table([{ label: 'Item', width: 340 }, { label: 'Amount', width: 140, align: 'right' }], rec.lines.map(([a, b]) => [a, b])); r.y += 12; }
  if (rec.total) r.row(rec.total[0], rec.total[1]);
  if (rec.local) r.row(rec.kind === 'payout' ? 'Received in local money' : 'Paid in local money', rec.local);
  if (rec.method) r.row(rec.kind === 'payout' ? 'Sent to' : rec.kind === 'refund' ? 'Refunded' : 'Paid with', rec.method);
  if (rec.status) r.row('Status', rec.status);
  r.finish({ closingNote: rec.kind === 'payout'
    ? 'This statement shows the earnings Trothen paid out to you and what was taken off. Keep it for your records and taxes. Amounts are in US dollars unless shown in local money.'
    : 'Trothen collects payments for the pros, drivers and sellers on it, and holds them until the work is done. Keep this receipt for your records. Amounts are in US dollars unless shown in local money. Questions about a payment: use Help in the app.' });
  await done;
  return Buffer.concat(chunks);
}

// The email: a short summary, the PDF attached.
function emailParts(rec, user) {
  const appUrl = String(process.env.APP_URL || 'https://trothenpro.com').replace(/\/+$/, '');
  const amount = rec.local ? `${rec.local} (${usd(rec.amountUsd)})` : usd(rec.amountUsd);
  const lead = { payment: `Thank you. Your payment of ${amount} for ${rec.title} was received.`, cash: `Your ${rec.title} is complete: ${amount}, paid in cash.`, refund: `${usd(rec.amountUsd)} is being refunded to you for ${rec.title}.`, tokens: `Your token purchase of ${amount} went through.`, payout: `${amount} was sent to you.` }[rec.kind] || '';
  const subject = { payment: `Your Trothen receipt ${rec.number}: ${amount}`, cash: `Your Trothen receipt ${rec.number}: ${amount}`, refund: `Trothen refund ${rec.number}: ${usd(rec.amountUsd)}`, tokens: `Your Trothen receipt ${rec.number}: tokens`, payout: `Trothen payout statement ${rec.number}: ${amount}` }[rec.kind];
  const first = String((user && user.name) || '').split(/\s+/)[0] || 'there';
  const rows = [...(rec.lines || []), rec.total].filter(Boolean);
  const text = [`Hello ${first},`, '', lead, '', ...rows.map(([a, b]) => `${a}: ${b}`), rec.method ? `${rec.kind === 'payout' ? 'Sent to' : 'Paid with'}: ${rec.method}` : '', `Receipt number: ${rec.number}`, '', 'The receipt is attached as a PDF. You can also find it in Trothen under Account → Receipts:', `${appUrl}/?go=receipts`, '', 'Trothen'].filter(x => x !== null).join('\n');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!doctype html><html><body style="margin:0;background:#F4F5F7;font-family:Helvetica,Arial,sans-serif;color:#12161F;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:10px;overflow:hidden;">
<tr><td style="background:#12161F;padding:20px 24px;color:#FFFFFF;font-size:18px;font-weight:bold;">TROTHEN<div style="color:#B08A3E;font-size:11px;letter-spacing:1px;margin-top:4px;">${esc((TITLES[rec.kind] || 'Receipt').toUpperCase())} · ${esc(rec.number)}</div></td></tr>
<tr><td style="padding:22px 24px 6px;font-size:15px;line-height:1.5;">Hello ${esc(first)},<br><br>${esc(lead)}</td></tr>
<tr><td style="padding:6px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
${rows.map(([a, b], i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E6E8EC;${i === rows.length - 1 ? 'font-weight:bold;' : ''}">${esc(a)}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #E6E8EC;${i === rows.length - 1 ? 'font-weight:bold;' : ''}">${esc(b)}</td></tr>`).join('')}
</table></td></tr>
<tr><td style="padding:10px 24px;font-size:13px;color:#5A5F6C;line-height:1.6;">${rec.method ? `${esc(rec.kind === 'payout' ? 'Sent to' : 'Paid with')}: ${esc(rec.method)}<br>` : ''}Receipt number: ${esc(rec.number)}</td></tr>
<tr><td style="padding:8px 24px 24px;"><a href="${esc(appUrl)}/?go=receipts" style="display:inline-block;background:#12161F;color:#FFFFFF;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:bold;">View my receipts</a>
<div style="font-size:12px;color:#5A5F6C;margin-top:14px;">The full receipt is attached as a PDF.</div></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

// Sends one receipt: email (with the PDF), or SMS for someone with no email.
async function send(rec) {
  const user = await db.find('users', u => u.id === rec.userId);
  if (!user || user.closedAt) return;
  const delivery = require('./delivery');
  const patch = {};
  if (user.email && delivery.isEmailConfigured()) {
    try {
      const { subject, text, html } = emailParts(rec, user);
      const pdf = await pdfFor(rec);
      const r = await delivery.sendEmail(user.email, subject, text, { html, attachments: [{ filename: `Trothen-${rec.number}.pdf`, content: pdf, contentType: 'application/pdf' }] });
      if (r.sent) { patch.emailedAt = new Date().toISOString(); patch.emailError = null; } else { patch.emailError = r.words || r.error || 'not sent'; }
    } catch (e) { patch.emailError = String(e.message || e).slice(0, 200); }
    patch.emailTries = (rec.emailTries || 0) + 1;
  } else if (!user.email && user.phone && delivery.isSmsConfigured()) {
    const appUrl = String(process.env.APP_URL || 'https://trothenpro.com').replace(/\/+$/, '');
    const amount = rec.local || usd(rec.amountUsd);
    const r = await delivery.sendSms(user.phone, `Trothen ${TITLES[rec.kind] || 'receipt'} ${rec.number}: ${amount}, ${rec.title}. ${appUrl}/?go=receipts`.slice(0, 300));
    if (r.sent) patch.smsAt = new Date().toISOString();
  }
  if (Object.keys(patch).length) await db.update('receipts', rec.id, patch);
}

let running = false;
async function sweep() {
  if (running) return { skipped: true };
  running = true;
  let issued = 0;
  try {
    const events = await dueEvents();
    if (!events.length) return { issued: 0 };
    const have = new Set((await db.filter('receipts', x => events.some(e => e.key === x.key))).map(x => x.key));
    for (const ev of events) {
      if (have.has(ev.key)) continue;
      let snap;
      try { snap = await snapshot(ev); } catch (e) { console.error('[receipts] could not read', ev.key, e.message); continue; }
      const rec = { id: `rcp_${nanoid(10)}`, key: ev.key, number: `TR-${numberId()}`, userId: ev.userId, kind: ev.kind, contractId: ev.contractId || null, escrowId: ev.escrowId || null, purchaseId: ev.purchaseId || null, payoutId: ev.payoutId || null, eventAt: ev.at, createdAt: new Date().toISOString(), ...snap };
      // The key is checked again just before saving, in case another server instance is sweeping too.
      if (await db.find('receipts', x => x.key === ev.key)) continue;
      await db.insert('receipts', rec);
      have.add(ev.key); issued++;
      await send(rec).catch(e => console.error('[receipts] send:', e.message));
    }
    // A receipt whose email failed (the mail server was down) is tried again, up to 5 times.
    const retry = await db.filter('receipts', x => x.emailError && !x.emailedAt && (x.emailTries || 0) < 5 && Date.now() - new Date(x.createdAt).getTime() < 2 * 24 * 3600 * 1000);
    for (const rec of retry) await send(rec).catch(() => {});
  } finally { running = false; }
  return { issued };
}

let kickTimer = null;
function kick(ms = 3000) {
  if (kickTimer) return;
  kickTimer = setTimeout(() => { kickTimer = null; sweep().catch(e => console.error('[receipts] sweep:', e.message)); }, ms);
  if (kickTimer.unref) kickTimer.unref();
}
function start() {
  setTimeout(() => sweep().catch(e => console.error('[receipts] sweep:', e.message)), Math.min(SWEEP_MS, 8000));
  setInterval(() => sweep().catch(e => console.error('[receipts] sweep:', e.message)), SWEEP_MS);
}

// For the app: the person's own receipts, newest first.
async function listFor(userId) {
  return (await db.filter('receipts', r => r.userId === userId)).sort((a, b) => String(b.eventAt).localeCompare(String(a.eventAt)))
    .map(r => ({ id: r.id, number: r.number, kind: r.kind, title: r.title, for: r.for, amountUsd: r.amountUsd, local: r.local || '', at: r.eventAt, emailed: !!r.emailedAt }));
}

module.exports = { sweep, kick, start, listFor, pdfFor, emailParts, whatFor, TITLES };
