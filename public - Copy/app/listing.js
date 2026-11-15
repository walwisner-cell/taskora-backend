// v133: tell a pro plainly when customers cannot find them.
// A pro is shown in search, on the homepage and in job matches only once
// their ID is verified and they have a profile photo (see src/listing.js).
// A verified pro with no photo used to be hidden without being told.
(function () {
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const e = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s));
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Customers cannot find you yet': 'Los clientes todavía no pueden encontrarte',
      'Add a profile photo to appear in search and receive job matches.': 'Agrega una foto de perfil. Hasta que lo hagas, no apareces en los resultados de búsqueda ni en la página principal, y no recibes trabajos nuevos.',
      'Add Profile Photo': 'Agregar foto de perfil',
    });
  } catch (err) {}

  function hidden() {
    const u = (typeof AUTH !== 'undefined' && AUTH.user) || null;
    return !!(u && u.role === 'provider' && u.verified && !u.profilePhotoUrl);
  }
  function banner() {
    const main = document.getElementById('provider-main');
    if (!main) return;
    const old = document.getElementById('listing-banner'); if (old) old.remove();
    if (!hidden()) return;
    const div = document.createElement('div');
    div.id = 'listing-banner'; div.className = 'panel'; div.setAttribute('role', 'alert');
    div.style.cssText = 'border:1px solid rgba(217,119,6,.45);background:rgba(217,119,6,.08);display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
    div.innerHTML = `<div style="flex:1 1 260px;min-width:0;">
        <div style="font-weight:700;color:#92400E;font-size:15px;">${e(t('Customers cannot find you yet'))}</div>
        <div style="font-size:14px;color:var(--text);margin-top:4px;line-height:1.5;">${e(t('Add a profile photo to appear in search and receive job matches.'))}</div>
      </div>
      <button class="btn-sm btn-sm-primary" onclick="selectProviderSection('settings')">${e(t('Add Profile Photo'))}</button>`;
    const header = main.querySelector('.dash-header');
    if (header) header.insertAdjacentElement('afterend', div); else main.prepend(div);
  }
  window.showListingBanner = banner;
  if (typeof selectProviderSection === 'function') {
    const f = selectProviderSection;
    selectProviderSection = function (key) { const r = f.apply(this, arguments); if (key === 'matches' || key === 'settings') banner(); else { const o = document.getElementById('listing-banner'); if (o) o.remove(); } /* v152: on the Overview, "Complete your profile" lists the photo as Required */ return r; };
  }
})();
