/* v183: search in the app.

   1. searchBox(input, opts): a search box with suggestions while typing and the
      person's recent searches, built to the WAI-ARIA "combobox" pattern (W3C ARIA
      Authoring Practices): ↑ ↓ move through the suggestions, Enter chooses, Escape
      closes, and a screen reader hears how many suggestions there are.
   2. highlightHTML(text, q): the text, escaped, with the words that matched in <mark>.
   3. listSearch: a search box above a long list (bookings, orders, receipts, Admin
      tables…) that filters it as you type with the same engine as the Market:
      typos, plurals and other names for the same thing. It says "X of Y shown",
      and what to do when nothing matches. Lists of fewer than 6 rows get no box.

   Recent searches are kept only on this device, and can be cleared. */
(function () {
  'use strict';
  const S = window.TrothenSearch;
  if (!S) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (x) { return []; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) {} },
  };

  window.highlightHTML = function (text, q) {
    const src = String(text == null ? '' : text);
    if (!q) return esc(src);
    const hs = S.highlights(src, q); if (!hs.length) return esc(src);
    let out = '', at = 0;
    for (const [a, b] of hs) { out += esc(src.slice(at, a)) + '<mark class="ts-mark">' + esc(src.slice(a, b)) + '</mark>'; at = b; }
    return out + esc(src.slice(at));
  };

  // ── 1. the search box with suggestions ──────────────────────────────
  let uid = 0;
  window.searchBox = function (input, opts) {
    if (!input || input.dataset.tsBox) return;
    input.dataset.tsBox = '1';
    opts = opts || {};
    const id = 'ts-list-' + (++uid);
    const wrap = document.createElement('div'); wrap.className = 'ts-wrap';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    const list = document.createElement('ul'); list.id = id; list.className = 'ts-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
    list.setAttribute('aria-label', t('Suggestions'));
    wrap.appendChild(list);
    const live = document.createElement('div'); live.className = 'ts-sr'; live.setAttribute('aria-live', 'polite'); wrap.appendChild(live);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', id); input.setAttribute('autocomplete', 'off'); input.setAttribute('enterkeyhint', 'search');
    if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', input.getAttribute('placeholder') || t('Search'));
    let items = [], active = -1, timer = null, seq = 0;
    const recentKey = opts.recentKey;
    const recent = () => (recentKey ? store.get(recentKey) : []);
    const remember = (q) => { if (!recentKey || !S.fold(q)) return; const r = recent().filter(x => S.fold(x) !== S.fold(q)); r.unshift(q.trim()); store.set(recentKey, r.slice(0, 8)); };
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; }
    function paint(head) {
      if (!items.length) { close(); return; }
      list.innerHTML = (head ? `<li class="ts-head" role="presentation">${esc(head)}${recentKey && head === t('Recent searches') ? ` <button type="button" class="ts-clear" data-clear="1">${esc(t('Clear'))}</button>` : ''}</li>` : '')
        + items.map((it, i) => `<li id="${id}-${i}" role="option" class="ts-opt${i === active ? ' on' : ''}" aria-selected="${i === active}" data-i="${i}">${it.recent ? '<span aria-hidden="true">🕘</span>' : '<span aria-hidden="true">🔍</span>'}<span class="ts-txt">${highlightHTML(it.text, input.value)}</span>${it.kind === 'category' ? ` <span class="ts-kind">${esc(t('category'))}</span>` : it.kind === 'brand' ? ` <span class="ts-kind">${esc(t('brand'))}</span>` : ''}</li>`).join('');
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
      live.textContent = `${items.length} ${t(items.length === 1 ? 'suggestion' : 'suggestions')}`;
    }
    function move(d) {
      if (list.hidden || !items.length) return;
      active = (active + d + items.length) % items.length;
      [...list.querySelectorAll('[role=option]')].forEach((li, i) => { li.classList.toggle('on', i === active); li.setAttribute('aria-selected', String(i === active)); });
      input.setAttribute('aria-activedescendant', `${id}-${active}`);
      const el = document.getElementById(`${id}-${active}`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    function choose(it) { input.value = it.text; close(); go(it); }
    function go(it) { remember(input.value); if (opts.onSearch) opts.onSearch(input.value, it || null); }
    async function suggest() {
      const q = input.value;
      if (document.activeElement !== input) return;
      if (!S.fold(q)) { items = recent().map(text => ({ text, recent: true })); active = -1; paint(t('Recent searches')); return; }
      if (!opts.suggest) return;
      const my = ++seq;
      let got = [];
      try { got = await opts.suggest(q); } catch (x) { got = []; }
      if (my !== seq || document.activeElement !== input) return; // the person has moved on
      const rec = recent().filter(x => S.score(q, x).matched === S.terms(q).length && S.fold(x) !== S.fold(q)).slice(0, 2).map(text => ({ text, recent: true }));
      items = rec.concat((got || []).filter(g => !rec.some(r => S.fold(r.text) === S.fold(g.text)))).slice(0, 8); active = -1; paint();
    }
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { suggest(); if (opts.onType) opts.onType(input.value); }, opts.delay || 250);
    });
    input.addEventListener('focus', () => { if (!S.fold(input.value)) suggest(); });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (list.hidden) suggest(); else move(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (!list.hidden && active >= 0) choose(items[active]); else { close(); clearTimeout(timer); go(null); } }
      else if (ev.key === 'Escape') { if (!list.hidden) { ev.preventDefault(); close(); } }
    });
    list.addEventListener('mousedown', (ev) => ev.preventDefault()); // keep the focus in the box
    list.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-clear]')) { store.set(recentKey, []); items = []; close(); input.focus(); return; }
      const li = ev.target.closest('[role=option]'); if (li) choose(items[Number(li.dataset.i)]);
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
    return { close, remember };
  };

  // ── 3. search any long list ─────────────────────────────────────────
  // spec: { box: container element, rows: () => [elements], text: (row) => string,
  //         label: 'Search your bookings', min: 6, key: a name for this list }
  window.listSearch = function (spec) {
    const box = spec.box; if (!box || !box.isConnected) return;
    const rows = spec.rows().filter(r => r && r.isConnected);
    const prev = box.previousElementSibling && box.previousElementSibling.classList && box.previousElementSibling.classList.contains('ls-bar') ? box.previousElementSibling : null;
    if (rows.length < (spec.min || 6)) { if (prev && !prev.querySelector('input').value) prev.remove(); return; }
    let bar = prev;
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'ls-bar';
      const lid = 'ls-' + (++uid);
      bar.innerHTML = `<label class="ts-sr" for="${lid}">${esc(t(spec.label || 'Search this list'))}</label>
        <input type="search" id="${lid}" class="form-input ls-input" placeholder="${esc(t(spec.label || 'Search this list'))}" autocomplete="off" enterkeyhint="search"/>
        <span class="ls-count" aria-live="polite"></span>`;
      box.parentNode.insertBefore(bar, box);
      const input = bar.querySelector('input');
      let timer = null;
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => apply(), 150); });
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && input.value) { input.value = ''; apply(); } });
      bar._apply = () => apply();
    }
    const input = bar.querySelector('input'), count = bar.querySelector('.ls-count');
    function apply() {
      const all = spec.rows().filter(r => r && r.isConnected);
      const q = input.value;
      let empty = box.querySelector(':scope > .ls-empty, :scope > tbody > .ls-empty');
      if (!S.terms(q).length) {
        all.forEach(r => r.classList.remove('ls-hide'));
        count.textContent = ''; if (empty) empty.remove(); return;
      }
      const found = S.search(all, q, (r) => [{ text: spec.text ? spec.text(r) : r.textContent, weight: 1 }], { relax: false });
      const keep = new Set(found.results.map(x => x.item));
      all.forEach(r => r.classList.toggle('ls-hide', !keep.has(r)));
      count.textContent = `${keep.size} ${t('of')} ${all.length} ${t('shown')}`;
      if (!keep.size) {
        if (!empty) {
          const inTable = all[0] && all[0].tagName === 'TR';
          empty = document.createElement(inTable ? 'tr' : 'div'); empty.className = 'ls-empty';
          const msg = `${esc(t('Nothing matches'))} “${esc(q)}”. ${esc(t('Check the spelling, or try fewer words.'))}`;
          empty.innerHTML = inTable ? `<td colspan="20">${msg}</td>` : msg;
          (inTable ? (all[0].parentNode) : box).appendChild(empty);
        }
      } else if (empty) empty.remove();
    }
    apply();
  };

  /* Where lists get a search box. Each entry: the list (a CSS selector), its rows
     (relative to the list), and the words on the box. Checked each time a page is
     drawn; nothing is added to a list of fewer than 6 rows. */
  /* Where lists get a search box: on the customer, pro and Admin pages,
       - every table with 6 rows or more, and
       - every list of 6 or more cards that look alike (bookings, orders, receipts…).
     Left alone: menus, forms, tabs, buttons, the Market and Rentals results (they
     have their own search), chats, help videos, and anything inside a pop-up. */
  const PAGES = '#customer-main, #provider-main, #admin-main';
  const SKIP = '.ts-wrap, .ls-bar, #help-videos, .modal-overlay, .mk-grid, #mk-results, #rt-results, .dash-nav, nav, form, [role=tablist], [role=menu], [role=listbox], .chat-thread, .messages-thread, #message-thread, .stat-cards, .market-tabs, select, svg';
  function sameShape(kids) {
    const key = (k) => k.tagName + '.' + String(k.className || '').split(' ')[0];
    const counts = {}; kids.forEach(k => { const x = key(k); counts[x] = (counts[x] || 0) + 1; });
    const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
    return n >= 6 && n / kids.length >= 0.8 && !/^(OPTION|BUTTON|LI\.$|SPAN|TD|TH|LABEL|INPUT|A\.|IMG|BR|svg|path|P\.$|H\d)/.test(top) ? top : null;
  }
  // a list that already has its own search box (Customers & Providers, Customer Payments…) gets no second one
  const hasOwnSearch = (el) => { const area = el.closest('.panel, section, [id$="-body"]') || el.parentElement; return !!(area && [...area.querySelectorAll('input')].some(i => !i.classList.contains('ls-input') && (i.type === 'search' || /search|find/i.test(i.placeholder || '')))); };
  function scan() {
    for (const page of document.querySelectorAll(PAGES)) {
      // tables
      for (const tb of page.querySelectorAll('table > tbody')) {
        const table = tb.closest('table');
        if (table.closest(SKIP) || table.dataset.noSearch === '1' || hasOwnSearch(table)) continue;
        try { listSearch({ box: table, rows: () => [...tb.querySelectorAll(':scope > tr')].filter(r => !r.classList.contains('ls-empty')), label: page.id === 'admin-main' ? 'Search this list: a name, a number or a word' : 'Search this list' }); } catch (x) {}
      }
      // lists of cards
      for (const el of page.querySelectorAll('div, ul, ol, section')) {
        if (el.children.length < 6 || el.closest(SKIP) || el.dataset.noSearch === '1' || el.closest('table') || hasOwnSearch(el)) continue;
        const kids = [...el.children].filter(k => !k.classList.contains('ls-empty') && !k.classList.contains('ls-bar'));
        const shape = sameShape(kids); if (!shape) continue;
        if (kids.some(k => k.matches('label, fieldset') || k.querySelector('input, textarea, select, label'))) continue; // a form or settings, not a list
        if (kids.filter(k => (k.textContent || '').trim().length >= 12).length < kids.length * 0.8) continue; // too little text to search
        if ([...page.querySelectorAll('[data-ls-list]')].some(o => o !== el && o.contains(el))) continue; // a list inside a list
        el.dataset.lsList = '1';
        try { listSearch({ box: el, rows: () => [...el.children].filter(k => !k.classList.contains('ls-empty') && !k.classList.contains('ls-bar')), label: 'Search this list' }); } catch (x) {}
      }
    }
  }
  let pending = false;
  const later = () => { if (pending) return; pending = true; setTimeout(() => { pending = false; scan(); }, 250); };
  if (typeof MutationObserver === 'function') {
    const start = () => new MutationObserver((muts) => { if (muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !(n.classList && (n.classList.contains('ls-bar') || n.classList.contains('ls-empty') || n.classList.contains('ts-list')))))) later(); }).observe(document.body, { childList: true, subtree: true });
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }

  // the look: plain and readable, in the app's colours, big enough to tap (44 px)
  const css = document.createElement('style');
  css.textContent = `
    .ts-wrap{position:relative;flex:1 1 220px;min-width:0;display:flex}
    .ts-wrap>input{flex:1;min-width:0;min-height:44px}
    .ts-list{position:absolute;left:0;right:0;top:100%;z-index:60;margin:4px 0 0;padding:4px 0;list-style:none;background:var(--white,#fff);border:1px solid var(--border,#d0d7e2);border-radius:10px;box-shadow:0 10px 24px rgba(15,38,64,.14);max-height:320px;overflow:auto}
    .ts-opt{padding:10px 12px;cursor:pointer;min-height:44px;box-sizing:border-box;display:flex;gap:8px;align-items:center;color:var(--text,#1b2533)}
    .ts-txt{flex:1 1 auto;min-width:0;line-height:1.35;overflow-wrap:anywhere}
    .ts-opt.on,.ts-opt:hover{background:#eef4fb}
    .ts-head{padding:6px 12px;font-size:12px;color:var(--slate,#5b6575);display:flex;justify-content:space-between;align-items:center}
    .ts-clear{border:0;background:none;color:var(--teal,#0e7c86);font-weight:700;cursor:pointer;min-height:32px}
    .ts-kind{flex:0 0 auto;margin-left:auto;font-size:11.5px;color:var(--slate,#5b6575);border:1px solid var(--border,#d0d7e2);border-radius:999px;padding:1px 8px}
    .ts-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    mark.ts-mark{background:#FFF1B8;color:inherit;border-radius:2px;padding:0 1px}
    .ls-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
    .ls-bar .ls-input{flex:1 1 240px;max-width:460px;min-height:44px}
    .ls-count{font-size:13px;color:var(--slate,#5b6575)}
    .ls-empty{padding:14px;color:var(--slate,#5b6575)}
    tr.ls-empty td{padding:14px;color:var(--slate,#5b6575)}
    .ls-hide{display:none!important}`;
  (document.head || document.documentElement).appendChild(css);
})();
