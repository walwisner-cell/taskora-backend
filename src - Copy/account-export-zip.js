// v138: "Download a copy of my data" as one ZIP file, the way Google
// Takeout and Facebook's "Download your information" do it, and what data
// protection laws ask for (a copy a person can read, and one they can take
// to another service).
//
// Inside the ZIP:
//   Start here.html   Open in any browser: your profile, every booking,
//                     payment, review, dispute, call and every conversation
//                     in full, with your photos and voice messages playable.
//   Summary.pdf       A short printable summary (the same as before).
//   spreadsheets/     The main lists as CSV files for Excel or Google Sheets.
//   data.json         Everything, exactly, for moving to another service.
//   files/            Your profile photo, portfolio, store photos, receipts,
//                     dispute evidence you uploaded, and the voice messages
//                     in your conversations.
//   README.txt        What each part is.
//
// Not included, on purpose: passwords (never stored readably) and ID
// document images (kept only for checks; ask support if you need them).
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const db = require('./db');
const { createZip } = require('./zip-stream');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const money = (n) => (n == null || n === '' || isNaN(Number(n)) ? '' : `$${Number(n).toFixed(2)}`);
const mmss = (s) => { s = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const safeName = (s) => String(s || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);

// CSV that opens correctly in Excel (UTF-8 mark) and can't run formulas.
function csv(rows, cols) {
  const cell = (v) => {
    let s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // a cell starting with = or + would run as a formula in Excel
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.map(c => cell(c[0])).join(','), ...rows.map(r => cols.map(c => cell(c[1](r))).join(','))].join('\r\n') + '\r\n';
}

function readFileSafe(dir, name, encrypted) {
  if (!name) return null;
  const p = path.join(dir, path.basename(String(name)));
  try {
    if (!fs.existsSync(p)) return null;
    return encrypted ? require('./file-crypto').readPossiblyEncrypted(p) : fs.readFileSync(p);
  } catch (e) { return null; }
}

async function pdfBuffer(userId) {
  const pt = new PassThrough();
  pt.setHeader = () => {};
  const chunks = [];
  pt.on('data', c => chunks.push(c));
  const done = new Promise((resolve) => { pt.on('end', resolve); pt.on('finish', resolve); });
  const ok = await require('./account-privacy').buildExportPdf(pt, userId);
  if (!ok) return null;
  await done;
  return Buffer.concat(chunks);
}

async function buildExportZip(res, userId) {
  const { buildExport } = require('./account-privacy');
  const data = await buildExport(userId);
  if (!data) return false;
  const me = data.profile;
  const { UPLOADS_DIR, PRIVATE_UPLOADS_DIR } = require('./uploads');
  const VOICE_DIR = path.join(PRIVATE_UPLOADS_DIR, 'voice');

  // Names of the people in their bookings and conversations.
  const otherIds = new Set();
  for (const b of data.bookings) { otherIds.add(b.customerId); otherIds.add(b.providerId); }
  for (const m of data.messages) { otherIds.add(m.fromId); otherIds.add(m.toId); }
  for (const c of data.calls) { otherIds.add(c.fromId); otherIds.add(c.toId); }
  otherIds.delete(userId); otherIds.delete(undefined); otherIds.delete(null);
  const people = otherIds.size ? await db.filter('users', u => otherIds.has(u.id)) : [];
  const nameOf = (id) => (id === userId ? (me.name || 'You') : ((people.find(u => u.id === id) || {}).name || 'Former member'));
  const other = (b) => nameOf(b.customerId === userId ? b.providerId : b.customerId);

  const stamp = new Date(data.exportedAt).toISOString().slice(0, 10);
  res.set('Cache-Control', 'no-store, private');
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="trothen-my-data-${stamp}.zip"`);
  const zip = createZip(res);
  const missing = [];
  const files = { photos: [], voice: new Map() };

  // ── files ──
  if (me.profilePhotoUrl) {
    const n = String(me.profilePhotoUrl).split('/').pop();
    const b = readFileSafe(UPLOADS_DIR, n);
    if (b) { const f = `files/profile-photo${path.extname(n) || '.jpg'}`; await zip.add(f, b); files.photos.push({ f, label: 'Profile photo' }); } else missing.push('Profile photo');
  }
  for (const p of data.portfolioPhotos) {
    const b = readFileSafe(UPLOADS_DIR, p.filename || String(p.url || '').split('/').pop());
    if (b) { const f = `files/portfolio/${safeName(p.id)}${path.extname(p.filename || p.url || '') || '.jpg'}`; await zip.add(f, b); files.photos.push({ f, label: p.caption || p.title || 'Portfolio' }); } else missing.push(`Portfolio photo ${p.id}`);
  }
  for (const g of data.storeGoods) {
    let i = 0;
    for (const u of (g.photoUrls || [])) {
      const n = String(u).split('/').pop(); const b = readFileSafe(UPLOADS_DIR, n);
      if (b) { const f = `files/store/${safeName(g.name || g.id)}-${++i}${path.extname(n) || '.jpg'}`; await zip.add(f, b); files.photos.push({ f, label: g.name || 'Store item' }); } else missing.push(`Store photo for ${g.name || g.id}`);
    }
  }
  for (const x of data.expenses) {
    if (!x.receiptUrl) continue;
    const n = String(x.receiptUrl).split('/').pop(); const b = readFileSafe(UPLOADS_DIR, n);
    if (b) await zip.add(`files/receipts/${safeName(x.id)}${path.extname(n) || '.jpg'}`, b); else missing.push(`Receipt ${x.id}`);
  }
  const evidence = await db.filter('disputeEvidence', e => e.uploadedBy === userId);
  for (const e of evidence) {
    const b = readFileSafe(PRIVATE_UPLOADS_DIR, e.filename, true);
    if (b) await zip.add(`files/dispute-evidence/${safeName(e.id)}-${safeName(e.originalName || e.filename)}`, b); else missing.push(`Dispute evidence ${e.originalName || e.id}`);
  }
  for (const m of data.messages) {
    if (m.kind !== 'voice' || !m.voice || !m.voice.file || m.voice.deletedAt) continue;
    const b = readFileSafe(VOICE_DIR, m.voice.file, true);
    if (!b) { missing.push(`Voice message from ${day(m.createdAt)}`); continue; }
    const f = `files/voice-messages/${m.createdAt.slice(0, 19).replace(/[:T]/g, '-')}-${m.fromId === userId ? 'sent' : 'received'}.${m.voice.ext || 'webm'}`;
    await zip.add(f, b); files.voice.set(m.id, f);
  }

  // ── spreadsheets ──
  await zip.add('spreadsheets/bookings.csv', csv(data.bookings, [
    ['Booking number', b => b.bookingNumber || b.id], ['Date', b => b.createdAt], ['Service', b => b.ride ? 'Ride' : b.service], ['With', other], ['You were', b => (b.customerId === userId ? 'Customer' : 'Pro')],
    ['Status', b => b.status], ['Amount', b => b.amount], ['Currency', b => b.currency || 'USD'], ['Paid by', b => b.paymentMethod || b.payPreference || ''], ['Scheduled for', b => [b.date, b.time].filter(Boolean).join(' ')]]));
  await zip.add('spreadsheets/payments-held.csv', csv(data.paymentsHeld, [['Date', p => p.createdAt], ['Booking', p => p.contractId], ['Amount', p => p.amount], ['Commission', p => p.commission ?? p.platformFee ?? ''], ['Status', p => p.status], ['Released', p => p.releasedAt || '']]));
  if (me.role === 'provider') await zip.add('spreadsheets/payouts.csv', csv(data.payouts, [['Date', p => p.date || p.createdAt], ['Amount', p => p.amount], ['Status', p => p.status], ['Method', p => p.method || '']]));
  await zip.add('spreadsheets/tokens.csv', csv(data.tokens, [['Date', t => t.createdAt], ['Tokens', t => t.tokens], ['Reason', t => t.reason || t.type || t.note || ''], ['Booking', t => t.contractId || '']]));
  await zip.add('spreadsheets/messages.csv', csv(data.messages.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [['Date', m => m.createdAt], ['From', m => nameOf(m.fromId)], ['To', m => nameOf(m.toId)], ['Message', m => m.text], ['Type', m => m.kind || 'text'], ['Voice file', m => files.voice.get(m.id) || ''], ['Read', m => m.readAt || '']]));
  await zip.add('spreadsheets/calls.csv', csv(data.calls, [['Date', c => c.createdAt], ['From', c => nameOf(c.fromId)], ['To', c => nameOf(c.toId)], ['Type', c => (c.video ? 'Video' : 'Voice')], ['Result', c => c.status], ['Length (seconds)', c => (c.answeredAt && c.endedAt ? Math.round((Date.parse(c.endedAt) - Date.parse(c.answeredAt)) / 1000) : 0)]]));
  await zip.add('spreadsheets/reviews.csv', csv(data.reviews, [['Date', r => r.createdAt], ['Stars', r => r.stars], ['Review', r => r.text], ['By', r => r.authorName || ''], ['About you', r => (r.providerId === userId ? 'Yes' : 'No, written by you')]]));
  await zip.add('spreadsheets/disputes.csv', csv(data.disputes, [['Opened', d => d.createdAt], ['Booking', d => d.contractId], ['Reason', d => d.reason || d.category], ['Status', d => d.status], ['Resolution', d => d.resolution || '']]));
  if (data.jobsPosted.length) await zip.add('spreadsheets/jobs-posted.csv', csv(data.jobsPosted, [['Date', j => j.createdAt], ['Category', j => j.category], ['Description', j => j.description], ['Budget', j => j.budget], ['Status', j => j.status]]));
  await zip.add('spreadsheets/notifications.csv', csv(data.notifications, [['Date', n => n.createdAt], ['Notification', n => n.text], ['Read', n => (n.read ? 'Yes' : 'No')]]));

  // ── the complete file ──
  await zip.add('data.json', JSON.stringify(data, null, 2));

  // ── the summary PDF ──
  try { const pdf = await pdfBuffer(userId); if (pdf) await zip.add('Summary.pdf', pdf); } catch (e) { /* the HTML has everything */ }

  // ── Start here.html ──
  const table = (cols, rows) => rows.length
    ? `<div class="tw"><table><thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : '<p class="none">None.</p>';
  const section = (id, title, n, body) => `<section id="${id}"><h2>${esc(title)}${n != null ? ` <span class="n">${n}</span>` : ''}</h2>${body}</section>`;
  const convos = new Map();
  for (const m of data.messages.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
    const o = m.fromId === userId ? m.toId : m.fromId;
    if (!convos.has(o)) convos.set(o, []);
    convos.get(o).push(m);
  }
  const profileRows = [['Name', me.name], ['Email', me.email], ['Phone', me.phone], ['Account type', me.role === 'provider' ? 'Pro' : 'Customer'], ['Category', me.category], ['Country', me.country], ['City', me.city], ['Address', me.address], ['Member since', day(me.createdAt)], ['Verified', me.verified ? 'Yes' : 'No']].filter(r => r[1]);
  const nav = [['profile', 'Profile'], ['bookings', 'Bookings'], ['payments', 'Payments'], ...(me.role === 'provider' ? [['payouts', 'Payouts']] : []), ['messages', 'Messages'], ['calls', 'Calls'], ['reviews', 'Reviews'], ['disputes', 'Disputes'], ...(data.jobsPosted.length ? [['jobs', 'Jobs posted']] : []), ...(files.photos.length ? [['photos', 'Photos']] : []), ['more', 'Everything else']];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your Trothen data</title>
<style>
:root{--navy:#0F2640;--slate:#5b6676;--border:#dde3ea;--bg:#f6f8fb;--blue:#1D5FA8}
*{box-sizing:border-box}body{margin:0;font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2533;background:var(--bg)}
header{background:var(--navy);color:#fff;padding:24px 16px}header h1{margin:0 0 4px;font-size:24px}header p{margin:0;opacity:.85;font-size:14px}
nav{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--border);padding:8px 12px;display:flex;gap:6px;overflow-x:auto;z-index:2}
nav a{white-space:nowrap;color:var(--navy);text-decoration:none;font-size:13.5px;padding:6px 10px;border-radius:8px;background:var(--bg)}
main{max-width:980px;margin:0 auto;padding:16px}section{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin:0 0 16px}
h2{margin:0 0 12px;font-size:18px;color:var(--navy)}.n{font-size:13px;color:var(--slate);font-weight:500;background:var(--bg);border-radius:20px;padding:2px 8px;margin-left:4px}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top}th{color:var(--slate);font-weight:600;font-size:12.5px;white-space:nowrap}
.none{color:var(--slate);margin:0}.convo{border:1px solid var(--border);border-radius:10px;margin:0 0 12px;overflow:hidden}.convo summary{cursor:pointer;padding:10px 12px;font-weight:600;color:var(--navy);background:var(--bg)}
.msgs{padding:10px 12px;display:flex;flex-direction:column;gap:6px}.m{max-width:80%;padding:7px 10px;border-radius:12px;background:#eef2f7;font-size:14px}.m.me{align-self:flex-end;background:var(--navy);color:#fff}.m small{display:block;opacity:.7;font-size:11.5px;margin-top:2px}
.m.call{align-self:center;background:none;color:var(--slate);font-size:13px}audio{width:240px;max-width:100%;margin-top:4px}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.photos figure{margin:0}.photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid var(--border)}.photos figcaption{font-size:12.5px;color:var(--slate)}
.note{font-size:13px;color:var(--slate)}ul.files{margin:0;padding-left:18px}
</style></head><body>
<header><h1>Your Trothen data</h1><p>${esc(me.name || '')} · downloaded ${esc(when(data.exportedAt))}</p></header>
<nav>${nav.map(([id, l]) => `<a href="#${id}">${esc(l)}</a>`).join('')}</nav>
<main>
${section('profile', 'Profile', null, `<div class="tw"><table><tbody>${profileRows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>`)}
${section('bookings', 'Bookings', data.bookings.length, table([['Booking', b => esc(b.bookingNumber || b.id)], ['Date', b => esc(day(b.createdAt))], ['Service', b => esc(b.ride ? 'Ride' : b.service)], ['With', b => esc(other(b))], ['Status', b => esc(b.status)], ['Amount', b => esc(money(b.amount))]], data.bookings.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))))}
${section('payments', 'Payments held for bookings', data.paymentsHeld.length, table([['Date', p => esc(day(p.createdAt))], ['Booking', p => esc(p.contractId)], ['Amount', p => esc(money(p.amount))], ['Status', p => esc(p.status)]], data.paymentsHeld) + (data.tokens.length ? `<h2 style="margin-top:16px;font-size:16px;">Tokens <span class="n">${data.tokens.length}</span></h2>` + table([['Date', t => esc(day(t.createdAt))], ['Tokens', t => esc(t.tokens)], ['Reason', t => esc(t.reason || t.type || t.note || '')]], data.tokens) : ''))}
${me.role === 'provider' ? section('payouts', 'Payouts', data.payouts.length, table([['Date', p => esc(day(p.date || p.createdAt))], ['Amount', p => esc(money(p.amount))], ['Status', p => esc(p.status)]], data.payouts)) : ''}
${section('messages', 'Messages', data.messages.length, convos.size ? [...convos.entries()].map(([o, list]) => `<details class="convo"><summary>${esc(nameOf(o))} · ${list.length} message${list.length === 1 ? '' : 's'}</summary><div class="msgs">${list.map(m => {
    if (m.kind === 'call') return `<div class="m call">${esc(m.text)} · ${esc(when(m.createdAt))}</div>`;
    const mineMsg = m.fromId === userId;
    const vf = files.voice.get(m.id);
    const body = m.kind === 'voice' ? (vf ? `${esc(m.text)}<br><audio controls preload="none" src="${esc(vf)}"></audio>` : `${esc(m.text)} <em>(the recording is no longer available)</em>`) : esc(m.text);
    return `<div class="m${mineMsg ? ' me' : ''}">${body}<small>${esc(when(m.createdAt))}</small></div>`;
  }).join('')}</div></details>`).join('') : '<p class="none">None.</p>')}
${section('calls', 'Calls', data.calls.length, table([['Date', c => esc(when(c.createdAt))], ['From', c => esc(nameOf(c.fromId))], ['To', c => esc(nameOf(c.toId))], ['Type', c => (c.video ? 'Video' : 'Voice')], ['Result', c => esc(c.answeredAt ? `Answered, ${mmss(c.answeredAt && c.endedAt ? (Date.parse(c.endedAt) - Date.parse(c.answeredAt)) / 1000 : 0)}` : c.status)]], data.calls) + '<p class="note">Calls are never recorded. Only the time and length are kept.</p>')}
${section('reviews', 'Reviews', data.reviews.length, table([['Date', r => esc(day(r.createdAt))], ['Stars', r => esc(r.stars)], ['Review', r => esc(r.text)], ['', r => (r.providerId === userId ? 'About you' : 'Written by you')]], data.reviews))}
${section('disputes', 'Disputes', data.disputes.length, table([['Opened', d => esc(day(d.createdAt))], ['Reason', d => esc(d.reason || d.category)], ['Status', d => esc(d.status)], ['Resolution', d => esc(d.resolution || '')]], data.disputes))}
${data.jobsPosted.length ? section('jobs', 'Jobs posted', data.jobsPosted.length, table([['Date', j => esc(day(j.createdAt))], ['Category', j => esc(j.category)], ['Description', j => esc(j.description)], ['Status', j => esc(j.status)]], data.jobsPosted)) : ''}
${files.photos.length ? section('photos', 'Photos', files.photos.length, `<div class="photos">${files.photos.map(p => `<figure><a href="${esc(p.f)}"><img src="${esc(p.f)}" alt="" loading="lazy"></a><figcaption>${esc(p.label)}</figcaption></figure>`).join('')}</div>`) : ''}
${section('more', 'Everything else', null, `<ul class="files">
  <li>Notifications: ${data.notifications.length} (in <code>spreadsheets/notifications.csv</code>)</li>
  <li>Identity checks on file: ${data.identityChecks.length} (the records, not the ID images)</li>
  <li>Favorite pros: ${data.favorites.length} · Referrals: ${data.referrals.length} · Payment methods: ${data.paymentMethods.length}</li>
  ${me.role === 'provider' ? `<li>Store items: ${data.storeGoods.length} · Tools: ${data.tools.length} · Expenses: ${data.expenses.length} · Quotes and invoices: ${data.quotesAndInvoices.length}</li>` : ''}
</ul>
<p class="note">Everything, exactly as Trothen stores it, is in <code>data.json</code> (for moving to another service). The main lists are in the <code>spreadsheets</code> folder for Excel or Google Sheets.</p>
<p class="note">Not included: your password (it is never stored in a readable form) and the images of your ID documents (kept only for identity checks; contact support if you need a copy).</p>
${missing.length ? `<p class="note">${missing.length} file${missing.length === 1 ? ' is' : 's are'} recorded but no longer on our servers: ${esc(missing.slice(0, 20).join(', '))}${missing.length > 20 ? '…' : ''}.</p>` : ''}`)}
</main></body></html>`;
  await zip.add('Start here.html', html);

  await zip.add('README.txt', [
    'YOUR TROTHEN DATA',
    `Downloaded ${when(data.exportedAt)} for ${me.name || me.email || ''}.`,
    '',
    'Start here.html   Open this in any web browser. It shows everything in a readable way:',
    '                  your profile, bookings, payments, every conversation (voice messages play),',
    '                  calls, reviews, disputes and your photos.',
    'Summary.pdf       A short printable summary.',
    'spreadsheets\\     The main lists as CSV files. Open them in Excel or Google Sheets.',
    'data.json         Everything, exactly as Trothen stores it. Use this if you are moving',
    '                  your data to another service.',
    'files\\            Your profile photo, portfolio and store photos, receipts, dispute evidence',
    '                  you uploaded, and the voice messages in your conversations.',
    '',
    'On a phone: unzip the file first (iPhone: tap it in Files. Android: open it in Files by Google),',
    'then open "Start here.html".',
    '',
    'Not included: your password (never stored in a readable form) and your ID document images',
    '(kept only for identity checks; contact support if you need a copy).',
    missing.length ? `\n${missing.length} recorded file(s) are no longer on our servers and could not be included.` : '',
    '',
    'Keep this file safe: it contains your personal details and your conversations.',
  ].join('\r\n'));

  await zip.finish();
  return true;
}

module.exports = { buildExportZip, csv };
