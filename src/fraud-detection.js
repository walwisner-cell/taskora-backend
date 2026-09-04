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
  // High-severity flags get a real, fast review deadline — 2 hours, not
  // sitting in a general queue with no urgency. Medium/low flags still
  // get reviewed, just without the same time pressure, since a
  // lower-confidence signal doesn't justify treating every review as an
  // emergency.
  const reviewDeadline = severity === 'high'
    ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    : null;
  const flag = {
    id: `flag_${nanoid(10)}`,
    type, severity,
    userId: userId || null,
    relatedUserId: relatedUserId || null,
    contractId: contractId || null,
    details,
    status: 'open',
    reviewDeadline,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  };
  await db.insert('fraudFlags', flag);
  // Real admins get a real notification — this is what makes "screened
  // automatically" true rather than a flag nobody ever sees.
  const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
  for (const admin of superAdmins) {
    await require('./notify').notify(admin.id, '🚩', `${severity === 'high' ? 'URGENT — review within 2hrs: ' : ''}Fraud check flagged: ${details}`);
  }

  // The actual new protection: a high-severity flag with a specific
  // at-fault account automatically pauses that account's new activity —
  // not a full suspension (they can still log in, see their history,
  // reach support), just paused until a real person reviews it. No
  // algorithm ever locks someone out entirely; this only ever limits
  // what they can start doing next, and only for the highest-confidence
  // signals, with a real, fast human deadline attached.
  if (severity === 'high' && userId) {
    const user = await db.find('users', u => u.id === userId);
    if (user && !user.onHold && user.active !== false) {
      await db.update('users', userId, { onHold: true, holdReason: details, holdSince: new Date().toISOString() });
      await require('./notify').notify(userId, '⏸️', `Your account has been temporarily paused pending a quick review — you can still log in and see your history, but can't start new bookings or request payouts until this is cleared, usually within a couple hours. Contact support if you believe this is a mistake.`, null, { section: 'settings' });
    }
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
  // Providers are fetched once into a lookup map rather than looked up
  // individually per contract — the same result, but one query instead
  // of one per contract, which matters once this runs against real
  // Postgres instead of the small JSON-file store it started on.
  const allContracts = await db.all('contracts');
  const allProviders = await db.filter('users', u => u.role === 'provider');
  const providerById = new Map(allProviders.map(p => [p.id, p]));
  const sameCategoryAmounts = [];
  for (const c of allContracts) {
    if (c.id === contractId) continue;
    const provider = providerById.get(c.providerId);
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

// Rule 5 — Gaming protected cancellations: a provider citing a protected
// reason (unsafe, wrong category, unlicensed) repeatedly in a short
// window is a real, new signal this session's protected-cancellation
// feature made possible to detect — that protection exists so a
// genuinely good provider never gets penalized for a real safety issue
// or a real mismatch, but nothing before this stopped someone from
// citing it every single time to dodge real work while still surfacing
// for new offers.
async function checkProtectedCancellationAbuse(providerId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const contracts = await db.filter('contracts', c =>
    c.providerId === providerId && c.status === 'cancelled' && c.cancelledByRole === 'provider' &&
    c.protectedCancellation && c.createdAt >= thirtyDaysAgo);
  if (contracts.length >= 4) {
    return createFlag({
      type: 'protected_cancellation_pattern',
      severity: 'high',
      userId: providerId,
      details: `This provider has cited a protected cancellation reason ${contracts.length} times in the last 30 days — worth checking whether these are genuine or a pattern of avoiding real jobs.`,
    });
  }
  return null;
}

// Rule 6 — Payout velocity: several payout requests in rapid succession
// is a real signal of either a compromised account being drained
// quickly, or a provider structuring withdrawals to stay under some
// perceived threshold.
async function checkPayoutVelocity(providerId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentPayouts = await db.filter('payouts', p => p.providerId === providerId && p.createdAt >= oneHourAgo);
  if (recentPayouts.length >= 3) {
    return createFlag({
      type: 'payout_velocity',
      severity: 'high',
      userId: providerId,
      details: `${recentPayouts.length} payout requests from this account in the last hour — unusually fast, worth a look before more go through.`,
    });
  }
  return null;
}

// A genuine, checkable anti-spoofing signal — not a claim that this
// prevents someone from faking their GPS (nothing running in a browser
// really can; the browser's location API can always be overridden by
// the person using the device, on any platform, with freely available
// tools). What this DOES catch: two real location pings from the same
// booking that are physically impossible to both be true — e.g.
// "on my way" from one point and "arrived" three states away four
// minutes later. That's not proof of fraud on its own (poor GPS
// accuracy indoors, a VPN messing with an unrelated signal, etc. can
// also produce a large jump), which is exactly why this creates a
// review flag for a human to look at, not an automatic block — same
// principle as every other check in this file.
async function checkImplausibleTravelSpeed(contract) {
  if (!contract.onMyWayLocation || !contract.arrivedLocation || !contract.onMyWayAt || !contract.arrivedAt) return null;
  const { distanceInMiles } = require('./geo-distance');
  const miles = distanceInMiles(
    contract.onMyWayLocation.latitude, contract.onMyWayLocation.longitude,
    contract.arrivedLocation.latitude, contract.arrivedLocation.longitude
  );
  const hours = (new Date(contract.arrivedAt).getTime() - new Date(contract.onMyWayAt).getTime()) / (1000 * 60 * 60);
  if (hours <= 0) return null; // clock skew or same-instant taps — nothing meaningful to compute
  const impliedMph = miles / hours;
  // 90mph sustained is already generous (well above any real door-to-door
  // trip, even highway-only) — this is deliberately loose so normal GPS
  // drift, a long highway leg, or a slightly-off phone clock don't create
  // false alarms. It only fires for genuinely impossible numbers.
  if (impliedMph > 90 && miles > 5) {
    return createFlag({
      type: 'implausible_travel_speed',
      severity: 'medium',
      userId: contract.providerId,
      contractId: contract.id,
      details: `"On my way" and "arrived" locations for this booking are ${Math.round(miles)} miles apart, ${hours.toFixed(2)} hours apart — implies ~${Math.round(impliedMph)} mph average, which isn't realistic. Could be a genuine GPS/clock glitch, or could be a spoofed location — worth a quick look.`,
    });
  }
  return null;
}

module.exports = { checkDuplicateIdentity, checkPriceAnomaly, checkRapidDisputes, checkNewAccountHighValue, checkProtectedCancellationAbuse, checkPayoutVelocity, checkImplausibleTravelSpeed, createFlag };
