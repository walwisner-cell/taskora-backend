const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { seedIfEmpty } = require('./src/seed');

const authRoutes = require('./src/routes/auth.routes');
const marketplaceRoutes = require('./src/routes/marketplace.routes');
const paymentsRoutes = require('./src/routes/payments.routes');
const adminRoutes = require('./src/routes/admin.routes');
const miscRoutes = require('./src/routes/misc.routes');

// Seed demo data only if the datastore is empty (fresh disk / first boot).
// Never overwrites data that already exists, so redeploys are safe.
seedIfEmpty();

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

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'taskora-api', time: new Date().toISOString() }));

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

app.listen(PORT, () => {
  console.log(`\n  Taskora API + frontend running at http://localhost:${PORT}\n`);
});
