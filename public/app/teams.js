// v147: My Team, for a team manager (Head of Customer Service, Verification
// lead…). They see everyone on their team (when each last signed in, how
// much they did this week), add people to the team, and suspend or
// reactivate them. Their own access to data stays exactly their team's.
(function () {
  'use strict';
  const e = (s) => escapeHtml(String(s == null ? '' : s));
  const isManager = () => !!(AUTH && AUTH.user && AUTH.user.role === 'admin' && AUTH.user.teamManager === true && AUTH.user.adminDepartment);

  if (typeof getAdminNavItems === 'function') {
    const f = getAdminNavItems;
    getAdminNavItems = function () {
      const items = f.apply(this, arguments).slice();
      if (isManager() && !items.some(i => i.key === 'myteam')) items.splice(Math.max(0, items.length - 1), 0, { key: 'myteam', label: 'My Team', icon: '👥' });
      return items;
    };
  }
  if (typeof ADMIN_SECTIONS !== 'undefined') {
    ADMIN_SECTIONS.myteam = () => `<div class="dash-header"><div><div class="dash-title">My Team</div><div class="dash-sub">The people on your team, and adding or suspending them</div></div><button class="btn-sm btn-sm-primary" onclick="teamAddOpen()">+ Add someone</button></div>
      <div class="panel" id="team-add" style="display:none;"><div class="panel-title">Add someone to your team</div>
        <div class="form-row"><div class="form-group"><label class="form-label" for="team-name">Full name</label><input class="form-input" id="team-name" autocomplete="off"/></div>
        <div class="form-group"><label class="form-label" for="team-email">Work email</label><input class="form-input" id="team-email" type="email" autocomplete="off"/></div></div>
        <div class="form-group"><label class="form-label" for="team-pass">Temporary password (8+ characters)</label><input class="form-input" id="team-pass" type="text" autocomplete="new-password"/><div style="font-size:12.5px;color:var(--muted);margin-top:4px;">Give it to them in person or by phone. They must change it the first time they sign in, and they sign in with a code sent to their email.</div></div>
        <div class="ver-note">They get the same access as your team, and cover no more than you do.</div>
        <div class="row-actions" style="margin-top:8px;"><button class="btn-sm btn-sm-primary" onclick="teamAdd()">Add to my team</button><button class="btn-sm btn-sm-outline" onclick="document.getElementById('team-add').style.display='none'">Cancel</button></div></div>
      <div class="panel"><div id="team-body">Loading…</div></div>`;
  }
  if (typeof selectAdminSection === 'function') {
    const f = selectAdminSection;
    selectAdminSection = function (key) { const r = f.apply(this, arguments); if (key === 'myteam') draw(); return r; };
  }

  const when = (iso) => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
  async function draw(data) {
    const box = document.getElementById('team-body'); if (!box) return;
    let d = data;
    if (!d) { try { d = await apiFetch('GET', '/admin/team'); } catch (x) { box.textContent = x.message || 'Could not load your team'; return; } }
    const rows = d.members || [];
    const me = AUTH.user.id;
    box.innerHTML = `<div class="panel-title">${e(d.teamName || '')} team <small>${rows.length} ${rows.length === 1 ? 'person' : 'people'}</small></div>
      <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Covers</th><th>Last signed in</th><th>Actions this week</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(m => `<tr><td>${e(m.name)}${m.teamManager ? ' <span class="badge badge-success">Manager</span>' : ''}<div style="font-size:12.5px;color:var(--slate);">${e(m.email)}</div>${m.mustChangePassword ? '<div style="font-size:12px;color:#B45309;">Hasn\'t signed in to set their password yet</div>' : ''}</td>
        <td>${e(m.scope)}</td><td>${e(when(m.lastSignIn))}</td><td>${m.actionsThisWeek}</td><td>${statusBadge(m.active ? 'active' : 'suspended')}</td>
        <td class="row-actions">${m.id === me || m.teamManager ? '' : `<button class="btn-sm btn-sm-outline" onclick="teamSetActive('${e(m.id)}', ${!m.active})">${m.active ? 'Suspend' : 'Reactivate'}</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:8px;">"Actions this week" counts the records they opened that hold people's personal details (the Access Log). Suspending someone signs them out at once. Only a super admin can suspend or change a manager.</div>`;
  }
  window.teamAddOpen = () => { const p = document.getElementById('team-add'); if (p) { p.style.display = ''; document.getElementById('team-name').focus(); } };
  window.teamAdd = async function () {
    const name = document.getElementById('team-name').value.trim(), email = document.getElementById('team-email').value.trim(), password = document.getElementById('team-pass').value;
    if (name.length < 2) return showToast('Enter their full name');
    if (!isValidEmailClient(email)) return showToast('Enter a valid email address');
    if (password.length < 8 || password.length > 72) return showToast('The temporary password must be 8 to 72 characters');
    const u = AUTH.user;
    try {
      const { admin } = await apiFetch('POST', '/admin/sub-admins', { name, email, password, city: u.city || u.region || '', country: u.country || '', department: u.adminDepartment, scope: u.adminScope === 'country' ? 'country' : 'city', regionScoped: !!u.regionScoped });
      showToast(`${admin.name} has been added to your team`);
      document.getElementById('team-add').style.display = 'none';
      ['team-name', 'team-email', 'team-pass'].forEach(id => { document.getElementById(id).value = ''; });
      draw();
    } catch (x) { showToast(x.message || 'Could not add them'); }
  };
  window.teamSetActive = async function (id, active) {
    try { await apiFetch('PATCH', `/admin/team/${encodeURIComponent(id)}`, { active }); showToast(active ? 'Reactivated' : 'Suspended and signed out'); draw(); }
    catch (x) { showToast(x.message || 'Could not change'); }
  };
})();
