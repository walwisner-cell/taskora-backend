// v147: Mobile Money numbers and wallets, one place for the whole app.
//
//  - A number can be typed any common way (0777 123 456, 777123456,
//    +231 777 123 456, 00231...) and is kept in the international form the
//    Mobile Money systems use (MSISDN, e.g. 231777123456).
//  - In Liberia (and Ghana) the network is known from the first digits, so
//    an Orange number saved as MTN is caught: Liberia 077 = Orange Money,
//    088 / 055 = Lonestar Cell MTN.
//  - Which wallets can be charged or paid through a real Mobile Money system
//    (an API), and whether that system is switched on. Today that is MTN in
//    Liberia (Lonestar Cell MTN's MoMo API, src/liberia-momo.js), once its
//    keys are set and LCMMMI_INTEGRATION_ENABLED is true. Every other wallet
//    is paid with a payment code (the customer sends to Trothen's number
//    with a code) or sent by the finance team by hand, with a reference.
const pm = require('./payout-methods');

// Calling code, and how many digits follow it (the national number without its leading 0).
const COUNTRY = {
  Liberia: ['231', [9]], Ghana: ['233', [9]], 'Sierra Leone': ['232', [8]], Nigeria: ['234', [10]], Guinea: ['224', [9]],
  "Côte d'Ivoire": ['225', [10]], "Cote d'Ivoire": ['225', [10]], 'Ivory Coast': ['225', [10]], Senegal: ['221', [9]], Gambia: ['220', [7]], 'The Gambia': ['220', [7]],
  Cameroon: ['237', [9]], Kenya: ['254', [9]], Uganda: ['256', [9]], Tanzania: ['255', [9]], Rwanda: ['250', [9]], Zambia: ['260', [9]], Zimbabwe: ['263', [9]],
  Ethiopia: ['251', [9]], Benin: ['229', [10, 8]], Togo: ['228', [8]], Mali: ['223', [8]], 'Burkina Faso': ['226', [8]], Niger: ['227', [8]], Malawi: ['265', [9]],
  Mozambique: ['258', [9]], 'Democratic Republic of the Congo': ['243', [9]], 'DR Congo': ['243', [9]], Egypt: ['20', [10]], Morocco: ['212', [9]],
};
// Network from the first digits of the national number, where it is certain.
const PREFIX = {
  Liberia: [[/^77/, 'Orange Money'], [/^(88|55)/, 'MTN Mobile Money']],
  Ghana: [[/^(24|25|53|54|55|59)/, 'MTN Mobile Money'], [/^(20|50)/, 'Telecel Cash'], [/^(26|27|56|57)/, 'AT Money']],
};

// Reads a typed number. Returns { msisdn, nsn, display, network } or { error }.
function readNumber(input, country) {
  let d = String(input || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2);
  d = d.replace(/\D/g, '');
  const c = COUNTRY[String(country || '').trim()];
  if (!c) {
    if (!/^\d{8,15}$/.test(d)) return { error: 'Enter the Mobile Money number with the country code, for example +231 77 123 4567' };
    return { msisdn: d, nsn: d, display: '+' + d, network: null };
  }
  const [cc, lens] = c;
  let nsn = d.startsWith(cc) && d.length > cc.length + 6 ? d.slice(cc.length) : d.startsWith('0') ? d.slice(1) : d;
  if (!lens.includes(nsn.length)) {
    const eg = country === 'Liberia' ? '0777 123 456 or 0886 123 456' : `+${cc} followed by ${lens[0]} digits`;
    return { error: `That doesn't look like a ${country} mobile number. Enter it like ${eg}.` };
  }
  const rule = (PREFIX[country] || []).find(([re]) => re.test(nsn));
  const display = '+' + cc + ' ' + nsn.replace(/^(\d{2,3})(\d{3})(\d+)$/, '$1 $2 $3');
  return { msisdn: cc + nsn, nsn, display, network: rule ? rule[1] : null };
}

const isMtn = (network) => /\bMTN\b/i.test(String(network || ''));
// Can this wallet go through a real Mobile Money system, and is it on?
function apiFor(country, network) {
  if (String(country || '').trim() === 'Liberia' && isMtn(network)) {
    let on = { collections: false, disbursement: false };
    try { const m = require('./liberia-momo'); on = { collections: m.isCollectionsConfigured(), disbursement: m.isDisbursementConfigured() }; } catch (e) { /* not available */ }
    return { name: 'Lonestar Cell MTN MoMo', ...on };
  }
  return null;
}

// A customer's saved Mobile Money wallet: the number in MSISDN form
// (older saved methods kept it as typed).
function numberOf(method) {
  if (!method) return null;
  if (method.momoNumber) return pm.open(method.momoNumber);
  return method.mobileMoneyNumber ? String(method.mobileMoneyNumber).replace(/\D/g, '') : null;
}
// Charge a customer's default wallet through the API, where possible.
// Returns null when the wallet can't be charged that way (the caller then
// uses a payment code), or the API's answer.
async function chargeDefaultWallet(customer, amountUsd, ref, rate) {
  const db = require('./db');
  const method = await db.find('paymentMethods', m => m.userId === customer.id && m.isDefault && m.type === 'mobile_money');
  if (!method) return null;
  const api = apiFor(customer.country, method.network || method.brand);
  if (!api || !api.collections) return null;
  const msisdn = numberOf(method);
  if (!msisdn) return null;
  return require('./liberia-momo').requestMobileMoneyCollection(msisdn, amountUsd, ref, rate);
}

module.exports = { COUNTRY, readNumber, apiFor, isMtn, numberOf, chargeDefaultWallet };
