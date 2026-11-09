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

  // ── one checkout screen for every way of paying (v125) ─────────────────
  async function ensureOpts() {
    if (window.PAYWAYS_OPTS) return window.PAYWAYS_OPTS;
    try { window.PAYWAYS_OPTS = await apiFetch('GET', '/customer-payments/options'); } catch (x) { window.PAYWAYS_OPTS = null; }
    return window.PAYWAYS_OPTS;
  }
  window.ensurePayOpts = ensureOpts;
  const modeNow = () => (window.PAYWAYS_OPTS && window.PAYWAYS_OPTS.protectedMode) || 'none';
  function payPanel(cash, total, ride) {
    const until = ride ? tr('until you confirm you arrived') : tr('until you say the job is done');
    if (cash) return { note: tr('💵 Cash: nothing to pay now. You pay the pro directly, only after the work is done. Trothen doesn\'t hold this money.'), btn: tr('Confirm') };
    const m = modeNow();
    if (m === 'card') return { note: `💳 ${tr('Card: next you pay on Stripe\'s secure page. Your card details never touch Trothen.')} ${tr('Trothen holds the money')} ${until}, ${tr('and you get it back if the pro doesn\'t come or something goes wrong.')}`, btn: `${tr('Continue to secure payment')} · ${money(total)}` };
    if (m === 'code') return { note: `🏦 ${tr('Pay to Trothen\'s account: next you get a payment code and Trothen\'s account details. Send the exact amount with the code.')} ${tr('Trothen holds it')} ${until}.`, btn: tr('Get my payment code') };
    if (m === 'simulated') return { note: `🛡️ ${tr('Escrow: Trothen holds this payment')} ${until}, ${tr('and you get it back if something goes wrong.')} ${tr('Payments aren\'t connected yet, so no real money moves for now.')}`, btn: `${tr('Pay')} ${money(total)}` };
    return { note: tr('Paying through Trothen isn\'t available in your country yet. Choose a cash job instead.'), btn: null };
  }
  // rows: [[label, value], ...]
  window.openCheckout = async function ({ title, sub, price, priceLabel, cash, goods, onConfirm, fee: feeGiven, feeNote, ride: isRide }) {
    await ensureOpts();
    const off = feeGiven != null ? 0 : (TIER_FEE_OFF[(AUTH.user && AUTH.user.membershipTier) || 'free'] || 0); // v125: rides pass their own fee
    const fee = cash ? 0 : feeGiven != null ? feeGiven : Math.round(feeFor(price) * (1 - off) * 100) / 100;
    const total = Math.round((price + fee + (goods || 0)) * 100) / 100;
    const pp = payPanel(cash, total, isRide);
    overlay('checkout', e(title), e(sub || ''), `
      <div class="booking-summary">
        <div class="summary-row"><span>${e(priceLabel || tr('Agreed price'))}</span><span><strong>${money(price)}</strong></span></div>
        ${cash ? `<div class="summary-row"><span>${e(tr('Trothen service fee'))}</span><span>${e(tr('None, cash job'))}</span></div>`
          : `<div class="summary-row"><span>${e(tr('Trothen service fee'))} <small style="color:var(--muted);">(${feeNote ? e(feeNote) : '9%, $2.99–$25'}${off ? `, ${Math.round(off * 100)}% ${e(tr('off for members'))}` : ''})</small></span><span>${money(fee)}</span></div>`}
        ${goods ? `<div class="summary-row"><span>${e(tr('Goods from the store'))}</span><span>${money(goods)}</span></div>` : ''}
        <div class="summary-row total"><span>${e(tr(cash ? 'You pay the pro after the job' : 'Total to pay'))}</span><span>${money(cash ? price : total)}</span></div>
      </div>
      <div class="ver-note" style="margin-top:10px;">${e(pp.note)}</div>`,
      pp.btn ? `<button class="confirm-btn" id="checkout-go">${e(pp.btn)}</button>` : `<button class="btn-sm btn-sm-outline" onclick="document.getElementById('checkout').remove()">${e(tr('Close'))}</button>`);
    const go = el('checkout-go');
    if (go) go.onclick = async () => { go.disabled = true; go.textContent = tr('Working…'); try { await onConfirm(total); } finally { const g = el('checkout-go'); if (g) { g.disabled = false; g.textContent = pp.btn; } } };
  };
  // After a step: say plainly what happened and what comes next, in front.
  window.showResult = function ({ icon, title, lines, then }) {
    overlay('step-result', `${icon || '✅'} ${e(title)}`, '', `<div style="font-size:14.5px;line-height:1.6;color:var(--navy);">${(lines || []).map(l => `<p style="margin:0 0 8px;">${e(l)}</p>`).join('')}</div>`,
      `<button class="confirm-btn" onclick="document.getElementById('step-result').remove()${then ? `;${then}` : ''}">${e(tr('OK'))}</button>`);
  };
  // A payment that needs the card page or a code: take the customer there.
  window.handlePaymentStep = function (payment, contract) {
    if (!payment) return false;
    if (payment.method === 'card' && payment.url) {
      overlay('checkout', `💳 ${e(tr('Taking you to the secure card page'))}`, '', `<p style="font-size:14.5px;">${e(tr('You\'ll pay on Stripe. When you\'re done you come straight back here.'))}</p>`, `<a class="confirm-btn" style="display:block;text-align:center;text-decoration:none;" href="${e(payment.url)}">${e(tr('Continue'))}</a>`);
      setTimeout(() => { window.location.href = payment.url; }, 900);
      return true;
    }
    if (payment.method === 'momo') { momoWait(payment, contract); return true; } // v147
    return false; // a code: payways.js shows the code screen
  };
  // v147: paying from the customer's own MTN MoMo wallet: MTN sends a prompt
  // to their phone; this waits for their PIN and says plainly what happened.
  let momoTimer = null;
  function momoWait(p, contract) {
    const id = p.contractId || (contract && contract.id);
    if (!id) return;
    const amount = `LRD ${Number(p.amountDue || 0).toLocaleString()}`;
    overlay('momo-wait', `📱 ${e(tr('Approve the payment on your phone'))}`, '',
      `<div style="font-size:14.5px;line-height:1.6;color:var(--navy);">
        <p style="margin:0 0 8px;">${e(tr('A payment prompt for'))} <strong>${e(amount)}</strong> ${e(tr('from'))} ${e(p.network || 'MTN Mobile Money')} ${e(tr('has been sent to your phone'))}${p.last4 ? ` (${e(tr('the number ending'))} ${e(p.last4)})` : ''}.</p>
        <p style="margin:0 0 8px;">${e(tr('Enter your Mobile Money PIN on your phone to approve it. Trothen holds the money until the job is done.'))}</p>
        <p id="momo-wait-state" style="margin:0;color:var(--slate);">⏳ ${e(tr('Waiting for your approval…'))}</p>
        <p style="font-size:12.5px;color:var(--muted);margin:8px 0 0;">${e(tr('Only approve a prompt you expect. Trothen never asks for your PIN by call or message.'))}</p></div>`,
      `<button class="btn-sm btn-sm-outline" id="momo-wait-close">${e(tr('Close (it keeps checking)'))}</button>`);
    const close = () => { clearInterval(momoTimer); momoTimer = null; const o = el('momo-wait'); if (o) o.remove(); };
    const btn = el('momo-wait-close'); if (btn) btn.onclick = close;
    const until = Date.now() + 12 * 60 * 1000;
    clearInterval(momoTimer);
    const refresh = async () => { try { if (typeof loadCustomerData === 'function') await loadCustomerData(); } catch (x) {} try { if (typeof ridesRefresh === 'function') ridesRefresh(); } catch (x) {} };
    const tick = async () => {
      if (!el('momo-wait') || Date.now() > until) { clearInterval(momoTimer); momoTimer = null; return; }
      try {
        const r = await apiFetch('GET', `/customer-payments/${encodeURIComponent(id)}/card-status`);
        if (r && r.paid && r.escrowStatus !== 'payment_expired') {
          close(); await refresh();
          showResult({ title: tr('Payment approved'), lines: [`${tr('We received')} ${amount}${r.bookingNumber ? ` ${tr('for booking')} #${r.bookingNumber}` : ''}.`, tr('Trothen is holding it safely until the job is done.'), r.isOrder ? tr('The seller has been told to get it ready.') : r.isRide ? tr('Your driver has been asked to confirm.') : tr('Your pro has been asked to confirm.')] });
        } else if (r && (r.escrowStatus === 'payment_expired' || r.bookingStatus === 'cancelled')) {
          close(); await refresh();
          showResult({ icon: '⚠️', title: tr('The payment was not approved'), lines: [tr('Nothing was taken from your wallet, and the booking was cancelled.'), tr('You can book again, or choose another way to pay.')] });
        }
      } catch (x) { /* try again shortly */ }
    };
    momoTimer = setInterval(tick, 4000);
  }
  window.payMomoWait = momoWait;

  // The customer accepts the pro's suggested price.
  window.agreeToPrice = function (contractId) {
    const c = RAW_CONTRACTS[contractId]; if (!c) return;
    const n = names(c);
    const price = currentPrice(c);
    const goods = Number(c.storeGoodsTotal || 0) + (c.storeFeePaidBy === 'customer' ? Number(c.storeFee || 0) : 0);
    openCheckout({ title: `${tr('Accept')} ${first(n.pro)}${tr('\'s price')}`, sub: c.service, price, cash: c.payMethod === 'cash', goods, onConfirm: async (total) => {
      try {
        const r = await apiFetch('POST', `/contracts/${encodeURIComponent(contractId)}/agree`, { amount: price });
        closeOverlay('checkout');
        if (handlePaymentStep(r && r.payment, r && r.contract)) return;
        await refreshAfterPriceChange();
        const st = r && r.contract && r.contract.status;
        if (st === 'awaiting_payment') return; // the payment code screen is showing
        showResult({ title: tr('Booked'), lines: [`${tr('You agreed')} ${money(price)} ${tr('with')} ${first(n.pro)}.`, c.payMethod === 'cash' ? tr('Pay the pro in cash after the work is done.') : tr('Trothen is holding your payment until you say the job is done.'), tr('You\'ll find it in My Bookings.')] });
      } catch (x) { showToast(x.message || tr('Could not accept this price')); }
    } });
  };
  // Pay a price the pro accepted (test payment, or the card page).
  window.payNow = function (contractId) {
    const c = RAW_CONTRACTS[contractId]; if (!c) return;
    const n = names(c);
    const price = currentPrice(c);
    const goods = Number(c.storeGoodsTotal || 0) + (c.storeFeePaidBy === 'customer' ? Number(c.storeFee || 0) : 0);
    openCheckout({ title: tr('Pay to confirm your booking'), sub: c.service, price, cash: false, goods, onConfirm: async (total) => {
      try {
        const r = await apiFetch('POST', `/contracts/${encodeURIComponent(contractId)}/pay`, { total });
        closeOverlay('checkout');
        if (handlePaymentStep(r && r.payment, r && r.contract)) return;
        await refreshAfterPriceChange();
        showResult({ title: tr('Paid'), lines: [`${money(total)} ${tr('paid. Trothen is holding it until you say the job is done.')}`, `${first(n.pro)} ${tr('has been told. Your booking is confirmed.')}`] });
      } catch (x) {
        if (x && /payment code/i.test(x.message || '')) { await refreshAfterPriceChange(); if (typeof payWaysShow === 'function') return payWaysShow(contractId); }
        showToast(x.message || tr('Could not pay'));
      }
    } });
  };

  // ── the price box on each pro's card in "Responses to Your Job" ──────────
  window.candidateDealHTML = function (c, job, canAct) {
    const p = c.provider || {}; const fn = first(p.name); const id = jsArg(p.id);
    const o = c.offer;
    if (o) RAW_CONTRACTS[o.id] = { ...(RAW_CONTRACTS[o.id] || {}), ...o };
    const box = (inner, color) => `<div style="margin-top:12px;padding:12px 14px;border:2px solid ${color || 'var(--teal)'};border-radius:10px;background:var(--offwhite, #FAF8F4);">${inner}</div>`;
    const head = (t) => `<div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--slate);margin-bottom:6px;">${e(t)}</div>`;
    if (o && o.status === 'pending_agreement') {
      return box(`${head(tr('Agreeing the price'))}${priceTalkHTML(o.id, 'customer')}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">${priceActionsHTML(o.id, 'customer')}</div><div style="font-size:12.5px;color:var(--muted);margin-top:6px;">${e(tr('Nothing is paid until you both agree one price.'))}</div>`);
    }
    if (o && o.status === 'awaiting_payment') {
      const total = Math.round(((o.amount || 0) + (o.serviceFee || 0)) * 100) / 100;
      return box(`${head(tr('Price agreed'))}<div style="font-size:20px;font-weight:800;color:var(--navy);">${money(o.laborAmount != null ? o.laborAmount : o.amount)}</div><div style="font-size:13.5px;margin:4px 0 10px;">${e(tr('Pay to confirm the booking. Nothing is booked until you pay.'))}</div><button class="confirm-btn" onclick="payNow(${jsArg(o.id)})">💳 ${e(tr('Pay'))} ${money(total)}</button>`, 'var(--gold, #C9A227)');
    }
    if (o && o.status === 'pending_provider_confirmation') return box(`${head(tr('Paid'))}<div style="font-size:14px;">${e(tr('You paid'))} ${money(o.laborAmount != null ? o.laborAmount : o.amount)}. ${e(tr('Waiting for'))} ${e(fn)} ${e(tr('to confirm. If they don\'t, you get your money back.'))}</div>`);
    if (o && o.status === 'active') return box(`${head(tr('Booked'))}<div style="font-size:14px;">✅ ${e(tr('Booked with'))} ${e(fn)} ${e(tr('at'))} ${money(o.laborAmount != null ? o.laborAmount : o.amount)}. ${e(tr('See it in My Bookings.'))}</div>`);
    if (o && o.status === 'completed') return box(`${head(tr('Done'))}<div style="font-size:14px;">${e(tr('This job is done.'))}</div>`);
    if (!canAct) return '';
    if (c.cashReady === false) return box(`<div style="font-size:13.5px;">${e(fn)} ${e(tr('can\'t take cash jobs at the moment, so you can\'t hire them for this cash job. Choose another pro, or post the job again with "Protected by Trothen".'))}</div>`, 'var(--border)');
    const offerRow = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px;"><span style="font-size:13.5px;">${e(tr(c.price ? 'Or offer a different price:' : 'Offer a price:'))}</span><input class="form-input" type="number" min="1" step="0.01" style="width:120px;" id="job-offer-amount-${e(p.id)}" placeholder="$"/><button class="btn-sm btn-sm-outline" onclick="sendJobOffer(${id})">${e(tr('Send offer'))}</button></div>`;
    if (c.price) {
      return box(`${head(fn + tr('\'s price'))}<div style="font-size:24px;font-weight:800;color:var(--navy);">${money(c.price)}</div>${c.priceNote ? `<div style="font-size:13px;color:var(--slate);">${e(c.priceNote)}</div>` : ''}
        <button class="confirm-btn" style="margin-top:10px;" onclick="acceptQuote(${id})">${e(tr(job && job.payMethod === 'cash' ? 'Accept and book' : 'Accept and pay'))} ${money(c.price)}</button>${offerRow}`);
    }
    return box(`${head(tr('Price'))}<div style="font-size:14px;">${e(fn)} ${e(tr('hasn\'t given a price yet.'))}</div><button class="btn-sm btn-sm-primary" style="margin-top:8px;" onclick="askForPrice(${id})">${e(tr('Ask'))} ${e(fn)} ${e(tr('for a price'))}</button>${offerRow}`, 'var(--border)');
  };
  window.acceptQuote = function (providerId) {
    const c = CANDIDATE_ROWS[providerId]; const job = CANDIDATE_JOB; if (!c || !job) return;
    const fn = first(c.provider.name);
    openCheckout({ title: `${tr('Book')} ${fn} ${tr('at their price')}`, sub: job.description, price: Number(c.price), priceLabel: fn + tr('\'s price'), cash: job.payMethod === 'cash', onConfirm: async () => {
      try {
        const r = await apiFetch('POST', `/jobs/${encodeURIComponent(job.id)}/select-provider`, { providerId });
        closeOverlay('checkout');
        if (handlePaymentStep(r && r.payment, r && r.contract)) return;
        if (r && r.contract && r.contract.status === 'awaiting_payment') return; // the payment code screen is showing
        await viewJobCandidates(job.id);
        showResult({ title: job.payMethod === 'cash' ? tr('Booking sent') : tr('Paid'), lines: [
          job.payMethod === 'cash' ? `${tr('You booked')} ${fn} ${tr('at')} ${money(c.price)}, ${tr('paid in cash after the job.')}` : `${tr('You paid for')} ${fn} ${tr('at')} ${money(c.price)}. ${tr('Trothen is holding the money until you say the job is done.')}`,
          `${fn} ${tr('has been asked to confirm. If they don\'t, the job goes to the next pro, or you get your money back.')}`] });
      } catch (x) { showToast(x.message || tr('Could not book')); }
    } });
  };
  window.sendJobOffer = async function (providerId) {
    const c = CANDIDATE_ROWS[providerId]; const job = CANDIDATE_JOB; if (!c || !job) return;
    const amount = Number((el('job-offer-amount-' + providerId) || {}).value);
    if (!(amount >= 1)) return showToast(tr('Type your price first'));
    const fn = first(c.provider.name);
    try {
      await apiFetch('POST', `/jobs/${encodeURIComponent(job.id)}/select-provider`, { providerId, amount });
      await viewJobCandidates(job.id);
      showResult({ icon: '📨', title: tr('Offer sent'), lines: [`${tr('You offered')} ${fn} ${money(amount)}.`, `${fn} ${tr('can accept it, suggest a different price, or decline. You\'ll see the answer right here, straight away.')}`, tr('Nothing is paid until you both agree one price.')] });
    } catch (x) { showToast(x.message || tr('Could not send your offer')); }
  };
  window.askForPrice = async function (providerId) {
    const c = CANDIDATE_ROWS[providerId]; const job = CANDIDATE_JOB; if (!c || !job) return;
    try {
      await apiFetch('POST', '/messages', { toId: providerId, text: `Hi ${first(c.provider.name)}, what is your price for this job? Please send it with "Send my price" so I can accept it.`, jobId: job.id });
      showToast(tr('Asked. You\'ll see their price here as soon as they send it.'));
      await viewJobCandidates(job.id);
    } catch (x) { showToast(x.message || tr('Could not send')); }
  };

  // ── the pro's chat window: a price box above the messages ───────────────
  window.drawProPriceBox = function (match) {
    const slot = el('job-negotiation-price'); if (!slot) return;
    if (!match) { slot.innerHTML = ''; return; }
    if (match.offerContractId) {
      slot.innerHTML = `<div class="ver-note" style="margin-bottom:10px;">💬 ${e(tr('The customer offered you a price for this job.'))} <a style="color:var(--teal);font-weight:600;cursor:pointer;" onclick="document.getElementById('job-negotiation-modal').classList.remove('open');selectProviderSection('contracts')">${e(tr('Answer it in My Contracts'))}</a></div>`;
      return;
    }
    if (match.matchStatus && !['interested', 'pending'].includes(match.matchStatus)) { slot.innerHTML = ''; return; }
    const budgetAmt = typeof postedBudgetAmount === 'function' ? postedBudgetAmount(match.budget) : null; // v127
    slot.innerHTML = `<div style="border:2px solid var(--teal);border-radius:10px;padding:10px 12px;margin-bottom:10px;">
      ${budgetAmt ? `<div style="margin-bottom:10px;"><div style="font-size:13.5px;margin-bottom:6px;">${e(tr('The customer\'s price:'))} <strong>${money(budgetAmt)}</strong></div><button class="confirm-btn" onclick="acceptPostedBudget(${jsArg(match.id)}, ${budgetAmt})">${e(tr('Accept the job at'))} ${money(budgetAmt)}</button><div style="font-size:12.5px;color:var(--slate);margin-top:6px;">${e(tr('Or send a different price below.'))}</div></div>` : ''}
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--slate);margin-bottom:4px;">${e(tr(budgetAmt ? 'A different price' : 'Your price for this job'))}</div>
      ${match.price ? `<div style="font-size:20px;font-weight:800;color:var(--navy);">${money(match.price)}</div>` : `<div style="font-size:13.5px;color:var(--slate);">${e(tr('Not sent yet. Send it here, not as a chat message, so the customer can accept it with one press.'))}</div>`}
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;"><input class="form-input" type="number" min="1" step="0.01" style="width:130px;" id="pp-price" placeholder="$"/><input class="form-input" style="flex:1;min-width:140px;" maxlength="300" id="pp-note" placeholder="${e(tr('What it covers (optional)'))}"/><button class="btn-sm btn-sm-primary" onclick="sendProPriceFromChat(${jsArg(match.id)})">${e(tr(match.price ? 'Change my price' : 'Send my price'))}</button></div></div>`;
  };
  window.sendProPriceFromChat = async function (matchId) {
    const price = Number((el('pp-price') || {}).value);
    if (!(price >= 1)) return showToast(tr('Enter a price of at least $1'));
    const note = ((el('pp-note') || {}).value || '').trim();
    try {
      await apiFetch('POST', `/matches/${encodeURIComponent(matchId)}/price`, { price, note: note || undefined });
      showToast(tr('Price sent. The customer sees it now and can accept it.'));
      await loadProviderData();
      const m = (providerData.matches || []).find(x => x.id === matchId); drawProPriceBox(m);
    } catch (x) { showToast(x.message || tr('Could not send your price')); }
  };

  // ── coming back from the card page ───────────────────────────────────────
  (function returnFromCard() {
    const q = new URLSearchParams(window.location.search);
    const paid = q.get('paid'), cancelled = q.get('paycancel');
    if (!paid && !cancelled) return;
    try { history.replaceState(null, '', window.location.pathname); } catch (x) {}
    let tries = 0;
    const wait = setInterval(async () => {
      if (!(AUTH && AUTH.token && AUTH.user) && tries++ < 40) return;
      clearInterval(wait);
      if (!AUTH.token) return;
      if (cancelled) return showResult({ icon: '↩️', title: tr('Payment not finished'), lines: [tr('Nothing was charged. You can pay any time from My Bookings with Pay now, until the booking runs out.')], then: "goToCustomerDashboard('bookings')" });
      let r = null;
      for (let i = 0; i < 6 && !(r && r.paid); i++) { try { r = await apiFetch('GET', `/customer-payments/${encodeURIComponent(paid)}/card-status`); } catch (x) {} if (!(r && r.paid)) await new Promise(res => setTimeout(res, 1500)); }
      if (r && r.paid) showResult({ title: tr('Payment received'), lines: [`${tr('Booking')} #${r.bookingNumber || ''}: ${tr('your card payment went through. Trothen is holding it')} ${tr(r.isRide ? 'until you confirm you arrived.' : 'until you say the job is done.')}`, r.bookingStatus === 'pending_provider_confirmation' ? tr('Your pro has been asked to confirm.') : tr('Your booking is confirmed.')], then: r.isRide ? "goToCustomerDashboard('rides')" : "goToCustomerDashboard('bookings')" });
      else showResult({ icon: '⏳', title: tr('Checking your payment'), lines: [tr('Stripe hasn\'t confirmed it yet. This page updates by itself as soon as it does. Nothing is booked until it\'s confirmed.')], then: "goToCustomerDashboard('bookings')" });
    }, 250);
  })();

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
