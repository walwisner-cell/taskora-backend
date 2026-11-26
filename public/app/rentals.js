// v180: Rentals in the Market (the screens). The rules are on the server:
// src/rentals.js and src/routes/rentals.routes.js.
//
// Market → Rentals has three parts:
//   - Find a place: stays by the night, or homes by the month. Search by
//     area, dates and guests. A place opens with its photos, what it has,
//     the house rules, the cancellation rule, the host and the reviews, a
//     calendar of the free days, and the price for the chosen dates.
//   - My trips: every booking, what happens next, the address once the host
//     has accepted, Pay now, Cancel (with what comes back, shown first),
//     "All good" after check-in, Report a problem, and rating the stay.
//   - Hosting: list a place (checked by the Trothen team first), the
//     calendar of closed days, requests to accept or decline, and bookings.
(function () {
  const e = (s) => escapeHtml(s == null ? '' : String(s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const $ = (id) => document.getElementById(id);
  const money = (n) => '$' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const localMoney = (lp) => (lp && lp.amount ? `${lp.code} ${Number(lp.amount).toLocaleString('en-US')}` : '');
  const signedIn = () => !!(typeof AUTH === 'object' && AUTH.token && AUTH.user && ['customer', 'provider'].includes(AUTH.user.role));
  const role = () => (AUTH && AUTH.user && AUTH.user.role) || null;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayMs = (s) => Date.parse(s + 'T00:00:00Z');
  const addDays = (s, n) => new Date(dayMs(s) + n * 864e5).toISOString().slice(0, 10);
  // "Sat 14 March 2026": the day written out, as people say it.
  const longDate = (s) => { if (!s) return ''; const d = new Date(dayMs(s)); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${t(MONTHS[d.getUTCMonth()])} ${d.getUTCFullYear()}`; };
  const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : '');
  try {
    if (typeof ES_TEXT === 'object') Object.assign(ES_TEXT, {
      'Rentals': 'Alquileres', 'Find a place': 'Buscar un lugar', 'My trips': 'Mis viajes', 'Hosting': 'Anfitrión', 'Stays by the night': 'Estancias por noche', 'Homes by the month': 'Casas por mes',
      'Area or community': 'Zona o comunidad', 'Check-in': 'Llegada', 'Check-out': 'Salida', 'Move-in': 'Mudanza', 'Guests': 'Huéspedes', 'Search': 'Buscar', 'night': 'noche', 'month': 'mes',
      'Request to book': 'Solicitar reserva', 'List a place': 'Publicar un lugar', 'Your places': 'Tus lugares', 'Requests': 'Solicitudes', 'Accept': 'Aceptar', 'Decline': 'Rechazar',
      'All good': 'Todo bien', 'Report a problem': 'Reportar un problema', 'Rate your stay': 'Califica tu estancia', 'Pay now': 'Pagar ahora', 'Cancel': 'Cancelar', 'Calendar': 'Calendario',
      'What this place has': 'Lo que ofrece este lugar', 'House rules': 'Normas de la casa', 'Cancellation rule': 'Regla de cancelación', 'Being checked': 'En revisión', 'Shown to guests': 'Visible para huéspedes', 'Paused': 'En pausa',
      'Nothing found. Try another area, other dates or fewer guests.': 'No se encontró nada. Prueba otra zona, otras fechas o menos huéspedes.',
      'Your money is held by Trothen until 24 hours after check-in.': 'Trothen retiene tu dinero hasta 24 horas después de la llegada.',
    });
  } catch (x) {}

  const S = { part: 'find', mode: 'stay', q: '', checkIn: '', checkOut: '', moveIn: '', guests: 1, sort: 'newest', items: null, opts: null, seq: 0, cur: null, pick: { from: '', to: '' }, cal: null, quote: null, quoteErr: '', busy: false, months: null };
  window.RENTALS = S;
  async function options() { if (!S.opts) { try { S.opts = await apiFetch('GET', '/rentals/options'); } catch (x) { S.opts = { propertyTypes: {}, amenities: {}, cancellation: {}, fees: { guestPercent: 5, hostPercent: 3 }, currencies: [{ code: 'USD' }] }; } } return S.opts; }

  // ── Market → Rentals ────────────────────────────────────────────────
  window.drawRentals = function (part) {
    if (part) S.part = part;
    const body = $('market-body'); if (!body) return;
    const pub = !signedIn();
    const parts = pub ? [['find', 'Find a place']] : [['find', 'Find a place'], ['trips', 'My trips'], ['hosting', 'Hosting']];
    body.innerHTML = pub ? '<div id="rt-body"></div>' : `<div class="rt-parts" role="tablist" aria-label="${e(t('Rentals'))}" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">${parts.map(([k, l]) => `<button type="button" role="tab" aria-selected="${S.part === k}" class="btn-sm ${S.part === k ? 'btn-sm-primary' : 'btn-sm-outline'}" data-rpart="${k}" onclick="drawRentals('${k}')">${e(t(l))}</button>`).join('')}</div><div id="rt-body"></div>`;
    if (S.part === 'trips' && !pub) return drawTrips();
    if (S.part === 'hosting' && !pub) return drawHosting();
    S.part = 'find'; return drawFind();
  };

  // ── find a place ────────────────────────────────────────────────────
  function drawFind() {
    const box = $('rt-body'); if (!box) return;
    const today = new Date().toISOString().slice(0, 10);
    box.innerHTML = `<div class="panel" style="padding:12px;">
      <div role="radiogroup" aria-label="${e(t('Kind of rental'))}" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        ${[['stay', '🛏️ Stays by the night'], ['monthly', '🏠 Homes by the month']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${S.mode === k}" class="btn-sm ${S.mode === k ? 'btn-sm-primary' : 'btn-sm-outline'}" data-rmode="${k}" onclick="rentalsMode('${k}')">${e(t(l))}</button>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end;">
        <div class="form-group" style="margin:0;"><label class="form-label" for="rt-q">${e(t('Area or community'))}</label><input type="search" class="form-input" id="rt-q" value="${e(S.q)}" placeholder="${e(t('For example Sinkor'))}" onkeydown="if(event.key==='Enter')rentalsSearch()"/></div>
        ${S.mode === 'stay' ? `<div class="form-group" style="margin:0;"><label class="form-label" for="rt-in">${e(t('Check-in'))}</label><input type="date" class="form-input" id="rt-in" min="${today}" value="${e(S.checkIn)}"/></div>
        <div class="form-group" style="margin:0;"><label class="form-label" for="rt-out">${e(t('Check-out'))}</label><input type="date" class="form-input" id="rt-out" min="${today}" value="${e(S.checkOut)}"/></div>`
        : `<div class="form-group" style="margin:0;"><label class="form-label" for="rt-move">${e(t('Move-in'))}</label><input type="date" class="form-input" id="rt-move" min="${today}" value="${e(S.moveIn)}"/></div>`}
        <div class="form-group" style="margin:0;"><label class="form-label" for="rt-guests">${e(t('Guests'))}</label><select class="form-input form-select" id="rt-guests">${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}" ${S.guests === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="form-group" style="margin:0;"><label class="form-label" for="rt-sort">${e(t('Sort'))}</label><select class="form-input form-select" id="rt-sort">${[['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Best rated']].map(([v, l]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${e(t(l))}</option>`).join('')}</select></div>
        <button type="button" class="btn-sm btn-sm-primary" style="min-height:44px;" onclick="rentalsSearch()">${e(t('Search'))}</button>
      </div>
      <div style="font-size:12.5px;color:var(--slate);margin-top:8px;">🛡️ ${e(t(S.mode === 'stay' ? 'Your money is held by Trothen until 24 hours after check-in.' : 'Your money is held by Trothen until 48 hours after you move in.'))} ${e(t('Every place is checked by the Trothen team, and every host has a verified ID.'))}</div>
    </div><div id="rt-results" style="margin-top:12px;"><div style="color:var(--slate);">${e(t('Loading…'))}</div></div>`;
    loadFind();
  }
  window.rentalsMode = function (m) { S.mode = m; drawFind(); };
  window.rentalsSearch = function () {
    const v = (id) => ($(id) || {}).value || '';
    S.q = v('rt-q'); S.guests = Number(v('rt-guests')) || 1; S.sort = v('rt-sort') || 'newest';
    if (S.mode === 'stay') { S.checkIn = v('rt-in'); S.checkOut = v('rt-out'); if (S.checkIn && S.checkOut && S.checkOut <= S.checkIn) return showToast(t('Check-out must be after check-in')); } else S.moveIn = v('rt-move');
    loadFind();
  };
  async function loadFind() {
    const box = $('rt-results'); if (!box) return;
    const seq = ++S.seq;
    const qs = new URLSearchParams({ mode: S.mode, q: S.q, guests: String(S.guests), sort: S.sort });
    if (S.mode === 'stay' && S.checkIn && S.checkOut) { qs.set('checkIn', S.checkIn); qs.set('checkOut', S.checkOut); }
    if (S.mode === 'monthly' && S.moveIn) qs.set('moveIn', S.moveIn);
    if (!signedIn() && typeof MARKET === 'object' && MARKET.pubCountry !== undefined) qs.set('country', MARKET.pubCountry || '');
    let r; try { r = await apiFetch('GET', '/rentals?' + qs.toString()); } catch (x) { box.innerHTML = `<div class="panel">${e(x.message)}</div>`; return; }
    if (seq !== S.seq) return;
    S.items = r.items;
    box.innerHTML = r.items.length
      ? `<div style="font-size:13px;color:var(--slate);margin-bottom:8px;">${r.total} ${e(t(r.total === 1 ? 'place' : 'places'))}</div><div class="rt-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">${r.items.map(cardHTML).join('')}</div>`
      : `<div class="panel" style="color:var(--slate);">${e(t('Nothing found. Try another area, other dates or fewer guests.'))}</div>`;
  }
  const priceLine = (it, mode) => {
    const p = mode === 'monthly' ? it.monthly : it.stay || it.monthly;
    if (!p) return '';
    const per = p === it.monthly ? t('month') : t('night'), usd = p === it.monthly ? p.monthlyUsd : p.nightlyUsd;
    return `<strong style="color:var(--navy);font-size:16px;">${money(usd)}</strong> <span style="color:var(--slate);font-size:13px;">/ ${e(per)}</span>${p.local ? `<div style="color:var(--slate);font-size:12.5px;">${e(localMoney(p.local))} / ${e(per)}</div>` : ''}`;
  };
  const roomsWords = (it) => [it.bedrooms === 0 ? t('Studio') : `${it.bedrooms} ${t(it.bedrooms === 1 ? 'bedroom' : 'bedrooms')}`, `${it.bathrooms} ${t(it.bathrooms === 1 ? 'bathroom' : 'bathrooms')}`, `${t('up to')} ${it.maxGuests} ${t(it.maxGuests === 1 ? 'guest' : 'guests')}`].join(' · ');
  function cardHTML(it) {
    const click = `openRental(${jsArg(it.id)})`;
    return `<div class="rt-card" data-id="${e(it.id)}" role="button" tabindex="0" onclick="${click}" onkeydown="if(event.key==='Enter'){${click}}" style="cursor:pointer;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--white,#fff);display:flex;flex-direction:column;">
      ${it.photo ? `<img src="${e(it.photo)}" alt="" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;background:#f2f4f7;"/>` : '<div style="width:100%;aspect-ratio:4/3;background:#f2f4f7;"></div>'}
      <div style="padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;gap:8px;"><span style="font-size:12.5px;color:var(--slate);">${e(t(it.propertyLabel))} · ${e(it.community)}</span>${it.rating ? `<span style="font-size:12.5px;color:#8A5A00;white-space:nowrap;">★ ${Number(it.rating).toFixed(1)} (${it.ratingCount})</span>` : `<span style="font-size:12px;color:var(--slate);">${e(t('New'))}</span>`}</div>
        <div style="font-weight:700;color:var(--navy);line-height:1.3;">${e(it.title)}</div>
        <div style="font-size:12.5px;color:var(--slate);">${e(roomsWords(it))}</div>
        <div style="margin-top:4px;">${priceLine(it, S.mode)}</div>
      </div></div>`;
  }

  // ── one place ───────────────────────────────────────────────────────
  window.openRental = async function (id) {
    v105Overlay('rt-place', `<div class="modal-header"><button class="modal-close" onclick="v105Close('rt-place')" aria-label="${e(t('Close'))}">✕</button><h3 id="rtp-title">${e(t('Loading…'))}</h3><p id="rtp-sub"></p></div>
      <div class="modal-body" id="rtp-body" style="overflow:auto;flex:1 1 auto;min-height:0;"></div><div class="modal-footer" id="rtp-foot" style="display:block;"></div>`, 760);
    let l; try { l = (await apiFetch('GET', '/rentals/' + encodeURIComponent(id))).listing; } catch (x) { $('rtp-body').innerHTML = `<p style="color:var(--slate);">${e(x.message)}</p>`; return; }
    S.cur = l; S.quote = null; S.quoteErr = '';
    S.bookMode = l.stay && (S.mode === 'stay' || !l.monthly) ? 'stay' : 'monthly';
    S.pick = S.bookMode === 'stay' ? { from: S.checkIn || '', to: S.checkOut || '' } : { from: S.moveIn || '', to: '' };
    S.months = l.monthly ? l.monthly.payMonths : null;
    S.cal = (S.pick.from || l.today).slice(0, 7);
    await options();
    $('rtp-title').textContent = l.title;
    $('rtp-sub').textContent = [t(l.propertyLabel), l.community, l.city].filter(Boolean).join(' · ');
    const h = l.host || {};
    $('rtp-body').innerHTML = `
      <div id="rtp-photos">${l.photoUrls.length ? `<img id="rtp-main" src="${e(l.photoUrls[0])}" alt="${e(t('Photo 1 of'))} ${l.photoUrls.length}" style="width:100%;max-height:420px;object-fit:cover;border-radius:12px;background:#f2f4f7;"/>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">${l.photoUrls.map((u, i) => `<button type="button" aria-label="${e(t('Photo'))} ${i + 1}" onclick="document.getElementById('rtp-main').src='${e(u)}'" style="padding:0;border:1px solid var(--border);border-radius:8px;background:none;cursor:pointer;"><img src="${e(u)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:7px;display:block;"/></button>`).join('')}</div>` : ''}</div>
      <div style="font-size:14px;color:var(--navy);margin:12px 0 4px;font-weight:600;">${e(roomsWords(l))}${l.rating ? ` · <span style="color:#8A5A00;">★ ${Number(l.rating).toFixed(1)} (${l.ratingCount} ${e(t(l.ratingCount === 1 ? 'review' : 'reviews'))})</span>` : ''}</div>
      <p style="white-space:pre-wrap;line-height:1.6;margin:8px 0 12px;">${e(l.description)}</p>
      ${l.amenities.length ? `<h4 style="margin:14px 0 6px;color:var(--navy);">${e(t('What this place has'))}</h4><ul style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px 12px;margin:0;padding-left:18px;font-size:14px;">${l.amenities.map(a => `<li>${e(t(a.label))}</li>`).join('')}</ul>` : ''}
      ${l.rules ? `<h4 style="margin:14px 0 6px;color:var(--navy);">${e(t('House rules'))}</h4><p style="white-space:pre-wrap;margin:0;font-size:14px;line-height:1.55;">${e(l.rules)}</p>` : ''}
      <h4 style="margin:14px 0 6px;color:var(--navy);">${e(t('Where it is'))}</h4><p style="margin:0;font-size:14px;line-height:1.55;">📍 ${e(l.community)}, ${e(l.city)}. ${e(t('The exact address and pin are shared once the host accepts your booking.'))}</p>
      <div style="display:flex;gap:10px;align-items:center;border:1px solid var(--border);border-radius:12px;padding:10px;margin:14px 0;">
        ${typeof avatarHTML === 'function' ? avatarHTML({ name: h.name, initials: h.initials || String(h.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), color: h.color || '#1D5FA8', profilePhotoUrl: h.profilePhotoUrl }, 44) : ''}
        <div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--navy);">${e(t('Hosted by'))} ${e(h.name)} ${h.verified ? `<span class="badge badge-success" style="font-size:11px;">${e(t('ID verified'))}</span>` : ''}</div>
          <div style="font-size:12.5px;color:var(--slate);">${h.stays || 0} ${e(t(h.stays === 1 ? 'stay hosted' : 'stays hosted'))} · ${e(t('On Trothen since'))} ${e(h.since)}${h.isNew ? ` · <span style="color:#8a5a00;font-weight:600;">${e(t('New host'))}</span>` : ''}${l.ownerDeclared ? ` · ${e(t('declares they own the place or have the owner\'s permission'))}` : ''}</div></div>
        ${l.mine ? '' : `<button type="button" class="btn-sm btn-sm-outline" onclick="rentalsMessageHost()">💬 ${e(t('Ask the host'))}</button>`}
      </div>
      <div id="rtp-book"></div>
      ${l.reviews && l.reviews.length ? `<h4 style="margin:16px 0 6px;color:var(--navy);">${e(t('Reviews'))}</h4>${l.reviews.map(r => `<div style="border-top:1px solid var(--border);padding:8px 0;font-size:14px;"><div><span style="color:#8A5A00;">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span> <strong>${e(r.name)}</strong> <span style="color:var(--slate);font-size:12.5px;">${e(new Date(r.at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</span></div>${r.text ? `<div style="margin-top:2px;line-height:1.5;">${e(r.text)}</div>` : ''}</div>`).join('')}` : ''}
      <div style="font-size:13px;color:var(--slate);line-height:1.55;margin-top:12px;border-left:3px solid #2E8C6F;padding-left:8px;">🛡️ ${e(t('Pay only through Trothen. A host who asks you to pay by phone, transfer or cash before you arrive is breaking the rules: report them. Your money is held until after you arrive, so if the place is not as described, report a problem and the Trothen team decides.'))}</div>
      ${l.mine ? '' : `<div style="text-align:right;margin-top:8px;"><button type="button" class="btn-sm btn-sm-ghost" onclick="rentalsReport()">${e(t('Report this place'))}</button></div>`}`;
    drawBook();
  };
  window.rentalsMessageHost = function () {
    const l = S.cur; if (!l || !needSignIn()) return;
    v105Close('rt-place');
    if (role() === 'provider') selectProviderSection('messages'); else selectCustomerSection('messages');
    setTimeout(() => { try { selectMessageContact(l.host.id); } catch (x) {} const i = $('msg-input'); if (i) { i.value = `${t('Hello, I am interested in')} "${l.title}".`; i.focus(); } }, 500);
  };
  function needSignIn() {
    if (signedIn()) return true;
    showToast(t('Sign in or create an account to book.'));
    v105Close('rt-place'); if (typeof showAuth === 'function') showAuth('login');
    return false;
  }
  window.rentalsReport = async function () {
    if (!needSignIn()) return;
    const why = await confirmDialog(t('What is wrong with this place? For example: the photos are of another house, the host asked for money outside Trothen, or it does not exist.'), { requireTextInput: true, confirmLabel: t('Send report'), placeholder: t('What is wrong') });
    if (typeof why !== 'string' || !why) return;
    try { await apiFetch('POST', `/rentals/${encodeURIComponent(S.cur.id)}/report`, { reason: why }); showToast(t('Thank you. The Trothen team will look at it.')); } catch (x) { showToast(x.message); }
  };

  // The calendar and the price.
  function calendarHTML(l, opts) {
    const [y, m] = S.cal.split('-').map(Number);
    const first = `${S.cal}-01`, startDow = new Date(dayMs(first)).getUTCDay();
    const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const taken = new Set(opts.taken || []), today = l.today || new Date().toISOString().slice(0, 10);
    const { from, to } = opts.pick || {};
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push('<span></span>');
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${S.cal}-${String(d).padStart(2, '0')}`;
      const past = ds < today, off = taken.has(ds);
      const inRange = from && to && ds >= from && ds < to, edge = ds === from || ds === to;
      const bg = edge ? 'var(--teal,#0f766e)' : inRange ? '#cdeee8' : off ? '#f2f4f7' : '#fff';
      const fg = edge ? '#fff' : past || off ? '#9aa4b2' : 'var(--navy)';
      const disabled = past || (off && !opts.toggle && !(opts.pick && from && !to && ds > from && !opts.single));
      cells.push(`<button type="button" class="rt-day" data-date="${ds}" ${disabled ? 'disabled' : ''} aria-label="${e(longDate(ds))}${off ? ' ' + e(t(opts.toggle ? 'closed' : 'not available')) : ''}" aria-pressed="${edge || inRange || (opts.toggle && off)}" onclick="${opts.onPick}('${ds}')" style="min-height:40px;border:1px solid ${edge ? 'transparent' : 'var(--border)'};border-radius:8px;background:${bg};color:${fg};font-weight:${edge ? 700 : 500};${off && !opts.toggle ? 'text-decoration:line-through;' : ''}cursor:${disabled ? 'default' : 'pointer'};">${d}</button>`);
    }
    const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    return `<div class="rt-cal" style="max-width:420px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><button type="button" class="btn-sm btn-sm-ghost" aria-label="${e(t('Previous month'))}" ${prev < today.slice(0, 7) ? 'disabled' : ''} onclick="rentalsCal('${prev}','${opts.redraw}')">‹</button><strong style="color:var(--navy);">${e(t(MONTHS[m - 1]))} ${y}</strong><button type="button" class="btn-sm btn-sm-ghost" aria-label="${e(t('Next month'))}" onclick="rentalsCal('${next}','${opts.redraw}')">›</button></div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:12px;color:var(--slate);text-align:center;margin-bottom:4px;">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span>${e(t(d))}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">${cells.join('')}</div></div>`;
  }
  window.rentalsCal = function (ym, redraw) { S.cal = ym; if (redraw === 'host') drawHostCal(); else drawBook(); };
  function drawBook() {
    const box = $('rtp-book'), foot = $('rtp-foot'), l = S.cur; if (!box || !l) return;
    if (l.mine) { box.innerHTML = ''; foot.innerHTML = `<button class="btn-sm btn-sm-outline" onclick="v105Close('rt-place');drawRentals('hosting')">${e(t('Manage in Hosting'))}</button>`; return; }
    const both = l.stay && l.monthly, stay = S.bookMode === 'stay';
    const p = stay ? l.stay : l.monthly;
    box.innerHTML = `<div class="panel" style="padding:12px;margin:0;border:2px solid var(--border);">
      ${both ? `<div role="radiogroup" aria-label="${e(t('How to rent it'))}" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">${[['stay', 'By the night'], ['monthly', 'By the month']].map(([k, w]) => `<button type="button" role="radio" aria-checked="${S.bookMode === k}" class="btn-sm ${S.bookMode === k ? 'btn-sm-primary' : 'btn-sm-outline'}" onclick="rentalsBookMode('${k}')">${e(t(w))}</button>`).join('')}</div>` : ''}
      <div style="font-size:20px;font-weight:800;color:var(--navy);">${money(stay ? p.nightlyUsd : p.monthlyUsd)} <span style="font-size:14px;font-weight:400;color:var(--slate);">/ ${e(t(stay ? 'night' : 'month'))}${p.local ? ` · ${e(localMoney(p.local))}` : ''}</span></div>
      <div style="font-size:13px;color:var(--slate);margin:2px 0 10px;">${stay ? `${e(t('Check-in from'))} ${e(p.checkInFrom)} · ${e(t('check-out by'))} ${e(p.checkOutBy)} · ${e(t('at least'))} ${p.minNights} ${e(t(p.minNights === 1 ? 'night' : 'nights'))}${p.cleaningUsd ? ` · ${e(t('cleaning fee'))} ${money(p.cleaningUsd)}` : ''}` : `${e(t('Pay'))} ${p.payMonths} ${e(t(p.payMonths === 1 ? 'month' : 'months'))} ${e(t('at the start'))}${p.minMonths > 1 ? ` · ${e(t('rent for at least'))} ${p.minMonths} ${e(t('months'))}` : ''}`}</div>
      <div style="font-size:13.5px;color:var(--navy);margin-bottom:6px;font-weight:600;" id="rtp-pickwords" aria-live="polite">${e(pickWords())}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;">
        ${calendarHTML(l, { taken: l.unavailable, pick: S.pick, onPick: 'rentalsPick', redraw: 'book', single: !stay })}
        <div style="flex:1 1 220px;min-width:0;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div class="form-group" style="margin:0;flex:1 1 90px;"><label class="form-label" for="rtp-guests">${e(t('Guests'))}</label><select class="form-input form-select" id="rtp-guests" onchange="rentalsQuote()">${Array.from({ length: l.maxGuests }, (_, i) => i + 1).map(n => `<option ${n === Math.min(S.guests, l.maxGuests) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            ${stay ? '' : `<div class="form-group" style="margin:0;flex:1 1 120px;"><label class="form-label" for="rtp-months">${e(t('Months to pay now'))}</label><select class="form-input form-select" id="rtp-months" onchange="RENTALS.months=Number(this.value);rentalsQuote()">${Array.from({ length: 13 - p.payMonths }, (_, i) => i + p.payMonths).map(n => `<option value="${n}" ${n === S.months ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`}
          </div>
          <div id="rtp-quote" style="margin-top:10px;"></div>
          <div class="form-group" style="margin:10px 0 0;"><label class="form-label" for="rtp-note">${e(t('Message to the host (optional)'))}</label><textarea class="form-input" id="rtp-note" rows="2" maxlength="500" placeholder="${e(t('Who is coming, and when you expect to arrive'))}"></textarea></div>
        </div>
      </div>
      <details style="margin-top:10px;font-size:13.5px;"><summary style="cursor:pointer;font-weight:600;color:var(--navy);">${e(t('Cancellation rule'))}: ${e(t(stay ? p.cancellationLabel : 'Monthly'))}</summary><p style="margin:6px 0 0;line-height:1.55;">${e(t(p.cancellationWords))} ${e(t(S.opts && S.opts.feeRefund || ''))}</p></details>
    </div>`;
    drawQuote();
  }
  function pickWords() {
    const stay = S.bookMode === 'stay';
    if (stay) {
      if (!S.pick.from) return t('Tap your check-in day.');
      if (!S.pick.to) return `${t('Check-in')}: ${longDate(S.pick.from)}. ${t('Now tap your check-out day.')}`;
      const n = Math.round((dayMs(S.pick.to) - dayMs(S.pick.from)) / 864e5);
      return `${longDate(S.pick.from)} → ${longDate(S.pick.to)} (${n} ${t(n === 1 ? 'night' : 'nights')})`;
    }
    return S.pick.from ? `${t('Move-in')}: ${longDate(S.pick.from)}` : t('Tap your move-in day.');
  }
  window.rentalsBookMode = function (m) { S.bookMode = m; S.pick = { from: '', to: '' }; S.quote = null; S.quoteErr = ''; drawBook(); };
  window.rentalsPick = function (ds) {
    const l = S.cur, taken = new Set(l.unavailable || []);
    if (S.bookMode === 'monthly') { if (taken.has(ds)) return; S.pick = { from: ds, to: '' }; }
    else if (!S.pick.from || S.pick.to || ds <= S.pick.from) { if (taken.has(ds)) return; S.pick = { from: ds, to: '' }; }
    else {
      for (let d = S.pick.from; d < ds; d = addDays(d, 1)) if (taken.has(d)) { showToast(t('Some nights in between are taken. Choose other dates.')); S.pick = { from: taken.has(ds) ? '' : ds, to: '' }; drawBook(); return; }
      S.pick.to = ds;
    }
    drawBook(); rentalsQuote();
  };
  window.rentalsQuote = async function () {
    const l = S.cur; if (!l) return;
    const guests = Number(($('rtp-guests') || {}).value || 1);
    S.guests = guests;
    const stay = S.bookMode === 'stay';
    if (!S.pick.from || (stay && !S.pick.to)) { S.quote = null; S.quoteErr = ''; return drawQuote(); }
    const qs = new URLSearchParams(stay ? { mode: 'stay', checkIn: S.pick.from, checkOut: S.pick.to, guests } : { mode: 'monthly', moveIn: S.pick.from, months: S.months, guests });
    $('rtp-quote').innerHTML = `<div style="color:var(--slate);">${e(t('Working out the price…'))}</div>`;
    try { S.quote = (await apiFetch('GET', `/rentals/${encodeURIComponent(l.id)}/quote?${qs}`)).quote; S.quoteErr = ''; } catch (x) { S.quote = null; S.quoteErr = x.message; }
    drawQuote();
  };
  function drawQuote() {
    const box = $('rtp-quote'), foot = $('rtp-foot'); if (!box) return;
    const q = S.quote;
    box.innerHTML = S.quoteErr ? `<div role="alert" style="color:#A5352B;font-size:13.5px;">${e(S.quoteErr)}</div>` : q ? `<div class="booking-summary">
        ${q.lines.map(x => `<div class="summary-row"><span>${e(x.label)}</span><span>${money(x.usd)}</span></div>`).join('')}
        <div class="summary-row"><span>${e(t('Trothen service fee'))} (${q.feePercent}%)</span><span>${money(q.guestFee)}</span></div>
        <div class="summary-row total"><span>${e(t('Total'))}</span><span>${money(q.total)}${q.local ? `<br><small style="font-weight:400;color:var(--slate);">${e(t('about'))} ${e(localMoney(q.local))}</small>` : ''}</span></div></div>` : '';
    if (!foot) return;
    foot.innerHTML = `<button class="confirm-btn" id="rtp-go" style="width:100%;" ${!q || S.busy ? 'disabled' : ''} onclick="rentalsBook()">${e(t(S.busy ? 'Booking…' : q ? 'Request to book' : (S.bookMode === 'stay' ? 'Choose your dates' : 'Choose your move-in day')))}${q && !S.busy ? ` · ${money(q.total)}` : ''}</button>
      <div style="font-size:12.5px;color:var(--slate);margin-top:6px;line-height:1.5;">${e(t('You pay now and Trothen holds the money. The host has 24 hours to accept; if they don\'t, you get everything back.'))} ${e(t(S.bookMode === 'stay' ? 'The money goes to the host 24 hours after check-in, unless you report a problem first.' : 'The money goes to the host 48 hours after you move in, unless you report a problem first.'))}</div>`;
  }
  window.rentalsBook = async function () {
    const l = S.cur, q = S.quote; if (!l || !q || S.busy || !needSignIn()) return;
    const stay = S.bookMode === 'stay';
    const body = { mode: S.bookMode, guests: S.guests, expectedTotal: q.total, note: ($('rtp-note') || {}).value || undefined, ...(stay ? { checkIn: S.pick.from, checkOut: S.pick.to } : { moveIn: S.pick.from, months: S.months }) };
    S.busy = true; drawQuote();
    try {
      const r = await apiFetch('POST', `/rentals/${encodeURIComponent(l.id)}/book`, body);
      S.busy = false; v105Close('rt-place');
      if (r.payment) { payFor(r.booking, r.payment); }
      else if (typeof showResult === 'function') showResult({ icon: '🏠', title: t('Booking requested'), lines: [t('Trothen is holding your payment.'), t('The host has 24 hours to accept. You will get a message, and the address, as soon as they do. If they don\'t, you get everything back.')], then: "openMarket('rentals');setTimeout(function(){drawRentals('trips')},300)" });
      else showToast(t('Booking requested. The host has 24 hours to accept.'));
      S.part = 'trips';
    } catch (x) { S.busy = false; drawQuote(); showToast(x.message || t('Could not book')); if (x && /taken/.test(x.message || '')) openRental(l.id); }
  };
  function payFor(b, p) {
    if (typeof handlePaymentStep === 'function' && handlePaymentStep(p, { id: b.id })) return;
    if (typeof payWaysShowFor === 'function') return payWaysShowFor({ id: b.id, bookingNumber: b.bookingNumber, service: b.title }, p);
    showToast(t('Pay to confirm your booking: see My trips.'));
  }

  // ── my trips ────────────────────────────────────────────────────────
  const STATUS = { awaiting_payment: ['Waiting for your payment', 'badge-warn'], pending_provider_confirmation: ['Waiting for the host', 'badge-pending'], active: ['Confirmed', 'badge-success'], completed: ['Finished', 'badge-neutral'], cancelled: ['Cancelled', 'badge-neutral'], declined: ['The host said no', 'badge-neutral'], expired: ['No answer: refunded', 'badge-neutral'], disputed: ['Problem reported', 'badge-danger'] };
  const badge = (s, host) => { const x = host && s === 'pending_provider_confirmation' ? ['Waiting for your answer', 'badge-warn'] : host && s === 'expired' ? ['Not answered in time: refunded', 'badge-neutral'] : host && s === 'declined' ? ['You declined', 'badge-neutral'] : STATUS[s] || [s, 'badge-neutral']; return `<span class="badge ${x[1]}">${e(t(x[0]))}</span>`; };
  const datesOf = (b) => (b.mode === 'monthly' ? `${t('Move in')} ${longDate(b.moveIn)} · ${b.months} ${t(b.months === 1 ? 'month' : 'months')} ${t('paid, to')} ${longDate(b.endDate)}` : `${longDate(b.checkIn)} → ${longDate(b.checkOut)} · ${b.nights} ${t(b.nights === 1 ? 'night' : 'nights')}`);
  async function drawTrips() {
    const box = $('rt-body'); if (!box) return;
    box.innerHTML = `<div style="color:var(--slate);">${e(t('Loading…'))}</div>`;
    let r; try { r = await apiFetch('GET', '/rentals/trips/mine'); } catch (x) { box.innerHTML = `<div class="panel">${e(x.message)}</div>`; return; }
    S.trips = r.trips;
    if (!r.trips.length) { box.innerHTML = `<div class="panel" style="color:var(--slate);">${e(t('No trips yet. Find a place to stay or a home to rent.'))} <button class="btn-sm btn-sm-primary" onclick="drawRentals('find')">${e(t('Find a place'))}</button></div>`; return; }
    box.innerHTML = r.trips.map(b => `<div class="panel rt-trip" data-id="${e(b.id)}" style="display:flex;gap:12px;flex-wrap:wrap;">
      ${b.photo ? `<img src="${e(b.photo)}" alt="" style="width:110px;height:90px;object-fit:cover;border-radius:10px;flex:none;"/>` : ''}
      <div style="flex:1 1 260px;min-width:0;">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"><strong style="color:var(--navy);">${e(b.title)}</strong>${badge(b.status)}</div>
        <div style="font-size:13.5px;color:var(--slate);margin:2px 0;">${e(b.community)}, ${e(b.city)} · #${e(b.bookingNumber)} · ${b.guests} ${e(t(b.guests === 1 ? 'guest' : 'guests'))}</div>
        <div style="font-size:14px;color:var(--navy);">${e(datesOf(b))}</div>
        <div style="font-size:13.5px;margin-top:2px;">${e(t('Total paid'))}: <strong>${money(b.total)}</strong>${b.refundedAmount ? ` · ${e(t('refunded'))} ${money(b.refundedAmount)}` : b.cancel && b.cancel.kind === 'full' ? ` · ${e(t('refunded in full'))}` : ''}</div>
        ${nextStep(b)}
        ${b.address ? `<div style="font-size:14px;margin-top:6px;padding:8px;background:#f0f8f6;border-radius:8px;">📍 <strong>${e(t('Address'))}:</strong> ${e(b.address)}${b.location ? ` · <a href="https://www.google.com/maps/search/?api=1&query=${b.location.latitude},${b.location.longitude}" target="_blank" rel="noopener">${e(t('Open in Google Maps'))}</a>` : ''}${b.mode === 'stay' ? `<br>${e(t('Check-in from'))} ${e(b.checkInFrom)} · ${e(t('check-out by'))} ${e(b.checkOutBy)}` : ''}</div>` : ''}
        <div class="row-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          ${b.payment ? `<button class="btn-sm btn-sm-primary" onclick="rentalsPay(${jsArg(b.id)})">💳 ${e(t('Pay now'))}</button>` : ''}
          ${b.canAllGood ? `<button class="btn-sm btn-sm-primary" onclick="rentalsAllGood(${jsArg(b.id)})">✅ ${e(t('All good: pay the host now'))}</button>` : ''}
          ${b.canReport ? `<button class="btn-sm btn-sm-outline" onclick="openDisputeForm(${jsArg(b.id)})">⚠️ ${e(t('Report a problem'))}</button>` : ''}
          ${b.canReview ? `<button class="btn-sm btn-sm-primary" onclick="rentalsReview(${jsArg(b.id)})">⭐ ${e(t('Rate your stay'))}</button>` : ''}
          ${['active', 'pending_provider_confirmation', 'completed'].includes(b.status) && b.host ? `<button class="btn-sm btn-sm-outline" onclick="rentalsMessage(${jsArg(b.host.id)})">💬 ${e(t('Message the host'))}</button>` : ''}
          ${b.canCancel ? `<button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="rentalsCancel(${jsArg(b.id)},'guest')">${e(t('Cancel'))}</button>` : ''}
          <button class="btn-sm btn-sm-ghost" onclick="openRental(${jsArg(b.listingId)})">${e(t('See the place'))}</button>
        </div></div></div>`).join('');
  }
  function nextStep(b) {
    const say = (w) => `<div style="font-size:13.5px;margin-top:6px;line-height:1.5;border-left:3px solid var(--gold,#C9A227);padding-left:8px;">${w}</div>`;
    if (b.status === 'awaiting_payment') return say(e(t('Pay to send your request to the host. If it isn\'t paid in time, the booking is cancelled and nothing is taken.')));
    if (b.status === 'pending_provider_confirmation') return say(`${e(t('The host has until'))} <strong>${e(when(b.answerBy))}</strong> ${e(t('to accept. If they don\'t, you get everything back.'))}`);
    if (b.status === 'active' && !b.canAllGood) return say(`${e(t('Confirmed. Trothen holds your money until'))} <strong>${e(when(b.releaseAt))}</strong>. ${e(t('If the place is not as described when you arrive, report a problem before then.'))}`);
    if (b.status === 'active') return say(`${e(t('You can now be in the place. If all is well, press "All good". If something is wrong, report a problem before'))} <strong>${e(when(b.releaseAt))}</strong>; ${e(t('after that the money goes to the host.'))}`);
    if (b.status === 'disputed') return say(e(t('The Trothen team is looking at the problem you reported. The money stays held until they decide.')));
    return '';
  }
  window.rentalsPay = function (id) { const b = (S.trips || []).find(x => x.id === id); if (b && b.payment) payFor(b, b.payment); };
  window.rentalsMessage = function (userId) { if (role() === 'provider') selectProviderSection('messages'); else selectCustomerSection('messages'); setTimeout(() => { try { selectMessageContact(userId); } catch (x) {} }, 500); };
  window.rentalsAllGood = async function (id) {
    if (true !== (await confirmDialog(t('Send the money to the host now? Only do this if you are in the place and all is as described. After this, a problem can still be reported to support, but the payment has gone.'), { confirmLabel: t('Yes, all good') }))) return;
    try { await apiFetch('POST', `/rentals/bookings/${encodeURIComponent(id)}/all-good`); showToast(t('Thank you. The host has been paid. Enjoy your stay.')); drawTrips(); } catch (x) { showToast(x.message); }
  };
  window.rentalsCancel = async function (id, who) {
    let plan; try { plan = (await apiFetch('GET', `/rentals/bookings/${encodeURIComponent(id)}/cancel`)).plan; } catch (x) { return showToast(x.message); }
    if (plan.blocked) return showToast(plan.words);
    const back = plan.kind === 'unpaid' ? '' : plan.refundUsd > 0 ? `${t(who === 'host' ? 'The guest gets back' : 'You get back')} ${money(plan.refundUsd)}.` : t('Nothing is refunded.');
    const msg = `${t(who === 'host' ? 'Cancel this booking? The guest is refunded in full, those dates close in your calendar, and hosts who cancel often are looked at by the Trothen team.' : 'Cancel this booking?')} ${back} ${plan.words}`;
    if (true !== (await confirmDialog(msg, { danger: true, confirmLabel: t('Cancel the booking'), cancelLabel: t('Keep it') }))) return;
    try { const r = await apiFetch('POST', `/rentals/bookings/${encodeURIComponent(id)}/cancel`); showToast(r.plan.refundUsd > 0 ? `${t('Cancelled.')} ${money(r.plan.refundUsd)} ${t('is refunded.')}` : t('Cancelled.')); who === 'host' ? drawHosting() : drawTrips(); } catch (x) { showToast(x.message); }
  };
  window.rentalsReview = function (id) {
    S.stars = 0;
    v105Overlay('rt-review', `<div class="modal-header"><button class="modal-close" onclick="v105Close('rt-review')" aria-label="${e(t('Close'))}">✕</button><h3>${e(t('Rate your stay'))}</h3><p>${e(t('Your rating and words are shown on the place, with your first name.'))}</p></div>
      <div class="modal-body"><div role="radiogroup" aria-label="${e(t('Stars'))}" id="rt-stars" style="display:flex;gap:6px;font-size:32px;">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} ${e(t(n === 1 ? 'star' : 'stars'))}" onclick="rentalsStars(${n})" style="background:none;border:none;cursor:pointer;color:#9aa4b2;min-width:44px;min-height:44px;">★</button>`).join('')}</div>
      <div class="form-group"><label class="form-label" for="rt-rtext">${e(t('What was it like? (optional)'))}</label><textarea class="form-input" id="rt-rtext" rows="3" maxlength="1000" placeholder="${e(t('Was it clean, as in the photos, easy to find? How was the host?'))}"></textarea></div></div>
      <div class="modal-footer"><button class="confirm-btn" onclick="rentalsSendReview(${jsArg(id)})">${e(t('Send'))}</button></div>`, 480);
  };
  window.rentalsStars = function (n) { S.stars = n; document.querySelectorAll('#rt-stars button').forEach((b, i) => { b.style.color = i < n ? '#C9A227' : '#9aa4b2'; b.setAttribute('aria-checked', String(i + 1 === n)); }); };
  window.rentalsSendReview = async function (id) {
    if (!S.stars) return showToast(t('Choose 1 to 5 stars'));
    try { await apiFetch('POST', `/rentals/bookings/${encodeURIComponent(id)}/review`, { stars: S.stars, text: ($('rt-rtext') || {}).value || '' }); v105Close('rt-review'); showToast(t('Thank you for your rating.')); drawTrips(); } catch (x) { showToast(x.message); }
  };

  // ── hosting ─────────────────────────────────────────────────────────
  const LSTATUS = { review: ['Being checked', 'badge-pending'], live: ['Shown to guests', 'badge-success'], paused: ['Paused', 'badge-neutral'], rejected: ['Not approved', 'badge-danger'], removed: ['Taken down', 'badge-danger'] };
  async function drawHosting() {
    const box = $('rt-body'); if (!box) return;
    box.innerHTML = `<div style="color:var(--slate);">${e(t('Loading…'))}</div>`;
    let r; try { r = await apiFetch('GET', '/rentals/hosting/mine'); } catch (x) { box.innerHTML = `<div class="panel">${e(x.message)}</div>`; return; }
    S.host = r;
    const reqs = r.bookings.filter(b => b.status === 'pending_provider_confirmation');
    const coming = r.bookings.filter(b => ['active', 'disputed'].includes(b.status));
    const past = r.bookings.filter(b => !['pending_provider_confirmation', 'active', 'disputed'].includes(b.status));
    const vb = (b, actions) => `<div class="rt-hb" data-id="${e(b.id)}" style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"><strong style="color:var(--navy);">${e(b.title)}</strong>${badge(b.status, true)}</div>
      <div style="font-size:14px;">${e(datesOf(b))} · ${b.guests} ${e(t(b.guests === 1 ? 'guest' : 'guests'))} · ${e(b.guest ? b.guest.name : '')}${b.guest && b.guest.verified ? ` <span class="badge badge-success" style="font-size:11px;">${e(t('ID verified'))}</span>` : ''}</div>
      <div style="font-size:13.5px;color:var(--slate);">${e(t('You get'))} <strong style="color:var(--navy);">${money(b.hostGets)}</strong> (${e(t('price'))} ${money(b.subtotal)} ${e(t('less the host fee'))} ${money(b.hostFee)})${b.releaseAt ? ` · ${e(t('paid to you on'))} ${e(when(b.releaseAt))}` : ''}</div>
      ${b.note ? `<div style="font-size:13.5px;margin-top:4px;">💬 “${e(b.note)}”</div>` : ''}
      ${b.answerBy ? `<div style="font-size:13.5px;color:#8a5a00;margin-top:4px;">⏳ ${e(t('Answer by'))} ${e(when(b.answerBy))}. ${e(t('If you don\'t, the guest is refunded.'))}</div>` : ''}
      ${actions ? `<div class="row-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${actions}</div>` : ''}</div>`;
    box.innerHTML = `
      ${!r.verified ? `<div class="panel" style="border-left:4px solid #f59e0b;">${e(t('To list a place, verify your identity first. Guests only see hosts Trothen has checked.'))} <button class="btn-sm btn-sm-outline" onclick="${role() === 'provider' ? "selectProviderSection('verification')" : "selectCustomerSection('verification')"}">${e(t('Verify my ID'))}</button></div>` : ''}
      ${reqs.length ? `<div class="panel" style="border:2px solid #E0A526;"><div class="panel-title">${e(t('Requests'))} (${reqs.length})</div>${reqs.map(b => vb(b, `<button class="btn-sm btn-sm-primary" onclick="rentalsAnswer(${jsArg(b.id)},'accept')">✅ ${e(t('Accept'))}</button><button class="btn-sm btn-sm-outline" onclick="rentalsAnswer(${jsArg(b.id)},'decline')">${e(t('Decline'))}</button><button class="btn-sm btn-sm-ghost" onclick="rentalsMessage(${jsArg(b.guest && b.guest.id)})">💬 ${e(t('Message the guest'))}</button>`)).join('')}</div>` : ''}
      <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div><div class="panel-title" style="margin:0;">${e(t('Your places'))}</div><div style="font-size:13px;color:var(--slate);">${e(t('Every place is checked by the Trothen team before guests can see it, usually within a day.'))} ${e(t('Trothen takes'))} ${r.fees.hostPercent}% ${e(t('from the price when a guest books; there is no commission when you cash out.'))}</div></div>
        <button class="btn-sm btn-sm-primary" ${r.verified ? '' : 'disabled'} onclick="rentalsEdit()">+ ${e(t('List a place'))}</button></div>
        ${r.listings.length ? r.listings.map(l => { const s = LSTATUS[l.status] || [l.status, 'badge-neutral']; return `<div class="rt-mine" data-id="${e(l.id)}" style="display:flex;gap:10px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px;margin-top:10px;flex-wrap:wrap;">
          ${l.photoUrls[0] ? `<img src="${e(l.photoUrls[0])}" alt="" style="width:72px;height:60px;object-fit:cover;border-radius:8px;"/>` : ''}
          <div style="flex:1 1 200px;min-width:0;"><div style="font-weight:700;color:var(--navy);">${e(l.title)}</div><div style="font-size:13px;color:var(--slate);">${[l.stay ? `${money(l.stay.nightlyUsd)} / ${t('night')}` : '', l.monthly ? `${money(l.monthly.monthlyUsd)} / ${t('month')}` : ''].filter(Boolean).join(' · ')} · <span class="badge ${s[1]}">${e(t(s[0]))}</span>${l.rating ? ` · ★ ${Number(l.rating).toFixed(1)}` : ''}${l.reviewNote ? `<br><span style="color:#A5352B;">${e(l.reviewNote)}</span>` : ''}</div></div>
          <div class="row-actions" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            ${['live', 'paused', 'review', 'rejected'].includes(l.status) ? `<button class="btn-sm btn-sm-outline" onclick="rentalsEdit(${jsArg(l.id)})">${e(t('Edit'))}</button>` : ''}
            ${['live', 'paused'].includes(l.status) ? `<button class="btn-sm btn-sm-outline" onclick="rentalsHostCal(${jsArg(l.id)})">📅 ${e(t('Calendar'))}</button>` : ''}
            ${l.status === 'live' ? `<button class="btn-sm btn-sm-ghost" onclick="rentalsShow(${jsArg(l.id)},'paused')">${e(t('Pause'))}</button>` : l.status === 'paused' ? `<button class="btn-sm btn-sm-primary" onclick="rentalsShow(${jsArg(l.id)},'live')">${e(t('Show to guests'))}</button>` : ''}
            <button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="rentalsDelete(${jsArg(l.id)})">${e(t('Delete'))}</button>
          </div></div>`; }).join('') : `<p style="color:var(--slate);margin:12px 0 0;">${e(t('No places yet. A room, an apartment or a house: list it and guests can book it through Trothen.'))}</p>`}
      </div>
      ${coming.length ? `<div class="panel"><div class="panel-title">${e(t('Coming up'))}</div>${coming.map(b => vb(b, `<button class="btn-sm btn-sm-ghost" onclick="rentalsMessage(${jsArg(b.guest && b.guest.id)})">💬 ${e(t('Message the guest'))}</button>${b.canCancel ? `<button class="btn-sm btn-sm-ghost" style="color:#A5352B;" onclick="rentalsCancel(${jsArg(b.id)},'host')">${e(t('Cancel'))}</button>` : ''}`)).join('')}</div>` : ''}
      ${past.length ? `<details class="panel"><summary class="panel-title" style="cursor:pointer;">${e(t('Past and cancelled'))} (${past.length})</summary>${past.map(b => vb(b, '')).join('')}</details>` : ''}`;
  }
  window.rentalsAnswer = async function (id, what) {
    if (what === 'decline' && true !== (await confirmDialog(t('Decline this request? The guest is refunded in full.'), { confirmLabel: t('Decline'), cancelLabel: t('Go back') }))) return;
    try { await apiFetch('POST', `/rentals/bookings/${encodeURIComponent(id)}/${what}`); showToast(t(what === 'accept' ? 'Accepted. The guest has been sent the address.' : 'Declined. The guest is refunded.')); drawHosting(); } catch (x) { showToast(x.message); }
  };
  window.rentalsShow = async function (id, status) { try { await apiFetch('POST', `/rentals/${encodeURIComponent(id)}/status`, { status }); drawHosting(); } catch (x) { showToast(x.message); } };
  window.rentalsDelete = async function (id) {
    if (true !== (await confirmDialog(t('Delete this place? Guests won\'t see it any more.'), { danger: true, confirmLabel: t('Delete') }))) return;
    try { await apiFetch('DELETE', `/rentals/${encodeURIComponent(id)}`); drawHosting(); } catch (x) { showToast(x.message); }
  };

  // The host's calendar: tap days to close or open them.
  window.rentalsHostCal = function (id) {
    const l = S.host.listings.find(x => x.id === id); if (!l) return;
    S.hostCal = { id, blocked: new Set(l.blockedDates || []) };
    S.cal = new Date().toISOString().slice(0, 7);
    v105Overlay('rt-hcal', `<div class="modal-header"><button class="modal-close" onclick="v105Close('rt-hcal')" aria-label="${e(t('Close'))}">✕</button><h3>📅 ${e(l.title)}</h3><p>${e(t('Tap a day to close it (for example when you or family use the place), or to open it again. Booked days are closed by Trothen.'))}</p></div>
      <div class="modal-body" id="rt-hcal-body"></div><div class="modal-footer"><button class="confirm-btn" onclick="rentalsSaveCal()">${e(t('Save'))}</button></div>`, 480);
    drawHostCal();
  };
  function drawHostCal() {
    const b = $('rt-hcal-body'); if (!b) return;
    b.innerHTML = calendarHTML({ today: new Date().toISOString().slice(0, 10) }, { taken: [...S.hostCal.blocked], onPick: 'rentalsToggleDay', redraw: 'host', toggle: true }) + `<p style="font-size:13px;color:var(--slate);margin-top:8px;">${S.hostCal.blocked.size} ${e(t(S.hostCal.blocked.size === 1 ? 'day closed' : 'days closed'))}</p>`;
  }
  window.rentalsToggleDay = function (ds) { const s = S.hostCal.blocked; s.has(ds) ? s.delete(ds) : s.add(ds); drawHostCal(); };
  window.rentalsSaveCal = async function () {
    try { await apiFetch('PUT', `/rentals/${encodeURIComponent(S.hostCal.id)}/calendar`, { blocked: [...S.hostCal.blocked] }); v105Close('rt-hcal'); showToast(t('Saved')); drawHosting(); } catch (x) { showToast(x.message); }
  };

  // Listing a place, or changing it.
  window.rentalsEdit = async function (id) {
    const o = await options();
    const l = id ? S.host.listings.find(x => x.id === id) : null;
    const raw = (l && l.raw) || {};
    const cur = (S.host && S.host.currencies) || o.currencies || [{ code: 'USD' }];
    S.form = { id: id || null, photos: l ? [...l.photoUrls] : [], location: l ? l.location : null };
    const curSel = (idName, val) => `<select class="form-input form-select" id="${idName}" style="flex:0 0 96px;">${cur.map(c => `<option value="${e(c.code)}" ${val === c.code ? 'selected' : ''}>${e(c.code)}</option>`).join('')}</select>`;
    const st = raw.stay || {}, mo = raw.monthly || {};
    const f = (lbl, idName, inner, help) => `<div class="form-group"><label class="form-label" for="${idName}">${e(t(lbl))}</label>${inner}${help ? `<div style="font-size:12.5px;color:var(--slate);margin-top:3px;">${e(t(help))}</div>` : ''}</div>`;
    v105Overlay('rt-edit', `<div class="modal-header"><button class="modal-close" onclick="v105Close('rt-edit')" aria-label="${e(t('Close'))}">✕</button><h3>${e(t(id ? 'Change your place' : 'List a place'))}</h3><p>${e(t('Write it the way a guest would want to read it. The Trothen team checks every place before guests can see it.'))}</p></div>
      <div class="modal-body" style="overflow:auto;flex:1 1 auto;min-height:0;">
        <h4 style="color:var(--navy);margin:0 0 6px;">1. ${e(t('The place'))}</h4>
        ${f('Title', 'rf-title', `<input class="form-input" id="rf-title" maxlength="80" value="${e(l ? l.title : '')}" placeholder="${e(t('For example: 2-bedroom apartment in Sinkor, near the beach'))}"/>`)}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;">
          ${f('Kind of place', 'rf-type', `<select class="form-input form-select" id="rf-type">${Object.entries(o.propertyTypes).map(([k, v]) => `<option value="${k}" ${l && l.propertyType === k ? 'selected' : ''}>${e(t(v))}</option>`).join('')}</select>`)}
          ${f('Bedrooms', 'rf-bed', `<input class="form-input" id="rf-bed" type="number" min="0" max="20" inputmode="numeric" value="${l ? l.bedrooms : 1}"/>`)}
          ${f('Bathrooms', 'rf-bath', `<input class="form-input" id="rf-bath" type="number" min="0" max="20" inputmode="numeric" value="${l ? l.bathrooms : 1}"/>`)}
          ${f('Up to how many guests', 'rf-guests', `<input class="form-input" id="rf-guests" type="number" min="1" max="30" inputmode="numeric" value="${l ? l.maxGuests : 2}"/>`)}
        </div>
        ${f('Description', 'rf-desc', `<textarea class="form-input" id="rf-desc" rows="4" maxlength="3000" placeholder="${e(t('The rooms, the furniture, the area, what is nearby (shops, the main road, the beach), and how to get there.'))}">${e(l ? l.description : '')}</textarea>`)}
        <h4 style="color:var(--navy);margin:14px 0 6px;">2. ${e(t('Where it is'))}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
          ${f('Community or area (shown to everyone)', 'rf-comm', `<input class="form-input" id="rf-comm" maxlength="80" value="${e(l ? l.community : '')}" placeholder="${e(t('For example: Sinkor, 12th Street'))}"/>`)}
          ${f('City or town', 'rf-city', `<input class="form-input" id="rf-city" maxlength="60" value="${e(l ? l.city : (AUTH.user && AUTH.user.city) || '')}"/>`)}
        </div>
        ${f('Full address or directions (private)', 'rf-addr', `<input class="form-input" id="rf-addr" maxlength="200" value="${e(l ? l.address : '')}" placeholder="${e(t('House number, street, landmark'))}"/>`, 'Only a guest whose booking you accept sees it. Guests see a rough area on the map before.')}
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13.5px;"><span id="rf-pin">${S.form.location ? '📍 ' + e(t('Pinned')) : e(t('No pin yet: add one while you are at the place.'))}</span><button type="button" class="btn-sm btn-sm-outline" onclick="rentalsPin()">📍 ${e(t('Use where I am now'))}</button></div>
        <h4 style="color:var(--navy);margin:14px 0 6px;">3. ${e(t('Photos'))}</h4>
        <div style="font-size:13px;color:var(--slate);margin-bottom:6px;">${e(t('At least 3, up to 12: the outside, the main room, each bedroom, the bathroom and the kitchen. Real photos of this place only, in daylight.'))}</div>
        <div id="rf-photos" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        <label class="btn-sm btn-sm-outline" style="display:inline-block;margin-top:6px;cursor:pointer;">📷 ${e(t('Add photos'))}<input type="file" accept="image/*" multiple style="display:none;" onchange="rentalsAddPhotos(this.files);this.value=''"/></label>
        <h4 style="color:var(--navy);margin:14px 0 6px;">4. ${e(t('What it has'))}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:2px 10px;">${Object.entries(o.amenities).map(([k, v]) => `<label style="display:flex;gap:8px;align-items:center;min-height:36px;font-size:14px;"><input type="checkbox" class="rf-am" value="${k}" ${l && l.amenities.some(a => a.key === k) ? 'checked' : ''}/> ${e(t(v))}</label>`).join('')}</div>
        ${f('House rules (optional)', 'rf-rules', `<textarea class="form-input" id="rf-rules" rows="2" maxlength="1000" placeholder="${e(t('For example: no smoking inside, quiet after 22:00, no parties'))}">${e(l ? l.rules : '')}</textarea>`)}
        <h4 style="color:var(--navy);margin:14px 0 6px;">5. ${e(t('Prices'))}</h4>
        <label style="display:flex;gap:8px;align-items:center;font-weight:600;"><input type="checkbox" id="rf-stay" ${!l || raw.stay ? 'checked' : ''} onchange="document.getElementById('rf-stay-box').style.display=this.checked?'':'none'"/> ${e(t('By the night (short stays)'))}</label>
        <div id="rf-stay-box" style="${!l || raw.stay ? '' : 'display:none;'}border-left:3px solid var(--border);padding-left:10px;margin:6px 0 10px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
            ${f('Price per night', 'rf-sp', `<div style="display:flex;gap:6px;"><input class="form-input" id="rf-sp" type="number" min="1" step="any" inputmode="decimal" value="${st.price || ''}"/>${curSel('rf-sc', st.currency || cur[cur.length - 1].code)}</div>`)}
            ${f('Cleaning fee (optional, once per stay)', 'rf-clean', `<input class="form-input" id="rf-clean" type="number" min="0" step="any" inputmode="decimal" value="${st.cleaningFee || ''}"/>`)}
            ${f('Shortest stay (nights)', 'rf-minn', `<input class="form-input" id="rf-minn" type="number" min="1" max="30" value="${st.minNights || 1}"/>`)}
            ${f('Longest stay (nights)', 'rf-maxn', `<input class="form-input" id="rf-maxn" type="number" min="1" max="90" value="${st.maxNights || 30}"/>`)}
            ${f('Check-in from', 'rf-cin', `<input class="form-input" id="rf-cin" type="time" value="${st.checkInFrom || '14:00'}"/>`)}
            ${f('Check-out by', 'rf-cout', `<input class="form-input" id="rf-cout" type="time" value="${st.checkOutBy || '11:00'}"/>`)}
          </div>
          <div class="form-label" style="margin-top:6px;">${e(t('Cancellation rule'))}</div>
          ${Object.entries(o.cancellation).map(([k, v]) => `<label style="display:flex;gap:8px;align-items:flex-start;border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:6px;cursor:pointer;"><input type="radio" name="rf-cancel" value="${k}" ${(st.cancellation || 'moderate') === k ? 'checked' : ''} style="margin-top:3px;"/><span><strong>${e(t(v.label))}</strong><br><span style="font-size:13px;color:var(--slate);">${e(t(v.words))}</span></span></label>`).join('')}
        </div>
        <label style="display:flex;gap:8px;align-items:center;font-weight:600;"><input type="checkbox" id="rf-month" ${raw.monthly ? 'checked' : ''} onchange="document.getElementById('rf-month-box').style.display=this.checked?'':'none'"/> ${e(t('By the month (longer rentals)'))}</label>
        <div id="rf-month-box" style="${raw.monthly ? '' : 'display:none;'}border-left:3px solid var(--border);padding-left:10px;margin:6px 0 10px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
            ${f('Rent per month', 'rf-mp', `<div style="display:flex;gap:6px;"><input class="form-input" id="rf-mp" type="number" min="1" step="any" inputmode="decimal" value="${mo.price || ''}"/>${curSel('rf-mc', mo.currency || cur[cur.length - 1].code)}</div>`)}
            ${f('Months paid at the start', 'rf-pay', `<input class="form-input" id="rf-pay" type="number" min="1" max="12" value="${mo.payMonths || 1}"/>`, 'Paid through Trothen and held until 48 hours after move-in.')}
            ${f('Shortest rental (months)', 'rf-minm', `<input class="form-input" id="rf-minm" type="number" min="1" max="24" value="${mo.minMonths || 1}"/>`)}
          </div>
          <div style="font-size:12.5px;color:var(--slate);">${e(t(o.monthlyCancellation || ''))}</div>
        </div>
        <div style="font-size:13px;color:var(--slate);margin:4px 0 10px;">${e(t('Guests pay a'))} ${o.fees.guestPercent}% ${e(t('Trothen service fee on top. Trothen takes'))} ${o.fees.hostPercent}% ${e(t('from your price when a guest books. Nothing else is taken.'))}</div>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.5;"><input type="checkbox" id="rf-own" ${l && l.ownerDeclared ? 'checked' : ''} style="margin-top:4px;"/> ${e(t('I own this place, or I have the owner\'s written permission to rent it out. The photos and the description are true. I will only take payment through Trothen.'))}</label>
      </div>
      <div class="modal-footer"><button class="confirm-btn" id="rf-save" style="width:100%;" onclick="rentalsSave()">${e(t(id ? 'Save changes' : 'Send to the Trothen team to check'))}</button></div>`, 720);
    drawPhotos();
  };
  function drawPhotos() {
    const b = $('rf-photos'); if (!b) return;
    b.innerHTML = S.form.photos.map((u, i) => `<div style="position:relative;"><img src="${e(u)}" alt="${e(t('Photo'))} ${i + 1}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--border);"/><button type="button" aria-label="${e(t('Remove photo'))} ${i + 1}" onclick="RENTALS.form.photos.splice(${i},1);rentalsDrawPhotos()" style="position:absolute;top:2px;right:2px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;">✕</button></div>`).join('') || `<span style="font-size:13px;color:var(--slate);">${e(t('No photos yet.'))}</span>`;
  }
  window.rentalsDrawPhotos = drawPhotos;
  window.rentalsAddPhotos = async function (files) {
    for (const file of Array.from(files || [])) {
      if (S.form.photos.length >= 12) { showToast(t('Up to 12 photos')); break; }
      try { const url = await v105UploadPhoto('/rentals/photo', file); if (url) { S.form.photos.push(url); drawPhotos(); } } catch (x) { showToast(x.message); break; }
    }
  };
  window.rentalsPin = function () {
    if (!navigator.geolocation) return showToast(t('This device can\'t share its location.'));
    navigator.geolocation.getCurrentPosition((p) => { S.form.location = { latitude: p.coords.latitude, longitude: p.coords.longitude }; const s = $('rf-pin'); if (s) s.textContent = '📍 ' + t('Pinned'); }, () => showToast(t('Location was not shared. The address is enough.')), { enableHighAccuracy: true, timeout: 15000 });
  };
  window.rentalsSave = async function () {
    const v = (id) => ($(id) || {}).value;
    const n = (id) => Number(v(id));
    const body = {
      title: v('rf-title'), propertyType: v('rf-type'), bedrooms: n('rf-bed'), bathrooms: n('rf-bath'), maxGuests: n('rf-guests'), description: v('rf-desc'),
      community: v('rf-comm'), city: v('rf-city'), address: v('rf-addr'), location: S.form.location || null, photoUrls: S.form.photos,
      amenities: [...document.querySelectorAll('.rf-am:checked')].map(x => x.value), rules: v('rf-rules'),
      stay: $('rf-stay').checked ? { price: n('rf-sp'), currency: v('rf-sc'), cleaningFee: n('rf-clean') || 0, minNights: n('rf-minn'), maxNights: n('rf-maxn'), checkInFrom: v('rf-cin'), checkOutBy: v('rf-cout'), cancellation: (document.querySelector('input[name="rf-cancel"]:checked') || {}).value } : null,
      monthly: $('rf-month').checked ? { price: n('rf-mp'), currency: v('rf-mc'), payMonths: n('rf-pay'), minMonths: n('rf-minm') } : null,
      ownerDeclared: $('rf-own').checked,
    };
    const btn = $('rf-save'); btn.disabled = true;
    try {
      const r = await apiFetch(S.form.id ? 'PATCH' : 'POST', S.form.id ? `/rentals/${encodeURIComponent(S.form.id)}` : '/rentals', body);
      v105Close('rt-edit');
      showToast(t(r.listing.status === 'review' ? 'Sent to the Trothen team. They check it, usually within a day, and you get a message.' : 'Saved'));
      drawHosting();
    } catch (x) { btn.disabled = false; showToast(x.message); }
  };
})();
