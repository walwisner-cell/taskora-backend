// v148: "Are you ready?" checks for every customer, pro, seller and driver,
// before they do something (as Uber, Bolt and Jumia check a driver or seller
// before they can go online or sell).
//
// One list per person, read from their real account: ID check, terms,
// profile photo, licence dates, payout details, tokens for cash work,
// store approval, driver documents, whether rides run in their country.
// Each item says what is missing, why it matters and where to fix it.
// The app shows the list on the Overview ("Get ready"), and checks the
// ones that matter before an action (going online, accepting a job,
// asking for a payout, selling), so people are told plainly first instead
// of failing halfway. The server still enforces its own rules either way.
const db = require('./db');
const { getSetting } = require('./platform-settings');

const today = () => new Date().toISOString().slice(0, 10);
const daysTo = (d) => Math.round((Date.parse(String(d).slice(0, 10)) - Date.parse(today())) / 86400000);
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// level: 'block' = the action can't go ahead; 'warn' = it can, but something will go wrong or be slower.
const item = (key, ok, label, why, fix, level = 'block', actions = []) => ({ key, ok: !!ok, label, why: ok ? null : why, fix: ok ? null : fix, level, actions });

async function checksFor(u) {
  const out = [];
  if (!u) return out;
  const { CURRENT_TERMS_VERSION } = require('./terms');
  const pro = u.role === 'provider', cust = u.role === 'customer';
  const ALL = ['acceptJob', 'acceptCashJob', 'goOnline', 'requestPayout', 'sell', 'book', 'buy'];

  out.push(item('active', u.active !== false && !u.onHold, 'Your account is active',
    u.onHold ? `Your account is on hold${u.holdReason ? `: ${u.holdReason}` : ''}. You can't take new work or sell until it is lifted.` : 'Your account is suspended.',
    { label: 'Contact support', section: 'messages' }, 'block', ALL));
  out.push(item('terms', u.termsVersion === CURRENT_TERMS_VERSION, 'You accepted the latest Terms',
    'The Terms changed. You are asked to accept them before your next booking, sale or job.', { label: 'Read and accept', action: 'terms' }, 'warn', ALL));
  out.push(item('verified', u.verified === true, 'Your ID is checked',
    pro ? 'Customers can only book pros whose ID has been checked, and you can\'t be paid out before it is.' : 'Selling in the Market, and some bookings, need your ID checked.',
    { label: 'Verify my ID', section: 'verification' }, pro ? 'block' : 'warn', pro ? ['acceptJob', 'acceptCashJob', 'goOnline', 'requestPayout', 'sell'] : ['sell']));
  out.push(item('phone', !!String(u.phone || '').trim(), 'A phone number is on your account',
    'Drivers, pros and customers call each other during a job. Without a number they can only message.', { label: 'Add my phone', section: 'settings' }, 'warn', ['acceptJob', 'goOnline', 'book']));

  if (pro) {
    out.push(item('photo', !!u.profilePhotoUrl, 'Your profile has a photo',
      'Customers choose pros with a clear face photo, and drivers must be recognised at pickup.', { label: 'Add a photo', section: 'settings' }, 'warn', ['acceptJob', 'goOnline']));
    if (u.proMode !== 'goods') out.push(item('category', !!u.category, 'You chose the work you do', 'Without a service category you don\'t appear in search or get matched to jobs.', { label: 'Choose my work', section: 'settings' }, 'block', ['acceptJob']));
    if (u.licenseExpiryDate) {
      const left = daysTo(u.licenseExpiryDate);
      out.push(item('licence', left >= 0, 'Your trade licence is in date', `Your licence expired on ${String(u.licenseExpiryDate).slice(0, 10)}. Upload the renewed one to take jobs that need it.`, { label: 'Upload my licence', section: 'settings' }, 'block', ['acceptJob', 'acceptCashJob']));
      if (left >= 0 && left <= 30) out.push(item('licence_soon', false, 'Your trade licence is in date', `It expires in ${left} day${left === 1 ? '' : 's'}. Upload the renewed one now so your work isn't stopped.`, { label: 'Upload my licence', section: 'settings' }, 'warn', ['acceptJob']));
    }
    // payout details
    const pm = require('./payout-methods');
    const method = u.payoutMethod || (pm.isAfrica(u.country) ? 'Mobile Money' : 'Bank Transfer');
    const payErr = pm.readyToPay(u, method);
    out.push(item('payout', !payErr, 'Your payout details are set', `${payErr || ''} Without them your earnings can't be sent to you.`.trim(), { label: 'Add payout details', section: 'settings' }, 'block', ['requestPayout']));
    // cash work: tokens
    const tokens = require('./tokens');
    const debt = Number(u.tokenDebt || 0);
    if (debt > 0) out.push(item('debt', false, 'No commission is owed', `You owe ${debt} tokens of commission from an earlier cash job. You can't accept cash jobs or cash rides until you buy tokens (what you owe is taken first).`, { label: 'Buy tokens', section: 'tokens' }, 'block', ['acceptCashJob']));
    const cashOn = (await getSetting('cashJobsEnabled')) !== false;
    if (cashOn) {
      const bal = await tokens.balance(u.id);
      out.push(item('tokens', bal >= 1 || (u.freeCommissionCredits || 0) > 0, 'You have tokens for cash jobs',
        `You have ${bal} tokens. On a cash job the customer pays you directly, so Trothen's commission comes from your tokens when you accept. With none, customers can't book you for cash.`, { label: 'Buy tokens', section: 'tokens' }, 'warn', ['acceptCashJob']));
    }
    // a store
    if (u.proMode === 'goods' || u.proMode === 'both' || u.store) {
      const st = u.store || {};
      const approved = st.approval && st.approval.status === 'approved';
      out.push(item('store', approved && st.open !== false, 'Your store is approved and open',
        !st.name ? 'You haven\'t set up your store yet.' : !approved ? 'Your store is waiting for a manager to approve it.' : 'Your store is closed, so buyers can\'t order.',
        { label: 'Open My Store', section: 'store' }, 'block', ['sell']));
      if (approved) {
        const live = await db.filter('storeGoods', g => g.providerId === u.id && g.status === 'approved' && g.forSale !== false);
        out.push(item('goods', live.length > 0, 'You have goods for sale', 'No approved goods are on sale, so your store shows empty.', { label: 'Add goods', section: 'store' }, 'warn', ['sell']));
      }
    }
    // a driver
    const rd = u.rideDriver;
    if (rd) {
      out.push(item('driver', rd.status === 'approved', 'You are approved to drive', rd.status === 'pending' ? 'Your driver application is being checked.' : 'You are not approved to drive. Apply in Rides.', { label: 'Open Rides', section: 'rides' }, 'block', ['goOnline']));
      const on = (await getSetting('rideEnabledCountries')) || [];
      out.push(item('ride_country', on.some(c => sameText(c, u.country)), 'Rides run in your country', `Rides aren't switched on in ${u.country || 'your country'} yet.`, null, 'block', ['goOnline']));
      for (const [k, label] of [['licenceExpiry', 'driving licence'], ['insuranceExpiry', 'vehicle insurance']]) {
        if (!rd[k]) continue;
        const left = daysTo(rd[k]);
        if (left < 0) out.push(item('ride_' + k, false, `Your ${label} is in date`, `Your ${label} expired on ${String(rd[k]).slice(0, 10)}. Upload the new one to drive.`, { label: 'Update my documents', section: 'rides' }, 'block', ['goOnline']));
        else if (left <= 14) out.push(item('ride_' + k + '_soon', false, `Your ${label} is in date`, `It expires in ${left} day${left === 1 ? '' : 's'}. Upload the new one so you aren't stopped.`, { label: 'Update my documents', section: 'rides' }, 'warn', ['goOnline']));
      }
      if (rd.acceptsCash && (await getSetting('rideCashEnabled')) === true) {
        const ready = await tokens.cashReady(u, 5, { ride: true });
        out.push(item('ride_cash', ready.ok, 'You can take cash rides', 'You take cash rides, but have no Driver Pass and too few tokens for the commission, so riders paying cash won\'t see you.', { label: 'Buy tokens or a pass', section: 'tokens' }, 'warn', ['goOnline']));
      }
    }
  }
  if (cust) {
    const realOn = (await getSetting('realPaymentsOnly')) === true;
    const africa = require('./payout-methods').isAfrica(u.country);
    if (realOn && africa) {
      const mm = await db.find('paymentMethods', m => m.userId === u.id && m.type === 'mobile_money');
      out.push(item('wallet', !!mm, 'Your Mobile Money number is saved', 'Saving it makes paying quicker, and refunds go straight back to it.', { label: 'Add Mobile Money', section: 'payments' }, 'warn', ['book', 'buy']));
    }
  }
  return out;
}

// For one action: may it go ahead, and what should the person know?
async function forAction(u, action) {
  const all = await checksFor(u);
  const rel = all.filter(i => !i.ok && (!action || i.actions.includes(action)));
  return { action: action || null, ready: !rel.some(i => i.level === 'block'), blocking: rel.filter(i => i.level === 'block'), warnings: rel.filter(i => i.level === 'warn'), items: all };
}

module.exports = { checksFor, forAction };
