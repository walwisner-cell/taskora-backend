/* Finding each other on a job (v128, rewritten for v129). Loaded after trothen.js.

   v128 added: a required job location, "Set the job location" on a booking,
   the customer sharing their live location, and quieter trip tracking.

   v129:
   - "On My Way" works every time on a phone. The dark "sharing your
     location" bar sat on top of the confirmation sheet and covered its
     buttons, so tapping did nothing. The bar now sits under every window,
     is smaller, and has its own "View trip" and "Arrived" buttons.
   - "Leave Now" (the pro's start button) responds at once. It no longer
     waits up to 12 seconds for a location before telling the customer; the
     trip opens straight away and the position follows.
   - If the pro's phone blocks location, the trip screen says so plainly,
     explains how to allow it, and offers "Try again".
   - The trip screen is rewritten in a professional format: a status line
     (Scheduled, En route, Arrived), a clear headline, figures for distance,
     estimated arrival and last update, then the map and the details. On a
     phone it fills the screen.
   - Names show properly ("James Doe", not "JAMES DOE").

   It replaces these functions from trothen.js, keeping their names:
   gpsStatusNote, openTripTracking, closeTripTracking, refreshTripTracking,
   drawTripMap, sendLivePoint, startLiveTrip, renderLiveTripBar,
   resumeLiveTripIfAny, markContractOnMyWay, markContractArrived,
   getBestLocation. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const EDITABLE = ['pending_agreement', 'pending_provider_confirmation', 'awaiting_payment', 'active'];
  const TRIP_MAX_MS = 6 * 60 * 60 * 1000;
  const hasPin = (c) => !!(c && c.jobLocation && typeof c.jobLocation.latitude === 'number');
  const raw = (id) => (typeof RAW_CONTRACTS === 'object' && RAW_CONTRACTS[id]) || null;
  const esc = (s) => escapeHtml(s == null ? '' : String(s));
  const iAmPro = () => !!(AUTH.user && AUTH.user.role === 'provider');

  // "JAMES DOE" and "james doe" read as "James Doe". Mixed case is left alone.
  function personName(n, fallback) {
    n = String(n || '').trim();
    if (!n) return fallback || '';
    if (n !== n.toUpperCase() && n !== n.toLowerCase()) return n;
    return n.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }
  function sentence(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  window.personName = personName;
  window.sentenceCase = sentence;

  function fmtDist(miles) {
    if (miles == null || !Number.isFinite(miles)) return '';
    const km = miles * 1.609344;
    const usesMiles = ['United States', 'Liberia', 'United Kingdom', 'Myanmar'].includes((AUTH.user && AUTH.user.country) || 'United States');
    if (usesMiles) return miles < 0.1 ? `${Math.max(10, Math.round(miles * 5280 / 10) * 10)} ft` : `${miles.toFixed(1)} mi`;
    return km < 1 ? `${Math.max(10, Math.round(km * 1000 / 10) * 10)} m` : `${km.toFixed(1)} km`;
  }
  function etaRange(km) {
    if (km == null || km < 0.2) return null;
    const lo = Math.max(1, Math.round(km * 1.3 / 30 * 60)), hi = Math.max(lo + 1, Math.round(km * 1.6 / 15 * 60));
    return { lo, hi };
  }
  function clockOf(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function whenOf(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const today = new Date(); const tm = new Date(Date.now() + 86400000);
    const same = (a, b) => a.toDateString() === b.toDateString();
    const day = same(d, today) ? tr('Today') : same(d, tm) ? tr('Tomorrow') : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `${day}, ${clockOf(iso)}`;
  }
  window.arrivalWhen = whenOf;
  function agoWords(s) {
    if (s == null) return '—';
    if (s < 10) return tr('Just now');
    if (s < 60) return `${s} s ${tr('ago')}`;
    const m = Math.round(s / 60);
    return m < 60 ? `${m} min ${tr('ago')}` : `${Math.round(m / 60)} h ${tr('ago')}`;
  }

  // ── Asking the phone where it is ──────────────────────────────────────
  // Keeps listening for the best fix, stops early once it's good enough, and
  // also asks for the current position straight away.
  window.getBestLocation = function (opts) {
    const { goodEnoughM = 50, maxWaitMs = 25000, onProgress } = opts || {};
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ error: 'unsupported' });
      let best = null, done = false, watchId = null, timer = null;
      const finish = (r) => { if (done) return; done = true; if (watchId != null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} } clearTimeout(timer); resolve(r); };
      const take = (pos) => {
        if (done) return;
        const fix = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyM: Math.max(1, Math.round(pos.coords.accuracy || 0)) };
        if (!best || fix.accuracyM < best.accuracyM) best = fix;
        if (onProgress) { try { onProgress(best); } catch (e) {} }
        if (best.accuracyM <= goodEnoughM) finish(best);
      };
      const fail = (err) => { if (err && err.code === 1) finish({ error: 'denied' }); };
      timer = setTimeout(() => {
        if (best) return finish(best);
        navigator.geolocation.getCurrentPosition((p) => { take(p); finish(best); }, (err) => finish({ error: err && err.code === 1 ? 'denied' : 'unavailable' }), { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
      }, maxWaitMs);
      try { navigator.geolocation.getCurrentPosition(take, fail, { enableHighAccuracy: true, maximumAge: 10000, timeout: maxWaitMs }); } catch (e) {}
      try { watchId = navigator.geolocation.watchPosition(take, fail, { enableHighAccuracy: true, maximumAge: 15000, timeout: maxWaitMs }); } catch (e) { if (!best) finish({ error: 'unavailable' }); }
    });
  };

  // ── My Bookings: the location line under each booking ────────────────
  window.gpsStatusNote = function (b) {
    const r = raw(b.id) || {};
    if (r.ride || r.delivery) return legacyNote(b);
    let where = '';
    if (EDITABLE.includes(b.status) && !b.arrivedAt && !r.workDoneAt) { // v147: not once the pro says the job is finished
      where = !hasPin(b) && r.landmark // v147: a landmark is how most addresses work in Liberia; a pin helps but isn't required
        ? `<div style="margin-top:4px;font-size:12.5px;color:var(--slate);">${esc(tr('Your pro has your landmark. A pin on the map helps them find you faster.'))} <button type="button" class="link-btn" onclick="openJobLocationEditor(${jsArg(b.id)})">${esc(tr('Add a pin'))}</button></div>`
        : !hasPin(b)
        ? `<div class="where-warn"><strong>${esc(tr('Location required.'))}</strong> ${esc(tr('Your pro cannot navigate to you until a location is set.'))}<div style="margin-top:6px;"><button type="button" class="btn-sm btn-sm-primary" onclick="openJobLocationEditor(${jsArg(b.id)})">${esc(tr('Set Job Location'))}</button></div></div>`
        : `<div style="margin-top:4px;"><button type="button" class="link-btn" onclick="openJobLocationEditor(${jsArg(b.id)})">${esc(tr('Change Location'))}</button></div>`;
    }
    return legacyNote(b) + where;
  };
  function legacyNote(b) {
    const enRoute = b.onMyWayAt && !b.arrivedAt && b.status === 'active';
    const track = enRoute ? `<div style="margin-top:6px;"><button class="btn-sm btn-sm-primary" onclick="openTripTracking(${jsArg(b.id)})">${esc(tr('Track Arrival'))}</button></div>` : '';
    if (!b.onMyWayAt && !b.arrivedAt) return '';
    const fmt = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const parts = [];
    if (b.onMyWayAt) parts.push(`${esc(tr('Departed'))} ${fmt(b.onMyWayAt)}`);
    if (b.arrivedAt) parts.push(`${esc(tr('Arrived'))} ${fmt(b.arrivedAt)}`);
    return `<div class="trip-note">${enRoute ? `<span class="pill pill-live">${esc(tr('En route'))}</span> ` : ''}${parts.join(' · ')}</div>${track}`;
  }

  // ── Set or change the job location on a booking ───────────────────────
  window.openJobLocationEditor = function (contractId) {
    closeJobLocationEditor();
    const c = raw(contractId) || ((typeof customerData === 'object' && customerData.bookings) || []).find(x => x.id === contractId) || {};
    JOB_PIN.fix = hasPin(c) ? { latitude: c.jobLocation.latitude, longitude: c.jobLocation.longitude, accuracyM: c.jobLocation.accuracyM != null ? c.jobLocation.accuracyM : null, source: c.jobLocation.source || 'map' } : null;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open sheet-overlay" id="fixloc-overlay" style="z-index:5320;" onclick="if(event.target===this)closeJobLocationEditor()">
      <div class="modal sheet" role="dialog" aria-modal="true" aria-label="${esc(tr('Job location'))}">
        <div class="modal-header sheet-head">
          <button class="modal-close" onclick="closeJobLocationEditor()" aria-label="${esc(tr('Close'))}">✕</button>
          <h3>${esc(tr(hasPin(c) ? 'Change job location' : 'Set job location'))}</h3>
          <p>${esc(sentence(c.service || ''))}${c.bookingNumber ? ' · #' + esc(c.bookingNumber) : ''}</p>
        </div>
        <div class="modal-body sheet-body">
          ${locationPickerHTML('fix')}
          <div class="ver-note">${esc(tr('Your pro is notified as soon as you save, and their trip map updates immediately.'))}</div>
        </div>
        <div class="modal-footer sheet-foot">
          <button class="btn-sm btn-sm-outline" onclick="closeJobLocationEditor()">${esc(tr('Cancel'))}</button>
          <button class="confirm-btn" id="fixloc-save" onclick="saveJobLocation(${jsArg(contractId)})">${esc(tr('Save Location'))}</button>
        </div>
      </div></div>`);
    const lm = $('fix-landmark'); if (lm && c.landmark) lm.value = c.landmark;
    renderJobPin('fix');
  };
  window.closeJobLocationEditor = function () { const o = $('fixloc-overlay'); if (o) o.remove(); };
  window.saveJobLocation = async function (contractId) {
    const w = readJobWhere('fix');
    if (!w.jobLocation && !(w.landmark && w.landmark.length >= 5)) return showToast(tr('Pin the location, choose it on a map, or describe a landmark.'));
    const btn = $('fixloc-save'); if (btn) { btn.disabled = true; btn.textContent = tr('Saving…'); }
    try {
      const { contract } = await apiFetch('PATCH', `/contracts/${encodeURIComponent(contractId)}/job-location`, w);
      if (contract && typeof RAW_CONTRACTS === 'object') RAW_CONTRACTS[contract.id] = { ...(RAW_CONTRACTS[contract.id] || {}), ...contract };
      closeJobLocationEditor();
      showToast(tr('Location saved. Your pro can see it now.'));
      if ($('trip-overlay')) refreshTripTracking();
      if (typeof loadCustomerData === 'function' && $('screen-customer')) { await loadCustomerData(); selectCustomerSection('bookings'); }
    } catch (e) {
      showToast(e.message || tr('Could not save the location'));
      if (btn) { btn.disabled = false; btn.textContent = tr('Save Location'); }
    }
  };

  // ── Bars at the bottom while a location is being shared ───────────────
  function bar(id, dotColor, text, buttons) {
    let el = $(id);
    if (!text) { if (el) el.remove(); return; }
    if (!el) { document.body.insertAdjacentHTML('beforeend', `<div id="${id}" class="share-bar" role="status"></div>`); el = $(id); }
    el.innerHTML = `<span class="share-dot" style="background:${dotColor};"></span><span class="share-text">${text}</span><span class="share-btns">${buttons}</span>`;
  }

  // ── PRO: the trip, from "Leave Now" to "Arrived" ──────────────────────
  // LIVE_TRIP comes from trothen.js; geoError is new.
  function roughAfterGood(p, last, lastAt) {
    return !!(last && last.accuracyM != null && last.accuracyM <= 200 && Date.now() - lastAt < 120000 && (p.accuracyM == null || p.accuracyM > 1000));
  }
  window.sendLivePoint = async function (force) {
    const p = LIVE_TRIP.latest;
    if (!p || !LIVE_TRIP.contractId) return;
    const now = Date.now();
    if (!force && now - LIVE_TRIP.lastSentAt < 8000) return;
    if (!force && metresBetween(LIVE_TRIP.lastSent, p) < 15 && now - LIVE_TRIP.lastSentAt < 30000) return;
    if (roughAfterGood(p, LIVE_TRIP.lastSent, LIVE_TRIP.lastSentAt)) return;
    LIVE_TRIP.lastSentAt = now; LIVE_TRIP.lastSent = p;
    try { await apiFetch('POST', `/contracts/${LIVE_TRIP.contractId}/live-location`, p); renderLiveTripBar(); }
    catch (e) { if (e && e.data && e.data.code === 'TRIP_CLOSED') stopLiveTrip(); }
  };
  window.renderLiveTripBar = function () {
    if (!LIVE_TRIP.contractId) return bar('live-trip-bar');
    const p = LIVE_TRIP.latest;
    const text = LIVE_TRIP.geoError === 'denied'
      ? `<strong>${esc(tr('Location blocked.'))}</strong> ${esc(tr('Your customer cannot see you.'))}`
      : !p ? `<strong>${esc(tr('Trip in progress.'))}</strong> ${esc(tr('Locating you…'))}`
      : `<strong>${esc(tr('Sharing your location'))}</strong> ${esc(tr('with your customer'))}${p.accuracyM > 500 ? ` · <span style="color:#FFD58A;">${esc(tr('rough position'))}</span>` : ''}`;
    bar('live-trip-bar', LIVE_TRIP.geoError ? '#F2B84B' : '#3DDC97', text,
      `<button type="button" onclick="openTripTracking(LIVE_TRIP.contractId)">${esc(tr('View Trip'))}</button><button type="button" class="primary" onclick="markContractArrived(LIVE_TRIP.contractId)">${esc(tr('Arrived'))}</button>`);
  };
  window.startLiveTrip = async function (contractId) {
    if (LIVE_TRIP.contractId === contractId && LIVE_TRIP.watchId != null) return;
    stopLiveTrip();
    LIVE_TRIP.contractId = contractId; LIVE_TRIP.geoError = null;
    if (!navigator.geolocation) { LIVE_TRIP.geoError = 'unsupported'; renderLiveTripBar(); return; }
    try { if (navigator.wakeLock && navigator.wakeLock.request) LIVE_TRIP.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    const onPos = (pos) => {
      LIVE_TRIP.geoError = null;
      LIVE_TRIP.latest = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyM: Math.max(1, Math.round(pos.coords.accuracy || 0)) };
      sendLivePoint(!LIVE_TRIP.lastSent);
    };
    const onErr = (err) => { LIVE_TRIP.geoError = err && err.code === 1 ? 'denied' : 'unavailable'; renderLiveTripBar(); if ($('trip-overlay')) refreshTripTracking(); };
    try { navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }); } catch (e) {}
    try { LIVE_TRIP.watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }); } catch (e) {}
    LIVE_TRIP.timer = setInterval(() => sendLivePoint(false), 10000);
    renderLiveTripBar();
  };
  window.retryLiveLocation = function () {
    const id = LIVE_TRIP.contractId || TRIP_VIEW.contractId;
    if (!id) return;
    stopLiveTrip();
    startLiveTrip(id);
    showToast(tr('Trying to get your location again…'));
  };
  // After a reload, carry on sharing for the most recent open trip.
  window.resumeLiveTripIfAny = function (contracts) {
    if (!AUTH.user || AUTH.user.role !== 'provider') return;
    const open = (contracts || []).filter(c => c.status === 'active' && c.onMyWayAt && !c.arrivedAt && (Date.now() - new Date(c.onMyWayAt).getTime()) < TRIP_MAX_MS)
      .sort((a, b) => new Date(b.onMyWayAt) - new Date(a.onMyWayAt))[0];
    if (open) startLiveTrip(open.id); else if (LIVE_TRIP.contractId) stopLiveTrip();
  };

  function openTripsOther(contractId) {
    return ((typeof providerData === 'object' && providerData.contracts) || [])
      .filter(c => c.id !== contractId && c.status === 'active' && c.onMyWayAt && !c.arrivedAt && (Date.now() - new Date(c.onMyWayAt).getTime()) < TRIP_MAX_MS);
  }
  const busy = new Set();
  // "Leave Now": tells the customer at once, opens the trip, then shares the position.
  window.markContractOnMyWay = async function (contractId) {
    if (!BACKEND_AVAILABLE) return showToast('Marked on the way (demo mode)');
    if (busy.has(contractId)) return;
    const c = ((providerData && providerData.contracts) || []).find(x => x.id === contractId) || raw(contractId) || {};
    const who = personName(c.customer || c.customerName, tr('your customer'));
    const others = openTripsOther(contractId);
    const msg = `${tr('Start the trip to')} ${who}?\n\n${tr('Your customer will be notified that you are on your way and will see your live location until you mark yourself as arrived. Keep Trothen open on your phone during the trip.')}${others.length ? `\n\n${tr('Your trip for')} "${sentence(others[0].service)}" ${tr('is still open. Location sharing will move to this trip.')}` : ''}`;
    const ok = await confirmDialog(msg, { confirmLabel: tr('Leave Now') });
    if (!ok) return;
    busy.add(contractId);
    showToast(tr('Starting your trip…'));
    // Use a position the page already has, or wait at most 4 seconds for one.
    let loc = LIVE_TRIP.latest || null;
    if (!loc) { const r = await getBestLocation({ goodEnoughM: 200, maxWaitMs: 4000 }); if (!r.error) loc = r; }
    try {
      await apiFetch('POST', `/contracts/${contractId}/on-my-way`, loc || {});
      showToast(tr('Trip started. Your customer has been notified.'));
      startLiveTrip(contractId);
      openTripTracking(contractId);
      try { await loadProviderData(); selectProviderSection('contracts'); } catch (e) {}
    } catch (e) {
      showToast(e.message || tr('Could not start the trip. Please try again.'));
    } finally { busy.delete(contractId); }
  };
  window.markContractArrived = async function (contractId) {
    if (!BACKEND_AVAILABLE) return showToast('Marked arrived (demo mode)');
    if (!contractId || busy.has(contractId)) return;
    const ok = await confirmDialog(tr('Confirm that you have arrived at the job location? Location sharing will stop and your customer will be notified.'), { confirmLabel: tr('I Have Arrived') });
    if (!ok) return;
    busy.add(contractId);
    let loc = LIVE_TRIP.contractId === contractId ? LIVE_TRIP.latest : null;
    if (!loc) { const r = await getBestLocation({ goodEnoughM: 150, maxWaitMs: 4000 }); if (!r.error) loc = r; }
    try {
      await apiFetch('POST', `/contracts/${contractId}/arrived`, loc || {});
      if (LIVE_TRIP.contractId === contractId) stopLiveTrip();
      showToast(tr('Arrival confirmed. Your customer has been notified.'));
      if ($('trip-overlay')) refreshTripTracking();
      try { await loadProviderData(); selectProviderSection('contracts'); } catch (e) {}
    } catch (e) {
      showToast(e.message || tr('Could not confirm your arrival. Please try again.'));
    } finally { busy.delete(contractId); }
  };

  // ── CUSTOMER: sharing where they are until the pro arrives ────────────
  const SHARE = { contractId: null, watchId: null, latest: null, lastSent: null, lastSentAt: 0, timer: null, wakeLock: null, geoError: null };
  window.CUSTOMER_SHARE = SHARE;
  async function sendShare(force) {
    const p = SHARE.latest;
    if (!p || !SHARE.contractId) return;
    const now = Date.now();
    if (!force && now - SHARE.lastSentAt < 8000) return;
    if (!force && metresBetween(SHARE.lastSent, p) < 15 && now - SHARE.lastSentAt < 30000) return;
    if (roughAfterGood(p, SHARE.lastSent, SHARE.lastSentAt)) return;
    SHARE.lastSentAt = now; SHARE.lastSent = p;
    try { await apiFetch('POST', `/contracts/${encodeURIComponent(SHARE.contractId)}/customer-live-location`, p); renderShareBar(); }
    catch (e) { if (e && e.data && e.data.code === 'TRIP_CLOSED') { stopShare(); showToast(tr('Your pro has arrived. Location sharing has ended.')); } }
  }
  function renderShareBar() {
    if (!SHARE.contractId) return bar('share-loc-bar');
    const text = SHARE.geoError === 'denied' ? `<strong>${esc(tr('Location blocked.'))}</strong> ${esc(tr('Your pro cannot see you.'))}`
      : !SHARE.latest ? `<strong>${esc(tr('Sharing location.'))}</strong> ${esc(tr('Locating you…'))}`
      : `<strong>${esc(tr('Sharing your location'))}</strong> ${esc(tr('with your pro'))}`;
    bar('share-loc-bar', SHARE.geoError ? '#F2B84B' : '#3DDC97', text,
      `<button type="button" onclick="openTripTracking(CUSTOMER_SHARE.contractId)">${esc(tr('View'))}</button><button type="button" onclick="stopCustomerShare()">${esc(tr('Stop'))}</button>`);
  }
  window.startCustomerShare = async function (contractId, skipAsk) {
    if (!navigator.geolocation) return showToast(tr("This browser can't share location."));
    if (SHARE.contractId === contractId && SHARE.watchId != null) return;
    if (!skipAsk) {
      const ok = await confirmDialog(tr('Share your live location with your pro until they arrive? Only the pro on this booking can see it. You can stop at any time, and it is deleted when they arrive. Keep Trothen open on your phone.'), { confirmLabel: tr('Share Location') });
      if (!ok) return;
    }
    stopShare();
    SHARE.contractId = contractId;
    try { if (navigator.wakeLock && navigator.wakeLock.request) SHARE.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    const onPos = (pos) => { SHARE.geoError = null; SHARE.latest = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyM: Math.max(1, Math.round(pos.coords.accuracy || 0)) }; sendShare(!SHARE.lastSent); };
    const onErr = (err) => { SHARE.geoError = err && err.code === 1 ? 'denied' : 'unavailable'; renderShareBar(); if ($('trip-overlay')) refreshTripTracking(); };
    try { navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }); } catch (e) {}
    try { SHARE.watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }); } catch (e) {}
    SHARE.timer = setInterval(() => sendShare(false), 10000);
    renderShareBar();
    if ($('trip-overlay')) refreshTripTracking();
  };
  function stopShare() {
    const id = SHARE.contractId;
    if (SHARE.watchId != null) { try { navigator.geolocation.clearWatch(SHARE.watchId); } catch (e) {} }
    if (SHARE.timer) clearInterval(SHARE.timer);
    if (SHARE.wakeLock) { try { SHARE.wakeLock.release(); } catch (e) {} }
    Object.assign(SHARE, { contractId: null, watchId: null, latest: null, lastSent: null, lastSentAt: 0, timer: null, wakeLock: null, geoError: null });
    renderShareBar();
    return id;
  }
  window.stopCustomerShare = async function () {
    const id = stopShare();
    if (id) { try { await apiFetch('DELETE', `/contracts/${encodeURIComponent(id)}/customer-live-location`); } catch (e) {} }
    showToast(tr('Location sharing stopped.'));
    if ($('trip-overlay')) refreshTripTracking();
  };
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (SHARE.contractId) { try { if (navigator.wakeLock && navigator.wakeLock.request) SHARE.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} sendShare(true); }
  });

  // ── The trip screen (both sides) ──────────────────────────────────────
  window.closeTripTracking = function () {
    if (TRIP_VIEW.timer) clearInterval(TRIP_VIEW.timer);
    if (TRIP_VIEW.map) { try { TRIP_VIEW.map.remove(); } catch (e) {} }
    Object.assign(TRIP_VIEW, { contractId: null, timer: null, map: null, proMarker: null, jobMarker: null, accCircle: null, custMarker: null, custCircle: null, fitted: false, last: null });
    const o = $('trip-overlay'); if (o) o.remove();
    document.body.classList.remove('trip-open');
  };
  window.openTripTracking = async function (contractId) {
    if (!contractId) return;
    closeTripTracking();
    TRIP_VIEW.contractId = contractId;
    const c = raw(contractId) || {};
    document.body.classList.add('trip-open');
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="trip-overlay" style="z-index:5300;" onclick="if(event.target===this)closeTripTracking()">
      <div class="modal trip-sheet" role="dialog" aria-modal="true" aria-label="${esc(tr('Live trip'))}">
        <div class="trip-top">
          <div style="min-width:0;">
            <div class="trip-eyebrow">${esc(tr('Live trip'))}${c.bookingNumber ? ' · #' + esc(c.bookingNumber) : ''}</div>
            <div class="trip-service" id="trip-sub">${esc(sentence(c.service || ''))}</div>
          </div>
          <button class="modal-close" onclick="closeTripTracking()" aria-label="${esc(tr('Close'))}">✕</button>
        </div>
        <div class="trip-scroll">
          <div class="trip-steps" id="trip-steps"></div>
          <h2 class="trip-headline" id="trip-headline">${esc(tr('Loading…'))}</h2>
          <div class="trip-sub" id="trip-fresh" aria-live="polite"></div>
          <div class="trip-stats" id="trip-stats"></div>
          <div id="trip-notice"></div>
          <div class="trip-actions" id="trip-actions"></div>
          <div id="trip-map" class="trip-map">${esc(tr('Loading the map…'))}</div>
          <div class="trip-details" id="trip-links"></div>
          <div class="trip-foot">${esc(tr('Distances are measured in a straight line. Estimated arrival times are approximate. Location updates only while Trothen is open on the pro\'s phone.'))}</div>
        </div>
      </div></div>`);
    await refreshTripTracking();
    TRIP_VIEW.timer = setInterval(refreshTripTracking, 6000);
  };

  function stepsHTML(phase, arrivalAt) {
    const idx = phase === 'arrived' ? 2 : phase === 'on_the_way' ? 1 : 0;
    const labels = [arrivalAt ? `${tr('Scheduled')} · ${clockOf(arrivalAt)}` : tr('Scheduled'), tr('En route'), tr('Arrived')];
    return labels.map((l, i) => `<div class="trip-step ${i < idx ? 'done' : i === idx ? 'now' : ''}"><span class="trip-step-dot"></span><span>${esc(l)}</span></div>`).join('<span class="trip-step-line"></span>');
  }
  function stat(label, value, sub) { return `<div class="trip-stat"><div class="trip-stat-label">${esc(label)}</div><div class="trip-stat-value">${value}</div>${sub ? `<div class="trip-stat-sub">${sub}</div>` : ''}</div>`; }

  window.refreshTripTracking = async function () {
    const id = TRIP_VIEW.contractId;
    if (!id || !$('trip-overlay')) return;
    let d;
    try { d = await apiFetch('GET', `/contracts/${id}/tracking`); }
    catch (e) { const f = $('trip-fresh'); if (f) f.textContent = tr('Unable to refresh. Retrying…'); return; }
    if (TRIP_VIEW.contractId !== id) return;
    const pro = iAmPro();
    d.proName = personName(d.proName, tr('Your pro')); d.customerName = personName(d.customerName, tr('Customer'));
    if (pro && LIVE_TRIP.contractId === id && LIVE_TRIP.latest && d.phase === 'on_the_way') { d.proLocation = { ...LIVE_TRIP.latest }; d.secondsSinceUpdate = 0; }
    if (!pro && SHARE.contractId === id && SHARE.latest && d.phase === 'on_the_way') d.customerLocation = { ...SHARE.latest };
    const target = d.jobLocation || d.customerLocation || null;
    let km = null;
    if (d.proLocation && target) { km = metresBetween(d.proLocation, target) / 1000; d.distanceMiles = km / 1.609344; d.distanceTo = d.jobLocation ? 'pin' : 'customer'; }
    TRIP_VIEW.last = d;
    const set = (elId, html) => { const el = $(elId); if (el) el.innerHTML = html; };
    set('trip-sub', esc(sentence(d.service || '')));
    set('trip-steps', stepsHTML(d.phase, d.arrivalAt));

    const stale = d.secondsSinceUpdate != null && d.secondsSinceUpdate > 90;
    const rough = d.proLocation && d.proLocation.accuracyM > 500;
    const eta = !stale && !rough ? etaRange(km) : null;
    let headline = '', sub = '', stats = '', notice = '';
    if (d.phase === 'arrived') {
      headline = pro ? tr('You have arrived') : `${d.proName} ${tr('has arrived')}`;
      sub = `${tr('Arrived at')} ${clockOf(d.arrivedAt)}. ${tr('Live location sharing has ended.')}`;
    } else if (d.phase === 'not_started') {
      headline = pro ? tr('Trip not started') : `${d.proName} ${tr('has not set off yet')}`;
      sub = d.arrivalAt ? `${tr('Scheduled arrival')}: ${whenOf(d.arrivalAt)}.` : tr('No arrival time has been agreed yet.');
      sub += ' ' + (pro ? tr('Tap Leave Now when you set off. Your customer will be able to follow your arrival.') : tr('Live tracking starts when your pro taps Leave Now.'));
    } else if (d.phase === 'ended') {
      headline = tr('This trip is no longer live');
    } else if (!d.proLocation) {
      headline = pro ? tr('Locating you…') : `${d.proName} ${tr('is en route')}`;
      sub = pro ? tr('Waiting for your phone\'s location.') : `${tr('Awaiting the first location update from')} ${d.proName}.`;
    } else {
      headline = km == null ? (pro ? tr('En route') : `${d.proName} ${tr('is en route')}`)
        : pro ? `${fmtDist(d.distanceMiles)} ${tr(d.distanceTo === 'customer' ? 'to your customer' : 'to destination')}`
        : `${d.proName} ${tr('is')} ${fmtDist(d.distanceMiles)} ${tr('away')}`;
      sub = pro ? tr('Your customer can see your location.') : (d.distanceTo === 'customer' ? tr('Measured to your shared location (no job pin is set).') : tr('Measured to the job location.'));
      stats = stat(tr('Distance'), km == null ? '—' : esc(fmtDist(d.distanceMiles)))
        + stat(tr('Est. arrival'), eta ? `${eta.lo}–${eta.hi} min` : '—', eta ? esc(tr('approximate')) : '')
        + stat(tr('Last update'), esc(agoWords(d.secondsSinceUpdate)), d.proLocation.accuracyM ? `±${d.proLocation.accuracyM >= 1000 ? (d.proLocation.accuracyM / 1000).toFixed(1) + ' km' : d.proLocation.accuracyM + ' m'}` : '');
      if (stale) notice += noticeHTML('warn', pro ? tr('Your location has not been sent recently. Keep Trothen open with the screen on.') : `${tr('No update for over a minute. This is')} ${d.proName}'s ${tr('last known position; their phone may be locked or out of signal.')}`);
      if (rough) notice += noticeHTML('warn', pro ? tr('Your position is approximate. Computers estimate location from Wi-Fi and can be far off. Use your phone with Location on, outdoors if possible.') : `${d.proName}'s ${tr('position is approximate and may be off. It usually improves once they are outdoors with GPS on.')}`);
    }
    // Problems that need someone to act.
    if (pro && d.phase === 'on_the_way' && LIVE_TRIP.contractId === id && LIVE_TRIP.geoError) {
      notice = noticeHTML('error', LIVE_TRIP.geoError === 'denied'
        ? `<strong>${esc(tr('Location access is blocked.'))}</strong> ${esc(tr('Your customer cannot see you. Allow location for trothenpro.com: on iPhone, Settings › Privacy › Location Services › Safari Websites; on Android, tap the lock icon next to the address, then Permissions › Location.'))}`
        : `<strong>${esc(tr('Location unavailable.'))}</strong> ${esc(tr('Make sure Location is switched on, then try again.'))}`, `<button type="button" class="btn-sm btn-sm-primary" onclick="retryLiveLocation()">${esc(tr('Try Again'))}</button>`) + notice;
    }
    if (pro && d.phase === 'on_the_way' && LIVE_TRIP.contractId !== id) {
      notice = noticeHTML('warn', tr('Location sharing is not running for this trip on this device.'), `<button type="button" class="btn-sm btn-sm-primary" onclick="startLiveTrip(${jsArg(id)});setTimeout(refreshTripTracking,800)">${esc(tr('Share My Location'))}</button>`) + notice;
    }
    if (!pro && !SHARE.contractId && SHARE.geoError === 'denied') notice += noticeHTML('error', tr('Location access is blocked on this phone, so your location cannot be shared.'));
    if (!d.jobLocation && d.phase !== 'arrived') {
      notice += pro
        ? (d.customerLocation ? '' : noticeHTML('warn', tr('No job location has been set and the customer is not sharing their location. They have been asked to. You can also message them.')))
        : (d.canEditLocation ? noticeHTML('warn', `<strong>${esc(tr('Location required.'))}</strong> ${esc(tr('Your pro cannot navigate to you until you share your location or set the job location.'))}`) : '');
    }
    set('trip-headline', esc(headline));
    set('trip-fresh', esc(sub));
    set('trip-stats', stats);
    const st = $('trip-stats'); if (st) st.style.display = stats ? '' : 'none';
    set('trip-notice', notice);
    set('trip-actions', actionsHTML(d, pro, id));
    set('trip-links', detailsHTML(d, pro));
    drawTripMap(d);
  };
  function noticeHTML(kind, html, btn) { return `<div class="trip-notice ${kind}"><div>${html}</div>${btn ? `<div style="margin-top:8px;">${btn}</div>` : ''}</div>`; }

  function actionsHTML(d, pro, id) {
    const btns = [];
    const dirTo = d.jobLocation || d.customerLocation;
    if (pro) {
      const c = ((typeof providerData === 'object' && providerData.contracts) || []).find(x => x.id === id) || raw(id) || {};
      if (d.phase === 'not_started' && d.status === 'active') btns.push(`<button type="button" class="btn-sm btn-sm-primary" onclick="closeTripTracking();markContractOnMyWay(${jsArg(id)})">${esc(tr('Leave Now'))}</button>`);
      if (d.phase === 'on_the_way') btns.push(`<button type="button" class="btn-sm btn-sm-primary" onclick="markContractArrived(${jsArg(id)})">${esc(tr('I Have Arrived'))}</button>`);
      if (dirTo && d.phase !== 'arrived') btns.push(`<a class="btn-sm btn-sm-outline" href="https://www.google.com/maps/dir/?api=1&destination=${dirTo.latitude},${dirTo.longitude}" target="_blank" rel="noopener noreferrer">${esc(tr('Directions'))}</a>`);
      if (c.customerId) btns.push(`<button type="button" class="btn-sm btn-sm-outline" onclick="closeTripTracking();selectProviderSection('messages');setTimeout(()=>selectMessageContact(${jsArg(c.customerId)}),80)">${esc(tr('Message'))}</button>`);
      return btns.join('');
    }
    const c = raw(id) || {};
    if (d.phase === 'on_the_way') btns.push(SHARE.contractId === id
      ? `<button type="button" class="btn-sm btn-sm-outline" onclick="stopCustomerShare()">${esc(tr('Stop Sharing'))}</button>`
      : `<button type="button" class="btn-sm ${d.jobLocation ? 'btn-sm-outline' : 'btn-sm-primary'}" onclick="startCustomerShare(${jsArg(id)}, ${d.customerLocation ? 'true' : 'false'})">${esc(tr(d.customerLocation ? 'Resume sharing' : 'Share my location'))}</button>`);
    if (d.canEditLocation) btns.push(`<button type="button" class="btn-sm ${d.jobLocation ? 'btn-sm-outline' : 'btn-sm-primary'}" onclick="openJobLocationEditor(${jsArg(id)})">${esc(tr(d.jobLocation ? 'Change location' : 'Set job location'))}</button>`);
    if (c.providerId) btns.push(`<button type="button" class="btn-sm btn-sm-outline" onclick="closeTripTracking();selectCustomerSection('messages');setTimeout(()=>selectMessageContact(${jsArg(c.providerId)}),80)">${esc(tr('Message'))}</button>`);
    return btns.join('');
  }

  function detailsHTML(d, pro) {
    const rows = [];
    const mapsUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
    const row = (k, v) => `<div class="trip-row"><div class="trip-row-k">${esc(k)}</div><div class="trip-row-v">${v}</div></div>`;
    if (d.arrivalAt) rows.push(row(tr('Scheduled arrival'), esc(whenOf(d.arrivalAt))));
    if (d.onMyWayAt) rows.push(row(tr('Departed'), esc(clockOf(d.onMyWayAt))));
    if (d.jobLocation) rows.push(row(tr('Job location'), `${plusCodeFor(d.jobLocation.latitude, d.jobLocation.longitude)} · <a href="${mapsUrl(d.jobLocation)}" target="_blank" rel="noopener noreferrer">${esc(tr('Open in Maps'))}</a>`));
    if (d.landmark) rows.push(row(tr('Landmark'), esc(d.landmark)));
    if (d.customerLocation) rows.push(row(pro ? `${d.customerName} (${tr('shared')})` : tr('Your shared location'), `${d.customerSecondsSinceUpdate != null ? esc(agoWords(d.customerSecondsSinceUpdate)) + ' · ' : ''}<a href="${mapsUrl(d.customerLocation)}" target="_blank" rel="noopener noreferrer">${esc(tr('Open in Maps'))}</a>`));
    if (d.proLocation && !pro) rows.push(row(d.proName, `<a href="${mapsUrl(d.proLocation)}" target="_blank" rel="noopener noreferrer">${esc(tr('Open Position in Maps'))}</a>`));
    return rows.join('');
  }

  window.drawTripMap = async function (d) {
    const box = $('trip-map');
    if (!box) return;
    const pro = iAmPro();
    const pts = [d.proLocation, d.jobLocation, d.customerLocation].filter(Boolean);
    if (!pts.length) { if (!TRIP_VIEW.map) { box.textContent = tr('The map appears once a location is available.'); box.classList.add('empty'); } return; }
    box.classList.remove('empty');
    const ok = await loadLeaflet();
    if (!ok || !$('trip-map')) { if (!TRIP_VIEW.map) box.textContent = tr('The map could not load. Use the links below.'); return; }
    if (!TRIP_VIEW.map) {
      box.textContent = '';
      TRIP_VIEW.map = L.map(box, { zoomControl: true, attributionControl: true }).setView([pts[0].latitude, pts[0].longitude], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(TRIP_VIEW.map);
      try { TRIP_VIEW.map.attributionControl.setPrefix('Leaflet'); } catch (e) {}
    }
    const dot = (color, label) => L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div title="${esc(label)}" style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);"></div>` });
    const place = (key, circleKey, p, color, label) => {
      if (!p) {
        if (TRIP_VIEW[key]) { TRIP_VIEW.map.removeLayer(TRIP_VIEW[key]); TRIP_VIEW[key] = null; }
        if (circleKey && TRIP_VIEW[circleKey]) { TRIP_VIEW.map.removeLayer(TRIP_VIEW[circleKey]); TRIP_VIEW[circleKey] = null; }
        return;
      }
      const ll = [p.latitude, p.longitude];
      if (!TRIP_VIEW[key]) TRIP_VIEW[key] = L.marker(ll, { icon: dot(color, label) }).addTo(TRIP_VIEW.map).bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10] });
      else { TRIP_VIEW[key].setLatLng(ll); TRIP_VIEW[key].setTooltipContent(label); }
      if (!circleKey) return;
      const r = p.accuracyM || 0;
      if (r > 30) { if (!TRIP_VIEW[circleKey]) TRIP_VIEW[circleKey] = L.circle(ll, { radius: r, color, weight: 1, fillOpacity: 0.08 }).addTo(TRIP_VIEW.map); else { TRIP_VIEW[circleKey].setLatLng(ll); TRIP_VIEW[circleKey].setRadius(r); } }
      else if (TRIP_VIEW[circleKey]) { TRIP_VIEW.map.removeLayer(TRIP_VIEW[circleKey]); TRIP_VIEW[circleKey] = null; }
    };
    place('jobMarker', null, d.jobLocation, '#C0392B', tr('Job'));
    place('proMarker', 'accCircle', d.proLocation, '#1F5FBF', pro ? tr('You') : d.proName.split(' ')[0] || tr('Pro'));
    place('custMarker', 'custCircle', d.customerLocation, '#1E8E5A', pro ? d.customerName.split(' ')[0] || tr('Customer') : tr('You'));
    const framePts = pts.filter(p => !(p.accuracyM > 3000) || pts.length === 1);
    const bounds = L.latLngBounds((framePts.length ? framePts : pts).map(p => [p.latitude, p.longitude]));
    if (!TRIP_VIEW.fitted || !TRIP_VIEW.map.getBounds().contains(bounds)) {
      if (framePts.length > 1) TRIP_VIEW.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 }); else TRIP_VIEW.map.setView([pts[0].latitude, pts[0].longitude], 16);
      TRIP_VIEW.fitted = true;
    }
    setTimeout(() => { if (TRIP_VIEW.map) TRIP_VIEW.map.invalidateSize(); }, 50);
  };
})();
