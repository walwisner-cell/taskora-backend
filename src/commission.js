// Single source of truth for commission rates by provider plan. Previously
// this constant only lived inside payments.routes.js (used at actual payout
// time). It's pulled out here so admin.routes.js can also use it to show an
// *estimated* commission on transactions that haven't been paid out yet,
// without duplicating (and risking drifting from) the real rate table.
// Rates match the officially published Fees and Payment Policy exactly:
// Starter 13%, Pro 9%, Super-Pro 7%. If these ever change, update the
// actual policy document first — this constant should always follow the
// published policy, never the other way around.
const COMMISSION_RATES = { starter: 0.13, pro: 0.09, superpro: 0.07 };

function commissionRateForPlan(plan) {
  return COMMISSION_RATES[plan] ?? COMMISSION_RATES.starter;
}

// The real rate a specific provider pays right now — an organization's
// negotiated volume-discount rate (see src/schema.sql organizations table)
// always wins over their individual plan rate, since that's the entire
// point of the Custom plan's "volume commission discount" promise. Falls
// back to the normal plan-based rate for any provider not attached to an
// org, or attached to one with no custom rate set.
function effectiveCommissionRate(provider, organization) {
  if (organization && organization.commissionRate != null) return organization.commissionRate;
  return commissionRateForPlan(provider && provider.plan);
}

module.exports = { COMMISSION_RATES, commissionRateForPlan, effectiveCommissionRate };
