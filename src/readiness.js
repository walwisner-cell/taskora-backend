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

// level: 'block' = needed (the action can't go ahead); 'warn' = recommended.
// label is what is done ("Profile photo added"); todo is what to do when it
// isn't ("Add a profile photo"). fix.target is the exact place on the page.
const DONE = {
  active: 'Account active', terms: 'Latest Terms accepted', verified: 'ID checked', phone: 'Phone number added', photo: 'Profile photo added',
  category: 'Your work chosen', licence: 'Trade licence in date', licence_soon: 'Trade licence in date', payout: 'Payout details added', debt: 'No commission owed',
  tokens: 'Tokens for cash jobs', store: 'Store approved and open', goods: 'Goods on sale', driver: 'Approved to drive', ride_country: 'Rides run in your country',
  ride_cash: 'Ready for cash rides', wallet: 'Mobile Money saved', price: 'Your price set', portfolio: 'Photos of your work', twofa: 'Two-step sign-in on', location: 'Work location shared',
};
const item = (key, ok, todo, why, fix, level = 'block', actions = []) => ({ key, ok: !!ok, label: DONE[key.replace(/_(licenceExpiry|insuranceExpiry)(_soon)?$/, '_doc')] || DONE[key] || todo, todo, why: ok ? null : why, fix: ok ? null : fix, level, actions });

async function checksFor(u) {
  const out = [];
  if (!u) return out;
  const { CURRENT_TERMS_VERSION } = require('./terms');
  const pro = u.role === 'provider', cust = u.role === 'customer';
  const ALL = ['acceptJob', 'acceptCashJob', 'goOnline', 'requestPayout', 'sell', 'book', 'buy'];

  out.push(item('active', u.active !== false && !u.onHold, u.onHold ? 'Your account is on hold' : 'Your account is suspended',
    u.onHold ? `Your account is on hold${u.holdReason ? `: ${u.holdReason}` : ''}. You can't take new work or sell until it is lifted.` : 'Your account is suspended.',
    { label: 'Contact support', section: 'messages' }, 'block', ALL));
  out.push(item('terms', u.termsVersion === CURRENT_TERMS_VERSION, 'Accept the updated Terms',
    'The Terms changed. You will be asked to accept them before your next booking, sale or job.', { label: 'Read the Terms', section: 'settings', target: '#settings-terms-provider, #settings-terms-customer' }, 'warn', ALL));
  out.push(item('verified', u.verified === true, 'Get your ID checked',
    pro ? 'Customers can only book pros whose ID has been checked, and you can\'t be paid out before it is.' : 'Selling in the Market, and some bookings, need your ID checked.',
    { label: 'Check my ID', section: 'verification', target: '.panel' }, pro ? 'block' : 'warn', pro ? ['acceptJob', 'acceptCashJob', 'goOnline', 'requestPayout', 'sell'] : ['sell']));
  out.push(item('phone', !!String(u.phone || '').trim(), 'Add your phone number',
    'Drivers, pros and customers call each other during a job. Without a number they can only message you.', { label: 'Add my phone', section: 'settings', target: pro ? 'panel:Confirm your phone number' : '#set-cust-phone' }, 'warn', ['acceptJob', 'goOnline', 'book']));

  if (pro) {
    out.push(item('photo', !!u.profilePhotoUrl, 'Add a profile photo',
      'Customers choose pros with a clear photo of their face. It is also how a driver is recognised at pickup.', { label: 'Add a photo', section: 'settings', target: '#prov-profile-photo-preview' }, 'warn', ['acceptJob', 'goOnline']));
    if (u.proMode !== 'goods') out.push(item('category', !!u.category, 'Choose the work you do', 'Without your main kind of work you don\'t appear in search and aren\'t matched to jobs.', { label: 'Choose my work', section: 'settings', target: '#set-prov-category' }, 'block', ['acceptJob']));
    if (u.licenseExpiryDate) {
      const left = daysTo(u.licenseExpiryDate);
      out.push(item('licence', left >= 0, 'Renew your trade licence', `Your licence expired on ${String(u.licenseExpiryDate).slice(0, 10)}. Enter the new expiry date and upload the renewed licence to take jobs that need it.`, { label: 'Update my licence', section: 'settings', target: '#set-prov-license-expiry' }, 'block', ['acceptJob', 'acceptCashJob']));
      if (left >= 0 && left <= 30) out.push(item('licence_soon', false, 'Your trade licence ends soon', `It expires in ${left} day${left === 1 ? '' : 's'}. Renew it now so your work isn't stopped.`, { label: 'Update my licence', section: 'settings', target: '#set-prov-license-expiry' }, 'warn', ['acceptJob']));
    }
    // v150: more of what makes a profile complete (as Thumbtack and TaskRabbit list them)
    if (u.proMode !== 'goods') {
      const hasPrice = Number(u.price) > 0 || (u.pricing && (Number(u.pricing.rate) > 0 || Number(u.pricing.price) > 0));
      out.push(item('price', hasPrice, 'Set your price', 'Customers compare prices before they book. Without one they must ask you first, and many don\'t.', { label: 'Set my price', section: 'settings', target: 'panel:How you charge' }, 'warn', ['acceptJob']));
      const photos = await db.filter('portfolioPhotos', x => x.providerId === u.id);
      out.push(item('portfolio', photos.length >= 3, 'Add photos of your work', `You have ${photos.length} photo${photos.length === 1 ? '' : 's'} of your work. Pros with 3 or more get booked more often.`, { label: 'Add photos', section: 'portfolio', target: '.panel' }, 'warn', []));
      out.push(item('location', u.latitude != null && u.longitude != null, 'Share your work location', 'Nearby customers see how far away you are, and you are matched to jobs close to you.', { label: 'Share my location', section: 'settings', target: 'panel:Service Location' }, 'warn', []));
    }
    // payout details
    const pm = require('./payout-methods');
    const method = u.payoutMethod || (pm.isAfrica(u.country) ? 'Mobile Money' : 'Bank Transfer');
    const payErr = pm.readyToPay(u, method);
    out.push(item('payout', !payErr, method === 'Mobile Money' ? 'Add your Mobile Money number for payouts' : 'Add your bank account for payouts', method === 'Mobile Money' ? 'This is the wallet your earnings are sent to. Until it is added, your money stays with Trothen and can\'t be sent to you.' : 'This is where your earnings are sent. Until it is added, your money stays with Trothen and can\'t be sent to you.', { label: 'Add payout details', section: 'settings', target: '#pds-box' }, 'block', ['requestPayout']));
    // cash work: tokens
    const tokens = require('./tokens');
    const debt = Number(u.tokenDebt || 0);
    if (debt > 0) out.push(item('debt', false, 'Pay the commission you owe', `You owe ${debt} tokens of commission from an earlier cash job. You can't accept cash jobs or cash rides until you buy tokens (what you owe is taken first).`, { label: 'Buy tokens', section: 'tokens', target: '#tok-buy-btn, #tok-code-btn' }, 'block', ['acceptCashJob']));
    const cashOn = (await getSetting('cashJobsEnabled')) !== false;
    if (cashOn) {
      const bal = await tokens.balance(u.id);
      out.push(item('tokens', bal >= 1 || (u.freeCommissionCredits || 0) > 0, 'Buy tokens to take cash jobs',
        `You have ${bal} tokens. When a customer pays you cash, Trothen's commission is paid with tokens when you accept the job. With no tokens, customers can only book you to pay through Trothen.`, { label: 'Buy tokens', section: 'tokens', target: '#tok-buy-btn, #tok-code-btn' }, 'warn', ['acceptCashJob']));
    }
    // a store
    if (u.proMode === 'goods' || u.proMode === 'both' || u.store) {
      const st = u.store || {};
      const approved = st.approval && st.approval.status === 'approved';
      out.push(item('store', approved && st.open !== false, !st.name ? 'Set up your store' : !approved ? 'Your store is waiting for approval' : 'Open your store',
        !st.name ? 'You chose to sell goods, but your store has no name or details yet. Set it up so a manager can approve it and buyers can find it.' : !approved ? 'A manager is checking your store. You will get a notification when it is approved (usually within 24 hours).' : 'Your store is closed, so buyers can\'t order. Open it when you are ready to sell.',
        { label: !st.name ? 'Set up my store' : 'Go to My Store', section: 'store', target: '.panel' }, 'block', ['sell']));
      if (approved) {
        const live = await db.filter('storeGoods', g => g.providerId === u.id && g.status === 'approved' && g.forSale !== false);
        out.push(item('goods', live.length > 0, 'Add goods to your store', 'Your store has nothing approved for sale yet, so buyers see it empty.', { label: 'Add goods', section: 'store', target: '.panel' }, 'warn', ['sell']));
      }
    }
    // a driver
    const rd = u.rideDriver;
    if (rd) {
      out.push(item('driver', rd.status === 'approved', rd.status === 'pending' ? 'Your driver application is being checked' : 'Apply to drive', rd.status === 'pending' ? 'A manager is checking your documents. You will get a notification when you are approved.' : 'You are not approved to drive yet. Send your application in Rides.', { label: 'Open Rides', section: 'rides', target: '.panel' }, 'block', ['goOnline']));
      const on = (await getSetting('rideEnabledCountries')) || [];
      out.push(item('ride_country', on.some(c => sameText(c, u.country)), 'Rides are not open in your country yet', `Rides aren't switched on in ${u.country || 'your country'} yet. You will be told when they are.`, null, 'block', ['goOnline']));
      for (const [k, label] of [['licenceExpiry', 'driving licence'], ['insuranceExpiry', 'vehicle insurance']]) {
        if (!rd[k]) continue;
        const left = daysTo(rd[k]);
        if (left < 0) out.push(item('ride_' + k, false, `Renew your ${label}`, `Your ${label} expired on ${String(rd[k]).slice(0, 10)}. Upload the new one in Rides to drive again.`, { label: 'Update my documents', section: 'rides', target: '.panel' }, 'block', ['goOnline']));
        else if (left <= 14) out.push(item('ride_' + k + '_soon', false, `Your ${label} ends soon`, `It expires in ${left} day${left === 1 ? '' : 's'}. Upload the new one so you aren't stopped.`, { label: 'Update my documents', section: 'rides', target: '.panel' }, 'warn', ['goOnline']));
      }
      if (rd.acceptsCash && (await getSetting('rideCashEnabled')) === true) {
        const ready = await tokens.cashReady(u, 5, { ride: true });
        out.push(item('ride_cash', ready.ok, 'Buy tokens or a Driver Pass for cash rides', 'You said you take cash, but you have no Driver Pass and too few tokens for the commission, so riders paying cash won\'t see you.', { label: 'Buy tokens or a pass', section: 'tokens', target: '#tok-buy-btn, #tok-code-btn' }, 'warn', ['goOnline']));
      }
    }
  }
  out.push(item('twofa', u.twoFactorEnabled === true, 'Turn on two-step sign-in', 'A code is asked for when you sign in, so nobody can get into your account with your password alone.', { label: 'Turn it on', section: 'settings', target: 'panel:Two-Factor Authentication' }, 'warn', []));
  if (cust) {
    const realOn = (await getSetting('realPaymentsOnly')) === true;
    const africa = require('./payout-methods').isAfrica(u.country);
    if (realOn && africa) {
      const mm = await db.find('paymentMethods', m => m.userId === u.id && m.type === 'mobile_money');
      out.push(item('wallet', !!mm, 'Save your Mobile Money number', 'Paying is quicker with it saved, and refunds go straight back to it.', { label: 'Add Mobile Money', section: 'payments', run: 'openAddPaymentMethodForm', target: '#pm-mobile-money-number' }, 'warn', ['book', 'buy']));
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
