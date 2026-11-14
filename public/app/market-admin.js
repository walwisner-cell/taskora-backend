// v164: Admin → Market. The team's one place to look after the Market:
// numbers at a glance, listings to check, every listing and store good with
// search, sellers (and stopping one from selling), orders, stolen-item
// reports, what the team did, and the Market fees. Server: src/routes/market-admin.routes.js.
(function () {
  const e = (s) => escapeHtml(s == null ? '' : String(s));
  const A = { tab: 'overview', show: {}, q: {} };
  const TABS = [
    ['overview', 'At a glance'], ['check', 'To check'], ['listings', 'Listings'], ['goods', 'Store goods'],
    ['sellers', 'Sellers'], ['orders', 'Orders'], ['stolen', 'Stolen items'], ['activity', 'Team activity'], ['fees', 'Fees'],
  ];
  const when = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (x) { return ''; } };
  const STATUS_WORDS = { live: 'On sale', review: 'Held for a check', hidden: 'Hidden', removed: 'Taken down', sold: 'Sold', reserved: 'Being bought', approved: 'Approved', pending: 'Waiting', rejected: 'Turned down' };
  const badge = (st) => `<span class="badge ${['live', 'approved', 'completed'].includes(st) ? 'badge-success' : ['removed', 'rejected', 'cancelled'].includes(st) ? 'badge-danger' : 'badge-pending'}">${e(STATUS_WORDS[st] || String(st).replace(/_/g, ' '))}</span>`;

  ADMIN_SECTIONS.market = () => `<div class="dash-header"><div><div class="dash-title">Market</div><div class="dash-sub">Listings, store goods, sellers and orders in the area you look after</div></div></div>
    <div class="am-tabs" role="tablist" aria-label="Market">${TABS.map(([k, l]) => `<button type="button" role="tab" class="btn-sm ${k === A.tab ? 'btn-sm-primary' : 'btn-sm-outline'}" data-amtab="${k}" aria-selected="${k === A.tab}" onclick="adminMarketTab('${k}')">${e(l)}</button>`).join('')}</div>
    <div id="am-body"><div class="panel" style="color:var(--slate);">Loading…</div></div>`;

  window.loadAdminMarket = function () { draw(); };
  window.adminMarketTab = function (k) {
    A.tab = k;
    document.querySelectorAll('[data-amtab]').forEach(b => { const on = b.dataset.amtab === k; b.className = 'btn-sm ' + (on ? 'btn-sm-primary' : 'btn-sm-outline'); b.setAttribute('aria-selected', on); });
    draw();
  };
  window.reloadAdminMarketTab = function () { draw(); };

  const body = () => document.getElementById('am-body');
  const fail = (x) => { const b = body(); if (b) b.innerHTML = `<div class="panel">${e(x.message || 'Could not load')}</div>`; };
  // A filter row: status choices, and a search box for the lists that have one.
  function filterRow(tab, choices, withSearch) {
    const cur = A.show[tab] || choices[0][0];
    return `<div class="am-filter">${choices.map(([k, l]) => `<button type="button" class="btn-sm ${k === cur ? 'btn-sm-primary' : 'btn-sm-ghost'}" onclick="adminMarketShow('${tab}','${k}')">${e(l)}</button>`).join('')}
      ${withSearch ? `<form class="am-search" onsubmit="event.preventDefault();adminMarketSearch('${tab}', this.q.value)" role="search"><label class="sr-only" for="am-q-${tab}">Search</label><input class="form-input" id="am-q-${tab}" name="q" type="search" placeholder="Search by name, seller or number" value="${e(A.q[tab] || '')}"/><button class="btn-sm btn-sm-outline" type="submit">Search</button></form>` : ''}</div>`;
  }
  window.adminMarketShow = function (tab, k) { A.show[tab] = k; draw(); };
  window.adminMarketSearch = function (tab, q) { A.q[tab] = String(q || '').trim(); draw(); };
  const qs = (tab, def) => `show=${encodeURIComponent(A.show[tab] || def)}&q=${encodeURIComponent(A.q[tab] || '')}`;

  async function draw() {
    const b = body(); if (!b) return;
    b.innerHTML = '<div class="panel" style="color:var(--slate);">Loading…</div>';
    try {
      if (A.tab === 'overview') return await drawOverview();
      if (A.tab === 'check') { A.show.listings = 'check'; return await drawListings('check'); }
      if (A.tab === 'listings') return await drawListings();
      if (A.tab === 'goods') return await drawGoods();
      if (A.tab === 'sellers') return await drawSellers();
      if (A.tab === 'orders') return await drawOrders();
      if (A.tab === 'stolen') return await drawStolen();
      if (A.tab === 'activity') return await drawActivity();
      if (A.tab === 'fees') { b.innerHTML = ''; return await window.drawMarketFees(b); }
    } catch (x) { fail(x); }
  }

  async function drawOverview() {
    const o = await apiFetch('GET', '/admin/market/overview');
    const tile = (n, label, tab, warn) => `<button type="button" class="am-tile${warn && n ? ' am-tile-warn' : ''}" onclick="adminMarketTab('${tab}')"><span class="am-n">${e(n)}</span><span class="am-l">${e(label)}</span></button>`;
    body().innerHTML = `<div class="panel"><div class="panel-title">Needs the team</div><div class="am-tiles">
        ${tile(o.listings.toCheck, 'Listings held or reported', 'check', true)}
        ${tile(o.goods.waiting, 'Store goods waiting', 'goods', true)}
        ${tile(o.orders.problems, 'Orders with a problem', 'orders', true)}
        ${tile(o.orders.returnsForTeam, 'Returns for the team', 'orders', true)}
        ${tile(o.stolenOpen, 'Stolen-item reports open', 'stolen', true)}
      </div></div>
      <div class="panel"><div class="panel-title">The Market now</div><div class="am-tiles">
        ${tile(o.listings.live, 'Personal listings on sale', 'listings')}
        ${tile(o.goods.live, 'Store goods on sale', 'goods')}
        ${tile(o.stores.live, 'Stores open', 'sellers')}
        ${tile(o.orders.open, 'Orders in progress', 'orders')}
        ${tile(o.orders.completed30, 'Orders completed, 30 days', 'orders')}
        ${tile(usd2(o.orders.value30), 'Sold, 30 days', 'orders')}
        ${tile(o.listings.removed, 'Listings taken down', 'listings')}
        ${tile(o.sellersStopped, 'Sellers stopped', 'sellers')}
      </div>
      <div class="ver-note" style="margin-top:10px;">How the team acts: take down what breaks the rules and say why (the seller sees the reason). Stop a seller who keeps breaking them. Every action is recorded under Team activity.</div></div>`;
  }

  // ── listings (also "To check") ───────────────────────────────────────
  async function drawListings(force) {
    const tab = 'listings';
    const show = force || A.show[tab] || 'live';
    const d = await apiFetch('GET', `/admin/market/all-listings?show=${encodeURIComponent(show)}&q=${encodeURIComponent(A.q[tab] || '')}`);
    const rows = d.listings.map(l => `<div class="am-row">
        ${l.photoUrls[0] ? `<img src="${e(l.photoUrls[0])}" alt="" class="am-thumb" loading="lazy"/>` : '<div class="am-thumb am-thumb-none" aria-hidden="true"></div>'}
        <div class="am-main"><div class="am-title">${e(l.title)}</div>
          <div class="am-meta">${e(l.currency)} ${e(l.price)} · ${e(l.category)} · ${badge(l.status)} · ${e(when(l.createdAt))} · ${e(l.views)} views</div>
          <div class="am-meta">${l.seller ? `${e(l.seller.name)}${l.seller.verified ? ' ✓' : ''}${l.seller.stopped ? ' · <strong style="color:#A5352B;">stopped</strong>' : ''}` : ''} · ${e([l.city, l.country].filter(Boolean).join(', '))}</div>
          ${l.description ? `<details class="am-more"><summary>Description</summary><div>${e(l.description)}</div></details>` : ''}
          ${l.reviewReasons.length ? `<div class="am-warn">Held for a check: ${e(l.reviewReasons.join('; '))}</div>` : ''}
          ${l.reports.length ? `<div class="am-warn">Reported ${l.reports.length} time${l.reports.length === 1 ? '' : 's'}:<ul>${l.reports.map(r => `<li>${e(r.reason)}</li>`).join('')}</ul></div>` : ''}
          ${l.removedReason ? `<div class="am-meta">Taken down: ${e(l.removedReason)}</div>` : ''}
        </div>
        <div class="am-actions">
          ${['review', 'hidden', 'removed'].includes(l.status) || l.reports.length ? `<button class="btn-sm btn-sm-outline" onclick="adminListing(${jsArg(l.id)},'restore')">${l.status === 'review' ? 'Approve' : l.status === 'removed' ? 'Put back on sale' : 'Keep it on sale'}</button>` : ''}
          ${!['removed', 'sold', 'reserved'].includes(l.status) ? `<button class="btn-sm btn-sm-ghost am-danger" onclick="adminListing(${jsArg(l.id)},'remove')">Take it down</button>` : ''}
          ${l.seller && !l.seller.stopped ? `<button class="btn-sm btn-sm-ghost" onclick="adminMarketStop(${jsArg(l.seller.id)},${jsArg(l.seller.name)})">Stop this seller</button>` : ''}
        </div></div>`).join('');
    body().innerHTML = `<div class="panel">${force ? '<div class="ver-note" style="margin-bottom:8px;">Listings held by the automatic safety checks (prices far below normal, a number registered as stolen, photos used by another seller), and listings people reported. Three reports from different people hide a listing until the team looks.</div>' : filterRow(tab, [['live', 'On sale'], ['check', 'To check'], ['hidden', 'Hidden'], ['removed', 'Taken down'], ['sold', 'Sold'], ['all', 'All']], true)}
      ${rows || `<p class="am-empty">${force ? 'Nothing to check. Well done.' : 'No listings match.'}</p>`}</div>`;
  }

  // ── store goods ──────────────────────────────────────────────────────
  async function drawGoods() {
    const d = await apiFetch('GET', '/admin/market/goods?' + qs('goods', 'live'));
    const rows = d.goods.map(g => `<div class="am-row">
        ${g.photoUrls[0] ? `<img src="${e(g.photoUrls[0])}" alt="" class="am-thumb" loading="lazy"/>` : '<div class="am-thumb am-thumb-none" aria-hidden="true"></div>'}
        <div class="am-main"><div class="am-title">${e(g.name)}</div>
          <div class="am-meta">${usd2(g.price)}${g.unit ? ' / ' + e(g.unit) : ''} · ${badge(g.status)}${g.live && !g.inStock ? ' · sold out' : ''}</div>
          <div class="am-meta">🛍️ ${e(g.storeName)} · ${e(g.seller.name)} · ${e([g.seller.city, g.seller.country].filter(Boolean).join(', '))}${g.seller.stopped ? ' · <strong style="color:#A5352B;">stopped</strong>' : ''}</div>
          ${g.reviewNote ? `<div class="am-meta">Note: ${e(g.reviewNote)}${g.reviewedByName ? ' (' + e(g.reviewedByName) + ')' : ''}</div>` : ''}
        </div>
        <div class="am-actions">
          ${g.status !== 'approved' ? `<button class="btn-sm btn-sm-primary" onclick="adminMarketGood(${jsArg(g.id)},'approve')">Approve</button>` : ''}
          ${g.status !== 'rejected' ? `<button class="btn-sm btn-sm-ghost am-danger" onclick="adminMarketGood(${jsArg(g.id)},'reject')">${g.status === 'approved' ? 'Take it down' : 'Turn down'}</button>` : ''}
          ${!g.seller.stopped ? `<button class="btn-sm btn-sm-ghost" onclick="adminMarketStop(${jsArg(g.seller.id)},${jsArg(g.seller.name)})">Stop this seller</button>` : ''}
        </div></div>`).join('');
    body().innerHTML = `<div class="panel">${filterRow('goods', [['live', 'On sale'], ['pending', 'Waiting'], ['rejected', 'Turned down'], ['all', 'All']], true)}${rows || '<p class="am-empty">No goods match.</p>'}</div>`;
  }
  window.adminMarketGood = async function (id, decision) {
    let note = '';
    if (decision === 'reject') { note = await askReason('Why? The seller sees this, so they can fix it.', 'Take it down', 3); if (note === null) return; }
    try { await apiFetch('POST', `/admin/store/goods/${encodeURIComponent(id)}/decide`, { decision, note }); showToast(decision === 'approve' ? 'Approved. It is on sale.' : 'Done. The seller was told why.'); draw(); }
    catch (x) { showToast(x.message); }
  };

  // ── sellers ──────────────────────────────────────────────────────────
  async function drawSellers() {
    const d = await apiFetch('GET', '/admin/market/sellers?' + qs('sellers', 'all'));
    const rows = d.sellers.map(s => `<div class="am-row">
        <div class="am-main"><div class="am-title">${e(s.storeName ? `${s.storeName} · ${s.name}` : s.name)} ${s.verified ? '<span class="badge badge-success">ID checked</span>' : ''} ${s.stopped ? '<span class="badge badge-danger">Stopped</span>' : ''}</div>
          <div class="am-meta">${e(s.role === 'provider' ? 'Pro' : 'Customer')} · ${e([s.city, s.country].filter(Boolean).join(', '))}${s.sellerRating ? ` · ★ ${e(s.sellerRating)}` : ''}</div>
          <div class="am-meta">${e(s.listingsLive)} listings on sale · ${e(s.goodsLive)} store goods · ${e(s.orders)} orders · ${s.reports ? `<strong style="color:#8a5a00;">${e(s.reports)} reports</strong>` : '0 reports'} · ${s.problems ? `<strong style="color:#8a5a00;">${e(s.problems)} problems or returns</strong>` : '0 problems'} · ${e(s.listingsRemoved)} taken down</div>
          ${s.stopped ? `<div class="am-warn">Stopped${s.stopped.until ? ' until ' + e(when(s.stopped.until)) : ' until lifted'} by ${e(s.stopped.byName || 'the team')}: ${e(s.stopped.reason)}</div>` : ''}
          ${s.storeClosedByTeam && !s.stopped ? '<div class="am-meta">Store closed by the team.</div>' : ''}
        </div>
        <div class="am-actions">${s.stopped ? `<button class="btn-sm btn-sm-outline" onclick="adminMarketLift(${jsArg(s.id)},${jsArg(s.name)})">Allow selling again</button>` : `<button class="btn-sm btn-sm-ghost am-danger" onclick="adminMarketStop(${jsArg(s.id)},${jsArg(s.name)})">Stop selling</button>`}</div>
      </div>`).join('');
    body().innerHTML = `<div class="panel">${filterRow('sellers', [['all', 'All sellers'], ['stopped', 'Stopped']], true)}
      <div class="ver-note" style="margin-bottom:6px;">Sellers with the most reports and problems come first. Stopping a seller takes their listings off sale and closes their store; orders already paid for carry on.</div>
      ${rows || '<p class="am-empty">No sellers match.</p>'}</div>`;
  }
  window.adminMarketStop = async function (id, name) {
    const p = confirmDialog('', { confirmLabel: 'Stop selling' });
    const m = document.getElementById('confirm-dialog-message');
    if (m) m.innerHTML = `<div style="text-align:left;"><div style="font-weight:700;color:var(--navy);margin-bottom:6px;">Stop ${e(name)} selling in the Market?</div>
      <label class="form-label" for="am-stop-why">Why? The seller sees this.</label><textarea class="form-input" id="am-stop-why" rows="3" maxlength="300"></textarea>
      <label class="form-label" for="am-stop-days" style="margin-top:8px;">For how long</label><select class="form-input form-select" id="am-stop-days"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="">Until the team lifts it</option></select></div>`;
    let reason = '', days = '30';
    document.getElementById('confirm-dialog-confirm-btn').addEventListener('click', () => { reason = (document.getElementById('am-stop-why') || {}).value || ''; days = (document.getElementById('am-stop-days') || {}).value; }, { once: true, capture: true });
    if (!(await p)) return;
    try { const r = await apiFetch('POST', `/admin/market/sellers/${encodeURIComponent(id)}/stop`, { reason, days: days ? Number(days) : null }); showToast(`Stopped. ${r.hidden} listing${r.hidden === 1 ? '' : 's'} taken off sale; the seller was told why.`); draw(); }
    catch (x) { showToast(x.message); }
  };
  window.adminMarketLift = async function (id, name) {
    if (!(await confirmDialog(`Allow ${name} to sell in the Market again?`, { confirmLabel: 'Allow selling' }))) return;
    try { const r = await apiFetch('POST', `/admin/market/sellers/${encodeURIComponent(id)}/lift`); showToast(`Done. ${r.back} listing${r.back === 1 ? ' is' : 's are'} back on sale.`); draw(); }
    catch (x) { showToast(x.message); }
  };

  // ── orders ───────────────────────────────────────────────────────────
  async function drawOrders() {
    const d = await apiFetch('GET', '/admin/market/orders?' + qs('orders', 'open'));
    const rows = d.orders.map(o => `<div class="am-row">
        <div class="am-main"><div class="am-title">#${e(o.number)} · ${e(o.seller.name)} → ${e(o.buyer ? o.buyer.name : '')}</div>
          <div class="am-meta">${badge(o.status)} · ${e(o.kind === 'person' ? 'From a person' : o.kind === 'store' ? 'From a store' : 'Goods with a job')} · ${usd2(o.goodsTotal || o.amount)} · ${e(when(o.createdAt))}${o.delivery ? ' · ' + e(o.delivery) : ''}</div>
          <div class="am-meta">${e(o.items)}</div>
          ${o.dispute ? `<div class="am-warn">Problem reported (${e(o.dispute.status)}). Decide it in Disputes.</div>` : ''}
          ${o.returnStatus ? `<div class="am-meta">Return: ${e(String(o.returnStatus).replace(/_/g, ' '))}</div>` : ''}
        </div>
        <div class="am-actions">${o.dispute ? `<button class="btn-sm btn-sm-outline" onclick="selectAdminSection('disputes')">Open Disputes</button>` : ''}${o.returnStatus === 'escalated' ? `<button class="btn-sm btn-sm-outline" onclick="selectAdminSection('stores')">Decide the return</button>` : ''}</div>
      </div>`).join('');
    body().innerHTML = `<div class="panel">${filterRow('orders', [['open', 'In progress'], ['problems', 'With a problem'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All']], true)}${rows || '<p class="am-empty">No orders match.</p>'}</div>`;
  }

  // ── stolen-item reports ──────────────────────────────────────────────
  async function drawStolen() {
    const d = await apiFetch('GET', '/admin/market/stolen?show=' + encodeURIComponent(A.show.stolen || 'open'));
    const rows = d.reports.map(r => `<div class="am-row">
        <div class="am-main"><div class="am-title">${e(r.what)} · number ending ${e(r.serialLast4)}</div>
          <div class="am-meta">${badge(r.status === 'open' ? 'pending' : 'completed')} · reported ${e(when(r.createdAt))} by ${e(r.owner.name)}${r.owner.phone ? ' · ' + e(r.owner.phone) : ''}${r.policeReport ? ' · police report ' + e(r.policeReport) : ''}</div>
          ${r.listings.length ? `<div class="am-warn">Listings with this number: ${r.listings.map(l => `${e(l.title)} (${e(STATUS_WORDS[l.status] || l.status)})`).join(', ')}</div>` : '<div class="am-meta">No listing with this number so far.</div>'}
          ${r.closedNote ? `<div class="am-meta">Closed: ${e(r.closedNote)}</div>` : ''}
        </div>
        <div class="am-actions">${r.status === 'open' ? `<button class="btn-sm btn-sm-outline" onclick="adminMarketStolenClose(${jsArg(r.id)})">Close the report</button>` : ''}</div>
      </div>`).join('');
    body().innerHTML = `<div class="panel">${filterRow('stolen', [['open', 'Open'], ['all', 'All']], false)}
      <div class="ver-note" style="margin-bottom:6px;">A listing whose number matches an open report is held at once and never goes on sale. Pass anything that looks like stolen goods to the police; don't confront the seller.</div>
      ${rows || '<p class="am-empty">No reports.</p>'}</div>`;
  }
  window.adminMarketStolenClose = async function (id) {
    const note = await askReason('What was found or done? The person who reported it sees this.', 'Close the report', 5); if (note === null) return;
    try { await apiFetch('POST', `/admin/market/stolen/${encodeURIComponent(id)}/close`, { note }); showToast('Closed. They were told.'); draw(); }
    catch (x) { showToast(x.message); }
  };

  async function drawActivity() {
    const d = await apiFetch('GET', '/admin/market/activity');
    body().innerHTML = `<div class="panel"><div class="panel-title">What the team did</div>${d.activity.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead><tbody>${d.activity.map(a => `<tr><td>${e(new Date(a.at).toLocaleString())}</td><td>${e(a.by)}</td><td>${e(a.what)}</td><td>${e(a.detail)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="am-empty">Nothing yet.</p>'}</div>`;
  }

  // A reason the other person will read, asked for in the app's own dialog.
  async function askReason(question, confirmLabel, min) {
    const p = confirmDialog('', { confirmLabel });
    const m = document.getElementById('confirm-dialog-message');
    if (m) m.innerHTML = `<div style="text-align:left;"><label class="form-label" for="am-why">${e(question)}</label><textarea class="form-input" id="am-why" rows="3" maxlength="300"></textarea></div>`;
    let v = '';
    document.getElementById('confirm-dialog-confirm-btn').addEventListener('click', () => { v = (document.getElementById('am-why') || {}).value || ''; }, { once: true, capture: true });
    if (!(await p)) return null;
    v = v.trim();
    if (v.length < min) { showToast(`Write at least ${min} characters, so they know why.`); return null; }
    return v;
  }
})();
