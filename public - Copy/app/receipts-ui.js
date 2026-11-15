// v166: Account → Receipts. Every receipt Trothen has sent the person
// (payments, cash rides and jobs, refunds, token purchases, payout
// statements), newest first, to download again or have emailed again.
// The receipts themselves are made and emailed by the server
// (src/receipts.js) the moment the money moves.
(function () {
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const ICON = { payment: '🧾', cash: '💵', refund: '↩️', tokens: '🪙', payout: '💸' };
  const KIND = { payment: 'Payment', cash: 'Paid in cash', refund: 'Refund', tokens: 'Tokens', payout: 'Payout statement' };
  const FOR = { ride: 'Ride', delivery: 'Delivery', store: 'Store order', booking: 'Booking', extra: 'Extra work', tip: 'Tip', tokens: 'Tokens', payout: 'Payout' };
  const FILTERS = [['all', 'All'], ['ride', 'Rides'], ['delivery', 'Deliveries'], ['store', 'Store orders'], ['booking', 'Bookings'], ['refund', 'Refunds'], ['tokens', 'Tokens'], ['payout', 'Payouts']];
  let LIST = null, FILTER = 'all';

  function shellHTML() {
    return `<div class="dash-header"><div><div class="dash-title">${e(tr('Receipts'))}</div><div class="dash-sub">${e(tr('Every payment, refund and payout, with its receipt. Each one is also emailed to you when it happens.'))}</div></div></div>
      <div id="rcpt-filters" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
      <div id="rcpt-body"><div class="panel" style="color:var(--slate);">${e(tr('Loading…'))}</div></div>`;
  }
  function when(iso) {
    try { return new Date(iso).toLocaleString(typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG === 'es' ? 'es' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (x) { return String(iso || '').slice(0, 16); }
  }
  function rowHTML(r) {
    const money = r.local ? `${r.local} <span style="color:var(--slate);font-weight:400;font-size:12.5px;">($${Number(r.amountUsd).toFixed(2)})</span>` : `$${Number(r.amountUsd).toFixed(2)}`;
    const sign = r.kind === 'refund' || r.kind === 'payout' ? '+ ' : '';
    return `<div class="panel" style="display:flex;gap:12px;align-items:flex-start;padding:14px 16px;margin-bottom:10px;">
      <div aria-hidden="true" style="font-size:22px;line-height:1;">${ICON[r.kind] || '🧾'}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><strong style="font-size:14.5px;">${e(r.title)}</strong><strong style="white-space:nowrap;font-size:14.5px;">${sign}${money}</strong></div>
        <div style="font-size:12.5px;color:var(--slate);margin-top:2px;">${e(tr(KIND[r.kind] || 'Receipt'))} · ${e(when(r.at))} · ${e(r.number)}${r.emailed ? ' · ' + e(tr('emailed')) : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button type="button" class="btn-sm btn-sm-outline" onclick="receiptDownload('${e(r.id)}','${e(r.number)}')">${e(tr('Download PDF'))}</button>
          <button type="button" class="btn-sm btn-sm-ghost" onclick="receiptEmail('${e(r.id)}', this)">${e(tr('Email it to me'))}</button>
        </div>
      </div></div>`;
  }
  function paint() {
    const body = document.getElementById('rcpt-body'), fb = document.getElementById('rcpt-filters');
    if (!body || !LIST) return;
    const present = new Set(LIST.flatMap(r => [r.for, r.kind]));
    if (fb) fb.innerHTML = FILTERS.filter(([k]) => k === 'all' || present.has(k)).map(([k, l]) => `<button type="button" class="btn-sm ${FILTER === k ? 'btn-sm-primary' : 'btn-sm-outline'}" aria-pressed="${FILTER === k}" onclick="receiptFilter('${k}')">${e(tr(l))}</button>`).join('');
    const shown = LIST.filter(r => FILTER === 'all' || r.for === FILTER || r.kind === FILTER);
    body.innerHTML = shown.length ? shown.map(rowHTML).join('')
      : `<div class="panel" style="color:var(--slate);font-size:14px;">${e(tr(LIST.length ? 'No receipts of this kind yet.' : 'No receipts yet. When you pay for something on Trothen, or are paid, its receipt shows here and is emailed to you.'))}</div>`;
  }
  async function load() {
    try { LIST = (await apiFetch('GET', '/receipts')).receipts || []; }
    catch (x) { const b = document.getElementById('rcpt-body'); if (b) b.innerHTML = `<div class="panel">${e(x.message || tr('Could not load your receipts'))}</div>`; return; }
    paint();
  }
  window.receiptFilter = function (k) { FILTER = k; paint(); };
  window.receiptDownload = function (id, number) { v105Download('/receipts/' + encodeURIComponent(id) + '/pdf', `Trothen-${number}.pdf`); };
  window.receiptEmail = async function (id, btn) {
    if (btn) btn.disabled = true;
    try { const r = await apiFetch('POST', '/receipts/' + encodeURIComponent(id) + '/email'); showToast(tr('Sent to') + ' ' + r.to); }
    catch (x) { showToast(x.message || tr('Could not send it')); }
    finally { if (btn) btn.disabled = false; }
  };

  // In the account menus: customers after Payments, pros after Earnings & Payouts.
  const addAfter = (items, after) => { if (items.some(i => i.key === 'receipts')) return; const i = items.findIndex(x => x.key === after); items.splice(i === -1 ? items.length - 1 : i + 1, 0, { key: 'receipts', label: 'Receipts', icon: '🧾' }); };
  addAfter(CUSTOMER_NAV_ITEMS, 'payments');
  addAfter(PROVIDER_NAV_ITEMS, 'earnings');
  CUSTOMER_SECTIONS.receipts = shellHTML;
  PROVIDER_SECTIONS.receipts = shellHTML;
  { const o = selectCustomerSection; selectCustomerSection = function (key) { const r = o.apply(this, arguments); if (key === 'receipts') { FILTER = 'all'; load(); } return r; }; }
  { const o = selectProviderSection; selectProviderSection = function (key) { const r = o.apply(this, arguments); if (key === 'receipts') { FILTER = 'all'; load(); } return r; }; }

  // The "View my receipts" link in a receipt email (/?go=receipts): once the
  // person is signed in and their dashboard is up, open Receipts.
  function wantsReceipts() { try { return new URLSearchParams(location.search).get('go') === 'receipts'; } catch (x) { return false; } }
  function clearGo() { try { const u = new URL(location.href); u.searchParams.delete('go'); history.replaceState(history.state, '', u.pathname + (u.search ? u.search : '') + u.hash); } catch (x) {} }
  { const o = goDashboard; goDashboard = async function (role) {
    const r = await o.apply(this, arguments);
    if (wantsReceipts() && AUTH.user) {
      clearGo();
      if (AUTH.user.role === 'provider') selectProviderSection('receipts');
      else if (AUTH.user.role === 'customer') goToCustomerDashboard('receipts');
    }
    return r;
  }; }
  if (wantsReceipts() && !(typeof AUTH !== 'undefined' && AUTH.token) && typeof showAuth === 'function') {
    // Not signed in on this device: sign in first; the dashboard then opens Receipts.
    window.addEventListener('load', () => { if (!AUTH.user) { try { showAuth('login'); showToast(tr('Sign in to see your receipts')); } catch (x) {} } });
  }
})();
