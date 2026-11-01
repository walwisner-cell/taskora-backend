/* Agreeing one final price (v122). Loaded after review.js.

   How it works, the way Thumbtack, Airtasker and eBay do it:
   - On a posted job, a pro answers with their price (and what it covers),
     the way a Thumbtack or Airtasker pro sends a quote. The customer sees
     every pro's price side by side and hires at that price. The pro can
     change their price until they're hired.
   - On a "Make an Offer" booking, the price goes back and forth: the pro
     can accept the customer's offer, suggest a different price, or
     decline; the customer can accept the pro's price, suggest another, or
     cancel. Each side can suggest up to 5 prices (like eBay's counter-
     offers), and each price runs out if it isn't answered in time.
   - Nothing is paid or held until one side accepts the other's latest
     price. That price is the final, agreed price on the contract.
   The rules live on the server (POST /contracts/:id/propose and /agree,
   POST /matches/:id/price). */
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const money = (n) => '$' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
  const first = (name) => String(name || '').split(' ')[0].replace(/\.+$/, '');
  const feeFor = (amount) => amount > 0 ? Math.round(Math.min(Math.max(amount * 0.09, 2.99), 25) * 100) / 100 : 0;
  const TIER_FEE_OFF = { plus: 0.20, pro: 0.40, elite: 0.60, vip: 0.80 };
  const MAX_EACH = 5;

  function overlay(id, title, sub, body, footer) {
    const old = el(id); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="${id}" onclick="if(event.target===this)this.remove()"><div class="modal">
      <div class="modal-header"><button class="modal-close" onclick="document.getElementById('${id}').remove()">✕</button><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>
      <div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></div></div>`);
  }
  const closeOverlay = (id) => { const o = el(id); if (o) o.remove(); };

  // ── the price history on an offer booking ─────────────────────────────
  function historyOf(c) {
    if (Array.isArray(c.negotiation) && c.negotiation.length) return c.negotiation;
    return [{ by: 'customer', amount: Number(c.laborAmount != null ? c.laborAmount : c.amount), note: null, at: c.createdAt }];
  }
  function currentPrice(c) { return Number(c.laborAmount != null ? c.laborAmount : c.amount); }
  function waitingOn(c) { return c.waitingOn || 'provider'; }
  function names(c) {
    return { pro: c.providerName || c.pro || (c.provider && c.provider.name) || 'the pro', customer: c.customerName || c.customer || 'the customer' };
  }

  // A short, readable thread: "You offered $150 · Aisha suggested $180: materials cost more"
  window.priceTalkHTML = function (contractId, viewer) {
    const c = (typeof RAW_CONTRACTS === 'object' && RAW_CONTRACTS[contractId]) || null;
    if (!c || c.status !== 'pending_agreement') return '';
    const n = names(c);
    const lines = historyOf(c).map((h, i, all) => {
      const mine = h.by === viewer;
      const who = mine ? tr('You') : (h.by === 'provider' ? first(n.pro) : first(n.customer));
      const verb = i === 0 ? tr('offered') : tr('suggested');
      const latest = i === all.length - 1;
      return `<div style="font-size:13px;color:${latest ? 'var(--navy)' : 'var(--slate)'};${latest ? 'font-weight:600;' : ''}">${e(who)} ${e(verb)} ${money(h.amount)}${h.note ? `: <span style="font-weight:400;">"${e(h.note)}"</span>` : ''}</div>`;
    }).join('');
    return `<div style="margin-top:6px;padding:8px 10px;background:var(--offwhite, #F6F4EF);border-radius:8px;">${lines}</div>`;
  };

  // What each side can do on an offer booking that isn't agreed yet.
  window.priceActionsHTML = function (contractId, viewer) {
    const c = (typeof RAW_CONTRACTS === 'object' && RAW_CONTRACTS[contractId]) || null;
    if (!c) return '';
    const n = names(c);
    const price = currentPrice(c);
    const myTurn = waitingOn(c) === viewer;
    const used = historyOf(c).filter(h => h.by === viewer).length;
    const canSuggest = used < MAX_EACH;
    const id = jsArg(contractId);
    if (viewer === 'customer') {
      if (!myTurn) return `<span style="font-size:13px;color:var(--slate);">${e(tr('Waiting for'))} ${e(first(n.pro))} ${e(tr('to answer your'))} ${money(price)}</span> <button class="btn-sm btn-sm-outline" onclick="cancelBooking(${id})">${e(tr('Withdraw Offer'))}</button>`;
      return `<button class="btn-sm btn-sm-primary" onclick="agreeToPrice(${id})">${e(tr('Accept'))} ${money(price)}</button> ${canSuggest ? `<button class="btn-sm btn-sm-outline" onclick="suggestPrice(${id},'customer')">${e(tr('Suggest a price'))}</button> ` : ''}<button class="btn-sm btn-sm-ghost" onclick="cancelBooking(${id})">${e(tr('Cancel'))}</button>`;
    }
    if (!myTurn) return `<span style="font-size:13px;color:var(--slate);">${e(tr('You suggested'))} ${money(price)}. ${e(tr('Waiting for the customer.'))}</span> <button class="btn-sm btn-sm-outline" onclick="respondToOffer(${id},'decline')">${e(tr('Decline'))}</button>`;
    return `<button class="btn-sm btn-sm-primary" onclick="respondToOffer(${id},'accept')">${e(tr('Accept'))} ${money(price)}</button> ${canSuggest ? `<button class="btn-sm btn-sm-outline" onclick="suggestPrice(${id},'provider')">${e(tr('Suggest a different price'))}</button> ` : ''}<button class="btn-sm btn-sm-ghost" onclick="respondToOffer(${id},'decline')">${e(tr('Decline'))}</button>`;
  };

  window.suggestPrice = function (contractId, viewer) {
    const c = RAW_CONTRACTS[contractId]; if (!c) return;
    const n = names(c);
    const price = currentPrice(c);
    const left = MAX_EACH - historyOf(c).filter(h => h.by === viewer).length;
    const other = viewer === 'customer' ? first(n.pro) : tr('The customer');
    overlay('price-suggest', e(tr('Suggest a price')), `${e(c.service || '')}`, `
      <div class="summary-row"><span>${e(tr('Price on the table now'))}</span><span><strong>${money(price)}</strong></span></div>
      <div class="form-group" style="margin-top:12px;"><label class="form-label" for="ps-amount">${e(tr('Your price ($)'))}</label>
        <input class="form-input" type="number" min="1" step="0.01" id="ps-amount" placeholder="e.g. ${Math.round(price)}"/></div>
      <div class="form-group"><label class="form-label" for="ps-note">${e(tr(viewer === 'provider' ? 'What this price covers' : 'Why this price'))} <span style="font-weight:400;color:var(--slate);">${e(tr('(optional)'))}</span></label>
        <input class="form-input" maxlength="300" id="ps-note" placeholder="${e(tr(viewer === 'provider' ? 'e.g. includes the new pipe and fittings' : 'e.g. I already bought the parts'))}"/></div>
      <div style="font-size:13px;color:var(--muted);">${e(other)} ${e(tr('can accept it or answer with another price. Nothing is paid until one of you accepts.'))} ${e(tr('You can suggest'))} ${left} ${e(tr(left === 1 ? 'more price.' : 'more prices.'))}</div>`,
      `<button class="confirm-btn" onclick="sendSuggestedPrice(${jsArg(contractId)})">${e(tr('Send my price'))}</button>`);
    setTimeout(() => { const i = el('ps-amount'); if (i) i.focus(); }, 50);
  };
  window.sendSuggestedPrice = async function (contractId) {
    const amount = Number((el('ps-amount') || {}).value);
    if (!(amount >= 1)) return showToast(tr('Enter a price of at least $1'));
    const note = ((el('ps-note') || {}).value || '').trim();
    try {
      await apiFetch('POST', `/contracts/${encodeURIComponent(contractId)}/propose`, { amount, note: note || undefined });
      closeOverlay('price-suggest');
      showToast(tr('Your price was sent'));
      await refreshAfterPriceChange();
    } catch (x) { showToast(x.message || tr('Could not send your price')); }
  };

  // The customer accepts the pro's price: show exactly what will happen first.
  window.agreeToPrice = function (contractId) {
    const c = RAW_CONTRACTS[contractId]; if (!c) return;
    const n = names(c);
    const price = currentPrice(c);
    const cash = c.payMethod === 'cash';
    const off = TIER_FEE_OFF[(AUTH.user && AUTH.user.membershipTier) || 'free'] || 0;
    const fee = cash || c.loyaltyPointsRedeemed ? 0 : Math.round(feeFor(price) * (1 - off) * 100) / 100;
    const goods = Number(c.storeGoodsTotal || 0) + (c.storeFeePaidBy === 'customer' ? Number(c.storeFee || 0) : 0);
    const total = Math.round((price + fee + goods) * 100) / 100;
    const codeMode = !!(window.PAYWAYS_OPTS && window.PAYWAYS_OPTS.protectedMode === 'code');
    const next = cash
      ? tr('The booking is confirmed. You pay the pro in cash, only once the work is done.')
      : codeMode
        ? tr('Next you get a payment code in My Bookings. Send the total by mobile money with the code in the reference. Trothen holds it until you say the job is done.')
        : tr('Your payment is held by Trothen until you say the job is done. If the pro doesn\'t come or something goes wrong, you get it back.');
    overlay('price-agree', `${e(tr('Accept'))} ${e(first(n.pro))}${e(tr('\'s price?'))}`, e(c.service || ''), `
      <div class="booking-summary">
        <div class="summary-row"><span>${e(tr('Agreed price'))}</span><span><strong>${money(price)}</strong></span></div>
        ${cash ? `<div class="summary-row"><span>${e(tr('Trothen service fee'))}</span><span>${e(tr('None, cash job'))}</span></div>`
          : `<div class="summary-row"><span>${e(tr('Trothen service fee'))} <small style="color:var(--muted);">(9%, $2.99–$25${off ? `, ${Math.round(off * 100)}% ${e(tr('off for members'))}` : ''})</small></span><span>${money(fee)}</span></div>`}
        ${goods ? `<div class="summary-row"><span>${e(tr('Goods from the store'))}</span><span>${money(goods)}</span></div>` : ''}
        <div class="summary-row total"><span>${e(tr(cash ? 'You pay the pro after the job' : 'Total to pay'))}</span><span>${money(cash ? price : total)}</span></div>
      </div>
      <div class="ver-note" style="margin-top:10px;">${e(next)}</div>`,
      `<button class="confirm-btn" onclick="sendAgree(${jsArg(contractId)}, ${price})">${e(tr('Accept and book'))}</button>`);
  };
  window.sendAgree = async function (contractId, price) {
    try {
      const r = await apiFetch('POST', `/contracts/${encodeURIComponent(contractId)}/agree`, { amount: price });
      closeOverlay('price-agree');
      const st = r && r.contract && r.contract.status;
      showToast(st === 'awaiting_payment' ? tr('Agreed. Your payment code is in My Bookings.') : tr('Agreed. Your booking is confirmed.'));
      await refreshAfterPriceChange();
    } catch (x) { showToast(x.message || tr('Could not accept this price')); }
  };

  async function refreshAfterPriceChange() {
    const role = AUTH.user && AUTH.user.role;
    if (role === 'provider' && typeof loadProviderData === 'function') { await loadProviderData(); selectProviderSection('contracts'); }
    else if (role === 'customer' && typeof loadCustomerData === 'function') { await loadCustomerData(); selectCustomerSection('bookings'); }
  }

  // ── a pro's price on a posted job ─────────────────────────────────────
  if (typeof respondToMatch === 'function') {
    const f = respondToMatch;
    respondToMatch = function (id, decision) {
      if (decision !== 'accept' || !BACKEND_AVAILABLE) return f.apply(this, arguments);
      const m = (providerData.matches || []).find(x => x.id === id) || {};
      overlay('match-quote', e(tr('Send your price')), e(m.service || ''), `
        ${m.budget && m.budget !== '—' ? `<div class="summary-row"><span>${e(tr('Customer\'s budget'))}</span><span>${e(m.budget)}</span></div>` : ''}
        <div class="form-group" style="margin-top:12px;"><label class="form-label" for="mq-price">${e(tr('Your price for the whole job ($)'))}</label>
          <input class="form-input" type="number" min="1" step="0.01" id="mq-price" placeholder="e.g. 150"/>
          <div style="font-size:12.5px;color:var(--muted);margin-top:5px;">${e(tr('Include everything you\'ll charge: labour, materials you bring, and getting there. The customer sees this price next to other pros\' prices.'))}</div></div>
        <div class="form-group"><label class="form-label" for="mq-covers">${e(tr('What this price covers'))} <span style="font-weight:400;color:var(--slate);">${e(tr('(optional)'))}</span></label>
          <input class="form-input" maxlength="300" id="mq-covers" placeholder="${e(tr('e.g. new pipe, fittings and 2 hours of work'))}"/></div>
        <div class="form-group"><label class="form-label" for="mq-note">${e(tr('A note to the customer'))} <span style="font-weight:400;color:var(--slate);">${e(tr('(optional)'))}</span></label>
          <input class="form-input" maxlength="1000" id="mq-note" placeholder="${e(tr('Why you\'re a good fit'))}"/></div>
        <div style="font-size:13px;color:var(--muted);">${e(tr('You can change your price until the customer hires someone. Not sure yet? Leave the price blank and message the customer first.'))}</div>`,
        `<button class="confirm-btn" onclick="sendMatchQuote(${jsArg(id)})">${e(tr('Send'))}</button>`);
      setTimeout(() => { const i = el('mq-price'); if (i) i.focus(); }, 50);
    };
  }
  window.sendMatchQuote = async function (id) {
    const raw = ((el('mq-price') || {}).value || '').trim();
    const price = raw ? Number(raw) : null;
    if (raw && !(price >= 1)) return showToast(tr('Enter a price of at least $1, or leave it blank'));
    const priceNote = ((el('mq-covers') || {}).value || '').trim();
    const coverLetter = ((el('mq-note') || {}).value || '').trim();
    try {
      await apiFetch('POST', `/matches/${encodeURIComponent(id)}/respond`, { decision: 'accept', price: price || undefined, priceNote: priceNote || undefined, coverLetter: coverLetter || undefined });
      closeOverlay('match-quote');
      showToast(price ? tr('Sent. The customer sees your price.') : tr('Sent. Message the customer to agree a price.'));
      await loadProviderData(); selectProviderSection('matches');
    } catch (x) { showToast(x.message || tr('Could not send')); }
  };
  window.changeMatchPrice = function (id) {
    const m = (providerData.matches || []).find(x => x.id === id) || {};
    overlay('match-price', e(tr(m.price ? 'Change your price' : 'Add your price')), e(m.service || ''), `
      ${m.price ? `<div class="summary-row"><span>${e(tr('Your price now'))}</span><span><strong>${money(m.price)}</strong></span></div>` : ''}
      <div class="form-group" style="margin-top:12px;"><label class="form-label" for="mp-price">${e(tr('New price for the whole job ($)'))}</label><input class="form-input" type="number" min="1" step="0.01" id="mp-price"/></div>
      <div class="form-group"><label class="form-label" for="mp-note">${e(tr('What this price covers'))} <span style="font-weight:400;color:var(--slate);">${e(tr('(optional)'))}</span></label><input class="form-input" maxlength="300" id="mp-note" value="${e(m.priceNote || '')}"/></div>
      <div style="font-size:13px;color:var(--muted);">${e(tr('The customer is told about the change.'))}</div>`,
      `<button class="confirm-btn" onclick="sendMatchPrice(${jsArg(id)})">${e(tr('Save my price'))}</button>`);
  };
  window.sendMatchPrice = async function (id) {
    const price = Number((el('mp-price') || {}).value);
    if (!(price >= 1)) return showToast(tr('Enter a price of at least $1'));
    const note = ((el('mp-note') || {}).value || '').trim();
    try {
      await apiFetch('POST', `/matches/${encodeURIComponent(id)}/price`, { price, note: note || undefined });
      closeOverlay('match-price'); showToast(tr('Price saved. The customer has been told.'));
      await loadProviderData(); selectProviderSection('matches');
    } catch (x) { showToast(x.message || tr('Could not save your price')); }
  };
})();
