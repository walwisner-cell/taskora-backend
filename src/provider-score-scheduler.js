const db = require('./db');
const { notify } = require('./notify');
const { computeProviderScore, recommendedActionForScore } = require('./provider-score');

// Recomputes every provider's trust score once a day, stores it on their
// account (so it's fast to read/display without recomputing on every
// page load), and — the real point of this sweep — notifies the
// verification team and the provider's own regional admin the moment a
// score newly crosses into a recommended-pause band. "Newly" matters:
// this only notifies once per crossing, not every single day the score
// stays low, the same "don't re-notify for something already flagged"
// principle the document-expiry sweep already uses.
//
// This never pauses anyone automatically — see recommendedActionForScore
// in src/provider-score.js for why. It surfaces the recommendation to a
// real person; a real person clicks a real button
// (POST /admin/providers/:id/apply-score-pause) to actually act on it.
async function sweepProviderScores() {
  const providers = await db.filter('users', u => u.role === 'provider');
  let flagged = 0;
  let reactivated = 0;

  for (const provider of providers) {
    // A score-based pause (see POST /admin/providers/:id/apply-score-pause)
    // auto-expires once holdUntil passes — this is the actual check that
    // makes that "auto" real, rather than leaving a provider paused
    // forever until someone remembers to manually clear it. A manual
    // hold (no holdUntil set) is unaffected and stays exactly as
    // permanent as it always was — this only ever touches holds that
    // were created with a real expiry date.
    if (provider.onHold && provider.holdUntil && new Date(provider.holdUntil) <= new Date()) {
      await db.update('users', provider.id, { onHold: false, holdReason: null, holdSince: null, holdUntil: null });
      await notify(provider.id, '✅', 'Your account hold has expired and you can book and accept jobs normally again.', null, { section: 'settings' });
      reactivated += 1;
    }

    const result = await computeProviderScore(provider.id);
    if (!result) continue;

    const previousScore = provider.trustScore;
    await db.update('users', provider.id, {
      trustScore: result.total,
      trustScoreBreakdown: result.breakdown,
      trustScoreUpdatedAt: new Date().toISOString(),
    });

    const action = recommendedActionForScore(result.total);
    const previousAction = previousScore != null ? recommendedActionForScore(previousScore) : null;
    const isNewCrossing = action && (!previousAction || previousAction.months !== action.months);
    if (!isNewCrossing) continue;

    const superAdmins = await db.filter('users', u => u.role === 'admin' && u.isSuperAdmin);
    const regionalAdmins = provider.city
      ? await db.filter('users', u => u.role === 'admin' && !u.isSuperAdmin && !u.adminDepartment && u.city === provider.city)
      : [];
    const verificationAdmins = await db.filter('users', u => u.role === 'admin' && u.adminDepartment === 'verification');
    const recipients = [...superAdmins, ...regionalAdmins, ...verificationAdmins];
    for (const admin of recipients) {
      await notify(admin.id, '⚠️', `${provider.name}'s trust score dropped to ${result.total}/99 — recommended: ${action.label}.`, null, { section: 'people' });
    }
    flagged += 1;
  }

  if (flagged > 0) console.log(`[provider-score-scheduler] Flagged ${flagged} provider${flagged === 1 ? '' : 's'} for a newly-recommended score-based pause.`);
  if (reactivated > 0) console.log(`[provider-score-scheduler] Auto-reactivated ${reactivated} provider${reactivated === 1 ? '' : 's'} whose score-based pause expired.`);
  return { checked: providers.length, flagged, reactivated };
}

module.exports = { sweepProviderScores };
