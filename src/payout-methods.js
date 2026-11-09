// v141: how a pro or seller is paid, by country.
//
// In Liberia and across Africa people are paid by Mobile Money (Orange
// Money, MTN MoMo, M-Pesa...) or into a bank account. PayPal can't pay
// people out in Africa, so it isn't offered there at all.
//
// What a person saves:
//   payoutMethod   'Mobile Money' | 'Bank Transfer' | 'PayPal' (outside Africa only)
//   payoutMobile   { network, number, name }      the wallet and the name it's registered in
//   payoutBank     { bankName, accountName, accountNumber, branch, swift }
//
// Account and wallet numbers are kept encrypted when ID_FILE_ENCRYPTION_KEY
// is set (the same key as ID photos), and the app only ever shows the last
// 4 digits. The team sees the full number only when sending a payout.
const crypto = require('crypto');

const AFRICA = new Set([
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cape Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
  'Congo', 'Republic of the Congo', 'Democratic Republic of the Congo', 'DR Congo', "Côte d'Ivoire", "Cote d'Ivoire", 'Ivory Coast', 'Djibouti', 'Egypt',
  'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Swaziland', 'Ethiopia', 'Gabon', 'Gambia', 'The Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho',
  'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda',
  'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia',
  'Uganda', 'Zambia', 'Zimbabwe',
]);

// The wallets people actually use, per country. "Other" is always offered too.
const NETWORKS = {
  Liberia: ['Orange Money', 'MTN Mobile Money'],
  'Sierra Leone': ['Orange Money', 'Africell Money'],
  Guinea: ['Orange Money', 'MTN Mobile Money'],
  Ghana: ['MTN Mobile Money', 'Telecel Cash', 'AT Money'],
  Nigeria: ['OPay', 'PalmPay', 'Moniepoint', 'MTN MoMo PSB'],
  "Côte d'Ivoire": ['Orange Money', 'MTN Mobile Money', 'Moov Money', 'Wave'],
  "Cote d'Ivoire": ['Orange Money', 'MTN Mobile Money', 'Moov Money', 'Wave'],
  'Ivory Coast': ['Orange Money', 'MTN Mobile Money', 'Moov Money', 'Wave'],
  Senegal: ['Wave', 'Orange Money', 'Free Money'],
  Gambia: ['Wave', 'Afrimoney', 'QMoney'],
  'The Gambia': ['Wave', 'Afrimoney', 'QMoney'],
  Cameroon: ['MTN Mobile Money', 'Orange Money'],
  Kenya: ['M-Pesa', 'Airtel Money'],
  Uganda: ['MTN Mobile Money', 'Airtel Money'],
  Tanzania: ['M-Pesa', 'Airtel Money', 'Mixx by Yas', 'HaloPesa'],
  Rwanda: ['MTN Mobile Money', 'Airtel Money'],
  Zambia: ['MTN Mobile Money', 'Airtel Money', 'Zamtel Kwacha'],
  Zimbabwe: ['EcoCash', 'OneMoney'],
  Ethiopia: ['telebirr', 'M-Pesa'],
  Malawi: ['Airtel Money', 'TNM Mpamba'],
  Mozambique: ['M-Pesa', 'e-Mola', 'mKesh'],
  'Democratic Republic of the Congo': ['M-Pesa', 'Orange Money', 'Airtel Money'],
  'DR Congo': ['M-Pesa', 'Orange Money', 'Airtel Money'],
  Benin: ['MTN Mobile Money', 'Moov Money'],
  Togo: ['Flooz', 'T-Money'],
  Mali: ['Orange Money', 'Moov Money'],
  'Burkina Faso': ['Orange Money', 'Moov Money'],
  Niger: ['Airtel Money', 'Moov Money'],
  Egypt: ['Vodafone Cash', 'Orange Cash', 'Etisalat Cash'],
  Morocco: ['Orange Money', 'Inwi Money'],
  'South Africa': [],
};

// v150: a country is matched however it was typed ("liberia", "Liberia ", "LIBERIA").
const canonCountry = (country) => { const c = String(country || '').trim(); if (!c) return ''; const low = c.toLowerCase(); for (const k of [...Object.keys(NETWORKS), ...AFRICA]) if (k.toLowerCase() === low) return k; return c; };
const isAfrica = (country) => AFRICA.has(canonCountry(country));
const networksFor = (country) => [...(NETWORKS[canonCountry(country)] || []), 'Other'];

// The methods offered to someone in this country, most used first.
function methodsFor(country) {
  if (isAfrica(country)) return ['Mobile Money', 'Bank Transfer'];
  return ['Bank Transfer', 'PayPal', 'Mobile Money'];
}
function intlMethodsFor(country) {
  return isAfrica(country) ? ['Bank Transfer'] : ['PayPal', 'Bank Transfer'];
}
// Older accounts saved "Wallet / Mobile Money" or "Debit Card".
function normalMethod(m) {
  if (m === 'Wallet / Mobile Money') return 'Mobile Money';
  return m;
}

// ── keeping numbers private ─────────────────────────────────────────────
function key() {
  const hex = (process.env.ID_FILE_ENCRYPTION_KEY || '').trim();
  return /^[0-9a-fA-F]{64}$/.test(hex) ? Buffer.from(hex, 'hex') : null;
}
function seal(text) {
  const k = key();
  if (!k) return { plain: text };
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return { enc: Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64') };
}
function open(sealed) {
  if (!sealed) return null;
  if (sealed.plain != null) return String(sealed.plain);
  const k = key();
  if (!k || !sealed.enc) return null;
  try {
    const raw = Buffer.from(sealed.enc, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return null; }
}
const last4 = (s) => String(s || '').replace(/\D/g, '').slice(-4);
const cleanText = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

// Cleans the wallet a person saves. Returns { value } or { error }.
function cleanMobile(input, country) {
  const b = input || {};
  const network = cleanText(b.network, 40);
  if (!network) return { error: 'Choose your Mobile Money network' };
  if (!networksFor(country).includes(network) && network.length < 2) return { error: 'Choose your Mobile Money network' };
  const digits = String(b.number || '').replace(/[\s\-().]/g, '');
  if (!/^\+?\d{7,15}$/.test(digits)) return { error: 'Enter the Mobile Money number, with the country code if you know it (for example +231 77 123 4567)' };
  const name = cleanText(b.name, 80);
  if (name.length < 2) return { error: 'Enter the name the Mobile Money account is registered in' };
  return { value: { network, number: seal(digits), last4: last4(digits), name } };
}
function cleanBank(input) {
  const b = input || {};
  const bankName = cleanText(b.bankName, 80);
  const accountName = cleanText(b.accountName, 80);
  const acct = String(b.accountNumber || '').replace(/[\s-]/g, '').toUpperCase();
  if (bankName.length < 2) return { error: 'Enter the name of your bank' };
  if (accountName.length < 2) return { error: 'Enter the name on the bank account' };
  if (!/^[A-Z0-9]{5,34}$/.test(acct)) return { error: 'Enter the account number (5 to 34 letters and numbers; an IBAN works too)' };
  const swift = cleanText(b.swift, 11).toUpperCase();
  if (swift && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) return { error: 'The SWIFT / BIC code is 8 or 11 letters and numbers' };
  return { value: { bankName, accountName, accountNumber: seal(acct), last4: last4(acct) || acct.slice(-4), branch: cleanText(b.branch, 80), swift } };
}

// What the person themselves (and their screens) see: never the full number.
// v148: payouts go to an account in the pro's own name or their business's
// name (the usual know-your-customer rule for paying out money). A different
// name is allowed but flagged, so finance checks it before sending.
function nameMatches(u, accountName) {
  const words = (x) => String(x || '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
  const acc = new Set(words(accountName));
  if (!acc.size) return false;
  const mine = [...words(u && u.name), ...words(u && u.businessName)];
  return mine.filter(w => acc.has(w)).length >= Math.min(2, Math.max(1, words(u && u.name).length - 1)) || words(u && u.businessName).some(w => acc.has(w));
}
function publicMobile(m) { return m ? { network: m.network, name: m.name, last4: m.last4, nameMatch: m.nameMatch !== false } : null; }
function publicBank(b) { return b ? { bankName: b.bankName, accountName: b.accountName, last4: b.last4, branch: b.branch || '', swift: b.swift || '', nameMatch: b.nameMatch !== false } : null; }

// Where a payout goes, in words, e.g. "Orange Money •••• 4567 (J. Doe)".
function destinationText(u, method) {
  const m = normalMethod(method);
  if (m === 'Mobile Money' && u.payoutMobile) return `${u.payoutMobile.network} •••• ${u.payoutMobile.last4} (${u.payoutMobile.name})`;
  if (m === 'Bank Transfer' && u.payoutBank) return `${u.payoutBank.bankName} •••• ${u.payoutBank.last4} (${u.payoutBank.accountName})`;
  if (m === 'PayPal' && u.payoutPaypalEmail) return `PayPal ${u.payoutPaypalEmail}`;
  return null;
}

// Before a payout: is there somewhere to send it? Returns null or an error.
function readyToPay(u, method) {
  const m = normalMethod(method);
  if (m === 'PayPal' && isAfrica(u.country)) return 'PayPal can\'t pay out in your country. Choose Mobile Money or Bank Transfer in your payout settings.';
  if (m === 'Mobile Money' && !u.payoutMobile) return 'Add your Mobile Money number first, so we know where to send your money.';
  if (m === 'Bank Transfer' && !u.payoutBank) return 'Add your bank account first, so we know where to send your money.';
  if (m === 'PayPal' && !u.payoutPaypalEmail) return 'Add your PayPal email first.';
  return null;
}

// What the team needs to send it (full number, for the payout record only).
function sendTo(u, method) {
  const m = normalMethod(method);
  if (m === 'Mobile Money' && u.payoutMobile) return { method: m, network: u.payoutMobile.network, name: u.payoutMobile.name, last4: u.payoutMobile.last4, number: u.payoutMobile.number };
  if (m === 'Bank Transfer' && u.payoutBank) return { method: m, bankName: u.payoutBank.bankName, accountName: u.payoutBank.accountName, last4: u.payoutBank.last4, branch: u.payoutBank.branch, swift: u.payoutBank.swift, accountNumber: u.payoutBank.accountNumber };
  if (m === 'PayPal') return { method: m, email: u.payoutPaypalEmail || null };
  return { method: m };
}

module.exports = { canonCountry, nameMatches, AFRICA, NETWORKS, isAfrica, networksFor, methodsFor, intlMethodsFor, normalMethod, seal, open, cleanMobile, cleanBank, publicMobile, publicBank, destinationText, readyToPay, sendTo };
