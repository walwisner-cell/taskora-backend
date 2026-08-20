const { nanoid } = require('nanoid');
const db = require('./db');

// Real-badge-verified role-based access (department-scoped admin accounts,
// regional scoping) has existed in this app for a while — but knowing
// WHO could see something isn't the same as knowing who actually looked
// at it, which is what the legal checklist's "access logs (who viewed
// what, and when)" item is really asking for. This is that missing half:
// a real, queryable record of every time an admin account actually
// viewed or downloaded sensitive customer/financial data, not just who
// was theoretically allowed to.
//
// Deliberately NOT wired into every single admin GET endpoint in the
// app — that would be a lot of near-identical one-line additions for
// diminishing real value. Wired into the genuinely sensitive ones:
// financial transactions, disputes (which can contain real personal
// detail about what went wrong), the full customer/provider list, and
// cross-region financial totals. The same one-line call
// (logAccess(req, 'resource_type', resourceId)) is the pattern to
// extend to any other endpoint later.
async function logAccess(req, resourceType, resourceId = null) {
  try {
    await db.insert('accessLogs', {
      id: `alog_${nanoid(10)}`,
      adminId: req.user.sub,
      resourceType,
      resourceId,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    // Logging a view should never be the reason a real admin action
    // fails — if this write fails for any reason, the request continues
    // exactly as it would have anyway. Worth knowing about in the
    // server logs, but not worth blocking someone's actual work over.
    console.error('[access-log] Failed to record access log entry:', e.message);
  }
}

module.exports = { logAccess };
