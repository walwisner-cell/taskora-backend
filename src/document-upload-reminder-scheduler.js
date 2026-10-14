const db = require('./db');
const { notify } = require('./notify');
const { isSmsConfigured, sendSms } = require('./delivery');

// A real, one-time reminder for anyone — customer or provider — who
// signed up but never actually completed identity verification. Sent
// via real text message when Twilio is configured (see src/delivery.js),
// always via an in-app notification regardless. Waits a real 24 hours
// after signup before reminding — nagging someone in their first few
// minutes on the platform isn't the goal here, catching the people who
// genuinely forgot is.
//
// Sends exactly once per account, tracked with documentReminderSentAt —
// same "don't re-notify for something already flagged" principle as the
// license-expiry sweep this is modeled on.
const REMINDER_DELAY_HOURS = 24;

async function sweepDocumentUploadReminders() {
  const cutoff = new Date(Date.now() - REMINDER_DELAY_HOURS * 60 * 60 * 1000).toISOString();
  const candidates = await db.filter('users', u =>
    (u.role === 'customer' || u.role === 'provider') &&
    !u.verified &&
    !u.documentReminderSentAt &&
    u.createdAt && u.createdAt <= cutoff
  );

  let reminded = 0;
  for (const user of candidates) {
    try {
      // v110: notify first, then mark — so a notify/SMS failure doesn't
      // falsely record that this person was reminded when they weren't,
      // which would silently block them from ever getting a real one
      // (same principle as the provider-score and other sweeps below).
      await notify(user.id, '🪪', 'Quick reminder — you haven\'t finished verifying your identity yet. It only takes a couple minutes, and unlocks the full Trothen experience.', null, { section: 'verification' });
      if (isSmsConfigured() && user.phone) {
        await sendSms(user.phone, 'Trothen: You started signing up but haven\'t finished identity verification yet. Open the app to finish — it only takes a couple minutes.');
      }
      await db.update('users', user.id, { documentReminderSentAt: new Date().toISOString() });
      reminded += 1;
    } catch (e) {
      console.error(`[document-reminder-scheduler] Failed to remind ${user.id} — skipped, continuing with the rest:`, e.message);
    }
  }

  if (reminded > 0) console.log(`[document-reminder-scheduler] Sent a verification reminder to ${reminded} account${reminded === 1 ? '' : 's'}.`);
  return { checked: candidates.length, reminded };
}

module.exports = { sweepDocumentUploadReminders };
