// v140: ringtones and alert sounds people can choose.
//
// Every sound is made in the browser (Web Audio), so there are no sound
// files to download and nothing extra on the server. The choice is saved
// with the person's call settings (so it follows them to every device) and
// remembered on this device too.
//
//   TrothenSounds.loop('ring')      the incoming-call ringtone, until stopped
//   TrothenSounds.loop('ringback')  what the caller hears while it rings
//   TrothenSounds.alert()           one message / notification sound
//   TrothenSounds.preview(kind, name)
(function () {
  const RINGTONES = {
    classic: { label: 'Classic phone', every: 3500 },
    marimba: { label: 'Marimba', every: 2600 },
    chime: { label: 'Chime', every: 3200 },
    pulse: { label: 'Pulse', every: 2200 },
    soft: { label: 'Soft', every: 4000 },
    digital: { label: 'Digital', every: 2400 },
    silent: { label: 'Silent (vibrate only)', every: 3000 },
  };
  const ALERTS = {
    triple: { label: 'Triple chime' },
    ding: { label: 'Ding' },
    pop: { label: 'Pop' },
    chime: { label: 'Two-note chime' },
    soft: { label: 'Soft' },
    none: { label: 'No sound' },
  };
  let ctx = null;
  function ac() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch (x) { return null; }
  }
  // One note: frequency, start (s from now), length (s), wave, volume.
  function note(f, at, len, type, vol) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + len + 0.05);
  }
  const RING_PLAY = {
    classic: () => { for (const at of [0, 1.2]) { note(440, at, 0.9, 'sine', 0.05); note(480, at, 0.9, 'sine', 0.05); } },
    marimba: () => { [523, 659, 784, 1047, 784, 659].forEach((f, i) => note(f, i * 0.16, 0.35, 'triangle', 0.12)); },
    chime: () => { [[1047, 0], [1319, 0.35], [1568, 0.7]].forEach(([f, at]) => { note(f, at, 1.2, 'sine', 0.07); note(f * 2, at, 0.6, 'sine', 0.02); }); },
    pulse: () => { for (let i = 0; i < 4; i++) note(880, i * 0.22, 0.12, 'square', 0.03); },
    soft: () => { note(523, 0, 1.4, 'sine', 0.05); note(659, 0.5, 1.4, 'sine', 0.04); },
    digital: () => { for (let i = 0; i < 6; i++) note(i % 2 ? 1000 : 1250, i * 0.09, 0.08, 'square', 0.025); },
    silent: () => {},
  };
  const ALERT_PLAY = {
    triple: () => { for (let r = 0; r < 3; r++) { note(880, r * 0.55, 0.3, 'sine', 0.08); note(1108, r * 0.55 + 0.1, 0.3, 'sine', 0.08); } },
    ding: () => { note(1320, 0, 0.6, 'sine', 0.1); note(2640, 0, 0.3, 'sine', 0.02); },
    pop: () => { note(600, 0, 0.08, 'triangle', 0.12); note(900, 0.04, 0.08, 'triangle', 0.08); },
    chime: () => { note(988, 0, 0.45, 'sine', 0.08); note(1319, 0.18, 0.6, 'sine', 0.08); },
    soft: () => { note(660, 0, 0.5, 'sine', 0.05); },
    none: () => {},
  };
  const KEY = 'trothen_sounds';
  function prefs() {
    const p = window.TROTHEN_SOUND_PREFS || (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (x) { return null; } })() || {};
    return { ringtone: RINGTONES[p.ringtone] ? p.ringtone : 'classic', alertTone: ALERTS[p.alertTone] ? p.alertTone : 'triple' };
  }
  function setPrefs(p) {
    window.TROTHEN_SOUND_PREFS = { ...prefs(), ...p };
    try { localStorage.setItem(KEY, JSON.stringify(window.TROTHEN_SOUND_PREFS)); } catch (x) {}
  }
  function loop(kind) {
    const name = kind === 'ring' ? prefs().ringtone : 'classic';
    const play = kind === 'ring' ? RING_PLAY[name] : () => { note(440, 0, 1.2, 'sine', 0.04); note(480, 0, 1.2, 'sine', 0.04); };
    const every = kind === 'ring' ? RINGTONES[name].every : 4000;
    const vib = () => { if (kind === 'ring' && navigator.vibrate) { try { navigator.vibrate([500, 300, 500]); } catch (x) {} } };
    play(); vib();
    const id = setInterval(() => { play(); vib(); }, every);
    return () => { clearInterval(id); if (navigator.vibrate) { try { navigator.vibrate(0); } catch (x) {} } };
  }
  function alertSound() { const f = ALERT_PLAY[prefs().alertTone]; if (f) f(); }
  function preview(kind, name) { if (kind === 'ring' && RING_PLAY[name]) RING_PLAY[name](); if (kind === 'alert' && ALERT_PLAY[name]) ALERT_PLAY[name](); }
  window.TrothenSounds = { RINGTONES, ALERTS, prefs, setPrefs, loop, alert: alertSound, preview };
  // The message sound everywhere in the app uses the chosen alert sound.
  if (typeof playMessageSound === 'function') { playMessageSound = function () { try { alertSound(); } catch (x) {} }; }
})();
