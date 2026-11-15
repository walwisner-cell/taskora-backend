// v166: Account → Receipts: every receipt Trothen has issued to the person
// (payments, cash rides and jobs, refunds, token purchases, payout
// statements), to look through and download again. See src/receipts.js.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const receipts = require('../receipts');

const router = express.Router();

router.get('/receipts', requireAuth, async (req, res) => {
  res.json({ receipts: await receipts.listFor(req.user.sub) });
});

// The receipt's PDF. Only the person it was issued to, or an admin, can open it.
router.get('/receipts/:id/pdf', requireAuth, async (req, res) => {
  const rec = await db.find('receipts', r => r.id === req.params.id);
  const me = rec && (rec.userId === req.user.sub ? null : await db.find('users', u => u.id === req.user.sub));
  if (!rec || (rec.userId !== req.user.sub && !(me && me.role === 'admin'))) return res.status(404).json({ error: 'Receipt not found' });
  const pdf = await receipts.pdfFor(rec);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Trothen-${rec.number}.pdf"`);
  res.end(pdf);
});

// Send it again by email (for example to a new address).
router.post('/receipts/:id/email', requireAuth, async (req, res) => {
  const rec = await db.find('receipts', r => r.id === req.params.id && r.userId === req.user.sub);
  if (!rec) return res.status(404).json({ error: 'Receipt not found' });
  if (rec.lastResentAt && Date.now() - new Date(rec.lastResentAt).getTime() < 60 * 1000) return res.status(429).json({ error: 'It was just sent. Check your inbox and spam folder.' });
  const user = await db.find('users', u => u.id === req.user.sub);
  const delivery = require('../delivery');
  if (!user || !user.email) return res.status(400).json({ error: 'Add an email address to your account first.' });
  if (!delivery.isEmailConfigured()) return res.status(503).json({ error: 'Email isn\'t set up on Trothen yet. Download the PDF instead.' });
  const { subject, text, html } = receipts.emailParts(rec, user);
  const r = await delivery.sendEmail(user.email, subject, text, { html, attachments: [{ filename: `Trothen-${rec.number}.pdf`, content: await receipts.pdfFor(rec), contentType: 'application/pdf' }] });
  await db.update('receipts', rec.id, { lastResentAt: new Date().toISOString(), ...(r.sent ? { emailedAt: new Date().toISOString(), emailError: null } : {}) });
  if (!r.sent) return res.status(502).json({ error: r.words || 'The email could not be sent. Download the PDF instead.' });
  res.json({ ok: true, to: user.email });
});

module.exports = router;
