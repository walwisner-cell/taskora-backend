// v106: is this guarantor really someone else?
//
// A guarantor vouches for a pro when there is no background-check service
// to use. If the "guarantor" has the pro's own phone number or the pro's
// own name, a call to them proves nothing. This is the one place that
// decides that, used when a pro saves guarantors and when the team reviews
// ones saved before this check existed.
const normalizeNameForMatch = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 0 && !['jr', 'sr', 'ii', 'iii', 'iv'].includes(w));

// Phone numbers are compared by their last 9 digits, so "+231 77 000 0000",
// "0770000000" and "231770000000" count as the same number.
function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-9) : digits;
}
function sameName(a, b) {
  const key = (n) => { const t = normalizeNameForMatch(String(n || '')); return (Array.isArray(t) ? t.slice().sort().join(' ') : String(t)).trim(); };
  const x = key(a), y = key(b);
  return x.length >= 4 && x === y;
}
// Returns 'phone', 'name' or null.
function guarantorProblem(pro, g) {
  if (!pro || !g) return null;
  const k = phoneKey(g.phone);
  if (k && k.length >= 7 && k === phoneKey(pro.phone)) return 'phone';
  if (sameName(g.name, pro.name)) return 'name';
  return null;
}

// v167: Walter, on Admin → Verification → Guarantors to Call: "organize
// this". The list showed numbers like "088900998" with no country code (a
// tap on them dialled the wrong country from abroad), names like "hhgshhs",
// and relationships like "ssddffdd", and nothing said so.
//
// The international way to write a phone number is E.164: + country code,
// then the number without its leading 0 (+231 88 900 998). It works from any
// phone, in any country, and in WhatsApp links.

// How many digits a number has after the country code, for the countries
// Trothen is used in most (from the ITU's national numbering plans).
const NSN_DIGITS = { 'Liberia': [7, 9], 'United States': [10, 10], 'Canada': [10, 10], 'Nigeria': [10, 10], 'Ghana': [9, 9], 'Sierra Leone': [8, 8], 'Kenya': [9, 9], 'United Kingdom': [10, 10], 'Guinea': [9, 9], "Cote d'Ivoire": [10, 10], 'Gambia': [7, 7], 'South Africa': [9, 9] };

// The number in international form for the pro's country, or null when it
// can't be made sense of.
function phoneIntl(phone, country) {
  const raw = String(phone || '').trim();
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const dial = String(require('./geo-data').dialCodeForCountry(country) || '').replace(/\D/g, '');
  if (raw.startsWith('+') || raw.startsWith('00')) {
    if (raw.startsWith('00')) digits = digits.slice(2);
    return '+' + digits;
  }
  if (dial && digits.startsWith(dial) && digits.length > dial.length + 6) return '+' + digits; // written with the code but no +
  if (dial === '1' && digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  digits = digits.replace(/^0+/, '');
  return dial ? `+${dial}${digits}` : null;
}
// Does the number have the right length for the country?
function phoneLooksRight(phone, country) {
  const intl = phoneIntl(phone, country);
  if (!intl) return false;
  const dial = String(require('./geo-data').dialCodeForCountry(country) || '').replace(/\D/g, '');
  const nsn = dial && intl.startsWith('+' + dial) ? intl.length - 1 - dial.length : null;
  const [lo, hi] = NSN_DIGITS[country] || [7, 12];
  if (nsn == null) return intl.length >= 9 && intl.length <= 16; // another country's number: the general E.164 length
  return nsn >= lo && nsn <= hi;
}
// "+231 88 900 998": the number written in groups, easier to read out on a call.
function phoneDisplay(intl, country) {
  if (!intl) return '';
  const dial = String(require('./geo-data').dialCodeForCountry(country) || '').replace(/\D/g, '');
  // The country code: the pro's own, or the longest known code the number starts with.
  let code = dial && intl.startsWith('+' + dial) ? dial : '';
  if (!code) {
    const codes = [...new Set(Object.values(require('./geo-data').DIAL_CODE_BY_COUNTRY || {}).map(c => String(c).replace(/\D/g, '')))].sort((a, b) => b.length - a.length);
    code = codes.find(c => c && intl.startsWith('+' + c)) || '';
  }
  if (!code) return intl;
  const rest = intl.slice(1 + code.length);
  const groups = code === '1' && rest.length === 10 ? [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6)]
    : rest.length <= 7 ? [rest.slice(0, 3), rest.slice(3)] : rest.length === 10 ? [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6)] : [rest.slice(0, 2), rest.slice(2, 5), rest.slice(5)];
  return `+${code} ${groups.filter(Boolean).join(' ')}`;
}

// A full name: at least two parts, each with two or more letters, not one letter repeated.
function looksLikeFullName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(w => /\p{L}{2,}/u.test(w) && !/^(jr|sr|ii|iii|iv)\.?$/i.test(w));
  if (parts.length < 2) return false;
  return parts.every(w => !/^(.)\1+$/u.test(w.toLowerCase()) && /[aeiouyàáâãäåèéêëìíîïòóôõöùúûü]/i.test(w));
}

// What a reference usually is (international reference-check practice):
// someone who knows the person's work or character and can be reached.
const RELATIONSHIPS = ['Past employer or boss', 'Client I worked for', 'Landlord or property owner', 'Pastor, imam or religious leader', 'Town chief or community leader', 'Teacher or trainer', 'Co-worker', 'Neighbour', 'Friend', 'Family member'];
const FAMILY = /^(family|brother|sister|bro|sis|cousin|uncle|aunt|auntie|mother|mom|mum|ma|father|dad|pa|son|daughter|wife|husband|niece|nephew|grand\w*|in-?law|relative|broter|siter|familiar|hermano|hermana|primo|prima|t[ií]o|t[ií]a|madre|padre|mam[aá]|pap[aá]|hijo|hija|esposo|esposa|sobrino|sobrina|abuel\w*|cu[ñn]ad\w*|suegr\w*|pariente)\b/i;
const isFamily = (rel) => FAMILY.test(String(rel || '').trim());
function relationshipLooksRight(rel) {
  const r = String(rel || '').trim();
  if (!r) return false;
  if (RELATIONSHIPS.some(x => x.toLowerCase() === r.toLowerCase()) || isFamily(r)) return true;
  return /\p{L}{3,}/u.test(r) && /[aeiouy]/i.test(r) && !/^(.)\1+$/.test(r) && !/(.)\1\1/.test(r) && !/[bcdfghjklmnpqrstvwxz]{5,}/i.test(r);
}

// For the team: what to look out for before calling.
function checks(pro, g) {
  const out = [];
  if (!looksLikeFullName(g.name)) out.push('The name does not look like a full name (first and last name).');
  if (!phoneLooksRight(g.phone, pro && pro.country)) out.push(`The number does not look complete for ${(pro && pro.country) || 'the pro\'s country'}.`);
  if (!relationshipLooksRight(g.relationship)) out.push(g.relationship ? 'The relationship is not clear.' : 'No relationship given.');
  return out;
}

module.exports = { phoneKey, sameName, guarantorProblem, phoneIntl, phoneLooksRight, phoneDisplay, looksLikeFullName, relationshipLooksRight, isFamily, checks, RELATIONSHIPS };
