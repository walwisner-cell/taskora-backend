const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../auth');
const { isNonEmptyString, validate } = require('../validators');
const { notify } = require('../notify');

const router = express.Router();

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
