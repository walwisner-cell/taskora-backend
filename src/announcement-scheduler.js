const db = require('./db');
const { notify } = require('./notify');

// Item 16 / Administration Announcement Center — the scheduling half.
// POST /admin/announcements (see admin.routes.js) sends an announcement
// immediately when it has no scheduledFor, or when scheduledFor is
// already in the past. This sweep is what makes a FUTURE scheduledFor
// actually mean something: it finds every announcement whose time has
// now arrived but hasn't been sent yet, and sends it for real — the
// same "a setting with no consequence isn't real" principle every other
// scheduler in this app follows.
async function resolveTargetAdmins(announcement) {
  const allAdmins = await db.filter('users', u => u.role === 'admin' && !u.isSuperAdmin);
  if (!announcement.targetRegions || announcement.targetRegions.includes('all')) return allAdmins;
  return allAdmins.filter(a => announcement.targetRegions.includes(a.city));
}

const PRIORITY_ICON = { urgent: '🚨', high: '⚠️', normal: '📢' };

async function sendOneAnnouncement(announcement) {
  const recipients = await resolveTargetAdmins(announcement);
  const icon = PRIORITY_ICON[announcement.priority] || '📢';
  for (const admin of recipients) {
    await notify(admin.id, icon, `${announcement.title}: ${announcement.body}`, null, { section: 'announcements' });
  }
  const updated = await db.update('announcements', announcement.id, { sentAt: new Date().toISOString(), recipientCount: recipients.length });
  return updated;
}

async function sweepScheduledAnnouncements() {
  const now = new Date().toISOString();
  const due = await db.filter('announcements', a => !a.sentAt && a.scheduledFor && a.scheduledFor <= now);
  let sent = 0;
  for (const announcement of due) {
    try {
      await sendOneAnnouncement(announcement);
      sent += 1;
    } catch (e) {
      console.error(`[announcement-scheduler] Failed to send announcement ${announcement.id}:`, e.message);
    }
  }
  if (sent > 0) console.log(`[announcement-scheduler] Sent ${sent} scheduled announcement${sent === 1 ? '' : 's'}.`);
  return { sent, checked: due.length };
}

module.exports = { sweepScheduledAnnouncements, sendOneAnnouncement, resolveTargetAdmins };
