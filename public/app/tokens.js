/* Trothen Tokens for pros (v115-v118).
   Loaded after trothen.js and rides.js. Adds:
     - a "Tokens" page for pros: balance, buy packs (in the app or with a
       mobile money payment code), what tokens pay for, history
     - a "Tokens" page for admins: totals, job fee, packs and limits per
       country, mobile money codes, look up and adjust a pro
   Tokens only ever pay what a pro owes Trothen. Customers and escrow are
   not touched.
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
  const isPro = () => !!(BACKEND_AVAILABLE && AUTH.user && AUTH.user.role === 'provider');

  async function loadMe(force) {
    if (!isPro()) return null;
    if (T.me && !force) return T.me;
    if (T.loading && !force) return T.loading;
    T.loading = apiFetch('GET', '/tokens/me').then(r => { T.me = r; if (AUTH.user) AUTH.user.tokenBalance = r.balance; return r; }).catch(() => null).finally(() => { T.loading = null; });
    return T.loading;
  }

  // If the server says the balance is too short, offer to go and buy.
  async function shortBalance(x) {
    if (!x || !x.data || x.data.code !== 'TOKENS_SHORT') return false;
    loadMe(true);
    if (await confirmDialog(`${x.message} ${tr('Open your tokens to buy more?')}`, { confirmLabel: tr('Buy tokens') })) window.openTokensPage();
    return true;
  }
  window.tokenShortBalance = shortBalance;
  window.openTokensPage = function () { if (typeof selectProviderSection === 'function') selectProviderSection('tokens'); };

  // ── PRO: the Tokens page ─────────────────────────────────────────────
  function addNav(items, afterKey, item) {
    if (items.some(i => i.key === item.key)) return;
    const at = items.findIndex(i => i.key === afterKey);
    items.splice(at === -1 ? items.length : at + 1, 0, item);
  }
  addNav(PROVIDER_NAV_ITEMS, 'earnings', { key: 'tokens', label: 'Tokens', icon: '🪙' });
  PROVIDER_SECTIONS.tokens = () => `<div class="dash-header"><div><div class="dash-title">🪙 ${e(tr('Tokens'))}</div><div class="dash-sub">${e(tr('Top up once, then pay what you owe Trothen from your balance'))}</div></div></div><div id="tokens-body"><div class="panel">${e(tr('Loading…'))}</div></div>`;
  { const f = selectProviderSection; selectProviderSection = function (key) { const r = f.apply(this, arguments); if (key === 'tokens') drawCustomerPage(true); return r; }; }

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
      <button class="confirm-btn" id="tok-buy-btn" onclick="tokensBuy()">🔒 ${e(tr('Pay'))} ${e(main(chosen))} ${e(tr('in the app'))}</button>
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">${e(tr('Paid with your usual payment method.'))} ${e(tr('If your connection drops, just press Pay again: you will not be charged twice.'))}</div>
      ${me.canPayByCode ? `<div style="text-align:center;color:var(--slate);font-size:13px;margin:12px 0 8px;">${e(tr('or'))}</div>
      <button class="btn-sm btn-sm-outline" style="width:100%;padding:12px;font-size:15px;" id="tok-code-btn" onclick="tokensGetCode()">📱 ${e(tr('Send mobile money myself: get a payment code'))}</button>
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">${e(tr('Trothen gives you a code. You send'))} ${e(main(chosen))} ${e(tr('to Trothen\'s mobile money number with the code in the reference, and your tokens are added once the payment is checked.'))}</div>` : ''}
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
      ${codesHTML(me)}
      ${usesHTML(me)}
      ${!me.verified ? `<div class="ver-note">${e(tr('Verify your identity first to buy tokens. A token balance is stored money, so we need to know who holds it.'))} <a style="color:var(--gold);cursor:pointer;" onclick="selectProviderSection('verification')">${e(tr('Verify now'))}</a></div>` : ''}
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
          <li>${e(tr('1 token pays $1 of what you owe Trothen, so your tokens keep their value even if the exchange rate changes. Bigger packs come with bonus tokens.'))}</li>
          <li>${e(tr('Tokens pay Trothen only: job fees, commission, your plan fee, ads and driver passes. You choose which, above.'))}</li>
          <li>${e(tr('Tokens never touch your customers\' money. A customer still pays for the job into Trothen\'s safe hold (escrow), and it is paid to you when they confirm the job is done, the same as always.'))}</li>
          <li>${e(tr('A job fee comes back to you if the customer cancels, if you cancel for a reason that doesn\'t count against you (for example it became unsafe), or if Trothen cancels the job. An ad you withdraw before it runs, or one that is turned down, is given back too.'))}</li>
          <li>${e(tr('Tokens are for paying on Trothen only. They can\'t be sent to another person, and unused tokens are not paid out as cash unless you arrange it with support.'))}</li>
          <li>${e(tr('To keep your money safe, there is a limit on how many tokens you can hold and buy in a day. Trothen staff will never ask for your PIN or a code.'))}</li>
          <li>${e(tr('Your tokens don\'t expire. Before closing your account, spend them or contact support about the rest.'))}</li>
        </ul>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('History'))}</div>${hist}</div>`;
  }
  const newRequestId = () => { try { return crypto.randomUUID().replace(/-/g, ''); } catch (x) { return Date.now().toString(36) + Math.random().toString(36).slice(2, 12); } };
  window.tokensPickPack = function (id) { T.buyPack = T.buyPack === id ? null : id; T.agree = false; T.requestId = T.buyPack ? newRequestId() : null; drawCustomerPage(false); };
  // What this pro's tokens pay for: the job fee (set by Trothen) and the
  // bills they choose to pay from tokens first.
  const USE_ROWS = [
    ['commission', 'Commission when I cash out', 'Trothen\'s commission is paid from tokens, so you keep the full amount you earned. If your tokens don\'t cover all of it, the rest comes out of the payout as usual.'],
    ['plan', 'My monthly plan fee', 'Paid from tokens as soon as the month\'s invoice is made, instead of from your payouts.'],
    ['ad', 'Ads I place', 'Paid from tokens when your balance covers the whole price; otherwise the usual way.'],
    ['pass', 'Driver passes', 'Paid from tokens when your balance covers the whole price; otherwise the usual way.'],
  ];
  function usesHTML(me) {
    const a = me.autopay || {};
    const jf = me.jobFee;
    const jfWords = jf ? [jf.flatTokens > 0 ? `${n2(jf.flatTokens)} ${tr(jf.flatTokens === 1 ? 'token' : 'tokens')}` : '', jf.percent > 0 ? `${n2(jf.percent)}% ${tr('of the job price')}` : ''].filter(Boolean).join(' + ') + (jf.maxTokens > 0 ? ` (${tr('at most')} ${n2(jf.maxTokens)})` : '') : '';
    const inv = me.planInvoices || [];
    return `<div class="panel"><div class="panel-title">${e(tr('What your tokens pay for'))}</div>
      <div style="padding:10px 12px;border-radius:10px;background:var(--offwhite);margin-bottom:12px;font-size:14px;color:var(--slate);">
        <strong style="color:var(--navy);">${e(tr('Job fee'))}:</strong> ${jf ? `${e(jfWords)} ${e(tr('for each job you accept. It is taken from your tokens when you press Accept, so keep some in your balance.'))}` : e(tr('There is no job fee in your country right now. You can accept jobs without tokens.'))}
      </div>
      <div style="font-size:14px;color:var(--slate);margin-bottom:8px;">${e(tr('Choose what else to pay from your tokens first:'))}</div>
      ${USE_ROWS.map(([k, label, sub]) => `<label style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--border);cursor:pointer;">
        <input type="checkbox" ${a[k] ? 'checked' : ''} onchange="tokensSetAutopay('${k}', this.checked)" style="width:18px;height:18px;margin-top:2px;flex-shrink:0;"/>
        <span><strong style="color:var(--navy);">${e(tr(label))}</strong><br><span style="font-size:12.5px;color:var(--slate);">${e(tr(sub))}</span></span></label>`).join('')}
      ${inv.length ? `<div style="font-weight:700;color:var(--navy);margin:12px 0 6px;">${e(tr('Plan fees you owe'))}</div>
        ${inv.map(i => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--border);">
          <span style="font-size:14px;">${e(i.period)} · ${e(i.plan)} · ${e(tr('owed'))} <strong>${usd(i.owedUsd)}</strong></span>
          <button class="btn-sm btn-sm-primary" onclick="tokensPayInvoice(${jsArg(i.id)})" ${me.balance > 0 ? '' : 'disabled'}>${e(tr('Pay with tokens'))}</button></div>`).join('')}` : ''}
    </div>`;
  }
  window.tokensSetAutopay = async function (key, on) {
    try { const r = await apiFetch('PUT', '/tokens/autopay', { [key]: !!on }); if (T.me) T.me.autopay = r.autopay; showToast(tr('Saved')); }
    catch (x) { showToast(x.message || 'Could not save'); drawCustomerPage(true); }
  };
  window.tokensPayInvoice = async function (id) {
    try { const r = await apiFetch('POST', `/tokens/plan-invoices/${encodeURIComponent(id)}/pay`); showToast(`${tok(r.paid)} ${tr('paid')}${r.left > 0 ? ` · ${usd(r.left)} ${tr('still owed')}` : ''}`); }
    catch (x) { showToast(x.message || 'Could not pay'); }
    drawCustomerPage(true);
  };
  const CODE_STATUS = { awaiting_payment: 'Waiting for your payment', customer_says_paid: 'You said you paid: being checked', paid: 'Paid: tokens added', expired: 'Ran out', cancelled: 'Cancelled', rejected: 'Not matched' };
  function codesHTML(me) {
    const list = (me.codes || []);
    if (!list.length) return '';
    const cur = me.currency;
    const amt = (c) => c.currency && c.currency !== 'USD' ? local(cur.code === c.currency ? cur : { code: c.currency, symbol: '' }, c.amountDue) : usd(c.amountDue);
    return `<div class="panel" style="border-left:4px solid var(--gold);"><div class="panel-title">📱 ${e(tr('Your mobile money payment codes'))}</div>
      ${list.map(c => {
        const open = c.status === 'awaiting_payment';
        return `<div style="border-top:1px solid var(--border);padding:12px 0;">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
            <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:24px;font-weight:800;letter-spacing:.12em;color:var(--navy);">${e(c.code)}</div>
            <span class="badge ${c.status === 'paid' ? 'badge-success' : ['expired', 'cancelled', 'rejected'].includes(c.status) ? '' : 'badge-warn'}">${e(tr(CODE_STATUS[c.status] || c.status))}</span>
          </div>
          <div style="font-size:14px;color:var(--slate);margin-top:4px;">${e(c.packLabel)}: ${e(tok(c.tokens))} · ${e(tr('send exactly'))} <strong style="color:var(--navy);">${e(amt(c))}</strong></div>
          ${open || c.status === 'customer_says_paid' ? `<ol style="margin:8px 0 0;padding-left:20px;font-size:14px;color:var(--slate);line-height:1.6;">
            <li>${e(tr('Send exactly'))} <strong>${e(amt(c))}</strong> ${e(tr('by mobile money to'))} ${(c.payTo || []).map(a => `<strong>${e(a.network)} ${e(a.number)}</strong> (${e(a.accountName)})`).join(' ' + e(tr('or')) + ' ')}.</li>
            <li>${e(tr('Write'))} <strong>${e(c.code)}</strong> ${e(tr('in the reference or note of the transfer.'))}</li>
            <li>${e(tr('Check the name shown before you confirm on your phone. It must be the account name above.'))}</li>
            <li>${e(tr('Then press "I have sent it" below. Your tokens are added once the payment is checked.'))}</li>
          </ol>` : ''}
          ${open ? `<div style="font-size:12.5px;color:var(--muted);margin-top:6px;">${e(tr('This code runs out'))} ${e(new Date(c.expiresAt).toLocaleString())}.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button class="btn-sm btn-sm-outline" onclick="tokensCopyCode(${jsArg(c.code)})">${e(tr('Copy code'))}</button>
            <input class="form-input" style="flex:1;min-width:180px;" id="tkc-tx-${e(c.id)}" maxlength="60" placeholder="${e(tr('Transaction ID from your SMS (optional)'))}"/>
            <button class="btn-sm btn-sm-primary" onclick="tokensCodePaid(${jsArg(c.id)})">${e(tr('I have sent it'))}</button>
            <button class="btn-sm btn-sm-outline" onclick="tokensCodeCancel(${jsArg(c.id)})">${e(tr('Cancel code'))}</button>
          </div>` : ''}
          ${c.status === 'customer_says_paid' ? `<div style="font-size:13px;color:var(--slate);margin-top:6px;">${e(tr('Thank you. The team is checking the payment'))}${c.customerTransactionId ? ` (${e(tr('your transaction ID'))} ${e(c.customerTransactionId)})` : ''}. ${e(tr('You will get a message when your tokens are added.'))}</div>` : ''}
          ${c.status === 'rejected' && c.rejectReason ? `<div style="font-size:13px;color:#B4472E;margin-top:6px;">${e(c.rejectReason)}</div>` : ''}
        </div>`;
      }).join('')}
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">${e(tr('Only send money to the numbers shown here. Trothen will never ask you to send it to any other number or person, or ask for your PIN.'))}</div>
    </div>`;
  }
  window.tokensGetCode = async function () {
    const me = T.me; const p = me && me.packs.find(x => x.id === T.buyPack);
    if (!p) return;
    if (!T.agree) return showToast(tr('Tick the box to say you have read how tokens work'));
    const btn = el('tok-code-btn'); if (btn) { btn.disabled = true; btn.textContent = tr('Making your code…'); }
    try {
      if (!T.requestId) T.requestId = newRequestId();
      const r = await apiFetch('POST', '/tokens/payment-code', { packId: p.id, expectedPrice: p.priceLocal != null ? p.priceLocal : p.priceUsd, agree: true, requestId: T.requestId });
      T.buyPack = null; T.agree = false; T.requestId = null;
      showToast(`${tr('Your payment code is')} ${r.paymentCode.code}`);
    } catch (x) {
      if (!x || !x.data) { showToast(tr('No connection. Check your signal and try again. You will not get two codes.')); if (btn) { btn.disabled = false; btn.textContent = tr('Try again'); } return; }
      if (x.data.code !== 'PRICE_CHANGED') T.requestId = newRequestId();
      showToast(x.message || tr('Could not make a code'));
      if (x.data.code === 'VERIFY_IDENTITY') return selectProviderSection('verification');
    }
    await drawCustomerPage(true);
    const box = el('tokens-body'); if (box) box.scrollIntoView({ behavior: 'smooth' });
  };
  window.tokensCopyCode = async function (code) {
    try { await navigator.clipboard.writeText(code); showToast(tr('Code copied')); } catch (x) { showToast(`${tr('Your code is')} ${code}`); }
  };
  window.tokensCodePaid = async function (id) {
    const tx = ((el('tkc-tx-' + id) || {}).value || '').trim();
    try { await apiFetch('POST', `/tokens/payment-code/${encodeURIComponent(id)}/paid`, { transactionId: tx || undefined }); showToast(tr('Thank you. The team will check the payment.')); }
    catch (x) { showToast(x.message || tr('Could not send')); }
    drawCustomerPage(true);
  };
  window.tokensCodeCancel = async function (id) {
    if (!(await confirmDialog(tr('Cancel this code? Only do this if you have NOT sent the money.'), { confirmLabel: tr('Cancel code'), danger: true }))) return;
    try { await apiFetch('POST', `/tokens/payment-code/${encodeURIComponent(id)}/cancel`); showToast(tr('Code cancelled')); }
    catch (x) { showToast(x.message || tr('Could not cancel')); }
    drawCustomerPage(true);
  };
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
      if (x.data.code === 'VERIFY_IDENTITY') return selectProviderSection('verification');
    }
    drawCustomerPage(true);
  };

  // When accepting a job fails because the job fee can't be paid, offer to
  // open the Tokens page.
  if (typeof apiFetch === 'function') {
    const f = apiFetch;
    apiFetch = async function (method, path) {
      try { return await f.apply(this, arguments); }
      catch (x) {
        if (x && x.data && x.data.code === 'TOKENS_SHORT' && method === 'POST' && /^\/contracts\/[^/]+\/respond-offer/.test(path)) setTimeout(() => shortBalance(x), 1200); // v118: a job fee the pro can't pay yet
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
  if (typeof ADMIN_SECTIONS !== 'undefined') ADMIN_SECTIONS.tokens = () => `<div class="dash-header"><div><div class="dash-title">🪙 ${e(tr('Tokens'))}</div><div class="dash-sub">${e(tr('What pros have bought and spent, the packs on sale, and individual balances'))}</div></div></div><div id="admin-tokens-body"><div class="panel">${e(tr('Loading…'))}</div></div>`;
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
        ${stat('Tokens pros hold now', n2(st.outstandingTokens), `Worth $${n2(st.outstandingTokens).toFixed(2)} of fees Trothen has been paid in advance. ${st.customersWithBalance} pro(s).`)}
        ${stat('Sold, last 30 days', '$' + n2(st.last30.soldUsd).toFixed(2), `${n2(st.last30.tokensSold)} tokens, of which ${n2(st.last30.bonusGiven)} bonus`)}
        ${stat('Spent, last 30 days', n2(st.last30.tokensSpent), `${n2(st.last30.tokensRefunded)} given back on refunds`)}
        ${stat('Sold, all time', '$' + n2(st.allTime.soldUsd).toFixed(2), `${n2(st.allTime.tokensSpent)} tokens spent all time`)}
        ${st.pendingPurchases ? stat('Waiting for mobile money', st.pendingPurchases, 'Purchases not yet confirmed by MTN') : ''}
      </div>
      <div class="ver-note" style="margin-bottom:14px;">${e(tr('Money paid for tokens is not revenue until the tokens are spent. Until then it is a balance Trothen owes its pros. Bonus tokens are a discount Trothen pays for when they are spent.'))}</div>
      <div class="panel"><div class="panel-title">${e(tr('Settings'))}${edit ? '' : ` <small style="font-weight:400;color:var(--slate);">${e(tr('(only a super admin can change these)'))}</small>`}</div>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:8px;"><input type="checkbox" id="tka-enabled" ${s.enabled ? 'checked' : ''} ${edit ? '' : 'disabled'}/> ${e(tr('Tokens are on (pros can buy them and pay Trothen with them)'))}</label>
        ${jobFeeEditor('tka', s.jobFeeDefault, edit, 'Job fee (default for every country)')}
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div class="form-group" style="flex:1;min-width:200px;max-width:280px;"><label class="form-label" for="tka-max">${e(tr('Most tokens one pro can hold'))}</label><input class="form-input" type="number" min="10" max="10000" step="1" id="tka-max" value="${e(s.maxBalance)}" ${edit ? '' : 'disabled'}/></div>
          <div class="form-group" style="flex:1;min-width:200px;max-width:280px;"><label class="form-label" for="tka-day">${e(tr('Most a pro can buy in 24 hours (US$)'))}</label><input class="form-input" type="number" min="1" max="10000" step="1" id="tka-day" value="${e(s.dailyLimitUsd)}" ${edit ? '' : 'disabled'}/></div>
        </div>
        <div class="form-group"><label class="form-label" for="tka-countries">${e(tr('Countries where tokens are on'))} <small style="font-weight:400;color:var(--slate);">${e(tr('comma separated; leave empty for every country'))}</small></label><input class="form-input" id="tka-countries" value="${e((s.countries || []).join(', '))}" placeholder="${e(tr('e.g. Liberia, Ghana, Nigeria, United States'))}" ${edit ? '' : 'disabled'}/></div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('These are the defaults. A country can have its own packs and limits under "Countries" below; Liberia, Ghana and Nigeria start with smaller packs and lower limits.'))}</div>
        <div style="font-weight:700;color:var(--navy);margin:10px 0 6px;">${e(tr('Packs'))}</div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('Price in US dollars. Tokens must be at least the price; anything above it is bonus. Pros see the price in their own currency too.'))}</div>
        <div class="data-table-wrap"><table class="data-table" id="tka-packs"><thead><tr><th>${e(tr('Code'))}</th><th>${e(tr('Name'))}</th><th>${e(tr('Price (US$)'))}</th><th>${e(tr('Tokens'))}</th><th></th></tr></thead><tbody>${s.packs.map(packRow).join('')}</tbody></table></div>
        ${edit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn-sm btn-sm-outline" onclick="tokensAdminAddPack()">+ ${e(tr('Add a pack'))}</button><button class="btn-sm btn-sm-primary" onclick="tokensAdminSave()">${e(tr('Save settings'))}</button></div>` : ''}
      </div>
      <div class="panel" style="border-left:4px solid var(--gold);"><div class="panel-title">📱 ${e(tr('Mobile money payment codes'))}${st.codesToCheck ? ` <span class="badge badge-warn">${st.codesToCheck} ${e(tr('to check'))}</span>` : ''}</div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(tr('Pros who send mobile money themselves get a code from Trothen to put in the reference. Find the payment on Trothen\'s mobile money statement, then confirm it here with Trothen\'s transaction ID and the amount that arrived.'))} ${st.codesWaiting ? e(st.codesWaiting + ' ' + tr('code(s) waiting for payment.')) : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><input class="form-input" style="flex:1;min-width:200px;text-transform:uppercase;" id="tka-code-q" placeholder="${e(tr('Code (e.g. TK7H3M9Q) or the pro\'s transaction ID'))}" onkeydown="if(event.key==='Enter')tokensAdminCodes()"/><button class="btn-sm btn-sm-primary" onclick="tokensAdminCodes()">${e(tr('Find'))}</button><button class="btn-sm btn-sm-outline" onclick="document.getElementById('tka-code-q').value='';tokensAdminCodes()">${e(tr('Show all open'))}</button></div>
        <div id="tka-codes" style="margin-top:10px;"></div>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('Countries'))}</div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(tr('See what pros in one country are offered, in their own money. Give a country its own packs, a fixed local price per pack (for round amounts like L$950 or ₦7,500) and its own limits.'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><select class="form-input form-select" id="tka-country" style="flex:1;min-width:200px;">${['Liberia', 'Ghana', 'Nigeria'].concat((d.countryList || []).filter(c => !['Liberia', 'Ghana', 'Nigeria'].includes(c))).map(c => `<option>${e(c)}</option>`).join('')}</select><button class="btn-sm btn-sm-primary" onclick="tokensAdminCountry()">${e(tr('Show'))}</button></div>
        <div id="tka-country-body" style="margin-top:10px;"></div>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('Look up a pro'))}</div>
        ${d.canRecordPayments ? `<div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(tr('To add tokens for a payment made outside the app (cash, agent, bank deposit or mobile money to Trothen\'s number), find the pro here and use "Record a payment".'))}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><input class="form-input" style="flex:1;min-width:200px;" id="tka-q" placeholder="${e(tr('Email or name'))}" onkeydown="if(event.key==='Enter')tokensAdminLookup()"/><button class="btn-sm btn-sm-primary" onclick="tokensAdminLookup()">${e(tr('Search'))}</button></div>
        <div id="tka-results" style="margin-top:10px;"></div>
      </div>
      <div class="panel"><div class="panel-title">${e(tr('Recent activity'))}</div>
        ${st.recent.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>${e(tr('When'))}</th><th>${e(tr('Pro'))}</th><th>${e(tr('What'))}</th><th>${e(tr('Tokens'))}</th><th>${e(tr('Balance after'))}</th></tr></thead><tbody>
        ${st.recent.map(l => `<tr><td>${e(new Date(l.createdAt).toLocaleString())}</td><td>${e(l.customer)}</td><td>${e(tr(l.what))}${l.packLabel ? ' · ' + e(l.packLabel) + (l.priceUsd != null ? ' (' + usd(l.priceUsd) + ')' : '') : ''}${l.bookingNumber ? ' · #' + e(l.bookingNumber) : ''}${l.note ? `<div style="font-size:12px;color:var(--slate);">${e(l.note)}${l.actorName ? ' · ' + e(tr('by')) + ' ' + e(l.actorName) : ''}</div>` : ''}</td><td style="font-weight:700;color:${l.tokens < 0 ? '#B4472E' : '#2E8C6F'};">${l.tokens > 0 ? '+' : ''}${e(n2(l.tokens))}</td><td>${e(n2(l.balanceAfter))}</td></tr>`).join('')}
        </tbody></table></div>` : `<div style="color:var(--slate);font-size:14px;">${e(tr('No token activity yet.'))}</div>`}
      </div>`;
    window.tokensAdminCodes();
  }
  const ADMIN_CODE_STATUS = { awaiting_payment: 'Waiting for payment', customer_says_paid: 'Pro says paid: check it', paid: 'Confirmed', expired: 'Ran out', cancelled: 'Cancelled by the pro', rejected: 'No payment found' };
  window.tokensAdminCodes = async function () {
    const out = el('tka-codes'); if (!out) return;
    const q = ((el('tka-code-q') || {}).value || '').trim();
    out.textContent = tr('Loading…');
    let r; try { r = await apiFetch('GET', '/admin/tokens/codes' + (q ? '?q=' + encodeURIComponent(q) : '')); } catch (x) { out.innerHTML = `<div class="ver-note">${e(x.message || 'Could not load')}</div>`; return; }
    const can = T.admin && T.admin.canRecordPayments;
    if (!r.codes.length) { out.innerHTML = `<div style="color:var(--slate);font-size:14px;">${e(tr(q ? 'No code or transaction matches that.' : 'No codes waiting.'))}</div>`; return; }
    out.innerHTML = r.codes.map(c => {
      const open = ['awaiting_payment', 'customer_says_paid', 'expired'].includes(c.status);
      return `<div style="border-top:1px solid var(--border);padding:10px 0;">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;">
          <div><span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;font-size:17px;letter-spacing:.08em;color:var(--navy);">${e(c.code)}</span> · <strong>${e(c.currency && c.currency !== 'USD' ? c.currency + ' ' + Number(c.amountDue).toLocaleString() : usd(c.amountDue))}</strong> · ${e(tok(c.tokens))}</div>
          <span class="badge ${c.status === 'customer_says_paid' ? 'badge-warn' : c.status === 'paid' ? 'badge-success' : ''}">${e(tr(ADMIN_CODE_STATUS[c.status] || c.status))}</span>
        </div>
        <div style="font-size:13px;color:var(--slate);margin-top:2px;">${e(c.customer)}${c.phone ? ' · ' + e(c.phone) : ''}${c.country ? ' · ' + e(c.country) : ''} · ${e(tr('made'))} ${e(new Date(c.createdAt).toLocaleString())}${c.customerTransactionId ? ` · ${e(tr('pro\'s transaction ID'))}: <strong>${e(c.customerTransactionId)}</strong>` : ''}${c.receipt ? ` · ${e(tr('confirmed with'))} ${e(c.receipt)} ${e(tr('by'))} ${e(c.recordedByName || '')}` : ''}</div>
        ${can && open ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <input class="form-input" style="flex:1;min-width:170px;" id="tkx-tx-${e(c.code)}" maxlength="60" placeholder="${e(tr('Trothen\'s transaction ID'))}"/>
          <input class="form-input" style="width:150px;" type="number" step="0.01" id="tkx-amt-${e(c.code)}" placeholder="${e(tr('Amount received'))}"/>
          <button class="btn-sm btn-sm-primary" onclick="tokensAdminConfirmCode(${jsArg(c.code)})">${e(tr('Confirm payment'))}</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
          <input class="form-input" style="flex:1;min-width:200px;" id="tkx-why-${e(c.code)}" maxlength="300" placeholder="${e(tr('If no payment found: reason (the pro sees it)'))}"/>
          <button class="btn-sm btn-sm-outline" onclick="tokensAdminRejectCode(${jsArg(c.code)})">${e(tr('No payment found'))}</button>
        </div>` : ''}
      </div>`;
    }).join('');
  };
  window.tokensAdminConfirmCode = async function (code) {
    const tx = ((el('tkx-tx-' + code) || {}).value || '').trim(), amt = Number((el('tkx-amt-' + code) || {}).value);
    if (tx.length < 4) return showToast(tr('Enter the transaction ID from Trothen\'s mobile money statement'));
    if (!(amt > 0)) return showToast(tr('Enter the amount that arrived'));
    if (!(await confirmDialog(`${tr('Confirm code')} ${code} ${tr('with transaction')} ${tx}? ${tr('Only do this once you can see the money on Trothen\'s statement with this code in the reference.')}`, { confirmLabel: tr('Confirm payment') }))) return;
    try { const r = await apiFetch('POST', '/admin/tokens/codes/confirm', { code, transactionId: tx, amountReceived: amt }); showToast(`${tok(r.line.tokens)} ${tr('added')}`); window.tokensAdminCodes(); }
    catch (x) { showToast(x.message || 'Could not confirm'); }
  };
  window.tokensAdminRejectCode = async function (code) {
    const why = ((el('tkx-why-' + code) || {}).value || '').trim();
    if (why.length < 5) return showToast(tr('Type the reason first (at least 5 characters). The pro sees it.'));
    if (!(await confirmDialog(`${tr('Mark code')} ${code} ${tr('as not matched? Reason:')} "${why}"`, { confirmLabel: tr('No payment found'), danger: true }))) return;
    try { await apiFetch('POST', '/admin/tokens/codes/reject', { code, reason: why }); showToast(tr('Pro told')); window.tokensAdminCodes(); }
    catch (x) { showToast(x.message || 'Could not update'); }
  };
  // The job fee: a small number of tokens a pro pays for each job they accept.
  function jobFeeEditor(prefix, f, edit, title) {
    f = f || { enabled: false, flatTokens: 1, percent: 0, maxTokens: 0 };
    const dis = edit ? '' : 'disabled';
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin:10px 0;">
      <div style="font-weight:700;color:var(--navy);margin-bottom:4px;">${e(tr(title))}</div>
      <div style="font-size:12.5px;color:var(--slate);margin-bottom:8px;">${e(tr('Tokens a pro pays when they accept a job (not rides or deliveries). Charged only for jobs the pro actually accepts, and given back if the customer cancels. Keep it small: pros already pay commission on what they earn.'))}</div>
      <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:8px;"><input type="checkbox" id="${prefix}-jf-on" ${f.enabled ? 'checked' : ''} ${dis}/> ${e(tr('Charge a job fee'))}</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;"><label class="form-label" for="${prefix}-jf-flat">${e(tr('Flat tokens per job'))}</label><input class="form-input" style="width:140px;" type="number" min="0" max="100" step="0.5" id="${prefix}-jf-flat" value="${e(f.flatTokens)}" ${dis}/></div>
        <div class="form-group" style="margin:0;"><label class="form-label" for="${prefix}-jf-pct">${e(tr('Plus % of job price'))}</label><input class="form-input" style="width:140px;" type="number" min="0" max="20" step="0.5" id="${prefix}-jf-pct" value="${e(f.percent)}" ${dis}/></div>
        <div class="form-group" style="margin:0;"><label class="form-label" for="${prefix}-jf-max">${e(tr('Most per job (0 = no cap)'))}</label><input class="form-input" style="width:140px;" type="number" min="0" max="200" step="0.5" id="${prefix}-jf-max" value="${e(f.maxTokens)}" ${dis}/></div>
      </div></div>`;
  }
  function readJobFee(prefix) {
    const on = el(prefix + '-jf-on'); if (!on) return undefined;
    return { enabled: !!on.checked, flatTokens: Number((el(prefix + '-jf-flat') || {}).value) || 0, percent: Number((el(prefix + '-jf-pct') || {}).value) || 0, maxTokens: Number((el(prefix + '-jf-max') || {}).value) || 0 };
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
    const body = { enabled: !!(el('tka-enabled') || {}).checked, jobFeeDefault: readJobFee('tka'), maxBalance: Number((el('tka-max') || {}).value), dailyLimitUsd: Number((el('tka-day') || {}).value), countries, packs: readPacks() };
    if (T.admin && T.admin.settings.enabled && !body.enabled && !(await confirmDialog(tr('Turn tokens off? Pros keep their balances but can\'t buy or pay with tokens until you turn them back on.'), { confirmLabel: tr('Turn off') }))) return;
    try { await apiFetch('PATCH', '/admin/tokens/settings', body); showToast(tr('Token settings saved')); drawAdminPage(); }
    catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.tokensAdminLookup = async function () {
    const q = ((el('tka-q') || {}).value || '').trim(), out = el('tka-results'); if (!out) return;
    if (q.length < 3) return showToast(tr('Type at least 3 letters'));
    out.textContent = tr('Searching…');
    let r; try { r = await apiFetch('GET', '/admin/tokens/customer?q=' + encodeURIComponent(q)); } catch (x) { out.innerHTML = `<div class="ver-note">${e(x.message || 'Search failed')}</div>`; return; }
    if (!r.customers.length) { out.innerHTML = `<div style="color:var(--slate);font-size:14px;">${e(tr('No pro found.'))}</div>`; return; }
    const edit = T.admin && T.admin.canEdit;
    out.innerHTML = r.customers.map(c => `<div style="border-top:1px solid var(--border);padding:10px 0;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><div><strong style="color:var(--navy);">${e(c.name)}</strong> <span style="color:var(--slate);font-size:13px;">${e(c.email)}${c.country ? ' · ' + e(c.country) : ''}</span></div><div style="font-weight:800;color:var(--navy);">${e(tok(c.balance))}</div></div>
      ${c.shownBalance != null && Math.abs(c.shownBalance - c.balance) > 0.004 ? `<div class="ver-note">${e(tr('The balance saved on the account differs from the ledger; the ledger figure above is the correct one and is used for every payment.'))}</div>` : ''}
      ${c.history.length ? `<div style="font-size:13px;color:var(--slate);margin-top:6px;">${c.history.slice(0, 8).map(h => `${e(new Date(h.createdAt).toLocaleDateString())} · ${e(tr(h.what))}${h.bookingNumber ? ' #' + e(h.bookingNumber) : ''}: <strong style="color:${h.tokens < 0 ? '#B4472E' : '#2E8C6F'};">${h.tokens > 0 ? '+' : ''}${e(n2(h.tokens))}</strong>${h.note ? ' (' + e(h.note) + ')' : ''}`).join('<br>')}</div>` : ''}
      ${edit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">
        <input class="form-input" style="width:110px;" type="number" step="0.01" id="tka-adj-${e(c.id)}" placeholder="${e(tr('+ or -'))}"/>
        <input class="form-input" style="flex:1;min-width:200px;" id="tka-why-${e(c.id)}" maxlength="300" placeholder="${e(tr('Reason (the pro sees this)'))}"/>
        <button class="btn-sm btn-sm-primary" onclick="tokensAdminAdjust(${jsArg(c.id)})">${e(tr('Change balance'))}</button></div>` : ''}
      ${T.admin && T.admin.canRecordPayments ? `<details style="margin-top:8px;"><summary style="cursor:pointer;color:var(--navy);font-weight:600;font-size:14px;">💵 ${e(tr('Record a payment made outside the app'))}</summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:8px;">
          <select class="form-input form-select" id="tko-method-${e(c.id)}">${Object.entries(T.admin.offlineMethods || {}).map(([k, v]) => `<option value="${e(k)}">${e(tr(v))}</option>`).join('')}</select>
          <select class="form-input form-select" id="tko-pack-${e(c.id)}" onchange="document.getElementById('tko-amt-${e(c.id)}').disabled=!!this.value"><option value="">${e(tr('Custom amount'))}</option>${(c.packs || []).map(p => `<option value="${e(p.id)}">${e(p.label)}: ${e(tok(p.tokens))} for ${e(p.priceLocal != null ? local(c.currency, p.priceLocal) : usd(p.priceUsd))}</option>`).join('')}</select>
          <input class="form-input" type="number" min="0" step="0.01" id="tko-amt-${e(c.id)}" placeholder="${e(tr('Amount paid'))} (${e(c.currency ? c.currency.code : 'USD')})"/>
          <input class="form-input" id="tko-rc-${e(c.id)}" maxlength="60" placeholder="${e(tr('Receipt / transaction no.'))}"/>
        </div>
        <input class="form-input" style="margin-top:8px;" id="tko-note-${e(c.id)}" maxlength="200" placeholder="${e(tr('Note (optional): where it was paid, who took it'))}"/>
        <div style="font-size:12.5px;color:var(--muted);margin:6px 0;">${e(tr('Tokens are worked out from the pack or the amount paid (no bonus on a custom amount). Each receipt number can only be used once. The pro gets a message with the receipt number.'))}</div>
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
      ${r.packs.some(p => p.drifted) ? `<div class="ver-note">${e(tr('A fixed local price is now 5% or more away from today\'s exchange rate. Pros are getting noticeably more (or less) than they pay for. Check the prices marked ⚠️.'))}</div>` : ''}
      <div class="data-table-wrap"><table class="data-table" id="tkc-packs"><thead><tr><th>${e(tr('Code'))}</th><th>${e(tr('Name'))}</th><th>${e(tr('Price (US$)'))}</th><th>${e(tr('Tokens'))}</th>${isUsd ? '' : `<th>${e(tr('Fixed local price'))} (${e(cur.code)})</th><th>${e(tr('Pros pay'))}</th>`}<th></th></tr></thead><tbody>
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
      ${jobFeeEditor('tkc', r.jobFee, edit, `Job fee in ${country}`)}
      <div style="font-weight:700;color:var(--navy);margin:14px 0 4px;">📱 ${e(tr('Trothen\'s mobile money numbers in'))} ${e(country)}</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('Pros who choose "Send mobile money myself" get a code and are told to send to these numbers. Use only official Trothen merchant or business numbers. Leave empty to switch this way of paying off in this country.'))}</div>
      <div class="data-table-wrap"><table class="data-table" id="tkc-momo"><thead><tr><th>${e(tr('Network'))}</th><th>${e(tr('Number'))}</th><th>${e(tr('Account name pros see'))}</th></tr></thead><tbody>
      ${[0, 1, 2, 3].map(i => { const a = (rule.momoAccounts || [])[i] || {}; return `<tr><td><input class="form-input" data-f="network" value="${e(a.network || '')}" placeholder="${i === 0 ? e(tr('e.g. MTN MoMo')) : ''}" ${edit ? '' : 'disabled'}/></td><td><input class="form-input" data-f="number" value="${e(a.number || '')}" ${edit ? '' : 'disabled'}/></td><td><input class="form-input" data-f="accountName" value="${e(a.accountName || '')}" placeholder="${i === 0 ? e(tr('e.g. Trothen Tech Group')) : ''}" ${edit ? '' : 'disabled'}/></td></tr>`; }).join('')}
      </tbody></table></div>
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
      const momoAccounts = [...document.querySelectorAll('#tkc-momo tbody tr')].map(row => ({ network: row.querySelector('[data-f="network"]').value.trim(), number: row.querySelector('[data-f="number"]').value.trim(), accountName: row.querySelector('[data-f="accountName"]').value.trim() })).filter(a => a.network || a.number || a.accountName);
      rule = { country: c.country, enabled: !!(el('tkc-on') || {}).checked, maxBalance: (el('tkc-max') || {}).value, dailyLimitUsd: (el('tkc-day') || {}).value, packs, momoAccounts, jobFee: readJobFee('tkc') };
    }
    try { await apiFetch('PATCH', '/admin/tokens/settings', { countryRule: rule }); showToast(tr('Saved')); window.tokensAdminCountry(); }
    catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.tokensAdminAdjust = async function (userId) {
    const t = Number((el('tka-adj-' + userId) || {}).value), why = ((el('tka-why-' + userId) || {}).value || '').trim();
    if (!t) return showToast(tr('Enter how many tokens to add (or take away, with a minus sign)'));
    if (why.length < 5) return showToast(tr('Say why, in at least 5 characters'));
    if (!(await confirmDialog(`${t > 0 ? tr('Add') : tr('Take away')} ${tok(Math.abs(t))}? ${tr('The pro is told, with your reason, and the change is logged.')}`, { confirmLabel: tr('Change balance'), danger: t < 0 }))) return;
    try { await apiFetch('POST', '/admin/tokens/adjust', { userId, tokens: t, reason: why }); showToast(tr('Balance changed')); window.tokensAdminLookup(); }
    catch (x) { showToast(x.message || 'Could not change the balance'); }
  };
})();
