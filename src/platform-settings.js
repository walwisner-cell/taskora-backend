const db = require('./db');

// Sensible defaults for every setting this app currently has — used
// whenever no row exists yet in the database (nothing has been changed
// from default). This is the same "DB row overrides code default"
// convention used everywhere else in this app (plan pricing, exchange
// rates, category active-toggles).
const DEFAULTS = {
  // How long a provider has to accept or decline a new booking (direct or
  // a Mutual Agreement offer) before it auto-expires and the customer is
  // refunded — tiered by how soon the job actually is, not a flat number.
  // Real-world comparables: Uber/Lyft give a driver ~15 seconds (the ride
  // starts now); Airbnb's Request-to-Book gives a host 24 hours (bookings
  // are usually days/weeks out). Local home-services jobs span both
  // extremes — someone booking an emergency plumber this afternoon needs a
  // fast provider response; someone booking a mover for next month doesn't
  // need the provider glued to their phone. A single flat window can't
  // serve both well, so this scales with lead time instead.
  bookingResponseTiers: {
    within24h: 1,  // job starts within 24 hours — respond within 1 hour
    within7d: 4,   // job starts within 2–7 days — respond within 4 hours
    beyond7d: 24,  // job starts more than a week out — respond within 24 hours
  },

  // The homepage support chat's "Chat with us" / "Call" links. Ships with
  // an obviously-fake placeholder number on purpose — flagged in every
  // audit rather than silently invented — until a super admin sets the
  // real one here. whatsapp is digits only (country code, no +/spaces/
  // dashes, e.g. "15551234567"); phoneDisplay is whatever human-readable
  // format should actually show on screen.
  supportContact: {
    whatsapp: '15551234567',
    phoneDisplay: '+1 (555) 123-4567',
  },

  // The homepage's actual on-screen copy — hero headline/subheadline, the
  // rotating word in the hero, and the mission section. Editable in
  // Settings → Platform Settings without needing a code deploy. Kept
  // deliberately small (headline pieces + one paragraph) rather than a
  // full page-builder — the rest of the homepage (stats, categories,
  // trust badges) is generated from real data and isn't free-text anyway.
  homepageContent: {
    heroPrefix: 'Find Trusted Local',
    heroRotatingWords: ['Pros', 'Plumbers', 'Cleaners', 'Tutors', 'Electricians'],
    heroSuffix: 'Instantly',
    heroSubheadline: "Every pro is ID-verified. Every job runs on an auto-generated contract with funds held in escrow until you're satisfied. Book in under 2 minutes.",
    missionHeadline: "Local services shouldn't require a leap of faith.",
    missionBody: "From Atlanta to Lagos to Accra, hiring a plumber or a tutor has always meant crossing your fingers — no way to know who's really showing up, and no recourse if it goes wrong. Taskora closes that gap: every professional is identity-verified before they can accept a single job, every booking runs on an auto-generated contract, and your payment sits safely in escrow until the work is done right. Trust shouldn't be a gamble. On Taskora, it's the default.",
  },
};

async function getSetting(key) {
  const row = await db.find('platformSettings', s => s.key === key);
  if (row) return row.value;
  return DEFAULTS[key];
}

async function setSetting(key, value) {
  const existing = await db.find('platformSettings', s => s.key === key);
  const patch = { key, value, updatedAt: new Date().toISOString() };
  if (existing) return db.update('platformSettings', existing.id, patch);
  return db.insert('platformSettings', { id: `ps_${key}`, ...patch });
}

// The actual per-booking calculation. Priority order, same fallback-chain
// convention used everywhere else in this app:
//   1. A category-level override (set in Categories & Countries) always
//      wins — e.g. "Emergency Plumbing" might always need a 30-minute
//      response regardless of how far out the job is.
//   2. Otherwise, the tiered default based on how soon the job actually
//      starts (see bookingResponseTiers above).
//   3. Hard floor either way: the deadline can never exceed the job's own
//      start time (confirming a job after it was supposed to start is
//      meaningless) and never drops below 15 minutes (so a same-hour
//      emergency booking still gets a real, if short, window instead of
//      an instantly-expired one).
function computeResponseWindowHours({ now, jobDateTime, tiers, categoryOverrideHours }) {
  let hours;
  if (categoryOverrideHours != null) {
    hours = categoryOverrideHours;
  } else if (jobDateTime && !isNaN(jobDateTime.getTime())) {
    const hoursUntilJob = (jobDateTime - now) / (1000 * 60 * 60);
    if (hoursUntilJob <= 24) hours = tiers.within24h;
    else if (hoursUntilJob <= 24 * 7) hours = tiers.within7d;
    else hours = tiers.beyond7d;
  } else {
    // Job date/time didn't parse (free-text edge case) — fall back to the
    // middle tier rather than guessing wrong in either direction.
    hours = tiers.within7d;
  }

  if (jobDateTime && !isNaN(jobDateTime.getTime())) {
    const hoursUntilJob = (jobDateTime - now) / (1000 * 60 * 60);
    const maxAllowed = Math.max(0.25, hoursUntilJob); // never past the job's own start time; floor of 15 minutes
    hours = Math.min(hours, maxAllowed);
  }
  return Math.round(hours * 100) / 100;
}

module.exports = { getSetting, setSetting, computeResponseWindowHours, DEFAULTS };
