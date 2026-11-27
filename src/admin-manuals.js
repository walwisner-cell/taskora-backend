// v185: the manuals for the Admin team.
//
// One manual for each part of Admin, written in help-admin/manuals/<key>.md.
// help-admin/ is never on the public site: a manual is only sent, as a page,
// to a signed-in admin (GET /api/admin/manuals/:key), never as a file to save.
//
// How it is kept from being taken away (as far as a web page can):
//  - no download, save or print button, and no file: the text is sent to the
//    Admin page and drawn there;
//  - "Cache-Control: no-store", so it is not kept in the browser or a proxy;
//  - the page draws the reader's name, email and the time across every page
//    (so a photo of the screen shows who took it), and turns off printing,
//    copying, saving and the right-click menu;
//  - every opening is written in the Access Logs (who, which manual, when).
// No web page can stop a photo of the screen; the name across the page is
// there so that a copy can be traced back.
//
// The files use a small, safe part of Markdown (written by us, never by users):
//   ---                 the header: key, title, sections (the parts of Admin it
//   key: disputes       covers, comma-separated), video (the help video), updated
//   ...
//   ---
//   ## Chapter          a chapter (listed in the contents)
//   ### Heading         a heading inside a chapter
//   paragraph text      **bold**, *italic*, `a button or a word on the screen`
//   - item / 1. item    lists
//   > **Rule:** text    a box that stands out (Rule, Tip, Warning, Note, Policy)
//   | a | b |           a table (the first row is the header)
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'help-admin', 'manuals');
const KEY_RE = /^[a-z0-9-]+$/;

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// bold, italic and screen words, inside text that is already escaped
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<span class="am-ui">$1</span>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
const slug = (s, used) => { let b = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part'; let x = b, i = 2; while (used.has(x)) x = `${b}-${i++}`; used.add(x); return x; };

function parse(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text.replace(/\r\n/g, '\n'));
  const head = {};
  if (m) for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) head[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  const body = m ? text.replace(/\r\n/g, '\n').slice(m[0].length) : text;
  return { head, body };
}

// Markdown → HTML, and the list of chapters
function render(body) {
  const out = [], chapters = [], used = new Set();
  const lines = body.split('\n');
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { flush(); i++; continue; }
    let h;
    if ((h = /^(#{2,4})\s+(.*)$/.exec(line))) {
      flush();
      const lvl = h[1].length, id = slug(h[2], used);
      if (lvl === 2) chapters.push({ id, title: h[2] });
      out.push(`<h${lvl} id="${id}">${inline(h[2])}</h${lvl}>`); i++; continue;
    }
    if (/^>\s?/.test(line)) {
      flush(); const box = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { box.push(lines[i].replace(/^>\s?/, '')); i++; }
      const kind = (/^\*\*(Rule|Tip|Warning|Note|Policy|Example)\b/i.exec(box[0] || '') || [])[1];
      out.push(`<div class="am-box${kind ? ' am-' + kind.toLowerCase() : ''}">${box.map(b => `<p>${inline(b)}</p>`).join('')}</div>`); continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush(); const ordered = /^\s*\d+\./.test(line); const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''); const sub = []; i++;
        // a line indented under the item, that is not itself a list item, continues it
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s+([-*]|\d+\.)\s+/.test(lines[i])) { item += ' ' + lines[i].trim(); i++; }
        while (i < lines.length && /^\s{2,}([-*]|\d+\.)\s+/.test(lines[i])) { sub.push(lines[i].replace(/^\s+([-*]|\d+\.)\s+/, '')); i++; }
        items.push(`<li>${inline(item)}${sub.length ? `<ul>${sub.map(s => `<li>${inline(s)}</li>`).join('')}</ul>` : ''}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    if (/^\|.*\|\s*$/.test(line)) {
      flush(); const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { if (!/^\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|').map(c => c.trim())); i++; }
      const [hd, ...rs] = rows;
      out.push(`<div class="am-table"><table><thead><tr>${hd.map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rs.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    para.push(line.trim()); i++;
  }
  flush();
  return { html: out.join('\n'), chapters };
}

function read(key) {
  if (!KEY_RE.test(String(key || ''))) return null;
  const file = path.join(DIR, `${key}.md`);
  if (!fs.existsSync(file)) return null;
  const { head, body } = parse(fs.readFileSync(file, 'utf8'));
  return {
    key, title: head.title || key, updated: head.updated || null, video: head.video || null,
    sections: String(head.sections || '').split(',').map(s => s.trim()).filter(Boolean), body,
  };
}
function list() {
  let files = []; try { files = fs.readdirSync(DIR).filter(f => /\.md$/.test(f)); } catch (e) { return []; }
  return files.map(f => read(f.replace(/\.md$/, ''))).filter(Boolean)
    .map(m => { const r = render(m.body); return { key: m.key, title: m.title, updated: m.updated, video: m.video, sections: m.sections, chapters: r.chapters, words: m.body.split(/\s+/).filter(Boolean).length }; })
    .sort((a, b) => a.title.localeCompare(b.title));
}
function page(key) {
  const m = read(key); if (!m) return null;
  const r = render(m.body);
  return { key: m.key, title: m.title, updated: m.updated, video: m.video, sections: m.sections, chapters: r.chapters, html: r.html };
}

module.exports = { list, page, render, DIR };
