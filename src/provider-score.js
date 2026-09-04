const db = require('./db');
const { LICENSED_TRADE_CATEGORIES, hasValidLicense } = require('./routes/marketplace.routes');

// The 9 components and their point weights. The first 8 are exactly as
// originally specified: identity verification (10), document
// verification (10, if applicable), job completed (15), arrived-on-time
// rate (10), repeated customers (15), response time (15), background
// check (10), cancellation rate (20). The 9th, customer trust rating
// (15), was added afterward: a real yes/no "do you trust this provider"
// question customers can optionally answer alongside their star review
// (see POST /reviews in marketplace.routes.js) — a different signal from
// star rating, since someone can leave 4 stars for competent work while
// still genuinely not trusting the person, or vice versa. Those add up
// to 120, not 100 — the total below is capped at 99 (never a perfect
// 100), matching "the score shall run from 0/100 – 99/100" literally:
// 99 is the ceiling, not 100.
//
// Honesty note, worth reading before trusting this number for anything
// serious: three of these nine components don't have a fully precise
// data source to compute from yet, so they use a defensible proxy
// instead — each one says exactly what it's actually measuring in its
// own comment below. And a provider with little or no job history yet
// gets full credit on volume-based components (job count, repeat
// customers, response rate, cancellation rate, trust rating) rather
// than a harsh default of zero — a brand new account hasn't done
// anything wrong, so it shouldn't score as if it had.
const WEIGHTS = {
  identityVerification: 10,
  documentVerification: 10,
  jobsCompleted: 15,
  arrivedOnTime: 10,
  repeatedCustomers: 15,
  responseTime: 15,
  backgroundCheck: 10,
  cancellationRate: 20,
  customerTrustRating: 15,
};

// Same volume benchmark already established elsewhere in this app
// (checkAndAdvanceProviderTier's Pro-tier threshold) for "this provider
// has done enough jobs to judge them on" — reused here rather than
// inventing a second number that could drift from it.
const MEANINGFUL_JOB_COUNT = 50;

// Blends an observed rate toward full credit as real sample size grows,
// instead of switching abruptly from "full credit" to "fully judged" the
// instant there's a single data point. Found by a real audit: a provider
// with 2 completed jobs and one missed arrival stamp was getting a hard
// 0/10 on-time-arrival score — full statistical weight on a sample of 2
// — while their own "Path to Pro" panel says 50 jobs is the real bar for
// being judged that way. This makes the score actually match that
// promise: confidence in the observed rate grows linearly from 0 (no
// data at all) to 1 (MEANINGFUL_JOB_COUNT or more), so a thin sample
// mostly falls back to the benefit of the doubt, and a real, meaningful
// sample increasingly reflects genuine behavior — the same shape of
// reasoning a batting average or a seller rating uses to avoid one early
// data point swinging the whole number.
function blendedCredit(observedFraction, sampleSize, weight) {
  const confidence = Math.min(sampleSize / MEANINGFUL_JOB_COUNT, 1);
  return ((confidence * observedFraction) + (1 - confidence)) * weight;
}

async function computeProviderScore(providerId) {
  const provider = await db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider) return null;

  const contracts = await db.filter('contracts', c => c.providerId === providerId);
  const completed = contracts.filter(c => c.status === 'completed');
  const cancellations = contracts.filter(c => c.status === 'cancelled' && c.cancelledByRole === 'provider');
  const countedCancellations = cancellations.filter(c => !c.protectedCancellation).length;
  const cancellationDenominator = completed.length + cancellations.length;

  // 1. Identity verification — direct, precise: the account's real
  // verified flag (manual admin approval, or the automated Persona flow
  // if connected).
  const identityVerification = provider.verified ? WEIGHTS.identityVerification : 0;

  // 2. Document verification — direct and precise for licensed trades
  // (electrical, plumbing, etc.): full credit only with a real, current,
  // non-expired license on file. "If applicable" is taken literally —
  // a provider whose category doesn't require a license isn't penalized
  // for not having one.
  const licenseApplies = LICENSED_TRADE_CATEGORIES.has(provider.category);
  const documentVerification = !licenseApplies ? WEIGHTS.documentVerification : (hasValidLicense(provider) ? WEIGHTS.documentVerification : 0);

  // 3. Jobs completed — direct: scales up to full credit at
  // MEANINGFUL_JOB_COUNT completed jobs, capped there rather than
  // rewarding volume indefinitely.
  const jobsCompleted = Math.min(completed.length / MEANINGFUL_JOB_COUNT, 1) * WEIGHTS.jobsCompleted;

  // 4. Arrived on time — PROXY. There's no scheduled-arrival-time data
  // precise enough to compare against a real deadline yet (the booking's
  // "time" field is a plain display string, not something safe to
  // machine-parse back into an exact deadline). This instead measures
  // how consistently the provider actually uses the on-my-way/arrived
  // status feature at all on their completed jobs — a real, honest
  // signal of professional habit, just not literally "were they on
  // time." New providers with no completed jobs yet get full credit
  // rather than being penalized for having no history.
  let arrivedOnTime = WEIGHTS.arrivedOnTime;
  if (completed.length > 0) {
    const withArrivalLogged = completed.filter(c => c.arrivedAt).length;
    arrivedOnTime = blendedCredit(withArrivalLogged / completed.length, completed.length, WEIGHTS.arrivedOnTime);
  }

  // 5. Repeated customers — direct: the real share of this provider's
  // completed jobs that come from a customer who has booked them more
  // than once.
  let repeatedCustomers = WEIGHTS.repeatedCustomers;
  if (completed.length > 0) {
    const countByCustomer = new Map();
    for (const c of completed) countByCustomer.set(c.customerId, (countByCustomer.get(c.customerId) || 0) + 1);
    const fromRepeatCustomers = completed.filter(c => countByCustomer.get(c.customerId) > 1).length;
    repeatedCustomers = blendedCredit(fromRepeatCustomers / completed.length, completed.length, WEIGHTS.repeatedCustomers);
  }

  // 6. Response time — PROXY. There's no per-match "time to respond"
  // timestamp recorded yet, so this measures RATE instead of speed: the
  // share of job matches this provider has actually responded to
  // (interested or declined) rather than left sitting unanswered. A
  // provider who ignores every job notification scores low here even
  // though this isn't literally measuring how fast they replied.
  const matches = await db.filter('matches', m => m.providerId === providerId);
  let responseTime = WEIGHTS.responseTime;
  if (matches.length > 0) {
    const responded = matches.filter(m => m.status !== 'pending').length;
    responseTime = blendedCredit(responded / matches.length, matches.length, WEIGHTS.responseTime);
  }

  // 7. Background check — PROXY, and the most honest admission in this
  // whole function: there is no real, separate background-check result
  // anywhere in this system yet (see the legal-readiness checklist —
  // that needs a real vendor like Checkr, not built yet). This currently
  // just mirrors identity verification as a stand-in. Once a real
  // background-check integration exists, this should read its actual
  // pass/fail result instead.
  const backgroundCheck = provider.verified ? WEIGHTS.backgroundCheck : 0;

  // 8. Cancellation rate — direct: reuses the exact same rate
  // calculation already established in checkAndAdvanceProviderTier
  // (src/commission.js), so a provider's cancellation rate means the
  // same thing here as it does for tier advancement — not a second,
  // possibly-different definition of the same concept.
  let cancellationRate = WEIGHTS.cancellationRate;
  if (cancellationDenominator > 0) {
    const rate = (countedCancellations / cancellationDenominator) * 100; // as a percentage
    const goodness = Math.max(0, 1 - rate / 20); // 20%+ cancellation rate = zero goodness
    cancellationRate = blendedCredit(goodness, cancellationDenominator, WEIGHTS.cancellationRate);
  }

  // 9. Customer trust rating — direct: the real share of customers who
  // answered "do you trust this provider?" and said yes (see POST
  // /reviews in marketplace.routes.js, where trustRatePercent is
  // actually computed and stored). Deliberately optional on the
  // customer's side, so a provider nobody has answered this for yet
  // gets full credit rather than being penalized for a question simply
  // not being answered. Blended the same way as the other rate-based
  // components once at least one answer exists — a single early "not
  // trusted" answer on a thin sample shouldn't swing this whole category
  // straight to zero any more than one missed arrival stamp should.
  const customerTrustRating = provider.trustRatePercent != null
    ? blendedCredit(provider.trustRatePercent / 100, provider.trustRatingSampleSize || 1, WEIGHTS.customerTrustRating)
    : WEIGHTS.customerTrustRating;

  const rawTotal = identityVerification + documentVerification + jobsCompleted + arrivedOnTime + repeatedCustomers + responseTime + backgroundCheck + cancellationRate + customerTrustRating;
  const total = Math.max(0, Math.min(99, Math.round(rawTotal)));

  return {
    total,
    breakdown: {
      identityVerification: Math.round(identityVerification * 10) / 10,
      documentVerification: Math.round(documentVerification * 10) / 10,
      jobsCompleted: Math.round(jobsCompleted * 10) / 10,
      arrivedOnTime: Math.round(arrivedOnTime * 10) / 10,
      repeatedCustomers: Math.round(repeatedCustomers * 10) / 10,
      responseTime: Math.round(responseTime * 10) / 10,
      backgroundCheck: Math.round(backgroundCheck * 10) / 10,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      customerTrustRating: Math.round(customerTrustRating * 10) / 10,
    },
    weights: WEIGHTS,
  };
}

// Maps a score to the recommended action, exactly as specified. This is
// a RECOMMENDATION, not something that gets applied automatically — see
// src/provider-score-scheduler.js for why: several of the components
// above are honest proxies, not perfectly precise measurements, and
// automatically shutting off someone's income based on a partly-proxy
// number is a real decision that deserves a human clicking a real
// button, not a script doing it unattended. "Give the verification team
// the ability to pause" is exactly that — a tool they can use, not a
// script that acts on its own.
// What used to be an escalating series of pause durations (1 month, up
// to 12 for the lowest scores) is gone — see NEW_MATCH_TRUST_SCORE_FLOOR
// in marketplace.routes.js for why: pausing someone's whole account
// blocked the very things (completing jobs, responding, avoiding
// cancellations) that would let their score recover. The real
// consequence is now automatic and continuous — a provider at or below
// the floor simply stops receiving new job matches, and starts again
// the moment their score crosses back over, with no admin action
// required either way.
//
// What's left for a human to actually decide is whether real outreach
// would help: a low score can mean something fixable (a run of bad luck,
// a misunderstanding about how the platform works) that a phone call
// could genuinely help with, not just a number to react to.
function recommendedActionForScore(score) {
  if (score > 60) return null; // fine standing, nothing recommended
  if (score > 40) return { callRequired: false, label: 'Approaching the new-match floor — worth keeping an eye on, no action needed yet' };
  return { callRequired: true, label: 'At or below the new-match floor — new job matches are already paused automatically; call to understand why and see if there\'s a real way to help them recover' };
}

module.exports = { computeProviderScore, recommendedActionForScore, MEANINGFUL_JOB_COUNT };
