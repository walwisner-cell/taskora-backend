#!/usr/bin/env node
// v178: records Trothen's help videos from the real app, so they always match it.
//
//   node scripts/help-videos/film.js            records every video into public/help/
//   node scripts/help-videos/film.js rides      records only the Rides video
//   node scripts/help-videos/film.js --phone    only the phone versions (or --computer)
//   node scripts/help-videos/film.js --check    records nothing: checks that every step of
//                                               every video can still be done (run with the
//                                               tests; if a screen changed, it says which
//                                               video and which step to record again)
//
// It starts its own copy of Trothen on a throw-away demo database (never the
// real one), signs in as demo people, and does each step the way a person
// would: real taps, real typing, real scrolling, on a phone-sized screen. A
// circle shows each tap and a caption says what to do. The captions are also
// the words shown under each video.
//
// Needs Playwright on the computer that records (not on the server):
//   npm install --no-save playwright && npx playwright install chromium
// and ffmpeg (https://ffmpeg.org) for the MP4 files.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const ONLY = args.filter(a => !a.startsWith('--'));
const OUT = { public: path.join(ROOT, 'public', 'help'), admin: path.join(ROOT, 'help-admin') }; // the team's videos are never on the public site
const LIST = { public: 'help-videos.json', admin: 'admin-help-videos.json' };
const NAME = (f) => (f.group === 'admin' ? `help-admin-${f.key}` : `help-${f.key}`);
const PORT = Number(process.env.FILM_PORT || 3190);
const BASE = `http://localhost:${PORT}`;
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 }; // Admin is used on a computer
// v179: each video for people is recorded twice, on a phone and on a laptop, because
// the screens are laid out differently (a menu at the bottom on a phone, on the left
// on a laptop). The app plays the one for the screen it is on. Admin: computer only.
const DEVICES = (f) => (f.group === 'admin' ? ['computer'] : (f.devices || ['phone', 'computer'])).filter(x => !(args.includes('--phone') && x !== 'phone') && !(args.includes('--computer') && x !== 'computer'));
const FILE = (f, device) => NAME(f) + (f.group !== 'admin' && device === 'computer' ? '-computer' : '');
// On a laptop you click: the same captions, in the words for a mouse.
const FOR_MOUSE = (text) => String(text).replace(/\bTap\b/g, 'Click').replace(/\btap\b/g, 'click').replace(/\bTapping\b/g, 'Clicking').replace(/\btapping\b/g, 'clicking').replace(/\btaps\b/g, 'clicks');

// A throw-away database and uploads folder for the demo.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trothen-film-'));
process.env.DATA_DIR = path.join(TMP, 'data');
process.env.UPLOADS_DIR = path.join(TMP, 'uploads');
process.env.PRIVATE_UPLOADS_DIR = path.join(TMP, 'private');
process.env.TROTHEN_JWT_SECRET = process.env.TROTHEN_JWT_SECRET || 'film_' + Math.random().toString(36).slice(2) + '_secret_secret';
delete process.env.DATABASE_URL; // never the real database
for (const d of [process.env.DATA_DIR, process.env.UPLOADS_DIR, process.env.PRIVATE_UPLOADS_DIR]) fs.mkdirSync(d, { recursive: true });

let playwright;
try { playwright = require('playwright'); } catch (e) {
  console.error('Playwright is needed to record the help videos:\n  npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}
const narrate = require('./narrate');
const VOICE = CHECK || args.includes('--no-voice') ? { ok: false, why: 'switched off' } : narrate.available();
const FLOWS = require(process.env.FILM_FLOWS ? path.resolve(process.env.FILM_FLOWS) : './flows');

// The caption bar and the tap circle, drawn over the real page (they never catch a tap).
const OVERLAY = `(() => {
  const css = '#film-cap{position:fixed;left:12px;right:12px;bottom:84px;z-index:2147483647;pointer-events:none;background:rgba(15,38,64,.94);color:#fff;font:600 19px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px 16px;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.3);opacity:0;transform:translateY(12px);transition:opacity .25s,transform .25s}' +
    '#film-cap.on{opacity:1;transform:none}#film-cap b{color:#F2B705;font-weight:800;margin-right:6px}' +
    '.film-ring{position:fixed;z-index:2147483646;pointer-events:none;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:5px solid #F2B705;background:rgba(242,183,5,.28);box-shadow:0 0 0 3px rgba(15,38,64,.55);animation:filmRing 1s ease-out infinite}' +
    '@keyframes filmRing{0%{transform:scale(.55);opacity:1}100%{transform:scale(1.35);opacity:.15}}' +
    '@media (min-width:900px){#film-cap{left:50%;right:auto;bottom:28px;transform:translate(-50%,12px);max-width:900px;font-size:22px}#film-cap.on{transform:translate(-50%,0)}}';
  const add = () => {
    if (document.getElementById('film-cap')) return;
    const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s);
    const c = document.createElement('div'); c.id = 'film-cap'; document.documentElement.appendChild(c);
  };
  window.__film = {
    caption(n, text) { add(); const c = document.getElementById('film-cap'); c.innerHTML = (n ? '<b>' + n + '</b>' : '') + text.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); c.classList.add('on'); },
    hide() { const c = document.getElementById('film-cap'); if (c) c.classList.remove('on'); },
    ring(x, y) { add(); const r = document.createElement('div'); r.className = 'film-ring'; r.style.left = x + 'px'; r.style.top = y + 'px'; document.documentElement.appendChild(r); return true; },
    unring() { document.querySelectorAll('.film-ring').forEach(r => r.remove()); },
  };
  document.addEventListener('DOMContentLoaded', add);
})();`;

class StepError extends Error {}
let TILE = null;
async function blankTile() {
  if (TILE) return TILE;
  try { TILE = await require('sharp')(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#EEF0EA"/><path d="M0 90H256M0 200H256M70 0V256M190 0V256" stroke="#FFFFFF" stroke-width="9"/><path d="M0 30L256 160" stroke="#FFFFFF" stroke-width="6"/></svg>')).png().toBuffer(); }
  catch (e) { TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8+/9/PQAI8wNPYl1jQAAAAABJRU5ErkJggg==', 'base64'); }
  return TILE;
}

// One video being recorded (or checked).
function director(page, key, desk) {
  const lines = []; let n = 0;
  const voice = []; let speakUntil = 0; // the spoken lines, and when the current one ends
  const wait = (ms) => (CHECK ? Promise.resolve() : page.waitForTimeout(ms));
  async function find(sel) {
    const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
    try { await loc.waitFor({ state: 'visible', timeout: 8000 }); }
    catch (e) {
      if (process.env.FILM_DUMP) console.error((await page.evaluate(() => [...document.querySelectorAll('button, a, input, select, textarea, [onclick], [role=button], [role=tab], h1, h2, h3, .dash-title')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }).slice(0, 90).map(el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} ${(el.getAttribute('onclick') || '').slice(0, 50)} | ${(el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50)}`).join('\n'))));
      throw new StepError(`"${key}" video${desk ? ' (laptop)' : ''}, step ${n}: can't find ${typeof sel === 'string' ? sel : 'the element'} on the screen. The screen has changed: update scripts/help-videos/flows.js and record this video again.`); }
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
    // repaint the whole screen after a scroll (a fixed side menu can otherwise be recorded half-drawn)
    await page.evaluate(() => new Promise(res => { const h = document.documentElement; h.style.transform = 'translateZ(0)'; requestAnimationFrame(() => requestAnimationFrame(() => { h.style.transform = ''; res(); })); })).catch(() => {});
    return loc;
  }
  async function caption(text, numbered) {
    if (desk) text = FOR_MOUSE(text);
    lines.push(text);
    if (VOICE.ok) { const v = await narrate.say(text); voice.push({ file: v.file, wall: Date.now() / 1000 }); speakUntil = Date.now() + v.seconds * 1000 + 300; }
    await page.evaluate(([a, b]) => window.__film && window.__film.caption(a, b), [numbered ? `${n}.` : '', text]).catch(() => {});
  }
  async function ringOn(loc) {
    const b = await loc.boundingBox(); if (!b) return;
    await page.evaluate(([x, y]) => window.__film && window.__film.ring(x, y), [b.x + b.width / 2, b.y + b.height / 2]).catch(() => {});
  }
  const unring = () => page.evaluate(() => window.__film && window.__film.unring()).catch(() => {});
  // let the narrator finish the sentence before the next thing happens
  const talk = () => (CHECK || !VOICE.ok ? Promise.resolve() : page.waitForTimeout(Math.max(0, speakUntil - Date.now())));
  return {
    lines,
    voice,
    page,
    wait,
    desk: !!desk, // on a laptop (the menu is on the left), not a phone (the menu is at the bottom)
    // a caption on its own (what this screen is, or a tip)
    async say(text, ms = 2600) { n++; await caption(text, false); n--; await wait(ms); await talk(); },
    // tap something: a circle shows where, then it's tapped for real
    async tap(sel, text, ms = 1400) { n++; const loc = await find(sel); await caption(text, true); await wait(500); await ringOn(loc); await wait(ms); await talk(); await unring(); await loc.click(); await wait(1100); },
    // type into a box, letter by letter
    async type(sel, value, text) { n++; const loc = await find(sel); await caption(text, true); await ringOn(loc); await wait(900); await unring(); await loc.click(); await loc.fill(''); await loc.pressSequentially(value, { delay: CHECK ? 0 : 65 }); await wait(700); await talk(); },
    // add a photo: the button is shown being tapped, and the demo photo is given to the file picker
    async files(button, input, file, text) { n++; const loc = await find(button); await caption(text, true); await ringOn(loc); await wait(1300); await unring(); await page.setInputFiles(input, file); await wait(1400); await talk(); },
    // choose from a list
    async choose(sel, value, text) { n++; const loc = await find(sel); await caption(text, true); await ringOn(loc); await wait(1200); await unring(); await loc.selectOption(value); await wait(800); await talk(); },
    // point at something without tapping it
    async show(sel, text, ms = 2600) { n++; const loc = await find(sel); await caption(text, true); await ringOn(loc); await wait(ms); await talk(); await unring(); },
    // bring something into view, slowly
    async scrollTo(sel, ms = 900) { const loc = await find(sel); await wait(ms); return loc; },
    // a step done by the app itself (opening a screen the way a link would)
    async run(fn, arg) { await page.evaluate(fn, arg); await wait(1200); },
    hide: () => page.evaluate(() => window.__film && window.__film.hide()).catch(() => {}),
    // (while writing a video) list what can be tapped on this screen
    async dump(label) { console.log('--- ' + (label || 'screen')); console.log(await page.evaluate(() => [...document.querySelectorAll('button, a, input, select, textarea, [onclick], [role=button], [role=tab], h1, h2, h3, .dash-title, label')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }).slice(0, 140).map(el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} ${(el.getAttribute('onclick') || '').slice(0, 50)} | ${(el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50)}`).join('\n'))); },
  };
}

async function startServer() {
  // another copy already on this port (an earlier recording that was stopped) would be recorded instead
  try { await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(1500) }); throw new Error(`Something is already running on port ${PORT}. Stop it (or set FILM_PORT to another port) and start again.`); }
  catch (e) { if (/already running/.test(e.message)) throw e; }
  const seed = require(path.join(ROOT, 'src', 'seed.js'));
  if (typeof seed.seedDatabase === 'function') await seed.seedDatabase();
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), FILM: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  // if the recording is stopped, the demo copy of Trothen stops with it
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { try { srv.kill(); } catch (e) {} process.exit(130); });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok || r.status < 500) return srv; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  console.error(log.slice(-2000)); throw new Error('Trothen did not start');
}

(async () => {
  if (!CHECK && !VOICE.ok) console.log(`Recording without narration: ${VOICE.why}.`);
  if (VOICE.ok) await narrate.warm(); // the voice loaded before the first video starts
  const srv = await startServer();
  const demo = require('./demo');
  await demo.prepare(ROOT);
  const browser = await playwright.chromium.launch();
  const meta = []; let failed = 0;
  const flows = FLOWS.filter(f => !ONLY.length || ONLY.includes(f.key));
  const vids = path.join(TMP, 'video'); fs.mkdirSync(vids, { recursive: true });
  const jobs = []; for (const f of flows) for (const device of DEVICES(f)) jobs.push({ f, device });
  for (const { f, device } of jobs) {
    const desk = device === 'computer';
    const label = f.key + (f.group !== 'admin' && desk ? ' (laptop)' : '');
    const screen = desk ? DESK : PHONE;
    const ctx = await browser.newContext({ viewport: screen, deviceScaleFactor: desk ? 1 : 2, ...(desk ? {} : { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }), locale: 'en-US', geolocation: demo.MONROVIA, permissions: ['geolocation'] });
    // Map pictures: the real ones when this computer is online; a plain light tile when it isn't.
    await ctx.route(/tile\.openstreetmap|arcgisonline|basemaps\.cartocdn|\/tiles?\//, async (r) => {
      try { const resp = await r.fetch({ timeout: 4000 }); if (resp.ok()) return r.fulfill({ response: resp }); } catch (e) { /* offline */ }
      return r.fulfill({ status: 200, contentType: 'image/png', body: await blankTile() });
    });
    await ctx.addInitScript(OVERLAY);
    await ctx.addInitScript(([tk]) => { try { localStorage.setItem('trothen_install_dismissed', '1'); if (tk) localStorage.setItem('trothen_session_token', tk); } catch (e) {} }, [f.as ? await demo.token(f.as) : null]);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', x => errs.push(x.message));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => { const b = document.getElementById('test-mode-banner'); if (b) b.style.display = 'none'; });
    if (f.start) { await page.evaluate(f.start); await page.waitForTimeout(1500); }
    const d = director(page, f.key, desk);
    // Record the screen at full sharpness (a phone's screen at 2x), frame by frame as it changes.
    let rec = null;
    if (!CHECK) {
      const cdp = await ctx.newCDPSession(page);
      const fdir = path.join(vids, f.key + '-' + device); fs.mkdirSync(fdir, { recursive: true });
      rec = { cdp, fdir, frames: [] };
      cdp.on('Page.screencastFrame', (ev) => {
        const file = path.join(fdir, `f${String(rec.frames.length).padStart(6, '0')}.jpg`);
        fs.writeFileSync(file, Buffer.from(ev.data, 'base64'));
        rec.frames.push({ t: ev.metadata.timestamp, file });
        cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: desk ? DESK.width : PHONE.width * 2, maxHeight: desk ? DESK.height : PHONE.height * 2, everyNthFrame: 1 });
      await page.waitForTimeout(300);
    }
    let ok = true;
    try { await f.steps(d); await d.wait(1200); }
    catch (e) { ok = false; failed++; console.error((e instanceof StepError ? '' : `"${label}" video: `) + e.message.split('\n')[0]); }
    if (errs.length) { ok = false; failed++; console.error(`"${label}" video: the page had an error: ${errs[0]}`); }
    let endT = Date.now() / 1000;
    if (rec) { await page.waitForTimeout(400); endT = Date.now() / 1000; await rec.cdp.send('Page.stopScreencast').catch(() => {}); }
    await ctx.close();
    if (CHECK) { if (ok) console.log(`ok   ${label} (${d.lines.length} steps)`); continue; }
    if (!ok) continue;
    if (!rec || rec.frames.length < 2) { failed++; console.error(`"${label}" video: nothing was recorded`); continue; }
    // each picture is shown until the next one (the screen only sends a picture when it changes)
    const list = path.join(rec.fdir, 'list.txt');
    fs.writeFileSync(list, rec.frames.map((fr, i) => `file '${fr.file}'\nduration ${Math.max(0.001, ((rec.frames[i + 1] ? rec.frames[i + 1].t : endT) - fr.t)).toFixed(3)}`).join('\n') + `\nfile '${rec.frames[rec.frames.length - 1].file}'\n`);
    const dir = OUT[f.group === 'admin' ? 'admin' : 'public'];
    const mp4 = path.join(dir, `${FILE(f, device)}.mp4`), tmp = mp4.replace(/\.mp4$/, '.tmp.mp4');
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', desk ? 'fps=30,scale=1280:-2' : 'fps=30,scale=720:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', tmp]);
    fs.renameSync(tmp, mp4);
    if (d.voice.length) { // the narration, each line where its caption appeared
      const t0 = rec.frames[0].t, withSound = mp4.replace(/\.mp4$/, '.voice.mp4');
      narrate.addSound(mp4, d.voice.map(v => ({ file: v.file, at: v.wall - t0 })), withSound);
      fs.renameSync(withSound, mp4);
    }
    const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim());
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(3, secs / 3)), '-i', mp4, '-frames:v', '1', '-vf', desk ? 'scale=640:400:force_original_aspect_ratio=decrease,pad=640:400:(ow-iw)/2:(oh-ih)/2:color=0x0F2640' : 'scale=-2:380,pad=640:400:(ow-iw)/2:(oh-ih)/2:color=0x0F2640', '-q:v', '4', path.join(dir, `${FILE(f, device)}.jpg`)]);
    const take = { file: FILE(f, device), seconds: Math.round(secs), transcript: d.lines.filter((x, i, a) => a.indexOf(x) === i) };
    const g = f.group === 'admin' ? 'admin' : 'public';
    let m = meta.find(x => x.group === g && x.key === f.key);
    if (!m) { m = { group: g, key: f.key, title: f.title, tagline: f.tagline, ...(f.topic ? { topic: f.topic } : {}), audience: f.audience || 'all', ...(f.section ? { section: f.section } : {}) }; meta.push(m); }
    if (g === 'public' && desk) m.computer = take; else Object.assign(m, take);
    console.log(`recorded ${label}: ${Math.round(secs)} s, ${d.lines.length} steps`);
  }
  await browser.close();
  narrate.stop();
  srv.kill();
  if (!CHECK && meta.length) for (const g of ['public', 'admin']) { // keep the order of flows.js; keep videos not recorded this time
    const file = path.join(OUT[g], LIST[g]);
    let old = []; try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
    const all = FLOWS.filter(f => (f.group === 'admin' ? 'admin' : 'public') === g).map(f => {
      const now = meta.find(m => m.group === g && m.key === f.key), was = old.find(m => m.key === f.key);
      if (!now) return was;
      const m = { ...(was || {}), ...now }; // a video recorded on one device only keeps the other one from before
      if (!now.file && was) { m.file = was.file; m.seconds = was.seconds; m.transcript = was.transcript; }
      if (!now.computer && was && was.computer) m.computer = was.computer;
      return m.file ? m : null;
    }).filter(Boolean).map(({ group, ...m }) => m);
    // v182: keep subjects that have only an animated explainer (no screen recording)
    for (const was of old) if (was.explainer && !all.some(m => m.key === was.key)) all.push(was);
    if (all.length) { fs.mkdirSync(OUT[g], { recursive: true }); fs.writeFileSync(file, JSON.stringify(all, null, 1) + '\n'); }
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  if (failed) { console.error(`${failed} video(s) need attention.`); process.exit(1); }
  console.log(CHECK ? 'Every help video still matches the app.' : 'Done.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
