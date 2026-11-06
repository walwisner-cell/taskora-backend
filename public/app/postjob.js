// v144: Post a Job, step by step (the way Thumbtack, Airtasker and
// TaskRabbit ask it). Loaded after categories.js and payways.js.
//
//   1 What      one search box with the kinds of work and how many pros offer each
//   2 Details   what needs doing (with prompts), photos, and who provides materials
//   3 When      as soon as possible / on a date / flexible, and where
//   4 Price     pros send prices (recommended) / my price / my budget range,
//               in US$ or local money (L$), and how to pay
//   5 Check     everything on one screen, who will see it, then Post
//
// Each step is checked before the next, nothing typed is lost going back,
// and the job closes by itself after 14 days (or the day after the date).
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const STEPS = ['What', 'Details', 'When & where', 'Price', 'Check'];
  const S = { step: 0, cats: null, cur: null, pick: null, when: 'flexible', materials: null, pricing: 'quotes' };

  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'What': 'Qué', 'Details': 'Detalles', 'When & where': 'Cuándo y dónde', 'Price': 'Precio', 'Check': 'Revisar',
      'Next': 'Siguiente', 'Back': 'Atrás', 'Post my job': 'Publicar mi trabajo', 'As soon as possible': 'Lo antes posible', 'I\'m flexible': 'Tengo flexibilidad',
      'Pros send me their prices': 'Los profesionales me envían sus precios', 'My price is': 'Mi precio es', 'My budget is': 'Mi presupuesto es',
    });
  } catch (x) {}

  // ── the job card line, for the customer and for pros ────────────────
  window.jobFactsLine = function (j, small) {
    if (!j) return '';
    const when = j.when === 'asap' ? t('As soon as possible') : j.when === 'date' && j.preferredDate ? `${t('On')} ${new Date(j.preferredDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${j.preferredTime ? ', ' + j.preferredTime : ''}` : (j.when === 'flexible' ? t('Flexible') : '');
    const mat = j.materialsBy === 'me' ? t('Customer has the materials') : j.materialsBy === 'pro' ? t('Pro brings materials') : j.materialsBy === 'unsure' ? t('Materials: not sure') : '';
    const price = j.budgetLabel || (j.budget ? `${t('Budget')}: ${j.budget}` : '');
    const bits = [when && `🗓 ${e(when)}`, mat && `🧰 ${e(mat)}`, price && `💲 ${e(price)}`].filter(Boolean);
    if (!bits.length) return small ? '' : '<span></span>';
    return small ? `<div style="font-size:12.5px;color:var(--slate);margin-top:4px;">${bits.join(' · ')}</div>` : `<span style="font-size:12.5px;color:var(--slate);">${bits.join(' · ')}</span>`;
  };

  // ── the form ─────────────────────────────────────────────────────────
  postJobFormHTML = function () {
    const opts = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).map(c => `<option>${e(c.name)}</option>`).join('');
    const today = new Date().toISOString().slice(0, 10);
    const radio = (name, value, title, sub, checked) => `<label class="pj-opt" style="display:flex;gap:10px;align-items:flex-start;border:1.5px solid ${checked ? 'var(--navy)' : 'var(--border)'};border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} onchange="pjSet('${name}', this.value)" style="margin-top:3px;"/><span><strong style="color:var(--navy);">${e(t(title))}</strong>${sub ? `<span style="display:block;font-size:12.5px;color:var(--slate);">${e(t(sub))}</span>` : ''}</span></label>`;
    return `
    <div id="pj-progress" style="display:flex;gap:4px;margin-bottom:6px;">${STEPS.map((s, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i === 0 ? 'var(--navy)' : 'var(--border)'};" data-bar="${i}"></div>`).join('')}</div>
    <div id="pj-steplabel" style="font-size:12.5px;color:var(--slate);margin-bottom:12px;"></div>

    <section class="pj-step" data-step="0">
      <div class="form-group"><label class="form-label" for="pj-cat-q">${e(t('What do you need?'))}</label>
        <input class="form-input" id="pj-cat-q" type="search" autocomplete="off" placeholder="${e(t('Type what you need, e.g. plumber, braids, painting'))}" oninput="pjCats()"/>
        <select id="pj-category" data-v135="1" style="display:none;" aria-hidden="true">${opts}<option value="__other__">Other</option></select>
        <div id="pj-cat-list" style="margin-top:8px;max-height:280px;overflow:auto;"></div>
      </div>
      <div class="form-group" id="pj-custom-category-group" style="display:none;"><label class="form-label" for="pj-custom-category">${e(t('What kind of work is it?'))}</label><input class="form-input" id="pj-custom-category" maxlength="60" placeholder="${e(t('e.g. Piano tuning'))}"/><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${e(t('It isn\'t one of the kinds of work we list yet, so it may not reach a pro straight away. The team is told and follows up.'))}</div></div>
    </section>

    <section class="pj-step" data-step="1" style="display:none;">
      <div class="form-group"><label class="form-label" for="pj-desc">${e(t('Describe the job'))}</label>
        <textarea class="form-input" id="pj-desc" rows="5" maxlength="500" oninput="pjCount()" placeholder="${e(t('What needs doing, where it is (kitchen, roof, yard…), how big it is, and anything the pro should know (access, parking, pets, power or water).'))}"></textarea>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:4px;"><span id="pj-desc-tip">${e(t('Clear details get more accurate prices.'))}</span><span id="pj-desc-count">0/500</span></div></div>
      ${typeof jobPhotoUploadHTML === 'function' ? jobPhotoUploadHTML('pj') : ''}
      <div class="form-group"><label class="form-label">${e(t('Materials'))}</label>
        ${radio('pj-mat', 'me', 'I have the materials', 'The pro only brings tools and does the work.', false)}
        ${radio('pj-mat', 'pro', 'The pro brings the materials', 'They include the materials in their price.', false)}
        ${radio('pj-mat', 'unsure', 'Not sure', 'The pro can advise you.', false)}
        <div id="pj-have-wrap" style="display:none;"><label class="form-label" for="pj-materials-on-hand">${e(t('What do you already have?'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><input class="form-input" id="pj-materials-on-hand" maxlength="300" placeholder="${e(t('e.g. I bought the new tap and the pipe'))}"/></div>
        <input type="hidden" id="pj-materials-cost" value=""/>
      </div>
    </section>

    <section class="pj-step" data-step="2" style="display:none;">
      <div class="form-group"><label class="form-label">${e(t('When do you need it?'))}</label>
        ${radio('pj-when', 'asap', 'As soon as possible', 'Within about 2 days.', false)}
        ${radio('pj-when', 'date', 'On a date', '', false)}
        <div id="pj-date-wrap" style="display:none;margin:-2px 0 8px 28px;" class="dates-row"><div class="form-group" style="margin:0;"><label class="form-label" for="pj-date">${e(t('Date'))}</label><input class="form-input" id="pj-date" type="date" min="${today}"/></div><div class="form-group" style="margin:0;"><label class="form-label" for="pj-time">${e(t('Time'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><input class="form-input" id="pj-time" type="time"/></div></div>
        ${radio('pj-when', 'flexible', 'I\'m flexible', 'Agree a time with the pro.', true)}
      </div>
      ${typeof locationPickerHTML === 'function' ? locationPickerHTML('pj') : ''}
    </section>

    <section class="pj-step" data-step="3" style="display:none;">
      <div class="form-group"><label class="form-label">${e(t('How do you want to price it?'))}</label>
        ${radio('pj-price', 'quotes', 'Pros send me their prices (recommended)', 'Pros who can do it answer with a price. You compare them and choose. Nothing is paid until you choose.', true)}
        ${radio('pj-price', 'fixed', 'My price is…', 'The first pro to accept at your price gets the job. Pros can also offer a different price.', false)}
        <div id="pj-fixed-wrap" style="display:none;margin:-2px 0 8px 28px;"><div style="display:flex;gap:6px;max-width:320px;"><select class="form-input form-select pj-cur" id="pj-fixed-cur" style="flex:0 0 90px;"></select><input class="form-input" id="pj-fixed" type="number" min="1" step="0.01" inputmode="decimal" style="flex:1;min-width:0;" oninput="pjLocal()"/></div><div class="pj-usd" id="pj-fixed-usd" style="font-size:12.5px;color:var(--muted);margin-top:4px;"></div></div>
        ${radio('pj-price', 'range', 'My budget is…', 'A range helps pros see if the job suits them. They answer with their price.', false)}
        <div id="pj-range-wrap" style="display:none;margin:-2px 0 8px 28px;"><div style="display:flex;gap:6px;align-items:center;max-width:380px;"><select class="form-input form-select pj-cur" id="pj-range-cur" style="flex:0 0 90px;"></select><input class="form-input" id="pj-min" type="number" min="1" step="0.01" placeholder="${e(t('from'))}" style="flex:1;min-width:0;" oninput="pjLocal()"/><span>–</span><input class="form-input" id="pj-max" type="number" min="1" step="0.01" placeholder="${e(t('to'))}" style="flex:1;min-width:0;" oninput="pjLocal()"/></div><div class="pj-usd" id="pj-range-usd" style="font-size:12.5px;color:var(--muted);margin-top:4px;"></div></div>
        <input type="hidden" id="pj-budget" value=""/>
        <div style="font-size:12.5px;color:var(--muted);">${e(t('When you hire, Trothen adds its service fee (9%, $2.99 to $25) on a protected payment, and holds your money until the job is done. No fee on cash jobs.'))}</div>
      </div>
      <div id="pj-pay-slot"></div>
    </section>

    <section class="pj-step" data-step="4" style="display:none;"><div id="pj-review"></div></section>`;
  };

  // ── step 1: the kinds of work, with how many pros offer each ────────
  async function loadCats() {
    const u = (typeof AUTH !== 'undefined' && AUTH.user) || {};
    try { const q = new URLSearchParams(); if (u.country) q.set('country', u.country); if (u.city) q.set('city', u.city); S.cats = (await apiFetch('GET', `/categories?${q}`)).categories || []; }
    catch (x) { S.cats = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).map(c => ({ name: c.name, icon: c.icon })); }
    const sel = el('pj-category'); if (sel) sel.innerHTML = S.cats.map(c => `<option>${e(c.name)}</option>`).join('') + '<option value="__other__">Other</option>';
    window.pjCats();
  }
  const SYN = { plumber: 'plumb', electrician: 'electric', mechanic: 'auto', hair: 'hair', braids: 'hair', painter: 'paint', cleaner: 'clean', driver: 'driver', keke: 'driver', motorbike: 'driver', mason: 'mason', carpenter: 'carpent', tailor: 'tailor', welder: 'weld', teacher: 'tutor', lessons: 'tutor', yard: 'lawn', garden: 'garden' };
  window.pjCats = function () {
    const box = el('pj-cat-list'); if (!box || !S.cats) return;
    const raw = (el('pj-cat-q').value || '').trim().toLowerCase();
    const q = SYN[raw] || raw;
    const country = (AUTH.user && AUTH.user.country) || '';
    // the same words the old picker understood ("yard" finds Landscaping), in English or Spanish
    const words = (c) => [c.name, typeof tn === 'function' ? tn(c.name) : '', c.group, ...((typeof COMPOSER_WORDS === 'object' && COMPOSER_WORDS[String(c.name).toLowerCase()]) || [])].join(' ').toLowerCase();
    const syn = typeof SEARCH_SYNONYMS === 'object' ? SEARCH_SYNONYMS[raw] : null;
    let list = S.cats.filter(c => !q || (syn && c.name === syn) || words(c).includes(q) || words(c).includes(raw) || raw.split(/\s+/).every(w => words(c).includes(SYN[w] || w)));
    list.sort((a, b) => (b.cityCount || 0) - (a.cityCount || 0) || (b.countryCount || 0) - (a.countryCount || 0) || a.name.localeCompare(b.name));
    if (!q) list = list.slice(0, 12);
    const count = (c) => c.cityCount > 0 ? `${c.cityCount} ${t(c.cityCount === 1 ? 'pro near you' : 'pros near you')}` : c.countryCount > 0 ? `${c.countryCount} ${t(c.countryCount === 1 ? 'pro in' : 'pros in')} ${country}` : (c.countryCount === 0 ? t('No pros yet') : '');
    const card = (c) => `<button type="button" class="pj-cat" onclick="pjPick(${jsArg(c.name)})" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1.5px solid ${S.pick === c.name ? 'var(--navy)' : 'var(--border)'};background:${S.pick === c.name ? 'rgba(27,42,74,.05)' : 'var(--white)'};border-radius:10px;padding:9px 12px;margin-bottom:6px;cursor:pointer;"><span style="font-size:20px;">${typeof categoryIcon === 'function' ? categoryIcon(c.name) : ''}</span><span style="flex:1;font-weight:600;color:var(--navy);">${e(c.name)}</span><span style="font-size:12px;color:${c.cityCount > 0 ? '#15803d' : c.countryCount > 0 ? 'var(--slate)' : '#B45309'};">${e(count(c))}</span></button>`;
    box.innerHTML = `${!q ? `<div style="font-size:12.5px;color:var(--slate);margin-bottom:6px;">${e(t('Most offered near you. Type to search all.'))}</div>` : ''}${list.map(card).join('') || `<div style="font-size:13.5px;color:var(--slate);margin-bottom:6px;">${e(t('Nothing matches.'))}</div>`}
      <button type="button" class="pj-cat" onclick="pjPick('__other__')" style="width:100%;text-align:left;border:1.5px dashed ${S.pick === '__other__' ? 'var(--navy)' : 'var(--border)'};background:var(--white);border-radius:10px;padding:9px 12px;cursor:pointer;color:var(--slate);">➕ ${e(t('Something else (not listed)'))}</button>`;
  };
  window.pjPick = function (name) {
    S.pick = name;
    const sel = el('pj-category');
    if (name !== '__other__' && ![...sel.options].some(o => o.value === name)) sel.insertAdjacentHTML('afterbegin', `<option>${e(name)}</option>`);
    sel.value = name;
    el('pj-custom-category-group').style.display = name === '__other__' ? '' : 'none';
    window.pjCats();
    if (name !== '__other__') setTimeout(() => go(1), 150);
  };

  // ── small helpers ────────────────────────────────────────────────────
  window.pjSet = function (name, v) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => { r.closest('.pj-opt').style.borderColor = r.checked ? 'var(--navy)' : 'var(--border)'; });
    if (name === 'pj-mat') { S.materials = v; el('pj-have-wrap').style.display = v === 'pro' ? 'none' : ''; }
    if (name === 'pj-when') { S.when = v; el('pj-date-wrap').style.display = v === 'date' ? '' : 'none'; }
    if (name === 'pj-price') { S.pricing = v; el('pj-fixed-wrap').style.display = v === 'fixed' ? '' : 'none'; el('pj-range-wrap').style.display = v === 'range' ? '' : 'none'; pjLocal(); }
  };
  window.pjCount = function () { const v = el('pj-desc').value; el('pj-desc-count').textContent = `${v.length}/500`; el('pj-desc-tip').textContent = t(v.trim().length < 20 ? 'Add a little more: what, where and how big.' : 'Good. Clear details get more accurate prices.'); };
  async function loadCurrency() {
    S.cur = { code: 'USD', symbol: '$', rate: 1, isUSD: true };
    try { const r = await apiFetch('GET', '/currency/mine?amount=1000'); if (r && !r.isUSD) S.cur = { code: r.currency.code, symbol: r.currency.symbol, rate: (Number(String(r.convertedAmount).replace(/[^\d.]/g, '')) || 1000) / 1000, isUSD: false }; } catch (x) {}
    document.querySelectorAll('.pj-cur').forEach(s => { s.innerHTML = (S.cur.isUSD ? ['USD'] : [S.cur.code, 'USD']).map(c => `<option value="${c}">${c === 'USD' ? 'US$' : e(S.cur.symbol)}</option>`).join(''); s.onchange = pjLocal; });
  }
  const money = (sym, n) => `${sym}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  window.pjLocal = function () {
    const conv = (code, n) => (code === 'USD' ? null : `≈ US$${(n / S.cur.rate).toFixed(2)}`);
    const fc = (el('pj-fixed-cur') || {}).value, f = Number((el('pj-fixed') || {}).value);
    if (el('pj-fixed-usd')) el('pj-fixed-usd').textContent = f > 0 && fc && fc !== 'USD' ? conv(fc, f) : '';
    const rc = (el('pj-range-cur') || {}).value, lo = Number((el('pj-min') || {}).value), hi = Number((el('pj-max') || {}).value);
    if (el('pj-range-usd')) el('pj-range-usd').textContent = lo > 0 && hi > 0 && rc && rc !== 'USD' ? `≈ US$${(lo / S.cur.rate).toFixed(2)}–${(hi / S.cur.rate).toFixed(2)}` : '';
  };
  function priceWords() {
    if (S.pricing === 'fixed') { const c = el('pj-fixed-cur').value; return `${t('My price')}: ${money(c === 'USD' ? '$' : S.cur.symbol, el('pj-fixed').value)}${c !== 'USD' ? ` (${el('pj-fixed-usd').textContent})` : ''}`; }
    if (S.pricing === 'range') { const c = el('pj-range-cur').value, s = c === 'USD' ? '$' : S.cur.symbol; return `${t('My budget')}: ${money(s, el('pj-min').value)}–${money(s, el('pj-max').value).replace(s, '')}${c !== 'USD' ? ` (${el('pj-range-usd').textContent})` : ''}`; }
    return t('Pros send me their prices');
  }

  // ── moving between steps (each step is checked first) ───────────────
  function problem(i) {
    if (i === 0) {
      if (!S.pick) return t('Choose what you need');
      if (S.pick === '__other__' && el('pj-custom-category').value.trim().length < 2) return t('Say what kind of work it is');
    }
    if (i === 1) {
      const d = el('pj-desc').value.trim();
      if (d.length < 15) return t('Describe the job in a few more words (at least 15 characters), so pros can price it');
      if (!S.materials) return t('Say who provides the materials');
      if (typeof getUploadedJobPhotoUrls === 'function' && (JOB_PHOTO_STATE.pj || []).some(p => p.uploading)) return t('Wait for your photos to finish uploading');
    }
    if (i === 2) {
      if (S.when === 'date' && !el('pj-date').value) return t('Choose the date');
      const w = typeof readJobWhere === 'function' ? readJobWhere('pj') : {};
      if (!w.jobLocation && !(w.landmark && w.landmark.length >= 5)) return t('Tell the pro where the job is: pin your location, choose it on a map, or describe a landmark.');
    }
    if (i === 3) {
      if (S.pricing === 'fixed' && !(Number(el('pj-fixed').value) > 0)) return t('Enter your price');
      if (S.pricing === 'range') { const lo = Number(el('pj-min').value), hi = Number(el('pj-max').value); if (!(lo > 0 && hi > lo)) return t('Enter your budget as two amounts, the lower one first'); }
    }
    return null;
  }
  function go(i) {
    if (i > S.step) { for (let k = S.step; k < i; k++) { const p = problem(k); if (p) { showToast(p); return; } } }
    S.step = Math.max(0, Math.min(STEPS.length - 1, i));
    document.querySelectorAll('.pj-step').forEach(s => { s.style.display = Number(s.dataset.step) === S.step ? '' : 'none'; });
    document.querySelectorAll('#pj-progress [data-bar]').forEach(b => { b.style.background = Number(b.dataset.bar) <= S.step ? 'var(--navy)' : 'var(--border)'; });
    el('pj-steplabel').textContent = `${t('Step')} ${S.step + 1} ${t('of')} ${STEPS.length}: ${t(STEPS[S.step])}`;
    if (S.step === 3) movePay();
    if (S.step === 4) drawReview();
    const foot = document.querySelector('#postjob-modal .modal-footer');
    if (foot) foot.innerHTML = `<div style="display:flex;gap:8px;width:100%;">${S.step > 0 ? `<button class="btn-sm btn-sm-outline" style="flex:0 0 auto;padding:12px 18px;" onclick="pjGo(-1)">← ${e(t('Back'))}</button>` : ''}${S.step < STEPS.length - 1 ? (S.step === 0 ? '' : `<button class="confirm-btn" style="flex:1;" onclick="pjGo(1)">${e(t('Next'))} →</button>`) : `<button class="confirm-btn" style="flex:1;" id="pj-post" onclick="pjPost()">${e(t('Post my job'))}</button>`}</div>`;
    const body = el('postjob-body'); if (body) body.scrollTop = 0;
  }
  window.pjGo = function (d) { go(S.step + d); };
  function movePay() { const slot = el('pj-pay-slot'), pw = el('pw-job'); if (slot && pw && pw.parentElement !== slot) slot.appendChild(pw); }
  function drawReview() {
    const box = el('pj-review'); if (!box) return;
    const cat = S.pick === '__other__' ? el('pj-custom-category').value.trim() : S.pick;
    const c = (S.cats || []).find(x => x.name === cat);
    const w = typeof readJobWhere === 'function' ? readJobWhere('pj') : {};
    const photos = typeof getUploadedJobPhotoUrls === 'function' ? getUploadedJobPhotoUrls('pj').length : 0;
    const when = S.when === 'asap' ? t('As soon as possible') : S.when === 'date' ? `${new Date(el('pj-date').value + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${el('pj-time').value ? ', ' + el('pj-time').value : ''}` : t('Flexible');
    const mat = { me: 'I have the materials', pro: 'The pro brings the materials', unsure: 'Not sure about materials' }[S.materials];
    const pay = document.querySelector('input[name="pw-job"]:checked');
    const reach = c && c.cityCount > 0 ? `${c.cityCount} ${t(c.cityCount === 1 ? 'pro near you' : 'pros near you')}` : c && c.countryCount > 0 ? `${c.countryCount} ${t(c.countryCount === 1 ? 'pro in' : 'pros in')} ${AUTH.user.country}` : t('No pro offers this here yet: it is saved and the team follows up');
    const row = (k, v, step) => `<div class="summary-row" style="align-items:flex-start;"><span>${e(t(k))}</span><span style="text-align:right;max-width:65%;">${v} <a onclick="pjGoTo(${step})" style="color:var(--teal);cursor:pointer;font-size:12.5px;margin-left:4px;">${e(t('Change'))}</a></span></div>`;
    box.innerHTML = `<div class="booking-summary">
      ${row('What', e(cat), 0)}
      ${row('Details', `${e(el('pj-desc').value.trim())}${photos ? `<br><span style="color:var(--slate);">📷 ${photos} ${e(t(photos === 1 ? 'photo' : 'photos'))}</span>` : ''}`, 1)}
      ${row('Materials', e(t(mat)) + (el('pj-materials-on-hand').value.trim() && S.materials !== 'pro' ? `<br><span style="color:var(--slate);">${e(el('pj-materials-on-hand').value.trim())}</span>` : ''), 1)}
      ${row('When', e(when), 2)}
      ${row('Where', e([w.landmark, w.jobLocation ? t('Pinned on the map') : ''].filter(Boolean).join(' · ')), 2)}
      ${row('Price', e(priceWords()), 3)}
      ${pay ? row('Payment', e(t(pay.value === 'cash' ? 'Cash to the pro after the job' : 'Protected by Trothen')), 3) : ''}
    </div>
    <div class="ver-note" style="margin-top:10px;">👥 ${e(t('Who sees it'))}: ${e(reach)}. ${e(t('Only pros who offer this, and only what they need: your exact location is shared only with the pro you hire.'))} ${e(t('Open for 14 days, or until the day after your date.'))}</div>`;
  }
  window.pjGoTo = function (i) { S.step = i; go(i); };

  // ── posting: the original screen does the rest (matching and results) ──
  window.pjPost = function () {
    for (let k = 0; k < 4; k++) { const p = problem(k); if (p) { go(k); return showToast(p); } }
    const extra = { when: S.when, preferredDate: S.when === 'date' ? el('pj-date').value : undefined, preferredTime: S.when === 'date' && el('pj-time').value ? el('pj-time').value : undefined, materialsBy: S.materials, budgetType: S.pricing };
    if (S.pricing === 'fixed') Object.assign(extra, { budgetCurrency: el('pj-fixed-cur').value, budgetAmount: Number(el('pj-fixed').value) });
    if (S.pricing === 'range') Object.assign(extra, { budgetCurrency: el('pj-range-cur').value, budgetMin: Number(el('pj-min').value), budgetMax: Number(el('pj-max').value) });
    if (S.materials === 'pro') el('pj-materials-on-hand').value = '';
    // The original screen clears the form before sending it, so read the place now
    // (before, a job with only a landmark and no map pin was refused for this reason).
    if (typeof readJobWhere === 'function') Object.assign(extra, readJobWhere('pj'));
    // If the server refuses it, put the form back as it was, at the same step (not an empty form).
    const body = el('postjob-body'), kids = [...body.childNodes], reopen = openPostJobModal;
    openPostJobModal = function () { body.innerHTML = ''; kids.forEach(k => body.appendChild(k)); document.getElementById('postjob-modal').classList.add('open'); go(S.step); };
    const real = apiFetch;
    apiFetch = function (m, p, b) { if (m === 'POST' && p === '/jobs' && b && typeof b === 'object') { delete b.budget; b = { ...b, ...extra }; } return real.apply(this, [m, p, b]); };
    const done = () => { apiFetch = real; openPostJobModal = reopen; };
    try { const r = runAIMatch(); if (r && typeof r.then === 'function') r.then(done, done); else done(); } catch (x) { done(); throw x; }
  };

  if (typeof openPostJobModal === 'function') {
    const base = openPostJobModal;
    openPostJobModal = function () {
      Object.assign(S, { step: 0, pick: null, when: 'flexible', materials: null, pricing: 'quotes' });
      const r = base.apply(this, arguments);
      go(0); loadCats(); loadCurrency();
      // the payment choice (payways.js) arrives a moment later: keep it in the Price step
      let n = 0; const iv = setInterval(() => { const pw = el('pw-job'), slot = el('pj-pay-slot'); if (pw && slot) { slot.appendChild(pw); clearInterval(iv); } if (++n > 40) clearInterval(iv); }, 100);
      setTimeout(() => { const q = el('pj-cat-q'); if (q) q.focus(); }, 100);
      return r;
    };
  }
})();
