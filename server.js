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

const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Standard security headers this app had none of before: clickjacking
// protection (X-Frame-Options), MIME-sniffing protection
// (X-Content-Type-Options), HSTS, and a few others helmet sets by
// default. Content-Security-Policy is deliberately turned off here — this
// app's frontend is a single HTML file with inline <script>/<style>
// blocks, and helmet's default CSP disallows inline-anything, which would
// break the entire page. The real defense against injected content is
// the output-escaping fix already in place; this is additional
// defense-in-depth for the rest, not a replacement for that.
app.use(helmet({ contentSecurityPolicy: false }));
// CORS was wide open (any origin, unconditionally) with no way to
// restrict it. Given this app authenticates with a Bearer token rather
// than cookies, the classic CSRF risk CORS restriction primarily guards
// against doesn't directly apply — a malicious site can't get a victim's
// browser to automatically attach their token to a forged request the
// way it could with cookies. Still, allowing literally any origin is
// looser than it needs to be. This adds a real restriction that's
// entirely opt-in: set ALLOWED_ORIGINS (comma-separated) once you have a
// real domain, and only those origins (plus requests with no Origin
// header at all — same-origin page loads, curl, mobile apps, server-to-
// server calls) will be allowed. Leave it unset and behavior is
// unchanged from today, so this can't break your live site by itself.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
} : undefined));
app.use(express.json());
app.use(morgan('dev'));

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api', marketplaceRoutes);
app.use('/api', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', miscRoutes);
app.use('/api', portfolioRoutes);

// A real health check — Render (and any monitoring) uses this to decide
// whether this instance is actually healthy enough to route traffic to.
// Always returning ok:true regardless of what's actually happening
// underneath means a genuinely broken instance (database unreachable)
// would keep receiving traffic with no early warning. This does one real,
// cheap query against the actual datastore in use (JSON file or Postgres)
// and only reports healthy if that genuinely succeeds.
app.get('/api/health', async (req, res) => {
  try {
    const db = require('./src/db');
    await db.all('categories');
    res.json({ ok: true, service: 'trothen-api', time: new Date().toISOString() });
  } catch (e) {
    console.error('Health check failed — datastore unreachable:', e.message);
    res.status(503).json({ ok: false, service: 'trothen-api', error: 'Datastore unreachable', time: new Date().toISOString() });
  }
});

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

// A request to a genuinely unknown /api/* route (a typo, an old removed
// endpoint, whatever) was falling through to Express's default 404 —
// a raw HTML page, not the JSON format every real endpoint in this app
// actually returns. Anything calling this API expects JSON back, always.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
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
      console.log(`\n  Trothen API + frontend running at http://localhost:${PORT}\n`);
    });

    // Daily live exchange-rate refresh (see src/fx-scheduler.js). Runs once
    // shortly after boot, then every 24 hours — fire-and-forget, never
    // blocks server startup or crashes the process if the provider is
    // briefly unreachable (falls back to whatever rates already exist).
    const { refreshLiveExchangeRates } = require('./src/fx-scheduler');
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    setTimeout(() => { refreshLiveExchangeRates().catch(e => console.error('[exchange-rates] Unexpected error during scheduled refresh:', e)); }, 5000);
    setInterval(() => { refreshLiveExchangeRates().catch(e => console.error('[exchange-rates] Unexpected error during scheduled refresh:', e)); }, ONE_DAY_MS);

    // Booking-response expiry sweep (see src/booking-scheduler.js). Runs
    // every 5 minutes — much more frequent than the FX refresh, since a
    // provider confirmation window is measured in hours, not days. Without
    // this, "respond within N hours" would just be text with no actual
    // consequence.
    const { expireOverdueBookingResponses } = require('./src/booking-scheduler');
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    setTimeout(() => { expireOverdueBookingResponses().catch(e => console.error('[booking-scheduler] Unexpected error during scheduled sweep:', e)); }, 8000);
    setInterval(() => { expireOverdueBookingResponses().catch(e => console.error('[booking-scheduler] Unexpected error during scheduled sweep:', e)); }, FIVE_MINUTES_MS);
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
