// v166: Walter, looking at a chat about a cancelled store order: "why should
// this work if I don't have anything to do with him now". Before, anyone could
// send a message to anyone, for ever, and a chat in which both had written
// in the last 7 days also allowed calls.
//
// What marketplaces and ride apps do (Uber, Bolt, Airbnb, Upwork, Jumia):
// people talk through the app while they have something together, and for a
// short time after, to sort out what is left (a lost item, a refund, a
// return, a review). After that the chat stays readable (it is the record if
// there is a dispute) but closes: to talk again they book again, or ask
// Trothen's support.
//
//   Open booking, order, ride, delivery or job response  messages and calls
//   Completed                                            messages 14 days, calls 24 hours
//   Cancelled, declined, refunded or expired             messages 2 days, no calls
//   A customer's question to a pro, or anyone's to a seller with a Market listing on sale:
//                                                        messages (they can answer for 14 days), no calls
//   Nothing together                                     closed (the history can still be read)
//
// The Trothen team (admins) can always write to anyone.
const db = require('./db');

const DAY = 24 * 3600 * 1000;
const ENDED_OK = ['completed', 'released'];
const ENDED_OFF = ['cancelled', 'declined', 'refunded', 'expired', 'closed', 'rejected'];
const MSG_AFTER_DONE = 14 * DAY, CALL_AFTER_DONE = 1 * DAY, MSG_AFTER_OFF = 2 * DAY;
const CLOSED_JOB = ['closed', 'cancelled', 'expired', 'completed', 'deleted'];

const endOf = (c) => Date.parse(c.completedAt || c.cancelledAt || c.updatedAt || c.createdAt) || 0;

// What `a` may do towards `b` now, and until when: { message, call, until, why }.
async function between(a, b) {
  if (!a || !b || a.id === b.id) return { message: false, call: false, why: 'none' };
  if (a.role === 'admin' || b.role === 'admin') return { message: true, call: false, why: 'team' };
  const now = Date.now();
  let message = false, call = false, until = 0, why = 'none';
  const pair = (x, y) => (x === a.id && y === b.id) || (x === b.id && y === a.id);
  // The two sides of a booking, and also a seller and the driver carrying their goods.
  const contracts = await db.filter('contracts', c => pair(c.customerId, c.providerId) || (c.delivery && pair(c.delivery.sellerId, c.providerId)));
  for (const c of contracts) {
    if (ENDED_OK.includes(c.status)) {
      const end = endOf(c);
      if (now - end < MSG_AFTER_DONE) { message = true; until = Math.max(until, end + MSG_AFTER_DONE); why = why === 'open' ? why : 'done'; }
      if (now - end < CALL_AFTER_DONE) call = true;
    } else if (ENDED_OFF.includes(c.status)) {
      const end = endOf(c);
      if (now - end < MSG_AFTER_OFF) { message = true; until = Math.max(until, end + MSG_AFTER_OFF); if (why === 'none') why = 'cancelled'; }
    } else { message = true; call = true; why = 'open'; until = Infinity; }
  }
  // A job response (a pro answered a customer's posted job) while the job is open.
  const cust = a.role === 'customer' ? a : b.role === 'customer' ? b : null, pro = cust === a ? b : a;
  if (cust && pro.role === 'provider' && why !== 'open') {
    for (const m of await db.filter('matches', m => m.customerId === cust.id && m.providerId === pro.id)) {
      const job = m.jobId ? await db.find('jobs', j => j.id === m.jobId) : null;
      if (job && !CLOSED_JOB.includes(job.status) && !['not_selected', 'declined'].includes(m.status)) { message = true; call = true; why = 'open'; until = Infinity; break; }
    }
  }
  // Asking before booking or buying (as on Airbnb, Thumbtack, Jiji and Facebook
  // Marketplace): a customer may write to a pro, and anyone may write to someone
  // with a Market listing on sale. The other side can answer for 14 days after
  // the last message they were sent. Neither opens calls.
  if (!message && a.role === 'customer' && b.role === 'provider') { message = true; why = 'enquiry'; }
  if (!message && await db.find('marketListings', l => l.sellerId === b.id && l.status === 'live')) { message = true; why = 'enquiry'; }
  if (!message && await db.find('rentalListings', l => l.hostId === b.id && l.status === 'live')) { message = true; why = 'enquiry'; } // v180: asking a host about their place
  if (!message) {
    const last = (await db.filter('messages', m => m.fromId === b.id && m.toId === a.id && m.kind !== 'call')).reduce((t, m) => Math.max(t, Date.parse(m.createdAt) || 0), 0);
    if (last && now - last < MSG_AFTER_DONE) { message = true; why = 'reply'; until = last + MSG_AFTER_DONE; }
  }
  return { message, call, until: until === Infinity ? null : (until ? new Date(until).toISOString() : null), why };
}

// The words shown when a chat is closed.
function closedWords(state, name) {
  if (state.message) return '';
  return `This conversation is closed: you have no open booking, order or ride with ${name || 'this person'}. You can still read it. To talk again, book again, or ask Trothen Support for help.`;
}

module.exports = { between, closedWords, MSG_AFTER_DONE, CALL_AFTER_DONE, MSG_AFTER_OFF };
