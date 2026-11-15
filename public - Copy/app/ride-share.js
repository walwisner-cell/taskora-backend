(function () {
  var token = location.pathname.split('/').pop();
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var WORDS = { waiting: 'Waiting for the driver to accept', driver_coming: 'Driver is on the way to pick up', on_trip: 'On the trip', ended: 'Trip ended' };
  function show(j) {
    document.getElementById('t').textContent = j.rider + "'s ride";
    var cls = j.status === 'on_trip' ? 'pill on' : j.status === 'ended' ? 'pill end' : 'pill';
    document.getElementById('s').innerHTML = '<span class="' + cls + '">' + esc(WORDS[j.status] || j.status) + '</span>';
    var d = document.getElementById('d'); d.style.display = 'block';
    var live = j.live ? '<div style="margin-top:8px">📍 Last seen ' + esc(j.live.secondsAgo) + ' seconds ago<br/><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(j.live.latitude + ',' + j.live.longitude) + '">Open driver position in Maps</a></div>' : (j.status === 'ended' ? '' : '<div class="muted" style="margin-top:8px">Driver position not available right now.</div>');
    d.innerHTML = '<div><strong>From:</strong> ' + esc(j.from) + '</div><div><strong>To:</strong> ' + esc(j.to) + '</div><div style="margin-top:8px"><strong>Driver:</strong> ' + esc(j.driver || '') + ' · ' + esc(j.vehicle || '') + '</div>' + (j.plate ? '<div style="margin-top:6px"><span class="plate">' + esc(j.plate) + '</span></div>' : '') + live;
  }
  function load() {
    fetch('/api/ride-share/' + encodeURIComponent(token), { cache: 'no-store' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
      if (!x.ok) { document.getElementById('t').textContent = x.j.error || 'This link is not valid.'; clearInterval(timer); return; }
      show(x.j); if (x.j.status === 'ended') clearInterval(timer);
    }).catch(function () {});
  }
  var timer = setInterval(load, 10000); load();
})();
