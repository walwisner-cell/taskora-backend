// v178: the admin help videos are not on the public site. They live in
// help-admin/ and are played through a private link that works for 30 minutes:
//   /api/help-media/<expiry>/<signature>/<file>
// The signature is an HMAC of the file name and the expiry, made with the
// server's secret, so a link can't be made up, changed to another file, or
// used after it expires (the same idea as a pre-signed cloud storage link).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'help-admin');
const LIFE_SECONDS = 30 * 60;
const FILE_RE = /^help-admin-[a-z0-9-]+\.(mp4|jpg)$/;

const secret = () => require('./auth').JWT_SECRET;
const sign = (file, exp) => crypto.createHmac('sha256', secret()).update(`help-media:${file}:${exp}`).digest('base64url');

function signedUrl(file) {
  const exp = Math.floor(Date.now() / 1000) + LIFE_SECONDS;
  return `/api/help-media/${exp}/${sign(file, exp)}/${encodeURIComponent(file)}`;
}
function adminList() {
  try { const j = JSON.parse(fs.readFileSync(path.join(DIR, 'admin-help-videos.json'), 'utf8')); return Array.isArray(j) ? j : []; } catch (e) { return []; }
}
function serve(req, res) {
  const { exp, sig, file } = req.params;
  const n = Number(exp);
  if (!FILE_RE.test(file) || !Number.isInteger(n)) return res.status(404).type('text/plain').send('Not found');
  if (n < Date.now() / 1000) return res.status(403).type('text/plain').send('This link has expired. Open the video again from Admin → Help videos.');
  const want = Buffer.from(sign(file, n)), got = Buffer.from(String(sig));
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return res.status(403).type('text/plain').send('Not allowed');
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) return res.status(404).type('text/plain').send('Not found');
  res.set('Cache-Control', 'private, max-age=600');
  res.set('X-Robots-Tag', 'noindex');
  res.sendFile(full); // answers Range requests, so the video can be skipped through
}
module.exports = { signedUrl, adminList, serve, LIFE_SECONDS, DIR };
