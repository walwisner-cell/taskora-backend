const { currencyForCountry, convertFromUSD, APPROX_USD_RATE } = require('./currency-data');

// Default USD prices — same numbers that used to be hardcoded directly into
// the pricing page HTML. These now act as the fallback base price for any
// plan the super admin hasn't explicitly edited yet, so the site keeps
// working identically until someone actually opens the new pricing screen.
const DEFAULT_USD_PRICES = { starter: 0, pro: 20, superpro: 27 };
const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', superpro: 'Super Pro' };
const PLAN_KEYS = ['starter', 'pro', 'superpro'];

// Resolves the USD base price for a plan: an explicit super-admin edit if
// one exists, otherwise the built-in default above.
function resolveUsdBase(plan, baseRows) {
  const row = (baseRows || []).find(r => r.plan === plan);
  return row ? row.usdPrice : DEFAULT_USD_PRICES[plan];
}

// Resolves the effective exchange rate for a currency: a super-admin edit
// if one exists in the DB, otherwise the static approximate rate that
// already powers job-payment currency conversion elsewhere in the app.
function resolveRate(currencyCode, rateRows) {
  const row = (rateRows || []).find(r => r.currencyCode === currencyCode);
  if (row) return row.rateToUsd;
  return APPROX_USD_RATE[currencyCode] ?? 1;
}

// The core calculation: given a country and the current DB state (base
// prices, per-country overrides, exchange rate edits), work out what a plan
// actually costs there — always returning BOTH the local-currency figure
// and its USD equivalent side by side, whether that local figure came from
// an explicit regional override or an automatic conversion. This mirrors
// how job payments are already shown ("$X ≈ local currency Y") rather than
// inventing a new convention.
function effectivePlanPricing(country, { baseRows, overrideRows, rateRows }) {
  const currency = currencyForCountry(country);
  const rate = resolveRate(currency.code, rateRows);

  return PLAN_KEYS.map(plan => {
    const usdBase = resolveUsdBase(plan, baseRows);
    const override = (overrideRows || []).find(o => o.country === country && o.plan === plan);

    let localPrice, usdEquivalent, isOverride;
    if (override) {
      localPrice = override.localPrice;
      // Round to 2dp for the reference figure only — this is a display
      // convenience so an admin can sanity-check their override against
      // the USD base, not a canonical accounting number.
      usdEquivalent = Math.round((localPrice / rate) * 100) / 100;
      isOverride = true;
    } else {
      localPrice = convertFromUSD(usdBase, currency.code, rate);
      usdEquivalent = usdBase;
      isOverride = false;
    }

    return {
      plan,
      label: PLAN_LABELS[plan],
      usdBase,
      localPrice,
      usdEquivalent,
      currencyCode: currency.code,
      currencySymbol: currency.symbol,
      isOverride,
    };
  });
}

module.exports = { DEFAULT_USD_PRICES, PLAN_LABELS, PLAN_KEYS, resolveUsdBase, resolveRate, effectivePlanPricing };
