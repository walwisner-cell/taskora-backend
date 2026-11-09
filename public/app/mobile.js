/* v154: Trothen on a phone, the way people expect a phone app to work.
   ─────────────────────────────────────────────────────────────────────
   1. A tab bar at the bottom of the screen, within reach of the thumb (the pattern used by
      Apple's and Google's own design guidelines and by most large apps). Four main places plus
      "More", which opens the full list. It replaces the strip of section buttons that sat under the
      top bar and had to be scrolled sideways to find things.
   2. The floating chat button no longer covers the page on the dashboards; "Help & support" is in More.
   3. The early-access notice stays closed once closed (until its text changes).
   4. On a phone the tab bar only shows on the customer and pro dashboards, never on the admin
      dashboard (staff use a computer) and never on the public pages. */
(function () {
  const PHONE = '(max-width: 760px)';
  const isPhone = () => window.matchMedia(PHONE).matches;
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);

  // The four main places for each kind of account, in the order people use them. Everything
  // else is one tap away in More.
  const MAIN = {
    'customer-nav': [['overview', 'Home'], ['bookings', 'Bookings'], ['messages', 'Messages'], ['payments', 'Payments']],
    'provider-nav': [['overview', 'Home'], ['matches', 'Jobs'], ['contracts', 'Contracts'], ['messages', 'Messages']],
  };
  const MORE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
  const HELP_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/></svg>';

  let state = null; // { containerId, items, activeKey, fnName }
  // Focus moves into the sheet (and back) only for keyboard users; a tap shouldn't leave an outline behind.
  let byKeyboard = false;
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Tab' || ev.key === 'Enter' || ev.key === ' ') byKeyboard = true; }, true);
  document.addEventListener('pointerdown', () => { byKeyboard = false; }, true);

  function iconFor(containerId, key) {
    const c = document.getElementById(containerId);
    const it = state && state.items.find(i => i.key === key);
    if (!c || !it) return '';
    const el = [...c.querySelectorAll('.dash-nav-item')].find(x => (x.getAttribute('onclick') || '').includes(`'${key}'`));
    const ic = el && (el.querySelector('.dash-nav-icon') || el.querySelector('span[aria-hidden]'));
    return ic ? ic.innerHTML : e(it.icon || '');
  }
  function dotFor(key) {
    const it = state && state.items.find(i => i.key === key);
    return !!(it && it.dot);
  }

  function draw() {
    let bar = document.getElementById('mtab');
    const on = isPhone() && state && MAIN[state.containerId] && isDashOpen(state.containerId);
    document.body.classList.toggle('has-mtab', !!on);
    if (!on) { if (bar) bar.remove(); return; }
    const main = MAIN[state.containerId].filter(([k]) => state.items.some(i => i.key === k));
    const inMore = !main.some(([k]) => k === state.activeKey);
    const html = main.map(([k, label]) => {
      const active = k === state.activeKey;
      return `<button type="button" class="mtab-item${active ? ' on' : ''}"${active ? ' aria-current="page"' : ''} onclick="mtabGo('${k}')"><span class="mtab-ic">${iconFor(state.containerId, k)}${dotFor(k) ? '<span class="mtab-dot" aria-hidden="true"></span>' : ''}</span><span class="mtab-l">${e(t(label))}</span>${dotFor(k) ? `<span class="sr-only"> (${e(t('new'))})</span>` : ''}</button>`;
    }).join('') + `<button type="button" class="mtab-item${inMore ? ' on' : ''}" aria-haspopup="dialog" onclick="mtabMore()"><span class="mtab-ic">${MORE_ICON}${state.items.some(i => i.dot && !main.some(([k]) => k === i.key)) ? '<span class="mtab-dot" aria-hidden="true"></span>' : ''}</span><span class="mtab-l">${e(t('More'))}</span></button>`;
    if (!bar) {
      bar = document.createElement('nav');
      bar.id = 'mtab'; bar.setAttribute('aria-label', t('Main'));
      document.body.appendChild(bar);
    }
    bar.innerHTML = html;
  }
  function isDashOpen(containerId) {
    const scr = document.getElementById(containerId === 'customer-nav' ? 'screen-customer' : 'screen-provider');
    return !!(scr && scr.classList.contains('active'));
  }

  window.mtabGo = (key) => {
    if (!state) return;
    closeMore();
    try { window[state.fnName](key); } catch (x) {}
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };

  // ── "More": a sheet from the bottom with every other place ──
  function closeMore() {
    const s = document.getElementById('mtab-sheet');
    if (s) { s.remove(); document.body.classList.remove('mtab-sheet-open'); const b = document.querySelector('#mtab .mtab-item:last-child'); if (b && byKeyboard) b.focus(); }
  }
  window.mtabCloseMore = closeMore;
  window.mtabMore = () => {
    if (!state) return;
    if (document.getElementById('mtab-sheet')) return closeMore();
    const mainKeys = MAIN[state.containerId].map(([k]) => k);
    const rest = state.items.filter(i => !mainKeys.includes(i.key));
    const sheet = document.createElement('div');
    sheet.id = 'mtab-sheet';
    sheet.innerHTML = `<div class="mtab-back" onclick="mtabCloseMore()"></div>
      <div class="mtab-panel" role="dialog" aria-modal="true" aria-labelledby="mtab-title">
        <div class="mtab-grab" aria-hidden="true"></div>
        <div class="mtab-head"><h2 id="mtab-title">${e(t('More'))}</h2><button type="button" class="mtab-x" onclick="mtabCloseMore()" aria-label="${e(t('Close'))}">✕</button></div>
        <div class="mtab-list">
          ${rest.map(i => `<button type="button" class="mtab-row${i.key === state.activeKey ? ' on' : ''}"${i.key === state.activeKey ? ' aria-current="page"' : ''} onclick="mtabGo('${i.key}')"><span class="mtab-ic">${iconFor(state.containerId, i.key)}</span><span>${e(t(i.label))}</span>${i.dot ? '<span class="mtab-dot inline" aria-hidden="true"></span>' : ''}</button>`).join('')}
          ${typeof toggleSupportChat === 'function' ? `<button type="button" class="mtab-row" onclick="mtabCloseMore();toggleSupportChat()"><span class="mtab-ic">${HELP_ICON}</span><span>${e(t('Help & support'))}</span></button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(sheet);
    document.body.classList.add('mtab-sheet-open');
    const first = sheet.querySelector('.mtab-row'); if (first && byKeyboard) first.focus(); else { const pnl = sheet.querySelector('.mtab-panel'); if (pnl) { pnl.setAttribute('tabindex', '-1'); pnl.focus({ preventScroll: true }); } }
  };
  document.addEventListener('keydown', (ev) => {
    const s = document.getElementById('mtab-sheet');
    if (!s) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeMore(); return; }
    if (ev.key === 'Tab') { // keep the keyboard inside the sheet while it is open
      const f = [...s.querySelectorAll('button')]; if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
    }
  });

  // Follow the app's own menu: whenever it is drawn, the tab bar is drawn from the same list.
  function hook() {
    const f = window.renderDashNav;
    if (typeof f !== 'function' || f.__mtab) return;
    const w = function (containerId, items, activeKey, fnName) {
      const r = f.apply(this, arguments);
      if (MAIN[containerId]) { state = { containerId, items: items || [], activeKey, fnName }; try { draw(); } catch (x) {} }
      return r;
    };
    w.__mtab = true;
    window.renderDashNav = w;
  }
  hook();
  // Leaving the dashboard (signing out, the public pages) hides the tab bar.
  const so = window.showScreen;
  if (typeof so === 'function' && !so.__mtab) {
    const w = function (id) { const r = so.apply(this, arguments); setTimeout(() => { if (!/screen-(customer|provider)$/.test(id)) { state = state && isDashOpen(state.containerId) ? state : null; } try { closeMore(); draw(); } catch (x) {} }, 0); return r; };
    w.__mtab = true; window.showScreen = w;
  }
  window.matchMedia(PHONE).addEventListener('change', () => { try { closeMore(); draw(); } catch (x) {} });

  // ── The early-access notice stays closed once closed, until its wording changes ──
  function bannerKey() { const el = document.getElementById('test-mode-banner-text'); return 'tm_closed:' + ((el && el.textContent) || '').length + ':' + ((el && el.textContent) || '').slice(0, 40); }
  function bannerInit() {
    const b = document.getElementById('test-mode-banner'); if (!b) return;
    const x = b.querySelector('[onclick*="none"]');
    if (x) {
      x.setAttribute('role', 'button'); x.setAttribute('tabindex', '0'); x.setAttribute('aria-label', 'Close this notice'); x.classList.add('tm-close');
      x.addEventListener('click', () => { try { localStorage.setItem(bannerKey(), '1'); } catch (y) {} });
    }
    const apply = () => { try { if (localStorage.getItem(bannerKey()) === '1') b.style.display = 'none'; } catch (y) {} };
    apply();
    const txt = document.getElementById('test-mode-banner-text');
    if (txt) new MutationObserver(apply).observe(txt, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bannerInit); else bannerInit();

  // An open conversation, and the on-screen keyboard, get the whole screen: the tab bar steps aside.
  let threadObs = null;
  function watchThread() {
    const lay = document.getElementById('chat-layout');
    const set = () => document.body.classList.toggle('chat-thread-open', !!(lay && lay.isConnected && lay.classList.contains('show-thread') && isPhone()));
    if (threadObs) threadObs.disconnect();
    if (lay) { threadObs = new MutationObserver(set); threadObs.observe(lay, { attributes: true, attributeFilter: ['class'] }); }
    set();
  }
  let qd = false;
  new MutationObserver(() => {
    if (qd) return; qd = true;
    requestAnimationFrame(() => { qd = false; const lay = document.getElementById('chat-layout'); if (lay && !lay.__mtabWatched) { lay.__mtabWatched = true; watchThread(); } else if (!lay) document.body.classList.remove('chat-thread-open'); });
  })
    .observe(document.body, { childList: true, subtree: true });
  if (window.visualViewport) {
    const full = () => window.innerHeight;
    window.visualViewport.addEventListener('resize', () => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
      document.body.classList.toggle('kb-open', isPhone() && typing && window.visualViewport.height < full() - 150);
    });
  }
  document.addEventListener('focusout', () => setTimeout(() => { if (!/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) document.body.classList.remove('kb-open'); }, 50));

  window.__mtab = { draw, state: () => state };
})();
