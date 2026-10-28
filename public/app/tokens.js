/* Trothen Tokens (v115).
   Loaded after trothen.js and rides.js. Adds:
     - a "Tokens" page for customers (balance, buy packs, history)
     - a "Pay with" choice on the booking form, Post a Job, store checkout and rides
     - a "Tokens" page for admins (totals, packs and limits, look up and adjust a customer)
   The rules live on the server (src/tokens.js, src/routes/tokens.routes.js). */
(function () {
  'use strict';
  const T = { me: null, loading: null, choice: {}, admin: null, buyPack: null, agree: false };
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const el = (id) => document.getElementById(id);
  const n2 = (n) => (Math.round(Number(n || 0) * 100) / 100);
  const tok = (n) => { const v = n2(n); return (Number.isInteger(v) ? String(v) : v.toFixed(2)) + ' ' + tr(Math.abs(v) === 1 ? 'token' : 'tokens'); };
  const usd = (n) => '$' + n2(n).toFixed(2);
  const local = (cur, amount) => (cur && cur.code !== 'USD' && amount != null) ? `${cur.symbol}${Number(amount).toLocaleString()} ${cur.code}` : '';
  const isCustomer = () => !!(BACKEND_AVAILABLE && AUTH.user && AUTH.user.role === 'customer');

  async function loadMe(force) {
    if (!isCustomer()) return null;
    if (T.me && !force) return T.me;
    if (T.loading && !force) return T.loading;
    T.loading = apiFetch('GET', '/tokens/me').then(r => { T.me = r; if (AUTH.user) AUTH.user.tokenBalance = r.balance; return r; }).catch(() => null).finally(() => { T.loading = null; });
    return T.loading;
  }

  // ── "Pay with" choice, shared by every checkout ─────────────────────
  // scope: 'booking' | 'job' | 'checkout' | 'ride'
  window.tokenPayWith = function (scope) {
    const c = T.choice[scope];
    return c === 'tokens' || c === 'tokens_fee' ? c : undefined;
  };
  window.setTokenPayChoice = function (scope, value) {
    T.choice[scope] = value;
    document.querySelectorAll(`[data-tok-scope="${scope}"] label.tok-opt`).forEach(l => {
      const on = l.querySelector('input').value === value;
      l.style.borderColor = on ? 'var(--teal)' : 'var(--border)';
    });
  };
  function choiceHTML(scope, opts) {
    const me = T.me;
    if (!me || !me.enabled) return '';
    opts = opts || {};
    const c = T.choice[scope] || 'normal';
    const none = !(me.balance > 0);
    const line = (value, title, sub, disabled) => `<label class="tok-opt" style="display:flex;gap:10px;align-items:flex-start;border:2px solid ${c === value ? 'var(--teal)' : 'var(--border)'};border-radius:10px;padding:8px 10px;margin-bottom:6px;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? '.55' : '1'};">
        <input type="radio" name="tok-pay-${scope}" value="${value}" ${c === value ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="setTokenPayChoice('${scope}', this.value)" style="width:18px;height:18px;margin-top:2px;flex-shrink:0;"/>
        <span><strong style="color:var(--navy);">${e(tr(title))}</strong>${sub ? `<br><span style="font-size:12.5px;color:var(--slate);">${e(tr(sub))}</span>` : ''}</span></label>`;
    return `<div class="form-group tok-choice" data-tok-scope="${scope}" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <label class="form-label">🪙 ${e(tr('Pay with'))}</label>
      ${line('normal', 'My usual payment method', '')}
      ${line('tokens', 'Tokens: the whole amount', opts.wholeSub || 'The job and the Trothen fee come out of your tokens.', none)}
      ${me.feeOnlyEnabled ? line('tokens_fee', 'Tokens: only the Trothen fee', opts.feeSub || 'The fee comes out of your tokens; the job price is paid the usual way.', none) : ''}
      <div style="font-size:12.5px;color:var(--slate);margin-top:4px;">${e(tr('You have'))} <strong>${e(tok(me.balance))}</strong>${me.balanceLocal != null ? ` (≈ ${e(local(me.currency, me.balanceLocal))})` : ''}. ${e(tr('1 token = $1.'))} <a style="color:var(--gold);cursor:pointer;" onclick="openTokensPage()">${e(tr(none ? 'Buy tokens' : 'Buy more'))}</a>${opts.note ? ' ' + e(tr(opts.note)) : ''}</div>
    </div>`;
  }
  // If the server says the balance is too short, offer to go and buy.
  async function shortBalance(x) {
    if (!x || !x.data || x.data.code !== 'TOKENS_SHORT') return false;
    loadMe(true);
    if (await confirmDialog(`${x.message} ${tr('Open your tokens to buy more?')}`, { confirmLabel: tr('Buy tokens') })) window.openTokensPage();
    return true;
  }
  window.tokenShortBalance = shortBalance;

  window.openTokensPage = async function () {
    try { ['booking-modal', 'postjob-modal'].forEach(id => { const m = el(id); if (m) m.classList.remove('open'); }); } catch (x) { /* nothing open */ }
    try { if (typeof v105Close === 'function') v105Close('store-checkout-overlay'); } catch (x) { /* not open */ }
    if (typeof goToCustomerDashboard === 'function') await goToCustomerDashboard('tokens');
  };

  // Booking form: the choice goes under the loyalty row.
  if (typeof openBooking === 'function') {
    const f = openBooking;
    openBooking = async function () {
      const r = await f.apply(this, arguments);
      try {
        await loadMe(true);
        const row = el('booking-loyalty-row');
        let box = el('tok-choice-booking');
        if (!box && row) { box = document.createElement('div'); box.id = 'tok-choice-booking'; row.insertAdjacentElement('afterend', box); }
        if (box) box.innerHTML = choiceHTML('booking', { note: 'If the job is an offer, the tokens are taken when the pro accepts it.' });
      } catch (x) { /* the form still works without it */ }
      return r;
    };
  }
  // Post a Job: tokens are taken when you hire a pro.
  if (typeof openPostJobModal === 'function') {
    const f = openPostJobModal;
    openPostJobModal = function () {
      const r = f.apply(this, arguments);
      T.choice.job = 'normal';
      loadMe(true).then(() => {
        const body = el('postjob-body');
        if (body && !el('tok-choice-job')) body.insertAdjacentHTML('beforeend', `<div id="tok-choice-job">${choiceHTML('job', { note: 'Tokens are taken when you hire a pro, not now.' })}</div>`);
      });
      return r;
    };
  }
  // Store checkout: redrawn often, so the choice is added after each draw.
  if (typeof drawCheckout === 'function') {
    const f = drawCheckout;
    drawCheckout = function () {
      const r = f.apply(this, arguments);
      try {
        const body = el('co-body');
        if (body && T.me && T.me.enabled && !body.querySelector('[data-tok-scope="checkout"]')) {
          const notes = body.querySelectorAll('.ver-note');
          const last = notes[notes.length - 1];
          const html = choiceHTML('checkout', { wholeSub: 'The goods, any delivery and the Trothen fees come out of your tokens.', feeSub: 'The Trothen fees come out of your tokens; the rest is paid the usual way.' });
          if (last) last.insertAdjacentHTML('beforebegin', html); else body.insertAdjacentHTML('beforeend', html);
        }
      } catch (x) { /* checkout still works */ }
      return r;
    };
  }
  // Rides: the choice sits above the list of drivers.
  if (typeof window.ridesFindDrivers === 'function') {
    const f = window.ridesFindDrivers;
    window.ridesFindDrivers = async function () {
      await loadMe(true);
      const r = await f.apply(this, arguments);
      const out = el('ride-drivers');
      if (out && T.me && T.me.enabled && out.querySelector('button') && !out.querySelector('[data-tok-scope="ride"]')) out.insertAdjacentHTML('afterbegin', choiceHTML('ride', { wholeSub: 'The fare and the Trothen fee come out of your tokens.', feeSub: 'The Trothen fee comes out of your tokens; the fare is paid the usual way.', note: 'Not used for cash rides.' }));
      return r;
    };
  }

  // ── CUSTOMER: the Tokens page ────────────────────────────────────────
  function addNav(items, afterKey, item) {
    if (items.some(i => i.key === item.key)) return;
    const at = items.findIndex(i => i.key === afterKey);
    items.splice(at === -1 ? items.length : at + 1, 0, item);
  }
  addNav(CUSTOMER_NAV_ITEMS, 'payments', { key: 'tokens', label: 'Tokens', icon: '🪙' });
  CUSTOMER_SECTIONS.tokens = () => `<div class="dash-header"><div><div class="dash-title">🪙 ${e(tr('Tokens'))}</div><div class="dash-sub">${e(tr('Top up once, then pay for bookings, rides and store orders from your balance'))}</div></div></div><div id="tokens-body"><div class="panel">${e(tr('Loading…'))}</div></div>`;
  { const f = selectCustomerSection; selectCustomerSection = function (key) { const r = f.apply(this, arguments); if (key === 'tokens') drawCustomerPage(true); return r; }; }

  const KIND_ICON = { purchase: '➕', spend: '➖', refund: '↩️', admin_add: '🛠️', admin_remove: '🛠️' };
  async function drawCustomerPage(force) {
    const box = el('tokens-body'); if (!box) return;
    const me = await loadMe(force);
    if (!me) { box.innerHTML = `<div class="panel">${e(tr('Could not load your tokens. Please refresh.'))}</div>`; return; }
    if (!me.enabled) { box.innerHTML = `<div class="panel">${e(tr('Tokens are not available right now.'))}${me.balance > 0 ? ' ' + e(tr('Your balance is safe:')) + ' <strong>' + e(tok(me.balance)) + '</strong>.' : ''}</div>`; return; }
    const cur = me.currency;
    const hasLocal = cur.code !== 'USD';
    // Where people have their own money, that is the price they see first.
    const main = (p) => p.priceLocal != null ? local(cur, p.priceLocal) : usd(p.priceUsd);
    const second = (p) => p.priceLocal != null ? `≈ ${usd(p.priceUsd)}` : '';
    const pack = (p) => {
      const chosen = T.buyPack === p.id;
      return `<div style="border:2px solid ${chosen ? 'var(--teal)' : 'var(--border)'};border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px;background:var(--white);">
        <div style="font-weight:700;color:var(--navy);">${e(p.label)}</div>
        <div style="font-size:26px;font-weight:800;color:var(--navy);line-height:1.1;">${e(tok(p.tokens))}</div>
        ${p.bonus > 0 ? `<div><span class="badge badge-success">+${e(tok(p.bonus))} ${e(tr('bonus'))}</span></div>` : '<div style="height:20px;"></div>'}
        <div style="font-size:14px;color:var(--slate);">${e(tr('You pay'))} <strong>${e(main(p))}</strong>${second(p) ? ` <span style="font-size:12.5px;">${e(second(p))}</span>` : ''}</div>
        <button class="btn-sm ${chosen ? 'btn-sm-primary' : 'btn-sm-outline'}" onclick="tokensPickPack(${jsArg(p.id)})">${e(tr(chosen ? 'Selected' : 'Choose'))}</button>
      </div>`;
    };
    const chosen = me.packs.find(p => p.id === T.buyPack);
    const leftToday = Math.max(0, n2(me.dailyLimitUsd - me.boughtTodayUsd));
    const buyBox = !chosen ? '' : `<div class="panel" style="border-left:4px solid var(--teal);">
      <div class="panel-title">${e(tr('Buy'))} ${e(chosen.label)}: ${e(tok(chosen.tokens))} ${e(tr('for'))} ${e(main(chosen))}</div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:6px 0 12px;cursor:pointer;"><input type="checkbox" id="tok-agree" ${T.agree ? 'checked' : ''} onchange="tokensAgree(this.checked)" style="margin-top:3px;"/> <span>${e(tr('I have read how tokens work (below): 1 token is worth $1 on Trothen, tokens are for paying on Trothen only, and unused tokens are not paid out as cash except by arrangement with support.'))}</span></label>
      <button class="confirm-btn" id="tok-buy-btn" onclick="tokensBuy()">🔒 ${e(tr('Pay'))} ${e(main(chosen))}</button>
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">${e(tr('Paid with your usual payment method.'))} ${e(tr('If your connection drops, just press Pay again: you will not be charged twice.'))}</div>
    </div>`;
    const hist = me.history.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>${e(tr('Date'))}</th><th>${e(tr('What'))}</th><th>${e(tr('Tokens'))}</th><th>${e(tr('Balance'))}</th></tr></thead><tbody>
      ${me.history.map(h => `<tr><td>${e(new Date(h.createdAt).toLocaleDateString())}</td><td>${KIND_ICON[h.kind] || ''} ${e(tr(h.what))}${h.packLabel ? ' · ' + e(h.packLabel) : ''}${h.kind === 'purchase' && h.priceLocal != null && h.currency && h.currency !== 'USD' ? ' · ' + e(local({ code: h.currency, symbol: h.currency === cur.code ? cur.symbol : '' }, h.priceLocal)) : (h.kind === 'purchase' && h.priceUsd != null ? ' · ' + e(usd(h.priceUsd)) : '')}${h.bookingNumber ? ' · #' + e(h.bookingNumber) : ''}${h.note || h.reference ? `<div style="font-size:12.5px;color:var(--slate);">${h.note ? e(h.note) : ''}${h.note && h.reference ? ' · ' : ''}${h.reference ? e(tr('Ref')) + ' ' + e(h.reference) : ''}</div>` : ''}</td><td style="font-weight:700;color:${h.tokens < 0 ? '#B4472E' : '#2E8C6F'};">${h.tokens > 0 ? '+' : ''}${e(n2(h.tokens))}</td><td>${e(n2(h.balanceAfter))}</td></tr>`).join('')}
      </tbody></table></div>` : `<div style="color:var(--slate);font-size:14px;">${e(tr('Nothing yet. Your purchases and what you spend will show here.'))}</div>`;
    box.innerHTML = `
      <div class="panel" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <div style="font-size:44px;line-height:1;">🪙</div>
        <div style="flex:1;min-width:200px;">
          <div style="font-size:13px;color:var(--slate);text-transform:uppercase;letter-spacing:.04em;">${e(tr('Your balance'))}</div>
          <div style="font-size:34px;font-weight:800;color:var(--navy);line-height:1.15;">${e(tok(me.balance))}</div>
          <div style="font-size:14px;color:var(--slate);">${e(tr('Worth'))} ${hasLocal && me.balanceLocal != null ? `≈ ${e(local(cur, me.balanceLocal))} (${usd(me.balance)})` : usd(me.balance)} ${e(tr('on Trothen'))}</div>
          <div style="font-size:12.5px;color:var(--muted);margin-top:2px;">${hasLocal && me.tokenLocal != null ? `1 ${e(tr('token'))} = $1 ≈ ${e(local(cur, me.tokenLocal))} ${e(tr('today'))} · ` : ''}${e(tr('Most you can hold'))}: ${e(tok(me.maxBalance))} · ${e(tr('You can still buy'))} ${usd(leftToday)} ${e(tr('in the next 24 hours'))}</div>
        </div>
      </div>
      ${me.pending.length ? `<div class="ver-note">${me.pending.map(p => `${e(tr('Waiting for your mobile money payment:'))} ${e(p.packLabel)} (${e(tok(p.tokens))}). ${e(tr('Approve it on your phone. The tokens are added as soon as the payment goes through. If it fails, you are not charged.'))} ${e(tr('Reference'))}: <strong>${e(p.id)}</strong>`).join('<br>')}</div>` : ''}
      ${!me.verified ? `<div class="ver-note">${e(tr('Verify your identity first to buy tokens. A token balance is stored money, so we need to know who holds it.'))} <a style="color:var(--gold);cursor:pointer;" onclick="selectCustomerSection('verification')">${e(tr('Verify now'))}</a></div>` : ''}
      <div class="panel"><div class="panel-title">${e(tr('Buy tokens'))}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">${me.packs.map(pack).join('')}</div>
        ${hasLocal ? `<div style="font-size:12.5px;color:var(--muted);margin-top:10px;">${e(tr('Prices in'))} ${e(cur.name)}. ${e(tr('The dollar amount is a guide at today\'s exchange rate.'))}</div>` : ''}
      </div>
      ${buyBox}
      <div class="panel"><div class="panel-title">${e(tr('No card? Pay in cash or by mobile money'))}</div>
        <div style="font-size:14px;color:var(--slate);line-height:1.6;">${e(tr('You can also pay at a Trothen office or agent, by bank deposit, or by sending mobile money to Trothen\'s own number. Contact support first to get the right details, and keep your receipt or transaction number. Once the payment is checked, the tokens are added to your balance and you get a message with the receipt number. Only pay Trothen staff or agents through these official ways, never a private number.'))}</div>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('How tokens work'))}</div>
        <ul style="margin:0;padding-left:18px;font-size:14px;color:var(--slate);line-height:1.6;">
          <li>${e(tr('1 token is worth $1 when you spend it, so your tokens keep their value even if the exchange rate changes. Bigger packs come with bonus tokens.'))}</li>
          <li>${e(tr('When you book a pro, post a job, buy from a store or request a ride, choose "Pay with: Tokens". Pay the whole amount, or only the Trothen fee.'))}</li>
          <li>${e(tr('Your money is still held safely until the job is done, the same as any other payment.'))}</li>
          <li>${e(tr('If a booking is cancelled, declined, not answered in time or refunded after a dispute, your tokens come back to your balance automatically.'))}</li>
          <li>${e(tr('Tokens are for paying on Trothen only. They can\'t be sent to another person, and unused tokens are not paid out as cash unless you arrange it with support.'))}</li>
          <li>${e(tr('To keep your money safe, there is a limit on how many tokens you can hold and buy in a day. Trothen staff will never ask for your PIN or a code.'))}</li>
          <li>${e(tr('Your tokens don\'t expire. Before closing your account, spend them or contact support about the rest.'))}</li>
        </ul>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('History'))}</div>${hist}</div>`;
  }
  const newRequestId = () => { try { return crypto.randomUUID().replace(/-/g, ''); } catch (x) { return Date.now().toString(36) + Math.random().toString(36).slice(2, 12); } };
  window.tokensPickPack = function (id) { T.buyPack = T.buyPack === id ? null : id; T.agree = false; T.requestId = T.buyPack ? newRequestId() : null; drawCustomerPage(false); };
  window.tokensAgree = function (v) { T.agree = !!v; };
  window.tokensBuy = async function () {
    const me = T.me; const p = me && me.packs.find(x => x.id === T.buyPack);
    if (!p) return;
    if (!T.agree) return showToast(tr('Tick the box to say you have read how tokens work'));
    const btn = el('tok-buy-btn'); if (btn) { btn.disabled = true; btn.textContent = tr('Processing…'); }
    try {
      if (!T.requestId) T.requestId = newRequestId();
      // The same requestId is sent again if this is a retry after a dropped connection, so it is never charged twice.
      const r = await apiFetch('POST', '/tokens/buy', { packId: p.id, expectedPrice: p.priceLocal != null ? p.priceLocal : p.priceUsd, agree: true, requestId: T.requestId });
      T.buyPack = null; T.agree = false; T.requestId = null;
      showToast(r.purchase.status === 'paid' ? `${tok(r.purchase.tokens)} ${tr('added')}. ${tr('Balance')}: ${tok(r.balance)}` : tr('Approve the payment on your phone. Your tokens are added once it goes through.'));
    } catch (x) {
      // No answer from the server (weak signal): keep the same requestId so pressing Pay again is safe.
      if (!x || !x.data) { showToast(tr('No connection. Check your signal and press Pay again. You will not be charged twice.')); const b2 = el('tok-buy-btn'); if (b2) { b2.disabled = false; b2.textContent = tr('Pay again'); } return; }
      if (x.data.code !== 'PRICE_CHANGED') T.requestId = newRequestId(); // a refused purchase can be tried fresh
      showToast(x.message || tr('Could not buy tokens'));
      if (x.data.code === 'VERIFY_IDENTITY') return selectCustomerSection('verification');
    }
    drawCustomerPage(true);
  };

  // Wrap the booking/job/checkout/ride calls' error handling: when the
  // server says the balance is short, offer to open the Tokens page.
  if (typeof apiFetch === 'function') {
    const f = apiFetch;
    apiFetch = async function (method, path) {
      try { return await f.apply(this, arguments); }
      catch (x) {
        if (x && x.data && x.data.code === 'TOKENS_SHORT' && method === 'POST' && /^\/(contracts|store\/orders|rides|jobs\/[^/]+\/select-provider)/.test(path)) setTimeout(() => shortBalance(x), 1200);
        throw x;
      }
    };
  }

  // ── ADMIN: the Tokens page ───────────────────────────────────────────
  const VIEW_DEPTS = ['customer_service', 'financial', 'accountant', 'controller'];
  const adminCanView = () => !!(AUTH.user && AUTH.user.role === 'admin' && (AUTH.user.isSuperAdmin || VIEW_DEPTS.includes(AUTH.user.adminDepartment)));
  if (typeof getAdminNavItems === 'function') {
    const f = getAdminNavItems;
    getAdminNavItems = function () {
      const items = f.apply(this, arguments).slice();
      if (adminCanView()) addNav(items, items.some(i => i.key === 'payments') ? 'payments' : 'disputes', { key: 'tokens', label: 'Tokens', icon: '🪙' });
      return items;
    };
  }
  if (typeof ADMIN_SECTIONS !== 'undefined') ADMIN_SECTIONS.tokens = () => `<div class="dash-header"><div><div class="dash-title">🪙 ${e(tr('Tokens'))}</div><div class="dash-sub">${e(tr('What customers have bought and spent, the packs on sale, and individual balances'))}</div></div></div><div id="admin-tokens-body"><div class="panel">${e(tr('Loading…'))}</div></div>`;
  if (typeof selectAdminSection === 'function') { const f = selectAdminSection; selectAdminSection = function (key) { const r = f.apply(this, arguments); if (key === 'tokens') drawAdminPage(); return r; }; }

  async function drawAdminPage() {
    const box = el('admin-tokens-body'); if (!box) return;
    let d; try { d = await apiFetch('GET', '/admin/tokens'); } catch (x) { box.innerHTML = `<div class="panel">${e(x.message || 'Could not load tokens')}</div>`; return; }
    T.admin = d;
    const s = d.settings, st = d.stats, edit = d.canEdit;
    const stat = (label, value, sub) => `<div class="panel" style="margin:0;"><div style="font-size:12.5px;color:var(--slate);">${e(tr(label))}</div><div style="font-size:24px;font-weight:800;color:var(--navy);">${e(value)}</div>${sub ? `<div style="font-size:12px;color:var(--muted);">${e(tr(sub))}</div>` : ''}</div>`;
    const packRow = (p, i) => `<tr data-pack-row="${i}">
      <td><input class="form-input" style="min-width:80px;" data-f="id" value="${e(p.id)}" ${edit ? '' : 'disabled'}/></td>
      <td><input class="form-input" style="min-width:110px;" data-f="label" value="${e(p.label)}" ${edit ? '' : 'disabled'}/></td>
      <td><input class="form-input" style="min-width:80px;" type="number" min="0.5" step="0.01" data-f="priceUsd" value="${e(p.priceUsd)}" ${edit ? '' : 'disabled'}/></td>
      <td><input class="form-input" style="min-width:80px;" type="number" min="0.5" step="0.01" data-f="tokens" value="${e(p.tokens)}" ${edit ? '' : 'disabled'}/></td>
      <td>${edit ? `<button class="btn-sm btn-sm-outline" onclick="tokensAdminRemovePack(${i})">${e(tr('Remove'))}</button>` : ''}</td></tr>`;
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
        ${stat('Tokens customers hold now', n2(st.outstandingTokens), `Worth $${n2(st.outstandingTokens).toFixed(2)} of bookings Trothen still owes. ${st.customersWithBalance} customer(s).`)}
        ${stat('Sold, last 30 days', '$' + n2(st.last30.soldUsd).toFixed(2), `${n2(st.last30.tokensSold)} tokens, of which ${n2(st.last30.bonusGiven)} bonus`)}
        ${stat('Spent, last 30 days', n2(st.last30.tokensSpent), `${n2(st.last30.tokensRefunded)} given back on refunds`)}
        ${stat('Sold, all time', '$' + n2(st.allTime.soldUsd).toFixed(2), `${n2(st.allTime.tokensSpent)} tokens spent all time`)}
        ${st.pendingPurchases ? stat('Waiting for mobile money', st.pendingPurchases, 'Purchases not yet confirmed by MTN') : ''}
      </div>
      <div class="ver-note" style="margin-bottom:14px;">${e(tr('Money paid for tokens is not revenue until the tokens are spent. Until then it is a balance Trothen owes its customers. Bonus tokens are a discount Trothen pays for when they are spent.'))}</div>
      <div class="panel"><div class="panel-title">${e(tr('Settings'))}${edit ? '' : ` <small style="font-weight:400;color:var(--slate);">${e(tr('(only a super admin can change these)'))}</small>`}</div>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:8px;"><input type="checkbox" id="tka-enabled" ${s.enabled ? 'checked' : ''} ${edit ? '' : 'disabled'}/> ${e(tr('Tokens are on (customers can buy and pay with them)'))}</label>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:8px;"><input type="checkbox" id="tka-feeonly" ${s.feeOnlyEnabled ? 'checked' : ''} ${edit ? '' : 'disabled'}/> ${e(tr('Customers may use tokens for the Trothen fee only'))}</label>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div class="form-group" style="flex:1;min-width:200px;max-width:280px;"><label class="form-label" for="tka-max">${e(tr('Most tokens one customer can hold'))}</label><input class="form-input" type="number" min="10" max="10000" step="1" id="tka-max" value="${e(s.maxBalance)}" ${edit ? '' : 'disabled'}/></div>
          <div class="form-group" style="flex:1;min-width:200px;max-width:280px;"><label class="form-label" for="tka-day">${e(tr('Most a customer can buy in 24 hours (US$)'))}</label><input class="form-input" type="number" min="1" max="10000" step="1" id="tka-day" value="${e(s.dailyLimitUsd)}" ${edit ? '' : 'disabled'}/></div>
        </div>
        <div class="form-group"><label class="form-label" for="tka-countries">${e(tr('Countries where tokens are on'))} <small style="font-weight:400;color:var(--slate);">${e(tr('comma separated; leave empty for every country'))}</small></label><input class="form-input" id="tka-countries" value="${e((s.countries || []).join(', '))}" placeholder="${e(tr('e.g. Liberia, Ghana, Nigeria, United States'))}" ${edit ? '' : 'disabled'}/></div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('These are the defaults. A country can have its own packs and limits under "Countries" below; Liberia, Ghana and Nigeria start with smaller packs and lower limits.'))}</div>
        <div style="font-weight:700;color:var(--navy);margin:10px 0 6px;">${e(tr('Packs'))}</div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('Price in US dollars. Tokens must be at least the price; anything above it is bonus. Customers see the price in their own currency too.'))}</div>
        <div class="data-table-wrap"><table class="data-table" id="tka-packs"><thead><tr><th>${e(tr('Code'))}</th><th>${e(tr('Name'))}</th><th>${e(tr('Price (US$)'))}</th><th>${e(tr('Tokens'))}</th><th></th></tr></thead><tbody>${s.packs.map(packRow).join('')}</tbody></table></div>
        ${edit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn-sm btn-sm-outline" onclick="tokensAdminAddPack()">+ ${e(tr('Add a pack'))}</button><button class="btn-sm btn-sm-primary" onclick="tokensAdminSave()">${e(tr('Save settings'))}</button></div>` : ''}
      </div>
      <div class="panel"><div class="panel-title">${e(tr('Countries'))}</div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(tr('See what customers in one country are offered, in their own money. Give a country its own packs, a fixed local price per pack (for round amounts like L$950 or ₦7,500) and its own limits.'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><select class="form-input form-select" id="tka-country" style="flex:1;min-width:200px;">${['Liberia', 'Ghana', 'Nigeria'].concat((d.countryList || []).filter(c => !['Liberia', 'Ghana', 'Nigeria'].includes(c))).map(c => `<option>${e(c)}</option>`).join('')}</select><button class="btn-sm btn-sm-primary" onclick="tokensAdminCountry()">${e(tr('Show'))}</button></div>
        <div id="tka-country-body" style="margin-top:10px;"></div>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('Look up a customer'))}</div>
        ${d.canRecordPayments ? `<div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(tr('To add tokens for a payment made outside the app (cash, agent, bank deposit or mobile money to Trothen\'s number), find the customer here and use "Record a payment".'))}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><input class="form-input" style="flex:1;min-width:200px;" id="tka-q" placeholder="${e(tr('Email or name'))}" onkeydown="if(event.key==='Enter')tokensAdminLookup()"/><button class="btn-sm btn-sm-primary" onclick="tokensAdminLookup()">${e(tr('Search'))}</button></div>
        <div id="tka-results" style="margin-top:10px;"></div>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('Recent activity'))}</div>
        ${st.recent.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>${e(tr('When'))}</th><th>${e(tr('Customer'))}</th><th>${e(tr('What'))}</th><th>${e(tr('Tokens'))}</th><th>${e(tr('Balance after'))}</th></tr></thead><tbody>
        ${st.recent.map(l => `<tr><td>${e(new Date(l.createdAt).toLocaleString())}</td><td>${e(l.customer)}</td><td>${e(tr(l.what))}${l.packLabel ? ' · ' + e(l.packLabel) + (l.priceUsd != null ? ' (' + usd(l.priceUsd) + ')' : '') : ''}${l.bookingNumber ? ' · #' + e(l.bookingNumber) : ''}${l.note ? `<div style="font-size:12px;color:var(--slate);">${e(l.note)}${l.actorName ? ' · ' + e(tr('by')) + ' ' + e(l.actorName) : ''}</div>` : ''}</td><td style="font-weight:700;color:${l.tokens < 0 ? '#B4472E' : '#2E8C6F'};">${l.tokens > 0 ? '+' : ''}${e(n2(l.tokens))}</td><td>${e(n2(l.balanceAfter))}</td></tr>`).join('')}
        </tbody></table></div>` : `<div style="color:var(--slate);font-size:14px;">${e(tr('No token activity yet.'))}</div>`}
      </div>`;
  }
  function readPacks() {
    return [...document.querySelectorAll('#tka-packs tbody tr')].map(tr_ => {
      const g = (f) => tr_.querySelector(`[data-f="${f}"]`).value;
      return { id: g('id').trim().toLowerCase(), label: g('label').trim(), priceUsd: Number(g('priceUsd')), tokens: Number(g('tokens')) };
    });
  }
  window.tokensAdminAddPack = function () {
    const tb = document.querySelector('#tka-packs tbody'); if (!tb) return;
    const i = tb.children.length;
    tb.insertAdjacentHTML('beforeend', `<tr data-pack-row="${i}"><td><input class="form-input" data-f="id" placeholder="code"/></td><td><input class="form-input" data-f="label" placeholder="${e(tr('Name'))}"/></td><td><input class="form-input" type="number" min="0.5" step="0.01" data-f="priceUsd"/></td><td><input class="form-input" type="number" min="0.5" step="0.01" data-f="tokens"/></td><td><button class="btn-sm btn-sm-outline" onclick="this.closest('tr').remove()">${e(tr('Remove'))}</button></td></tr>`);
  };
  window.tokensAdminRemovePack = function (i) { const row = document.querySelector(`#tka-packs tr[data-pack-row="${i}"]`); if (row) row.remove(); };
  window.tokensAdminSave = async function () {
    const countries = ((el('tka-countries') || {}).value || '').split(',').map(x => x.trim()).filter(Boolean);
    const body = { enabled: !!(el('tka-enabled') || {}).checked, feeOnlyEnabled: !!(el('tka-feeonly') || {}).checked, maxBalance: Number((el('tka-max') || {}).value), dailyLimitUsd: Number((el('tka-day') || {}).value), countries, packs: readPacks() };
    if (T.admin && T.admin.settings.enabled && !body.enabled && !(await confirmDialog(tr('Turn tokens off? Customers keep their balances but can\'t buy or pay with tokens until you turn them back on.'), { confirmLabel: tr('Turn off') }))) return;
    try { await apiFetch('PATCH', '/admin/tokens/settings', body); showToast(tr('Token settings saved')); drawAdminPage(); }
    catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.tokensAdminLookup = async function () {
    const q = ((el('tka-q') || {}).value || '').trim(), out = el('tka-results'); if (!out) return;
    if (q.length < 3) return showToast(tr('Type at least 3 letters'));
    out.textContent = tr('Searching…');
    let r; try { r = await apiFetch('GET', '/admin/tokens/customer?q=' + encodeURIComponent(q)); } catch (x) { out.innerHTML = `<div class="ver-note">${e(x.message || 'Search failed')}</div>`; return; }
    if (!r.customers.length) { out.innerHTML = `<div style="color:var(--slate);font-size:14px;">${e(tr('No customer found.'))}</div>`; return; }
    const edit = T.admin && T.admin.canEdit;
    out.innerHTML = r.customers.map(c => `<div style="border-top:1px solid var(--border);padding:10px 0;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><div><strong style="color:var(--navy);">${e(c.name)}</strong> <span style="color:var(--slate);font-size:13px;">${e(c.email)}${c.country ? ' · ' + e(c.country) : ''}</span></div><div style="font-weight:800;color:var(--navy);">${e(tok(c.balance))}</div></div>
      ${c.shownBalance != null && Math.abs(c.shownBalance - c.balance) > 0.004 ? `<div class="ver-note">${e(tr('The balance saved on the account differs from the ledger; the ledger figure above is the correct one and is used for every payment.'))}</div>` : ''}
      ${c.history.length ? `<div style="font-size:13px;color:var(--slate);margin-top:6px;">${c.history.slice(0, 8).map(h => `${e(new Date(h.createdAt).toLocaleDateString())} · ${e(tr(h.what))}${h.bookingNumber ? ' #' + e(h.bookingNumber) : ''}: <strong style="color:${h.tokens < 0 ? '#B4472E' : '#2E8C6F'};">${h.tokens > 0 ? '+' : ''}${e(n2(h.tokens))}</strong>${h.note ? ' (' + e(h.note) + ')' : ''}`).join('<br>')}</div>` : ''}
      ${edit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">
        <input class="form-input" style="width:110px;" type="number" step="0.01" id="tka-adj-${e(c.id)}" placeholder="${e(tr('+ or -'))}"/>
        <input class="form-input" style="flex:1;min-width:200px;" id="tka-why-${e(c.id)}" maxlength="300" placeholder="${e(tr('Reason (the customer sees this)'))}"/>
        <button class="btn-sm btn-sm-primary" onclick="tokensAdminAdjust(${jsArg(c.id)})">${e(tr('Change balance'))}</button></div>` : ''}
      ${T.admin && T.admin.canRecordPayments ? `<details style="margin-top:8px;"><summary style="cursor:pointer;color:var(--navy);font-weight:600;font-size:14px;">💵 ${e(tr('Record a payment made outside the app'))}</summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:8px;">
          <select class="form-input form-select" id="tko-method-${e(c.id)}">${Object.entries(T.admin.offlineMethods || {}).map(([k, v]) => `<option value="${e(k)}">${e(tr(v))}</option>`).join('')}</select>
          <select class="form-input form-select" id="tko-pack-${e(c.id)}" onchange="document.getElementById('tko-amt-${e(c.id)}').disabled=!!this.value"><option value="">${e(tr('Custom amount'))}</option>${(c.packs || []).map(p => `<option value="${e(p.id)}">${e(p.label)}: ${e(tok(p.tokens))} for ${e(p.priceLocal != null ? local(c.currency, p.priceLocal) : usd(p.priceUsd))}</option>`).join('')}</select>
          <input class="form-input" type="number" min="0" step="0.01" id="tko-amt-${e(c.id)}" placeholder="${e(tr('Amount paid'))} (${e(c.currency ? c.currency.code : 'USD')})"/>
          <input class="form-input" id="tko-rc-${e(c.id)}" maxlength="60" placeholder="${e(tr('Receipt / transaction no.'))}"/>
        </div>
        <input class="form-input" style="margin-top:8px;" id="tko-note-${e(c.id)}" maxlength="200" placeholder="${e(tr('Note (optional): where it was paid, who took it'))}"/>
        <div style="font-size:12.5px;color:var(--muted);margin:6px 0;">${e(tr('Tokens are worked out from the pack or the amount paid (no bonus on a custom amount). Each receipt number can only be used once. The customer gets a message with the receipt number.'))}</div>
        <button class="btn-sm btn-sm-primary" onclick="tokensAdminOffline(${jsArg(c.id)})">${e(tr('Add tokens for this payment'))}</button>
      </details>` : ''}
    </div>`).join('');
  };
  window.tokensAdminOffline = async function (userId) {
    const g = (k) => (el(`tko-${k}-${userId}`) || {}).value || '';
    const body = { userId, method: g('method'), packId: g('pack') || null, amountPaid: g('pack') ? undefined : Number(g('amt')), receipt: g('rc').trim(), note: g('note').trim() || undefined };
    if (!body.packId && !(body.amountPaid > 0)) return showToast(tr('Choose a pack or enter the amount paid'));
    if (body.receipt.length < 3) return showToast(tr('Enter the receipt or transaction number'));
    if (!(await confirmDialog(`${tr('Add tokens for receipt')} ${body.receipt}? ${tr('Only do this once you have checked the money has really arrived.')}`, { confirmLabel: tr('Add tokens') }))) return;
    try { const r = await apiFetch('POST', '/admin/tokens/offline-topup', body); showToast(`${tok(r.purchase.tokens)} ${tr('added')}`); window.tokensAdminLookup(); }
    catch (x) { showToast(x.message || 'Could not record the payment'); }
  };
  window.tokensAdminCountry = async function () {
    const country = (el('tka-country') || {}).value, out = el('tka-country-body'); if (!out || !country) return;
    out.textContent = tr('Loading…');
    let r; try { r = await apiFetch('GET', '/admin/tokens/country?country=' + encodeURIComponent(country)); } catch (x) { out.innerHTML = `<div class="ver-note">${e(x.message || 'Could not load')}</div>`; return; }
    T.country = r;
    const edit = T.admin && T.admin.canEdit, cur = r.currency, isUsd = cur.code === 'USD';
    const rule = r.rule || {};
    const rows = (rule.packs && rule.packs.length ? rule.packs : r.packs.map(p => ({ id: p.id, label: p.label, priceUsd: p.listUsd, tokens: p.tokens, localPrice: p.fixedLocal ? p.priceLocal : undefined })));
    const shown = (id) => r.packs.find(p => p.id === id) || {};
    out.innerHTML = `
      <div style="font-size:14px;color:var(--slate);margin-bottom:8px;">${e(country)}: ${e(cur.name)} (${e(cur.code)})${isUsd ? '' : ` · $1 = ${e(cur.symbol)}${e(r.rate)} ${e(tr('in the app today'))}`} · ${e(tr(r.enabled ? 'tokens on' : 'tokens off'))} · ${e(tr('hold up to'))} ${e(tok(r.maxBalance))} · ${e(tr('buy up to'))} ${usd(r.dailyLimitUsd)} ${e(tr('a day'))}${r.hasOwnRule ? '' : ' · ' + e(tr('using the defaults'))}</div>
      ${r.packs.some(p => p.drifted) ? `<div class="ver-note">${e(tr('A fixed local price is now 5% or more away from today\'s exchange rate. Customers are getting noticeably more (or less) than they pay for. Check the prices marked ⚠️.'))}</div>` : ''}
      <div class="data-table-wrap"><table class="data-table" id="tkc-packs"><thead><tr><th>${e(tr('Code'))}</th><th>${e(tr('Name'))}</th><th>${e(tr('Price (US$)'))}</th><th>${e(tr('Tokens'))}</th>${isUsd ? '' : `<th>${e(tr('Fixed local price'))} (${e(cur.code)})</th><th>${e(tr('Customers pay'))}</th>`}<th></th></tr></thead><tbody>
      ${rows.map(p => { const sh = shown(p.id); return `<tr>
        <td><input class="form-input" data-f="id" value="${e(p.id)}" ${edit ? '' : 'disabled'}/></td>
        <td><input class="form-input" data-f="label" value="${e(p.label)}" ${edit ? '' : 'disabled'}/></td>
        <td><input class="form-input" type="number" step="0.01" data-f="priceUsd" value="${e(p.priceUsd)}" ${edit ? '' : 'disabled'}/></td>
        <td><input class="form-input" type="number" step="0.01" data-f="tokens" value="${e(p.tokens)}" ${edit ? '' : 'disabled'}/></td>
        ${isUsd ? '' : `<td><input class="form-input" type="number" step="0.01" data-f="localPrice" value="${p.localPrice != null ? e(p.localPrice) : ''}" placeholder="${e(tr('auto'))}" ${edit ? '' : 'disabled'}/></td>
        <td style="white-space:nowrap;">${sh.priceLocal != null ? e(local(cur, sh.priceLocal)) + ' ≈ ' + usd(sh.priceUsd) : '—'}${sh.drifted ? ' ⚠️' : ''}</td>`}
        <td>${edit ? `<button class="btn-sm btn-sm-outline" onclick="this.closest('tr').remove()">${e(tr('Remove'))}</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>
      ${isUsd ? '' : `<div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${e(tr('Leave "Fixed local price" empty to work it out from the exchange rate each day (rounded). Fill it in for a round price that never moves; then check it when the rate changes.'))}</div>`}
      ${edit ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;align-items:flex-end;">
        <label style="display:flex;gap:6px;align-items:center;font-size:14px;"><input type="checkbox" id="tkc-on" ${rule.enabled === false ? '' : 'checked'}/> ${e(tr('Tokens on in this country'))}</label>
        <div class="form-group" style="margin:0;"><label class="form-label" for="tkc-max">${e(tr('Hold up to (tokens)'))}</label><input class="form-input" style="width:140px;" type="number" id="tkc-max" value="${rule.maxBalance != null ? e(rule.maxBalance) : ''}" placeholder="${e(tr('default'))}"/></div>
        <div class="form-group" style="margin:0;"><label class="form-label" for="tkc-day">${e(tr('Buy up to a day (US$)'))}</label><input class="form-input" style="width:140px;" type="number" id="tkc-day" value="${rule.dailyLimitUsd != null ? e(rule.dailyLimitUsd) : ''}" placeholder="${e(tr('default'))}"/></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn-sm btn-sm-outline" onclick="tokensAdminCountryAddPack()">+ ${e(tr('Add a pack'))}</button>
        <button class="btn-sm btn-sm-primary" onclick="tokensAdminCountrySave()">${e(tr('Save'))} ${e(country)}</button>
        ${r.hasOwnRule ? `<button class="btn-sm btn-sm-outline" onclick="tokensAdminCountrySave(true)">${e(tr('Use the defaults instead'))}</button>` : ''}
      </div>` : ''}`;
  };
  window.tokensAdminCountryAddPack = function () {
    const tb = document.querySelector('#tkc-packs tbody'), isUsd = T.country && T.country.currency.code === 'USD'; if (!tb) return;
    tb.insertAdjacentHTML('beforeend', `<tr><td><input class="form-input" data-f="id" placeholder="code"/></td><td><input class="form-input" data-f="label"/></td><td><input class="form-input" type="number" step="0.01" data-f="priceUsd"/></td><td><input class="form-input" type="number" step="0.01" data-f="tokens"/></td>${isUsd ? '' : '<td><input class="form-input" type="number" step="0.01" data-f="localPrice" placeholder="auto"/></td><td></td>'}<td><button class="btn-sm btn-sm-outline" onclick="this.closest('tr').remove()">${e(tr('Remove'))}</button></td></tr>`);
  };
  window.tokensAdminCountrySave = async function (useDefaults) {
    const c = T.country; if (!c) return;
    let rule;
    if (useDefaults === true) rule = { country: c.country, remove: true };
    else {
      const packs = [...document.querySelectorAll('#tkc-packs tbody tr')].map(row => {
        const g = (f) => { const i = row.querySelector(`[data-f="${f}"]`); return i ? i.value : ''; };
        return { id: g('id').trim().toLowerCase(), label: g('label').trim(), priceUsd: Number(g('priceUsd')), tokens: Number(g('tokens')), localPrice: g('localPrice') === '' ? undefined : Number(g('localPrice')) };
      });
      rule = { country: c.country, enabled: !!(el('tkc-on') || {}).checked, maxBalance: (el('tkc-max') || {}).value, dailyLimitUsd: (el('tkc-day') || {}).value, packs };
    }
    try { await apiFetch('PATCH', '/admin/tokens/settings', { countryRule: rule }); showToast(tr('Saved')); window.tokensAdminCountry(); }
    catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.tokensAdminAdjust = async function (userId) {
    const t = Number((el('tka-adj-' + userId) || {}).value), why = ((el('tka-why-' + userId) || {}).value || '').trim();
    if (!t) return showToast(tr('Enter how many tokens to add (or take away, with a minus sign)'));
    if (why.length < 5) return showToast(tr('Say why, in at least 5 characters'));
    if (!(await confirmDialog(`${t > 0 ? tr('Add') : tr('Take away')} ${tok(Math.abs(t))}? ${tr('The customer is told, with your reason, and the change is logged.')}`, { confirmLabel: tr('Change balance'), danger: t < 0 }))) return;
    try { await apiFetch('POST', '/admin/tokens/adjust', { userId, tokens: t, reason: why }); showToast(tr('Balance changed')); window.tokensAdminLookup(); }
    catch (x) { showToast(x.message || 'Could not change the balance'); }
  };
})();
