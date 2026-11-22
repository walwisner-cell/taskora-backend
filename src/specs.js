// v177: item specifics. The details buyers need for each kind of good, the
// way Amazon, eBay and Jumia ask for them (and GS1, the global product data
// standard, groups them): a phone's storage and network, an appliance's
// voltage and plug, cement's grade and bag weight, a pipe's diameter.
//
// One list here is used by the server (to check what a seller sends) and by
// the app (it is sent with /market/categories), so the two never disagree.
//
// Every field is optional. A field is one of:
//   text:   a short answer (up to `max` characters, 60 by default)
//   choice: one of `options`
//   number: a number from `min` to `max`, shown with its `unit`
// IMEI and serial numbers are never item specifics: they stay private in the
// ownership part of the form (src/stolen-goods.js).

const F = {
  // what it is
  model:        { label: 'Model', type: 'text', ph: 'e.g. Galaxy A15, HP 250 G9' },
  colour:       { label: 'Colour', type: 'text', max: 40, ph: 'e.g. Black, Midnight blue' },
  material:     { label: 'Material', type: 'text', ph: 'e.g. 100% cotton, solid wood, steel' },
  dimensions:   { label: 'Size (L × W × H)', type: 'text', ph: 'e.g. 120 × 60 × 85 cm' },
  weight:       { label: 'Weight', type: 'text', max: 30, ph: 'e.g. 25 kg, 500 g' },
  origin:       { label: 'Made in', type: 'text', max: 40, ph: 'e.g. China, Liberia, USA' },
  warranty:     { label: 'Warranty', type: 'choice', options: ['No warranty', '1 month', '3 months', '6 months', '1 year', '2 years', '3 years or more'] },
  inBox:        { label: 'In the box', type: 'text', max: 160, ph: 'e.g. Phone, charger, cable, case' },
  // phones, computers, electronics
  storage:      { label: 'Storage', type: 'choice', options: ['8 GB', '16 GB', '32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB', '4 TB'] },
  ram:          { label: 'RAM (memory)', type: 'choice', options: ['1 GB', '2 GB', '3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '24 GB', '32 GB', '64 GB'] },
  network:      { label: 'Network', type: 'choice', options: ['2G / 3G', '4G LTE', '5G', 'Wi-Fi only'] },
  sim:          { label: 'SIM', type: 'choice', options: ['Single SIM', 'Dual SIM', 'eSIM only', 'SIM + eSIM', 'No SIM'] },
  locked:       { label: 'Network lock', type: 'choice', options: ['Unlocked (any network)', 'Locked to one network'] },
  battery:      { label: 'Battery health', type: 'number', unit: '%', min: 1, max: 100, ph: 'for a used phone or laptop' },
  screen:       { label: 'Screen size', type: 'number', unit: 'inches', min: 1, max: 120, step: 0.1 },
  processor:    { label: 'Processor', type: 'text', max: 40, ph: 'e.g. Intel Core i5 12th gen, Apple M2' },
  os:           { label: 'Operating system', type: 'choice', options: ['Android', 'iOS / iPadOS', 'Windows', 'macOS', 'ChromeOS', 'Linux', 'Other / none'] },
  device:       { label: 'Type', type: 'text', max: 40, ph: 'e.g. Laptop, TV, speaker, router, solar inverter' },
  // power
  voltage:      { label: 'Voltage', type: 'choice', options: ['220–240 V', '110–120 V', 'Dual voltage 110–240 V', '12 V DC', '24 V DC', 'Battery', 'Solar'] },
  plug:         { label: 'Plug', type: 'choice', options: ['Type G (UK, 3 square pins)', 'Type C / F (Europe, 2 round pins)', 'Type A / B (US, flat pins)', 'Type D / M (India and South Africa, round pins)', 'USB', 'No plug (wired in)'] },
  power:        { label: 'Power', type: 'number', unit: 'W', min: 0.1, max: 200000, step: 0.1 },
  amps:         { label: 'Current (amps)', type: 'number', unit: 'A', min: 0.1, max: 5000, step: 0.1 },
  capacity:     { label: 'Capacity', type: 'text', max: 40, ph: 'e.g. 20 litres, 7 kg wash, 1.5 HP, 10 kVA' },
  energy:       { label: 'Energy rating', type: 'text', max: 30, ph: 'e.g. A++, 5 star, Energy Star' },
  // building and hardware
  grade:        { label: 'Grade or standard', type: 'text', ph: 'e.g. Cement 42.5N (EN 197-1), rebar B500B, plywood 18 mm' },
  saleUnit:     { label: 'Sold by the', type: 'choice', options: ['Piece', 'Pack', 'Box', 'Bag', 'Bundle', 'Sheet', 'Length', 'Roll', 'Pair', 'Set (several pieces)', 'Metre', 'Square metre (m²)', 'Cubic metre (m³)', 'Kilogram', 'Ton', 'Litre', 'Gallon', 'Truck load'] },
  packQty:      { label: 'Pieces in each', type: 'number', unit: '', min: 1, max: 100000, step: 1, ph: 'e.g. 100 nails, 10 sheets' },
  thickness:    { label: 'Thickness or gauge', type: 'text', max: 30, ph: 'e.g. 0.4 mm, 28 gauge, 12 mm' },
  length:       { label: 'Length', type: 'text', max: 30, ph: 'e.g. 6 m, 100 m roll, 12 ft' },
  finishUse:    { label: 'For use', type: 'choice', options: ['Inside', 'Outside', 'Inside and outside'] },
  // plumbing
  pipeMaterial: { label: 'Material', type: 'choice', options: ['PVC', 'uPVC', 'CPVC', 'PPR', 'PEX', 'HDPE', 'Galvanised iron (GI)', 'Copper', 'Brass', 'Stainless steel', 'Cast iron', 'Ceramic'] },
  diameter:     { label: 'Size (diameter)', type: 'choice', options: ['½ inch (15 mm)', '¾ inch (20 mm)', '1 inch (25 mm)', '1¼ inch (32 mm)', '1½ inch (40 mm)', '2 inch (50 mm)', '2½ inch (63 mm)', '3 inch (75–90 mm)', '4 inch (110 mm)', '6 inch (160 mm)'] },
  pressure:     { label: 'Pressure rating', type: 'text', max: 30, ph: 'e.g. PN16, 10 bar, Class B' },
  // electrical
  cableSize:    { label: 'Cable size', type: 'choice', options: ['0.75 mm²', '1 mm²', '1.5 mm²', '2.5 mm²', '4 mm²', '6 mm²', '10 mm²', '16 mm²', '25 mm²', '35 mm²', '50 mm²'] },
  cores:        { label: 'Cores', type: 'choice', options: ['Single core', '2 core', '3 core (with earth)', '4 core', '5 core', 'Twin and earth', 'Flex'] },
  standard:     { label: 'Standard or approval', type: 'text', ph: 'e.g. IEC 60227, BS 6004, CE, UL listed' },
  ip:           { label: 'Water and dust rating', type: 'choice', options: ['IP20 (indoor)', 'IP44 (splashes)', 'IP54', 'IP65 (jets of water)', 'IP66', 'IP67 (under water a short time)', 'IP68'] },
  // paint
  paintType:    { label: 'Type', type: 'choice', options: ['Emulsion (water-based)', 'Oil-based gloss', 'Enamel', 'Primer or undercoat', 'Varnish', 'Wood stain', 'Texture coating', 'Waterproofing', 'Spray paint', 'Road or floor paint'] },
  finish:       { label: 'Finish', type: 'choice', options: ['Matt', 'Eggshell', 'Satin', 'Semi-gloss', 'Gloss', 'Textured'] },
  volume:       { label: 'Volume', type: 'text', max: 30, ph: 'e.g. 1 litre, 4 litres, 20 litres' },
  coverage:     { label: 'Coverage', type: 'text', max: 40, ph: 'e.g. 10–12 m² per litre' },
  dryTime:      { label: 'Drying time', type: 'text', max: 40, ph: 'e.g. touch dry 1 hour, recoat 4 hours' },
  // tools
  powerSource:  { label: 'Power source', type: 'choice', options: ['Hand tool (no power)', 'Mains (corded)', 'Battery (cordless)', 'Petrol', 'Diesel', 'Compressed air', 'Solar'] },
  // vehicles and parts
  make:         { label: 'Make (or fits make)', type: 'text', max: 40, ph: 'e.g. Toyota, Honda, Haojue' },
  vModel:       { label: 'Model (or fits model)', type: 'text', max: 40, ph: 'e.g. Corolla, CG 125' },
  years:        { label: 'Year (or fits years)', type: 'text', max: 30, ph: 'e.g. 2012, or 2009–2013' },
  partNumber:   { label: 'Part number', type: 'text', max: 40, ph: 'the maker\'s (OEM) number, e.g. 04465-02220' },
  position:     { label: 'Position on the vehicle', type: 'choice', options: ['Front', 'Rear', 'Left side', 'Right side', 'Front left', 'Front right', 'Rear left', 'Rear right', 'Not applicable'] },
  fuel:         { label: 'Fuel', type: 'choice', options: ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Gas (LPG / CNG)'] },
  gearbox:      { label: 'Gearbox', type: 'choice', options: ['Manual', 'Automatic'] },
  mileage:      { label: 'Mileage', type: 'text', max: 30, ph: 'e.g. 85,000 km' },
  // home and furniture
  assembly:     { label: 'Assembly', type: 'choice', options: ['Comes assembled', 'Needs assembly', 'We assemble it for you'] },
  seats:        { label: 'Seats or sleeps', type: 'number', unit: '', min: 1, max: 50, step: 1 },
  // food
  netQty:       { label: 'Net weight or volume', type: 'text', max: 30, ph: 'e.g. 25 kg, 1 litre, 12 × 330 ml' },
  ingredients:  { label: 'Ingredients', type: 'text', max: 300, ph: 'in order, the most first' },
  allergens:    { label: 'Allergens', type: 'text', max: 120, ph: 'e.g. Contains peanuts, milk, wheat (gluten)' },
  keep:         { label: 'How to store it', type: 'choice', options: ['Room temperature', 'Cool and dry place', 'Refrigerate (0–5 °C)', 'Frozen (−18 °C)'] },
  diet:         { label: 'Suitable for', type: 'text', max: 60, ph: 'e.g. Halal, vegetarian, vegan' },
  // health and beauty
  skinHair:     { label: 'For skin or hair type', type: 'text', max: 40, ph: 'e.g. All skin types, dry, curly 4C' },
  use:          { label: 'How to use', type: 'text', max: 200 },
  // fashion (the sizes and size chart are their own part of the form)
  forWho:       { label: 'Made for', type: 'choice', options: ['Women', 'Men', 'Unisex', 'Girls', 'Boys', 'Baby'] },
  fit:          { label: 'Fit', type: 'choice', options: ['True to size', 'Runs small (choose one size up)', 'Runs large (choose one size down)', 'Loose / oversized', 'Slim fit', 'Stretchy'] },
  care:         { label: 'Care', type: 'text', max: 80, ph: 'e.g. Hand wash cold, do not bleach, dry in shade' },
  // children
  ageRange:     { label: 'Age range', type: 'text', max: 30, ph: 'e.g. 0–6 months, 3 years and up' },
  safety:       { label: 'Safety standard', type: 'text', max: 60, ph: 'e.g. EN 71, ASTM F963, CE' },
  // sports
  sport:        { label: 'Sport or activity', type: 'text', max: 40 },
  // books
  author:       { label: 'Author', type: 'text', max: 80 },
  publisher:    { label: 'Publisher and year', type: 'text', max: 80, ph: 'e.g. Macmillan, 2021' },
  isbn:         { label: 'ISBN', type: 'text', max: 17, ph: '10 or 13 digits, on the back cover' },
  language:     { label: 'Language', type: 'text', max: 30, ph: 'e.g. English' },
  level:        { label: 'Level or grade', type: 'text', max: 40, ph: 'e.g. Grade 9, WASSCE, university' },
  // farm
  npk:          { label: 'Nutrients (N-P-K)', type: 'text', max: 30, ph: 'e.g. 15-15-15, Urea 46-0-0' },
  activeIng:    { label: 'Active ingredient', type: 'text', max: 80, ph: 'e.g. Glyphosate 360 g/L' },
  variety:      { label: 'Variety or breed', type: 'text', max: 60, ph: 'e.g. NERICA rice, broiler, hybrid maize' },
  // cleaning
  scent:        { label: 'Scent', type: 'text', max: 30 },
};

// The details for each Market category, the most important first.
const CATEGORY_SPECS = {
  'Phones & Tablets':        ['model', 'storage', 'ram', 'colour', 'network', 'sim', 'locked', 'battery', 'screen', 'os', 'warranty', 'inBox'],
  'Computers & Electronics': ['device', 'model', 'processor', 'ram', 'storage', 'screen', 'os', 'voltage', 'plug', 'power', 'colour', 'warranty', 'inBox'],
  'Appliances':              ['model', 'voltage', 'plug', 'power', 'capacity', 'dimensions', 'energy', 'colour', 'warranty', 'inBox'],
  'Building & Hardware':     ['material', 'grade', 'saleUnit', 'packQty', 'dimensions', 'thickness', 'length', 'weight', 'colour', 'finishUse', 'origin'],
  'Plumbing Supplies':       ['pipeMaterial', 'diameter', 'length', 'pressure', 'standard', 'saleUnit', 'packQty', 'colour', 'origin'],
  'Electrical Supplies':     ['voltage', 'amps', 'power', 'cableSize', 'cores', 'length', 'standard', 'ip', 'saleUnit', 'packQty', 'colour', 'warranty'],
  'Tools & Equipment':       ['model', 'powerSource', 'power', 'voltage', 'capacity', 'weight', 'inBox', 'warranty'],
  'Paint & Finishes':        ['paintType', 'colour', 'volume', 'finish', 'finishUse', 'coverage', 'dryTime', 'origin'],
  'Home & Furniture':        ['material', 'colour', 'dimensions', 'seats', 'assembly', 'weight', 'care', 'origin'],
  'Vehicles & Parts':        ['make', 'vModel', 'years', 'partNumber', 'position', 'fuel', 'gearbox', 'mileage', 'colour', 'warranty'],
  'Garden & Outdoor':        ['material', 'dimensions', 'powerSource', 'colour', 'finishUse', 'weight'],
  'Cleaning Supplies':       ['netQty', 'scent', 'use', 'packQty', 'origin'],
  'Health & Beauty':         ['netQty', 'skinHair', 'ingredients', 'use', 'origin'],
  'Fashion & Clothing':      ['forWho', 'material', 'colour', 'fit', 'care', 'origin'],
  'Baby & Kids':             ['ageRange', 'material', 'colour', 'safety', 'forWho', 'care'],
  'Sports & Hobbies':        ['sport', 'material', 'colour', 'dimensions', 'weight', 'forWho'],
  'Books & Education':       ['author', 'publisher', 'isbn', 'language', 'level'],
  'Food & Groceries':        ['netQty', 'ingredients', 'allergens', 'keep', 'diet', 'origin'],
  'Agriculture & Farm':      ['netQty', 'npk', 'activeIng', 'variety', 'use', 'origin'],
  'Other':                   ['model', 'material', 'colour', 'dimensions', 'weight', 'origin'],
};

// One-tap option sets for "Sizes or colours" that fit the category, and the
// word for them. Clothing keeps v176's sizes and its size chart.
const CATEGORY_OPTIONS = {
  'Phones & Tablets':        [['Storage', ['64 GB', '128 GB', '256 GB', '512 GB']]],
  'Computers & Electronics': [['Storage', ['256 GB', '512 GB', '1 TB']], ['RAM', ['8 GB', '16 GB', '32 GB']]],
  'Plumbing Supplies':       [['Pipe size', ['½ inch', '¾ inch', '1 inch', '1¼ inch', '1½ inch', '2 inch']]],
  'Electrical Supplies':     [['Cable size', ['1.5 mm²', '2.5 mm²', '4 mm²', '6 mm²']]],
  'Paint & Finishes':        [['Volume', ['1 litre', '4 litres', '20 litres']]],
  'Building & Hardware':     [['Diameter', ['8 mm', '10 mm', '12 mm', '16 mm']], ['Length', ['2 inch', '3 inch', '4 inch', '6 inch']]],
  'Food & Groceries':        [['Pack size', ['1 kg', '5 kg', '25 kg', '50 kg']]],
};
const CHART_CATEGORIES = ['Fashion & Clothing', 'Baby & Kids', 'Sports & Hobbies'];

const MAX_EXTRA = 5;
const KEY_RE = /^[a-zA-Z]{1,20}$/;
const LONG_NUMBER = /\d{14,}/; // an IMEI (15 digits) or a long serial: kept private, never a detail

function clean(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function isbnOk(s) {
  const d = String(s).replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(d)) { let sum = 0; for (let i = 0; i < 10; i++) sum += (d[i] === 'X' ? 10 : Number(d[i])) * (10 - i); return sum % 11 === 0; }
  if (/^\d{13}$/.test(d)) { let sum = 0; for (let i = 0; i < 13; i++) sum += Number(d[i]) * (i % 2 ? 3 : 1); return sum % 10 === 0; }
  return false;
}

// Checks the details a seller sent. `specs` is { key: value }; `extra` is up
// to 5 { name, value } pairs of their own. Blank values are dropped. Returns
// { specs, extra } (null when nothing is filled in) or { error }.
function readSpecs(specs, extra) {
  const out = {};
  if (specs !== undefined && specs !== null) {
    if (typeof specs !== 'object' || Array.isArray(specs)) return { error: 'The details are not in the right form' };
    const keys = Object.keys(specs);
    if (keys.length > 40) return { error: 'Too many details' };
    for (const k of keys) {
      if (!KEY_RE.test(k) || !Object.prototype.hasOwnProperty.call(F, k)) return { error: 'One of the details is not known. Reload the page and try again.' };
      const f = F[k], raw = specs[k];
      if (raw === null || raw === undefined || raw === '') continue;
      if (f.type === 'number') {
        const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
        if (!Number.isFinite(n) || n < f.min || n > f.max) return { error: `${f.label} must be a number from ${f.min} to ${f.max}${f.unit ? ' ' + f.unit : ''}` };
        out[k] = f.step === 1 ? Math.round(n) : Math.round(n * 10) / 10;
      } else if (f.type === 'choice') {
        const v = clean(raw);
        if (!f.options.includes(v)) return { error: `Choose "${f.label}" from the list` };
        out[k] = v;
      } else {
        const v = clean(raw);
        if (!v) continue;
        const max = f.max || 60;
        if (v.length > max) return { error: `${f.label} must be under ${max} characters` };
        if (LONG_NUMBER.test(v.replace(/[\s-]/g, '')) && k !== 'isbn') return { error: `Don't put an IMEI or serial number in "${f.label}". It is kept private in the ownership part of the form.` };
        if (k === 'isbn' && !isbnOk(v)) return { error: 'That ISBN is not right. It has 10 or 13 digits; check the back cover.' };
        out[k] = v;
      }
    }
  }
  const more = [];
  if (extra !== undefined && extra !== null) {
    if (!Array.isArray(extra)) return { error: 'The other details are not in the right form' };
    for (const x of extra) {
      const name = clean(x && x.name), value = clean(x && x.value);
      if (!name && !value) continue;
      if (!name || !value) return { error: 'Each detail of your own needs a name and what it is' };
      if (name.length > 30) return { error: 'The name of a detail must be under 30 characters' };
      if (value.length > 80) return { error: 'A detail must be under 80 characters' };
      if (LONG_NUMBER.test(value.replace(/[\s-]/g, ''))) return { error: 'Don\'t put an IMEI or serial number in the details. It is kept private in the ownership part of the form.' };
      if (more.some(m => m.name.toLowerCase() === name.toLowerCase())) return { error: `"${name}" is there twice` };
      more.push({ name, value });
    }
    if (more.length > MAX_EXTRA) return { error: `Up to ${MAX_EXTRA} details of your own` };
  }
  return { specs: Object.keys(out).length ? out : null, extra: more.length ? more : null };
}

// The details as label and value, in the order of the category (then any
// others), for the buyer's page.
function specRows(specs, extra, category) {
  const rows = [];
  const order = (CATEGORY_SPECS[category] || []).concat(Object.keys(F));
  const seen = new Set();
  for (const k of order) {
    if (seen.has(k) || !specs || specs[k] === undefined || specs[k] === null) continue;
    seen.add(k);
    const f = F[k]; if (!f) continue;
    rows.push({ key: k, type: f.type, raw: specs[k], unit: f.unit || '', label: f.label, value: f.type === 'number' ? `${specs[k]}${f.unit ? (f.unit === '%' ? '%' : ' ' + f.unit) : ''}` : String(specs[k]) });
  }
  for (const x of extra || []) rows.push({ key: null, label: x.name, value: x.value });
  return rows;
}

// For search: the details as words, with "128 GB" also as "128gb" so either finds it.
function specsText(specs, extra) {
  const parts = [];
  for (const r of specRows(specs, extra, null)) parts.push(r.value);
  const s = parts.join(' ');
  return s + ' ' + s.replace(/(\d)\s+(gb|tb|mb|mm²|mm2|mm|cm|kg|g|v|w|a|l|m|inch|in|litres?|hp|kva|mah)\b/gi, '$1$2').replace(/mm²/g, 'mm2');
}

// What the app needs to draw the form and the buyer's table.
function publicTemplates() {
  return { fields: F, categories: CATEGORY_SPECS, options: CATEGORY_OPTIONS, chartCategories: CHART_CATEGORIES, maxExtra: MAX_EXTRA };
}

module.exports = { FIELDS: F, CATEGORY_SPECS, CATEGORY_OPTIONS, CHART_CATEGORIES, MAX_EXTRA, readSpecs, specRows, specsText, publicTemplates, isbnOk };
