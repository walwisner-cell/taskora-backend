// Datastore entry point — picks the real backend based on environment.
//
// Set DATABASE_URL (a real Postgres connection string) to use Postgres —
// this is the production path, and what you get automatically once you
// attach a Render Postgres instance (or any Postgres) via that env var.
//
// Leave DATABASE_URL unset and it falls back to the JSON-file store used
// throughout local development and testing so far — zero setup, works
// immediately. Every route in this app calls db.all/find/filter/insert/
// update/remove/replaceAll and awaits the result either way; which backend
// is actually running underneath is invisible to route code.
module.exports = process.env.DATABASE_URL
  ? require('./db-postgres')
  : require('./db-json');
