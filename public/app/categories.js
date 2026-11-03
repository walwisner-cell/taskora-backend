// v135: choosing the kind of work, the way international marketplaces do it.
//
// - One worldwide list, grouped (Home repairs, Cleaning, Outdoor & garden...).
// - The customer sees only what is offered in their country, with how many
//   pros offer it near them, so they know before posting.
// - A search box filters the list as they type ("yard", "plumber" work too).
// - Choosing something with no pros nearby says so plainly, before posting.
// - Admins can switch a category off in particular countries (Categories &
//   Countries page), for local law or licensing.
(function () {
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const tn = (n) => (typeof translateCategoryName === 'function' ? translateCategoryName(n) : n);
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Search kinds of work': 'Buscar tipos de trabajo', 'e.g. plumber, yard, braids': 'p. ej. plomero, jardín, trenzas',
      'near you': 'cerca de ti', 'in': 'en', 'no pros yet': 'sin profesionales aún',
      'Home repairs & maintenance': 'Reparaciones y mantenimiento', 'Cleaning': 'Limpieza', 'Outdoor & garden': 'Exterior y jardín',
      'Moving & delivery': 'Mudanzas y entregas', 'Beauty & wellness': 'Belleza y bienestar', 'Lessons & tutoring': 'Clases y tutorías',
      'Events & media': 'Eventos y medios', 'Vehicles': 'Vehículos', 'Pets': 'Mascotas', 'Care': 'Cuidado', 'Business & tech': 'Negocios y tecnología',
      'Other services': 'Otros servicios', 'Nothing matches. Choose "Other" below and describe it.': 'Nada coincide. Elige "Otro" abajo y descríbelo.',
      'No pros offer this in your area yet. You can still post it, but you may not get a response until pros join.': 'Todavía no hay profesionales que ofrezcan esto en tu zona. Puedes publicarlo, pero quizá no recibas respuesta hasta que se unan profesionales.',
      'pros offer this near you.': 'profesionales ofrecen esto cerca de ti.', 'pro offers this near you.': 'profesional ofrece esto cerca de ti.',
      'pros offer this in': 'profesionales ofrecen esto en', 'pro offers this in': 'profesional ofrece esto en',
      'Showing the kinds of work offered in': 'Se muestran los tipos de trabajo que se ofrecen en',
    });
  } catch (err) {}

  const ORDER = ['Home repairs & maintenance', 'Cleaning', 'Outdoor & garden', 'Moving & delivery', 'Beauty & wellness', 'Lessons & tutoring', 'Events & media', 'Vehicles', 'Pets', 'Care', 'Business & tech', 'Other services'];
  let LOCAL = null; // the categories for this customer's country, with counts

  function countLabel(c) {
    if (c.cityCount > 0) return `${c.cityCount} ${t('near you')}`;
    if (c.countryCount > 0) return `${c.countryCount} ${t('in')} ${COUNTRY}`;
    if (c.countryCount === 0) return t('no pros yet');
    return '';
  }
  let COUNTRY = '';
  function words(c) {
    const extra = (typeof COMPOSER_WORDS === 'object' && COMPOSER_WORDS[String(c.name).toLowerCase()]) || [];
    return [c.name, tn(c.name), c.group, ...extra].join(' ').toLowerCase();
  }
  function optionsHTML(list, query) {
    const q = String(query || '').trim().toLowerCase();
    const shown = q ? list.filter(c => words(c).includes(q) || q.split(/\s+/).every(w => words(c).includes(w))) : list;
    const groups = new Map();
    for (const c of shown) { const g = c.group || 'Other services'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); }
    const keys = [...groups.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const html = keys.map(g => `<optgroup label="${e(t(g))}">${groups.get(g).sort((a, b) => tn(a.name).localeCompare(tn(b.name))).map(c => {
      const n = countLabel(c);
      return `<option value="${e(c.name)}">${e(tn(c.name))}${n ? ` · ${e(n)}` : ''}</option>`;
    }).join('')}</optgroup>`).join('');
    return { html, count: shown.length };
  }
  function hint() {
    const sel = document.getElementById('pj-category'); const box = document.getElementById('pj-cat-hint');
    if (!sel || !box || !LOCAL) return;
    const c = LOCAL.find(x => x.name === sel.value);
    if (!c) { box.textContent = ''; return; }
    if (c.cityCount > 0) box.innerHTML = `<span style="color:#15803d;">${c.cityCount} ${e(t(c.cityCount === 1 ? 'pro offers this near you.' : 'pros offer this near you.'))}</span>`;
    else if (c.countryCount > 0) box.innerHTML = `${c.countryCount} ${e(t(c.countryCount === 1 ? 'pro offers this in' : 'pros offer this in'))} ${e(COUNTRY)}.`;
    else box.innerHTML = `<span style="color:#B45309;">${e(t('No pros offer this in your area yet. You can still post it, but you may not get a response until pros join.'))}</span>`;
  }
  async function enhance() {
    const sel = document.getElementById('pj-category'); if (!sel || sel.dataset.v135) return;
    sel.dataset.v135 = '1';
    const u = (typeof AUTH !== 'undefined' && AUTH.user) || {};
    COUNTRY = u.country || '';
    try {
      const q = new URLSearchParams(); if (u.country) q.set('country', u.country); if (u.city) q.set('city', u.city);
      LOCAL = (await apiFetch('GET', `/categories?${q.toString()}`)).categories || [];
    } catch (err) { LOCAL = null; return; } // keep the plain list
    if (!document.body.contains(sel)) return;
    const other = '<option value="__other__">' + e(t('Other (not listed, describe below)')) + '</option>';
    const search = document.createElement('input');
    search.type = 'search'; search.className = 'form-input'; search.id = 'pj-cat-search'; search.autocomplete = 'off';
    search.placeholder = t('e.g. plumber, yard, braids'); search.setAttribute('aria-label', t('Search kinds of work'));
    search.style.marginBottom = '8px';
    sel.insertAdjacentElement('beforebegin', search);
    const box = document.createElement('div'); box.id = 'pj-cat-hint'; box.style.cssText = 'font-size:13px;color:var(--slate);margin-top:6px;line-height:1.45;';
    sel.insertAdjacentElement('afterend', box);
    if (COUNTRY) { const note = document.createElement('div'); note.style.cssText = 'font-size:12.5px;color:var(--muted);margin-top:4px;'; note.textContent = `${t('Showing the kinds of work offered in')} ${COUNTRY}.`; box.insertAdjacentElement('afterend', note); }
    const draw = () => {
      const keep = sel.value;
      const { html, count } = optionsHTML(LOCAL, search.value);
      sel.innerHTML = html + other;
      if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
      else if (count) sel.selectedIndex = 0; else sel.value = '__other__';
      sel.dispatchEvent(new Event('change'));
      if (!count && search.value.trim()) box.textContent = t('Nothing matches. Choose "Other" below and describe it.');
    };
    search.addEventListener('input', draw);
    sel.addEventListener('change', hint);
    draw();
  }
  if (typeof openPostJobModal === 'function') {
    const f = openPostJobModal;
    openPostJobModal = function () { const r = f.apply(this, arguments); enhance(); return r; };
  }
  window.enhanceCategoryPicker = enhance;

  // Admin: which countries a category is switched off in.
  window.editCategoryCountries = async function (id, name, current) {
    const now = (current || '').split('|').filter(Boolean);
    const msg = `${name}: ${t('which countries should it be switched off in? Type country names separated by commas, or type none to offer it in every country.')}`;
    const p = confirmDialog(msg, { requireTextInput: true, confirmLabel: t('Save') });
    const input = document.getElementById('confirm-dialog-textinput');
    if (input) input.value = now.length ? now.join(', ') : 'none';
    const text = await p;
    if (!text) return;
    const list = /^(none|all|everywhere)$/i.test(text.trim()) ? [] : String(text).split(',').map(x => x.trim()).filter(Boolean);
    try {
      await apiFetch('PATCH', `/admin/categories/${encodeURIComponent(id)}/countries`, { notOfferedIn: list });
      showToast(list.length ? `${name}: ${t('switched off in')} ${list.join(', ')}` : `${name}: ${t('offered in every country')}`);
      if (typeof loadAdminData === 'function') { await loadAdminData(); selectAdminSection('categories'); }
    } catch (x) { showToast(x.message || t('Could not save')); }
  };
})();
