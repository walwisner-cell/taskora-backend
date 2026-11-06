// Item 2 / "strengthen the frontend search engine." The actual gap: search
// was pure substring matching, which misses extremely natural queries like
// "plumber" against the category "Plumbing" — real words, same real
// meaning, different ending, so plain .includes() never connects them.
// Deliberately a small, curated, hand-checked list rather than automatic
// stemming — stemming risks false-positive matches (e.g. blindly stripping
// "-er"/"-ing" can misfire in ways nobody asked for); every entry here is a
// real, common way someone actually types what they need done, checked by
// hand against the real category list in src/seed.js.
const SEARCH_SYNONYMS = {
  plumber: 'Plumbing', plumbers: 'Plumbing',
  electrician: 'Electrical', electricians: 'Electrical',
  hvac: 'HVAC & Air Conditioning', 'air conditioning': 'HVAC & Air Conditioning', 'ac repair': 'HVAC & Air Conditioning', furnace: 'HVAC & Air Conditioning',
  handyman: 'Handyman Services', 'handy man': 'Handyman Services',
  carpenter: 'Carpentry', carpenters: 'Carpentry',
  painter: 'Painting', painters: 'Painting',
  roofer: 'Roofing', roofers: 'Roofing',
  flooring: 'Flooring Installation', floors: 'Flooring Installation',
  locksmith: 'Locksmith', locksmiths: 'Locksmith', 'lock repair': 'Locksmith',
  appliance: 'Appliance Repair', appliances: 'Appliance Repair',
  exterminator: 'Pest Control', pests: 'Pest Control', roaches: 'Pest Control', mice: 'Pest Control', 'rat removal': 'Pest Control',
  mason: 'Masonry', masons: 'Masonry', bricklayer: 'Masonry',
  welder: 'Welding', welders: 'Welding',
  contractor: 'General Contracting', contractors: 'General Contracting',
  renovation: 'Home Renovation', remodel: 'Home Renovation', remodeling: 'Home Renovation',
  cleaner: 'Cleaning', cleaners: 'Cleaning', maid: 'Cleaning', housekeeping: 'Cleaning', housekeeper: 'Cleaning',
  carpet: 'Carpet Cleaning',
  pool: 'Pool Cleaning & Maintenance',
  laundry: 'Laundry & Dry Cleaning', 'dry cleaning': 'Laundry & Dry Cleaning',
  mover: 'Moving', movers: 'Moving',
  delivery: 'Pick & Drop', courier: 'Pick & Drop',
  driver: 'Driver for Hire', drivers: 'Driver for Hire', chauffeur: 'Driver for Hire', taxi: 'Driver for Hire', keke: 'Driver for Hire', 'pen pen': 'Driver for Hire', 'pen-pen': 'Driver for Hire', motorbike: 'Driver for Hire', 'motor bike': 'Driver for Hire', okada: 'Driver for Hire', boda: 'Driver for Hire', // v142
  furniture: 'Furniture Assembly', assembly: 'Furniture Assembly', ikea: 'Furniture Assembly',
  junk: 'Junk Removal', hauling: 'Junk Removal',
  landscaper: 'Landscaping', landscapers: 'Landscaping', yard: 'Landscaping',
  lawn: 'Lawn Care', mowing: 'Lawn Care', mow: 'Lawn Care',
  gardener: 'Gardening', gardeners: 'Gardening',
  tree: 'Tree Trimming & Removal', trees: 'Tree Trimming & Removal', arborist: 'Tree Trimming & Removal',
  fence: 'Fence Installation & Repair', fencing: 'Fence Installation & Repair',
  trainer: 'Fitness', gym: 'Fitness', workout: 'Fitness',
  massage: 'Massage Therapy', masseuse: 'Massage Therapy',
  hair: 'Hair Styling', hairstylist: 'Hair Styling', barber: 'Hair Styling',
  makeup: 'Makeup Artistry',
  nails: 'Nail Care', manicure: 'Nail Care', pedicure: 'Nail Care',
  tutor: 'Tutoring', tutors: 'Tutoring',
  music: 'Music Lessons', piano: 'Music Lessons', guitar: 'Music Lessons',
  language: 'Language Lessons', spanish: 'Language Lessons', french: 'Language Lessons',
  sat: 'Test Prep', act: 'Test Prep', gre: 'Test Prep',
  wedding: 'Event Planning', party: 'Event Planning',
  photographer: 'Photography', photos: 'Photography',
  videographer: 'Videography',
  dj: 'DJ Services',
  caterer: 'Catering',
  mechanic: 'Auto Repair', 'car repair': 'Auto Repair',
  'car wash': 'Car Detailing & Wash', detailing: 'Car Detailing & Wash',
  tow: 'Towing', 'tow truck': 'Towing',
  petsitting: 'Pet Sitting', 'pet sitter': 'Pet Sitting',
  'dog walker': 'Dog Walking', walker: 'Dog Walking',
  groomer: 'Pet Grooming', grooming: 'Pet Grooming',
  computer: 'IT Support & Computer Repair', laptop: 'IT Support & Computer Repair',
  designer: 'Web & Graphic Design', website: 'Web & Graphic Design', logo: 'Web & Graphic Design', graphic: 'Web & Graphic Design',
  accountant: 'Accounting & Bookkeeping', bookkeeper: 'Accounting & Bookkeeping', taxes: 'Accounting & Bookkeeping',
  lawyer: 'Legal Consulting', attorney: 'Legal Consulting',
  notary: 'Notary Services',
  decorator: 'Interior Design',
};

// Given a raw search query, returns the extra category name(s) it should
// also match against, beyond plain substring matching — or an empty array
// if nothing in the table applies. Guards short queries (under 3
// characters) against the "term contains needle" direction specifically,
// since a 1-2 character needle would otherwise match almost every term in
// the table and defeat the point of a targeted synonym list.
function categoriesForSearchTerm(query) {
  const needle = (query || '').toLowerCase().trim();
  if (!needle) return [];
  const matches = new Set();
  for (const [term, category] of Object.entries(SEARCH_SYNONYMS)) {
    if (needle.includes(term)) matches.add(category);
    else if (needle.length >= 3 && term.includes(needle)) matches.add(category);
  }
  return Array.from(matches);
}

// v134: the listed category a customer meant, when they typed it slightly
// differently: "Land Scaping", "landscaping", "Land-scaping" or "landscaper"
// all mean Landscaping. Only an exact match (ignoring capitals, spaces and
// punctuation) or a whole-word synonym counts, so a genuinely new kind of
// work is never forced into the wrong category. Returns null when unsure.
function canonicalCategory(typed, activeNames) {
  const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const n = norm(typed);
  if (!n) return null;
  const exact = (activeNames || []).find(c => norm(c) === n);
  if (exact) return exact;
  const syn = Object.entries(SEARCH_SYNONYMS).find(([term]) => norm(term) === n);
  if (syn && (activeNames || []).includes(syn[1])) return syn[1];
  return null;
}

module.exports = { SEARCH_SYNONYMS, categoriesForSearchTerm, canonicalCategory };
