// Shared PDF report builder — same letterhead design and visual language as
// the contract PDF (src/routes/marketplace.routes.js), factored out here so
// payout and payment history reports can reuse it without duplicating (or
// risking breaking) the existing, already-tested contract PDF code.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const NAVY = '#12161F';
const SLATE = '#5A5F6C';
const GOLD = '#B08A3E';
const CREAM = '#F5F3ED';
const PAGE_WIDTH = 612; // LETTER width in points
const PAGE_BOTTOM = 700; // leave room for the footer below this
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_PATH = path.join(__dirname, 'assets', 'trothen-logo.png');

// Creates a new report document with the shared letterhead/footer/section
// helpers attached. `title`/`subtitle` go in the letterhead; `docId` shows
// top-right (e.g. a report reference number); `verificationSeed` is hashed
// into a verification ID shown in the footer.
function createReportDoc({ res, filename, title, subtitle, docId, verificationSeed }) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const generatedAt = new Date();
  const verificationId = crypto.createHash('sha256')
    .update(`${verificationSeed}|${generatedAt.toISOString()}`)
    .digest('hex').slice(0, 16).toUpperCase();

  function drawLetterhead() {
    doc.rect(0, 0, PAGE_WIDTH, 118).fill(NAVY);
    if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, MARGIN, 28, { width: 56, height: 56 });
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('TROTHEN', MARGIN + 70, 36);
    doc.fillColor(GOLD).fontSize(9.5).font('Helvetica-Bold').text(title.toUpperCase(), MARGIN + 70, 61, { characterSpacing: 1.1 });
    if (subtitle) doc.fillColor('#B7BAC2').fontSize(8.5).font('Helvetica').text(subtitle, MARGIN + 70, 78);
    doc.fillColor('#B7BAC2').fontSize(8).font('Helvetica').text(`Generated ${generatedAt.toLocaleString('en-US')}`, MARGIN, 96, { width: CONTENT_WIDTH - 140 });
    if (docId) doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold').text(docId, PAGE_WIDTH - MARGIN - 200, 90, { width: 200, align: 'right' });
  }

  function drawContinuationHeader() {
    doc.fillColor(SLATE).fontSize(8).font('Helvetica-Bold').text(`TROTHEN — ${title.toUpperCase()} (CONTINUED)`, MARGIN, 32, { characterSpacing: 0.5 });
    doc.strokeColor('#D8D3C8').lineWidth(0.5).moveTo(MARGIN, 48).lineTo(PAGE_WIDTH - MARGIN, 48).stroke();
  }

  let y = 148;
  drawLetterhead();

  function ensureSpace(neededHeight) {
    if (y + neededHeight > PAGE_BOTTOM) {
      doc.addPage();
      drawContinuationHeader();
      y = 66;
    }
  }

  function sectionHeader(text) {
    ensureSpace(100); // v166: keep a heading with what follows it (an address card is about 150 high)
    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(CREAM);
    doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold').text(text.toUpperCase(), MARGIN + 10, y + 5, { characterSpacing: 0.8 });
    y += 30;
  }

  function row(label, value) {
    ensureSpace(38);
    doc.fillColor(SLATE).fontSize(8.5).font('Helvetica-Bold').text(label.toUpperCase(), MARGIN, y, { characterSpacing: 0.4 });
    doc.fillColor(NAVY).fontSize(11.5).font('Helvetica').text(value || '—', MARGIN, y + 12, { width: CONTENT_WIDTH });
    y += 38;
  }

  function twoColumnRow(labelA, valueA, labelB, valueB) {
    ensureSpace(38);
    const colWidth = CONTENT_WIDTH / 2 - 10;
    doc.fillColor(SLATE).fontSize(8.5).font('Helvetica-Bold').text(labelA.toUpperCase(), MARGIN, y, { characterSpacing: 0.4 });
    doc.fillColor(NAVY).fontSize(11.5).font('Helvetica').text(valueA || '—', MARGIN, y + 12, { width: colWidth });
    doc.fillColor(SLATE).fontSize(8.5).font('Helvetica-Bold').text(labelB.toUpperCase(), MARGIN + colWidth + 20, y, { characterSpacing: 0.4 });
    doc.fillColor(NAVY).fontSize(11.5).font('Helvetica').text(valueB || '—', MARGIN + colWidth + 20, y + 12, { width: colWidth });
    y += 38;
  }

  // v164: where a place is (see plus-code.js placeLines).
  // v166: laid out the way Uber, Amazon and Jumia print an address: a card
  // with the person's name, the address as postal lines (street, then area,
  // town and country), the landmark as directions, one small grey line with
  // the Plus Code and "View on map", and a small map with the pin beside it.
  // No raw coordinates: the Plus Code and the map link carry the exact spot.
  // `lines` are [label, value] from placeLines / tripLines; a ride's lines
  // ("Pick-up: landmark", "Drop-off map") become one card for each place.
  function placeBlock(lines, picture, opts = {}) {
    if (!lines || !lines.length) return;
    const groups = [];
    for (const [label, value] of lines) {
      const m = /^(Pick-up|Drop-off)(?::\s*(.*)|\s+map)?$/i.exec(label);
      const head = m ? m[1] : '';
      const key = m ? (/map$/i.test(label) ? 'map' : (m[2] || 'address').toLowerCase()) : label.toLowerCase();
      let g = groups.find(x => x.head === head);
      if (!g) { g = { head, f: {} }; groups.push(g); }
      g.f[key] = value;
    }
    groups.forEach((g, n) => { if (n === 0 && opts.head && !g.head) g.head = opts.head; card(g, n === 0 ? picture : null, n === 0 ? opts.name : ''); });
  }
  function card(g, picture, name) {
    const f = g.f;
    const hasPic = !!(picture && picture.tiles && picture.tiles.length);
    const picW = hasPic ? 180 : 0, picH = hasPic ? 120 : 0;
    const textW = CONTENT_WIDTH - 24 - (hasPic ? picW + 16 : 0);
    const exact = String(f['exact location'] || '');
    const typed = String(f.address || '');
    const main = exact || typed || '';
    const cut = main.indexOf(', ');
    const rows = []; // [text, style]
    if (g.head) rows.push([g.head.toUpperCase(), 'head']);
    // What the person called the place ("Home", "Red Light Market") comes
    // first, then the street address of the pin.
    const typedFirst = !!(exact && typed && typed.toLowerCase() !== exact.toLowerCase());
    if (name) rows.push([name, 'name']);
    if (typedFirst) rows.push([typed, name ? 'line1' : 'name']);
    if (main) { if (cut > 0) { rows.push([main.slice(0, cut), typedFirst ? 'line' : 'line1']); rows.push([main.slice(cut + 2), 'line']); } else rows.push([main, typedFirst ? 'line' : 'line1']); }
    if (f.near) rows.push([f.near, 'line']);
    if (f.landmark) rows.push(['Directions: ' + f.landmark, main ? 'note' : 'line1']);
    const code = String(f['plus code'] || f['pinned location'] || '').split('  (')[0];
    const small = [code ? 'Plus Code ' + code : '', f.map ? 'View on map' : ''].filter(Boolean);
    const font = (st) => st === 'head' ? ['Helvetica-Bold', 8, SLATE] : st === 'name' ? ['Helvetica-Bold', 11.5, NAVY] : st === 'line1' ? [name ? 'Helvetica' : 'Helvetica-Bold', 10.5, NAVY] : st === 'note' ? ['Helvetica-Oblique', 9.5, SLATE] : ['Helvetica', 10.5, NAVY];
    let th = 0;
    for (const [t, st] of rows) { const [fn, fs] = font(st); doc.font(fn).fontSize(fs); th += doc.heightOfString(t, { width: textW }) + 2.5; }
    if (small.length) th += 16;
    const h = Math.max(th, picH) + 24;
    ensureSpace(h + 10);
    const top = y;
    doc.save().lineWidth(0.75).strokeColor('#DADDE3').fillColor('#FBFBFC').roundedRect(MARGIN, top, CONTENT_WIDTH, h, 6).fillAndStroke().restore();
    let ty = top + 12;
    for (const [t, st] of rows) {
      const [fn, fs, col] = font(st);
      doc.fillColor(col).font(fn).fontSize(fs).text(t, MARGIN + 12, ty, { width: textW, characterSpacing: st === 'head' ? 0.6 : 0 });
      ty += doc.heightOfString(t, { width: textW }) + 2.5;
    }
    if (small.length) {
      ty += 5;
      doc.font('Helvetica').fontSize(8.5).fillColor(SLATE);
      if (code) { doc.text('Plus Code ' + code + (f.map ? '  ·  ' : ''), MARGIN + 12, ty, { continued: !!f.map }); }
      if (f.map) doc.fillColor('#1B6F6A').text('View on map', code ? undefined : MARGIN + 12, code ? undefined : ty, { link: String(f.map), underline: true, continued: false });
    }
    if (hasPic) {
      const X = MARGIN + CONTENT_WIDTH - 12 - picW, Y = top + 12;
      try {
        doc.save(); doc.roundedRect(X, Y, picW, picH, 4).clip();
        // The tiles were fetched for a wider box: centre them on this one.
        const ox = (picW - picture.widthPt) / 2, oy = (picH - picture.heightPt) / 2;
        for (const t of picture.tiles) doc.image(t.buf, X + ox + t.dx, Y + oy + t.dy, { width: picture.size, height: picture.size });
        doc.restore();
        doc.save().lineWidth(0.75).strokeColor('#C9CED6').roundedRect(X, Y, picW, picH, 4).stroke().restore();
        const cx = X + picW / 2, cy = Y + picH / 2;
        doc.save().fillColor('#000000').fillOpacity(0.18).ellipse(cx, cy + 1.5, 5, 1.8).fill().restore();
        doc.save().fillColor('#D93025').moveTo(cx, cy).bezierCurveTo(cx - 2.6, cy - 6, cx - 7, cy - 9.5, cx - 7, cy - 14).bezierCurveTo(cx - 7, cy - 18.5, cx - 4, cy - 21.5, cx, cy - 21.5).bezierCurveTo(cx + 4, cy - 21.5, cx + 7, cy - 18.5, cx + 7, cy - 14).bezierCurveTo(cx + 7, cy - 9.5, cx + 2.6, cy - 6, cx, cy).fill().restore();
        doc.save().fillColor('#FFFFFF').circle(cx, cy - 14, 2.8).fill().restore();
        doc.fillColor('#8A8F99').font('Helvetica').fontSize(6).text(picture.credit, X, Y + picH + 2, { width: picW, align: 'right' });
      } catch (e) { try { doc.restore(); } catch (_) {} }
    }
    y = top + h + 12;
  }

  function paragraph(text, opts = {}) {
    const height = doc.heightOfString(text, { width: CONTENT_WIDTH, lineGap: 2 });
    ensureSpace(height + 8);
    doc.fillColor(opts.color || SLATE).fontSize(opts.size || 9).font(opts.font || 'Helvetica').text(text, MARGIN, y, { width: CONTENT_WIDTH, lineGap: 2 });
    y += height + (opts.gapAfter ?? 10);
  }

  // A simple itemized table with column definitions [{label, width, align}]
  // and rows as arrays of cell strings in the same order.
  function table(columns, rows) {
    const rowHeight = 24;
    ensureSpace(rowHeight + 10);
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(CREAM);
    let x = MARGIN + 8;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY);
    for (const col of columns) {
      doc.text(col.label.toUpperCase(), x, y + 8, { width: col.width, align: col.align || 'left', characterSpacing: 0.3 });
      x += col.width;
    }
    y += rowHeight;

    doc.font('Helvetica').fontSize(9.5);
    for (const rowData of rows) {
      ensureSpace(rowHeight);
      doc.strokeColor('#EDEAE2').lineWidth(0.5).moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).stroke();
      let cx = MARGIN + 8;
      doc.fillColor(NAVY);
      for (let i = 0; i < columns.length; i++) {
        doc.text(String(rowData[i] ?? '—'), cx, y + 7, { width: columns[i].width, align: columns[i].align || 'left' });
        cx += columns[i].width;
      }
      y += rowHeight;
    }
  }

  function finish({ closingNote }) {
    if (closingNote) {
      ensureSpace(60);
      doc.strokeColor('#D8D3C8').lineWidth(1).moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
      y += 16;
      paragraph(closingNote, { size: 8.5 });
    }

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      const footerY = 740;
      doc.strokeColor('#D8D3C8').lineWidth(0.5).moveTo(MARGIN, footerY).lineTo(PAGE_WIDTH - MARGIN, footerY).stroke();
      doc.fillColor(SLATE).fontSize(7.5).font('Helvetica').text(
        `Verification ID ${verificationId} · This document is a system-generated record reflecting Trothen's records at the time of generation.`,
        MARGIN, footerY + 8, { width: CONTENT_WIDTH - 90 }
      );
      doc.fillColor(SLATE).fontSize(7.5).font('Helvetica').text(
        `Page ${i - pageRange.start + 1} of ${pageRange.count}`,
        PAGE_WIDTH - MARGIN - 90, footerY + 8, { width: 90, align: 'right' }
      );
      doc.fillColor(GOLD).fontSize(7.5).font('Helvetica-Bold').text(require('./platform-settings').supportEmailCached(), MARGIN, footerY + 26); // v95: the one support email from Settings
    }
    doc.end();
  }

  return { doc, sectionHeader, row, twoColumnRow, paragraph, table, finish, placeBlock, MAP_WIDTH: CONTENT_WIDTH - 120, get y() { return y; }, set y(v) { y = v; } };
}

module.exports = { createReportDoc, CONTENT_WIDTH, MARGIN };
