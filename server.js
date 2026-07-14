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
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
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
