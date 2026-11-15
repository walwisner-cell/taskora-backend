// v148: System Check. Trothen watches itself.
//
// Every 15 minutes (and whenever an admin presses "Check now") it looks at
// the live system: emails, payments waiting for finance, refunds, payouts,
// MTN MoMo, background tasks, calls, server errors, rides, exchange rates.
// Each check says:  OK / Needs attention / Problem,  the likely cause, and
// what to do. When a check turns into a Problem, the super admins (and the
// finance team for money matters) are told at once, with the cause and the
// fix, then again every 6 hours while it lasts, and once more when it is
// fixed. Admin → System Check shows the whole list, and "Copy report" gives
// a text to send to the developer.
//
// It also keeps the "safety gates": checks a switch must pass before it can
// be turned on (see gate()), so a step can't be taken before things are
// ready.
const db = require('./db');
const { notify } = require('./notify');

const MIN = 60 * 1000, HOUR = 60 * MIN;
const STATE = { lastRun: null, results: [], beats: {}, errors: [], started: Date.now() };

// ── what the server notices as it runs ─────────────────────────────────
function beat(name) { STATE.beats[name] = Date.now(); }
// Counts server errors (5xx) per route, for the last hour.
function errorCounter(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 500) return;
    STATE.errors.push({ at: Date.now(), path: String(req.baseUrl + (req.route && req.route.path ? req.route.path : req.path)).slice(0, 80), method: req.method, status: res.statusCode });
    if (STATE.errors.length > 500) STATE.errors.splice(0, STATE.errors.length - 500);
  });
  next();
}
// Background tasks report in when they finish, so a stopped one is noticed.
function install() {
  const wrap = (mod, fn, name) => {
    try {
      const m = require(mod);
      if (typeof m[fn] !== 'function' || m[fn].__beat) return;
      const orig = m[fn];
      m[fn] = async function () { const r = await orig.apply(this, arguments); beat(name); return r; };
      m[fn].__beat = true;
    } catch (e) { /* module not present */ }
  };
  wrap('./customer-payments', 'expireUnpaid', 'payments');
  wrap('./customer-payments', 'sweepMomo', 'momo');
  wrap('./payout-sending', 'sweepSending', 'payouts');
  wrap('./tokens', 'sweep', 'tokens');
  wrap('./routes/payments.routes', 'sweepWorkDone', 'workdone');
  process.on('unhandledRejection', (e) => { STATE.errors.push({ at: Date.now(), path: '(background) ' + String(e && e.message || e).slice(0, 60), method: '-', status: 500 }); });
}

// ── the checks ─────────────────────────────────────────────────────────
const ok = (key, area, label, words) => ({ key, area, label, status: 'ok', words });
const warn = (key, area, label, words, cause, fix) => ({ key, area, label, status: 'warn', words, cause, fix });
const bad = (key, area, label, words, cause, fix) => ({ key, area, label, status: 'problem', words, cause, fix });
const ago = (ms) => (ms < HOUR ? `${Math.round(ms / MIN)} minutes` : ms < 48 * HOUR ? `${Math.round(ms / HOUR)} hours` : `${Math.round(ms / (24 * HOUR))} days`);
const safe = async (key, area, label, fn) => { try { return await fn(); } catch (e) { return warn(key, area, label, 'This check could not run.', e.message, 'If it keeps happening, send the report to the developer.'); } };
const getSetting = async (k) => require('./platform-settings').getSetting(k);

async function runChecks() {
  const now = Date.now();
  const out = [];
  const realOn = (await getSetting('realPaymentsOnly')) === true;

  // Email
  out.push(await safe('email', 'Sign-in and email', 'Emails are being sent', async () => {
    const d = require('./delivery'); const st = d.emailStatus();
    if (!d.isEmailConfigured()) return bad('email', 'Sign-in and email', 'Emails are being sent', 'No email service is connected.', 'The SMTP settings are not on the server.', 'Render → Environment: add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS for noreply@trothenpro.com, then Admin → Go-Live → "Send a test email".');
    if (st.last && !st.last.sent && !st.last.badAddress) return bad('email', 'Sign-in and email', 'Emails are being sent', `The last email failed (${new Date(st.last.at).toUTCString()}): ${st.last.words}`, /auth|password|535|login/i.test(st.last.words || '') ? 'The mailbox password on the server is wrong, or was changed.' : /quota|limit|plan|credit/i.test(st.last.words || '') ? 'The email plan ran out (as happened with SendGrid).' : 'The mail server refused or did not answer.', 'Check SMTP_PASS on Render matches the noreply@trothenpro.com mailbox, then "Send a test email".');
    return ok('email', 'Sign-in and email', 'Emails are being sent', st.last ? `The last email went at ${new Date(st.last.at).toUTCString()}.` : 'Connected. No email sent since the server started.');
  }));

  // Customer payments waiting for finance
  out.push(await safe('pay_wait', 'Money', 'Customer payments are confirmed quickly', async () => {
    const said = await db.filter('escrowTransactions', e => e.paidBy === 'code' && e.status === 'awaiting_payment' && e.customerSaysPaidAt);
    const late = said.filter(e => now - Date.parse(e.customerSaysPaidAt) > 2 * HOUR);
    if (late.length) return bad('pay_wait', 'Money', 'Customer payments are confirmed quickly', `${late.length} customer${late.length === 1 ? '' : 's'} said they paid over 2 hours ago and are still waiting (oldest: ${ago(now - Math.min(...late.map(e => Date.parse(e.customerSaysPaidAt))))}).`, 'Nobody in finance has checked Trothen\'s Mobile Money account and confirmed the payments.', 'Admin → Payments → Customer payments: check each code against the Mobile Money account, then Confirm or Reject. The pro or seller is waiting too.');
    return ok('pay_wait', 'Money', 'Customer payments are confirmed quickly', said.length ? `${said.length} waiting, all under 2 hours.` : 'None waiting.');
  }));
  out.push(await safe('refunds', 'Money', 'Refunds are sent', async () => {
    const list = await require('./customer-payments').refundsToSend();
    const rows = await Promise.all(list.map(r => db.find('escrowTransactions', e => e.id === r.escrowId)));
    const old = rows.filter(e => e && now - Date.parse(e.updatedAt || e.createdAt) > 24 * HOUR);
    if (old.length) return bad('refunds', 'Money', 'Refunds are sent', `${old.length} refund${old.length === 1 ? ' has' : 's have'} waited over a day to be sent.`, 'Refunds to Mobile Money are sent by hand by finance, and these have not been.', 'Admin → Payments → Refunds to send: send each one from Trothen\'s Mobile Money account and enter the transaction ID.');
    return list.length ? warn('refunds', 'Money', 'Refunds are sent', `${list.length} refund${list.length === 1 ? '' : 's'} to send (under a day old).`, 'Normal after a cancellation.', 'Admin → Payments → Refunds to send.') : ok('refunds', 'Money', 'Refunds are sent', 'None waiting.');
  }));
  out.push(await safe('payouts', 'Money', 'Pros\' payouts are sent', async () => {
    const list = await db.filter('payouts', p => ['processing', 'sending'].includes(p.status));
    const stuckMtn = list.filter(p => p.status === 'sending' && now - Date.parse(p.momoSentAt || p.updatedAt || p.createdAt) > HOUR);
    if (stuckMtn.length) return bad('payouts', 'Money', 'Pros\' payouts are sent', `${stuckMtn.length} payout${stuckMtn.length === 1 ? '' : 's'} sent through MTN MoMo got no answer for over an hour.`, 'MTN\'s system is slow or down, or the disbursement keys stopped working.', 'Check the payouts in Admin → Payments → Payouts being sent. If MTN shows them as paid, press "Mark as sent" with MTN\'s reference.');
    const old = list.filter(p => p.status === 'processing' && now - Date.parse(p.createdAt) > 3 * 24 * HOUR);
    if (realOn && old.length) return bad('payouts', 'Money', 'Pros\' payouts are sent', `${old.length} payout${old.length === 1 ? ' has' : 's have'} waited over 3 days.`, 'Payouts are sent by finance by hand, and these have not been (or have a problem noted).', 'Admin → Payments → Payouts being sent: send them and press "Mark as sent", or "Can\'t send" with the reason.');
    return ok('payouts', 'Money', 'Pros\' payouts are sent', list.length ? `${list.length} waiting, none overdue.` : 'None waiting.');
  }));
  out.push(await safe('momo', 'Money', 'MTN MoMo payments get answers', async () => {
    const lm = require('./liberia-momo');
    if (!lm.isCollectionsConfigured()) return ok('momo', 'Money', 'MTN MoMo payments get answers', 'MTN MoMo is not switched on (payments use codes).');
    const wait = await db.filter('escrowTransactions', e => e.paidBy === 'momo' && e.status === 'awaiting_payment' && e.paymentExpiresAt && Date.parse(e.paymentExpiresAt) < now - 15 * MIN);
    if (wait.length) return bad('momo', 'Money', 'MTN MoMo payments get answers', `${wait.length} MTN payment${wait.length === 1 ? ' is' : 's are'} past their time with no answer from MTN.`, 'MTN\'s system is not answering, or the collection keys are wrong.', 'Check the MTN partner portal. If MTN is down, customers can pay with a code instead (remove their MTN wallet as default).');
    return ok('momo', 'Money', 'MTN MoMo payments get answers', 'Answering.');
  }));
  out.push(await safe('pay_setup', 'Money', 'Customers can pay where real payments are required', async () => {
    if (!realOn) return ok('pay_setup', 'Money', 'Customers can pay where real payments are required', '"Real payments only" is off (test payments).');
    const cp = require('./customer-payments');
    const live = (await db.all('countries')).filter(c => c.status === 'live').map(c => c.name);
    const none = [];
    for (const c of live) if ((await cp.optionsFor(c)).protectedMode === 'none') none.push(c);
    if (none.length) return bad('pay_setup', 'Money', 'Customers can pay where real payments are required', `No way to pay is set up for ${none.join(', ')}, so protected bookings and Market purchases are refused there.`, '"Real payments only" is on, but Trothen\'s Mobile Money account (or card payments) is not set for these countries.', 'Admin → Tokens → Countries: add Trothen\'s Mobile Money number for the country, or add the Stripe keys on Render.');
    return ok('pay_setup', 'Money', 'Customers can pay where real payments are required', `Set up for ${live.join(', ') || 'every live country'}.`);
  }));

  // v149: the money and the bookings agree (nothing stuck, nothing paid twice)
  out.push(await safe('money_match', 'Money', 'Money and bookings agree', async () => {
    const [contracts, escrows] = await Promise.all([db.all('contracts'), db.all('escrowTransactions')]);
    const byId = new Map(contracts.map(c => [c.id, c]));
    const stuck = [], wrong = [], doubled = [];
    const seen = new Map();
    for (const e of escrows) {
      const c = byId.get(e.contractId); if (!c) continue;
      const age = now - Date.parse(c.updatedAt || c.createdAt || 0);
      if (e.status === 'held' && ['cancelled', 'declined', 'expired', 'completed'].includes(c.status) && age > HOUR) stuck.push(`#${c.bookingNumber} (${c.status}, $${Number(e.amount).toFixed(2)} still held)`);
      if (['payment_expired', 'refunded'].includes(e.status) && ['active', 'pending_provider_confirmation'].includes(c.status) && age > HOUR) wrong.push(`#${c.bookingNumber} (${c.status.replace(/_/g, ' ')}, but the money is ${e.status.replace(/_/g, ' ')})`);
      if (e.status === 'held' && c.status === 'awaiting_payment' && age > HOUR) wrong.push(`#${c.bookingNumber} (money held, but it still says waiting for payment)`);
      if (['held', 'released'].includes(e.status)) { seen.set(e.contractId, (seen.get(e.contractId) || 0) + 1); if (seen.get(e.contractId) === 2) doubled.push(`#${c.bookingNumber}`); }
    }
    const list = [...stuck, ...wrong, ...doubled.map(x => `${x} (two payments held)`)];
    if (list.length) return bad('money_match', 'Money', 'Money and bookings agree', `${list.length} booking${list.length === 1 ? '' : 's'} where the money doesn't match the booking: ${list.slice(0, 5).join('; ')}${list.length > 5 ? '…' : ''}.`, 'A step stopped halfway (the server restarted in the middle of it, or an error), so the booking and its money went different ways.', 'Open each booking in Admin → Bookings. Release or refund the money by hand to match what really happened, and send this report to the developer.');
    return ok('money_match', 'Money', 'Money and bookings agree', `${escrows.length} payments checked.`);
  }));

  // Background tasks
  out.push(await safe('tasks', 'System', 'Background tasks are running', async () => {
    const up = now - STATE.started;
    if (up < 12 * MIN) return ok('tasks', 'System', 'Background tasks are running', 'The server started recently; checking after 12 minutes.');
    const expect = { payments: 12 * MIN, momo: 5 * MIN, payouts: 12 * MIN, tokens: 12 * MIN, workdone: 2.5 * HOUR };
    const names = { payments: 'unpaid bookings and orders', momo: 'MTN payment checks', payouts: 'payout checks', tokens: 'token purchases', workdone: 'jobs completing by themselves' };
    const late = Object.entries(expect).filter(([k, ms]) => up > ms && (!STATE.beats[k] || now - STATE.beats[k] > ms)).map(([k]) => names[k]);
    if (late.length) return bad('tasks', 'System', 'Background tasks are running', `These have not run when they should: ${late.join(', ')}.`, 'A background task is failing every time (a code error), or the server is restarting over and over.', 'Render → Logs: look for lines with [customer-payments], [momo], [payout-sending], [tokens] or [work-done]. Send them to the developer.');
    return ok('tasks', 'System', 'Background tasks are running', 'All ran on time.');
  }));
  out.push(await safe('errors', 'System', 'No server errors', async () => {
    const hour = STATE.errors.filter(x => now - x.at < HOUR);
    if (!hour.length) return ok('errors', 'System', 'No server errors', 'None in the last hour.');
    const by = {}; hour.forEach(x => { const k = `${x.method} ${x.path}`; by[k] = (by[k] || 0) + 1; });
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} (${n})`).join('; ');
    const f = hour.length >= 10 ? bad : warn;
    return f('errors', 'System', 'No server errors', `${hour.length} server error${hour.length === 1 ? '' : 's'} in the last hour: ${top}.`, 'A part of the app is failing for people (a code error, or the database or disk is full or unreachable).', 'Render → Logs at those times shows the error. Copy this report and the log lines to the developer.');
  }));
  out.push(await safe('storage', 'System', 'Data is kept safely', async () => {
    if (!process.env.DATABASE_URL && !process.env.DATA_DIR) return bad('storage', 'System', 'Data is kept safely', 'Data is not on a permanent disk.', 'DATA_DIR (or DATABASE_URL) is not set, so data is lost on every deploy.', 'Render: attach a disk and set DATA_DIR, as in the deployment steps.');
    return ok('storage', 'System', 'Data is kept safely', process.env.DATABASE_URL ? 'Database' : `Disk at ${process.env.DATA_DIR}`);
  }));

  // Calls
  out.push(await safe('calls', 'Calls', 'Calls connect', async () => {
    const day = await db.filter('calls', c => c.createdAt && now - Date.parse(c.createdAt) < 24 * HOUR);
    const answered = day.filter(c => c.answeredAt || c.connectedAt);
    const failed = answered.filter(c => /fail|ice|network/i.test(String(c.endReason || '')) && !c.connectedAt);
    const relay = !!(process.env.TURN_API_URL || process.env.TURN_URLS);
    if (answered.length >= 5 && failed.length / answered.length > 0.3) return bad('calls', 'Calls', 'Calls connect', `${failed.length} of ${answered.length} answered calls in the last day failed to connect.`, relay ? 'The relay (TURN) service is out of data or its link is wrong.' : 'No relay (TURN) is set, and calls fail on many mobile networks.', relay ? 'Check the TURN account (Metered) is active and TURN_API_URL is right.' : 'Render: set TURN_API_URL (Metered Open Relay, free).');
    if (!relay) return warn('calls', 'Calls', 'Calls connect', 'No relay (TURN) is set.', 'Calls fail on some mobile networks and VPNs without one.', 'Render: set TURN_API_URL.');
    return ok('calls', 'Calls', 'Calls connect', day.length ? `${day.length} calls in the last day.` : 'Relay set.');
  }));

  // Rides and maps
  out.push(await safe('rides', 'Rides', 'Ride countries are ready', async () => {
    const on = (await getSetting('rideEnabledCountries')) || [];
    if (!on.length) return ok('rides', 'Rides', 'Ride countries are ready', 'Rides are switched off everywhere.');
    const problems = [];
    for (const c of on) {
      const fares = await require('./ride-fares').tableFor(c).catch(() => null);
      if (!fares) problems.push(`${c}: no fare table`);
      const places = await db.filter('places', p => p.country === c && p.status === 'live');
      if (!places.length) problems.push(`${c}: no pinned places, so riders can't search by name`);
    }
    if (problems.length) return warn('rides', 'Rides', 'Ride countries are ready', problems.join('; ') + '.', 'Rides were switched on before the country was fully set up.', 'Admin → Rides → Fares, and Admin → Rides → Places (pin the starter places).');
    return ok('rides', 'Rides', 'Ride countries are ready', on.join(', '));
  }));
  out.push(await safe('maps', 'Rides', 'Maps are on a provider that allows a business app', async () => {
    if ((process.env.MAPBOX_TOKEN || '').trim() || process.env.MAP_TILE_URL) return ok('maps', 'Rides', 'Maps are on a provider that allows a business app', 'Yes.');
    return warn('maps', 'Rides', 'Maps are on a provider that allows a business app', 'Maps use OpenStreetMap\'s free servers.', 'Their rules don\'t allow a busy app to rely on them; maps may load slowly or be blocked as Trothen grows.', 'Render: add MAPBOX_TOKEN (free tier, business use allowed).');
  }));
  out.push(await safe('rate', 'Money', 'The exchange rate is up to date', async () => {
    const rows = await db.all('exchangeRates');
    const lrd = rows.find(r => r.currencyCode === 'LRD');
    if (!lrd) return ok('rate', 'Money', 'The exchange rate is up to date', 'No L$ rate in use.');
    const at = Date.parse(lrd.updatedAt || lrd.fetchedAt || lrd.createdAt || 0);
    if (at && now - at > 7 * 24 * HOUR) return warn('rate', 'Money', 'The exchange rate is up to date', `The L$ rate was last changed ${ago(now - at)} ago.`, 'It is set by hand, and prices in L$ follow it.', 'Admin → Settings → Exchange rates: set today\'s rate.');
    return ok('rate', 'Money', 'The exchange rate is up to date', 'Recent.');
  }));
  return out;
}

// ── alerts ─────────────────────────────────────────────────────────────
async function alertPeople(r, fixed) {
  const admins = await db.filter('users', u => u.role === 'admin' && u.active !== false && (u.isSuperAdmin || (r.area === 'Money' && u.adminDepartment === 'financial')));
  const text = fixed ? `✅ Fixed: ${r.label}. ${r.words}` : `System Check: ${r.label}. ${r.words} Likely cause: ${r.cause} What to do: ${r.fix}`;
  for (const a of admins) await notify(a.id, fixed ? '✅' : '🚨', text.slice(0, 600), null, { section: 'systemcheck' });
}
async function run() {
  const results = await runChecks();
  STATE.results = results; STATE.lastRun = new Date().toISOString();
  const now = Date.now();
  let memo = {};
  try { memo = (await getSetting('systemCheckAlerts')) || {}; } catch (e) { memo = {}; }
  const next = { ...memo };
  for (const r of results) {
    const m = memo[r.key];
    if (r.status === 'problem') {
      if (!m || m.words !== r.words && now - Date.parse(m.at) > HOUR || now - Date.parse(m.at) > 6 * HOUR) { await alertPeople(r, false); next[r.key] = { at: new Date().toISOString(), words: r.words }; }
    } else if (m) { await alertPeople(r, true); delete next[r.key]; }
  }
  try { await require('./platform-settings').setSetting('systemCheckAlerts', next); } catch (e) { /* the next run tries again */ }
  return report();
}
function report() {
  const results = STATE.results || [];
  return { lastRun: STATE.lastRun, problems: results.filter(r => r.status === 'problem').length, warnings: results.filter(r => r.status === 'warn').length, results };
}
function reportText() {
  const r = report();
  return [`Trothen System Check, ${r.lastRun || 'not run yet'}: ${r.problems} problem(s), ${r.warnings} to watch.`, ...r.results.filter(x => x.status !== 'ok').map(x => `- [${x.status === 'problem' ? 'PROBLEM' : 'watch'}] ${x.label}: ${x.words} Cause: ${x.cause} Fix: ${x.fix}`), ...r.results.filter(x => x.status === 'ok').map(x => `- [ok] ${x.label}: ${x.words}`)].join('\n');
}

// ── safety gates: a switch is only turned on when it is ready ──────────
// Returns [] when it may go ahead, or the reasons it may not.
async function gate(step, args = {}) {
  const reasons = [];
  if (step === 'realPaymentsOnly') {
    const cp = require('./customer-payments');
    const live = (await db.all('countries')).filter(c => c.status === 'live').map(c => c.name);
    const tokens = require('./tokens'); const all = await tokens.settings();
    const cardOn = require('./stripe-pay').isOn();
    const withAccounts = Object.entries(all.countryRules || {}).filter(([, r]) => r && Array.isArray(r.momoAccounts) && r.momoAccounts.some(a => a && a.number)).map(([c]) => c);
    if (!cardOn && !withAccounts.length) reasons.push('No way for customers to pay is set up: add Trothen\'s Mobile Money number for a country (Admin → Tokens → Countries), or the Stripe keys on Render. With "Real payments only" on and nothing set up, every protected booking and Market purchase would be refused.');
    const d = require('./delivery'); if (!d.isEmailConfigured()) reasons.push('Email is not connected: customers would not get payment receipts and sign-in codes by email. Add the SMTP settings first.');
    const missing = cardOn ? [] : live.filter(c => !withAccounts.includes(c));
    if (!reasons.length && missing.length) reasons.push(`Customers in ${missing.join(', ')} would have no way to pay. Add Trothen's Mobile Money number for ${missing.length === 1 ? 'that country' : 'those countries'}, or mark ${missing.length === 1 ? 'it' : 'them'} not live.`);
    void cp;
  }
  if (step === 'rideCountry') {
    const fares = await require('./ride-fares').tableFor(args.country).catch(() => null);
    if (!fares) reasons.push(`There is no fare table for ${args.country}. Set the fares first (Admin → Rides → Fares), or riders would be quoted by each driver's own rates only.`);
  }
  return reasons;
}

module.exports = { install, beat, errorCounter, runChecks, run, report, reportText, gate, STATE };
