// Single source of truth for commission rates by provider plan. Previously
// this constant only lived inside payments.routes.js (used at actual payout
// time). It's pulled out here so admin.routes.js can also use it to show an
// *estimated* commission on transactions that haven't been paid out yet,
// without duplicating (and risking drifting from) the real rate table.
const COMMISSION_RATES = { starter: 0.12, pro: 0.08, superpro: 0.05 };

function commissionRateForPlan(plan) {
  return COMMISSION_RATES[plan] ?? COMMISSION_RATES.starter;
}

module.exports = { COMMISSION_RATES, commissionRateForPlan };
