// v146: Admin → Call health. The last 50 calls, each with what happened in
// plain words (talked, didn't ring because Trothen wasn't open, answered but
// the sound never connected, cut off…), this week's totals, and what to fix.
// Super admins only.
(function () {
  'use strict';
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const t = (s) => (typeof tr === 'function' ? tr(s) : s);
  const isSuper = () => !!(AUTH && AUTH.user && AUTH.user.role === 'admin' && AUTH.user.isSuperAdmin);

  if (typeof getAdminNavItems === 'function') {
    const f = getAdminNavItems;
    getAdminNavItems = function () {
      const items = f.apply(this, arguments).slice();
      if (isSuper() && !items.some(i => i.key === 'callhealth')) {
        const at = items.findIndex(i => i.key === 'rides');
        items.splice(at >= 0 ? at + 1 : items.length, 0, { key: 'callhealth', label: 'Call health', icon: '📞' });
      }
      return items;
    };
  }
  if (typeof ADMIN_SECTIONS !== 'undefined') {
    ADMIN_SECTIONS.callhealth = () => `<div class="dash-header"><div><div class="dash-title">${e(t('Call health'))}</div><div class="dash-sub">${e(t('Why calls worked or didn\'t, and what to fix'))}</div></div></div><div id="callhealth-body"><div class="panel">${e(t('Loading…'))}</div></div>`;
  }
  if (typeof selectAdminSection === 'function') {
    const f = selectAdminSection;
    selectAdminSection = function (key) { const r = f.apply(this, arguments); if (key === 'callhealth') draw(); return r; };
  }

  const COLOR = { talked: '#15803d', active: '#15803d', ringing: 'var(--slate)', declined: 'var(--slate)', no_answer: 'var(--slate)', caller_hung_up: 'var(--slate)', hung_up_connecting: '#B45309', not_open: '#B45309', dropped: '#B45309', no_connect: '#C0392B' };
  async function draw() {
    const box = document.getElementById('callhealth-body'); if (!box) return;
    let d; try { d = await apiFetch('GET', '/admin/calls/health'); } catch (x) { box.innerHTML = `<div class="panel">${e(x.message || t('Could not load'))}</div>`; return; }
    const w = d.week;
    const stat = (n, label, color) => `<div style="flex:1;min-width:120px;border:1px solid var(--border);border-radius:10px;padding:10px 12px;"><div style="font-size:22px;font-weight:700;color:${color || 'var(--navy)'};">${n}</div><div style="font-size:12.5px;color:var(--slate);">${e(t(label))}</div></div>`;
    const lvl = { high: ['#FDECEA', '#C0392B', 'Fix first'], medium: ['#FEF6E7', '#B45309', 'Should fix'], low: ['#EEF6F1', '#15803d', 'Good to know'] };
    const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    box.innerHTML = `
      <div class="panel"><div class="panel-title">${e(t('Set-up'))}</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:14px;">
          <span>${d.relay ? '✅' : '❌'} ${e(t(d.relay ? 'Relay (TURN) server set: calls work on every network' : 'No relay (TURN) server: calls fail on some networks'))}</span>
          <span>${d.push ? '✅' : '❌'} ${e(t(d.push ? 'Phone push set: a closed Trothen still gets a notification' : 'No phone push: a call only rings while Trothen is open'))}</span>
        </div></div>
      ${d.fixes.length ? `<div class="panel"><div class="panel-title">${e(t('What to fix'))}</div>${d.fixes.map(f => { const L = lvl[f.level] || lvl.low; return `<div style="background:${L[0]};border-left:4px solid ${L[1]};border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:14px;"><strong style="color:${L[1]};">${e(t(L[2]))}:</strong> ${e(f.text)}</div>`; }).join('')}</div>` : ''}
      <div class="panel"><div class="panel-title">${e(t('The last 7 days'))}: ${w.total} ${e(t(w.total === 1 ? 'call' : 'calls'))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${stat(w.talked, 'Talked', '#15803d')}${stat(w.notOpen, "Didn't ring (Trothen not open)", w.notOpen ? '#B45309' : null)}${stat(w.noConnect, 'Answered, sound never connected', w.noConnect ? '#C0392B' : null)}${stat(w.dropped, 'Cut off', w.dropped ? '#B45309' : null)}${stat(w.noAnswer, 'Rang, no answer')}${stat(w.declined, 'Declined')}${stat(w.callerHungUp, 'Caller hung up first')}
        </div></div>
      <div class="panel"><div class="panel-title">${e(t('The last 50 calls'))}</div>
        ${d.recent.length ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13.5px;"><thead><tr style="text-align:left;color:var(--slate);"><th style="padding:6px;">${e(t('When'))}</th><th style="padding:6px;">${e(t('Who called'))}</th><th style="padding:6px;">${e(t('Who was called'))}</th><th style="padding:6px;">${e(t('What happened'))}</th></tr></thead><tbody>
          ${d.recent.map(c => `<tr style="border-top:1px solid var(--border);"><td style="padding:6px;white-space:nowrap;">${e(when(c.when))}</td><td style="padding:6px;">${e(c.from)}</td><td style="padding:6px;">${e(c.to)}</td><td style="padding:6px;color:${COLOR[c.outcome.key] || 'inherit'};">${c.video ? '🎥' : '📞'} ${e(c.outcome.words)}${c.network ? `<div style="font-size:12px;color:var(--muted);">${e(t('Network paths found'))}: ${e(c.network)}${c.relayOnCall === false ? ` · ${e(t('no relay'))}` : ''}</div>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : `<div style="color:var(--slate);">${e(t('No calls yet.'))}</div>`}
        <div style="font-size:12.5px;color:var(--muted);margin-top:8px;">${e(t('Only times and outcomes are kept. Calls are never recorded.'))}</div>
      </div>`;
  }
})();
