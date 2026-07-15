// Where uploaded files (portfolio photos, and anything similar later) live
// on disk. Independent of which datastore backend is active (JSON files or
// Postgres) — Postgres stores data, not files, so uploads always need real
// disk (or, at larger scale, cloud blob storage like S3) regardless of that
// choice.
//
// On Render, point UPLOADS_DIR at the same mounted persistent disk used for
// DATA_DIR so uploaded photos survive redeploys, same principle as the JSON
// datastore. If this app ever runs on infrastructure without a persistent
// disk (or across multiple server instances), this is the file to replace
// with an S3-compatible client — nothing else needs to change, since routes
// only ever call the functions this module exports.
const fs = require('fs');
const path = require('path');

const usingConfiguredDir = !!process.env.UPLOADS_DIR;
const UPLOADS_DIR = usingConfiguredDir
  ? process.env.UPLOADS_DIR
  : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Loud, unmissable startup log — this is exactly the kind of misconfiguration
// (uploads silently landing somewhere that doesn't persist) that's otherwise
// invisible until someone notices a photo vanished. If UPLOADS_DIR isn't set,
// say so clearly instead of quietly falling back.
if (usingConfiguredDir) {
  console.log(`✅ Portfolio uploads will be saved to: ${UPLOADS_DIR} (UPLOADS_DIR is set)`);
} else {
  console.log(`⚠️  UPLOADS_DIR is not set — portfolio uploads will be saved to ${UPLOADS_DIR}, which will NOT survive a redeploy or restart on most hosting platforms. Set UPLOADS_DIR to a path on your persistent disk (e.g. /var/data/uploads on Render) for uploads to actually stick around.`);
}

module.exports = { UPLOADS_DIR };
