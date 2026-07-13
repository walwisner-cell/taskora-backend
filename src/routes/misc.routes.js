const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/notifications/mine
router.get('/notifications/mine', requireAuth, (req, res) => {
  const notifications = db.filter('notifications', n => n.userId === req.user.sub);
  res.json({ notifications });
});

// POST /api/notifications/:id/read
router.post('/notifications/:id/read', requireAuth, (req, res) => {
  const updated = db.update('notifications', req.params.id, { read: true });
  if (!updated) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification: updated });
});

// GET /api/verification/mine
router.get('/verification/mine', requireAuth, (req, res) => {
  const records = db.filter('verifications', v => v.userId === req.user.sub);
  res.json({ verifications: records });
});

// POST /api/verification/submit — submit documents for review
router.post('/verification/submit', requireAuth, (req, res) => {
  const { docType } = req.body || {};
  const record = {
    id: `ver_${nanoid(10)}`,
    userId: req.user.sub,
    docType: docType || 'Government ID',
    status: 'in review',
    createdAt: new Date().toISOString(),
  };
  db.insert('verifications', record);
  res.status(201).json({ verification: record });
});

// GET /api/messages/:withUserId — simple thread between the logged-in user and another
router.get('/messages/:withUserId', requireAuth, (req, res) => {
  const all = db.filter('messages', m =>
    (m.fromId === req.user.sub && m.toId === req.params.withUserId) ||
    (m.toId === req.user.sub && m.fromId === req.params.withUserId)
  );
  res.json({ messages: all });
});

// POST /api/messages — send a message
router.post('/messages', requireAuth, (req, res) => {
  const { toId, text } = req.body || {};
  if (!toId || !text) return res.status(400).json({ error: 'toId and text are required' });
  const message = { id: `msg_${nanoid(10)}`, fromId: req.user.sub, toId, text, createdAt: new Date().toISOString() };
  db.insert('messages', message);
  res.status(201).json({ message });
});

module.exports = router;
