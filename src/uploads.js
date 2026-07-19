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

module.exports = { UPLOADS_DIR, verifyImageMagicBytes };

// Every upload endpoint in this app validates a file by its CLIENT-DECLARED
// mimetype (from the multipart form field) — which is exactly what an
// attacker sending the request controls directly, not something the
// browser reliably enforces. A file renamed to end in .png with a manually
// set Content-Type: image/png header would sail through that check
// regardless of what bytes it actually contains. This reads the first few
// real bytes of the file ALREADY SAVED to disk and confirms they match a
// genuine signature for that image format — the same technique real image
// libraries use to identify a file, not trusting anything the uploader
// claimed about it. Called after multer saves the file; the route deletes
// it and rejects the upload if this returns false.
function verifyImageMagicBytes(filePath, declaredMimetype) {
  let buf;
  try {
    const fd = fs.openSync(filePath, 'r');
    buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
  } catch (e) {
    return false; // couldn't even read the file — treat as invalid, not as a pass
  }

  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isGif = buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a';
  const isWebp = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';

  switch (declaredMimetype) {
    case 'image/png': return isPng;
    case 'image/jpeg': return isJpeg;
    case 'image/gif': return isGif;
    case 'image/webp': return isWebp;
    default: return false;
  }
}
