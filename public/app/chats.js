/* Messages: every conversation, past and present (v128). Loaded after trothen.js.

   Before this, the Messages page only listed people you had a booking
   with, showed "Tap to view conversation" instead of the last message, and
   kept no sense of what was new. A chat with a pro who answered your job
   but wasn't hired couldn't be found again at all.

   Now the page lists every conversation you've had on Trothen, newest
   first, with:
   - the last message and when it was sent;
   - how many messages you haven't read (also shown on the Messages menu);
   - the bookings and jobs each chat is about;
   - a search box, and an "Unread" filter;
   - date lines in the chat ("Today", "Yesterday", "Sat, Nov 1"), a note
     when the chat moves to a different job, and "Seen" under your last
     message once they've opened it;
   - "Save chat" to download the whole conversation as a text file.
   On a phone, the list and the chat take turns filling the screen.

   It replaces these functions from trothen.js, keeping their names so
   every "Message" and "Discuss" button already in the app still works:
   messagingHTML, loadMessageThread, selectMessageContact, sendRealMessage. */
(function () {
  'use strict';
  const CHATS = { list: [], loaded: false, activeId: null, q: '', filter: 'all', showThread: false, seq: 0, thread: [], role: null, unreadTotal: 0 };
  window.CHATS = CHATS;
  const $ = (id) => document.getElementById(id);
  const isPhone = () => window.matchMedia && window.matchMedia('(max-width: 860px)').matches;

  // ── small helpers ─────────────────────────────────────────────────────
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function shortWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    const now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (diff === 1) return tr('Yesterday');
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function dayLabel(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return tr('Today');
    if (diff === 1) return tr('Yesterday');
    return d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear() ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function statusWord(s) {
    const map = { pending_agreement: 'Agreeing on price', pending_provider_confirmation: 'Waiting for the pro', awaiting_payment: 'Waiting for payment', active: 'Active', completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined', expired: 'Expired', disputed: 'In dispute', open: 'Open', matched: 'Matched', closed: 'Closed' };
    return tr(map[s] || String(s || '').replace(/_/g, ' '));
  }
  function myRole() { return (AUTH.user && AUTH.user.role) || CHATS.role || 'customer'; }
  function convo(id) { return CHATS.list.find(c => c.userId === id) || null; }

  // Someone you have a booking with but no conversation record yet (for
  // example, the list hasn't loaded, or a "Message" button was pressed).
  function placeholderFor(id) {
    let name = null;
    try { const c = (getRealContacts(myRole()) || []).find(x => x.id === id); if (c) name = c.name; } catch (e) {}
    return { userId: id, name: name || tr('Conversation'), role: null, lastMessage: null, lastAt: null, unread: 0, total: 0, bookings: [], jobs: [], placeholder: true };
  }

  function matches(c, q) {
    if (!q) return true;
    const hay = [c.name, c.category, c.lastMessage && c.lastMessage.text]
      .concat((c.bookings || []).map(b => `${b.bookingNumber || ''} ${b.service || ''}`))
      .concat((c.jobs || []).map(j => j.title))
      .join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  }

  // ── the page ──────────────────────────────────────────────────────────
  window.messagingHTML = function (role) {
    CHATS.role = role;
    if (!BACKEND_AVAILABLE) {
      return `<div class="dash-header"><div><div class="dash-title">Messages</div><div class="dash-sub">Messaging is unavailable without a server connection</div></div></div>
      <div class="panel" style="text-align:center;color:var(--slate);padding:40px;">Messaging requires the backend to be running (demo mode).</div>`;
    }
    const unread = CHATS.list.reduce((s, c) => s + (c.unread || 0), 0);
    return `
    <div class="dash-header"><div><div class="dash-title">${escapeHtml(tr('Messages'))}</div><div class="dash-sub">${escapeHtml(tr('Every conversation you\'ve had on Trothen, newest first. Old chats stay here.'))}</div></div></div>
    <div class="chat-layout ${CHATS.showThread && isPhone() ? 'show-thread' : ''}" id="chat-layout">
      <div class="chat-side">
        <div class="chat-tools">
          <input type="search" class="form-input" id="chat-q" value="${escapeHtml(CHATS.q)}" placeholder="${escapeHtml(tr('Search names, bookings or jobs'))}" oninput="chatsSearch(this.value)" aria-label="${escapeHtml(tr('Search conversations'))}"/>
          <div class="chat-filters" role="tablist">
            <button type="button" class="chat-filter ${CHATS.filter === 'all' ? 'on' : ''}" onclick="chatsFilter('all')">${escapeHtml(tr('All'))}</button>
            <button type="button" class="chat-filter ${CHATS.filter === 'unread' ? 'on' : ''}" onclick="chatsFilter('unread')">${escapeHtml(tr('Unread'))}${unread ? ` (${unread})` : ''}</button>
          </div>
        </div>
        <div class="chat-list" id="chat-list">${listHTML()}</div>
      </div>
      <div class="chat-main">
        <div class="chat-head" id="chat-head">${headHTML()}</div>
        <div class="msg-thread-body chat-body" id="msg-thread-body"><div class="chat-empty">${escapeHtml(tr('Loading…'))}</div></div>
        <div class="msg-input-row" id="chat-input-row"><input type="text" placeholder="${escapeHtml(tr('Type a message...'))}" id="msg-input" maxlength="2000" onkeypress="if(event.key==='Enter')sendRealMessage()"/><button onclick="sendRealMessage()">${escapeHtml(tr('Send'))}</button></div>
      </div>
    </div>`;
  };

  function listHTML() {
    if (!CHATS.loaded && !CHATS.list.length) return `<div class="chat-empty">${escapeHtml(tr('Loading your conversations…'))}</div>`;
    let list = CHATS.list.slice();
    if (CHATS.activeId && !convo(CHATS.activeId)) list.unshift(placeholderFor(CHATS.activeId));
    list = list.filter(c => matches(c, CHATS.q) && (CHATS.filter !== 'unread' || c.unread > 0 || c.userId === CHATS.activeId));
    if (!CHATS.list.length && !CHATS.activeId) {
      return `<div class="chat-empty">${escapeHtml(tr(myRole() === 'provider'
        ? 'No conversations yet. When a customer books you, or you answer a posted job, your chat with them appears here and stays here.'
        : 'No conversations yet. When you book a pro, or a pro answers a job you posted, your chat with them appears here and stays here.'))}</div>`;
    }
    if (!list.length) return `<div class="chat-empty">${escapeHtml(tr(CHATS.filter === 'unread' ? 'No unread messages.' : 'Nothing matches that search.'))}</div>`;
    return list.map(c => {
      const lm = c.lastMessage;
      const preview = lm ? `${lm.fromMe ? escapeHtml(tr('You')) + ': ' : ''}${escapeHtml(lm.text)}` : `<span style="font-style:italic;">${escapeHtml(tr('No messages yet'))}</span>`;
      const b = (c.bookings || [])[0];
      const j = (c.jobs || [])[0];
      const more = (c.bookings || []).length + (c.jobs || []).length - 1;
      const ctx = b ? `${b.bookingNumber ? '#' + escapeHtml(b.bookingNumber) + ' · ' : ''}${escapeHtml(b.service || '')} · ${escapeHtml(statusWord(b.status))}` : j ? `${escapeHtml(tr('Job'))}: ${escapeHtml(j.title)}` : '';
      return `<button type="button" class="chat-item ${c.userId === CHATS.activeId ? 'active' : ''} ${c.unread ? 'has-unread' : ''}" data-contact-id="${escapeHtml(c.userId)}" onclick="selectMessageContact(${jsArg(c.userId)})">
        <span class="chat-avatar" aria-hidden="true">${escapeHtml(initials(c.name))}</span>
        <span class="chat-item-main">
          <span class="chat-item-top"><span class="chat-name">${escapeHtml(c.name)}</span><span class="chat-when">${escapeHtml(shortWhen(c.lastAt))}</span></span>
          <span class="chat-preview">${preview}</span>
          ${ctx ? `<span class="chat-ctx">${ctx}${more > 0 ? ` <span style="opacity:.75;">+${more}</span>` : ''}</span>` : ''}
        </span>
        ${c.unread ? `<span class="chat-unread" aria-label="${c.unread} ${escapeHtml(tr('unread'))}">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}
      </button>`;
    }).join('');
  }

  function headHTML() {
    const c = CHATS.activeId ? (convo(CHATS.activeId) || placeholderFor(CHATS.activeId)) : null;
    if (!c) return `<div class="chat-head-empty">${escapeHtml(tr('Pick a conversation'))}</div>`;
    const who = c.role === 'provider' ? (c.category ? `${tr('Pro')} · ${c.category}` : tr('Pro')) : c.role === 'customer' ? tr('Customer') : '';
    const since = c.total ? `${c.total} ${tr(c.total === 1 ? 'message' : 'messages')}` : '';
    const chips = (c.bookings || []).slice(0, 4).map(b => `<button type="button" class="chat-chip" onclick="chatsOpenBookings()" title="${escapeHtml(tr('Open your bookings'))}">${b.bookingNumber ? '#' + escapeHtml(b.bookingNumber) + ' · ' : ''}${escapeHtml(String(b.service || '').slice(0, 28))} · ${escapeHtml(statusWord(b.status))}</button>`).join('')
      + (c.jobs || []).filter(j => !(c.bookings || []).some(b => b.jobId === j.id)).slice(0, 2).map(j => `<span class="chat-chip">${escapeHtml(tr('Job'))}: ${escapeHtml(String(j.title).slice(0, 30))}</span>`).join('');
    return `<div class="chat-head-row">
        <button type="button" class="chat-back" onclick="chatsBack()" aria-label="${escapeHtml(tr('All conversations'))}">‹ ${escapeHtml(tr('All Chats'))}</button>
        <span class="chat-avatar" aria-hidden="true">${escapeHtml(initials(c.name))}</span>
        <div style="min-width:0;flex:1;"><div class="chat-head-name">${escapeHtml(c.name)}</div><div class="chat-head-sub">${escapeHtml([who, since].filter(Boolean).join(' · '))}</div></div>
        ${c.total ? `<button type="button" class="btn-sm btn-sm-outline" onclick="chatsDownload()" title="${escapeHtml(tr('Download this conversation as a text file'))}">⬇ ${escapeHtml(tr('Save Chat'))}</button>` : ''}
      </div>
      ${chips ? `<div class="chat-chips">${chips}</div>` : ''}`;
  }

  function threadHTML(messages, c) {
    if (!messages.length) return `<div class="chat-empty">${escapeHtml(tr('No messages yet. Say hello.'))}</div>`;
    const me = AUTH.user && AUTH.user.id;
    const jobTitle = (id) => { const j = (c && c.jobs || []).find(x => x.id === id); return j ? j.title : null; };
    const lastMine = [...messages].reverse().find(m => m.fromId === me);
    let out = '', lastDay = null, lastJob;
    for (const m of messages) {
      const dl = dayLabel(m.createdAt);
      if (dl !== lastDay) { out += `<div class="chat-day"><span>${escapeHtml(dl)}</span></div>`; lastDay = dl; }
      const jid = m.jobId || null;
      if (lastJob !== undefined && jid !== lastJob && jid && jobTitle(jid)) out += `<div class="chat-about">${escapeHtml(tr('About the job'))}: ${escapeHtml(jobTitle(jid))}</div>`;
      else if (lastJob === undefined && jid && jobTitle(jid)) out += `<div class="chat-about">${escapeHtml(tr('About the job'))}: ${escapeHtml(jobTitle(jid))}</div>`;
      lastJob = jid;
      const mine = m.fromId === me;
      const seen = mine && lastMine && m.id === lastMine.id && m.readAt ? ` · ${escapeHtml(tr('Seen'))}` : '';
      out += `<div class="msg-bubble ${mine ? 'me' : 'them'}">${escapeHtml(m.text)}<div style="text-align:${mine ? 'right' : 'left'};margin-top:3px;line-height:1;opacity:.85;">${msgTimeHTML(m.createdAt)}${seen ? `<span class="msg-time" style="font-size:11.5px;">${seen}</span>` : ''}</div></div>`;
    }
    return out;
  }

  function redrawSide() {
    const l = $('chat-list'); if (l) l.innerHTML = listHTML();
    const h = $('chat-head'); if (h) h.innerHTML = headHTML();
    const unread = CHATS.list.reduce((s, c) => s + (c.unread || 0), 0);
    CHATS.unreadTotal = unread; // reading a chat lowers the menu count straight away
    document.querySelectorAll('.chat-filter').forEach(b => { if (/unread/i.test(b.getAttribute('onclick') || '')) b.textContent = tr('Unread') + (unread ? ` (${unread})` : ''); });
    const lay = $('chat-layout'); if (lay) lay.classList.toggle('show-thread', !!(CHATS.showThread && isPhone()));
    const input = $('msg-input'); const c = CHATS.activeId ? convo(CHATS.activeId) : null;
    if (input) { const closed = !!(c && c.closed); input.disabled = closed || !CHATS.activeId; input.placeholder = closed ? tr('This account is closed. You can still read the chat.') : tr('Type a message...'); }
    setNavBadge(unread);
  }

  async function fetchConversations() {
    const { conversations, unreadTotal } = await apiFetch('GET', '/messages/conversations');
    CHATS.list = conversations || []; CHATS.loaded = true; CHATS.unreadTotal = unreadTotal || 0;
    return CHATS.list;
  }

  // Called by the app every time the Messages page is drawn (and redrawn live).
  window.loadMessageThread = async function () {
    if (!AUTH.user || !BACKEND_AVAILABLE || !$('chat-layout')) return;
    const seq = ++CHATS.seq;
    try { await fetchConversations(); } catch (e) { if (!CHATS.loaded) { const l = $('chat-list'); if (l) l.innerHTML = `<div class="chat-empty">${escapeHtml(tr('Could not load your conversations. Check your connection.'))}</div>`; } }
    if (seq !== CHATS.seq) return;
    if (!CHATS.activeId && CHATS.list.length && !isPhone()) CHATS.activeId = CHATS.list[0].userId;
    redrawSide();
    await loadThread();
  };

  async function loadThread() {
    const body = $('msg-thread-body');
    if (!body) return;
    const id = CHATS.activeId;
    if (!id) { body.innerHTML = `<div class="chat-empty">${escapeHtml(tr(CHATS.list.length ? 'Pick a conversation on the left.' : 'Your conversations will show here.'))}</div>`; return; }
    const seq = ++CHATS.seq;
    try {
      const { messages } = await apiFetch('GET', `/messages/${encodeURIComponent(id)}?markRead=1`);
      if (seq !== CHATS.seq || CHATS.activeId !== id) return;
      CHATS.thread = messages || [];
      const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
      const firstLoad = body.dataset.for !== id;
      body.innerHTML = threadHTML(CHATS.thread, convo(id));
      body.dataset.for = id;
      if (firstLoad || atBottom) body.scrollTop = body.scrollHeight;
      // Opening the chat read it: clear its unread count here at once.
      const c = convo(id);
      if (c && c.unread) c.unread = 0;
      redrawSide();
    } catch (e) {
      if (CHATS.activeId === id) body.innerHTML = `<div class="chat-empty">${escapeHtml(tr('Could not load messages.'))}</div>`;
    }
  }

  window.selectMessageContact = function (id) {
    if (!AUTH.user || !id) return;
    CHATS.activeId = id;
    CHATS.showThread = true;
    const body = $('msg-thread-body'); if (body && body.dataset.for !== id) body.innerHTML = `<div class="chat-empty">${escapeHtml(tr('Loading…'))}</div>`;
    redrawSide();
    loadThread();
    const input = $('msg-input'); if (input && !isPhone()) { try { input.focus({ preventScroll: true }); } catch (e) {} }
  };

  window.sendRealMessage = async function () {
    const input = $('msg-input');
    const text = input ? input.value.trim() : '';
    if (!text || !CHATS.activeId) return;
    input.disabled = true;
    try {
      await apiFetch('POST', '/messages', { toId: CHATS.activeId, text });
      input.value = '';
      await window.loadMessageThread();
    } catch (e) {
      showToast(e.message || tr('Could not send message'));
    } finally { input.disabled = false; try { input.focus({ preventScroll: true }); } catch (e) {} }
  };

  window.chatsSearch = function (q) { CHATS.q = String(q || ''); const l = $('chat-list'); if (l) l.innerHTML = listHTML(); };
  window.chatsFilter = function (f) {
    CHATS.filter = f === 'unread' ? 'unread' : 'all';
    document.querySelectorAll('.chat-filter').forEach(b => b.classList.toggle('on', (b.getAttribute('onclick') || '').includes(`'${CHATS.filter}'`)));
    const l = $('chat-list'); if (l) l.innerHTML = listHTML();
  };
  window.chatsBack = function () { CHATS.showThread = false; const lay = $('chat-layout'); if (lay) lay.classList.remove('show-thread'); };
  window.chatsOpenBookings = function () {
    if (myRole() === 'provider') selectProviderSection('contracts'); else selectCustomerSection('bookings');
  };

  // A plain text copy of the whole conversation, for the person's own records.
  window.chatsDownload = function () {
    const c = convo(CHATS.activeId) || placeholderFor(CHATS.activeId);
    if (!CHATS.thread.length) return showToast(tr('There are no messages to save yet.'));
    const me = AUTH.user || {};
    const full = (iso) => new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const lines = [
      `Trothen conversation between ${me.name || 'you'} and ${c.name}`,
      `Saved ${full(new Date().toISOString())}`,
      ...(c.bookings || []).map(b => `Booking${b.bookingNumber ? ' #' + b.bookingNumber : ''}: ${b.service || ''} (${statusWord(b.status)})`),
      '',
    ];
    for (const m of CHATS.thread) lines.push(`[${full(m.createdAt)}] ${m.fromId === me.id ? (me.name || 'You') : c.name}: ${m.text}`);
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Trothen-chat-${String(c.name || 'conversation').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // ── unread count on the Messages menu item ────────────────────────────
  function setNavBadge(n) {
    document.querySelectorAll('.dash-nav-item').forEach(item => {
      if (!/\('messages'\)/.test(item.getAttribute('onclick') || '')) return;
      let b = item.querySelector('.chat-nav-badge');
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'chat-nav-badge'; item.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n);
    });
  }
  async function refreshNavBadge() {
    if (!AUTH.user || !BACKEND_AVAILABLE || !['customer', 'provider'].includes(AUTH.user.role)) return;
    try { const { unreadTotal } = await apiFetch('GET', '/messages/conversations'); CHATS.unreadTotal = unreadTotal || 0; setNavBadge(CHATS.unreadTotal); } catch (e) {}
  }
  // After the dashboard's data loads (first open, and every live update), and
  // after the menu is drawn, so the number is always there.
  for (const name of ['loadCustomerData', 'loadProviderData']) {
    if (typeof window[name] === 'function') { const f = window[name]; window[name] = async function () { const r = await f.apply(this, arguments); refreshNavBadge(); return r; }; }
  }
  if (typeof window.renderDashNav === 'function') { const f = window.renderDashNav; window.renderDashNav = function () { const r = f.apply(this, arguments); setTimeout(() => setNavBadge(CHATS.unreadTotal), 0); return r; }; }

  // Moving between phone and wide screen keeps the right panel showing.
  window.addEventListener('resize', () => { const lay = $('chat-layout'); if (lay) lay.classList.toggle('show-thread', !!(CHATS.showThread && isPhone())); });
})();
