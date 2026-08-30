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

function feeDiscountForTier(tier) {
  const config = MEMBERSHIP_TIERS[tier];
  return config ? config.feeDiscount : 0;
}

module.exports = { MEMBERSHIP_TIERS, feeDiscountForTier };
