/* Live updates (v123). Loaded last.

   The page keeps one connection open to the server (src/live.js). When
   something changes for the signed-in person (a pro accepts, a price is
   suggested, a payment is confirmed, a message or job response arrives),
   the server sends a tiny "this changed" note. This file then reloads just
   that data and redraws the screen that's open, in place, keeping your
   scroll position. Nobody has to press refresh.

   It never redraws under someone who is typing: it waits until they click
   away. Text typed in an open "Responses to Your Job" window is kept.

   If the live connection can't be opened or drops (a weak phone signal,
   for example), the page checks for changes every 20 seconds until it's
   back, and catches up straight away when you come back to the tab. */
(function () {
  'use strict';
  if (typeof EventSource === 'undefined') return; // very old browsers: the 5-second bell check still runs
  const LV = { es: null, cust: 'overview', prov: 'overview', admin: null, wanted: false, failures: 0, fallback: null, pend: new Set(), timer: null, busy: false, again: false, everConnected: false };
  const el = (id) => document.getElementById(id);
  const role = () => AUTH.user && AUTH.user.role;
  const visible = (id) => { const s = el(id); return !!(s && s.classList.contains('active') || (s && getComputedStyle(s).display !== 'none')); };

  // Remember which screen is open, so it's the one redrawn.
  if (typeof selectCustomerSection === 'function') { const f = selectCustomerSection; selectCustomerSection = function (key) { LV.cust = key; return f.apply(this, arguments); }; }
  if (typeof selectProviderSection === 'function') { const f = selectProviderSection; selectProviderSection = function (key) { LV.prov = key; return f.apply(this, arguments); }; }
  if (typeof selectAdminSection === 'function') { const f = selectAdminSection; selectAdminSection = function (key) { LV.admin = key; return f.apply(this, arguments); }; }

  // ── the connection ────────────────────────────────────────────────────
  async function connect() {
    if (!LV.wanted || LV.es || !BACKEND_AVAILABLE || !AUTH.token) return;
    let ticket;
    try { ticket = (await apiFetch('POST', '/live/ticket')).ticket; }
    catch (x) { return retryLater(); }
    if (!LV.wanted || LV.es) return;
    const es = new EventSource(`${API_BASE}/live/stream?ticket=${encodeURIComponent(ticket)}`);
    LV.es = es;
    es.addEventListener('hello', () => {
      const reconnect = LV.everConnected || LV.failures > 0;
      LV.everConnected = true; LV.failures = 0; stopFallback();
      if (reconnect) { LV.pend.add('all'); schedule(); } // things may have changed while the connection was down
    });
    es.addEventListener('change', (ev) => {
      try { (JSON.parse(ev.data).sections || []).forEach(s => LV.pend.add(s)); } catch (x) { LV.pend.add('all'); }
      schedule();
    });
    es.onerror = () => {
      // A ticket only works once, so a fresh connection needs a fresh ticket:
      // close this one and open a new one after a short wait.
      try { es.close(); } catch (x) {}
      if (LV.es === es) LV.es = null;
      retryLater();
    };
  }
  function retryLater() {
    if (!LV.wanted) return;
    LV.failures++;
    startFallback();
    setTimeout(connect, Math.min(30000, 2000 * LV.failures));
  }
  function disconnect() {
    LV.wanted = false; LV.everConnected = false; LV.failures = 0;
    if (LV.es) { try { LV.es.close(); } catch (x) {} LV.es = null; }
    stopFallback();
  }
  function startFallback() {
    if (LV.fallback) return;
    LV.fallback = setInterval(() => { if (!document.hidden && LV.wanted) { LV.pend.add('all'); schedule(); } }, 20000);
  }
  function stopFallback() { if (LV.fallback) clearInterval(LV.fallback); LV.fallback = null; }

  // Start with the bell check (after sign-in), stop with it (sign-out).
  if (typeof startMessagePolling === 'function') { const f = startMessagePolling; startMessagePolling = async function () { const r = await f.apply(this, arguments); LV.wanted = true; connect(); return r; }; }
  if (typeof stopMessagePolling === 'function') { const f = stopMessagePolling; stopMessagePolling = function () { disconnect(); return f.apply(this, arguments); }; }

  // Coming back to the tab or phone screen: catch up at once.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !LV.wanted) return;
    if (!LV.es) connect();
    LV.pend.add('all'); schedule();
  });
  window.addEventListener('online', () => { if (LV.wanted) { if (!LV.es) connect(); LV.pend.add('all'); schedule(); } });

  // ── redrawing ─────────────────────────────────────────────────────────
  function schedule() { clearTimeout(LV.timer); LV.timer = setTimeout(run, 150); }

  // Someone typing in the page (not in a pop-up window): wait for them.
  // v125: only when something has actually been typed. A cursor sitting in an
  // empty box (as in the "Message JAMES" box) no longer holds updates back.
  // Pop-up windows like "Responses to Your Job" are never held back: what's
  // typed there is kept while they redraw.
  function typingInPage() {
    const a = document.activeElement;
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    if (a.tagName !== 'SELECT' && !String(a.value || '').trim()) return false;
    return !!a.closest('#customer-main, #provider-main, #admin-main');
  }

  async function run() {
    if (LV.busy) { LV.again = true; return; }
    if (!LV.pend.size || !AUTH.token) return;
    if (typingInPage()) {
      document.activeElement.addEventListener('blur', () => setTimeout(schedule, 50), { once: true });
      return;
    }
    const sections = new Set(LV.pend); LV.pend.clear();
    const all = sections.has('all');
    const dataChanged = all || [...sections].some(s => s !== 'notifications');
    LV.busy = true;
    try {
      if (all || sections.has('notifications')) await bellNow();
      if (dataChanged) await redraw();
    } catch (x) { /* the next change or check tries again */ }
    LV.busy = false;
    if (LV.again) { LV.again = false; schedule(); }
  }

  // The bell: same as the 5-second check, just right away.
  async function bellNow() {
    const { notifications } = await apiFetch('GET', '/notifications/mine');
    const seen = typeof seenNotificationIds !== 'undefined' && seenNotificationIds ? seenNotificationIds : new Set();
    const newOnes = notifications.filter(n => !seen.has(n.id));
    try { seenNotificationIds = new Set(notifications.map(n => n.id)); } catch (x) {}
    if (!newOnes.length) return;
    CURRENT_NOTIFICATIONS = notifications;
    const soundOn = AUTH.user && AUTH.user.notifPrefs && AUTH.user.notifPrefs.messageSound;
    if (soundOn && newOnes.some(n => n.linkTo && ['messages', 'bookings', 'matches'].includes(n.linkTo.section))) {
      try { playMessageSound(); } catch (x) {}
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    document.querySelectorAll('.notif-bell').forEach(bell => { if (!bell.querySelector('.notif-dot')) bell.insertAdjacentHTML('beforeend', '<span class="notif-dot"></span>'); });
    document.querySelectorAll('.notif-panel.open').forEach(p => { p.innerHTML = notifPanelInnerHTML(); });
  }

  async function redraw() {
    const y = window.scrollY;
    const r = role();
    if (r === 'customer' && visible('screen-customer')) {
      await loadCustomerData();
      if (!typingInPage()) selectCustomerSection(LV.cust || 'overview');
    } else if (r === 'provider' && visible('screen-provider')) {
      await loadProviderData();
      if (!typingInPage()) selectProviderSection(LV.prov || 'overview');
    } else if (r === 'admin' && visible('screen-admin') && LV.admin === 'custpay') {
      selectAdminSection('custpay');
    }
    window.scrollTo(0, y);
    if (typeof ridesRefresh === 'function' && document.getElementById('rides-body')) { try { ridesRefresh(); } catch (x) {} } // v125: the Rides page
    await redrawOpenWindows();
  }

  // Windows that show live data on top of the page.
  async function redrawOpenWindows() {
    // The customer's "Responses to Your Job": new responses, prices and messages.
    const modal = el('job-candidates-modal');
    if (modal && modal.classList.contains('open') && typeof CURRENT_JOB_CANDIDATES_JOBID !== 'undefined' && CURRENT_JOB_CANDIDATES_JOBID) {
      const keep = {};
      modal.querySelectorAll('input').forEach(i => { if (i.id && i.value && !/^job-hire-amount-/.test(i.id)) keep[i.id] = i.value; });
      // A hire amount the customer typed themselves is kept; one filled in from the pro's price follows the new price.
      modal.querySelectorAll('input[id^="job-hire-amount-"]').forEach(i => { if (i.dataset.touched) keep[i.id] = i.value; });
      const focused = document.activeElement && modal.contains(document.activeElement) ? document.activeElement.id : null;
      const data = await apiFetch('GET', `/jobs/${CURRENT_JOB_CANDIDATES_JOBID}/candidates`);
      renderJobCandidates(data);
      for (const [id, v] of Object.entries(keep)) { const i = el(id); if (i) { i.value = v; if (/^job-hire-amount-/.test(id)) { i.dataset.touched = '1'; i.dispatchEvent(new Event('input')); } } }
      if (focused && el(focused)) { const f = el(focused); f.focus(); try { const n = String(f.value || '').length; f.setSelectionRange(n, n); } catch (x) {} }
      const chat = modal.querySelectorAll('.cand-chat'); chat.forEach(cd => { cd.scrollTop = cd.scrollHeight; }); // newest message in view
      markHireTouched();
    }
    // The pro's job chat with a customer.
    if (typeof CURRENT_JOB_NEGOTIATION !== 'undefined' && CURRENT_JOB_NEGOTIATION && typeof loadJobNegotiationThread === 'function') {
      try { await loadJobNegotiationThread(); } catch (x) {}
      try { if (typeof drawProPriceBox === 'function' && typeof providerData === 'object') drawProPriceBox((providerData.matches || []).find(m => m.jobId === CURRENT_JOB_NEGOTIATION.jobId)); } catch (x) {}
    }
  }
  function markHireTouched() {
    document.querySelectorAll('input[id^="job-hire-amount-"]').forEach(i => { if (!i.dataset.watch) { i.dataset.watch = '1'; i.addEventListener('keydown', () => { i.dataset.touched = '1'; }); } });
  }
  if (typeof renderJobCandidates === 'function') { const f = renderJobCandidates; renderJobCandidates = function () { const r = f.apply(this, arguments); setTimeout(markHireTouched, 0); return r; }; }

  // For checking from the browser console: liveStatus()
  window.liveStatus = () => ({ connected: !!(LV.es && LV.es.readyState === 1), checkingEvery20s: !!LV.fallback, screen: role() === 'customer' ? LV.cust : role() === 'provider' ? LV.prov : LV.admin });
})();
