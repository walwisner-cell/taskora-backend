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

// v166: "the system is sometimes not stable". Every read used to open the
// collection's file and parse all of it, and every write wrote all of it
// back, indented. The app reads the same files many times a second (each
// open page checks notifications and messages every few seconds, and the
// background sweeps scan bookings and payments), so as the data grew, the
// small Render server spent most of its time re-reading files: pages
// slowed down, and Render's health check could time out and restart it.
//
// Now each collection is kept in memory after the first read, and the file
// is only read again if it changed on disk (its time and size are checked,
// which is cheap), so anything else writing the files is still seen. Writes
// still go to disk at once, safely (a temporary file, then a rename), so
// nothing is held only in memory. Files are written compact, not indented
// (about half the size). Callers get their own copies of records, so code
// that changes a record it was given can't change the stored data by accident.
const cache = new Map(); // collection -> { mtimeMs, size, records }
const CACHE_MAX_BYTES = Number(process.env.JSON_CACHE_MAX_BYTES) || 25 * 1024 * 1024;
const clone = (x) => (x === null || x === undefined ? x : structuredClone(x));
// What is stored is exactly what the file would give back (dates become text,
// undefined fields go), as before when every read came from the file.
const asStored = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function readCollection(collection) {
  const fp = filePath(collection);
  let st;
  try { st = fs.statSync(fp); } catch (e) { cache.delete(collection); return []; }
  const hit = cache.get(collection);
  // A file changed in the last second is read again anyway: two writes by another
  // program close together can leave the same time and size (some disks keep
  // times only to a few milliseconds).
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size && Date.now() - st.mtimeMs > 1000) return hit.records;
  const raw = fs.readFileSync(fp, 'utf-8').trim();
  const records = raw ? JSON.parse(raw) : [];
  // A very large file is not kept in memory (the Starter server has 512 MB);
  // past that size it is time to move to Postgres (DATABASE_URL).
  if (st.size <= CACHE_MAX_BYTES) cache.set(collection, { mtimeMs: st.mtimeMs, size: st.size, records }); else cache.delete(collection);
  return records;
}

function writeCollection(collection, records) {
  const fp = filePath(collection);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(records));
  fs.renameSync(tmp, fp);
  try { const st = fs.statSync(fp); if (st.size <= CACHE_MAX_BYTES) cache.set(collection, { mtimeMs: st.mtimeMs, size: st.size, records }); else cache.delete(collection); } catch (e) { cache.delete(collection); }
}

const db = {
  async all(collection) {
    return clone(readCollection(collection));
  },
  async find(collection, predicate) {
    return clone(readCollection(collection).find(predicate) || null);
  },
  async filter(collection, predicate) {
    return clone(readCollection(collection).filter(predicate));
  },
  async insert(collection, record) {
    const records = readCollection(collection).slice();
    records.push(asStored(record));
    writeCollection(collection, records);
    return record;
  },
  async update(collection, id, patch) {
    const records = readCollection(collection).slice();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    records[idx] = asStored({ ...records[idx], ...patch, updatedAt: new Date().toISOString() });
    writeCollection(collection, records);
    return clone(records[idx]);
  },
  async remove(collection, id) {
    const records = readCollection(collection);
    const next = records.filter(r => r.id !== id);
    writeCollection(collection, next);
    return next.length !== records.length;
  },
  async replaceAll(collection, records) {
    writeCollection(collection, asStored(records));
  },
};

module.exports = db;
