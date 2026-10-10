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
// Loaded here (not just lazily where it's used) purely so its own
// configured/not-configured startup message — see src/push-notifications.js
// — shows up at boot alongside every other integration's status, instead
// of silently waiting until the first push notification actually fires.
require('./src/push-notifications');

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

// Render (like every hosted platform) puts one proxy hop in front of this
// app. Without this line, Express sees the PROXY's address as every
// visitor's IP — which meant every rate limit in the app (login attempts,
// code guesses, signups) was one shared bucket for the whole world: ten
// bad logins from anyone locked out everyone for 15 minutes. Trusting
// exactly one hop gives each real visitor their own limit and makes
// req.protocol report https correctly for links built from the request.
app.set('trust proxy', 1);

// Standard security headers this app had none of before: clickjacking
// protection (X-Frame-Options), MIME-sniffing protection
// (X-Content-Type-Options), HSTS, and a few others helmet sets by
// default. Content-Security-Policy is deliberately turned off here — this
// app's frontend is a single HTML file with inline <script>/<style>
// blocks, and helmet's default CSP disallows inline-anything, which would
// break the entire page. The real defense against injected content is
// the output-escaping fix already in place; this is additional
// defense-in-depth for the rest, not a replacement for that.
// v82: a content security policy is now on. The page keeps its code
// inside one file, so inline scripts have to stay allowed; what this adds
// is a fixed list of the ONLY outside places the page may load code,
// styles, fonts or frames from (Google sign-in and Google Fonts), no
// plugins, no being framed by another site, and no sending forms
// elsewhere. Set CSP_REPORT_ONLY=true on the server to make the browser
// report problems without blocking, if something ever needs diagnosing.
// v108: the page's code now lives in its own files (public/app/*.js), so
// the policy can go a step further. Browsers that understand the newer
// rules (every current one) follow these two:
//   script-src-elem: a <script> may only come from this site or Google
//                    sign-in. A <script> written into the page itself is
//                    refused. That is the common way injected code runs.
//   script-src-attr: the page's own buttons still use onclick="...", so
//                    those stay allowed. Closing that too means rewriting
//                    every button on the site.
// Older browsers ignore both and fall back to script-src, unchanged from
// before, so nothing breaks for them.
// 'wasm-unsafe-eval' lets the page run the HEIC photo converter (a
// WebAssembly file from this site). It does not allow eval() of text.
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://accounts.google.com'],
  scriptSrcElem: ["'self'", 'https://accounts.google.com'],
  scriptSrcAttr: ["'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  mediaSrc: ["'self'", 'blob:', 'data:'],
  connectSrc: ["'self'", 'https://accounts.google.com'],
  frameSrc: ["'self'", 'blob:', 'https://accounts.google.com'],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
};
app.use(helmet({
  contentSecurityPolicy: { useDefaults: false, directives: cspDirectives, reportOnly: process.env.CSP_REPORT_ONLY === 'true' },
  // Helmet's default Cross-Origin-Opener-Policy (same-origin) severs
  // window.opener between this page and any popup IT opens — which
  // silently breaks Google Sign-In's popup flow, since Google's own
  // client script hands the credential back via
  // window.opener.postMessage(). same-origin-allow-popups keeps the
  // same real protection against a POPUP reaching back into THIS page
  // (the actual thing COOP defends against), while still allowing this
  // page to talk to a popup it opened itself. Confirmed via a live
  // Google Sign-In test that this was the actual root cause — the
  // popup opened but stayed blank until this changed.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
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
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(morgan('dev'));

// ---- API routes ----
app.use('/api/auth', authRoutes);
// v105: pro stores, extra skills, pick-up/drop-off, and the pro's business tools.
// These come first so their /api/admin/store addresses are reached before the main admin routes.
app.use('/api', require('./src/routes/store.routes'));
app.use('/api', require('./src/routes/orders.routes')); // v108: store orders, drivers, receipts
app.use('/api', require('./src/routes/business.routes'));
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

// What is actually live on THIS server right now, read straight from its
// real configuration — never hardcoded. The site-wide notice at the top of
// every page is built from this, so it can't drift out of date again the
// way the old fixed "codes appear on-screen" wording did once real email
// sending was connected. Only yes/no flags are returned, never any key.
app.get('/api/system-status', (req, res) => {
  const delivery = require('./src/delivery');
  let liberiaMoMoLive = false;
  try {
    const momo = require('./src/liberia-momo');
    liberiaMoMoLive = process.env.LCMMMI_INTEGRATION_ENABLED === 'true' && !!(momo.isLiberiaMoMoConfigured && momo.isLiberiaMoMoConfigured());
  } catch (e) { liberiaMoMoLive = false; }
  let googleSignInLive = false;
  try { googleSignInLive = require('./src/google-auth').isGoogleSignInConfigured(); } catch (e) {}
  res.set('Cache-Control', 'no-store');
  res.json({
    emailLive: delivery.isEmailConfigured(),
    smsLive: delivery.isSmsConfigured() || delivery.isVerifyConfigured(),
    googleSignInLive,
    // Card payments and payouts have no real payment processor behind them
    // (Stripe Connect is waiting on attorney sign-off), so this is false
    // until that code exists — not a setting anyone can flip by accident.
    cardPaymentsLive: false,
    liberiaMoMoLive,
  });
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
// v108: the page's code is in public/app/. The browser must always ask
// whether it changed ("no-cache" means check first, not never keep), so a
// deploy is picked up at once and an unchanged file costs almost nothing.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/[\\/]app[\\/][^\\/]+\.js$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
// A script or vendor file that isn't there must be a plain "not found". It
// used to fall through to the line below and come back as the HTML page,
// which a browser then tried to run as code.
app.get(['/app/*', '/vendor/*'], (req, res) => res.status(404).type('text/plain').send('Not found'));
{
  const fsCheck = require('fs');
  for (const f of ['app/trothen.js', 'app/theme.js']) {
    if (!fsCheck.existsSync(path.join(__dirname, 'public', f))) console.error(`❌ public/${f} is missing. The site will not work without it. Copy the whole "public" folder from the release package, including the "app" folder.`);
  }
}
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

// Last line of defense, outside any single request — express-async-errors
// above already forwards a route handler's thrown/rejected errors to the
// error handler right above, and every scheduled sweep (see the
// setInterval calls below) already catches its own errors individually.
// This exists for anything genuinely unexpected that falls outside both
// of those: it gets logged instead of silently crashing the whole
// server for every user over one unrelated bug.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// Seed demo data only if the datastore is empty (fresh disk/database, first
// boot). Never overwrites data that already exists, so redeploys are safe.
// This is awaited before the server starts accepting requests — with a real
// Postgres backend, the very first query needs the schema to exist and the
// seed check needs to actually finish, not race against incoming traffic.
seedIfEmpty()
  .then(() => require('./src/go-live').bootstrapSuperAdminIfNeeded())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Trothen API + frontend running at http://localhost:${PORT}\n`);
    });

    // Daily live exchange-rate refresh (see src/fx-scheduler.js). Runs once
    // shortly after boot, then every 24 hours — fire-and-forget, never
    // blocks server startup or crashes the process if the provider is
    // briefly unreachable (falls back to whatever rates already exist).
    const { refreshLiveExchangeRates } = require('./src/fx-scheduler');
    // v86: the four core markets are always live. They are what the
    // homepage's "Live now in" strip shows and where people can sign up.
    // If one of them is found switched off when the server starts (a slip
    // of the toggle in Admin → Categories & Countries, or a tool that reset
    // the list), it is switched back on and the fact is logged. Before
    // this, that correction only ran when someone pressed the Sync button.
    // Other countries are never touched here.
    (async () => {
      try {
        const db = require('./src/db');
        const { nanoid } = require('nanoid');
        const CORE = ['United States', 'Nigeria', 'Ghana', 'Liberia'];
        const fixed = [];
        for (const name of CORE) {
          const c = await db.find('countries', x => x.name === name);
          if (!c) { await db.insert('countries', { id: `cty_${nanoid(8)}`, name, status: 'live' }); fixed.push(name + ' (added)'); }
          else if (c.status !== 'live') { await db.update('countries', c.id, { status: 'live' }); fixed.push(name); }
        }
        if (fixed.length) console.log(`[countries] Switched back to live at startup: ${fixed.join(', ')}.`);
      } catch (e) { console.error('[countries] Could not check the core countries at startup:', e.message); }
    })();

    // v95: load the one support email, so PDF footers have it from the first request.
    require('./src/platform-settings').publicSupportEmail().catch(() => {});

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

    // Document (license) expiry reminder sweep (see
    // src/document-expiry-scheduler.js). Runs once shortly after boot, then
    // once every 24 hours — a 30-day warning has no reason to run more
    // often than that, same cadence as the exchange-rate refresh above.
    const { sweepExpiringDocuments } = require('./src/document-expiry-scheduler');
    setTimeout(() => { sweepExpiringDocuments().catch(e => console.error('[document-expiry-scheduler] Unexpected error during scheduled sweep:', e)); }, 11000);
    setInterval(() => { sweepExpiringDocuments().catch(e => console.error('[document-expiry-scheduler] Unexpected error during scheduled sweep:', e)); }, ONE_DAY_MS);

    // Provider trust score sweep (see src/provider-score-scheduler.js).
    // Same daily cadence — a score built from job history and account
    // data has no reason to be recomputed more often than that.
    const { sweepProviderScores } = require('./src/provider-score-scheduler');
    setTimeout(() => { sweepProviderScores().catch(e => console.error('[provider-score-scheduler] Unexpected error during scheduled sweep:', e)); }, 14000);
    setInterval(() => { sweepProviderScores().catch(e => console.error('[provider-score-scheduler] Unexpected error during scheduled sweep:', e)); }, ONE_DAY_MS);

    // Payout settlement sweep (see src/payout-settlement-scheduler.js).
    // Same daily cadence — settlement is simulated as "a couple of days,"
    // not something that needs to be precise to the hour.
    const { sweepPayoutSettlement } = require('./src/payout-settlement-scheduler');
    setTimeout(() => { sweepPayoutSettlement().catch(e => console.error('[payout-settlement-scheduler] Unexpected error during scheduled sweep:', e)); }, 17000);
    setInterval(() => { sweepPayoutSettlement().catch(e => console.error('[payout-settlement-scheduler] Unexpected error during scheduled sweep:', e)); }, ONE_DAY_MS);

    // Daily top-scorer free-commission promotion (see
    // src/top-scorer-promotion-scheduler.js). Runs every day — each
    // city's highest Trust Score that day earns a real, consumable
    // free-commission credit for their next payout.
    const { sweepTopScorerPromotion } = require('./src/top-scorer-promotion-scheduler');
    setTimeout(() => { sweepTopScorerPromotion().catch(e => console.error('[top-scorer-promotion-scheduler] Unexpected error during scheduled sweep:', e)); }, 20000);
    setInterval(() => { sweepTopScorerPromotion().catch(e => console.error('[top-scorer-promotion-scheduler] Unexpected error during scheduled sweep:', e)); }, ONE_DAY_MS);

    // Post-signup document upload reminder (see
    // src/document-upload-reminder-scheduler.js).
    const { sweepDocumentUploadReminders } = require('./src/document-upload-reminder-scheduler');
    setTimeout(() => { sweepDocumentUploadReminders().catch(e => console.error('[document-reminder-scheduler] Unexpected error during scheduled sweep:', e)); }, 23000);
    setInterval(() => { sweepDocumentUploadReminders().catch(e => console.error('[document-reminder-scheduler] Unexpected error during scheduled sweep:', e)); }, ONE_DAY_MS);

    // v107: ads come down when their time is up (see src/ads.js). Hourly.
    // v108.1: customers marked verified before v75 without an approved ID
    setTimeout(() => { require('./src/customer-id-rule').applyCustomerIdRule().catch(e => console.error('[customer-id-rule] failed:', e)); }, 5000);
    const { endExpiredAds } = require('./src/ads');
    setTimeout(() => { endExpiredAds().catch(e => console.error('[ads] sweep failed:', e)); }, 37000);
    setInterval(() => { endExpiredAds().catch(e => console.error('[ads] sweep failed:', e)); }, 60 * 60 * 1000);

    // v96: remove exact job locations once they're no longer needed (see
    // src/location-retention-scheduler.js). Shortly after boot, then daily.
    const { sweepLocationRetention } = require('./src/location-retention-scheduler');
    setTimeout(() => { sweepLocationRetention().catch(e => console.error('[location-retention] sweep failed:', e)); }, 34000);
    setInterval(() => { sweepLocationRetention().catch(e => console.error('[location-retention] sweep failed:', e)); }, ONE_DAY_MS);

    // v82: nightly copy of the data files (see src/backup-scheduler.js).
    // A minute after boot if today's copy doesn't exist yet, then daily.
    const backups = require('./src/backup-scheduler');
    if (backups.backupsApply()) {
      const safeBackup = () => { try { backups.runBackup(); } catch (e) { console.error('[backup] failed:', e.message); } };
      setTimeout(() => { const today = new Date().toISOString().slice(0, 10); if (!backups.listBackups().some(b => b.day === today)) safeBackup(); }, 60000);
      setInterval(safeBackup, ONE_DAY_MS);
    }

    // v81: sign-ups that were started and never finished are removed once
    // they've expired (they used to stay on disk for good). Hourly.
    const sweepExpiredSignups = async () => {
      const db = require('./src/db');
      const now = new Date().toISOString();
      const stale = await db.filter('pendingRegistrations', p => p.expiresAt && p.expiresAt < now);
      for (const p of stale) await db.remove('pendingRegistrations', p.id);
      if (stale.length) console.log(`[signup] Removed ${stale.length} expired unfinished sign-up${stale.length === 1 ? '' : 's'}.`);
    };
    setTimeout(() => { sweepExpiredSignups().catch(e => console.error('[signup] sweep failed:', e)); }, 31000);
    setInterval(() => { sweepExpiredSignups().catch(e => console.error('[signup] sweep failed:', e)); }, 60 * 60 * 1000);

    // v78: monthly provider plan invoices (see src/plan-billing.js). Does
    // nothing unless billing is switched on. Shortly after boot, then daily;
    // it only ever creates one invoice per provider per month.
    const { sweepPlanInvoices } = require('./src/plan-billing');
    setTimeout(() => { sweepPlanInvoices().catch(e => console.error('[plan-billing] Unexpected error during scheduled sweep:', e)); }, 29000);
    setInterval(() => { sweepPlanInvoices().catch(e => console.error('[plan-billing] Unexpected error during scheduled sweep:', e)); }, ONE_DAY_MS);

    // v77: delete ID files once they're past the retention period (see
    // src/id-retention-scheduler.js). Shortly after boot, then daily.
    const { sweepIdDocumentRetention } = require('./src/id-retention-scheduler');
    setTimeout(() => { sweepIdDocumentRetention().catch(e => console.error('[id-retention] Unexpected error during scheduled sweep:', e)); }, 26000);
    setInterval(() => { sweepIdDocumentRetention().catch(e => console.error('[id-retention] Unexpected error during scheduled sweep:', e)); }, ONE_DAY_MS);

    // Scheduled announcement sweep (see src/announcement-scheduler.js) —
    // checked every 5 minutes, same cadence as the booking-response sweep,
    // since a scheduled announcement is genuinely time-sensitive (an
    // announcement meant to go out at 9am shouldn't sit unsent until the
    // next daily sweep).
    const { sweepScheduledAnnouncements } = require('./src/announcement-scheduler');
    setTimeout(() => { sweepScheduledAnnouncements().catch(e => console.error('[announcement-scheduler] Unexpected error during scheduled sweep:', e)); }, 26000);
    setInterval(() => { sweepScheduledAnnouncements().catch(e => console.error('[announcement-scheduler] Unexpected error during scheduled sweep:', e)); }, FIVE_MINUTES_MS);
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
