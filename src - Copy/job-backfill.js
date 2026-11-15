// v159: what happens after a job is posted and no pro is found nearby.
//
// Before, the customer read "Your request is saved, and we'll notify you the
// moment someone's available", but nothing did that: a job was only ever
// sent to the pros listed at the moment it was posted. A pro who joined (or
// was verified, or added that kind of work) an hour later never saw it, and
// nobody on the team knew where customers were waiting with no pros.
//
// What marketplaces do (Thumbtack, TaskRabbit, Airtasker, Bark), and what
// this does:
//   1. The job stays open for its normal time (up to 7 days, or its date).
//   2. Every 10 minutes, open jobs are sent to pros who have become
//      available since: newly verified pros, pros who added that kind of
//      work, or pros back from a pause. The same area rule as when posting
//      (the city first, then the state or region, then the country, never
//      another country). Pros already sent the job are never sent it again.
//   3. The customer is told once, when the first new pro gets it.
//   4. The team is told where customers are waiting with no pro (once a day
//      for each kind of work and city), so they know where to find pros.
//   5. When the job closes with nobody hired, the customer is told and
//      offered next steps (already done by job-details.sweepExpiredJobs).

const db = require('./db');
const { notify } = require('./notify');
const { nanoid } = require('nanoid');
const { isListedPro } = require('./listing');

const MAX_NEW_PER_JOB = 5; // a few at a time, so a job isn't sprayed at every pro in the country at once
const ENOUGH = 3; // a job with 3 or more pros still able to answer doesn't need more
const MAX_PER_JOB = 15; // v160: the most pros one job is ever sent to, counting those who were sent it when it was posted

function sameArea(p, customer, scope) {
  if (!customer || !p || p.country !== customer.country) return false;
  if (scope === 'city') return !!(p.city && customer.city && p.city.toLowerCase() === customer.city.toLowerCase());
  if (scope === 'state') return !!(p.state && customer.state && p.state.toLowerCase() === customer.state.toLowerCase());
  return true;
}

// Pros who could take this job now and haven't been sent it.
async function newCandidates(job, customer, matchedIds) {
  const proStore = require('./store');
  const { weeklyJobAccessCapForScore } = require('./provider-score');
  const { weeklyMatchCountsForProviders } = require('./routes/marketplace.routes');
  const pool = await db.filter('users', u => isListedPro(u) && u.id !== job.customerId && !matchedIds.has(u.id) && proStore.hasSkill(u, job.category));
  const weekly = await weeklyMatchCountsForProviders(pool.map(u => u.id));
  const allowed = pool.filter(u => {
    const cap = weeklyJobAccessCapForScore(u.trustScore, u.trustScoreProvisional === true);
    if (cap === 0) return false;
    return cap === null || (weekly.get(u.id) || 0) < cap;
  });
  for (const scope of ['city', 'state', 'country']) {
    const inArea = allowed.filter(p => sameArea(p, customer, scope));
    if (inArea.length) return { scope, pros: inArea };
  }
  return { scope: null, pros: [] };
}

const sweepOpenJobs = require('./single-flight').singleFlight(async function sweepOpenJobs(nowMs = Date.now()) { // v160: never two runs at once
  const jobs = await db.filter('jobs', j => j.status === 'open' && !j.forProviderId && (!j.expiresAt || Date.parse(j.expiresAt) > nowMs));
  let sent = 0;
  for (const job of jobs) {
    try {
      const customer = await db.find('users', u => u.id === job.customerId);
      if (!customer || customer.active === false || customer.closedAt) continue;
      const matches = await db.filter('matches', m => m.jobId === job.id);
      const stillAble = matches.filter(m => ['pending', 'interested'].includes(m.status)).length;
      if (stillAble >= ENOUGH) continue;
      if (matches.length >= MAX_PER_JOB) continue; // v160: a job that many pros turned down isn't sent on and on
      const { scope, pros } = await newCandidates(job, customer, new Set(matches.map(m => m.providerId)));
      if (!pros.length) { await noteUnmet(job, customer, nowMs); continue; }
      const pick = pros
        .map(p => ({ p, s: (p.rating || 0) * 4 + Math.min(p.jobs || 0, 300) / 30 + (p.zipCode && p.zipCode === customer.zipCode ? 8 : 0) }))
        .sort((a, b) => b.s - a.s).slice(0, Math.min(MAX_NEW_PER_JOB, ENOUGH - stillAble + 2));
      for (const { p, s } of pick) {
        await db.insert('matches', { id: `match_${nanoid(10)}`, jobId: job.id, providerId: p.id, customerId: job.customerId, score: Math.min(99, Math.round(70 + s)), sameCommunity: !!(p.zipCode && p.zipCode === customer.zipCode), status: 'pending', addedLater: true, createdAt: new Date(nowMs).toISOString() });
        await notify(p.id, '🎯', `New job match: ${String(job.description).slice(0, 50)}${String(job.description).length > 50 ? '…' : ''}. Open it in Job Matches and send your price.`, 'newMatches', { section: 'matches' });
        sent++;
      }
      const patch = { backfillCount: (job.backfillCount || 0) + pick.length, lastBackfillAt: new Date(nowMs).toISOString() };
      if (!job.customerToldOfBackfill) {
        patch.customerToldOfBackfill = new Date(nowMs).toISOString();
        const where = scope === 'city' ? 'near you' : scope === 'state' ? 'in your region' : 'in your country';
        await notify(job.customerId, '🙌', `Good news: ${pick.length === 1 ? 'a pro' : `${pick.length} pros`} who ${pick.length === 1 ? 'does' : 'do'} ${job.category} ${where} ${pick.length === 1 ? 'is' : 'are'} now available, and your job "${String(job.description).slice(0, 50)}" was sent to ${pick.length === 1 ? 'them' : 'them'}. You'll see each answer in View Responses.`, 'bookingUpdates', { section: 'overview' });
      }
      await db.update('jobs', job.id, patch);
    } catch (e) { console.error('[job-backfill]', job.id, e.message); }
  }
  return sent;
});

// The team hears where customers are waiting with no pro: once a day for
// each kind of work in each city.
async function noteUnmet(job, customer, nowMs) {
  if (job.unmetNotedAt) return;
  await db.update('jobs', job.id, { unmetNotedAt: new Date(nowMs).toISOString() });
  const key = `${job.category}|${customer.city || ''}|${customer.country || ''}`.toLowerCase();
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const seen = await db.find('unmetDemand', d => d.key === key && d.day === day);
  if (seen) { await db.update('unmetDemand', seen.id, { jobs: (seen.jobs || 1) + 1 }); return; }
  await db.insert('unmetDemand', { id: `ud_${nanoid(8)}`, key, day, category: job.category, city: customer.city || null, country: customer.country || null, jobs: 1, createdAt: new Date(nowMs).toISOString() });
  // super admins, and the regional admins of that city or country
  const lc = (x) => String(x || '').toLowerCase();
  const team = await db.filter('users', u => u.role === 'admin' && u.active !== false && (u.isSuperAdmin === true
    || (!u.adminDepartment && ((u.adminScope === 'country' && lc(u.country) === lc(customer.country)) || (customer.city && lc(u.region || u.city) === lc(customer.city))))));
  for (const a of team) await notify(a.id, '📍', `A customer in ${customer.city || customer.country || 'an area'} posted a "${job.category}" job and there is no verified pro for it there yet. Inviting ${job.category} pros in ${customer.city || 'that area'} would fill it.`, null, { section: 'overview' });
}

// Where customers are waiting, for the admin dashboard (last 30 days).
async function unmetSummary(nowMs = Date.now()) {
  const since = new Date(nowMs - 30 * 86400e3).toISOString().slice(0, 10);
  const rows = await db.filter('unmetDemand', d => d.day >= since);
  const by = new Map();
  for (const r of rows) {
    const k = `${r.category}|${r.city || ''}|${r.country || ''}`;
    const x = by.get(k) || { category: r.category, city: r.city, country: r.country, jobs: 0, lastDay: r.day };
    x.jobs += r.jobs || 1; if (r.day > x.lastDay) x.lastDay = r.day;
    by.set(k, x);
  }
  return [...by.values()].sort((a, b) => b.jobs - a.jobs);
}

module.exports = { sweepOpenJobs, unmetSummary, newCandidates, noteUnmet };
