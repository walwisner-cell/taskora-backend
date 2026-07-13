const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// In production this must come from an environment variable / secrets
// manager, never be hardcoded, and be rotated. It's inlined here only so
// the project runs immediately with zero setup for local development.
const JWT_SECRET = process.env.TASKORA_JWT_SECRET || 'taskora-dev-secret-change-me';
const TOKEN_TTL = '7d';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// Password-reset tokens are high-entropy random strings, not user-chosen
// passwords — a fast cryptographic hash (SHA-256) is the standard, correct
// choice for these, unlike bcrypt which exists specifically to slow down
// brute-forcing *low*-entropy user passwords. Hashing the token before
// storing it means a leaked database still can't be used to reset accounts.
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { sub, role, email }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden — insufficient role' });
    }
    next();
  };
}

module.exports = {
  hashPassword, verifyPassword, signToken, requireAuth, requireRole, JWT_SECRET,
  generateResetToken, hashResetToken,
};
