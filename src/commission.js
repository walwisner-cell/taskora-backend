// Single source of truth for commission rates by provider plan. Previously
// this constant only lived inside payments.routes.js (used at actual payout
// time). It's pulled out here so admin.routes.js can also use it to show an
// *estimated* commission on transactions that haven't been paid out yet,
// without duplicating (and risking drifting from) the real rate table.
// Rates match the current Master Reference and Fees and Payment Policy
// exactly: Starter 13%, Pro 12%, Super-Pro 10%. If these ever change,
// update the actual policy document first — this constant should always
// follow the published policy, never the other way around.
const COMMISSION_RATES = { starter: 0.13, pro: 0.12, superpro: 0.10 };

function commissionRateForPlan(plan) {
  return COMMISSION_RATES[plan] ?? COMMISSION_RATES.starter;
}

// The real rate a specific provider pays right now — an organization's
// negotiated volume-discount rate (see src/schema.sql organizations table)
// always wins over their individual plan rate, since that's the entire
// point of the Custom plan's "volume commission discount" promise. Falls
// back to the normal plan-based rate for any provider not attached to an
// org, or attached to one with no custom rate set.
function effectiveCommissionRate(provider, organization) {
  if (organization && organization.commissionRate != null) return organization.commissionRate;
  return commissionRateForPlan(provider && provider.plan);
}

module.exports = { COMMISSION_RATES, commissionRateForPlan, effectiveCommissionRate, checkAndAdvanceProviderTier };

// Real thresholds from the Master Reference and Fees and Payment Policy.
const TIER_THRESHOLDS = {
  pro: { jobs: 50, rating: 4.7, cancellationRate: 5 },
  superpro: { jobs: 500, rating: 4.85, cancellationRate: 2, monthsActive: 12 },
};

// The real fix for the actual bug: a provider could previously just click
// a button and set their own plan to Pro or Super-Pro, with zero check on
// whether they'd earned it — completely bypassing the tier ladder this
// whole system is built around. Now plan changes only ever happen here
// (Pro, automatically, the moment real stats qualify) or through a real
// admin action (Super-Pro, which policy explicitly says is "reviewed, not
// automatic" — this only ever flags eligibility, an admin still has to
// approve it).
//
// Honest limitation: "no upheld serious complaint" (part of the real
// Super-Pro requirement) isn't automatically computable from existing
// dispute data — there's no clean "upheld against this provider" flag to
// check. That's exactly why this tier requires a human review rather than
// being fully automatic; an admin can weigh dispute history directly
// when deciding, rather than this function guessing at it.
async function checkAndAdvanceProviderTier(providerId) {
  const db = require('./db');
  const { notify } = require('./notify');
  const provider = await db.find('users', u => u.id === providerId && u.role === 'provider');
  if (!provider || provider.plan === 'superpro') return; // already at the top, or not a real provider
  if (provider.onHold) return; // under active fraud review — advancing their tier doesn't make sense until that clears

  const contracts = await db.filter('contracts', c => c.providerId === providerId);
  const jobsCompleted = contracts.filter(c => c.status === 'completed').length;
  const providerCancellations = contracts.filter(c => c.status === 'cancelled' && c.cancelledByRole === 'provider');
  const countedCancellations = providerCancellations.filter(c => !c.protectedCancellation).length;
  const denominator = jobsCompleted + providerCancellations.length;
  const cancellationRate = denominator > 0 ? (countedCancellations / denominator) * 100 : 0;
  const rating = provider.rating ? Number(provider.rating) : 0;
  const monthsActive = provider.since
    ? (Date.now() - new Date(provider.since).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    : 0;

  if ((provider.plan || 'starter') === 'starter') {
    const t = TIER_THRESHOLDS.pro;
    if (jobsCompleted >= t.jobs && rating >= t.rating && cancellationRate <= t.cancellationRate) {
      await db.update('users', provider.id, { plan: 'pro' });
      await notify(provider.id, '🎉', `You've been automatically moved to the Pro tier — 12% commission, priority placement, and portfolio boosts, effective now.`, null, { section: 'settings' });
      return;
    }
  }

  if ((provider.plan || 'starter') !== 'superpro') {
    const t = TIER_THRESHOLDS.superpro;
    const qualifies = jobsCompleted >= t.jobs && rating >= t.rating && cancellationRate <= t.cancellationRate && monthsActive >= t.monthsActive;
    if (qualifies && !provider.superProEligibleSince) {
      await db.update('users', provider.id, { superProEligibleSince: new Date().toISOString() });
      // Real Super-Pro advancement is a human decision, not this
      // function's — flag it for an admin, don't apply it.
      const supers = await db.filter('users', u => u.isSuperAdmin === true);
      for (const admin of supers) {
        await notify(admin.id, '🏆', `${provider.name} now meets every automatic Super-Pro requirement and is ready for review.`, null, { section: 'people' });
      }
    }
  }
}
