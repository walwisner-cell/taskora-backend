const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../auth');
const { isNonEmptyString, validate } = require('../validators');
const { notify } = require('../notify');

const router = express.Router();

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
  console.log(`[TEST MODE — no email provider connected] Would email support@taskora.io: new contact form submission from ${submission.email}`);

  res.status(201).json({ ok: true });
});

// POST /api/careers-inquiry — same real-storage, real-notification pattern
// as the contact form, for the Careers page's "get in touch" form.
router.post('/careers-inquiry', async (req, res) => {
  const { name, email, role, message } = req.body || {};
  const errors = validate([
    ['name', isNonEmptyString(name, { min: 2, max: 100 }), 'Enter your name'],
    ['email', isNonEmptyString(email, { min: 5, max: 254 }), 'Enter a valid email address'],
    ['role', isNonEmptyString(role, { min: 2, max: 200 }), 'Tell us what role or area interests you'],
    ['message', isNonEmptyString(message, { min: 10, max: 3000 }), 'Tell us a bit about yourself (at least 10 characters)'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const submission = {
    id: `career_${nanoid(10)}`,
    name: name.trim(), email: email.trim(), role: role.trim(), message: message.trim(),
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  await db.insert('careersInquiries', submission);

  const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
  for (const admin of superAdmins) {
    await notify(admin.id, '💼', `New careers inquiry from ${submission.name} — interested in: "${submission.role}"`);
  }
  console.log(`[TEST MODE — no email provider connected] Would email support@taskora.io: new careers inquiry from ${submission.email}`);

  res.status(201).json({ ok: true });
});

// GET /api/notifications/mine
router.get('/notifications/mine', requireAuth, async (req, res) => {
  const notifications = await db.filter('notifications', n => n.userId === req.user.sub);
  res.json({ notifications });
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

// GET /api/messages/:withUserId — simple thread between the logged-in user and another
router.get('/messages/:withUserId', requireAuth, async (req, res) => {
  const all = (await db.filter('messages', m =>
    (m.fromId === req.user.sub && m.toId === req.params.withUserId) ||
    (m.toId === req.user.sub && m.fromId === req.params.withUserId)
  )).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ messages: all });
});

// POST /api/messages — send a message
router.post('/messages', requireAuth, async (req, res) => {
  const { toId, text } = req.body || {};
  const errors = validate([
    ['toId', isNonEmptyString(toId), 'Recipient is required'],
    ['text', isNonEmptyString(text, { min: 1, max: 2000 }), 'Message cannot be empty'],
  ]);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const recipient = await db.find('users', u => u.id === toId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const message = { id: `msg_${nanoid(10)}`, fromId: req.user.sub, toId, text: text.trim(), createdAt: new Date().toISOString() };
  await db.insert('messages', message);

  const sender = await db.find('users', u => u.id === req.user.sub);
  await notify(toId, '💬', `New message from ${sender ? sender.name : 'someone'}: "${text.trim().slice(0, 50)}${text.length > 50 ? '…' : ''}"`, 'messages');

  res.status(201).json({ message });
});

module.exports = router;
