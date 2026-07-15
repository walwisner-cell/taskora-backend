const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { UPLOADS_DIR } = require('../uploads');

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

module.exports = router;
