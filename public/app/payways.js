/* How customers pay for a job (v119).
   Loaded after trothen.js, rides.js and tokens.js. Adds:
     - a "How will you pay?" choice on the booking form and on Post a Job:
         Protected by Trothen (escrow), or Cash to the pro after the job
     - the payment-code screen when a protected booking is paid by code
       (mobile money to Trothen's own number), and "I have sent it"
     - "How much did you pay?" when a customer marks a cash job done
     - an admin "Customer Payments" page: payments to confirm, refunds to send
   The rules live on the server (src/customer-payments.js). */
(function () {
  'use strict';
  const PW = { opts: null, choice: { booking: 'protected', job: 'protected' } };
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const el = (id) => document.getElementById(id);
  const isCustomer = () => !!(BACKEND_AVAILABLE && AUTH.user && AUTH.user.role === 'customer');
  const amountText = (p) => p.currency && p.currency !== 'USD' ? `${p.currency} ${Number(p.amountDue).toLocaleString()}` : `$${Number(p.amountDue).toFixed(2)}`;

  async function loadOpts() {
    if (!isCustomer()) return null;
    try { PW.opts = await apiFetch('GET', '/customer-payments/options'); } catch (x) { PW.opts = null; }
    return PW.opts;
  }

  // ── the choice ───────────────────────────────────────────────────────
  window.setPayWay = function (scope, v) {
    PW.choice[scope] = v;
    document.querySelectorAll(`[data-payway="${scope}"] label.pw-opt`).forEach(l => { l.style.borderColor = l.querySelector('input').value === v ? 'var(--teal)' : 'var(--border)'; });
    const warn = el('pw-cash-warn-' + scope); if (warn) warn.style.display = v === 'cash' ? 'block' : 'none';
    if (scope === 'booking') {
      const btn = document.querySelector('#booking-modal .modal-footer .confirm-btn');
      if (btn) { if (!btn.dataset.pwText) btn.dataset.pwText = btn.textContent; btn.textContent = v === 'cash' ? tr('Confirm cash booking') : btn.dataset.pwText; }
    }
  };
  function choiceHTML(scope) {
    const o = PW.opts; if (!o) return '';
    const c = o.cashJobs ? PW.choice[scope] : 'protected';
    PW.choice[scope] = c;
    const opt = (v, title, sub, badge) => `<label class="pw-opt" style="display:flex;gap:10px;align-items:flex-start;border:2px solid ${c === v ? 'var(--teal)' : 'var(--border)'};border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;">
      <input type="radio" name="pw-${scope}" value="${v}" ${c === v ? 'checked' : ''} onchange="setPayWay('${scope}', this.value)" style="width:18px;height:18px;margin-top:2px;flex-shrink:0;"/>
      <span><strong style="color:var(--navy);">${e(tr(title))}</strong>${badge ? ` <span class="badge badge-success">${e(tr(badge))}</span>` : ''}<br><span style="font-size:13px;color:var(--slate);">${e(tr(sub))}</span></span></label>`;
    const protSub = o.protectedMode === 'code'
      ? 'You pay Trothen by mobile money with a code we give you. We hold the money until you say the job is done. If the pro doesn\'t come or something goes wrong, you get it back.'
      : 'Your payment is held by Trothen until you say the job is done. If the pro doesn\'t come or something goes wrong, you get it back.';
    return `<div class="form-group" data-payway="${scope}" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <label class="form-label">${e(tr('How will you pay?'))}</label>
      ${opt('protected', '🛡️ Protected by Trothen', protSub, 'Recommended')}
      ${o.cashJobs ? opt('cash', '💵 Cash to the pro after the job', 'Nothing to pay now. Pay the pro directly, only once the work is done.') : ''}
      <div id="pw-cash-warn-${scope}" class="ver-note" style="display:${c === 'cash' ? 'block' : 'none'};margin-top:4px;">${e(tr('No Trothen service fee: you pay the pro the job price directly, after the work.'))} ${e(tr('A cash job is not covered by Trothen\'s payment protection: Trothen never holds the money, so it can\'t refund cash. You still get an ID-checked pro, a written agreement, ratings and our dispute team. Never pay before the work is done, and don\'t pay more than agreed in the app.'))}</div>
    </div>`;
  }

  if (typeof openBooking === 'function') {
    const f = openBooking;
    openBooking = async function () {
      const r = await f.apply(this, arguments);
      try {
        PW.choice.booking = 'protected';
        await loadOpts();
        const row = el('booking-loyalty-row');
        let box = el('pw-booking');
        if (!box && row) { box = document.createElement('div'); box.id = 'pw-booking'; row.insertAdjacentElement('afterend', box); }
        if (box) box.innerHTML = choiceHTML('booking');
        setPayWay('booking', PW.choice.booking); // puts the button text back to normal for a new booking
      } catch (x) { /* the form still works: protected */ }
      return r;
    };
  }
  if (typeof openPostJobModal === 'function') {
    const f = openPostJobModal;
    openPostJobModal = function () {
      const r = f.apply(this, arguments);
      PW.choice.job = 'protected';
      loadOpts().then(() => { const body = el('postjob-body'); if (body && !el('pw-job')) body.insertAdjacentHTML('beforeend', `<div id="pw-job">${choiceHTML('job')}</div>`); });
      return r;
    };
  }

  // The booking and job calls carry the choice; their answers can carry a
  // payment code to show.
  if (typeof apiFetch === 'function') {
    const f = apiFetch;
    apiFetch = async function (method, path, body) {
      if (method === 'POST' && isCustomer() && body && typeof body === 'object' && body.payMethod === undefined) {
        if (path === '/contracts') body.payMethod = PW.choice.booking;
        else if (path === '/jobs') body.payMethod = PW.choice.job;
      }
      try {
        const res = await f.apply(this, [method, path, body]);
        if (method === 'POST' && (path === '/contracts' || /^\/jobs\/[^/]+\/select-provider$/.test(path)) && res) {
          if (res.payment) setTimeout(() => { setConfirmWords('code'); showPaymentCode(res.contract, res.payment); }, 500);
          else if (res.contract && res.contract.payMethod === 'cash') setTimeout(() => { setConfirmWords('cash'); fixConfirmForCash(); }, 300);
          else setTimeout(() => setConfirmWords('normal'), 300);
        }
        return res;
      } catch (x) { throw x; }
    };
  }
  // The booking confirmation screen's heading and line, for each way of paying.
  const CONFIRM_WORDS = {
    code: ['Booking created: waiting for your payment', 'Send the payment with your code. Trothen holds it until you say the job is done, and your pro is asked to confirm once we see it.'],
    cash: ['Cash booking sent', 'Your pro will confirm shortly. You pay them directly, only after the work is done. Trothen does not hold this money.'],
  };
  function setConfirmWords(kind) {
    const card = document.querySelector('#screen-confirm .confirm-card'); if (!card) return;
    const h = card.querySelector('h2'), p = card.querySelector('p');
    if (h && !h.dataset.pwOrig) { h.dataset.pwOrig = h.textContent; if (p) p.dataset.pwOrig = p.textContent; }
    const w = CONFIRM_WORDS[kind];
    if (h) h.textContent = w ? tr(w[0]) : h.dataset.pwOrig;
    if (p) p.textContent = w ? tr(w[1]) : p.dataset.pwOrig;
  }
  // The booking confirmation says "Escrow held"; on a cash job nothing is held.
  function fixConfirmForCash() {
    const box = el('confirm-details'); if (!box) return;
    box.querySelectorAll('.confirm-detail').forEach(row => {
      const label = row.querySelector('span');
      if (!label) return;
      if (/Escrow held/i.test(label.textContent)) { label.textContent = tr('Payment'); row.querySelector('strong').textContent = tr('Cash to the pro, after the job'); }
      if (/Fees to Trothen|Total charged/i.test(label.textContent)) row.remove();
    });
    box.insertAdjacentHTML('beforeend', `<div class="ver-note" style="margin-top:10px;">${e(tr('Cash job: pay the pro only once the work is done, and only the agreed price. Trothen does not hold this money.'))}</div>`);
  }

  // ── the payment code ─────────────────────────────────────────────────
  function codeBoxHTML(contract, p) {
    return `<div style="text-align:center;margin:6px 0 12px;"><div style="font-size:13px;color:var(--slate);">${e(tr('Your payment code'))}</div>
        <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:800;letter-spacing:.14em;color:var(--navy);">${e(p.code)}</div></div>
      <ol style="margin:0;padding-left:20px;font-size:14.5px;color:var(--slate);line-height:1.7;">
        <li>${e(tr('Send exactly'))} <strong style="color:var(--navy);">${e(amountText(p))}</strong> ${e(tr('by mobile money to'))} ${(p.payTo || []).map(a => `<strong>${e(a.network)} ${e(a.number)}</strong> (${e(a.accountName)})`).join(' ' + e(tr('or')) + ' ')}.</li>
        <li>${e(tr('Write'))} <strong>${e(p.code)}</strong> ${e(tr('in the reference or note.'))}</li>
        <li>${e(tr('Check the name on your phone before you confirm. It must be the account name above.'))}</li>
        <li>${e(tr('Press "I have sent it". Your pro is asked to confirm once we see your payment.'))}</li>
      </ol>
      <div style="font-size:12.5px;color:var(--muted);margin-top:8px;">${e(tr('If you don\'t pay by'))} ${e(new Date(p.expiresAt).toLocaleString())}, ${e(tr('the booking is cancelled. Trothen will never ask you to pay any other number or person, or for your PIN.'))}</div>
      ${p.customerSaysPaidAt ? `<div class="ver-note" style="margin-top:10px;">${e(tr('Thank you. You told us you have paid. The team is checking it, and you will get a message.'))}</div>` : `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <input class="form-input" style="flex:1;min-width:180px;" id="pw-tx-${e(contract.id)}" maxlength="60" placeholder="${e(tr('Transaction ID from your SMS (optional)'))}"/>
        <button class="btn-sm btn-sm-primary" onclick="payWaysSent(${jsArg(contract.id)})">${e(tr('I have sent it'))}</button>
        <button class="btn-sm btn-sm-outline" onclick="payWaysCopy(${jsArg(p.code)})">${e(tr('Copy code'))}</button>
      </div>`}`;
  }
  function showPaymentCode(contract, p) {
    const old = el('pw-code-overlay'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="pw-code-overlay"><div class="modal">
      <div class="modal-header"><button class="modal-close" onclick="document.getElementById('pw-code-overlay').remove()">✕</button>
        <h3>💳 ${e(tr('Pay to confirm your booking'))}</h3><p>${e(tr('Booking'))} #${e(contract.bookingNumber || '')}: ${e(contract.service || '')}</p></div>
      <div class="modal-body">${codeBoxHTML(contract, p)}</div>
      <div class="modal-footer"><button class="btn-sm btn-sm-outline" onclick="document.getElementById('pw-code-overlay').remove()">${e(tr('I\'ll pay later (see My Bookings)'))}</button></div>
    </div></div>`);
  }
  // "Pay now" on a booking in My Bookings.
  window.payWaysShow = function (contractId) {
    const c = typeof RAW_CONTRACTS === 'object' ? RAW_CONTRACTS[contractId] : null;
    const es = c && c.escrow;
    if (!es || es.paidBy !== 'code') return showToast(tr('Payment details not found. Please refresh.'));
    showPaymentCode(c, { code: es.paymentCode, amountDue: es.amountDue, currency: es.dueCurrency, payTo: es.payTo, expiresAt: es.paymentExpiresAt, customerSaysPaidAt: es.customerSaysPaidAt });
  };
  window.payWaysCopy = async function (code) { try { await navigator.clipboard.writeText(code); showToast(tr('Code copied')); } catch (x) { showToast(`${tr('Your code is')} ${code}`); } };
  window.payWaysSent = async function (contractId) {
    const tx = ((el('pw-tx-' + contractId) || {}).value || '').trim();
    try {
      await apiFetch('POST', `/customer-payments/${encodeURIComponent(contractId)}/paid`, { transactionId: tx || undefined });
      showToast(tr('Thank you. We will check the payment and tell you.'));
      const o = el('pw-code-overlay'); if (o) o.remove();
      if (typeof loadCustomerData === 'function') { await loadCustomerData(); if (el('pw-waiting')) drawWaiting(); }
    } catch (x) { showToast(x.message || tr('Could not send')); }
  };

  // Bookings still waiting for the customer's payment, at the top of My Bookings and Overview.
  function waitingList() {
    return Object.values(typeof RAW_CONTRACTS === 'object' ? RAW_CONTRACTS : {}).filter(c => c.status === 'awaiting_payment' && c.escrow && c.escrow.paidBy === 'code');
  }
  function drawWaiting() {
    const main = el('customer-main'); if (!main) return;
    const list = waitingList();
    let box = el('pw-waiting');
    if (!list.length) { if (box) box.remove(); return; }
    if (!box) { main.insertAdjacentHTML('afterbegin', '<div id="pw-waiting"></div>'); box = el('pw-waiting'); }
    box.innerHTML = list.map(c => {
      const es = c.escrow;
      const p = { code: es.paymentCode, amountDue: es.amountDue, currency: es.dueCurrency, payTo: es.payTo, expiresAt: es.paymentExpiresAt, customerSaysPaidAt: es.customerSaysPaidAt };
      return `<div class="panel" style="border-left:4px solid var(--gold);"><div class="panel-title">💳 ${e(tr('Waiting for your payment'))}: #${e(c.bookingNumber)} · ${e(c.service)}</div>${codeBoxHTML(c, p)}</div>`;
    }).join('');
  }
  if (typeof selectCustomerSection === 'function') {
    const f = selectCustomerSection;
    selectCustomerSection = function (key) { const r = f.apply(this, arguments); if (key === 'bookings' || key === 'overview') setTimeout(drawWaiting, 50); return r; };
  }
  if (typeof statusBadge === 'function') {
    const f = statusBadge;
    statusBadge = function (status) { if (status === 'awaiting_payment') return `<span class="badge badge-warn">${e(tr('Waiting for payment'))}</span>`; return f.apply(this, arguments); };
  }

  // ── a cash job is marked done: how much was paid? ─────────────────────
  if (typeof completeBooking === 'function') {
    const f = completeBooking;
    completeBooking = function (contractId) {
      const c = typeof RAW_CONTRACTS === 'object' ? RAW_CONTRACTS[contractId] : null;
      if (!c || c.payMethod !== 'cash') return f.apply(this, arguments);
      const old = el('pw-cash-overlay'); if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="pw-cash-overlay" onclick="if(event.target===this)this.remove()"><div class="modal">
        <div class="modal-header"><button class="modal-close" onclick="document.getElementById('pw-cash-overlay').remove()">✕</button>
          <h3>${e(tr('Confirm the job is done'))}</h3><p>${e(tr('This was a cash job. Tell us how much you paid the pro, so Trothen\'s records are right.'))}</p></div>
        <div class="modal-body"><div class="form-group"><label class="form-label" for="pw-cash-paid">${e(tr('Cash you paid (US$ equivalent)'))}</label>
          <input class="form-input" type="number" min="0.01" step="0.01" id="pw-cash-paid" value="${e(Number(c.amount).toFixed(2))}"/>
          <div style="font-size:12.5px;color:var(--muted);margin-top:5px;">${e(tr('The agreed price was'))} $${e(Number(c.amount).toFixed(2))}. ${e(tr('If you paid more for extra work you agreed on the spot, put the full amount.'))}</div></div></div>
        <div class="modal-footer"><button class="confirm-btn" onclick="payWaysCashDone(${jsArg(contractId)})">${e(tr('Confirm job done'))}</button></div>
      </div></div>`);
    };
  }
  window.payWaysCashDone = async function (contractId) {
    const paid = Number((el('pw-cash-paid') || {}).value);
    if (!(paid > 0)) return showToast(tr('Enter how much you paid'));
    try {
      await apiFetch('POST', `/contracts/${encodeURIComponent(contractId)}/complete`, { cashPaidAmount: paid });
      const o = el('pw-cash-overlay'); if (o) o.remove();
      showToast(tr('Thank you. The job is marked done.'));
      if (typeof loadCustomerData === 'function') await loadCustomerData();
      selectCustomerSection('bookings');
    } catch (x) { showToast(x.message || tr('Could not complete this booking')); }
  };

  // ── ADMIN: Customer Payments ─────────────────────────────────────────
  const VIEW = ['customer_service', 'financial', 'accountant', 'controller'];
  const canView = () => !!(AUTH.user && AUTH.user.role === 'admin' && (AUTH.user.isSuperAdmin || VIEW.includes(AUTH.user.adminDepartment)));
  function addNav(items, afterKey, item) { if (items.some(i => i.key === item.key)) return; const at = items.findIndex(i => i.key === afterKey); items.splice(at === -1 ? items.length : at + 1, 0, item); }
  if (typeof getAdminNavItems === 'function') {
    const f = getAdminNavItems;
    getAdminNavItems = function () { const items = f.apply(this, arguments).slice(); if (canView()) addNav(items, items.some(i => i.key === 'tokens') ? 'tokens' : 'payments', { key: 'custpay', label: 'Customer Payments', icon: '💳' }); return items; };
  }
  if (typeof ADMIN_SECTIONS !== 'undefined') ADMIN_SECTIONS.custpay = () => `<div class="dash-header"><div><div class="dash-title">💳 ${e(tr('Customer Payments'))}</div><div class="dash-sub">${e(tr('Protected bookings paid by mobile money with a code: confirm what arrived, and send refunds back'))}</div></div></div><div id="custpay-body"><div class="panel">${e(tr('Loading…'))}</div></div>`;
  if (typeof selectAdminSection === 'function') { const f = selectAdminSection; selectAdminSection = function (key) { const r = f.apply(this, arguments); if (key === 'custpay') drawAdmin(); return r; }; }

  async function drawAdmin(q) {
    const box = el('custpay-body'); if (!box) return;
    let d; try { d = await apiFetch('GET', '/admin/customer-payments' + (q ? '?q=' + encodeURIComponent(q) : '')); } catch (x) { box.innerHTML = `<div class="panel">${e(x.message || 'Could not load')}</div>`; return; }
    const can = d.canAct;
    const pay = (p) => `<div style="border-top:1px solid var(--border);padding:10px 0;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;">
        <div><span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;font-size:17px;letter-spacing:.08em;color:var(--navy);">${e(p.code)}</span> · <strong>${e(amountText(p))}</strong> · ${e(tr('booking'))} #${e(p.bookingNumber || '')}</div>
        <span class="badge ${p.customerSaysPaidAt ? 'badge-warn' : p.status === 'held' ? 'badge-success' : ''}">${e(tr(p.status === 'awaiting_payment' ? (p.customerSaysPaidAt ? 'Customer says paid: check it' : 'Waiting for payment') : p.status === 'held' ? 'Confirmed: held' : p.status.replace(/_/g, ' ')))}</span>
      </div>
      <div style="font-size:13px;color:var(--slate);margin-top:2px;">${e(p.customer)}${p.customerPhone ? ' · ' + e(p.customerPhone) : ''} → ${e(p.pro)} · ${e(p.service || '')} · ${e(new Date(p.createdAt).toLocaleString())}${p.customerTransactionId ? ` · ${e(tr('customer\'s transaction ID'))}: <strong>${e(p.customerTransactionId)}</strong>` : ''}${p.receipt ? ` · ${e(tr('confirmed with'))} ${e(p.receipt)}${p.confirmedByName ? ' ' + e(tr('by')) + ' ' + e(p.confirmedByName) : ''}` : ''}</div>
      ${can && p.status === 'awaiting_payment' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <input class="form-input" style="flex:1;min-width:170px;" id="cpx-tx-${e(p.code)}" maxlength="60" placeholder="${e(tr('Trothen\'s transaction ID'))}"/>
        <input class="form-input" style="width:150px;" type="number" step="0.01" id="cpx-amt-${e(p.code)}" placeholder="${e(tr('Amount received'))}"/>
        <button class="btn-sm btn-sm-primary" onclick="custPayConfirm(${jsArg(p.code)})">${e(tr('Confirm payment'))}</button></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
        <input class="form-input" style="flex:1;min-width:200px;" id="cpx-why-${e(p.code)}" maxlength="300" placeholder="${e(tr('If no payment found: reason (the customer sees it)'))}"/>
        <button class="btn-sm btn-sm-outline" onclick="custPayReject(${jsArg(p.code)})">${e(tr('No payment found: cancel booking'))}</button></div>` : ''}
    </div>`;
    const ref = (r) => `<div style="border-top:1px solid var(--border);padding:10px 0;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><div><strong style="color:var(--navy);">${e(r.currency && r.currency !== 'USD' ? r.currency + ' ' + Number(r.amountLocal).toLocaleString() : '$' + Number(r.amountUsd).toFixed(2))}</strong> ${e(tr(r.full ? '(full refund)' : '(part refund after a dispute)'))} → ${e(r.customer)}${r.customerPhone ? ' · ' + e(r.customerPhone) : ''}</div><div style="font-size:13px;color:var(--slate);">${e(tr('booking'))} #${e(r.bookingNumber || '')} · ${e(tr('code'))} ${e(r.code)} · ${e(tr('paid in with'))} ${e(r.receivedWith)}</div></div>
      ${can ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><input class="form-input" style="flex:1;min-width:200px;" id="cpr-tx-${e(r.escrowId)}" maxlength="60" placeholder="${e(tr('Transaction ID of the refund you sent'))}"/><button class="btn-sm btn-sm-primary" onclick="custPayRefundSent(${jsArg(r.escrowId)})">${e(tr('Mark refund sent'))}</button></div>` : ''}
    </div>`;
    box.innerHTML = `
      <div class="ver-note" style="margin-bottom:12px;">${e(tr('Turn payment codes on per country in Admin → Tokens → Countries ("Protected payments"), with Trothen\'s official mobile money number. Only confirm a payment once you can see it on Trothen\'s statement with the code in the reference.'))}</div>
      <div class="panel"><div class="panel-title">${e(tr('Payments to confirm'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><input class="form-input" style="flex:1;min-width:200px;text-transform:uppercase;" id="cp-q" value="${e(q || '')}" placeholder="${e(tr('Code, or a transaction ID'))}" onkeydown="if(event.key==='Enter')custPayFind()"/><button class="btn-sm btn-sm-primary" onclick="custPayFind()">${e(tr('Find'))}</button><button class="btn-sm btn-sm-outline" onclick="custPayFind(true)">${e(tr('Show all waiting'))}</button></div>
        ${d.payments.length ? d.payments.map(pay).join('') : `<div style="color:var(--slate);font-size:14px;margin-top:10px;">${e(tr(q ? 'Nothing matches that.' : 'No payments waiting.'))}</div>`}
      </div>
      <div class="panel"><div class="panel-title">${e(tr('Refunds to send'))}${d.refunds.length ? ` <span class="badge badge-warn">${d.refunds.length}</span>` : ''}</div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('Customers who paid by code and were then refunded (booking cancelled, declined, not answered, or a dispute). Send the money back by mobile money to the number they paid from, then mark it sent.'))}</div>
        ${d.refunds.length ? d.refunds.map(ref).join('') : `<div style="color:var(--slate);font-size:14px;">${e(tr('Nothing to send.'))}</div>`}
      </div>`;
  }
  window.custPayFind = function (all) { drawAdmin(all === true ? '' : ((el('cp-q') || {}).value || '').trim()); };
  window.custPayConfirm = async function (code) {
    const tx = ((el('cpx-tx-' + code) || {}).value || '').trim(), amt = Number((el('cpx-amt-' + code) || {}).value);
    if (tx.length < 4) return showToast(tr('Enter the transaction ID from Trothen\'s mobile money statement'));
    if (!(amt > 0)) return showToast(tr('Enter the amount that arrived'));
    if (!(await confirmDialog(`${tr('Confirm code')} ${code} ${tr('with transaction')} ${tx}? ${tr('Only do this once you can see the money on Trothen\'s statement with this code in the reference.')}`, { confirmLabel: tr('Confirm payment') }))) return;
    try { await apiFetch('POST', '/admin/customer-payments/confirm', { code, transactionId: tx, amountReceived: amt }); showToast(tr('Confirmed. The pro has been asked to confirm the booking.')); drawAdmin(); }
    catch (x) { showToast(x.message || 'Could not confirm'); }
  };
  window.custPayReject = async function (code) {
    const why = ((el('cpx-why-' + code) || {}).value || '').trim();
    if (why.length < 5) return showToast(tr('Type the reason first (at least 5 characters). The customer sees it.'));
    if (!(await confirmDialog(`${tr('No payment found for')} ${code}? ${tr('The booking is cancelled and the customer is told:')} "${why}"`, { confirmLabel: tr('Cancel booking'), danger: true }))) return;
    try { await apiFetch('POST', '/admin/customer-payments/reject', { code, reason: why }); showToast(tr('Customer told')); drawAdmin(); }
    catch (x) { showToast(x.message || 'Could not update'); }
  };
  window.custPayRefundSent = async function (escrowId) {
    const tx = ((el('cpr-tx-' + escrowId) || {}).value || '').trim();
    if (tx.length < 4) return showToast(tr('Enter the transaction ID of the refund you sent'));
    try { await apiFetch('POST', '/admin/customer-payments/refund-sent', { escrowId, transactionId: tx }); showToast(tr('Marked sent. The customer is told.')); drawAdmin(); }
    catch (x) { showToast(x.message || 'Could not update'); }
  };
})();
