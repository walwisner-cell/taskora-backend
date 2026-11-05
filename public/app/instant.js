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
  window.announceNewNotifications = function (list) {
    if (!Array.isArray(list) || !list.length || document.hidden) return;
    const now = Date.now();
    // Only what is genuinely new: never a backlog after the page was asleep.
    const fresh = list.filter(n => n && n.id && !shown.has(n.id) && (!n.createdAt || now - new Date(n.createdAt).getTime() < 3 * 60 * 1000));
    fresh.forEach(n => shown.add(n.id));
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
})();
