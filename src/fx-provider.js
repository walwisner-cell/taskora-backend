// Live exchange-rate provider — open.er-api.com. Free, no API key
// required, updates once every 24 hours, base currency USD (matching the
// convention used throughout this app: rate = units of local currency per
// $1 USD). If this ever needs to move to a paid provider with better
// coverage or more frequent updates, this is the only file that needs to
// change — everything else calls fetchLiveRates() and doesn't know or
// care which provider is behind it.
//
// NOTE: this was written and code-reviewed but could not be test-fetched
// from the development sandbox this was built in (its outbound network is
// allowlisted to a small set of package-registry domains and doesn't
// include this provider). It follows the documented response shape
// exactly, but the first real confirmation it's working will be an actual
// deploy — use the "Refresh Live Rates Now" button in Plans & Pricing
// (super admin) right after deploying to confirm, rather than waiting for
// the first scheduled refresh.
const PROVIDER_URL = 'https://open.er-api.com/v6/latest/USD';

async function fetchLiveRates() {
  const res = await fetch(PROVIDER_URL);
  if (!res.ok) throw new Error(`Exchange rate provider returned HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== 'success' || !data.rates) {
    throw new Error(`Exchange rate provider returned an unexpected response shape: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { rates: data.rates, providerUpdatedAt: data.time_last_update_utc || null };
}

module.exports = { fetchLiveRates, PROVIDER_URL };
