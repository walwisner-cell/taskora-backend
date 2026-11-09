// v141: where your money is paid, the way it works in Liberia and Africa.
//
// Across Africa people are paid by Mobile Money (Orange Money, MTN MoMo,
// M-Pesa, Wave...) or into a bank account. PayPal can't pay people out
// there, so it isn't offered in African countries. The networks offered
// follow the person's country (src/payout-methods.js).
//
//   - Pros: Settings → "Where your money is paid" (replaces the old
//     payout method panels).
//   - Market sellers: Market → Sell → "Your Market money".
//   - Admin → Payments → "Payouts being sent": where each payout goes, and
//     the full number only on "Show full number" (logged).
// Wallet and account numbers only ever come back as the last 4 digits.
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const money = (n) => '$' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2);

  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Where your money is paid': 'Dónde recibes tu dinero', 'Mobile Money': 'Dinero móvil', 'Bank Transfer': 'Transferencia bancaria',
      'Mobile Money network': 'Red de dinero móvil', 'Mobile Money number': 'Número de dinero móvil', 'Name on the account': 'Nombre en la cuenta',
      'Bank name': 'Nombre del banco', 'Account number': 'Número de cuenta', 'Save payout details': 'Guardar datos de pago',
    });
  } catch (x) {}

  const S = { opts: null, editing: false, method: null };
  async function load() { S.opts = await apiFetch('GET', '/auth/payout-options'); S.method = S.opts.method && S.opts.methods.includes(S.opts.method) ? S.opts.method : S.opts.methods[0]; return S.opts; }

  function savedLine(o, m) {
    if (m === 'Mobile Money' && o.mobile) return `${o.mobile.network} •••• ${o.mobile.last4} (${o.mobile.name})`;
    if (m === 'Bank Transfer' && o.bank) return `${o.bank.bankName} •••• ${o.bank.last4} (${o.bank.accountName})`;
    if (m === 'PayPal' && o.paypalEmail) return `PayPal ${o.paypalEmail}`;
    return null;
  }
  function formHTML(prefix) {
    const o = S.opts; const m = S.method;
    const saved = savedLine(o, m);
    const showForm = !saved || S.editing;
    const sel = `<div class="form-group"><label class="form-label" for="${prefix}-pm">${e(t('Paid by'))}</label><select class="form-input form-select" id="${prefix}-pm" onchange="pdMethod('${prefix}', this.value)" style="max-width:260px;">${o.methods.map(x => `<option value="${e(x)}" ${x === m ? 'selected' : ''}>${e(t(x))}</option>`).join('')}</select></div>`;
    let fields = '';
    if (showForm && m === 'Mobile Money') {
      fields = `<div style="display:flex;gap:10px;flex-wrap:wrap;">
        <div class="form-group" style="flex:1 1 180px;"><label class="form-label" for="${prefix}-net">${e(t('Mobile Money network'))}</label><select class="form-input form-select" id="${prefix}-net">${o.networks.map(n => `<option ${o.mobile && o.mobile.network === n ? 'selected' : ''}>${e(n)}</option>`).join('')}</select></div>
        <div class="form-group" style="flex:1 1 180px;"><label class="form-label" for="${prefix}-num">${e(t('Mobile Money number'))}</label><input class="form-input" id="${prefix}-num" inputmode="tel" autocomplete="off" placeholder="+231 77 123 4567"/></div>
        <div class="form-group" style="flex:1 1 200px;"><label class="form-label" for="${prefix}-nm">${e(t('Name on the account'))}</label><input class="form-input" id="${prefix}-nm" value="${e(o.mobile ? o.mobile.name : ((AUTH && AUTH.user && AUTH.user.name) || ''))}"/></div></div>
        <div style="font-size:12.5px;color:var(--muted);margin:-4px 0 10px;">${e(t('Use the name the wallet is registered in, so the money reaches you. Payouts go to a wallet in your own name (or your business name); a wallet in someone else\'s name is checked by our finance team first, which can delay your payout.'))}</div>${o.mobile && o.mobile.nameMatch === false ? `<div style="font-size:12.5px;color:#8a5a00;margin:-6px 0 10px;">⚠️ ${e(t('The name on this wallet is different from your account name, so finance checks it before each payout.'))}</div>` : ''}`;
    } else if (showForm && m === 'Bank Transfer') {
      fields = `<div style="display:flex;gap:10px;flex-wrap:wrap;">
        <div class="form-group" style="flex:1 1 200px;"><label class="form-label" for="${prefix}-bank">${e(t('Bank name'))}</label><input class="form-input" id="${prefix}-bank" placeholder="${o.country === 'Liberia' ? 'e.g. Ecobank Liberia' : ''}" value="${e(o.bank ? o.bank.bankName : '')}"/></div>
        <div class="form-group" style="flex:1 1 200px;"><label class="form-label" for="${prefix}-an">${e(t('Name on the account'))}</label><input class="form-input" id="${prefix}-an" value="${e(o.bank ? o.bank.accountName : ((AUTH && AUTH.user && AUTH.user.name) || ''))}"/></div>
        <div class="form-group" style="flex:1 1 200px;"><label class="form-label" for="${prefix}-acct">${e(t('Account number'))}</label><input class="form-input" id="${prefix}-acct" autocomplete="off" inputmode="numeric"/></div>
        <div class="form-group" style="flex:1 1 160px;"><label class="form-label" for="${prefix}-br">${e(t('Branch (optional)'))}</label><input class="form-input" id="${prefix}-br" value="${e(o.bank ? o.bank.branch : '')}"/></div>
        <div class="form-group" style="flex:1 1 160px;"><label class="form-label" for="${prefix}-sw">${e(t('SWIFT / BIC (for money from abroad)'))}</label><input class="form-input" id="${prefix}-sw" value="${e(o.bank ? o.bank.swift : '')}"/></div></div>`;
    } else if (showForm && m === 'PayPal') {
      fields = `<div class="form-group"><label class="form-label" for="${prefix}-pp">${e(t('PayPal email'))}</label><input class="form-input" id="${prefix}-pp" type="email" value="${e(o.paypalEmail || '')}" style="max-width:320px;"/></div>`;
    } else if (showForm) {
      fields = `<div style="font-size:13px;color:var(--slate);margin-bottom:10px;">${e(t('Card payouts are in test mode until a payment processor is connected.'))}</div>`;
    }
    const savedBox = saved && !S.editing ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:10px;"><div style="flex:1;min-width:0;"><div style="font-size:12.5px;color:var(--slate);">${e(t('Your money is sent to'))}</div><strong style="color:var(--navy);overflow-wrap:anywhere;">${e(saved)}</strong></div><button class="btn-sm btn-sm-outline" onclick="pdEdit('${prefix}')">${e(t('Change'))}</button></div>` : '';
    const wait = o.waitUntil ? `<div class="ver-note" style="margin-bottom:10px;">🔒 ${e(t('Your payout details changed recently. For your safety, payouts can start again from'))} ${e(new Date(o.waitUntil).toLocaleString())}.</div>` : '';
    const africaNote = o.africa ? `<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;">${e(t('PayPal can\'t pay people out in'))} ${e(o.country)}, ${e(t('so you are paid by Mobile Money or bank transfer.'))}</div>` : '';
    return `${wait}${sel}${savedBox}${fields}${africaNote}${showForm ? `<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-sm btn-sm-primary" onclick="pdSave('${prefix}')">${e(t('Save payout details'))}</button>${saved ? `<button class="btn-sm btn-sm-ghost" onclick="pdCancel('${prefix}')">${e(t('Cancel'))}</button>` : ''}</div><div style="font-size:12.5px;color:var(--muted);margin-top:8px;">${e(t('Only the last 4 digits are ever shown. A change makes payouts wait 24 hours, in case someone else got into your account.'))}</div>` : (saved && S.method !== (S.opts.method || '') ? `<button class="btn-sm btn-sm-primary" onclick="pdSave('${prefix}')">${e(t('Use this'))}</button>` : '')}`;
  }
  function draw(prefix) { const box = el(prefix + '-box'); if (box && S.opts) box.innerHTML = formHTML(prefix); }
  window.pdMethod = function (prefix, m) { S.method = m; S.editing = false; draw(prefix); };
  window.pdEdit = function (prefix) { S.editing = true; draw(prefix); };
  window.pdCancel = function (prefix) { S.editing = false; draw(prefix); };
  window.pdSave = async function (prefix) {
    const m = S.method; const body = { payoutMethod: m };
    const editing = S.editing || !savedLine(S.opts, m);
    if (editing && m === 'Mobile Money') body.payoutMobile = { network: el(prefix + '-net').value, number: el(prefix + '-num').value, name: el(prefix + '-nm').value };
    if (editing && m === 'Bank Transfer') body.payoutBank = { bankName: el(prefix + '-bank').value, accountName: el(prefix + '-an').value, accountNumber: el(prefix + '-acct').value, branch: el(prefix + '-br').value, swift: el(prefix + '-sw').value };
    if (editing && m === 'PayPal') body.payoutPaypalEmail = el(prefix + '-pp').value.trim();
    try {
      const { user } = await apiFetch('PATCH', '/auth/me', body);
      if (user) AUTH.user = user;
      S.editing = false; await load(); draw(prefix);
      showToast(t('Saved. Payouts will be sent to') + ' ' + (savedLine(S.opts, S.method) || t(S.method)));
    } catch (x) { showToast((x && x.message) || t('Could not save')); }
  };
  window.payoutFormMount = async function (hostId, prefix) {
    const host = el(hostId); if (!host) return;
    prefix = prefix || 'pd';
    host.innerHTML = `<div id="${prefix}-box"><span style="color:var(--slate);font-size:13px;">${e(t('Loading…'))}</span></div>`;
    try { await load(); S.editing = false; draw(prefix); } catch (x) { host.innerHTML = `<span style="color:var(--slate);font-size:13px;">${e(x.message || '')}</span>`; }
  };
  window.payoutReady = () => !!(S.opts && savedLine(S.opts, S.method));

  // ── pro Settings: one panel instead of the old payout method panels ──
  function replaceProPanels() {
    const sel = el('set-prov-payout-method'); if (!sel) return;
    const panel = sel.closest('.panel'); if (!panel || panel.id === 'pd-settings') return;
    panel.id = 'pd-settings';
    panel.innerHTML = `<div class="panel-title">${e(t('Where your money is paid'))}</div><div style="font-size:13.5px;color:var(--slate);margin-bottom:12px;">${e(t('For payouts of your earnings. You choose this account each time you cash out.'))}</div><div id="pd-settings-host"></div>`;
    ['prov-payout-paypal-panel', 'prov-billing-card-panel'].forEach(id => { const p = el(id); if (p) p.remove(); });
    payoutFormMount('pd-settings-host', 'pds');
    // International: only methods that work from this country.
    const intl = el('set-prov-payout-method-intl');
    if (intl) apiFetch('GET', '/auth/payout-options').then(o => {
      const cur = intl.value;
      intl.innerHTML = `<option value="">${e(t('Not set up'))}</option>` + o.intlMethods.map(m => `<option value="${e(m)}" ${m === cur ? 'selected' : ''}>${e(m === 'Bank Transfer' ? t('International Bank Transfer') : m)}</option>`).join('');
      const note = intl.closest('.panel') && intl.closest('.panel').querySelector('div[style*="font-size:13.5px"]');
      if (note && o.africa) note.textContent = t('For payments from customers abroad, paid to your bank account by international transfer (add the SWIFT / BIC code above).');
      const g = el('prov-payout-paypal-intl-group'); if (g && o.africa) g.remove();
    }).catch(() => {});
  }
  if (typeof selectProviderSection === 'function') {
    const base = selectProviderSection;
    selectProviderSection = function (key) { const r = base.apply(this, arguments); if (key === 'settings') setTimeout(replaceProPanels, 0); return r; };
  }

  // ── Admin → Payments: payouts being sent ─────────────────────────────
  async function drawAdminPayouts() {
    const main = el('admin-main'); if (!main || el('admin-payouts-send')) return;
    let data; try { data = await apiFetch('GET', '/admin/payouts-to-send'); } catch (x) { return; } // not permitted
    const box = document.createElement('div'); box.className = 'panel'; box.id = 'admin-payouts-send';
    const rows = data.payouts || [];
    box.innerHTML = `<div class="panel-title">${e(t('Payouts being sent'))} <span style="font-weight:400;color:var(--slate);font-size:13px;">(${rows.length})</span></div>
      <div style="font-size:13px;color:var(--slate);margin:-6px 0 8px;">${e(t('Where each payout goes. The full number shows only when you press "Show full number", and each look is recorded in the access log.'))}</div>
      ${rows.length ? rows.map(p => `<div style="border-top:1px solid var(--border);padding:8px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;"><div style="flex:1;min-width:220px;"><strong style="color:var(--navy);">${e(p.person.name)}</strong> · ${money(p.amount)}${p.payoutAmountLocal ? ` (${e(p.payoutCurrency)} ${e(p.payoutAmountLocal)})` : ''} · ${e(p.person.city || '')}${p.person.country ? ', ' + e(p.person.country) : ''}<div style="font-size:13px;color:var(--slate);">${e(p.destination || p.method + ' · ' + t('no details saved (older payout)'))} · ${e(new Date(p.createdAt).toLocaleString())}</div>${p.nameCheck && !p.nameCheck.ok ? `<div style="font-size:13px;color:#8a5a00;background:#fff8e6;border-radius:6px;padding:4px 8px;margin-top:4px;">⚠️ ${e(t('The account is in the name'))} "${e(p.nameCheck.holder)}", ${e(t('not the pro'))} (${e(p.nameCheck.pro)}). ${e(t('Check with the pro before sending.'))}</div>` : ''}<div id="pd-rev-${e(p.id)}" style="font-size:13.5px;"></div>${p.problem ? `<div style="font-size:13px;color:#B45309;">⚠️ ${e(p.problem.reason)}</div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;" id="pd-act-${e(p.id)}">
          ${p.momo ? (p.momo.on ? `<button class="btn-sm btn-sm-primary" onclick="pdSendMomo('${e(p.id)}')">${e(t('Send by'))} ${e(p.momo.name)}</button>` : `<span style="font-size:12.5px;color:var(--muted);align-self:center;">${e(p.momo.name)} ${e(t('payouts aren\'t switched on yet: send it by hand'))}</span>`) : ''}
          <input class="form-input" id="pd-ref-${e(p.id)}" placeholder="${e(t('Transaction ID from the receipt'))}" style="max-width:220px;padding:6px 10px;font-size:13.5px;"/>
          <button class="btn-sm btn-sm-outline" onclick="pdMarkSent('${e(p.id)}')">${e(t('Mark as sent'))}</button>
          <button class="btn-sm btn-sm-ghost" onclick="pdProblem('${e(p.id)}')">${e(t("Can't send"))}</button>
        </div></div>${p.destination ? `<button class="btn-sm btn-sm-outline" onclick="pdReveal('${e(p.id)}')">${e(t('Show full number'))}</button>` : ''}</div>`).join('') : `<p style="color:var(--slate);margin:0;">${e(t('No payouts waiting.'))}</p>`}
      ${(data.sending || []).length ? `<div style="margin-top:10px;font-size:13.5px;"><strong>${e(t('Waiting for MTN to confirm'))}:</strong> ${(data.sending || []).map(x => `${e(x.person.name)} ${money(x.amount)}`).join(' · ')}</div>` : ''}
      <div style="font-size:12.5px;color:var(--muted);margin-top:8px;">${e(t(data.autoSettle ? 'Real payments are not switched on, so payouts are marked paid by themselves after 2 days. Once real payments are on, a payout is paid only when you mark it sent with the receipt\'s transaction ID, or MTN confirms it.' : 'A payout is marked paid only when you mark it sent with the receipt\'s transaction ID, or when MTN confirms it. The pro sees the reference.'))}</div>`;
    main.appendChild(box);
  }
  async function pdAct(id, path, body, okWords) {
    try { await apiFetch('POST', `/admin/payouts/${encodeURIComponent(id)}/${path}`, body || {}); showToast(t(okWords)); const b = el('admin-payouts-send'); if (b) b.remove(); drawAdminPayouts(); }
    catch (x) { showToast((x && x.message) || 'Error'); }
  }
  window.pdMarkSent = (id) => pdAct(id, 'sent', { reference: (el('pd-ref-' + id) || {}).value || '' }, 'Marked as sent. The pro has been told, with the reference.');
  window.pdSendMomo = (id) => pdAct(id, 'send-momo', {}, 'Sent to MTN. It is marked paid when MTN confirms.');
  window.pdProblem = (id) => {
    const box = el('pd-act-' + id); if (!box || el('pd-why-' + id)) return;
    box.insertAdjacentHTML('beforeend', `<input class="form-input" id="pd-why-${id}" placeholder="${e(t('What is wrong (the pro is told)'))}" style="max-width:280px;padding:6px 10px;font-size:13.5px;"/><button class="btn-sm btn-sm-outline" onclick="pdProblemSend('${id}')">${e(t('Tell the pro'))}</button>`);
  };
  window.pdProblemSend = (id) => pdAct(id, 'problem', { reason: (el('pd-why-' + id) || {}).value || '' }, 'The pro has been told what to fix.');
  window.pdReveal = async function (id) {
    try {
      const r = await apiFetch('POST', `/admin/payouts/${encodeURIComponent(id)}/reveal`, {});
      const slot = el('pd-rev-' + id); if (!slot) return;
      slot.innerHTML = r.number ? `<strong>${e(r.network || r.bankName || r.method)}</strong>: <code>${e(r.number)}</code> · ${e(r.name || '')}${r.branch ? ' · ' + e(r.branch) : ''}${r.swift ? ' · SWIFT ' + e(r.swift) : ''}` : (r.email ? e(r.email) : e(r.note || t('No number saved')));
    } catch (x) { showToast((x && x.message) || 'Error'); }
  };
  if (typeof selectAdminSection === 'function') {
    const base = selectAdminSection;
    selectAdminSection = function (key) { const r = base.apply(this, arguments); if (key === 'payments') setTimeout(drawAdminPayouts, 0); return r; };
  }
})();
