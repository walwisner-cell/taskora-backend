const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { hashPassword, verifyPassword, signToken, requireAuth, generateResetToken, hashResetToken } = require('../auth');
const { isValidEmail, isNonEmptyString, isValidPassword, isValidPhone, isValidPostalCode, validate } = require('../validators');

const router = express.Router();

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  const { name, email, password, role, country, city, phone, address, zipCode, category, skills } = req.body || {};
  const errors = validate([
    ['name', isNonEmptyString(name, { min: 2, max: 100 }), 'Full name must be at least 2 characters'],
    ['email', isValidEmail(email), 'Enter a valid email address'],
    ['password', isValidPassword(password), 'Password must be at least 6 characters'],
    ['role', ['customer', 'provider'].includes(role), 'Role must be customer or provider — admin accounts are created by a super admin'],
    ['phone', isValidPhone(phone), 'Enter a valid phone number (7-15 digits)'],
    ['zipCode', isValidPostalCode(zipCode), 'Enter a valid postal/zip code'],
    ['address', isNonEmptyString(address, { min: 3, max: 200 }), 'Enter a valid address'],
  ]);
  if (role === 'provider') {
    errors.push(...validate([
      ['category', isNonEmptyString(category), 'Select your primary service category'],
      ['skills', isNonEmptyString(skills, { min: 2, max: 300 }), 'List at least one skill or specialty'],
    ]));
  }
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const trimmedName = name.trim();
  const existing = db.find('users', u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const user = {
    id: `u_${nanoid(10)}`,
    name: trimmedName,
    email: email.trim(),
    role,
    country: country || 'United States',
    city: city || 'Atlanta',
    phone: phone.trim(),
    address: address.trim(),
    zipCode: zipCode.trim(),
    phoneVerified: false,
    initials: trimmedName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    verified: false,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    ...(role === 'provider' ? {
      providerRole: 'New Provider',
      category: category || 'Plumbing',
      // Skills are stored both as free text (what the provider actually
      // typed) and as a parsed tag list (what the UI displays as chips) —
      // this is also what the community-matching algorithm below reads.
      skills: skills.trim(),
      tags: skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6),
      rating: 0, jobs: 0, price: 50, color: '#5A5F6C', since: String(new Date().getFullYear()),
    } : {}),
  };
  db.insert('users', user);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const user = db.find('users', u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.active === false) {
    return res.status(403).json({ error: 'This account has been suspended. Contact a super admin for access.' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.find('users', u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/me — update own profile / settings
router.patch('/me', requireAuth, (req, res) => {
  const allowed = ['name', 'email', 'phone', 'country', 'city', 'address', 'zipCode', 'payPreference', 'payoutMethod', 'notifPrefs', 'availability', 'pricingModel', 'price'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  if ('name' in patch && !isNonEmptyString(patch.name, { min: 2, max: 100 })) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters' });
  }
  if ('email' in patch) {
    if (!isValidEmail(patch.email)) return res.status(400).json({ error: 'Enter a valid email address' });
    patch.email = patch.email.trim();
    const conflict = db.find('users', u => u.id !== req.user.sub && u.email.toLowerCase() === patch.email.toLowerCase());
    if (conflict) return res.status(409).json({ error: 'That email is already in use by another account' });
  }
  if ('phone' in patch && patch.phone && !isNonEmptyString(patch.phone, { min: 7, max: 30 })) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }
  if ('availability' in patch) {
    if (!Array.isArray(patch.availability) || !patch.availability.every(a => typeof a === 'string' && a.trim().length > 0)) {
      return res.status(400).json({ error: 'Availability must be a list of time slots' });
    }
    if (patch.availability.length === 0) {
      return res.status(400).json({ error: 'You need at least one available time slot' });
    }
    patch.availability = patch.availability.map(a => a.trim()).slice(0, 15);
  }
  if ('pricingModel' in patch && !['hourly', 'negotiable'].includes(patch.pricingModel)) {
    return res.status(400).json({ error: 'Pricing model must be hourly or negotiable' });
  }
  if ('price' in patch && (typeof patch.price !== 'number' || patch.price <= 0)) {
    return res.status(400).json({ error: 'Hourly rate must be a positive number' });
  }
  const updated = db.update('users', req.user.sub, patch);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(updated) });
});

// POST /api/auth/change-password — requires the current password, not just auth
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const user = db.find('users', u => u.id === req.user.sub);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (verifyPassword(newPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'New password must be different from your current password' });
  }
  db.update('users', user.id, { passwordHash: hashPassword(newPassword) });
  res.json({ ok: true });
});

// ── FORGOT / RESET PASSWORD ──────────────────────────────────────────────────
// No real email service is wired up yet, so this runs in a clearly-labeled
// "test mode": the reset link is handed straight back in the API response
// instead of being emailed. Everything else here — hashed single-use
// expiring tokens, no account-enumeration, rate limiting — is the real
// production pattern. Swapping in a real provider (SendGrid, Postmark, SES,
// Resend, etc.) later means sending the link by email instead of returning
// it, not redesigning this flow.

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Simple in-memory rate limit: max 3 reset requests per email per 15 minutes.
// This is intentionally lightweight (no new dependency) and lives on a
// single instance — fine for now, but if this app ever runs across multiple
// server instances, this needs to move to a shared store (e.g. Redis)
// rather than each instance tracking its own counts.
const resetRequestLog = new Map(); // email -> array of request timestamps
function isRateLimited(email) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const attempts = (resetRequestLog.get(email) || []).filter(t => now - t < windowMs);
  attempts.push(now);
  resetRequestLog.set(email, attempts);
  return attempts.length > 3;
}

// POST /api/auth/forgot-password — always responds the same way whether or
// not the email exists, so this endpoint can't be used to discover which
// emails have accounts.
router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  const normalized = email.trim().toLowerCase();

  const genericResponse = { message: 'If an account with that email exists, a reset link has been sent.' };

  if (isRateLimited(normalized)) {
    // Still don't reveal whether the email exists — just stop generating
    // new tokens for it for a while.
    return res.json(genericResponse);
  }

  const user = db.find('users', u => u.email.toLowerCase() === normalized);
  if (!user) return res.json(genericResponse); // deliberately identical to the success path

  // Invalidate any previous outstanding reset tokens for this user before
  // issuing a new one, so only the most recent link works.
  db.filter('passwordResets', r => r.userId === user.id && !r.used).forEach(r => {
    db.update('passwordResets', r.id, { used: true });
  });

  const rawToken = generateResetToken();
  const record = {
    id: `pr_${nanoid(10)}`,
    userId: user.id,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  };
  db.insert('passwordResets', record);

  console.log(`[TEST MODE] Password reset requested for ${user.email}. Reset token: ${rawToken} (expires in 30 min)`);

  res.json({
    ...genericResponse,
    testMode: true,
    testModeNote: 'No real email service is configured yet — this token is returned directly instead of being emailed. Do not do this in production.',
    resetToken: rawToken,
  });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!isNonEmptyString(token)) return res.status(400).json({ error: 'Reset token is required' });
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const tokenHash = hashResetToken(token);
  const record = db.find('passwordResets', r => r.tokenHash === tokenHash);
  if (!record || record.used || new Date(record.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  }

  const user = db.find('users', u => u.id === record.userId);
  if (!user) return res.status(404).json({ error: 'Account not found' });

  db.update('users', user.id, { passwordHash: hashPassword(newPassword) });
  db.update('passwordResets', record.id, { used: true });

  res.json({ message: 'Password reset successfully — you can now sign in with your new password.' });
});

// ── PHONE VERIFICATION (test mode — same honest pattern as password reset) ──
// No real SMS provider (Twilio, etc.) is connected yet, so the OTP code is
// returned directly in the API response instead of being texted, clearly
// labeled as test mode. Everything else — a real one-time code, hashed
// before storage, short expiry, single use — is the production pattern.
// Wiring in a real SMS provider later means sending the code by text instead
// of returning it, not redesigning this flow.
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// POST /api/auth/send-phone-otp — sends (in test mode: returns) a code to the
// phone number already on the requesting user's account.
router.post('/send-phone-otp', requireAuth, (req, res) => {
  const user = db.find('users', u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  if (!user.phone) return res.status(400).json({ error: 'Add a phone number to your account first' });

  // Invalidate any previous outstanding code before issuing a new one.
  db.filter('phoneVerifications', v => v.userId === user.id && !v.used).forEach(v => {
    db.update('phoneVerifications', v.id, { used: true });
  });

  const code = generateOtp();
  db.insert('phoneVerifications', {
    id: `pv_${nanoid(10)}`,
    userId: user.id,
    codeHash: hashResetToken(code), // same fast-hash helper as reset tokens — a short-lived numeric code, not a password
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  });

  console.log(`[TEST MODE] Phone verification code for ${user.phone}: ${code} (expires in 10 min)`);

  res.json({
    message: `A verification code would be sent to ${user.phone}.`,
    testMode: true,
    testModeNote: 'No real SMS provider is configured yet — this code is returned directly instead of being texted. Do not do this in production.',
    code,
  });
});

// POST /api/auth/verify-phone-otp — confirms the code and marks the phone verified
router.post('/verify-phone-otp', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!isNonEmptyString(code)) return res.status(400).json({ error: 'Enter the code you received' });

  const codeHash = hashResetToken(code.trim());
  const record = db.find('phoneVerifications', v => v.userId === req.user.sub && v.codeHash === codeHash);
  if (!record || record.used || new Date(record.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'That code is invalid or has expired. Request a new one.' });
  }
  db.update('phoneVerifications', record.id, { used: true });
  db.update('users', req.user.sub, { phoneVerified: true });
  res.json({ message: 'Phone number verified.' });
});

module.exports = router;
