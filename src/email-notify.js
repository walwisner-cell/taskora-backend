// v158: important updates also arrive by email.
//
// Before, a booking update reached a person only inside Trothen (and as a
// push message if they had switched those on, which an iPhone allows only
// for an installed app). A customer who booked and closed the page never
// heard that the pro confirmed, that a payment code was waiting, or that the
// booking was cancelled and refunded. A pro never heard of a new booking
// unless they happened to open the app. Marketplaces send these by email as
// standard.
//
// What is emailed: booking updates (requests, confirmations, payments,
// cancellations, refunds, reminders), payout alerts, and account-critical
// notices (suspension, verification, disputes). Never chat messages, new
// job matches or promotions.
//
// So it never becomes noise:
//   - not while the person has Trothen open (they see it there): the app
//     checks for notifications every few seconds, which records "seen";
//   - at most 8 emails an hour per person, and never the same text twice
//     within 30 minutes;
//   - "Email me updates" in Settings → Notifications turns them all off;
//   - only when an email service is set up (SMTP or SendGrid on Render).

const db = require('./db');

const EMAIL_CATEGORIES = new Set(['bookingUpdates', 'payoutAlerts']);
const SEEN_WINDOW_MS = 3 * 60 * 1000;
const PER_HOUR = 8;
const SAME_TEXT_MS = 30 * 60 * 1000;

const seenAt = new Map(); // userId -> last time the app was open (ms)
const sentLog = new Map(); // userId -> [{ at, text }]

function markSeen(userId) {
  if (userId) seenAt.set(userId, Date.now());
}

function appUrl() {
  return String(process.env.APP_URL || 'https://trothenpro.com').replace(/\/+$/, '');
}

function subjectFrom(text) {
  const plain = String(text || '').replace(/\s+/g, ' ').trim();
  const first = (plain.match(/^.*?[.!?](\s|$)/) || [plain])[0].trim();
  const s = first.length > 78 ? first.slice(0, 75).replace(/\s+\S*$/, '') + '…' : first;
  return `Trothen: ${s}`;
}

// Decides, and sends in the background. Never throws, never delays the action.
async function maybeEmail(userId, text, category, linkTo) {
  try {
    const { isEmailConfigured, sendEmail } = require('./delivery');
    if (!isEmailConfigured()) return { sent: false, why: 'not_configured' };
    if (category && !EMAIL_CATEGORIES.has(category)) return { sent: false, why: 'category' };
    const user = await db.find('users', u => u.id === userId);
    if (!user || !user.email || user.active === false || user.closedAt) return { sent: false, why: 'no_user' };
    if (user.notifPrefs && user.notifPrefs.emailUpdates === false) return { sent: false, why: 'opted_out' };
    const now = Date.now();
    if (now - (seenAt.get(userId) || 0) < SEEN_WINDOW_MS) return { sent: false, why: 'in_app' };
    const log = (sentLog.get(userId) || []).filter(x => now - x.at < 3600e3);
    if (log.length >= PER_HOUR) return { sent: false, why: 'cap' };
    if (log.some(x => x.text === text && now - x.at < SAME_TEXT_MS)) return { sent: false, why: 'same' };
    log.push({ at: now, text }); sentLog.set(userId, log);
    const first = String(user.name || '').trim().split(/\s+/)[0] || 'there';
    const section = linkTo && linkTo.section ? `/?section=${encodeURIComponent(linkTo.section)}` : '/';
    const body = [
      `Hello ${first},`,
      '',
      String(text).trim(),
      '',
      `Open Trothen: ${appUrl()}${section}`,
      '',
      'You get this email because "Email me updates" is on. To stop these emails, open Trothen, go to Settings, then Notifications, and switch it off. Sign-in codes and password emails still come.',
      'Trothen will never ask for your password, PIN or a payment to a personal number by email.',
      '',
      'Trothen',
    ].join('\n');
    const r = await sendEmail(user.email, subjectFrom(text), body);
    return { sent: !!(r && r.sent), why: r && r.sent ? null : (r && r.error) || 'failed' };
  } catch (e) {
    console.error('[email-notify]', e.message);
    return { sent: false, why: 'error' };
  }
}

module.exports = { maybeEmail, markSeen, subjectFrom, _sentLog: sentLog, _seenAt: seenAt };
