// v147: Payments → Add Payment Method, by country.
//  - Liberia and the rest of Africa: Mobile Money first (the network from
//    the country's list, the number, the name it is registered in), then a
//    card. No PayPal or Apple Pay (not used there).
//  - It says which wallets go through a connected Mobile Money system
//    (MTN in Liberia, once switched on) and which are paid with a payment
//    code sent to Trothen's number.
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  let OPT = null;

  async function options() {
    try { OPT = await apiFetch('GET', '/payment-methods/options'); } catch (x) { OPT = null; }
    return OPT;
  }
  function shape() {
    if (!OPT) return;
    const tabs = el('pm-type-tabs'); if (!tabs) return;
    ['card', 'apple_pay', 'paypal', 'mobile_money'].forEach(k => { const b = el('pm-tab-' + k); if (b) b.style.display = OPT.types.includes(k) ? '' : 'none'; });
    // Mobile Money first where it's the usual way to pay
    if (OPT.africa) { const mmTab = el('pm-tab-mobile_money'); if (mmTab) tabs.insertBefore(mmTab, tabs.firstChild); }
    const form = el('pm-form-mobile_money');
    if (form && !el('pm-mm-network')) {
      const nets = OPT.networks || [];
      const anyApi = nets.some(n => n.api);
      form.innerHTML = `
        <div class="form-group"><label class="form-label" for="pm-mm-network">Network</label>
          <select class="form-input form-select" id="pm-mm-network">${nets.map(n => `<option value="${e(n.name)}">${e(n.name)}${n.apiOn ? ' · pays in the app' : ''}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="pm-mobile-money-number">Mobile Money number</label>
          <input class="form-input" id="pm-mobile-money-number" inputmode="tel" autocomplete="tel" placeholder="${e(OPT.example || '')}"/>
          <div style="font-size:12.5px;color:var(--muted);margin-top:4px;">The number your Mobile Money wallet is on${OPT.callingCode ? `. You can leave out +${e(OPT.callingCode)}` : ''}.</div></div>
        <div class="form-group"><label class="form-label" for="pm-mm-name">Name on the Mobile Money account</label><input class="form-input" id="pm-mm-name" autocomplete="name" value="${e((AUTH.user && AUTH.user.name) || '')}"/></div>
        <div class="ver-note" id="pm-mm-how"></div>`;
      const how = () => {
        const n = nets.find(x => x.name === el('pm-mm-network').value) || {};
        el('pm-mm-how').textContent = n.apiOn
          ? `When you pay, ${n.api} sends a prompt to this phone: enter your PIN to approve. Your money is held by Trothen until the job is done.`
          : n.api
            ? `Paying straight from ${n.name} in the app is being connected. Until then you pay with a payment code: Trothen shows you its ${n.name} number and a code, you send the money, and press "I have sent it". Your money is held by Trothen until the job is done.`
            : `You pay with a payment code: Trothen shows you where to send the money and a code to put in the reference, then you press "I have sent it". Your money is held by Trothen until the job is done.`;
      };
      el('pm-mm-network').onchange = how; how();
    }
    const badge = document.querySelector('#add-payment-panel .badge-warn');
    if (badge && OPT.africa) badge.style.display = 'none';
  }

  // the card warning ("don't type a real card number") is only about cards
  if (typeof selectPaymentMethodType === 'function') {
    const base = selectPaymentMethodType;
    selectPaymentMethodType = function (type) {
      const r = base.apply(this, arguments);
      const panel = el('add-payment-panel');
      if (panel) [...panel.children].filter(c => /real debit or credit card|No charges are made/.test(c.textContent || '') && !c.id).forEach(c => { c.style.display = type === 'card' ? '' : 'none'; });
      return r;
    };
  }
  if (typeof openAddPaymentMethodForm === 'function') {
    const base = openAddPaymentMethodForm;
    openAddPaymentMethodForm = async function () {
      const r = base.apply(this, arguments);
      if (!OPT) await options();
      shape();
      if (OPT && OPT.africa) { selectPaymentMethodType('mobile_money'); setTimeout(() => { const n = el('pm-mobile-money-number'); if (n) n.focus(); }, 50); }
      return r;
    };
  }
  if (typeof submitPaymentMethod === 'function') {
    const base = submitPaymentMethod;
    submitPaymentMethod = async function () {
      if (typeof selectedPaymentMethodType === 'undefined' || selectedPaymentMethodType !== 'mobile_money' || !el('pm-mm-network')) return base.apply(this, arguments);
      const network = el('pm-mm-network').value, mobileMoneyNumber = el('pm-mobile-money-number').value.trim(), accountName = el('pm-mm-name').value.trim();
      if (mobileMoneyNumber.replace(/\D/g, '').length < 7) return showToast('Enter your Mobile Money number');
      if (accountName.length < 2) return showToast('Enter the name the Mobile Money account is registered in');
      try {
        await apiFetch('POST', '/payment-methods', { type: 'mobile_money', network, mobileMoneyProvider: network, mobileMoneyNumber, accountName });
        showToast(`${network} saved`);
        el('add-payment-panel').style.display = 'none';
        el('pm-mobile-money-number').value = '';
        await loadCustomerData();
        selectCustomerSection('payments');
      } catch (x) { showToast(x.message || 'Could not save'); }
    };
  }
})();
