// A single, shared lock set used by every endpoint that changes a
// contract's status — complete, cancel, and respond-offer, across both
// payments.routes.js and marketplace.routes.js. This has to be one
// shared instance: if each file kept its own separate Set, a customer
// completing a contract and a provider responding to it at nearly the
// same moment would each check a *different* lock and neither would see
// the other's in-progress change, defeating the whole point of locking
// in the first place.
const contractStatusLocks = new Set();

// v153: for the timed jobs (expire unanswered bookings, complete finished
// jobs by themselves, cancel unpaid ones). If a person is changing the same
// booking at that moment, the timed job leaves it for the next round. Inside
// the lock it reads the booking again, so it acts on how things are now, not
// on how they were when the list was made.
async function whenFree(id, fn) {
  if (!id || contractStatusLocks.has(id)) return { skipped: true };
  contractStatusLocks.add(id);
  try { return await fn(); } finally { contractStatusLocks.delete(id); }
}

// v160: waits (up to 20 seconds) until nobody is changing the booking, then
// holds it while fn runs. Used when the money for extra work or a tip
// arrives: it must not be recorded at the very moment the customer completes
// or cancels the booking it belongs to (one would add the extra to the job
// while the other stopped its payment).
async function waitAndHold(id, fn, maxMs = 20000) {
  if (!id) return fn();
  const until = Date.now() + maxMs;
  while (contractStatusLocks.has(id) && Date.now() < until) await new Promise(r => setTimeout(r, 40));
  const mine = !contractStatusLocks.has(id);
  if (mine) { contractStatusLocks.add(id); paymentHolds.add(id); }
  try { return await fn(); } finally { if (mine) { contractStatusLocks.delete(id); paymentHolds.delete(id); } }
}
const paymentHolds = new Set();
// For Complete and Cancel: when the booking is held only because a payment
// for it is being recorded, wait for that (a second or two) instead of
// answering "try again"; a double tap still gets "already being updated".
async function freeOfPayment(id, maxMs = 20000) {
  const until = Date.now() + maxMs;
  while (paymentHolds.has(id) && Date.now() < until) await new Promise(r => setTimeout(r, 40));
}

module.exports = { contractStatusLocks, whenFree, waitAndHold, freeOfPayment };
