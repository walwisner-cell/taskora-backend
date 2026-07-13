// Lightweight JSON-file datastore.
//
// This gives Taskora real, persisted, multi-user data without requiring a
// native database driver to compile on the developer's machine — every
// collection is just a JSON file under /data, read fresh and written
// atomically on every mutation. It is deliberately simple so it's easy to
// read and swap out later.
//
// For production, swap this module for a real database (Postgres via
// Prisma/Knex is the recommended path — see README "Going to production").
// Because every route only talks to db.js's methods (never to the files
// directly), that swap does not require touching route code.

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
  all(collection) {
    return readCollection(collection);
  },
  find(collection, predicate) {
    return readCollection(collection).find(predicate) || null;
  },
  filter(collection, predicate) {
    return readCollection(collection).filter(predicate);
  },
  insert(collection, record) {
    const records = readCollection(collection);
    records.push(record);
    writeCollection(collection, records);
    return record;
  },
  update(collection, id, patch) {
    const records = readCollection(collection);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...patch, updatedAt: new Date().toISOString() };
    writeCollection(collection, records);
    return records[idx];
  },
  remove(collection, id) {
    const records = readCollection(collection);
    const next = records.filter(r => r.id !== id);
    writeCollection(collection, next);
    return next.length !== records.length;
  },
  replaceAll(collection, records) {
    writeCollection(collection, records);
  },
};

module.exports = db;
