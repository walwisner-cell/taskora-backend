// v185: the manuals for the Admin team, read inside Admin.
//
//  - "📘 Manual" on each Admin page (next to "Watch how it works"), and a list
//    of the manuals in Admin → Help videos.
//  - The manual opens over the page: contents on the left, the chapters, a box
//    to find a word, and a button to watch the video on the same subject.
//  - It can be read, not taken away: no download, save or print; copying, the
//    right-click menu, and the keys for saving, printing and copying are turned
//    off while it is open; and the reader's name, email and the time are drawn
//    across every page, so a photo of the screen shows who took it. The server
//    sends it with "no-store" (nothing kept by the browser) and logs each
//    opening in the Access Logs. (No web page can stop a photo of the screen:
//    the name across the page is what makes a copy traceable.)
(function () {
  'use strict';
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const ID = 'admin-manual';
  let LIST = null, loading = null, back = null;
  const isAdmin = () => { try { return !!(AUTH && AUTH.user && AUTH.user.role === 'admin'); } catch (x) { return false; } };

  function list() {
    if (LIST) return Promise.resolve(LIST);
    if (!loading) loading = apiFetch('GET', '/admin/manuals').then(r => (LIST = r.manuals || [])).catch(x => { loading = null; throw x; });
    return loading;
  }
  function adminKeys() { try { return new Set((typeof getAdminNavItems === 'function' ? getAdminNavItems() : []).map(i => i.key)); } catch (x) { return new Set(); } }
  // the manuals for the parts of Admin this person can open
  function mine(all) {
    const keys = adminKeys(), sup = !!(AUTH.user && AUTH.user.isSuperAdmin);
    return all.filter(m => sup || !m.sections.length || m.sections.some(s => keys.has(s)));
  }
  const forSection = (all, section) => mine(all).find(m => m.sections[0] === section) || mine(all).find(m => m.sections.includes(section)) || null;

  // ── the styles (once) ─────────────────────────────────────────────────
  function styles() {
    if (document.getElementById('am-style')) return;
    const s = document.createElement('style'); s.id = 'am-style';
    s.textContent = `
#${ID}{position:fixed;inset:0;z-index:6000;background:rgba(15,38,64,.55);display:flex;align-items:stretch;justify-content:center}
#${ID} .am-sheet{position:relative;background:var(--white,#fff);color:var(--ink,#1B2430);width:min(1180px,100%);display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.35)}
#${ID} .am-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border,#E3E7EE);background:var(--offwhite,#F7F8FA)}
#${ID} .am-top h2{margin:0;font-size:19px;color:var(--navy,#0F2640);flex:1 1 220px;min-width:0}
#${ID} .am-find{min-height:44px;flex:0 1 240px;min-width:0}
#${ID} .am-main{display:flex;flex:1;min-height:0}
#${ID} nav.am-toc{flex:0 0 250px;overflow:auto;border-right:1px solid var(--border,#E3E7EE);padding:12px 8px;font-size:14px}
#${ID} nav.am-toc a{display:block;padding:9px 10px;border-radius:8px;color:var(--navy,#0F2640);text-decoration:none;min-height:44px;box-sizing:border-box;line-height:1.35}
#${ID} nav.am-toc a:hover,#${ID} nav.am-toc a:focus{background:var(--offwhite,#F0F3F7);outline:2px solid transparent}
#${ID} nav.am-toc a:focus-visible{outline:2px solid var(--teal,#1F7A8C)}
#${ID} .am-scroll{flex:1;overflow:auto;position:relative}
#${ID} .am-doc{position:relative;padding:22px 28px 60px;max-width:820px;line-height:1.65;font-size:15.5px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#${ID} .am-doc h2{font-size:21px;color:var(--navy,#0F2640);margin:30px 0 10px;padding-top:8px;border-top:1px solid var(--border,#E3E7EE)}
#${ID} .am-doc h2:first-child{border-top:0;margin-top:0}
#${ID} .am-doc h3{font-size:17px;color:var(--navy,#0F2640);margin:20px 0 6px}
#${ID} .am-doc h4{font-size:15.5px;margin:16px 0 4px}
#${ID} .am-doc p{margin:0 0 12px}
#${ID} .am-doc ul,#${ID} .am-doc ol{padding-left:24px}
#${ID} .am-doc li{margin:4px 0}
#${ID} .am-ui{font-weight:700;color:var(--navy,#0F2640);background:var(--offwhite,#EEF2F6);border:1px solid var(--border,#DCE2EA);border-radius:5px;padding:0 5px;white-space:nowrap}
#${ID} .am-box{border-left:5px solid var(--teal,#1F7A8C);background:#F1F7F8;border-radius:8px;padding:8px 14px;margin:14px 0}
#${ID} .am-box p{margin:6px 0}
#${ID} .am-rule,#${ID} .am-policy{border-left-color:#0F2640;background:#EEF2F8}
#${ID} .am-warning{border-left-color:#B3261E;background:#FCEEEE}
#${ID} .am-tip{border-left-color:#2E8C6F;background:#EEF7F2}
#${ID} .am-example{border-left-color:#B07D00;background:#FBF5E6}
#${ID} .am-table{overflow-x:auto;margin:12px 0}
#${ID} table{border-collapse:collapse;width:100%;font-size:14.5px}
#${ID} th,#${ID} td{border:1px solid var(--border,#DCE2EA);padding:7px 9px;text-align:left;vertical-align:top}
#${ID} th{background:var(--offwhite,#F2F5F8)}
#${ID} mark.am-hit{background:#FFE58A;color:inherit;padding:0}
#${ID} mark.am-hit.am-now{background:#F2B705;outline:2px solid #B07D00}
#${ID} .am-mark{position:absolute;inset:0;pointer-events:none;z-index:2;background-repeat:repeat}
#${ID} .am-foot{font-size:12.5px;color:var(--slate,#5B6676);padding:8px 16px;border-top:1px solid var(--border,#E3E7EE)}
@media (max-width:820px){#${ID} nav.am-toc{display:none}#${ID} .am-doc{padding:16px 16px 50px}#${ID} .am-tocsel{display:block!important}}
@media print{html.am-open body *{visibility:hidden!important}html.am-open body::before{content:"Printing the Admin manuals is turned off.";visibility:visible;display:block;font:20px sans-serif;padding:40px}}`;
    document.head.appendChild(s);
  }
  // the reader's name, email and the time, across the page
  function watermark(reader) {
    const when = new Date(reader.at || Date.now()).toLocaleString();
    const text = `${reader.name || ''} · ${reader.email || ''} · ${when}`.replace(/[<>&"]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260"><text x="10" y="150" transform="rotate(-24 260 130)" font-family="Arial, sans-serif" font-size="17" fill="rgba(15,38,64,0.10)">${text}</text></svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }

  // ── stop saving, printing and copying while a manual is open ─────────
  const block = (ev) => { if (document.getElementById(ID)) { ev.preventDefault(); ev.stopPropagation(); return false; } };
  function onKey(ev) {
    if (!document.getElementById(ID)) return;
    if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
    const k = String(ev.key || '').toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && ['s', 'p', 'c', 'x', 'a', 'u'].includes(k)) { ev.preventDefault(); ev.stopPropagation(); toast(k === 'p' ? 'Printing the Admin manuals is turned off.' : k === 's' ? 'The Admin manuals can\'t be saved.' : 'The Admin manuals can\'t be copied.'); return; }
    if (k === 'printscreen') toast('Every page shows your name, so a copy can be traced.');
    if (ev.key === 'Tab') { // keep the keyboard inside the manual
      const f = [...document.getElementById(ID).querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent);
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
  }
  const toast = (m) => { try { showToast(t(m)); } catch (x) {} };
  const beforePrint = () => { if (document.getElementById(ID)) toast('Printing the Admin manuals is turned off.'); };

  function close() {
    const o = document.getElementById(ID); if (!o) return;
    o.remove(); // the manual is not left in the page
    document.documentElement.classList.remove('am-open');
    document.removeEventListener('keydown', onKey, true);
    for (const ev of ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart']) document.removeEventListener(ev, block, true);
    window.removeEventListener('beforeprint', beforePrint);
    if (back && document.contains(back)) { try { back.focus(); } catch (x) {} }
    back = null;
  }

  // ── find a word in the manual ─────────────────────────────────────────
  function find(doc, q, step) {
    doc.querySelectorAll('mark.am-hit').forEach(m => { const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
    const out = document.getElementById('am-count');
    const w = String(q || '').trim(); if (w.length < 2) { if (out) out.textContent = ''; return; }
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const walk = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT); const nodes = []; let n; while ((n = walk.nextNode())) if (re.test(n.nodeValue)) nodes.push(n);
    let hits = 0;
    for (const node of nodes) {
      const frag = document.createDocumentFragment(); let last = 0; const v = node.nodeValue; re.lastIndex = 0; let m;
      while ((m = re.exec(v))) { frag.appendChild(document.createTextNode(v.slice(last, m.index))); const mk = document.createElement('mark'); mk.className = 'am-hit'; mk.textContent = m[0]; frag.appendChild(mk); last = m.index + m[0].length; hits++; }
      frag.appendChild(document.createTextNode(v.slice(last))); node.parentNode.replaceChild(frag, node);
    }
    const all = [...doc.querySelectorAll('mark.am-hit')];
    find.at = all.length ? ((find.at || 0) + (step || 0) + all.length) % all.length : 0;
    if (all[find.at]) { all[find.at].classList.add('am-now'); all[find.at].scrollIntoView({ block: 'center' }); }
    if (out) out.textContent = hits ? `${find.at + 1} / ${hits}` : t('Not found');
  }

  // ── open a manual ─────────────────────────────────────────────────────
  window.openAdminManual = async function (key, at) {
    if (!isAdmin()) return;
    styles(); close();
    back = document.activeElement;
    const o = document.createElement('div'); o.id = ID; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'am-title');
    o.innerHTML = `<div class="am-sheet"><div class="am-top"><h2 id="am-title">${e(t('Loading…'))}</h2><button type="button" class="btn-sm btn-sm-outline" id="am-close" style="min-height:44px;">✕ ${e(t('Close'))}</button></div></div>`;
    o.addEventListener('click', (ev) => { if (ev.target === o) close(); });
    document.body.appendChild(o);
    document.documentElement.classList.add('am-open');
    document.addEventListener('keydown', onKey, true);
    for (const ev of ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart']) document.addEventListener(ev, block, true);
    window.addEventListener('beforeprint', beforePrint);
    o.querySelector('#am-close').addEventListener('click', close);
    let r;
    try { r = await apiFetch('GET', '/admin/manuals/' + encodeURIComponent(key)); }
    catch (x) { const h = o.querySelector('#am-title'); if (h) h.textContent = x.message || t('The manual can\'t be opened right now.'); return; }
    if (!document.getElementById(ID)) return; // closed while loading
    const m = r.manual, reader = r.reader || {};
    o.querySelector('.am-sheet').innerHTML = `
      <div class="am-top">
        <h2 id="am-title">📘 ${e(m.title)}</h2>
        <label class="sr-only" for="am-find" style="position:absolute;left:-9999px;">${e(t('Find in this manual'))}</label>
        <input id="am-find" class="form-input am-find" type="search" autocomplete="off" placeholder="${e(t('Find in this manual'))}"/>
        <span id="am-count" role="status" aria-live="polite" style="font-size:13px;color:var(--slate);min-width:48px;"></span>
        ${m.video ? `<button type="button" class="btn-sm btn-sm-outline" id="am-video" style="min-height:44px;">▶ ${e(t('Watch the video'))}</button>` : ''}
        <button type="button" class="btn-sm btn-sm-outline" id="am-close" style="min-height:44px;">✕ ${e(t('Close'))}</button>
      </div>
      <select class="form-input am-tocsel" id="am-tocsel" aria-label="${e(t('Go to a chapter'))}" style="display:none;margin:8px 16px 0;min-height:44px;width:auto;">${m.chapters.map(c => `<option value="${e(c.id)}">${e(c.title)}</option>`).join('')}</select>
      <div class="am-main">
        <nav class="am-toc" aria-label="${e(t('Contents'))}">${m.chapters.map((c, i) => `<a href="#${e(c.id)}" data-am="${e(c.id)}">${i + 1}. ${e(c.title)}</a>`).join('')}</nav>
        <div class="am-scroll" id="am-scroll"><div class="am-doc" id="am-doc">${m.html}<div class="am-mark" aria-hidden="true"></div></div></div>
      </div>
      <div class="am-foot">${e(t('For the Trothen team only. Do not share, copy or photograph. Opened by'))} ${e(reader.name || '')} (${e(reader.email || '')}). ${m.updated ? e(t('Last updated')) + ' ' + e(m.updated) + '.' : ''}</div>`;
    const doc = o.querySelector('#am-doc'), sc = o.querySelector('#am-scroll');
    o.querySelector('.am-mark').style.backgroundImage = watermark(reader); // the reader's name across every page
    const go = (id) => { const h = doc.querySelector('#' + CSS.escape(id)); if (h) sc.scrollTop = h.offsetTop - 8; };
    o.querySelectorAll('[data-am]').forEach(a => a.addEventListener('click', (ev) => { ev.preventDefault(); go(a.dataset.am); }));
    o.querySelector('#am-tocsel').addEventListener('change', (ev) => go(ev.target.value));
    o.querySelector('#am-close').addEventListener('click', close);
    const v = o.querySelector('#am-video'); if (v) v.addEventListener('click', () => { const k = m.video; close(); if (typeof window.openAdminVideo === 'function') window.openAdminVideo(k); });
    const f = o.querySelector('#am-find'); let tm = null; find.at = 0;
    f.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { find.at = 0; find(doc, f.value, 0); }, 200); });
    f.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); find(doc, f.value, ev.shiftKey ? -1 : 1); } });
    if (at) go(at);
    o.querySelector('#am-close').focus();
  };
  window.closeAdminManual = close;

  // ── "📘 Manual" on each Admin page ────────────────────────────────────
  function button(m) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-sm btn-sm-ghost'; b.dataset.adminManual = m.key;
    b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;padding:6px 12px;border:1px solid var(--border);border-radius:999px;font-size:14px;font-weight:600;color:var(--navy);min-height:44px;';
    b.innerHTML = `<svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" style="flex:none"><path d="M2 2.5C2 1.7 2.7 1 3.5 1H8v13H3.5A1.5 1.5 0 0 1 2 12.5z" fill="currentColor" opacity=".85"/><path d="M8 1h4.5c.8 0 1.5.7 1.5 1.5v10c0 .8-.7 1.5-1.5 1.5H8z" fill="currentColor" opacity=".55"/></svg> ${e(t('Manual'))}`;
    b.setAttribute('aria-label', t('Read the manual') + ': ' + m.title);
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); window.openAdminManual(m.key); });
    return b;
  }
  async function place(section) {
    if (!isAdmin() || section === 'helpvideos') return;
    let all; try { all = await list(); } catch (x) { return; }
    const m = forSection(all, section); if (!m) return;
    const main = document.getElementById('admin-main'); if (!main || main.querySelector('[data-admin-manual]')) return;
    const head = main.querySelector('.dash-header'); if (!head) return;
    let row = main.querySelector('.help-chip-row');
    if (!row) { row = document.createElement('div'); row.className = 'help-chip-row'; head.insertAdjacentElement('afterend', row); }
    row.style.display = 'flex'; row.style.flexWrap = 'wrap'; row.style.gap = '0 8px';
    row.appendChild(button(m));
  }
  // the list in Admin → Help videos
  async function drawList() {
    const box = document.getElementById('admin-manuals-body'); if (!box) return;
    let all; try { all = mine(await list()); } catch (x) { box.innerHTML = `<p>${e(x.message || t('The manuals can\'t be loaded right now.'))}</p>`; return; }
    box.innerHTML = all.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">${all.map(m => `
      <button type="button" data-am-open="${e(m.key)}" style="text-align:left;border:1px solid var(--border);border-radius:12px;background:var(--white,#fff);padding:12px 14px;cursor:pointer;color:inherit;font:inherit;min-height:44px;">
        <strong style="display:block;color:var(--navy);">📘 ${e(m.title)}</strong>
        <span style="display:block;font-size:13px;color:var(--slate);margin-top:3px;">${m.chapters.length} ${e(t('chapters'))} · ${Math.max(1, Math.round(m.words / 200))} ${e(t('min read'))}</span></button>`).join('')}</div>`
      : `<p style="color:var(--slate);">${e(t('No manuals yet.'))}</p>`;
    box.querySelectorAll('[data-am-open]').forEach(b => b.addEventListener('click', () => window.openAdminManual(b.dataset.amOpen)));
  }
  if (typeof ADMIN_SECTIONS === 'object' && ADMIN_SECTIONS && ADMIN_SECTIONS.helpvideos) {
    const base = ADMIN_SECTIONS.helpvideos;
    ADMIN_SECTIONS.helpvideos = function () { return base.apply(this, arguments) + `<div class="panel" style="margin-top:16px;"><div class="panel-title">${e(t('Manuals'))}</div><p style="margin:0 0 12px;color:var(--slate);font-size:14px;">${e(t('Step-by-step guides for each part of Admin. They open here to read; they can\'t be downloaded, printed or copied.'))}</p><div id="admin-manuals-body">${e(t('Loading…'))}</div></div>`; };
  }
  if (typeof selectAdminSection === 'function') {
    const baseSel = selectAdminSection;
    selectAdminSection = function (key) { const r = baseSel.apply(this, arguments); if (key === 'helpvideos') drawList(); else place(key).catch(() => {}); return r; };
  }
})();
