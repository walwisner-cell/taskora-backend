const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { hashPassword, verifyPassword, signToken, requireAuth } = require('../auth');

const router = express.Router();

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  const { name, email, password, role, country, city } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  if (!['customer', 'provider'].includes(role)) {
    return res.status(400).json({ error: 'role must be customer or provider — admin accounts are created by a super admin' });
  }
  const existing = db.find('users', u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const user = {
    id: `u_${nanoid(10)}`,
    name,
    email,
    role,
    country: country || 'United States',
    city: city || 'Atlanta',
    initials: name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    verified: false,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    ...(role === 'provider' ? { providerRole: 'New Provider', category: 'Plumbing', rating: 0, jobs: 0, price: 50, tags: [], color: '#5A5F6C', since: String(new Date().getFullYear()) } : {}),
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
  const allowed = ['name', 'email', 'phone', 'country', 'city', 'payPreference', 'payoutMethod', 'notifPrefs'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  const updated = db.update('users', req.user.sub, patch);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(updated) });
});

module.exports = router;
