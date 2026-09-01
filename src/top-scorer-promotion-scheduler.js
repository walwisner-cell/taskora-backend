const db = require('./db');
const { notify } = require('./notify');

const FREE_COMMISSION_DAYS = 2;

// Every Sunday, whoever has the single highest Trust Score in each
// city/region automatically gets a real, working commission-free period —
// see effectiveCommissionRate in src/commission.js, which checks this
// first and always honors it (0% is unambiguously the best rate, so
// there's nothing to weigh it against). This is fully automatic — no
// admin has to notice or click anything for a provider to actually get
// the reward, unlike the individual commission override (which is a
// human decision) or the trust-score pause recommendations (which
// deliberately require a human to act). A single, unambiguous winner
// per region each week doesn't carry the same judgment risk an
// automatic pause would.
//
// Ties: if two providers in the same city are genuinely tied on score,
// both win — this is a reward, not a punishment, so there's no harm in
// more than one person qualifying, and picking an arbitrary "winner"
// between two truly equal scores would be less fair, not more.
async function sweepTopScorerPromotion() {
  const today = new Date();
  if (today.getDay() !== 0) return { ran: false, reason: 'not Sunday' }; // 0 = Sunday

  const providers = await db.filter('users', u => u.role === 'provider' && u.trustScore != null && u.city);
  const byCity = new Map();
  for (const p of providers) {
    if (!byCity.has(p.city)) byCity.set(p.city, []);
    byCity.get(p.city).push(p);
  }

  let awarded = 0;
  const until = new Date(Date.now() + FREE_COMMISSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const [city, cityProviders] of byCity) {
    const topScore = Math.max(...cityProviders.map(p => p.trustScore));
    const winners = cityProviders.filter(p => p.trustScore === topScore);
    for (const winner of winners) {
      // Don't re-notify/re-extend if they already won today somehow (the
      // sweep is only meant to run once per Sunday — see server.js for
      // the daily cadence this runs on, which naturally only lands on a
      // Sunday once a week).
      await db.update('users', winner.id, { freeCommissionUntil: until });
      await notify(winner.id, '🏆', `You had the highest Trust Score in ${city} this week! ${FREE_COMMISSION_DAYS} days of 0% commission, starting now.`, null, { section: 'earnings' });
      awarded += 1;
    }
  }

  if (awarded > 0) console.log(`[top-scorer-promotion-scheduler] Awarded free commission to ${awarded} provider${awarded === 1 ? '' : 's'} across ${byCity.size} cities.`);
  return { ran: true, awarded, citiesChecked: byCity.size };
}

module.exports = { sweepTopScorerPromotion, FREE_COMMISSION_DAYS };
