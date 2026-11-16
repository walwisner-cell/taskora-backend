// Membership tiers, exactly as specified: Free, Plus, Pro, Elite, VIP.
// Only Free ($0) and Plus ($9.99) had real prices given for them — Pro
// and Elite are marked below as suggested starting prices, easy to
// change in this one place, not something claimed to be a final decision
// made without you. VIP is deliberately not self-serve purchasable at
// any price — "Invitation/eligibility" means a real admin grants it to a
// specific customer, not something anyone can buy their way into.
//
// "Lower fees" and "more savings" are the one benefit here concrete
// enough to actually build: each paid tier gives a real discount on the
// platform's own service fee (never on what the provider is paid — that
// never changes based on membership). "Priority features" and "premium
// support" / "concierge" are real, valuable ideas, but they're support-
// routing and feature-access concepts, not something with an unambiguous
// mechanism to build without more specifics — they're described
// honestly as-is for now rather than half-built into something that
// doesn't actually do anything yet.
const MEMBERSHIP_TIERS = {
  free: { label: 'Free', price: 0, feeDiscount: 0, selfServe: true, description: '$0. Book and pay, with full access to the marketplace.' },
  // v167: Walter: "fix this with explanation". The cards said "Lower fees +
  // priority features", "More savings + premium support" and "Maximum
  // customer benefits", but the only thing a membership actually does is the
  // service-fee discount; nothing called "priority" or "premium support"
  // exists. Consumer-protection rules (the US FTC's, the EU's) and good
  // practice say a subscription must state plainly what it gives, so each
  // tier now says exactly that.
  plus: { label: 'Plus', price: 9.99, feeDiscount: 0.20, selfServe: true, description: "20% off Trothen's service fee on every booking with a pro." },
  pro: { label: 'Pro', price: 19.99, feeDiscount: 0.40, selfServe: true, description: "40% off Trothen's service fee on every booking with a pro.", suggestedPrice: true },
  elite: { label: 'Elite', price: 39.99, feeDiscount: 0.60, selfServe: true, description: "60% off Trothen's service fee on every booking with a pro.", suggestedPrice: true },
  vip: { label: 'VIP', price: null, feeDiscount: 0.80, selfServe: false, description: "By invitation only. 80% off Trothen's service fee on every booking with a pro." },
};

// Resolves the real, current USD price for a paid tier: a super-admin
// edit if one exists in the DB (see PATCH /admin/settings/membership-
// pricing), otherwise the built-in default above — the exact same
// "DB override, code default as fallback" pattern already used for
// provider plan pricing (resolveUsdBase in src/plan-pricing.js). This is
// the ONE place both what a customer is shown (GET /membership/tiers)
// and what they're actually charged (POST /membership/subscribe) get
// the price from — those two were previously two separate reads of the
// same hardcoded constant, which is fine only as long as nothing is
// ever editable; now that a price CAN be edited, both call sites go
// through this so a customer is never shown one number and charged a
// different, stale one.
function resolveMembershipPrice(tier, baseRows) {
  const config = MEMBERSHIP_TIERS[tier];
  if (!config || config.price === null) return config ? config.price : null; // VIP stays null — never self-serve priced
  const row = (baseRows || []).find(r => r.tier === tier);
  return row ? row.usdPrice : config.price;
}

function feeDiscountForTier(tier) {
  const config = MEMBERSHIP_TIERS[tier];
  return config ? config.feeDiscount : 0;
}

// v167: the service fee a customer pays on a booking (the same numbers as
// computeServiceFee in marketplace.routes.js): 9% of the job, at least
// $2.99 and at most $25.
const SERVICE_FEE = { rate: 0.09, min: 2.99, max: 25 };

// How much a month of bookings makes a tier pay for itself: the fee saved is
// discount × 9% of what is spent, so it breaks even at price ÷ (discount × 9%).
// Rounded up to a tidy figure, as it is an estimate.
function breakEvenUsd(tier, price) {
  const d = feeDiscountForTier(tier);
  if (!d || !(price > 0)) return null;
  return Math.ceil(price / (d * SERVICE_FEE.rate) / 10) * 10;
}

// Paid tiers must cost more as they give more (a bigger discount), or the
// cheaper tier would make no sense.
function orderProblem(prices) {
  const order = ['plus', 'pro', 'elite'];
  for (let i = 1; i < order.length; i++) if (prices[order[i]] != null && prices[order[i - 1]] != null && prices[order[i]] <= prices[order[i - 1]]) return `${MEMBERSHIP_TIERS[order[i]].label} must cost more than ${MEMBERSHIP_TIERS[order[i - 1]].label}.`;
  return null;
}

module.exports = { MEMBERSHIP_TIERS, feeDiscountForTier, resolveMembershipPrice, SERVICE_FEE, breakEvenUsd, orderProblem };
