// v135: custom admin permissions (the screens). The rules themselves are on
// the server (src/admin-permissions.js); this file only shows them.
//
// - New Admin: Role → "Custom permissions". Every admin section with
//   Off / View / Manage, a "Start from a role" shortcut, and the area they
//   cover (one city, one country, or all regions).
// - Functional Team Members: a Permissions button for each team member, to
//   change what they can do (a fixed role can be switched to custom here).
// - A custom admin's menu shows only the sections they were given.
(function () {
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s));
  let AREAS = null;
  async function areas() {
    if (AREAS) return AREAS;
    try { AREAS = (await apiFetch('GET', '/admin/permission-areas')).areas; } catch (x) { AREAS = []; }
    return AREAS;
  }
  const NAV_KEY = { contact: 'contact-submissions' };
  const LABELS = { overview: 'Overview', approvals: 'User Approvals', people: 'Customers & Providers', verification: 'Verification Queue', stores: 'Stores & Skills', market: 'Market', rides: 'Rides', providerscores: 'Provider Scores', disputes: 'Disputes', fraud: 'Fraud & Safety', payments: 'Payments', tokens: 'Tokens', custpay: 'Customer Payments', pricing: 'Plans & Pricing', advertising: 'Advertising', promotions: 'Promotions', careers: 'Job Applications', contact: 'Contact Us Messages', reports: 'Reports', sales: 'Sales Inquiries', organizations: 'Organizations', accesslogs: 'Access Logs' };
  const ICON = { overview: '📊', approvals: '✅', people: '👥', verification: '🪪', stores: '🛍️', market: '🛒', rides: '🛵', providerscores: '📊', disputes: '⚖️', fraud: '🚩', payments: '💳', tokens: '🪙', custpay: '💵', pricing: '💲', advertising: '📣', promotions: '🎉', careers: '💼', contact: '✉️', reports: '📈', sales: '💼', organizations: '🏢', accesslogs: '🔍' };

  // The fixed roles as starting points.
  const M = 'manage', V = 'view';
  const TEMPLATES = {
    '': { label: 'Regional Admin', p: { overview: M, approvals: M, people: M, verification: M, stores: M, rides: M, providerscores: M, disputes: M, fraud: M, payments: V, pricing: M, advertising: M, promotions: M, careers: M, contact: M, reports: V } },
    verification: { label: 'Verification Team', p: { approvals: M, verification: M, stores: M, rides: M, providerscores: V } },
    disputes: { label: 'Disputes Team', p: { disputes: M, fraud: M } },
    financial: { label: 'Financial Team', p: { payments: V, tokens: M, custpay: M, reports: V } },
    customer_service: { label: 'Customer Service', p: { approvals: M, verification: M, stores: M, rides: M, disputes: M, tokens: V, custpay: V } },
    legal: { label: 'Legal', p: { disputes: V, payments: V, accesslogs: V } },
    sales: { label: 'Sales Team', p: { sales: M, organizations: M } },
    hr: { label: 'HR Team', p: { careers: M } },
  };
  TEMPLATES.accountant = TEMPLATES.financial; TEMPLATES.controller = TEMPLATES.financial;

  // v137: each section has a quick choice (Off, View, Manage, Custom) and,
  // under "Details", a tick box for every action in it.
  const readKeys = (a) => a.actions.filter(x => x.read).map(x => x.key);
  const allKeys = (a) => a.actions.map(x => x.key);
  function keysFor(a, v) {
    if (v === 'manage') return allKeys(a);
    if (v === 'view') return readKeys(a);
    if (Array.isArray(v)) { const k = allKeys(a).filter(x => v.includes(x)); return k.length && !k.includes('view') ? ['view', ...k] : k; }
    return [];
  }
  const same = (x, y) => x.length === y.length && x.every(k => y.includes(k));
  function levelOf(a, keys) {
    if (!keys.length) return '';
    if (same(keys, readKeys(a))) return 'view';
    if (same(keys, allKeys(a))) return 'manage';
    return 'custom';
  }
  function gridHTML(list, perms, prefix) {
    const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
    return `<div class="perm-grid" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
      ${list.map((a, i) => {
        const keys = keysFor(a, perms[a.key]); const lvl = levelOf(a, keys);
        const many = a.actions.length > 1;
        return `<div class="perm-row" data-area="${e(a.key)}" style="padding:9px 12px;${i ? 'border-top:1px solid var(--border);' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="min-width:0;"><div style="font-weight:600;color:var(--navy);font-size:14px;">${e(a.label)}</div><div style="font-size:12.5px;color:var(--slate);">${e(a.help)}</div>
            ${many ? `<button type="button" class="perm-toggle" style="background:none;border:0;padding:2px 0 0;color:var(--blue,#2563eb);font-size:12.5px;cursor:pointer;">Details · <span class="perm-count">${keys.length}</span> of ${a.actions.length} allowed</button>` : ''}</div>
          <select class="form-input form-select" data-perm="${e(a.key)}" id="${prefix}-${e(a.key)}" style="width:auto;min-width:120px;flex-shrink:0;padding:6px 30px 6px 10px;">
            ${opt('', 'Off', lvl)}${opt('view', 'View', lvl)}${a.actions.some(x => !x.read) ? opt('manage', 'Manage', lvl) : ''}${many ? opt('custom', 'Custom', lvl) : ''}
          </select></div>
        <div class="perm-actions" style="display:${lvl === 'custom' ? 'block' : 'none'};margin:8px 0 2px;padding:8px 10px;background:var(--bg-soft,#f6f8fb);border-radius:8px;">
          ${a.actions.map(x => `<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text,#1b2533);padding:3px 0;cursor:pointer;">
            <input type="checkbox" data-action="${e(x.key)}" ${keys.includes(x.key) ? 'checked' : ''}> ${e(x.label)}${x.read ? '' : ' <span style="font-size:11.5px;color:#8a5a00;background:#fff8e6;border-radius:6px;padding:1px 6px;">changes</span>'}</label>`).join('')}
        </div></div>`;
      }).join('')}
    </div>`;
  }
  // Keeps the quick choice and the tick boxes of one row in step.
  function wireGrid(root, list) {
    if (!root || root.dataset.wired) return; root.dataset.wired = '1';
    const def = (k) => list.find(a => a.key === k);
    const sync = (row) => {
      const a = def(row.dataset.area); const boxes = [...row.querySelectorAll('input[data-action]')];
      const keys = boxes.filter(b => b.checked).map(b => b.dataset.action);
      const c = row.querySelector('.perm-count'); if (c) c.textContent = keys.length;
      const view = boxes.find(b => b.dataset.action === 'view');
      if (view) view.disabled = keys.some(k => k !== 'view'); // you can't act on what you can't see
      return { a, keys };
    };
    root.addEventListener('change', (ev) => {
      const row = ev.target.closest('.perm-row'); if (!row) return;
      const a = def(row.dataset.area); if (!a) return;
      const panel = row.querySelector('.perm-actions');
      const sel = row.querySelector('select[data-perm]');
      if (ev.target === sel) {
        if (sel.value !== 'custom') {
          const keys = keysFor(a, sel.value);
          row.querySelectorAll('input[data-action]').forEach(b => { b.checked = keys.includes(b.dataset.action); });
        } else { panel.style.display = 'block'; const v = row.querySelector('input[data-action="view"]'); if (v && !row.querySelector('input[data-action]:checked')) v.checked = true; }
        sync(row);
        return;
      }
      if (ev.target.matches('input[data-action]')) {
        if (ev.target.checked && ev.target.dataset.action !== 'view') { const v = row.querySelector('input[data-action="view"]'); if (v) v.checked = true; }
        const { keys } = sync(row);
        const lvl = levelOf(a, keys); sel.value = lvl === '' ? '' : lvl;
      }
    });
    root.addEventListener('click', (ev) => {
      const t = ev.target.closest('.perm-toggle'); if (!t) return;
      const panel = t.closest('.perm-row').querySelector('.perm-actions');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    root.querySelectorAll('.perm-row').forEach(sync);
  }
  function readGrid(root) {
    const out = {};
    root.querySelectorAll('.perm-row').forEach(row => {
      const sel = row.querySelector('select[data-perm]');
      if (!sel || !sel.value) return;
      if (sel.value !== 'custom') { out[row.dataset.area] = sel.value; return; }
      const keys = [...row.querySelectorAll('input[data-action]:checked')].map(b => b.dataset.action);
      if (keys.length) out[row.dataset.area] = keys;
    });
    return out;
  }
  function templateSelectHTML(id) {
    return `<select class="form-input form-select" id="${id}" style="width:auto;">
      <option value="">Start from a role…</option>
      ${['', 'verification', 'disputes', 'financial', 'customer_service', 'legal', 'sales', 'hr'].map(k => `<option value="t:${k}">${e(TEMPLATES[k].label)}</option>`).join('')}
      <option value="t:none">Nothing (all Off)</option>
    </select>`;
  }
  function applyTemplate(root, value) {
    if (!value) return;
    const p = value === 't:none' ? {} : (TEMPLATES[value.slice(2)] || {}).p || {};
    root.querySelectorAll('select[data-perm]').forEach(s => {
      const want = p[s.dataset.perm] || '';
      s.value = [...s.options].some(o => o.value === want) ? want : (want === 'manage' ? 'view' : '');
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  const EXPLAIN = 'View: they can open the section and see its records. Manage: they can also do everything in it. Custom: tick exactly which actions they can take (open Details). Off: hidden and blocked.';
  const NOTE = 'Super-admin-only actions are never included: creating admins, Go-Live, Data Cleanup, platform settings and the legal pages.';

  // ── New Admin form ──────────────────────────────────────────────────
  async function enhanceNewAdminForm() {
    const dep = document.getElementById('loc-department');
    if (!dep || dep.dataset.v135 || !(AUTH.user && AUTH.user.isSuperAdmin)) return;
    dep.dataset.v135 = '1';
    const o = document.createElement('option'); o.value = 'custom'; o.textContent = 'Custom permissions: choose exactly what they can see and do';
    dep.appendChild(o);
    const list = await areas();
    const box = document.createElement('div'); box.id = 'loc-custom-box'; box.style.cssText = 'display:none;margin-top:12px;';
    box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="font-weight:700;color:var(--navy);">Permissions</div>${templateSelectHTML('loc-custom-template')}</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${e(EXPLAIN)}</div>
      ${gridHTML(list, {}, 'loc-perm')}
      <div style="font-size:12.5px;color:var(--muted);margin-top:8px;">${e(NOTE)}</div>`;
    const anchor = document.getElementById('loc-region-scoped-row') || dep;
    anchor.insertAdjacentElement('afterend', box);
    wireGrid(box, list);
    document.getElementById('loc-custom-template').addEventListener('change', (ev) => applyTemplate(box, ev.target.value));
    const scope = document.getElementById('loc-scope');
    dep.addEventListener('change', () => {
      const on = dep.value === 'custom';
      box.style.display = on ? 'block' : 'none';
      if (on) {
        const w = document.getElementById('loc-department-warning'); if (w) w.style.display = 'none';
        const r = document.getElementById('loc-region-scoped-row'); if (r) r.style.display = 'none';
      }
      if (scope) {
        let all = scope.querySelector('option[value="all"]');
        if (on && !all) { all = document.createElement('option'); all.value = 'all'; all.textContent = 'Every region (all countries)'; scope.appendChild(all); }
        if (!on && all) { if (scope.value === 'all') scope.value = 'country'; all.remove(); }
      }
    });
  }
  if (typeof createLocationAdmin === 'function') {
    const base = createLocationAdmin;
    createLocationAdmin = async function () {
      const dep = document.getElementById('loc-department');
      if (!dep || dep.value !== 'custom') return base.apply(this, arguments);
      const name = document.getElementById('loc-admin-name').value.trim();
      const email = document.getElementById('loc-admin-email').value.trim();
      const password = document.getElementById('loc-admin-password').value;
      const city = document.getElementById('loc-city').value.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      const country = document.getElementById('loc-country').value;
      const scope = (document.getElementById('loc-scope') || {}).value || 'country';
      const permissions = readGrid(document.getElementById('loc-custom-box'));
      if (!name || !email || !password || !city || !country) return showToast('Please fill in every field');
      if (!Object.keys(permissions).length) return showToast('Choose at least one section this admin can view or manage.');
      try {
        const { admin } = await apiFetch('POST', '/admin/sub-admins', { name, email, password, city, country, department: 'custom', scope, permissions });
        const n = Object.keys(permissions).length;
        showToast(`${admin.name} was created with access to ${n} section${n === 1 ? '' : 's'}${scope === 'all' ? ' in every region' : scope === 'country' ? ` in ${country}` : ` in ${city}`}.`);
        await loadAdminData(); selectAdminSection('locations');
      } catch (x) { showToast(x.message || 'Could not create admin'); }
    };
  }

  // ── Team members list: a Permissions button for each ────────────────
  function summary(a) {
    const p = a.adminPermissions || {};
    const keys = Object.keys(p);
    if (!keys.length) return 'No sections';
    const lab = (k) => LABELS[k] || k;
    const m = keys.filter(k => p[k] === 'manage').map(lab), v = keys.filter(k => p[k] === 'view').map(lab);
    const c = keys.filter(k => Array.isArray(p[k])).map(k => {
      const def = (AREAS || []).find(x => x.key === k);
      const acts = p[k].filter(x => x !== 'view').map(x => ((def && def.actions.find(y => y.key === x)) || {}).label || x);
      return `${lab(k)} (${acts.length ? acts.join('; ') : 'see only'})`;
    });
    return [m.length ? `Manage: ${m.join(', ')}` : '', v.length ? `View: ${v.join(', ')}` : '', c.length ? `Some actions: ${c.join(', ')}` : ''].filter(Boolean).join('. ');
  }
  if (typeof functionalAdminsTable === 'function') {
    const base = functionalAdminsTable;
    functionalAdminsTable = function (list) {
      const html = base(list);
      if (!(AUTH.user && AUTH.user.isSuperAdmin) || !list.length) return html;
      if (!AREAS) areas(); // so the summary can name each action
      const box = document.createElement('div'); box.innerHTML = html;
      box.querySelectorAll('tbody tr').forEach((tr, i) => {
        const a = list[i]; if (!a) return;
        if (a.adminDepartment === 'custom' && tr.children[2]) tr.children[2].innerHTML = `<strong>Custom permissions</strong><div style="font-size:12.5px;color:var(--slate);max-width:320px;white-space:normal;">${e(summary(a))}</div>`;
        if (a.adminDepartment === 'custom' && tr.children[3] && !a.regionScoped) tr.children[3].innerHTML = 'Every region';
        const actions = tr.querySelector('.row-actions');
        if (actions) {
          if (a.adminDepartment === 'custom') { const sb = [...actions.querySelectorAll('button')].find(b => /Make Global|Scope to/.test(b.textContent)); if (sb) sb.remove(); }
          actions.insertAdjacentHTML('afterbegin', `<button class="btn-sm btn-sm-primary" data-id="${e(a.id)}" onclick="editAdminPermissions(this.dataset.id)">Permissions</button> `);
        }
      });
      return box.innerHTML;
    };
  }
  window.editAdminPermissions = async function (id) {
    const a = (adminData.subAdmins || []).find(x => x.id === id); if (!a) return;
    const list = await areas();
    const start = a.adminDepartment === 'custom' ? (a.adminPermissions || {}) : ((TEMPLATES[a.adminDepartment || ''] || {}).p || {});
    const scopeNow = a.adminDepartment === 'custom' ? (a.regionScoped ? (a.adminScope === 'country' ? 'country' : 'city') : 'all') : (a.adminScope === 'country' ? 'country' : 'city');
    const html = `<div style="text-align:left;">
      <div style="font-weight:700;color:var(--navy);font-size:16px;">Permissions for ${e(a.name)}</div>
      ${a.adminDepartment !== 'custom' ? `<div style="font-size:13px;color:#8a5a00;background:#fff8e6;border:1px solid #f0d896;border-radius:8px;padding:8px 10px;margin:8px 0;">${e(a.name)} has the fixed role "${e((TEMPLATES[a.adminDepartment || ''] || {}).label || a.adminDepartment)}". Saving switches them to custom permissions, starting from that role.</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0;">
        <select class="form-input form-select" id="perm-edit-scope" style="width:auto;">
          <option value="city" ${scopeNow === 'city' ? 'selected' : ''}>Only ${e(a.city || 'their city')}</option>
          <option value="country" ${scopeNow === 'country' ? 'selected' : ''}>All of ${e(a.country || 'their country')}</option>
          <option value="all" ${scopeNow === 'all' ? 'selected' : ''}>Every region</option>
        </select>
        ${templateSelectHTML('perm-edit-template')}
      </div>
      <div style="font-size:12.5px;color:var(--slate);margin-bottom:6px;">${e(EXPLAIN)}</div>
      <div id="perm-edit-grid" style="max-height:50vh;overflow:auto;">${gridHTML(list, start, 'perm-edit')}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:8px;">${e(NOTE)}</div></div>`;
    const p = confirmDialog('', { confirmLabel: 'Save Permissions' });
    const msg = document.getElementById('confirm-dialog-message'); if (msg) msg.innerHTML = html;
    wireGrid(document.getElementById('perm-edit-grid'), list);
    const tpl = document.getElementById('perm-edit-template'); if (tpl) tpl.addEventListener('change', (ev) => applyTemplate(document.getElementById('perm-edit-grid'), ev.target.value));
    let permissions = null, scope = null;
    const grab = () => { permissions = readGrid(document.getElementById('perm-edit-grid')); scope = document.getElementById('perm-edit-scope').value; };
    const btn = document.getElementById('confirm-dialog-confirm-btn'); btn.addEventListener('click', grab, { once: true, capture: true });
    const ok = await p;
    if (!ok) return;
    if (!permissions) grab();
    if (!Object.keys(permissions).length) return showToast('Choose at least one section this admin can view or manage.');
    try {
      await apiFetch('PATCH', `/admin/sub-admins/${encodeURIComponent(id)}`, { department: 'custom', permissions, scope });
      showToast(`Permissions saved for ${a.name}. They apply from their next action.`);
      await loadAdminData(); selectAdminSection('locations');
    } catch (x) { showToast(x.message || 'Could not save permissions'); }
  };

  // ── A custom admin's menu ───────────────────────────────────────────
  if (typeof getAdminNavItems === 'function') {
    const base = getAdminNavItems;
    getAdminNavItems = function () {
      const u = AUTH.user || {};
      if (u.adminDepartment !== 'custom' || u.isSuperAdmin) return base.apply(this, arguments);
      const p = u.adminPermissions || {};
      const order = ['overview', 'approvals', 'people', 'verification', 'stores', 'market', 'rides', 'providerscores', 'disputes', 'fraud', 'payments', 'tokens', 'custpay', 'pricing', 'advertising', 'promotions', 'careers', 'contact', 'reports', 'sales', 'organizations', 'accesslogs'];
      const items = order.filter(k => p[k]).map(k => ({ key: NAV_KEY[k] || k, label: LABELS[k], icon: ICON[k] || '•' }));
      items.push({ key: 'settings', label: 'Settings', icon: '⚙️' });
      return items;
    };
  }

  if (typeof selectAdminSection === 'function') {
    const f = selectAdminSection;
    selectAdminSection = function (key) { const r = f.apply(this, arguments); if (key === 'locations') { areas().then(() => enhanceNewAdminForm()); } return r; };
  }
  window.enhanceNewAdminForm = enhanceNewAdminForm;
})();
