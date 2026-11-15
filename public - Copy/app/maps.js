// v148: maps, GPS and navigation, the way Uber, Bolt and Google Maps behave,
// for every map in the app (phone, tablet and computer).
//
//  - One map provider for all maps, set on the server (/api/geo/map-config):
//    Mapbox when MAPBOX_TOKEN is set, otherwise OpenStreetMap, with a
//    Satellite view (most useful in Liberia, where few streets are mapped).
//    If the map pictures don't load, the map switches to a backup by itself.
//  - Maps stay sharp when their box changes size: a window opening, a
//    phone or tablet turned, a computer window resized. (Before, a map
//    opened in a window was often grey or showed only one corner.)
//  - A "my location" button: the blue dot with its accuracy circle.
//  - A live map follows the driver until you move it yourself; then a
//    "Re-centre" button brings it back (before, it jumped back every few
//    seconds, so you couldn't look around).
//  - Moving markers glide instead of jumping.
//  - The road route drawn between two points (straight dashed line if no
//    routing service is set).
//  - "Navigate" opens a choice of Google Maps, Waze or Apple Maps, and can
//    remember the choice.
(function () {
  'use strict';
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  if (!document.getElementById('tmap-css')) {
    const st = document.createElement('style'); st.id = 'tmap-css';
    st.textContent = `
      .tmap-btn{background:#fff;border:0;border-radius:10px;box-shadow:0 1px 5px rgba(0,0,0,.3);min-width:44px;height:44px;padding:0 12px;font:600 14px/44px inherit;font-family:inherit;color:#1b2b44;cursor:pointer;display:inline-flex;align-items:center;gap:6px;justify-content:center;}
      .tmap-btn:hover{background:#f3f6fa;} .tmap-btn:focus-visible{outline:3px solid #1A73E8;outline-offset:2px;}
      .tmap-locate{padding:0;width:44px;} .tmap-locate.busy .tmap-target{animation:tmapSpin 1s linear infinite;}
      .tmap-target{width:18px;height:18px;border-radius:50%;border:3px solid #1A73E8;position:relative;display:block;}
      .tmap-target::after{content:"";position:absolute;inset:3px;border-radius:50%;background:#1A73E8;}
      .tmap-me{position:relative;width:22px;height:22px;} .tmap-me-dot{position:absolute;inset:2px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 0 0 0 rgba(26,115,232,.5);animation:tmapPulse 2s infinite;}
      @keyframes tmapPulse{0%{box-shadow:0 0 0 0 rgba(26,115,232,.45);}70%{box-shadow:0 0 0 14px rgba(26,115,232,0);}100%{box-shadow:0 0 0 0 rgba(26,115,232,0);}}
      @keyframes tmapSpin{to{transform:rotate(360deg);}}
      .tmap .leaflet-control-zoom a{width:36px;height:36px;line-height:36px;font-size:20px;}
      .tmap .leaflet-control-attribution{font-size:10px;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      @media (max-width:420px){.tmap-layer span,.tmap-recenter span{display:none;}}
      @media (prefers-reduced-motion:reduce){.tmap-me-dot{animation:none;}}`;
    document.head.appendChild(st);
  }

  // ── the map provider ───────────────────────────────────────────────
  const CFG = { data: null, p: null };
  function config() {
    if (!CFG.p) CFG.p = fetch('/api/geo/map-config').then(r => (r.ok ? r.json() : null)).then(j => (CFG.data = j)).catch(() => null);
    return CFG.p;
  }
  config();
  const isOsm = (u) => /tile\.openstreetmap\.org/.test(String(u || ''));
  const layerOpts = (c) => { const o = { maxZoom: c.maxZoom || 19, attribution: c.attribution || '' }; ['tileSize', 'zoomOffset', 'maxNativeZoom', 'subdomains'].forEach(k => { if (c[k] !== undefined) o[k] = c[k]; }); return o; };

  function install() {
    if (!window.L || !L.Map || L.__trothenMaps) return;
    L.__trothenMaps = true;
    // Every "OpenStreetMap" layer in the app uses the provider set on the server.
    const baseTile = L.tileLayer;
    L.tileLayer = function (url, opts) {
      let u = url, o = opts || {};
      const street = CFG.data && CFG.data.street;
      const wasDefault = isOsm(url);
      if (wasDefault && street && !isOsm(street.url)) { u = street.url; o = { ...o, ...layerOpts(street) }; }
      const layer = baseTile.call(this, u, o);
      if (wasDefault) layer.__street = true;
      return layer;
    };
    L.Map.addInitHook(function () {
      const map = this;
      if (window.ResizeObserver) {
        let raf = 0;
        const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { try { if (map._loaded) map.invalidateSize({ pan: false }); } catch (e) {} }); });
        ro.observe(map.getContainer());
        map.on('unload', () => ro.disconnect());
      }
      [120, 400, 1200].forEach(ms => setTimeout(() => { try { if (map._loaded && map.getContainer().isConnected) map.invalidateSize({ pan: false }); } catch (e) {} }, ms));
      setTimeout(() => decorate(map), 0);
    });
  }

  function decorate(map) {
    if (!map || map.__decorated || !map.getContainer().isConnected) return;
    let street = null;
    map.eachLayer(l => { if (l.__street) street = l; });
    if (!street) return;
    map.__decorated = true;
    map.getContainer().classList.add('tmap');
    watchTiles(map, street);
    if (map.options.noTrothenControls) return;
    satelliteToggle(map, street);
    locateButton(map);
  }

  // If the map pictures fail to load (blocked, or the provider is down), switch to the backup.
  function watchTiles(map, layer) {
    let loaded = 0, failed = 0;
    layer.on('tileload', () => { loaded++; });
    layer.on('tileerror', () => {
      failed++;
      if (failed >= 6 && loaded === 0 && !layer.__swapped && CFG.data && CFG.data.fallback && layer._url !== CFG.data.fallback.url) {
        layer.__swapped = true;
        layer.setUrl(CFG.data.fallback.url);
      }
    });
  }

  function makeSatellite() {
    const s = CFG.data && CFG.data.satellite;
    if (!s) return null;
    const imagery = L.tileLayer(s.url, layerOpts(s));
    if (!s.labels) return imagery;
    return L.layerGroup([imagery, L.tileLayer(s.labels.url, { ...layerOpts(s.labels), attribution: '' })]);
  }
  function satelliteToggle(map, street) {
    const sat = makeSatellite(); if (!sat) return;
    const Ctl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const b = L.DomUtil.create('button', 'tmap-btn tmap-layer');
        b.type = 'button';
        const draw = () => { const onSat = map.hasLayer(sat); b.innerHTML = onSat ? `🗺️ <span>${esc(t('Map'))}</span>` : `🛰️ <span>${esc(t('Satellite'))}</span>`; b.setAttribute('aria-label', onSat ? t('Show the street map') : t('Show the satellite view')); };
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, 'click', (ev) => {
          L.DomEvent.preventDefault(ev);
          if (map.hasLayer(sat)) { map.removeLayer(sat); street.addTo(map); store.set('tmap_view', 'map'); }
          else { map.removeLayer(street); sat.addTo(map); store.set('tmap_view', 'satellite'); }
          draw();
        });
        draw();
        return b;
      },
    });
    map.addControl(new Ctl());
    if (store.get('tmap_view') === 'satellite' || map.options.preferSatellite) { map.removeLayer(street); sat.addTo(map); const b = map.getContainer().querySelector('.tmap-layer'); if (b) b.innerHTML = `🗺️ <span>${esc(t('Map'))}</span>`; }
  }

  // ── GPS ────────────────────────────────────────────────────────────
  // The best position within a few seconds: the phone's first answer is
  // often a rough one from the network; the GPS fix comes a moment later.
  function bestPosition({ goodM = 25, maxWaitMs = 12000 } = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject({ code: 'unsupported' });
      let best = null, watch = null, done = false;
      const finish = () => { if (done) return; done = true; try { if (watch != null) navigator.geolocation.clearWatch(watch); } catch (e) {} clearTimeout(timer); best ? resolve(best) : reject({ code: 'timeout' }); };
      const take = (p) => {
        const fix = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: Math.max(1, Math.round(p.coords.accuracy || 9999)), heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null, speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null, at: p.timestamp || Date.now() };
        if (!best || fix.accuracyM <= best.accuracyM) best = fix;
        if (best.accuracyM <= goodM) finish();
      };
      const fail = (err) => { if (err && err.code === 1) { done = true; clearTimeout(timer); try { if (watch != null) navigator.geolocation.clearWatch(watch); } catch (e) {} reject({ code: 'denied' }); } };
      const timer = setTimeout(finish, maxWaitMs);
      try { watch = navigator.geolocation.watchPosition(take, fail, { enableHighAccuracy: true, maximumAge: 5000, timeout: maxWaitMs }); } catch (e) { reject({ code: 'unsupported' }); }
    });
  }
  // What to do when location is blocked, for the device in hand.
  function locationHelp(code) {
    const ua = navigator.userAgent || '';
    if (code === 'denied') {
      if (/iPhone|iPad|iPod/.test(ua)) return t('Location is blocked. On your iPhone: Settings → Privacy & Security → Location Services → turn it on, then Safari Websites (or Chrome) → While Using. Then come back and try again.');
      if (/Android/.test(ua)) return t('Location is blocked. Tap the lock icon next to the web address → Permissions → Location → Allow. Also check the phone\'s Location is on (swipe down from the top).');
      return t('Location is blocked. Click the lock icon next to the web address, allow Location for this site, then try again.');
    }
    if (code === 'timeout') return t('No GPS signal yet. Go near a window or outside, check the phone\'s Location is on, and try again.');
    return t('This device can\'t share its location. You can still drop a pin on the map.');
  }
  const ACC_WORDS = (m) => (m <= 20 ? t('Accurate') : m <= 60 ? t('Good') : m <= 200 ? t('Rough') : t('Weak signal'));

  function meDot(heading) {
    const cone = Number.isFinite(heading) ? `<div style="position:absolute;left:50%;top:50%;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:18px solid rgba(26,115,232,.55);transform:translate(-50%,-100%) rotate(${heading}deg);transform-origin:50% 100%;"></div>` : '';
    return L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="tmap-me">${cone}<div class="tmap-me-dot"></div></div>` });
  }
  function showMe(map, fix) {
    const ll = [fix.latitude, fix.longitude];
    if (!map.__me) {
      map.__meAcc = L.circle(ll, { radius: fix.accuracyM, color: '#1A73E8', weight: 1, fillColor: '#1A73E8', fillOpacity: 0.12, interactive: false }).addTo(map);
      map.__me = L.marker(ll, { icon: meDot(fix.heading), keyboard: false, zIndexOffset: 1000 }).addTo(map);
    } else {
      glide(map.__me, ll); map.__meAcc.setLatLng(ll); map.__meAcc.setRadius(fix.accuracyM);
      if (Number.isFinite(fix.heading)) map.__me.setIcon(meDot(fix.heading));
    }
    map.__me.bindTooltip(`${t('You are here')} · ${ACC_WORDS(fix.accuracyM)} (±${fix.accuracyM} m)`, { direction: 'top', offset: [0, -10] });
  }
  function locateButton(map) {
    const Ctl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd() {
        const b = L.DomUtil.create('button', 'tmap-btn tmap-locate');
        b.type = 'button'; b.title = t('Show my location'); b.setAttribute('aria-label', t('Show my location'));
        b.innerHTML = '<span class="tmap-target"></span>';
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, 'click', async (ev) => {
          L.DomEvent.preventDefault(ev);
          b.classList.add('busy');
          try {
            const fix = await bestPosition({ goodM: 30, maxWaitMs: 10000 });
            showMe(map, fix);
            map.flyTo([fix.latitude, fix.longitude], Math.max(map.getZoom(), fix.accuracyM > 500 ? 14 : 17), { duration: 0.8 });
            if (fix.accuracyM > 200 && typeof showToast === 'function') showToast(`${t('Your position is rough')} (±${fix.accuracyM} m). ${t('Go near a window or outside for a better GPS fix.')}`);
          } catch (e) { if (typeof showToast === 'function') showToast(locationHelp(e && e.code)); }
          b.classList.remove('busy');
        });
        return b;
      },
    });
    map.addControl(new Ctl());
  }

  // ── markers that glide, a map that follows ─────────────────────────
  function glide(marker, to, ms = 900) {
    if (!marker || !to) return;
    const from = marker.getLatLng(); const target = L.latLng(to);
    if (!from || from.distanceTo(target) < 1 || from.distanceTo(target) > 3000 || document.hidden) { marker.setLatLng(target); return; }
    cancelAnimationFrame(marker.__glide);
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      marker.setLatLng([from.lat + (target.lat - from.lat) * e, from.lng + (target.lng - from.lng) * e]);
      if (k < 1) marker.__glide = requestAnimationFrame(step);
    };
    marker.__glide = requestAnimationFrame(step);
  }
  // The map keeps the trip in view until the person moves it; then a button brings it back.
  function follow(map, getBounds) {
    if (map.__follow) return map.__follow;
    const st = { on: true, btn: null };
    const stop = () => { if (!st.on) return; st.on = false; if (st.btn) st.btn.style.display = ''; };
    map.on('dragstart', stop);
    map.getContainer().addEventListener('wheel', stop, { passive: true });
    map.getContainer().addEventListener('touchstart', (ev) => { if (ev.touches && ev.touches.length > 1) stop(); }, { passive: true });
    const Ctl = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd() {
        const b = L.DomUtil.create('button', 'tmap-btn tmap-recenter'); b.type = 'button'; b.style.display = 'none';
        b.innerHTML = `◎ <span>${esc(t('Re-centre'))}</span>`;
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, 'click', (ev) => { L.DomEvent.preventDefault(ev); st.on = true; b.style.display = 'none'; st.frame(true); });
        st.btn = b; return b;
      },
    });
    map.addControl(new Ctl());
    st.frame = (force) => {
      if (!st.on && !force) return;
      const b = getBounds(); if (!b || !b.isValid()) return;
      const sz = map.getSize();
      const pad = Math.max(30, Math.min(70, Math.round(Math.min(sz.x, sz.y) * 0.12)));
      if (b.getNorthEast().equals(b.getSouthWest())) map.setView(b.getCenter(), Math.max(map.getZoom(), 16), { animate: true });
      else map.fitBounds(b, { padding: [pad, pad], maxZoom: 17, animate: true });
    };
    map.__follow = st;
    return st;
  }
  // The road between two points, drawn once (and again if a point moves a lot).
  async function drawRoute(map, a, b, opts = {}) {
    if (!map || !a || !b) return null;
    const key = [a.latitude, a.longitude, b.latitude, b.longitude].map(n => Number(n).toFixed(3)).join(',');
    const slot = opts.slot || 'route';
    map.__routes = map.__routes || {};
    const have = map.__routes[slot];
    if (have && have.key === key) return have;
    let r = null;
    try { r = await apiFetch('GET', `/geo/route?fromLat=${a.latitude}&fromLng=${a.longitude}&toLat=${b.latitude}&toLng=${b.longitude}${opts.vehicle ? '&vehicle=' + encodeURIComponent(opts.vehicle) : ''}`); } catch (e) { r = { source: 'straight', points: [[a.latitude, a.longitude], [b.latitude, b.longitude]] }; }
    if (!map._loaded || !map.getContainer().isConnected) return null;
    if (have && have.layer) map.removeLayer(have.layer);
    const road = r.source === 'road';
    const layer = L.layerGroup([
      ...(road ? [L.polyline(r.points, { color: '#ffffff', weight: 8, opacity: 0.9, interactive: false })] : []),
      L.polyline(r.points, { color: opts.color || '#1A73E8', weight: road ? 5 : 3, opacity: road ? 0.95 : 0.7, dashArray: road ? null : '8 8', interactive: false }),
    ]).addTo(map);
    map.__routes[slot] = { key, layer, km: r.km, minutes: r.minutes, source: r.source };
    return map.__routes[slot];
  }

  // ── navigation: Google Maps, Waze or Apple Maps ────────────────────
  const APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || '');
  function navLinks(dest) {
    const ll = dest.latitude != null ? `${dest.latitude},${dest.longitude}` : null;
    const q = ll || encodeURIComponent(dest.address || ''); // numbers and a comma need no encoding
    const out = [{ key: 'google', name: 'Google Maps', icon: '🗺️', href: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving` },
      { key: 'waze', name: 'Waze', icon: '🚙', href: ll ? `https://waze.com/ul?ll=${q}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes` }];
    if (APPLE) out.push({ key: 'apple', name: 'Apple Maps', icon: '🧭', href: `https://maps.apple.com/?daddr=${q}&dirflg=d` });
    return out;
  }
  function openNav(dest, label) {
    const links = navLinks(dest);
    const fav = store.get('tmap_nav');
    const pick = links.find(l => l.key === fav);
    if (pick) { window.open(pick.href, '_blank', 'noopener'); return; }
    const old = document.getElementById('tmap-nav'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="tmap-nav" role="dialog" aria-modal="true" aria-label="${esc(t('Navigate'))}"><div class="modal" style="max-width:420px;">
      <div class="modal-header"><button class="modal-close" onclick="document.getElementById('tmap-nav').remove()" aria-label="${esc(t('Close'))}">✕</button><h3>🧭 ${esc(t('Navigate'))}</h3>${label ? `<p>${esc(label)}</p>` : ''}</div>
      <div class="modal-body" style="display:grid;gap:10px;">
        ${links.map(l => `<a class="btn-sm btn-sm-outline tmap-nav-app" data-key="${l.key}" href="${esc(l.href)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;justify-content:flex-start;padding:12px 14px;font-size:15px;">${l.icon} ${esc(l.name)}</a>`).join('')}
        <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--slate);"><input type="checkbox" id="tmap-nav-keep"/> ${esc(t('Always use this app'))}</label>
      </div></div></div>`);
    document.querySelectorAll('#tmap-nav .tmap-nav-app').forEach(a => a.addEventListener('click', () => {
      const keep = document.getElementById('tmap-nav-keep'); if (keep && keep.checked) store.set('tmap_nav', a.dataset.key);
      setTimeout(() => { const o = document.getElementById('tmap-nav'); if (o) o.remove(); }, 100);
    }));
  }
  // Every "directions" link in the app offers the choice.
  document.addEventListener('click', (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest('a[href^="https://www.google.com/maps/dir/"]');
    if (!a || a.classList.contains('tmap-nav-app') || ev.ctrlKey || ev.metaKey) return;
    let dest = null;
    try { const u = new URL(a.href); const d = u.searchParams.get('destination') || ''; const m = d.match(/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/); dest = m ? { latitude: Number(m[1]), longitude: Number(m[2]) } : { address: d }; } catch (e) { return; }
    ev.preventDefault();
    openNav(dest, (a.getAttribute('data-label') || '').trim());
  }, true);

  // Leaflet is loaded on demand: hook in as soon as it is there.
  if (typeof loadLeaflet === 'function') {
    const base = loadLeaflet;
    loadLeaflet = async function () { const [ok] = await Promise.all([base.apply(this, arguments), Promise.race([config(), new Promise(r => setTimeout(r, 2500))])]); if (ok) install(); return ok; };
  }
  install();

  window.TrothenMap = { config, install, bestPosition, locationHelp, showMe, glide, follow, drawRoute, openNav, navLinks };
  window.navigateTo = (lat, lng, label) => openNav({ latitude: lat, longitude: lng }, label);
})();
