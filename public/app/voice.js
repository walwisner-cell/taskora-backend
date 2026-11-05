// v137: voice messages, call settings, blocking, and call history for disputes.
// The rules live on the server (src/routes/calls.routes.js); this file is the screens.
//
// - Voice messages: a microphone button next to Send in every chat. Tap to
//   record (up to 2 minutes), listen back, then Send or Discard. They play
//   right in the chat. When a call isn't answered, is declined, or the
//   person is busy or outside their call hours, the caller is offered
//   "Leave a voice message".
// - Settings → Calls & Voice Messages: take calls or not, take voice
//   messages or not, call hours and days, and the people you've blocked.
// - Block / Unblock in each chat header: no calls or voice messages from them.
// - Admin → Disputes → a dispute: when the two sides called or sent voice
//   messages (times and lengths only; nothing is recorded or played).
(function () {
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Voice message': 'Mensaje de voz', 'Record a voice message': 'Grabar un mensaje de voz', 'Leave a voice message': 'Dejar un mensaje de voz',
      'Recording…': 'Grabando…', 'Tap to start recording': 'Toca para empezar a grabar', 'Stop': 'Detener', 'Send': 'Enviar', 'Discard': 'Descartar', 'Record again': 'Grabar de nuevo',
      'Voice message sent': 'Mensaje de voz enviado', 'Up to 2 minutes': 'Hasta 2 minutos', 'Close': 'Cerrar', 'Block': 'Bloquear', 'Unblock': 'Desbloquear',
      'Calls & Voice Messages': 'Llamadas y mensajes de voz', 'Take calls on Trothen': 'Recibir llamadas en Trothen', 'Take voice messages': 'Recibir mensajes de voz',
      'Only take calls at set times': 'Recibir llamadas solo en horario', 'From': 'Desde', 'To': 'Hasta', 'Save': 'Guardar', 'Saved': 'Guardado',
      'People you blocked': 'Personas bloqueadas', 'Nobody. Block someone from the top of your chat with them.': 'Nadie. Bloquea a alguien desde la parte superior de tu chat con esa persona.',
      'This voice message was deleted.': 'Este mensaje de voz fue eliminado.', 'Delete': 'Eliminar', 'Could not play this voice message.': 'No se pudo reproducir este mensaje de voz.',
      'Allow the microphone to record a voice message. Check the permission in your browser settings, then try again.': 'Permite el micrófono para grabar un mensaje de voz. Revisa el permiso en la configuración del navegador e inténtalo de nuevo.',
      'This browser cannot record voice messages.': 'Este navegador no puede grabar mensajes de voz.',
    });
  } catch (x) {}
  const I = {
    mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    block: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  };
  const svg = (k, size, color, fill) => `<svg width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" fill="${fill || 'none'}" stroke="${color || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
  const mmss = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const isUser = () => !!(typeof AUTH !== 'undefined' && AUTH && AUTH.user && ['customer', 'provider'].includes(AUTH.user.role));

  // ── blocked people ──────────────────────────────────────────────────
  window.CALL_BLOCKED = window.CALL_BLOCKED || new Set();
  let settingsCache = null;
  async function loadSettings() {
    if (!isUser()) return null;
    try { settingsCache = await apiFetch('GET', '/calls/settings'); window.CALL_BLOCKED = new Set((settingsCache.blocked || []).map(b => b.userId)); } catch (x) {}
    return settingsCache;
  }
  window.callMenuHTML = function (userId, name) {
    const isBlocked = window.CALL_BLOCKED.has(userId);
    return `<button type="button" class="btn-sm btn-sm-ghost call-block-btn" data-uid="${e(userId)}" data-name="${e(name || '')}" onclick="toggleCallBlock(this.dataset.uid, this.dataset.name)" title="${e(t(isBlocked ? 'Unblock' : 'Block'))}: ${e(t('Calls & Voice Messages'))}" style="color:${isBlocked ? '#dc2626' : 'var(--slate)'};">${svg('block', 15)} ${e(t(isBlocked ? 'Unblock' : 'Block'))}</button>`;
  };
  window.toggleCallBlock = async function (userId, name) {
    const isBlocked = window.CALL_BLOCKED.has(userId);
    const first = String(name || '').split(' ')[0] || 'them';
    const ok = await confirmDialog(isBlocked
      ? `Unblock ${first}? They will be able to call you and send voice messages again.`
      : `Block ${first}? They won't be able to call you or send you voice messages. Text messages still work, so any booking can be finished, and they aren't told you blocked them.`,
      { confirmLabel: isBlocked ? t('Unblock') : t('Block') });
    if (!ok) return;
    try {
      if (isBlocked) { await apiFetch('DELETE', `/calls/block/${encodeURIComponent(userId)}`); window.CALL_BLOCKED.delete(userId); }
      else { await apiFetch('POST', '/calls/block', { userId }); window.CALL_BLOCKED.add(userId); }
      showToast(isBlocked ? `${first} is unblocked.` : `${first} is blocked from calling you and sending voice messages.`);
      document.querySelectorAll(`.call-block-btn[data-uid="${CSS.escape(userId)}"]`).forEach(b => { b.outerHTML = callMenuHTML(userId, name); });
      if (document.getElementById('call-settings-panel')) drawSettingsPanel();
    } catch (x) { showToast(x.message || 'Could not save'); }
  };

  // ── recording ───────────────────────────────────────────────────────
  const MAX_SECONDS = 120;
  const R = { stream: null, rec: null, chunks: [], startedAt: 0, timer: null, blob: null, seconds: 0, mime: '', url: null, to: null, name: '', callId: null };
  function pickMime() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const m of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (x) {} }
    return '';
  }
  function overlay(html) {
    let o = document.getElementById('voice-recorder');
    if (!o) { o = document.createElement('div'); o.id = 'voice-recorder'; document.body.appendChild(o); }
    o.style.cssText = 'position:fixed;inset:0;z-index:6100;background:rgba(15,38,64,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px;';
    o.innerHTML = `<div role="dialog" aria-label="${e(t('Voice message'))}" style="background:#fff;border-radius:16px;width:100%;max-width:420px;padding:20px 18px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25);text-align:center;margin-bottom:max(16px, env(safe-area-inset-bottom));">${html}</div>`;
    return o;
  }
  function closeRecorder() {
    try { if (R.rec && R.rec.state !== 'inactive') R.rec.stop(); } catch (x) {}
    try { R.stream && R.stream.getTracks().forEach(tr => tr.stop()); } catch (x) {}
    if (R.timer) clearInterval(R.timer);
    if (R.url) { try { URL.revokeObjectURL(R.url); } catch (x) {} }
    Object.assign(R, { stream: null, rec: null, chunks: [], startedAt: 0, timer: null, blob: null, seconds: 0, url: null });
    const o = document.getElementById('voice-recorder'); if (o) o.remove();
  }
  window.closeVoiceRecorder = closeRecorder;
  const head = () => `<div style="font-weight:700;color:var(--navy);font-size:16px;">${e(t('Voice message'))}${R.name ? ` · ${e(R.name)}` : ''}</div><div style="font-size:12.5px;color:var(--slate);margin-top:2px;">${e(t('Up to 2 minutes'))}</div>`;
  const bigBtn = (id, icon, bg, label) => `<button type="button" id="${id}" aria-label="${e(label)}" style="width:72px;height:72px;border-radius:50%;border:0;background:${bg};color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.18);">${svg(icon, 30, '#fff', icon === 'stop' || icon === 'play' ? '#fff' : 'none')}</button>`;
  function drawReady(note) {
    overlay(`${head()}
      <div style="margin:22px 0 10px;">${bigBtn('vr-start', 'mic', '#dc2626', t('Tap to start recording'))}</div>
      <div style="font-size:13.5px;color:var(--slate);">${e(note || t('Tap to start recording'))}</div>
      <div style="margin-top:16px;"><button type="button" class="btn-sm btn-sm-ghost" id="vr-close">${e(t('Close'))}</button></div>`);
    document.getElementById('vr-start').onclick = startRecording;
    document.getElementById('vr-close').onclick = closeRecorder;
  }
  window.openVoiceRecorder = function (userId, name, callId) {
    if (!userId) return;
    closeRecorder();
    R.to = userId; R.name = name || ''; R.callId = callId || null;
    if (pickMime() === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return showToast(t('This browser cannot record voice messages.'));
    drawReady();
  };
  async function startRecording() {
    try { R.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (x) { return drawReady(t('Allow the microphone to record a voice message. Check the permission in your browser settings, then try again.')); }
    const mime = pickMime();
    try { R.rec = new MediaRecorder(R.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 }); }
    catch (x) { R.rec = new MediaRecorder(R.stream); }
    R.mime = (R.rec.mimeType || mime || 'audio/webm');
    R.chunks = [];
    R.rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) R.chunks.push(ev.data); };
    R.rec.onstop = () => {
      R.seconds = Math.min(MAX_SECONDS, (Date.now() - R.startedAt) / 1000);
      R.blob = new Blob(R.chunks, { type: R.mime.split(';')[0] });
      try { R.stream.getTracks().forEach(tr => tr.stop()); } catch (x) {}
      if (R.timer) clearInterval(R.timer);
      if (document.getElementById('voice-recorder')) drawReview();
    };
    R.rec.start(250);
    R.startedAt = Date.now();
    overlay(`${head()}
      <div style="margin:18px 0 6px;display:flex;align-items:center;justify-content:center;gap:10px;"><span style="width:10px;height:10px;border-radius:50%;background:#dc2626;animation:vrpulse 1s infinite;"></span><span id="vr-time" style="font-size:26px;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;">0:00</span></div>
      <div style="height:6px;background:#eef2f7;border-radius:4px;overflow:hidden;margin:0 10px 16px;"><div id="vr-bar" style="height:100%;width:0;background:#dc2626;transition:width .25s linear;"></div></div>
      ${bigBtn('vr-stop', 'stop', 'var(--navy,#0F2640)', t('Stop'))}
      <div style="font-size:13.5px;color:var(--slate);margin-top:8px;">${e(t('Recording…'))}</div>
      <style>@keyframes vrpulse{50%{opacity:.25}}</style>`);
    document.getElementById('vr-stop').onclick = () => { try { R.rec.stop(); } catch (x) {} };
    R.timer = setInterval(() => {
      const s = (Date.now() - R.startedAt) / 1000;
      const tm = document.getElementById('vr-time'); if (tm) tm.textContent = mmss(s);
      const bar = document.getElementById('vr-bar'); if (bar) bar.style.width = Math.min(100, s / MAX_SECONDS * 100) + '%';
      if (s >= MAX_SECONDS) { try { R.rec.stop(); } catch (x) {} }
    }, 250);
  }
  function drawReview() {
    if (R.url) { try { URL.revokeObjectURL(R.url); } catch (x) {} }
    R.url = URL.createObjectURL(R.blob);
    overlay(`${head()}
      <div style="margin:18px 0 14px;"><audio id="vr-preview" controls src="${R.url}" style="width:100%;"></audio></div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:14px;">${mmss(R.seconds)}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button type="button" class="btn-sm btn-sm-ghost" id="vr-discard">${e(t('Discard'))}</button>
        <button type="button" class="btn-sm btn-sm-outline" id="vr-again">${e(t('Record again'))}</button>
        <button type="button" class="btn-sm btn-sm-primary" id="vr-send" style="min-width:110px;">${e(t('Send'))}</button>
      </div>`);
    document.getElementById('vr-discard').onclick = closeRecorder;
    document.getElementById('vr-again').onclick = () => { const to = R.to, n = R.name, c = R.callId; closeRecorder(); R.to = to; R.name = n; R.callId = c; drawReady(); startRecording(); };
    document.getElementById('vr-send').onclick = sendRecording;
  }
  async function sendRecording() {
    const btn = document.getElementById('vr-send'); if (btn) { btn.disabled = true; btn.textContent = '…'; }
    const ext = /mp4|aac/.test(R.mime) ? 'm4a' : /ogg/.test(R.mime) ? 'ogg' : 'webm';
    const fd = new FormData();
    fd.append('toUserId', R.to);
    fd.append('seconds', String(Math.max(1, Math.round(R.seconds))));
    if (R.callId) fd.append('callId', R.callId);
    fd.append('audio', R.blob, `voice.${ext}`);
    try {
      const res = await fetch(API_BASE + '/voice-messages', { method: 'POST', headers: { Authorization: 'Bearer ' + AUTH.token }, body: fd });
      let data = null; try { data = await res.json(); } catch (x) {}
      if (!res.ok) throw new Error((data && data.error) || 'Could not send the voice message');
      const to = R.to;
      closeRecorder();
      showToast(t('Voice message sent'));
      if (window.CHATS && CHATS.activeId === to && typeof loadMessageThread === 'function') loadMessageThread();
    } catch (x) {
      showToast(x.message);
      if (btn) { btn.disabled = false; btn.textContent = t('Send'); }
    }
  }

  // The microphone next to Send.
  window.voiceButtonHTML = function () {
    return `<button type="button" id="msg-mic" class="msg-mic" onclick="voiceFromChat()" title="${e(t('Record a voice message'))}" aria-label="${e(t('Record a voice message'))}" style="background:#fff;color:var(--navy);border:1.5px solid var(--border);padding:10px 12px;display:inline-flex;align-items:center;">${svg('mic', 18)}</button>`;
  };
  window.voiceFromChat = function () {
    const id = window.CHATS && CHATS.activeId;
    if (!id) return showToast('Pick a conversation first.');
    const c = (CHATS.list || []).find(x => x.userId === id);
    if (c && c.closed) return showToast('This account is closed.');
    openVoiceRecorder(id, c ? c.name : '');
  };

  // ── playing voice messages in the chat ──────────────────────────────
  // One player for the whole page, outside the chat, so a live refresh of
  // the chat doesn't cut off a message that's playing.
  const P = { audio: null, id: null, urls: new Map() };
  window.voiceBubbleHTML = function (m, mine) {
    const v = m.voice || {};
    if (v.deletedAt) return `<span style="font-style:italic;opacity:.8;">${e(t('This voice message was deleted.'))}</span>`;
    const playing = P.id === m.id && P.audio && !P.audio.paused;
    const fg = mine ? '#fff' : 'var(--navy,#0F2640)';
    return `<div class="voice-msg" data-id="${e(m.id)}" data-seconds="${Number(v.seconds) || 0}" style="display:flex;align-items:center;gap:10px;min-width:200px;">
      <button type="button" class="voice-play" onclick="playVoiceMessage(this.closest('.voice-msg').dataset.id)" aria-label="${e(t('Voice message'))}" style="flex-shrink:0;width:36px;height:36px;border-radius:50%;border:0;background:${mine ? 'rgba(255,255,255,.22)' : 'var(--navy,#0F2640)'};color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">${svg(playing ? 'pause' : 'play', 16, '#fff', '#fff')}</button>
      <div style="flex:1;min-width:0;">
        <div style="height:4px;border-radius:3px;background:${mine ? 'rgba(255,255,255,.3)' : '#dbe3ee'};overflow:hidden;"><div class="voice-progress" style="height:100%;width:0;background:${mine ? '#fff' : 'var(--navy,#0F2640)'};"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;color:${fg};opacity:.85;"><span>${svg('mic', 12, fg)} ${e(t('Voice message'))}</span><span class="voice-time">${mmss(v.seconds)}</span></div>
      </div>
      ${mine ? `<button type="button" onclick="deleteVoiceMessage(this.closest('.voice-msg').dataset.id)" title="${e(t('Delete'))}" style="background:none;border:0;color:${fg};opacity:.7;cursor:pointer;font-size:16px;padding:0 2px;">×</button>` : ''}
    </div>`;
  };
  function paintPlayer() {
    document.querySelectorAll('.voice-msg').forEach(box => {
      const id = box.dataset.id, secs = Number(box.dataset.seconds) || 0;
      const active = P.id === id && P.audio;
      const btn = box.querySelector('.voice-play');
      if (btn) btn.innerHTML = svg(active && !P.audio.paused ? 'pause' : 'play', 16, '#fff', '#fff');
      const bar = box.querySelector('.voice-progress');
      const dur = active && isFinite(P.audio.duration) && P.audio.duration > 0 ? P.audio.duration : secs;
      if (bar) bar.style.width = active && dur ? Math.min(100, P.audio.currentTime / dur * 100) + '%' : '0';
      const tm = box.querySelector('.voice-time'); if (tm) tm.textContent = active && P.audio.currentTime > 0 ? mmss(P.audio.currentTime) : mmss(secs);
    });
  }
  window.playVoiceMessage = async function (id) {
    if (P.audio && P.id === id) { if (P.audio.paused) P.audio.play().catch(() => {}); else P.audio.pause(); paintPlayer(); return; }
    if (P.audio) { P.audio.pause(); }
    let url = P.urls.get(id);
    if (!url) {
      try {
        const res = await fetch(`${API_BASE}/voice-messages/${encodeURIComponent(id)}/audio`, { headers: { Authorization: 'Bearer ' + AUTH.token } });
        if (!res.ok) { let d = null; try { d = await res.json(); } catch (x) {} throw new Error((d && d.error) || t('Could not play this voice message.')); }
        url = URL.createObjectURL(await res.blob()); P.urls.set(id, url);
      } catch (x) { return showToast(x.message); }
    }
    P.audio = P.audio || new Audio();
    P.id = id; P.audio.src = url;
    P.audio.ontimeupdate = paintPlayer; P.audio.onpause = paintPlayer; P.audio.onplay = paintPlayer;
    P.audio.onended = () => { const done = P.id; P.id = null; paintPlayer(); window.__lastPlayedVoice = done; };
    try { await P.audio.play(); } catch (x) { showToast(t('Could not play this voice message.')); }
    paintPlayer();
  };
  window.deleteVoiceMessage = async function (id) {
    if (!(await confirmDialog('Delete this voice message? It is removed for both of you.', { confirmLabel: t('Delete') }))) return;
    try { await apiFetch('DELETE', `/voice-messages/${encodeURIComponent(id)}`); if (P.id === id && P.audio) { P.audio.pause(); P.id = null; } if (typeof loadMessageThread === 'function') loadMessageThread(); }
    catch (x) { showToast(x.message || 'Could not delete'); }
  };

  // ── Settings → Calls & Voice Messages ───────────────────────────────
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function myTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (x) { return null; } }
  async function drawSettingsPanel() {
    const panel = document.getElementById('call-settings-panel'); if (!panel) return;
    const data = await loadSettings(); if (!data) return;
    const s = data.settings, h = s.hours || {};
    panel.innerHTML = `<div class="panel-title" style="font-weight:700;color:var(--navy);font-size:17px;margin-bottom:4px;">${e(t('Calls & Voice Messages'))}</div>
      <div style="font-size:13.5px;color:var(--slate);margin-bottom:12px;">Customers and pros you have a booking or job with can call you inside Trothen. Your phone number is never shared, and calls are never recorded.</div>
      <label style="display:flex;gap:10px;align-items:center;margin:8px 0;font-size:14.5px;"><input type="checkbox" id="cs-calls" ${s.calls ? 'checked' : ''}> ${e(t('Take calls on Trothen'))}</label>
      <label style="display:flex;gap:10px;align-items:center;margin:8px 0;font-size:14.5px;"><input type="checkbox" id="cs-voice" ${s.voice ? 'checked' : ''}> ${e(t('Take voice messages'))}</label>
      <label style="display:flex;gap:10px;align-items:center;margin:14px 0 6px;font-size:14.5px;"><input type="checkbox" id="cs-hours-on" ${h.on ? 'checked' : ''}> ${e(t('Only take calls at set times'))}</label>
      <div id="cs-hours" style="display:${h.on ? 'block' : 'none'};padding:10px 12px;background:var(--offwhite,#f6f8fb);border-radius:10px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <label style="font-size:13.5px;">${e(t('From'))} <input type="time" id="cs-from" class="form-input" value="${e(h.from || '08:00')}" style="width:auto;display:inline-block;padding:6px 8px;"></label>
          <label style="font-size:13.5px;">${e(t('To'))} <input type="time" id="cs-to" class="form-input" value="${e(h.to || '20:00')}" style="width:auto;display:inline-block;padding:6px 8px;"></label>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">${DAYS.map((d, i) => `<label style="display:inline-flex;gap:4px;align-items:center;font-size:13.5px;border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:#fff;"><input type="checkbox" class="cs-day" value="${i}" ${(h.days || []).includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div>
        <div style="font-size:12.5px;color:var(--slate);margin-top:8px;">Your time zone: ${e(myTz() || 'not known')}. Outside these times, people can leave you a voice message.</div>
      </div>
      <div style="margin-top:12px;"><button type="button" class="btn-sm btn-sm-primary" id="cs-save">${e(t('Save'))}</button></div>
      <div style="font-weight:600;color:var(--navy);margin:18px 0 6px;">${e(t('People you blocked'))}</div>
      ${(data.blocked || []).length ? data.blocked.map(b => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--border);font-size:14px;"><span>${e(b.name)}</span><button type="button" class="btn-sm btn-sm-outline" data-uid="${e(b.userId)}" data-name="${e(b.name)}" onclick="toggleCallBlock(this.dataset.uid, this.dataset.name)">${e(t('Unblock'))}</button></div>`).join('') : `<div style="font-size:13.5px;color:var(--slate);">${e(t('Nobody. Block someone from the top of your chat with them.'))}</div>`}`;
    document.getElementById('cs-hours-on').onchange = (ev) => { document.getElementById('cs-hours').style.display = ev.target.checked ? 'block' : 'none'; };
    document.getElementById('cs-save').onclick = async () => {
      const body = {
        calls: document.getElementById('cs-calls').checked,
        voice: document.getElementById('cs-voice').checked,
        tz: myTz(),
        hours: { on: document.getElementById('cs-hours-on').checked, from: document.getElementById('cs-from').value || '08:00', to: document.getElementById('cs-to').value || '20:00', days: [...document.querySelectorAll('.cs-day:checked')].map(x => Number(x.value)) },
      };
      try { await apiFetch('PUT', '/calls/settings', body); showToast(t('Saved')); } catch (x) { showToast(x.message || 'Could not save'); }
    };
  }
  window.drawCallSettingsPanel = drawSettingsPanel;
  function addSettingsPanel(mainId) {
    const main = document.getElementById(mainId); if (!main || document.getElementById('call-settings-panel')) return;
    const box = document.createElement('div');
    box.id = 'call-settings-panel'; box.className = 'panel'; box.style.marginTop = '16px';
    main.appendChild(box);
    drawSettingsPanel();
  }
  for (const [fn, mainId] of [['selectCustomerSection', 'customer-main'], ['selectProviderSection', 'provider-main']]) {
    if (typeof window[fn] !== 'function') continue;
    const base = window[fn];
    window[fn] = function (key) { const r = base.apply(this, arguments); if (key === 'settings') setTimeout(() => addSettingsPanel(mainId), 0); return r; };
  }

  // ── Admin → a dispute: calls and voice messages between the two sides ─
  if (typeof viewDispute === 'function') {
    const base = viewDispute;
    viewDispute = async function (id) {
      const r = await base.apply(this, arguments);
      try {
        const data = await apiFetch('GET', `/admin/disputes/${encodeURIComponent(id)}/calls`);
        const body = document.getElementById('dispute-modal-body'); if (!body) return r;
        const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        const rows = [
          ...data.calls.map(c => ({ at: c.at, html: `<strong style="color:var(--navy);">${c.video ? 'Video call' : 'Voice call'}</strong> ${e(c.from)} → ${e(c.to)}: ${c.answered ? `answered, ${mmss(c.seconds)}${c.droppedByNetwork ? ' (dropped: connection)' : ''}` : c.status === 'declined' ? 'declined' : c.status === 'ringing' || c.status === 'active' ? 'in progress' : 'not answered'}` })),
          ...data.voiceMessages.map(v => ({ at: v.at, html: `<strong style="color:var(--navy);">Voice message</strong> ${e(v.from)} → ${e(v.to)}: ${mmss(v.seconds)}${v.deleted ? ', deleted by sender' : v.played ? ', played' : ', not played yet'}` })),
        ].sort((a, b) => new Date(a.at) - new Date(b.at));
        body.insertAdjacentHTML('beforeend', `<div class="form-label" style="margin:14px 0 8px;">Calls and voice messages between them</div>
          <div id="dispute-calls" style="font-size:13px;color:var(--slate);line-height:1.8;max-height:180px;overflow-y:auto;border-top:1px solid var(--border);padding-top:8px;">
          ${rows.length ? rows.map(x => `<div>${x.html} <span style="opacity:.6;">(${e(when(x.at))})</span></div>`).join('') : 'None. They have not called each other or sent voice messages on Trothen.'}
          <div style="font-size:12px;color:var(--muted);margin-top:6px;">Times and lengths only. Calls are never recorded, and voice messages stay private to the two people.</div></div>`);
      } catch (x) { /* not permitted, or none */ }
      return r;
    };
  }

  // Load the blocked list once signed in, so chat headers show Block/Unblock correctly.
  let tries = 0;
  const boot = setInterval(() => { tries++; if (isUser()) { clearInterval(boot); loadSettings(); } else if (tries > 120) clearInterval(boot); }, 1000);
})();
