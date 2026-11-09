// v153: one change at a time for each account.
//
// A double-tap, a slow connection that sends a request again, or the same
// account open on two phones can send the same change twice at the same
// moment. With the Postgres database each request really runs at the same
// time as the other, so both could read "not done yet" and both do it:
// two reviews, two free bookings from the same loyalty points, a payout
// marked sent twice. (The JSON store hid this, because there one request
// always finished before the next one started.)
//
// So changes (POST, PUT, PATCH, DELETE) from the same signed-in account are
// handled one after the other. The second one then sees the first one's
// result and answers "already done", exactly as if it had been sent later.
// Different people are never held up by each other, reading (GET) is never
// held up, and nobody waits more than 20 seconds (after that the request
// simply goes ahead, as it did before).
//
// This is for one server, which is how Trothen runs on Render. With several
// servers this would need a shared lock (for example in Postgres).
const jwt = require('jsonwebtoken');

const MAX_WAIT_MS = 20000;
const CHANGES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Calls (live audio/video signalling) and live location pings are fast,
// frequent and safe to repeat, so they never wait behind anything.
const SKIP = /^\/(calls\/|webhooks\/|live\/)|\/(live-location|customer-live-location|location)$/;

const tails = new Map();
const holders = new Map(); // what each account is doing now, for the warning below

function accountOf(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const { JWT_SECRET } = require('./auth');
    const p = jwt.verify(header.slice(7), JWT_SECRET);
    return p && p.sub ? 'u:' + p.sub : null;
  } catch (e) { return null; } // a bad token is refused by the route itself
}

function oneAtATime(req, res, next) {
  if (!CHANGES.has(req.method) || SKIP.test(req.path)) return next();
  const key = accountOf(req);
  if (!key) return next();
  const before = tails.get(key) || Promise.resolve();
  let release;
  const mine = new Promise(r => { release = r; });
  const tail = before.then(() => mine);
  tails.set(key, tail);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    release();
    if (tails.get(key) === tail) tails.delete(key);
  };
  res.on('finish', finish);
  res.on('close', finish);
  const holder = holders.get(key);
  holders.set(key, req.method + ' ' + req.path);
  let timer; const t0 = Date.now();
  const waited = new Promise(r => { timer = setTimeout(r, MAX_WAIT_MS); });
  Promise.race([before, waited]).then(() => {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (ms > 2000) console.warn(`[one-at-a-time] ${req.method} ${req.path} waited ${ms} ms behind ${holder || 'an earlier request'}`);
    next();
  });
}

// Some things are changed by several staff, not one account: a payment code
// two finance people confirm at once, a dispute two managers settle at once,
// a return two staff decide at once. For these the thing itself is locked:
// the first goes ahead, the second is told someone else is doing it.
const SHARED = [
  [/^\/admin\/tokens\/codes\/(confirm|reject)$/, (req) => 'tokcode:' + String((req.body || {}).code || '').trim().toUpperCase()],
  [/^\/admin\/tokens\/(offline-topup|adjust)$/, (req) => 'tokuser:' + String((req.body || {}).userId || '')],
  [/^\/admin\/customer-payments\/(confirm|reject)$/, (req) => 'cpcode:' + String((req.body || {}).code || '').trim().toUpperCase()],
  [/^\/admin\/customer-payments\/refund-sent$/, (req) => 'cprefund:' + String((req.body || {}).escrowId || '')],
  [/^\/admin\/disputes\/([^/]+)\/(resolve|decide)$|^\/disputes\/([^/]+)\/resolve$/, (req, m) => 'dispute:' + (m[1] || m[3])],
  [/^\/admin\/store\/returns\/([^/]+)\/decide$/, (req, m) => 'return:' + m[1]],
  [/^\/admin\/payouts\/([^/]+)\/(sent|problem|send-momo)$/, (req, m) => 'payout:' + m[1]],
];
const held = new Set();
function oneStaffAtATime(req, res, next) {
  if (!CHANGES.has(req.method)) return next();
  for (const [re, keyFn] of SHARED) {
    const m = re.exec(req.path);
    if (!m) continue;
    const key = 'shared:' + keyFn(req, m);
    if (held.has(key)) return res.status(409).json({ error: 'Someone else is working on this right now. Refresh in a moment to see what they did.' });
    held.add(key);
    let done = false; const free = () => { if (!done) { done = true; held.delete(key); } };
    res.on('finish', free); res.on('close', free);
    return next();
  }
  next();
}

module.exports = { oneAtATime, oneStaffAtATime, _tails: tails };
