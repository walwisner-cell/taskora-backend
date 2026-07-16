// Real, rule-based fraud/safety screening — this is what actually backs
// the "every job screened automatically" claim on the marketing page. It's
// deliberately NOT a vendor-grade ML fraud model (that would need a real
// fraud-detection service like Sift or Stripe Radar) — it's genuine,
// functioning heuristic logic that runs on real signups, bookings, and
// disputes, and creates a real flag an admin can actually review. Flags
// never block the action automatically; a human reviews and decides,
// since false positives here would mean blocking real customers.
const db = require('./db');
const { nanoid } = require('nanoid');

async function createFlag({ type, severity, userId, relatedUserId, contractId, details }) {
  const flag = {
    id: `flag_${nanoid(10)}`,
    type, severity,
    userId: userId || null,
    relatedUserId: relatedUserId || null,
    contractId: contractId || null,
    details,
    status: 'open',
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  };
  await db.insert('fraudFlags', flag);
  // Real admins get a real notification — this is what makes "screened
  // automatically" true rather than a flag nobody ever sees.
  const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
  for (const admin of superAdmins) {
    await require('./notify').notify(admin.id, '🚩', `Fraud check flagged: ${details}`);
  }
  return flag;
}

// Rule 1 — Duplicate identity at signup: the same phone number registering
// a second account is one of the most common real signals for someone
// trying to get around a suspension, leave themselves a fake good review,
// or run a scam from a "clean" second identity.
async function checkDuplicateIdentity(phone, email, newUserId) {
  if (!phone) return null;
  const normalizedPhone = phone.replace(/[^\d+]/g, '');
  const existing = await db.find('users', u => u.id !== newUserId && u.phone && u.phone.replace(/[^\d+]/g, '') === normalizedPhone);
  if (existing) {
    return createFlag({
      type: 'duplicate_identity',
      severity: 'high',
      userId: newUserId,
      relatedUserId: existing.id,
      details: `New account signed up with a phone number already registered to another account (${existing.name}, ${existing.email}).`,
    });
  }
  return null;
}

// Rule 2 — Price anomaly: a booking wildly outside the normal range for
// its category is a real, common fraud/error signal — either a mistake
// (potential customer harm) or an attempt to move an unusually large sum
// through escrow for reasons unrelated to the stated service.
async function checkPriceAnomaly(category, amount, contractId, customerId, providerId) {
  // category isn't stored directly on contracts, so this compares against
  // all OTHER contracts whose provider is in the same service category —
  // a real comparison against real historical data, not a guessed range.
  const allContracts = await db.all('contracts');
  const sameCategoryAmounts = [];
  for (const c of allContracts) {
    if (c.id === contractId) continue;
    const provider = await db.find('users', u => u.id === c.providerId);
    if (provider && provider.category === category) sameCategoryAmounts.push(c.amount);
  }
  if (sameCategoryAmounts.length < 3) return null; // not enough real data to judge an anomaly yet
  const avg = sameCategoryAmounts.reduce((s, a) => s + a, 0) / sameCategoryAmounts.length;
  if (amount > avg * 3 || amount < avg / 3) {
    return createFlag({
      type: 'price_anomaly',
      severity: 'medium',
      userId: customerId,
      relatedUserId: providerId,
      contractId,
      details: `Booking of $${amount} for "${category}" is far outside the typical range for this category (average ≈ $${Math.round(avg)}).`,
    });
  }
  return null;
}

// Rule 3 — Rapid repeat disputes: a party involved in an unusual number of
// disputes in a short window is a real, common signal of either a bad-faith
// user or a genuinely mismatched account that needs a closer look.
async function checkRapidDisputes(userId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const contracts = await db.filter('contracts', c => c.customerId === userId || c.providerId === userId);
  const contractIds = new Set(contracts.map(c => c.id));
  const allDisputes = await db.all('disputes');
  const recentDisputes = allDisputes.filter(d => contractIds.has(d.contractId) && d.createdAt >= thirtyDaysAgo);
  if (recentDisputes.length >= 3) {
    return createFlag({
      type: 'repeat_disputes',
      severity: 'high',
      userId,
      details: `This account has been party to ${recentDisputes.length} disputes in the last 30 days — worth a closer look.`,
    });
  }
  return null;
}

// Rule 4 — New account, high-value transaction: a genuinely common fraud
// pattern is opening a brand-new account and immediately trying to move a
// large sum through it, before any real trust or history exists.
async function checkNewAccountHighValue(userId, amount, threshold = 500) {
  if (amount < threshold) return null;
  const user = await db.find('users', u => u.id === userId);
  if (!user) return null;
  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
  if (accountAgeMs < 24 * 60 * 60 * 1000) {
    return createFlag({
      type: 'new_account_high_value',
      severity: 'medium',
      userId,
      details: `Account created less than 24 hours ago attempted a $${amount} transaction — above the $${threshold} threshold for new-account review.`,
    });
  }
  return null;
}

module.exports = { checkDuplicateIdentity, checkPriceAnomaly, checkRapidDisputes, checkNewAccountHighValue, createFlag };
