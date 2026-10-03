// v77: ID documents and selfies are not kept forever.
//
// Once a verification has been decided (approved, rejected, or replaced by
// a newer upload), the uploaded files are only needed for a while: long
// enough to answer a question or a dispute about the decision. After the
// number of days set in Admin → Verification, the FILES are deleted from
// the disk. The RECORD stays (who, which kind of document, the name on it,
// who reviewed it and when), so "Verified" still has its trail.
//
// Submissions still waiting for review are never touched.
// A setting of 0 means "keep files until I delete them myself".
const fs = require('fs');
const path = require('path');
const db = require('./db');

const DECIDED = ['approved', 'rejected', 'superseded'];

async function sweepIdDocumentRetention() {
  const { getSetting } = require('./platform-settings');
  const { PRIVATE_UPLOADS_DIR } = require('./uploads');
  const days = Number(await getSetting('idDocumentRetentionDays'));
  if (!Number.isFinite(days) || days <= 0) return { deleted: 0, skipped: 'retention is off' };

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const due = await db.filter('verifications', v =>
    DECIDED.includes(v.status) &&
    (v.documentFilename || v.selfieFilename) &&
    String(v.reviewedAt || v.createdAt || '') !== '' &&
    String(v.reviewedAt || v.createdAt) <= cutoff
  );

  let deleted = 0;
  for (const v of due) {
    for (const name of [v.documentFilename, v.selfieFilename]) {
      if (!name) continue;
      // Only ever a plain file name inside the private folder.
      const safe = path.basename(String(name));
      try { fs.unlinkSync(path.join(PRIVATE_UPLOADS_DIR, safe)); } catch (e) { /* already gone is fine */ }
    }
    await db.update('verifications', v.id, { documentFilename: null, selfieFilename: null, filesDeletedAt: new Date().toISOString() });
    deleted += 1;
  }
  if (deleted > 0) console.log(`[id-retention] Deleted the uploaded files for ${deleted} decided verification${deleted === 1 ? '' : 's'} older than ${days} days. The records are kept.`);
  return { deleted };
}

module.exports = { sweepIdDocumentRetention };
