// v162: the shopping cart.
//
// One cart across every store, kept on the account (any device) and, before
// signing in, in this browser; it joins the account at sign-in. Grouped by
// store and checked out one store at a time (as on Etsy), because each store
// has its own delivery, discount codes and held money. The store window and
// its checkout are unchanged: they keep reading STORE_BASKET, which this file
// fills from the cart and keeps the cart in step with.
(function () {
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const money = (n) => (typeof usd2 === 'function' ? usd2(n) : '$' + Number(n || 0).toFixed(2));
  const LS = 'trothen_cart_v1';
  // drawn, like the bell beside it (an emoji next to the count was removed by the icon pass)
  const CART_ICON = '<svg class="ui-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';
  const C = { view: null, sig: null, guest: [], pending: new Map(), timer: null, busy: false, notices: [] };

  if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
    'Cart': 'Carrito', 'Your cart': 'Tu carrito', 'Add to cart': 'Añadir al carrito', 'Added to your cart': 'Añadido a tu carrito', 'Choose options': 'Elegir opciones',
    'Your cart is empty': 'Tu carrito está vacío', 'Goods you add from any store stay here, on any device you sign in on.': 'Lo que añadas de cualquier tienda se queda aquí, en cualquier dispositivo donde inicies sesión.',
    'Browse the Market': 'Explorar el Mercado', 'Browse pros and their stores': 'Ver profesionales y sus tiendas', 'Sign in to see your cart': 'Inicia sesión para ver tu carrito',
    'Add goods from a pro\'s store and they wait here. Signed in, your cart follows you to any device.': 'Añade productos de la tienda de un profesional y te esperan aquí. Con tu sesión iniciada, el carrito te sigue en cualquier dispositivo.',
    'Carts are for customer and pro accounts.': 'Los carritos son para cuentas de cliente y de profesional.', 'Check out with this store': 'Pagar en esta tienda', 'Subtotal': 'Subtotal', 'Remove': 'Quitar', 'Save for later': 'Guardar para después',
    'Saved for later': 'Guardado para después', 'Move to cart': 'Pasar al carrito', 'Sold out': 'Agotado', 'No longer available': 'Ya no está disponible', 'Only': 'Solo', 'left': 'quedan',
    'Delivery, any discount code and Trothen\'s fee are worked out at checkout.': 'La entrega, cualquier código de descuento y la tarifa de Trothen se calculan al pagar.',
    'Each store is paid for on its own, because each has its own delivery and its money is held until you have the goods.': 'Cada tienda se paga por separado, porque cada una tiene su propia entrega y su dinero se retiene hasta que tienes los productos.',
    'Sign in to check out. Your cart is kept on this device until you do.': 'Inicia sesión para pagar. Tu carrito se guarda en este dispositivo hasta entonces.',
    'Sign in to check out': 'Inicia sesión para pagar', 'Price went down': 'Bajó de precio', 'Price went up': 'Subió de precio', 'was': 'antes',
    'Only so many were left, so your cart now has fewer:': 'Quedaban pocos, así que tu carrito ahora tiene menos:',
    'Open the store': 'Abrir la tienda', 'This store is closed at the moment.': 'Esta tienda está cerrada en este momento.', 'items': 'artículos', 'item': 'artículo', 'from': 'de', 'stores': 'tiendas', 'store': 'tienda',
    'Your cart from before you signed in was added.': 'Se añadió el carrito que tenías antes de iniciar sesión.', 'Some goods from before you signed in are no longer sold and were left out.': 'Algunos productos de antes de iniciar sesión ya no se venden y no se añadieron.',
    'Remove the goods that can\'t be bought to check out.': 'Quita los productos que no se pueden comprar para pagar.', 'Loading your cart…': 'Cargando tu carrito…', 'View cart': 'Ver carrito',
  });

  const me = () => (typeof AUTH !== 'undefined' && AUTH.user) || null;
  const isBuyer = () => !!(typeof AUTH !== 'undefined' && AUTH.token && me() && ['customer', 'provider'].includes(me().role));
  const keyFor = (goodId, variantId) => (variantId ? `${goodId}::${variantId}` : goodId); // STORE_BASKET's key
  const serverKey = (goodId, variantId) => `${goodId}::${variantId || ''}`;

  // ── the guest's cart, in this browser ────────────────────────────────
  function readGuest() { try { const v = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(v) ? v.slice(0, 60) : []; } catch (x) { return []; } }
  function writeGuest(lines) { try { if (lines.length) localStorage.setItem(LS, JSON.stringify(lines)); else localStorage.removeItem(LS); } catch (x) { /* private mode: kept for this visit only */ } }
  function guestSet(providerId, goodId, variantId, qty) {
    const lines = readGuest().filter(l => !(l.providerId === providerId && l.goodId === goodId && (l.variantId || null) === (variantId || null)));
    if (qty > 0) lines.push({ providerId, goodId, variantId: variantId || null, qty, addedAt: new Date().toISOString() });
    writeGuest(lines); C.guest = lines;
  }
  function basketFromLines(lines) {
    for (const k of Object.keys(STORE_BASKET)) delete STORE_BASKET[k];
    for (const l of lines) { if (l.saved) continue; const b = STORE_BASKET[l.providerId] = STORE_BASKET[l.providerId] || {}; b[keyFor(l.goodId, l.variantId)] = l.qty; }
  }
  function basketFromView(v) {
    const lines = [];
    for (const s of v.stores || []) for (const l of s.lines) if (l.status === 'ok') lines.push(l);
    basketFromLines(lines);
  }

  // ── the count on the cart icon ───────────────────────────────────────
  // what's picked right now (the server's answer, a moment later, fills the same baskets)
  function count() {
    return Object.values(STORE_BASKET).reduce((s, b) => s + Object.values(b || {}).reduce((a, n) => a + n, 0), 0);
  }
  function paintCount() {
    const n = count();
    document.querySelectorAll('.nav-cart').forEach(b => {
      b.setAttribute('aria-label', `${t('Cart')}${n ? `, ${n} ${t(n === 1 ? 'item' : 'items')}` : ''}`);
      const c = b.querySelector('.nav-cart-count'); if (c) { c.textContent = n > 99 ? '99+' : String(n); c.hidden = !n; }
    });
    const m = document.querySelector('[data-cart-menu-count]'); if (m) m.textContent = n ? ` (${n})` : '';
  }
  window.cartPaintCount = paintCount;

  // ── loading and keeping in step ─────────────────────────────────────
  // v164: loads run one after another (at sign-in two could start together and both add the visitor's
  // cart; the second now finds it already added, and a load asked for after signing in always runs)
  function load() { const run = (C.loading || Promise.resolve()).then(() => loadNow(), () => loadNow()); C.loading = run.catch(() => {}); return run; }
  async function loadNow() {
    if (!isBuyer()) { C.view = null; C.guest = readGuest(); basketFromLines(C.guest); paintCount(); return null; }
    try {
      const guest = readGuest();
      if (guest.length) {
        const r = await apiFetch('POST', '/cart/merge', { lines: guest });
        writeGuest([]); C.guest = [];
        C.view = r;
        if (typeof showToast === 'function') showToast(t(r.skipped ? 'Some goods from before you signed in are no longer sold and were left out.' : 'Your cart from before you signed in was added.'));
      } else C.view = await apiFetch('GET', '/cart');
      basketFromView(C.view);
    } catch (x) { /* the cart icon stays as it was */ }
    paintCount();
    return C.view;
  }
  window.cartRefresh = () => load();

  // A change to one line, made in the store window or the cart page.
  function queue(providerId, goodId, variantId, qty) {
    if (!isBuyer()) { guestSet(providerId, goodId, variantId, qty); paintCount(); return Promise.resolve(); }
    C.pending.set(serverKey(goodId, variantId), { providerId, goodId, variantId: variantId || null, qty });
    clearTimeout(C.timer);
    return new Promise((resolve) => { C.timer = setTimeout(async () => { await flush(); resolve(); }, 350); });
  }
  async function flush() {
    const jobs = [...C.pending.values()]; C.pending.clear();
    for (const j of jobs) {
      try {
        const r = await apiFetch('POST', '/cart/items', { ...j, mode: 'set' });
        C.view = r; if (r.notice) showToast(t(r.notice));
      } catch (x) { showToast(x.message || 'Could not update your cart'); }
    }
    if (C.view) basketFromView(C.view);
    paintCount(); redrawIfOpen();
    if (document.getElementById('pro-store-overlay') && typeof renderProStore === 'function') renderProStore();
  }

  // The store window's + and − (and its size/colour picker) change
  // STORE_BASKET; the cart follows.
  if (typeof changeBasket === 'function') {
    const base = changeBasket;
    changeBasket = function (goodId) {
      const pid = STORE_VIEW.providerId;
      const before = { ...(STORE_BASKET[pid] || {}) };
      const out = base.apply(this, arguments);
      const after = STORE_BASKET[pid] || {};
      for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if ((before[k] || 0) === (after[k] || 0)) continue;
        const [gid, vid] = k.split('::');
        queue(pid, gid, vid || null, after[k] || 0);
      }
      paintCount();
      return out;
    };
  }
  // the store window's footer gets a way to the cart
  if (typeof renderProStore === 'function') {
    const base = renderProStore;
    renderProStore = function () {
      const out = base.apply(this, arguments);
      const foot = document.getElementById('ps-foot');
      if (foot && count() > 0 && !foot.querySelector('.ps-cart-link')) foot.insertAdjacentHTML('afterbegin', `<div class="ps-cart-link" style="text-align:right;margin:-2px 0 6px;"><button type="button" class="btn-sm btn-sm-ghost" onclick="v105Close('pro-store-overlay');openCart()">🛒 ${e(t('View cart'))} (${count()})</button></div>`);
      return out;
    };
  }
  // A placed order (or a booking with goods) takes its goods out of the cart
  // on the server; the icon and baskets follow.
  if (typeof apiFetch === 'function') {
    const base = apiFetch;
    apiFetch = async function (method, path) {
      const r = await base.apply(this, arguments);
      if (method === 'POST' && (path === '/store/orders' || path === '/contracts')) setTimeout(() => load(), 300);
      return r;
    };
  }

  // From a Market card (a good with no sizes or colours).
  window.cartAddFromMarket = async function (providerId, goodId, btn) {
    if (btn) btn.disabled = true;
    try {
      if (isBuyer()) {
        const r = await apiFetch('POST', '/cart/items', { providerId, goodId, qty: 1, mode: 'add' });
        C.view = r; basketFromView(r);
        showToast(t(r.notice || 'Added to your cart'));
      } else {
        const have = readGuest().find(l => l.providerId === providerId && l.goodId === goodId && !l.variantId);
        guestSet(providerId, goodId, null, Math.min(99, ((have && have.qty) || 0) + 1)); basketFromLines(readGuest());
        showToast(t('Added to your cart'));
      }
      paintCount();
    } catch (x) {
      if (x.data && x.data.code === 'CHOOSE_OPTION') return openProStore(providerId);
      showToast(x.message || 'Could not add it');
    } finally { if (btn) btn.disabled = false; }
  };

  // ── the cart page ───────────────────────────────────────────────────
  // The guest's cart is drawn from each store's public page.
  async function guestView() {
    const lines = readGuest(); const byStore = new Map();
    for (const l of lines) { if (!byStore.has(l.providerId)) byStore.set(l.providerId, []); byStore.get(l.providerId).push(l); }
    const stores = [];
    for (const [pid, ls] of byStore) {
      let d = null; try { d = await apiFetch('GET', '/providers/' + encodeURIComponent(pid) + '/store'); } catch (x) { /* closed */ }
      const out = ls.map(l => {
        const g = d && d.goods.find(x => x.id === l.goodId); const v = g && l.variantId ? (g.variants || []).find(x => x.id === l.variantId) : null;
        if (!d) return { ...l, key: serverKey(l.goodId, l.variantId), name: t('No longer available'), status: 'store_closed' };
        if (!g || (l.variantId && !v)) return { ...l, key: serverKey(l.goodId, l.variantId), name: t('No longer available'), status: 'gone' };
        const left = v ? v.left : g.left; const sold = v ? v.soldOut : g.soldOut;
        const qty = left !== null && left !== undefined ? Math.min(l.qty, left) : l.qty;
        const unitPrice = (v || g).price;
        return { ...l, key: serverKey(l.goodId, l.variantId), qty, name: g.name, variantLabel: v ? v.label : null, photo: (g.photoUrls || [])[0] || null, status: sold ? 'sold_out' : 'ok', left: left === undefined ? null : left, unitPrice, lineTotal: Math.round(unitPrice * qty * 100) / 100, salePercent: (v || g).salePercent || g.salePercent || null, wasUnitPrice: (v || g).wasPrice || null };
      });
      const ok = out.filter(x => x.status === 'ok');
      stores.push({ providerId: pid, storeName: d ? d.store.name : t('Store'), sellerName: d ? d.store.providerName : '', city: d ? d.store.city : '', closed: !d, lines: out, subtotal: Math.round(ok.reduce((s, x) => s + x.lineTotal, 0) * 100) / 100, count: ok.reduce((s, x) => s + x.qty, 0), canCheckout: ok.length > 0 });
    }
    return { stores, saved: [], count: stores.reduce((s, x) => s + x.count, 0), subtotal: Math.round(stores.reduce((s, x) => s + x.subtotal, 0) * 100) / 100, guest: true };
  }

  function priceHTML(l) {
    if (l.unitPrice == null) return '';
    const local = l.priceCurrency && l.priceLocal ? ` <span style="color:var(--slate);font-size:12.5px;">(${e(l.priceSymbol || l.priceCurrency)}${Number(l.priceLocal).toLocaleString()})</span>` : '';
    return `${l.salePercent && l.wasUnitPrice ? `<span style="text-decoration:line-through;color:var(--slate);font-size:12.5px;margin-right:4px;">${money(l.wasUnitPrice)}</span>` : ''}<strong style="color:var(--navy);">${money(l.unitPrice)}</strong>${l.unit ? ` <span style="color:var(--slate);font-size:12.5px;">/ ${e(l.unit)}</span>` : ''}${local}${l.salePercent ? ` <span class="badge badge-warn" style="font-size:11px;">−${e(l.salePercent)}%</span>` : ''}${l.trade ? ` <span class="badge badge-neutral" style="font-size:11px;">${e(t('Trade price for pros'))}</span>` : ''}`;
  }
  function lineHTML(l, guest) {
    const k = jsArg(l.key);
    const off = l.status !== 'ok';
    const status = l.status === 'sold_out' ? `<span class="badge badge-danger" style="font-size:11.5px;">${e(t('Sold out'))}</span>`
      : off ? `<span class="badge badge-neutral" style="font-size:11.5px;">${e(t(l.status === 'store_closed' ? 'This store is closed at the moment.' : 'No longer available'))}</span>`
      : (l.left !== null && l.left !== undefined && l.left <= 5 ? `<span style="color:#B4472E;font-size:12.5px;font-weight:600;">${e(t('Only'))} ${e(l.left)} ${e(t('left'))}</span>` : '');
    const change = l.priceChange ? `<div style="font-size:12.5px;color:${l.priceChange.way === 'down' ? '#0f766e' : '#B4472E'};">${e(t(l.priceChange.way === 'down' ? 'Price went down' : 'Price went up'))} (${e(t('was'))} ${money(l.priceChange.from)})</div>` : '';
    const max = l.left !== null && l.left !== undefined ? Math.min(99, l.left) : 99;
    return `<div class="cart-line${off ? ' is-off' : ''}" data-key="${e(l.key)}">
      ${l.photo ? `<img src="${e(l.photo)}" alt="" loading="lazy" class="cart-photo"/>` : '<div class="cart-photo"></div>'}
      <div class="cart-info">
        <div class="cart-name">${e(l.name)}${l.variantLabel ? ` <span style="color:var(--slate);font-weight:500;">· ${e(l.variantName ? l.variantName + ': ' : '')}${e(l.variantLabel)}</span>` : ''}</div>
        <div class="cart-price">${off ? '' : priceHTML(l)}</div>
        ${change}${status ? `<div>${status}</div>` : ''}
        <div class="cart-actions">
          ${l.saved || off ? '' : `<div class="cart-qty" role="group" aria-label="${e(t('Quantity'))}">
            <button type="button" class="btn-sm btn-sm-outline" aria-label="−" onclick="cartQty(${k},${l.qty - 1})">−</button>
            <span aria-live="polite">${e(l.qty)}</span>
            <button type="button" class="btn-sm btn-sm-outline" aria-label="+" ${l.qty >= max ? 'disabled' : ''} onclick="cartQty(${k},${l.qty + 1})">+</button>
          </div>`}
          ${l.saved ? `<button type="button" class="btn-link" onclick="cartSave(${k},false)">${e(t('Move to cart'))}</button>` : (!guest && !off ? `<button type="button" class="btn-link" onclick="cartSave(${k},true)">${e(t('Save for later'))}</button>` : '')}
          <button type="button" class="btn-link cart-remove" onclick="cartRemove(${k})">${e(t('Remove'))}</button>
        </div>
      </div>
      <div class="cart-total">${l.lineTotal != null && !off && !l.saved ? money(l.lineTotal) : ''}</div>
    </div>`;
  }
  function cartHTML(v) {
    if (!v) return `<p style="color:var(--slate);">${e(t('Loading your cart…'))}</p>`;
    const guest = !!v.guest;
    const n = v.count || 0, ns = (v.stores || []).length;
    const reduced = []; for (const s of v.stores || []) for (const l of s.lines) if (l.reduced) reduced.push(`${l.name}: ${l.reduced.from} → ${l.reduced.to}`);
    // v164: an empty cart always offers a way on (Baymard: an empty cart is a dead end without one). A visitor
    // who isn't signed in is told the truth (their cart is on this device) and can sign in to see one kept elsewhere.
    if (!ns && !(v.saved || []).length) {
      const signedIn = isBuyer();
      const staff = !!(me() && !['customer', 'provider'].includes(me().role));
      return `<div class="cart-empty"><span class="cart-empty-icon" aria-hidden="true">${CART_ICON}</span><div class="cart-empty-title">${e(t('Your cart is empty'))}</div>
        <p>${e(t(staff ? 'Carts are for customer and pro accounts.' : signedIn ? 'Goods you add from any store stay here, on any device you sign in on.' : 'Add goods from a pro\'s store and they wait here. Signed in, your cart follows you to any device.'))}</p>
        ${staff ? '' : `<div class="cart-empty-actions">
          <button type="button" class="confirm-btn" onclick="v105Close('cart-overlay');cartBrowseMarket()">${e(t(signedIn ? 'Browse the Market' : 'Browse pros and their stores'))}</button>
          ${signedIn ? '' : `<button type="button" class="btn-link cart-empty-signin" onclick="v105Close('cart-overlay');showAuth('login')">${e(t('Sign in to see your cart'))}</button>`}
        </div>`}</div>`;
    }
    return `
      ${guest ? `<div class="ver-note" style="margin-bottom:12px;">${e(t('Sign in to check out. Your cart is kept on this device until you do.'))}</div>` : ''}
      ${reduced.length ? `<div class="ver-note" style="margin-bottom:12px;">${e(t('Only so many were left, so your cart now has fewer:'))} ${e(reduced.join(' · '))}</div>` : ''}
      ${ns ? `<div style="font-size:13.5px;color:var(--slate);margin-bottom:10px;">${e(n)} ${e(t(n === 1 ? 'item' : 'items'))} ${e(t('from'))} ${e(ns)} ${e(t(ns === 1 ? 'store' : 'stores'))}${ns > 1 ? ` · ${e(t('Each store is paid for on its own, because each has its own delivery and its money is held until you have the goods.'))}` : ''}</div>` : ''}
      ${(v.stores || []).map(s => `<section class="cart-store panel" aria-label="${e(s.storeName)}">
        <div class="cart-store-head">
          <div><button type="button" class="btn-link cart-store-name" onclick="v105Close('cart-overlay');openProStore(${jsArg(s.providerId)})">🛍️ ${e(s.storeName)}</button>
          <div style="font-size:12.5px;color:var(--slate);">${e([s.sellerName, s.city].filter(Boolean).join(' · '))}</div></div>
        </div>
        ${s.lines.map(l => lineHTML(l, guest)).join('')}
        <div class="cart-store-foot">
          <div class="cart-subtotal"><span>${e(t('Subtotal'))} (${e(s.count)} ${e(t(s.count === 1 ? 'item' : 'items'))})</span><strong>${money(s.subtotal)}</strong></div>
          ${s.error ? `<div class="ver-note" style="color:#B4472E;">${e(s.error)}</div>` : ''}
          ${s.unavailable && s.canCheckout ? `<div style="font-size:12.5px;color:var(--slate);">${e(t('Remove the goods that can\'t be bought to check out.'))}</div>` : ''}
          <button type="button" class="confirm-btn" ${s.canCheckout ? '' : 'disabled'} onclick="cartCheckout(${jsArg(s.providerId)})">${e(t(guest ? 'Sign in to check out' : 'Check out with this store'))}</button>
          <div style="font-size:12px;color:var(--muted);text-align:center;">${e(t('Delivery, any discount code and Trothen\'s fee are worked out at checkout.'))}</div>
        </div>
      </section>`).join('')}
      ${(v.saved || []).length ? `<section class="cart-store panel" aria-label="${e(t('Saved for later'))}"><div class="cart-store-head"><strong style="color:var(--navy);">${e(t('Saved for later'))}</strong></div>${v.saved.map(l => lineHTML(l, guest)).join('')}</section>` : ''}`;
  }
  function redrawIfOpen() {
    const b = document.getElementById('cart-body'); if (b) b.innerHTML = cartHTML(C.shown);
    const sec = document.getElementById('cart-section-body'); if (sec) sec.innerHTML = cartHTML(C.shown);
  }
  async function refreshShown() {
    C.shown = isBuyer() ? await load() : await guestView();
    if (!isBuyer()) paintCount();
    redrawIfOpen();
  }
  window.cartBrowseMarket = async function () {
    const role = me() && me().role;
    if (role === 'customer' && typeof goToCustomerDashboard === 'function') return goToCustomerDashboard('market');
    if (role === 'provider' && typeof selectProviderSection === 'function') { const sc = document.getElementById('screen-provider'); if (sc && !sc.classList.contains('active')) showScreen('screen-provider'); return selectProviderSection('market'); }
    if (role === 'customer' || role === 'provider') { if (typeof openMarket === 'function') openMarket('browse'); return; }
    if (typeof goDirectory === 'function') goDirectory(); // not signed in: the pros, whose stores sell the goods
  };
  window.openCart = async function () {
    v105Overlay('cart-overlay', `
      <div class="modal-header"><button class="modal-close" onclick="v105Close('cart-overlay')" aria-label="${e(t('Close'))}">✕</button><h3>🛒 ${e(t('Your cart'))}</h3></div>
      <div class="modal-body" id="cart-body" style="overflow:auto;flex:1 1 auto;min-height:0;">${cartHTML(null)}</div>`, 640);
    await refreshShown();
  };
  window.cartQty = async function (key, qty) {
    const l = findLine(key); if (!l) return;
    if (qty < 1) return cartRemove(key);
    l.qty = qty; if (l.unitPrice != null) l.lineTotal = Math.round(l.unitPrice * qty * 100) / 100; redrawIfOpen();
    await queue(l.providerId, l.goodId, l.variantId, qty);
    if (!isBuyer()) await refreshShown(); else { C.shown = C.view; redrawIfOpen(); }
  };
  window.cartRemove = async function (key) {
    const l = findLine(key); if (!l) return;
    try {
      if (isBuyer()) { C.view = await apiFetch('DELETE', '/cart/items/' + encodeURIComponent(key)); basketFromView(C.view); C.shown = C.view; }
      else { guestSet(l.providerId, l.goodId, l.variantId, 0); basketFromLines(readGuest()); C.shown = await guestView(); }
    } catch (x) { showToast(x.message || 'Could not remove it'); }
    paintCount(); redrawIfOpen();
  };
  window.cartSave = async function (key, saved) {
    try { C.view = await apiFetch('PATCH', '/cart/items/' + encodeURIComponent(key), { saved }); basketFromView(C.view); C.shown = C.view; }
    catch (x) { showToast(x.message || 'Could not move it'); }
    paintCount(); redrawIfOpen();
  };
  function findLine(key) {
    const v = C.shown; if (!v) return null;
    for (const s of v.stores || []) for (const l of s.lines) if (l.key === key) return l;
    return (v.saved || []).find(l => l.key === key) || null;
  }
  // Checking out one store from the cart opens that store's own checkout,
  // with the cart's goods from that store.
  window.cartCheckout = async function (providerId) {
    if (!isBuyer()) { v105Close('cart-overlay'); showToast(t('Sign in to check out. Your cart is kept on this device until you do.')); return showAuth('login'); }
    const s = (C.shown && C.shown.stores || []).find(x => x.providerId === providerId); if (!s) return;
    if (C.pending.size) { clearTimeout(C.timer); await flush(); }
    try {
      STORE_VIEW.providerId = providerId;
      STORE_VIEW.data = await apiFetch('GET', '/providers/' + encodeURIComponent(providerId) + '/store');
    } catch (x) { return showToast(x.message || t('This store is closed at the moment.')); }
    STORE_BASKET[providerId] = {};
    for (const l of s.lines) if (l.status === 'ok') STORE_BASKET[providerId][keyFor(l.goodId, l.variantId)] = l.qty;
    v105Close('cart-overlay');
    if (typeof openStoreCheckout === 'function') openStoreCheckout();
  };

  // ── the cart icon in the top bar ────────────────────────────────────
  if (typeof navbarHTML === 'function') {
    const base = navbarHTML;
    navbarHTML = function (active) {
      const html = base.apply(this, arguments);
      if (active === 'admin' || active === 'superadmin' || (me() && me().role === 'admin')) return html;
      const n = count();
      const btn = `<button type="button" class="nav-cart" onclick="openCart()" aria-label="${e(t('Cart'))}${n ? `, ${n} ${e(t(n === 1 ? 'item' : 'items'))}` : ''}">${CART_ICON}<span class="nav-cart-count"${n ? '' : ' hidden'}>${n > 99 ? '99+' : n}</span></button>`;
      // just after the language switcher, before the bell (or the guest's buttons)
      const at = html.indexOf('<div class="navbar-nav">');
      if (at < 0) return html;
      const sw = html.indexOf('</div>\n    </div>', html.indexOf('lang-dropdown', at));
      const pos = sw > 0 ? sw + '</div>\n    </div>'.length : at + '<div class="navbar-nav">'.length;
      let out = html.slice(0, pos) + btn + html.slice(pos);
      // and in the customer's account menu
      out = out.replace(/(<div class="account-menu-item" onclick="closeAccountMenu\(\);goToCustomerDashboard\('bookings'\)">[^<]*<\/div>)/, `$1<div class="account-menu-item" onclick="closeAccountMenu();openCart()">🛒 ${e(t('Cart'))}<span data-cart-menu-count>${n ? ` (${n})` : ''}</span></div>`);
      return out;
    };
    // the top bars already drawn before this file loaded
    setTimeout(() => document.querySelectorAll('[data-nav-active]').forEach(el => { try { renderNavbar(el.id, el.dataset.navActive); } catch (x) {} }), 0);
  }
  // the customer's menus: Cart
  if (typeof CUSTOMER_NAV_ITEMS !== 'undefined' && !CUSTOMER_NAV_ITEMS.some(x => x.key === 'cart')) {
    const i = CUSTOMER_NAV_ITEMS.findIndex(x => x.key === 'orders');
    CUSTOMER_NAV_ITEMS.splice(i === -1 ? 2 : i, 0, { key: 'cart', label: 'Cart', icon: '🛒' });
    CUSTOMER_SECTIONS.cart = () => `<div class="dash-header"><div><div class="dash-title">${e(t('Your cart'))}</div></div></div><div id="cart-section-body">${cartHTML(null)}</div>`;
    const _sel = selectCustomerSection;
    selectCustomerSection = function (key) { const r = _sel.apply(this, arguments); if (key === 'cart') refreshShown(); return r; };
  }

  // Signing in, out, or as someone else: the cart follows the account.
  function sig() { return (typeof AUTH !== 'undefined' && AUTH.token ? AUTH.token.slice(-16) : '') + '|' + (me() ? me().id + me().role : ''); }
  setInterval(() => { const s = sig(); if (s !== C.sig) { C.sig = s; C.view = null; load(); } }, 1000);
  C.sig = sig(); load();
  window.addEventListener('storage', (ev) => { if (ev.key === LS && !isBuyer()) load(); }); // another tab
})();
