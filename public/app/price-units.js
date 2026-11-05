// v141: pros charge the way work is really priced. Loaded after review.js.
//
// In Liberia and much of Africa most work is priced per job, from what the
// customer describes, not by the hour. Each pro now chooses (Settings →
// How you charge):
//   - per job   the customer describes the job and asks for a price, or
//               makes an offer. An optional "from" price gives an idea.
//   - per hour, per day or per trip, at the pro's rate.
//   - fixed prices: up to 20 set jobs the customer can book straight away
//     ("Fix a leaking tap $15", "Install a ceiling fan $25").
// The server works every amount out again from the pro's own prices
// (src/pricing.js); the page never decides what a booking costs.
//
// Drivers approved for passenger rides show their ride fare on their card,
// and "Get a ride" opens Rides, where the fare is set by distance.
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const num = (n) => { const r = Math.round(Number(n || 0) * 100) / 100; return Number.isInteger(r) ? String(r) : r.toFixed(2); };
  const money = (n) => '$' + num(n);
  const feeFor = (amount) => (amount > 0 ? Math.round(Math.min(Math.max(amount * 0.09, 2.99), 25) * 100) / 100 : 0);
  const UNITS = {
    job: { label: 'Per job', per: 'per job', short: 'per job', noun: 'job', nouns: 'jobs', max: 1, icon: '🧾', help: 'You price each job from what the customer describes.' },
    hour: { label: 'Per hour', per: 'per hour', short: '/hr', noun: 'hour', nouns: 'hours', max: 24, icon: '⏱️', help: 'A rate for each hour of work.' },
    day: { label: 'Per day', per: 'per day', short: '/day', noun: 'day', nouns: 'days', max: 30, icon: '📅', help: 'A rate for each day, like masons, labourers or a car with a driver.' },
    trip: { label: 'Per trip', per: 'per trip', short: '/trip', noun: 'trip', nouns: 'trips', max: 20, icon: '🚚', help: 'A price for each trip, like pick-and-drop or moving a load.' },
  };
  const VEHICLE = { motorbike: 'Motorbike', keke: 'Keke', car: 'Car', van: 'Van' };

  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Price per job': 'Precio por trabajo', 'per job': 'por trabajo', 'From': 'Desde', 'How you charge': 'Cómo cobras',
      'Ask for a price': 'Pedir un precio', 'Describe the job and ask for a price': 'Describe el trabajo y pide un precio',
      'Make an offer': 'Hacer una oferta', 'Fixed prices': 'Precios fijos', 'Request sent': 'Solicitud enviada', 'Send my request': 'Enviar mi solicitud',
      'Get a ride': 'Pedir un viaje', 'Save pricing': 'Guardar precios', 'Add a fixed price': 'Añadir un precio fijo',
    });
  } catch (x) {}

  // How a pro charges, read the same way the server reads it (src/pricing.js).
  function pricingOf(p) {
    if (p && p.pricing && UNITS[p.pricing.unit]) {
      const q = p.pricing;
      return { unit: q.unit, rate: q.unit === 'job' ? null : (Number(q.rate) > 0 ? Number(q.rate) : null), from: Number(q.from) > 0 ? Number(q.from) : null, minUnits: q.minUnits >= 1 ? q.minUnits : 1, list: Array.isArray(q.list) ? q.list : [], offers: q.unit === 'job' ? true : q.offers === true };
    }
    if (p && p.pricingModel === 'negotiable') return { unit: 'job', rate: null, from: null, minUnits: 1, list: [], offers: true };
    return { unit: 'hour', rate: p && Number(p.price) > 0 ? Number(p.price) : null, from: null, minUnits: 1, list: [], offers: !!(p && p.pricingModel === 'both') };
  }
  window.pricingOfPro = pricingOf;

  function label(p) {
    if (p && p.priceLabel && p.priceLabel.text) return p.priceLabel;
    const q = pricingOf(p);
    const listMin = q.list.length ? Math.min(...q.list.map(x => Number(x.price))) : null;
    if (q.unit === 'job') {
      const from = [q.from, listMin].filter(x => x != null);
      return from.length ? { prefix: 'From', amount: Math.min(...from), unit: 'per job', text: `From $${num(Math.min(...from))} per job` } : { prefix: '', amount: null, unit: 'Price per job', text: 'Price per job' };
    }
    if (q.rate != null) return { prefix: '', amount: q.rate, unit: UNITS[q.unit].short, text: `$${num(q.rate)}${UNITS[q.unit].short}` };
    return { prefix: '', amount: null, unit: 'Price per job', text: 'Price per job' };
  }
  const rideFare = (p) => (p && p.rideDriver && p.rideDriver.baseFee != null ? `${money(p.rideDriver.baseFee)} + ${money(p.rideDriver.perKm || 0)}/km` : null);

  window.priceText = function (p) {
    if (p && p.rideDriver && rideFare(p)) return `${t('Rides')} ${rideFare(p)}`;
    const l = label(p);
    return l.amount == null ? t(l.text) : `${l.prefix ? t(l.prefix) + ' ' : ''}$${num(l.amount)}${l.unit === 'per job' ? ' ' + t('per job') : l.unit}`;
  };
  window.priceTagHTML = function (p) {
    if (p && p.rideDriver && rideFare(p)) return `<span style="font-size:12px;">🛵 ${e(t('From'))}</span> ${e(money(p.rideDriver.baseFee))}<span> + ${e(money(p.rideDriver.perKm || 0))}/km</span>`;
    const l = label(p);
    if (l.amount == null) return `<span style="font-size:14px;font-weight:700;color:var(--navy);">${e(t(l.text))}</span>`;
    return `${l.prefix ? `<span style="font-size:12px;">${e(t(l.prefix))}</span> ` : ''}$${e(num(l.amount))}<span>${e(l.unit === 'per job' ? ' ' + t('per job') : l.unit)}</span>`;
  };
  window.bookButtonHTML = function (p) {
    if (p && p.rideDriver) return `<button class="book-btn" onclick="event.stopPropagation();rideWithDriver('${e(p.id)}')">${e(t('Get a ride'))}</button>`;
    const q = pricingOf(p);
    const word = q.unit === 'job' && !q.list.length ? t('Ask for a price') : 'Book';
    return `<button class="book-btn" onclick="event.stopPropagation();openBooking('${e(p.id)}')">${e(word)}</button>`;
  };
  window.rideWithDriver = async function () {
    if (!(typeof AUTH !== 'undefined' && AUTH.token)) { if (typeof showAuth === 'function') showAuth('signup'); if (typeof setAuthRole === 'function') setAuthRole('customer'); return showToast(t('Create a free account to get a ride')); }
    if (AUTH.user.role !== 'customer') return showToast(t('Sign in as a customer to get a ride'));
    if (typeof goToCustomerDashboard === 'function') await goToCustomerDashboard('rides');
    showToast(t('Set where you are going. Nearby drivers, with their fares, show here.'));
  };

  // The price block on a pro's profile page, with their fixed prices.
  window.profilePriceHTML = function (p) {
    const q = pricingOf(p); const first = String(p.name || '').split(' ')[0];
    const unitWord = UNITS[q.unit];
    const under = q.unit === 'job'
      ? `${e(first)} ${e(t('prices each job from what you describe. Describe the job and ask for a price, or make an offer.'))}`
      : `${e(t('Book by the'))} ${e(t(unitWord.noun))}${q.minUnits > 1 ? ` (${e(t('at least'))} ${q.minUnits} ${e(t(unitWord.nouns))})` : ''}${q.offers ? `, ${e(t('or make an offer'))}` : ''}. ${e(t('Escrow-protected, released when the job is confirmed done.'))}`;
    const list = q.list.length ? `<div style="text-align:left;margin:4px 0 14px;"><div style="font-weight:700;color:var(--navy);font-size:14px;margin-bottom:6px;">${e(t('Fixed prices'))}</div>${q.list.map(it => `<div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--border);padding:7px 0;"><div style="flex:1;min-width:0;font-size:14px;">${e(it.name)}${it.note ? `<div style="font-size:12px;color:var(--slate);">${e(it.note)}</div>` : ''}</div><strong style="color:var(--navy);">${money(it.price)}</strong><button class="btn-sm btn-sm-outline" onclick="bookPriceItem('${e(p.id)}','${e(it.id)}')">${e(t('Book'))}</button></div>`).join('')}</div>` : '';
    const ride = p.rideDriver ? `<div class="ver-note" style="text-align:left;margin-bottom:12px;">🛵 ${e(VEHICLE[p.rideDriver.vehicle] || t('Driver'))} ${e(t('rides'))}: ${e(rideFare(p) || t('fare by distance'))}. <a href="#" onclick="event.preventDefault();rideWithDriver('${e(p.id)}')">${e(t('Get a ride'))}</a></div>` : '';
    return `<div class="profile-side-price">${priceTagHTML({ ...p, rideDriver: null })}</div><div style="font-size:13px;color:var(--slate);margin-bottom:12px;">${under}</div>${list}${ride}`;
  };
  window.bookPriceItem = function (proId, itemId) { BK.preset = { proId, itemId }; openBooking(proId); };

  // ── the booking window: how the customer wants to pay this pro ─────────
  const BK = { choice: null, itemId: null, units: null, preset: null };
  function choices(q) {
    const out = [];
    if (q.list.length) out.push('item');
    if (q.unit !== 'job' && q.rate != null) out.push('units');
    if (q.offers) out.push('offer');
    out.push('ask');
    return out;
  }
  window.bookingPick = function () {
    if (typeof currentPro === 'undefined' || !currentPro) return null;
    if (typeof BOOKING_GOODS_ONLY !== 'undefined' && BOOKING_GOODS_ONLY) return null;
    if (!el('pu-box')) return null;
    const q = pricingOf(currentPro);
    if (BK.choice === 'ask') return { kind: 'ask', amount: 0 };
    if (BK.choice === 'item') {
      const it = q.list.find(x => x.id === BK.itemId);
      if (!it) return { kind: 'item', amount: 0, error: t('Choose one of the fixed prices') };
      return { kind: 'item', amount: Number(it.price), label: `${it.name}, ${t('fixed price')}`, payload: { priceItemId: it.id } };
    }
    if (BK.choice === 'units') {
      const u = UNITS[q.unit]; const n = Number((el('pu-units') || {}).value);
      if (!(n >= q.minUnits && n <= u.max)) return { kind: 'units', amount: 0, error: `${t('Choose')} ${q.minUnits} ${t('to')} ${u.max} ${t(u.nouns)}` };
      const units = q.unit === 'hour' ? Math.round(n * 2) / 2 : Math.round(n);
      return { kind: 'units', amount: Math.round(units * q.rate * 100) / 100, label: `${num(units)} ${t(units === 1 ? u.noun : u.nouns)} × ${money(q.rate)}${u.short}`, payload: { units } };
    }
    const offer = parseFloat((el('job-offer-amount') || {}).value);
    if (!(offer > 0)) return { kind: 'offer', amount: 0, error: t('Enter your offer amount') };
    return { kind: 'offer', amount: Math.round(offer * 100) / 100, label: t('your offer'), payload: { isOffer: true } };
  };

  function drawBox() {
    const box = el('pu-box'); if (!box || !currentPro) return;
    const q = pricingOf(currentPro); const u = UNITS[q.unit]; const first = String(currentPro.name || '').split(' ')[0];
    const opts = choices(q);
    if (!opts.includes(BK.choice)) BK.choice = q.unit === 'job' && !q.list.length ? 'ask' : opts[0]; // a per-job pro: asking for a price comes first
    const opt = (key, icon, title, sub) => `<label class="pu-opt" style="display:flex;gap:10px;align-items:flex-start;border:1.5px solid ${BK.choice === key ? 'var(--navy)' : 'var(--border)'};border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;background:${BK.choice === key ? 'rgba(27,42,74,.04)' : 'transparent'};"><input type="radio" name="pu-choice" value="${key}" ${BK.choice === key ? 'checked' : ''} onchange="puChoose('${key}')" style="margin-top:3px;"/><span style="flex:1;min-width:0;"><span style="font-weight:700;color:var(--navy);">${icon} ${e(title)}</span>${sub ? `<span style="display:block;font-size:12.5px;color:var(--slate);">${e(sub)}</span>` : ''}</span></label>`;
    let html = `<div style="font-weight:700;color:var(--navy);margin-bottom:8px;">${e(t('How do you want to pay'))} ${e(first)}?</div>`;
    if (opts.includes('item')) html += opt('item', '💲', t('A fixed price'), t('Book one of their set jobs at the price shown'));
    if (opts.includes('units')) html += opt('units', u.icon, `${t('By the')} ${t(u.noun)}: ${money(q.rate)}${u.short}`, q.minUnits > 1 ? `${t('At least')} ${q.minUnits} ${t(u.nouns)}` : '');
    if (opts.includes('offer')) html += opt('offer', '🤝', t('Make an offer'), `${first} ${t('can accept it, suggest a different price, or decline. Nothing is paid until you agree.')}`);
    html += opt('ask', '💬', t('Describe the job and ask for a price'), `${first} ${t('reads your description and photos and sends a price. You then accept it or not.')}`);
    let detail = '';
    if (BK.choice === 'item') {
      detail = `<select class="form-input form-select" id="pu-item" onchange="puItem(this.value)">${q.list.map(it => `<option value="${e(it.id)}" ${BK.itemId === it.id ? 'selected' : ''}>${e(it.name)}: ${money(it.price)}</option>`).join('')}</select>${(() => { const it = q.list.find(x => x.id === BK.itemId); return it && it.note ? `<div style="font-size:12.5px;color:var(--slate);margin-top:4px;">${e(it.note)}</div>` : ''; })()}`;
    } else if (BK.choice === 'units') {
      detail = `<label class="form-label" for="pu-units">${e(t('How many'))} ${e(t(u.nouns))}?</label><input class="form-input" type="number" id="pu-units" min="${q.minUnits}" max="${u.max}" step="${q.unit === 'hour' ? '0.5' : '1'}" value="${BK.units != null ? BK.units : (q.unit === 'hour' ? Math.max(2, q.minUnits) : q.minUnits)}" oninput="puUnits(this.value)" style="max-width:140px;"/>`;
    } else if (BK.choice === 'offer') {
      detail = `<label class="form-label" for="job-offer-amount">${e(t('Your offer ($)'))}</label><input class="form-input" type="number" min="1" placeholder="e.g. 50" id="job-offer-amount" oninput="puRefresh()" style="max-width:180px;"/>`;
    } else {
      detail = `<div class="ver-note">${e(t('Write what needs doing in the job description below, add photos if you can, and say where it is. The date and time you pick are what you would like; you agree them with'))} ${e(first)}. ${e(t('Nothing is paid now.'))}</div>`;
    }
    html += `<div style="margin:4px 0 10px;">${detail}</div><div id="pu-money"></div>${typeof currencyToggleHTML === 'function' && BK.choice !== 'ask' ? currencyToggleHTML() : ''}`;
    box.innerHTML = html;
    if (BK.choice === 'item' && !BK.itemId && q.list[0]) BK.itemId = q.list[0].id;
    moneyRows();
  }
  function moneyRows() {
    const slot = el('pu-money'); if (!slot) return;
    if (BK.choice === 'ask') { slot.innerHTML = ''; buttonText(); return; }
    const pk = bookingPick(); const amount = pk && !pk.error ? pk.amount : 0;
    const fee = feeFor(amount);
    slot.innerHTML = `<div class="summary-row"><span>${e(t('Job amount'))}</span><span>${amount > 0 ? money(amount) : e(t('Set once you choose'))}</span></div>
      <div class="summary-row"><span>Service fee <small style="color:var(--muted);">(9%, $2.99–$25)</small></span><span id="offer-service-fee">${amount > 0 ? '$' + fee.toFixed(2) : e(t('Calculated from the amount'))}</span></div>
      <div class="summary-row"><span>Smart Contract</span><span style="color:#2E8C6F">Included ✓</span></div>
      <div class="summary-row total"><span>Total charged</span><span id="offer-total-charged">${amount > 0 ? '$' + (amount + fee).toFixed(2) : e(t('Set once you choose'))}</span></div>`;
    buttonText();
  }
  function buttonText() {
    const footer = document.querySelector('#booking-modal .modal-footer');
    if (!footer || footer.dataset.reviewing === '1') return;
    const btn = footer.querySelector('.confirm-btn');
    if (btn) btn.textContent = BK.choice === 'ask' ? t('Send my request') + ' →' : t('Check my booking') + ' →';
  }
  window.puChoose = function (k) { BK.choice = k; drawBox(); if (typeof updateCurrencyPreview === 'function') updateCurrencyPreview(); };
  window.puItem = function (id) { BK.itemId = id; drawBox(); if (typeof updateCurrencyPreview === 'function') updateCurrencyPreview(); };
  window.puUnits = function (v) { BK.units = v; puRefresh(); };
  window.puRefresh = function () { moneyRows(); if (typeof updateCurrencyPreview === 'function') updateCurrencyPreview(); };

  if (typeof openBooking === 'function') {
    const base = openBooking;
    openBooking = async function (id) {
      const preset = BK.preset && BK.preset.proId === id ? BK.preset : null;
      BK.preset = null; BK.choice = null; BK.itemId = null; BK.units = null;
      const r = await base.apply(this, arguments);
      const sum = el('booking-summary');
      if (sum && typeof currentPro !== 'undefined' && currentPro && currentPro.id === id && el('booking-modal') && el('booking-modal').classList.contains('open')) {
        if (preset) { BK.choice = 'item'; BK.itemId = preset.itemId; }
        sum.innerHTML = '<div id="pu-box"></div>';
        drawBox();
        if (typeof updateCurrencyPreview === 'function') updateCurrencyPreview();
      }
      return r;
    };
  }
  // The amount in local money follows the choice (the original only knew "2 hours" or an offer).
  if (typeof updateCurrencyPreview === 'function') {
    const base = updateCurrencyPreview;
    updateCurrencyPreview = async function () {
      const r = await base.apply(this, arguments);
      const pk = typeof bookingPick === 'function' ? bookingPick() : null;
      const preview = el('currency-preview');
      if (pk && pk.kind !== 'offer' && preview && typeof currentCurrencyInfo !== 'undefined' && currentCurrencyInfo && !currentCurrencyInfo.isUSD && !(typeof selectedPayCurrency !== 'undefined' && selectedPayCurrency === 'usd')) {
        if (!(pk.amount > 0)) { preview.textContent = ''; return r; }
        try { const d = await apiFetch('GET', `/currency/mine?amount=${pk.amount + feeFor(pk.amount)}`); const c = currentCurrencyInfo.currency; preview.textContent = d.convertedAmount ? `≈ ${c.symbol}${d.convertedAmount} ${c.code} (${d.exchangeRateNote})` : ''; } catch (x) {}
      }
      return r;
    };
  }

  // "Describe the job and ask for a price": the job goes to this pro only.
  window.sendPriceRequest = async function () {
    const desc = el('job-desc').value.trim();
    if (desc.length < 5) return showToast(t('Describe the job in at least 5 characters, so the pro can price it'));
    const where = typeof readJobWhere === 'function' ? readJobWhere('book') : {};
    const addr = el('job-address').value.trim();
    if (!where.landmark && addr) where.landmark = addr;
    const pw = document.querySelector('input[name="pw-booking"]:checked');
    const body = {
      category: currentPro.cat, description: desc, forProviderId: currentPro.id,
      preferredDate: el('job-date').value || undefined,
      preferredTime: el('job-time').value ? new Date(`2000-01-01T${el('job-time').value}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : undefined,
      ...where,
      materialsOnHand: (el('job-materials-on-hand') || {}).value ? el('job-materials-on-hand').value.trim() : undefined,
      photoUrls: typeof getUploadedJobPhotoUrls === 'function' ? getUploadedJobPhotoUrls('booking') : [],
      payMethod: pw && pw.value === 'cash' ? 'cash' : 'protected',
      payCurrency: typeof selectedPayCurrency !== 'undefined' ? selectedPayCurrency : undefined,
    };
    const first = String(currentPro.name || '').split(' ')[0];
    try {
      await apiFetch('POST', '/jobs', body);
      if (typeof closeModal === 'function') closeModal();
      const lines = [`${first} ${t('has your description and will send a price. You\'ll be told as soon as it arrives.')}`, t('You then accept the price and pay (Trothen holds the money until the job is done), or make a different offer. Nothing is paid until you agree.')];
      if (typeof showResult === 'function') showResult({ icon: '💬', title: t('Request sent'), lines, then: "goToCustomerDashboard('overview')" });
      else showToast(t('Request sent'));
    } catch (x) { showToast((x && x.message) || t('Could not send your request')); }
  };

  // ── Settings: how the pro charges ─────────────────────────────────────
  const ED = { unit: null, list: [] };
  function editorHTML() {
    const u = (typeof AUTH !== 'undefined' && AUTH.user) || {};
    const q = pricingOf(u);
    ED.unit = ED.unit || q.unit; ED.list = ED.list.length ? ED.list : q.list.map(x => ({ ...x }));
    const unit = UNITS[ED.unit];
    const optBox = (k) => `<div class="auth-role-opt ${ED.unit === k ? 'active' : ''}" id="pu-unit-${k}" onclick="puSetUnit('${k}')"><span class="r-icon">${UNITS[k].icon}</span>${e(t(UNITS[k].label))}</div>`;
    return `<div class="panel-title">${e(t('How you charge'))}</div>
      <div style="font-size:13.5px;color:var(--slate);margin-bottom:12px;">${e(t('Choose what fits your work. Most work in Liberia is priced per job: the customer describes it and you send a price.'))}</div>
      <div class="auth-role-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin-bottom:8px;">${['job', 'hour', 'day', 'trip'].map(optBox).join('')}</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:12px;">${e(t(unit.help))}</div>
      ${ED.unit === 'job' ? `<div class="form-group"><label class="form-label" for="pu-from">${e(t('Usual starting price, optional ($)'))}</label><input class="form-input" type="number" min="0" step="0.01" id="pu-from" placeholder="e.g. 20" value="${q.unit === 'job' && q.from ? e(q.from) : ''}" style="max-width:180px;"/><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${e(t('Shown as "From $20 per job" so customers know roughly what to expect. Leave blank to show "Price per job".'))}</div></div>`
        : `<div style="display:flex;gap:12px;flex-wrap:wrap;"><div class="form-group"><label class="form-label" for="pu-rate">${e(t('Your price'))} ${e(t(unit.per))} ($)</label><input class="form-input" type="number" min="1" step="0.01" id="pu-rate" value="${q.unit === ED.unit && q.rate ? e(q.rate) : ''}" style="max-width:160px;"/></div>
          <div class="form-group"><label class="form-label" for="pu-min">${e(t('Fewest'))} ${e(t(unit.nouns))} ${e(t('per booking'))}</label><input class="form-input" type="number" min="1" max="${unit.max}" step="1" id="pu-min" value="${q.unit === ED.unit ? q.minUnits : 1}" style="max-width:120px;"/></div></div>
          <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:10px;"><input type="checkbox" id="pu-offers" ${q.offers ? 'checked' : ''}/> ${e(t('Customers may also make me an offer'))}</label>`}
      <div style="border-top:1px solid var(--border);margin:12px 0 10px;"></div>
      <div style="font-weight:700;color:var(--navy);">${e(t('Fixed prices'))} <span style="font-weight:400;color:var(--slate);font-size:13px;">(${e(t('optional, up to 20'))})</span></div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(t('Jobs you always do for the same price. Customers can book them straight away, without waiting for a quote.'))}</div>
      <div id="pu-list">${ED.list.map((it, i) => `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px;"><input class="form-input pu-li-name" data-i="${i}" placeholder="${e(t('e.g. Fix a leaking tap'))}" value="${e(it.name || '')}" style="flex:2 1 180px;"/><input class="form-input pu-li-price" data-i="${i}" type="number" min="1" step="0.01" placeholder="$" value="${it.price != null ? e(it.price) : ''}" style="flex:0 1 90px;"/><input class="form-input pu-li-note" data-i="${i}" placeholder="${e(t('What it includes (optional)'))}" value="${e(it.note || '')}" style="flex:2 1 160px;"/><button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="puRemoveItem(${i})" aria-label="Remove">✕</button></div>`).join('')}</div>
      ${ED.list.length < 20 ? `<button class="btn-sm btn-sm-outline" onclick="puAddItem()">+ ${e(t('Add a fixed price'))}</button>` : ''}
      <div style="margin-top:14px;"><button class="btn-sm btn-sm-primary" onclick="puSavePricing()">${e(t('Save pricing'))}</button></div>`;
  }
  function readList() {
    document.querySelectorAll('.pu-li-name').forEach(i => { ED.list[i.dataset.i].name = i.value; });
    document.querySelectorAll('.pu-li-price').forEach(i => { ED.list[i.dataset.i].price = i.value === '' ? null : Number(i.value); });
    document.querySelectorAll('.pu-li-note').forEach(i => { ED.list[i.dataset.i].note = i.value; });
  }
  function redrawEditor() { const p = el('pu-pricing-panel'); if (p) p.innerHTML = editorHTML(); }
  window.puSetUnit = function (k) { readList(); ED.unit = k; redrawEditor(); };
  window.puAddItem = function () { readList(); if (ED.list.length < 20) ED.list.push({ name: '', price: null, note: '' }); redrawEditor(); const n = document.querySelectorAll('.pu-li-name'); if (n.length) n[n.length - 1].focus(); };
  window.puRemoveItem = function (i) { readList(); ED.list.splice(i, 1); redrawEditor(); };
  window.puSavePricing = async function () {
    readList();
    const list = ED.list.filter(x => String(x.name || '').trim() || x.price != null).map(x => ({ id: x.id, name: String(x.name || '').trim(), price: x.price, note: String(x.note || '').trim() }));
    const pricing = { unit: ED.unit, list };
    if (ED.unit === 'job') { const f = (el('pu-from') || {}).value; pricing.from = f === '' || f == null ? null : Number(f); }
    else { pricing.rate = Number((el('pu-rate') || {}).value); pricing.minUnits = Number((el('pu-min') || {}).value || 1); pricing.offers = !!(el('pu-offers') || {}).checked; }
    try {
      const { user } = await apiFetch('PATCH', '/auth/me', { pricing });
      AUTH.user = user; ED.list = []; ED.unit = null; redrawEditor();
      showToast(t('Saved. Customers now see') + ' "' + priceText(user) + '"');
    } catch (x) { showToast((x && x.message) || t('Could not save')); }
  };
  function replaceSettingsPanel() {
    const old = el('pricing-opt-hourly'); if (!old) return;
    const panel = old.closest('.panel'); if (!panel || panel.id === 'pu-pricing-panel') return;
    ED.unit = null; ED.list = [];
    panel.id = 'pu-pricing-panel';
    panel.innerHTML = editorHTML();
  }
  if (typeof selectProviderSection === 'function') {
    const base = selectProviderSection;
    selectProviderSection = function (key) { const r = base.apply(this, arguments); if (key === 'settings') setTimeout(replaceSettingsPanel, 0); return r; };
  }
})();
