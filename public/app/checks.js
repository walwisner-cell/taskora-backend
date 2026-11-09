// v148: checks before things go wrong.
//
//  1. Admin → System Check (super admins): what is wrong in the running
//     system right now, the likely cause, and what to do. It runs by itself
//     every 15 minutes and alerts the super admins (and finance, for money)
//     when something turns into a problem. "Copy report" gives a text to
//     send to the developer.
//  2. "Get ready" for customers, pros, sellers and drivers: on the Overview,
//     what is missing on their account and where to fix it. Before going
//     online, accepting a job or asking for a payout, the same checks run
//     first, and a clear window says what to fix instead of failing halfway.
//     The phone's location and notifications are checked too before a driver
//     goes online.
(function () {
  'use strict';
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const el = (id) => document.getElementById(id);
  if (!el('chk-css')) { const st = document.createElement('style'); st.id = 'chk-css'; st.textContent = '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}' +
      '.rd-spot{outline:3px solid #E0A526 !important;outline-offset:4px;border-radius:10px;animation:rdPulse 1s ease-in-out 3;}@keyframes rdPulse{50%{outline-color:rgba(224,165,38,.25);}}' +
      '.rd-chip{display:inline-block;font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 8px;margin-left:8px;vertical-align:2px;}' +
      '.rd-row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--border);}.rd-row .rd-act{flex-shrink:0;}' +
      '@media (max-width:560px){.rd-row{flex-wrap:wrap;}.rd-row .rd-act{width:100%;margin-left:24px;}}'; document.head.appendChild(st); }
  const isSuper = () => !!(AUTH && AUTH.user && AUTH.user.role === 'admin' && AUTH.user.isSuperAdmin);

  // ── 1. Admin → System Check ─────────────────────────────────────────
  if (typeof getAdminNavItems === 'function') {
    const f = getAdminNavItems;
    getAdminNavItems = function () {
      const items = f.apply(this, arguments).slice();
      if (isSuper() && !items.some(i => i.key === 'systemcheck')) items.splice(1, 0, { key: 'systemcheck', label: 'System Check', icon: '🩺' });
      return items;
    };
  }
  if (typeof ADMIN_SECTIONS !== 'undefined') {
    ADMIN_SECTIONS.systemcheck = () => `<div class="dash-header"><div><div class="dash-title">System Check</div><div class="dash-sub">What needs attention right now, the likely cause, and what to do. It checks by itself every 15 minutes and alerts you when something goes wrong.</div></div>
      <div class="row-actions"><button class="btn-sm btn-sm-primary" onclick="sysCheckRun()">Check now</button><button class="btn-sm btn-sm-outline" onclick="sysCheckCopy()">Copy report</button></div></div>
      <div id="sc-body"><div class="panel">Checking…</div></div>`;
  }
  if (typeof selectAdminSection === 'function') {
    const f = selectAdminSection;
    selectAdminSection = function (key) { const r = f.apply(this, arguments); if (key === 'systemcheck') sysDraw(); return r; };
  }
  let LAST = null;
  const COLOR = { problem: '#C0392B', warn: '#E0A526', ok: '#2E8C6F' };
  const dotHTML = (c) => `<span aria-hidden="true" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c};margin-top:5px;flex-shrink:0;"></span>`;
  function sysPaint(d) {
    LAST = d;
    const box = el('sc-body'); if (!box) return;
    const order = { problem: 0, warn: 1, ok: 2 };
    const rows = (d.results || []).slice().sort((a, b) => order[a.status] - order[b.status]);
    box.innerHTML = `<div class="panel" style="border-left:4px solid ${d.problems ? '#C0392B' : d.warnings ? '#E0A526' : '#2E8C6F'};">
        <div style="font-size:17px;font-weight:700;color:var(--navy);">${d.problems ? `${d.problems} problem${d.problems === 1 ? '' : 's'} to fix` : d.warnings ? 'Working, with things to watch' : 'Everything checked is working'}</div>
        <div style="font-size:13px;color:var(--slate);margin-top:4px;">Last checked ${d.lastRun ? e(new Date(d.lastRun).toLocaleString()) : 'just now'} · ${d.problems} problem(s), ${d.warnings} to watch</div></div>
      ${rows.map(r => `<div class="panel sc-row" data-status="${e(r.status)}" style="padding:14px 16px;">
        <div style="display:flex;gap:10px;align-items:flex-start;">${dotHTML(COLOR[r.status])}<span class="sr-only">${r.status === 'problem' ? 'Problem' : r.status === 'warn' ? 'Watch' : 'OK'}</span><div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:var(--navy);">${e(r.label)} <span style="font-weight:500;font-size:12.5px;color:var(--muted);">· ${e(r.area)}</span></div>
          <div style="font-size:14px;margin-top:2px;">${e(r.words)}</div>
          ${r.status !== 'ok' ? `<div style="font-size:13.5px;margin-top:8px;background:var(--offwhite);border-radius:8px;padding:8px 10px;"><div><strong>Likely cause:</strong> ${e(r.cause)}</div><div style="margin-top:4px;"><strong>What to do:</strong> ${e(r.fix)}</div></div>` : ''}
        </div></div></div>`).join('')}`;
  }
  async function sysDraw() { try { sysPaint(await apiFetch('GET', '/admin/system-check')); } catch (x) { const b = el('sc-body'); if (b) b.innerHTML = `<div class="panel">${e(x.message || 'Could not load')}</div>`; } }
  window.sysCheckRun = async function () { const b = el('sc-body'); if (b) b.insertAdjacentHTML('afterbegin', '<div class="panel" id="sc-wait">Checking…</div>'); try { sysPaint(await apiFetch('POST', '/admin/system-check/run')); showToast('Checked'); } catch (x) { showToast(x.message); } };
  window.sysCheckCopy = async function () {
    const text = LAST && LAST.text; if (!text) return showToast('Nothing to copy yet');
    try { await navigator.clipboard.writeText(text); showToast('Report copied. Paste it to the developer.'); } catch (x) { const w = window.open('', '_blank'); if (w) { w.document.body.innerText = text; } }
  };

  // ── 2. "Get ready" for everyone ─────────────────────────────────────
  // v150: a fix goes straight to the exact place: opens the section, scrolls to the
  // field or button, highlights it, and puts the cursor in it.
  const goFix = async (fix) => {
    if (!fix) return;
    const box = el('rd-modal'); if (box) box.remove();
    if (fix.action === 'notify') { try { if (typeof notifyAskNow === 'function') await notifyAskNow(); else await Notification.requestPermission(); } catch (x) {} return setTimeout(() => drawCard(AUTH.user.role === 'provider' ? 'provider-main' : 'customer-main'), 400); }
    const role = AUTH.user && AUTH.user.role;
    const mainId = role === 'provider' ? 'provider-main' : 'customer-main';
    if (role === 'provider' && typeof selectProviderSection === 'function') selectProviderSection(fix.section || 'settings');
    else if (typeof goToCustomerDashboard === 'function') await goToCustomerDashboard(fix.section || 'settings');
    if (fix.run && typeof window[fix.run] === 'function') { try { await window[fix.run](); } catch (x) {} }
    const find = () => {
      const main = el(mainId) || document; let t = null;
      if (fix.target && fix.target.startsWith('panel:')) { // a panel by its title; the cursor goes in its first field
        const want = fix.target.slice(6).toLowerCase();
        const panel = [...main.querySelectorAll('.panel')].find(pn => { const h = pn.querySelector('.panel-title'); return h && h.textContent.trim().toLowerCase().startsWith(want); });
        return panel ? (panel.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=file]), select, textarea') || panel) : null;
      }
      if (fix.target) { try { t = main.querySelector(fix.target) || document.querySelector(fix.target); } catch (x) {} }
      return t;
    };
    let target = null;
    for (let i = 0; i < 25 && !(target = find()); i++) await new Promise(r => setTimeout(r, 120));
    if (!target) { const main = el(mainId); target = main && main.querySelector('.panel'); }
    if (!target) return;
    const spot = target.closest('.form-group') || target.closest('.panel') || target;
    spot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    spot.classList.add('rd-spot'); setTimeout(() => spot.classList.remove('rd-spot'), 3200);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) setTimeout(() => { try { target.focus({ preventScroll: true }); } catch (x) {} }, 450);
  };
  window.readyFix = (key) => { const it = (READY.items || []).find(i => i.key === key); goFix(it && it.fix); };
  const READY = { items: [], at: 0 };
  async function load(action) {
    try { const r = await apiFetch('GET', '/me/readiness' + (action ? '?action=' + encodeURIComponent(action) : '')); READY.items = r.items || []; READY.at = Date.now(); return r; } catch (x) { return null; }
  }
  const CHIP = { block: ['Needed', '#C0392B', '#fdecea'], warn: ['Recommended', '#8a5a00', '#fff4dc'] };
  function rowHTML(i) {
    const [word, fg, bg] = CHIP[i.level] || CHIP.warn;
    return `<div class="rd-row">
      ${dotHTML(i.level === 'block' ? '#C0392B' : '#E0A526')}
      <div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--navy);font-size:15px;">${e(t(i.todo || i.label))}<span class="rd-chip" style="color:${fg};background:${bg};">${e(t(word))}</span></div><div style="font-size:13.5px;color:var(--slate);margin-top:3px;line-height:1.5;">${e(t(i.why || ''))}</div></div>
      ${i.fix ? `<button type="button" class="btn-sm rd-act ${i.level === 'block' ? 'btn-sm-primary' : 'btn-sm-outline'}" onclick="readyFix(${jsArg(i.key)})">${e(t(i.fix.label))} →</button>` : ''}</div>`;
  }
  // The phone or computer itself: notifications (for everyone on the Overview).
  function deviceItems() {
    const out = [];
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') out.push({ key: 'dev_notif', ok: false, level: 'warn', todo: 'Turn on notifications', why: Notification.permission === 'denied' ? 'Notifications are blocked for Trothen on this device, so you miss new bookings and messages when the app is closed. Allow them in your browser\'s site settings (the lock icon by the web address).' : 'So you hear about new bookings, messages and payments even when Trothen is closed.', fix: Notification.permission === 'denied' ? null : { label: 'Turn on', action: 'notify' } });
    return out;
  }
  // The "Get ready" card on the Overview
  let SECTION = null; // which section is on screen, so a slow answer never lands on another page
  async function drawCard(mainId) {
    const main = el(mainId); if (!main) return;
    const r = await load(null); if (!r || SECTION !== 'overview') return;
    const all = [...(r.items || []), ...deviceItems()];
    READY.items = all;
    const need = all.filter(i => !i.ok && i.level === 'block'), rec = all.filter(i => !i.ok && i.level !== 'block'), done = all.filter(i => i.ok);
    let card = el('rd-card');
    if (!need.length && !rec.length) { if (card) card.remove(); return; }
    const pct = Math.round(done.length / all.length * 100);
    const open = (() => { try { return localStorage.getItem('rd_done_open') === '1'; } catch (x) { return false; } })();
    const html = `<div class="panel" id="rd-card" style="border-left:4px solid ${need.length ? '#C0392B' : '#E0A526'};">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap;"><div class="panel-title" style="margin:0;">${e(t('Finish setting up your account'))}</div><span style="font-size:13px;color:var(--slate);">${done.length} ${e(t('of'))} ${all.length} ${e(t('done'))}</span></div>
      <div style="font-size:13.5px;color:var(--slate);margin-top:4px;">${need.length ? `${e(t('You have'))} <strong style="color:#C0392B;">${need.length} ${e(t(need.length === 1 ? 'thing you need to do' : 'things you need to do'))}</strong>${rec.length ? ` ${e(t('and'))} ${rec.length} ${e(t(rec.length === 1 ? 'recommended one' : 'recommended ones'))}` : ''}. ${e(t('Each button takes you straight to it.'))}` : `${e(t('Everything needed is done.'))} ${rec.length} ${e(t(rec.length === 1 ? 'more thing will help you' : 'more things will help you'))}.`}</div>
      <div style="height:8px;background:var(--offwhite);border-radius:4px;margin:10px 0 2px;" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="height:8px;width:${pct}%;background:#2E8C6F;border-radius:4px;"></div></div>
      ${need.map(rowHTML).join('')}${rec.map(rowHTML).join('')}
      ${done.length ? `<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:2px;"><button type="button" class="link-btn" style="font-size:13.5px;" onclick="readyToggleDone()">${open ? '▾' : '▸'} ${e(t('Done'))} (${done.length})</button>
        ${open ? `<div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:13.5px;color:var(--slate);">${done.map(i => `<span>✓ ${e(t(i.label))}</span>`).join('')}</div>` : ''}</div>` : ''}
    </div>`;
    if (card) card.outerHTML = html; else main.insertAdjacentHTML('afterbegin', html);
  }
  window.readyToggleDone = () => { try { localStorage.setItem('rd_done_open', localStorage.getItem('rd_done_open') === '1' ? '0' : '1'); } catch (x) {} const role = AUTH.user && AUTH.user.role; drawCard(role === 'provider' ? 'provider-main' : 'customer-main'); };
  if (typeof selectProviderSection === 'function') {
    const f = selectProviderSection;
    selectProviderSection = function (key) { SECTION = key; const r = f.apply(this, arguments); if (key === 'overview') setTimeout(() => drawCard('provider-main'), 50); return r; };
  }
  if (typeof selectCustomerSection === 'function') {
    const f = selectCustomerSection;
    selectCustomerSection = function (key) { SECTION = key; const r = f.apply(this, arguments); if (key === 'overview') setTimeout(() => drawCard('customer-main'), 50); return r; };
  }

  // The phone itself: location and notifications, for drivers and pros on the move.
  async function deviceChecks(action) {
    const out = [];
    if (action !== 'goOnline') return out;
    let geo = 'unknown';
    try { if (navigator.permissions) geo = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (x) {}
    if (!navigator.geolocation) out.push({ key: 'dev_geo', level: 'block', label: 'Location works on this device', todo: 'Use a browser that shares location', why: 'This browser can\'t share your location. Riders can\'t see you coming. Use Chrome or Safari on your phone.' });
    else if (geo === 'denied') out.push({ key: 'dev_geo', level: 'block', label: 'Location is allowed for Trothen', todo: 'Allow location for Trothen', why: window.TrothenMap ? TrothenMap.locationHelp('denied') : 'Location is blocked for this site. Allow it in your browser settings.' });
    let notif = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    if (notif === 'denied') out.push({ key: 'dev_notif', level: 'warn', label: 'Notifications are allowed', todo: 'Allow notifications for Trothen', why: 'Notifications are blocked, so you won\'t hear new ride requests while the app is in the background. Allow notifications for this site in your browser settings.' });
    else if (notif === 'default') out.push({ key: 'dev_notif', level: 'warn', label: 'Notifications are allowed', todo: 'Turn on notifications', why: 'So you hear new ride requests even when Trothen is in the background.', fix: { label: 'Turn on', action: 'notify' } });
    return out;
  }
  // Before an action: check, and show what to fix. Resolves true to go ahead.
  // Things that only slow you down are shown on the Overview; before an action only what stops it
  // (or, before going online, what would make you miss ride requests) interrupts.
  async function preflight(action, label, warnToo) {
    const r = await load(action);
    if (!r) return true; // the check couldn't run: let the server decide
    const dev = await deviceChecks(action);
    const blocking = [...(r.blocking || []), ...dev.filter(d => d.level === 'block')];
    const warnings = warnToo ? [...(r.warnings || []), ...dev.filter(d => d.level === 'warn')] : [];
    if (!blocking.length && !warnings.length) return true;
    READY.items = [...(READY.items || []), ...dev];
    return new Promise((resolve) => {
      const old = el('rd-modal'); if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open" id="rd-modal" role="dialog" aria-modal="true"><div class="modal" style="max-width:520px;">
        <div class="modal-header"><button class="modal-close" id="rd-x" aria-label="${e(t('Close'))}">✕</button><h3>${blocking.length ? e(t('Before you can')) + ' ' + e(t(label)) : e(t('Before you')) + ' ' + e(t(label))}</h3><p>${e(t(blocking.length ? 'Fix these first. Each one says why and where.' : 'You can go ahead, but these will cause problems. Fixing them takes a minute.'))}</p></div>
        <div class="modal-body">${[...blocking, ...warnings].map(rowHTML).join('')}</div>
        <div class="modal-footer"><button class="btn-sm btn-sm-outline" id="rd-cancel">${e(t('Not now'))}</button>${blocking.length ? '' : `<button class="btn-sm btn-sm-primary" id="rd-go">${e(t('Continue anyway'))}</button>`}</div></div></div>`);
      const done = (v) => { const m = el('rd-modal'); if (m) m.remove(); resolve(v); };
      el('rd-x').onclick = () => done(false); el('rd-cancel').onclick = () => done(false);
      if (el('rd-go')) el('rd-go').onclick = () => done(true);
      el('rd-modal').querySelectorAll('button[onclick^="readyFix"]').forEach(b => {
        const key = (b.getAttribute('onclick').match(/readyFix\("([^"]+)"\)/) || [])[1];
        if (key === 'dev_notif') { b.onclick = async () => { try { if (typeof notifyAskNow === 'function') await notifyAskNow(); else await Notification.requestPermission(); } catch (x) {} b.textContent = t('Done'); b.disabled = true; }; }
        else b.addEventListener('click', () => resolve(false));
      });
    });
  }
  window.readyPreflight = preflight;

  // Hook the main actions.
  const hook = (name, action, label, when, warnToo) => {
    const f = window[name]; if (typeof f !== 'function') return;
    window[name] = async function () { if (!when || when.apply(this, arguments)) { if (!(await preflight(action, label, warnToo))) return; } return f.apply(this, arguments); };
  };
  hook('ridesToggleOnline', 'goOnline', 'go online', (on) => on === true, true);
  hook('requestPayout', 'requestPayout', 'ask for a payout');
  hook('respondToOffer', 'acceptJob', 'accept this job', (id, decision) => decision === 'accept');
  if (typeof requestPayout === 'function' && window.requestPayout !== requestPayout) try { requestPayout = window.requestPayout; } catch (x) {}
  if (typeof respondToOffer === 'function' && window.respondToOffer !== respondToOffer) try { respondToOffer = window.respondToOffer; } catch (x) {}
})();
