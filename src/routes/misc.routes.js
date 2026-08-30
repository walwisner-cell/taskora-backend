const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { isNonEmptyString, validate } = require('../validators');
const { notify } = require('../notify');
const { currencyForCountry } = require('../currency-data');
const { generateUniqueReferralCode } = require('../referral-code');
const { UPLOADS_DIR, verifyPdfMagicBytes } = require('../uploads');

const router = express.Router();

// Messages between two real, identity-verified users had no rate limit at
// all — a frustrated or malicious user could flood the other party with
// unlimited messages in rapid succession. Generous enough not to get in
// the way of a genuine back-and-forth conversation (30/minute is well
// above any real typing pace), strict enough to stop an actual flood.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Sending messages too quickly — please slow down a moment.' },
});

// The AI chat calls a real, metered external API per question — a
// genuine back-and-forth conversation needs room to breathe, but nothing
// should be able to hammer this endpoint the way it could a free,
// in-memory keyword match.
const supportChatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many questions in a row — please wait a moment, or ask to talk to a real person.' },
});

// POST /api/contact — the public "Contact Us" form. No auth required (an
// anonymous visitor should be able to reach out), but genuinely stored and
// genuinely alerts the team — not just a toast that pretends to send
// something.
router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const errors = validate([
    ['name', isNonEmptyString(name, { min: 2, max: 100 }), 'Enter your name'],
    ['email', isNonEmptyString(email, { min: 5, max: 254 }), 'Enter a valid email address'],
    ['subject', isNonEmptyString(subject, { min: 2, max: 200 }), 'Enter a subject'],
    ['message', isNonEmptyString(message, { min: 10, max: 3000 }), 'Message must be at least 10 characters'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const submission = {
    id: `contact_${nanoid(10)}`,
    name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(),
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  await db.insert('contactSubmissions', submission);

  const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
  for (const admin of superAdmins) {
    await notify(admin.id, '✉️', `New contact form message from ${submission.name}: "${submission.subject}"`);
  }
  console.log(`[TEST MODE — no email provider connected] Would email support@trothen.io: new contact form submission from ${submission.email}`);

  res.status(201).json({ ok: true });
});

// POST /api/careers-inquiry — a real job application, not just a "get in
// touch" note. Previously this only collected a name, email, a free-text
// message, and fired a one-time notification with nowhere for anyone to
// actually go review it — no resume, no phone number, no admin screen to
// see submissions at all. Now accepts a resume (PDF only, verified by
// real file bytes — see verifyPdfMagicBytes — not just the filename or
// declared type), a phone number, and a proper cover letter, and routes
// to whichever HR-department admins exist, falling back to every super
// admin if no HR department admin has been set up yet (see
// GET /admin/careers-inquiries below for where these actually get
// reviewed).
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `resume_${nanoid(16)}.pdf`),
});
const resumeFileFilter = (req, file, cb) => {
  if (file.mimetype !== 'application/pdf') return cb(new Error('Resume must be a PDF file'));
  cb(null, true);
};
const uploadResume = multer({ storage: resumeStorage, fileFilter: resumeFileFilter, limits: { fileSize: 8 * 1024 * 1024 } });

router.post('/careers-inquiry', (req, res, next) => {
  uploadResume.single('resume')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message === 'Resume must be a PDF file' ? err.message : 'Resume upload failed — must be a PDF under 8MB' });
    next();
  });
}, async (req, res) => {
  const { name, email, phone, city, role, coverLetter } = req.body || {};
  const errors = validate([
    ['name', isNonEmptyString(name, { min: 2, max: 100 }), 'Enter your name'],
    ['email', isNonEmptyString(email, { min: 5, max: 254 }), 'Enter a valid email address'],
    ['phone', isNonEmptyString(phone, { min: 7, max: 30 }), 'Enter a real phone number we can reach you at'],
    ['role', isNonEmptyString(role, { min: 2, max: 200 }), 'Tell us what role or area interests you'],
    ['coverLetter', isNonEmptyString(coverLetter, { min: 10, max: 5000 }), 'Tell us a bit about yourself (at least 10 characters)'],
  ]);
  if (errors.length) {
    if (req.file) fs.unlink(req.file.path, () => {}); // don't leave an orphaned file if the rest of the form is invalid
    return res.status(400).json({ error: errors[0], errors });
  }

  let resumeUrl = null;
  if (req.file) {
    if (!verifyPdfMagicBytes(req.file.path)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'That file doesn\'t look like a real PDF — please upload an actual PDF resume' });
    }
    resumeUrl = `/uploads/${req.file.filename}`;
  }

  const submission = {
    id: `career_${nanoid(10)}`,
    name: name.trim(), email: email.trim(), phone: phone.trim(), city: (city || '').trim() || null, role: role.trim(), coverLetter: coverLetter.trim(),
    resumeUrl,
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  await db.insert('careersInquiries', submission);

  // Who actually sees this depends on whether the applicant gave a city.
  // With a city: the city's own regional manager (a plain regional
  // admin has a real, direct stake in who joins their own team — this is
  // the literal "let application be regional manager" request), plus any
  // HR admin specifically scoped to that same city, plus any HR admin
  // who's global. Without a city, or if genuinely nobody above exists:
  // every super admin, so an application never just goes nowhere.
  let recipients = [];
  if (submission.city) {
    const regionalManager = await db.find('users', u => u.role === 'admin' && !u.isSuperAdmin && !u.adminDepartment && u.city === submission.city);
    const cityHr = await db.filter('users', u => u.role === 'admin' && u.adminDepartment === 'hr' && u.regionScoped && u.city === submission.city);
    const globalHr = await db.filter('users', u => u.role === 'admin' && u.adminDepartment === 'hr' && !u.regionScoped);
    recipients = [regionalManager, ...cityHr, ...globalHr].filter(Boolean);
  } else {
    recipients = await db.filter('users', u => u.role === 'admin' && u.adminDepartment === 'hr');
  }
  if (!recipients.length) recipients = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);

  for (const admin of recipients) {
    await notify(admin.id, '💼', `New job application from ${submission.name}${submission.city ? ` (${submission.city})` : ''} — interested in: "${submission.role}"${resumeUrl ? ' (resume attached)' : ''}`, null, { section: 'careers' });
  }
  console.log(`[TEST MODE — no email provider connected] Would email ${recipients.length ? recipients.map(a => a.email).join(', ') : 'support@trothen.io'}: new job application from ${submission.email}`);

  res.status(201).json({ ok: true });
});

// POST /api/advertising-inquiry — the "Advertise Here" slide's real
// destination. Previously this button just opened a mailto: link, which
// silently does nothing on any device without a configured default mail
// client and leaves no record anywhere on the platform. This follows the
// same real-storage, real-notification pattern as /contact and
// /careers-inquiry: genuinely saved, genuinely alerts the super admin team.
// GET /api/ad-pricing?city=X — the real, current self-serve ad price,
// so a provider sees the actual cost before deciding to submit, not a
// surprise after the fact.
// GET /api/my-ad-status — lets a provider see the real, current status
// of their own self-serve ad, if they have one. Real ad platforms always
// give a seller this visibility rather than leaving them to wonder what
// happened after they paid.
router.get('/my-ad-status', requireAuth, requireRole('provider'), async (req, res) => {
  const ad = await db.find('advertisingInquiries', a => a.providerId === req.user.sub && (a.isLive === true || a.status === 'new'));
  if (!ad) return res.json({ ad: null });
  res.json({ ad: { id: ad.id, isLive: ad.isLive, price: ad.price, displayHeadline: ad.displayHeadline, targetCity: ad.targetCity, createdAt: ad.createdAt } });
});

router.get('/ad-pricing', async (req, res) => {
  const { selfServeAdPriceForCity } = require('../ad-pricing');
  const price = await selfServeAdPriceForCity(req.query.city || null);
  res.json({ price });
});

// POST /api/advertising-inquiry/self-serve — an existing, already
// identity-verified provider promoting their own real profile, not an
// outside company. Skips the cold-inquiry contact form (we already know
// exactly who this is), captures the real, current price immediately
// (test-mode, same "genuinely happens, no real money yet" convention as
// every other payment in this app) — but still goes through the same
// quick admin content review before actually going live. The price
// isn't being negotiated at review time, just the content itself.
router.post('/advertising-inquiry/self-serve', requireAuth, requireRole('provider'), async (req, res) => {
  const { displayHeadline, displaySubtext, displayLink, targetCity } = req.body || {};
  const errors = validate([
    ['displayHeadline', isNonEmptyString(displayHeadline, { min: 2, max: 100 }), 'Enter a real headline for your ad'],
    ['displaySubtext', isNonEmptyString(displaySubtext, { min: 5, max: 200 }), 'Enter a short description (at least 5 characters)'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const provider = await db.find('users', u => u.id === req.user.sub);
  // Consistent with every other real-money action already gated by a
  // fraud hold (new bookings, accepting jobs, payouts) — an account
  // under active review shouldn't be able to pay for and submit a new
  // ad in the meantime either.
  if (provider.onHold) {
    return res.status(403).json({ error: 'Your account is temporarily paused pending a quick review — you\'ll be able to submit an ad again shortly.' });
  }
  // A provider paying for a second ad while their first is still pending
  // review or already live isn't a real, separate purchase — it's the
  // same promotion, and letting it happen would mean charging them
  // twice for essentially one thing. Real ad platforms (Etsy, Amazon
  // Seller) all cap this at one active promotion per seller for exactly
  // this reason.
  const existingActive = await db.find('advertisingInquiries', a => a.providerId === provider.id && (a.isLive === true || a.status === 'new'));
  if (existingActive) {
    return res.status(409).json({ error: existingActive.isLive ? 'You already have a live ad running — take it down first if you want to submit a new one.' : 'You already have an ad pending review — please wait for that one before submitting another.' });
  }
  // A provider can only ever target their own city, or genuinely go
  // platform-wide — never claim to represent a city they're not
  // actually based in.
  const wantsOwnCity = targetCity === provider.city;
  const wantsPlatformWide = !targetCity;
  if (!wantsOwnCity && !wantsPlatformWide) {
    return res.status(400).json({ error: 'You can only target your own city, or the whole platform' });
  }
  const city = wantsOwnCity ? provider.city : null;

  const { selfServeAdPriceForCity } = require('../ad-pricing');
  const price = await selfServeAdPriceForCity(city);

  const submission = {
    id: `ad_${nanoid(10)}`,
    providerId: provider.id,
    companyName: provider.businessName || provider.name,
    contactName: provider.name,
    email: provider.email,
    phone: provider.phone || null,
    message: `Self-serve submission from an existing provider (${provider.category || 'no category set'}).`,
    status: 'new',
    targetCity: city,
    isLive: false, // still requires the same quick admin content review — the price is fixed, but the content isn't approved yet
    price,
    currencyCode: currencyForCountry(provider.country || 'United States').code,
    displayHeadline: displayHeadline.trim(),
    displaySubtext: displaySubtext.trim(),
    displayLink: (displayLink || '').trim() || null,
    createdAt: new Date().toISOString(),
  };
  await db.insert('advertisingInquiries', submission);

  const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
  const regionalAdmins = city
    ? await db.filter('users', u => u.role === 'admin' && !u.isSuperAdmin && !u.adminDepartment && u.city === city)
    : [];
  const toNotify = [...superAdmins, ...regionalAdmins];
  for (const admin of toNotify) {
    await notify(admin.id, '📣', `${provider.name} (an existing provider) submitted a self-serve ad, already paid ($${price}) — just needs a quick content review${city ? ` for ${city}` : ' (platform-wide)'}`, null, { section: 'advertising' });
  }

  res.json({ submission });
});

router.post('/advertising-inquiry', async (req, res) => {
  const { companyName, contactName, email, phone, message, targetCity } = req.body || {};
  const errors = validate([
    ['companyName', isNonEmptyString(companyName, { min: 2, max: 150 }), 'Enter your company name'],
    ['contactName', isNonEmptyString(contactName, { min: 2, max: 100 }), 'Enter your name'],
    ['email', isNonEmptyString(email, { min: 5, max: 254 }), 'Enter a valid email address'],
    ['message', isNonEmptyString(message, { min: 10, max: 3000 }), 'Tell us a bit about what you have in mind (at least 10 characters)'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  // targetCity is optional — an empty/missing value means "platform-wide",
  // which only a super admin can approve (see admin.routes.js). Any
  // non-empty value is trusted as typed here; it doesn't need to match a
  // real city exactly for the inquiry to be stored, but it won't show up
  // in any regional admin's queue unless it matches their city exactly —
  // that's the same convention used for how a customer's own city already
  // scopes what a regional admin sees everywhere else in the app.
  const city = (targetCity || '').trim() || null;

  const submission = {
    id: `ad_${nanoid(10)}`,
    companyName: companyName.trim(),
    contactName: contactName.trim(),
    email: email.trim(),
    phone: (phone || '').trim() || null,
    message: message.trim(),
    status: 'new',
    targetCity: city,
    isLive: false,
    createdAt: new Date().toISOString(),
  };
  await db.insert('advertisingInquiries', submission);

  // Notify whoever can actually act on this: the regional admin for the
  // targeted city (if there is one), plus every super admin regardless —
  // a platform-wide (city: null) inquiry only reaches super admins, since
  // only they can approve one.
  const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
  const regionalAdmins = city
    ? await db.filter('users', u => u.role === 'admin' && !u.isSuperAdmin && !u.adminDepartment && u.city === city)
    : [];
  const toNotify = [...superAdmins, ...regionalAdmins];
  for (const admin of toNotify) {
    await notify(admin.id, '📣', `New advertising inquiry from ${submission.companyName} (${submission.contactName})${city ? ` — targeting ${city}` : ' — platform-wide'}`, null, { section: 'advertising' });
  }
  console.log(`[TEST MODE — no email provider connected] Would email sales@trothen.io: new advertising inquiry from ${submission.companyName} <${submission.email}>`);

  res.status(201).json({ ok: true });
});

// POST /api/sales-inquiry — the Custom Plan pricing card's "Contact Sales"
// button. Same bug as "Advertise Here" had: previously a mailto: link,
// meaning it silently did nothing on any device without a configured
// default mail client, and no enterprise lead was ever actually recorded.
// Kept in its own table (not merged with advertisingInquiries) since this
// is a distinct funnel — organizations interested in the platform itself,
// not media partners — that a sales team would want to work separately.
router.post('/sales-inquiry', async (req, res) => {
  const { companyName, contactName, email, teamSize, message } = req.body || {};
  const errors = validate([
    ['companyName', isNonEmptyString(companyName, { min: 2, max: 150 }), 'Enter your company name'],
    ['contactName', isNonEmptyString(contactName, { min: 2, max: 100 }), 'Enter your name'],
    ['email', isNonEmptyString(email, { min: 5, max: 254 }), 'Enter a valid email address'],
    ['message', isNonEmptyString(message, { min: 10, max: 3000 }), 'Tell us a bit about what you need (at least 10 characters)'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const submission = {
    id: `sales_${nanoid(10)}`,
    companyName: companyName.trim(),
    contactName: contactName.trim(),
    email: email.trim(),
    teamSize: (teamSize || '').trim() || null,
    message: message.trim(),
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  await db.insert('salesInquiries', submission);

  const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
  for (const admin of superAdmins) {
    await notify(admin.id, '💼', `New Custom plan sales inquiry from ${submission.companyName} (${submission.contactName})`, null, { section: 'sales' });
  }
  console.log(`[TEST MODE — no email provider connected] Would email sales@trothen.io: new Custom plan inquiry from ${submission.companyName} <${submission.email}>`);

  res.status(201).json({ ok: true });
});

// GET /api/notifications/mine
router.get('/notifications/mine', requireAuth, async (req, res) => {
  const notifications = await db.filter('notifications', n => n.userId === req.user.sub);
  res.json({ notifications });
});

// DELETE /api/notifications/:id — dismiss a single notification for good.
// Previously there was no way to ever actually remove one; marking it
// "read" only ever hid the unread indicator, it stayed in the list
// forever.
router.delete('/notifications/:id', requireAuth, async (req, res) => {
  const record = await db.find('notifications', n => n.id === req.params.id && n.userId === req.user.sub);
  if (!record) return res.status(404).json({ error: 'Notification not found' });
  await db.remove('notifications', record.id);
  res.json({ ok: true });
});

// DELETE /api/notifications — clear every notification for the current
// user at once.
router.delete('/notifications', requireAuth, async (req, res) => {
  const mine = await db.filter('notifications', n => n.userId === req.user.sub);
  for (const n of mine) await db.remove('notifications', n.id);
  res.json({ ok: true, cleared: mine.length });
});

// POST /api/notifications/:id/read
router.post('/notifications/:id/read', requireAuth, async (req, res) => {
  const record = await db.find('notifications', n => n.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Notification not found' });
  if (record.userId !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
  const updated = await db.update('notifications', req.params.id, { read: true });
  res.json({ notification: updated });
});

// GET /api/verification/mine
router.get('/verification/mine', requireAuth, async (req, res) => {
  const records = await db.filter('verifications', v => v.userId === req.user.sub);
  res.json({ verifications: records });
});

// POST /api/verification/submit — submit documents for review
router.post('/verification/submit', requireAuth, async (req, res) => {
  const { docType } = req.body || {};
  const record = {
    id: `ver_${nanoid(10)}`,
    userId: req.user.sub,
    docType: isNonEmptyString(docType) ? docType.trim() : 'Government ID',
    status: 'in review',
    createdAt: new Date().toISOString(),
  };
  await db.insert('verifications', record);
  res.status(201).json({ verification: record });
});

// GET /api/verification/start — whether real, live ID verification
// (Persona) is actually connected. When it is, hands back the hosted
// flow URL to send the person to; the result comes back later via the
// Persona webhook below, not synchronously here. When it isn't
// configured, the frontend falls back to the existing manual
// document-upload + admin-review flow (POST /verification/submit above)
// — same honest "tell the truth about what's real" pattern used
// elsewhere in this app for payments and notifications.
router.get('/verification/start', requireAuth, async (req, res) => {
  const { isPersonaConfigured, isPersonaWebhookConfigured, buildHostedFlowUrl } = require('../persona-verification');
  if (!isPersonaConfigured() || !isPersonaWebhookConfigured()) {
    return res.json({ configured: false });
  }
  res.json({ configured: true, hostedFlowUrl: buildHostedFlowUrl(req.user.sub) });
});

// POST /api/webhooks/persona — real-time result from Persona once someone
// completes (or fails) hosted verification. Public — Persona calls this
// directly, not a signed-in user — so trust comes entirely from the
// signature check, not from auth middleware. Rejects anything that
// doesn't verify rather than trusting the payload's own claims about
// who it's for.
router.post('/webhooks/persona', async (req, res) => {
  const { verifyWebhookSignature } = require('../persona-verification');
  const signature = req.headers['persona-signature'];
  if (!req.rawBody || !verifyWebhookSignature(req.rawBody.toString('utf8'), signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body;
  const eventType = event && event.data && event.data.attributes && event.data.attributes.name;
  const inquiry = event && event.data && event.data.attributes && event.data.attributes.payload && event.data.attributes.payload.data;
  const userId = inquiry && inquiry.attributes && inquiry.attributes['reference-id'];
  if (!userId) return res.status(200).json({ ok: true }); // nothing to act on, but acknowledge receipt so Persona doesn't retry forever

  const user = await db.find('users', u => u.id === userId);
  if (!user) return res.status(200).json({ ok: true });

  if (eventType === 'inquiry.approved') {
    await db.update('users', user.id, { verified: true });
    await db.insert('verifications', {
      id: `ver_${nanoid(10)}`, userId: user.id, docType: 'ID + selfie (Persona, automated)',
      status: 'approved', createdAt: new Date().toISOString(),
    });
    await notify(user.id, '✅', 'Your identity was verified automatically.', null, { section: 'verification' });
  } else if (eventType === 'inquiry.declined' || eventType === 'inquiry.failed') {
    await db.insert('verifications', {
      id: `ver_${nanoid(10)}`, userId: user.id, docType: 'ID + selfie (Persona, automated)',
      status: 'in review', createdAt: new Date().toISOString(),
    });
    const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
    const regionalAdmins = user.city
      ? await db.filter('users', u => u.role === 'admin' && !u.isSuperAdmin && !u.adminDepartment && u.city === user.city)
      : [];
    for (const admin of [...superAdmins, ...regionalAdmins]) {
      await notify(admin.id, '⚠️', `${user.name}'s automated ID verification didn't pass — needs manual review.`, null, { section: 'verification' });
    }
    await notify(user.id, '⚠️', 'Automated identity verification didn\'t go through — a real person will review it shortly.', null, { section: 'verification' });
  }
  res.status(200).json({ ok: true });
});

// GET /api/messages/:withUserId — simple thread between the logged-in user and another
router.get('/messages/:withUserId', requireAuth, async (req, res) => {
  const { jobId } = req.query;
  const all = (await db.filter('messages', m =>
    (m.fromId === req.user.sub && m.toId === req.params.withUserId) ||
    (m.toId === req.user.sub && m.fromId === req.params.withUserId)
  ))
    .filter(m => !jobId || m.jobId === jobId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ messages: all });
});

// POST /api/messages — send a message
// POST /api/support-chat/ask — real chat intelligence, not keyword
// matching. Anonymous visitors can use this too (the chat widget is
// visible on the public homepage), so no auth is required, but it's
// rate-limited since each real question costs a real API call. Fails
// honestly (a clear error, not a fabricated answer) if the API key
// isn't configured, so the frontend can fall back to the existing FAQ +
// human-handoff path rather than silently pretending to be smarter than
// it is.
router.post('/support-chat/ask', supportChatLimiter, async (req, res) => {
  const { message, history } = req.body || {};
  if (!isNonEmptyString(message, { min: 1, max: 1000 })) {
    return res.status(400).json({ error: 'Enter a real question (up to 1000 characters)' });
  }
  try {
    const { askSupportChat } = require('../support-chat');
    const answer = await askSupportChat(message, Array.isArray(history) ? history : []);
    res.json({ answer });
  } catch (e) {
    if (e.code === 'NOT_CONFIGURED') {
      return res.status(503).json({ error: 'not_configured' });
    }
    console.error('[support-chat] Real API call failed:', e.message);
    res.status(502).json({ error: 'Could not reach the assistant right now — try again, or talk to a real person.' });
  }
});

router.post('/messages', requireAuth, messageLimiter, async (req, res) => {
  const { toId, text, jobId } = req.body || {};
  const errors = validate([
    ['toId', isNonEmptyString(toId), 'Recipient is required'],
    ['text', isNonEmptyString(text, { min: 1, max: 2000 }), 'Message cannot be empty'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const recipient = await db.find('users', u => u.id === toId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  let job = null;
  if (jobId) {
    job = await db.find('jobs', j => j.id === jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    // Whoever's sending this must actually be one of the two real parties
    // to that job — either the customer who posted it, or a provider
    // messaging that customer about it. Stops a jobId being attached to a
    // conversation neither side of the job is actually part of.
    const isJobCustomer = job.customerId === req.user.sub && recipient.id !== job.customerId;
    const isJobProvider = recipient.id === job.customerId && req.user.role === 'provider';
    if (!isJobCustomer && !isJobProvider) return res.status(403).json({ error: 'This job doesn\'t belong to either you or the person you\'re messaging' });
  }

  const message = { id: `msg_${nanoid(10)}`, fromId: req.user.sub, toId, text: text.trim(), jobId: jobId || null, createdAt: new Date().toISOString() };
  await db.insert('messages', message);

  const sender = await db.find('users', u => u.id === req.user.sub);
  await notify(toId, '💬', `New message from ${sender ? sender.name : 'someone'}: "${text.trim().slice(0, 50)}${text.length > 50 ? '…' : ''}"`, 'messages', { section: 'messages', contactId: req.user.sub, jobId: jobId || undefined });

  // A provider messaging a customer about their open job is a real
  // response, the same as clicking "I'm Interested" — this keeps the
  // job's candidate list honest even for a provider who jumped straight
  // to negotiating instead of clicking the button first. Only touches
  // the match if one already exists and is still just 'pending'; never
  // overwrites 'interested', 'accepted', or 'not_selected'.
  if (job && req.user.sub !== job.customerId) {
    const match = await db.find('matches', m => m.jobId === job.id && m.providerId === req.user.sub);
    if (match && match.status === 'pending') {
      await db.update('matches', match.id, { status: 'interested' });
    }
  }

  res.status(201).json({ message });
});

// GET /api/referrals/mine — a customer or provider's own referral code
// and who's actually joined through it so far. Every account gets a
// referral code at signup (see auth.routes.js), so this never 404s for a
// real signed-in user. Referred people are shown as first name + last
// initial only — enough to feel real without exposing a referred
// person's full identity to whoever referred them.
// GET /api/provider-score/mine — a provider's own real, live trust score
// and breakdown, the same numbers an admin sees, so there's nothing
// hidden about how it's calculated.
// GET /api/promotions/mine — active promotions actually meant for this
// person: matching their role (or posted to 'both'), and either
// platform-wide or specifically targeting their own city. Expired ones
// (past expiresAt) are filtered out here too, so nothing stale ever
// reaches a dashboard even if an admin forgets to deactivate it.
router.get('/promotions/mine', requireAuth, async (req, res) => {
  if (!['customer', 'provider'].includes(req.user.role)) return res.json({ promotions: [] });
  const me = await db.find('users', u => u.id === req.user.sub);
  const audienceKey = req.user.role === 'customer' ? 'customers' : 'providers';
  const now = new Date();
  const all = await db.filter('promotions', p =>
    p.active &&
    (p.audience === audienceKey || p.audience === 'both') &&
    (!p.region || p.region === (me && me.city)) &&
    (!p.expiresAt || new Date(p.expiresAt) > now)
  );
  res.json({ promotions: all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

router.get('/provider-score/mine', requireAuth, requireRole('provider'), async (req, res) => {
  const { computeProviderScore } = require('../provider-score');
  const result = await computeProviderScore(req.user.sub);
  if (!result) return res.status(404).json({ error: 'Account not found' });
  res.json(result);
});

// GET /api/favorites/mine — a customer's saved favorite providers, with
// real, current profile data (not a stale snapshot from when they
// favorited) so a rating or trust score change shows up correctly.
// POST /api/membership/subscribe — starts (or changes) a customer's paid
// membership tier. Simulated the same way every other payment in this
// app is right now (no real Stripe integration yet). VIP is deliberately
// rejected here even if requested — see src/membership.js for why it's
// never self-purchasable at any price.
router.post('/membership/subscribe', requireAuth, requireRole('customer'), async (req, res) => {
  const { MEMBERSHIP_TIERS } = require('../membership');
  const { tier } = req.body || {};
  const config = MEMBERSHIP_TIERS[tier];
  if (!config || !config.selfServe) {
    return res.status(400).json({ error: 'tier must be plus, pro, or elite' });
  }
  const me = await db.find('users', u => u.id === req.user.sub);
  if (me.membershipTier === tier) return res.status(400).json({ error: `You're already on the ${config.label} tier` });
  const updated = await db.update('users', me.id, {
    membershipTier: tier,
    membershipStartedAt: new Date().toISOString(),
    membershipPrice: config.price,
  });
  await notify(me.id, '⭐', `Welcome to Trothen ${config.label}! $${config.price}/month, cancel or change anytime.`, null, { section: 'settings' });
  res.json({ user: updated });
});

// POST /api/membership/cancel — drops back to Free, no dark patterns:
// takes effect immediately, one call, no retention flow in the way.
router.post('/membership/cancel', requireAuth, requireRole('customer'), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me.membershipTier || me.membershipTier === 'free') return res.status(400).json({ error: 'You\'re already on the Free tier' });
  const updated = await db.update('users', me.id, { membershipTier: 'free', membershipCancelledAt: new Date().toISOString(), membershipPrice: null });
  await notify(me.id, '👋', 'Your Trothen membership has been cancelled — no further charges. You\'re back on the Free tier.', null, { section: 'settings' });
  res.json({ user: updated });
});

// GET /api/loyalty/mine — a customer's real points balance, and how
// close they are to a free-booking credit (see src/loyalty.js for
// exactly how points are earned and redeemed).
router.get('/loyalty/mine', requireAuth, requireRole('customer'), async (req, res) => {
  const { POINTS_FOR_FREE_BOOKING } = require('../loyalty');
  const me = await db.find('users', u => u.id === req.user.sub);
  const points = (me && me.loyaltyPoints) || 0;
  res.json({
    points,
    pointsForFreeBooking: POINTS_FOR_FREE_BOOKING,
    freeBookingsAvailable: Math.floor(points / POINTS_FOR_FREE_BOOKING),
    pointsUntilNext: POINTS_FOR_FREE_BOOKING - (points % POINTS_FOR_FREE_BOOKING),
  });
});

router.get('/favorites/mine', requireAuth, requireRole('customer'), async (req, res) => {
  const favorites = (await db.filter('favoriteProviders', f => f.customerId === req.user.sub))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const providers = (await Promise.all(favorites.map(async f => {
    const provider = await db.find('users', u => u.id === f.providerId && u.role === 'provider');
    if (!provider) return null;
    const { publicProvider } = require('./marketplace.routes');
    return { favoriteId: f.id, ...publicProvider(provider) };
  }))).filter(Boolean);
  res.json({ providers });
});

// GET /api/favorites/check/:providerId — whether this specific provider
// is already in the customer's favorites, for showing the right
// state (filled vs outline heart) on a profile or card.
router.get('/favorites/check/:providerId', requireAuth, requireRole('customer'), async (req, res) => {
  const favorite = await db.find('favoriteProviders', f => f.customerId === req.user.sub && f.providerId === req.params.providerId);
  res.json({ isFavorite: !!favorite, favoriteId: favorite ? favorite.id : null });
});

// POST /api/favorites — save a provider as a favorite.
router.post('/favorites', requireAuth, requireRole('customer'), async (req, res) => {
  const { providerId } = req.body || {};
  if (!isNonEmptyString(providerId)) return res.status(400).json({ error: 'providerId is required' });
  const provider = await db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  const existing = await db.find('favoriteProviders', f => f.customerId === req.user.sub && f.providerId === providerId);
  if (existing) return res.json({ favorite: existing }); // already favorited — not an error, just a no-op
  const favorite = { id: `fav_${nanoid(10)}`, customerId: req.user.sub, providerId, createdAt: new Date().toISOString() };
  await db.insert('favoriteProviders', favorite);
  res.status(201).json({ favorite });
});

// DELETE /api/favorites/:providerId — remove a provider from favorites.
router.delete('/favorites/:providerId', requireAuth, requireRole('customer'), async (req, res) => {
  const existing = await db.find('favoriteProviders', f => f.customerId === req.user.sub && f.providerId === req.params.providerId);
  if (!existing) return res.status(404).json({ error: 'Not in your favorites' });
  await db.remove('favoriteProviders', existing.id);
  res.json({ ok: true });
});

router.get('/referrals/mine', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'Account not found' });
  let code = me.referralCode;
  if (!code) {
    // An account created before referrals existed — give it a real code
    // now rather than leaving this feature permanently unavailable to
    // everyone who signed up before this shipped.
    code = await generateUniqueReferralCode();
    await db.update('users', me.id, { referralCode: code });
  }
  const records = (await db.filter('referrals', r => r.referrerId === me.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const referred = await Promise.all(records.map(async r => {
    const u = await db.find('users', u => u.id === r.referredUserId);
    if (!u) return null;
    const parts = u.name.split(' ');
    const displayName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
    return { name: displayName, role: r.referredRole, joinedAt: r.createdAt };
  }));
  res.json({
    code,
    totalReferred: records.length,
    referred: referred.filter(Boolean),
  });
});

module.exports = router;
