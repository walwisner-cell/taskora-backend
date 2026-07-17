// Real currency codes and symbols per country, plus exchange rates for
// converting between a person's local currency and USD.
//
// IMPORTANT — exchange rates below are static, approximate reference
// values, not live market rates. No real foreign-exchange data provider is
// connected yet (that would need a service like exchangerate-api.com,
// Open Exchange Rates, or a bank/payment processor's FX feed). Every place
// these rates are used is clearly labeled "test mode" / "approximate" in
// the UI — this is the same honest pattern used elsewhere in the app for
// anything that needs a real external service before going live (SMS,
// email, payment processing). Before this goes to production, wire
// fetchLiveRates() (stubbed below) up to a real provider and have it
// refresh these periodically instead of using the static table.

const CURRENCY_BY_COUNTRY = {
  'United States': { code: 'USD', symbol: '$', name: 'US Dollar' },
  'Nigeria': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  'Ghana': { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  'Liberia': { code: 'LRD', symbol: 'L$', name: 'Liberian Dollar' },
  'United Kingdom': { code: 'GBP', symbol: '£', name: 'British Pound' },
  'Canada': { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  'Kenya': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  'South Africa': { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  'India': { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  'Germany': { code: 'EUR', symbol: '€', name: 'Euro' },
  'France': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Italy': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Spain': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Netherlands': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Ireland': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Portugal': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Belgium': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Austria': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Finland': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Greece': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Australia': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  'New Zealand': { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  'Japan': { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  'China': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  'Brazil': { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  'Mexico': { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso' },
  'Egypt': { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  'Morocco': { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham' },
  'Saudi Arabia': { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal' },
  'United Arab Emirates': { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  'Israel': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  'Turkey': { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  'Russia': { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  'Philippines': { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  'Indonesia': { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  'Malaysia': { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  'Singapore': { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  'Thailand': { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  'Vietnam': { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  'South Korea': { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  'Pakistan': { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  'Bangladesh': { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  'Ethiopia': { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
  'Tanzania': { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  'Uganda': { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  'Rwanda': { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc' },
  'Zambia': { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha' },
  'Zimbabwe': { code: 'ZWL', symbol: 'Z$', name: 'Zimbabwean Dollar' },
  'Argentina': { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  'Colombia': { code: 'COP', symbol: 'CO$', name: 'Colombian Peso' },
  'Chile': { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso' },
  'Peru': { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  'Poland': { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  'Sweden': { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  'Norway': { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  'Denmark': { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  'Switzerland': { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  'Ukraine': { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' },
};

// Approximate USD conversion rates (units of local currency per 1 USD) —
// see the file-level note above: these are static test-mode reference
// values, not live rates.
const APPROX_USD_RATE = {
  USD: 1, NGN: 1550, GHS: 15.3, LRD: 190, GBP: 0.78, CAD: 1.37, KES: 129,
  ZAR: 18.2, INR: 84, EUR: 0.92, AUD: 1.52, NZD: 1.66, JPY: 152, CNY: 7.2,
  BRL: 5.6, MXN: 18.5, EGP: 49, MAD: 9.8, SAR: 3.75, AED: 3.67, ILS: 3.7,
  TRY: 34, RUB: 92, PHP: 57, IDR: 15800, MYR: 4.5, SGD: 1.35, THB: 35,
  VND: 25400, KRW: 1370, PKR: 278, BDT: 118, ETB: 118, TZS: 2650, UGX: 3750,
  RWF: 1310, ZMW: 27, ZWL: 26000, ARS: 970, COP: 4100, CLP: 940, PEN: 3.75,
  PLN: 3.95, SEK: 10.9, NOK: 11.3, DKK: 6.9, CHF: 0.89, UAH: 41,
};

function currencyForCountry(country) {
  return CURRENCY_BY_COUNTRY[country] || { code: 'USD', symbol: '$', name: 'US Dollar' };
}

// Converts a USD amount into the target currency, rounded sensibly (whole
// units for high-denomination currencies like NGN/IDR, 2 decimals for
// others). `rateOverride`, if given, is used instead of the static table
// below — this is how a super admin's edited exchange rate (see
// src/plan-pricing.js resolveRate) flows through to every conversion in
// the app without this function needing to know about the database.
function convertFromUSD(usdAmount, currencyCode, rateOverride) {
  const rate = rateOverride ?? (APPROX_USD_RATE[currencyCode] ?? 1);
  const converted = usdAmount * rate;
  const wholeUnitCurrencies = new Set(['NGN', 'IDR', 'VND', 'KRW', 'UGX', 'TZS', 'ZWL', 'RWF']);
  return wholeUnitCurrencies.has(currencyCode) ? Math.round(converted) : Math.round(converted * 100) / 100;
}

// Stub for wiring in a real live-rate provider later — deliberately not
// implemented, since no FX API is connected yet. Swapping this out (and
// having it refresh APPROX_USD_RATE periodically) is the one change needed
// to move from test-mode rates to real ones.
async function fetchLiveRates() {
  throw new Error('No live exchange rate provider is connected yet — using static approximate rates.');
}

module.exports = { CURRENCY_BY_COUNTRY, APPROX_USD_RATE, currencyForCountry, convertFromUSD, fetchLiveRates };
