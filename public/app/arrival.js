/* Agreeing an arrival time, "Leave Now", and a phone-friendly dashboard (v129).
   Loaded after trothen.js and where.js.

   1. ARRIVAL TIME. The customer and the pro agree when the pro will arrive.
      Either one proposes a date and time; the other accepts it or proposes
      another. A direct booking that already has a date and time uses that
      one automatically. Once a time is agreed, the server sends reminders:
      an hour before, when it is time to leave, at the agreed time if the pro
      hasn't set off, and to the customer if the pro is 30 minutes late (see
      src/arrival-time.js).
   2. NEXT JOB CARD. At the top of the pro's Overview and My Contracts, and
      the customer's Overview and My Bookings: the trip in progress, or the
      next agreed arrival, with the one button that matters right now
      ("Leave Now", "I have arrived", "Track Arrival", "Accept").
   3. PHONE LAYOUT. On a phone, the bookings and contracts tables become
      cards (each line labelled), with full-width buttons. The pro's
      "On My Way" button is labelled "Leave Now".
   4. NAMES. Names typed in capitals ("JAMES DOE") show as "James Doe" on the
      dashboards. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => escapeHtml(s == null ? '' : String(s));
  const OPEN = ['pending_agreement', 'pending_provider_confirmation', 'awaiting_payment', 'active'];
  const LEAD_MIN = 30;
  const sentence = (s) => (typeof sentenceCase === 'function' ? sentenceCase(s) : String(s || ''));
  const raw = (id) => (typeof RAW_CONTRACTS === 'object' && RAW_CONTRACTS[id]) || null;
  const role = () => (AUTH.user && AUTH.user.role) || null;
  const nameFix = (n, f) => (typeof personName === 'function' ? personName(n, f) : (n || f));
  const myTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } };
  const when = (iso) => (typeof arrivalWhen === 'function' ? arrivalWhen(iso) : new Date(iso).toLocaleString());
  function inWords(iso) {
    const m = Math.round((Date.parse(iso) - Date.now()) / 60000);
    if (m <= -1) { const late = -m; return late < 60 ? `${late} min ${tr('overdue')}` : `${Math.floor(late / 60)} h ${late % 60} min ${tr('overdue')}`; }
    if (m < 1) return tr('now');
    if (m < 60) return `${tr('in')} ${m} min`;
    if (m < 24 * 60) return `${tr('in')} ${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim();
    const d = Math.round(m / 1440); return `${tr('in')} ${d} ${tr(d === 1 ? 'day' : 'days')}`;
  }
  const canSchedule = (c) => c && OPEN.includes(c.status) && !c.onMyWayAt && !c.arrivedAt && !c.ride && !c.delivery && !c.storeOrder; // v148: goods orders have no arrival time
  const otherName = (c) => role() === 'provider' ? nameFix(c.customerName, tr('the customer')) : nameFix(c.providerName, tr('your pro'));
  const timeToLeave = (c) => !!(c && c.arrival && c.arrival.agreed && (Date.parse(c.arrival.agreed.at) - Date.now()) / 60000 <= LEAD_MIN + 15);

  // ── names ─────────────────────────────────────────────────────────────
  function tidyNames() {
    try { for (const b of (customerData.bookings || [])) { b.pro = nameFix(b.pro); b.service = sentence(b.service); } } catch (e) {}
    try { for (const c of (providerData.contracts || [])) { c.customer = nameFix(c.customer); c.service = sentence(c.service); } } catch (e) {}
    try { for (const c of Object.values(RAW_CONTRACTS)) { c.providerName = nameFix(c.providerName); c.customerName = nameFix(c.customerName); } } catch (e) {}
  }

  // ── a direct booking's date and time becomes the agreed arrival time ──
  const adopted = new Set();
  async function adoptBookedTimes() {
    if (role() !== 'customer' || !BACKEND_AVAILABLE) return;
    for (const c of Object.values(RAW_CONTRACTS || {})) {
      if (adopted.has(c.id) || !c.date || !c.time || c.arrival || !canSchedule(c) || c.status !== 'active') continue;
      adopted.add(c.id);
      const hm = typeof timeHM24 === 'function' ? timeHM24(c.time) : String(c.time).slice(0, 5); // v156: "9:00 AM" used to be misread
      if (!hm) continue;
      const local = new Date(`${String(c.date).slice(0, 10)}T${hm}`);
      if (isNaN(local) || local.getTime() < Date.now() + 5 * 60000) continue;
      try { const { contract } = await apiFetch('POST', `/contracts/${encodeURIComponent(c.id)}/arrival-time/adopt`, { at: local.toISOString(), tz: myTz() }); if (contract) RAW_CONTRACTS[c.id] = { ...c, ...contract }; } catch (e) { /* stays as it is */ }
    }
  }

  for (const name of ['loadCustomerData', 'loadProviderData']) {
    if (typeof window[name] === 'function') {
      const f = window[name];
      window[name] = async function () { const r = await f.apply(this, arguments); tidyNames(); if (name === 'loadCustomerData') adoptBookedTimes(); return r; };
    }
  }

  // ── the arrival line inside each booking ──────────────────────────────
  function arrivalBlockHTML(c) {
    if (!c || c.ride || c.delivery || c.storeOrder) return '';
    const a = c.arrival || {};
    const meId = AUTH.user && AUTH.user.id;
    const isPro = role() === 'provider';
    if (!canSchedule(c)) {
      if (a.agreed && c.onMyWayAt && !c.arrivedAt) return `<div class="arr"><span class="arr-k">${esc(tr('Arrival'))}</span> ${esc(when(a.agreed.at))}</div>`;
      return '';
    }
    let html = '';
    if (a.agreed) {
      const leave = isPro && c.status === 'active' && timeToLeave(c);
      html += `<div class="arr"><span class="arr-k">${esc(tr('Arrival'))}</span> <strong>${esc(when(a.agreed.at))}</strong> <span class="pill pill-ok">${esc(tr('Agreed'))}</span>
        <div class="arr-sub">${esc(inWords(a.agreed.at))}${a.proposal ? '' : ` · <button type="button" class="link-btn" onclick="openArrivalTime(${jsArg(c.id)})">${esc(tr('Change'))}</button>`}</div>
        ${leave ? `<div style="margin-top:6px;"><button type="button" class="btn-sm btn-sm-primary" onclick="markContractOnMyWay(${jsArg(c.id)})">${esc(tr('Leave Now'))}</button></div>` : ''}</div>`;
    }
    if (a.proposal) {
      const mine = a.proposal.byId === meId;
      html += mine
        ? `<div class="arr arr-pending"><span class="arr-k">${esc(tr(a.agreed ? 'New time proposed' : 'Arrival proposed'))}</span> <strong>${esc(when(a.proposal.at))}</strong><div class="arr-sub">${esc(tr('Awaiting confirmation from'))} ${esc(otherName(c))} · <button type="button" class="link-btn" onclick="openArrivalTime(${jsArg(c.id)})">${esc(tr('Change'))}</button></div></div>`
        : `<div class="arr arr-action"><span class="arr-k">${esc(otherName(c))} ${esc(tr('proposed'))}</span> <strong>${esc(when(a.proposal.at))}</strong>${a.proposal.note ? `<div class="arr-sub">“${esc(a.proposal.note)}”</div>` : ''}
            <div class="arr-btns"><button type="button" class="btn-sm btn-sm-primary" onclick="acceptArrivalTime(${jsArg(c.id)})">${esc(tr('Accept'))}</button><button type="button" class="btn-sm btn-sm-outline" onclick="openArrivalTime(${jsArg(c.id)})">${esc(tr('Propose Another Time'))}</button></div></div>`;
    }
    if (!a.agreed && !a.proposal) {
      html += `<div class="arr arr-none"><span class="arr-k">${esc(tr('Arrival'))}</span> ${esc(tr('Not agreed yet'))}<div class="arr-btns"><button type="button" class="btn-sm btn-sm-outline" onclick="openArrivalTime(${jsArg(c.id)})">${esc(tr('Agree Arrival Time'))}</button></div></div>`;
    }
    return html;
  }
  window.arrivalBlockHTML = arrivalBlockHTML;
  // whereHTML is drawn in the service cell of both the customer's bookings
  // and the pro's contracts, so the arrival line goes in right after it.
  if (typeof window.whereHTML === 'function') {
    const f = window.whereHTML;
    window.whereHTML = function (c) { const base = f.apply(this, arguments); const r = c && c.id ? raw(c.id) : null; return base + (r ? arrivalBlockHTML(r) : ''); };
  }

  // ── propose / accept ──────────────────────────────────────────────────
  function pad(n) { return String(n).padStart(2, '0'); }
  function localParts(d) { return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; }
  window.openArrivalTime = function (contractId) {
    closeArrivalTime();
    const c = raw(contractId) || {};
    const a = c.arrival || {};
    let start = a.proposal ? new Date(a.proposal.at) : a.agreed ? new Date(a.agreed.at) : (c.date && c.time && typeof timeHM24 === 'function' && timeHM24(c.time) ? new Date(`${String(c.date).slice(0, 10)}T${timeHM24(c.time)}`) : null);
    if (!start || isNaN(start) || start.getTime() < Date.now() + 10 * 60000) { start = new Date(Date.now() + 60 * 60000); start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0); }
    const p = localParts(start), today = localParts(new Date());
    const tz = myTz();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay open sheet-overlay" id="arr-overlay" style="z-index:5330;" onclick="if(event.target===this)closeArrivalTime()">
      <div class="modal sheet" role="dialog" aria-modal="true" aria-label="${esc(tr('Arrival time'))}">
        <div class="modal-header sheet-head">
          <button class="modal-close" onclick="closeArrivalTime()" aria-label="${esc(tr('Close'))}">✕</button>
          <h3>${esc(tr(a.agreed ? 'Propose a new arrival time' : 'Agree an arrival time'))}</h3>
          <p>${esc(sentence(c.service || ''))}${c.bookingNumber ? ' · #' + esc(c.bookingNumber) : ''} · ${esc(tr('with'))} ${esc(otherName(c))}</p>
        </div>
        <div class="modal-body sheet-body">
          <div class="arr-quick">
            <button type="button" class="chip" onclick="arrQuick(0)">${esc(tr('Today'))}</button>
            <button type="button" class="chip" onclick="arrQuick(1)">${esc(tr('Tomorrow'))}</button>
            <button type="button" class="chip" onclick="arrQuick(2)">${esc(new Date(Date.now() + 2 * 86400000).toLocaleDateString(undefined, { weekday: 'short' }))}</button>
          </div>
          <div class="arr-fields">
            <div class="form-group"><label class="form-label" for="arr-date">${esc(tr('Date'))}</label><input class="form-input" type="date" id="arr-date" min="${today.date}" value="${p.date}"/></div>
            <div class="form-group"><label class="form-label" for="arr-time">${esc(tr('Time'))}</label><input class="form-input" type="time" id="arr-time" step="300" value="${p.time}"/></div>
          </div>
          <div class="form-group"><label class="form-label" for="arr-note">${esc(tr('Note (optional)'))}</label><input class="form-input" type="text" id="arr-note" maxlength="200" placeholder="${esc(tr('e.g. Please call when you reach the gate'))}"/></div>
          <div class="ver-note">${esc(tr('Times are shown in your time zone'))}${tz ? ` (${esc(tz.replace(/_/g, ' '))})` : ''}. ${esc(otherName(c))} ${esc(tr('sees the same moment in theirs. Once the time is agreed, both of you receive reminders, and the pro is told when it is time to leave.'))}</div>
        </div>
        <div class="modal-footer sheet-foot">
          <button class="btn-sm btn-sm-outline" onclick="closeArrivalTime()">${esc(tr('Cancel'))}</button>
          <button class="confirm-btn" id="arr-save" onclick="submitArrivalTime(${jsArg(contractId)})">${esc(tr('Send Proposal'))}</button>
        </div>
      </div></div>`);
  };
  window.arrQuick = function (days) { const d = new Date(Date.now() + days * 86400000); const el = $('arr-date'); if (el) el.value = localParts(d).date; };
  window.closeArrivalTime = function () { const o = $('arr-overlay'); if (o) o.remove(); };
  window.submitArrivalTime = async function (contractId) {
    const d = ($('arr-date') || {}).value, t = ($('arr-time') || {}).value;
    if (!d || !t) return showToast(tr('Choose a date and a time.'));
    const at = new Date(`${d}T${t}`);
    if (isNaN(at)) return showToast(tr('Choose a valid date and time.'));
    if (at.getTime() < Date.now() + 5 * 60000) return showToast(tr('Choose a time at least 5 minutes from now.'));
    const btn = $('arr-save'); if (btn) { btn.disabled = true; btn.textContent = tr('Sending…'); }
    try {
      const { contract } = await apiFetch('POST', `/contracts/${encodeURIComponent(contractId)}/arrival-time`, { at: at.toISOString(), tz: myTz(), note: ($('arr-note') || {}).value || '' });
      if (contract) RAW_CONTRACTS[contractId] = { ...(raw(contractId) || {}), ...contract };
      closeArrivalTime();
      showToast(tr('Proposal sent. You will be notified when it is accepted.'));
      redrawCurrent();
    } catch (e) { showToast(e.message || tr('Could not send the proposal.')); if (btn) { btn.disabled = false; btn.textContent = tr('Send Proposal'); } }
  };
  window.acceptArrivalTime = async function (contractId) {
    try {
      const { contract } = await apiFetch('POST', `/contracts/${encodeURIComponent(contractId)}/arrival-time/accept`, { tz: myTz() });
      if (contract) RAW_CONTRACTS[contractId] = { ...(raw(contractId) || {}), ...contract };
      showToast(`${tr('Arrival time confirmed')}: ${when(contract.arrival.agreed.at)}`);
      redrawCurrent();
    } catch (e) { showToast(e.message || tr('Could not accept the time.')); }
  };
  async function redrawCurrent() {
    try {
      if (role() === 'provider') { await loadProviderData(); const k = currentKey('provider-nav'); selectProviderSection(k || 'contracts'); }
      else { await loadCustomerData(); const k = currentKey('customer-nav'); selectCustomerSection(k || 'bookings'); }
    } catch (e) {}
  }
  function currentKey(navId) {
    const a = document.querySelector(`#${navId} .dash-nav-item.active`);
    const m = a && /\('([a-z]+)'\)/.exec(a.getAttribute('onclick') || '');
    return m ? m[1] : null;
  }

  // ── the "next job" card ───────────────────────────────────────────────
  function nextUp() {
    const list = Object.values(RAW_CONTRACTS || {}).filter(c => {
      if (c.ride || c.delivery || c.storeOrder) return false;
      const mine = role() === 'provider' ? c.providerId === AUTH.user.id : c.customerId === AUTH.user.id;
      return mine && OPEN.includes(c.status);
    });
    const trip = list.filter(c => c.status === 'active' && c.onMyWayAt && !c.arrivedAt && Date.now() - Date.parse(c.onMyWayAt) < 6 * 3600000).sort((a, b) => Date.parse(b.onMyWayAt) - Date.parse(a.onMyWayAt))[0];
    if (trip) return { kind: 'trip', c: trip };
    const ask = list.find(c => c.arrival && c.arrival.proposal && c.arrival.proposal.byId !== AUTH.user.id && canSchedule(c));
    const next = list.filter(c => c.status === 'active' && !c.onMyWayAt && !c.arrivedAt && c.arrival && c.arrival.agreed && Date.parse(c.arrival.agreed.at) > Date.now() - 24 * 3600000)
      .sort((a, b) => Date.parse(a.arrival.agreed.at) - Date.parse(b.arrival.agreed.at))[0];
    if (next && timeToLeave(next)) return { kind: 'next', c: next };
    if (ask) return { kind: 'ask', c: ask };
    if (next) return { kind: 'next', c: next };
    const unscheduled = list.find(c => c.status === 'active' && canSchedule(c) && !(c.arrival && (c.arrival.agreed || c.arrival.proposal)));
    if (unscheduled) return { kind: 'none', c: unscheduled };
    return null;
  }
  function cardHTML() {
    const n = nextUp();
    if (!n) return '';
    const c = n.c, isPro = role() === 'provider';
    const who = otherName(c);
    const title = `${sentence(c.service || '')}${c.bookingNumber ? ` · #${c.bookingNumber}` : ''}`;
    let label = '', head = '', sub = '', btns = '';
    if (n.kind === 'trip') {
      label = tr('Trip in progress');
      head = isPro ? `${tr('En route to')} ${who}` : `${who} ${tr('is en route')}`;
      sub = `${tr('Departed')} ${new Date(c.onMyWayAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${c.arrival && c.arrival.agreed ? ` · ${tr('due')} ${when(c.arrival.agreed.at)}` : ''}`;
      btns = isPro
        ? `<button type="button" class="btn-sm btn-sm-primary" onclick="markContractArrived(${jsArg(c.id)})">${esc(tr('I Have Arrived'))}</button><button type="button" class="btn-sm btn-sm-outline" onclick="openTripTracking(${jsArg(c.id)})">${esc(tr('View Trip'))}</button>`
        : `<button type="button" class="btn-sm btn-sm-primary" onclick="openTripTracking(${jsArg(c.id)})">${esc(tr('Track Arrival'))}</button>`;
    } else if (n.kind === 'next') {
      const due = c.arrival.agreed.at, leave = timeToLeave(c);
      const overdue = Date.parse(due) < Date.now();
      label = isPro ? (overdue ? tr('Overdue') : leave ? tr('Time to leave') : tr('Next job')) : tr('Upcoming arrival');
      head = isPro ? `${tr('Due at')} ${who}'s ${when(due)}` : `${who} ${tr('arrives')} ${when(due)}`;
      sub = `${sentence(inWords(due))}${isPro && !leave ? ` · ${tr('you will be reminded when it is time to leave')}` : ''}`;
      btns = isPro
        ? `<button type="button" class="btn-sm ${leave ? 'btn-sm-primary' : 'btn-sm-outline'}" onclick="markContractOnMyWay(${jsArg(c.id)})">${esc(tr('Leave Now'))}</button>${c.jobLocation ? `<a class="btn-sm btn-sm-outline" href="https://www.google.com/maps/dir/?api=1&destination=${c.jobLocation.latitude},${c.jobLocation.longitude}" target="_blank" rel="noopener noreferrer">${esc(tr('Directions'))}</a>` : ''}`
        : `<button type="button" class="btn-sm btn-sm-outline" onclick="openArrivalTime(${jsArg(c.id)})">${esc(tr('Change Time'))}</button>`;
      if (isPro && (leave || overdue)) label = `<span class="pill pill-live">${esc(label)}</span>`;
    } else if (n.kind === 'ask') {
      label = tr('Action needed');
      head = `${who} ${tr('proposed an arrival time')}`;
      sub = when(c.arrival.proposal.at);
      btns = `<button type="button" class="btn-sm btn-sm-primary" onclick="acceptArrivalTime(${jsArg(c.id)})">${esc(tr('Accept'))}</button><button type="button" class="btn-sm btn-sm-outline" onclick="openArrivalTime(${jsArg(c.id)})">${esc(tr('Propose Another Time'))}</button>`;
    } else {
      label = tr('Action needed');
      head = tr('No arrival time agreed');
      sub = `${tr('Agree a time with')} ${who} ${tr('so both of you receive reminders.')}`;
      btns = `<button type="button" class="btn-sm btn-sm-primary" onclick="openArrivalTime(${jsArg(c.id)})">${esc(tr('Agree Arrival Time'))}</button>`;
    }
    return `<div class="next-card" id="next-card"><div class="next-label">${label.startsWith('<span') ? label : esc(label)}</div><div class="next-title">${esc(title)}</div><div class="next-head">${esc(head)}</div><div class="next-sub">${esc(sub)}</div><div class="next-btns">${btns}</div></div>`;
  }
  function placeCard(mainId) {
    const main = $(mainId);
    if (!main) return;
    const old = $('next-card'); if (old) old.remove();
    const html = cardHTML();
    if (!html) return;
    const header = main.querySelector('.dash-header');
    if (header) header.insertAdjacentHTML('afterend', html); else main.insertAdjacentHTML('afterbegin', html);
  }
  const CARD_ON = { customer: ['overview', 'bookings'], provider: ['overview', 'contracts'] };
  for (const [fn, r, mainId] of [['selectCustomerSection', 'customer', 'customer-main'], ['selectProviderSection', 'provider', 'provider-main']]) {
    if (typeof window[fn] !== 'function') continue;
    const f = window[fn];
    window[fn] = function (key) { const out = f.apply(this, arguments); if (CARD_ON[r].includes(key)) placeCard(mainId); return out; };
  }
  // Keep the countdown and "Time to leave" current without a reload.
  setInterval(() => {
    if (!AUTH.user || document.hidden) return;
    const r = role(); if (!['customer', 'provider'].includes(r)) return;
    const k = currentKey(r === 'provider' ? 'provider-nav' : 'customer-nav');
    if (CARD_ON[r].includes(k)) placeCard(r === 'provider' ? 'provider-main' : 'customer-main');
  }, 30000);

  // ── phone layout: tables become labelled cards ────────────────────────
  function cardify(root) {
    (root || document).querySelectorAll('#customer-main table.data-table, #provider-main table.data-table').forEach(t => {
      if (t.dataset.cardified === '1') return;
      if (t.querySelector('td[colspan]')) return; // tables with expandable rows keep their own layout
      const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
      if (!heads.length) return;
      t.classList.add('tbl-cards');
      t.querySelectorAll('tbody tr').forEach(tr => {
        [...tr.children].forEach((td, i) => {
          const label = heads[i] || '';
          td.setAttribute('data-label', label);
          // v155: a cell holding only buttons or links is an actions row too (a line across the card, buttons full width)
          const onlyButtons = td.children.length > 0 && [...td.children].every(c => /^(BUTTON|A)$/.test(c.tagName) || c.classList.contains('btn-sm')) && !(td.textContent.replace([...td.children].map(c => c.textContent).join(''), '').trim());
          if (/^actions?$/i.test(label) || td.classList.contains('row-actions') || onlyButtons) { td.classList.add('td-actions'); return; }
          // Everything in the cell goes in one box, so it all sits in the value column.
          if (td.childNodes.length && !(td.childNodes.length === 1 && td.firstChild.classList && td.firstChild.classList.contains('td-v'))) {
            const box = document.createElement('div'); box.className = 'td-v';
            while (td.firstChild) box.appendChild(td.firstChild);
            td.appendChild(box);
          }
        });
      });
      t.dataset.cardified = '1';
    });
    // "Welcome back, JAMES" reads "Welcome back, James".
    (root || document).querySelectorAll('#customer-main .dash-title, #provider-main .dash-title').forEach(h => {
      const m = /^(.*?,\s*)([^,]+)$/.exec(h.textContent || '');
      if (m && /[A-Za-z]/.test(m[2]) && (m[2] === m[2].toUpperCase() || m[2] === m[2].toLowerCase())) { const fixed = m[1] + nameFix(m[2]); if (h.textContent !== fixed) h.textContent = fixed; }
    });
    // The pro's start button reads the same everywhere.
    (root || document).querySelectorAll('#provider-main button[onclick^="markContractOnMyWay"]').forEach(b => { if (b.textContent.trim() !== tr('Leave Now')) b.textContent = tr('Leave Now'); b.classList.remove('btn-sm-outline'); b.classList.add('btn-sm-primary'); });
    (root || document).querySelectorAll('#provider-main button[onclick^="markContractArrived"]').forEach(b => { if (!/arrived/i.test(b.dataset.done || '')) { b.textContent = tr('I Have Arrived'); b.dataset.done = 'arrived'; } });
    (root || document).querySelectorAll('#provider-main button[onclick^="openTripTracking"]').forEach(b => { b.textContent = tr('View Trip'); });
  }
  // Names in the side panel, the account button and greetings, shown properly
  // ("walter wisner" and "JAMES DOE" read "Walter Wisner" and "James Doe").
  // Display only: the account itself is not changed.
  function tidyChrome() {
    document.querySelectorAll('[id$="-sidebar-name"]').forEach(el => { const f = nameFix(el.textContent); if (f && f !== el.textContent) el.textContent = f; });
    document.querySelectorAll('.account-menu-btn').forEach(el => {
      const t = el.childNodes; for (const n of t) if (n.nodeType === 3) { const m = /^(\s*👤?\s*)(.+?)(\s*▾\s*)$/.exec(n.nodeValue); if (m) { const f = m[1] + nameFix(m[2]) + m[3]; if (f !== n.nodeValue) n.nodeValue = f; } }
    });
    document.querySelectorAll('.customer-welcome-text').forEach(el => { const m = /^(Welcome back, )(\S+)(.*)$/.exec(el.textContent); if (m) { const f = m[1] + nameFix(m[2]) + m[3]; if (f !== el.textContent) el.textContent = f; } });
  }
  setInterval(() => { if (AUTH.user) tidyChrome(); }, 1500);
  let pending = null;
  const obs = new MutationObserver(() => { if (pending) return; pending = setTimeout(() => { pending = null; cardify(); }, 30); });
  function watch() { ['customer-main', 'provider-main'].forEach(id => { const el = $(id); if (el && !el.dataset.cardWatch) { el.dataset.cardWatch = '1'; obs.observe(el, { childList: true, subtree: true }); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
