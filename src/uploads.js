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

// Identity documents (government ID photos, etc. submitted for manual
// verification review) are fundamentally different from everything else
// in UPLOADS_DIR above: portfolio photos, resumes, and promo images are
// all meant to be viewable by anyone with the link, which is exactly why
// UPLOADS_DIR is mounted at /uploads as a public static folder in
// server.js. A government ID must never sit in that same publicly-served
// tree — this is a genuinely separate directory, never passed to
// express.static anywhere, and only ever read by the two protected
// routes that stream a specific document to its owner or an authorized
// verification-team admin (see /verification/:id/document in
// misc.routes.js and admin.routes.js).
const usingConfiguredPrivateDir = !!process.env.PRIVATE_UPLOADS_DIR;
const PRIVATE_UPLOADS_DIR = usingConfiguredPrivateDir
  ? process.env.PRIVATE_UPLOADS_DIR
  : path.join(__dirname, '..', 'private-uploads');

if (!fs.existsSync(PRIVATE_UPLOADS_DIR)) fs.mkdirSync(PRIVATE_UPLOADS_DIR, { recursive: true });

if (usingConfiguredPrivateDir) {
  console.log(`✅ Identity verification documents will be saved to: ${PRIVATE_UPLOADS_DIR} (PRIVATE_UPLOADS_DIR is set)`);
} else {
  console.log(`⚠️  PRIVATE_UPLOADS_DIR is not set — identity documents will be saved to ${PRIVATE_UPLOADS_DIR}, which will NOT survive a redeploy or restart on most hosting platforms. Set PRIVATE_UPLOADS_DIR to a path on your persistent disk (e.g. /var/data/private-uploads on Render, a DIFFERENT subfolder than UPLOADS_DIR) for uploads to actually stick around.`);
}

// Loud, unmissable startup log — this is exactly the kind of misconfiguration
// (uploads silently landing somewhere that doesn't persist) that's otherwise
// invisible until someone notices a photo vanished. If UPLOADS_DIR isn't set,
// say so clearly instead of quietly falling back.
if (usingConfiguredDir) {
  console.log(`✅ Portfolio uploads will be saved to: ${UPLOADS_DIR} (UPLOADS_DIR is set)`);
} else {
  console.log(`⚠️  UPLOADS_DIR is not set — portfolio uploads will be saved to ${UPLOADS_DIR}, which will NOT survive a redeploy or restart on most hosting platforms. Set UPLOADS_DIR to a path on your persistent disk (e.g. /var/data/uploads on Render) for uploads to actually stick around.`);
}

// MP4 and MOV (QuickTime) both store their container type in a 'ftyp' box
// that appears within the first ~12-16 bytes of a real file — checking
// for the literal ASCII bytes 'ftyp' at offset 4 catches both formats,
// the same way real media libraries identify them. WebM is a different
// container format entirely (Matroska/EBML) with its own fixed magic
// header at the very start of the file. Between the two checks, this
// covers every format the upload form actually offers.
function verifyVideoMagicBytes(filePath, declaredMimetype) {
  let buf;
  try {
    const fd = fs.openSync(filePath, 'r');
    buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
  } catch (e) {
    return false;
  }
  const isMp4OrMov = buf.toString('ascii', 4, 8) === 'ftyp';
  const isWebm = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  switch (declaredMimetype) {
    case 'video/mp4': return isMp4OrMov;
    case 'video/quicktime': return isMp4OrMov;
    case 'video/webm': return isWebm;
    default: return false;
  }
}

module.exports = { UPLOADS_DIR, PRIVATE_UPLOADS_DIR, verifyImageMagicBytes, verifyPdfMagicBytes, verifyVideoMagicBytes };

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

// Same real-bytes-not-claimed-type technique as verifyImageMagicBytes
// above, for resume/CV uploads on the Careers page. PDF only — DOC/DOCX
// magic bytes are far less reliable to verify this way (DOCX is just a
// ZIP file, indistinguishable at the byte level from any other ZIP), and
// PDF is universally readable by anyone reviewing applications, so
// restricting to PDF is a real safety choice, not just a convenience one.
function verifyPdfMagicBytes(filePath) {
  let buf;
  try {
    const fd = fs.openSync(filePath, 'r');
    buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
  } catch (e) {
    return false;
  }
  return buf.toString('ascii', 0, 5) === '%PDF-';
}
