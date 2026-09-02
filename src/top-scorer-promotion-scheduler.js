const db = require('./db');
const { notify } = require('./notify');

// Every day at midnight, whoever has the single highest Trust Score in
// each city/region automatically gets a real, consumable free-commission
// credit — their next payout has 0% commission taken, whenever they
// actually request one. Not a time window: if nobody books them before
// they'd otherwise request a payout, the credit just sits there unused
// until they do have something to request — there's no expiry to lose it
// to, but there's also nothing to apply it to until a real payout
// happens. See POST /payouts/request in payments.routes.js for where
// the credit actually gets consumed.
//
// This is fully automatic — no admin has to notice or click anything,
// unlike the individual commission override (a human decision) or the
// trust-score pause recommendations (which deliberately require a human
// to act). A single, unambiguous daily winner per region doesn't carry
// the same judgment risk an automatic pause would.
//
// Ties: if two providers in the same city are genuinely tied on score,
// both win — this is a reward, not a punishment, so there's no harm in
// more than one person qualifying.
//
// Runs once a day; topScorerAwardedForDate on each provider prevents a
// second award landing on the same calendar day if the sweep were ever
// run more than once (matches the "one award per real occurrence"
// pattern used elsewhere in this app, e.g. the license-expiry reminder).
async function sweepTopScorerPromotion() {
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const providers = await db.filter('users', u => u.role === 'provider' && u.trustScore != null && u.city);
  const byCity = new Map();
  for (const p of providers) {
    if (!byCity.has(p.city)) byCity.set(p.city, []);
    byCity.get(p.city).push(p);
  }

  let awarded = 0;
  for (const [city, cityProviders] of byCity) {
    const topScore = Math.max(...cityProviders.map(p => p.trustScore));
    const winners = cityProviders.filter(p => p.trustScore === topScore);
    for (const winner of winners) {
      if (winner.topScorerAwardedForDate === todayKey) continue; // already won today
      await db.update('users', winner.id, {
        freeCommissionCredits: (winner.freeCommissionCredits || 0) + 1,
        topScorerAwardedForDate: todayKey,
      });
      await notify(winner.id, '🏆', `You had the highest Trust Score in ${city} today! Your next payout will have 0% commission.`, null, { section: 'earnings' });
      awarded += 1;
    }
  }

  if (awarded > 0) console.log(`[top-scorer-promotion-scheduler] Awarded a free-commission credit to ${awarded} provider${awarded === 1 ? '' : 's'} across ${byCity.size} cities.`);
  return { ran: true, awarded, citiesChecked: byCity.size };
}

module.exports = { sweepTopScorerPromotion };
