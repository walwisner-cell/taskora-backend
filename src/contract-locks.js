// A single, shared lock set used by every endpoint that changes a
// contract's status — complete, cancel, and respond-offer, across both
// payments.routes.js and marketplace.routes.js. This has to be one
// shared instance: if each file kept its own separate Set, a customer
// completing a contract and a provider responding to it at nearly the
// same moment would each check a *different* lock and neither would see
// the other's in-progress change, defeating the whole point of locking
// in the first place.
const contractStatusLocks = new Set();

module.exports = { contractStatusLocks };
