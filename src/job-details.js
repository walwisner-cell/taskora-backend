// v144: what a posted job says, in a form pros can act on.
//
// Before, "Budget" was free text ("$80-150", "L$5000"...) that the app then
// guessed a number from, falling back to $100 when it couldn't; there was no
// "when", and "materials cost" was a number the customer had to guess.
// Now, the way Thumbtack, Airtasker and TaskRabbit ask it:
//
//   When       As soon as possible (within 2 days) / on a date (and time) / I'm flexible
//   Materials  I have them / the pro brings them (in their price) / not sure
//   Price      Pros send me their prices (recommended) / my price is X / my budget is X to Y,
//              in US$ or the customer's own money (L$ in Liberia). Kept in US$
//              for payments, and shown in both.
//   Expiry     An open job closes by itself after 14 days (or the day after the
//              chosen date), so pros never see stale jobs and the customer is told.
const { currencyForCountry } = require('./currency-data');
const DAY = 24 * 3600 * 1000;
const money = (n) => Math.round(Number(n) * 100) / 100;
const OPEN_DAYS = 14;

async function rateFor(code) {
  if (!code || code === 'USD') return 1;
  return require('./plan-pricing').resolveRate(code, await require('./db').all('exchangeRates'));
}
const fmt = (sym, n) => `${sym}${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// Reads when / materials / price. Returns { fields } or { error }.
async function readJobDetails(b, customer) {
  b = b || {};
  const f = {};
  // When
  const when = ['asap', 'date', 'flexible'].includes(b.when) ? b.when : (b.preferredDate ? 'date' : 'flexible');
  f.when = when;
  if (when === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.preferredDate || ''))) return { error: 'Choose the date you want it done' };
    const t = Date.parse(b.preferredDate + 'T23:59:59Z');
    if (!(t >= Date.now() - DAY) || t > Date.now() + 180 * DAY) return { error: 'Choose a date from today up to 6 months ahead' };
    f.preferredDate = b.preferredDate;
  }
  if (b.preferredTime !== undefined && b.preferredTime !== null && b.preferredTime !== '') f.preferredTime = String(b.preferredTime).trim().slice(0, 20);
  // Materials
  if (b.materialsBy !== undefined) {
    if (!['me', 'pro', 'unsure'].includes(b.materialsBy)) return { error: 'Say who provides the materials' };
    f.materialsBy = b.materialsBy;
  }
  // Price
  const local = currencyForCountry((customer && customer.country) || 'United States');
  if (b.budgetType !== undefined) {
    if (!['quotes', 'fixed', 'range'].includes(b.budgetType)) return { error: 'Choose how you want to price the job' };
    f.budgetType = b.budgetType;
    if (b.budgetType !== 'quotes') {
      const code = b.budgetCurrency === local.code ? local.code : 'USD';
      const sym = code === 'USD' ? '$' : local.symbol;
      const rate = await rateFor(code);
      const usd = (n) => money(n / rate);
      if (b.budgetType === 'fixed') {
        const a = Number(b.budgetAmount);
        if (!(a > 0) || usd(a) < 1 || usd(a) > 100000) return { error: `Enter your price (at least $1${code !== 'USD' ? ' or the same in ' + code : ''})` };
        f.budgetUsd = usd(a);
        f.budgetLocal = { currency: code, symbol: sym, amount: money(a) };
        f.budget = `$${f.budgetUsd.toFixed(2)}`; // the machine-readable single price "Accept the job at" uses
        f.budgetLabel = code === 'USD' ? `$${f.budgetUsd.toFixed(2)}` : `${fmt(sym, a)} (≈ $${f.budgetUsd.toFixed(2)})`;
      } else {
        const lo = Number(b.budgetMin), hi = Number(b.budgetMax);
        if (!(lo > 0) || !(hi > lo)) return { error: 'Enter your budget as two amounts, the lower one first' };
        if (usd(hi) > 100000) return { error: 'The budget is too high' };
        f.budgetMinUsd = usd(lo); f.budgetMaxUsd = usd(hi);
        f.budgetLocal = { currency: code, symbol: sym, min: money(lo), max: money(hi) };
        f.budget = `$${f.budgetMinUsd.toFixed(2)}–$${f.budgetMaxUsd.toFixed(2)}`;
        f.budgetLabel = code === 'USD' ? f.budget : `${fmt(sym, lo)}–${fmt(sym, hi).replace(sym, '')} (≈ ${f.budget})`;
      }
    } else { f.budget = null; f.budgetLabel = 'Pros send their prices'; }
  }
  // Closes by itself
  const until = f.preferredDate ? Math.min(Date.now() + OPEN_DAYS * DAY, Date.parse(f.preferredDate + 'T23:59:59Z') + DAY) : Date.now() + OPEN_DAYS * DAY;
  f.expiresAt = new Date(Math.max(until, Date.now() + DAY)).toISOString();
  return { fields: f };
}

// One amount to use for a job when the pro hasn't given a price: the
// customer's single price, or nothing (never a made-up default).
function singlePriceUsd(job) {
  if (!job) return null;
  if (Number(job.budgetUsd) > 0) return Number(job.budgetUsd);
  const m = String(job.budget || '').replace(/,/g, '').match(/^\s*\$?\s*(\d+(?:\.\d{1,2})?)\s*\$?\s*$/);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
// Words for the job card, the same for the customer and the pros.
function jobFacts(job) {
  const out = {};
  out.when = job.when === 'asap' ? 'As soon as possible' : job.when === 'date' && job.preferredDate ? `On ${new Date(job.preferredDate + 'T12:00:00Z').toDateString()}${job.preferredTime ? ', ' + job.preferredTime : ''}` : 'Flexible';
  out.materials = job.materialsBy === 'me' ? 'The customer has the materials' : job.materialsBy === 'pro' ? 'The pro brings the materials (include them in the price)' : job.materialsBy === 'unsure' ? 'Materials: not sure yet, advise the customer' : null;
  out.price = job.budgetLabel || (job.budget ? job.budget : 'Pros send their prices');
  return out;
}

// Open jobs past their date close by themselves; the customer is told.
async function sweepExpiredJobs() {
  const db = require('./db'); const { notify } = require('./notify');
  const now = Date.now(); let n = 0;
  for (const j of await db.filter('jobs', x => x.status === 'open' && x.expiresAt && Date.parse(x.expiresAt) <= now)) {
    await db.update('jobs', j.id, { status: 'cancelled', closedReason: 'expired', closedAt: new Date().toISOString() });
    for (const m of await db.filter('matches', x => x.jobId === j.id && ['pending', 'interested'].includes(x.status))) await db.update('matches', m.id, { status: 'not_selected' });
    try { await notify(j.customerId, '⌛', `Your job "${String(j.description).slice(0, 60)}" closed because no pro was hired in time. Post it again any time, or book a pro directly.`, 'bookingUpdates', { section: 'overview' }); } catch (e) { /* closed anyway */ }
    n++;
  }
  return n;
}

module.exports = { OPEN_DAYS, readJobDetails, singlePriceUsd, jobFacts, sweepExpiredJobs };
