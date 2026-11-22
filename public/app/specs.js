// v177: item specifics, the details buyers need for each kind of good (a
// phone's storage and network, an appliance's voltage and plug, cement's
// grade, a pipe's diameter), as Amazon, eBay and Jumia ask for them.
// The list comes from the server (src/specs.js, sent with /market/categories),
// so the form and the server's checks always agree.
//
//   specsLoad()                      → the templates (fetched once)
//   specsBoxHTML(prefix)             → an empty box to draw the form into
//   specsDraw(prefix, category, values, extra)  → draws the fields for a category
//   specsRead(prefix)                → { specs, specsExtra } to send
//   specsTableHTML(rows)             → the buyer's "Details" table
//   specsLine(rows, n)               → "128 GB · Dual SIM · Black", for a card
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  let TPL = null, loading = null;
  const STATE = {}; // prefix → { cat, values, extra }

  window.specsLoad = function () {
    if (TPL) return Promise.resolve(TPL);
    if (!loading) loading = apiFetch('GET', '/market/categories').then(r => { TPL = r.specs || null; if (r.categories && !(window.MARKET_CATS && window.MARKET_CATS.length)) window.MARKET_CATS = r.categories; return TPL; }).catch(() => { loading = null; return null; });
    return loading;
  };
  window.specsTemplates = () => TPL;
  window.specsFor = (cat) => (TPL && TPL.categories[cat]) || [];
  window.specsBoxHTML = (prefix) => `<div id="${prefix}-specs-box" class="specs-box" style="margin:4px 0 12px;"></div>`;

  function readInto(prefix) {
    const st = STATE[prefix]; if (!st) return;
    for (const inp of document.querySelectorAll(`[data-spec-of="${prefix}"]`)) st.values[inp.dataset.key] = inp.value;
    const names = document.querySelectorAll(`[data-specx-of="${prefix}"][data-part="name"]`);
    if (names.length || el(`${prefix}-specs-x`)) st.extra = [...names].map(n => ({ name: n.value, value: (document.querySelector(`[data-specx-of="${prefix}"][data-part="value"][data-i="${n.dataset.i}"]`) || {}).value || '' }));
  }
  function filled(prefix) {
    const st = STATE[prefix], keys = window.specsFor(st.cat);
    return keys.filter(k => String(st.values[k] == null ? '' : st.values[k]).trim() !== '').length;
  }
  function countText(prefix) {
    const st = STATE[prefix], n = filled(prefix), of = window.specsFor(st.cat).length;
    return `${t('Details filled in')}: ${n}/${of}`;
  }
  function fieldHTML(prefix, k) {
    const f = TPL.fields[k], st = STATE[prefix], val = st.values[k] == null ? '' : String(st.values[k]);
    const id = `${prefix}-spec-${k}`, common = `id="${id}" data-spec-of="${prefix}" data-key="${k}" oninput="specsCount(${jsArg(prefix)})" onchange="specsCount(${jsArg(prefix)})"`;
    let input;
    if (f.type === 'choice') input = `<select ${common} class="form-input form-select"><option value="">${e(t('Not given'))}</option>${f.options.map(o => `<option value="${e(o)}" ${o === val ? 'selected' : ''}>${e(t(o))}</option>`).join('')}</select>`;
    else if (f.type === 'number') input = `<div style="display:flex;align-items:center;gap:6px;"><input ${common} class="form-input" type="number" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step || 'any'}" value="${e(val)}" ${f.ph ? `placeholder="${e(t(f.ph))}"` : ''} style="flex:1;min-width:0;"/>${f.unit ? `<span style="color:var(--slate);font-size:13px;">${e(t(f.unit))}</span>` : ''}</div>`;
    else if ((f.max || 60) > 120) input = `<textarea ${common} class="form-input" rows="2" maxlength="${f.max}" ${f.ph ? `placeholder="${e(t(f.ph))}"` : ''}>${e(val)}</textarea>`;
    else input = `<input ${common} class="form-input" maxlength="${f.max || 60}" value="${e(val)}" ${f.ph ? `placeholder="${e(t(f.ph))}"` : ''}/>`;
    const wide = f.type === 'text' && (f.max || 60) > 80;
    return `<div class="form-group" style="flex:${wide ? '1 1 100%' : '1 1 200px'};min-width:0;margin-bottom:8px;"><label class="form-label" for="${id}" style="font-size:13px;">${e(t(f.label))}</label>${input}</div>`;
  }
  function extraHTML(prefix) {
    const st = STATE[prefix], max = TPL.maxExtra || 5;
    return `<div id="${prefix}-specs-x">${st.extra.map((x, i) => `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;"><input class="form-input" data-specx-of="${prefix}" data-part="name" data-i="${i}" maxlength="30" value="${e(x.name)}" placeholder="${e(t('Detail, e.g. Charger'))}" aria-label="${e(t('Name of the detail'))}" style="flex:1 1 110px;min-width:0;"/><input class="form-input" data-specx-of="${prefix}" data-part="value" data-i="${i}" maxlength="80" value="${e(x.value)}" placeholder="${e(t('e.g. 25 W fast charger included'))}" aria-label="${e(t('What it is'))}" style="flex:2 1 160px;min-width:0;"/><button type="button" class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="specsExtraRemove(${jsArg(prefix)},${i})" aria-label="${e(t('Remove'))}">✕</button></div>`).join('')}
      ${st.extra.length < max ? `<button type="button" class="btn-sm btn-sm-outline" onclick="specsExtraAdd(${jsArg(prefix)})">+ ${e(t('Add a detail of your own'))}</button>` : ''}</div>`;
  }
  window.specsDraw = function (prefix, cat, values, extra, keepState) {
    const box = el(`${prefix}-specs-box`); if (!box) return;
    if (STATE[prefix] && values === undefined && !keepState) readInto(prefix); // what was typed survives a redraw
    const st = STATE[prefix] = STATE[prefix] && values === undefined ? STATE[prefix] : { values: {}, extra: [] };
    if (values !== undefined) { st.values = { ...(values || {}) }; st.extra = (extra || []).map(x => ({ ...x })); }
    st.cat = cat || '';
    if (!TPL) { box.innerHTML = ''; window.specsLoad().then(() => { if (TPL) window.specsDraw(prefix, st.cat); }); return; }
    const keys = window.specsFor(st.cat);
    // Details already saved that this category doesn't ask for stay, so nothing typed is lost.
    const others = Object.keys(st.values).filter(k => !keys.includes(k) && TPL.fields[k] && String(st.values[k]).trim() !== '');
    box.innerHTML = `<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;"><strong style="color:var(--navy);">${e(t('Details buyers look for'))}</strong>${keys.length ? `<span id="${prefix}-specs-count" aria-live="polite" style="font-size:12.5px;color:var(--slate);">${e(countText(prefix))}</span>` : ''}</div>
      <div style="font-size:12.5px;color:var(--muted);margin:2px 0 8px;">${e(t(keys.length ? 'All optional, but buyers search and compare by these. Fill in what you know.' : 'Choose the category above to see the details buyers look for.'))}</div>
      ${keys.length ? `<div style="display:flex;flex-wrap:wrap;gap:0 10px;">${keys.map(k => fieldHTML(prefix, k)).join('')}${others.map(k => fieldHTML(prefix, k)).join('')}</div>` : ''}
      ${keys.length ? `<div style="font-size:12.5px;color:var(--slate);margin:2px 0 6px;">${e(t('Something else buyers should know?'))}</div>${extraHTML(prefix)}` : ''}
    </div>`;
  };
  window.specsCount = function (prefix) { const c = el(`${prefix}-specs-count`); if (!c || !STATE[prefix]) return; readInto(prefix); c.textContent = countText(prefix); };
  window.specsExtraAdd = function (prefix) { readInto(prefix); const st = STATE[prefix]; if (st.extra.length < ((TPL && TPL.maxExtra) || 5)) st.extra.push({ name: '', value: '' }); window.specsDraw(prefix, st.cat, undefined, undefined, true); const n = document.querySelectorAll(`[data-specx-of="${prefix}"][data-part="name"]`); if (n.length) n[n.length - 1].focus(); };
  window.specsExtraRemove = function (prefix, i) { readInto(prefix); STATE[prefix].extra.splice(i, 1); window.specsDraw(prefix, STATE[prefix].cat, undefined, undefined, true); };
  // What to send: only the fields on the screen (so changing the category drops the old ones), blanks left out.
  window.specsRead = function (prefix) {
    if (!el(`${prefix}-specs-box`) || !STATE[prefix] || !TPL) return null;
    readInto(prefix);
    const specs = {};
    for (const inp of document.querySelectorAll(`[data-spec-of="${prefix}"]`)) { const v = String(inp.value).trim(); if (v !== '') specs[inp.dataset.key] = TPL.fields[inp.dataset.key].type === 'number' ? Number(v) : v; }
    const specsExtra = STATE[prefix].extra.map(x => ({ name: String(x.name || '').trim(), value: String(x.value || '').trim() })).filter(x => x.name || x.value);
    return { specs, specsExtra };
  };
  // The buyer's table: a real table, labels as row headers.
  // A detail's value in the reader's language: choices and units are translated, the seller's own words are not.
  function shown(r) {
    if (!r.key) return r.value;
    if (r.type === 'choice') return t(r.raw);
    if (r.type === 'number') return `${r.raw}${r.unit ? (r.unit === '%' ? '%' : ' ' + t(r.unit)) : ''}`;
    return r.raw != null ? String(r.raw) : r.value;
  }
  window.specsShown = shown;
  window.specsTableHTML = function (rows, id) {
    if (!rows || !rows.length) return '';
    return `<div ${id ? `id="${id}"` : ''} style="margin-top:14px;"><strong style="color:var(--navy);">${e(t('Details'))}</strong>
      <table style="border-collapse:collapse;font-size:13.5px;width:100%;margin-top:4px;"><tbody>${rows.map((r, i) => `<tr style="${i % 2 ? '' : 'background:#F6F8FB;'}"><th scope="row" style="text-align:left;font-weight:600;color:var(--slate);padding:6px 8px;width:42%;vertical-align:top;">${e(r.key ? t(r.label) : r.label)}</th><td style="padding:6px 8px;color:var(--text,#1b2533);overflow-wrap:anywhere;">${e(shown(r))}</td></tr>`).join('')}</tbody></table></div>`;
  };
  window.specsLine = function (rows, n) { return (rows || []).filter(r => r.key && String(r.value).length <= 24).slice(0, n || 3).map(shown).join(' · '); };
  // The aisle Trothen would choose from the name (for "Choose for me").
  let guessTimer = null;
  window.specsGuess = function (text, cb) {
    clearTimeout(guessTimer);
    guessTimer = setTimeout(() => { apiFetch('GET', '/market/guess-category?text=' + encodeURIComponent(String(text || '').slice(0, 300))).then(r => cb(r.category || null)).catch(() => {}); }, 350);
  };
  window.specsLoad();
})();
