// v139: the Market (the screens). The rules are on the server: src/market.js
// and src/routes/market.routes.js.
//
// - "Market" in the menu for customers and pros: one place to browse goods
//   from stores and items people are selling, search, filter by category,
//   and sort. Store goods open the store (as before); a person's item opens
//   its own page.
// - Buy with Trothen protection (shown first): pay through Trothen, money
//   held until you have it, collect it or have a driver bring it. Or
//   message the seller to meet in person and pay cash.
// - Sell: anyone with a verified ID lists their own item with photos.
// - My orders: everything you bought (stores and people), "I have my
//   goods", report a problem, rate the seller, and the date an order
//   completes by itself.
// - Sign-up and Settings: a pro chooses services, a store, or both.
(function () {
  const e = (s) => escapeHtml(s == null ? '' : String(s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const money = (n) => '$' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
  const localMoney = (lp) => (lp ? `${lp.symbol || ''}${Number(lp.amount).toLocaleString()} ${lp.code}` : '');
  const role = () => (AUTH && AUTH.user && AUTH.user.role) || null;
  const signedIn = () => !!(AUTH && AUTH.token && AUTH.user && ['customer', 'provider'].includes(AUTH.user.role));
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Market': 'Mercado', 'Browse': 'Explorar', 'Sell': 'Vender', 'My orders': 'Mis pedidos', 'Search the Market': 'Buscar en el Mercado',
      'All categories': 'Todas las categorías', 'Everything': 'Todo', 'Stores': 'Tiendas', 'From people': 'De personas', 'Newest': 'Más recientes',
      'Price: low to high': 'Precio: menor a mayor', 'Price: high to low': 'Precio: mayor a menor', 'Best rated sellers': 'Vendedores mejor calificados',
      'Store': 'Tienda', 'Verified': 'Verificado', 'Buy with Trothen protection': 'Comprar con protección de Trothen', 'Message the seller': 'Escribir al vendedor',
      'Report': 'Reportar', 'Sell an item': 'Vender un artículo', 'Nothing found. Try other words or another category.': 'No se encontró nada. Prueba otras palabras u otra categoría.',
      'Offer my services': 'Ofrecer mis servicios', 'Sell goods (a store)': 'Vender productos (una tienda)', 'Both: services and a store': 'Ambos: servicios y una tienda',
    });
  } catch (x) {}

  const M = { tab: 'browse', q: '', category: '', type: 'all', sort: 'newest', items: null, total: 0, cats: [], conds: {}, mine: null, currencies: [], earnings: null, selling: [], loading: false, seq: 0 };
  window.MARKET = M;

  // ── menu and section ────────────────────────────────────────────────
  function addNav(list, afterKey) {
    if (!Array.isArray(list) || list.some(i => i.key === 'market')) return;
    const at = list.findIndex(i => i.key === afterKey);
    list.splice(at >= 0 ? at + 1 : 1, 0, { key: 'market', label: 'Market', icon: '🛒' });
  }
  try { addNav(CUSTOMER_NAV_ITEMS, 'bookings'); } catch (x) {}
  try { addNav(PROVIDER_NAV_ITEMS, 'contracts'); } catch (x) {}
  const shell = () => `<div class="dash-header"><div><div class="dash-title">${e(t('Market'))}</div><div class="dash-sub">${e(t('Items from stores and people near you. Your payment is held until you receive your order.'))}</div></div></div>
    <div class="market-tabs" role="tablist" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
      ${[['browse', 'Browse'], ['sell', 'Sell'], ['orders', 'My orders']].map(([k, l]) => `<button type="button" role="tab" class="btn-sm ${M.tab === k ? 'btn-sm-primary' : 'btn-sm-outline'}" data-mtab="${k}" onclick="marketTab('${k}')">${e(t(l))}</button>`).join('')}
    </div>
    <div style="text-align:right;margin:-6px 0 10px;font-size:13px;"><a onclick="reportStolen()" style="color:var(--teal);cursor:pointer;font-weight:600;">🚨 ${e(t('Was something of yours stolen? Register it'))}</a></div>
    <div id="market-body"><div class="panel" style="color:var(--slate);">${e(t('Loading…'))}</div></div>`;
  try { CUSTOMER_SECTIONS.market = shell; } catch (x) {}
  try { PROVIDER_SECTIONS.market = shell; } catch (x) {}
  for (const fn of ['selectCustomerSection', 'selectProviderSection']) {
    if (typeof window[fn] !== 'function') continue;
    const base = window[fn];
    window[fn] = function (key) { const r = base.apply(this, arguments); if (key === 'market') setTimeout(drawTab, 0); return r; };
  }
  window.marketTab = function (k) { M.tab = k; document.querySelectorAll('[data-mtab]').forEach(b => { b.className = 'btn-sm ' + (b.dataset.mtab === k ? 'btn-sm-primary' : 'btn-sm-outline'); }); drawTab(); };
  window.openMarket = function (tab) {
    M.tab = tab || 'browse';
    if (role() === 'provider') selectProviderSection('market'); else if (role() === 'customer') selectCustomerSection('market');
  };
  function drawTab() {
    if (!document.getElementById('market-body')) return;
    if (M.tab === 'sell') return drawSell();
    if (M.tab === 'orders') return drawOrders();
    return drawBrowse();
  }

  // ── browse ──────────────────────────────────────────────────────────
  async function cats() {
    if (M.cats.length) return;
    try { const r = await apiFetch('GET', '/market/categories'); M.cats = r.categories; M.conds = r.conditions; } catch (x) {}
  }
  async function drawBrowse() {
    const body = document.getElementById('market-body'); if (!body) return;
    await cats();
    body.innerHTML = `<div class="panel" style="padding:12px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="search" class="form-input" id="mk-q" value="${e(M.q)}" placeholder="${e(t('Search the Market'))}" style="flex:1 1 220px;" onkeydown="if(event.key==='Enter')marketSearch()"/>
          <select class="form-input form-select" id="mk-cat" style="flex:1 1 150px;width:auto;min-width:0;" onchange="marketSearch()"><option value="">${e(t('All categories'))}</option>${M.cats.map(c => `<option ${M.category === c ? 'selected' : ''}>${e(c)}</option>`).join('')}</select>
          <select class="form-input form-select" id="mk-type" style="flex:1 1 120px;width:auto;min-width:0;" onchange="marketSearch()">${[['all', 'Everything'], ['stores', 'Stores'], ['people', 'From people']].map(([v, l]) => `<option value="${v}" ${M.type === v ? 'selected' : ''}>${e(t(l))}</option>`).join('')}</select>
          <select class="form-input form-select" id="mk-sort" style="flex:1 1 150px;width:auto;min-width:0;" onchange="marketSearch()">${[['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Best rated sellers']].map(([v, l]) => `<option value="${v}" ${M.sort === v ? 'selected' : ''}>${e(t(l))}</option>`).join('')}</select>
          <button type="button" class="btn-sm btn-sm-primary" onclick="marketSearch()">${e(t('Search'))}</button>
        </div>
      </div>
      <div id="mk-results" style="margin-top:12px;"><div style="color:var(--slate);">${e(t('Loading…'))}</div></div>`;
    await loadItems();
  }
  window.marketSearch = function () {
    M.q = (document.getElementById('mk-q') || {}).value || '';
    M.category = (document.getElementById('mk-cat') || {}).value || '';
    M.type = (document.getElementById('mk-type') || {}).value || 'all';
    M.sort = (document.getElementById('mk-sort') || {}).value || 'newest';
    loadItems();
  };
  async function loadItems() {
    const box = document.getElementById('mk-results'); if (!box) return;
    const seq = ++M.seq;
    const qs = new URLSearchParams({ q: M.q, category: M.category, type: M.type, sort: M.sort });
    try { const r = await apiFetch('GET', '/market/items?' + qs.toString()); if (seq !== M.seq) return; M.items = r.items; M.total = r.total; }
    catch (x) { box.innerHTML = `<div class="panel">${e(x.message || 'Could not load the Market')}</div>`; return; }
    box.innerHTML = M.items.length
      ? `<div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${M.total} ${e(t(M.total === 1 ? 'item' : 'items'))}</div><div class="mk-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;">${M.items.map(cardHTML).join('')}</div>`
      : `<div class="panel" style="color:var(--slate);">${e(t('Nothing found. Try other words or another category.'))}</div>`;
  }
  const stars = (r) => (r && r.rating ? `<span title="${e(r.ratingCount)} ratings" style="color:#B7791F;">★ ${Number(r.rating).toFixed(1)}</span>` : '');
  function cardHTML(it) {
    const click = it.kind === 'store' ? `openProStore(${jsArg(it.providerId)})` : `openListing(${jsArg(it.id)})`;
    const badge = it.kind === 'store' ? `<span class="badge badge-neutral" style="font-size:11px;">${e(t('Store'))}: ${e(it.storeName)}</span>` : (it.conditionLabel ? `<span class="badge badge-neutral" style="font-size:11px;">${e(t(it.conditionLabel))}</span>` : '');
    return `<div class="mk-card" data-kind="${it.kind}" data-id="${e(it.id)}" role="button" tabindex="0" onclick="${click}" onkeydown="if(event.key==='Enter'){${click}}" style="cursor:pointer;border:1px solid var(--border);border-radius:12px;background:var(--white,#fff);overflow:hidden;display:flex;flex-direction:column;">
      ${it.photo ? `<img src="${e(it.photo)}" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;background:#f2f4f7;"/>` : `<div style="width:100%;aspect-ratio:1;background:#f2f4f7;"></div>`}
      <div style="padding:9px 10px 11px;display:flex;flex-direction:column;gap:4px;flex:1;">
        <div style="font-weight:800;color:var(--navy);font-size:15.5px;">${money(it.price)}${it.localPrice ? ` <span style="font-weight:400;color:var(--slate);font-size:12px;">${e(localMoney(it.localPrice))}</span>` : ''}</div>
        <div style="font-size:14px;color:var(--text,#1b2533);line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${e(it.title)}</div>
        <div>${badge}</div>
        ${it.tradePrice ? `<div style="font-size:12.5px;color:#0f766e;font-weight:700;">${e(t('Trade price for pros'))}: ${money(it.tradePrice)}</div>` : ''}
        ${it.kind === 'store' && typeof cartAddFromMarket === 'function' ? `<button type="button" class="btn-sm ${it.hasOptions ? 'btn-sm-outline' : 'btn-sm-primary'} mk-cart-btn" style="margin-top:4px;" onkeydown="event.stopPropagation()" onclick="event.stopPropagation();${it.hasOptions ? `openProStore(${jsArg(it.providerId)})` : `cartAddFromMarket(${jsArg(it.providerId)},${jsArg(it.id)},this)`}">${e(t(it.hasOptions ? 'Choose options' : 'Add to cart'))}</button>` : ''}
        <div style="font-size:12px;color:var(--slate);margin-top:auto;">${e(it.city || '')}${it.seller ? ` · ${e(it.seller.name)}${it.seller.verified ? ' ✓' : ''} ${stars(it.seller)}${it.seller.isNew ? ` · <span style="color:#8a5a00;">${e(t('New seller'))}</span>` : ''}` : ''}</div>
      </div></div>`;
  }

  // ── one person's item ───────────────────────────────────────────────
  let CUR = null;
  window.openListing = async function (id) {
    v105Overlay('mk-listing', `<div class="modal-header"><button class="modal-close" onclick="v105Close('mk-listing')" aria-label="Close">✕</button><h3 id="mkl-title">${e(t('Loading…'))}</h3><p id="mkl-sub"></p></div>
      <div class="modal-body" id="mkl-body" style="overflow:auto;flex:1 1 auto;min-height:0;"></div><div class="modal-footer" id="mkl-foot"></div>`, 640);
    try { CUR = (await apiFetch('GET', '/market/listings/' + encodeURIComponent(id))).listing; }
    catch (x) { document.getElementById('mkl-body').innerHTML = `<p style="color:var(--slate);">${e(x.message)}</p>`; return; }
    const l = CUR, s = l.seller || {};
    document.getElementById('mkl-title').textContent = l.title;
    document.getElementById('mkl-sub').textContent = [l.category, l.conditionLabel && t(l.conditionLabel), l.city].filter(Boolean).join(' · ');
    document.getElementById('mkl-body').innerHTML = `
      ${l.photoUrls.length ? `<img id="mkl-main" src="${e(l.photoUrls[0])}" alt="" style="width:100%;max-height:380px;object-fit:contain;background:#f2f4f7;border-radius:10px;"/>
        ${l.photoUrls.length > 1 ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">${l.photoUrls.map(u => `<img src="${e(u)}" alt="" onclick="document.getElementById('mkl-main').src=this.src" style="width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border);"/>`).join('')}</div>` : ''}` : ''}
      <div style="font-size:24px;font-weight:800;color:var(--navy);margin:12px 0 2px;">${money(l.price)}${l.localPrice ? ` <span style="font-size:14px;font-weight:400;color:var(--slate);">${e(localMoney(l.localPrice))}</span>` : ''}</div>
      ${l.status !== 'live' ? `<span class="badge badge-pending">${e(l.status === 'reserved' ? t('Someone is buying this') : l.status === 'sold' ? t('Sold') : l.status)}</span>` : ''}
      ${l.description ? `<p style="white-space:pre-wrap;line-height:1.6;margin:10px 0;">${e(l.description)}</p>` : ''}
      <div style="display:flex;gap:10px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:10px;margin:12px 0;">
        ${typeof avatarHTML === 'function' ? avatarHTML({ name: s.name, initials: s.initials || String(s.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), color: s.color || '#1D5FA8', profilePhotoUrl: s.profilePhotoUrl }, 40) : ''}
        <div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--navy);">${e(s.name)} ${s.verified ? `<span class="badge badge-success" style="font-size:11px;">${e(t('ID verified'))}</span>` : ''}</div>
          <div style="font-size:12.5px;color:var(--slate);">${e(t(s.sellerType === 'business' ? 'Business seller' : 'Private seller'))}${s.businessName && s.sellerType === 'business' ? ` (${e(s.businessName)})` : ''} · ${s.rating ? `★ ${Number(s.rating).toFixed(1)} (${s.ratingCount}) · ` : `${e(t('No ratings yet'))} · `}${s.sales || 0} ${e(t(s.sales === 1 ? 'sale' : 'sales'))} · ${e(t('On Trothen since'))} ${e(s.since)}${s.isNew ? ` · <span style="color:#8a5a00;font-weight:600;">${e(t('New seller'))}</span>` : ''}</div>
          ${s.sellerType === 'private' ? `<div style="font-size:12px;color:var(--slate);margin-top:2px;">${e(t('Private sellers are not businesses, so shop consumer rights may not apply. Trothen protection still covers you when you pay through Trothen.'))}</div>` : ''}</div>
      </div>
      ${l.serialLast4 || l.proofGiven || l.ownerDeclared ? `<div style="font-size:13px;line-height:1.6;border-left:3px solid #2E8C6F;padding-left:8px;margin-bottom:8px;">${l.ownerDeclared ? `✅ ${e(t('The seller declares they own this item'))}<br>` : ''}${l.serialLast4 ? `🔢 ${e(t(l.category === 'Phones & Tablets' ? 'IMEI ending' : l.category === 'Vehicles & Parts' ? 'Chassis or engine number ending' : 'Serial number ending'))} <strong>${e(l.serialLast4)}</strong>. ${e(t(l.category === 'Phones & Tablets' ? 'Before you pay, dial *#06# on the phone and check it matches.' : 'Before you pay, check it matches the number on the item.'))} ${e(t('It is checked against items reported stolen.'))}<br>` : ''}${l.proofGiven ? `🧾 ${e(t('Proof of ownership given to Trothen'))}` : ''}</div>` : ''}
      <div style="font-size:13.5px;color:var(--slate);line-height:1.6;">📍 ${e(l.pickupPlace || l.city)}${l.protected ? `<br>🛡️ ${e(t('Buy through Trothen: your money is held until you have the item. If it isn\'t as described, report a problem and the Trothen team decides.'))}` : ''}${l.cash ? `<br>🤝 ${e(t('Meeting in person? Meet somewhere public in daylight, check the item before you pay, and never send money first.'))}` : ''}</div>`;
    const foot = document.getElementById('mkl-foot');
    if (l.mine) { foot.innerHTML = `<button class="btn-sm btn-sm-outline" onclick="v105Close('mk-listing');openMarket('sell')">${e(t('Manage in Sell'))}</button>`; return; }
    const canBuy = l.status === 'live' && l.protected;
    foot.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">
      ${canBuy ? `<button class="confirm-btn" id="mkl-buy" style="flex:1 1 240px;" onclick="buyListing()">🛡️ ${e(t('Buy with Trothen protection'))} · ${money(l.price + l.protectionFee)}</button>` : ''}
      ${l.status === 'live' ? `<button class="btn-sm btn-sm-outline" style="flex:1 1 160px;" onclick="messageSeller()">💬 ${e(t('Message the seller'))}</button>` : ''}
      <button class="btn-sm btn-sm-ghost" onclick="reportListing()">${e(t('Report'))}</button></div>
      ${canBuy ? `<div style="font-size:12.5px;color:var(--slate);margin-top:6px;">${money(l.price)} + ${money(l.protectionFee)} ${e(t('buyer protection'))}. ${e(t('The seller gets their full price.'))}</div>` : ''}`;
  };
  function needSignIn() {
    if (signedIn()) return false;
    showToast(t('Sign in or create an account to buy and sell in the Market.'));
    if (!AUTH.token) { v105Close('mk-listing'); showAuth('login'); }
    return true;
  }
  window.messageSeller = async function () {
    if (!CUR || needSignIn()) return;
    const sellerId = CUR.seller.id, title = CUR.title;
    v105Close('mk-listing');
    if (role() === 'provider') selectProviderSection('messages'); else selectCustomerSection('messages');
    setTimeout(() => {
      try { selectMessageContact(sellerId); } catch (x) {}
      const i = document.getElementById('msg-input'); if (i) { i.value = `Hi, is "${title}" still for sale?`; i.focus(); }
    }, 500);
  };
  window.reportListing = async function () {
    if (!CUR || needSignIn()) return;
    const p = confirmDialog('', { confirmLabel: t('Report') });
    const m = document.getElementById('confirm-dialog-message');
    if (m) m.innerHTML = `<div style="text-align:left;"><div style="font-weight:700;color:var(--navy);margin-bottom:6px;">${e(t('Report this listing'))}</div><textarea class="form-input" id="mk-report" rows="3" maxlength="300" placeholder="${e(t('What is wrong? For example: fake, stolen, not allowed, misleading.'))}"></textarea></div>`;
    let why = ''; const btn = document.getElementById('confirm-dialog-confirm-btn'); btn.addEventListener('click', () => { why = (document.getElementById('mk-report') || {}).value || ''; }, { once: true, capture: true });
    if (!(await p)) return;
    try { await apiFetch('POST', `/market/listings/${encodeURIComponent(CUR.id)}/report`, { reason: why }); showToast(t('Thank you. The Trothen team will look at it.')); } catch (x) { showToast(x.message); }
  };

  // ── buying a person's item with protection ──────────────────────────
  const B = { method: 'pickup', pin: null, landmark: '', drivers: null, driverId: null, loading: false, busy: false, note: '' };
  window.buyListing = function () {
    if (!CUR || needSignIn()) return;
    Object.assign(B, { method: 'pickup', pin: null, landmark: '', drivers: null, driverId: null, loading: false, busy: false, note: '' });
    v105Close('mk-listing');
    v105Overlay('mk-buy', `<div class="modal-header"><button class="modal-close" onclick="v105Close('mk-buy')" aria-label="Close">✕</button><h3>${e(t('Buy'))}: ${e(CUR.title)}</h3><p>${e(t('Pay now. Your money is held until you have the item.'))}</p></div>
      <div class="modal-body" id="mkb-body" style="overflow:auto;flex:1 1 auto;min-height:0;"></div><div class="modal-footer" id="mkb-foot"></div>`, 560);
    drawBuy();
  };
  function drawBuy() {
    const body = document.getElementById('mkb-body'), foot = document.getElementById('mkb-foot'); if (!body || !CUR) return;
    const dr = (B.drivers || []).find(d => d.id === B.driverId) || null;
    const pct = B.feePercent || 0;
    const driverFee = B.method === 'driver' && dr ? dr.price : 0;
    const driverShare = Math.round(driverFee * pct) / 100;
    const total = CUR.price + CUR.protectionFee + driverFee + driverShare;
    const card = (k, title, sub) => `<label style="display:flex;gap:10px;align-items:flex-start;border:2px solid ${B.method === k ? 'var(--teal)' : 'var(--border)'};border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;"><input type="radio" name="mkb-m" value="${k}" ${B.method === k ? 'checked' : ''} onchange="mkbMethod('${k}')" style="margin-top:3px;"/><span><strong style="color:var(--navy);">${e(t(title))}</strong><br><span style="font-size:13px;color:var(--slate);">${e(sub)}</span></span></label>`;
    body.innerHTML = `${card('pickup', 'I collect it', `${t('From')} ${CUR.pickupPlace || CUR.city}. ${t('Agree a time with the seller in Messages.')}`)}
      ${CUR.driver ? card('driver', 'A pick-and-drop driver brings it', t('Choose a driver and approve their price.')) : ''}
      ${B.method === 'driver' ? `<div class="form-group" style="margin-top:8px;"><label class="form-label" for="mkb-landmark">${e(t('Where should it be brought?'))}</label><input class="form-input" id="mkb-landmark" maxlength="200" value="${e(B.landmark)}" oninput="MARKET_BUY.landmark=this.value" placeholder="${e(t('A landmark or address'))}"/></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13.5px;margin-bottom:8px;">${B.pin ? `📍 ${e(t('Pinned'))}` : e(t('Add a pin so the driver can find you.'))} <button type="button" class="btn-sm btn-sm-outline" onclick="mkbPin()">📍 ${e(t(B.pin ? 'Pin again' : 'Use where I am now'))}</button> <button type="button" class="btn-sm btn-sm-outline" onclick="mkbDrivers()">${e(t('Find drivers'))}</button></div>
        ${B.loading ? `<p style="color:var(--slate);">${e(t('Finding drivers…'))}</p>` : B.drivers ? (B.drivers.length ? B.drivers.map(d => `<label style="display:flex;gap:10px;align-items:center;border:2px solid ${B.driverId === d.id ? 'var(--teal)' : 'var(--border)'};border-radius:10px;padding:8px 10px;margin-bottom:6px;cursor:pointer;"><input type="radio" name="mkb-d" ${B.driverId === d.id ? 'checked' : ''} onchange="MARKET_BUY.driverId=${jsArg(d.id)};mkbDraw()"/><span style="flex:1;"><strong>${e(d.name)}</strong> <span style="font-size:12.5px;color:var(--slate);">${e(d.vehicle || '')}${d.rating ? ` · ★ ${d.rating}` : ''}</span></span><strong>${money(d.price)}</strong></label>`).join('') : `<p style="color:#B4472E;font-size:13.5px;">${e(t('No drivers available right now. You can collect it instead.'))}</p>`) : ''}` : ''}
      <div class="form-group" style="margin-top:8px;"><label class="form-label" for="mkb-note">${e(t('Note to the seller (optional)'))}</label><input class="form-input" id="mkb-note" maxlength="300" value="${e(B.note)}" oninput="MARKET_BUY.note=this.value"/></div>
      <div class="booking-summary" style="margin-top:10px;">
        <div class="summary-row"><span>${e(CUR.title)}</span><span>${money(CUR.price)}</span></div>
        <div class="summary-row"><span>${e(t('Buyer protection'))}</span><span>${money(CUR.protectionFee)}</span></div>
        ${driverFee ? `<div class="summary-row"><span>${e(t('Driver'))} (${e(dr.name)})</span><span>${money(driverFee)}</span></div>${driverShare ? `<div class="summary-row"><span>${e(t('Trothen delivery fee'))}</span><span>${money(driverShare)}</span></div>` : ''}` : ''}
        <div class="summary-row total"><span>${e(t('Total'))}</span><span>${money(total)}</span></div>
      </div>
      <div style="font-size:12.5px;color:var(--slate);margin-top:8px;line-height:1.5;">${e(t('Your money is held by Trothen. It goes to the seller when you press "I have my goods", or by itself a few days after you have it if you report no problem. If the item is not as described, report a problem from My orders.'))}</div>`;
    foot.innerHTML = `<button class="confirm-btn" id="mkb-pay" style="width:100%;" ${B.busy || (B.method === 'driver' && !dr) ? 'disabled' : ''} onclick="mkbPay()">${e(t(B.busy ? 'Paying…' : 'Pay'))} ${money(total)}</button>`;
  }
  window.MARKET_BUY = B; window.mkbDraw = drawBuy;
  window.mkbMethod = function (m) { B.method = m; drawBuy(); if (m === 'driver' && !B.drivers) mkbDrivers(); };
  window.mkbPin = function () {
    if (!navigator.geolocation) return showToast(t('This device can\'t share its location.'));
    navigator.geolocation.getCurrentPosition((p) => { B.pin = { latitude: p.coords.latitude, longitude: p.coords.longitude }; B.drivers = null; drawBuy(); mkbDrivers(); }, () => showToast(t('Location was not shared. Type a landmark instead.')), { enableHighAccuracy: true, timeout: 15000 });
  };
  window.mkbDrivers = async function () {
    B.loading = true; drawBuy();
    const qs = B.pin ? `?latitude=${B.pin.latitude}&longitude=${B.pin.longitude}` : '';
    try { const r = await apiFetch('GET', `/market/listings/${encodeURIComponent(CUR.id)}/drivers${qs}`); B.drivers = r.drivers || []; B.feePercent = r.feePercent || 0; if (B.drivers[0] && !B.driverId) B.driverId = B.drivers[0].id; }
    catch (x) { B.drivers = []; showToast(x.message); }
    B.loading = false; drawBuy();
  };
  window.mkbPay = async function () {
    if (B.busy) return;
    const dr = (B.drivers || []).find(d => d.id === B.driverId) || null;
    const body = { deliveryMethod: B.method, expectedPrice: CUR.price, note: B.note || undefined };
    if (B.method === 'driver') Object.assign(body, { driverId: dr && dr.id, driverPrice: dr && dr.price, landmark: B.landmark || undefined, address: B.landmark || undefined, ...(B.pin ? { jobLocation: B.pin } : {}) });
    B.busy = true; drawBuy();
    try {
      const r = await apiFetch('POST', `/market/listings/${encodeURIComponent(CUR.id)}/buy`, body);
      v105Close('mk-buy');
      showToast(r && r.payment ? t('Reserved for you. Pay to confirm it.') : t('Bought. Your money is held until you have the item.')); // v148
      openMarket('orders');
    } catch (x) { B.busy = false; drawBuy(); showToast(x.message || t('Could not complete the purchase')); }
  };

  // ── sell ────────────────────────────────────────────────────────────
  async function drawSell() {
    const body = document.getElementById('market-body'); if (!body) return;
    await cats();
    let data, orders;
    try { [data, orders] = await Promise.all([apiFetch('GET', '/market/listings/mine'), apiFetch('GET', '/store/orders/mine')]); }
    catch (x) { body.innerHTML = `<div class="panel">${e(x.message)}</div>`; return; }
    M.mine = data.listings; M.currencies = data.currencies;
    M.selling = (orders.selling || []).filter(o => o.listing);
    let earn = null; try { earn = await apiFetch('GET', '/market/earnings'); } catch (x) {}
    M.earnings = earn;
    const verified = AUTH.user && AUTH.user.verified;
    const statusBadge = (s) => ({ live: '<span class="badge badge-success">On sale</span>', reserved: '<span class="badge badge-pending">Being bought</span>', sold: '<span class="badge badge-neutral">Sold</span>', hidden: '<span class="badge badge-neutral">Paused</span>', expired: '<span class="badge badge-neutral">Ended</span>', removed: '<span class="badge badge-danger">Taken down</span>', review: '<span class="badge badge-pending">Being checked</span>' }[s] || e(s));
    const u = AUTH.user || {};
    body.innerHTML = `
      ${!verified ? `<div class="panel" style="border-left:4px solid #f59e0b;">${e(t('To sell in the Market, verify your identity first. Buyers only see sellers Trothen has checked.'))} <button class="btn-sm btn-sm-outline" onclick="${role() === 'provider' ? "selectProviderSection('verification')" : "selectCustomerSection('verification')"}">${e(t('Verify my ID'))}</button></div>` : ''}
      <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="panel-title" style="margin:0;">${e(t('Your items for sale'))}</div><div style="font-size:13px;color:var(--slate);">${e(t('Up to'))} ${data.limit} ${e(t('at once. Each listing runs 60 days and can be renewed.'))}</div></div>
        <button class="btn-sm btn-sm-primary" ${verified ? '' : 'disabled'} onclick="editListing()">+ ${e(t('Sell an item'))}</button></div>
        ${M.mine.length ? `<div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">${M.mine.map(l => `<div class="mk-mine" data-id="${e(l.id)}" style="display:flex;gap:10px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px;">
          ${l.photoUrls[0] ? `<img src="${e(l.photoUrls[0])}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;"/>` : ''}
          <div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--navy);overflow-wrap:anywhere;">${e(l.title)}</div><div style="font-size:13px;color:var(--slate);">${money(l.price)}${l.localPrice ? ` (${e(localMoney(l.localPrice))})` : ''} · ${statusBadge(l.status)} · ${l.views || 0} ${e(t('views'))}${l.reports ? ` · <span style="color:#B4472E;">${l.reports} ${e(t('reports'))}</span>` : ''}${l.removedReason ? `<br><span style="color:#B4472E;">${e(l.removedReason)}</span>` : ''}</div></div>
          <div class="row-actions" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            ${['live', 'hidden', 'expired'].includes(l.status) ? `<button class="btn-sm btn-sm-outline" onclick="editListing(${jsArg(l.id)})">${e(t('Edit'))}</button>` : ''}
            ${l.status === 'live' ? `<button class="btn-sm btn-sm-ghost" onclick="listingStatus(${jsArg(l.id)},'hidden')">${e(t('Pause'))}</button><button class="btn-sm btn-sm-ghost" onclick="listingStatus(${jsArg(l.id)},'sold')">${e(t('Mark sold'))}</button>` : ''}
            ${['hidden', 'expired'].includes(l.status) ? `<button class="btn-sm btn-sm-primary" onclick="listingStatus(${jsArg(l.id)},'live')">${e(t(l.status === 'expired' ? 'Renew' : 'Put on sale'))}</button>` : ''}
            ${l.status !== 'reserved' ? `<button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="deleteListing(${jsArg(l.id)})">${e(t('Delete'))}</button>` : ''}
          </div></div>`).join('')}</div>` : `<p style="color:var(--slate);margin:12px 0 0;">${e(t('Nothing for sale yet.'))}</p>`}
      </div>
      <div class="panel"><div class="panel-title">${e(t('Sold through Trothen'))}</div>
        ${M.selling.length ? M.selling.map(o => `<div class="mk-sale" data-order="${e(o.id)}" style="border-top:1px solid var(--border);padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;"><strong style="color:var(--navy);">${e(o.listing.title || '')}</strong> · ${money(o.goodsTotal)} · #${e(o.number)}<div style="font-size:13px;color:var(--slate);">${e(o.customer ? o.customer.name : '')} · ${e(o.deliveryMethod === 'driver' ? t('a driver collects it') : t('collects from you'))} · ${typeof orderStatusHTML === 'function' ? orderStatusHTML(o) : e(o.status)}${o.autoCompleteAt ? ` · ${e(t('completes by itself'))} ${e(new Date(o.autoCompleteAt).toLocaleDateString())}` : ''}</div></div>
          ${o.status === 'active' && o.deliveryMethod !== 'driver' && !o.handedOverAt ? `<button class="btn-sm btn-sm-primary" onclick="handedOver(${jsArg(o.id)})">${e(t('They have it'))}</button>` : ''}
        </div>`).join('') : `<p style="color:var(--slate);margin:0;">${e(t('Nothing sold through Trothen yet.'))}</p>`}
      </div>
      ${earn ? `<div class="panel" id="mk-earnings"><div class="panel-title">${e(t('Your Market money'))}</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:14px;"><div>${e(t('Ready to cash out'))}<div style="font-size:20px;font-weight:800;color:var(--navy);">${money(earn.net)}</div></div><div>${e(t('Held until buyers have their items'))}<div style="font-size:20px;font-weight:800;color:var(--slate);">${money(earn.held)}</div></div>${earn.reserved && earn.reserved.amount > 0 ? `<div>${e(t('New-seller safety period'))}<div style="font-size:20px;font-weight:800;color:#8a5a00;">${money(earn.reserved.amount)}</div><div style="font-size:12px;color:var(--slate);">${e(t('payable from'))} ${e(new Date(earn.reserved.until).toLocaleDateString())}</div></div>` : ''}</div>
        ${role() === 'provider' ? `<p style="font-size:13px;color:var(--slate);margin:10px 0 0;">${e(t('Market money is paid out with your other earnings.'))} <a href="#" onclick="event.preventDefault();selectProviderSection('earnings')">${e(t('Earnings & Payouts'))}</a></p>` : `
        <div style="margin-top:12px;"><div style="font-weight:700;color:var(--navy);margin-bottom:6px;">${e(t('Where your money is paid'))}</div><div id="mk-payout"></div>
          <button class="btn-sm btn-sm-primary" style="margin-top:10px;" ${earn.net > 0 ? '' : 'disabled'} onclick="cashOutMarket()">${e(t('Cash out'))}</button></div>`}
      </div>` : ''}
      ${u.role === 'provider' ? `<div class="panel" id="mk-store-cats"><div class="panel-title">${e(t('Your store in the Market'))}</div>
        <div style="font-size:13.5px;color:var(--slate);margin-bottom:8px;">${e(t('Your approved store goods show in the Market automatically. Choose up to three aisles they belong in.'))} <a href="#" onclick="event.preventDefault();selectProviderSection('store')">${e(t('My Store'))}</a></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${M.cats.map(c => `<label style="display:inline-flex;gap:4px;align-items:center;font-size:13px;border:1px solid var(--border);border-radius:8px;padding:4px 8px;"><input type="checkbox" class="mk-sc" value="${e(c)}" ${((u.store && u.store.marketCategories) || []).includes(c) ? 'checked' : ''}/>${e(c)}</label>`).join('')}</div>
        <button class="btn-sm btn-sm-outline" style="margin-top:8px;" onclick="saveStoreCats()">${e(t('Save'))}</button>
        <div style="border-top:1px solid var(--border);margin:14px 0 10px;"></div>
        <div style="font-weight:700;color:var(--navy);">${e(t('Trade prices for pros'))}</div>
        <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(t('A lower price only verified pros see and pay, like a trade counter. Leave blank for no trade price.'))}</div>
        <div id="mk-trade"><span style="color:var(--slate);font-size:13px;">${e(t('Loading…'))}</span></div></div>` : ''}`;
    if (u.role === 'provider') drawTrade();
    else if (earn && typeof payoutFormMount === 'function') payoutFormMount('mk-payout', 'mkp'); // v141: Mobile Money or bank, by country
  }
  async function drawTrade() {
    const box = document.getElementById('mk-trade'); if (!box) return;
    let goods = []; try { goods = (await apiFetch('GET', '/market/my-goods')).goods; } catch (x) { box.textContent = x.message; return; }
    if (!goods.length) { box.innerHTML = `<span style="color:var(--slate);font-size:13px;">${e(t('No goods in your store yet.'))}</span>`; return; }
    box.innerHTML = `${goods.map(g => `<div style="display:flex;gap:8px;align-items:center;padding:4px 0;"><span style="flex:1;min-width:0;font-size:14px;">${e(g.name)} <span style="color:var(--slate);">(${money(g.price)})</span></span><input class="form-input mk-tp" data-id="${e(g.id)}" type="number" min="0" step="0.01" placeholder="${e(t('Trade $'))}" value="${g.tradePrice == null ? '' : e(g.tradePrice)}" style="width:110px;"/></div>`).join('')}
      <button class="btn-sm btn-sm-outline" style="margin-top:6px;" onclick="saveTradePrices()">${e(t('Save trade prices'))}</button>`;
  }
  window.saveTradePrices = async function () {
    const prices = {}; document.querySelectorAll('.mk-tp').forEach(i => { prices[i.dataset.id] = i.value === '' ? null : Number(i.value); });
    try { await apiFetch('PUT', '/market/trade-prices', { prices }); showToast(t('Saved')); } catch (x) { showToast(x.message); }
  };
  window.saveStoreCats = async function () {
    const categories = [...document.querySelectorAll('.mk-sc:checked')].map(x => x.value);
    try { const r = await apiFetch('PUT', '/market/store-categories', { categories }); if (AUTH.user.store) AUTH.user.store.marketCategories = r.categories; showToast(t('Saved')); } catch (x) { showToast(x.message); }
  };
  window.cashOutMarket = async function () {
    // v141: the payout details are saved in the box above (Mobile Money or bank)
    if (typeof payoutReady === 'function' && !payoutReady()) return showToast(t('Add where your money should be paid first, then press Save.'));
    try {
      await apiFetch('POST', '/payouts/request', {});
      showToast(t('Cash-out requested. You will be notified when it is sent.'));
      drawSell();
    } catch (x) { showToast(x.message); }
  };
  window.handedOver = async function (id) {
    if (!(await confirmDialog(t('Confirm the buyer has the item. They then have a few days to report a problem; after that you are paid by itself.'), { confirmLabel: t('They have it') }))) return;
    try { await apiFetch('POST', `/store/orders/${encodeURIComponent(id)}/handed-over`); showToast(t('Thank you. The buyer has been told.')); drawSell(); } catch (x) { showToast(x.message); }
  };
  window.listingStatus = async function (id, status) {
    try { await apiFetch('POST', `/market/listings/${encodeURIComponent(id)}/status`, { status }); drawSell(); } catch (x) { showToast(x.message); }
  };
  window.deleteListing = async function (id) {
    if (!(await confirmDialog(t('Delete this listing?'), { confirmLabel: t('Delete') }))) return;
    try { await apiFetch('DELETE', `/market/listings/${encodeURIComponent(id)}`); drawSell(); } catch (x) { showToast(x.message); }
  };

  // The sell form.
  const F = { id: null, photos: [], pin: null, busy: false };
  window.MARKET_FORM = F;
  window.editListing = async function (id) {
    await cats();
    const l = id ? (M.mine || []).find(x => x.id === id) : null;
    Object.assign(F, { id: l ? l.id : null, photos: l ? [...l.photoUrls] : [], pin: l ? l.pickupLocation || null : null, busy: false });
    const cur = M.currencies && M.currencies.length ? M.currencies : [{ code: 'USD', symbol: '$' }];
    v105Overlay('mk-form', `<div class="modal-header"><button class="modal-close" onclick="v105Close('mk-form')" aria-label="Close">✕</button><h3>${e(t(l ? 'Edit your item' : 'Sell an item'))}</h3><p>${e(t('Clear photos and an honest description sell faster.'))}</p></div>
      <div class="modal-body" style="overflow:auto;flex:1 1 auto;min-height:0;">
        <div class="form-group"><label class="form-label" for="mkf-title">${e(t('Title'))}</label><input class="form-input" id="mkf-title" maxlength="80" value="${e(l ? l.title : '')}" placeholder="${e(t('e.g. Bosch drill, 650W, with case'))}"/></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <div class="form-group" style="flex:1 1 200px;"><label class="form-label" for="mkf-cat">${e(t('Category'))}</label><select class="form-input form-select" id="mkf-cat"><option value="">${e(t('Choose…'))}</option>${M.cats.map(c => `<option ${l && l.category === c ? 'selected' : ''}>${e(c)}</option>`).join('')}</select></div>
          <div class="form-group" style="flex:1 1 140px;"><label class="form-label" for="mkf-cond">${e(t('Condition'))}</label><select class="form-input form-select" id="mkf-cond">${Object.entries(M.conds).map(([k, v]) => `<option value="${k}" ${l && l.condition === k ? 'selected' : ''}>${e(t(v))}</option>`).join('')}</select></div>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:1;"><label class="form-label" for="mkf-price">${e(t('Price'))}</label><input class="form-input" id="mkf-price" type="number" min="0" step="0.01" inputmode="decimal" value="${l ? e(l.price_raw) : ''}"/></div>
          <div class="form-group" style="flex:0 0 110px;"><label class="form-label" for="mkf-cur">${e(t('Currency'))}</label><select class="form-input form-select" id="mkf-cur">${cur.map(c => `<option value="${e(c.code)}" ${(l ? l.currency === c.code : c.code === ((cur.find(x => x.code !== 'USD') || cur[0]).code)) ? 'selected' : ''}>${e(c.code)}</option>`).join('')}</select></div>
        </div>
        <div class="form-group"><label class="form-label" for="mkf-desc">${e(t('Description'))}</label><textarea class="form-input" id="mkf-desc" rows="4" maxlength="1000">${e(l ? l.description : '')}</textarea></div>
        <div id="mkf-own" style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px;">
          <div class="form-group" id="mkf-serial-row"><label class="form-label" for="mkf-serial" id="mkf-serial-label">${e(t('IMEI, serial or chassis number'))}</label><input class="form-input" id="mkf-serial" maxlength="40" autocomplete="off" placeholder="${l && l.serialLast4 ? e(t('Saved, ending')) + ' ' + e(l.serialLast4) : ''}"/><div id="mkf-serial-help" style="font-size:12.5px;color:var(--muted);margin-top:4px;"></div></div>
          <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:8px;" id="mkf-part-row"><input type="checkbox" id="mkf-part" ${l && l.isPart ? 'checked' : ''}/> ${e(t('This is a part or an accessory (no number needed)'))}</label>
          <div class="form-group" id="mkf-proof-row"><label class="form-label">${e(t('Proof it is yours'))} <small style="font-weight:400;color:var(--slate);" id="mkf-proof-need"></small></label><div id="mkf-proof-line" style="font-size:13px;"></div><input type="file" id="mkf-proof-file" accept="image/jpeg,image/png,image/webp" style="margin-top:6px;" onchange="mkfProof(this)"/><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${e(t('The receipt, the box showing the same number, or the registration papers. Only the Trothen team sees it; buyers see "Proof of ownership given".'))}</div></div>
          <label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;"><input type="checkbox" id="mkf-owns" style="margin-top:3px;"/> <span>${e(t('I own this item and have the right to sell it. It is not stolen, borrowed, or still being paid for.'))} <span style="color:var(--slate);font-size:12.5px;">${e(t('Selling stolen goods is a crime. Sellers are ID-checked and every sale is recorded, so the team can help the police.'))}</span></span></label>
        </div>
        <div class="form-group"><label class="form-label">${e(t('Photos (up to 6)'))}</label><div id="mkf-photos" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
          <input type="file" id="mkf-file" accept="image/jpeg,image/png,image/webp" multiple style="margin-top:6px;" onchange="mkfUpload(this)"/></div>
        <div class="form-group"><label class="form-label" for="mkf-place">${e(t('Where to collect it'))}</label><input class="form-input" id="mkf-place" maxlength="120" value="${e(l ? l.pickupPlace : '')}" placeholder="${e(t('An area or landmark, not your home address'))}"/>
          <div style="font-size:13px;margin-top:6px;" id="mkf-pin-line"></div></div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:14px;">
          <label><input type="checkbox" id="mkf-prot" ${!l || l.protected ? 'checked' : ''}/> ${e(t('Let buyers pay through Trothen (recommended): the money is held until they have it, then paid to you.'))}</label>
          <label><input type="checkbox" id="mkf-drv" ${!l || l.driver ? 'checked' : ''}/> ${e(t('A pick-and-drop driver may collect it from me'))}</label>
          <label><input type="checkbox" id="mkf-cash" ${!l || l.cash ? 'checked' : ''}/> ${e(t('Buyers may also meet me in person and pay cash'))}</label>
        </div>
      </div><div class="modal-footer"><button class="confirm-btn" id="mkf-save" style="width:100%;" onclick="saveListing()">${e(t(l ? 'Save changes' : 'Put it on sale'))}</button></div>`, 600);
    F.proof = l ? l.proofUrl || null : null;
    drawFormPhotos(); drawPin(); drawOwn();
    ['mkf-cat', 'mkf-part', 'mkf-price', 'mkf-cur'].forEach(id => { const x = document.getElementById(id); if (x) x.addEventListener(id === 'mkf-price' ? 'input' : 'change', drawOwn); });
  };
  // v143: what the form asks for to keep stolen goods out (src/stolen-goods.js)
  const SERIAL_WORDS = { 'Phones & Tablets': 'IMEI (dial *#06# on the phone to see it)', 'Computers & Electronics': 'Serial number (on a sticker underneath, or in the settings)', 'Vehicles & Parts': 'Chassis (VIN) or engine number' };
  const SERIAL_OPT = { Appliances: 'Serial number (optional)', 'Tools & Equipment': 'Serial number (optional, for generators and power tools)' };
  function drawOwn() {
    const cat = (document.getElementById('mkf-cat') || {}).value || '';
    const part = (document.getElementById('mkf-part') || {}).checked;
    const need = !!SERIAL_WORDS[cat];
    const row = document.getElementById('mkf-serial-row'); if (!row) return;
    row.style.display = need || SERIAL_OPT[cat] ? (need && part ? 'none' : '') : 'none';
    document.getElementById('mkf-part-row').style.display = need ? '' : 'none';
    document.getElementById('mkf-serial-label').textContent = t(SERIAL_WORDS[cat] || SERIAL_OPT[cat] || 'Serial number');
    document.getElementById('mkf-serial-help').textContent = need ? t('Needed to keep stolen goods off Trothen. Buyers only see the last 4.') : t('Helps buyers trust the item. Buyers only see the last 4.');
    const cur = (M.currencies || []).find(c => c.code === (document.getElementById('mkf-cur') || {}).value) || { rate: 1 };
    const usd = Number((document.getElementById('mkf-price') || {}).value || 0) / (cur.rate || 1);
    const proofNeeded = need && !part && usd >= 200;
    document.getElementById('mkf-proof-row').style.display = need && !part ? '' : 'none';
    document.getElementById('mkf-proof-need').textContent = t(proofNeeded ? 'needed for $200 or more' : 'optional');
    document.getElementById('mkf-proof-line').innerHTML = F.proof ? `🧾 ${e(t('Added'))} <button type="button" class="btn-sm btn-sm-ghost" onclick="MARKET_FORM.proof=null;mkfOwn()">${e(t('Remove'))}</button>` : '';
  }
  window.mkfOwn = drawOwn;
  window.mkfProof = async function (input) {
    const f = (input.files || [])[0]; if (!f) return;
    const fd = new FormData(); fd.append('photo', f);
    try { const res = await fetch(API_BASE + '/market/photo', { method: 'POST', headers: { Authorization: 'Bearer ' + AUTH.token }, body: fd }); const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.error || 'Upload failed'); F.proof = d.url; drawOwn(); }
    catch (x) { showToast(x.message); }
    input.value = '';
  };
  window.reportStolen = function () {
    if (needSignIn()) return;
    v105Overlay('mk-stolen', `<div class="modal-header"><button class="modal-close" onclick="v105Close('mk-stolen')" aria-label="Close">✕</button><h3>${e(t('Register a stolen item'))}</h3><p>${e(t('If anyone tries to sell it on Trothen, the listing is held and the team contacts you.'))}</p></div>
      <div class="modal-body"><div class="form-group"><label class="form-label" for="st-what">${e(t('What was stolen'))}</label><input class="form-input" id="st-what" maxlength="120" placeholder="${e(t('e.g. Tecno Spark 10, blue'))}"/></div>
      <div class="form-group"><label class="form-label" for="st-serial">${e(t('IMEI, serial or chassis number'))}</label><input class="form-input" id="st-serial" maxlength="40" autocomplete="off"/><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${e(t('A phone\'s IMEI is on its box and on your phone company\'s records.'))}</div></div>
      <div class="form-group"><label class="form-label" for="st-police">${e(t('Police report number'))} <small style="font-weight:400;color:var(--slate);">${e(t('optional'))}</small></label><input class="form-input" id="st-police" maxlength="60"/></div></div>
      <div class="modal-footer"><button class="confirm-btn" onclick="sendStolen()">${e(t('Register it'))}</button></div>`, 480);
  };
  window.sendStolen = async function () {
    try { const r = await apiFetch('POST', '/market/stolen', { what: document.getElementById('st-what').value, serial: document.getElementById('st-serial').value, policeReport: document.getElementById('st-police').value }); v105Close('mk-stolen'); showToast(r.message); }
    catch (x) { showToast(x.message || 'Could not register'); }
  };
  function drawFormPhotos() {
    const box = document.getElementById('mkf-photos'); if (!box) return;
    box.innerHTML = F.photos.map((u, i) => `<div style="position:relative;"><img src="${e(u)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);"/><button type="button" aria-label="${e(t('Remove'))}" onclick="MARKET_FORM.photos.splice(${i},1);mkfPhotos()" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:0;background:#0F2640;color:#fff;cursor:pointer;">×</button></div>`).join('') || `<span style="font-size:13px;color:var(--slate);">${e(t('No photos yet'))}</span>`;
  }
  window.mkfPhotos = drawFormPhotos;
  function drawPin() {
    const el = document.getElementById('mkf-pin-line'); if (!el) return;
    el.innerHTML = `${F.pin ? `📍 ${e(t('Pinned'))} ` : e(t('A pin helps drivers find the pick-up place.')) + ' '}<button type="button" class="btn-sm btn-sm-outline" onclick="mkfPin()">📍 ${e(t(F.pin ? 'Pin again' : 'Use where I am now'))}</button>${F.pin ? ` <button type="button" class="btn-sm btn-sm-ghost" onclick="MARKET_FORM.pin=null;mkfPinDraw()">${e(t('Remove pin'))}</button>` : ''}`;
  }
  window.mkfPinDraw = drawPin;
  window.mkfPin = function () {
    if (!navigator.geolocation) return showToast(t('This device can\'t share its location.'));
    navigator.geolocation.getCurrentPosition((p) => { F.pin = { latitude: p.coords.latitude, longitude: p.coords.longitude }; drawPin(); }, () => showToast(t('Location was not shared.')), { enableHighAccuracy: true, timeout: 15000 });
  };
  window.mkfUpload = async function (input) {
    const files = [...(input.files || [])];
    for (const f of files) {
      if (F.photos.length >= 6) { showToast(t('Up to 6 photos')); break; }
      const fd = new FormData(); fd.append('photo', f);
      try {
        const res = await fetch(API_BASE + '/market/photo', { method: 'POST', headers: { Authorization: 'Bearer ' + AUTH.token }, body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Upload failed');
        F.photos.push(d.url); drawFormPhotos();
      } catch (x) { showToast(x.message); }
    }
    input.value = '';
  };
  window.saveListing = async function () {
    if (F.busy) return;
    const v = (id) => (document.getElementById(id) || {}).value;
    const body = {
      title: (v('mkf-title') || '').trim(), category: v('mkf-cat'), condition: v('mkf-cond'), price: Number(v('mkf-price')), currency: v('mkf-cur'),
      description: (v('mkf-desc') || '').trim(), photoUrls: F.photos, pickupPlace: (v('mkf-place') || '').trim(), pickupLocation: F.pin,
      protected: document.getElementById('mkf-prot').checked, driver: document.getElementById('mkf-drv').checked, cash: document.getElementById('mkf-cash').checked,
      isPart: !!(document.getElementById('mkf-part') || {}).checked, proofUrl: F.proof || null, // v143
    };
    const serial = ((document.getElementById('mkf-serial') || {}).value || '').trim(); if (serial) body.serial = serial;
    if (!(document.getElementById('mkf-owns') || {}).checked) return showToast(t('Confirm that you own this item and have the right to sell it'));
    body.ownsIt = true;
    F.busy = true;
    try {
      const r = F.id ? await apiFetch('PATCH', `/market/listings/${encodeURIComponent(F.id)}`, body) : await apiFetch('POST', '/market/listings', body);
      const checking = r && r.listing && r.listing.status === 'review';
      v105Close('mk-form'); showToast(t(checking ? 'Thanks. The Trothen team checks this listing before it goes on sale, usually within a day.' : F.id ? 'Saved' : 'Your item is on sale in the Market.')); drawSell();
    } catch (x) { showToast(x.message); }
    F.busy = false;
  };

  // ── my orders (what I bought) ───────────────────────────────────────
  async function drawOrders() {
    const body = document.getElementById('market-body'); if (!body) return;
    body.innerHTML = `<div id="my-orders-body"><div class="panel" style="color:var(--slate);">${e(t('Loading…'))}</div></div>`;
    if (typeof loadMyOrders === 'function') await loadMyOrders();
  }
  // Each order: when it completes by itself, rate the seller, a personal item's title.
  if (typeof loadMyOrders === 'function') {
    const base = loadMyOrders;
    loadMyOrders = async function () {
      const r = await base.apply(this, arguments);
      try { decorateOrders(); } catch (x) {}
      return r;
    };
  }
  function decorateOrders() {
    for (const o of (typeof CUSTOMER_ORDERS !== 'undefined' ? CUSTOMER_ORDERS : []) || []) {
      const el = document.querySelector(`.store-order[data-order="${CSS.escape(o.id)}"]`); if (!el || el.dataset.mk) continue;
      el.dataset.mk = '1';
      const extra = [];
      // v148: an order waiting for the buyer's payment
      if (o.status === 'awaiting_payment' && o.payment) el.insertAdjacentHTML('afterbegin', `<div class="mk-pay" style="background:#fff8e6;border-left:4px solid var(--gold);border-radius:8px;padding:10px 12px;margin-bottom:8px;"><div style="font-weight:700;color:var(--navy);">⏳ ${e(t('Waiting for your payment'))}</div><div style="font-size:13px;color:var(--slate);margin:4px 0 8px;">${e(t('The seller is told once it is paid. If it isn\'t paid in time, the order is cancelled and nothing is taken.'))}</div><button class="btn-sm btn-sm-primary" onclick="payWaysOrder(${jsArg(o.id)})">${e(t('Pay now'))}</button> <button class="btn-sm btn-sm-outline" onclick="mkCancelUnpaid(${jsArg(o.id)})">${e(t('Cancel order'))}</button></div>`);
      if (o.listing) extra.push(`<div style="font-size:13.5px;margin-bottom:6px;">🏷️ ${e(o.listing.title)} <span style="color:var(--slate);">· ${e(t('from a person, bought with Trothen protection'))}</span></div>`);
      if (o.status === 'active' && o.autoCompleteAt) extra.push(`<div class="mk-auto" style="font-size:13px;color:#8a5a00;background:#fff8e6;border-radius:8px;padding:6px 10px;margin:6px 0;">${e(t('Completes by itself on'))} ${e(new Date(o.autoCompleteAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}. ${e(t('If something is wrong, report a problem before then.'))}</div>`);
      if (o.status === 'completed' && !o.review) extra.push(`<button class="btn-sm btn-sm-primary mk-rate" onclick="rateSeller(${jsArg(o.id)})">★ ${e(t('Rate the seller'))}</button>`);
      if (o.status === 'completed' && o.review) extra.push(`<div style="font-size:13px;color:var(--slate);">${e(t('You rated this'))} ${'★'.repeat(o.review.stars)}</div>`);
      if (extra.length) el.insertAdjacentHTML('beforeend', `<div class="mk-extra" style="margin-top:8px;">${extra.join(' ')}</div>`);
    }
  }
  window.mkCancelUnpaid = async function (id) { // v148
    if (!(await confirmDialog(t('Cancel this order? Nothing has been paid, so nothing is taken.'), { confirmLabel: t('Cancel order') }))) return;
    try { await apiFetch('POST', `/contracts/${encodeURIComponent(id)}/cancel`, { reason: 'Not paid', reasonCategory: 'changed_mind' }); showToast(t('Order cancelled')); if (typeof loadMyOrders === 'function') loadMyOrders(); } catch (x) { showToast(x.message); }
  };
  window.rateSeller = async function (id) {
    const p = confirmDialog('', { confirmLabel: t('Send rating') });
    const m = document.getElementById('confirm-dialog-message');
    if (m) m.innerHTML = `<div style="text-align:left;"><div style="font-weight:700;color:var(--navy);margin-bottom:8px;">${e(t('How was the seller?'))}</div>
      <div id="mk-stars" style="font-size:30px;letter-spacing:4px;cursor:pointer;">${[1, 2, 3, 4, 5].map(n => `<span data-n="${n}" onclick="document.querySelectorAll('#mk-stars span').forEach(s=>s.style.color=Number(s.dataset.n)<=${n}?'#B7791F':'#cbd5e1');document.getElementById('mk-stars').dataset.v=${n}" style="color:#cbd5e1;">★</span>`).join('')}</div>
      <textarea class="form-input" id="mk-rtext" rows="3" maxlength="500" placeholder="${e(t('Anything others should know (optional)'))}" style="margin-top:8px;"></textarea></div>`;
    let stars = 0, text = ''; const btn = document.getElementById('confirm-dialog-confirm-btn');
    btn.addEventListener('click', () => { stars = Number((document.getElementById('mk-stars') || {}).dataset.v || 0); text = (document.getElementById('mk-rtext') || {}).value || ''; }, { once: true, capture: true });
    if (!(await p)) return;
    if (!stars) return showToast(t('Choose 1 to 5 stars'));
    try { await apiFetch('POST', `/market/orders/${encodeURIComponent(id)}/review`, { stars, text }); showToast(t('Thank you for rating the seller.')); if (typeof loadMyOrders === 'function') loadMyOrders(); } catch (x) { showToast(x.message); }
  };

  // Pros can buy from stores too (the store window used to be customers only).
  if (typeof openStoreCheckout === 'function') {
    const base = openStoreCheckout;
    openStoreCheckout = async function () {
      if (AUTH && AUTH.user && AUTH.user.role === 'provider') {
        if (STORE_VIEW && STORE_VIEW.providerId === AUTH.user.id) return showToast(t('This is your own store.'));
        const real = AUTH.user.role; AUTH.user.role = 'customer'; // the checkout window only checks the role to show itself
        try { return await base.apply(this, arguments); } finally { AUTH.user.role = real; }
      }
      return base.apply(this, arguments);
    };
  }

  // ── Admin → Stores & Skills: Market listings and fees ───────────────
  async function drawAdminMarket() {
    const host = document.getElementById('admin-stores-body'); if (!host || document.getElementById('admin-market')) return;
    const box = document.createElement('div'); box.id = 'admin-market'; host.prepend(box);
    let data = null; try { data = await apiFetch('GET', '/admin/market/listings?show=reported'); } catch (x) { /* not permitted */ }
    let st = null; try { st = (await apiFetch('GET', '/admin/store/review')).settings; } catch (x) {}
    const isSuper = !!(AUTH.user && AUTH.user.isSuperAdmin);
    box.innerHTML = `${data ? `<div class="panel"><div class="panel-title">Market listings to check</div><div style="font-size:13px;color:var(--slate);margin:-6px 0 8px;">Listings held by the automatic safety checks, and listings people reported.</div>
        ${data.listings.length ? data.listings.map(l => `<div class="adm-ml" data-id="${e(l.id)}" style="display:flex;gap:10px;border-top:1px solid var(--border);padding:10px 0;align-items:flex-start;flex-wrap:wrap;">
          ${l.photoUrls[0] ? `<img src="${e(l.photoUrls[0])}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;"/>` : ''}
          <div style="flex:1;min-width:220px;"><strong style="color:var(--navy);">${e(l.title)}</strong> · ${e(l.currency)} ${e(l.price)} · ${e(l.status)}<div style="font-size:13px;color:var(--slate);">${e(l.seller ? l.seller.name : '')} · ${e([l.city, l.country].filter(Boolean).join(', '))}</div>
            ${(l.reviewReasons || []).length ? `<div style="font-size:13px;color:#8a5a00;margin-top:4px;">Held for a safety check: ${e(l.reviewReasons.join('; '))}</div>` : ''}
            <ul style="font-size:13px;margin:4px 0 0 18px;padding:0;">${l.reports.map(r => `<li>${e(r.reason)}</li>`).join('')}</ul></div>
          <div class="row-actions" style="display:flex;gap:6px;"><button class="btn-sm btn-sm-outline" onclick="adminListing(${jsArg(l.id)},'restore')">${l.status === 'review' ? 'Approve' : 'Keep it on sale'}</button><button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="adminListing(${jsArg(l.id)},'remove')">Take it down</button></div>
        </div>`).join('') : '<p style="color:var(--slate);margin:0;">No reported listings.</p>'}</div>` : ''}
      ${st && isSuper ? `<div class="panel"><div class="panel-title">Market fees and timing</div>
        <div style="font-size:13.5px;color:var(--slate);margin-bottom:10px;">Store items: a percentage of the sale, deducted from the seller's payment. Items from individuals: the buyer pays a small protection fee. Orders complete automatically a few days after hand-over unless the buyer reports a problem.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${[['adm-gfp', 'Fee on store goods (%)', st.goodsFeePercent], ['adm-gfm', 'Minimum fee (US$)', st.goodsFeeMin], ['adm-pfp', 'Buyer protection (%)', st.protectionFeePercent], ['adm-pfm', 'Minimum protection fee (US$)', st.protectionFeeMin], ['adm-arp', 'Days after collection', st.autoReleasePickupDays], ['adm-ard', 'Days after delivery', st.autoReleaseDeliveryDays]].map(([id, l, v]) => `<div class="form-group" style="flex:1 1 150px;margin:0;"><label class="form-label" for="${id}">${l}</label><input class="form-input" id="${id}" type="number" step="0.01" min="0" value="${e(v)}"/></div>`).join('')}
          <div class="form-group" style="flex:1 1 150px;margin:0;"><label class="form-label" for="adm-fm">How the store fee works</label><select class="form-input form-select" id="adm-fm"><option value="percent" ${st.feeMode !== 'flat' ? 'selected' : ''}>A percentage (recommended)</option><option value="flat" ${st.feeMode === 'flat' ? 'selected' : ''}>The flat fee per purchase</option></select></div>
        </div><button class="btn-sm btn-sm-primary" style="margin-top:10px;" onclick="saveMarketFees()">Save</button></div>` : ''}`;
  }
  window.adminListing = async function (id, decision) {
    let reason = '';
    if (decision === 'remove') {
      const p = confirmDialog('', { confirmLabel: 'Take it down' });
      const m = document.getElementById('confirm-dialog-message');
      if (m) m.innerHTML = `<div style="text-align:left;"><div style="font-weight:700;color:var(--navy);margin-bottom:6px;">Why? The seller sees this.</div><textarea class="form-input" id="adm-ml-why" rows="3" maxlength="300"></textarea></div>`;
      document.getElementById('confirm-dialog-confirm-btn').addEventListener('click', () => { reason = (document.getElementById('adm-ml-why') || {}).value || ''; }, { once: true, capture: true });
      if (!(await p)) return;
    }
    try { await apiFetch('POST', `/admin/market/listings/${encodeURIComponent(id)}/decide`, { decision, reason }); showToast(decision === 'remove' ? 'Taken down. The seller was told why.' : 'Back on sale.'); const b = document.getElementById('admin-market'); if (b) b.remove(); drawAdminMarket(); }
    catch (x) { showToast(x.message); }
  };
  window.saveMarketFees = async function () {
    const n = (id) => Number(document.getElementById(id).value);
    const body = { feeMode: document.getElementById('adm-fm').value, goodsFeePercent: n('adm-gfp'), goodsFeeMin: n('adm-gfm'), protectionFeePercent: n('adm-pfp'), protectionFeeMin: n('adm-pfm'), autoReleasePickupDays: Math.round(n('adm-arp')), autoReleaseDeliveryDays: Math.round(n('adm-ard')) };
    try { await apiFetch('PUT', '/admin/store/settings', body); showToast('Saved. New orders use these.'); } catch (x) { showToast(x.message); }
  };
  if (typeof loadAdminStores === 'function') {
    const base = loadAdminStores;
    loadAdminStores = async function () { const r = await base.apply(this, arguments); try { await drawAdminMarket(); } catch (x) {} return r; };
  }

  // ── Materials for a job (v140) ──────────────────────────────────────
  // On the customer's job: goods from nearby stores that go with that kind
  // of work (the pro on the job's own store first). Buying from here links
  // the order to the job, and the pro is told the materials are coming.
  window.openMaterials = async function (jobId, category) {
    v105Overlay('mk-materials', `<div class="modal-header"><button class="modal-close" onclick="v105Close('mk-materials')" aria-label="Close">✕</button><h3>${e(t('Materials for this job'))}</h3><p>${e(category || '')}</p></div>
      <div class="modal-body" id="mkm-body" style="overflow:auto;flex:1 1 auto;min-height:0;"><p style="color:var(--slate);">${e(t('Loading…'))}</p></div>`, 680);
    let r; try { r = await apiFetch('GET', `/market/suggest?jobId=${encodeURIComponent(jobId || '')}&category=${encodeURIComponent(category || '')}`); } catch (x) { document.getElementById('mkm-body').textContent = x.message; return; }
    const b = document.getElementById('mkm-body'); if (!b) return;
    b.innerHTML = r.items.length
      ? `<div style="font-size:13.5px;color:var(--slate);margin-bottom:10px;">${e(t('From stores near you that sell'))} ${e(r.aisles.join(', '))}. ${e(t('Buy here and the order is linked to your job.'))}</div>
         <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;">${r.items.map(it => `<div class="mk-card mk-mat" role="button" tabindex="0" onclick="openMaterialStore(${jsArg(it.providerId)},${jsArg(jobId || '')})" style="cursor:pointer;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;">
           ${it.photo ? `<img src="${e(it.photo)}" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;"/>` : `<div style="width:100%;aspect-ratio:1;background:#f2f4f7;"></div>`}
           <div style="padding:8px 10px;"><div style="font-weight:800;color:var(--navy);">${money(it.price)}</div><div style="font-size:13.5px;">${e(it.title)}</div><div style="font-size:12px;color:var(--slate);">${e(it.storeName)}${it.yourPro ? ` · <strong>${e(t('your pro\'s store'))}</strong>` : ''}</div></div></div>`).join('')}</div>`
      : `<p style="color:var(--slate);">${e(t(r.aisles.length ? 'No stores near you sell materials for this kind of job yet.' : 'There are no materials suggestions for this kind of job.'))}</p>`;
  };
  window.openMaterialStore = function (providerId, jobId) {
    v105Close('mk-materials');
    M.jobContext = jobId || null; M.jobContextStore = providerId;
    openProStore(providerId);
    if (jobId) showToast(t('What you buy from this store is linked to your job.'));
  };
  if (typeof apiFetch === 'function') {
    const base = apiFetch;
    apiFetch = function (method, path, body) {
      if (method === 'POST' && path === '/store/orders' && M.jobContext && body && body.providerId === M.jobContextStore && !body.jobId) body = { ...body, jobId: M.jobContext };
      const p = base.call(this, method, path, body);
      if (method === 'POST' && path === '/store/orders') p.then(() => { M.jobContext = null; }).catch(() => {});
      return p;
    };
  }
  if (typeof openProStore === 'function') {
    const base = openProStore;
    openProStore = function (providerId) { if (providerId !== M.jobContextStore) M.jobContext = null; return base.apply(this, arguments); };
  }
  // A verified pro sees and pays the trade price in a store.
  if (typeof renderProStore === 'function') {
    const base = renderProStore;
    renderProStore = function () {
      try { const d = STORE_VIEW && STORE_VIEW.data; if (d && !d.tradeApplied) { d.tradeApplied = true; for (const g of d.goods || []) if (g.tradePrice && g.tradePrice < g.price) { g.description = `${t('Trade price for pros')} (${t('shelf')} ${money(g.price)}). ${g.description || ''}`.trim(); g.price = g.tradePrice; } } } catch (x) {}
      return base.apply(this, arguments);
    };
  }
  // The customer's job card: "Materials for this job".
  if (typeof openJobCardHTML === 'function') {
    const base = openJobCardHTML;
    openJobCardHTML = function (j) {
      const html = base(j);
      try {
        if (!j || !j.id || !j.category) return html;
        const btn = `<button type="button" class="btn-sm btn-sm-outline mk-mat-btn" onclick="event.stopPropagation();openMaterials(${jsArg(j.id)},${jsArg(j.category)})">🧰 ${e(t('Materials for this job'))}</button>`;
        // v160: with the card's other buttons (it used to be put after the text column, which squeezed the text to one word a line on phones)
        const k = html.indexOf('<!--job-actions-end-->');
        if (k > -1) return html.slice(0, k) + btn + html.slice(k);
        const i = html.lastIndexOf('</div>');
        return i > -1 ? html.slice(0, i) + btn + html.slice(i) : html + btn;
      } catch (x) { return html; }
    };
  }
  try { Object.assign(FRAUD_TYPE_LABELS, { market_listing_risk: 'Market Listing Held', stolen_item_listed: 'Stolen Item Listed (urgent)', off_platform_payment: 'Off-Platform Payment Request', market_self_dealing: 'Buying From Own Account' }); } catch (x) {}

  // ── sign-up and Settings: services, a store, or both ────────────────
  window.proModeChanged = function (v) {
    const f = document.getElementById('auth-service-fields'); if (f) f.style.display = v === 'goods' ? 'none' : '';
  };
  // v154: the line under the choice describes the choice that is selected
  window.proModeHint = (v) => t(v === 'goods' ? 'Your store appears in the Market. You won\'t appear in service search.' : v === 'both' ? 'You appear in service search, and your store appears in the Market.' : 'Customers find you in service search and job matches.');
  function addProModePanel() {
    if (!(AUTH && AUTH.user && AUTH.user.role === 'provider')) return;
    const main = document.getElementById('provider-main'); if (!main || document.getElementById('pro-mode-panel')) return;
    const cur = AUTH.user.proMode || 'services';
    main.insertAdjacentHTML('afterbegin', '');
    const box = document.createElement('div'); box.className = 'panel'; box.id = 'pro-mode-panel';
    box.innerHTML = `<div class="panel-title">${e(t('What you do on Trothen'))}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><select class="form-input form-select" id="pro-mode-select" style="width:auto;" onchange="document.getElementById('pro-mode-hint').textContent = proModeHint(this.value)">
        ${[['services', 'Offer my services'], ['goods', 'Sell goods (a store)'], ['both', 'Both: services and a store']].map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${e(t(l))}</option>`).join('')}</select>
        <button class="btn-sm btn-sm-primary" onclick="saveProMode()">${e(t('Save'))}</button></div>
      <div id="pro-mode-hint" style="font-size:13px;color:var(--slate);margin-top:6px;">${e(proModeHint(cur))}</div>`;
    const header = main.querySelector('.dash-header');
    if (header) header.insertAdjacentElement('afterend', box); else main.prepend(box);
  }
  window.saveProMode = async function () {
    const proMode = document.getElementById('pro-mode-select').value;
    try { const r = await apiFetch('PATCH', '/auth/me', { proMode }); AUTH.user = r.user || { ...AUTH.user, proMode }; showToast(t(proMode === 'goods' ? 'Saved. Open your store in My Store; it shows in the Market once approved.' : 'Saved')); }
    catch (x) { showToast(x.message); }
  };
  if (typeof selectProviderSection === 'function') {
    const base = selectProviderSection;
    selectProviderSection = function (key) { const r = base.apply(this, arguments); if (key === 'settings') setTimeout(addProModePanel, 0); return r; };
  }
})();
