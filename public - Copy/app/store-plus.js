// v143: the store, complete. Loaded after trothen.js and market.js.
//
//  Sellers:  sizes or colours (each with its own price and stock), a sale
//            (a % off until a date), brand, condition, a section of the
//            store, size for delivery and an expiry date; a returns policy;
//            delivery charged by distance; their own discount codes; and
//            returns to answer on their orders.
//  Buyers:   the sale and "was" price, stars from people who bought it,
//            choosing a size or colour, saving a good (and "tell me when
//            it's back"), the returns policy before paying, a discount code
//            at checkout, returning goods, and rating what they bought.
//  The team: Stores & Skills → Returns to decide, and the minimum returns window.
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const money = (n) => (typeof usd2 === 'function' ? usd2(n) : '$' + Number(n || 0).toFixed(2));
  const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
  const SIZES = { small: 'Small (fits a motorbike box)', medium: 'Medium (a motorbike can carry it)', large: 'Large (needs a keke or car)', bulky: 'Bulky (needs a van or truck)' };
  const REASONS = { faulty: 'Faulty or not working', wrong_item: 'Wrong item sent', damaged: 'Damaged', not_as_described: 'Not as described', changed_mind: 'Changed my mind' };
  const priceLocal = (o) => (o.priceCurrency && o.priceCurrency !== 'USD' && o.priceLocal != null ? (typeof localMoney === 'function' ? localMoney(o.priceSymbol, o.priceLocal) : o.priceSymbol + o.priceLocal) : money(o.price));
  const wasLocal = (o) => (o.priceCurrency && o.priceCurrency !== 'USD' && o.wasLocal != null ? (typeof localMoney === 'function' ? localMoney(o.priceSymbol, o.wasLocal) : o.priceSymbol + o.wasLocal) : money(o.wasPrice));

  // ── SELLER: store options (returns, delivery by distance) ────────────
  window.deliveryPricingHTML = function (opt) {
    return `<div class="form-group" style="margin-bottom:8px;"><label class="form-label" for="so-dprice">${e(t('How I charge for delivery'))}</label><select class="form-input form-select" id="so-dprice"><option value="flat" ${opt.deliveryPricing !== 'distance' ? 'selected' : ''}>${e(t('One flat charge'))}</option><option value="distance" ${opt.deliveryPricing === 'distance' ? 'selected' : ''}>${e(t('By distance, at Trothen\'s motorbike fare'))}</option></select><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${e(t('By distance uses the per-km fares Trothen sets for your country (in L$ in Liberia). The flat charge below is used when the buyer gives no pin.'))}</div></div>`;
  };
  window.storeReturnsFormHTML = function (opt, set) {
    const p = opt.returnPolicy || { days: (set && set.storeMinReturnDays) || 0 };
    const min = (set && set.storeMinReturnDays) || 0;
    const days = []; for (let d = min; d <= 30; d += (d < 7 ? 1 : d < 14 ? 7 : 16)) days.push(d);
    if (!days.includes(p.days)) days.push(p.days);
    days.sort((a, b) => a - b);
    return `<div style="border-top:1px solid var(--border);margin:14px 0 10px;"></div>
      <div style="font-weight:700;color:var(--navy);margin-bottom:4px;">↩️ ${e(t('Returns'))}</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${min ? `${e(t('All stores accept returns of faulty, damaged or incorrect items for at least'))} ${min} ${e(t('days. You can offer longer, or accept change-of-mind returns. Buyers see your policy before they pay.'))}` : e(t('Buyers see your returns policy before they pay.'))}</div>
      <div class="dates-row"><div class="form-group"><label class="form-label" for="so-ret-days">${e(t('Returns accepted for'))}</label><select class="form-input form-select" id="so-ret-days">${days.map(d => `<option value="${d}" ${d === p.days ? 'selected' : ''}>${d ? d + ' ' + e(t(d === 1 ? 'day' : 'days')) : e(t('No returns'))}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label" for="so-ret-ship">${e(t('Who pays to send it back'))}</label><select class="form-input form-select" id="so-ret-ship"><option value="buyer" ${p.returnShipping !== 'seller' ? 'selected' : ''}>${e(t('The buyer (unless I sent the wrong or a faulty item)'))}</option><option value="seller" ${p.returnShipping === 'seller' ? 'selected' : ''}>${e(t('I do'))}</option></select></div></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:8px;"><input type="checkbox" id="so-ret-mind" ${p.changeOfMind ? 'checked' : ''}/> ${e(t('I also accept change-of-mind returns'))}</label>
      <div class="form-group"><label class="form-label" for="so-ret-cond">${e(t('Conditions'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><input class="form-input" id="so-ret-cond" maxlength="300" value="${e(p.conditions || '')}" placeholder="${e(t('e.g. Unused, in the original packet'))}"/></div>`;
  };
  window.readStoreExtrasForm = function () {
    const out = {};
    if (el('so-ret-days')) out.returnPolicy = { days: Number(el('so-ret-days').value), changeOfMind: el('so-ret-mind').checked, conditions: el('so-ret-cond').value.trim(), returnShipping: el('so-ret-ship').value };
    if (el('so-dprice')) out.deliveryPricing = el('so-dprice').value;
    return out;
  };

  // ── SELLER: discount codes ───────────────────────────────────────────
  const DC = { list: null };
  window.storeDiscountsPanelHTML = function () {
    setTimeout(loadCodes, 0);
    return `<div class="panel" id="store-codes-panel"><div class="panel-title">🏷️ ${e(t('Discount codes'))}</div><div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(t('Customers enter these codes at checkout. Discounts come out of your sale amount, and each customer can use a code once.'))}</div><div id="store-codes-body">${e(t('Loading…'))}</div></div>`;
  };
  async function loadCodes() { try { DC.list = (await apiFetch('GET', '/store/discounts')).discounts; } catch (x) { DC.list = []; } drawCodes(); }
  function drawCodes() {
    const box = el('store-codes-body'); if (!box) return;
    const row = (d, i) => `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">
      <input class="form-input dc-code" data-i="${i}" maxlength="16" value="${e(d.code || '')}" placeholder="SAVE10" style="flex:1 1 90px;text-transform:uppercase;"/>
      <select class="form-input form-select dc-kind" data-i="${i}" style="flex:0 1 110px;"><option value="percent" ${d.kind !== 'amount' ? 'selected' : ''}>% ${e(t('off'))}</option><option value="amount" ${d.kind === 'amount' ? 'selected' : ''}>$ ${e(t('off'))}</option></select>
      <input class="form-input dc-value" data-i="${i}" type="number" min="0" step="0.01" value="${d.value != null ? e(d.value) : ''}" placeholder="10" style="flex:0 1 70px;"/>
      <input class="form-input dc-min" data-i="${i}" type="number" min="0" step="0.01" value="${d.minOrder ? e(d.minOrder) : ''}" placeholder="${e(t('min $'))}" style="flex:0 1 80px;"/>
      <input class="form-input dc-ends" data-i="${i}" type="date" value="${d.endsAt ? e(String(d.endsAt).slice(0, 10)) : ''}" style="flex:0 1 140px;" aria-label="${e(t('Ends'))}"/>
      <input class="form-input dc-max" data-i="${i}" type="number" min="1" step="1" value="${d.maxUses ? e(d.maxUses) : ''}" placeholder="${e(t('uses'))}" style="flex:0 1 70px;"/>
      <span style="font-size:12px;color:var(--slate);">${d.used ? e(d.used) + ' ' + e(t('used')) : ''}</span>
      <button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="storeCodeRemove(${i})" aria-label="${e(t('Remove'))}">✕</button></div>`;
    box.innerHTML = `${(DC.list || []).map(row).join('') || `<div style="font-size:13.5px;color:var(--slate);margin-bottom:6px;">${e(t('No codes yet.'))}</div>`}
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${e(t('Code · % or $ off · value · minimum order · ends · how many uses (blank = no limit)'))}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-sm btn-sm-outline" onclick="storeCodeAdd()">+ ${e(t('Add a code'))}</button><button class="btn-sm btn-sm-primary" onclick="storeCodesSave()">${e(t('Save codes'))}</button></div>`;
  }
  function readCodes() {
    return [...document.querySelectorAll('.dc-code')].map(i => { const n = i.dataset.i; const q = (c) => document.querySelector(`.${c}[data-i="${n}"]`).value; return { code: q('dc-code').trim(), kind: q('dc-kind'), value: Number(q('dc-value')), minOrder: q('dc-min') === '' ? 0 : Number(q('dc-min')), endsAt: q('dc-ends') ? new Date(q('dc-ends') + 'T23:59:00').toISOString() : null, maxUses: q('dc-max') === '' ? null : Number(q('dc-max')) }; });
  }
  window.storeCodeAdd = function () { DC.list = readCodes(); DC.list.push({ code: '', kind: 'percent', value: 10 }); drawCodes(); };
  window.storeCodeRemove = function (i) { DC.list = readCodes(); DC.list.splice(i, 1); drawCodes(); };
  window.storeCodesSave = async function () {
    try { DC.list = (await apiFetch('PUT', '/store/discounts', { discounts: readCodes().filter(d => d.code) })).discounts; drawCodes(); showToast(t('Codes saved')); } catch (x) { showToast(x.message || 'Could not save'); }
  };

  // ── SELLER: the good form (sizes or colours, sale, details) ──────────
  const GV = { rows: [] };
  // v164: the Market's categories, for the good form's "Market category"
  if (!window.MARKET_CATS) { window.MARKET_CATS = []; try { apiFetch('GET', '/market/categories').then(r => { window.MARKET_CATS = r.categories || []; }).catch(() => {}); } catch (x) {} }
  if (typeof openGoodForm === 'function') {
    const base = openGoodForm;
    openGoodForm = function (id) {
      base.apply(this, arguments);
      const g = id && MY_STORE ? MY_STORE.goods.find(x => x.id === id) : null;
      const anchor = el('gf-forsale'); if (!anchor) return;
      GV.rows = g && g.variants ? g.variants.map(v => ({ ...v })) : [];
      const v = (x) => (x === null || x === undefined ? '' : e(x));
      const cats = (window.MARKET_CATS || []);
      const html = `<div id="gf-extras" style="border-top:1px solid var(--border);margin:6px 0 12px;padding-top:10px;">
        <div class="form-group"><label class="form-label" for="gf-mcat">${e(t('Market category'))}</label><select class="form-input form-select" id="gf-mcat"><option value="">${e(t('Choose for me from the name'))}${g && g.guessedCategory ? ' (' + e(t(g.guessedCategory)) + ')' : ''}</option>${cats.map(c => `<option value="${e(c)}" ${g && g.marketCategory === c ? 'selected' : ''}>${e(t(c))}</option>`).join('')}</select>
          <div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${e(t('Where shoppers find this good in the Market, for example Fashion & Clothing or Plumbing Supplies.'))}</div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="gf-brand">${e(t('Brand'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><input class="form-input" id="gf-brand" maxlength="40" value="${v(g && g.brand)}"/></div>
        <div class="form-group"><label class="form-label" for="gf-cond">${e(t('Condition'))}</label><select class="form-input form-select" id="gf-cond">${['new', 'used', 'refurbished'].map(c => `<option value="${c}" ${(g ? g.condition : 'new') === c ? 'selected' : ''}>${e(t(c[0].toUpperCase() + c.slice(1)))}</option>`).join('')}</select></div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="gf-shelf">${e(t('Section of my store'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><input class="form-input" id="gf-shelf" maxlength="40" value="${v(g && g.shelf)}" placeholder="${e(t('e.g. Pipes, Hair care'))}"/></div>
        <div class="form-group"><label class="form-label" for="gf-size">${e(t('Size for delivery'))}</label><select class="form-input form-select" id="gf-size"><option value="">${e(t('Not set'))}</option>${Object.entries(SIZES).map(([k, l]) => `<option value="${k}" ${g && g.size === k ? 'selected' : ''}>${e(t(l))}</option>`).join('')}</select></div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="gf-sale">${e(t('Sale: % off'))} <small style="font-weight:400;color:var(--slate);">${e(t('0 = no sale'))}</small></label><input class="form-input" id="gf-sale" type="number" min="0" max="90" step="1" value="${v(g ? (g.salePercentSet || 0) : 0)}"/></div>
        <div class="form-group"><label class="form-label" for="gf-sale-end">${e(t('Sale ends'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><input class="form-input" id="gf-sale-end" type="date" value="${g && g.saleEndsAt ? e(String(g.saleEndsAt).slice(0, 10)) : ''}"/></div></div>
        <div class="form-group"><label class="form-label" for="gf-expiry">${e(t('Expiry date'))} <small style="font-weight:400;color:var(--slate);">${e(t('for food, medicine-free care products and anything that goes off'))}</small></label><input class="form-input" id="gf-expiry" type="date" value="${g && g.expiryDate ? e(g.expiryDate) : ''}" style="max-width:200px;"/></div>
        <div style="font-weight:700;color:var(--navy);margin:6px 0 4px;">${e(t('Sizes or colours'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional, up to 20'))}</small></div>
        <div style="font-size:12.5px;color:var(--muted);margin-bottom:6px;">${e(t('Each one can have its own price (blank = the price above) and its own stock. With these, the stock above is not used.'))}</div>
        <div class="form-group" style="max-width:240px;"><label class="form-label" for="gf-vname">${e(t('Called'))}</label><input class="form-input" id="gf-vname" maxlength="20" value="${v(g && g.variantName)}" placeholder="${e(t('Size, Colour, Length…'))}"/></div>
        <div id="gf-variants"></div><button type="button" class="btn-sm btn-sm-outline" onclick="goodVariantAdd()">+ ${e(t('Add a size or colour'))}</button></div>`;
      anchor.closest('label').insertAdjacentHTML('beforebegin', html);
      drawVariants();
    };
  }
  function drawVariants() {
    const box = el('gf-variants'); if (!box) return;
    box.innerHTML = GV.rows.map((r, i) => `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;"><input class="form-input gv-label" data-i="${i}" maxlength="40" value="${e(r.label || '')}" placeholder="${e(t('e.g. Large, Red, 14 inch'))}" style="flex:2 1 120px;"/><input class="form-input gv-price" data-i="${i}" type="number" min="0" step="0.01" value="${r.price != null ? e(r.price) : ''}" placeholder="${e(t('price'))}" style="flex:1 1 70px;"/><input class="form-input gv-stock" data-i="${i}" type="number" min="0" step="1" value="${r.stock != null ? e(r.stock) : ''}" placeholder="${e(t('stock'))}" style="flex:1 1 60px;"/><button type="button" class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="goodVariantRemove(${i})" aria-label="${e(t('Remove'))}">✕</button></div>`).join('');
  }
  function readVariants() { return [...document.querySelectorAll('.gv-label')].map(i => { const n = i.dataset.i; const p = document.querySelector(`.gv-price[data-i="${n}"]`).value, s = document.querySelector(`.gv-stock[data-i="${n}"]`).value; return { id: GV.rows[n] && GV.rows[n].id, label: i.value.trim(), price: p === '' ? null : Number(p), stock: s === '' ? null : Number(s) }; }); }
  window.goodVariantAdd = function () { GV.rows = readVariants(); if (GV.rows.length < 20) GV.rows.push({ label: '', price: null, stock: null }); drawVariants(); };
  window.goodVariantRemove = function (i) { GV.rows = readVariants(); GV.rows.splice(i, 1); drawVariants(); };
  // saveGood sends the extras too (the original reads the rest of the form).
  if (typeof saveGood === 'function') {
    const base = saveGood;
    saveGood = async function () {
      if (!el('gf-extras')) return base.apply(this, arguments);
      const realFetch = apiFetch;
      const variants = readVariants().filter(v => v.label);
      const extras = { marketCategory: el('gf-mcat') ? el('gf-mcat').value : undefined, brand: el('gf-brand').value.trim(), condition: el('gf-cond').value, shelf: el('gf-shelf').value.trim(), size: el('gf-size').value || null, salePercent: Number(el('gf-sale').value) || 0, saleEndsAt: el('gf-sale-end').value ? new Date(el('gf-sale-end').value + 'T23:59:00').toISOString() : null, expiryDate: el('gf-expiry').value || null, variantName: el('gf-vname').value.trim(), variants };
      apiFetch = function (m, p, body) { if ((m === 'POST' && p === '/store/goods') || (m === 'PATCH' && /^\/store\/goods\/[^/]+$/.test(p))) body = { ...body, ...extras }; return realFetch.apply(this, [m, p, body]); };
      try { return await base.apply(this, arguments); } finally { apiFetch = realFetch; }
    };
  }

  // ── BUYER: the store window ──────────────────────────────────────────
  const PICK = {}; // goodId → chosen variant id
  const keyOf = (g) => (g.variants && g.variants.length ? `${g.id}::${PICK[g.id] || ''}` : g.id);
  window.storePickVariant = function (goodId, vid) { PICK[goodId] = vid; renderProStore(); };
  changeBasket = function (goodId, delta) {
    const pid = STORE_VIEW.providerId, d = STORE_VIEW.data; if (!pid || !d) return;
    const g = d.goods.find(x => x.id === goodId); if (!g || g.soldOut) return;
    const hasV = g.variants && g.variants.length;
    if (hasV && !PICK[goodId]) return showToast(`${t('Choose the')} ${(g.variantName || t('option')).toLowerCase()} ${t('first')}`);
    const v = hasV ? g.variants.find(x => x.id === PICK[goodId]) : null;
    if (v && v.soldOut) return showToast(t('That one is sold out'));
    const key = keyOf(g);
    const b = STORE_BASKET[pid] = STORE_BASKET[pid] || {};
    const left = v ? v.left : g.left;
    let q = (b[key] || 0) + delta;
    const max = left !== null && left !== undefined ? Math.min(left, 99) : 99;
    if (q > max) { q = max; showToast(left !== null && left !== undefined ? `${t('Only')} ${left} ${t('left')}` : t('That is the most you can add')); }
    if (q <= 0) delete b[key]; else b[key] = q;
    renderProStore();
  };
  window.storeToggleSave = async function (goodId, saved) {
    if (!(typeof AUTH !== 'undefined' && AUTH.token)) return showToast(t('Sign in to save goods'));
    try {
      if (saved) await apiFetch('DELETE', `/store/goods/${encodeURIComponent(goodId)}/save`);
      else await apiFetch('POST', `/store/goods/${encodeURIComponent(goodId)}/save`, { notifyRestock: true });
      const g = STORE_VIEW.data.goods.find(x => x.id === goodId); if (g) g.saved = !saved;
      showToast(t(saved ? 'Removed from Saved' : 'Saved. You\'ll be told if it comes back in stock.')); renderProStore();
    } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.storeShowReviews = async function (goodId, name) {
    let r; try { r = await apiFetch('GET', `/store/goods/${encodeURIComponent(goodId)}/reviews`); } catch (x) { return showToast(x.message); }
    v105Overlay('good-reviews', `<div class="modal-header"><button class="modal-close" onclick="v105Close('good-reviews')" aria-label="Close">✕</button><h3>${e(name)}</h3><p>${r.rating ? `${stars(r.rating.avg)} ${e(r.rating.avg)} · ${e(r.rating.count)} ${e(t('reviews from people who bought it'))}` : ''}</p></div>
      <div class="modal-body">${r.reviews.map(x => `<div style="border-top:1px solid var(--border);padding:8px 0;"><div style="color:#B08A3C;">${stars(x.stars)}</div><div style="font-size:14px;">${e(x.text)}</div><div style="font-size:12px;color:var(--slate);">${e(x.authorName)}${x.variantLabel ? ' · ' + e(x.variantLabel) : ''} · ${e(new Date(x.createdAt).toLocaleDateString())} · ${e(t('Verified purchase'))}</div></div>`).join('') || `<p style="color:var(--slate);">${e(t('No reviews yet.'))}</p>`}</div>`, 480);
  };
  renderProStore = function () {
    const d = STORE_VIEW.data, pid = STORE_VIEW.providerId;
    if (!d || !el('pro-store-overlay')) return;
    // v140: a verified pro sees and pays the trade price (in US$) where the store has one
    if (!d.tradeApplied) { d.tradeApplied = true; for (const g of d.goods || []) if (g.tradePrice && g.tradePrice < g.price && !(g.variants && g.variants.length)) { g.description = `${t('Trade price for pros')} (${t('shelf')} ${money(g.price)}). ${g.description || ''}`.trim(); Object.assign(g, { price: g.tradePrice, priceCurrency: 'USD', priceLocal: null, salePercent: 0 }); } }
    const basket = STORE_BASKET[pid] || {};
    const del = d.delivery || { methods: ['pickup'] };
    el('ps-title').textContent = d.store.name;
    el('ps-sub').textContent = (d.store.description ? d.store.description + ' · ' : '') + t('Sold by') + ' ' + d.store.providerName + (d.store.rating ? ` · ★ ${Number(d.store.rating).toFixed(1)}` : '');
    const ways = del.methods.map(m => t(m === 'pickup' ? 'collect it yourself' : m === 'seller' ? (del.deliveryPricing === 'distance' ? 'the seller brings it (charged by distance)' : 'the seller brings it') : 'a driver brings it')).join(' · ');
    const shelves = [...new Set(d.goods.map(g => g.shelf).filter(Boolean))];
    const card = (g) => {
      const hasV = g.variants && g.variants.length; const v = hasV ? g.variants.find(x => x.id === PICK[g.id]) : null;
      const shown = v || g; const q = basket[keyOf(g)] || 0;
      return `<div class="store-good" style="border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;background:var(--white);position:relative;">
      <button type="button" onclick="storeToggleSave(${jsArg(g.id)}, ${g.saved ? 'true' : 'false'})" aria-label="${e(t(g.saved ? 'Remove from Saved' : 'Save'))}" title="${e(t(g.saved ? 'Saved' : 'Save'))}" style="position:absolute;top:14px;right:14px;border:none;background:rgba(255,255,255,.9);border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px;color:${g.saved ? '#C1554D' : 'var(--slate)'};">${g.saved ? '♥' : '♡'}</button>
      ${g.salePercent ? `<span style="position:absolute;top:14px;left:14px;background:#C1554D;color:#fff;font-weight:800;font-size:12px;border-radius:6px;padding:2px 6px;">−${e(g.salePercent)}%</span>` : ''}
      ${g.photoUrls[0] ? `<img src="${e(g.photoUrls[0])}" alt="${e(g.name)}" loading="lazy" onclick="v105Zoom(${jsArg(g.photoUrls[0])})" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:zoom-in;"/>` : ''}
      ${g.photoUrls.length > 1 ? `<div style="display:flex;gap:4px;">${g.photoUrls.slice(1).map(u => v105Photo(u, 34)).join('')}</div>` : ''}
      <div style="font-weight:700;color:var(--navy);font-size:14px;line-height:1.3;">${e(g.name)}</div>
      <div style="font-size:12px;color:var(--slate);">${[g.brand, g.condition && g.condition !== 'new' ? t(g.condition[0].toUpperCase() + g.condition.slice(1)) : '', g.expiryDate ? t('Use by') + ' ' + new Date(g.expiryDate + 'T12:00:00').toLocaleDateString() : ''].filter(Boolean).map(e).join(' · ')}</div>
      ${g.rating ? `<a onclick="storeShowReviews(${jsArg(g.id)},${jsArg(g.name)})" style="font-size:12.5px;color:#B08A3C;cursor:pointer;">${stars(g.rating.avg)} <span style="color:var(--slate);">${e(g.rating.avg)} (${e(g.rating.count)})</span></a>` : ''}
      ${g.description ? `<div style="font-size:12.5px;color:var(--slate);line-height:1.4;">${e(g.description)}</div>` : ''}
      ${hasV ? `<select class="form-input form-select" style="padding:6px;font-size:13px;" onchange="storePickVariant(${jsArg(g.id)}, this.value)" aria-label="${e(g.variantName || t('Option'))}"><option value="">${e(t('Choose'))} ${e((g.variantName || t('option')).toLowerCase())}</option>${g.variants.map(x => `<option value="${e(x.id)}" ${PICK[g.id] === x.id ? 'selected' : ''} ${x.soldOut ? 'disabled' : ''}>${e(x.label)}${x.price !== g.price ? ' · ' + priceLocal(x) : ''}${x.soldOut ? ' · ' + e(t('sold out')) : ''}</option>`).join('')}</select>` : ''}
      <div style="font-weight:800;color:var(--navy);margin-top:auto;">${priceLocal(shown)}${shown.salePercent ? ` <s style="font-weight:400;color:var(--slate);font-size:12.5px;">${wasLocal(shown)}</s>` : ''}${g.unit ? `<span style="font-weight:400;color:var(--slate);font-size:12.5px;"> / ${e(g.unit)}</span>` : ''}</div>
      ${g.saleEndsAt && g.salePercent ? `<div style="font-size:11.5px;color:#C1554D;">${e(t('Sale ends'))} ${e(new Date(g.saleEndsAt).toLocaleDateString())}</div>` : ''}
      ${g.soldOut ? `<span class="badge badge-neutral" style="align-self:flex-start;">${e(t('Sold out'))}</span>${g.saved ? '' : `<button class="btn-sm btn-sm-outline" onclick="storeToggleSave(${jsArg(g.id)}, false)">🔔 ${e(t('Tell me when it\'s back'))}</button>`}`
        : `${(v ? v.left : g.left) !== null && (v ? v.left : g.left) !== undefined ? `<div style="font-size:12px;color:#8C6423;">${e(t('Only'))} ${v ? v.left : g.left} ${e(t('left'))}</div>` : ''}
           <div style="display:flex;align-items:center;gap:8px;">
             <button type="button" class="btn-sm btn-sm-outline" style="min-width:36px;" onclick="changeBasket(${jsArg(g.id)},-1)" aria-label="${e(t('One fewer'))}" ${q ? '' : 'disabled'}>−</button>
             <span style="min-width:20px;text-align:center;font-weight:700;" aria-live="polite">${q}</span>
             <button type="button" class="btn-sm btn-sm-primary" style="min-width:36px;" onclick="changeBasket(${jsArg(g.id)},1)" aria-label="${e(t('One more'))}">+</button>
           </div>`}
    </div>`;
    };
    const grid = (list) => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">${list.map(card).join('')}</div>`;
    el('ps-body').innerHTML = `
      <div style="font-size:13px;color:var(--slate);margin-bottom:12px;line-height:1.6;">🚚 ${e(t('How to get your goods:'))} ${e(ways)}${del.hours ? `<br>🕒 ${e(del.hours)}` : ''}${del.orderNote ? `<br>${e(del.orderNote)}` : ''}${d.returnPolicy ? `<br>↩️ ${e(d.returnPolicy.words)}` : ''}${d.store.hasDiscounts ? `<br>🏷️ ${e(t('This store has discount codes. Enter yours at checkout.'))}` : ''}</div>
      ${d.goods.length ? (shelves.length > 1 ? shelves.map(s => `<div style="font-weight:700;color:var(--navy);margin:12px 0 8px;">${e(s)}</div>${grid(d.goods.filter(g => g.shelf === s))}`).join('') + (d.goods.some(g => !g.shelf) ? `<div style="font-weight:700;color:var(--navy);margin:12px 0 8px;">${e(t('More'))}</div>${grid(d.goods.filter(g => !g.shelf))}` : '') : grid(d.goods)) : `<p style="color:var(--slate);">${e(t('Nothing on the shelf right now.'))}</p>`}`;
    // the total, line by line (sizes and colours included)
    let total = 0;
    for (const [key, qn] of Object.entries(basket)) { const [gid, vid] = key.split('::'); const g = d.goods.find(x => x.id === gid); if (!g) continue; const v = vid ? (g.variants || []).find(x => x.id === vid) : null; total += (v || g).price * qn; }
    const count = basketCount(pid);
    el('ps-foot').innerHTML = count
      ? `<div style="font-size:13.5px;color:var(--slate);margin-bottom:8px;">${count} ${e(t(count === 1 ? 'good picked' : 'goods picked'))} · <strong style="color:var(--navy);">${money(total)}</strong>${d.purchaseFee > 0 ? ` + ${money(d.purchaseFee)} ${e(t('store purchase fee'))}` : ''}</div>
         <div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="confirm-btn" style="flex:1 1 200px;" onclick="openStoreCheckout()">🛒 ${e(t('Buy these goods'))}</button><button class="btn-sm btn-sm-outline" style="flex:1 1 160px;" onclick="bookWithBasket(false)">${e(t('Book this pro with these goods'))}</button></div>`
      : `<div style="font-size:13.5px;color:var(--slate);">${e(t('Pick what you need with +. You can buy the goods on their own, or add them to a booking with this pro.'))}</div>`;
    el('ps-foot').insertAdjacentHTML('beforeend', `<div style="font-size:12.5px;color:var(--muted);margin-top:8px;">${e(t('These goods are sold by the pro, not by Trothen. Your money is held until you have them. If something is missing, wrong or damaged, use "Report a Problem" on the order.'))}</div>`);
  };

  // ── BUYER: checkout extras (discount code, returns, delivery by distance) ──
  if (typeof drawCheckout === 'function') {
    const base = drawCheckout;
    drawCheckout = function () {
      base.apply(this, arguments);
      const body = el('co-body'); if (!body || CHECKOUT.orderId) return;
      const p = CHECKOUT.priced;
      const sums = body.querySelectorAll('.booking-summary'); const totals = sums[sums.length - 1];
      if (p && p.discount > 0 && totals) {
        const goodsRow = totals.querySelector('.summary-row');
        if (goodsRow) goodsRow.insertAdjacentHTML('beforebegin', `<div class="summary-row"><span>${e(t('Goods'))}</span><span>${money(p.goodsBeforeDiscount)}</span></div><div class="summary-row" style="color:#1E7A55;"><span>🏷️ ${e(p.discountCode)} (${e(p.discountLabel)})</span><span>−${money(p.discount)}</span></div>`);
        if (goodsRow) goodsRow.firstElementChild.textContent = t('Goods after discount');
      }
      if (totals) totals.insertAdjacentHTML('beforebegin', `<div class="form-group" style="margin-top:12px;"><label class="form-label" for="co-code">${e(t('Discount code'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><div style="display:flex;gap:6px;"><input class="form-input" id="co-code" maxlength="16" value="${e(CHECKOUT.discountCode || '')}" style="text-transform:uppercase;flex:1;min-width:0;"/><button type="button" class="btn-sm btn-sm-outline" onclick="storeApplyCode()">${e(t(CHECKOUT.discountCode ? 'Change' : 'Apply'))}</button>${CHECKOUT.discountCode ? `<button type="button" class="btn-sm btn-sm-ghost" onclick="storeApplyCode(true)">${e(t('Remove'))}</button>` : ''}</div></div>`);
      if (CHECKOUT.returnPolicy) body.insertAdjacentHTML('beforeend', `<div style="font-size:12.5px;color:var(--slate);margin-top:8px;">↩️ ${e(CHECKOUT.returnPolicy.words)}</div>`);
      if (CHECKOUT.method === 'seller' && CHECKOUT.delivery && CHECKOUT.delivery.deliveryPricing === 'distance') body.insertAdjacentHTML('beforeend', `<div style="font-size:12.5px;color:var(--slate);margin-top:4px;">${e(t(CHECKOUT.pin ? 'The seller\'s delivery charge is worked out from the distance.' : 'Add a pin: the seller charges by distance.'))}</div>`);
    };
  }
  window.storeApplyCode = async function (remove) {
    const code = remove ? null : ((el('co-code') || {}).value || '').trim().toUpperCase();
    try {
      CHECKOUT.priced = await apiFetch('POST', '/store/price-basket', { providerId: CHECKOUT.pid, items: basketToItems(STORE_BASKET[CHECKOUT.pid] || {}), discountCode: code || undefined });
      CHECKOUT.discountCode = code || null;
      if (code) showToast(`${t('Code applied')}: −${money(CHECKOUT.priced.discount)}`);
    } catch (x) { showToast(x.message || t('That code doesn\'t work here')); }
    drawCheckout();
  };
  async function sellerFeeByDistance() {
    const del = CHECKOUT.delivery; if (!del || del.deliveryPricing !== 'distance' || CHECKOUT.method !== 'seller') return;
    const q = CHECKOUT.pin ? `&latitude=${CHECKOUT.pin.latitude}&longitude=${CHECKOUT.pin.longitude}` : '';
    try { const r = await apiFetch('GET', `/store/seller-delivery?providerId=${encodeURIComponent(CHECKOUT.pid)}${q}`); del.sellerFee = r.fee; } catch (x) { /* the flat charge stays */ }
    drawCheckout();
  }
  if (typeof setCheckoutMethod === 'function') { const b = setCheckoutMethod; setCheckoutMethod = function () { const r = b.apply(this, arguments); sellerFeeByDistance(); return r; }; }
  if (typeof pinCheckout === 'function') { const b = pinCheckout; pinCheckout = async function () { const r = await b.apply(this, arguments); await sellerFeeByDistance(); return r; }; }

  // ── BUYER: returns and reviews on an order ───────────────────────────
  const rrWords = { requested: 'Return asked. Waiting for the seller (they have 3 days, or it is accepted).', accepted: 'Return accepted. Bring or send it back, then press "I\'ve sent it back".', declined: 'The seller declined the return.', sent: 'Sent back. Waiting for the seller to confirm they have it.', escalated: 'The Trothen team is deciding.', refunded: 'Refunded', declined_final: 'Not refunded (decided by Trothen).' };
  function returnBlock(o, seller) {
    const rr = o.returnRequest;
    const parts = [];
    if (o.discount > 0) parts.push(`<div style="font-size:13px;color:#1E7A55;">🏷️ ${e(o.discountCode)}: −${money(o.discount)}</div>`);
    if (rr) {
      parts.push(`<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#FBF3E4;font-size:13.5px;"><strong>↩️ ${e(t('Return'))}:</strong> ${rr.items.map(i => `${i.qty} × ${e(i.name)}`).join(', ')} · ${e(t(REASONS[rr.reason] || rr.reason))} · ${money(rr.amount)}${rr.note ? `<br>“${e(rr.note)}”` : ''}<br><strong>${e(t(rrWords[rr.status] || rr.status))}</strong>${rr.sellerNote ? `<br>${e(t('Seller'))}: “${e(rr.sellerNote)}”` : ''}${rr.decidedNote ? `<br>${e(t('Trothen'))}: “${e(rr.decidedNote)}”` : ''}${rr.status === 'refunded' ? ` ${money(rr.amount)}` : ''}${rr.returnTo && rr.status === 'accepted' ? `<br>${e(t('Return to'))}: ${e(rr.returnTo)}` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
          ${seller && rr.status === 'requested' ? `<button class="btn-sm btn-sm-primary" onclick="storeReturnAnswer(${jsArg(o.id)},'accept')">${e(t('Accept the return'))}</button><button class="btn-sm btn-sm-outline" onclick="storeReturnAnswer(${jsArg(o.id)},'decline')">${e(t('Decline'))}</button>` : ''}
          ${seller && ['sent', 'accepted'].includes(rr.status) ? `<button class="btn-sm btn-sm-primary" onclick="storeReturnReceived(${jsArg(o.id)})">${e(t('I have it back: refund the buyer'))}</button>` : ''}
          ${!seller && rr.status === 'accepted' ? `<button class="btn-sm btn-sm-primary" onclick="storeReturnSent(${jsArg(o.id)})">${e(t('I\'ve sent it back'))}</button>` : ''}
          ${!seller && (rr.status === 'declined' || (rr.status === 'sent' && Date.parse(rr.sentAt) < Date.now() - 3 * 86400000)) ? `<button class="btn-sm btn-sm-outline" onclick="storeReturnEscalate(${jsArg(o.id)})">${e(t('Ask Trothen to decide'))}</button>` : ''}
        </div></div>`);
    } else if (!seller && o.returnPolicy && o.status === 'completed') {
      parts.push(`<div style="font-size:12.5px;color:var(--slate);margin-top:6px;">↩️ ${o.canReturn ? `${e(t('You can return goods until'))} ${e(new Date(o.returnUntil).toLocaleDateString())}. ` : ''}${e(o.returnPolicy.words)}</div>`);
    }
    if (!seller && o.status === 'completed') {
      const toRate = (o.items || []).filter(i => !(o.reviewedGoods || []).includes(i.goodId));
      if (toRate.length || o.canReturn) parts.push(`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${o.canReturn ? `<button class="btn-sm btn-sm-outline" onclick="storeReturnOpen(${jsArg(o.id)})">↩️ ${e(t('Return an item'))}</button>` : ''}${[...new Map(toRate.map(i => [i.goodId, i])).values()].map(i => `<button class="btn-sm btn-sm-outline" onclick="storeRateOpen(${jsArg(o.id)},${jsArg(i.goodId)},${jsArg(i.name)})">⭐ ${e(t('Rate'))} ${e(i.name)}</button>`).join('')}</div>`);
    }
    return parts.join('');
  }
  function addToCard(html, extra) { const i = html.lastIndexOf('</div>'); return i === -1 ? html + extra : html.slice(0, i) + extra + html.slice(i); }
  if (typeof customerOrderHTML === 'function') { const b = customerOrderHTML; customerOrderHTML = function (o) { return addToCard(b.apply(this, arguments), returnBlock(o, false)); }; }
  if (typeof sellerOrderHTML === 'function') { const b = sellerOrderHTML; sellerOrderHTML = function (o) { return addToCard(b.apply(this, arguments), returnBlock(o, true)); }; }
  const findOrder = (id) => ((typeof CUSTOMER_ORDERS !== 'undefined' && CUSTOMER_ORDERS) || []).find(x => x.id === id) || (((typeof MY_ORDERS !== 'undefined' && MY_ORDERS && MY_ORDERS.selling) || []).find(x => x.id === id));
  const reloadOrders = async () => { if (el('my-orders-body') && typeof loadMyOrders === 'function') await loadMyOrders(); if (el('my-store-body') && typeof loadMyStore === 'function') await loadMyStore(); };
  window.storeReturnOpen = function (id) {
    const o = findOrder(id); if (!o) return;
    const mind = o.returnPolicy && o.returnPolicy.changeOfMind;
    v105Overlay('return-form', `<div class="modal-header"><button class="modal-close" onclick="v105Close('return-form')" aria-label="Close">✕</button><h3>${e(t('Return goods'))}</h3><p>${e(t('Order'))} #${e(o.number)} · ${e(o.store ? o.store.name : '')}</p></div>
      <div class="modal-body">${o.items.map((i, n) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--border);"><span style="flex:1;">${e(i.name)} <span style="color:var(--slate);">(${e(t('bought'))} ${i.qty})</span></span><input class="form-input rf-qty" data-n="${n}" type="number" min="0" max="${i.qty}" step="1" value="0" style="width:80px;" aria-label="${e(t('How many to return'))}"/></div>`).join('')}
        <div class="form-group" style="margin-top:10px;"><label class="form-label" for="rf-reason">${e(t('Why'))}</label><select class="form-input form-select" id="rf-reason">${Object.entries(REASONS).filter(([k]) => k !== 'changed_mind' || mind).map(([k, l]) => `<option value="${k}">${e(t(l))}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="rf-note">${e(t('What is wrong'))} <small style="font-weight:400;color:var(--slate);">${e(t('a few words, so the seller can check'))}</small></label><input class="form-input" id="rf-note" maxlength="500"/></div>
        <div class="ver-note">${e(o.returnPolicy ? o.returnPolicy.words : '')} ${e(t('You are refunded what you paid for the goods once the seller has them back.'))}</div></div>
      <div class="modal-footer"><button class="confirm-btn" onclick="storeReturnSend(${jsArg(id)})">${e(t('Ask for the return'))}</button></div>`, 520);
  };
  window.storeReturnSend = async function (id) {
    const o = findOrder(id); if (!o) return;
    const items = [...document.querySelectorAll('.rf-qty')].map(i => ({ line: o.items[i.dataset.n], qty: Number(i.value) })).filter(x => x.qty > 0).map(x => ({ goodId: x.line.goodId, variantId: x.line.variantId || null, qty: x.qty }));
    if (!items.length) return showToast(t('Choose how many of which goods'));
    try { await apiFetch('POST', `/store/orders/${encodeURIComponent(id)}/return`, { items, reason: el('rf-reason').value, note: el('rf-note').value.trim() }); v105Close('return-form'); showToast(t('Asked. The seller has 3 days to answer.')); await reloadOrders(); }
    catch (x) { showToast(x.message || 'Could not send'); }
  };
  window.storeReturnAnswer = async function (id, decision) {
    let note;
    if (decision === 'decline') { note = await confirmDialog(t('Say why you decline. The buyer can ask the Trothen team to decide.'), { confirmLabel: t('Decline'), requireTextInput: true, danger: true }); if (!note) return; }
    else if (!(await confirmDialog(t('Accept the return? The buyer brings or sends it back, and is refunded when you confirm you have it.'), { confirmLabel: t('Accept') }))) return;
    try { await apiFetch('POST', `/store/orders/${encodeURIComponent(id)}/return/answer`, { decision, note }); await reloadOrders(); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.storeReturnSent = async function (id) {
    if (!(await confirmDialog(t('Have you brought or sent the goods back? Keep any receipt from the sending.'), { confirmLabel: t('Yes, sent back') }))) return;
    try { await apiFetch('POST', `/store/orders/${encodeURIComponent(id)}/return/sent`, {}); await reloadOrders(); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.storeReturnReceived = async function (id) {
    if (!(await confirmDialog(t('You have the goods back? The buyer is refunded for them now, and they go back on your shelf.'), { confirmLabel: t('Yes, refund the buyer') }))) return;
    try { const r = await apiFetch('POST', `/store/orders/${encodeURIComponent(id)}/return/received`, { restock: true }); showToast(`${t('Refunded')} ${money(r.refunded)}`); await reloadOrders(); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.storeReturnEscalate = async function (id) {
    if (!(await confirmDialog(t('Ask the Trothen team to decide this return? They look at the order, the photos and what both of you said.'), { confirmLabel: t('Ask Trothen') }))) return;
    try { await apiFetch('POST', `/store/orders/${encodeURIComponent(id)}/return/escalate`, {}); showToast(t('The Trothen team has been asked.')); await reloadOrders(); } catch (x) { showToast(x.message || 'Could not send'); }
  };
  window.storeRateOpen = function (orderId, goodId, name) {
    window.__rate = { orderId, goodId, stars: 5 };
    v105Overlay('rate-good', `<div class="modal-header"><button class="modal-close" onclick="v105Close('rate-good')" aria-label="Close">✕</button><h3>${e(t('Rate'))} ${e(name)}</h3></div>
      <div class="modal-body"><div id="rg-stars" style="font-size:30px;color:#B08A3C;cursor:pointer;" role="radiogroup" aria-label="${e(t('Stars'))}">${[1, 2, 3, 4, 5].map(n => `<span role="radio" tabindex="${n === 5 ? 0 : -1}" aria-checked="${n === 5}" onclick="storeRateStars(${n})" onkeydown="storeRateKey(event, ${n})" aria-label="${n} ${e(t(n === 1 ? 'star' : 'stars'))}">★</span>`).join('')}</div>
        <div class="form-group" style="margin-top:8px;"><label class="form-label" for="rg-text">${e(t('What did you think?'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><textarea class="form-input" id="rg-text" rows="3" maxlength="600"></textarea></div></div>
      <div class="modal-footer"><button class="confirm-btn" onclick="storeRateSend()">${e(t('Post my review'))}</button></div>`, 440);
  };
  window.storeRateStars = function (n) { window.__rate.stars = n; [...document.querySelectorAll('#rg-stars span')].forEach((s, i) => { s.textContent = i < n ? '★' : '☆'; s.setAttribute('aria-checked', String(i + 1 === n)); s.tabIndex = i + 1 === n ? 0 : -1; }); };
  // v163: the stars work from a keyboard too (Enter or Space to choose, arrows to move), as a radio group should
  window.storeRateKey = function (ev, n) {
    let to = null;
    if (ev.key === 'Enter' || ev.key === ' ') to = n; else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') to = Math.min(5, n + 1); else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') to = Math.max(1, n - 1);
    if (to === null) return; ev.preventDefault(); storeRateStars(to); const sp = document.querySelectorAll('#rg-stars span')[to - 1]; if (sp) sp.focus();
  };
  window.storeRateSend = async function () {
    const r = window.__rate; try { await apiFetch('POST', `/store/goods/${encodeURIComponent(r.goodId)}/reviews`, { orderId: r.orderId, stars: r.stars, text: el('rg-text').value.trim() }); v105Close('rate-good'); showToast(t('Thank you for your review')); await reloadOrders(); }
    catch (x) { showToast(x.message || 'Could not post'); }
  };

  // ── BUYER: Saved goods ───────────────────────────────────────────────
  if (typeof CUSTOMER_NAV_ITEMS !== 'undefined' && !CUSTOMER_NAV_ITEMS.some(i => i.key === 'saved')) {
    const i = CUSTOMER_NAV_ITEMS.findIndex(x => x.key === 'orders');
    CUSTOMER_NAV_ITEMS.splice(i === -1 ? CUSTOMER_NAV_ITEMS.length : i + 1, 0, { key: 'saved', label: 'Saved', icon: '❤' });
    CUSTOMER_SECTIONS.saved = () => `<div class="dash-header"><div><div class="dash-title">${e(t('Saved'))}</div><div class="dash-sub">${e(t('Goods you saved. You\'re told when a sold-out one is back.'))}</div></div></div><div id="saved-body"><div class="panel" style="color:var(--slate);">${e(t('Loading…'))}</div></div>`;
    const b = selectCustomerSection; selectCustomerSection = function (key) { const r = b.apply(this, arguments); if (key === 'saved') loadSaved(); return r; };
  }
  async function loadSaved() {
    const box = el('saved-body'); if (!box) return;
    let rows; try { rows = (await apiFetch('GET', '/store/saved')).saved; } catch (x) { box.innerHTML = `<div class="panel">${e(x.message)}</div>`; return; }
    box.innerHTML = rows.length ? `<div class="panel">${rows.map(r => `<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--border);flex-wrap:wrap;">${r.photoUrl ? `<img src="${e(r.photoUrl)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;"/>` : ''}<div style="flex:1;min-width:160px;"><div style="font-weight:700;color:var(--navy);">${e(r.name)}</div><div style="font-size:13px;color:var(--slate);">${e(r.storeName)} · ${priceLocal(r)}${r.salePercent ? ` <span style="color:#C1554D;">−${e(r.salePercent)}%</span>` : ''} · ${e(t(!r.available ? 'No longer available' : r.soldOut ? 'Sold out: you\'ll be told when it\'s back' : 'In stock'))}</div></div>${r.available ? `<button class="btn-sm btn-sm-primary" onclick="openProStore(${jsArg(r.providerId)})">${e(t('Open the store'))}</button>` : ''}<button class="btn-sm btn-sm-ghost" onclick="storeUnsave(${jsArg(r.goodId)})">${e(t('Remove'))}</button></div>`).join('')}</div>`
      : `<div class="panel" style="color:var(--slate);">${e(t('Nothing saved yet. Press ♡ on a good in a store to save it.'))}</div>`;
  }
  window.storeUnsave = async function (id) { try { await apiFetch('DELETE', `/store/goods/${encodeURIComponent(id)}/save`); loadSaved(); } catch (x) { showToast(x.message); } };

  // ── THE TEAM: returns to decide, and the minimum window ──────────────
  async function drawAdminReturns() {
    const host = el('admin-stores-body'); if (!host || el('admin-returns')) return;
    let data; try { data = await apiFetch('GET', '/admin/store/returns'); } catch (x) { return; }
    const box = document.createElement('div'); box.className = 'panel'; box.id = 'admin-returns';
    const rows = data.returns || [];
    const isSuper = !!(AUTH.user && AUTH.user.isSuperAdmin);
    box.innerHTML = `<div class="panel-title">↩️ ${e(t('Store returns'))} <small>${rows.filter(r => r.returnRequest.status === 'escalated').length} ${e(t('to decide'))}</small></div>
      ${rows.length ? rows.map(r => { const rr = r.returnRequest; return `<div style="border-top:1px solid var(--border);padding:8px 0;"><div><strong>#${e(r.number)}</strong> · ${e(r.store)} (${e(r.seller)}) · ${e(t('buyer'))} ${e(r.buyer)} · <strong>${e(t(rrWords[rr.status] || rr.status))}</strong></div><div style="font-size:13.5px;color:var(--slate);">${rr.items.map(i => `${i.qty} × ${e(i.name)}`).join(', ')} · ${e(t(REASONS[rr.reason] || rr.reason))} · ${money(rr.amount)}${rr.note ? ` · “${e(rr.note)}”` : ''}${rr.sellerNote ? ` · ${e(t('seller'))}: “${e(rr.sellerNote)}”` : ''}</div>${rr.photoUrls && rr.photoUrls.length ? `<div style="display:flex;gap:4px;margin-top:4px;">${rr.photoUrls.map(u => v105Photo(u, 40)).join('')}</div>` : ''}${rr.status === 'escalated' ? `<div style="display:flex;gap:6px;margin-top:6px;"><button class="btn-sm btn-sm-primary" onclick="storeAdminReturn(${jsArg(r.id)},'refund')">${e(t('Refund the buyer'))}</button><button class="btn-sm btn-sm-outline" onclick="storeAdminReturn(${jsArg(r.id)},'refuse')">${e(t('Refuse the return'))}</button></div>` : ''}</div>`; }).join('') : `<div style="color:var(--slate);font-size:14px;">${e(t('No returns open.'))}</div>`}
      ${isSuper ? `<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;border-top:1px solid var(--border);padding-top:10px;"><div class="form-group" style="margin:0;"><label class="form-label" for="ar-min">${e(t('Every store takes back faulty goods for at least (days)'))}</label><input class="form-input" id="ar-min" type="number" min="0" max="30" step="1" style="max-width:120px;"/></div><button class="btn-sm btn-sm-outline" onclick="storeAdminMinDays()">${e(t('Save'))}</button></div><div style="font-size:12.5px;color:var(--muted);">${e(t('A seller\'s money for an order is paid after this window, so a refund is always possible. 0 = no returns after an order completes.'))}</div>` : ''}`;
    host.prepend(box);
    if (isSuper) { try { const st = (await apiFetch('GET', '/admin/store/review')).settings; if (el('ar-min')) el('ar-min').value = st.storeMinReturnDays; } catch (x) {} }
  }
  window.storeAdminReturn = async function (id, decision) {
    const note = await confirmDialog(t(decision === 'refund' ? 'Refund the buyer for the returned goods? Add a note both sides will see.' : 'Refuse the return? The seller is paid. Add a note both sides will see.'), { confirmLabel: t(decision === 'refund' ? 'Refund' : 'Refuse'), requireTextInput: true });
    if (!note) return;
    try { await apiFetch('POST', `/admin/store/returns/${encodeURIComponent(id)}/decide`, { decision, note }); showToast(t('Decided')); const b = el('admin-returns'); if (b) b.remove(); drawAdminReturns(); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.storeAdminMinDays = async function () {
    try { await apiFetch('PUT', '/admin/store/settings', { storeMinReturnDays: Number(el('ar-min').value) }); showToast(t('Saved')); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  if (typeof loadAdminStores === 'function') { const b = loadAdminStores; loadAdminStores = async function () { const r = await b.apply(this, arguments); setTimeout(drawAdminReturns, 0); return r; }; }
})();
