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
  free: { label: 'Free', price: 0, feeDiscount: 0, selfServe: true, description: '$0 — book and pay, create an account, full access to the core marketplace.' },
  plus: { label: 'Plus', price: 9.99, feeDiscount: 0.20, selfServe: true, description: 'Lower fees + priority features.' },
  pro: { label: 'Pro', price: 19.99, feeDiscount: 0.40, selfServe: true, description: 'More savings + premium support.', suggestedPrice: true },
  elite: { label: 'Elite', price: 39.99, feeDiscount: 0.60, selfServe: true, description: 'Maximum customer benefits.', suggestedPrice: true },
  vip: { label: 'VIP', price: null, feeDiscount: 0.80, selfServe: false, description: 'Invitation/eligibility — includes concierge support. Granted by Trothen, not self-purchased.' },
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

module.exports = { MEMBERSHIP_TIERS, feeDiscountForTier, resolveMembershipPrice };
