const db = require('./db');
const { fetchLiveRates } = require('./fx-provider');
const { CURRENCY_BY_COUNTRY } = require('./currency-data');

// Pulls fresh rates from the live provider and stores them — but only for
// currencies that AREN'T currently pinned by a manual admin edit
// (source: 'manual'). This is the same fallback-chain philosophy used
// elsewhere in this app (plan pricing overrides, category active toggles):
// an explicit human decision always wins over automation, automation only
// fills in what nobody has explicitly decided.
async function refreshLiveExchangeRates() {
  const ourCurrencies = new Set(Object.values(CURRENCY_BY_COUNTRY).map(c => c.code));
  ourCurrencies.delete('USD'); // USD is always 1 by definition — never stored

  let liveData;
  try {
    liveData = await fetchLiveRates();
  } catch (e) {
    console.error(`[exchange-rates] Live refresh failed: ${e.message} — keeping whatever rates are already stored.`);
    return { ok: false, error: e.message };
  }

  const existingRows = await db.all('exchangeRates');
  const existingByCode = new Map(existingRows.map(r => [r.currencyCode, r]));

  let updated = 0, skippedManual = 0;
  const missingFromProvider = [];
  const now = new Date().toISOString();

  for (const code of ourCurrencies) {
    const rate = liveData.rates[code];
    if (rate === undefined) { missingFromProvider.push(code); continue; }

    const existing = existingByCode.get(code);
    if (existing && existing.source === 'manual') { skippedManual++; continue; }

    const patch = { currencyCode: code, rateToUsd: rate, source: 'live', fetchedAt: now, updatedAt: now };
    if (existing) await db.update('exchangeRates', existing.id, patch);
    else await db.insert('exchangeRates', { id: `xr_${code}`, ...patch });
    updated++;
  }

  const summary = { ok: true, updated, skippedManual, missingFromProvider, providerUpdatedAt: liveData.providerUpdatedAt, refreshedAt: now };
  console.log(`[exchange-rates] Live refresh complete: ${updated} updated, ${skippedManual} skipped (manual override)${missingFromProvider.length ? `, not covered by provider: ${missingFromProvider.join(', ')}` : ''}.`);
  return summary;
}

module.exports = { refreshLiveExchangeRates };
