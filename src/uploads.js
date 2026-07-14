// Where uploaded files (portfolio photos, and anything similar later) live
// on disk. Independent of which datastore backend is active (JSON files or
// Postgres) — Postgres stores data, not files, so uploads always need real
// disk (or, at larger scale, cloud blob storage like S3) regardless of that
// choice.
//
// On Render, point UPLOADS_DIR at the same mounted persistent disk used for
// DATA_DIR so uploaded photos survive redeploys, same principle as the JSON
// datastore. If this app ever runs on infrastructure without a persistent
// disk (or across multiple server instances), this is the file to replace
// with an S3-compatible client — nothing else needs to change, since routes
// only ever call the functions this module exports.
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? process.env.UPLOADS_DIR
  : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

module.exports = { UPLOADS_DIR };
