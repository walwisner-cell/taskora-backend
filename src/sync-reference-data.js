// Keeps an ALREADY-RUNNING database's reference data (countries,
// categories) in sync with what's in the current codebase — without ever
// touching real users, bookings, contracts, or anything else real people
// created. This is the safe complement to seed.js: seed.js only runs on a
// genuinely empty, first-boot database (so it never overwrites real
// production data); this script is what you run *after* deploying new
// code, against a database that already has real data in it, whenever new
// countries or categories have been added to the reference lists since it
// was first seeded.
//
// Only ADDS what's missing. Never removes or modifies an existing
// country/category — if you've deactivated one, or changed its live/
// planned status, or renamed it, this leaves that choice alone.
const db = require('./db');
const { nanoid } = require('nanoid');
const { COUNTRIES } = require('./geo-data');

// The same comprehensive category list from seed.js, kept in sync there —
// duplicated here (rather than imported) only because seed.js doesn't
// currently export it as reusable data. If you add more categories to
// seed.js in the future, mirror the addition here too.
const REFERENCE_CATEGORIES = [
  { name: 'Plumbing', icon: '🔧' }, { name: 'Electrical', icon: '⚡' },
  { name: 'HVAC & Air Conditioning', icon: '❄️' }, { name: 'Handyman Services', icon: '🛠️' },
  { name: 'Carpentry', icon: '🪚' }, { name: 'Painting', icon: '🎨' },
  { name: 'Roofing', icon: '🏠' }, { name: 'Flooring Installation', icon: '🪵' },
  { name: 'Locksmith', icon: '🔑' }, { name: 'Appliance Repair', icon: '🔌' },
  { name: 'Pest Control', icon: '🐜' }, { name: 'Window Installation & Repair', icon: '🪟' },
  { name: 'Masonry', icon: '🧱' }, { name: 'Welding', icon: '🔥' },
  { name: 'General Contracting', icon: '👷' }, { name: 'Home Renovation', icon: '🏗️' },
  { name: 'Cleaning', icon: '🧹' }, { name: 'Deep Cleaning', icon: '🧼' },
  { name: 'Carpet Cleaning', icon: '🧽' }, { name: 'Window Cleaning', icon: '🪞' },
  { name: 'Pool Cleaning & Maintenance', icon: '🏊' }, { name: 'Laundry & Dry Cleaning', icon: '👕' },
  { name: 'Moving', icon: '📦' }, { name: 'Pick & Drop', icon: '🚗' },
  { name: 'Furniture Assembly', icon: '🪑' }, { name: 'Junk Removal', icon: '🗑️' },
  { name: 'Landscaping', icon: '🌿' }, { name: 'Lawn Care', icon: '🌾' },
  { name: 'Gardening', icon: '🌱' }, { name: 'Tree Trimming & Removal', icon: '🌳' },
  { name: 'Fence Installation & Repair', icon: '🚧' }, { name: 'Fitness', icon: '💪' },
  { name: 'Massage Therapy', icon: '💆' }, { name: 'Hair Styling', icon: '💇' },
  { name: 'Makeup Artistry', icon: '💄' }, { name: 'Nail Care', icon: '💅' },
  { name: 'Tutoring', icon: '📚' }, { name: 'Music Lessons', icon: '🎵' },
  { name: 'Language Lessons', icon: '🗣️' }, { name: 'Test Prep', icon: '📝' },
  { name: 'Event Planning', icon: '🎉' }, { name: 'Photography', icon: '📷' },
  { name: 'Videography', icon: '🎥' }, { name: 'DJ Services', icon: '🎧' },
  { name: 'Catering', icon: '🍽️' }, { name: 'Auto Repair', icon: '🚘' },
  { name: 'Car Detailing & Wash', icon: '🧽' }, { name: 'Towing', icon: '🚛' },
  { name: 'Pet Sitting', icon: '🐾' }, { name: 'Dog Walking', icon: '🐕' },
  { name: 'Pet Grooming', icon: '🐩' }, { name: 'IT Support & Computer Repair', icon: '💻' },
  { name: 'Web & Graphic Design', icon: '🎨' }, { name: 'Accounting & Bookkeeping', icon: '📊' },
  { name: 'Legal Consulting', icon: '⚖️' }, { name: 'Notary Services', icon: '🖋️' },
  { name: 'Interior Design', icon: '🛋️' }, { name: 'Babysitting & Nanny Services', icon: '🍼' },
  { name: 'Elder Care', icon: '🧓' }, { name: 'Security Services', icon: '🛡️' },
];

// These are the platform's core, always-operating countries — if one of
// these ever ends up "planned" instead of "live" (e.g. an accidental toggle
// in the admin panel), that's not a deliberate business decision the way it
// might be for a country that was only just added; it's almost certainly a
// mistake, since the whole platform is built around these being real,
// active markets. Sync corrects this defensively rather than assuming any
// existing status was intentional.
const CORE_COUNTRIES = ['United States', 'Nigeria', 'Ghana', 'Liberia'];

async function syncReferenceData() {
  const result = { countriesAdded: [], categoriesAdded: [], countriesReactivated: [], iconsBackfilled: [] };

  const existingCountries = await db.all('countries');
  const existingCountryNames = new Set(existingCountries.map(c => c.name));
  for (const name of COUNTRIES) {
    if (!existingCountryNames.has(name)) {
      await db.insert('countries', { id: `cty_${nanoid(8)}`, name, status: 'live' });
      result.countriesAdded.push(name);
    }
  }

  // Defensive correction for the core countries specifically — see the
  // comment above CORE_COUNTRIES for why this one case gets fixed rather
  // than just left as "whatever the database already says."
  for (const name of CORE_COUNTRIES) {
    const existing = await db.find('countries', c => c.name === name);
    if (existing && existing.status !== 'live') {
      await db.update('countries', existing.id, { status: 'live' });
      result.countriesReactivated.push(name);
    }
  }

  const existingCategories = await db.all('categories');
  const existingCategoryNames = new Set(existingCategories.map(c => c.name.toLowerCase()));
  for (const cat of REFERENCE_CATEGORIES) {
    if (!existingCategoryNames.has(cat.name.toLowerCase())) {
      await db.insert('categories', { id: `cat_${nanoid(8)}`, name: cat.name, icon: cat.icon, active: true });
      result.categoriesAdded.push(cat.name);
    }
  }

  // Backfills the icon on any EXISTING category that's missing one — this
  // is the actual fix for categories created before the icon field
  // existed on this database (they'd otherwise be stuck showing the
  // generic fallback tool icon forever, since adding new categories alone
  // never touches ones that already exist).
  const refIconByName = new Map(REFERENCE_CATEGORIES.map(c => [c.name.toLowerCase(), c.icon]));
  for (const existing of existingCategories) {
    if (existing.icon && existing.icon.trim()) continue; // already has a real icon — leave it alone
    const refIcon = refIconByName.get(existing.name.toLowerCase());
    if (refIcon) {
      await db.update('categories', existing.id, { icon: refIcon });
      result.iconsBackfilled.push(existing.name);
    }
  }

  return result;
}

module.exports = { syncReferenceData };

// Allows running this directly from a shell: `node src/sync-reference-data.js`
// — useful if you have terminal/console access to your host and would
// rather not go through the admin panel button.
if (require.main === module) {
  syncReferenceData().then(result => {
    console.log(`✅ Sync complete.`);
    console.log(`   Countries added: ${result.countriesAdded.length ? result.countriesAdded.join(', ') : '(none — already up to date)'}`);
    console.log(`   Countries reactivated (were incorrectly set to planned): ${result.countriesReactivated.length ? result.countriesReactivated.join(', ') : '(none)'}`);
    console.log(`   Categories added: ${result.categoriesAdded.length ? result.categoriesAdded.join(', ') : '(none — already up to date)'}`);
    console.log(`   Category icons fixed (were missing/blank): ${result.iconsBackfilled.length ? result.iconsBackfilled.join(', ') : '(none)'}`);
    process.exit(0);
  }).catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
}
