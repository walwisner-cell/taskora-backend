const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { UPLOADS_DIR, verifyImageMagicBytes } = require('../uploads');

const router = express.Router();

const MAX_PHOTOS_PER_PROVIDER = 12;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.sub}_${nanoid(12)}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed'));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

// GET /api/portfolio/mine — the logged-in provider's own photos
router.get('/portfolio/mine', requireAuth, requireRole('provider'), async (req, res) => {
  const photos = await db.filter('portfolioPhotos', p => p.providerId === req.user.sub);
  res.json({ photos });
});

// POST /api/portfolio/upload — real file upload, saved to real disk
router.post('/portfolio/upload', requireAuth, requireRole('provider'), (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No photo file was provided' });

    // Confirm the file actually landed where we expect before doing anything
    // else — silently reporting success on a write that didn't really stick
    // is exactly the failure mode that's hardest to notice until a user
    // reports a vanished photo days later.
    if (!fs.existsSync(req.file.path)) {
      console.error(`Portfolio upload reported success but file is missing at ${req.file.path} — check that UPLOADS_DIR points to a writable, persistent location.`);
      return res.status(500).json({ error: 'The photo could not be saved to disk. Please try again, or contact support if this keeps happening.' });
    }

    // The mimetype check above only looked at what the uploader CLAIMED
    // the file was — trivially spoofable by anyone crafting the request
    // directly rather than going through a real browser file picker. This
    // checks the actual bytes now on disk against a real signature for
    // that image format, and rejects (deleting the file) if they don't
    // match — the same technique real image-processing libraries use to
    // identify a file, not trusting what the upload claimed about itself.
    if (!verifyImageMagicBytes(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'This file does not appear to be a genuine image — please upload a real photo.' });
    }

    const existing = await db.filter('portfolioPhotos', p => p.providerId === req.user.sub);
    if (existing.length >= MAX_PHOTOS_PER_PROVIDER) {
      fs.unlink(req.file.path, () => {}); // clean up the file we just saved, since we're rejecting it
      return res.status(400).json({ error: `You can have at most ${MAX_PHOTOS_PER_PROVIDER} portfolio photos — remove one first` });
    }

    const photo = {
      id: `pf_${nanoid(10)}`,
      providerId: req.user.sub,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      createdAt: new Date().toISOString(),
    };
    await db.insert('portfolioPhotos', photo);

    // Verify the record genuinely round-trips back out of the datastore
    // before telling the client it worked — same principle as the file
    // check above, applied to the database side of the same operation.
    const confirmed = await db.find('portfolioPhotos', p => p.id === photo.id);
    if (!confirmed) {
      fs.unlink(req.file.path, () => {});
      console.error(`Portfolio photo record ${photo.id} did not persist after insert.`);
      return res.status(500).json({ error: 'The photo upload could not be saved. Please try again.' });
    }

    res.status(201).json({ photo: confirmed });
  });
});

// DELETE /api/portfolio/:id — remove one of the provider's own photos
router.delete('/portfolio/:id', requireAuth, requireRole('provider'), async (req, res) => {
  const photo = await db.find('portfolioPhotos', p => p.id === req.params.id && p.providerId === req.user.sub);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  await db.remove('portfolioPhotos', photo.id);
  const filePath = path.join(UPLOADS_DIR, photo.filename);
  fs.unlink(filePath, () => {}); // best-effort; a missing file shouldn't fail the request
  res.json({ ok: true });
});

// ── PROFILE PHOTO ────────────────────────────────────────────────────────
// A single photo identifying the person themselves — distinct from the
// portfolio (multiple work-sample photos). Available to any signed-in
// account, not just providers: a customer's profile photo is just as real
// as a provider's, even though providers are the ones shown on public
// cards today. Uploading a new one replaces the old one (and deletes the
// old file), rather than accumulating like the portfolio does.
router.post('/profile-photo/upload', requireAuth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No photo file was provided' });

    if (!fs.existsSync(req.file.path)) {
      console.error(`Profile photo upload reported success but file is missing at ${req.file.path} — check that UPLOADS_DIR points to a writable, persistent location.`);
      return res.status(500).json({ error: 'The photo could not be saved to disk. Please try again, or contact support if this keeps happening.' });
    }

    if (!verifyImageMagicBytes(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'This file does not appear to be a genuine image — please upload a real photo.' });
    }

    const user = await db.find('users', u => u.id === req.user.sub);
    const oldFilename = user && user.profilePhotoUrl ? user.profilePhotoUrl.split('/').pop() : null;

    const updated = await db.update('users', req.user.sub, { profilePhotoUrl: `/uploads/${req.file.filename}` });
    if (!updated || updated.profilePhotoUrl !== `/uploads/${req.file.filename}`) {
      fs.unlink(req.file.path, () => {});
      console.error(`Profile photo did not persist for user ${req.user.sub}.`);
      return res.status(500).json({ error: 'The photo could not be saved. Please try again.' });
    }

    // Clean up the previous photo now that the new one is confirmed saved.
    if (oldFilename) {
      fs.unlink(path.join(UPLOADS_DIR, oldFilename), () => {});
    }

    res.status(201).json({ profilePhotoUrl: updated.profilePhotoUrl });
  });
});

// DELETE /api/profile-photo — remove the current profile photo, reverting
// to the initials avatar everywhere it's shown.
router.delete('/profile-photo', requireAuth, async (req, res) => {
  const user = await db.find('users', u => u.id === req.user.sub);
  if (!user || !user.profilePhotoUrl) return res.status(404).json({ error: 'No profile photo to remove' });
  const filename = user.profilePhotoUrl.split('/').pop();
  await db.update('users', req.user.sub, { profilePhotoUrl: null });
  fs.unlink(path.join(UPLOADS_DIR, filename), () => {});
  res.json({ ok: true });
});

module.exports = router;
