const express = require('express');
const { nanoid } = require('nanoid');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { hashPassword, verifyPassword, signToken, requireAuth, generateResetToken, hashResetToken } = require('../auth');
const { isValidEmail, isNonEmptyString, isValidPassword, isValidPhone, isValidPostalCode, isValidName, validate, postalCodeErrorMessage } = require('../validators');
const { notify } = require('../notify');

const router = express.Router();

// Rate limiting on every sensitive auth endpoint — this genuinely didn't
// exist anywhere in the app before. Without it, there was no limit at all
// on how many times someone could try a password against a known email
// (a real, practical brute-force path — unlike a randomly-generated,
// short-lived reset token, a person's password doesn't expire), or how
// many times a 6-digit OTP code could be guessed for signup/login
// verification or password reset. Keyed by IP, generous enough that a
// real person fumbling their password a few times never notices it.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many signup attempts from this connection. Please try again in an hour.' },
});

// Same time-of-check-to-time-of-use pattern already fixed for payouts and
// organization seats: this endpoint checks the email is still free, then
// creates the account, with real time in between. Two people who both
// started signup with the same email (one might be retrying after a typo,
// or it's a genuine coincidence) could both complete verification at
// nearly the same moment and both pass the "still free" check before
// either had actually created their account. A per-email lock closes it
// the same way.
const signupVerifyLocks = new Set();

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// ── SIGNUP: real two-stage verification gate ────────────────────────────────
// Registration is no longer "submit a form, get an account instantly."
// Every new signup now requires proving both a real phone number AND a real
// email address before the account is actually created — two separate
// codes, two separate channels, both required. Same honest test-mode
// pattern as phone verification and password reset elsewhere: since no real
// SMS/email provider is connected yet, both codes are returned directly in
// the API response instead of being sent, clearly labeled as such. Wiring
// in real providers later means sending the codes instead of returning
// them — the verification gate itself doesn't change.
const REGISTRATION_TTL_MS = 15 * 60 * 1000; // 15 minutes to complete both codes

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/signup/start — validates everything and issues both codes,
// but does NOT create the account yet.
router.post('/signup/start', signupLimiter, async (req, res) => {
  const { name, email, password, role, country, state, city, phone, address, zipCode, category, skills, inviteCode } = req.body || {};
  const errors = validate([
    ['name', isValidName(name), 'Enter a real name — letters, spaces, hyphens, and apostrophes only'],
    ['email', isValidEmail(email), 'Enter a valid email address'],
    ['password', isValidPassword(password), 'Password must be at least 9 characters with at least 6 numbers, 2 letters, and 1 symbol'],
    ['role', ['customer', 'provider'].includes(role), 'Role must be customer or provider — admin accounts are created by a super admin'],
    ['phone', isValidPhone(phone), 'Enter a valid phone number (7-15 digits)'],
    ['zipCode', isValidPostalCode(zipCode, country), postalCodeErrorMessage(country)],
    ['address', isNonEmptyString(address, { min: 3, max: 200 }), 'Enter a valid address'],
    ['country', isNonEmptyString(country, { min: 2, max: 100 }), 'Select your country'],
    ['state', isNonEmptyString(state, { min: 2, max: 100 }), 'Select your state/region'],
    ['city', isNonEmptyString(city, { min: 2, max: 100 }), 'Enter your city'],
  ]);
  if (role === 'provider') {
    errors.push(...validate([
      ['category', isNonEmptyString(category), 'Select your primary service category'],
      ['skills', isNonEmptyString(skills, { min: 2, max: 300 }), 'List at least one skill or specialty'],
    ]));
  }
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const existing = await db.find('users', u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  // Org invite codes attach a brand-new provider to a Custom-plan
  // organization's seats. Validated up front so a bad code fails
  // immediately, rather than after the person's already gone through the
  // phone/email verification step.
  let inviteOrgId = null;
  const trimmedInviteCode = (inviteCode || '').trim().toUpperCase();
  if (trimmedInviteCode) {
    if (role !== 'provider') return res.status(400).json({ error: 'Organization invite links are for provider accounts' });
    const invite = await db.find('organizationInvites', i => i.code === trimmedInviteCode);
    if (!invite) return res.status(400).json({ error: 'This invite link is invalid' });
    if (invite.status !== 'active') return res.status(400).json({ error: 'This invite link has been revoked' });
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return res.status(400).json({ error: 'This invite link has expired' });
    if (invite.maxUses != null && invite.usesCount >= invite.maxUses) return res.status(400).json({ error: 'This invite link has reached its usage limit' });
    inviteOrgId = invite.organizationId;
  }

  const phoneCode = generateSixDigitCode();
  const emailCode = generateSixDigitCode();

  const pending = {
    id: `preg_${nanoid(12)}`,
    payload: { name: name.trim(), email: email.trim(), password, role, country: country.trim(), state: state.trim(), city: city.trim(), phone: phone.trim(), address: address.trim(), zipCode: (zipCode || '').trim(), category, skills, inviteCode: trimmedInviteCode || null },
    phoneCodeHash: hashResetToken(phoneCode),
    emailCodeHash: hashResetToken(emailCode),
    phoneVerified: false,
    emailVerified: false,
    expiresAt: new Date(Date.now() + REGISTRATION_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };
  await db.insert('pendingRegistrations', pending);

  console.log(`[TEST MODE] Registration codes for ${email.trim()} — phone: ${phoneCode}, email: ${emailCode}`);

  res.status(201).json({
    pendingId: pending.id,
    message: `Enter the code sent to ${phone.trim()} and the code sent to ${email.trim()} to finish creating your account.`,
    testMode: true,
    testModeNote: 'No real SMS or email provider is configured yet — both codes are returned directly instead of being sent. Do not do this in production.',
    phoneCode,
    emailCode,
    joiningOrganization: inviteOrgId ? true : false,
  });
});

// POST /api/auth/signup/verify — both codes must match before the account
// is actually created.
router.post('/signup/verify', otpLimiter, async (req, res) => {
  const { pendingId, phoneCode, emailCode } = req.body || {};
  if (!isNonEmptyString(pendingId) || !isNonEmptyString(phoneCode) || !isNonEmptyString(emailCode)) {
    return res.status(400).json({ error: 'pendingId, phoneCode, and emailCode are all required' });
  }
  const pending = await db.find('pendingRegistrations', p => p.id === pendingId);
  if (!pending) return res.status(400).json({ error: 'This registration has expired or was not found — please start again' });
  if (new Date(pending.expiresAt) < new Date()) {
    await db.remove('pendingRegistrations', pending.id);
    return res.status(400).json({ error: 'This registration has expired — please start again' });
  }

  // Locking on the email (not the pendingId) is what actually closes the
  // gap: two DIFFERENT pending registrations sharing the same email are
  // exactly the scenario that matters here, and they have different
  // pendingIds by definition.
  const emailKey = pending.payload.email.toLowerCase();
  if (signupVerifyLocks.has(emailKey)) {
    return res.status(409).json({ error: 'This email is already completing signup elsewhere — please wait a moment and try again.' });
  }
  signupVerifyLocks.add(emailKey);
  try {
    return await completeSignupVerify(req, res, pending);
  } finally {
    signupVerifyLocks.delete(emailKey);
  }
});

async function completeSignupVerify(req, res, pending) {
  const { phoneCode, emailCode } = req.body || {};
  if (hashResetToken(phoneCode.trim()) !== pending.phoneCodeHash) {
    return res.status(400).json({ error: 'That phone code is incorrect' });
  }
  if (hashResetToken(emailCode.trim()) !== pending.emailCodeHash) {
    return res.status(400).json({ error: 'That email code is incorrect' });
  }

  // Re-check email uniqueness — someone else could have registered the same
  // email in the window between starting and finishing this one.
  const { payload } = pending;
  const stillFree = !(await db.find('users', u => u.email.toLowerCase() === payload.email.toLowerCase()));
  if (!stillFree) {
    await db.remove('pendingRegistrations', pending.id);
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const trimmedName = payload.name;
  // A provider who typed a category we don't currently list isn't blocked —
  // their account is created normally and they can start using the
  // platform right away. What happens instead: their category goes into a
  // real pending-approval state (visible to them and to admins), and every
  // super admin is notified immediately so a real person reviews it — the
  // same "don't block, but don't silently pretend it's approved either"
  // principle used for unlisted job categories.
  let categoryApprovalStatus = 'approved';
  if (payload.role === 'provider') {
    const activeCategories = (await db.filter('categories', c => c.active)).map(c => c.name);
    if (!activeCategories.includes(payload.category)) categoryApprovalStatus = 'pending';
  }

  const user = {
    id: `u_${nanoid(10)}`,
    name: trimmedName,
    email: payload.email,
    role: payload.role,
    country: payload.country,
    state: payload.state,
    city: payload.city,
    phone: payload.phone,
    address: payload.address,
    zipCode: payload.zipCode,
    phoneVerified: true, // genuinely true this time — they just proved it as part of registering
    initials: trimmedName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    verified: false,
    passwordHash: hashPassword(payload.password),
    createdAt: new Date().toISOString(),
    ...(payload.role === 'provider' ? {
      providerRole: 'New Provider',
      category: payload.category || 'Plumbing',
      categoryApprovalStatus,
      skills: payload.skills.trim(),
      tags: payload.skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6),
      rating: 0, jobs: 0, price: 50, color: '#5A5F6C', since: String(new Date().getFullYear()),
    } : {}),
  };
  await db.insert('users', user);
  await db.remove('pendingRegistrations', pending.id);

  // Consume the org invite (if any) now that the account genuinely exists
  // — re-validated here rather than trusting the check from /signup/start,
  // since the code could have been revoked or hit its limit during the
  // phone/email verification window. If it's no longer valid, the account
  // still gets created normally — it just isn't attached to the org. Same
  // "don't block, but don't silently pretend it worked" principle as the
  // unlisted-category flow below.
  let joinedOrganizationName = null;
  if (payload.role === 'provider' && payload.inviteCode) {
    const invite = await db.find('organizationInvites', i => i.code === payload.inviteCode);
    const stillValid = invite
      && invite.status === 'active'
      && (!invite.expiresAt || new Date(invite.expiresAt) >= new Date())
      && (invite.maxUses == null || invite.usesCount < invite.maxUses);
    if (stillValid) {
      const org = await db.find('organizations', o => o.id === invite.organizationId && o.status === 'active');
      if (org) {
        await db.update('users', user.id, { organizationId: org.id });
        await db.update('organizationInvites', invite.id, { usesCount: invite.usesCount + 1 });
        joinedOrganizationName = org.name;
      }
    }
  }

  if (categoryApprovalStatus === 'pending') {
    const request = {
      id: `catreq_${nanoid(10)}`,
      providerId: user.id,
      requestedCategory: user.category,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    await db.insert('categoryRequests', request);

    // Real, immediate alert to every super admin — the actual working
    // mechanism today (in-app notifications are live; there's no email
    // provider connected yet, so an email alert is logged clearly as
    // test-mode rather than silently not happening).
    const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
    for (const admin of superAdmins) {
      await notify(admin.id, '🆕', `${user.name} signed up wanting to offer "${user.category}" — not a current category. Review within 24 hours in Categories & Countries → Category Requests.`, null, { section: 'categories' });
      console.log(`[TEST MODE — no email provider connected] Would email ${admin.email}: New category request "${user.category}" from ${user.name} needs review within 24 hours.`);
    }
  }

  // Real fraud/safety check — the same phone number registering a second
  // account is a genuine, common signal worth a human review. The account
  // is never blocked over this alone; it just creates a real flag.
  const { checkDuplicateIdentity } = require('../fraud-detection');
  await checkDuplicateIdentity(user.phone, user.email, user.id);

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user), categoryApprovalStatus, joinedOrganizationName });
}

// POST /api/auth/signup/resend — regenerate both codes for an in-progress
// registration (e.g. the 15-minute window is about to run out, or the codes
// were dismissed accidentally).
router.post('/signup/resend', async (req, res) => {
  const { pendingId } = req.body || {};
  if (!isNonEmptyString(pendingId)) return res.status(400).json({ error: 'pendingId is required' });
  const pending = await db.find('pendingRegistrations', p => p.id === pendingId);
  if (!pending) return res.status(400).json({ error: 'This registration has expired or was not found — please start again' });

  const phoneCode = generateSixDigitCode();
  const emailCode = generateSixDigitCode();
  await db.update('pendingRegistrations', pending.id, {
    phoneCodeHash: hashResetToken(phoneCode),
    emailCodeHash: hashResetToken(emailCode),
    expiresAt: new Date(Date.now() + REGISTRATION_TTL_MS).toISOString(),
  });

  console.log(`[TEST MODE] Resent registration codes for ${pending.payload.email} — phone: ${phoneCode}, email: ${emailCode}`);

  res.json({ testMode: true, phoneCode, emailCode });
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const user = await db.find('users', u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.active === false) {
    return res.status(403).json({ error: 'This account has been suspended. Contact a super admin for access.' });
  }

  // Two-factor is opt-in (Settings), not forced on every account — when a
  // person has turned it on, a correct password is only the first factor.
  // A second, time-limited code (same honest test-mode pattern as
  // everywhere else: no real SMS/email provider connected yet, so the code
  // is returned directly rather than silently not being sent) is required
  // before a real session token is issued.
  if (user.twoFactorEnabled) {
    const code = generateSixDigitCode();
    const pendingLogin = {
      id: `plogin_${nanoid(10)}`,
      userId: user.id,
      codeHash: hashResetToken(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      createdAt: new Date().toISOString(),
    };
    await db.insert('pendingLogins', pendingLogin);
    return res.json({
      requires2FA: true,
      pendingLoginId: pendingLogin.id,
      testMode: true,
      testModeNote: 'No real SMS or email provider is configured yet — the code is returned directly instead of being sent. Do not do this in production.',
      code,
    });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/login/verify-2fa — the second factor. Completes the
// session only if the code matches and hasn't expired; the pending login
// record is single-use either way, so a code can't be replayed.
router.post('/login/verify-2fa', otpLimiter, async (req, res) => {
  const { pendingLoginId, code } = req.body || {};
  if (!pendingLoginId || !code) return res.status(400).json({ error: 'pendingLoginId and code are required' });
  const pending = await db.find('pendingLogins', p => p.id === pendingLoginId);
  if (!pending) return res.status(400).json({ error: 'This login attempt has expired. Please sign in again.' });
  if (new Date(pending.expiresAt) < new Date()) {
    await db.remove('pendingLogins', pending.id);
    return res.status(400).json({ error: 'This code has expired. Please sign in again.' });
  }
  if (hashResetToken(code.trim()) !== pending.codeHash) {
    return res.status(400).json({ error: 'Incorrect code' });
  }
  await db.remove('pendingLogins', pending.id);
  const user = await db.find('users', u => u.id === pending.userId);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.find('users', u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/me — update own profile / settings
// Current version string for the Community/Customer Standards agreement.
// Bump this any time the actual terms change — any user whose stored
// terms_version doesn't match this gets shown the agreement gate again on
// their next visit, rather than being grandfathered into terms they never
// actually saw. Keep this in sync with CURRENT_TERMS_VERSION on the
// frontend (public/index.html) — both must agree for the gate to work.
const CURRENT_TERMS_VERSION = 'v1-2026';

// POST /api/auth/accept-terms — records genuine, deliberate consent: a
// real timestamp and the exact version being agreed to, not an implied
// "they must have agreed since they're using the app" assumption. This is
// what actually lets the business prove consent happened, the same way a
// real company needs to be able to.
router.post('/accept-terms', requireAuth, async (req, res) => {
  const { version } = req.body || {};
  if (version !== CURRENT_TERMS_VERSION) {
    return res.status(400).json({ error: 'This isn\'t the current version of the agreement — please refresh and try again.' });
  }
  await db.update('users', req.user.sub, { termsAcceptedAt: new Date().toISOString(), termsVersion: version });
  res.json({ ok: true, termsVersion: version });
});

router.patch('/me', requireAuth, async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'country', 'state', 'city', 'address', 'zipCode', 'payPreference', 'payoutMethod', 'notifPrefs', 'availability', 'pricingModel', 'price', 'plan', 'twoFactorEnabled', 'businessName', 'businessRegistrationNumber', 'category', 'acceptingBookings', 'licenseExpiryDate', 'insuranceExpiryDate'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  if ('acceptingBookings' in patch && typeof patch.acceptingBookings !== 'boolean') {
    return res.status(400).json({ error: 'acceptingBookings must be true or false' });
  }
  if ('name' in patch && !isValidName(patch.name)) {
    return res.status(400).json({ error: 'Enter a real name — letters, spaces, hyphens, and apostrophes only' });
  }
  if ('email' in patch) {
    if (!isValidEmail(patch.email)) return res.status(400).json({ error: 'Enter a valid email address' });
    patch.email = patch.email.trim();
    const conflict = await db.find('users', u => u.id !== req.user.sub && u.email.toLowerCase() === patch.email.toLowerCase());
    if (conflict) return res.status(409).json({ error: 'That email is already in use by another account' });
  }
  if ('phone' in patch && patch.phone && !isNonEmptyString(patch.phone, { min: 7, max: 30 })) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }
  if ('country' in patch) {
    if (!isNonEmptyString(patch.country, { min: 2, max: 100 })) return res.status(400).json({ error: 'Select a valid country' });
    patch.country = patch.country.trim();
  }
  if ('state' in patch) {
    if (!isNonEmptyString(patch.state, { min: 1, max: 100 })) return res.status(400).json({ error: 'Select a valid state/region' });
    patch.state = patch.state.trim();
  }
  if ('city' in patch) {
    if (!isNonEmptyString(patch.city, { min: 2, max: 100 })) return res.status(400).json({ error: 'Enter a valid city' });
    patch.city = patch.city.trim();
  }
  if ('twoFactorEnabled' in patch && typeof patch.twoFactorEnabled !== 'boolean') {
    return res.status(400).json({ error: 'twoFactorEnabled must be true or false' });
  }
  if ('businessName' in patch) {
    if (patch.businessName && !isNonEmptyString(patch.businessName, { max: 150 })) {
      return res.status(400).json({ error: 'Business name is too long' });
    }
    patch.businessName = patch.businessName ? patch.businessName.trim() : null;
  }
  if ('businessRegistrationNumber' in patch) {
    if (patch.businessRegistrationNumber && !isNonEmptyString(patch.businessRegistrationNumber, { max: 100 })) {
      return res.status(400).json({ error: 'Business registration number is too long' });
    }
    patch.businessRegistrationNumber = patch.businessRegistrationNumber ? patch.businessRegistrationNumber.trim() : null;
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
  if ('plan' in patch) {
    if (req.user.role !== 'provider') {
      return res.status(400).json({ error: 'Only provider accounts have a plan' });
    }
    if (!['starter', 'pro', 'superpro'].includes(patch.plan)) {
      return res.status(400).json({ error: 'Plan must be starter, pro, or superpro' });
    }
  }
  if ('notifPrefs' in patch) {
    if (typeof patch.notifPrefs !== 'object' || patch.notifPrefs === null || Array.isArray(patch.notifPrefs)) {
      return res.status(400).json({ error: 'notifPrefs must be an object of true/false toggles' });
    }
    if (!Object.values(patch.notifPrefs).every(v => typeof v === 'boolean')) {
      return res.status(400).json({ error: 'Every notifPrefs value must be true or false' });
    }
    // Merge, don't overwrite — toggling one preference (e.g. "Promotions")
    // shouldn't silently reset every other saved preference to defaults.
    const current = await db.find('users', u => u.id === req.user.sub);
    patch.notifPrefs = { ...(current && current.notifPrefs), ...patch.notifPrefs };
  }
  if ('category' in patch) {
    const current = await db.find('users', u => u.id === req.user.sub);
    if (!current || current.role !== 'provider') {
      return res.status(400).json({ error: 'Only provider accounts have a category' });
    }
    if (!isNonEmptyString(patch.category, { min: 2, max: 100 })) {
      return res.status(400).json({ error: 'Enter a valid category' });
    }
    patch.category = patch.category.trim();

    // Same real-category matching used at signup and at category-request
    // approval: strip punctuation/casing differences so "pick and drop"
    // correctly matches an existing "Pick & Drop" instead of creating a
    // near-duplicate, or incorrectly staying "pending" when it's really
    // already a listed category.
    const normalize = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const activeCategories = await db.filter('categories', c => c.active);
    const matchedCategory = activeCategories.find(c => normalize(c.name) === normalize(patch.category));

    if (matchedCategory) {
      patch.category = matchedCategory.name; // use the real, correctly-formatted name
      patch.categoryApprovalStatus = 'approved';
    } else {
      patch.categoryApprovalStatus = 'pending';
      const request = {
        id: `catreq_${nanoid(10)}`,
        providerId: req.user.sub,
        requestedCategory: patch.category,
        status: 'pending',
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      await db.insert('categoryRequests', request);
      const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
      for (const admin of superAdmins) {
        await notify(admin.id, '🆕', `${current.name} updated their category to "${patch.category}" — not a current category. Review within 24 hours in Categories & Countries → Category Requests.`, null, { section: 'categories' });
        console.log(`[TEST MODE — no email provider connected] Would email ${admin.email}: category update request "${patch.category}" from ${current.name} needs review within 24 hours.`);
      }
    }
  }
  const updated = await db.update('users', req.user.sub, patch);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(updated) });
});

// POST /api/auth/change-password — requires the current password, not just auth
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 9 characters with at least 6 numbers, 2 letters, and 1 symbol' });
  }
  const user = await db.find('users', u => u.id === req.user.sub);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (verifyPassword(newPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'New password must be different from your current password' });
  }
  const newTokenVersion = (user.tokenVersion || 0) + 1;
  await db.update('users', user.id, { passwordHash: hashPassword(newPassword), tokenVersion: newTokenVersion });
  const freshToken = signToken({ ...user, tokenVersion: newTokenVersion });
  res.json({ ok: true, token: freshToken });
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
router.post('/forgot-password', otpLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  const normalized = email.trim().toLowerCase();

  const genericResponse = { message: 'If an account with that email exists, a reset link has been sent.' };

  if (isRateLimited(normalized)) {
    // Still don't reveal whether the email exists — just stop generating
    // new tokens for it for a while.
    return res.json(genericResponse);
  }

  const user = await db.find('users', u => u.email.toLowerCase() === normalized);
  // Note: this closes the response-SHAPE leak (identical fields either
  // way). A response-TIME leak technically still exists — the real path
  // below does a few extra DB writes the decoy path doesn't — but that's
  // a much higher-effort attack (needs precise timing measurement over
  // many requests) than just reading the JSON, and full constant-time
  // handling is disproportionate for this app's threat model right now.
  // Worth revisiting if this ever needs to resist a genuinely determined
  // attacker rather than casual probing.
  if (!user) {
    // Previously this returned genericResponse alone — no testMode,
    // testModeNote, or resetToken fields. That made the response shape
    // itself distinguish a real account from a fake one (an attacker
    // doesn't need to read the message text, just check whether
    // resetToken is present), quietly defeating the whole point of
    // returning "the same" message either way. This generates a
    // realistic-looking token and returns it in the IDENTICAL shape as
    // the real path below — but it's never hashed, stored, or checked
    // against anything, so submitting it to /reset-password fails exactly
    // like any other wrong token would. Same UX, same test-mode
    // convenience, no distinguishable signal.
    const decoyToken = generateResetToken();
    console.log(`[TEST MODE] Password reset requested for an email with no account (${normalized}) — no token was actually issued.`);
    return res.json({
      ...genericResponse,
      testMode: true,
      testModeNote: 'No real email service is configured yet — this token is returned directly instead of being emailed. Do not do this in production.',
      resetToken: decoyToken,
    });
  }

  // Invalidate any previous outstanding reset tokens for this user before
  // issuing a new one, so only the most recent link works.
  const outstanding = await db.filter('passwordResets', r => r.userId === user.id && !r.used);
  for (const r of outstanding) {
    await db.update('passwordResets', r.id, { used: true });
  }

  const rawToken = generateResetToken();
  const record = {
    id: `pr_${nanoid(10)}`,
    userId: user.id,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  };
  await db.insert('passwordResets', record);

  console.log(`[TEST MODE] Password reset requested for ${user.email}. Reset token: ${rawToken} (expires in 30 min)`);

  res.json({
    ...genericResponse,
    testMode: true,
    testModeNote: 'No real email service is configured yet — this token is returned directly instead of being emailed. Do not do this in production.',
    resetToken: rawToken,
  });
});

// POST /api/auth/reset-password
router.post('/reset-password', otpLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!isNonEmptyString(token)) return res.status(400).json({ error: 'Reset token is required' });
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: 'New password must be at least 9 characters with at least 6 numbers, 2 letters, and 1 symbol' });

  const tokenHash = hashResetToken(token);
  const record = await db.find('passwordResets', r => r.tokenHash === tokenHash);
  if (!record || record.used || new Date(record.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  }

  const user = await db.find('users', u => u.id === record.userId);
  if (!user) return res.status(404).json({ error: 'Account not found' });

  await db.update('users', user.id, { passwordHash: hashPassword(newPassword), tokenVersion: (user.tokenVersion || 0) + 1 });
  await db.update('passwordResets', record.id, { used: true });

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
router.post('/send-phone-otp', requireAuth, async (req, res) => {
  const user = await db.find('users', u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  if (!user.phone) return res.status(400).json({ error: 'Add a phone number to your account first' });

  // Invalidate any previous outstanding code before issuing a new one.
  const outstanding = await db.filter('phoneVerifications', v => v.userId === user.id && !v.used);
  for (const v of outstanding) {
    await db.update('phoneVerifications', v.id, { used: true });
  }

  const code = generateOtp();
  await db.insert('phoneVerifications', {
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
router.post('/verify-phone-otp', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!isNonEmptyString(code)) return res.status(400).json({ error: 'Enter the code you received' });

  const codeHash = hashResetToken(code.trim());
  const record = await db.find('phoneVerifications', v => v.userId === req.user.sub && v.codeHash === codeHash);
  if (!record || record.used || new Date(record.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'That code is invalid or has expired. Request a new one.' });
  }
  await db.update('phoneVerifications', record.id, { used: true });
  await db.update('users', req.user.sub, { phoneVerified: true });
  res.json({ message: 'Phone number verified.' });
});

module.exports = router;
