// v136: in-app voice and video calls (the screens). See src/routes/calls.routes.js.
// v137: checks before ringing (call window, blocks, call hours) with
// "Leave a voice message" when a call can't go through or isn't answered;
// reconnects by itself when the network drops or changes mid-call;
// data-saver sound and video for weak mobile networks; a connection bar.
//
// - "Call" and "Video" buttons in a conversation, and next to the message
//   buttons on bookings and job matches.
// - The person called sees a full-screen "Voice call from …" with Answer and
//   Decline, and hears a ring. The caller hears a ringing tone.
// - During the call: mute, camera on/off (video calls), hang up, a timer.
// - The sound and picture go straight between the two phones or computers.
//   No phone numbers are shared. Each call leaves a line in the chat.
(function () {
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Call': 'Llamar', 'Video': 'Video', 'Voice call': 'Llamada de voz', 'Video call': 'Videollamada', 'Calling…': 'Llamando…', 'Ringing…': 'Sonando…',
      'Connecting…': 'Conectando…', 'Answer': 'Contestar', 'Decline': 'Rechazar', 'Mute': 'Silenciar', 'Unmute': 'Activar sonido', 'Camera off': 'Apagar cámara', 'Camera on': 'Encender cámara',
      'Hang Up': 'Colgar', 'Call ended': 'Llamada finalizada', 'No answer': 'Sin respuesta', 'Call declined': 'Llamada rechazada',
      'is calling you': 'te está llamando', 'Allow the microphone to make calls. Check the permission in your browser settings, then try again.': 'Permite el micrófono para hacer llamadas. Revisa el permiso en la configuración del navegador e inténtalo de nuevo.',
      'Allow the microphone and camera to make video calls. Check the permission in your browser settings, then try again.': 'Permite el micrófono y la cámara para hacer videollamadas. Revisa el permiso en la configuración del navegador e inténtalo de nuevo.',
      'The call could not connect. Some networks block calls. Try Wi-Fi, or send a message instead.': 'No se pudo conectar la llamada. Algunas redes bloquean las llamadas. Prueba con Wi-Fi o envía un mensaje.',
      'Calls need a secure connection (https).': 'Las llamadas necesitan una conexión segura (https).', 'This browser cannot make calls.': 'Este navegador no puede hacer llamadas.',
      'They are not on Trothen right now. They have been notified that you called.': 'No está en Trothen ahora. Se le avisó de tu llamada.',
      'Reconnecting…': 'Reconectando…', 'Still connecting…': 'Todavía conectando…',
      'The call could not connect. Check both internet connections and try again.': 'No se pudo conectar la llamada. Revisen sus conexiones a internet e inténtenlo de nuevo.',
      'The call could not connect. One of your networks is blocking direct calls, often a VPN or office, school or hotel Wi-Fi. Turn off a VPN, or switch between Wi-Fi and mobile data, and try again.': 'No se pudo conectar la llamada. Una de sus redes bloquea las llamadas directas, a menudo una VPN o el Wi-Fi de una oficina, escuela u hotel. Desactiva la VPN o cambia entre Wi-Fi y datos móviles, e inténtalo de nuevo.', 'Weak connection': 'Conexión débil', 'Leave a voice message': 'Dejar un mensaje de voz', 'Close': 'Cerrar', 'Call again': 'Llamar de nuevo',
      'The connection dropped. Call again when you have a better signal.': 'Se cortó la conexión. Vuelve a llamar cuando tengas mejor señal.',
    });
  } catch (x) {}

  const I = {
    phone: '<path d="M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.4"/>',
    video: '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
    micoff: '<path d="M12 19v3M15 9.3V5a3 3 0 0 0-5.7-1.3M19 10v2a7 7 0 0 1-.1 1.2M2 2l20 20M9 9v3a3 3 0 0 0 5.1 2.1M16.9 16.9A7 7 0 0 1 5 12v-2"/>',
    hang: '<path d="M10.7 13.3a10 10 0 0 0 3.4 2.2l1.5-1.5a1 1 0 0 1 1-.2l3.2.9a1 1 0 0 1 .7 1v3.4a1 1 0 0 1-1 1A17 17 0 0 1 3.1 4.1a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 .7l.9 3.2a1 1 0 0 1-.2 1L7.6 9.4"/><path d="M22 2 2 22"/>',
  };
  const svg = (k, size, color) => `<svg width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

  // ── buttons ──────────────────────────────────────────────────────────
  window.callButtonsHTML = function (userId, name) {
    if (!userId) return '';
    return `<span class="call-btns" style="display:inline-flex;gap:6px;flex-shrink:0;">
      <button type="button" class="btn-sm btn-sm-outline call-btn" title="${e(t('Voice call'))}" onclick="startCall(${JSON.stringify(String(userId)).replace(/"/g, '&quot;')}, false, ${JSON.stringify(String(name || '')).replace(/"/g, '&quot;')})">${svg('phone', 15, '#16a34a')} ${e(t('Call'))}</button>
      <button type="button" class="btn-sm btn-sm-outline call-btn" title="${e(t('Video call'))}" onclick="startCall(${JSON.stringify(String(userId)).replace(/"/g, '&quot;')}, true, ${JSON.stringify(String(name || '')).replace(/"/g, '&quot;')})">${svg('video', 15, '#4f46e5')} ${e(t('Video'))}</button>
    </span>`;
  };
  // Next to every "message this person" button on bookings, contracts and job matches.
  function addRowButtons() {
    if (!(AUTH && AUTH.user && ['customer', 'provider'].includes(AUTH.user.role))) return;
    document.querySelectorAll('#customer-main [onclick*="selectMessageContact("], #provider-main [onclick*="selectMessageContact("]').forEach(b => {
      if (b.dataset.callAdded || b.classList.contains('chat-item') || b.closest('.chat-list, .chat-shell .chat-items')) return;
      const cell = b.closest('td, .row-actions'); if (cell && cell.querySelector('.call-btns')) { b.dataset.callAdded = '1'; return; } // the row already has them
      const m = /selectMessageContact\((?:&quot;|'|")([^'"&)]+)/.exec(b.getAttribute('onclick') || '');
      if (!m) return;
      b.dataset.callAdded = '1';
      b.insertAdjacentHTML('afterend', ' ' + callButtonsHTML(m[1], ''));
    });
  }
  // Every live booking row: Call and Video in the Action column.
  const LIVE_STATUSES = ['active', 'confirmed', 'pending_provider_confirmation', 'pending_agreement', 'awaiting_payment'];
  function withCallButtons(fnName, peerOf) {
    const base = window[fnName];
    if (typeof base !== 'function') return;
    window[fnName] = function (list) {
      const html = base.apply(this, arguments);
      try {
        if (!Array.isArray(list) || !list.length) return html;
        const box = document.createElement('div'); box.innerHTML = html;
        const rows = [...box.querySelectorAll('table.data-table > tbody > tr, table.data-table > tr')].filter(tr => tr.parentElement.tagName !== 'THEAD');
        if (rows.length !== list.length) return html; // only when every row lines up with its booking
        rows.forEach((tr, i) => {
          const b = list[i]; const peer = b && peerOf(b);
          if (!peer || !LIVE_STATUSES.includes(b.status)) return;
          const cell = tr.lastElementChild; if (!cell || cell.querySelector('.call-btns')) return;
          cell.insertAdjacentHTML('beforeend', ' ' + callButtonsHTML(peer, b.pro || b.customer || ''));
        });
        return box.innerHTML;
      } catch (x) { return html; }
    };
  }
  withCallButtons('bookingsTable', b => b.providerId);
  withCallButtons('contractsTable', c => c.customerId);
  withCallButtons('contractsTableWithEscrow', c => c.customerId);
  let addTimer = null;
  new MutationObserver(() => { clearTimeout(addTimer); addTimer = setTimeout(addRowButtons, 150); }).observe(document.body, { childList: true, subtree: true });

  // ── sounds ───────────────────────────────────────────────────────────
  let audioCtx = null, toneTimer = null;
  function tone(pattern) {
    stopTone();
    // v140: the person's chosen ringtone (src: public/app/sounds.js)
    if (window.TrothenSounds) { const stop = window.TrothenSounds.loop(pattern === 'ring' ? 'ring' : 'ringback'); if (stop) { toneTimer = { stop }; return; } }
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (x) { return; }
    const beep = (f1, f2, ms) => { try { const o = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = f1; o2.frequency.value = f2; g.gain.value = 0.06; o.connect(g); o2.connect(g); g.connect(audioCtx.destination); o.start(); o2.start(); setTimeout(() => { o.stop(); o2.stop(); }, ms); } catch (x) {} };
    const play = pattern === 'ring' ? () => { beep(440, 480, 900); setTimeout(() => beep(440, 480, 900), 1200); } : () => beep(440, 480, 1200);
    play(); toneTimer = setInterval(play, pattern === 'ring' ? 3500 : 4000);
    if (pattern === 'ring' && navigator.vibrate) { try { navigator.vibrate([500, 300, 500]); } catch (x) {} }
  }
  function stopTone() { if (toneTimer && toneTimer.stop) toneTimer.stop(); else if (toneTimer) clearInterval(toneTimer); toneTimer = null; }

  // ── state ────────────────────────────────────────────────────────────
  const C = { id: null, role: null, video: false, peer: null, pc: null, local: null, queued: [], startedAt: null, timer: null, ice: null, ending: false, remoteSet: false, voiceOk: true, reconnecting: false, reconnectTimer: null, reconnectStarted: 0, reconnects: 0, statsTimer: null, quality: null, lastStats: null };
  window.callDebug = () => ({ id: C.id, role: C.role, state: C.pc && C.pc.connectionState, quality: C.quality, reconnects: C.reconnects, reconnecting: C.reconnecting, dataSaver: !!(C.pc && C.pc.localDescription && /usedtx=1/.test(C.pc.localDescription.sdp) && /maxaveragebitrate=32000/.test(C.pc.localDescription.sdp)) });
  async function iceServers() {
    if (C.ice) return C.ice;
    try { const r = await apiFetch('GET', '/calls/ice-servers'); C.ice = r.iceServers; C.relayConfigured = r.relay === true; } catch (x) { C.ice = [{ urls: 'stun:stun.l.google.com:19302' }]; C.relayConfigured = false; }
    return C.ice;
  }
  async function getMedia(video) {
    if (!window.isSecureContext && location.hostname !== 'localhost') throw new Error(t('Calls need a secure connection (https).'));
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error(t('This browser cannot make calls.'));
    try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: 'user', width: { ideal: 640, max: 640 }, height: { ideal: 360, max: 480 }, frameRate: { ideal: 15, max: 20 } } : false }); }
    catch (x) { throw new Error(t(video ? 'Allow the microphone and camera to make video calls. Check the permission in your browser settings, then try again.' : 'Allow the microphone to make calls. Check the permission in your browser settings, then try again.')); }
  }
  // Data saver: clear speech at about 32 kbps, video capped for 3G/4G.
  // Opus's own repair for lost packets (FEC) and silence saving (DTX) on.
  function tuneSdp(sdp) {
    const m = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp || '');
    if (!m) return sdp;
    const pt = m[1];
    const re = new RegExp(`a=fmtp:${pt} ([^\r\n]*)`);
    const extra = { useinbandfec: '1', usedtx: '1', maxaveragebitrate: '32000' };
    if (re.test(sdp)) return sdp.replace(re, (all, params) => { const have = Object.fromEntries(params.split(';').map(x => x.trim()).filter(Boolean).map(x => x.split('='))); Object.assign(have, extra); return `a=fmtp:${pt} ${Object.entries(have).map(([k, v]) => `${k}=${v}`).join(';')}`; });
    return sdp.replace(m[0], `${m[0]}\r\na=fmtp:${pt} useinbandfec=1;usedtx=1;maxaveragebitrate=32000`);
  }
  async function capSenders(pc) {
    for (const sender of pc.getSenders()) {
      if (!sender.track) continue;
      try {
        const p = sender.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        if (sender.track.kind === 'audio') p.encodings[0].maxBitrate = 32000;
        else { p.encodings[0].maxBitrate = 450000; p.encodings[0].maxFramerate = 20; }
        await sender.setParameters(p);
      } catch (x) { /* older browsers: their own defaults */ }
    }
  }
  async function makePC() {
    const pc = new RTCPeerConnection({ iceServers: await iceServers() });
    C.pc = pc;
    C.local.getTracks().forEach(tr => pc.addTrack(tr, C.local));
    C.candTypes = new Set();
    pc.onicecandidate = (ev) => { if (ev.candidate && C.id) { try { const m = / typ (\w+)/.exec(ev.candidate.candidate || ''); if (m) C.candTypes.add(m[1]); } catch (x) {} signal('ice', ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate); } };
    startConnectWatch();
    pc.ontrack = (ev) => {
      const v = document.getElementById('call-remote-video'), a = document.getElementById('call-remote-audio');
      if (C.video && v) { v.srcObject = ev.streams[0]; v.play && v.play().catch(() => {}); }
      if (a) { a.srcObject = ev.streams[0]; a.play && a.play().catch(() => {}); }
    };
    pc.oniceconnectionstatechange = () => { if (['connected', 'completed'].includes(pc.iceConnectionState)) setTimeout(reconnected, 300); };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') {
        stopTone();
        if (!C.startedAt) { C.startedAt = Date.now(); C.timer = setInterval(drawTimer, 1000); capSenders(pc); startStats(); clearTimeout(C.connectTimer); clearTimeout(C.connectFail); showNote(''); }
        reconnected();
        setStatus(''); drawTimer();
      }
      if (s === 'disconnected' || s === 'failed') {
        if (!C.startedAt) { if (s === 'failed') { showNote(t('The call could not connect. Some networks block calls. Try Wi-Fi, or send a message instead.')); hangUp(true, 'connection'); } return; }
        reconnect();
      }
    };
    return pc;
  }
  // v140: a call that never connects used to sit on "Connecting…" for ever.
  // After 15 seconds the caller tries a fresh route once; after 30 seconds
  // the call ends with a plain reason and (for the caller) the choice of a
  // voice message or calling again.
  function startConnectWatch() {
    clearTimeout(C.connectTimer); clearTimeout(C.connectFail);
    // Only the caller restarts and ends a call that won't connect, so the two sides never both try at once.
    C.connectTimer = setTimeout(() => {
      if (!C.pc || C.startedAt) return;
      showNote(t('Still connecting…'));
      if (C.role === 'caller') { C.reconnecting = true; C.reconnectStarted = Date.now(); reconnect(); C.reconnecting = false; }
    }, 15000);
    C.connectFail = setTimeout(() => {
      if (!C.pc || C.startedAt || !C.id) return;
      showNote(t(C.relayConfigured ? 'The call could not connect. Check both internet connections and try again.' : 'The call could not connect. One of your networks is blocking direct calls, often a VPN or office, school or hotel Wi-Fi. Turn off a VPN, or switch between Wi-Fi and mobile data, and try again.'));
      hangUp(false, 'connection');
    }, C.role === 'caller' ? 30000 : 40000); // the person called only gives up if the caller's page has gone
  }
  // Back on a working route (after a new offer and answer, or the line
  // coming back by itself): carry on.
  function reconnected() {
    if (!C.reconnecting || !C.pc) return;
    if (C.pc.connectionState !== 'connected' || !['connected', 'completed'].includes(C.pc.iceConnectionState) || C.pc.signalingState !== 'stable') return;
    C.reconnecting = false; clearTimeout(C.reconnectTimer); showNote(''); drawTimer();
  }
  // The network dropped or changed (Wi-Fi to mobile data, a tunnel...):
  // find a new route without hanging up. The caller makes the new offer;
  // the person called asks for one. Give up after 25 seconds.
  async function reconnect() {
    if (!C.pc || C.ending) return;
    if (!C.reconnecting) { C.reconnecting = true; C.reconnectStarted = Date.now(); C.reconnects++; setStatus(t('Reconnecting…')); }
    clearTimeout(C.reconnectTimer);
    if (Date.now() - C.reconnectStarted > 25000) { showNote(t('The connection dropped. Call again when you have a better signal.')); return hangUp(false, 'connection'); }
    try {
      if (C.role === 'caller') {
        if (C.pc.signalingState !== 'stable') { C.reconnectTimer = setTimeout(() => { if (C.reconnecting) reconnect(); }, 3000); return; } // an offer is already on its way
        const offer = await C.pc.createOffer({ iceRestart: true });
        offer.sdp = tuneSdp(offer.sdp);
        await C.pc.setLocalDescription(offer);
        signal('offer', { type: offer.type, sdp: offer.sdp });
      } else signal('restart');
    } catch (x) { /* try again below */ }
    C.reconnectTimer = setTimeout(() => { if (C.reconnecting) reconnect(); }, 6000);
  }
  window.addEventListener('online', () => { if (C.pc && C.startedAt && C.pc.connectionState !== 'connected') reconnect(); });
  // For support and testing: find a new route now, as if the network had changed.
  window.callReconnectNow = () => { if (C.pc && C.startedAt) { C.reconnecting = true; C.reconnectStarted = Date.now(); C.reconnects++; setStatus(t('Reconnecting…')); reconnect(); } };
  // The connection bar: round-trip time and lost sound every 2 seconds.
  function startStats() {
    clearInterval(C.statsTimer);
    C.statsTimer = setInterval(async () => {
      if (!C.pc) return;
      try {
        const st = await C.pc.getStats();
        let rtt = null, lost = 0, got = 0;
        st.forEach(r => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected) && r.currentRoundTripTime != null) rtt = r.currentRoundTripTime;
          if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) { lost = r.packetsLost || 0; got = r.packetsReceived || 0; }
        });
        const prev = C.lastStats || { lost: 0, got: 0 };
        const dl = Math.max(0, lost - prev.lost), dg = Math.max(0, got - prev.got);
        C.lastStats = { lost, got };
        const loss = dl + dg ? dl / (dl + dg) * 100 : 0;
        const q = C.reconnecting ? 'poor' : (rtt == null ? (loss > 10 ? 'poor' : 'good') : (rtt < 0.3 && loss < 3 ? 'good' : rtt < 0.7 && loss < 10 ? 'fair' : 'poor'));
        C.quality = { level: q, rttMs: rtt == null ? null : Math.round(rtt * 1000), lossPct: Math.round(loss * 10) / 10 };
        drawQuality();
      } catch (x) {}
    }, 2000);
  }
  function drawQuality() {
    const el = document.getElementById('call-quality'); if (!el || !C.quality) return;
    const n = C.quality.level === 'good' ? 3 : C.quality.level === 'fair' ? 2 : 1;
    const col = n === 3 ? '#22c55e' : n === 2 ? '#f59e0b' : '#ef4444';
    el.innerHTML = `<span style="display:inline-flex;align-items:flex-end;gap:2px;height:14px;vertical-align:middle;">${[1, 2, 3].map(i => `<span style="width:4px;height:${4 + i * 3}px;border-radius:1px;background:${i <= n ? col : 'rgba(255,255,255,.3)'};"></span>`).join('')}</span>${n === 1 ? ` <span style="vertical-align:middle;">${e(t('Weak connection'))}</span>` : ''}`;
    el.dataset.level = C.quality.level;
  }
  async function signal(kind, data) { try { await apiFetch('POST', `/calls/${encodeURIComponent(C.id)}/signal`, { kind, data }); } catch (x) { /* the call times out by itself */ } }
  async function addIce(c) { try { await C.pc.addIceCandidate(c); } catch (x) {} }

  // ── the call screen ──────────────────────────────────────────────────
  function screen(html) {
    let o = document.getElementById('call-screen');
    if (!o) { o = document.createElement('div'); o.id = 'call-screen'; document.body.appendChild(o); }
    o.style.cssText = 'position:fixed;inset:0;z-index:6000;background:#0F2640;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;text-align:center;';
    o.innerHTML = html;
    return o;
  }
  function avatar(p) {
    const initials = (p.initials || String(p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')).toUpperCase();
    return p.profilePhotoUrl ? `<img src="${e(p.profilePhotoUrl)}" alt="" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.25);">`
      : `<div style="width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:700;">${e(initials)}</div>`;
  }
  const roundBtn = (id, icon, label, bg) => `<button id="${id}" type="button" style="display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:0;color:#fff;cursor:pointer;font-size:13px;"><span style="width:62px;height:62px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;">${svg(icon, 26, '#fff')}</span>${e(label)}</button>`;
  function drawCall() {
    const p = C.peer || {};
    screen(`
      ${C.video ? `<video id="call-remote-video" autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0F2640;"></video>
        <video id="call-local-video" autoplay playsinline muted style="position:absolute;right:16px;top:16px;width:110px;height:150px;object-fit:cover;border-radius:12px;border:2px solid rgba(255,255,255,.4);background:#000;z-index:2;"></video>` : ''}
      <audio id="call-remote-audio" autoplay playsinline></audio>
      <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:10px;${C.video ? 'margin-top:auto;margin-bottom:24px;text-shadow:0 1px 4px rgba(0,0,0,.6);' : ''}">
        ${C.video ? '' : avatar(p)}
        <div style="font-size:22px;font-weight:700;">${e(p.name || '')}</div>
        <div id="call-quality" style="font-size:12.5px;min-height:14px;opacity:.95;"></div>
        <div id="call-status" style="font-size:15px;opacity:.85;">${e(t(C.role === 'caller' ? 'Calling…' : 'Connecting…'))}</div>
        <div id="call-note" style="font-size:13px;opacity:.85;max-width:340px;"></div>
      </div>
      <div style="position:relative;z-index:2;display:flex;gap:28px;margin-top:${C.video ? '0' : '40px'};">
        ${roundBtn('call-mute', 'mic', t('Mute'), 'rgba(255,255,255,.18)')}
        ${C.video ? roundBtn('call-cam', 'video', t('Camera off'), 'rgba(255,255,255,.18)') : ''}
        ${roundBtn('call-hang', 'hang', t('Hang Up'), '#dc2626')}
      </div>`);
    if (C.video) { const lv = document.getElementById('call-local-video'); if (lv && C.local) lv.srcObject = C.local; }
    document.getElementById('call-hang').onclick = () => hangUp(false);
    document.getElementById('call-mute').onclick = () => {
      const a = C.local && C.local.getAudioTracks()[0]; if (!a) return;
      a.enabled = !a.enabled;
      const b = document.getElementById('call-mute'); b.querySelector('span').innerHTML = svg(a.enabled ? 'mic' : 'micoff', 26, '#fff'); b.lastChild.textContent = t(a.enabled ? 'Mute' : 'Unmute');
      b.querySelector('span').style.background = a.enabled ? 'rgba(255,255,255,.18)' : '#f59e0b';
    };
    const cam = document.getElementById('call-cam');
    if (cam) cam.onclick = () => {
      const v = C.local && C.local.getVideoTracks()[0]; if (!v) return;
      v.enabled = !v.enabled; cam.lastChild.textContent = t(v.enabled ? 'Camera off' : 'Camera on');
      cam.querySelector('span').style.background = v.enabled ? 'rgba(255,255,255,.18)' : '#f59e0b';
    };
  }
  function setStatus(s) { const el = document.getElementById('call-status'); if (el) el.textContent = s; }
  function showNote(s) { const el = document.getElementById('call-note'); if (el) el.textContent = s; else if (typeof showToast === 'function') showToast(s); }
  function drawTimer() { if (!C.startedAt) return; const s = Math.round((Date.now() - C.startedAt) / 1000); setStatus(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); }

  function cleanup(message) {
    stopTone();
    if (C.timer) clearInterval(C.timer);
    clearInterval(C.statsTimer); clearTimeout(C.reconnectTimer); clearTimeout(C.connectTimer); clearTimeout(C.connectFail);
    try { C.pc && C.pc.close(); } catch (x) {}
    try { C.local && C.local.getTracks().forEach(tr => tr.stop()); } catch (x) {}
    const o = document.getElementById('call-screen');
    if (o && message) { setStatus(message); setTimeout(() => o.remove(), 1600); } else if (o) o.remove();
    Object.assign(C, { id: null, role: null, video: false, peer: null, pc: null, local: null, queued: [], startedAt: null, timer: null, ending: false, remoteSet: false, voiceOk: true, reconnecting: false, reconnectTimer: null, statsTimer: null, lastStats: null, reconnects: 0, quality: null });
  }
  async function hangUp(quiet, reason) {
    if (!C.id || C.ending) return;
    C.ending = true;
    const id = C.id;
    const diag = reason === 'connection' ? { ice: C.pc ? C.pc.iceConnectionState : '', relay: !!C.relayConfigured, candidates: [...(C.candTypes || [])].join(',') } : null;
    try { await apiFetch('POST', `/calls/${encodeURIComponent(id)}/end`, reason ? { reason, ...(diag ? { diag } : {}) } : undefined); } catch (x) {}
    if (reason === 'connection' && C.role === 'caller' && C.peer) return endWithChoices(C.startedAt ? t('The connection dropped. Call again when you have a better signal.') : ((document.getElementById('call-note') || {}).textContent || t('The call could not connect.')), true);
    if (reason === 'connection' && !C.startedAt) { const note = (document.getElementById('call-note') || {}).textContent; return cleanup(note || t('Call ended')); }
    cleanup(quiet ? null : t('Call ended'));
  }
  // The caller's screen when a call didn't go through: leave a voice
  // message, call again, or close.
  function endWithChoices(message, again) {
    const peer = C.peer || {}, callId = C.id, video = C.video, voiceOk = C.voiceOk !== false;
    stopTone();
    if (C.timer) clearInterval(C.timer);
    clearInterval(C.statsTimer); clearTimeout(C.reconnectTimer); clearTimeout(C.connectTimer); clearTimeout(C.connectFail);
    try { C.pc && C.pc.close(); } catch (x) {}
    try { C.local && C.local.getTracks().forEach(tr => tr.stop()); } catch (x) {}
    Object.assign(C, { id: null, role: null, video: false, peer: null, pc: null, local: null, queued: [], startedAt: null, timer: null, ending: false, remoteSet: false, voiceOk: true, reconnecting: false, reconnectTimer: null, statsTimer: null, lastStats: null, reconnects: 0, quality: null });
    screen(`<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        ${avatar(peer)}
        <div style="font-size:22px;font-weight:700;">${e(peer.name || '')}</div>
        <div id="call-status" style="font-size:15px;opacity:.9;max-width:340px;">${e(message)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:36px;width:100%;max-width:300px;">
        ${voiceOk && typeof openVoiceRecorder === 'function' ? `<button type="button" id="call-leave-voice" style="background:#16a34a;color:#fff;border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;">${e(t('Leave a voice message'))}</button>` : ''}
        ${again ? `<button type="button" id="call-again" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;">${e(t('Call again'))}</button>` : ''}
        <button type="button" id="call-close" style="background:none;color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:12px;font-size:15px;cursor:pointer;">${e(t('Close'))}</button>
      </div>`);
    const close = () => { const o = document.getElementById('call-screen'); if (o) o.remove(); };
    const lv = document.getElementById('call-leave-voice'); if (lv) lv.onclick = () => { close(); openVoiceRecorder(peer.id, peer.name, callId); };
    const ag = document.getElementById('call-again'); if (ag) ag.onclick = () => { close(); startCall(peer.id, video, peer.name); };
    document.getElementById('call-close').onclick = close;
  }
  window.endCallWithChoices = endWithChoices;
  window.hangUpCall = hangUp;

  // ── placing a call ───────────────────────────────────────────────────
  window.startCall = async function (userId, video, name) {
    if (C.id) return;
    // v137: check first (call window, blocks, call hours), before asking
    // for the microphone, and offer a voice message where that's possible.
    try {
      const r = await apiFetch('GET', `/calls/can-reach/${encodeURIComponent(userId)}`);
      if (!r.call.ok) return cantCall(userId, name, r.call.error, r.voice.ok);
    } catch (x) { /* the call request below gives the answer */ }
    C.role = 'caller'; C.video = !!video; C.peer = { id: userId, name: name || '' };
    try { C.local = await getMedia(C.video); }
    catch (x) { C.role = null; C.peer = null; return showToast(x.message); }
    drawCall();
    try {
      const r = await apiFetch('POST', '/calls', { toUserId: userId, video: C.video });
      C.id = r.call.id; C.peer = r.call.to; C.voiceOk = r.voiceOk !== false;
      drawCall();
      setStatus(t(r.ringing ? 'Ringing…' : 'Calling…'));
      if (!r.ringing) showNote(t('They are not on Trothen right now. They have been notified that you called.'));
      tone('ringback');
    } catch (x) {
      const peer = C.peer;
      cleanup();
      const d = x.data || {};
      if (['BUSY', 'TOO_MANY_TO_THEM', 'OUTSIDE_HOURS', 'NO_CALLS'].includes(d.code)) return cantCall(userId, (peer && peer.name) || name, x.message, !!d.voiceOk);
      showToast(x.message || t('Call ended'));
    }
  };
  function cantCall(userId, name, message, voiceOk) {
    C.peer = { id: userId, name: name || '' }; C.voiceOk = !!voiceOk;
    endWithChoices(message, false);
  }

  // ── events from the server ───────────────────────────────────────────
  async function onCallEvent(ev) { try { await handleCallEvent(ev); } catch (x) { console.warn('[call]', x && x.message); } }
  async function handleCallEvent(ev) {
    let d; try { d = JSON.parse(ev.data); } catch (x) { return; }
    if (d.type === 'ring') return incoming(d);
    if (!C.id || d.callId !== C.id) return;
    if (d.type === 'accepted' && C.role === 'caller') {
      stopTone(); setStatus(t('Connecting…'));
      await makePC();
      const offer = await C.pc.createOffer();
      offer.sdp = tuneSdp(offer.sdp);
      await C.pc.setLocalDescription(offer);
      signal('offer', { type: offer.type, sdp: offer.sdp });
    } else if (d.type === 'restart' && C.role === 'caller') {
      if (!C.reconnecting) { C.reconnecting = true; C.reconnectStarted = Date.now(); C.reconnects++; setStatus(t('Reconnecting…')); }
      reconnect();
    } else if (d.type === 'offer' && C.role === 'callee') {
      await C.pc.setRemoteDescription(d.data); C.remoteSet = true;
      for (const c of C.queued.splice(0)) await addIce(c);
      const answer = await C.pc.createAnswer();
      answer.sdp = tuneSdp(answer.sdp);
      await C.pc.setLocalDescription(answer);
      signal('answer', { type: answer.type, sdp: answer.sdp });
      setTimeout(reconnected, 500); setTimeout(reconnected, 1500);
    } else if (d.type === 'answer' && C.role === 'caller') {
      if (!C.pc || C.pc.signalingState !== 'have-local-offer') return; // a late or repeated answer
      await C.pc.setRemoteDescription(d.data); C.remoteSet = true;
      for (const c of C.queued.splice(0)) await addIce(c);
      setTimeout(reconnected, 500); setTimeout(reconnected, 1500);
    } else if (d.type === 'ice') {
      if (C.pc && C.remoteSet) await addIce(d.data); else C.queued.push(d.data);
    } else if (d.type === 'declined') { if (C.role === 'caller') endWithChoices(t('Call declined'), false); else cleanup(t('Call declined')); }
    else if (d.type === 'unanswered') { if (C.role === 'caller') endWithChoices(t('No answer'), true); else cleanup(t('No answer')); }
    else if (d.type === 'ended') { if (C.ending) return; cleanup(t(d.reason === 'connection' && !C.startedAt ? 'The call could not connect.' : 'Call ended')); } // our own hang-up echoing back is handled by hangUp
    else if (d.type === 'answered-elsewhere' && C.role === 'ringing') { cleanup(); }
  }
  function incoming(d) {
    if (C.id) { apiFetch('POST', `/calls/${encodeURIComponent(d.callId)}/decline`).catch(() => {}); return; } // already on a call
    C.id = d.callId; C.role = 'ringing'; C.video = !!d.video; C.peer = d.from || {};
    const p = C.peer;
    screen(`<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        ${avatar(p)}
        <div style="font-size:22px;font-weight:700;">${e(p.name || '')}</div>
        <div style="font-size:15px;opacity:.85;">${e(t(C.video ? 'Video call' : 'Voice call'))} · ${e(t('is calling you'))}</div>
        <div id="call-note" style="font-size:13px;opacity:.85;max-width:340px;"></div>
      </div>
      <div style="display:flex;gap:48px;margin-top:48px;">
        ${roundBtn('call-decline', 'hang', t('Decline'), '#dc2626')}
        ${roundBtn('call-answer', C.video ? 'video' : 'phone', t('Answer'), '#16a34a')}
      </div>`);
    tone('ring');
    document.getElementById('call-decline').onclick = async () => { const id = C.id; cleanup(); try { await apiFetch('POST', `/calls/${encodeURIComponent(id)}/decline`); } catch (x) {} };
    document.getElementById('call-answer').onclick = async () => {
      stopTone();
      try { C.local = await getMedia(C.video); }
      catch (x) { showNote(x.message); const id = C.id; setTimeout(() => cleanup(), 4000); try { await apiFetch('POST', `/calls/${encodeURIComponent(id)}/decline`); } catch (y) {} return; }
      C.role = 'callee';
      drawCall(); setStatus(t('Connecting…'));
      await makePC();
      try { await apiFetch('POST', `/calls/${encodeURIComponent(C.id)}/accept`); }
      catch (x) { cleanup(x.message || t('Call ended')); }
    };
  }
  window.LIVE_LISTENERS = window.LIVE_LISTENERS || [];
  window.LIVE_LISTENERS.push(['call', onCallEvent]);

  // Leaving the page hangs up.
  window.addEventListener('pagehide', () => {
    if (!C.id || !AUTH || !AUTH.token) return;
    try { fetch(`${API_BASE}/calls/${encodeURIComponent(C.id)}/${C.role === 'ringing' ? 'decline' : 'end'}`, { method: 'POST', keepalive: true, headers: { Authorization: `Bearer ${AUTH.token}`, 'Content-Type': 'application/json' }, body: '{}' }); } catch (x) {}
  });
})();
