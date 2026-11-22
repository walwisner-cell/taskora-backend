// v178: help videos inside Trothen, so anyone who is stuck can watch how it works.
//
//  - "Help videos" in the account menu, the support chat and the site footer
//    (visitors too): a page of short videos, each with its words underneath
//    (WCAG 2.1: a text version of every video, and captions on screen).
//  - "Watch how it works" on the screens where people get stuck (Rides, Post a
//    Job, My Store, the Market, Deliveries, Verification, the cart, Messages):
//    one tap plays the right video there and then.
//  - Each person sees the videos for them: the admin video only for admins,
//    Business tools only for pros.
//  - The list (/help/help-videos.json) and the files (/help/*.mp4) are only
//    fetched when someone asks: a video loads when its play button is pressed,
//    so nobody spends mobile data on a video they didn't choose.
(function () {
  'use strict';
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const ID = 'help-videos';
  let LIST = null, loading = null, back = null;

  function load() {
    if (LIST) return Promise.resolve(LIST);
    if (!loading) loading = fetch('/help/help-videos.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('No help videos'); return r.json(); }).then(j => (LIST = Array.isArray(j) ? j : [])).catch(x => { loading = null; throw x; });
    return loading;
  }
  function role() { try { return (typeof AUTH !== 'undefined' && AUTH && AUTH.user && AUTH.user.role) || null; } catch (x) { return null; } }
  function forMe(v) {
    const r = role();
    if (v.audience === 'admin') return false; // the team's videos are only in Admin → Help videos
    if (v.audience === 'provider') return r === 'provider' || r === 'admin';
    return true;
  }
  // v179: each video for people has a phone version and a laptop version (the screens are
  // laid out differently). The one for this screen plays: the laptop one above 760 px wide,
  // where Trothen shows its menu on the left.
  const wide = () => { try { return window.matchMedia('(min-width: 761px)').matches; } catch (x) { return false; } };
  const pick = (v) => (wide() && v.computer && v.computer.file ? { ...v.computer, desk: true } : { file: v.file, seconds: v.seconds, transcript: v.transcript, desk: false });
  const TOPICS = ['Getting started', 'Customers', 'Rides', 'Market', 'Pros'];
  const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mins = (s) => { const m = Math.max(1, Math.round((Number(s) || 60) / 60)); return `${m} ${t(m === 1 ? 'min' : 'mins')}`; };

  function close() {
    const o = document.getElementById(ID); if (!o) return;
    const v = o.querySelector('video'); if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (x) {} }
    o.remove(); document.removeEventListener('keydown', onKey, true);
    if (back && document.contains(back)) { try { back.focus(); } catch (x) {} }
    back = null;
  }
  function onKey(ev) {
    if (ev.key === 'Escape') { ev.stopPropagation(); close(); return; }
    if (ev.key === 'Tab') { // keep the keyboard inside the window while it is open
      const o = document.getElementById(ID); if (!o) return;
      const f = [...o.querySelectorAll('button, [href], video, summary, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
  }
  function shell(inner, label) {
    let o = document.getElementById(ID);
    if (!o) {
      back = document.activeElement;
      o = document.createElement('div'); o.id = ID; o.className = 'modal-overlay open'; o.style.zIndex = '5300';
      o.addEventListener('click', (ev) => { if (ev.target === o) close(); });
      document.body.appendChild(o); document.addEventListener('keydown', onKey, true);
    }
    o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${e(label)}" style="max-width:min(900px,96vw);width:96vw;max-height:94vh;display:flex;flex-direction:column;">
      <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;">${e(label)}</h3><button type="button" class="modal-close" id="hv-close" aria-label="${e(t('Close'))}">✕</button></div>
      <div class="modal-body" id="hv-body" style="overflow:auto;flex:1 1 auto;min-height:0;">${inner}</div></div>`;
    o.querySelector('#hv-close').addEventListener('click', close);
    return o;
  }

  function card(v) {
    const p = pick(v);
    const words = norm([t(v.title), t(v.tagline), v.title, v.tagline, ...(p.transcript || [])].join(' '));
    return `
        <button type="button" class="hv-card" data-hv="${e(v.key)}" data-words="${e(words)}" style="text-align:left;border:1px solid var(--border);border-radius:12px;background:var(--white,#fff);padding:0;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;color:inherit;font:inherit;">
          <span style="position:relative;display:block;width:100%;padding-top:62.5%;background:#0F2640;overflow:hidden;"><img src="/help/${e(p.file)}.jpg" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"/>
            <span aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span style="width:54px;height:54px;border-radius:50%;background:rgba(15,38,64,.85);color:#F2B705;display:flex;align-items:center;justify-content:center;font-size:22px;padding-left:4px;">▶</span></span>
            <span style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.7);color:#fff;font-size:12px;border-radius:4px;padding:1px 6px;">${e(mins(p.seconds))}</span></span>
          <span style="display:block;padding:10px 12px 12px;"><strong style="display:block;color:var(--navy);font-size:15px;">${e(t(v.title))}</strong><span style="display:block;font-size:13px;color:var(--slate);margin-top:2px;">${e(t(v.tagline))}</span></span>
        </button>`;
  }
  function grid(list) {
    // grouped by topic (Getting started, Customers, Rides, Market, Pros), in that order
    const order = [...TOPICS, ...list.map(v => v.topic || 'More').filter(x => !TOPICS.includes(x))].filter((x, i, a) => a.indexOf(x) === i);
    const groups = order.map(tp => ({ tp, items: list.filter(v => (v.topic || 'More') === tp) })).filter(g => g.items.length);
    return `<p style="color:var(--slate);margin:0 0 10px;">${e(t('Videos on how Trothen works, step by step. Each one has its words underneath, if you can\'t play sound.'))}</p>
      <label for="hv-search" class="sr-only">${e(t('Search the help videos'))}</label>
      <input id="hv-search" type="search" class="form-input" autocomplete="off" placeholder="${e(t('Search the help videos, for example: pay, ride, store'))}" style="width:100%;margin:0 0 14px;min-height:44px;"/>
      <p id="hv-none" role="status" style="display:none;color:var(--slate);">${e(t('No video matches your search. Try another word, or ask for help in the support chat.'))}</p>
      ${groups.map(g => `<section class="hv-group" style="margin:0 0 18px;"><h4 style="margin:0 0 10px;color:var(--navy);font-size:16px;">${e(t(g.tp))}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">${g.items.map(card).join('')}</div></section>`).join('')}
      <p style="font-size:12px;color:var(--slate);margin:14px 0 0;">${e(t('Narration voice: Kokoro (Apache 2.0).'))} <a href="/help/CREDITS.txt" target="_blank" rel="noopener" style="color:var(--slate);">${e(t('Credits'))}</a></p>`;
  }
  function search(q) {
    const o = document.getElementById(ID); if (!o) return;
    const words = norm(q).split(/\s+/).filter(Boolean);
    let shown = 0;
    o.querySelectorAll('.hv-group').forEach(g => {
      let n = 0;
      g.querySelectorAll('[data-hv]').forEach(c => { const ok = words.every(w => c.dataset.words.includes(w)); c.style.display = ok ? '' : 'none'; if (ok) n++; });
      g.style.display = n ? '' : 'none'; shown += n;
    });
    const none = o.querySelector('#hv-none'); if (none) none.style.display = shown ? 'none' : '';
  }
  function player(v, list) {
    const others = list.filter(x => x.key !== v.key);
    const p = pick(v);
    const size = p.desk ? 'width:min(860px,100%);aspect-ratio:16/10;' : 'height:min(66vh,640px);aspect-ratio:720/1558;max-width:100%;';
    return `<video id="hv-video" controls playsinline preload="metadata" style="display:block;margin:0 auto;${size}object-fit:contain;background:#0F2640;border-radius:12px;" aria-label="${e(t(v.title))}">
        <source src="/help/${e(p.file)}.mp4" type="video/mp4"/>${e(t('Your browser can\'t play this video. The words are below.'))}</video>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:10px;"><div><strong style="font-size:18px;color:var(--navy);">${e(t(v.title))}</strong> <span style="color:var(--slate);font-size:13px;">· ${e(mins(p.seconds))}</span></div>
        ${others.length ? `<button type="button" class="btn-sm btn-sm-outline" id="hv-all">${e(t('All help videos'))}</button>` : ''}</div>
      <details style="margin-top:10px;"><summary style="cursor:pointer;font-weight:600;color:var(--teal);">${e(t('Read it instead'))}</summary>
        <ol style="margin:8px 0 0;padding-left:22px;line-height:1.6;font-size:14.5px;">${(p.transcript || []).map(x => `<li>${e(x)}</li>`).join('')}</ol></details>
      <div style="margin-top:12px;font-size:13px;color:var(--slate);">${e(t('Still stuck?'))} <a role="button" tabindex="0" id="hv-help" style="color:var(--teal);cursor:pointer;font-weight:600;">${e(t('Ask for help'))}</a></div>`;
  }
  function wire(list) {
    const o = document.getElementById(ID); if (!o) return;
    o.querySelectorAll('[data-hv]').forEach(b => b.addEventListener('click', () => show(b.dataset.hv, list, true)));
    const all = o.querySelector('#hv-all'); if (all) all.addEventListener('click', () => { shell(grid(list), t('Help videos')); wire(list); const f = document.getElementById('hv-search'); if (f) f.focus(); });
    const q = o.querySelector('#hv-search'); if (q) q.addEventListener('input', () => search(q.value));
    const h = o.querySelector('#hv-help'); if (h) { const go = () => { close(); if (typeof toggleSupportChat === 'function') toggleSupportChat(); else if (typeof showContactPage === 'function') showContactPage(); }; h.addEventListener('click', go); h.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); }); }
  }
  function show(key, list, play) {
    const v = list.find(x => x.key === key); if (!v) return;
    shell(player(v, list), t('Help videos'));
    wire(list);
    const vid = document.getElementById('hv-video');
    if (vid) { if (play) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); } vid.focus(); }
  }
  // Open the help videos, or one of them: openHelpVideos() or openHelpVideos('rides').
  window.openHelpVideos = async function (key) {
    shell(`<p style="color:var(--slate);">${e(t('Loading…'))}</p>`, t('Help videos'));
    let list;
    try { list = (await load()).filter(forMe); }
    catch (x) { const b = document.getElementById('hv-body'); if (b) b.innerHTML = `<p>${e(t('The help videos can\'t be loaded right now. Check your connection and try again.'))}</p>`; return; }
    if (!document.getElementById(ID)) return; // closed while loading
    if (key && list.some(v => v.key === key)) show(key, list, true);
    else { shell(grid(list), t('Help videos')); wire(list); const c = document.getElementById('hv-close'); if (c) c.focus(); }
  };
  window.closeHelpVideos = close;

  // ── Admin → Help videos (v178): the team's own videos, never on the public site ──
  // Each admin sees the videos for the parts of Admin they can open. The videos
  // play through private links that work for 30 minutes (src/help-media.js).
  function adminKeys() { try { return new Set((typeof getAdminNavItems === 'function' ? getAdminNavItems() : []).map(i => i.key)); } catch (x) { return new Set(); } }
  function adminGrid(list) {
    return list.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">${list.map(v => `
      <button type="button" data-ahv="${e(v.key)}" style="text-align:left;border:1px solid var(--border);border-radius:12px;background:var(--white,#fff);padding:0;overflow:hidden;cursor:pointer;color:inherit;font:inherit;">
        <span style="position:relative;display:block;width:100%;padding-top:62.5%;background:#0F2640;overflow:hidden;"><img src="${e(v.poster)}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"/>
          <span aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span style="width:50px;height:50px;border-radius:50%;background:rgba(15,38,64,.85);color:#F2B705;display:flex;align-items:center;justify-content:center;font-size:20px;padding-left:4px;">▶</span></span>
          <span style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.7);color:#fff;font-size:12px;border-radius:4px;padding:1px 6px;">${e(mins(v.seconds))}</span></span>
        <span style="display:block;padding:10px 12px 12px;"><strong style="display:block;color:var(--navy);font-size:15px;">${e(v.title)}</strong><span style="display:block;font-size:13px;color:var(--slate);margin-top:2px;">${e(v.tagline)}</span></span>
      </button>`).join('')}</div>` : `<p style="color:var(--slate);">${e(t('No admin help videos yet.'))}</p>`;
  }
  function adminPlayer(v) {
    return `<div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;">
      <video id="ahv-video" controls playsinline preload="metadata" style="width:min(760px,100%);aspect-ratio:16/10;background:#0F2640;border-radius:12px;" aria-label="${e(v.title)}"><source src="${e(v.url)}" type="video/mp4"/></video>
      <div style="flex:1 1 280px;min-width:0;"><h3 style="margin:0 0 4px;color:var(--navy);">${e(v.title)}</h3><div style="color:var(--slate);font-size:13px;margin-bottom:10px;">${e(v.tagline)} · ${e(mins(v.seconds))}</div>
        <div style="font-weight:700;margin-bottom:6px;">${e(t('Step by step'))}</div><ol style="margin:0;padding-left:20px;line-height:1.6;font-size:14px;">${(v.transcript || []).map(p => `<li>${e(p)}</li>`).join('')}</ol>
        <button type="button" class="btn-sm btn-sm-outline" id="ahv-back" style="margin-top:12px;">← ${e(t('All admin videos'))}</button></div></div>`;
  }
  async function drawAdminVideos() {
    const box = document.getElementById('admin-hv-body'); if (!box) return;
    let all;
    try { all = (await apiFetch('GET', '/admin/help-videos')).videos || []; }
    catch (x) { box.innerHTML = `<p>${e(x.message || t('Could not load the videos'))}</p>`; return; }
    const keys = adminKeys(), isSuper = !!(typeof AUTH !== 'undefined' && AUTH.user && AUTH.user.isSuperAdmin);
    const mine = all.filter(v => isSuper || !v.section || keys.has(v.section));
    const wireGrid = () => box.querySelectorAll('[data-ahv]').forEach(b => b.addEventListener('click', () => show(b.dataset.ahv)));
    const show = (key) => {
      const v = mine.find(x => x.key === key); if (!v) return;
      box.innerHTML = adminPlayer(v);
      document.getElementById('ahv-back').addEventListener('click', () => { box.innerHTML = adminGrid(mine); wireGrid(); });
      const vid = document.getElementById('ahv-video'); if (vid) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); vid.focus(); }
    };
    box.innerHTML = adminGrid(mine); wireGrid();
  }
  if (typeof getAdminNavItems === 'function') {
    const baseNav = getAdminNavItems;
    getAdminNavItems = function () { const l = baseNav.apply(this, arguments) || []; return l.some(i => i.key === 'helpvideos') ? l : [...l, { key: 'helpvideos', label: 'Help videos', icon: '▶️' }]; };
  }
  if (typeof ADMIN_SECTIONS === 'object' && ADMIN_SECTIONS) ADMIN_SECTIONS.helpvideos = () => `<div class="dash-header"><div><div class="dash-title">${e(t('Help videos for the team'))}</div><div class="dash-sub">${e(t('How to do each job in Admin, recorded on the real screens. Only admins can watch these.'))}</div></div></div><div class="panel" id="admin-hv-body">${e(t('Loading…'))}</div>`;
  if (typeof selectAdminSection === 'function') {
    const baseSel = selectAdminSection;
    selectAdminSection = function (key) { const r = baseSel.apply(this, arguments); if (key === 'helpvideos') drawAdminVideos(); return r; };
  }

  // ── "Watch how it works" where people get stuck ─────────────────────
  // [the element it sits above, the video, where to put it]
  const SPOTS = [
    ['#rides-body', 'rides'], ['#pj-progress', 'services'], ['#my-store-body', 'stores'], ['#market-body', 'market'],
    ['#deliveries-body', 'deliveries'], ['#verification-action-area', 'verification'], ['#cart-section-body', 'cart'], ['#cart-body', 'cart'], // (not above a chat: on a phone the chat fills the screen down to the keyboard)
    ['#mkf-title', 'sell', true], ['#gf-name', 'stores', true],
  ];
  function chip(key) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-sm btn-sm-ghost help-chip'; b.dataset.helpChip = key;
    b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;padding:6px 12px;border:1px solid var(--border);border-radius:999px;font-size:14px;font-weight:600;color:var(--teal);min-height:44px;';
    b.innerHTML = `<span aria-hidden="true">▶</span> ${e(t('Watch how it works'))}`;
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); window.openHelpVideos(key); });
    return b;
  }
  function place() {
    if (role() === 'admin') return; // admins have their own videos, in Admin → Help videos
    for (const [sel, key, inField] of SPOTS) {
      const el = document.querySelector(sel); if (!el) continue;
      const host = inField ? (el.closest('.form-group') || el) : el;
      const prev = host.previousElementSibling;
      if (prev && prev.dataset && prev.dataset.helpChip === key) continue;
      host.parentNode.insertBefore(chip(key), host);
    }
  }
  let queued = false;
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { place(); } catch (x) {} }); };
  if (typeof MutationObserver === 'function') new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  later();
})();
