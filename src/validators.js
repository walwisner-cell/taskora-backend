// Shared input validation helpers used across every route that accepts
// user-provided data. Centralized here so every endpoint enforces the same
// rules consistently, rather than each route re-implementing its own ad hoc
// checks (which is how the app ended up with signup accepting a 1-character
// password while change-password required 6 — inconsistencies like that are
// exactly what this module exists to prevent).

// Closer to the WHATWG HTML5 living-standard email pattern than a naive
// "has an @ and a dot" check — catches things like leading/trailing dots,
// consecutive dots, and missing a real domain segment, without going all
// the way to a full RFC 5322 grammar (which rejects some real-world
// addresses people actually use). Combined with a practical max length
// (RFC 5321 caps a full email address at 254 characters).
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (trimmed.includes('..')) return false; // consecutive dots are never valid
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) return false;
  const localPart = trimmed.slice(0, atIndex);
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false; // leading/trailing dot in local part
  return EMAIL_RE.test(trimmed);
}

function isNonEmptyString(value, { min = 1, max = 500 } = {}) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

// A short, well-known list of the most common breached/weak passwords
// (per guidance like NIST 800-63B, which recommends checking against known-
// compromised passwords over arbitrary complexity rules). This is not
// exhaustive — it exists to catch the most obvious "password123"-style
// choices, not to replace a real breached-password database at scale.
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'letmein123', 'welcome123', 'admin1234', 'iloveyou1',
  'abc123456', '11111111', '00000000', 'taskora123', // yes, even our own demo password shouldn't be reused for a real account
]);

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 9 || password.length > 200) return false;
  const digitCount = (password.match(/[0-9]/g) || []).length;
  const letterCount = (password.match(/[a-zA-Z]/g) || []).length;
  const symbolCount = (password.match(/[^a-zA-Z0-9]/g) || []).length;
  if (digitCount < 6) return false;
  if (letterCount < 2) return false;
  if (symbolCount < 1) return false;
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) return false;
  return true;
}

// Deliberately permissive on exact format — Taskora operates across the US,
// Nigeria, Ghana, and Liberia, and phone formats vary a lot by country. This
// checks for "plausible," not one country's exact pattern: digits (with
// optional +, spaces, dashes, parens), a realistic length, and rejects
// obvious junk like every digit being the same.
function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!/^[0-9+()\-\s]+$/.test(trimmed)) return false;
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (digitsOnly.length < 8 || digitsOnly.length > 15) return false;
  if (/^(\d)\1+$/.test(digitsOnly)) return false; // e.g. "0000000000" or "1111111111"
  return true;
}

// Same "plausible across many countries" philosophy as phone — supports US
// ZIP (5 or 9 digit), Canadian/UK-style alphanumeric postcodes, and simpler
// numeric postal codes (Nigeria, Ghana, etc.), while rejecting obvious junk
// like a single character repeated the whole way through.
function isValidPostalCode(code) {
  if (typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (trimmed.length < 3 || trimmed.length > 10) return false;
  if (!/^[a-zA-Z0-9\s-]+$/.test(trimmed)) return false;
  const alnumOnly = trimmed.replace(/[\s-]/g, '');
  if (/^(.)\1+$/.test(alnumOnly)) return false; // e.g. "00000" or "AAAAA"
  return true;
}

// Real people's names: letters (Unicode-aware, so "José", "Chidinma", "Åsa"
// all work), spaces, hyphens, apostrophes, and periods (for "Jr.", "St."),
// but never digits or other symbols.
const NAME_RE = /^[\p{L}][\p{L}\s'.\-]*$/u;

function isValidName(name, { min = 2, max = 100 } = {}) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < min || trimmed.length > max) return false;
  return NAME_RE.test(trimmed);
}

// MM/YY card expiry format, with a plausible (not-already-expired,
// not-absurdly-far-future) year range. This validates the FORMAT and basic
// plausibility of what was entered — not whether it's a real card, which is
// out of scope until a real payment processor is wired in.
function isValidCardExpiry(expiry) {
  if (typeof expiry !== 'string') return false;
  const match = expiry.trim().match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!match) return false;
  const month = parseInt(match[1], 10);
  const year = parseInt('20' + match[2], 10);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  if (year < currentYear || year > currentYear + 20) return false;
  if (year === currentYear && month < now.getMonth() + 1) return false; // already expired this year
  return true;
}

// Category/country/plan names: real words, not "123" or "!!!" — allows
// letters, digits (e.g. "24/7 Support" as a plan feature), spaces, and a
// small set of common punctuation (&, /, -) without being so permissive
// that pure symbol/number spam gets through.
function isValidLabel(value, { min = 2, max = 60 } = {}) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false; // must contain at least one real letter
  return /^[\p{L}0-9\s&/'.\-]+$/u.test(trimmed);
}

// Collects every failing rule instead of stopping at the first one, so the
// client can show all problems at once rather than one at a time.
function validate(rules) {
  const errors = [];
  for (const [field, check, message] of rules) {
    if (!check) errors.push(message || `${field} is invalid`);
  }
  return errors;
}

module.exports = {
  isValidEmail, isNonEmptyString, isValidPassword, isValidPhone, isValidPostalCode,
  isValidName, isValidCardExpiry, isValidLabel, validate, EMAIL_RE,
};
