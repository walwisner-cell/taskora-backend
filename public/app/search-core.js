/* v183: Trothen's search engine, in one file used by the server (require) and the
   app (a <script>), so a search finds the same things everywhere.

   What it does, the way good shop and directory searches work:
     - folds text: capitals, accents (é → e), punctuation and "&" don't matter;
       a number and its unit are split ("128gb" = "128 gb");
     - plurals and common endings: "phones" finds "phone", "batteries" finds "battery";
     - other names for the same thing: fridge = refrigerator, AC = air conditioner,
       phone = mobile = smartphone (a short, hand-checked list, not guesses);
     - small typos: one wrong letter in a word of 4 to 7 letters, two in a longer
       word ("samsong" finds Samsung). Words of 3 letters or fewer must be exact, or
       the start of a word ("tec" finds Tecno);
     - every word must match (like Google and Amazon). If nothing matches all the
       words, it says so and shows what matches most of them;
     - ranking: a match in the title counts more than in the description; an exact
       word more than a typo; the whole phrase together gets a bonus;
     - "Did you mean …?" for a word it doesn't know, from the words it has seen.

   No outside service, nothing sent anywhere: it runs where the list is. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrothenSearch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── folding ──────────────────────────────────────────────────────────
  const UNITS = 'gb|tb|mb|kb|mah|mp|hz|khz|ghz|kw|w|v|kg|g|km|cm|mm|m|l|ml|in|ft|hp|cc|pcs|pc';
  const SPLIT_UNIT = new RegExp('(\\d)(' + UNITS + ')\\b', 'g');
  function fold(s) {
    return String(s == null ? '' : s)
      .normalize('NFKD').replace(/[̀-ͯ]/g, '') // accents
      .toLowerCase()
      .replace(/&/g, ' and ').replace(/[’']/g, '')
      .replace(/(\d)[,](\d{3})\b/g, '$1$2')                  // 1,500 → 1500
      .replace(SPLIT_UNIT, '$1 $2')                           // 128gb → 128 gb
      .replace(/[^a-z0-9.]+/g, ' ').replace(/(^|\s)\.|\.(\s|$)/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  const STOP = new Set(['a', 'an', 'the', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'with', 'my', 'me', 'i', 'want', 'need', 'looking', 'buy', 'please']);
  function words(s, keepStop) { const w = fold(s).split(' ').filter(Boolean); return keepStop ? w : w.filter(x => !STOP.has(x)); }

  // ── endings (a light English stemmer: safe endings only) ─────────────
  function stem(w) {
    if (w.length <= 3 || /\d/.test(w)) return w;
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';      // batteries → battery
    if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);       // watches → watch
    if (/oes$/.test(w) && w.length > 5) return w.slice(0, -2);            // tomatoes → tomato (shoes stays shoe)
    if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);    // phones → phone (glass, bus, chassis stay)
    return w;
  }

  // ── other names for the same thing ───────────────────────────────────
  // Each group is words that mean the same to a buyer. Multi-word names are written
  // as they're typed ("air conditioner"). Checked by hand: no word in two groups.
  const GROUPS = [
    ['phone', 'mobile', 'cellphone', 'smartphone', 'handset', 'cell phone', 'mobile phone'],
    ['fridge', 'refrigerator', 'freezer'],
    ['tv', 'television', 'telly'],
    ['ac', 'aircon', 'air conditioner', 'air conditioning', 'air con'],
    ['laptop', 'notebook computer'],
    ['sofa', 'couch', 'settee'],
    ['generator', 'genset', 'gen set'],
    ['motorbike', 'motorcycle', 'motor bike', 'pen pen', 'okada'],
    ['keke', 'tricycle', 'tuk tuk', 'tuktuk'],
    ['rod', 'rebar', 'iron rod', 'iron rods', 'reinforcement bar'],
    ['cement', 'portland cement'],
    ['zinc', 'roofing sheet', 'roofing sheets', 'corrugated sheet'],
    ['plywood', 'ply board'],
    ['trouser', 'pants', 'slacks'],
    ['sneaker', 'trainer', 'canvas shoe'],
    ['dress', 'gown', 'lappa'],
    ['wig', 'hair piece', 'weave'],
    ['charger', 'power adapter', 'adapter'],
    ['power bank', 'powerbank', 'portable charger'],
    ['earphone', 'earbud', 'headphone', 'headset'],
    ['speaker', 'sound system', 'woofer'],
    ['bed', 'bedframe', 'bed frame'],
    ['mattress', 'foam'],
    ['cooker', 'stove', 'gas cooker'],
    ['microwave', 'microwave oven'],
    ['iron', 'flat iron', 'clothes iron'],
    ['solar panel', 'solar module', 'pv panel'],
    ['inverter', 'converter'],
    ['battery', 'batteries', 'accumulator'],
    ['apartment', 'flat'],
    ['room', 'bedroom'],
    ['house', 'home'],
    ['guesthouse', 'guest house', 'lodge', 'motel'],
    ['plumber', 'plumbing'],
    ['electrician', 'electrical', 'wiring'],
    ['cleaner', 'cleaning', 'maid', 'housekeeping'],
    ['mechanic', 'auto repair', 'car repair'],
    ['barber', 'haircut', 'hair cut'],
    ['braid', 'braids', 'braiding', 'cornrow'],
    ['carpenter', 'carpentry', 'woodwork'],
    ['mason', 'masonry', 'bricklayer', 'block layer'],
    ['painter', 'painting'],
    ['tailor', 'tailoring', 'seamstress', 'sewing'],
    ['welder', 'welding'],
    ['driver', 'chauffeur'],
    ['delivery', 'courier', 'pick and drop', 'pick drop'],
  ];
  const SYN = new Map(); // folded name → group index
  GROUPS.forEach((g, i) => g.forEach(n => SYN.set(words(n, true).map(stem).join(' '), i)));
  // A query's words, with any multi-word name joined ("air conditioner" stays one term).
  function terms(q) {
    const w = words(q).map(stem), out = [];
    for (let i = 0; i < w.length; i++) {
      let took = false;
      for (const len of [3, 2]) {
        if (i + len <= w.length) { const ph = w.slice(i, i + len).join(' '); if (SYN.has(ph)) { out.push(ph); i += len - 1; took = true; break; } }
      }
      if (!took) out.push(w[i]);
    }
    return out;
  }
  function alts(term) { const g = SYN.get(term); return g == null ? [term] : GROUPS[g].map(n => words(n, true).map(stem).join(' ')); }

  // ── typos (Damerau-Levenshtein, stops early) ─────────────────────────
  function dist(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  const allowed = (w) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

  // How well one query term matches a text's words (0 = not at all).
  function termScore(term, toks, joined) {
    let best = 0;
    for (const t of alts(term)) {
      const syn = t !== term;
      if (t.includes(' ')) { if ((' ' + joined + ' ').includes(' ' + t + ' ')) best = Math.max(best, syn ? 0.9 : 1); continue; }
      for (const w of toks) {
        if (w === t) { best = Math.max(best, syn ? 0.9 : 1); continue; }
        if (t.length >= 2 && w.startsWith(t) && !/^\d+$/.test(t)) { best = Math.max(best, (syn ? 0.7 : 0.8)); continue; }
        const k = allowed(t);
        if (k && !/\d/.test(t) && !syn && w.length >= 4 && dist(t, w, k) <= k) best = Math.max(best, 0.6);
      }
      if (best === 1) break;
    }
    return best;
  }

  // Prepares a text once (fast when the same list is searched many times).
  function prep(text) { const f = fold(text); return { toks: f.split(' ').filter(Boolean).map(stem), joined: f.split(' ').filter(Boolean).map(stem).join(' '), folded: f }; }

  // fields: [{ text, weight }] or a single string. Returns { score, matched, of }.
  function score(q, fields, opts) {
    const qt = Array.isArray(q) ? q : terms(q);
    if (!qt.length) return { score: 1, matched: 0, of: 0 };
    const F = (Array.isArray(fields) ? fields : [{ text: fields, weight: 1 }]).map(f => ({ w: f.weight || 1, p: f.p || prep(f.text) }));
    let total = 0, matched = 0;
    for (const term of qt) {
      let best = 0;
      for (const f of F) { const s = termScore(term, f.p.toks, f.p.joined); if (s) best = Math.max(best, s * f.w); }
      if (best > 0) { matched++; total += best; }
    }
    const phrase = fold(Array.isArray(q) ? q.join(' ') : q);
    if (qt.length > 1 && F.some(f => f.p.folded.includes(phrase))) total += 1.5; // the words together, in order
    if (F[0] && qt.length && F[0].p.folded.startsWith(phrase)) total += 0.5;       // the title starts with it
    return { score: total, matched, of: qt.length };
  }

  /* Searches a list. getFields(item) → [{ text, weight }]. Returns
     { results: [{ item, score }], relaxed: bool } — relaxed when nothing matched every
     word and these are the items that match most of them. */
  function search(items, q, getFields, opts) {
    opts = opts || {};
    const qt = terms(q);
    if (!qt.length) return { results: items.map(item => ({ item, score: 0 })), relaxed: false, terms: [] };
    const all = [];
    for (const item of items) { const r = score(qt.concat(), getFields(item)); if (r.matched) all.push({ item, score: r.score, matched: r.matched }); }
    const strict = all.filter(r => r.matched === qt.length);
    let out = strict, relaxed = false;
    if (!strict.length && qt.length > 1 && opts.relax !== false) {
      const need = Math.max(1, Math.ceil(qt.length / 2)); // half the words or more
      out = all.filter(r => r.matched >= need); relaxed = out.length > 0;
    }
    out.sort((a, b) => b.matched - a.matched || b.score - a.score);
    // "score" here is fit; a near-even score breaks ties by the order given.
    return { results: out, relaxed, terms: qt };
  }

  // "Did you mean …?": each query word not found in the vocabulary, replaced by the
  // nearest word that is (or null when every word is known, or nothing is close).
  function didYouMean(q, vocab) {
    const ws = words(q, true); let changed = false;
    const set = vocab instanceof Set ? vocab : new Set(vocab);
    const out = ws.map(w => {
      if (STOP.has(w) || set.has(w) || set.has(stem(w)) || /\d/.test(w) || w.length < 4) return w;
      let best = null, bd = 3;
      for (const v of set) { if (Math.abs(v.length - w.length) > 2) continue; const d = dist(w, v, 2); if (d < bd || (d === bd && best && v.length === w.length && best.length !== w.length)) { bd = d; best = v; } }
      if (best && bd <= allowed(w)) { changed = true; return best; }
      return w;
    });
    return changed ? out.join(' ') : null;
  }
  function vocabulary(texts) { const s = new Set(); for (const t of texts) for (const w of fold(t).split(' ')) if (w.length >= 3 && !/^\d/.test(w)) s.add(w); return s; }

  // For the app: the parts of `text` to highlight for query q, as [start, end] pairs.
  function highlights(text, q) {
    const qt = terms(q); if (!qt.length) return [];
    const out = []; const re = /[\p{L}\p{N}]+/gu; let m;
    const src = String(text || '');
    while ((m = re.exec(src))) {
      const w = stem(fold(m[0])); if (!w) continue;
      if (qt.some(t => termScore(t, [w], w) >= 0.6)) out.push([m.index, m.index + m[0].length]);
    }
    return out;
  }

  return { fold, words, stem, terms, dist, score, search, didYouMean, vocabulary, highlights, prep, GROUPS };
});
