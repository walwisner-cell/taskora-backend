// Real, admin-configurable pricing for the self-serve provider
// advertising flow — an existing, already-verified provider pays this
// amount to submit their own profile as an ad, pending a quick admin
// content review (not a price negotiation, since the price is already
// fixed and known upfront). A regional admin can set their own city's
// price; anywhere without a specific override uses the platform default.
// Reuses the existing getSetting/setSetting infrastructure rather than a
// separate storage mechanism, matching the same convention used
// everywhere else in this app for admin-editable settings.
async function selfServeAdPriceForCity(city) {
  const { getSetting } = require('./platform-settings');
  if (city) {
    const override = await getSetting(`selfServeAdPrice:${city}`);
    if (override != null) return override;
  }
  const globalSetting = await getSetting('selfServeAdPrice:default');
  return globalSetting != null ? globalSetting : 25;
}

module.exports = { selfServeAdPriceForCity };

