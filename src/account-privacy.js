// v83: a person's own data, and leaving Trothen.
//
// Three things live here:
//   1. buildExport  — everything Trothen holds about one person, as one file
//                     they can download.
//   2. closureBlockers / closeAccount — closing an account at the person's
//                     own request. The account stops working straight away.
//   3. eraseAccount — a super admin removes the personal details of a closed
//                     account. Records of bookings, payments, reviews and
//                     disputes are KEPT (the other person in each of those
//                     has a right to their record, and money records have to
//                     be kept), but the closed person's name, contact
//                     details, photos and ID files are removed.
//
// What is kept and for how long is a legal decision. This code makes the
// conservative choice: nothing is erased automatically. A super admin
// presses the button, per account.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const safeAll = async (collection) => { try { return await db.all(collection); } catch (e) { return []; } };
const strip = (obj, keys) => { const o = { ...obj }; for (const k of keys) delete o[k]; return o; };

// Fields that are Trothen's own working notes or secrets, not the person's data.
const INTERNAL_USER_FIELDS = ['passwordHash', 'tokenVersion', 'twoFactorSecret', 'onHold', 'holdReason', 'heldBy', 'heldAt',
  'approvedBy', 'statusReviewedBy', 'commissionRateOverride', 'commissionRateOverrideStatus', 'mustChangePassword', 'googleId'];

async function buildExport(userId) {
  const me = await db.find('users', u => u.id === userId);
  if (!me) return null;
  const mine = (list, ...fields) => list.filter(r => fields.some(f => r[f] === userId));
  const contracts = mine(await safeAll('contracts'), 'customerId', 'providerId');
  const contractIds = new Set(contracts.map(c => c.id));
  const disputes = (await safeAll('disputes')).filter(d => contractIds.has(d.contractId));
  return {
    exportedAt: new Date().toISOString(),
    note: 'This is the information Trothen holds about your account. Passwords are never stored in readable form and are not included. Photos and ID files are not inside this file; the records of them are.',
    profile: strip(me, INTERNAL_USER_FIELDS),
    jobsPosted: mine(await safeAll('jobs'), 'customerId'),
    jobMatches: mine(await safeAll('matches'), 'providerId'),
    bookings: contracts,
    paymentsHeld: (await safeAll('escrowTransactions')).filter(e => contractIds.has(e.contractId)),
    payouts: mine(await safeAll('payouts'), 'providerId'),
    planInvoices: mine(await safeAll('planInvoices'), 'providerId'),
    paymentMethods: mine(await safeAll('paymentMethods'), 'userId'),
    reviews: mine(await safeAll('reviews'), 'customerId', 'providerId', 'authorId', 'reviewerId'),
    disputes,
    messages: mine(await safeAll('messages'), 'fromUserId', 'toUserId', 'from', 'to', 'senderId', 'recipientId'),
    notifications: mine(await safeAll('notifications'), 'userId'),
    identityChecks: mine(await safeAll('verifications'), 'userId').map(v => strip(v, ['documentFilename', 'selfieFilename', 'backFilename'])),
    portfolioPhotos: mine(await safeAll('portfolioPhotos'), 'providerId'),
    favorites: mine(await safeAll('favorites'), 'customerId', 'userId'),
    // v105: the pro's store and business records
    storeGoods: mine(await safeAll('storeGoods'), 'providerId'),
    tools: mine(await safeAll('proTools'), 'providerId'),
    expenses: mine(await safeAll('proExpenses'), 'providerId'),
    quotesAndInvoices: mine(await safeAll('proDocs'), 'providerId', 'customerId'),
    tokens: mine(await safeAll('tokenLedger'), 'userId'), // v115
    tokenPurchases: mine(await safeAll('tokenPurchases'), 'userId'),
  };
}

// Reasons an account can't be closed right now. Empty list = it can.
async function closureBlockers(user) {
  const reasons = [];
  const contracts = (await safeAll('contracts')).filter(c => c.customerId === user.id || c.providerId === user.id);
  const open = contracts.filter(c => !['completed', 'cancelled', 'declined', 'expired', 'rejected'].includes(c.status));
  if (open.some(c => c.status === 'disputed')) reasons.push('You have a booking with an open dispute. It has to be settled first.');
  const live = open.filter(c => c.status !== 'disputed');
  if (live.length) reasons.push(`You have ${live.length} booking${live.length === 1 ? '' : 's'} still in progress. Finish or cancel ${live.length === 1 ? 'it' : 'them'} first.`);
  const ids = new Set(contracts.map(c => c.id));
  const escrow = (await safeAll('escrowTransactions')).filter(e => ids.has(e.contractId));
  if (escrow.some(e => e.status === 'held')) reasons.push('There is a payment still being held on one of your bookings.');
  if (user.role === 'provider') {
    const provContractIds = new Set(contracts.filter(c => c.providerId === user.id).map(c => c.id));
    if (escrow.some(e => provContractIds.has(e.contractId) && e.status === 'released' && !e.payoutId)) reasons.push('You have earnings you haven\'t cashed out yet. Request your payout first.');
    if ((await safeAll('payouts')).some(p => p.providerId === user.id && p.status === 'processing')) reasons.push('A payout to you is still being processed.');
  }
  // v115: unspent tokens are the customer's stored money; closing would strand them.
  const tokenBal = Math.round((await safeAll('tokenLedger')).filter(l => l.userId === user.id).reduce((t, l) => t + (Number(l.tokens) || 0), 0) * 100) / 100;
  if ((user.tokenDebt || 0) > 0.004) reasons.push(`You owe ${Math.round(user.tokenDebt * 100) / 100} tokens of commission from a cash job. Buy tokens to pay it, or contact support, before closing your account.`); // v119
  if (tokenBal > 0.004) reasons.push(`You still have ${tokenBal} tokens. Spend them, or contact support to arrange a refund of the unspent tokens, before closing your account.`);
  const openJobs = (await safeAll('jobs')).filter(j => j.customerId === user.id && ['open', 'pending', 'matching'].includes(j.status));
  if (openJobs.length) reasons.push(`You have ${openJobs.length} job${openJobs.length === 1 ? '' : 's'} still posted. Cancel ${openJobs.length === 1 ? 'it' : 'them'} first.`);
  return reasons;
}

async function closeAccount(user, reason) {
  const now = new Date().toISOString();
  await db.update('users', user.id, {
    active: false, closedAt: now, closedByOwner: true, acceptingBookings: false,
    tokenVersion: (user.tokenVersion || 0) + 1, // signs them out everywhere
  });
  try { for (const s of (await safeAll('sessions')).filter(s => s.userId === user.id)) await db.remove('sessions', s.id); } catch (e) { /* tokenVersion already covers it */ }
  const record = { id: `acl_${crypto.randomBytes(6).toString('hex')}`, userId: user.id, role: user.role, requestedAt: now, reason: String(reason || '').slice(0, 500), status: 'closed', erasedAt: null };
  await db.insert('accountClosures', record);
  return record;
}

function removeFileQuietly(dir, name) {
  if (!name) return;
  try { fs.unlinkSync(path.join(dir, path.basename(String(name)))); } catch (e) { /* already gone */ }
}

// Super admin only (enforced by the route). Removes personal details; keeps the records.
async function eraseAccount(closure, adminId) {
  const user = await db.find('users', u => u.id === closure.userId);
  if (!user) return { ok: false, error: 'That account no longer exists' };
  const { PRIVATE_UPLOADS_DIR, UPLOADS_DIR } = require('./uploads');
  // ID files and face photos: gone now, whatever the retention setting says.
  for (const v of (await safeAll('verifications')).filter(v => v.userId === user.id)) {
    for (const f of [v.documentFilename, v.selfieFilename, v.backFilename]) removeFileQuietly(PRIVATE_UPLOADS_DIR, f);
    await db.update('verifications', v.id, { documentFilename: null, selfieFilename: null, backFilename: null, idLegalName: null, filesDeletedAt: new Date().toISOString() });
  }
  // Public photos.
  for (const p of (await safeAll('portfolioPhotos')).filter(p => p.providerId === user.id)) { removeFileQuietly(UPLOADS_DIR, p.filename); await db.remove('portfolioPhotos', p.id); }
  if (user.profilePhotoUrl) removeFileQuietly(UPLOADS_DIR, String(user.profilePhotoUrl).split('/').pop());
  // v105: their store, and the business records only they used. Goods
  // already bought stay written on the bookings they were part of.
  for (const g of (await safeAll('storeGoods')).filter(g => g.providerId === user.id)) {
    for (const u of (g.photoUrls || [])) removeFileQuietly(UPLOADS_DIR, String(u).split('/').pop());
    try { await db.remove('storeGoods', g.id); } catch (e) { /* skip */ }
  }
  for (const x of (await safeAll('proExpenses')).filter(x => x.providerId === user.id)) {
    if (x.receiptUrl) removeFileQuietly(UPLOADS_DIR, String(x.receiptUrl).split('/').pop());
    try { await db.remove('proExpenses', x.id); } catch (e) { /* skip */ }
  }
  for (const sk of (user.extraSkills || [])) if (sk && sk.licenceFile) removeFileQuietly(PRIVATE_UPLOADS_DIR, sk.licenceFile); // v106: licence proof for extra skills
  for (const coll of ['proTools', 'proDocs']) {
    for (const r of (await safeAll(coll)).filter(r => r.providerId === user.id)) { try { await db.remove(coll, r.id); } catch (e) { /* skip */ } }
  }
  // Where they were when they recorded a pick-up or drop-off, and (for a
  // pro) the routes recorded while carrying. The photos and times stay as
  // the record of the hand-over.
  for (const c of (await safeAll('contracts')).filter(c => c.handover && (c.customerId === user.id || c.providerId === user.id))) {
    const strip = (list) => (list || []).map(e => e.byId === user.id ? { ...e, location: null } : e);
    await db.update('contracts', c.id, { handover: { ...c.handover, pickup: strip(c.handover.pickup), dropoff: strip(c.handover.dropoff), trail: c.providerId === user.id ? [] : (c.handover.trail || []) } });
  }
  // Things only they used.
  for (const coll of ['paymentMethods', 'pushSubscriptions', 'notifications', 'favorites']) {
    for (const r of (await safeAll(coll)).filter(r => r.userId === user.id || r.customerId === user.id)) { try { await db.remove(coll, r.id); } catch (e) { /* skip */ } }
  }
  // v96: where they live. The job pin, landmark and address on their own
  // jobs and bookings are their home; the booking record stays, the
  // location does not. (A pro's bookings keep the customer's location:
  // that belongs to the customer, not to the pro being erased.)
  if (user.role === 'customer') {
    for (const c of (await safeAll('contracts')).filter(c => c.customerId === user.id)) {
      await db.update('contracts', c.id, { jobLocation: null, landmark: null, address: null, liveLocation: null, onMyWayLocation: null, arrivedLocation: null });
    }
    for (const j of (await safeAll('jobs')).filter(j => j.customerId === user.id)) {
      await db.update('jobs', j.id, { jobLocation: null, landmark: null });
    }
  }
  // The profile itself: every personal field blanked. The id stays, so
  // bookings, payments, reviews and disputes still point at "a closed account".
  const keep = { id: user.id, role: user.role, createdAt: user.createdAt, closedAt: user.closedAt, country: user.country };
  const blank = {};
  for (const k of Object.keys(user)) if (!(k in keep)) blank[k] = null;
  await db.update('users', user.id, {
    ...blank, ...keep,
    name: 'Closed account', initials: '—', email: `closed-${user.id}@closed.invalid`,
    passwordHash: require('./auth').hashPassword(crypto.randomBytes(24).toString('hex')), active: false, verified: false, closedByOwner: true, erased: true, erasedAt: new Date().toISOString(),
    tokenVersion: (user.tokenVersion || 0) + 1,
  });
  await db.update('accountClosures', closure.id, { status: 'erased', erasedAt: new Date().toISOString(), erasedBy: adminId });
  return { ok: true };
}

// A real, readable PDF version of buildExport(), for the "Download my
// data" button. The JSON export above is complete and exact, but it is
// not something an ordinary person can actually open and read on a
// phone — Joseph reported this as "not downloading in PDF", which is a
// fair description of what happens when a .json file lands on a phone
// with no app that opens it. This covers the same ground in a document
// a person can actually read: a profile summary, then a real line per
// booking/payout/dispute (the things people actually want to check),
// then honest counts for everything else (messages, notifications and
// so on) rather than dumping hundreds of raw records into a PDF, with a
// note that the complete machine-readable file is still available.
async function buildExportPdf(res, userId) {
  const data = await buildExport(userId);
  if (!data) return false;
  const { createReportDoc } = require('./pdf-report-builder');
  const me = data.profile;
  const r = createReportDoc({
    res, filename: `trothen-my-data-${new Date().toISOString().slice(0, 10)}.pdf`,
    title: 'Your Data', subtitle: 'Everything Trothen holds about your account',
    docId: me.id, verificationSeed: `my-data|${me.id}|${data.exportedAt}`,
  });
  r.sectionHeader('Your profile');
  r.twoColumnRow('Name', me.name || '—', 'Role', me.role || '—');
  r.twoColumnRow('Email', me.email || '—', 'Phone', me.phone || '—');
  r.twoColumnRow('Country', me.country || '—', 'City', me.city || '—');
  r.row('Account created', me.createdAt ? new Date(me.createdAt).toLocaleDateString('en-US') : '—');

  if (data.bookings.length) {
    // Contracts only ever store the other party's ID, not their name —
    // resolve it here so the PDF reads like a real statement ("With:
    // Marcus T.") rather than a bare, meaningless ID string.
    const otherPartyIds = data.bookings.map(b => (b.customerId === userId ? b.providerId : b.customerId)).filter(Boolean);
    const otherParties = otherPartyIds.length ? await db.filter('users', u => otherPartyIds.includes(u.id)) : [];
    const nameById = new Map(otherParties.map(u => [u.id, u.name]));
    r.sectionHeader(`Bookings (${data.bookings.length})`);
    r.table(
      [{ label: 'Date', width: 85 }, { label: 'Status', width: 85 }, { label: 'What', width: 110 }, { label: 'With', width: 100 }, { label: 'Amount', width: 80, align: 'right' }],
      data.bookings.slice(0, 60).map(b => [
        b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US') : '—',
        String(b.status || '—'),
        String(b.service || '—').slice(0, 24),
        String(nameById.get(b.customerId === userId ? b.providerId : b.customerId) || '—').slice(0, 22),
        b.amount != null ? `$${Number(b.amount).toFixed(2)}` : '—',
      ])
    );
    if (data.bookings.length > 60) r.paragraph(`${data.bookings.length - 60} more booking(s) are in the full data file — see below.`, { size: 8.5 });
  } else {
    r.sectionHeader('Bookings'); r.paragraph('No bookings yet.');
  }

  if (data.payouts.length) {
    r.sectionHeader(`Payouts (${data.payouts.length})`);
    r.table(
      [{ label: 'Date', width: 120 }, { label: 'Status', width: 120 }, { label: 'Amount', width: 220, align: 'right' }],
      data.payouts.slice(0, 40).map(p => [
        p.date || p.createdAt ? new Date(p.date || p.createdAt).toLocaleDateString('en-US') : '—',
        String(p.status || '—'),
        p.amount != null ? `$${Number(p.amount).toFixed(2)}` : '—',
      ])
    );
  }

  if (data.disputes.length) {
    r.sectionHeader(`Disputes (${data.disputes.length})`);
    r.table(
      [{ label: 'Opened', width: 120 }, { label: 'Status', width: 120 }, { label: 'Reason', width: 220 }],
      data.disputes.slice(0, 30).map(d => [
        d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US') : '—',
        String(d.status || '—'),
        String(d.reason || d.category || '—').slice(0, 40),
      ])
    );
  }

  if (data.reviews.length) {
    r.sectionHeader(`Reviews (${data.reviews.length})`);
    r.table(
      [{ label: 'Date', width: 110 }, { label: 'Rating', width: 70, align: 'right' }, { label: 'Comment', width: 280 }],
      data.reviews.slice(0, 30).map(rv => [
        rv.createdAt ? new Date(rv.createdAt).toLocaleDateString('en-US') : '—',
        rv.stars != null ? `${rv.stars}/5` : '—',
        String(rv.text || '—').slice(0, 50),
      ])
    );
  }

  r.sectionHeader('Everything else Trothen holds');
  r.paragraph(
    [
      `Messages: ${data.messages.length}`,
      `Notifications: ${data.notifications.length}`,
      `Identity checks on file: ${data.identityChecks.length}`,
      `Saved favorites: ${data.favorites.length}`,
      me.role === 'provider' ? `Portfolio photos: ${data.portfolioPhotos.length}` : null,
      me.role === 'provider' ? `Store items: ${data.storeGoods.length}` : null,
      me.role === 'provider' ? `Quotes/invoices: ${data.quotesAndInvoices.length}` : null,
    ].filter(Boolean).join('    ·    '),
    { size: 9.5 }
  );
  r.paragraph('Passwords are never stored in readable form and are not included here. Photos and ID document images are not inside this document; the records of them are. For the complete, exact copy of every field above (useful if you are moving your data somewhere else), use "Download the complete file (.json)" on the same screen.', { size: 8.5 });

  r.finish({ closingNote: `Generated for ${me.name || me.email} on ${new Date(data.exportedAt).toLocaleString('en-US')}.` });
  return true;
}

module.exports = { buildExport, buildExportPdf, closureBlockers, closeAccount, eraseAccount };
