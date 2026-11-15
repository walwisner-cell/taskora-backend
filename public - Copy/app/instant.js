// v136: make what just happened visible straight away.
//
// - A pop-up in the corner as soon as something arrives for you (a pro's
//   price, a new booking request, an offer, an accepted price, a message),
//   with a button that opens it. Before, only a small red dot appeared on
//   the bell, so a new price or booking was easy to miss.
// - The customer's job card on My Bookings shows how many pros answered and
//   the best price, so it is clear something came in without opening
//   "View Responses".
(function () {
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Open': 'Abrir', 'Close': 'Cerrar', 'Waiting for pros to respond': 'Esperando respuestas de profesionales',
      'pro responded': 'profesional respondió', 'pros responded': 'profesionales respondieron', 'best price': 'mejor precio', 'New': 'Nuevo',
    });
  } catch (x) {}

  const shown = new Set();
  let box = null;
  function container() {
    if (box && document.body.contains(box)) return box;
    box = document.createElement('div');
    box.id = 'live-toasts';
    box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:5600;display:flex;flex-direction:column;gap:10px;max-width:380px;width:calc(100vw - 32px);pointer-events:none;';
    document.body.appendChild(box);
    return box;
  }
  function close(card) { if (!card) return; card.style.opacity = '0'; card.style.transform = 'translateY(8px)'; setTimeout(() => card.remove(), 200); }

  // Called by the bell checks with the notifications that just arrived.
  // v147: when Trothen is in the background (another tab, another app, the
  // screen off), what arrives comes to the front as a phone or computer
  // notification, the way WhatsApp does, and the tab title and app icon
  // show how many are unread. It uses the same tag as the server's push, so
  // nothing shows twice.
  let unseen = 0; const baseTitle = document.title;
  function markUnseen(n) {
    unseen += n;
    try { document.title = unseen ? `(${unseen}) ${baseTitle}` : baseTitle; } catch (x) {}
    try { if (navigator.setAppBadge) (unseen ? navigator.setAppBadge(unseen) : navigator.clearAppBadge()).catch(() => {}); } catch (x) {}
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && unseen) { unseen = 0; markUnseen(0); } });
  async function systemNotify(n) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const opts = { body: String(n.text || ''), icon: '/icon-192.png', badge: '/icon-192.png', tag: `n_${n.id}`, renotify: false, data: { linkTo: n.linkTo || null } };
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg && reg.showNotification) return reg.showNotification('Trothen', opts);
      const note = new Notification('Trothen', opts);
      note.onclick = () => { try { window.focus(); navigateFromNotification(n.linkTo); } catch (x) {} note.close(); };
    } catch (x) { /* notifications blocked here */ }
  }

  window.announceNewNotifications = function (list) {
    if (!Array.isArray(list) || !list.length) return;
    const now = Date.now();
    // Only what is genuinely new: never a backlog after the page was asleep.
    const fresh = list.filter(n => n && n.id && !shown.has(n.id) && (!n.createdAt || now - new Date(n.createdAt).getTime() < 3 * 60 * 1000));
    fresh.forEach(n => shown.add(n.id));
    if (!fresh.length) return;
    if (document.hidden) { markUnseen(fresh.length); fresh.slice(0, 3).forEach(systemNotify); return; }
    const c = container();
    for (const n of fresh.slice(0, 3)) {
      const card = document.createElement('div');
      card.className = 'live-toast';
      card.style.cssText = 'pointer-events:auto;background:#fff;border:1px solid var(--border,#dde3ea);border-left:4px solid #2563eb;border-radius:12px;box-shadow:0 10px 30px rgba(15,38,64,.18);padding:12px 12px 12px 14px;display:flex;gap:10px;align-items:flex-start;transition:opacity .2s, transform .2s;opacity:0;transform:translateY(8px);';
      card.innerHTML = `<span class="live-toast-icon" style="flex-shrink:0;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;margin-top:1px;">${e(n.icon || '')}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;color:var(--text,#1b2533);line-height:1.45;">${e(n.text || '')}</div>
          ${n.linkTo ? `<button class="btn-sm btn-sm-primary" style="margin-top:8px;">${e(t('Open'))}</button>` : ''}
        </div>
        <button aria-label="${e(t('Close'))}" style="flex-shrink:0;background:none;border:0;font-size:18px;line-height:1;color:var(--slate,#5b6676);cursor:pointer;padding:2px 4px;">×</button>`;
      const [openBtn] = card.querySelectorAll('.btn-sm');
      if (openBtn) openBtn.addEventListener('click', () => { close(card); try { navigateFromNotification(n.linkTo); } catch (x) {} });
      card.querySelector('button[aria-label]').addEventListener('click', () => close(card));
      c.appendChild(card);
      requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'none'; });
      setTimeout(() => close(card), 9000);
      while (c.children.length > 3) c.firstChild.remove();
    }
  };

  // The customer's job card: responses and best price.
  if (typeof openJobCardHTML === 'function') {
    const base = openJobCardHTML;
    openJobCardHTML = function (j) {
      const html = base(j);
      const r = j && j.responses;
      if (!r) return html;
      const fresh = r.latestAt && Date.now() - new Date(r.latestAt).getTime() < 15 * 60 * 1000;
      const money = (n) => '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const line = r.count
        ? `<div class="job-responses" style="margin-top:8px;font-size:13.5px;color:var(--navy,#0f2640);font-weight:600;">${fresh ? `<span class="badge badge-pending" style="margin-right:6px;">${e(t('New'))}</span>` : ''}${r.count} ${e(t(r.count === 1 ? 'pro responded' : 'pros responded'))}${r.bestPrice != null ? ` · ${e(t('best price'))} ${money(r.bestPrice)}` : ''}</div>`
        : `<div class="job-responses" style="margin-top:8px;font-size:13px;color:var(--slate,#5b6676);">${e(t('Waiting for pros to respond'))}</div>`;
      // after the description line
      const i = html.indexOf('<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;');
      return i > -1 ? html.slice(0, i) + line + html.slice(i) : html;
    };
  }

  // v147: ask once, in plain words, to turn notifications on (best
  // practice: ask in context with a reason, never on first page load,
  // and not again for 14 days after "Not now"). Before, the switch was
  // only deep in Settings, so almost nobody had it.
  const ASK_KEY = 'trothen-notify-ask';
  async function maybeAsk() {
    try {
      if (!AUTH || !AUTH.token || !AUTH.user || AUTH.user.role === 'admin') return;
      if (!('Notification' in window) || Notification.permission !== 'default') return;
      let last = 0; try { last = Number(localStorage.getItem(ASK_KEY)) || 0; } catch (x) {}
      if (Date.now() - last < 14 * 24 * 3600 * 1000) return;
      if (document.getElementById('notify-ask')) return;
      const bar = document.createElement('div');
      bar.id = 'notify-ask';
      bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', t('Turn on notifications'));
      bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;max-width:460px;margin:0 auto;z-index:5590;background:#fff;border:1px solid var(--border,#dde3ea);border-left:4px solid var(--teal,#0f766e);border-radius:12px;box-shadow:0 10px 30px rgba(15,38,64,.18);padding:14px 16px;font-size:14px;color:var(--text,#1b2533);';
      bar.innerHTML = `<div style="font-weight:700;color:var(--navy,#1b2a4a);margin-bottom:4px;">🔔 ${e(t("Don't miss messages and calls"))}</div>
        <div style="color:var(--slate,#5b6676);margin-bottom:10px;">${e(t('Turn on notifications to see new messages, calls, prices and bookings even when Trothen is in the background.'))}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn-sm btn-sm-ghost" id="notify-ask-later">${e(t('Not now'))}</button><button class="btn-sm btn-sm-primary" id="notify-ask-on">${e(t('Turn on'))}</button></div>`;
      document.body.appendChild(bar);
      const done = () => { try { localStorage.setItem(ASK_KEY, String(Date.now())); } catch (x) {} bar.remove(); };
      bar.querySelector('#notify-ask-later').onclick = done;
      bar.querySelector('#notify-ask-on').onclick = async () => {
        done();
        let p = 'denied'; try { p = await Notification.requestPermission(); } catch (x) {}
        if (p !== 'granted') return showToast(t('Notifications are blocked. You can allow them in your browser or phone settings.'));
        // with phone push set up on the server, also subscribe, so it works with Trothen closed
        try {
          const k = await apiFetch('GET', '/push/vapid-public-key');
          if (k.configured && 'serviceWorker' in navigator && 'PushManager' in window) {
            const reg = await navigator.serviceWorker.ready;
            const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(k.publicKey) });
            await apiFetch('POST', '/push/subscribe', sub.toJSON()); window.__pushSubscribed = true;
          }
        } catch (x) { /* notifications still show while Trothen is open in the background */ }
        showToast(t('Notifications are on.'));
      };
    } catch (x) {}
  }
  // after sign-in, once the dashboard is up (not on the first page load)
  ['goToCustomerDashboard', 'initProviderDash'].forEach(fn => {
    if (typeof window[fn] === 'function') { const f = window[fn]; window[fn] = function () { const r = f.apply(this, arguments); setTimeout(maybeAsk, 4000); return r; }; }
  });
  window.notifyAskNow = maybeAsk; // for tests
})();
