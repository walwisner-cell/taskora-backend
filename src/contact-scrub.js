// v147: take phone numbers and email addresses out of a short text that
// goes to someone the writer has no confirmed booking with yet (a pickup
// note to a driver who hasn't accepted). Contact details are shared
// through Trothen once a booking is confirmed.
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/g;           // 8+ digits with spaces, dots, dashes or brackets
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const HIDDEN = '[contact details are shared in the app]';

function scrub(text) {
  return String(text || '')
    .replace(EMAIL, HIDDEN)
    .replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 7 ? HIDDEN : m));
}
const hasContact = (text) => scrub(text) !== String(text || '');

module.exports = { scrub, hasContact, HIDDEN };
