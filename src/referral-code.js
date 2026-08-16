const { nanoid } = require('nanoid');
const db = require('./db');

// Same code shape/generation style already used for org invite codes
// (nanoid, stripped of ambiguous characters, uppercased, 8 chars) — kept
// consistent rather than inventing a second convention. Collisions are
// astronomically unlikely at this length, but checked and retried anyway
// since a referral code must be genuinely unique to look someone up by.
async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = nanoid(10).replace(/[_-]/g, '').toUpperCase().slice(0, 8);
    const taken = await db.find('users', u => u.referralCode === code);
    if (!taken) return code;
  }
  // Vanishingly unlikely to ever be reached — falls back to a longer,
  // still-unique code rather than looping forever.
  return `${nanoid(10).replace(/[_-]/g, '').toUpperCase()}${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
}

module.exports = { generateUniqueReferralCode };
