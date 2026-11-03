/* Finding each other on a job (v128). Loaded after trothen.js.

   What went wrong before:
   - Most bookings had no location pin at all (posting a job didn't ask for
     one), so the pro had nowhere to navigate to and the trip map said
     "No distance".
   - The customer had no way to add or fix the location after booking.
   - The pro could only see a pin, never where the customer actually was.
   - A phone that briefly fell back to a rough Wi-Fi guess made the pro's
     dot jump kilometres away and back.

   What this file adds:
   - My Bookings: a clear warning on any booking with no location pin, and
     a "Set the job location" / "Change location" button that works until
     the pro arrives (the same pin, map and landmark choices as booking).
   - Track your pro: the customer can share their own live location with
     that one pro until they arrive, like waiting for a ride. They can stop
     at any time; it is wiped when the pro arrives.
   - Trip map, both sides: the job pin, the pro and (if shared) the
     customer, with distance to the pin, or to the customer when there is
     no pin. Directions go to the customer's shared position when there is
     no pin.
   - Honest warnings when a position is rough (for example a laptop, which
     guesses from Wi-Fi), and rough guesses don't replace a good GPS fix.

   It replaces gpsStatusNote, refreshTripTracking, drawTripMap and
   sendLivePoint from trothen.js, keeping their names. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const EDITABLE = ['pending_agreement', 'pending_provider_confirmation', 'awaiting_payment', 'active'];
  const hasPin = (c) => !!(c && c.jobLocation && typeof c.jobLocation.latitude === 'number');
  const raw = (id) => (typeof RAW_CONTRACTS === 'object' && RAW_CONTRACTS[id]) || null;
  const btnLink = 'background:none;border:none;padding:0;color:var(--teal);font-size:13px;text-decoration:underline;cursor:pointer;';
  function fmtDist(miles) {
    if (miles == null) return '';
    const km = miles * 1.609344;
    return `${miles < 0.1 ? Math.round(miles * 5280 / 10) * 10 + ' ' + tr('feet') : miles.toFixed(1) + ' ' + tr('miles')} (${km < 1 ? Math.round(km * 1000 / 10) * 10 + ' m' : km.toFixed(1) + ' km'})`;
  }

  // ── My Bookings: the location line under each booking ────────────────
  window.gpsStatusNote = function (b) {
    const r = raw(b.id) || {};
    if (r.ride || r.delivery) return legacyNote(b);
    let where = '';
    if (EDITABLE.includes(b.status) && !b.arrivedAt) {
      if (!hasPin(b)) {
        where = `<div class="where-warn">⚠️ ${escapeHtml(tr('No location pin. Your pro can\'t navigate to you.'))} <button type="button" class="btn-sm btn-sm-primary" style="margin-top:4px;" onclick="openJobLocationEditor(${jsArg(b.id)})">📍 ${escapeHtml(tr('Set the job location'))}</button></div>`;
      } else {
        where = `<div style="margin-top:3px;"><button type="button" style="${btnLink}" onclick="openJobLocationEditor(${jsArg(b.id)})">📍 ${escapeHtml(tr('Change location'))}</button></div>`;
      }
    }
    return legacyNote(b) + where;
  };
  function legacyNote(b) {
    const track = (b.onMyWayAt && !b.arrivedAt && b.status === 'active')
      ? `<div style="margin-top:6px;"><button class="btn-sm btn-sm-primary" onclick="openTripTracking(${jsArg(b.id)})">${escapeHtml(tr('Track your pro'))}</button></div>` : '';
    if (!b.onMyWayAt && !b.arrivedAt) return '';
    const fmt = (iso) => new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
    const parts = [];
    if (b.onMyWayAt) parts.push(`🚗 ${escapeHtml(tr('On the way'))} — ${fmt(b.onMyWayAt)}`);
    if (b.arrivedAt) parts.push(`📍 ${escapeHtml(tr('Arrived'))} — ${fmt(b.arrivedAt)}`);
    return `<div style="font-size:12.5px;color:var(--slate);margin-top:3px;">${parts.join(' · ')}</div>${track}`;
  }

  // ── Set or change the job location on a booking ───────────────────────
  window.openJobLocationEditor = function (contractId) {
    closeJobLocationEditor();
    const c = raw(contractId) || ((typeof customerData === 'object' && customerData.bookings) || []).find(x => x.id === contractId) || {};
    JOB_PIN.fix = hasPin(c) ? { latitude: c.jobLocation.latitude, longitude: c.jobLocation.longitude, accuracyM: c.jobLocation.accuracyM != null ? c.jobLocation.accuracyM : null, source: c.jobLocation.source || 'map' } : null;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="fixloc-overlay" style="z-index:5320;" onclick="if(event.target===this)closeJobLocationEditor()">
      <div class="modal" style="max-width:560px;max-height:94vh;display:flex;flex-direction:column;" role="dialog" aria-modal="true" aria-label="${escapeHtml(tr('Where is the job?'))}">
        <div class="modal-header" style="flex-shrink:0;">
          <button class="modal-close" onclick="closeJobLocationEditor()" aria-label="Close">✕</button>
          <h3>${escapeHtml(tr(hasPin(c) ? 'Change the job location' : 'Set the job location'))}</h3>
          <p>${escapeHtml(c.service || '')}${c.bookingNumber ? ' · #' + escapeHtml(c.bookingNumber) : ''}</p>
        </div>
        <div class="modal-body" style="overflow:auto;flex:1 1 auto;min-height:0;">
          ${locationPickerHTML('fix')}
          <div class="ver-note">${escapeHtml(tr('Your pro is told as soon as you save, and their trip map uses the new spot straight away.'))}</div>
        </div>
        <div class="modal-footer" style="display:flex;gap:10px;flex-shrink:0;">
          <button class="btn-sm btn-sm-outline" style="flex:1;" onclick="closeJobLocationEditor()">${escapeHtml(tr('Cancel'))}</button>
          <button class="confirm-btn" style="flex:2;" id="fixloc-save" onclick="saveJobLocation(${jsArg(contractId)})">${escapeHtml(tr('Save location'))}</button>
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
      if (typeof loadCustomerData === 'function' && typeof selectCustomerSection === 'function' && $('screen-customer')) { await loadCustomerData(); selectCustomerSection('bookings'); }
    } catch (e) {
      showToast(e.message || tr('Could not save the location'));
      if (btn) { btn.disabled = false; btn.textContent = tr('Save location'); }
    }
  };

  // ── The customer shares where they are, until the pro arrives ─────────
  const SHARE = { contractId: null, watchId: null, latest: null, lastSent: null, lastSentAt: 0, timer: null, wakeLock: null };
  window.CUSTOMER_SHARE = SHARE;
  async function sendShare(force) {
    const p = SHARE.latest;
    if (!p || !SHARE.contractId) return;
    const now = Date.now();
    const moved = metresBetween(SHARE.lastSent, p);
    if (!force && now - SHARE.lastSentAt < 8000) return;
    if (!force && moved < 15 && now - SHARE.lastSentAt < 30000) return;
    if (roughAfterGood(p, SHARE.lastSent, SHARE.lastSentAt)) return;
    SHARE.lastSentAt = now; SHARE.lastSent = p;
    try { await apiFetch('POST', `/contracts/${encodeURIComponent(SHARE.contractId)}/customer-live-location`, p); renderShareBar(); }
    catch (e) { if (e && e.data && e.data.code === 'TRIP_CLOSED') { stopShare(true); showToast(tr('Your pro has arrived, so location sharing has stopped.')); } }
  }
  function renderShareBar(note) {
    let bar = $('share-loc-bar');
    if (!SHARE.contractId) { if (bar) bar.remove(); return; }
    if (!bar) {
      document.body.insertAdjacentHTML('beforeend', '<div id="share-loc-bar" role="status" style="position:fixed;left:12px;right:12px;bottom:12px;z-index:4000;max-width:560px;margin:0 auto;background:#0F2640;color:#fff;border-radius:12px;padding:10px 14px;font-size:13.5px;line-height:1.45;box-shadow:0 10px 30px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center;"></div>');
      bar = $('share-loc-bar');
    }
    const p = SHARE.latest;
    bar.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:#3DDC97;flex-shrink:0;"></span>
      <span style="flex:1;">${escapeHtml(note || tr('Sharing your location with your pro until they arrive.'))}${p && p.accuracyM ? ' (' + describeAccuracy(p.accuracyM) + ')' : ''} ${escapeHtml(tr('Keep this page open.'))}</span>
      <button class="btn-sm" style="background:#fff;color:#0F2640;border:none;" onclick="openTripTracking(CUSTOMER_SHARE.contractId)">${escapeHtml(tr('Map'))}</button>
      <button class="btn-sm" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);" onclick="stopCustomerShare()">${escapeHtml(tr('Stop'))}</button>`;
  }
  window.startCustomerShare = async function (contractId, skipAsk) {
    if (!navigator.geolocation) return showToast(tr("This browser can't share location."));
    if (SHARE.contractId === contractId && SHARE.watchId != null) return;
    if (!skipAsk) {
      // The question must sit above the trip window it is asked from.
      const dlg = $('confirm-dialog-modal'); const prevZ = dlg ? dlg.style.zIndex : '';
      if (dlg) dlg.style.zIndex = '5400';
      const ok = await confirmDialog(tr('Share your live location with your pro until they arrive? Only the pro on this booking sees it. You can stop at any time, and it is deleted when they arrive. Keep this page open on your phone.'), { confirmLabel: tr('Share my location') });
      if (dlg) dlg.style.zIndex = prevZ;
      if (!ok) return;
    }
    stopShare(true);
    SHARE.contractId = contractId;
    try { if (navigator.wakeLock && navigator.wakeLock.request) SHARE.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    try {
      SHARE.watchId = navigator.geolocation.watchPosition(
        (pos) => { SHARE.latest = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyM: Math.max(1, Math.round(pos.coords.accuracy || 0)) }; sendShare(!SHARE.lastSent); },
        (err) => { renderShareBar(err && err.code === 1 ? tr('Location is switched off for this site, so your pro can\'t see you. Allow location, then try again.') : tr('Looking for your location…')); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
      );
    } catch (e) {}
    SHARE.timer = setInterval(() => sendShare(false), 10000);
    renderShareBar(tr('Finding your location…'));
    if ($('trip-overlay')) refreshTripTracking();
  };
  function stopShare(silent) {
    const id = SHARE.contractId;
    if (SHARE.watchId != null) { try { navigator.geolocation.clearWatch(SHARE.watchId); } catch (e) {} }
    if (SHARE.timer) clearInterval(SHARE.timer);
    if (SHARE.wakeLock) { try { SHARE.wakeLock.release(); } catch (e) {} }
    Object.assign(SHARE, { contractId: null, watchId: null, latest: null, lastSent: null, lastSentAt: 0, timer: null, wakeLock: null });
    renderShareBar();
    return id;
  }
  window.stopCustomerShare = async function () {
    const id = stopShare(true);
    if (id) { try { await apiFetch('DELETE', `/contracts/${encodeURIComponent(id)}/customer-live-location`); } catch (e) {} }
    showToast(tr('You stopped sharing your location.'));
    if ($('trip-overlay')) refreshTripTracking();
  };
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && SHARE.contractId) {
      try { if (navigator.wakeLock && navigator.wakeLock.request) SHARE.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
      sendShare(true);
    }
  });

  // A rough guess (worse than 1 km) doesn't replace a good fix (200 m or
  // better) sent in the last 2 minutes. The server checks this too.
  function roughAfterGood(p, last, lastAt) {
    return !!(last && last.accuracyM != null && last.accuracyM <= 200 && Date.now() - lastAt < 120000 && (p.accuracyM == null || p.accuracyM > 1000));
  }

  // ── Asking the phone where it is ──────────────────────────────────────
  // Same as before (keeps listening for the best fix, stops early once it's
  // good enough, falls back to masts and Wi-Fi), with one change: it also
  // asks for the current position straight away. When location sharing is
  // already running on the page, some browsers don't answer a second
  // "keep listening" request until it times out, so "Pin my current
  // location" used to wait the full 25 seconds. Now it answers at once.
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
      timer = setTimeout(() => {
        if (best) return finish(best);
        navigator.geolocation.getCurrentPosition(
          (p) => { take(p); finish(best); },
          (err) => finish({ error: err && err.code === 1 ? 'denied' : 'unavailable' }),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      }, maxWaitMs);
      try { navigator.geolocation.getCurrentPosition(take, (err) => { if (err && err.code === 1) finish({ error: 'denied' }); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: maxWaitMs }); } catch (e) {}
      try {
        watchId = navigator.geolocation.watchPosition(take, (err) => { if (err && err.code === 1) finish({ error: 'denied' }); }, { enableHighAccuracy: true, maximumAge: 15000, timeout: maxWaitMs });
      } catch (e) { if (!best) finish({ error: 'unavailable' }); }
    });
  };

  // ── The pro's phone: same as before, without the rough jumps ──────────
  window.sendLivePoint = async function (force) {
    const p = LIVE_TRIP.latest;
    if (!p || !LIVE_TRIP.contractId) return;
    const now = Date.now();
    const moved = metresBetween(LIVE_TRIP.lastSent, p);
    if (!force && now - LIVE_TRIP.lastSentAt < 8000) return;
    if (!force && moved < 15 && now - LIVE_TRIP.lastSentAt < 30000) return;
    if (roughAfterGood(p, LIVE_TRIP.lastSent, LIVE_TRIP.lastSentAt)) return;
    LIVE_TRIP.lastSentAt = now; LIVE_TRIP.lastSent = p;
    try {
      await apiFetch('POST', `/contracts/${LIVE_TRIP.contractId}/live-location`, p);
      renderLiveTripBar(p.accuracyM > 500 ? tr('Your position is rough right now, so the customer may see you in the wrong place. Use your phone with Location on, outdoors if you can.') : undefined);
    } catch (e) { if (e && e.data && e.data.code === 'TRIP_CLOSED') stopLiveTrip(); }
  };

  // ── The trip window (both sides) ──────────────────────────────────────
  function roughWords(m) { return m != null && m > 500 ? describeAccuracy(m) : ''; }
  window.refreshTripTracking = async function () {
    const id = TRIP_VIEW.contractId;
    if (!id || !$('trip-overlay')) return;
    let d;
    try { d = await apiFetch('GET', `/contracts/${id}/tracking`); }
    catch (e) { const f = $('trip-fresh'); if (f) f.textContent = tr('Couldn\'t refresh just now. Trying again…'); return; }
    if (TRIP_VIEW.contractId !== id) return;
    const iAmPro = AUTH.user && AUTH.user.role === 'provider';
    // The pro's own phone knows its position before the server does: use it.
    if (iAmPro && LIVE_TRIP.contractId === id && LIVE_TRIP.latest && d.phase === 'on_the_way') {
      d.proLocation = { ...LIVE_TRIP.latest }; d.secondsSinceUpdate = 0;
    }
    // Same for a customer who is sharing: their own dot is where they are now.
    if (!iAmPro && SHARE.contractId === id && SHARE.latest && d.phase === 'on_the_way') d.customerLocation = { ...SHARE.latest };
    const target = d.jobLocation || d.customerLocation || null;
    if (d.proLocation && target) {
      const miles = metresBetween(d.proLocation, target) / 1609.344;
      d.distanceMiles = miles; d.distanceKm = miles * 1.609344; d.distanceTo = d.jobLocation ? 'pin' : 'customer';
    }
    TRIP_VIEW.last = d;
    const set = (elId, html) => { const el = $(elId); if (el) el.innerHTML = html; };
    set('trip-title', escapeHtml(iAmPro ? tr('Trip to') + ' ' + d.customerName : d.proName + ' ' + tr('is coming')));
    set('trip-sub', escapeHtml(d.service || ''));
    const dist = d.distanceMiles != null ? fmtDist(d.distanceMiles) : null;
    let headline = '', fresh = '';
    if (d.phase === 'arrived') { headline = iAmPro ? escapeHtml(tr("You've arrived")) : escapeHtml(d.proName) + ' ' + escapeHtml(tr('has arrived')); fresh = escapeHtml(tr('Live location sharing has stopped.')); }
    else if (d.phase === 'not_started') { headline = iAmPro ? escapeHtml(tr('Tap "On My Way" when you set off')) : escapeHtml(tr("Your pro hasn't set off yet")); fresh = iAmPro ? '' : escapeHtml(tr('You\'ll be able to follow them here once they tap "On my way".')); }
    else if (d.phase === 'ended') { headline = escapeHtml(tr('This trip is no longer live')); }
    else if (!d.proLocation) { headline = iAmPro ? escapeHtml(tr('Finding your location…')) : escapeHtml(d.proName) + ' ' + escapeHtml(tr('is on the way')); fresh = iAmPro ? escapeHtml(tr('Make sure Location is on and this page stays open.')) : escapeHtml(tr('Waiting for their phone to send a position.')); }
    else {
      const toCust = d.distanceTo === 'customer';
      headline = dist
        ? (iAmPro ? dist + ' ' + escapeHtml(tr(toCust ? 'to the customer' : 'to go')) : dist + ' ' + escapeHtml(tr(toCust ? 'away from you' : 'away')))
        : (iAmPro ? escapeHtml(tr("You're on the way")) : escapeHtml(d.proName) + ' ' + escapeHtml(tr('is on the way')));
      const stale = d.secondsSinceUpdate > 90;
      fresh = `<span style="color:${stale ? '#8C6423' : 'var(--slate)'};">${escapeHtml(tr(iAmPro ? 'Your position was last sent' : 'Position updated'))} ${ago(d.secondsSinceUpdate)}${d.proLocation.accuracyM ? ' · ' + describeAccuracy(d.proLocation.accuracyM) : ''}.${stale ? ' ' + escapeHtml(tr(iAmPro ? 'Keep this page open with the screen on.' : 'Their phone may be locked or out of signal. This is their last known position.')) : ''}</span>`;
      const rough = roughWords(d.proLocation.accuracyM);
      if (rough) fresh += `<div class="where-warn" style="margin-top:6px;">${escapeHtml(iAmPro
        ? tr('Your position is rough') + ' (' + rough + '). ' + tr('Laptops and computers guess from Wi-Fi and can be far off. Use your phone with Location on, outdoors if you can.')
        : tr("Your pro's phone is only giving a rough position") + ' (' + rough + '), ' + tr('so their dot may be off. It usually gets better once they are outdoors with GPS on.'))}</div>`;
      if (toCust) fresh += `<div style="margin-top:4px;">${escapeHtml(tr(iAmPro ? 'Distance to where the customer is now (they are sharing their location). There is no job pin.' : 'Distance to where you are now. There is no job pin.'))}</div>`;
      else if (!target) fresh += `<div style="margin-top:4px;">${escapeHtml(tr('No distance yet: this booking has no location pin.'))}</div>`;
      else if (d.distanceKm != null && d.distanceKm >= 0.3 && !stale && !rough) {
        const lo = Math.max(1, Math.round(d.distanceKm * 1.3 / 30 * 60)), hi = Math.max(lo + 1, Math.round(d.distanceKm * 1.6 / 15 * 60));
        fresh += `<div style="margin-top:4px;">${escapeHtml(tr('Rough guess:'))} ${lo}–${hi} ${escapeHtml(tr('minutes, depending on the roads and traffic.'))}</div>`;
      }
    }
    set('trip-headline', headline); set('trip-fresh', fresh);
    set('trip-actions', actionsHTML(d, iAmPro, id));
    set('trip-links', linksHTML(d, iAmPro));
    drawTripMap(d);
  };

  function actionsHTML(d, iAmPro, id) {
    const onTheWay = d.phase === 'on_the_way';
    if (!iAmPro) {
      const sharing = SHARE.contractId === id;
      const parts = [];
      if (!d.jobLocation && d.canEditLocation) parts.push(`<div class="where-warn">⚠️ ${escapeHtml(tr('This booking has no location pin, so your pro can\'t navigate to you. Share your live location, or set the job location.'))}</div>`);
      const btns = [];
      if (onTheWay) btns.push(sharing
        ? `<button type="button" class="btn-sm btn-sm-outline" onclick="stopCustomerShare()">⏹ ${escapeHtml(tr('Stop sharing my location'))}</button>`
        : `<button type="button" class="btn-sm btn-sm-primary" onclick="startCustomerShare(${jsArg(id)}, ${d.customerLocation ? 'true' : 'false'})">📡 ${escapeHtml(tr(d.customerLocation ? 'Keep sharing my location' : 'Share my live location'))}</button>`);
      if (d.canEditLocation) btns.push(`<button type="button" class="btn-sm ${d.jobLocation ? 'btn-sm-outline' : 'btn-sm-primary'}" onclick="openJobLocationEditor(${jsArg(id)})">📍 ${escapeHtml(tr(d.jobLocation ? 'Change job location' : 'Set the job location'))}</button>`);
      if (btns.length) parts.push(`<div style="display:flex;gap:8px;flex-wrap:wrap;">${btns.join('')}</div>`);
      if (sharing || d.customerLocation) parts.push(`<div class="ver-note" style="margin-top:6px;">${escapeHtml(tr(sharing ? 'Your pro can see where you are. It stops when they arrive or when you tap Stop.' : 'Your last shared position is still showing to your pro. Tap "Keep sharing" to update it.'))}</div>`);
      return parts.join('');
    }
    if (!d.jobLocation && !d.customerLocation && onTheWay) {
      const c = ((typeof providerData === 'object' && providerData.contracts) || []).find(x => x.id === id) || raw(id) || {};
      return `<div class="where-warn">⚠️ ${escapeHtml(tr('This booking has no location pin and the customer isn\'t sharing their location yet. We\'ve asked them to. You can also message them.'))}${c.customerId ? ` <button type="button" class="btn-sm btn-sm-outline" style="margin-top:4px;" onclick="closeTripTracking();selectProviderSection('messages');setTimeout(()=>selectMessageContact(${jsArg(c.customerId)}),80)">💬 ${escapeHtml(tr('Message the customer'))}</button>` : ''}</div>`;
    }
    return '';
  }

  function linksHTML(d, iAmPro) {
    const links = [];
    const mapsUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
    const dirUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
    if (d.jobLocation) links.push(`<div><strong>${escapeHtml(tr('Job location:'))}</strong> ${plusCodeFor(d.jobLocation.latitude, d.jobLocation.longitude)} · <a href="${iAmPro ? dirUrl(d.jobLocation) : mapsUrl(d.jobLocation)}" target="_blank" rel="noopener noreferrer" style="color:var(--teal);font-weight:600;">${escapeHtml(tr(iAmPro ? 'Get directions in Google Maps' : 'Open in Maps'))}</a>${d.landmark ? '<div style="color:var(--slate);">' + escapeHtml(d.landmark) + '</div>' : ''}</div>`);
    else if (d.landmark) links.push(`<div><strong>${escapeHtml(tr('Job location:'))}</strong> ${escapeHtml(d.landmark)}</div>`);
    if (d.customerLocation && iAmPro) links.push(`<div><strong>${escapeHtml(d.customerName)}</strong> (${escapeHtml(tr('shared live'))}${d.customerSecondsSinceUpdate != null ? ', ' + ago(d.customerSecondsSinceUpdate) : ''}${roughWords(d.customerLocation.accuracyM) ? ', ' + roughWords(d.customerLocation.accuracyM) : ''}): <a href="${d.jobLocation ? mapsUrl(d.customerLocation) : dirUrl(d.customerLocation)}" target="_blank" rel="noopener noreferrer" style="color:var(--teal);font-weight:600;">${escapeHtml(tr(d.jobLocation ? 'Open in Maps' : 'Get directions to them'))}</a>${d.toCustomerMiles != null && d.jobLocation ? ' · ' + fmtDist(d.toCustomerMiles) + ' ' + escapeHtml(tr('from you')) : ''}</div>`);
    if (d.proLocation && !iAmPro) links.push(`<div><strong>${escapeHtml(d.proName)}:</strong> <a href="${mapsUrl(d.proLocation)}" target="_blank" rel="noopener noreferrer" style="color:var(--teal);font-weight:600;">${escapeHtml(tr('Open their position in Maps'))}</a></div>`);
    return links.join('');
  }

  // Make room for the action buttons in the trip window (added once, when it opens).
  if (typeof window.openTripTracking === 'function') {
    const f = window.openTripTracking;
    window.openTripTracking = async function (contractId) {
      const p = f.apply(this, arguments);
      const fresh = $('trip-fresh');
      if (fresh && !$('trip-actions')) fresh.insertAdjacentHTML('afterend', '<div id="trip-actions" style="margin-top:10px;"></div>');
      const r = await p;
      // A little quicker than before (6 s, was 8 s), with the same polite limits on the phone.
      if (TRIP_VIEW.timer) { clearInterval(TRIP_VIEW.timer); TRIP_VIEW.timer = setInterval(refreshTripTracking, 6000); }
      return r;
    };
  }
  if (typeof window.closeTripTracking === 'function') {
    const f = window.closeTripTracking;
    window.closeTripTracking = function () { TRIP_VIEW.custMarker = null; TRIP_VIEW.custCircle = null; TRIP_VIEW.last = null; return f.apply(this, arguments); };
  }

  window.drawTripMap = async function (d) {
    const box = $('trip-map');
    if (!box) return;
    const iAmPro = AUTH.user && AUTH.user.role === 'provider';
    const pts = [d.proLocation, d.jobLocation, d.customerLocation].filter(Boolean);
    if (!pts.length) { if (!TRIP_VIEW.map) box.textContent = tr('The map appears once there is a position to show.'); return; }
    const ok = await loadLeaflet();
    if (!ok || !$('trip-map')) { if (!TRIP_VIEW.map) box.textContent = tr('The map couldn\'t load. Use the links below.'); return; }
    if (!TRIP_VIEW.map) {
      box.textContent = ''; box.style.display = 'block';
      TRIP_VIEW.map = L.map(box, { zoomControl: true, attributionControl: true }).setView([pts[0].latitude, pts[0].longitude], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(TRIP_VIEW.map);
      try { TRIP_VIEW.map.attributionControl.setPrefix('Leaflet'); } catch (e) {}
    }
    const dot = (color, label) => L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div title="${escapeHtml(label)}" style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);"></div>` });
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
    place('proMarker', 'accCircle', d.proLocation, '#1F5FBF', iAmPro ? tr('You') : tr('Pro'));
    place('custMarker', 'custCircle', d.customerLocation, '#1E8E5A', iAmPro ? tr('Customer') : tr('You'));
    // Frame everything the first time, and again if someone drifts out of view.
    // A very rough circle (over 3 km) isn't used for framing, or the map zooms out to the whole city.
    const framePts = pts.filter(p => !(p.accuracyM > 3000) || pts.length === 1);
    const bounds = L.latLngBounds((framePts.length ? framePts : pts).map(p => [p.latitude, p.longitude]));
    if (!TRIP_VIEW.fitted || !TRIP_VIEW.map.getBounds().contains(bounds)) {
      if (framePts.length > 1) TRIP_VIEW.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 }); else TRIP_VIEW.map.setView([pts[0].latitude, pts[0].longitude], 16);
      TRIP_VIEW.fitted = true;
    }
    setTimeout(() => { if (TRIP_VIEW.map) TRIP_VIEW.map.invalidateSize(); }, 50);
  };
})();
