/* Check your booking before you send it (v120).
   Loaded last, after trothen.js, rides.js, tokens.js and payways.js.

   Before this, "Confirm & Pay Securely" sent the booking straight away.
   The customer never saw their offer, the fee and the total together with
   the date, place and way of paying before it went to the pro.

   Now the first press opens a review screen inside the booking window.
   It shows everything that will be sent, worked out the same way the
   server works it out (9% service fee, $2.99 minimum, $25 maximum; no fee
   on a cash job; no fee when loyalty points are used). From there the
   customer can go back and change something, or send it.

   It also keeps the price box at the top of the form honest when "Cash to
   the pro after the job" is picked: a cash job has no Trothen service fee,
   so the box says so instead of still showing 9%. */
(function () {
  'use strict';
  if (typeof confirmBooking !== 'function') return;

  const sendBooking = confirmBooking; // the real one in trothen.js
  const el = (id) => document.getElementById(id);
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const money = (n) => '$' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
  const feeFor = (amount) => amount > 0 ? Math.round(Math.min(Math.max(amount * 0.09, 2.99), 25) * 100) / 100 : 0;

  // Members get part of the service fee off (src/membership.js), the same as the server.
  const TIER_FEE_OFF = { plus: 0.20, pro: 0.40, elite: 0.60, vip: 0.80 };
  function memberFee(amount) {
    const off = TIER_FEE_OFF[(AUTH.user && AUTH.user.membershipTier) || 'free'] || 0;
    return { fee: Math.round(feeFor(amount) * (1 - off) * 100) / 100, off };
  }

  const codeMode = () => !!(window.PAYWAYS_OPTS && window.PAYWAYS_OPTS.protectedMode === 'code');
  const cardMode = () => !!(window.PAYWAYS_OPTS && window.PAYWAYS_OPTS.protectedMode === 'card'); // v125

  function payWay() {
    const r = document.querySelector('input[name="pw-booking"]:checked');
    return r ? r.value : 'protected';
  }
  const pick = () => (typeof bookingPick === 'function' && currentPro ? bookingPick() : null); // v141
  function isOfferBooking() {
    if (!currentPro) return false;
    const pk = pick(); if (pk) return pk.kind === 'offer';
    return currentPro.pricingModel === 'negotiable' || (currentPro.pricingModel === 'both' && bookingPricingChoice === 'offer');
  }
  function goodsPicked() {
    return !!(typeof BOOKING_BASKET_PRICED !== 'undefined' && BOOKING_BASKET_PRICED && BOOKING_BASKET_PRICED.items && BOOKING_BASKET_PRICED.items.length);
  }

  // The same checks the real confirmBooking() makes, so the review screen
  // only opens for a booking that can actually be sent.
  function formProblem() {
    const desc = el('job-desc').value.trim();
    if (!desc || desc.length < 3) return 'Describe the job in at least 3 characters';
    if (!el('job-date').value) return 'Pick a date for the job';
    if (!el('job-time').value) return 'Pick a time for the job';
    const addr = el('job-address').value.trim();
    const where = readJobWhere('book');
    if ((!addr || addr.length < 5) && !where.jobLocation && !(where.landmark && where.landmark.length >= 5)) return 'Tell your pro where the job is: pin the location, describe a landmark, or type an address';
    const pk = pick();
    if (pk && pk.error) return pk.error;
    if (!pk && isOfferBooking()) {
      const offerEl = el('job-offer-amount');
      const offer = offerEl ? parseFloat(offerEl.value) : 0;
      if (!offer || offer <= 0) return 'Enter your offer amount';
    }
    const adv = parseFloat(el('job-materials-advance').value) || 0;
    if (adv < 0) return 'Materials advance can\'t be negative';
    if (adv > jobAmount()) return 'The materials advance can\'t be more than the total job amount';
    if (payWay() === 'cash') {
      if (goodsPicked()) return 'Goods from a pro\'s store must be paid through Trothen. Choose a protected payment, or remove the goods.';
      if (adv > 0) return 'A materials advance needs a protected payment, because Trothen pays it to the pro. Remove the advance or choose a protected payment.';
      if (loyaltyTicked()) return 'Loyalty points waive Trothen\'s service fee, and a cash job has none. Untick the points to book a cash job.';
    }
    return null;
  }
  function jobAmount() {
    if (!currentPro) return 0;
    const pk = pick(); if (pk) return pk.amount || 0;
    if (isOfferBooking()) { const o = el('job-offer-amount'); return o ? (parseFloat(o.value) || 0) : 0; }
    return currentPro.price * 2;
  }
  function loyaltyTicked() { const c = el('booking-use-loyalty-points'); return !!(c && c.checked); }

  function row(label, value, strong) {
    return `<div class="summary-row${strong ? ' total' : ''}"><span>${label}</span><span style="text-align:right;">${value}</span></div>`;
  }

  // v121: can this pro take a cash job at this price? (yes/no from the server)
  let cashCheckSeq = 0;
  async function cashCheck() {
    const note = el('pw-cash-ready-booking');
    if (payWay() !== 'cash' || !currentPro) { if (note) note.style.display = 'none'; return { ok: true }; }
    const amount = jobAmount();
    if (!(amount > 0)) { if (note) note.style.display = 'none'; return { ok: true }; }
    const seq = ++cashCheckSeq;
    let r;
    try { r = await apiFetch('GET', `/customer-payments/cash-check?providerId=${encodeURIComponent(currentPro.id)}&amount=${amount}`); }
    catch (x) { return { ok: true }; } // the server checks again when the booking is sent
    if (seq !== cashCheckSeq) return r;
    let box = el('pw-cash-ready-booking');
    if (!box) {
      const wrap = document.querySelector('[data-payway="booking"]');
      if (wrap) { wrap.insertAdjacentHTML('beforeend', '<div id="pw-cash-ready-booking" class="ver-note" style="display:none;margin-top:6px;border-color:#B4472E;color:#7A2E1C;"></div>'); box = el('pw-cash-ready-booking'); }
    }
    if (box) { box.textContent = r.ok ? '' : (r.message || tr('This pro can\'t take cash jobs at the moment.')); box.style.display = r.ok ? 'none' : 'block'; }
    return r;
  }
  let cashTimer = null;
  function cashCheckSoon() { clearTimeout(cashTimer); cashTimer = setTimeout(cashCheck, 400); }

  async function showReview() {
    const problem = formProblem();
    if (problem) return showToast(tr(problem));
    if (payWay() === 'cash') {
      const ready = await cashCheck();
      if (!ready.ok) return showToast(ready.message || tr('This pro can\'t take cash jobs at the moment.'));
    }

    const cash = payWay() === 'cash';
    const offer = isOfferBooking();
    const job = Math.round(jobAmount() * 100) / 100;
    const points = !cash && loyaltyTicked();
    const mf = memberFee(job);
    const fee = cash || points ? 0 : mf.fee;
    const goods = !cash && goodsPicked() ? BOOKING_BASKET_PRICED : null;
    const goodsMoney = goods ? (goods.goodsTotal || 0) + (goods.purchaseFee || 0) : 0;
    const total = Math.round((job + fee + goodsMoney) * 100) / 100;
    const adv = cash ? 0 : (parseFloat(el('job-materials-advance').value) || 0);
    const first = currentPro.name.split(' ')[0];

    const rawTime = el('job-time').value;
    const time = rawTime ? new Date(`2000-01-01T${rawTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    const dateText = new Date(el('job-date').value + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const addr = el('job-address').value.trim();
    const where = readJobWhere('book');
    const whereBits = [];
    if (addr) whereBits.push(e(addr));
    if (where.jobLocation) whereBits.push(e(tr('Pinned on the map')));
    if (where.landmark) whereBits.push(e(where.landmark));
    const have = (el('job-materials-on-hand') || {}).value ? el('job-materials-on-hand').value.trim() : '';
    const photos = typeof getUploadedJobPhotoUrls === 'function' ? getUploadedJobPhotoUrls('booking').length : 0;

    let priceRows = offer
      ? row(e(tr('Your offer')), `<strong>${money(job)}</strong>`)
      : row(e(tr('Job amount')) + ` <small style="color:var(--muted);">(${pick() ? e(pick().label) : `2 hr × ${money(currentPro.price)}/hr`})</small>`, money(job));
    if (cash) priceRows += row(e(tr('Trothen service fee')), e(tr('None, cash job')));
    else if (points) priceRows += row(e(tr('Trothen service fee')), e(tr('Waived with 25 loyalty points')));
    else priceRows += row(e(tr('Trothen service fee')) + ` <small style="color:var(--muted);">(9%, $2.99–$25${mf.off ? `, ${Math.round(mf.off * 100)}% ${e(tr('off for members'))}` : ''})</small>`, money(fee));
    if (goods) {
      priceRows += goods.items.map(i => row(`${i.qty} × ${e(i.name)}`, money(i.lineTotal))).join('');
      if (goods.purchaseFee > 0) priceRows += row(e(tr('Store purchase fee')), money(goods.purchaseFee));
    }
    if (adv > 0) priceRows += row(e(tr('Materials advance')) + ` <small style="color:var(--muted);">(${e(tr('part of the job amount, released to the pro right away'))})</small>`, money(adv));
    priceRows += cash
      ? row(e(tr('You pay the pro after the job')), money(job), true)
      : row(e(tr(offer ? 'Total if your offer is accepted' : 'Total to pay')), money(total), true);
    priceRows += `<div id="review-local-money" style="font-size:13px;color:var(--muted);text-align:right;"></div>`;

    let what;
    if (offer && cash) what = `${first} ${tr('sees your offer and can accept it, suggest a different price, or decline. You agree one final price together, then you pay the pro in cash, only after the work is done.')}`;
    else if (offer && codeMode()) what = `${first} ${tr('sees your offer and can accept it, suggest a different price, or decline. Nothing is paid until you both agree one final price. Then you get a payment code to pay Trothen\'s account, and Trothen holds the money until you say the job is done.')}`;
    else if (offer) what = `${first} ${tr('sees your offer and can accept it, suggest a different price, or decline. Nothing is charged until you both agree one final price. Then Trothen holds your money until you say the job is done.')}`;
    else if (cash) what = tr('Nothing is paid now. You pay the pro directly, only once the work is done. Trothen does not hold this money, so it can\'t refund it.');
    else if (cardMode()) what = tr('Next you pay by card on Stripe\'s secure page; your card details never touch Trothen. Trothen holds the money until you say the job is done, and you get it back if the pro doesn\'t come or something goes wrong.');
    else if (codeMode()) what = tr('Next you get a payment code. Send the total to Trothen\'s account with the code in the reference. Your pro is asked to confirm once we see your payment. Trothen holds it until you say the job is done, and you get it back if the pro doesn\'t come or something goes wrong.');
    else what = tr('Trothen holds your payment until you say the job is done. If the pro doesn\'t come or something goes wrong, you get it back.');

    const box = ensureReviewBox();
    box.innerHTML = `
      <div style="font-weight:700;color:var(--navy);font-size:16px;margin-bottom:4px;">${e(tr('Check your booking'))}</div>
      <div style="font-size:13.5px;color:var(--slate);margin-bottom:12px;">${e(tr('This is exactly what will be sent to'))} ${e(String(currentPro.name).replace(/\.+$/, ''))}.</div>
      <div class="booking-summary">${priceRows}</div>
      <div class="booking-summary" style="margin-top:10px;">
        ${row(e(tr('Pro')), e(currentPro.name))}
        ${row(e(tr('Job')), e(el('job-desc').value.trim()))}
        ${have ? row(e(tr('You already have')), e(have)) : ''}
        ${row(e(tr('When')), `${e(dateText)}, ${e(time)}`)}
        ${row(e(tr('Where')), whereBits.join('<br>'))}
        ${photos ? row(e(tr('Photos')), String(photos)) : ''}
        ${row(e(tr('How you pay')), e(tr(cash ? '💵 Cash to the pro after the job' : '🛡️ Protected by Trothen')))}
      </div>
      <div class="ver-note" style="margin-top:10px;">${e(what)}</div>`;

    setReviewMode(true, offer, cash);
    localMoney(cash ? job : total);
  }

  // The amount in the customer's own money, when they pay in it.
  async function localMoney(amount) {
    const slot = el('review-local-money');
    if (!slot || !amount || typeof currentCurrencyInfo === 'undefined' || !currentCurrencyInfo || currentCurrencyInfo.isUSD) return;
    if (typeof selectedPayCurrency !== 'undefined' && selectedPayCurrency === 'usd') { slot.textContent = tr('Charged in US dollars'); return; }
    try {
      const data = await apiFetch('GET', `/currency/mine?amount=${amount}`);
      const c = currentCurrencyInfo.currency;
      if (data && data.convertedAmount && el('review-local-money')) el('review-local-money').textContent = `≈ ${c.code} ${Number(String(data.convertedAmount).replace(/,/g, '')).toLocaleString()}`;
    } catch (x) { /* the dollar amount is still shown */ }
  }

  function ensureReviewBox() {
    let box = el('booking-review');
    if (!box) {
      box = document.createElement('div');
      box.id = 'booking-review';
      box.className = 'modal-body';
      box.style.display = 'none';
      const body = document.querySelector('#booking-modal .modal-body');
      body.insertAdjacentElement('afterend', box);
    }
    return box;
  }

  function setReviewMode(on, offer, cash) {
    const body = document.querySelector('#booking-modal .modal-body:not(#booking-review)');
    const box = ensureReviewBox();
    const footer = document.querySelector('#booking-modal .modal-footer');
    const btn = footer.querySelector('.confirm-btn');
    if (body) body.style.display = on ? 'none' : '';
    box.style.display = on ? '' : 'none';
    let back = el('booking-review-back');
    if (on) {
      if (!back) {
        back = document.createElement('button');
        back.id = 'booking-review-back';
        back.type = 'button';
        back.className = 'btn-sm btn-sm-outline';
        back.style.cssText = 'width:100%;margin-bottom:8px;padding:12px;';
        back.onclick = () => setReviewMode(false);
        footer.insertBefore(back, btn);
      }
      back.textContent = '← ' + tr('Change something');
      back.style.display = '';
      btn.textContent = offer ? tr('Send my offer') : cash ? tr('Confirm cash booking') : codeMode() ? tr('Book and get my payment code') : cardMode() ? '🔒 ' + tr('Continue to secure card payment') : '🔒 ' + tr('Confirm & Pay Securely');
      footer.dataset.reviewing = '1';
      const modal = document.querySelector('#booking-modal .modal'); if (modal) modal.scrollTop = 0;
      box.scrollTop = 0;
    } else {
      if (back) back.style.display = 'none';
      delete footer.dataset.reviewing;
      formButton();
    }
  }

  // On the form, the button opens the review; it never sends the booking.
  function formButton() {
    const footer = document.querySelector('#booking-modal .modal-footer');
    if (!footer || footer.dataset.reviewing === '1') return;
    const btn = footer.querySelector('.confirm-btn');
    const pk = pick();
    if (btn) btn.textContent = pk && pk.kind === 'ask' ? tr('Send my request') + ' →' : tr('Check my booking') + ' →'; // v141
  }

  confirmBooking = async function () {
    const footer = document.querySelector('#booking-modal .modal-footer');
    // v141: "Ask for a price" sends the job description straight to the pro; there's nothing to pay yet.
    const pk = pick();
    if (pk && pk.kind === 'ask') {
      const desc = el('job-desc').value.trim(); const addr = el('job-address').value.trim(); const where = readJobWhere('book');
      if (!desc || desc.length < 5) return showToast(tr('Describe the job in at least 5 characters, so the pro can price it'));
      if ((!addr || addr.length < 5) && !where.jobLocation && !(where.landmark && where.landmark.length >= 5)) return showToast(tr('Tell your pro where the job is: pin the location, describe a landmark, or type an address'));
      return sendPriceRequest();
    }
    if (!footer || footer.dataset.reviewing !== '1') return showReview();
    const btn = footer.querySelector('.confirm-btn');
    if (btn) btn.disabled = true;
    try {
      // The form fields are still filled in behind the review screen, so the
      // real booking reads exactly what the customer just checked.
      setReviewMode(false);
      return await sendBooking.apply(this, arguments);
    } finally { if (btn) btn.disabled = false; }
  };

  // Every time the booking window opens it starts on the form, not the review.
  if (typeof openBooking === 'function') {
    const f = openBooking;
    openBooking = async function () {
      const box = el('booking-review'); if (box) setReviewMode(false);
      const r = await f.apply(this, arguments);
      cashPriceBox();
      formButton();
      return r;
    };
  }

  // ── the price box at the top of the form, for a cash job ─────────────
  function cashPriceBox() {
    const sum = el('booking-summary'); if (!sum) return;
    const cash = payWay() === 'cash';
    sum.querySelectorAll('.summary-row').forEach(r => {
      const label = r.querySelector('span'); const val = r.querySelectorAll('span')[1];
      if (!label || !val) return;
      if (/^Service fee/.test(label.textContent.trim()) || r.dataset.cashFee) {
        if (cash) {
          if (!r.dataset.cashFee) { r.dataset.cashFee = '1'; r.dataset.origLabel = label.innerHTML; r.dataset.origVal = val.innerHTML; }
          label.textContent = tr('Service fee');
          val.textContent = tr('None, cash job');
        } else if (r.dataset.cashFee) {
          label.innerHTML = r.dataset.origLabel; val.innerHTML = r.dataset.origVal; delete r.dataset.cashFee;
          if (typeof updateCurrencyPreview === 'function') updateCurrencyPreview();
        }
      }
      if (r.classList.contains('total')) {
        const job = jobAmount();
        if (cash) {
          if (!r.dataset.cashTotal) { r.dataset.cashTotal = '1'; r.dataset.origLabel = label.innerHTML; r.dataset.origVal = val.innerHTML; }
          label.textContent = tr('Pay the pro after the job');
          val.textContent = job > 0 ? money(job) : tr('Set once your offer is entered');
        } else if (r.dataset.cashTotal) {
          label.innerHTML = r.dataset.origLabel; val.innerHTML = r.dataset.origVal; delete r.dataset.cashTotal;
          if (typeof updateCurrencyPreview === 'function') updateCurrencyPreview();
        }
      }
    });
  }
  if (typeof setPayWay === 'function') {
    const f = setPayWay;
    setPayWay = function (scope) { const r = f.apply(this, arguments); if (scope === 'booking') { cashPriceBox(); formButton(); cashCheckSoon(); } return r; };
  }
  if (typeof updateCurrencyPreview === 'function') {
    const f = updateCurrencyPreview;
    updateCurrencyPreview = async function () {
      const sum = el('booking-summary');
      // Put the normal words back first so the real function can fill them in.
      if (sum) sum.querySelectorAll('.summary-row').forEach(r => {
        const spans = r.querySelectorAll('span');
        if ((r.dataset.cashFee || r.dataset.cashTotal) && spans[1]) { spans[0].innerHTML = r.dataset.origLabel; spans[1].innerHTML = r.dataset.origVal; delete r.dataset.cashFee; delete r.dataset.cashTotal; }
      });
      const p = f.apply(this, arguments);
      cashPriceBox();
      cashCheckSoon();
      return p;
    };
  }
  if (typeof applyGoodsOnlyToForm === 'function') {
    const f = applyGoodsOnlyToForm;
    applyGoodsOnlyToForm = function () { const r = f.apply(this, arguments); formButton(); return r; };
  }
  if (typeof setBookingPricingChoice === 'function') {
    const f = setBookingPricingChoice;
    setBookingPricingChoice = function () { const r = f.apply(this, arguments); cashPriceBox(); return r; };
  }
})();
