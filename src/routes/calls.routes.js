// v136/v137: in-app voice and video calls, and voice messages, between a
// customer and a pro.
//
// The call itself goes straight between the two browsers (WebRTC, built into
// every modern browser); the sound and picture do not pass through Trothen.
// This server only introduces the two sides: it rings the other person
// through their open live connection (src/live.js) and passes the technical
// "how to reach me" notes between them. No phone numbers are shared, and
// calls are never recorded.
//
// v137 rules (the way the big marketplaces do it):
//   - Call window. A customer and a pro can call each other while they have
//     something going on together (an open booking, an open job they're
//     talking about, or a conversation where both have written in the last
//     7 days), and for 7 days after a booking ends. Not forever.
//   - Block. Either side can block the other: no calls and no voice
//     messages from them. Text messages still work, so a booking can be
//     finished and the record stays complete for disputes.
//   - Spam limits. At most 3 unanswered calls to the same person in an
//     hour, and at most 20 calls started in an hour.
//   - Call hours. Each person chooses whether they take calls at all, and
//     optionally the hours and days they take them (in their own time
//     zone). Outside those hours the caller is offered a voice message.
//   - Voice messages. Recorded in the browser, up to 2 minutes, kept in the
//     private folder (never public), encrypted on disk when
//     ID_FILE_ENCRYPTION_KEY is set, and only the two people can play them.
//
// Reaching each other: most connections work with the free public STUN
// server below. Some networks (strict office Wi-Fi, some mobile carriers)
// need a relay (TURN) server. Set TURN_URLS, TURN_USERNAME and
// TURN_CREDENTIAL on Render to add one; without it a small share of calls
// will not connect and the person is told so.
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../auth');
const { notify } = require('../notify');
const live = require('../live');

const router = express.Router();
const RING_MS = (Number(process.env.CALL_RING_SECONDS) || 45) * 1000; // how long a call rings before it counts as missed
const MAX_SIGNAL = 20000;      // a connection note is a few KB; anything bigger is refused
const DAY = 24 * 3600 * 1000;
const WINDOW_DAYS = 7;         // calls stay possible this long after a booking or conversation
const MAX_UNANSWERED_PER_HOUR = 3;
const MAX_CALLS_PER_HOUR = 20;
const VOICE_MAX_SECONDS = 120;
const VOICE_MAX_BYTES = 3 * 1024 * 1024;

const nameOf = (u) => (u && u.name) || 'Someone';
const firstName = (u) => String(nameOf(u)).split(' ')[0];
const publicPerson = (u) => ({ id: u.id, name: nameOf(u), role: u.role, profilePhotoUrl: u.profilePhotoUrl || null, initials: u.initials || null, color: u.color || null });
const recent = (iso, days = WINDOW_DAYS) => !!iso && Date.now() - Date.parse(iso) < days * DAY;
const ENDED_CONTRACT = ['completed', 'cancelled', 'declined', 'refunded', 'released', 'closed', 'expired'];
const CLOSED_JOB = ['closed', 'cancelled', 'expired', 'completed', 'deleted'];

// Do these two people have something together? (any time, ever)
async function connected(a, b) {
  if (!a || !b || a.id === b.id) return false;
  // v139: a buyer and a seller with a Market order between them, whatever their roles.
  const pairOrder = await db.find('contracts', c => c.storeOrder === true && ((c.customerId === a.id && c.providerId === b.id) || (c.customerId === b.id && c.providerId === a.id)));
  if (pairOrder) return true;
  const roles = new Set([a.role, b.role]);
  if (!(roles.has('customer') && roles.has('provider'))) return false;
  const cust = a.role === 'customer' ? a : b, pro = a.role === 'provider' ? a : b;
  if (await db.find('contracts', c => c.customerId === cust.id && c.providerId === pro.id)) return true;
  if (await db.find('matches', m => m.customerId === cust.id && m.providerId === pro.id)) return true;
  if (await db.find('messages', m => (m.fromId === a.id && m.toId === b.id) || (m.fromId === b.id && m.toId === a.id))) return true;
  return false;
}

// v137: is there something going on between them right now (or recently)?
async function inCallWindow(a, b) {
  if (!(await connected(a, b))) return false;
  // v139: a Market order between them, open or ended in the last 7 days.
  const orders = await db.filter('contracts', c => c.storeOrder === true && ((c.customerId === a.id && c.providerId === b.id) || (c.customerId === b.id && c.providerId === a.id)));
  if (orders.some(c => !ENDED_CONTRACT.includes(c.status) || recent(c.updatedAt || c.createdAt))) return true;
  if (!((a.role === 'customer' && b.role === 'provider') || (a.role === 'provider' && b.role === 'customer'))) return false;
  const cust = a.role === 'customer' ? a : b, pro = a.role === 'provider' ? a : b;
  const contracts = await db.filter('contracts', c => c.customerId === cust.id && c.providerId === pro.id);
  if (contracts.some(c => !ENDED_CONTRACT.includes(c.status) || recent(c.updatedAt || c.createdAt))) return true;
  const matches = await db.filter('matches', m => m.customerId === cust.id && m.providerId === pro.id);
  for (const m of matches) {
    if (recent(m.updatedAt || m.createdAt)) return true;
    const job = m.jobId ? await db.find('jobs', j => j.id === m.jobId) : null;
    if (job && !CLOSED_JOB.includes(job.status) && !['not_selected', 'declined'].includes(m.status)) return true;
  }
  // A conversation where both have written in the last 7 days.
  const msgs = await db.filter('messages', m => ((m.fromId === a.id && m.toId === b.id) || (m.fromId === b.id && m.toId === a.id)) && m.kind !== 'call' && recent(m.createdAt));
  return msgs.some(m => m.fromId === a.id) && msgs.some(m => m.fromId === b.id);
}

const blocked = async (blockerId, blockedId) => !!(await db.find('callBlocks', x => x.blockerId === blockerId && x.blockedId === blockedId));

// ── call settings (each person's own) ────────────────────────────────────
const DEFAULT_SETTINGS = { calls: true, voice: true, hours: { on: false, from: '08:00', to: '20:00', days: [0, 1, 2, 3, 4, 5, 6] }, tz: null };
function settingsOf(u) {
  const s = (u && u.callSettings) || {};
  return { ...DEFAULT_SETTINGS, ...s, hours: { ...DEFAULT_SETTINGS.hours, ...(s.hours || {}) } };
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
function validTz(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } }
// Is it inside their call hours right now (their own time zone)?
function withinHours(s, now = new Date()) {
  if (!s.hours || !s.hours.on) return true;
  let day, hm;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: s.tz && validTz(s.tz) ? s.tz : 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
    day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    hm = `${String(parts.hour).padStart(2, '0')}:${parts.minute}`;
  } catch (e) { return true; }
  if (!(s.hours.days || []).includes(day)) return false;
  const { from, to } = s.hours;
  return from <= to ? (hm >= from && hm < to) : (hm >= from || hm < to); // e.g. 20:00 to 02:00 crosses midnight
}
function hoursText(s) {
  const f = (x) => { const [h, m] = x.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`; };
  const d = s.hours.days || [];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = d.length === 7 ? 'every day' : (d.join() === '1,2,3,4,5' ? 'Monday to Friday' : d.map(i => names[i]).join(', '));
  return `${f(s.hours.from)} to ${f(s.hours.to)}, ${days} (their time)`;
}

router.get('/calls/settings', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const blocks = await db.filter('callBlocks', x => x.blockerId === req.user.sub);
  const people = [];
  for (const b of blocks) { const u = await db.find('users', x => x.id === b.blockedId); people.push({ userId: b.blockedId, name: u ? nameOf(u) : 'Former member', at: b.createdAt }); }
  res.json({ settings: settingsOf(me), blocked: people });
});

router.put('/calls/settings', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'Account not found' });
  const b = req.body || {};
  const cur = settingsOf(me);
  const next = { ...cur };
  if ('calls' in b) { if (typeof b.calls !== 'boolean') return res.status(400).json({ error: 'calls must be true or false' }); next.calls = b.calls; }
  if ('voice' in b) { if (typeof b.voice !== 'boolean') return res.status(400).json({ error: 'voice must be true or false' }); next.voice = b.voice; }
  // v140: chosen sounds (made in the browser; see public/app/sounds.js)
  if ('ringtone' in b) { if (!['classic', 'marimba', 'chime', 'pulse', 'soft', 'digital', 'silent'].includes(b.ringtone)) return res.status(400).json({ error: 'Unknown ringtone' }); next.ringtone = b.ringtone; }
  if ('alertTone' in b) { if (!['triple', 'ding', 'pop', 'chime', 'soft', 'none'].includes(b.alertTone)) return res.status(400).json({ error: 'Unknown alert sound' }); next.alertTone = b.alertTone; }
  if ('tz' in b) { if (b.tz !== null && !(typeof b.tz === 'string' && validTz(b.tz))) return res.status(400).json({ error: 'Unknown time zone' }); next.tz = b.tz; }
  if ('hours' in b) {
    const h = b.hours || {};
    if (typeof h.on !== 'boolean') return res.status(400).json({ error: 'hours.on must be true or false' });
    if (!HHMM.test(h.from || '') || !HHMM.test(h.to || '')) return res.status(400).json({ error: 'Times must look like 08:00' });
    if (h.from === h.to) return res.status(400).json({ error: 'The start and end time must be different' });
    const days = Array.isArray(h.days) ? [...new Set(h.days.map(Number))].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort() : [];
    if (h.on && !days.length) return res.status(400).json({ error: 'Choose at least one day' });
    next.hours = { on: h.on, from: h.from, to: h.to, days };
  }
  await db.update('users', me.id, { callSettings: next });
  res.json({ settings: next });
});

// Block / unblock someone: no calls and no voice messages from them.
router.post('/calls/block', requireAuth, async (req, res) => {
  const { userId } = req.body || {};
  const them = await db.find('users', u => u.id === userId);
  if (!them || userId === req.user.sub) return res.status(404).json({ error: 'This person could not be found.' });
  if (!(await blocked(req.user.sub, userId))) await db.insert('callBlocks', { id: `cb_${nanoid(10)}`, blockerId: req.user.sub, blockedId: userId, createdAt: new Date().toISOString() });
  // A call ringing between them stops.
  for (const c of await db.filter('calls', c => ['ringing', 'active'].includes(c.status) && ((c.fromId === userId && c.toId === req.user.sub) || (c.fromId === req.user.sub && c.toId === userId)))) {
    await finish(c, 'ended');
    live.sendEvent(c.fromId, 'call', { type: 'ended', callId: c.id }); live.sendEvent(c.toId, 'call', { type: 'ended', callId: c.id });
  }
  res.json({ ok: true, blocked: true });
});
router.delete('/calls/block/:userId', requireAuth, async (req, res) => {
  for (const b of await db.filter('callBlocks', x => x.blockerId === req.user.sub && x.blockedId === req.params.userId)) await db.remove('callBlocks', b.id);
  res.json({ ok: true, blocked: false });
});

// Can I call (or leave a voice message for) this person? Used before the
// call screen opens, so the person is told why straight away.
async function reachCheck(me, them, kind) {
  if (!me || !them || them.active === false || them.closedAt) return { status: 404, code: 'NOT_FOUND', error: 'This person could not be found.' };
  if (!(await connected(me, them))) return { status: 403, code: 'NOT_CONNECTED', error: kind === 'voice' ? 'You can send voice messages once you have a booking, a job response or a conversation with them.' : 'You can call someone once you have a booking, a job response or a conversation with them.' };
  if (await blocked(them.id, me.id)) return { status: 403, code: 'BLOCKED', error: `${firstName(them)} isn't taking calls or voice messages from you. You can still send a text message.` };
  if (await blocked(me.id, them.id)) return { status: 403, code: 'YOU_BLOCKED', error: `You blocked ${firstName(them)}. Unblock them in Settings → Calls & Voice Messages to call or send voice messages.` };
  if (!(await inCallWindow(me, them))) return { status: 403, code: 'OUTSIDE_WINDOW', error: `Calls and voice messages are open while you have a booking or job together, and for ${WINDOW_DAYS} days after. Send ${firstName(them)} a text message instead.` };
  const s = settingsOf(them);
  if (kind === 'voice') {
    if (!s.voice) return { status: 409, code: 'NO_VOICE', error: `${firstName(them)} doesn't take voice messages. Send a text message instead.` };
    return null;
  }
  if (!s.calls) return { status: 409, code: 'NO_CALLS', error: `${firstName(them)} doesn't take calls on Trothen.`, voiceOk: s.voice };
  if (!withinHours(s)) return { status: 409, code: 'OUTSIDE_HOURS', error: `${firstName(them)} takes calls ${hoursText(s)}.`, voiceOk: s.voice };
  return null;
}

router.get('/calls/can-reach/:userId', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const them = await db.find('users', u => u.id === req.params.userId);
  const call = await reachCheck(me, them, 'call');
  const voice = await reachCheck(me, them, 'voice');
  res.json({ call: call ? { ok: false, code: call.code, error: call.error } : { ok: true }, voice: voice ? { ok: false, code: voice.code, error: voice.error } : { ok: true } });
});

const isBusy = async (userId) => !!(await db.find('calls', c => (c.fromId === userId || c.toId === userId) && (c.status === 'ringing' || c.status === 'active')));

function mmss(ms) { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// A line in the conversation, so both see the call in their chat history.
async function logToChat(call, text) {
  try { await db.insert('messages', { id: `msg_${nanoid(10)}`, fromId: call.fromId, toId: call.toId, text, kind: 'call', callId: call.id, jobId: null, createdAt: new Date().toISOString() }); } catch (e) { /* never break a call over the log */ }
}

async function finish(call, status, extra = {}) {
  const now = new Date().toISOString();
  const updated = await db.update('calls', call.id, { status, endedAt: now, ...extra });
  const kind = call.video ? 'Video call' : 'Voice call';
  if (status === 'ended' && call.answeredAt) await logToChat(updated, `${kind} · ${mmss(Date.parse(now) - Date.parse(call.answeredAt))}`);
  else if (status === 'missed' || (status === 'ended' && !call.answeredAt)) {
    await logToChat(updated, `Missed ${kind.toLowerCase()}`);
    const caller = await db.find('users', u => u.id === call.fromId);
    await notify(call.toId, '📞', `Missed ${kind.toLowerCase()} from ${nameOf(caller)}`, 'messages', { section: 'messages', contactId: call.fromId });
  } else if (status === 'declined') await logToChat(updated, `${kind} declined`);
  return updated;
}

// GET /api/calls/ice-servers — how the browsers find each other.
// v140: a relay (TURN) can come from fixed settings (TURN_URLS,
// TURN_USERNAME, TURN_CREDENTIAL) or from a provider's credentials link
// (TURN_API_URL, for example Metered's free Open Relay:
// https://<yourapp>.metered.live/api/v1/turn/credentials?apiKey=<key>).
// The link's answer is kept for 30 minutes.
let turnCache = { at: 0, servers: [] };
async function turnFromApi() {
  const url = String(process.env.TURN_API_URL || '').trim();
  if (!/^https:\/\//.test(url)) return [];
  if (Date.now() - turnCache.at < 30 * 60 * 1000 && turnCache.servers.length) return turnCache.servers;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t);
    const j = await r.json();
    const list = (Array.isArray(j) ? j : (j && j.iceServers) || []).filter(s => s && s.urls).slice(0, 8);
    if (list.length) turnCache = { at: Date.now(), servers: list };
    return list;
  } catch (e) { console.error('[calls] TURN_API_URL failed:', e.message); return turnCache.servers; }
}
async function iceServerList() {
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const turn = String(process.env.TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (turn.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) iceServers.push({ urls: turn, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  iceServers.push(...(await turnFromApi()));
  return iceServers;
}
router.get('/calls/ice-servers', requireAuth, async (req, res) => {
  const iceServers = await iceServerList();
  res.json({ iceServers, relay: iceServers.some(s => [].concat(s.urls || []).some(u => /^turns?:/.test(String(u)))) });
});

// POST /api/calls { toUserId, video } — ring someone.
router.post('/calls', requireAuth, async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const { toUserId, video } = req.body || {};
  const them = await db.find('users', u => u.id === toUserId);
  const no = await reachCheck(me, them, 'call');
  if (no) return res.status(no.status).json({ code: no.code, error: no.error, voiceOk: !!no.voiceOk });
  // Spam limits.
  const hourAgo = Date.now() - 3600 * 1000;
  const mineLastHour = await db.filter('calls', c => c.fromId === me.id && Date.parse(c.createdAt) > hourAgo);
  if (mineLastHour.length >= MAX_CALLS_PER_HOUR) return res.status(429).json({ code: 'TOO_MANY', error: 'You have made a lot of calls in the last hour. Please wait a little before calling again.' });
  const unanswered = mineLastHour.filter(c => c.toId === them.id && !c.answeredAt && ['missed', 'declined', 'ended'].includes(c.status));
  if (unanswered.length >= MAX_UNANSWERED_PER_HOUR) return res.status(429).json({ code: 'TOO_MANY_TO_THEM', voiceOk: settingsOf(them).voice, error: `${firstName(them)} hasn't answered your last ${MAX_UNANSWERED_PER_HOUR} calls. Leave a voice message or a text, and they can call you back.` });
  if (await isBusy(me.id)) return res.status(409).json({ code: 'YOU_BUSY', error: 'You are already in a call.' });
  if (await isBusy(them.id)) return res.status(409).json({ code: 'BUSY', voiceOk: settingsOf(them).voice, error: `${firstName(them)} is on another call. Try again in a few minutes, or leave a voice message.` });
  const call = { id: `call_${nanoid(12)}`, fromId: me.id, toId: them.id, video: video === true, status: 'ringing', createdAt: new Date().toISOString() };
  await db.insert('calls', call);
  const reached = live.sendEvent(them.id, 'call', { type: 'ring', callId: call.id, video: call.video, from: publicPerson(me) });
  if (!reached) {
    // Not on Trothen right now: a notification (and a phone push, where set up).
    await notify(them.id, '📞', `${nameOf(me)} is calling you. Open Trothen to answer.`, 'messages', { section: 'messages', contactId: me.id });
  }
  res.status(201).json({ call: { id: call.id, video: call.video, to: publicPerson(them) }, ringing: reached > 0, voiceOk: settingsOf(them).voice });
});

async function mine(req, res) {
  const call = await db.find('calls', c => c.id === req.params.id && (c.fromId === req.user.sub || c.toId === req.user.sub));
  if (!call) { res.status(404).json({ error: 'Call not found.' }); return null; }
  return call;
}
const other = (call, me) => (call.fromId === me ? call.toId : call.fromId);

// POST /api/calls/:id/accept — the person being called answers.
router.post('/calls/:id/accept', requireAuth, async (req, res) => {
  const call = await mine(req, res); if (!call) return;
  if (call.toId !== req.user.sub) return res.status(403).json({ error: 'Only the person being called can answer.' });
  if (call.status !== 'ringing') return res.status(409).json({ code: 'GONE', error: 'This call has ended.' });
  await db.update('calls', call.id, { status: 'active', answeredAt: new Date().toISOString() });
  live.sendEvent(call.fromId, 'call', { type: 'accepted', callId: call.id });
  // Other open pages of the same person stop ringing.
  live.sendEvent(call.toId, 'call', { type: 'answered-elsewhere', callId: call.id });
  res.json({ ok: true });
});

// POST /api/calls/:id/decline
router.post('/calls/:id/decline', requireAuth, async (req, res) => {
  const call = await mine(req, res); if (!call) return;
  if (call.status !== 'ringing') return res.json({ ok: true });
  await finish(call, call.toId === req.user.sub ? 'declined' : 'ended');
  live.sendEvent(other(call, req.user.sub), 'call', { type: call.toId === req.user.sub ? 'declined' : 'ended', callId: call.id });
  live.sendEvent(req.user.sub, 'call', { type: 'ended', callId: call.id });
  res.json({ ok: true });
});

// POST /api/calls/:id/end — either side hangs up.
router.post('/calls/:id/end', requireAuth, async (req, res) => {
  const call = await mine(req, res); if (!call) return;
  if (!['ringing', 'active'].includes(call.status)) return res.json({ ok: true });
  // v140: a call that never connected records what the browser saw, so the team can tell how often networks block calls.
  const diag = req.body && req.body.diag && typeof req.body.diag === 'object' ? { ice: String(req.body.diag.ice || '').slice(0, 20), relay: req.body.diag.relay === true, candidates: String(req.body.diag.candidates || '').slice(0, 60) } : null;
  await finish(call, 'ended', req.body && req.body.reason === 'connection' ? { endReason: 'connection', ...(diag ? { connectDiag: diag } : {}) } : {});
  live.sendEvent(other(call, req.user.sub), 'call', { type: 'ended', callId: call.id, reason: req.body && req.body.reason === 'connection' ? 'connection' : undefined });
  live.sendEvent(req.user.sub, 'call', { type: 'ended', callId: call.id });
  res.json({ ok: true });
});

// POST /api/calls/:id/signal { kind, data } — passes the browsers'
// connection notes to the other side. 'restart' asks the caller to
// reconnect after the network changed (v137).
router.post('/calls/:id/signal', requireAuth, async (req, res) => {
  const call = await mine(req, res); if (!call) return;
  if (!['ringing', 'active'].includes(call.status)) return res.status(409).json({ code: 'GONE', error: 'This call has ended.' });
  const { kind, data } = req.body || {};
  if (!['offer', 'answer', 'ice', 'restart'].includes(kind)) return res.status(400).json({ error: 'Unknown signal.' });
  if (JSON.stringify(data || null).length > MAX_SIGNAL) return res.status(413).json({ error: 'Signal too large.' });
  if (kind === 'restart') await db.update('calls', call.id, { reconnects: (call.reconnects || 0) + 1 });
  live.sendEvent(other(call, req.user.sub), 'call', { type: kind, callId: call.id, data });
  res.json({ ok: true });
});

// ── voice messages ──────────────────────────────────────────────────────
const { PRIVATE_UPLOADS_DIR } = require('../uploads');
const VOICE_DIR = path.join(PRIVATE_UPLOADS_DIR, 'voice');
try { fs.mkdirSync(VOICE_DIR, { recursive: true }); } catch (e) { /* reported on first use */ }
const AUDIO_TYPES = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/aac': 'm4a', 'audio/mpeg': 'mp3', 'audio/x-m4a': 'm4a' };
function audioKind(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'm4a';
  if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  return null;
}
const CONTENT_TYPE = { webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg' };
const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: VOICE_MAX_BYTES, files: 1 } });
const voiceLimiter = require('express-rate-limit')({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Sending voice messages too quickly. Please slow down a moment.' } });

// POST /api/voice-messages (multipart: audio, toUserId, seconds, callId?)
router.post('/voice-messages', requireAuth, voiceLimiter, (req, res, next) => voiceUpload.single('audio')(req, res, (err) => {
  if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That voice message is too long. Keep it under 2 minutes.' : 'Could not read that recording.' });
  next();
}), async (req, res) => {
  const me = await db.find('users', u => u.id === req.user.sub);
  const them = await db.find('users', u => u.id === (req.body || {}).toUserId);
  const no = await reachCheck(me, them, 'voice');
  if (no) return res.status(no.status).json({ code: no.code, error: no.error });
  const f = req.file;
  if (!f || !f.buffer || f.buffer.length < 200) return res.status(400).json({ error: 'The recording is empty. Hold the microphone button and speak, then send.' });
  const ext = audioKind(f.buffer);
  if (!ext || !AUDIO_TYPES[String(f.mimetype || '').split(';')[0]]) return res.status(400).json({ error: 'That isn\'t a voice recording Trothen can play.' });
  const seconds = Math.round(Number(req.body.seconds) || 0);
  if (!(seconds >= 1)) return res.status(400).json({ error: 'The recording is too short.' });
  if (seconds > VOICE_MAX_SECONDS + 2) return res.status(413).json({ error: 'That voice message is too long. Keep it under 2 minutes.' });
  const id = `msg_${nanoid(10)}`;
  const file = `${id}.${ext}`;
  try {
    fs.mkdirSync(VOICE_DIR, { recursive: true });
    fs.writeFileSync(path.join(VOICE_DIR, file), f.buffer);
    try { require('../file-crypto').encryptFileInPlace(path.join(VOICE_DIR, file)); } catch (e) { /* stays unencrypted, still private */ }
  } catch (e) { return res.status(500).json({ error: 'Could not save the voice message. Please try again.' }); }
  const callId = typeof req.body.callId === 'string' ? req.body.callId : null;
  const label = `Voice message (${mmss(seconds * 1000)})`;
  const message = { id, fromId: me.id, toId: them.id, text: label, kind: 'voice', voice: { file, seconds, ext }, callId: callId || null, jobId: null, createdAt: new Date().toISOString() };
  await db.insert('messages', message);
  await notify(them.id, '🎤', `${nameOf(me)} sent you a voice message (${mmss(seconds * 1000)}).`, 'messages', { section: 'messages', contactId: me.id });
  res.status(201).json({ message });
});

// GET /api/voice-messages/:id/audio — only the two people in the chat.
router.get('/voice-messages/:id/audio', requireAuth, async (req, res) => {
  const m = await db.find('messages', x => x.id === req.params.id && x.kind === 'voice' && (x.fromId === req.user.sub || x.toId === req.user.sub));
  if (!m || !m.voice || !m.voice.file) return res.status(404).json({ error: 'Voice message not found.' });
  if (m.voice.deletedAt) return res.status(410).json({ error: 'This voice message was deleted.' });
  let buf;
  try { buf = require('../file-crypto').readPossiblyEncrypted(path.join(VOICE_DIR, path.basename(m.voice.file))); }
  catch (e) { return res.status(404).json({ error: 'This voice message is no longer available.' }); }
  if (m.toId === req.user.sub && !m.voice.playedAt) { try { await db.update('messages', m.id, { voice: { ...m.voice, playedAt: new Date().toISOString() } }); } catch (e) { /* fine */ } }
  res.set('Content-Type', CONTENT_TYPE[m.voice.ext] || 'application/octet-stream');
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Disposition', 'inline');
  res.send(buf);
});

// DELETE /api/voice-messages/:id — the sender can delete their own.
router.delete('/voice-messages/:id', requireAuth, async (req, res) => {
  const m = await db.find('messages', x => x.id === req.params.id && x.kind === 'voice' && x.fromId === req.user.sub);
  if (!m) return res.status(404).json({ error: 'Voice message not found.' });
  try { fs.unlinkSync(path.join(VOICE_DIR, path.basename(m.voice.file))); } catch (e) { /* already gone */ }
  await db.update('messages', m.id, { text: 'Voice message deleted', voice: { ...m.voice, deletedAt: new Date().toISOString() } });
  res.json({ ok: true });
});

// Calls nobody answered become missed calls.
setInterval(async () => {
  try {
    const now = Date.now();
    for (const call of await db.filter('calls', c => c.status === 'ringing' && now - Date.parse(c.createdAt) > RING_MS)) {
      await finish(call, 'missed');
      live.sendEvent(call.fromId, 'call', { type: 'unanswered', callId: call.id });
      live.sendEvent(call.toId, 'call', { type: 'ended', callId: call.id });
    }
    // A call left "active" for over 4 hours (both pages closed mid-call) is closed.
    for (const call of await db.filter('calls', c => c.status === 'active' && now - Date.parse(c.answeredAt || c.createdAt) > 4 * 3600 * 1000)) await finish(call, 'ended');
  } catch (e) { /* try again next time */ }
}, 5000).unref();

module.exports = router;
module.exports.connected = connected;
module.exports.inCallWindow = inCallWindow;
module.exports.withinHours = withinHours;
module.exports.VOICE_DIR = VOICE_DIR;
module.exports.iceServerList = iceServerList; // v140: for tests
