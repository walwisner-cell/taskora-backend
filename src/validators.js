// Shared input validation helpers used across every route that accepts
// user-provided data. Centralized here so every endpoint enforces the same
// rules consistently, rather than each route re-implementing its own ad hoc
// checks (which is how the app ended up with signup accepting a 1-character
// password while change-password required 6 — inconsistencies like that are
// exactly what this module exists to prevent).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

function isNonEmptyString(value, { min = 1, max = 500 } = {}) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 200;
}

// Deliberately permissive on format — Taskora operates across the US, Nigeria,
// and Ghana, and phone/postal formats vary a lot by country. This checks for
// "plausible," not a single country's exact pattern: digits (with optional
// +, spaces, dashes, parens) and a sane length.
function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15 && /^[0-9+()\-\s]+$/.test(phone.trim());
}

function isValidPostalCode(code) {
  if (typeof code !== 'string') return false;
  const trimmed = code.trim();
  return trimmed.length >= 3 && trimmed.length <= 10 && /^[a-zA-Z0-9\s-]+$/.test(trimmed);
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

module.exports = { isValidEmail, isNonEmptyString, isValidPassword, isValidPhone, isValidPostalCode, validate, EMAIL_RE };
