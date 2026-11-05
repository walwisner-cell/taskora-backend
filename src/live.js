// Live updates (v123): the open page is told the moment something changes
// for the person looking at it, so nobody has to refresh to see that a pro
// accepted, a price was suggested, a payment was confirmed or a message
// arrived.
//
// How it works:
// - The page opens one Server-Sent Events connection (GET /api/live/stream).
//   This is plain HTTP that stays open; every browser supports it and
//   reconnects by itself. No new packages.
// - Every time the database saves a booking, job response, job, message,
//   payment, notification or token line, this file works out who it belongs
//   to (customer, pro, or both) and sends those people a tiny "this changed"
//   note, for example { sections: ["bookings"] }. No booking details travel
//   down this connection: the page reloads what changed through the normal,
//   signed-in API, with all its usual checks.
// - A browser can't put a sign-in header on this kind of connection, so the
//   page first asks for a one-time ticket (POST /api/live/ticket, signed in
//   as usual). The ticket works once, within 60 seconds. The real sign-in
//   token is never put in a web address, where it could end up in logs.
//
// One server only: the list of open connections lives in this server's
// memory. That matches Trothen today (one Render service). If Trothen ever
// runs on several servers at once, this needs a shared message channel
// (for example Redis) so a change on one server reaches pages on another.
const crypto = require('crypto');
const express = require('express');
const { requireAuth } = require('./auth');

const streams = new Map();   // userId -> Set of open responses
const tickets = new Map();   // ticket -> { userId, role, expires }
const pending = new Map();   // userId -> Set of sections waiting to be sent
let flushTimer = null;
const MAX_STREAMS_PER_USER = 6; // a few tabs or devices; the oldest is closed after that

// Which part of the app a saved record belongs to.
const SECTION_OF = {
  contracts: 'bookings',
  escrowTransactions: 'bookings',
  matches: 'matches',
  jobs: 'jobs',
  messages: 'messages',
  notifications: 'notifications',
  tokenLedger: 'tokens',
  scopeChangeRequests: 'bookings',
  disputes: 'disputes',
};

function queue(userId, section) {
  if (!userId || !streams.has(userId)) return; // nobody is looking: nothing to do
  if (!pending.has(userId)) pending.set(userId, new Set());
  pending.get(userId).add(section);
  // Changes made together (a booking, its payment and two notices) go out
  // as one note a moment later, not four.
  if (!flushTimer) flushTimer = setTimeout(flush, 250);
}
function flush() {
  flushTimer = null;
  for (const [userId, sections] of pending) {
    const set = streams.get(userId);
    if (!set) continue;
    const data = `event: change\ndata: ${JSON.stringify({ sections: [...sections], at: Date.now() })}\n\n`;
    for (const res of set) { try { res.write(data); } catch (e) { /* closed; cleaned up on 'close' */ } }
  }
  pending.clear();
}

// Works out who a saved record matters to.
async function peopleFor(db, collection, rec) {
  if (!rec) return [];
  switch (collection) {
    case 'contracts': return [rec.customerId, rec.providerId];
    case 'matches': return [rec.customerId, rec.providerId];
    case 'jobs': return [rec.customerId];
    case 'messages': return [rec.fromId, rec.toId];
    case 'notifications': return [rec.userId];
    case 'tokenLedger': return [rec.userId];
    case 'escrowTransactions':
    case 'scopeChangeRequests':
    case 'disputes': {
      if (rec.customerId || rec.providerId) return [rec.customerId, rec.providerId];
      if (!rec.contractId) return [];
      const c = await db.find('contracts', x => x.id === rec.contractId);
      return c ? [c.customerId, c.providerId] : [];
    }
    default: return [];
  }
}

// v128: marks an update so it doesn't send a "this changed" note. The mark
// is invisible to the database (not an own enumerable field), so it is
// never saved.
const QUIET = Symbol('quiet');
function quiet(patch) { Object.defineProperty(patch, QUIET, { value: true, enumerable: false }); return patch; }

// Wraps the database's insert and update once, at start-up, so every save
// anywhere in the app is noticed without touching each route.
let installed = false;
function install(db) {
  if (installed) return;
  installed = true;
  for (const op of ['insert', 'update']) {
    const original = db[op].bind(db);
    db[op] = async function (collection, ...rest) {
      const result = await original(collection, ...rest);
      const section = SECTION_OF[collection];
      // v128: a save marked quiet (see quiet() below) tells nobody. Used for
      // the live position on a trip, which changes every few seconds: the
      // trip map asks for it by itself, and telling the whole page each time
      // made both dashboards reload and redraw all through the trip.
      const patch = op === 'update' ? rest[1] : null;
      if (patch && patch[QUIET]) return result;
      if (section && streams.size) {
        // Never let a live note slow down or break the save itself.
        peopleFor(db, collection, result).then(ids => { for (const id of new Set(ids.filter(Boolean))) queue(id, section); }).catch(() => {});
      }
      return result;
    };
  }
}

const router = express.Router();

// POST /api/live/ticket — a one-time pass to open the live connection.
router.post('/live/ticket', requireAuth, (req, res) => {
  const ticket = crypto.randomBytes(24).toString('hex');
  tickets.set(ticket, { userId: req.user.sub, role: req.user.role, expires: Date.now() + 60 * 1000 });
  res.json({ ticket });
});

// GET /api/live/stream?ticket=… — stays open and sends "change" notes.
router.get('/live/stream', (req, res) => {
  const t = tickets.get(String(req.query.ticket || ''));
  tickets.delete(String(req.query.ticket || ''));
  if (!t || t.expires < Date.now()) return res.status(401).json({ error: 'Ticket expired. The page asks for a new one by itself.' });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // tells proxies not to hold the notes back
  });
  // v136: about 2 KB of padding first. Some proxies and phone networks hold
  // a response back until they have that much, which made the first notes
  // arrive late (or only when the next one pushed them through).
  res.write(`: ${' '.repeat(2048)}\n\n`);
  res.write(`retry: 5000\nevent: hello\ndata: {}\n\n`);
  if (!streams.has(t.userId)) streams.set(t.userId, new Set());
  const set = streams.get(t.userId);
  if (set.size >= MAX_STREAMS_PER_USER) { const oldest = set.values().next().value; set.delete(oldest); try { oldest.end(); } catch (e) {} }
  set.add(res);
  // A small "still here" every 25 seconds so hosting proxies and phones don't drop a quiet connection.
  // v136: a real "ping" event (not a comment) so the page can tell a live
  // connection from one that has quietly stopped delivering, and reconnect.
  const beat = setInterval(() => { try { res.write(`event: ping\ndata: {}\n\n`); } catch (e) {} }, 20 * 1000);
  req.on('close', () => {
    clearInterval(beat);
    set.delete(res);
    if (!set.size) streams.delete(t.userId);
  });
});

// Old, unused tickets are cleared every minute.
setInterval(() => { const now = Date.now(); for (const [k, v] of tickets) if (v.expires < now) tickets.delete(k); }, 60 * 1000).unref();

// v136: send a named event with data to one person's open pages (used for
// calls: ringing, answer, hang up). Returns how many pages received it.
function sendEvent(userId, event, data) {
  const set = streams.get(userId);
  if (!set || !set.size) return 0;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let n = 0;
  for (const res of set) { try { res.write(msg); n++; } catch (e) { /* closed */ } }
  return n;
}
const isOnline = (userId) => !!(streams.get(userId) && streams.get(userId).size);

function stats() { let open = 0; for (const s of streams.values()) open += s.size; return { people: streams.size, connections: open }; }

module.exports = { install, router, queue, stats, quiet, sendEvent, isOnline };
