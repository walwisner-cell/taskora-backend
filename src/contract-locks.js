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

module.exports = { contractStatusLocks, whenFree };
