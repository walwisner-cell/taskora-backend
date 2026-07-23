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
  // Long-form editable pages — About Us and the Terms of Service. Support
  // a small set of plain-text formatting markers (parsed client-side by
  // renderFormattedContent in public/index.html): a line starting with
  // "# " becomes a section heading, "- " becomes a bullet, "**text**"
  // becomes bold, and a blank line starts a new paragraph. Deliberately
  // not a full WYSIWYG/HTML editor — that would need real sanitization
  // against a much larger attack surface for content only a trusted
  // super admin ever edits; this gives genuine structure (headings,
  // emphasis, lists) with a parser simple enough to reason about
  // completely.
  aboutUsContent: `# Built to make hiring someone feel safe again

Trothen started with a simple frustration: hiring a plumber, a tutor, or a mover in your own neighborhood shouldn't feel like a gamble. Across every market we operate in — Atlanta to Lagos to Accra — the same problem kept coming up: no way to know who's really showing up, and no real recourse if something goes wrong.

So we built a platform where every professional is identity-verified before they can accept a single job, every booking runs on an auto-generated contract, and your payment sits safely in escrow until the work is actually done. Trust shouldn't be something you hope for — it should be the default.

We're a small, distributed team building this because we've personally been on both sides of a bad hire and a missed payment. We're still early, and we're building this in the open — if something's not working the way it should, we want to hear about it.`,

  termsOfServiceContent: `Trothen Terms of Service

Last updated: [set this date when you actually publish these terms]

# 1. Who These Terms Are Between

These Terms of Service ("Terms") govern your use of Trothen (the "Platform"), operated by Trothen Tech Group ("Trothen," "we," "us"). By creating an account, you agree to these Terms. If you don't agree, don't use the Platform.

# 2. What Trothen Is — and Isn't

Trothen is a marketplace that connects Customers who need local services with independent Providers who perform them. **Trothen does not perform the services listed on the Platform, and does not employ the Providers who do.** We verify identity, hold payment in escrow, generate contracts, and provide dispute support — we are not a party to the actual work performed.

# 3. Provider Relationship

Providers are independent contractors, not employees, agents, partners, or joint venturers of Trothen. Nothing in these Terms creates an employment relationship. Providers choose which jobs to accept, when to work, and how the work gets done. Providers are responsible for their own taxes, insurance, and business expenses.

# 4. Account Eligibility

You must be at least 18 years old and able to form a binding contract to use Trothen. You're responsible for keeping your login credentials secure and for everything that happens under your account. Provide accurate information when you register, and keep it up to date.

# 5. Community Standards

Every Customer and Provider agrees to Trothen's Community Standards as a condition of using the Platform:

- **Keep what you promised** — show up for the window you accepted, or say so early if you can't.
- **Be honest** — describe the job and the work accurately.
- **Be safe** — never work impaired or endangered; stop and report if something becomes unsafe.
- **Treat people with respect** — no harassment, discrimination, or unwanted contact.
- **Keep it on the platform** — arrange and pay for work through Trothen. Off-platform, there is no payment protection and no insurance, for either side.

# 6. Payment, Fees, and Escrow

Payment for a job is held in escrow from the time a booking is confirmed until the Customer confirms the job is complete, at which point funds release to the Provider (less Trothen's commission). Trothen's current commission rates by Provider tier, and any applicable Customer service fee, are published on the Platform and may change from time to time — the Platform will always show the actual, current rate before you confirm a booking.

# 7. Cancellations

Either party may cancel a booking before it's completed, subject to the cancellation terms shown on the Platform at the time. A Provider cancelling because a job wasn't accurately described, became unsafe, needed a different trade, or required a license they don't hold will never have that cancellation counted against their standing on the Platform — that's a system rule, not a case-by-case judgment call.

# 8. Prohibited Activity

The following can never be posted or booked on Trothen, regardless of category: transporting people, unsupervised care of minors, work involving weapons or controlled substances, medical or veterinary procedures, or handling of hazardous or biological waste. Trothen may remove any listing or booking that violates this, and may suspend the account responsible.

# 9. Disputes

If something goes wrong with a job, contact Trothen support. A real person reviews every dispute — no automated system suspends an account or makes a final call on a dispute. Response-time targets for different types of issues are published on the Platform.

# 10. Account Suspension

Trothen may suspend or terminate an account for violating these Terms, the Community Standards, or applicable law. Every such decision is made by a person, not an algorithm, and can be questioned — contact support if you believe a decision was made in error.

# 11. Limitation of Liability

Trothen provides the Platform "as is." To the maximum extent permitted by law, Trothen is not liable for the acts or omissions of Customers or Providers, or for indirect, incidental, or consequential damages arising from use of the Platform. Nothing in these Terms limits liability where the law does not allow it to be limited.

# 12. Changes to These Terms

Trothen may update these Terms from time to time. If a change is material, you'll be asked to review and accept the updated Terms before continuing to use the Platform.

# 13. Contact

Questions about these Terms: support@trothen.io`,

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
    missionBody: "From Atlanta to Lagos to Accra, hiring a plumber or a tutor has always meant crossing your fingers — no way to know who's really showing up, and no recourse if it goes wrong. Trothen closes that gap: every professional is identity-verified before they can accept a single job, every booking runs on an auto-generated contract, and your payment sits safely in escrow until the work is done right. Trust shouldn't be a gamble. On Trothen, it's the default.",
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
