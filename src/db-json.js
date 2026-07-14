// Lightweight JSON-file datastore — the automatic fallback when no
// DATABASE_URL is configured (see db.js). Every method returns a Promise,
// even though the underlying work is synchronous file I/O, so route code
// written with `await db.find(...)` behaves identically whether it's
// talking to this file store or to real Postgres (db-postgres.js). That's
// what makes the Postgres migration a drop-in swap rather than a rewrite:
// only db.js's backend-selection changes, nothing that calls db.* does.
const fs = require('fs');
const path = require('path');

// On Render (or any host), point DATA_DIR at a mounted persistent disk so
// test data survives redeploys and restarts. Without it, this defaults to a
// local folder next to the code — fine for local dev, but on most hosting
// platforms the filesystem is wiped on every deploy, so DATA_DIR should be
// set to a persistent volume path in production (see render.yaml).
const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readCollection(collection) {
  const fp = filePath(collection);
  if (!fs.existsSync(fp)) return [];
  const raw = fs.readFileSync(fp, 'utf-8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeCollection(collection, records) {
  const fp = filePath(collection);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
  fs.renameSync(tmp, fp);
}

const db = {
  async all(collection) {
    return readCollection(collection);
  },
  async find(collection, predicate) {
    return readCollection(collection).find(predicate) || null;
  },
  async filter(collection, predicate) {
    return readCollection(collection).filter(predicate);
  },
  async insert(collection, record) {
    const records = readCollection(collection);
    records.push(record);
    writeCollection(collection, records);
    return record;
  },
  async update(collection, id, patch) {
    const records = readCollection(collection);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...patch, updatedAt: new Date().toISOString() };
    writeCollection(collection, records);
    return records[idx];
  },
  async remove(collection, id) {
    const records = readCollection(collection);
    const next = records.filter(r => r.id !== id);
    writeCollection(collection, next);
    return next.length !== records.length;
  },
  async replaceAll(collection, records) {
    writeCollection(collection, records);
  },
};

module.exports = db;
