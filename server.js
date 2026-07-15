const path = require('path');
const express = require('express');
// Express 4 does not automatically catch rejected Promises thrown inside
// async route handlers — without this, any unexpected database error (or
// any other thrown error) inside an `async (req, res) => {...}` handler
// crashes the entire Node process instead of returning a 500 response.
// This patches Express's routing so those errors are forwarded to the
// error-handling middleware below like any other error. Must be required
// before any routes are defined.
require('express-async-errors');
const cors = require('cors');
const morgan = require('morgan');
const { seedIfEmpty } = require('./src/seed');

const authRoutes = require('./src/routes/auth.routes');
const marketplaceRoutes = require('./src/routes/marketplace.routes');
const paymentsRoutes = require('./src/routes/payments.routes');
const adminRoutes = require('./src/routes/admin.routes');
const miscRoutes = require('./src/routes/misc.routes');
const portfolioRoutes = require('./src/routes/portfolio.routes');
const { UPLOADS_DIR } = require('./src/uploads');

// Actually try writing to UPLOADS_DIR at boot, rather than assuming it's
// writable just because the path exists. This is what turns a silent
// misconfiguration (uploads that "succeed" but never really persist) into
// something visible in the logs before a single user ever hits it.
(function checkUploadsDirWritable() {
  const fs = require('fs');
  const path = require('path');
  const testFile = path.join(UPLOADS_DIR, `.write-check-${Date.now()}`);
  try {
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    console.log(`✅ Uploads directory is writable: ${UPLOADS_DIR}`);
  } catch (e) {
    console.error(`❌ Uploads directory is NOT writable: ${UPLOADS_DIR} — portfolio photo uploads will fail. Error: ${e.message}`);
  }
})();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api', marketplaceRoutes);
app.use('/api', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', miscRoutes);
app.use('/api', portfolioRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'taskora-api', time: new Date().toISOString() }));

// ---- Serve uploaded portfolio photos ----
app.use('/uploads', express.static(UPLOADS_DIR));

// ---- Serve the frontend ----
// The main HTML file explicitly disables caching — this is the file that
// changes with every deploy, and a browser serving a stale cached copy
// after a real fix has shipped is a genuinely confusing, hard-to-diagnose
// failure mode (looks like "the fix didn't work" when it's actually just
// an old cached page). Other static assets (images, uploads) can still
// cache normally since they change far less often.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Seed demo data only if the datastore is empty (fresh disk/database, first
// boot). Never overwrites data that already exists, so redeploys are safe.
// This is awaited before the server starts accepting requests — with a real
// Postgres backend, the very first query needs the schema to exist and the
// seed check needs to actually finish, not race against incoming traffic.
seedIfEmpty()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Taskora API + frontend running at http://localhost:${PORT}\n`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
