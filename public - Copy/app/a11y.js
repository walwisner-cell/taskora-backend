/* v151: accessibility (WCAG 2.1 AA), for people using a screen reader, a keyboard, or larger text.
   The app's screens are drawn by code in many places, and most form fields are written as
   <div class="form-group"><label>Name</label><input …></div> without the label being linked to its field.
   This file links them properly as each screen is drawn, so a screen reader reads "Full Name, edit text"
   instead of just "edit text", and tapping the label puts the cursor in the field.
   1. A label in a .form-group is linked (for=…) to the one field in that group.
   2. A field still without a name gets one from its placeholder, its title, or the words just before it.
   3. Anything acting as a button (role="button") works with Enter and Space, like a real button.
   4. Clickable navigation items can be reached with the Tab key. */
(function () {
  let n = 0;
  const FIELDS = 'input:not([type=hidden]):not([type=button]):not([type=submit]),select,textarea';
  const hasName = (el) => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) return true;
    if (el.labels && el.labels.length && [...el.labels].some(l => (l.textContent || '').trim())) return true;
    return false;
  };
  const words = (t) => (t || '').replace(/\s+/g, ' ').replace(/[*:]+\s*$/, '').trim().slice(0, 80);
  // relative luminance (WCAG 2.1); darken a colour until white text on it reaches 4.5 : 1
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  function darken(css) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css || ''); if (!m) return null;
    let [r, g, b] = [+m[1], +m[2], +m[3]]; if (1.05 / (lum(r, g, b) + 0.05) >= 4.5) return null;
    for (let i = 0; i < 20 && 1.05 / (lum(r, g, b) + 0.05) < 4.6; i++) { r = Math.round(r * 0.9); g = Math.round(g * 0.9); b = Math.round(b * 0.9); }
    return `rgb(${r}, ${g}, ${b})`;
  }
  window.a11yDarken = darken;
  function fix(root) {
    if (!root || !root.querySelectorAll) return;
    // 1. link labels to their field
    root.querySelectorAll('.form-group > label:not([for]), .form-group > .form-label:not([for])').forEach(l => {
      if (l.tagName !== 'LABEL' || l.querySelector(FIELDS)) return;
      const fs = [...l.parentElement.querySelectorAll(FIELDS)].filter(f => !f.closest('label'));
      if (fs.length !== 1) return;
      const f = fs[0]; if (!f.id) f.id = 'a11y-f' + (++n);
      l.htmlFor = f.id;
    });
    // 2. a name for any field still without one
    root.querySelectorAll(FIELDS).forEach(f => {
      if (hasName(f)) return;
      let name = f.getAttribute('placeholder');
      if (!name && f.type === 'date' && f.id) name = /-from$/.test(f.id) ? 'From date' : /-to$/.test(f.id) ? 'To date' : '';
      if (!name) {
        let p = f.previousElementSibling;
        while (p && !words(p.textContent)) p = p.previousElementSibling;
        if (p && p.tagName !== 'INPUT' && p.tagName !== 'SELECT') name = p.textContent;
      }
      if (!name) { const row = f.closest('.switch-row'); const lab = row && row.querySelector('.switch-label'); if (lab) name = lab.textContent; }
      if (!name && f.parentElement) { const lab = f.parentElement.querySelector('.form-label, label'); if (lab) name = lab.textContent; }
      if (!name && f.tagName === 'SELECT' && f.options && f.options[0]) name = f.options[0].textContent;
      name = words(name); if (name) f.setAttribute('aria-label', name);
    });
    // 4. navigation items reachable with Tab
    root.querySelectorAll('.dash-nav-item:not([tabindex])').forEach(d => { d.setAttribute('role', 'button'); d.tabIndex = 0; });
    // a table wider than the screen can be scrolled with the keyboard too
    root.querySelectorAll('.data-table-wrap:not([tabindex])').forEach(w => { if (w.scrollWidth > w.clientWidth + 2) { w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-label', 'Table (scroll sideways to see more)'); } });
    // white initials on a coloured avatar must be readable (contrast 4.5 : 1)
    root.querySelectorAll('[class*=avatar]').forEach(av => { if (av.children.length || !(av.textContent || '').trim()) return; const bg = av.style.background || av.style.backgroundColor; if (!bg || av.dataset.a11yBg === bg) return; const d = darken(getComputedStyle(av).backgroundColor); if (d) av.style.background = d; av.dataset.a11yBg = av.style.background; });
    // a progress bar always has a name
    root.querySelectorAll('[role=progressbar]:not([aria-label]):not([aria-labelledby])').forEach(b => b.setAttribute('aria-label', 'Progress'));
  }
  // 3. Enter and Space work on anything acting as a button
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target; if (!t || !t.getAttribute) return;
    if (t.getAttribute('role') !== 'button' || /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' && t.getAttribute('onkeydown')) return; // it already handles Enter itself
    e.preventDefault(); t.click();
  });
  let queued = false;
  const run = () => { queued = false; try { fix(document.body); } catch (e) {} };
  const queue = () => { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(run); } };
  const start = () => { run(); try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (e) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.a11yFix = fix;
})();
