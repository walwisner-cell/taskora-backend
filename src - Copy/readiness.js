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

// v152: dates as people read them ("Jan 5, 2026"), not 2026-01-05
const fmtDate = (d) => { const t = Date.parse(String(d).slice(0, 10) + 'T12:00:00Z'); return isNaN(t) ? String(d) : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const today = () => new Date().toISOString().slice(0, 10);
const daysTo = (d) => Math.round((Date.parse(String(d).slice(0, 10)) - Date.parse(today())) / 86400000);
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// level: 'block' = needed (the action can't go ahead); 'warn' = recommended.
// label is what is done ("Profile photo added"); todo is what to do when it
// isn't ("Add a profile photo"). fix.target is the exact place on the page.
const DONE = {
  active: 'Account active', terms: 'Terms accepted', verified: 'ID verified', phone: 'Phone number added', photo: 'Profile photo added',
  category: 'Main service chosen', licence: 'Trade license current', licence_soon: 'Trade license current', payout: 'Payout details added', debt: 'No commission owed',
  tokens: 'Tokens for cash jobs', store: 'Store open', goods: 'Goods listed', driver: 'Approved to drive', ride_country: 'Rides run in your country',
  ride_cash: 'Ready for cash rides', wallet: 'Mobile Money saved', price: 'Price set', portfolio: 'Work photos added', twofa: 'Two-step verification on', location: 'Service location set',
};
const item = (key, ok, todo, why, fix, level = 'block', actions = []) => ({ key, ok: !!ok, label: DONE[key.replace(/_(licenceExpiry|insuranceExpiry)(_soon)?$/, '_doc')] || DONE[key] || todo, todo, why: ok ? null : why, fix: ok ? null : fix, level, actions });

async function checksFor(u) {
  const out = [];
  if (!u) return out;
  const { CURRENT_TERMS_VERSION } = require('./terms');
  const pro = u.role === 'provider', cust = u.role === 'customer';
  const ALL = ['acceptJob', 'acceptCashJob', 'goOnline', 'requestPayout', 'sell', 'book', 'buy'];

  out.push(item('active', u.active !== false && !u.onHold, u.onHold ? 'Account on hold' : 'Account suspended',
    u.onHold ? `${u.holdReason ? `Reason: ${u.holdReason}. ` : ''}New work and sales are paused until the hold is lifted.` : 'Contact support to restore access.',
    { label: 'Contact Support', section: 'messages' }, 'block', ALL));
  out.push(item('terms', u.termsVersion === CURRENT_TERMS_VERSION, 'Accept the updated Terms',
    'Required before your next booking, sale or job.', { label: 'Review Terms', section: 'settings', target: '#settings-terms-provider, #settings-terms-customer' }, 'warn', ALL));
  out.push(item('verified', u.verified === true, 'Verify your ID',
    pro ? 'Required before customers can book you or you can receive payouts.' : 'Required to sell in the Market.',
    { label: 'Verify ID', section: 'verification', target: '.panel' }, pro ? 'block' : 'warn', pro ? ['acceptJob', 'acceptCashJob', 'goOnline', 'requestPayout', 'sell'] : ['sell']));
  out.push(item('phone', !!String(u.phone || '').trim(), 'Add a phone number',
    'So the other person can call you during a job.', { label: 'Add Phone', section: 'settings', target: pro ? 'panel:Confirm your phone number' : '#set-cust-phone' }, 'warn', ['acceptJob', 'goOnline', 'book']));

  if (pro) {
    out.push(item('photo', !!u.profilePhotoUrl, 'Add a profile photo',
      'Required to appear in search. Use a clear photo of your face.', { label: 'Add Photo', section: 'settings', target: '#prov-profile-photo-preview' }, 'block', []));
    if (u.proMode !== 'goods') out.push(item('category', !!u.category, 'Choose your main service', 'Required to appear in search and receive job matches.', { label: 'Choose Service', section: 'settings', target: '#set-prov-category' }, 'block', ['acceptJob']));
    if (u.licenseExpiryDate) {
      const left = daysTo(u.licenseExpiryDate);
      out.push(item('licence', left >= 0, 'Renew your trade license', `Expired on ${fmtDate(u.licenseExpiryDate)}. Upload the renewed license to keep taking jobs that need it.`, { label: 'Update License', section: 'settings', target: '#set-prov-license-expiry' }, 'block', ['acceptJob', 'acceptCashJob']));
      if (left >= 0 && left <= 30) out.push(item('licence_soon', false, 'Trade license expires soon', `Expires in ${left} day${left === 1 ? '' : 's'}.`, { label: 'Update License', section: 'settings', target: '#set-prov-license-expiry' }, 'warn', ['acceptJob']));
    }
    // v150: more of what makes a profile complete (as Thumbtack and TaskRabbit list them)
    if (u.proMode !== 'goods') {
      const hasPrice = Number(u.price) > 0 || (u.pricing && (Number(u.pricing.rate) > 0 || Number(u.pricing.price) > 0));
      out.push(item('price', hasPrice, 'Set your price', 'Customers compare prices before they book.', { label: 'Set Price', section: 'settings', target: 'panel:How you charge' }, 'warn', ['acceptJob']));
      const photos = await db.filter('portfolioPhotos', x => x.providerId === u.id);
      out.push(item('portfolio', photos.length >= 3, 'Add photos of your work', `${photos.length} of 3 added. Pros with photos get more bookings.`, { label: 'Add Photos', section: 'portfolio', target: '.panel' }, 'warn', []));
      out.push(item('location', u.latitude != null && u.longitude != null, 'Set your service location', 'Used to match you with nearby jobs.', { label: 'Set Location', section: 'settings', target: 'panel:Service Location' }, 'warn', []));
    }
    // payout details
    const pm = require('./payout-methods');
    const method = u.payoutMethod || (pm.isAfrica(u.country) ? 'Mobile Money' : 'Bank Transfer');
    const payErr = pm.readyToPay(u, method);
    out.push(item('payout', !payErr, method === 'Mobile Money' ? 'Add your Mobile Money payout number' : 'Add your bank details for payouts', 'Required to receive your earnings.', { label: 'Add Details', section: 'settings', target: '#pds-box' }, 'block', ['requestPayout']));
    // cash work: tokens
    const tokens = require('./tokens');
    const debt = Number(u.tokenDebt || 0);
    if (debt > 0) out.push(item('debt', false, 'Pay outstanding commission', `${debt} tokens owed from a cash job. Cash jobs are paused until it is paid.`, { label: 'Buy Tokens', section: 'tokens', target: '#tok-buy-btn, #tok-code-btn' }, 'block', ['acceptCashJob']));
    const cashOn = (await getSetting('cashJobsEnabled')) !== false;
    if (cashOn) {
      const bal = await tokens.balance(u.id);
      out.push(item('tokens', bal >= 1 || (u.freeCommissionCredits || 0) > 0, 'Buy tokens for cash jobs',
        `Commission on cash jobs is paid with tokens. Balance: ${bal}.`, { label: 'Buy Tokens', section: 'tokens', target: '#tok-buy-btn, #tok-code-btn' }, 'warn', ['acceptCashJob']));
    }
    // a store
    if (u.proMode === 'goods' || u.proMode === 'both' || u.store) {
      const st = u.store || {};
      const approved = st.approval && st.approval.status === 'approved';
      out.push(item('store', approved && st.open !== false, !st.name ? 'Set up your store' : !approved ? 'Store awaiting approval' : 'Open your store',
        !st.name ? 'Add a store name and details for approval.' : !approved ? 'Usually reviewed within 24 hours. We\'ll notify you.' : 'Your store is closed to new orders.',
        { label: !st.name ? 'Set Up Store' : 'Go to Store', section: 'store', target: '.panel' }, 'block', ['sell']));
      if (approved) {
        const live = await db.filter('storeGoods', g => g.providerId === u.id && g.status === 'approved' && g.forSale !== false);
        out.push(item('goods', live.length > 0, 'Add goods to your store', 'No approved goods are on sale yet.', { label: 'Add Goods', section: 'store', target: '.panel' }, 'warn', ['sell']));
      }
    }
    // a driver
    const rd = u.rideDriver;
    if (rd) {
      out.push(item('driver', rd.status === 'approved', rd.status === 'pending' ? 'Driver application under review' : 'Apply to drive', rd.status === 'pending' ? 'We\'ll notify you once it is approved.' : 'Submit your driver application in Rides.', { label: 'Open Rides', section: 'rides', target: '.panel' }, 'block', ['goOnline']));
      const on = (await getSetting('rideEnabledCountries')) || [];
      out.push(item('ride_country', on.some(c => sameText(c, u.country)), 'Rides not available yet', `Rides aren't available in ${u.country || 'your country'} yet.`, null, 'block', ['goOnline']));
      for (const [k, label] of [['licenceExpiry', "driver's license"], ['insuranceExpiry', 'vehicle insurance']]) {
        if (!rd[k]) continue;
        const left = daysTo(rd[k]);
        if (left < 0) out.push(item('ride_' + k, false, `Renew your ${label}`, `Expired on ${fmtDate(rd[k])}. Upload the new one to drive again.`, { label: 'Update Documents', section: 'rides', target: '.panel' }, 'block', ['goOnline']));
        else if (left <= 14) out.push(item('ride_' + k + '_soon', false, `${label[0].toUpperCase() + label.slice(1)} expires soon`, `Expires in ${left} day${left === 1 ? '' : 's'}.`, { label: 'Update Documents', section: 'rides', target: '.panel' }, 'warn', ['goOnline']));
      }
      if (rd.acceptsCash && (await getSetting('rideCashEnabled')) === true) {
        const ready = await tokens.cashReady(u, 5, { ride: true });
        out.push(item('ride_cash', ready.ok, 'Buy tokens or a Driver Pass', 'Required to accept cash rides.', { label: 'Buy Tokens', section: 'tokens', target: '#tok-buy-btn, #tok-code-btn' }, 'warn', ['goOnline']));
      }
    }
  }
  out.push(item('twofa', u.twoFactorEnabled === true, 'Turn on two-step verification', 'Adds a code at sign-in for extra security.', { label: 'Turn On', section: 'settings', target: 'panel:Two-Factor Authentication' }, 'warn', []));
  if (cust) {
    const realOn = (await getSetting('realPaymentsOnly')) === true;
    const africa = require('./payout-methods').isAfrica(u.country);
    if (realOn && africa) {
      const mm = await db.find('paymentMethods', m => m.userId === u.id && m.type === 'mobile_money');
      out.push(item('wallet', !!mm, 'Save your Mobile Money number', 'For faster checkout and refunds.', { label: 'Add Number', section: 'payments', run: 'openAddPaymentMethodForm', target: '#pm-mobile-money-number' }, 'warn', ['book', 'buy']));
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
