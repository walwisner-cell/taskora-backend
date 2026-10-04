// v82: a nightly copy of the data files.
//
// Trothen's records live in JSON files in the data folder. Until now there
// was no copy: one bad write, bug or mistaken delete and there was nothing
// to go back to. Once a day this copies every data file into
// <data folder>/backups/<date>/ and keeps the newest 14 days.
//
// What this is NOT: it is on the same disk as the data, so it doesn't
// protect against losing the disk itself. That needs Render's own disk
// snapshots or a copy kept somewhere else. Uploaded photos and ID files
// are not included.
const fs = require('fs');
const path = require('path');

const KEEP_DAYS = 14;
function dataDir() { return process.env.DATA_DIR || path.join(__dirname, '..', 'data'); }
function backupsDir() { return path.join(dataDir(), 'backups'); }

function runBackup(now = new Date()) {
  const src = dataDir();
  const day = now.toISOString().slice(0, 10);
  const dest = path.join(backupsDir(), day);
  fs.mkdirSync(dest, { recursive: true });
  let files = 0, bytes = 0;
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.json')) continue;
    const from = path.join(src, f);
    if (!fs.statSync(from).isFile()) continue;
    fs.copyFileSync(from, path.join(dest, f));
    files += 1; bytes += fs.statSync(from).size;
  }
  // keep the newest KEEP_DAYS folders
  const days = fs.readdirSync(backupsDir()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) {
    fs.rmSync(path.join(backupsDir(), old), { recursive: true, force: true });
  }
  console.log(`[backup] Copied ${files} data files (${Math.round(bytes / 1024)} KB) to backups/${day}.`);
  return { day, files, bytes };
}

function listBackups() {
  let days = [];
  try { days = fs.readdirSync(backupsDir()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse(); } catch (e) { /* none yet */ }
  return days.map(d => {
    const dir = path.join(backupsDir(), d);
    const names = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    return { day: d, files: names.length, bytes: names.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0) };
  });
}

// Only when using the file store. With a database, backups are the database's job.
function backupsApply() { return !process.env.DATABASE_URL; }

module.exports = { runBackup, listBackups, backupsApply, KEEP_DAYS };
