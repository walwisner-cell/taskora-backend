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
  const when = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const STATUS_WORDS = { pending_provider_confirmation: 'Waiting for the driver to answer', active: 'Confirmed', completed: 'Finished', cancelled: 'Cancelled', declined: 'The driver said no', expired: 'No answer, refunded' };

  function section(title, sub) {
    return `<div class="dash-header"><div><div class="dash-title">${e(tr(title))}</div><div class="dash-sub">${e(tr(sub))}</div></div></div><div id="rides-body"><div class="panel">${e(tr('Loading…'))}</div></div>`;
  }
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
    else { addNav(PROVIDER_NAV_ITEMS, 'contracts', { key: 'rides', label: 'Rides', icon: '🛵' }); rerenderNav('provider-nav', PROVIDER_NAV_ITEMS, 'selectProviderSection'); }
  }
  function rerenderNav(id, items, fn) {
    const box = el(id); if (!box) return;
    const act = box.querySelector('.dash-nav-item.active');
    const it = (act && items.find(i => act.textContent.includes(i.label))) || items[0];
    renderDashNav(id, items, it.key, fn);
  }
  CUSTOMER_SECTIONS.rides = () => section('Rides', 'Get a safe ride from a verified driver');
  PROVIDER_SECTIONS.rides = () => section('Rides', 'Give rides to passengers');
  if (typeof ADMIN_SECTIONS !== 'undefined') ADMIN_SECTIONS.rides = () => section('Rides', 'Drivers, safety alerts and where rides are on');

  { const f = selectCustomerSection; selectCustomerSection = function (key) { stopTimers(); const r = f.apply(this, arguments); if (key === 'rides') loadRiderPage(); return r; }; }
  { const f = selectProviderSection; selectProviderSection = function (key) { stopTimers(); const r = f.apply(this, arguments); if (key === 'rides') loadDriverPage(); return r; }; }
  { const f = selectAdminSection; selectAdminSection = function (key) { stopTimers(); const r = f.apply(this, arguments); if (key === 'rides') loadAdminRides(); return r; }; }
  { const f = getAdminNavItems; getAdminNavItems = function () { const items = f.apply(this, arguments).slice(); const u = AUTH.user || {}; if (!u.adminDepartment || ['verification', 'customer_service'].includes(u.adminDepartment)) addNav(items, 'stores', { key: 'rides', label: 'Rides', icon: '🛵' }); return items; }; }
  // The dashboards are started through a saved reference, so hook the sidebar update every start-up calls by name.
  { const f = updateCustomerSidebar; updateCustomerSidebar = function () { const r = f.apply(this, arguments); checkRidesMenu(); return r; }; }
  { const f = updateProviderSidebar; updateProviderSidebar = function () { const r = f.apply(this, arguments); checkRidesMenu(); return r; }; }

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
    const open = list.find(r => r.status === 'active' || r.status === 'pending_provider_confirmation');
    const past = list.filter(r => r !== open);
    body().innerHTML = (open ? riderTrip(open) : riderForm()) + (past.length ? `<div class="panel"><div class="panel-title">${e(tr('Past rides'))}</div>${past.slice(0, 15).map(pastRow).join('')}</div>` : '');
    if (open) { R.poll = setInterval(() => { if (!body()) return stopTimers(); loadRiderPage(); }, 8000); } else { renderPins(); }
  }
  function pastRow(r) {
    return `<div style="padding:10px 0;border-top:1px solid var(--border);font-size:14px;"><strong>${e(r.pickup.address)}</strong> → <strong>${e(r.dropoff.address)}</strong><div style="color:var(--slate);">${e(new Date(r.createdAt).toLocaleDateString())} · ${money(r.totalPaid)} · ${e(tr(STATUS_WORDS[r.status] || r.status))}</div></div>`;
  }
  function pinBox(prefix, label) {
    return `<div class="form-group"><label class="form-label">${e(tr(label))}</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn-sm btn-sm-outline" id="${prefix}-pin-btn" onclick="pinJobLocation('${prefix}')">${e(tr('Use my location'))}</button><button type="button" class="btn-sm btn-sm-outline" onclick="openMapPicker('${prefix}')">${e(tr('Choose on a map'))}</button></div>
      <div id="${prefix}-pin-status" style="font-size:13.5px;margin-top:8px;" aria-live="polite"></div>
      <input class="form-input" id="${prefix}-name" maxlength="120" placeholder="${e(tr('Name of the place, e.g. Red Light Market'))}" style="margin-top:8px;"/></div>`;
  }
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
      R.quote = { a, b, pax, an: (el('ridefrom-name').value || '').trim() || 'Pickup', bn: (el('rideto-name').value || '').trim() || 'Destination', fee: r.feePercent };
      if (!r.drivers.length) { out.innerHTML = `<div class="ver-note">${e(tr('No drivers are online near you right now. Try again in a few minutes.'))}</div>`; return; }
      out.innerHTML = `<div style="color:var(--slate);font-size:13.5px;margin-bottom:6px;">${e(tr('About'))} ${e(km(r.tripKm))}. ${e(tr('Fares are estimates from the distance; the driver sets their own price.'))}</div>` + r.drivers.map(d => `
        <div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--border);flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;"><div style="font-weight:700;color:var(--navy);">${e(d.name)} <span style="font-weight:400;color:var(--slate);">· ${d.rating ? '★ ' + e(d.rating) : e(tr('New'))}</span></div>
          <div style="font-size:13.5px;color:var(--slate);">${e(tr(d.vehicle))}${d.make ? ' · ' + e(d.make) : ''} · ${e(km(d.awayKm))} ${e(tr('away'))}${d.helmet ? ' · ' + e(tr('helmet provided')) : ''}</div></div>
          <div style="text-align:right;"><div style="font-weight:700;font-size:18px;">${money(d.fare)}</div><div style="font-size:12px;color:var(--slate);">+ ${e(r.feePercent)}% ${e(tr('Trothen fee'))}</div></div>
          <button class="btn-sm btn-sm-primary" onclick="ridesRequest(${jsArg(d.id)},${d.fare})">${e(tr('Request'))}</button>
        </div>`).join('');
    } catch (x) { out.innerHTML = `<div class="ver-note">${e(x.message || 'Could not find drivers')}</div>`; }
  };
  window.ridesRequest = async function (driverId, fare) {
    const q = R.quote; if (!q) return;
    if (!(await confirmDialog(tr('Request this ride? The fare is held now and refunded if the driver does not answer or you cancel before the trip starts.'), { confirmLabel: tr('Request ride') }))) return;
    try {
      await apiFetch('POST', '/rides', { driverId, passengers: q.pax, expectedFare: fare, pickup: { latitude: q.a.latitude, longitude: q.a.longitude, address: q.an }, dropoff: { latitude: q.b.latitude, longitude: q.b.longitude, address: q.bn } });
      showToast(tr('Ride requested. Waiting for the driver.')); loadRiderPage();
    } catch (x) { showToast(x.message || 'Could not request the ride'); if (x.data && x.data.code === 'PRICE_CHANGED') window.ridesFindDrivers(); }
  };
  function riderTrip(r) {
    const d = r.driver || {};
    const waiting = r.status === 'pending_provider_confirmation';
    return `<div class="panel" style="border:2px solid ${r.sosCount ? '#C0392B' : 'var(--teal)'};">
      <div class="panel-title">${e(tr(waiting ? 'Waiting for your driver' : r.startedAt ? 'You are on your way' : 'Your driver is coming'))} <small>#${e(r.number)}</small></div>
      <div style="font-size:15px;"><strong>${e(r.pickup.address)}</strong> → <strong>${e(r.dropoff.address)}</strong> · ${e(km(r.km))}</div>
      <div style="margin:10px 0;display:flex;gap:12px;align-items:center;">${d.profilePhotoUrl ? `<img src="${e(d.profilePhotoUrl)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;"/>` : `<div style="width:56px;height:56px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${e(d.initials || '?')}</div>`}
        <div><div style="font-weight:700;color:var(--navy);">${e(d.name || '')}</div><div style="font-size:14px;color:var(--slate);">${e(tr(d.vehicle || ''))}${d.make ? ' · ' + e(d.make) : ''}${d.helmet ? ' · ' + e(tr('helmet for you')) : ''}</div>
        ${d.plate ? `<div style="margin-top:4px;display:inline-block;border:2px solid #222;border-radius:6px;padding:2px 10px;font-weight:800;letter-spacing:1px;background:#FFE680;">${e(d.plate)}</div>` : ''}</div></div>
      ${waiting ? `<div class="ver-note">${e(tr('Answer due by'))} ${e(when(r.answerBy))}. ${e(tr('If there is no answer you are refunded automatically.'))}</div>` : ''}
      ${r.pin ? `<div style="text-align:center;margin:12px 0;padding:14px;border-radius:12px;background:#EEF8F3;"><div style="font-size:13px;color:var(--slate);">${e(tr('Your trip PIN. Check the plate, then give the driver this PIN.'))}</div><div style="font-size:44px;font-weight:800;letter-spacing:10px;color:var(--navy);">${e(r.pin)}</div></div>` : ''}
      ${r.status === 'active' ? `<div style="font-size:14px;margin:6px 0;">${r.live ? `📍 ${e(tr(r.phase === 'to_destination' ? 'On the way to your destination' : 'Driver is coming'))}${r.etaMinutes ? ' · ' + e(tr('about')) + ' ' + r.etaMinutes + ' ' + e(tr('min')) : ''}${r.stale ? ` · <span style="color:#B4472E;">${e(tr('no update for a while'))}</span>` : ''}` : e(tr('Waiting for the driver\'s location…'))}</div><button class="btn-sm btn-sm-primary" onclick="openTrack('ride',${jsArg(r.id)})">🗺️ ${e(tr('Watch on the map'))}</button>${contactRow(r.contact)}` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${r.canConfirm ? `<button class="confirm-btn" onclick="ridesConfirm(${jsArg(r.id)})">✅ ${e(tr('I arrived safely, pay the driver'))}</button>` : ''}
        ${r.shareUrl ? `<button class="btn-sm btn-sm-outline" onclick="ridesShare(${jsArg(r.shareUrl)})">🔗 ${e(tr('Share my trip'))}</button>` : ''}
        ${r.status === 'active' ? `<button class="btn-sm" style="background:#C0392B;color:#fff;" onclick="ridesSOS(${jsArg(r.id)})">🚨 ${e(tr('Emergency / SOS'))}</button>` : ''}
        ${r.canCancel ? `<button class="btn-sm btn-sm-outline" onclick="ridesCancel(${jsArg(r.id)})">${e(tr('Cancel ride'))}</button>` : ''}
      </div>
      <div class="ver-note" style="margin-top:10px;">${e(tr('Never get in if the plate or the driver does not match. Fare:'))} ${money(r.fare)} + ${money(r.fee)} ${e(tr('Trothen fee'))}.</div></div>`;
  }
  window.ridesConfirm = async function (id) {
    if (!(await confirmDialog(tr('Confirm you arrived? The driver is paid now.'), { confirmLabel: tr('Pay the driver') }))) return;
    try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/confirm`, {}); showToast(tr('Thank you. The driver has been paid.')); loadRiderPage(); } catch (x) { showToast(x.message || 'Could not confirm'); }
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
    if (d.status === 'approved') html += driverOps(d, list) + driverRates(d);
    else html += driverApply(d);
    const past = list.filter(r => !['active', 'pending_provider_confirmation'].includes(r.status));
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
        <div class="form-group"><label class="form-label" for="rd-vehicle">${e(tr('Vehicle'))}</label><select class="form-input form-select" id="rd-vehicle" ${locked ? 'disabled' : ''}>${Object.keys(d.vehicles).map(v => `<option value="${v}" ${v === d.vehicle ? 'selected' : ''}>${e(tr(v))} (${d.vehicles[v]} ${e(tr('seats'))})</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="rd-make">${e(tr('Make / colour'))}</label><input class="form-input" id="rd-make" maxlength="40" value="${e(d.make)}" placeholder="Honda, red" ${locked ? 'disabled' : ''}/></div>
        <div class="form-group"><label class="form-label" for="rd-plate">${e(tr('Number plate'))}</label><input class="form-input" id="rd-plate" maxlength="15" value="${e(d.plate)}" ${locked ? 'disabled' : ''}/></div>
      </div>
      <div class="dates-row">
        <div class="form-group"><label class="form-label" for="rd-lic">${e(tr("Driver's licence number"))}</label><input class="form-input" id="rd-lic" maxlength="30" value="${e(d.licenceNumber)}" ${locked ? 'disabled' : ''}/></div>
        <div class="form-group"><label class="form-label" for="rd-exp">${e(tr('Licence expires'))}</label><input class="form-input" type="date" id="rd-exp" value="${e(d.licenceExpiry)}" ${locked ? 'disabled' : ''}/></div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0 12px;"><input type="checkbox" id="rd-helmet" ${d.helmet ? 'checked' : ''} ${locked ? 'disabled' : ''}/> ${e(tr('I carry a helmet for the passenger (motorbike riders)'))}</label>
      ${locked ? '' : `<button class="btn-sm btn-sm-primary" onclick="ridesSaveApply()">${e(tr('Save details'))}</button>`}
      <div style="margin-top:14px;font-weight:700;color:var(--navy);">${e(tr('Documents'))}</div>${Object.keys(d.docKinds || { licence: 1, registration: 1, vehicle: 1, insurance: 1 }).map(docRow).join('')}
      ${locked || d.status === 'none' ? '' : `<button class="confirm-btn" style="margin-top:12px;" onclick="ridesSubmitApply()">${e(tr('Send for review'))}</button>`}</div>`;
  }
  window.el_ = (id) => document.getElementById(id);
  window.ridesSaveApply = async function () {
    if (!(await ensureRules())) return;
    try {
      await apiFetch('POST', '/rides/driver/apply', { vehicle: el('rd-vehicle').value, make: el('rd-make').value, plate: el('rd-plate').value, licenceNumber: el('rd-lic').value, licenceExpiry: el('rd-exp').value, helmet: el('rd-helmet').checked });
      showToast(tr('Saved. Now upload your documents.')); loadDriverPage();
    } catch (x) { showToast(x.message || 'Could not save'); }
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
  function driverRates(d) {
    return `<div class="panel"><div class="panel-title">${e(tr('My fares'))}</div>
      <div class="dates-row"><div class="form-group"><label class="form-label" for="rr-base">${e(tr('Starting fare (US$)'))}</label><input class="form-input" id="rr-base" type="number" min="0.5" max="100" step="0.01" value="${e(d.rates.baseFee)}"/></div>
      <div class="form-group"><label class="form-label" for="rr-km">${e(tr('Plus, for each kilometre (US$)'))}</label><input class="form-input" id="rr-km" type="number" min="0" max="20" step="0.01" value="${e(d.rates.perKm)}"/></div></div>
      <button class="btn-sm btn-sm-primary" onclick="ridesSaveRates()">${e(tr('Save my fares'))}</button>
      <div class="ver-note" style="margin-top:10px;">${e(tr('Riders see your fare before they choose you. Trothen adds a'))} ${e(d.feePercent)}% ${e(tr('fee on top for the rider. On ride earnings Trothen takes'))} ${e(d.commissionPercent)}% ${e(tr('when you are paid out (never more than your plan rate).'))}</div></div>`;
  }
  window.ridesSaveRates = async function () {
    try { await apiFetch('PUT', '/rides/driver/rates', { baseFee: Number(el('rr-base').value), perKm: Number(el('rr-km').value) }); showToast(tr('Fares saved')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not save'); }
  };
  function driverOps(d, list) {
    const incoming = list.filter(r => r.status === 'pending_provider_confirmation'), active = list.filter(r => r.status === 'active');
    return `<div class="panel"><div class="panel-title">${e(tr('Rides'))}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><span style="font-weight:700;color:${d.online ? '#2E8C6F' : 'var(--slate)'};">● ${e(tr(d.online ? 'You are online. Riders near you can see you.' : 'You are offline'))}</span>
      <button class="btn-sm ${d.online ? 'btn-sm-outline' : 'btn-sm-primary'}" onclick="ridesToggleOnline(${d.online ? 'false' : 'true'})">${e(tr(d.online ? 'Go offline' : 'Go online'))}</button></div>
      <div class="ver-note" style="margin-top:8px;">${e(tr('Keep this page open while you are online so riders can find you. You go offline by yourself after 12 hours.'))}</div></div>
      ${incoming.map(r => `<div class="panel" style="border:2px solid #E0A526;"><div class="panel-title">${e(tr('New ride request'))} <small>#${e(r.number)}</small></div>
        <div><strong>${e(r.pickup.address)}</strong> → <strong>${e(r.dropoff.address)}</strong> · ${e(km(r.km))} · ${e(r.passengers)} ${e(tr('passenger(s)'))}</div>
        <div style="font-size:14px;color:var(--slate);margin:4px 0;">${e(tr('Fare'))}: <strong>${money(r.fare)}</strong> · ${e(tr('Answer by'))} ${e(when(r.answerBy))}</div>
        <div style="display:flex;gap:8px;"><button class="btn-sm btn-sm-primary" onclick="ridesAnswer(${jsArg(r.id)},'accept')">${e(tr('Accept'))}</button><button class="btn-sm btn-sm-outline" onclick="ridesAnswer(${jsArg(r.id)},'decline')">${e(tr('Decline'))}</button></div></div>`).join('')}
      ${active.map(r => `<div class="panel" style="border:2px solid var(--teal);"><div class="panel-title">${e(tr(r.startedAt ? 'Trip in progress' : 'Go to your rider'))} <small>#${e(r.number)}</small></div>
        <div><strong>${e(r.pickup.address)}</strong> <a href="https://www.google.com/maps/dir/?api=1&destination=${r.pickup.latitude},${r.pickup.longitude}" target="_blank" rel="noopener">🧭</a> → <strong>${e(r.dropoff.address)}</strong> <a href="https://www.google.com/maps/dir/?api=1&destination=${r.dropoff.latitude},${r.dropoff.longitude}" target="_blank" rel="noopener">🧭</a></div>
        <div style="font-size:14px;color:var(--slate);margin:4px 0;">${e(r.rider ? r.rider.name : '')} · ${e(r.passengers)} ${e(tr('passenger(s)'))} · ${money(r.fare)}</div>
        ${contactRow(r.contact)}
        ${!r.startedAt ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">
          <button class="btn-sm btn-sm-outline" onclick="ridesArrived(${jsArg(r.id)})">📍 ${e(tr('I have arrived'))}</button>
          <input class="form-input" id="rd-pin-${e(r.id)}" inputmode="numeric" maxlength="4" placeholder="${e(tr('Rider PIN'))}" style="width:130px;"/>
          <button class="btn-sm btn-sm-primary" onclick="ridesStart(${jsArg(r.id)})">${e(tr('Start trip'))}</button></div>
          <div class="ver-note" style="margin-top:8px;">${e(tr('You can only start with the 4-digit PIN from the rider\'s app. Do not carry anyone who cannot give it.'))}</div>`
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
    try { await apiFetch('POST', `/contracts/${encodeURIComponent(id)}/respond-offer`, { decision }); showToast(tr(decision === 'accept' ? 'Accepted. Go to your rider.' : 'Declined')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not answer'); loadDriverPage(); }
  };
  window.ridesArrived = async function (id) { try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/arrived`, {}); showToast(tr('The rider has been told')); loadDriverPage(); } catch (x) { showToast(x.message || 'Error'); } };
  window.ridesStart = async function (id) {
    const pin = (el('rd-pin-' + id) || {}).value || ''; const f = await here();
    try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/start`, { pin, latitude: f ? f.latitude : undefined, longitude: f ? f.longitude : undefined }); showToast(tr('Trip started')); loadDriverPage(); } catch (x) { showToast(x.message || 'Could not start'); }
  };
  window.ridesEnd = async function (id) { try { await apiFetch('POST', `/rides/${encodeURIComponent(id)}/end`, {}); showToast(tr('The rider has been asked to confirm')); loadDriverPage(); } catch (x) { showToast(x.message || 'Error'); } };


  // ── CONTACTS ─────────────────────────────────────────────────────────
  // Real phone calls and texts go through the phone's own dialer; the in-app
  // chat is the Messages page. Numbers are only sent by the server while the
  // trip or delivery is open.
  function digits(p) { return String(p || '').replace(/[^\d]/g, ''); }
  function contactRow(c, label) {
    if (!c) return '';
    const who = label ? `<span style="font-weight:600;">${e(label)}${c.name ? ': ' + e(c.name) : ''}</span> ` : '';
    if (!c.phone) return `<div style="font-size:13.5px;margin-top:8px;color:var(--slate);">${who}${e(tr('No phone number on file. Use Messages.'))} <a onclick="ridesOpenMessages()" style="cursor:pointer;color:var(--teal);text-decoration:underline;">${e(tr('Open Messages'))}</a></div>`;
    const ph = c.phone.replace(/[^\d+]/g, ''), d = digits(c.phone);
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;">${who}<a class="btn-sm btn-sm-outline" href="tel:${e(ph)}">📞 ${e(tr('Call'))}</a><a class="btn-sm btn-sm-outline" href="sms:${e(ph)}">💬 ${e(tr('Text'))}</a>${d.length >= 8 ? `<a class="btn-sm btn-sm-outline" href="https://wa.me/${e(d)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<a class="btn-sm btn-sm-ghost" onclick="ridesOpenMessages()" style="cursor:pointer;">✉️ ${e(tr('In-app message'))}</a></div>`;
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
    T.map = null; T.layer = null; T.fitted = false;
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
    T.layer.clearLayers();
    const dot = (c) => L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: `<div style="width:18px;height:18px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);"></div>` });
    const pts = [];
    if (n.pickup && n.pickup.latitude != null) { L.marker([n.pickup.latitude, n.pickup.longitude], { icon: dot('#2E8C6F') }).addTo(T.layer).bindTooltip(tr('Pick-up'), { direction: 'top', offset: [0, -8] }); pts.push([n.pickup.latitude, n.pickup.longitude]); }
    if (n.dropoff && n.dropoff.latitude != null) { L.marker([n.dropoff.latitude, n.dropoff.longitude], { icon: dot('#C0392B') }).addTo(T.layer).bindTooltip(tr('Drop-off'), { direction: 'top', offset: [0, -8] }); pts.push([n.dropoff.latitude, n.dropoff.longitude]); }
    if (n.trail && n.trail.length > 1) L.polyline(n.trail, { color: '#1F5FBF', weight: 4, opacity: 0.8 }).addTo(T.layer);
    if (n.live) {
      const ll = [n.live.latitude, n.live.longitude]; pts.push(ll);
      if (n.live.accuracyM && n.live.accuracyM < 500) L.circle(ll, { radius: n.live.accuracyM, color: '#1F5FBF', weight: 1, fillOpacity: 0.08 }).addTo(T.layer);
      L.marker(ll, { icon: L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 18], html: `<div style="font-size:26px;line-height:36px;text-align:center;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));">${VEH[n.vehicle] || '🚚'}</div>` }) }).addTo(T.layer);
    }
    if (pts.length && (!T.fitted || n.live)) { try { T.map.fitBounds(L.latLngBounds(pts), { padding: [34, 34], maxZoom: 17 }); T.fitted = true; } catch (x) {} }
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
    BCN.watch = navigator.geolocation.watchPosition(p => { BCN.denied = false; BCN.latest = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy, speedMps: p.coords.speed, at: Date.now() }; renderBar(); },
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
  async function loadAdminRides() {
    if (!body()) return;
    let o; try { o = await apiFetch('GET', '/admin/rides/overview'); } catch (x) { body().innerHTML = `<div class="panel">${e(x.message || 'Could not load')}</div>`; return; }
    R.over = o; const s = o.settings, c = o.counts;
    body().innerHTML = `
      <div class="panel"><div class="panel-title">${e(tr('Where rides are on'))}</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px;font-size:14px;"><span>⏳ ${c.pending} ${e(tr('waiting for review'))}</span><span>✅ ${c.approved} ${e(tr('approved drivers'))}</span><span>🛵 ${c.openRides} ${e(tr('rides open now'))}</span><span style="color:${c.openAlerts ? '#C0392B' : 'inherit'};">🚨 ${c.openAlerts} ${e(tr('open safety alerts'))}</span></div>
        ${o.canEditSettings ? `<div class="form-group"><label class="form-label" for="rs-countries">${e(tr('Countries where rides are on (separate with commas)'))}</label><input class="form-input" id="rs-countries" value="${e((s.enabledCountries || []).join(', '))}"/></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="rs-max">${e(tr('Longest ride (km)'))}</label><input class="form-input" id="rs-max" type="number" value="${e(s.maxKm)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-search">${e(tr('Show drivers within (km)'))}</label><input class="form-input" id="rs-search" type="number" value="${e(s.searchKm)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-ans">${e(tr('Minutes for a driver to answer'))}</label><input class="form-input" id="rs-ans" type="number" value="${e(s.answerMinutes)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-fee">${e(tr('Trothen fee on top of the fare (%)'))}</label><input class="form-input" id="rs-fee" type="number" value="${e(s.feePercent)}"/></div></div>
        <div class="dates-row"><div class="form-group"><label class="form-label" for="rs-comm">${e(tr('Driver commission on ride earnings (%)'))}</label><input class="form-input" id="rs-comm" type="number" min="0" max="30" value="${e(s.commissionPercent)}"/></div>
        <div class="form-group"><label class="form-label" for="rs-ins">${e(tr('Insurance or road permit'))}</label><select class="form-input form-select" id="rs-ins"><option value="1" ${s.requireInsurance ? 'selected' : ''}>${e(tr('Required to be approved'))}</option><option value="0" ${!s.requireInsurance ? 'selected' : ''}>${e(tr('Optional'))}</option></select></div></div>
        <div class="form-group"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="rs-night" ${s.motorbikeNight && s.motorbikeNight.enabled ? 'checked' : ''}/> ${e(tr('No motorbike rides between'))} <input class="form-input" id="rs-n1" type="number" min="0" max="23" value="${e(s.motorbikeNight ? s.motorbikeNight.startHour : 20)}" style="width:70px;"/> ${e(tr('and'))} <input class="form-input" id="rs-n2" type="number" min="0" max="23" value="${e(s.motorbikeNight ? s.motorbikeNight.endHour : 6)}" style="width:70px;"/> ${e(tr('o\'clock (Liberia time)'))}</label></div>
        <div class="form-group"><label class="form-label" for="rs-rr">${e(tr('Ride Rules shown to riders'))} <small>(v${e(s.rulesVersion)})</small></label><textarea class="form-input" id="rs-rr" rows="8">${e(s.rulesRider)}</textarea></div>
        <div class="form-group"><label class="form-label" for="rs-rd">${e(tr('Ride Rules shown to drivers'))}</label><textarea class="form-input" id="rs-rd" rows="8">${e(s.rulesDriver)}</textarea></div>
        <div class="ver-note" style="margin-bottom:10px;border-left:3px solid #8C6423;">${e(tr('These rules are a starting draft. Have a lawyer review them before real riders use them. Saving changed wording makes everyone accept again.'))}</div>
        <button class="btn-sm btn-sm-primary" onclick="ridesAdminSave()">${e(tr('Save'))}</button>
        <div class="ver-note" style="margin-top:10px;">${e(tr('Turn a country on only after you have checked its transport rules. Even when it is on, no ride can happen until you approve a driver there.'))}</div>`
        : `<div class="ver-note">${e(tr('Rides are on in:'))} <strong>${e((s.enabledCountries || []).join(', ') || tr('no country'))}</strong>. ${e(tr('Only a super admin can change this.'))}</div>`}</div>
      <div class="panel"><div class="panel-title">${e(tr('Safety alerts'))}</div>${o.alerts.length ? o.alerts.map(a => `<div style="padding:10px 0;border-top:1px solid var(--border);font-size:14px;${a.status === 'open' ? 'background:#FDF0EE;' : ''}"><strong>${a.status === 'open' ? '🚨 ' : ''}#${e(a.bookingNumber)}</strong> · ${e(a.raisedByRole)} ${e(a.raisedByName)} · ${e(new Date(a.createdAt).toLocaleString())}${a.location ? ` · <a href="https://www.google.com/maps/search/?api=1&query=${a.location.latitude},${a.location.longitude}" target="_blank" rel="noopener">${e(tr('Open location'))}</a>` : ''}${a.note ? `<div>${e(a.note)}</div>` : ''}${a.status === 'open' ? `<button class="btn-sm btn-sm-outline" style="margin-top:6px;" onclick="ridesAdminResolve(${jsArg(a.id)})">${e(tr('Mark handled'))}</button>` : ` <span style="color:var(--slate);">${e(tr('handled'))}</span>`}</div>`).join('') : `<div style="color:var(--slate);">${e(tr('None'))}</div>`}</div>
      <div class="panel"><div class="panel-title">${e(tr('Driver applications'))}</div>${o.applications.length ? o.applications.map(a => `<div style="padding:12px 0;border-top:1px solid var(--border);font-size:14px;">
        <div style="font-weight:700;color:var(--navy);">${e(a.name)} <span style="font-weight:400;color:var(--slate);">· ${e(a.city || '')} ${e(a.country || '')} · ${statusBadge(a.status)}</span></div>
        <div>${e(a.vehicle)} ${e(a.make || '')} · ${e(tr('plate'))} <strong>${e(a.plate)}</strong> · ${e(tr('licence'))} ${e(a.licenceNumber)} (${e(tr('expires'))} ${e(a.licenceExpiry)})${a.vehicle === 'motorbike' ? ' · ' + e(a.helmet ? tr('helmet confirmed') : tr('NO helmet')) : ''}</div>
        <div style="margin:6px 0;">${['licence', 'registration', 'vehicle', 'insurance'].map(k => a.docs[k] ? `<button class="btn-sm btn-sm-outline" onclick="ridesAdminDoc(${jsArg(a.userId)},'${k}')">📄 ${e(tr(k))}</button> ` : '').join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${a.status === 'pending' ? `<button class="btn-sm btn-sm-primary" onclick="ridesAdminDecide(${jsArg(a.userId)},'approve')">${e(tr('Approve'))}</button><button class="btn-sm btn-sm-outline" onclick="ridesAdminDecide(${jsArg(a.userId)},'reject')">${e(tr('Reject'))}</button>` : ''}${a.status === 'approved' ? `<button class="btn-sm btn-sm-outline" onclick="ridesAdminDecide(${jsArg(a.userId)},'suspend')">${e(tr('Suspend'))}</button>` : ''}</div></div>`).join('') : `<div style="color:var(--slate);">${e(tr('No applications yet.'))}</div>`}</div>`;
  }
  window.ridesAdminSave = async function () {
    try {
      await apiFetch('PUT', '/admin/rides/settings', { enabledCountries: el('rs-countries').value.split(',').map(x => x.trim()).filter(Boolean), maxKm: Number(el('rs-max').value), searchKm: Number(el('rs-search').value), answerMinutes: Number(el('rs-ans').value), feePercent: Number(el('rs-fee').value), commissionPercent: Number(el('rs-comm').value), requireInsurance: el('rs-ins').value === '1', motorbikeNight: { enabled: el('rs-night').checked, startHour: Number(el('rs-n1').value), endHour: Number(el('rs-n2').value) }, rulesRider: el('rs-rr').value, rulesDriver: el('rs-rd').value });
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
