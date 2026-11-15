// v108.1: a customer is "verified" only when an ID has been approved.
//
// Joseph found customers showing as verified, all green, with nowhere to
// upload an ID. Those accounts were approved by the team before v75, when
// approving an account also switched on "verified". Since v75 that no
// longer happens, but the old accounts kept the flag. They could book
// without ever showing an ID, and the Verification page had no upload
// because it thought they were done.
//
// This runs once at start-up and then only does something for an account
// that somehow got the flag without an approved ID again. Such a customer
// goes back to unverified and is told, in a notice, to upload their ID.
// Bookings they already made are not touched. Pros are left alone: their
// accounts are listed for the team instead (see the admin People list).
const db = require('./db');

async function applyCustomerIdRule() {
  const approved = new Set((await db.filter('verifications', v => v.status === 'approved')).map(v => v.userId));
  const affected = await db.filter('users', u => u.role === 'customer' && u.verified === true && !approved.has(u.id));
  for (const u of affected) {
    await db.update('users', u.id, { verified: false, verifiedRemovedAt: new Date().toISOString(), verifiedRemovedReason: 'no_approved_id' });
    try {
      await require('./notify').notify(u.id, '🪪', 'Please upload your ID. Trothen now checks an ID for every customer before a booking. It takes two minutes: open Verification in your account.', null, { section: 'verification' });
    } catch (e) { /* the change still stands */ }
  }
  if (affected.length) console.log(`[customer-id-rule] ${affected.length} customer account(s) had "verified" with no approved ID and were asked to upload one.`);
  return affected.length;
}
module.exports = { applyCustomerIdRule };
