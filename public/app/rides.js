/* Trothen passenger rides (v111, Liberia first).
   Loaded after trothen.js. Adds a "Rides" page for riders, drivers and admins.
   Everything here talks to /api/rides/* (see src/routes/rides.routes.js). */
(function () {
  'use strict';
  const R = { cfg: null, drv: null, list: [], poll: null, hb: null, track: null, quote: null, over: null };
  const money = (n) => '$' + Number(n || 0).toFixed(2);
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const el = (id) => document.getElementById(id);
  const body = () => el('rides-body');
  const km = (x) => (x == null ? '' : x + ' km');
  // v142: a ride fare in local money (L$) with the US$ amount, when Trothen set the fare in L$; cash is paid in L$
  const fareL = (r, usd) => (r && r.local && r.local.per > 0 ? `${r.local.symbol}${Math.round(usd / r.local.per).toLocaleString()} (${money(usd)})` : money(usd));
  const when = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const STATUS_WORDS = { pending_agreement: 'Agreeing the fare', awaiting_payment: 'Waiting for payment', pending_provider_confirmation: 'Waiting for the driver to answer', active: 'Confirmed', completed: 'Finished', cancelled: 'Cancelled', declined: 'The driver said no', expired: 'No answer, refunded' };

  function section(title, sub) {
    return `<div class="dash-header"><div><div class="dash-title">${e(tr(title))}</div><div class="dash-sub">${e(tr(sub))}</div></div></div><div id="rides-body"><div class="panel">${e(tr('Loading…'))}</div></div>`;
  }
  // Every map in the app (job pin, trip view, handover, ride tracking) uses the
  // tile provider set by MAP_TILE_URL on the server, so changing provider never
  // needs a code change. Without that setting nothing is altered.
  (function patchTiles() {
    return; // v148: maps.js now sets the provider for every map (from /api/geo/map-config)
    const orig = window.loadLeaflet; if (typeof orig !== 'function') return;
    window.loadLeaflet = async function () {
      const ok = await orig.apply(this, arguments);
      try {
        if (ok && window.L && window.L.tileLayer && !window.L.tileLayer.__trothen) {
          const cfg = R.cfg || await loadConfig();
          const real = window.L.tileLayer;
          const wrapped = function (url, opts) {
            if (cfg && cfg.tileUrl && /tile\.openstreetmap\.org/.test(String(url)) && !/tile\.openstreetmap\.org/.test(cfg.tileUrl)) { url = cfg.tileUrl; opts = Object.assign({}, opts, { attribution: cfg.tileAttribution || (opts && opts.attribution) }); }
            return real.call(window.L, url, opts);
          };
          wrapped.__trothen = true; Object.keys(real).forEach(k => { wrapped[k] = real[k]; });
          window.L.tileLayer = wrapped;
        }
      } catch (e) { /* the default map still works */ }
      return ok;
    };
  })();
  async function loadConfig() { try { R.cfg = await apiFetch('GET', '/rides/config'); } catch (x) { R.cfg = null; } return R.cfg; }

  // ── menus ────────────────────────────────────────────────────────────
  function addNav(items, afterKey, item) {
    if (items.some(i => i.key === item.key)) return;
    const at = items.findIndex(i => i.key === afterKey);
    items.splice(at === -1 ? items.length : at + 1, 0, item);
  }
  let menuFor = null;
  async function checkRidesMenu() {
    if (!BACKEND_AVAILABLE || !AUTH.user || menuFor === AUTH.user.id + AUTH.user.role) return;
    const role = AUTH.user.role;
    if (role !== 'customer' && role !== 'provider') return;
    const cfg = await loadConfig();
    if (!cfg || !cfg.availableHere) return;
    menuFor = AUTH.user.id + role;
    if (role === 'customer') { addNav(CUSTOMER_NAV_ITEMS, 'bookings', { key: 'rides', label: 'Rides', icon: '🛵' }); rerenderNav('customer-nav', CUSTOMER_NAV_ITEMS, 'selectCustomerSection'); }
    else { addNav(PROVIDER_NAV_ITEMS, 'contracts', { key: 'rides', label: 'Rides', icon: '🛵' }); rerenderNav('provider-nav', PROVIDER_NAV_ITEMS, 'selectProviderSection'); inviteDriver(); }
  }
  // v114: a pro who has not applied (or has not finished) is invited to give rides. The sign-up box "I also want to
  // give rides" sends them straight to the application the first time they sign in.
  function inviteCard(st) {
    const word = st === 'rejected' ? 'Your ride driver application was not approved. Open Rides to see why and fix it.' : st === 'draft' ? 'You started a ride driver application. Finish it and send it for review.' : 'Earn more by giving rides to passengers. You need a driving licence and a vehicle, and the Trothen team checks your papers before you can start.';
    return `<div class="panel" id="rides-invite" style="border-left:4px solid var(--gold,#C9A227);display:flex;gap:12px;align-items:center;flex-wrap:wrap;"><div style="flex:1;min-width:220px;"><div class="panel-title" style="margin-bottom:4px;">🛵 ${e(tr('Give rides'))}</div><div style="font-size:14px;color:var(--slate);">${e(tr(word))}</div></div><button class="btn-sm btn-sm-primary" onclick="selectProviderSection('rides')">${e(tr(st === 'draft' || st === 'rejected' ? 'Open Rides' : 'See what is needed'))}</button></div>`;
  }
  async function inviteDriver() {
    let d; try { d = await apiFetch('GET', '/rides/driver/me'); } catch (x) { return; }
    if (!d || !d.availableHere || !['none', 'draft', 'rejected'].includes(d.status)) return;
    R.invite = d.status;
    let want = false; try { want = localStorage.getItem('trothen_want_rides') === '1'; if (want) localStorage.removeItem('trothen_want_rides'); } catch (x) { /* no storage: just show the card */ }
    if (want) return setTimeout(() => selectProviderSection('rides'), 400);
    const m = el('provider-main'), act = document.querySelector('#provider-nav .dash-nav-item.active');
    if (m && !el('rides-invite') && act && /overview/i.test(act.textContent)) m.insertAdjacentHTML('afterbegin', inviteCard(d.status));
  }
  function rerenderNav(id, items, fn) {
    const box = el(id); if (!box) return;
    const act = box.querySelector('.dash-nav-item.active');
    const it = (act && items.find(i => act.textContent.includes(i.label))) || items[0];
    renderDashNav(id, items, it.key, fn);
  }
  CUSTOMER_SECTIONS.rides = () => section('Rides', 'Get a safe ride from a verified driver');
  PROVIDER_SECTIONS.rides = () => section('Rides', 'Give rides to passengers');
  { const f = PROVIDER_SECTIONS.overview; PROVIDER_SECTIONS.overview = function () { const h = f.apply(this, arguments); return (R.invite ? inviteCard(R.invite) : '') + h; }; }
  if (typeof ADMIN_SECTIONS !== 'undefined') ADMIN_SECTIONS.rides = () => section('Rides', 'Drivers, safety alerts and where rides are on');

  { const f = selectCustomerSection; selectCustomerSection = function (key) { stopTimers(); const r = f.apply(this, arguments); if (key === 'rides') loadRiderPage(); return r; }; }
  { const f = selectProviderSection; selectProviderSection = function (key) { stopTimers(); const r = f.apply(this, arguments); if (key === 'rides') loadDriverPage(); return r; }; }
  { const f = selectAdminSection; selectAdminSection = function (key) { stopTimers(); const r = f.apply(this, arguments); if (key === 'rides') loadAdminRides(); return r; }; }
  { const f = getAdminNavItems; getAdminNavItems = function () { const items = f.apply(this, arguments).slice(); const u = AUTH.user || {}; if (!u.adminDepartment || ['verification', 'customer_service'].includes(u.adminDepartment)) addNav(items, 'stores', { key: 'rides', label: 'Rides', icon: '🛵' }); return items; }; }
  // The dashboards are started through a saved reference, so hook the sidebar update every start-up calls by name.
  { const f = updateCustomerSidebar; updateCustomerSidebar = function () { const r = f.apply(this, arguments); checkRidesMenu(); return r; }; }
  { const f = updateProviderSidebar; updateProviderSidebar = function () { const r = f.apply(this, arguments); checkRidesMenu(); return r; }; }

  // v125: live updates (live.js) call this when a ride changes. A rider still choosing a driver isn't disturbed.
  window.ridesRefresh = function () {
    if (!body()) return;
    const role = AUTH.user && AUTH.user.role;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && String(a.value || '').trim() && body().contains(a)) return; // typing a PIN or a fare: wait
    if (role === 'provider') { stopTimers(); loadDriverPage(); }
    else if (role === 'customer') {
      const hasOpen = (R.list || []).some(r => ['active', 'pending_provider_confirmation', 'pending_agreement', 'awaiting_payment'].includes(r.status));
      if (hasOpen) { stopTimers(); loadRiderPage(); } // a rider filling in "Where to?" is never redrawn under them
    }
  };
  function stopTimers() { clearInterval(R.poll); clearInterval(R.hb); clearInterval(R.track); R.poll = R.hb = R.track = null; }
  function here() { return new Promise(res => { getBestLocation({ goodEnoughM: 80, maxWaitMs: 8000 }).then(r => res(r && !r.error ? r : null)).catch(() => res(null)); }); }


  // ── RIDE RULES: must be accepted before a first ride or application ───
  async function ensureRules() {
    let st; try { st = await apiFetch('GET', '/rides/rules'); } catch (x) { showToast(x.message || 'Could not load the rules'); return false; }
    if (st.accepted) return true;
    return new Promise(resolve => {
      window._rulesDone = (yes) => { v105Close('rules-overlay'); resolve(yes); };
      v105Overlay('rules-overlay', `<div class="modal-header"><button class="modal-close" onclick="_rulesDone(false)" aria-label="Close">✕</button><h3>${e(tr('Ride Rules'))}</h3><p>${e(tr('Please read these before you continue.'))}</p></div>
        <div class="modal-body" style="overflow:auto;flex:1 1 auto;min-height:0;"><div style="white-space:pre-wrap;font-size:14.5px;line-height:1.6;">${e(st.text)}</div>
        <label style="display:flex;gap:8px;align-items:flex-start;margin-top:14px;"><input type="checkbox" id="rules-ok" style="margin-top:4px;"/> <span>${e(tr('I have read the Ride Rules and I accept them.'))}</span></label></div>
        <div class="modal-footer" style="display:flex;gap:10px;"><button class="btn-sm btn-sm-outline" style="flex:1;" onclick="_rulesDone(false)">${e(tr('Not now'))}</button><button class="confirm-btn" style="flex:2;" onclick="ridesAcceptRules(${st.version})">${e(tr('Accept and continue'))}</button></div>`, 640);
    });
  }
  window.ridesAcceptRules = async function (version) {
    if (!el('rules-ok') || !el('rules-ok').checked) return showToast(tr('Tick the box to accept'));
    try { await apiFetch('POST', '/rides/rules/accept', { version }); window._rulesDone(true); } catch (x) { showToast(x.message || 'Could not save'); }
  };

  // ── RIDER ────────────────────────────────────────────────────────────
  async function loadRiderPage() {
    if (!body()) return;
    let list = [];
    try { list = (await apiFetch('GET', '/rides/mine')).rides; } catch (x) { body().innerHTML = `<div class="panel">${e(x.message || 'Could not load')}</div>`; return; }
    R.list = list;
    const open = list.find(r => ['active', 'pending_provider_confirmation', 'pending_agreement', 'awaiting_payment'].includes(r.status)); // v125
    const past = list.filter(r => r !== open);
    body().innerHTML = (open ? riderTrip(open) : riderForm()) + (past.length ? `<div class="panel"><div class="panel-title">${e(tr('Past rides'))}</div>${past.slice(0, 15).map(pastRow).join('')}</div>` : '');
    if (open) { R.poll = setInterval(() => { if (!body()) return stopTimers(); loadRiderPage(); }, 8000); } else { renderPins(); loadMyPlaces(); }
  }
  function pastRow(r) {
    return `<div style="padding:10px 0;border-top:1px solid var(--border);font-size:14px;"><strong>${e(r.pickup.address)}</strong>${r.pickup.note ? ` <span style="font-size:13px;color:var(--slate);">(📝 ${e(r.pickup.note)})</span>` : ''} → <strong>${e(r.dropoff.address)}</strong><div style="color:var(--slate);">${e(new Date(r.createdAt).toLocaleDateString())} · ${money(r.totalPaid)} · ${e(tr(STATUS_WORDS[r.status] || r.status))}</div></div>`;
  }
  // v147: the way ride apps in Africa do it: search a landmark by name
  // (Trothen's own list of known places first), or tap Home, Work or a
  // recent place, or use GPS, or choose on a map. Then a note for the driver.
  function pinBox(prefix, label) {
    return `<div class="form-group"><label class="form-label" for="${prefix}-q">${e(tr(label))}</label>
      <input class="form-input" id="${prefix}-q" type="search" autocomplete="off" placeholder="${e(tr('Search a place, e.g. ELWA Junction, Red Light, JFK'))}" oninput="ridesPlaceSearch('${prefix}')"/>
      <div id="${prefix}-hits" style="margin-top:6px;"></div>
      <div id="${prefix}-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><button type="button" class="btn-sm btn-sm-outline" id="${prefix}-pin-btn" onclick="pinJobLocation('${prefix}')">📍 ${e(tr('Use my location'))}</button><button type="button" class="btn-sm btn-sm-outline" onclick="openMapPicker('${prefix}')">🗺️ ${e(tr('Choose on a map'))}</button></div>
      <div id="${prefix}-pin-status" style="font-size:13.5px;margin-top:8px;" aria-live="polite"></div>
      <input class="form-input" id="${prefix}-name" maxlength="120" placeholder="${e(tr('Name of the place, e.g. Red Light Market'))}" style="margin-top:8px;"/>
      ${prefix === 'ridefrom' ? `<input class="form-input" id="ridefrom-note" maxlength="140" placeholder="${e(tr('Note for the driver (optional), e.g. blue gate, I\'m wearing red'))}" style="margin-top:8px;"/>` : ''}
      <button type="button" class="btn-sm btn-sm-ghost" style="margin-top:6px;" onclick="ridesSavePlace('${prefix}')">☆ ${e(tr('Save this place'))}</button></div>`;
  }
  R.places = null;
  async function loadMyPlaces() {
    try { R.places = await apiFetch('GET', '/places/mine'); } catch (x) { R.places = { saved: [], recent: [] }; }
    for (const prefix of ['ridefrom', 'rideto']) {
      const box = el(prefix + '-chips'); if (!box) continue;
      const chip = (label, p, icon) => `<button type="button" class="btn-sm btn-sm-outline" style="font-size:13px;" onclick='ridesUsePlace(${JSON.stringify(prefix)}, ${JSON.stringify({ name: p.name, latitude: p.latitude, longitude: p.longitude, note: p.note || '' }).replace(/'/g, '&#39;')})'>${icon} ${e(label)}</button>`;
      box.innerHTML = (R.places.saved || []).map(p => chip(p.label, p, /home/i.test(p.label) ? '🏠' : /work|office/i.test(p.label) ? '💼' : '⭐')).join('') + (R.places.recent || []).slice(0, 3).map(p => chip(p.name, p, '🕘')).join('');
    }
  }
  window.ridesUsePlace = function (prefix, p) {
    JOB_PIN[prefix] = { latitude: p.latitude, longitude: p.longitude, accuracyM: null, source: 'place', at: Date.now() };
    const n = el(prefix + '-name'); if (n) n.value = p.name;
    const q = el(prefix + '-q'); if (q) q.value = '';
    const h = el(prefix + '-hits'); if (h) h.innerHTML = '';
    if (prefix === 'ridefrom' && p.note && el('ridefrom-note') && !el('ridefrom-note').value) el('ridefrom-note').value = p.note;
    if (typeof renderJobPin === 'function') renderJobPin(prefix);
  };
  let searchT = null;
  window.ridesPlaceSearch = function (prefix) {
    clearTimeout(searchT);
    searchT = setTimeout(async () => {
      const q = (el(prefix + '-q').value || '').trim(), box = el(prefix + '-hits');
      if (q.length < 2) { box.innerHTML = ''; return; }
      let r = { saved: [], places: [] }, osm = [];
      try { r = await apiFetch('GET', `/places/search?q=${encodeURIComponent(q)}`); } catch (x) {}
      if (!r.places.length && !r.saved.length) { try { osm = ((await apiFetch('GET', `/geo/place-search?q=${encodeURIComponent(q)}`)).places || []).map(p => ({ name: p.name.split(',').slice(0, 2).join(','), latitude: p.latitude, longitude: p.longitude, kind: 'map' })); } catch (x) {} }
      const all = [...r.saved.map(p => ({ ...p, name: p.name, sub: p.label, icon: '⭐' })), ...r.places.map(p => ({ ...p, sub: p.area, icon: '📌' })), ...osm.map(p => ({ ...p, sub: tr('from the map'), icon: '🗺️' }))].slice(0, 8);
      box.innerHTML = all.length ? `<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">${all.map(p => `<button type="button" style="display:flex;gap:8px;width:100%;text-align:left;background:var(--white);border:0;border-bottom:1px solid var(--border);padding:9px 12px;cursor:pointer;" onclick='ridesUsePlace(${JSON.stringify(prefix)}, ${JSON.stringify({ name: p.name, latitude: p.latitude, longitude: p.longitude, note: p.note || '' }).replace(/'/g, '&#39;')})'><span>${p.icon}</span><span><strong style="color:var(--navy);">${e(p.name)}</strong>${p.sub ? `<span style="display:block;font-size:12.5px;color:var(--slate);">${e(p.sub)}</span>` : ''}</span></button>`).join('')}</div>`
        : `<div style="font-size:13px;color:var(--slate);">${e(tr('Not found. Use your location or choose it on the map, then type its name.'))}</div>`;
    }, 250);
  };
  window.ridesSavePlace = async function (prefix) {
    const pin = JOB_PIN[prefix]; if (!pin) return showToast(tr('Set the place first: search it, use your location or choose it on the map'));
    const name = (el(prefix + '-name').value || '').trim();
    const label = (R.places && !(R.places.saved || []).some(p => /^home$/i.test(p.label))) ? 'Home' : (name || 'Saved place');
    const box = el(prefix + '-chips');
    if (!el(prefix + '-savelabel')) {
      box.insertAdjacentHTML('afterend', `<div id="${prefix}-saverow" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;"><input class="form-input" id="${prefix}-savelabel" maxlength="30" value="${e(label)}" style="max-width:180px;padding:6px 10px;"/><button type="button" class="btn-sm btn-sm-primary" onclick="ridesSavePlaceGo('${prefix}')">${e(tr('Save'))}</button></div>`);
      el(prefix + '-savelabel').focus(); return;
    }
  };
  window.ridesSavePlaceGo = async function (prefix) {
    const pin = JOB_PIN[prefix]; if (!pin) return;
    try {
      await apiFetch('POST', '/places/mine', { label: el(prefix + '-savelabel').value, name: (el(prefix + '-name').value || '').trim(), latitude: pin.latitude, longitude: pin.longitude, note: prefix === 'ridefrom' ? (el('ridefrom-note') || {}).value || '' : '' });
      const row = el(prefix + '-saverow'); if (row) row.remove();
      showToast(tr('Saved. It shows as a button next time.'));
      loadMyPlaces();
    } catch (x) { showToast(x.message || tr('Could not save')); }
  };
  function renderPins() { for (const p of ['ridefrom', 'rideto']) if (typeof renderJobPin === 'function') renderJobPin(p); }
  function riderForm() {
    if (R.cfg && !R.cfg.availableHere) return `<div class="panel"><div class="ver-note">${e(tr('Rides are not available in your country yet.'))}</div></div>`;
    return `<div class="panel"><div class="panel-title">${e(tr('Where to?'))}</div>
      <div class="ver-note" style="margin-bottom:12px;">${e(tr('Your money is held safely and is only paid to the driver when you confirm you arrived. You get a 4-digit PIN: give it to the driver only when you have checked the plate number.'))}</div>
      ${pinBox('ridefrom', 'Pick me up at')}${pinBox('rideto', 'Take me to')}
      <div class="form-group"><label class="form-label" for="ride-pax">${e(tr('Passengers'))}</label><select class="form-input form-select" id="ride-pax">${[1, 2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join('')}</select></div>
      <button class="confirm-btn" onclick="ridesFindDrivers()">${e(tr('Find drivers near me'))}</button>
      <div id="ride-drivers" style="margin-top:14px;"></div></div>`;
  }
  window.ridesFindDrivers = async function () {
    if (!(await ensureRules())) return;
    const a = JOB_PIN.ridefrom, b = JOB_PIN.rideto, out = el('ride-drivers');
    if (!a || !b) return showToast(tr('Pin where you are and where you are going first'));
    out.textContent = tr('Looking for drivers…');
    try {
      const pax = Number(el('ride-pax').value) || 1;
      const r = await apiFetch('GET', `/rides/drivers?pLat=${a.latitude}&pLng=${a.longitude}&dLat=${b.latitude}&dLng=${b.longitude}&passengers=${pax}`);
      R.quote = { a, b, pax, an: (el('ridefrom-name').value || '').trim() || 'Pickup', bn: (el('rideto-name').value || '').trim() || 'Destination', note: ((el('ridefrom-note') || {}).value || '').trim(), fee: r.feePercent, appPay: r.appPay !== false, payMode: r.payMode };
      if (!r.drivers.length) { out.innerHTML = `<div class="ver-note">${e(tr('No drivers are online near you right now. Try again in a few minutes.'))}</div>`; return; }
      R.floorPct = r.offerFloorPercent; // v142
      R.localOf = {}; r.drivers.forEach(d => { if (d.fareLocal != null && d.fareLocal > 0) R.localOf[d.id] = { per: d.fare / d.fareLocal, symbol: d.symbol || '' }; }); // offers can be typed in L$
      const tf = r.trothenFares || {}, tfKeys = Object.keys(tf);
      const head = tfKeys.length
        ? `<div style="font-size:13.5px;margin-bottom:6px;"><span style="color:var(--slate);">${e(tr('About'))} ${e(km(r.tripKm))}${r.tripMinutes ? `, ${e(r.tripMinutes)} ${e(tr('min'))}` : ''}${r.routeSource === 'road' ? ` ${e(tr('by road'))}` : ''}.</span> <strong>${e(tr('Trothen fare'))}:</strong> ${tfKeys.map(v => `${e(tr(v))} ${e(tf[v].symbol || '')}${e(Number(tf[v].local).toLocaleString())} (${money(tf[v].fare)})`).join(' · ')}<div style="color:var(--slate);font-size:12.5px;">${e(tr('Worked out from the distance and time, the same for every rider. Drivers can be a little above or below it, never more.'))}</div></div>`
        : `<div style="color:var(--slate);font-size:13.5px;margin-bottom:6px;">${e(tr('About'))} ${e(km(r.tripKm))}. ${e(tr('Fares are estimates from the distance; the driver sets their own price.'))}</div>`;
      out.innerHTML = head + r.drivers.map(d => `
        <div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--border);flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;"><div style="font-weight:700;color:var(--navy);">${e(d.name)} <span style="font-weight:400;color:var(--slate);">· ${d.rating ? '★ ' + e(d.rating) : e(tr('New'))}</span></div>
          <div style="font-size:13.5px;color:var(--slate);">${e(tr(d.vehicle))}${d.make ? ' · ' + e(d.make) : ''} · ${e(km(d.awayKm))} ${e(tr('away'))}${d.helmet ? ' · ' + e(tr('helmet provided')) : ''}</div></div>
          <div style="text-align:right;"><div style="font-weight:700;font-size:18px;">${d.fareLocal != null ? `${e(d.symbol || '')}${e(Number(d.fareLocal).toLocaleString())}</div><div style="font-size:13px;">${money(d.fare)}` : money(d.fare)}</div>${d.fareAdjust ? `<div style="font-size:12px;color:${d.fareAdjust > 0 ? '#8a5a00' : '#1E7A55'};">${Math.abs(d.fareAdjust)}% ${e(tr(d.fareAdjust > 0 ? 'above' : 'below'))} ${e(tr('Trothen fare'))}</div>` : (d.fareSource === 'trothen' ? `<div style="font-size:12px;color:#1E7A55;">${e(tr('Trothen fare'))}</div>` : '')}<div style="font-size:12px;color:var(--slate);">+ ${e(r.feePercent)}% ${e(tr('Trothen fee'))}</div></div>
          <div style="display:flex;flex-direction:column;gap:6px;">${r.appPay !== false ? `<button class="btn-sm btn-sm-primary" onclick="ridesRequest(${jsArg(d.id)},${d.fare},'app')">${e(tr('Request'))} · ${e(tr(r.payMode === 'card' ? 'pay by card' : 'pay in app'))}</button>` : ''}
          ${d.cashOk ? `<button class="btn-sm btn-sm-outline" onclick="ridesRequest(${jsArg(d.id)},${d.fare},'cash')">💵 ${e(tr('Pay cash'))}</button><div style="font-size:11.5px;color:var(--slate);max-width:120px;">${e(tr('no Trothen fee'))}</div>` : ''}
          ${r.appPay === false && !d.cashOk ? `<div style="font-size:12px;color:var(--slate);max-width:150px;">${e(tr('Paying in the app isn\'t available here yet, and this driver doesn\'t take cash.'))}</div>` : ''}</div>
          ${r.appPay !== false || d.cashOk ? `<div style="flex-basis:100%;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13.5px;"><span>${e(tr('Or offer your own fare:'))}</span><input class="form-input" type="number" min="1" step="0.5" id="ride-offer-${e(d.id)}" placeholder="${e(d.fareLocal != null ? (d.symbol || '') : '$')}" style="width:100px;"/>${r.offerFloorPercent != null ? `<span style="font-size:12px;color:var(--slate);">${e(tr('at least'))} ${d.fareLocal != null ? `${e(d.symbol || '')}${e(Math.ceil(d.fareLocal * r.offerFloorPercent / 100 / 5) * 5)}` : money(Math.ceil(d.fare * r.offerFloorPercent) / 100)}</span>` : ''}
            ${r.appPay !== false ? `<button class="btn-sm btn-sm-outline" onclick="ridesOffer(${jsArg(d.id)},'app')">${e(tr('Offer'))}</button>` : ''}${d.cashOk ? `<button class="btn-sm btn-sm-outline" onclick="ridesOffer(${jsArg(d.id)},'cash')">💵 ${e(tr('Offer, pay cash'))}</button>` : ''}</div>` : ''}
        </div>`).join('') + (r.appPay === false ? `<div class="ver-note" style="margin-top:8px;">${e(tr('Paying for rides in the app isn\'t switched on in your country yet, so rides are paid to the driver in cash.'))}</div>` : '');
    } catch (x) { out.innerHTML = `<div class="ver-note">${e(x.message || 'Could not find drivers')}</div>`; }
  };
  // v125: a clear pay step: the fare, the fee and the total, and how it's paid.
  function rideFee(amount) { const pct = Number(R.quote && R.quote.fee != null ? R.quote.fee : (R.cfg && R.cfg.feePercent) || 9); return Math.round(Math.max(0.25, amount * pct / 100) * 100) / 100; }
  async function rideCheckout({ title, sub, price, cash, onConfirm }) {
    if (typeof openCheckout !== 'function') return onConfirm();
    return openCheckout({ title, sub, price, priceLabel: tr('Fare'), cash, ride: true, fee: cash ? 0 : rideFee(price), feeNote: (R.quote && R.quote.fee != null ? R.quote.fee : (R.cfg && R.cfg.feePercent) || 9) + '%', onConfirm });
  }
  window.ridesRequest = async function (driverId, fare, payment) {
    const q = R.quote; if (!q) return;
    const cash = payment === 'cash';
    rideCheckout({ title: tr('Request this ride'), sub: `${q.an} → ${q.bn}`, price: fare, cash, onConfirm: async () => {
      try {
        const res = await apiFetch('POST', '/rides', { driverId, passengers: q.pax, expectedFare: fare, payment: cash ? 'cash' : 'app', pickup: { latitude: q.a.latitude, longitude: q.a.longitude, address: q.an, note: q.note || '' }, dropoff: { latitude: q.b.latitude, longitude: q.b.longitude, address: q.bn } });
        const c = el('checkout'); if (c) c.remove();
        if (typeof handlePaymentStep === 'function' && handlePaymentStep(res && res.payment)) return;
        if (typeof showResult === 'function') showResult({ icon: '🛵', title: tr('Ride requested'), lines: [cash ? tr('Pay the driver in cash at the end of the trip, exactly the fare shown.') : tr('Your fare is held by Trothen and only paid to the driver when you confirm you arrived.'), tr('Waiting for the driver to answer. You\'ll see it here the moment they do.')] });
        loadRiderPage();
      } catch (x) { const c = el('checkout'); if (c) c.remove(); showToast(x.message || 'Could not request the ride'); if (x.data && (x.data.code === 'PRICE_CHANGED' || x.data.code === 'CASH_NOT_AVAILABLE')) window.ridesFindDrivers(); }
    } });
  };
  // Offer your own fare (the driver accepts, suggests another, or declines).
  window.ridesOffer = async function (driverId, payment) {
    const q = R.quote; if (!q) return;
    const typed = Number((el('ride-offer-' + driverId) || {}).value);
    const lc = R.localOf && R.localOf[driverId]; // v142: typed in local money (L$), sent in US$
    const amount = lc ? Math.round(typed * lc.per * 100) / 100 : typed;
    if (!(typed > 0) || !(amount >= 0.25)) return showToast(tr('Type the fare you want to offer'));
    try {
      await apiFetch('POST', '/rides', { driverId, passengers: q.pax, offerFare: amount, payment: payment === 'cash' ? 'cash' : 'app', pickup: { latitude: q.a.latitude, longitude: q.a.longitude, address: q.an, note: q.note || '' }, dropoff: { latitude: q.b.latitude, longitude: q.b.longitude, address: q.bn } });
      if (typeof showResult === 'function') showResult({ icon: '📨', title: tr('Fare offered'), lines: [`${tr('You offered')} ${lc ? lc.symbol + typed.toLocaleString() + ' (' + money(amount) + ')' : money(amount)}.`, tr('The driver can accept it, suggest a different fare, or decline, within a few minutes. You\'ll see the answer here straight away.'), tr('Nothing is paid until you both agree the fare.')] });
      loadRiderPage();
    } catch (x) { showToast(x.message || 'Could not send your offer'); }
  };
  // Accept the driver's suggested fare.
  window.ridesAgree = function (id) {
    const r = (R.list || []).find(x => x.id === id); if (!r) return;
    rideCheckout({ title: tr('Accept the driver\'s fare'), sub: `${r.pickup.address} → ${r.dropoff.address}`, price: r.fare, cash: r.cash, onConfirm: async () => {
      try {
        const res = await apiFetch('POST', `/contracts/${encodeURIComponent(id)}/agree`, { amount: r.fare });
        const c = el('checkout'); if (c) c.remove();
        if (typeof handlePaymentStep === 'function' && handlePaymentStep(res && res.payment)) return;
        if (typeof showResult === 'function') showResult({ title: tr('Fare agreed'), lines: [r.cash ? tr('Pay the driver in cash at the end of the trip.') : tr('Trothen is holding your fare until you confirm you arrived.'), tr('Your driver is on the way. Your PIN is on this page.')] });
        loadRiderPage();
      } catch (x) { const c = el('checkout'); if (c) c.remove(); showToast(x.message || 'Could not accept'); loadRiderPage(); }
    } });
  };
  // Pay a fare the driver accepted.
  window.ridesPay = function (id) {
    const r = (R.list || []).find(x => x.id === id); if (!r) return;
    rideCheckout({ title: tr('Pay for your ride'), sub: `${r.pickup.address} → ${r.dropoff.address}`, price: r.fare, cash: false, onConfirm: async () => {
      try {
        const res = await apiFetch('POST', `/contracts/${encodeURIComponent(id)}/pay`, { total: r.totalPaid });
        const c = el('checkout'); if (c) c.remove();
        if (typeof handlePaymentStep === 'function' && handlePaymentStep(res && res.payment)) return;
        if (typeof showResult === 'function') showResult({ title: tr('Paid'), lines: [tr('Your fare is held by Trothen until you confirm you arrived. Your driver is on the way.')] });
        loadRiderPage();
      } catch (x) { const c = el('checkout'); if (c) c.remove(); showToast(x.message || 'Could not pay'); loadRiderPage(); }
    } });
  };
  // Suggest a different fare (rider or driver).
  window.ridesSuggest = function (id) {
    const r = (R.list || []).find(x => x.id === id); if (!r) return;
    v105Overlay('ride-suggest', `<div class="modal-header"><button class="modal-close" onclick="v105Close('ride-suggest')" aria-label="Close">✕</button><h3>${e(tr('Suggest a fare'))}</h3><p>${e(r.pickup.address)} → ${e(r.dropoff.address)} · ${e(km(r.km))}</p></div>
      <div class="modal-body"><div class="summary-row"><span>${e(tr('Fare on the table now'))}</span><span><strong>${r.local ? `${e(r.local.symbol)}${e(Math.round(r.fare / r.local.per).toLocaleString())} · ` : ''}${money(r.fare)}</strong></span></div>
      <div class="form-group" style="margin-top:10px;"><label class="form-label" for="rs-amount">${e(tr('Your fare'))} (${e(r.local ? r.local.symbol : '$')})</label><input class="form-input" type="number" min="0" step="${r.local ? 5 : 0.5}" id="rs-amount"/></div></div>
      <div class="modal-footer"><button class="confirm-btn" onclick="ridesSendSuggest(${jsArg(id)})">${e(tr('Send'))}</button></div>`);
  };
  window.ridesSendSuggest = async function (id) {
    const r = (R.list || []).find(x => x.id === id); const typed = Number((el('rs-amount') || {}).value);
    const amount = r && r.local ? Math.round(typed * r.local.per * 100) / 100 : typed; // v142: typed in L$, sent in US$
    if (!(amount >= 0.25)) return showToast(tr('Type the fare'));
    try { await apiFetch('POST', `/contracts/${encodeURIComponent(id)}/propose`, { amount }); v105Close('ride-suggest'); showToast(tr('Sent')); (R.drv ? loadDriverPage : loadRiderPage)(); }
    catch (x) { showToast(x.message || 'Could not send'); }
  };
  function fareTalkHTML(r, viewer) {
    const lines = (r.negotiation || []).map((h, i, all) => `<div style="font-size:13.5px;${i === all.length - 1 ? 'font-weight:700;color:var(--navy);' : 'color:var(--slate);'}">${e(h.by === viewer ? tr('You') : (h.by === 'provider' ? tr('Driver') : tr('Rider')))} ${e(tr(i === 0 ? 'offered' : 'suggested'))} ${money(h.amount)}</div>`).join('');
    return `<div style="margin:8px 0;padding:8px 10px;background:var(--offwhite, #F6F4EF);border-radius:8px;">${r.driverFare && viewer === 'customer' ? `<div style="font-size:12.5px;color:var(--slate);">${e(tr('Driver\'s usual fare'))}: ${money(r.driverFare)}</div>` : ''}${lines}</div>`;
  }

  function riderTrip(r) {
    const d = r.driver || {};
    if (r.status === 'pending_agreement' || r.status === 'awaiting_payment') { // v125
      const myTurn = r.status === 'pending_agreement' && r.waitingOn === 'customer';
      return `<div class="panel" style="border:2px solid var(--gold, #C9A227);">
        <div class="panel-title">${e(tr(r.status === 'awaiting_payment' ? 'Fare agreed: pay to confirm' : myTurn ? 'The driver suggests a fare' : 'Waiting for the driver to answer your fare'))} <small>#${e(r.number)}</small></div>
        <div style="font-size:15px;"><strong>${e(r.pickup.address)}</strong>${r.pickup.note ? ` <span style="font-size:13px;color:var(--slate);">(📝 ${e(r.pickup.note)})</span>` : ''} → <strong>${e(r.dropoff.address)}</strong> · ${e(km(r.km))} · ${e(d.name || '')}</div>
        ${r.negotiation ? fareTalkHTML(r, 'customer') : ''}
        ${r.answerBy && r.status === 'pending_agreement' ? `<div class="ver-note">${e(tr(myTurn ? 'Answer by' : 'The driver answers by'))} ${e(when(r.answerBy))}. ${e(tr('Nothing is paid until you both agree the fare.'))}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          ${myTurn ? `<button class="confirm-btn" style="max-width:280px;" onclick="ridesAgree(${jsArg(r.id)})">${e(tr('Accept'))} ${fareL(r, r.fare)}</button><button class="btn-sm btn-sm-outline" onclick="ridesSuggest(${jsArg(r.id)})">${e(tr('Suggest a fare'))}</button>` : ''}
          ${r.status === 'awaiting_payment' ? `<button class="confirm-btn" style="max-width:280px;" onclick="ridesPay(${jsArg(r.id)})">💳 ${e(tr('Pay'))} ${money(r.totalPaid)}</button>` : ''}
          ${r.canCancel ? `<button class="btn-sm btn-sm-outline" onclick="ridesCancel(${jsArg(r.id)})">${e(tr('Cancel'))}</button>` : ''}
        </div></div>`;
    }
    const waiting = r.status === 'pending_provider_confirmation';
    return `<div class="panel" style="border:2px solid ${r.sosCount ? '#C0392B' : 'var(--teal)'};">
      <div class="panel-title">${e(tr(waiting ? 'Waiting for your driver' : r.startedAt ? 'You are on your way' : 'Your driver is coming'))} <small>#${e(r.number)}</small></div>
      <div style="font-size:15px;"><strong>${e(r.pickup.address)}</strong>${r.pickup.note ? ` <span style="font-size:13px;color:var(--slate);">(📝 ${e(r.pickup.note)})</span>` : ''} → <strong>${e(r.dropoff.address)}</strong> · ${e(km(r.km))}</div>
      <div style="margin:10px 0;display:flex;gap:12px;align-items:center;">${d.profilePhotoUrl ? `<img src="${e(d.profilePhotoUrl)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;"/>` : `<div style="width:56px;height:56px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${e(d.initials || '?')}</div>`}
        <div><div style="font-weight:700;color:var(--navy);">${e(d.name || '')}</div><div style="font-size:14px;color:var(--slate);">${e(tr(d.vehicle || ''))}${d.make ? ' · ' + e(d.make) : ''}${d.helmet ? ' · ' + e(tr('helmet for you')) : ''}</div>
        ${d.plate ? `<div style="margin-top:4px;display:inline-block;border:2px solid #222;border-radius:6px;padding:2px 10px;font-weight:800;letter-spacing:1px;background:#FFE680;">${e(d.plate)}</div>` : ''}</div></div>
      ${waiting ? `<div class="ver-note">${e(tr('Answer due by'))} ${e(when(r.answerBy))}. ${e(tr('If there is no answer you are refunded automatically.'))}</div>` : ''}
      ${r.pin ? `<div style="text-align:center;margin:12px 0;padding:14px;border-radius:12px;background:#EEF8F3;"><div style="font-size:13px;color:var(--slate);">${e(tr('Your trip PIN. Check the plate, then give the driver this PIN.'))}</div><div style="font-size:44px;font-weight:800;letter-spacing:10px;color:var(--navy);">${e(r.pin)}</div></div>` : ''}
      ${r.status === 'active' ? `<div style="font-size:14px;margin:6px 0;">${r.live ? `📍 ${e(tr(r.phase === 'to_destination' ? 'On the way to your destination' : 'Driver is coming'))}${r.etaMinutes ? ' · ' + e(tr('about')) + ' ' + r.etaMinutes + ' ' + e(tr('min')) : ''}${r.stale ? ` · <span style="color:#B4472E;">${e(tr('no update for a while'))}</span>` : ''}` : e(tr('Waiting for the driver\'s location…'))}</div><button class="btn-sm btn-sm-primary" onclick="openTrack('ride',${jsArg(r.id)})">🗺️ ${e(tr('Watch on the map'))}</button>${contactRow(r.contact)}` : ''}
      ${r.cash ? `<div style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#FFF6DD;border:1px solid #E0A526;font-size:14px;">💵 <strong>${e(tr('Cash ride.'))}</strong> ${e(tr('Pay the driver exactly'))} <strong>${fareL(r, r.payInCash)}</strong> ${e(tr('at the end. Nothing is held by Trothen. If the driver asks for more, do not pay it. Report it here.'))}</div>` : ''}
      ${r.autoReleaseAt ? `<div class="ver-note" style="margin-top:8px;">${e(tr(r.cash ? 'Your driver says you have arrived. If you do nothing, this ride is closed as complete on' : 'Your driver says you have arrived. If you do nothing, the fare is released to the driver on'))} ${e(new Date(r.autoReleaseAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}. ${e(tr('If something was wrong, use Report a Problem on the booking before then.'))}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${r.canConfirm ? `<button class="confirm-btn" onclick="ridesConfirm(${jsArg(r.id)},${r.cash ? 'true' : 'false'})">✅ ${e(tr(r.cash ? 'I arrived safely and paid in cash' : 'I arrived safely, pay the driver'))}</button>` : ''}
        ${r.cash ? `<button class="btn-sm btn-sm-outline" onclick="ridesReport(${jsArg(r.id)})">📝 ${e(tr('Report a problem'))}</button>` : ''}
        ${r.shareUrl ? `<button class="btn-sm btn-sm-outline" onclick="ridesShare(${jsArg(r.shareUrl)})">🔗 ${e(tr('Share my trip'))}</button>` : ''}
        ${r.status === 'active' ? `<button class="btn-sm" style="background:#C0392B;color:#fff;" onclick="ridesSOS(${jsArg(r.id)})">🚨 ${e(tr('Emergency / SOS'))}</button>` : ''}
        ${r.canCancel ? `<button class="btn-sm btn-sm-outline" onclick="ridesCancel(${jsArg(r.id)})">${e(tr('Cancel ride'))}</button>` : ''}
      </div>
      <div class="ver-note" style="margin-top:10px;">${e(tr('Never get in if the plate or the driver does not match. Fare:'))} ${fareL(r, r.fare)} + ${money(r.fee)} ${e(tr('Trothen fee'))}.</div></div>`;
  }
  window.ridesReport = function (id) {
    v105Overlay('report-overlay', `<div class="modal-header"><button class="modal-close" onclick="v105Close('report-overlay')" aria-label="Close">✕</button><h3>${e(tr('Report a problem'))}</h3><p>${e(tr('Tell the Trothen team what happened on this ride.'))}</p></div>
      <div class="modal-body"><textarea class="form-input" id="report-note" rows="5" maxlength="500" placeholder="${e(tr('For example: the driver asked for more than the fare shown'))}"></textarea></div>
      <div class="modal-footer" style="display:flex;gap:10px;"><button class="btn-sm btn-sm-outline" style="flex:1;" onclick="v105Close('report-overlay')">${e(tr('Cancel'))}</button><button class="confirm-btn" style="flex:2;" onclick="ridesSendReport(${jsArg(id)})">${e(tr('Send'))}</button></div>`, 520);
  };
  window.ridesSendReport = async function (id) {
    try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/report`, { note: (el('report-note') || {}).value || '' }); v105Close('report-overlay'); showToast(tr('Thank you. The Trothen team has been told.')); }
    catch (x) { showToast(x.message || 'Could not send'); }
  };
  window.ridesConfirm = async function (id, cash) {
    if (!(await confirmDialog(cash ? tr('Confirm you arrived and paid the driver in cash?') : tr('Confirm you arrived? The driver is paid now.'), { confirmLabel: cash ? tr('Yes, I paid') : tr('Pay the driver') }))) return;
    try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/confirm`, {}); showToast(tr(cash ? 'Thank you. Ride complete.' : 'Thank you. The driver has been paid.')); loadRiderPage(); } catch (x) { showToast(x.message || 'Could not confirm'); }
  };
  window.ridesCancel = async function (id) {
    if (!(await confirmDialog(tr('Cancel this ride? Your money comes back.'), { confirmLabel: tr('Cancel ride'), danger: true }))) return;
    try { await apiFetch('POST', `/contracts/${encodeURIComponent(id)}/cancel`, { reason: 'customer_request' }); showToast(tr('Cancelled and refunded')); (R.drv ? loadDriverPage : loadRiderPage)(); } catch (x) { showToast(x.message || 'Could not cancel'); }
  };
  window.ridesShare = async function (path) {
    const url = location.origin + path;
    try { if (navigator.share) { await navigator.share({ title: 'Follow my trip', text: tr('Follow my Trothen ride live:'), url }); return; } } catch (x) { /* fall back to copy */ }
    try { await navigator.clipboard.writeText(url); showToast(tr('Link copied. Send it to someone you trust.')); } catch (x) { prompt(tr('Copy this link'), url); }
  };
  window.ridesSOS = async function (id) {
    if (!(await confirmDialog(tr('Send an emergency alert to the Trothen team? If you are in danger also call your local emergency number.'), { confirmLabel: tr('Send alert'), danger: true }))) return;
    const fix = await here();
    try { const r = await apiFetch('POST', `/rides/${encodeURIComponent(id)}/sos`, { latitude: fix ? fix.latitude : undefined, longitude: fix ? fix.longitude : undefined }); showToast(r.message || tr('Alert sent')); } catch (x) { showToast(x.message || 'Could not send the alert. Call your local emergency number.'); }
  };

  // ── DRIVER ───────────────────────────────────────────────────────────
  async function loadDriverPage() {
    if (!body()) return;
    let d, list = [];
    try { d = await apiFetch('GET', '/rides/driver/me'); list = (await apiFetch('GET', '/rides/mine')).rides; } catch (x) { body().innerHTML = `<div class="panel">${e(x.message || 'Could not load')}</div>`; return; }
    R.drv = d; R.list = list;
    if (!d.availableHere) { body().innerHTML = `<div class="panel"><div class="ver-note">${e(tr('Rides are not open in your country yet.'))}</div></div>`; return; }
    let html = '';
    if (d.status === 'approved') html += driverOps(d, list) + driverPass(d) + driverRates(d);
    else html += driverApply(d);
    const past = list.filter(r => !['active', 'pending_provider_confirmation', 'pending_agreement', 'awaiting_payment'].includes(r.status)); // v125
    if (past.length) html += `<div class="panel"><div class="panel-title">${e(tr('Past rides'))}</div>${past.slice(0, 15).map(pastRow).join('')}</div>`;
    body().innerHTML = html;
    if (d.status === 'approved') {
      R.poll = setInterval(() => { if (!body()) return stopTimers(); loadDriverPage(); }, 10000);
      if (d.online) R.hb = setInterval(async () => { const f = await here(); if (f) apiFetch('POST', '/rides/driver/online', { online: true, latitude: f.latitude, longitude: f.longitude }).catch(() => {}); }, 120000);
    }
  }
  function driverApply(d) {
    const locked = d.status === 'pending';
    const need = d.requiredDocs || ['licence', 'registration', 'vehicle'];
    const docRow = (k) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;"><span style="flex:1;min-width:200px;">${e(tr((d.docKinds || {})[k] || k))} <small style="color:${need.includes(k) ? '#B4472E' : 'var(--slate)'};">${e(tr(need.includes(k) ? 'required' : 'optional'))}</small> ${d.docs[k] ? '✅' : ''}</span>${locked ? '' : `<input type="file" accept="image/*,application/pdf" id="rd-doc-${k}" style="display:none" onchange="ridesUploadDoc('${k}',this)"/><button class="btn-sm btn-sm-outline" onclick="el_('rd-doc-${k}').click()">${e(tr(d.docs[k] ? 'Replace' : 'Upload'))}</button>`}</div>`;
    return `<div class="panel"><div class="panel-title">${e(tr('Become a ride driver'))}</div>
      ${d.status === 'pending' ? `<div class="ver-note" style="border-left:3px solid #8C6423;">${e(tr('Your application is being reviewed by the Trothen team. We will tell you as soon as it is done.'))}</div>` : ''}
      ${d.status === 'rejected' ? `<div class="ver-note" style="border-left:3px solid #C0392B;">${e(tr('Not approved:'))} ${e(d.rejectReason || '')}. ${e(tr('Fix this and apply again.'))}</div>` : ''}
      ${d.status === 'suspended' ? `<div class="ver-note" style="border-left:3px solid #C0392B;">${e(tr('Your ride driving is paused:'))} ${e(d.rejectReason || '')}</div>` : ''}
      <div class="ver-note" style="margin-bottom:12px;">${e(tr('To keep riders safe, an admin checks your licence and your vehicle before you can take rides. Your documents are private.'))}</div>
      <div class="dates-row">
        <div class="form-group"><label class="form-label" for="rd-vehicle">${e(tr('Vehicle'))}</label><select class="form-input form-select" id="rd-vehicle" onchange="ridesVehicleChanged()" ${locked ? 'disabled' : ''}>${Object.keys(d.vehicles).map(v => `<option value="${v}" ${v === d.vehicle ? 'selected' : ''}>${e(tr(v))} (${d.vehicles[v]} ${e(tr('seats'))})</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="rd-make">${e(tr('Make / colour'))}</label><input class="form-input" id="rd-make" maxlength="40" value="${e(d.make)}" placeholder="Honda, red" ${locked ? 'disabled' : ''}/></div>
        <div class="form-group"><label class="form-label" for="rd-plate">${e(tr('Number plate'))}</label><input class="form-input" id="rd-plate" maxlength="15" value="${e(d.plate)}" ${locked ? 'disabled' : ''}/></div>
      </div>
      <div class="dates-row">
        <div class="form-group"><label class="form-label" for="rd-lic">${e(tr("Driver's licence number"))}</label><input class="form-input" id="rd-lic" maxlength="30" value="${e(d.licenceNumber)}" ${locked ? 'disabled' : ''}/></div>
        <div class="form-group"><label class="form-label" for="rd-exp">${e(tr('Licence expires'))}</label><input class="form-input" type="date" id="rd-exp" value="${e(d.licenceExpiry)}" ${locked ? 'disabled' : ''}/></div>
        <div class="form-group"><label class="form-label" for="rd-ins">${e(tr('Insurance or road permit expires'))}${need.includes('insurance') ? '' : ' (' + e(tr('optional')) + ')'}</label><input class="form-input" type="date" id="rd-ins" value="${e(d.insuranceExpiry || '')}" ${locked ? 'disabled' : ''}/><div class="ver-note" style="margin-top:4px;">${e(tr('We remind you a week before it runs out. If it expires you go offline until you update it.'))}</div></div>
        ${need.includes('roadworthy') ? `<div class="form-group"><label class="form-label" for="rd-rw">${e(tr('Roadworthiness certificate expires'))}</label><input class="form-input" type="date" id="rd-rw" value="${e(d.roadworthyExpiry || '')}" ${locked ? 'disabled' : ''}/></div>` : ''}
      </div>
      <div class="ver-note" id="rd-need" style="margin-bottom:10px;">${e(tr('Papers needed for your vehicle:'))} <strong>${need.map(k => e(tr((d.docKinds || {})[k] || k))).join(', ')}</strong>. ${e(tr('The list depends on your country and vehicle. Save your details to update it.'))}</div>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0 12px;"><input type="checkbox" id="rd-helmet" ${d.helmet ? 'checked' : ''} ${locked ? 'disabled' : ''}/> ${e(tr('I carry a helmet for the passenger (motorbike riders)'))}</label>
      ${locked ? '' : `<button class="btn-sm btn-sm-primary" onclick="ridesSaveApply()">${e(tr('Save details'))}</button>`}
      <div style="margin-top:14px;font-weight:700;color:var(--navy);">${e(tr('Documents'))}</div>${need.map(docRow).join('')}
      ${(() => { const rest = Object.keys(d.docKinds || {}).filter(k => !need.includes(k)); return rest.length ? `<details style="margin-top:6px;"><summary style="cursor:pointer;color:var(--slate);">${e(tr('Add other documents (optional)'))}</summary>${rest.map(docRow).join('')}</details>` : ''; })()}
      ${locked || d.status === 'none' ? '' : `<button class="confirm-btn" style="margin-top:12px;" onclick="ridesSubmitApply()">${e(tr('Send for review'))}</button>`}</div>`;
  }
  window.el_ = (id) => document.getElementById(id);
  window.ridesSaveApply = async function () {
    if (!(await ensureRules())) return;
    try {
      await apiFetch('POST', '/rides/driver/apply', { vehicle: el('rd-vehicle').value, make: el('rd-make').value, plate: el('rd-plate').value, licenceNumber: el('rd-lic').value, licenceExpiry: el('rd-exp').value, insuranceExpiry: el('rd-ins') ? el('rd-ins').value : undefined, roadworthyExpiry: el('rd-rw') ? el('rd-rw').value : undefined, helmet: el('rd-helmet').checked });
      showToast(tr('Saved. Now upload your documents.')); loadDriverPage();
    } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.ridesVehicleChanged = function () {
    const d = R.drv, box = el('rd-need'); if (!d || !box || !d.requiredByVehicle) return;
    const list = d.requiredByVehicle[el('rd-vehicle').value] || [];
    box.innerHTML = e(tr('Papers needed for your vehicle:')) + ' <strong>' + list.map(k => e(tr((d.docKinds || {})[k] || k))).join(', ') + '</strong>. ' + e(tr('Save your details to update the boxes below.'));
  };
  window.ridesUploadDoc = async function (kind, input) {
    const file = input.files && input.files[0]; input.value = ''; if (!file) return;
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(API_BASE + '/rides/driver/documents/' + kind, { method: 'POST', headers: { Authorization: 'Bearer ' + AUTH.token }, body: fd });
      const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || 'Upload failed');
      showToast(tr('Uploaded')); loadDriverPage();
    } catch (x) { showToast(x.message || 'Upload failed'); }
  };
  window.ridesSubmitApply = async function () {
    try { await apiFetch('POST', '/rides/driver/submit', {}); showToast(tr('Sent. We will review it soon.')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not send'); }
  };
  function driverPass(d) {
    if (!d.passEnabled) return '';
    const p = d.pass || {}, act = p.active;
    const when2 = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return `<div class="panel"><div class="panel-title">${e(tr('Driver Pass'))}</div>
      ${act ? `<div style="padding:10px 12px;border-radius:10px;background:#EEF8F3;font-size:14.5px;">🎟️ <strong>${e(act.label)}</strong> ${e(tr('is active until'))} ${e(when2(act.endsAt))}. ${e(tr('You keep the whole fare on every ride while it runs.'))}</div>`
        : `<div class="ver-note">${e(tr('No pass at the moment. App rides pay Trothen'))} ${e(d.commissionPercent)}% ${e(tr('when you are paid out. With a pass you pay one flat price and keep every fare.'))}</div>`}
      ${(p.queued || []).map(q => `<div class="ver-note" style="margin-top:6px;">${e(q.label)} ${e(tr('starts'))} ${e(when2(q.startsAt))}.</div>`).join('')}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">${(d.passPlans || []).map(pl => `<button class="btn-sm btn-sm-outline" onclick="ridesBuyPass(${jsArg(pl.id)},${pl.priceUsd},${jsArg(pl.label)})"><strong>${e(pl.label)}</strong> · ${money(pl.priceUsd)} · ${pl.days} ${e(tr(pl.days === 1 ? 'day' : 'days'))}</button>`).join('')}</div>
      ${d.cashEnabled ? `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:14px;"><input type="checkbox" id="rd-cash" ${d.acceptsCash ? 'checked' : ''} onchange="ridesCashToggle(this.checked)" style="margin-top:4px;"/> <span>${e(tr('I take cash rides.'))} <span style="color:var(--slate);">${e(tr('Riders can then pay you in cash. You collect the fare yourself. With an active Driver Pass Trothen takes nothing from it; without one, Trothen\'s ride commission comes from your tokens when you accept the ride.'))}</span></span></label>` : ''}
      <div class="ver-note" style="margin-top:10px;">${e(tr('Passes are paid like other payments in Trothen. Buying a second pass while one is running starts it when the first ends.'))}</div></div>`;
  }
  window.ridesBuyPass = async function (id, price, label) {
    if (!(await confirmDialog(tr('Buy the') + ' ' + label + ' ' + tr('for') + ' ' + money(price) + '?', { confirmLabel: tr('Buy pass') }))) return;
    try { await apiFetch('POST', '/rides/driver/pass', { planId: id, expectedPrice: price }); showToast(tr('Pass bought')); loadDriverPage(); }
    catch (x) { showToast(x.message || 'Could not buy the pass'); if (x.data && x.data.code === 'PRICE_CHANGED') loadDriverPage(); }
  };
  window.ridesCashToggle = async function (on) {
    try { const r = await apiFetch('PUT', '/rides/driver/cash', { accepts: on }); showToast(on ? (r.hasPass ? tr('You now take cash rides') : tr('You now take cash rides. Keep tokens for the commission, or buy a Driver Pass.')) : tr('You no longer take cash rides')); }
    catch (x) { showToast(x.message || 'Could not save'); loadDriverPage(); }
  };
  // v143: approved drivers also carry store and Market deliveries (Deliveries in the menu)
  const deliversToggle = (d) => `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:14px;"><input type="checkbox" id="rd-delivers" ${d.delivers !== false ? 'checked' : ''} onchange="ridesDelivers(this.checked)" style="margin-top:3px;"/> <span>${e(tr('I also carry store and Market deliveries'))} <span style="color:var(--slate);">${e(tr('Buyers can choose you to bring their goods. Delivery jobs show under Deliveries.'))}</span></span></label>`;
  window.ridesDelivers = async function (on) { try { await apiFetch('PUT', '/rides/driver/delivers', { on }); showToast(tr(on ? 'You now carry deliveries too' : 'You no longer carry deliveries')); } catch (x) { showToast(x.message || 'Could not save'); } };
  function driverRates(d) {
    return driverRatesInner(d).replace(/<\/div>$/, deliversToggle(d) + '</div>');
  }
  function driverRatesInner(d) {
    if (d.fareTable) { // v142: Trothen sets the fares here; the driver chooses how far above or below
      const t = d.fareTable, sym = t.symbol || t.currency, n = (x) => `${e(sym)}${e(Number(x).toLocaleString())}`;
      const opts = []; for (let a = -t.band; a <= t.band; a += 5) opts.push(a);
      if (!opts.includes(d.fareAdjust)) opts.push(d.fareAdjust);
      opts.sort((x, y) => x - y);
      return `<div class="panel" id="rd-fares"><div class="panel-title">${e(tr('My fares'))}</div>
        <div style="font-size:14px;margin-bottom:8px;">${e(tr('Trothen works out every fare from the road distance and the time, the same way for every driver of your kind of vehicle:'))}</div>
        <div style="font-size:14px;margin-bottom:8px;"><strong>${n(t.row.base)}</strong> ${e(tr('to start'))}, ${e(tr('plus'))} <strong>${n(t.row.perKm)}</strong> ${e(tr('per km'))}${t.row.perMin ? `, ${e(tr('plus'))} <strong>${n(t.row.perMin)}</strong> ${e(tr('per minute'))}` : ''}${t.row.min ? `. ${e(tr('Lowest fare'))} <strong>${n(t.row.min)}</strong>` : ''}.${t.fuelFactor !== 1 ? ` ${e(tr('Adjusted for the fuel price'))} (${t.fuelFactor > 1 ? '+' : ''}${Math.round((t.fuelFactor - 1) * 1000) / 10}%).` : ''}${t.nightPct ? ` ${e(tr('At night'))} +${e(t.nightPct)}%.` : ''}</div>
        <table style="width:100%;max-width:460px;border-collapse:collapse;font-size:14px;margin-bottom:10px;"><thead><tr style="text-align:left;color:var(--slate);"><th style="padding:4px 0;">${e(tr('Trip'))}</th><th>${e(tr('Trothen fare'))}</th><th>${e(tr('Your fare'))}</th></tr></thead><tbody>${t.examples.map(x => `<tr style="border-top:1px solid var(--border);"><td style="padding:5px 0;">${x.km} km, ~${x.minutes} ${e(tr('min'))}</td><td>${n(x.trothenLocal)}</td><td><strong>${n(x.local)}</strong> <span style="color:var(--slate);">(${money(x.fare)})</span></td></tr>`).join('')}</tbody></table>
        <div class="form-group"><label class="form-label" for="rr-adjust">${e(tr('My fares compared with the Trothen fare'))}</label><select class="form-input form-select" id="rr-adjust" style="max-width:280px;">${opts.map(a => `<option value="${a}" ${a === d.fareAdjust ? 'selected' : ''}>${a === 0 ? e(tr('The Trothen fare')) : `${Math.abs(a)}% ${e(tr(a > 0 ? 'above' : 'below'))}`}</option>`).join('')}</select></div>
        <button class="btn-sm btn-sm-primary" onclick="ridesSaveAdjust()">${e(tr('Save'))}</button>
        <div class="ver-note" style="margin-top:10px;">${e(tr('Riders see your fare and the Trothen fare before they choose. A lower fare gets more riders; a higher one suits a newer or more comfortable vehicle. Trothen adds a'))} ${e(d.feePercent)}% ${e(tr('fee on top for the rider. On ride earnings Trothen takes'))} ${e(d.commissionPercent)}% ${e(tr('when you are paid out.'))}</div></div>`;
    }
    return `<div class="panel"><div class="panel-title">${e(tr('My fares'))}</div>
      <div class="dates-row"><div class="form-group"><label class="form-label" for="rr-base">${e(tr('Starting fare (US$)'))}</label><input class="form-input" id="rr-base" type="number" min="0.5" max="100" step="0.01" value="${e(d.rates.baseFee)}"/></div>
      <div class="form-group"><label class="form-label" for="rr-km">${e(tr('Plus, for each kilometre (US$)'))}</label><input class="form-input" id="rr-km" type="number" min="0" max="20" step="0.01" value="${e(d.rates.perKm)}"/></div></div>
      <button class="btn-sm btn-sm-primary" onclick="ridesSaveRates()">${e(tr('Save my fares'))}</button>
      <div class="ver-note" style="margin-top:10px;">${e(tr('Riders see your fare before they choose you. Trothen adds a'))} ${e(d.feePercent)}% ${e(tr('fee on top for the rider. On ride earnings Trothen takes'))} ${e(d.commissionPercent)}% ${e(tr('when you are paid out (never more than your plan rate).'))}</div></div>`;
  }
  window.ridesSaveAdjust = async function () {
    try { await apiFetch('PUT', '/rides/driver/rates', { fareAdjust: Number(el('rr-adjust').value) }); showToast(tr('Fares saved')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.ridesSaveRates = async function () {
    try { await apiFetch('PUT', '/rides/driver/rates', { baseFee: Number(el('rr-base').value), perKm: Number(el('rr-km').value) }); showToast(tr('Fares saved')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  function driverOps(d, list) {
    const incoming = list.filter(r => r.status === 'pending_provider_confirmation'), active = list.filter(r => r.status === 'active');
    const offers = list.filter(r => r.status === 'pending_agreement' || r.status === 'awaiting_payment'); // v125
    return `<div class="panel"><div class="panel-title">${e(tr('Rides'))}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><span style="font-weight:700;color:${d.online ? '#2E8C6F' : 'var(--slate)'};">● ${e(tr(d.online ? 'You are online. Riders near you can see you.' : 'You are offline'))}</span>
      <button class="btn-sm ${d.online ? 'btn-sm-outline' : 'btn-sm-primary'}" onclick="ridesToggleOnline(${d.online ? 'false' : 'true'})">${e(tr(d.online ? 'Go offline' : 'Go online'))}</button></div>
      <div class="ver-note" style="margin-top:8px;">${e(tr('Keep this page open while you are online so riders can find you. You go offline by yourself after 12 hours.'))}</div></div>
      ${offers.map(r => { const myTurn = r.status === 'pending_agreement' && r.waitingOn === 'provider'; return `<div class="panel" style="border:2px solid #E0A526;"><div class="panel-title">${e(tr(r.status === 'awaiting_payment' ? 'Fare agreed: waiting for the rider to pay' : myTurn ? 'A rider offers a fare' : 'Waiting for the rider'))} <small>#${e(r.number)}</small></div>
        <div><strong>${e(r.pickup.address)}</strong>${r.pickup.note ? ` <span style="font-size:13px;color:var(--slate);">(📝 ${e(r.pickup.note)})</span>` : ''} → <strong>${e(r.dropoff.address)}</strong> · ${e(km(r.km))} · ${e(r.passengers)} ${e(tr('passenger(s)'))}${r.cash ? ' · 💵 ' + e(tr('cash')) : ''}</div>
        ${r.negotiation ? fareTalkHTML(r, 'provider') : ''}
        ${myTurn ? `<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-sm btn-sm-primary" onclick="ridesAnswer(${jsArg(r.id)},'accept')">${e(tr('Accept'))} ${fareL(r, r.fare)}</button><button class="btn-sm btn-sm-outline" onclick="ridesSuggest(${jsArg(r.id)})">${e(tr('Suggest a fare'))}</button><button class="btn-sm btn-sm-outline" onclick="ridesAnswer(${jsArg(r.id)},'decline')">${e(tr('Decline'))}</button></div><div style="font-size:13px;color:var(--slate);margin-top:4px;">${e(tr('Answer by'))} ${e(when(r.answerBy))}</div>` : `<div style="font-size:13.5px;color:var(--slate);">${e(tr(r.status === 'awaiting_payment' ? 'You\'ll be told the moment the rider pays. Then go to them.' : 'The rider answers your fare next.'))}</div>`}</div>`; }).join('')}
      ${incoming.map(r => `<div class="panel" style="border:2px solid #E0A526;"><div class="panel-title">${e(tr('New ride request'))} <small>#${e(r.number)}</small></div>
        <div><strong>${e(r.pickup.address)}</strong>${r.pickup.note ? ` <span style="font-size:13px;color:var(--slate);">(📝 ${e(r.pickup.note)})</span>` : ''} → <strong>${e(r.dropoff.address)}</strong> · ${e(km(r.km))} · ${e(r.passengers)} ${e(tr('passenger(s)'))}</div>
        <div style="font-size:14px;color:var(--slate);margin:4px 0;">${e(tr('Fare'))}: <strong>${fareL(r, r.fare)}</strong>${r.cash ? ' · 💵 <strong>' + e(tr('paid in CASH by the rider')) + '</strong>' : ''} · ${e(tr('Answer by'))} ${e(when(r.answerBy))}</div>
        <div style="display:flex;gap:8px;"><button class="btn-sm btn-sm-primary" onclick="ridesAnswer(${jsArg(r.id)},'accept')">${e(tr('Accept'))}</button><button class="btn-sm btn-sm-outline" onclick="ridesAnswer(${jsArg(r.id)},'decline')">${e(tr('Decline'))}</button></div></div>`).join('')}
      ${active.map(r => `<div class="panel" style="border:2px solid var(--teal);"><div class="panel-title">${e(tr(r.startedAt ? 'Trip in progress' : 'Go to your rider'))} <small>#${e(r.number)}</small></div>
        <div><strong>${e(r.pickup.address)}</strong>${r.pickup.note ? ` <span style="font-size:13px;color:var(--slate);">(📝 ${e(r.pickup.note)})</span>` : ''} <a href="https://www.google.com/maps/dir/?api=1&destination=${r.pickup.latitude},${r.pickup.longitude}" target="_blank" rel="noopener">🧭</a> → <strong>${e(r.dropoff.address)}</strong> <a href="https://www.google.com/maps/dir/?api=1&destination=${r.dropoff.latitude},${r.dropoff.longitude}" target="_blank" rel="noopener">🧭</a></div>
        <div style="font-size:14px;color:var(--slate);margin:4px 0;">${e(r.rider ? r.rider.name : '')} · ${e(r.passengers)} ${e(tr('passenger(s)'))} · ${fareL(r, r.fare)}</div>
        ${r.cash ? `<div style="margin:6px 0;padding:8px 12px;border-radius:10px;background:#FFF6DD;border:1px solid #E0A526;font-size:14px;">💵 <strong>${e(tr('CASH ride.'))}</strong> ${e(tr('Collect'))} <strong>${fareL(r, r.payInCash)}</strong> ${e(tr('from the rider at the end. Do not ask for more than this.'))} <a onclick="ridesReport(${jsArg(r.id)})" style="cursor:pointer;text-decoration:underline;">${e(tr('Report a problem'))}</a></div>` : ''}
        ${contactRow(r.contact)}
        ${!r.startedAt ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">
          <button class="btn-sm btn-sm-outline" onclick="ridesArrived(${jsArg(r.id)})">📍 ${e(tr('I have arrived'))}</button>
          <input class="form-input" id="rd-pin-${e(r.id)}" inputmode="numeric" maxlength="4" placeholder="${e(tr('Rider PIN'))}" style="width:130px;"/>
          <button class="btn-sm btn-sm-primary" onclick="ridesStart(${jsArg(r.id)})">${e(tr('Start trip'))}</button></div>
          <div class="ver-note" style="margin-top:8px;">${e(tr('You can only start with the 4-digit PIN from the rider\'s app. Do not carry anyone who cannot give it.'))}</div>
          ${r.driverArrivedAt ? (r.canNoShow
            ? `<div style="margin-top:8px;"><button class="btn-sm btn-sm-outline" onclick="ridesNoShow(${jsArg(r.id)})">🚫 ${e(tr('The rider did not show up'))}</button><div class="ver-note" style="margin-top:6px;">${e(tr('You waited the full time. The ride is cancelled and the rider is refunded. Repeated no-shows pause that rider.'))}</div></div>`
            : `<div class="ver-note" style="margin-top:8px;">${e(tr('If the rider does not come, you can report it after waiting'))} ${r.waitMinutes} ${e(tr('minutes'))} (${e(tr('from'))} ${e(new Date(r.noShowOpensAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}).</div>`) : ''}`
        : `<div style="display:flex;gap:8px;margin-top:8px;"><button class="confirm-btn" onclick="ridesEnd(${jsArg(r.id)})">🏁 ${e(tr(r.endedAt ? 'Waiting for the rider to confirm' : 'End trip'))}</button></div>`}
        <div style="display:flex;gap:8px;margin-top:8px;"><button class="btn-sm" style="background:#C0392B;color:#fff;" onclick="ridesSOS(${jsArg(r.id)})">🚨 ${e(tr('Emergency / SOS'))}</button>${r.canCancel ? `<button class="btn-sm btn-sm-outline" onclick="ridesCancel(${jsArg(r.id)})">${e(tr('Cancel'))}</button>` : ''}</div></div>`).join('')}`;
  }
  window.ridesToggleOnline = async function (on) {
    try {
      let f = null; if (on) { f = await here(); if (!f) return showToast(tr('We need your location to show you to riders nearby. Allow location and try again.')); }
      await apiFetch('POST', '/rides/driver/online', { online: on, latitude: f ? f.latitude : undefined, longitude: f ? f.longitude : undefined });
      loadDriverPage();
    } catch (x) { showToast(x.message || 'Could not change'); }
  };
  window.ridesAnswer = async function (id, decision) {
    try { const res = await apiFetch('POST', `/contracts/${encodeURIComponent(id)}/respond-offer`, { decision }); const st = res && res.contract && res.contract.status; showToast(tr(decision !== 'accept' ? 'Declined' : st === 'awaiting_payment' ? 'Accepted. The rider is asked to pay; you\'ll be told when they do.' : 'Accepted. Go to your rider.')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not answer'); loadDriverPage(); }
  };
  window.ridesArrived = async function (id) { try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/arrived`, {}); showToast(tr('The rider has been told')); loadDriverPage(); } catch (x) { showToast(x.message || 'Error'); } };
  window.ridesStart = async function (id) {
    const pin = (el('rd-pin-' + id) || {}).value || ''; const f = await here();
    try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/start`, { pin, latitude: f ? f.latitude : undefined, longitude: f ? f.longitude : undefined }); showToast(tr('Trip started')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not start'); }
  };
  window.ridesNoShow = async function (id) {
    if (!(await confirmDialog(tr('Report that the rider did not show up? The ride is cancelled and the rider is refunded.'), { confirmLabel: tr('Report no-show'), danger: true }))) return;
    try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/no-show`, {}); showToast(tr('The ride was cancelled and the rider was refunded')); loadDriverPage(); } catch (x) { showToast(x.message || 'Error'); }
  };
  window.ridesEnd = async function (id) { try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/end`, {}); showToast(tr('The rider has been asked to confirm')); loadDriverPage(); } catch (x) { showToast(x.message || 'Error'); } };


  // ── CONTACTS ─────────────────────────────────────────────────────────
  // Real phone calls and texts go through the phone's own dialer; the in-app
  // chat is the Messages page. Numbers are only sent by the server while the
  // trip or delivery is open.
  function digits(p) { return String(p || '').replace(/[^\d]/g, ''); }
  // v148: WhatsApp needs the number with its country code (231 77…), not as
  // dialled at home (077…). A number saved as 0886 123 456 used to open
  // WhatsApp on a wrong number.
  const CC = { Liberia: '231', Ghana: '233', Nigeria: '234', 'Sierra Leone': '232', Guinea: '224', "Côte d'Ivoire": '225', Senegal: '221', Gambia: '220', Kenya: '254', Uganda: '256', Tanzania: '255', Rwanda: '250', Cameroon: '237', 'United States': '1', Canada: '1', 'United Kingdom': '44' };
  function waDigits(phone, country) {
    let s = String(phone || '').trim(); if (!s) return '';
    if (s.startsWith('+')) return digits(s);
    let d = digits(s);
    if (d.startsWith('00')) return d.slice(2);
    const cc = CC[country || (AUTH.user && AUTH.user.country) || ''];
    if (cc && d.startsWith('0')) return cc + d.slice(1);
    if (cc && !d.startsWith(cc) && d.length <= 10) return cc + d;
    return d;
  }
  function contactRow(c, label) {
    if (!c) return '';
    const who = label ? `<span style="font-weight:600;">${e(label)}${c.name ? ': ' + e(c.name) : ''}</span> ` : '';
    if (!c.phone) return `<div style="font-size:13.5px;margin-top:8px;color:var(--slate);">${who}${e(tr('No phone number on file. Use Messages.'))} <a onclick="ridesOpenMessages()" style="cursor:pointer;color:var(--teal);text-decoration:underline;">${e(tr('Open Messages'))}</a></div>`;
    const ph = c.phone.replace(/[^\d+]/g, ''), d = digits(c.phone);
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;">${who}<a class="btn-sm btn-sm-outline" href="tel:${e(ph)}">📞 ${e(tr('Call'))}</a><a class="btn-sm btn-sm-outline" href="sms:${e(ph)}">💬 ${e(tr('Text'))}</a>${d.length >= 8 ? `<a class="btn-sm btn-sm-outline" href="https://wa.me/${e(waDigits(c.phone, c.country))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<a class="btn-sm btn-sm-ghost" onclick="ridesOpenMessages()" style="cursor:pointer;">✉️ ${e(tr('In-app message'))}</a></div>`;
  }
  window.ridesOpenMessages = function () {
    closeTrack();
    if (AUTH.user && AUTH.user.role === 'provider') selectProviderSection('messages'); else goToCustomerDashboard('messages');
  };

  // ── LIVE TRACKING MAP (rides and deliveries) ─────────────────────────
  const T = { map: null, layer: null, timer: null, kind: null, id: null, fitted: false };
  const VEH = { motorbike: '🏍️', keke: '🛺', car: '🚗', van: '🚐', truck: '🚚', bicycle: '🚲', 'on foot': '🚶' };
  window.closeTrack = function () {
    clearInterval(T.timer); T.timer = null;
    if (T.map) { try { T.map.remove(); } catch (x) {} }
    T.map = null; T.layer = null; T.fitted = false; T.m = null; T.framePts = null;
    v105Close('track-overlay');
  };
  function norm(kind, j) {
    if (kind === 'ride') { const r = j.ride; return { title: 'Ride #' + r.number, phase: r.phase, driver: r.driver, vehicle: r.driver && r.driver.vehicle, live: r.live, stale: r.stale, pickup: r.pickup, dropoff: r.dropoff, remainingKm: r.remainingKm, etaMinutes: r.etaMinutes, trail: r.trail, contacts: { driver: r.role === 'rider' ? r.contact : null, rider: r.role === 'driver' ? r.contact : null }, viewer: r.role }; }
    return { title: 'Order #' + j.orderNumber, phase: j.phase, driver: j.driver, vehicle: j.driver && j.driver.vehicle, live: j.live, stale: j.stale, pickup: j.pickup, dropoff: j.dropoff, remainingKm: j.remainingKm, etaMinutes: j.etaMinutes, trail: j.trail, contacts: j.contacts || {}, viewer: j.viewer };
  }
  const PHASE_WORDS = {
    waiting_driver: 'Waiting for the driver to accept', to_store: 'The driver is heading to the store to collect it', to_customer: 'On the way with your goods', to_pickup: 'The driver is coming to pick up the rider', to_destination: 'On the way to the destination',
    delivered: 'Delivered', completed: 'Finished', cancelled: 'Cancelled', none: 'No delivery driver on this order',
  };
  window.openTrack = async function (kind, id) {
    closeTrack();
    T.kind = kind; T.id = id;
    v105Overlay('track-overlay', `<div class="modal-header"><button class="modal-close" onclick="closeTrack()" aria-label="Close">✕</button><h3>${e(tr('Live tracking'))}</h3><p id="trk-title"></p></div>
      <div class="modal-body" style="overflow:auto;flex:1 1 auto;min-height:0;"><div id="trk-status" style="font-weight:700;color:var(--navy);margin-bottom:6px;"></div><div id="trk-sub" style="font-size:14px;color:var(--slate);margin-bottom:8px;"></div>
      <div id="trk-map" style="height:min(48vh,380px);border-radius:10px;background:var(--offwhite);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--slate);">${e(tr('Loading the map…'))}</div><div id="trk-contacts"></div>
      <div class="ver-note" style="margin-top:10px;">${e(tr('The position comes from the driver\'s phone while this delivery is open and their Trothen page is on. It stops when the delivery ends.'))}</div></div>
      <div class="modal-footer"><button class="btn-sm btn-sm-outline" style="width:100%;" onclick="closeTrack()">${e(tr('Close'))}</button></div>`, 640);
    if (!R.cfg) await loadConfig();
    const ok = await loadLeaflet(); const box = el('trk-map'); if (!box) return;
    if (!ok) { box.textContent = tr("The map couldn't load. The status above still updates."); }
    else { box.textContent = ''; box.style.display = 'block'; T.map = L.map(box, { zoomControl: true }).setView([6.3156, -10.8074], 13); L.tileLayer((R.cfg && R.cfg.tileUrl) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: (R.cfg && R.cfg.tileAttribution) || '&copy; OpenStreetMap contributors' }).addTo(T.map); T.layer = L.layerGroup().addTo(T.map); setTimeout(() => { if (T.map) T.map.invalidateSize(); }, 80); }
    await refreshTrack();
    T.timer = setInterval(refreshTrack, 6000);
  };
  async function refreshTrack() {
    if (!el('trk-status')) return closeTrack();
    let n;
    try { n = norm(T.kind, await apiFetch('GET', T.kind === 'ride' ? `/rides/${encodeURIComponent(T.id)}` : `/store/orders/${encodeURIComponent(T.id)}/track`)); } catch (x) { el('trk-status').textContent = x.message || tr('Could not load'); return; }
    el('trk-title').textContent = n.title + (n.driver ? ' · ' + n.driver.name : '');
    let status = tr(PHASE_WORDS[n.phase] || n.phase);
    if (n.phase === 'to_customer' && n.viewer === 'seller') status = tr('On the way to the customer');
    el('trk-status').textContent = status;
    const bits = [];
    if (n.live && n.remainingKm != null) bits.push(n.remainingKm + ' km ' + tr('to go'));
    if (n.etaMinutes) bits.push(tr('about') + ' ' + n.etaMinutes + ' ' + tr('min'));
    if (n.live) bits.push(tr('updated') + ' ' + (n.live.secondsAgo < 60 ? n.live.secondsAgo + 's' : Math.round(n.live.secondsAgo / 60) + ' ' + tr('min')) + ' ' + tr('ago'));
    if (n.live && n.live.accuracyM && n.live.accuracyM > 150) bits.push(tr('rough position'));
    let sub = bits.join(' · ');
    if (!n.live && ['to_store', 'to_customer', 'to_pickup', 'to_destination'].includes(n.phase)) sub = tr('Waiting for the driver\'s phone to send a location. It starts when the driver opens Trothen.');
    if (n.stale) sub += ' ⚠️ ' + tr('No update for over 2 minutes. The driver may be in a weak signal area or the page may be closed.');
    el('trk-sub').innerHTML = e(sub);
    const cs = n.contacts || {};
    el('trk-contacts').innerHTML = [['driver', 'Driver'], ['rider', 'Rider'], ['customer', 'Customer'], ['seller', 'Seller']].filter(([k]) => cs[k]).map(([k, l]) => contactRow(cs[k], tr(l))).join('');
    if (!T.map || !T.layer) return;
    // v148: the markers stay and move (they used to be redrawn every few seconds), the
    // road route is drawn, and the map follows the trip until you move it yourself.
    const dot = (c) => L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: `<div style="width:18px;height:18px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);"></div>` });
    const M = T.m || (T.m = {});
    const put = (key, p, make) => {
      if (!p || p.latitude == null) { if (M[key]) { T.layer.removeLayer(M[key]); M[key] = null; } return null; }
      const ll = [p.latitude, p.longitude];
      if (!M[key]) M[key] = make(ll).addTo(T.layer); else if (window.TrothenMap) TrothenMap.glide(M[key], ll); else M[key].setLatLng(ll);
      return ll;
    };
    const pts = [];
    const pk = put('pickup', n.pickup, (ll) => L.marker(ll, { icon: dot('#2E8C6F') }).bindTooltip(tr('Pick-up'), { direction: 'top', offset: [0, -8] }));
    const dp = put('dropoff', n.dropoff, (ll) => L.marker(ll, { icon: dot('#C0392B') }).bindTooltip(tr('Drop-off'), { direction: 'top', offset: [0, -8] }));
    if (n.trail && n.trail.length > 1) { if (!M.trail) M.trail = L.polyline(n.trail, { color: '#5B6B82', weight: 4, opacity: 0.55 }).addTo(T.layer); else M.trail.setLatLngs(n.trail); }
    const lv = put('driver', n.live, (ll) => L.marker(ll, { zIndexOffset: 900, icon: L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 18], html: `<div style="font-size:26px;line-height:36px;text-align:center;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));">${VEH[n.vehicle] || '🚚'}</div>` }) }));
    if (n.live && n.live.accuracyM && n.live.accuracyM < 500) { const ll = [n.live.latitude, n.live.longitude]; if (!M.acc) M.acc = L.circle(ll, { radius: n.live.accuracyM, color: '#1F5FBF', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(T.layer); else { M.acc.setLatLng(ll); M.acc.setRadius(n.live.accuracyM); } }
    else if (M.acc) { T.layer.removeLayer(M.acc); M.acc = null; }
    // What matters now: the driver and where they are heading next.
    const toPickup = ['to_pickup', 'to_store', 'waiting', 'arrived'].includes(n.phase);
    const next = toPickup ? pk : dp;
    if (lv) pts.push(lv);
    if (next) pts.push(next);
    if (!lv) { if (pk) pts.push(pk); if (dp) pts.push(dp); }
    if (window.TrothenMap) {
      if (pk && dp) TrothenMap.drawRoute(T.map, n.pickup, n.dropoff, { slot: 'trip', color: '#1A73E8', vehicle: n.vehicle });
      if (n.live && toPickup && n.pickup && n.pickup.latitude != null) TrothenMap.drawRoute(T.map, n.live, n.pickup, { slot: 'approach', color: '#2E8C6F', vehicle: n.vehicle });
      const f = TrothenMap.follow(T.map, () => (T.framePts && T.framePts.length ? L.latLngBounds(T.framePts) : null));
      T.framePts = pts;
      if (!T.fitted) { f.frame(true); T.fitted = true; } else f.frame(false);
    } else if (pts.length && !T.fitted) { try { T.map.fitBounds(L.latLngBounds(pts), { padding: [34, 34], maxZoom: 17 }); T.fitted = true; } catch (x) {} }
  }

  // ── DRIVER BEACON: sends this phone's position while a job is open ────
  const BCN = { watch: null, latest: null, jobs: [], scanTimer: null, sendTimer: null, lock: null, denied: false, started: false };
  function barHTML() {
    if (BCN.denied) return `<span style="width:10px;height:10px;border-radius:50%;background:#E5533D;flex-shrink:0;"></span><span style="flex:1;">${e(tr('Location is blocked, so customers cannot see where you are. Allow location for this site.'))}</span>`;
    const acc = BCN.latest && BCN.latest.accuracyM ? ' · ' + Math.round(BCN.latest.accuracyM) + ' m' : '';
    if (BCN.offline) return `<span style="width:10px;height:10px;border-radius:50%;background:#E0A526;flex-shrink:0;"></span><span style="flex:1;">${e(tr('No signal. Your route is being saved and will be sent when you are back online.'))}</span>`;
    return `<span style="width:10px;height:10px;border-radius:50%;background:${BCN.latest ? '#3DDC97' : '#E0A526'};flex-shrink:0;"></span><span style="flex:1;">${e(tr('Sharing your live location for'))} ${e(BCN.jobs.map(j => j.label).join(', '))}${acc}. ${e(tr('Keep this page open.'))}</span>`;
  }
  function renderBar() {
    let bar = el('beacon-bar');
    if (!BCN.jobs.length) { if (bar) bar.remove(); return; }
    if (!bar) { document.body.insertAdjacentHTML('beforeend', `<div id="beacon-bar" role="status" style="position:fixed;left:12px;right:12px;bottom:12px;z-index:3990;max-width:560px;margin:0 auto;background:#1F4F8F;color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:10px;align-items:center;font-size:14px;box-shadow:0 4px 18px rgba(0,0,0,.3);"></div>`); bar = el('beacon-bar'); }
    bar.innerHTML = barHTML();
  }
  async function scanJobs() {
    if (!AUTH.user || AUTH.user.role !== 'provider' || !BACKEND_AVAILABLE) return stopBeacon();
    const jobs = [];
    try { const r = await apiFetch('GET', '/store/orders/mine'); (r.delivering || []).filter(d => d.status === 'active' && !d.droppedOffAt).forEach(d => jobs.push({ kind: 'delivery', id: d.contractId, label: tr('delivery') + ' #' + d.orderNumber })); } catch (x) { /* keep what we had */ jobs.push(...BCN.jobs.filter(j => j.kind === 'delivery')); }
    try { const r = await apiFetch('GET', '/rides/mine'); r.rides.filter(x => x.status === 'active' && x.role === 'driver' && !x.endedAt).forEach(x => jobs.push({ kind: 'ride', id: x.id, label: tr('ride') + ' #' + x.number })); } catch (x) { jobs.push(...BCN.jobs.filter(j => j.kind === 'ride')); }
    BCN.jobs = jobs;
    if (jobs.length) startWatch(); else stopWatch();
    renderBar();
  }
  function startWatch() {
    if (BCN.watch != null || !navigator.geolocation) return;
    BCN.denied = false;
    BCN.watch = navigator.geolocation.watchPosition(p => { BCN.denied = false; if (p.timestamp && Date.now() - p.timestamp > 60000) return; /* v148: an old cached position */ if (BCN.latest && p.coords.accuracy > 1000 && BCN.latest.accuracyM <= 200 && Date.now() - BCN.latest.at < 120000) return; /* a rough network fix right after a good GPS one */ BCN.latest = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy, speedMps: p.coords.speed, at: Date.now() }; renderBar(); },
      err => { if (err && err.code === 1) { BCN.denied = true; renderBar(); } }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { BCN.lock = l; }).catch(() => {}); } catch (x) {}
  }
  function stopWatch() {
    if (BCN.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(BCN.watch);
    BCN.watch = null; BCN.latest = null;
    try { if (BCN.lock) BCN.lock.release(); } catch (x) {} BCN.lock = null;
  }
  // Positions that could not be sent (no signal) are kept and sent together when the phone is back online.
  BCN.queue = {};
  async function sendBeacon() {
    const p = BCN.latest;
    if (p && Date.now() - p.at <= 90000) { // never queue an old position as if it were current
      for (const j of BCN.jobs) {
        const q = BCN.queue[j.id] || (BCN.queue[j.id] = []);
        if (!q.length || q[q.length - 1].at !== p.at) q.push({ latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracyM, speedMps: p.speedMps, at: p.at });
        if (q.length > 100) q.splice(0, q.length - 100);
      }
    }
    for (const j of BCN.jobs) {
      const q = BCN.queue[j.id]; if (!q || !q.length) continue;
      const sending = q.slice();
      const path = j.kind === 'ride' ? `/rides/${encodeURIComponent(j.id)}/location` : `/deliveries/${encodeURIComponent(j.id)}/location`;
      apiFetch('POST', path, { points: sending }).then(() => { BCN.queue[j.id] = (BCN.queue[j.id] || []).slice(sending.length); BCN.offline = false; renderBar(); })
        .catch(x => { if (x && x.data && x.data.code === 'TRACK_CLOSED') { delete BCN.queue[j.id]; scanJobs(); } else if (!x || !x.data) { BCN.offline = true; renderBar(); } });
    }
  }
  window.addEventListener('online', () => { if (BCN.jobs.length) sendBeacon(); });
  function startBeacon() {
    if (BCN.started || !AUTH.user || AUTH.user.role !== 'provider') return;
    BCN.started = true;
    scanJobs(); BCN.scanTimer = setInterval(scanJobs, 30000); BCN.sendTimer = setInterval(sendBeacon, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && BCN.jobs.length) { stopWatch(); startWatch(); } });
  }
  function stopBeacon() { clearInterval(BCN.scanTimer); clearInterval(BCN.sendTimer); BCN.started = false; BCN.jobs = []; stopWatch(); renderBar(); }
  window.ridesBeaconRescan = scanJobs;
  { const f = updateProviderSidebar; updateProviderSidebar = function () { const r = f.apply(this, arguments); startBeacon(); return r; }; }
  { const f = showAuth; showAuth = function () { stopBeacon(); return f.apply(this, arguments); }; }

  // ── delivery cards: track + contacts ─────────────────────────────────
  function appendToCard(html, extra) { const i = html.lastIndexOf('</div>'); return i === -1 ? html + extra : html.slice(0, i) + extra + html.slice(i); }
  function orderTrackRow(o) {
    if (!o || o.status !== 'active') return '';
    const d = o.delivery, c = o.contacts || {};
    const tracking = d && ['pending_provider_confirmation', 'active'].includes(d.status);
    return `<div style="border-top:1px dashed var(--border);margin-top:10px;padding-top:8px;">
      ${d && d.dropoffCode ? `<div style="margin:0 0 8px;padding:10px 12px;border-radius:10px;background:#EEF8F3;">🔐 ${e(tr('Your drop-off code'))}: <strong style="font-size:22px;letter-spacing:5px;">${e(d.dropoffCode)}</strong><div style="font-size:12.5px;color:var(--slate);">${e(tr('Give this to the driver only when you have your goods in your hands.'))}</div></div>` : ''}
      ${tracking ? `<button class="btn-sm btn-sm-primary" onclick="openTrack('order',${jsArg(o.id)})">📍 ${e(tr('Track the delivery live'))}</button>` : ''}
      ${c.driver ? contactRow(c.driver, tr('Driver')) : ''}${c.customer ? contactRow(c.customer, tr('Customer')) : ''}${c.seller ? contactRow(c.seller, tr('Seller')) : ''}</div>`;
  }
  { const f = customerOrderHTML; customerOrderHTML = function (o) { return appendToCard(f.apply(this, arguments), orderTrackRow(o)); }; }
  { const f = sellerOrderHTML; sellerOrderHTML = function (o) { return appendToCard(f.apply(this, arguments), orderTrackRow(o)); }; }
  // The driver's Deliveries page: who to call, and where to go.
  { const f = loadDeliveries; loadDeliveries = async function () {
    const r = await f.apply(this, arguments);
    const box = el('deliveries-body'); if (!box || typeof DELIVERIES === 'undefined' || !DELIVERIES) return r;
    const going = DELIVERIES.filter(d => d.status === 'active');
    if (!going.length) return r;
    box.insertAdjacentHTML('afterbegin', `<div class="panel"><div class="panel-title">${e(tr('On this delivery now'))}</div><div class="ver-note" style="margin-bottom:8px;">${e(tr('Your live location is shared with the customer and the seller while a delivery is open. Keep this page open.'))}</div>${going.map(d => `<div style="padding:10px 0;border-top:1px solid var(--border);"><div style="font-weight:700;color:var(--navy);">${e(d.storeName)} · ${e(tr('order'))} #${e(d.orderNumber)}</div>
      ${d.pickupCode ? `<div style="margin:6px 0;padding:8px 12px;border-radius:10px;background:#EEF8F3;display:inline-block;">${e(tr('Pick-up code (show it to the seller):'))} <strong style="font-size:20px;letter-spacing:4px;">${e(d.pickupCode)}</strong></div>` : ''}
      <div style="font-size:14px;line-height:1.7;">🧭 <a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${d.pickup.location ? d.pickup.location.latitude + ',' + d.pickup.location.longitude : ''}">${e(tr('Navigate to the store'))}</a> · <a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${d.dropoff.location ? d.dropoff.location.latitude + ',' + d.dropoff.location.longitude : ''}">${e(tr('Navigate to the customer'))}</a></div>
      ${contactRow(d.contacts && d.contacts.customer, tr('Customer'))}${contactRow(d.contacts && d.contacts.seller, tr('Seller'))}</div>`).join('')}</div>`);
    return r;
  }; }


  // ── delivery codes in the hand-over window ───────────────────────────
  function codeNeeds() {
    const c = RAW_CONTRACTS && HANDOVER && RAW_CONTRACTS[HANDOVER.contractId]; if (!c || !c.delivery || !AUTH.user) return null;
    const me = AUTH.user.id, seller = c.delivery.sellerId === me && c.providerId !== me && c.customerId !== me, driver = c.providerId === me;
    if (HANDOVER.stage === 'pickup' && seller) return { kind: 'pickup', label: 'Pick-up code (ask the driver to show you theirs)' };
    if (HANDOVER.stage === 'dropoff' && driver) return { kind: 'dropoff', label: 'Drop-off code (the customer shows you theirs)', skip: true };
    return null;
  }
  function decorateHandover() {
    const old = el('ho-code-box'); if (old) old.remove();
    const need = codeNeeds(), note = el('ho-note'); if (!need || !note) return;
    const anchor = note.closest('.form-group'); if (!anchor) return;
    anchor.insertAdjacentHTML('beforebegin', `<div id="ho-code-box" class="form-group" style="background:#EEF8F3;border-radius:10px;padding:10px 12px;"><label class="form-label" for="ho-code">🔐 ${e(tr(need.label))}</label><input class="form-input" id="ho-code" inputmode="numeric" maxlength="4" placeholder="4 digits" style="max-width:160px;"/>${need.skip ? `<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13.5px;"><input type="checkbox" id="ho-nocode"/> ${e(tr('The customer cannot give me the code. I will explain in the note below.'))}</label>` : ''}</div>`);
  }
  { const f = openHandover; openHandover = async function () { const r = await f.apply(this, arguments); decorateHandover(); return r; }; }
  { const f = setHandoverStage; setHandoverStage = function () { const r = f.apply(this, arguments); decorateHandover(); return r; }; }
  { const f = handoverEntryHTML; handoverEntryHTML = function (en) { const h = f.apply(this, arguments); const badge = en.codeVerified ? `<div style="font-size:13px;color:#1E7A55;margin-top:6px;">🔐 ${e(tr('Code checked'))}</div>` : en.codeSkipped ? `<div style="font-size:13px;color:#B4472E;margin-top:6px;">⚠️ ${e(tr('Delivered without the customer\'s code'))}</div>` : ''; return badge ? appendToCard(h, badge) : h; }; }

  // ── ADMIN ────────────────────────────────────────────────────────────
  // v146: one Rides switch per country Trothen is live in.
  function countrySwitchesHTML(o) {
    const list = o.countryList || [];
    if (!list.length) return `<div class="ver-note">${e(tr('No country is live yet. Make one live in Admin → Categories & Countries.'))}</div>`;
    // The countries that matter (Rides on, or drivers there) get a row; with
    // many live countries the rest are in a list to switch on.
    const shown = list.length <= 12 ? list : list.filter(c => c.on || c.approved || c.pending || (R.rcAdded || []).includes(c.name));
    const rest = list.filter(c => !shown.includes(c) && c.live);
    const row = (c) => `<tr style="border-top:1px solid var(--border);">
      <td style="padding:8px 6px;font-weight:600;color:var(--navy);">${e(c.name)}${c.live ? '' : ` <span style="font-size:12px;color:#B45309;font-weight:400;">${e(tr('(not live on Trothen)'))}</span>`}</td>
      <td style="padding:8px 6px;font-size:13px;color:var(--slate);">${c.approved} ${e(tr('approved'))}${c.pending ? ` · ${c.pending} ${e(tr('waiting'))}` : ''}${c.online ? ` · <span style="color:#15803d;">${c.online} ${e(tr('online'))}</span>` : ''}</td>
      <td style="padding:8px 6px;font-size:13px;color:${c.fares ? 'var(--slate)' : '#B45309'};">${e(tr(c.fares ? 'Trothen fares set' : 'No fares set: drivers price themselves'))}</td>
      <td style="padding:8px 6px;text-align:right;white-space:nowrap;">${o.canEditSettings
        ? `<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;"><span style="font-size:13px;font-weight:600;color:${c.on ? '#15803d' : 'var(--slate)'};" data-rc-word="${e(c.name)}">${e(tr(c.on ? 'On' : 'Off'))}</span><input type="checkbox" class="rc-switch" data-country="${e(c.name)}" ${c.on ? 'checked' : ''} ${!c.live && !c.on ? 'disabled' : ''} onchange="ridesCountrySwitch(this)" style="width:20px;height:20px;cursor:pointer;" aria-label="${e(tr('Rides in'))} ${e(c.name)}"/></label>`
        : `<strong style="color:${c.on ? '#15803d' : 'var(--slate)'};">${e(tr(c.on ? 'On' : 'Off'))}</strong>`}</td></tr>`;
    return `<div style="font-weight:700;color:var(--navy);margin:4px 0 2px;">${e(tr('Rides by country'))}</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('Rides can be on in any country Trothen is live in. Switch it on or off for each country; it takes effect straight away. Turning a country off stops new ride requests there; rides already under way finish normally. Check the country\'s transport rules (and set its fares below) before switching it on.'))}</div>
      <div style="overflow-x:auto;"><table id="rides-countries" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:${rest.length ? 6 : 12}px;"><tbody>${shown.map(row).join('')}</tbody></table></div>
      ${rest.length && o.canEditSettings ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px;font-size:13.5px;"><span style="color:var(--slate);">${e(tr('Switch Rides on in another live country'))} (${rest.length}):</span><select class="form-input form-select" id="rc-add" style="max-width:240px;"><option value="">${e(tr('Choose a country'))}</option>${rest.map(c => `<option>${e(c.name)}</option>`).join('')}</select><button type="button" class="btn-sm btn-sm-primary" onclick="ridesCountryAdd()">${e(tr('Switch on'))}</button></div>` : ''}`;
  }
  window.ridesCountrySwitch = async function (box) {
    const country = box.dataset.country, on = box.checked;
    const c = ((R.over && R.over.countryList) || []).find(x => x.name === country) || {};
    if (!on && c.online && !confirm(`${country}: ${c.online} ${tr('driver(s) are online. Turn Rides off? New ride requests stop; rides under way finish.')}`)) { box.checked = true; return; }
    box.disabled = true;
    try {
      const rr = await apiFetch('PUT', '/admin/rides/countries', { country, on }); if (rr && rr.warnings && rr.warnings.length) setTimeout(() => showToast('⚠️ ' + rr.warnings.join(' ')), 1500); // v148
      c.on = on;
      const w = document.querySelector(`[data-rc-word="${CSS.escape(country)}"]`); if (w) { w.textContent = tr(on ? 'On' : 'Off'); w.style.color = on ? '#15803d' : 'var(--slate)'; }
      showToast(`${tr('Rides')} ${tr(on ? 'on' : 'off')}: ${country}`);
    } catch (x) { box.checked = !on; showToast(x.message || tr('Could not save')); }
    box.disabled = false;
  };
  window.ridesCountryAdd = async function () {
    const v = (el('rc-add') || {}).value; if (!v) return showToast(tr('Choose a country'));
    try { const rr = await apiFetch('PUT', '/admin/rides/countries', { country: v, on: true }); if (rr && rr.warnings && rr.warnings.length) setTimeout(() => showToast('⚠️ ' + rr.warnings.join(' ')), 1500); R.rcAdded = [...(R.rcAdded || []), v]; showToast(`${tr('Rides')} ${tr('on')}: ${v}`); loadAdminRides(); }
    catch (x) { showToast(x.message || tr('Could not save')); }
  };
  async function loadAdminRides() {
    if (!body()) return;
    let o; try { o = await apiFetch('GET', '/admin/rides/overview'); } catch (x) { body().innerHTML = `<div class="panel">${e(x.message || 'Could not load')}</div>`; return; }
    R.over = o; const s = o.settings, c = o.counts;
    body().innerHTML = `
      <div class="panel"><div class="panel-title">${e(tr('Where rides are on'))}</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px;font-size:14px;"><span>⏳ ${c.pending} ${e(tr('waiting for review'))}</span><span>✅ ${c.approved} ${e(tr('approved drivers'))}</span><span>🛵 ${c.openRides} ${e(tr('rides open now'))}</span><span style="color:${c.openAlerts ? '#C0392B' : 'inherit'};">🚨 ${c.openAlerts} ${e(tr('open safety alerts'))}</span></div>
        ${countrySwitchesHTML(o)}
        ${o.canEditSettings ? `
        <div class="dates-row"><div class="form-group"><label class="form-label" for="rs-max">${e(tr('Longest ride (km)'))}</label><input class="form-input" id="rs-max" type="number" value="${e(s.maxKm)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-search">${e(tr('Show drivers within (km)'))}</label><input class="form-input" id="rs-search" type="number" value="${e(s.searchKm)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-ans">${e(tr('Minutes for a driver to answer'))}</label><input class="form-input" id="rs-ans" type="number" value="${e(s.answerMinutes)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-fee">${e(tr('Trothen fee on top of the fare (%)'))}</label><input class="form-input" id="rs-fee" type="number" value="${e(s.feePercent)}"/></div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="rs-comm">${e(tr('Driver commission on ride earnings (%)'))}</label><input class="form-input" id="rs-comm" type="number" min="0" max="30" value="${e(s.commissionPercent)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-ins">${e(tr('Insurance or road permit'))}</label><select class="form-input form-select" id="rs-ins"><option value="1" ${s.requireInsurance ? 'selected' : ''}>${e(tr('Required to be approved'))}</option><option value="0" ${!s.requireInsurance ? 'selected' : ''}>${e(tr('Optional'))}</option></select></div></div>
        <div class="form-group"><label class="form-label" for="rs-docs">${e(tr('Papers a driver must upload, by country and vehicle. One rule per line: country | vehicle | papers. Use * for any.'))}</label><textarea class="form-input" id="rs-docs" rows="4" style="font-family:monospace;" placeholder="Liberia | motorbike | licence, registration, vehicle, insurance, police, helmet">${e((o.docRules || []).map(r => [r.country, r.vehicle, r.docs.join(', ')].join(' | ')).join('\n'))}</textarea>
        <div class="ver-note" style="margin-top:4px;">${e(tr('Papers you can name:'))} ${Object.keys(o.docKinds || {}).map(k => '<code>' + e(k) + '</code> = ' + e(tr(o.docKinds[k]))).join('; ')}. ${e(tr('Every rule must include licence, registration and vehicle. With no rule the standard list applies:'))} ${(o.standardDocs || []).map(k => e(k)).join(', ')}. ${e(tr('The most specific rule wins. Drivers already approved are not removed when you add a paper: you will see a warning on their line and can ask them for it or suspend them. Ask a Liberian lawyer or the Ministry of Transport which papers are legally required before you set these.'))}</div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="rs-pass">${e(tr('Driver Pass'))}</label><select class="form-input form-select" id="rs-pass"><option value="1" ${s.passEnabled ? 'selected' : ''}>${e(tr('On: drivers can buy passes'))}</option><option value="0" ${!s.passEnabled ? 'selected' : ''}>${e(tr('Off'))}</option></select></div>
        <div class="form-group"><label class="form-label" for="rs-cash">${e(tr('Cash rides'))}</label><select class="form-input form-select" id="rs-cash"><option value="0" ${!s.cashEnabled ? 'selected' : ''}>${e(tr('Off (app payment only)'))}</option><option value="1" ${s.cashEnabled ? 'selected' : ''}>${e(tr('On: commission from the driver\'s tokens, none with a Driver Pass'))}</option></select></div></div>
        <div class="form-group"><label class="form-label" for="rs-plans">${e(tr('Pass prices, one per line: short-name, label, days, price in US$'))}</label><textarea class="form-input" id="rs-plans" rows="4" style="font-family:monospace;">${e((s.passPlans || []).map(p => [p.id, p.label, p.days, Number(p.priceUsd).toFixed(2)].join(', ')).join('\n'))}</textarea>
        <div class="ver-note" style="margin-top:4px;">${e(tr('These starting prices are placeholders. Set the real ones after checking what drivers in your country can pay. Cash rides carry no held money, so have your lawyer add a line about them to the Ride Rules before turning them on.'))}</div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="rs-auto">${e(tr('Release the fare automatically after the driver ends the trip (hours, 0 = never)'))}</label><input class="form-input" id="rs-auto" type="number" min="0" max="168" value="${e(s.autoReleaseHours)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-nostart">${e(tr('Cancel and refund a ride that never started after (hours)'))}</label><input class="form-input" id="rs-nostart" type="number" min="1" max="48" value="${e(s.noStartHours)}"/></div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="rs-stuck">${e(tr('Flag a started trip nobody ended after (hours)'))}</label><input class="form-input" id="rs-stuck" type="number" min="1" max="48" value="${e(s.stuckHours)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-wait">${e(tr('Driver waits for a rider (minutes)'))}</label><input class="form-input" id="rs-wait" type="number" min="3" max="30" value="${e(s.waitMinutes)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-keep">${e(tr('Keep GPS routes of finished rides (days)'))}</label><input class="form-input" id="rs-keep" type="number" min="1" max="365" value="${e(s.trackKeepDays)}"/></div></div>
        <div class="form-group"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="rs-night" ${s.motorbikeNight && s.motorbikeNight.enabled ? 'checked' : ''}/> ${e(tr('No motorbike rides between'))} <input class="form-input" id="rs-n1" type="number" min="0" max="23" value="${e(s.motorbikeNight ? s.motorbikeNight.startHour : 20)}" style="width:70px;"/> ${e(tr('and'))} <input class="form-input" id="rs-n2" type="number" min="0" max="23" value="${e(s.motorbikeNight ? s.motorbikeNight.endHour : 6)}" style="width:70px;"/> ${e(tr('o\'clock (Liberia time)'))}</label></div>
        <div class="form-group"><label class="form-label" for="rs-rr">${e(tr('Ride Rules shown to riders'))} <small>(v${e(s.rulesVersion)})</small></label><textarea class="form-input" id="rs-rr" rows="8">${e(s.rulesRider)}</textarea></div>
        <div class="form-group"><label class="form-label" for="rs-rd">${e(tr('Ride Rules shown to drivers'))}</label><textarea class="form-input" id="rs-rd" rows="8">${e(s.rulesDriver)}</textarea></div>
        <div class="ver-note" style="margin-bottom:10px;border-left:3px solid #8C6423;">${e(tr('These rules are a starting draft. Have a lawyer review them before real riders use them. Saving changed wording makes everyone accept again.'))}</div>
        <button class="btn-sm btn-sm-primary" onclick="ridesAdminSave()">${e(tr('Save'))}</button>
        <div class="ver-note" style="margin-top:10px;">${e(tr('Turn a country on only after you have checked its transport rules. Even when it is on, no ride can happen until you approve a driver there.'))}</div>`
        : `<div class="ver-note">${e(tr('Only a super admin can change these settings.'))}</div>`}</div>
      <div class="panel"><div class="panel-title">${e(tr('Safety alerts'))}</div>${o.alerts.length ? o.alerts.map(a => `<div style="padding:10px 0;border-top:1px solid var(--border);font-size:14px;${a.status === 'open' ? 'background:#FDF0EE;' : ''}"><strong>${a.status === 'open' ? (a.kind === 'report' ? '📝 ' : '🚨 ') : ''}#${e(a.bookingNumber)}</strong>${a.kind === 'report' ? ` <em>${e(tr('problem report'))}</em>` : ''} · ${e(a.raisedByRole)} ${e(a.raisedByName)} · ${e(new Date(a.createdAt).toLocaleString())}${a.location ? ` · <a href="https://www.google.com/maps/search/?api=1&query=${a.location.latitude},${a.location.longitude}" target="_blank" rel="noopener">${e(tr('Open location'))}</a>` : ''}${a.note ? `<div>${e(a.note)}</div>` : ''}${a.status === 'open' ? `<button class="btn-sm btn-sm-outline" style="margin-top:6px;" onclick="ridesAdminResolve(${jsArg(a.id)})">${e(tr('Mark handled'))}</button>` : ` <span style="color:var(--slate);">${e(tr('handled'))}</span>`}</div>`).join('') : `<div style="color:var(--slate);">${e(tr('None'))}</div>`}</div>
      ${o.passes ? `<div class="panel"><div class="panel-title">${e(tr('Driver Passes'))}</div><div style="display:flex;gap:18px;flex-wrap:wrap;font-size:14px;"><span>🎟️ ${o.passes.activeDrivers} ${e(tr('drivers with an active pass'))}</span><span>🛒 ${o.passes.soldLast30Days} ${e(tr('sold in the last 30 days'))}</span><span>💵 ${money(o.passes.revenueLast30Days)} ${e(tr('in the last 30 days'))}</span></div>
        ${(o.passes.recent || []).length ? `<div style="margin-top:8px;font-size:13px;color:var(--slate);">${o.passes.recent.map(x => `${e(new Date(x.createdAt).toLocaleDateString())} · ${e(x.label)} · ${money(x.priceUsd)} · ${e(x.paymentStatus)}`).join('<br>')}</div>` : ''}
        <div class="ver-note" style="margin-top:8px;">${e(tr('"simulated" means payments are not live yet, so no real money moved.'))}</div></div>` : ''}
      <div class="panel"><div class="panel-title">${e(tr('Recent rides'))}</div>${(o.recent || []).length ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="text-align:left;color:var(--slate);"><th style="padding:6px;">#</th><th>${e(tr('When'))}</th><th>${e(tr('Rider'))}</th><th>${e(tr('Driver'))}</th><th>${e(tr('Trip'))}</th><th>${e(tr('Fare'))}</th><th>${e(tr('Status'))}</th></tr></thead><tbody>${o.recent.map(x => `<tr style="border-top:1px solid var(--border);${x.sos ? 'background:#FDF0EE;' : ''}"><td style="padding:6px;">${e(x.number)}</td><td>${e(new Date(x.createdAt).toLocaleString())}</td><td>${e(x.rider)}</td><td>${e(x.driver)}</td><td>${e(x.from || '')} → ${e(x.to || '')} · ${e(x.km || '')} km</td><td>${money(x.fare)}</td><td>${statusBadge(x.status)}${x.sos ? ' 🚨' : ''}${x.note ? `<div style="color:var(--slate);">${e(x.note)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="ver-note">${e(tr('No rides yet.'))}</div>`}</div>
      <div class="panel"><div class="panel-title">${e(tr('Driver applications'))}</div>${o.applications.length ? o.applications.map(a => `<div style="padding:12px 0;border-top:1px solid var(--border);font-size:14px;">
        <div style="font-weight:700;color:var(--navy);">${e(a.name)} <span style="font-weight:400;color:var(--slate);">· ${e(a.city || '')} ${e(a.country || '')} · ${statusBadge(a.status)}</span></div>
        <div>${e(a.vehicle)} ${e(a.make || '')} · ${e(tr('plate'))} <strong>${e(a.plate)}</strong> · ${e(tr('licence'))} ${e(a.licenceNumber)} (${e(tr('expires'))} ${e(a.licenceExpiry)})${a.insuranceExpiry ? ' · ' + e(tr('insurance until')) + ' ' + e(a.insuranceExpiry) : ''}${a.roadworthyExpiry ? ' · ' + e(tr('roadworthy until')) + ' ' + e(a.roadworthyExpiry) : ''}${a.vehicle === 'motorbike' ? ' · ' + e(a.helmet ? tr('helmet confirmed') : tr('NO helmet')) : ''}</div>
        <div style="margin:6px 0;">${Object.keys(o.docKinds || a.docs).map(k => a.docs[k] ? `<button class="btn-sm btn-sm-outline" onclick="ridesAdminDoc(${jsArg(a.userId)},'${k}')">📄 ${e(tr((o.docKinds || {})[k] || k))}${(a.required || []).includes(k) ? '' : ' (' + e(tr('extra')) + ')'}</button> ` : '').join('')}${(a.missing || []).length ? `<div style="margin-top:6px;color:#B4472E;font-weight:600;">⚠️ ${e(tr('Missing required:'))} ${a.missing.map(k => e(tr((o.docKinds || {})[k] || k))).join(', ')}</div>` : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${a.status === 'pending' ? `<button class="btn-sm btn-sm-primary" onclick="ridesAdminDecide(${jsArg(a.userId)},'approve')">${e(tr('Approve'))}</button><button class="btn-sm btn-sm-outline" onclick="ridesAdminDecide(${jsArg(a.userId)},'reject')">${e(tr('Reject'))}</button>` : ''}${a.status === 'approved' ? `<button class="btn-sm btn-sm-outline" onclick="ridesAdminDecide(${jsArg(a.userId)},'suspend')">${e(tr('Suspend'))}</button>` : ''}</div></div>`).join('') : `<div style="color:var(--slate);">${e(tr('No applications yet.'))}</div>`}</div>`;
    drawAdminFares(); // v142
    body().insertAdjacentHTML('beforeend', '<div class="panel" id="rides-places"></div>'); drawPlaces(); // v147
  }
  // ── v147: Admin → Rides → Places ──────────────────────────────────────
  // The list of places riders can search by name, per country. The
  // starter list has names only: pin each one once ("Pin it"). Riders'
  // own named places show as suggestions once 3 or more use the same name.
  R.plc = { country: 'Liberia', filter: '' };
  async function drawPlaces() {
    const box = el('rides-places'); if (!box) return;
    let d; try { d = await apiFetch('GET', `/admin/rides/places?country=${encodeURIComponent(R.plc.country)}`); } catch (x) { box.remove(); return; }
    R.plcData = d;
    const countries = ((R.over && R.over.countryList) || []).filter(c => c.on || c.name === R.plc.country).map(c => c.name);
    const f = places => places.filter(p => !R.plc.filter || (p.name + ' ' + p.area).toLowerCase().includes(R.plc.filter.toLowerCase()));
    const needs = f(d.places.filter(p => p.status === 'needs_pin')), live = f(d.places.filter(p => p.status === 'live'));
    const row = (p) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid var(--border);font-size:14px;">
      <div style="flex:1;min-width:200px;"><strong style="color:var(--navy);">${e(p.name)}</strong> <span style="color:var(--slate);">${e(p.area || '')}${p.kind && p.kind !== 'other' ? ' · ' + e(p.kind.replace('_', ' ')) : ''}${p.status === 'live' ? ` · ${p.uses} ${e(tr('rides'))}` : ''}</span>${p.riderPinHint ? `<div style="font-size:12.5px;color:#15803d;">${e(tr('Riders pinned it'))} ${p.riderPinHint.of}×: ${e(tr('"Pin it" starts there'))}</div>` : ''}</div>
      <button class="btn-sm ${p.status === 'live' ? 'btn-sm-outline' : 'btn-sm-primary'}" onclick="ridesPlacePin(${jsArg(p.id)})">${e(tr(p.status === 'live' ? 'Move pin' : 'Pin it'))}</button>
      ${p.status === 'live' ? `<a class="btn-sm btn-sm-ghost" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" rel="noopener">${e(tr('Check'))}</a>` : ''}
      <button class="btn-sm btn-sm-ghost" onclick="ridesPlaceRemove(${jsArg(p.id)})">${e(tr('Remove'))}</button></div>`;
    box.innerHTML = `<div class="panel-title">📌 ${e(tr('Places riders can search'))}</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(tr('Where there are few street addresses, riders find their pickup by a known name ("ELWA Junction", "Red Light"). Only pinned places are offered. Pin each place on the map once; check it on the satellite view if you are not there.'))}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
        ${countries.length > 1 ? `<select class="form-input form-select" style="max-width:200px;" onchange="ridesPlaceCountry(this.value)">${countries.map(c => `<option ${c === R.plc.country ? 'selected' : ''}>${e(c)}</option>`).join('')}</select>` : ''}
        <input class="form-input" type="search" placeholder="${e(tr('Find in the list'))}" value="${e(R.plc.filter)}" oninput="ridesPlaceFilter(this.value)" style="max-width:220px;"/>
        <span style="font-size:13.5px;">✅ ${d.counts.live} ${e(tr('pinned'))} · ⏳ ${d.counts.needsPin} ${e(tr('need a pin'))}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"><input class="form-input" id="plc-name" maxlength="80" placeholder="${e(tr('New place, e.g. Total station, Old Road'))}" style="flex:1;min-width:180px;"/><input class="form-input" id="plc-area" maxlength="60" placeholder="${e(tr('Area, e.g. Sinkor'))}" style="max-width:160px;"/><select class="form-input form-select" id="plc-kind" style="max-width:150px;">${d.kinds.map(k => `<option value="${k}">${e(k.replace('_', ' '))}</option>`).join('')}</select><button class="btn-sm btn-sm-primary" onclick="ridesPlaceNew()">${e(tr('Add and pin it'))}</button></div>
      ${d.suggestions.length ? `<div style="font-weight:700;color:var(--navy);margin-top:8px;">${e(tr('Suggested by riders'))}</div>${d.suggestions.map(x => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid var(--border);font-size:14px;"><div style="flex:1;"><strong>${e(x.name)}</strong> <span style="color:var(--slate);">· ${x.riders} ${e(tr('riders'))}</span></div><button class="btn-sm btn-sm-primary" onclick="ridesPlaceAccept(${jsArg(x.id)})">${e(tr('Check and add'))}</button><button class="btn-sm btn-sm-ghost" onclick="ridesPlaceDismiss(${jsArg(x.id)})">${e(tr('Not a place'))}</button></div>`).join('')}` : ''}
      ${needs.length ? `<div style="font-weight:700;color:var(--navy);margin-top:10px;">${e(tr('Need a pin'))} (${needs.length})</div>${needs.map(row).join('')}` : ''}
      ${live.length ? `<div style="font-weight:700;color:var(--navy);margin-top:10px;">${e(tr('Pinned'))} (${live.length})</div>${live.map(row).join('')}` : ''}`;
  }
  window.ridesPlaceCountry = (c) => { R.plc.country = c; drawPlaces(); };
  window.ridesPlaceFilter = (v) => { R.plc.filter = v; clearTimeout(R.plcT); R.plcT = setTimeout(drawPlaces, 250); };
  // pin with the shared map picker; when it hands back a spot, save it
  function pickThen(start, done) {
    R.plcDone = done;
    JOB_PIN.plcpin = start ? { latitude: start.latitude, longitude: start.longitude, accuracyM: null, source: 'map' } : null;
    if (!el('plcpin-pin-status')) document.body.insertAdjacentHTML('beforeend', '<div id="plcpin-pin-status" style="display:none;"></div>');
    openMapPicker('plcpin');
  }
  if (typeof renderJobPin === 'function') {
    const base = renderJobPin;
    renderJobPin = function (prefix) {
      if (prefix === 'plcpin' && JOB_PIN.plcpin && R.plcDone) { const fn = R.plcDone; R.plcDone = null; fn(JOB_PIN.plcpin); return; }
      return base.apply(this, arguments);
    };
  }
  window.ridesPlacePin = function (id) {
    const p = (R.plcData.places || []).find(x => x.id === id); if (!p) return;
    pickThen(p.latitude != null ? p : p.riderPinHint || (R.plcData.places.find(x => x.latitude != null) || null), async (pin) => {
      try { await apiFetch('PATCH', `/admin/rides/places/${encodeURIComponent(id)}`, { latitude: pin.latitude, longitude: pin.longitude }); showToast(`${p.name}: ${tr('pinned')}`); drawPlaces(); }
      catch (x) { showToast(x.message || tr('Could not save')); }
    });
  };
  window.ridesPlaceNew = function () {
    const name = (el('plc-name').value || '').trim(); if (name.length < 2) return showToast(tr('Type the name of the place first'));
    const area = el('plc-area').value.trim(), kind = el('plc-kind').value;
    pickThen(null, async (pin) => {
      try { await apiFetch('POST', '/admin/rides/places', { country: R.plc.country, name, area, kind, latitude: pin.latitude, longitude: pin.longitude }); showToast(`${name}: ${tr('added')}`); drawPlaces(); }
      catch (x) { showToast(x.message || tr('Could not save')); }
    });
  };
  window.ridesPlaceAccept = function (sid) {
    const sg = (R.plcData.suggestions || []).find(x => x.id === sid); if (!sg) return;
    pickThen(sg.at, async (pin) => {
      try { await apiFetch('POST', '/admin/rides/places', { country: R.plc.country, name: sg.name, latitude: pin.latitude, longitude: pin.longitude, fromSuggestion: sid }); showToast(`${sg.name}: ${tr('added')}`); drawPlaces(); }
      catch (x) { showToast(x.message || tr('Could not save')); }
    });
  };
  window.ridesPlaceDismiss = async (sid) => { try { await apiFetch('POST', `/admin/rides/places/suggestions/${encodeURIComponent(sid)}/dismiss`, {}); drawPlaces(); } catch (x) { showToast(x.message); } };
  window.ridesPlaceRemove = async (id) => { try { await apiFetch('DELETE', `/admin/rides/places/${encodeURIComponent(id)}`); drawPlaces(); } catch (x) { showToast(x.message); } };
  // ── v142: Admin → Rides → Fares ──────────────────────────────────────
  const FARE_VEH = ['motorbike', 'keke', 'car', 'van'];
  const SPEED = { motorbike: 24, keke: 18, car: 20, van: 18 };
  const F = { data: null, country: null };
  function fareRowsHTML(t, edit) {
    const v = (t && t.vehicles) || {};
    return `<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:13.5px;min-width:520px;"><thead><tr style="text-align:left;color:var(--slate);"><th style="padding:4px 6px;">${e(tr('Vehicle'))}</th><th>${e(tr('Starting fare'))}</th><th>${e(tr('Per km'))}</th><th>${e(tr('Per minute'))}</th><th>${e(tr('Lowest fare'))}</th></tr></thead><tbody>${FARE_VEH.map(k => `<tr style="border-top:1px solid var(--border);"><td style="padding:4px 6px;">${e(tr(k))}</td>${['base', 'perKm', 'perMin', 'min'].map(f => `<td style="padding:3px;"><input class="form-input rf-in" data-v="${k}" data-f="${f}" type="number" min="0" step="any" value="${v[k] && v[k][f] != null ? e(v[k][f]) : ''}" style="width:90px;padding:6px;" ${edit ? '' : 'disabled'} oninput="ridesFarePreview()"/></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function readFareForm() {
    const vehicles = {};
    document.querySelectorAll('.rf-in').forEach(i => { if (i.value === '') return; (vehicles[i.dataset.v] = vehicles[i.dataset.v] || {})[i.dataset.f] = Number(i.value); });
    for (const k of Object.keys(vehicles)) if (vehicles[k].base == null && vehicles[k].min == null) delete vehicles[k];
    const g = (id) => (el(id) && el(id).value !== '' ? Number(el(id).value) : null);
    return { currency: (el('rf-cur').value || '').trim().toUpperCase(), vehicles, fuel: { refPrice: g('rf-fref'), currentPrice: g('rf-fcur'), threshold: g('rf-fth'), share: g('rf-fsh') }, night: { pct: g('rf-npct') || 0, startHour: g('rf-ns') == null ? 22 : g('rf-ns'), endHour: g('rf-ne') == null ? 5 : g('rf-ne') }, band: g('rf-band'), offerFloor: g('rf-floor'), roundTo: g('rf-round'), tzOffset: g('rf-tz') || 0 };
  }
  window.ridesFarePreview = function () {
    const box = el('rf-preview'); if (!box) return;
    const t = readFareForm(); const f = t.fuel; let fuel = 1;
    if (f.refPrice > 0 && f.currentPrice > 0) { const ch = f.currentPrice / f.refPrice - 1; if (Math.abs(ch) * 100 >= (f.threshold == null ? 10 : f.threshold)) fuel = 1 + ((f.share == null ? 40 : f.share) / 100) * ch; }
    const step = t.roundTo == null ? 5 : t.roundTo; const rd = (x) => (step > 0 ? Math.round(x / step) * step : Math.round(x * 100) / 100);
    const rows = Object.keys(t.vehicles).map(k => { const v = t.vehicles[k]; return `<tr style="border-top:1px solid var(--border);"><td style="padding:4px 6px;">${e(tr(k))}</td>${[2, 5, 10].map(d => { const m = d / SPEED[k] * 60; return `<td style="padding:4px 12px 4px 6px;white-space:nowrap;text-align:right;">${e(t.currency === 'LRD' ? 'L$' : t.currency + ' ')}${e(rd(Math.max(v.min || 0, (v.base || 0) + (v.perKm || 0) * d + (v.perMin || 0) * m) * fuel).toLocaleString())}</td>`; }).join('')}</tr>`; }).join('');
    box.innerHTML = rows ? `<div style="font-weight:700;color:var(--navy);margin:8px 0 4px;">${e(tr('Example fares (daytime)'))}${fuel !== 1 ? ` · ${e(tr('fuel'))} ${fuel > 1 ? '+' : ''}${Math.round((fuel - 1) * 1000) / 10}%` : ''}</div><table style="border-collapse:collapse;font-size:13.5px;"><thead><tr style="text-align:left;color:var(--slate);"><th style="padding:4px 6px;"></th><th style="padding:4px 12px 4px 6px;text-align:right;">2 km</th><th style="padding:4px 12px 4px 6px;text-align:right;">5 km</th><th style="padding:4px 12px 4px 6px;text-align:right;">10 km</th></tr></thead><tbody>${rows}</tbody></table><div style="font-size:12px;color:var(--slate);">${e(tr('Minutes estimated at city speeds (motorbike 24 km/h, car 20, keke and van 18). Real trips use the road distance and time.'))}</div>` : '';
  };
  function drawFareForm() {
    const host = el('rf-form'); if (!host || !F.data) return;
    const o = F.data, t = o.tables[F.country] || null, edit = R.over && R.over.canEditSettings;
    const curDefault = F.country && /liberia/i.test(F.country) ? 'LRD' : '';
    const inp = (id, label, val, extra) => `<div class="form-group" style="flex:1 1 150px;"><label class="form-label" for="${id}">${e(tr(label))}</label><input class="form-input" id="${id}" type="number" step="any" value="${val == null ? '' : e(val)}" ${edit ? '' : 'disabled'} oninput="ridesFarePreview()" ${extra || ''}/></div>`;
    host.innerHTML = `<div class="dates-row"><div class="form-group" style="flex:0 1 140px;"><label class="form-label" for="rf-cur">${e(tr('Currency'))}</label><input class="form-input" id="rf-cur" value="${e(t ? t.currency : curDefault)}" maxlength="3" ${edit ? '' : 'disabled'} oninput="ridesFarePreview()"/></div></div>
      ${fareRowsHTML(t, edit)}
      <div style="font-weight:700;color:var(--navy);margin:14px 0 4px;">⛽ ${e(tr('Fuel price link'))}</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(tr('Enter the pump price the fares above were set at, and today\'s price. Fares only move once the price has changed by more than the threshold, like the Ministry of Transport\'s fares, and then by the share of a fare that is fuel. Drivers are told when fares move.'))}</div>
      <div class="dates-row" style="flex-wrap:wrap;">${inp('rf-fref', 'Price when fares were set (per gallon)', t && t.fuel.refPrice)}${inp('rf-fcur', 'Price today (per gallon)', t && t.fuel.currentPrice)}${inp('rf-fth', 'Only move fares after a change of (%)', t ? t.fuel.threshold : 10)}${inp('rf-fsh', 'Share of a fare that is fuel (%)', t ? t.fuel.share : 40)}</div>
      <div style="font-weight:700;color:var(--navy);margin:10px 0 4px;">${e(tr('Other rules'))}</div>
      <div class="dates-row" style="flex-wrap:wrap;">${inp('rf-band', 'Drivers may be above or below the fare by up to (%)', t ? t.band : 20)}${inp('rf-floor', 'Lowest offer a rider can make (% of the fare)', t ? t.offerFloor : 70)}${inp('rf-round', 'Round fares to the nearest', t ? t.roundTo : 5)}</div>
      <div class="dates-row" style="flex-wrap:wrap;">${inp('rf-npct', 'Night extra (%), 0 for none', t ? t.night.pct : 0)}${inp('rf-ns', 'Night starts (hour, 0-23)', t ? t.night.startHour : 22)}${inp('rf-ne', 'Night ends (hour, 0-23)', t ? t.night.endHour : 5)}${inp('rf-tz', 'Hours from UTC (Liberia 0)', t ? t.tzOffset : 0)}</div>
      <div id="rf-preview"></div>
      ${edit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn-sm btn-sm-primary" onclick="ridesFareSave()">${e(tr('Save fares for'))} ${e(F.country)}</button>${t ? `<button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="ridesFareRemove()">${e(tr('Stop Trothen fares here (drivers set their own)'))}</button>` : ''}</div>` : `<div class="ver-note">${e(tr('Only a super admin can change fares.'))}</div>`}`;
    ridesFarePreview();
  }
  window.ridesFareCountry = function (c) { F.country = c; drawFareForm(); };
  window.ridesFareSave = async function () {
    if (!(await confirmDialog(tr('Save these fares? Riders in') + ' ' + F.country + ' ' + tr('see them straight away.'), { confirmLabel: tr('Save fares') }))) return;
    try { const r = await apiFetch('PUT', '/admin/rides/fares', { country: F.country, table: readFareForm() }); F.data.tables = r.tables; showToast(tr('Fares saved')); drawAdminFares(true); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.ridesFareRemove = async function () {
    if (!(await confirmDialog(tr('Stop Trothen fares in') + ' ' + F.country + '? ' + tr('Each driver\'s own starting fare and price per km apply again.'), { confirmLabel: tr('Stop'), danger: true }))) return;
    try { const r = await apiFetch('PUT', '/admin/rides/fares', { country: F.country, remove: true }); F.data.tables = r.tables; drawAdminFares(true); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  async function drawAdminFares(reload) {
    if (!body()) return;
    try { F.data = await apiFetch('GET', '/admin/rides/fares'); } catch (x) { return; }
    const o = F.data; const countries = [...new Set([...(o.enabledCountries || []), ...Object.keys(o.tables)])];
    if (!F.country || !countries.includes(F.country)) F.country = countries[0] || null;
    let box = el('admin-ride-fares');
    if (!box) { box = document.createElement('div'); box.className = 'panel'; box.id = 'admin-ride-fares'; const first = body().querySelector('.panel'); if (first && first.nextSibling) body().insertBefore(box, first.nextSibling); else body().appendChild(box); }
    box.innerHTML = `<div class="panel-title">💰 ${e(tr('Fares'))}</div>
      <div style="font-size:13.5px;color:var(--slate);margin-bottom:8px;">${e(tr('Trothen proposes every fare from the road distance and the time, per vehicle, in the country\'s own money. No surge pricing. A country without fares here uses each driver\'s own rates.'))} ${o.routing ? `<strong style="color:#1E7A55;">${e(tr('Road distances: on'))}</strong>` : `<span>${e(tr('Road distances: estimated (straight line × 1.3). Set ROUTING_URL on the server for real road distances.'))}</span>`}</div>
      ${countries.length ? `<div class="form-group"><label class="form-label" for="rf-country">${e(tr('Country'))}</label><select class="form-input form-select" id="rf-country" onchange="ridesFareCountry(this.value)" style="max-width:260px;">${countries.map(c => `<option ${c === F.country ? 'selected' : ''}>${e(c)}</option>`).join('')}</select></div><div id="rf-form"></div>` : `<div class="ver-note">${e(tr('Switch rides on in a country first.'))}</div>`}
      ${(o.stats || []).length ? `<div style="font-weight:700;color:var(--navy);margin:14px 0 4px;">${e(tr('What riders actually paid (last 30 days)'))}</div><table style="border-collapse:collapse;font-size:13.5px;"><thead><tr style="text-align:left;color:var(--slate);"><th style="padding:4px 6px;">${e(tr('Country'))}</th><th>${e(tr('Vehicle'))}</th><th>${e(tr('Rides'))}</th><th>${e(tr('Average trip'))}</th><th>${e(tr('Per km'))}</th></tr></thead><tbody>${o.stats.map(s => `<tr style="border-top:1px solid var(--border);"><td style="padding:4px 6px;">${e(s.country)}</td><td>${e(tr(s.vehicle))}</td><td>${e(s.rides)}</td><td>${e(s.avgKm)} km</td><td>${s.localPerKm != null ? `${e(s.currency)} ${e(s.localPerKm)} · ` : ''}${money(s.usdPerKm)}</td></tr>`).join('')}</tbody></table>` : ''}`;
    drawFareForm();
  }
  window.ridesAdminSave = async function () {
    try {
      await apiFetch('PUT', '/admin/rides/settings', { maxKm: Number(el('rs-max').value), searchKm: Number(el('rs-search').value), answerMinutes: Number(el('rs-ans').value), feePercent: Number(el('rs-fee').value), commissionPercent: Number(el('rs-comm').value), requireInsurance: el('rs-ins').value === '1', motorbikeNight: { enabled: el('rs-night').checked, startHour: Number(el('rs-n1').value), endHour: Number(el('rs-n2').value) }, rulesRider: el('rs-rr').value, rulesDriver: el('rs-rd').value, docRules: el('rs-docs').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const x = l.split('|').map(t => t.trim()); return { country: x[0], vehicle: (x[1] || '').toLowerCase(), docs: (x[2] || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean) }; }), passEnabled: el('rs-pass').value === '1', cashEnabled: el('rs-cash').value === '1', passPlans: el('rs-plans').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const x = l.split(',').map(t => t.trim()); return { id: x[0], label: x[1], days: Number(x[2]), priceUsd: Number(x[3]) }; }), autoReleaseHours: Number(el('rs-auto').value), noStartHours: Number(el('rs-nostart').value), stuckHours: Number(el('rs-stuck').value), waitMinutes: Number(el('rs-wait').value), trackKeepDays: Number(el('rs-keep').value) });
      showToast(tr('Saved')); loadAdminRides();
    } catch (x) { showToast(x.message || 'Could not save'); }
  };
  window.ridesAdminResolve = async function (id) { try { await apiFetch('POST', `/admin/rides/alerts/${encodeURIComponent(id)}/resolve`, {}); loadAdminRides(); } catch (x) { showToast(x.message || 'Error'); } };
  window.ridesAdminDoc = async function (userId, kind) {
    try {
      const res = await fetch(API_BASE + `/admin/rides/applications/${encodeURIComponent(userId)}/doc/${kind}`, { headers: { Authorization: 'Bearer ' + AUTH.token } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not open');
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch (x) { showToast(x.message || 'Could not open the document'); }
  };
  window.ridesAdminDecide = async function (userId, decision) {
    let reason = '';
    if (decision !== 'approve') { reason = prompt(tr('Reason for the driver (at least 5 characters)')) || ''; if (reason.trim().length < 5) return showToast(tr('A reason is needed')); }
    else if (!(await confirmDialog(tr('Approve this driver? Check the licence and the vehicle photo first.'), { confirmLabel: tr('Approve') }))) return;
    try { await apiFetch('POST', `/admin/rides/applications/${encodeURIComponent(userId)}/decision`, { decision, reason }); showToast(tr('Done')); loadAdminRides(); } catch (x) { showToast(x.message || 'Error'); }
  };
})();
