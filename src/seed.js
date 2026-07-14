// Resets /data (or the Postgres database, if DATABASE_URL is set) to a known
// demo state. Run with: npm run seed
// Also imported by server.js to auto-seed an empty datastore on first boot
// (e.g. a fresh Render persistent disk, or a freshly-created Postgres
// database) without ever overwriting real data.
const { nanoid } = require('nanoid');
const db = require('./db');
const { hashPassword } = require('./auth');

const DEMO_PASSWORD = 'taskora123';

function id(prefix) {
  return `${prefix}_${nanoid(10)}`;
}

const now = () => new Date().toISOString();

async function seedDatabase() {

// ---- Users (customers, providers) — every user belongs to a city -----------
const users = [
  { id: 'u_jordan', name: 'Jordan Diaz', email: 'jordan@example.com', role: 'customer', city: 'Atlanta', country: 'United States', initials: 'JD', verified: true },

  { id: 'u_marcus', name: 'Marcus T.', email: 'marcus@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'MT', verified: true,
    providerRole: 'Master Plumber', category: 'Plumbing', rating: 4.9, jobs: 312, price: 85, tags: ['Pipe Repair', 'Drain Cleaning', 'Fixtures'], color: '#12161F', since: '2022' },
  { id: 'u_aisha', name: 'Aisha K.', email: 'aisha@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'AK', verified: true,
    providerRole: 'Home Cleaning Pro', category: 'Cleaning', rating: 5.0, jobs: 487, price: 65, tags: ['Deep Clean', 'Move-Out', 'Weekly Service'], color: '#2E8C6F', since: '2023' },
  { id: 'u_james', name: 'James R.', email: 'james@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'JR', verified: true,
    providerRole: 'Math & Science Tutor', category: 'Tutoring', rating: 4.8, jobs: 156, price: 55, tags: ['SAT Prep', 'Algebra', 'Physics'], color: '#B08A3E', since: '2021' },
  { id: 'u_sofia', name: 'Sofia M.', email: 'sofia@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'SM', verified: true,
    providerRole: 'Licensed Electrician', category: 'Electrical', rating: 4.9, jobs: 228, price: 95, tags: ['Wiring', 'Panel Upgrade', 'Outlets'], color: '#4B5D7A', since: '2020' },
  { id: 'u_deshawn', name: 'DeShawn L.', email: 'deshawn@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'DL', verified: true,
    providerRole: 'Personal Trainer', category: 'Fitness', rating: 4.7, jobs: 203, price: 70, tags: ['Weight Loss', 'HIIT', 'Strength'], color: '#8C4A46', since: '2023' },
  { id: 'u_priya', name: 'Priya N.', email: 'priya@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'PN', verified: true,
    providerRole: 'Interior Painter', category: 'Painting', rating: 4.8, jobs: 91, price: 75, tags: ['Interior', 'Exterior', 'Accent Walls'], color: '#2F6F62', since: '2022' },
  { id: 'u_tom', name: 'Tom B.', email: 'tom@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'TB', verified: true,
    providerRole: 'Moving Specialist', category: 'Moving', rating: 4.6, jobs: 178, price: 110, tags: ['Local Move', 'Packing', 'Furniture'], color: '#6B4C7A', since: '2021' },
  { id: 'u_keisha', name: 'Keisha W.', email: 'keisha@example.com', role: 'provider', city: 'Atlanta', country: 'United States', initials: 'KW', verified: true,
    providerRole: 'Landscape Designer', category: 'Landscaping', rating: 4.9, jobs: 144, price: 80, tags: ['Lawn Care', 'Garden Design', 'Mulching'], color: '#3F6B4A', since: '2022' },

  // Lagos, Nigeria
  { id: 'u_emeka', name: 'Emeka N.', email: 'emeka@example.com', role: 'provider', city: 'Lagos', country: 'Nigeria', initials: 'EN', verified: false,
    providerRole: 'Plumber', category: 'Plumbing', rating: 0, jobs: 0, price: 40, tags: [], color: '#5A5F6C', since: '2026' },
  { id: 'u_chioma', name: 'Chioma K.', email: 'chioma@example.com', role: 'customer', city: 'Lagos', country: 'Nigeria', initials: 'CK', verified: false },

  // Accra, Ghana
  { id: 'u_grace', name: 'Grace Boakye', email: 'grace@example.com', role: 'provider', city: 'Accra', country: 'Ghana', initials: 'GB', verified: false,
    providerRole: 'Electrician', category: 'Electrical', rating: 0, jobs: 0, price: 50, tags: [], color: '#5A5F6C', since: '2026' },
  { id: 'u_ama', name: 'Ama Serwaa', email: 'ama@example.com', role: 'customer', city: 'Accra', country: 'Ghana', initials: 'AS', verified: false },

  // ---- Admins ----------------------------------------------------------
  // A location admin manages exactly one city and only sees that city's
  // users, disputes, and stats. A super admin (isSuperAdmin: true, region:
  // null) sees and manages everything, including creating new location
  // admins.
  { id: 'u_amara', name: 'Amara O.', email: 'amara@example.com', role: 'admin', city: 'Atlanta', country: 'United States', initials: 'AO', verified: true,
    region: 'Atlanta', isSuperAdmin: false, active: true },
  { id: 'u_ngozi', name: 'Ngozi A.', email: 'ngozi@example.com', role: 'admin', city: 'Lagos', country: 'Nigeria', initials: 'NA', verified: true,
    region: 'Lagos', isSuperAdmin: false, active: true },
  { id: 'u_kwame', name: 'Kwame B.', email: 'kwame@example.com', role: 'admin', city: 'Accra', country: 'Ghana', initials: 'KB', verified: true,
    region: 'Accra', isSuperAdmin: false, active: true },
  { id: 'u_superadmin', name: 'Taskora HQ', email: 'superadmin@taskora.io', role: 'admin', city: null, country: null, initials: 'TH', verified: true,
    region: null, isSuperAdmin: true, active: true },
].map((u, i) => ({
  ...u,
  passwordHash: hashPassword(DEMO_PASSWORD),
  createdAt: now(),
  phone: u.phone || `+1 404 555 ${String(1000 + i).slice(-4)}`,
  address: u.address || `${100 + i} Main Street`,
  // A couple of Atlanta providers deliberately share a zip code with Jordan
  // (the seeded demo customer) so the community-matching boost in AI
  // matching has something real to demonstrate rather than always being 0.
  zipCode: u.zipCode || (u.city === 'Atlanta' ? (i % 3 === 0 ? '30301' : '30302') : (u.city ? '00000' : null)),
  phoneVerified: u.phoneVerified !== undefined ? u.phoneVerified : true,
  skills: u.skills || (u.tags && u.tags.length ? u.tags.join(', ') : undefined),
}));

await db.replaceAll('users', users);

// ---- Categories & countries (global config — super admin only) -------------
await db.replaceAll('categories', [
  { id: id('cat'), name: 'Plumbing', active: true },
  { id: id('cat'), name: 'Cleaning', active: true },
  { id: id('cat'), name: 'Tutoring', active: true },
  { id: id('cat'), name: 'Electrical', active: true },
  { id: id('cat'), name: 'Moving', active: true },
  { id: id('cat'), name: 'Painting', active: true },
  { id: id('cat'), name: 'Landscaping', active: true },
  { id: id('cat'), name: 'Fitness', active: true },
]);

await db.replaceAll('countries', [
  { id: id('cty'), name: 'United States', status: 'live' },
  { id: id('cty'), name: 'Nigeria', status: 'live' },
  { id: id('cty'), name: 'Ghana', status: 'live' },
  { id: id('cty'), name: 'Liberia', status: 'live' },
  { id: id('cty'), name: 'United Kingdom', status: 'planned' },
  { id: id('cty'), name: 'Canada', status: 'planned' },
  { id: id('cty'), name: 'Kenya', status: 'planned' },
  { id: id('cty'), name: 'South Africa', status: 'planned' },
]);

// ---- Cities registry (which cities are open, and who admins them) ----------
await db.replaceAll('cities', [
  { id: 'city_atlanta', name: 'Atlanta', country: 'United States', adminId: 'u_amara' },
  { id: 'city_lagos', name: 'Lagos', country: 'Nigeria', adminId: 'u_ngozi' },
  { id: 'city_accra', name: 'Accra', country: 'Ghana', adminId: 'u_kwame' },
]);

// ---- Contracts / escrow / payouts (history for the demo customer & Marcus) -
const contracts = [
  { id: 'ct_1042', customerId: 'u_jordan', providerId: 'u_marcus', service: 'Kitchen sink pipe repair', amount: 180, status: 'active', signedAt: '2026-07-12' },
  { id: 'ct_1039', customerId: 'u_jordan', providerId: 'u_aisha', service: 'Deep clean — 3BR apartment', amount: 140, status: 'completed', signedAt: '2026-07-10' },
  { id: 'ct_1031', customerId: 'u_jordan', providerId: 'u_james', service: 'SAT prep — 4 sessions', amount: 220, status: 'completed', signedAt: '2026-07-02' },
  { id: 'ct_1024', customerId: 'u_jordan', providerId: 'u_sofia', service: 'Panel upgrade estimate', amount: 0, status: 'disputed', signedAt: '2026-06-24' },
];
await db.replaceAll('contracts', contracts.map(c => ({ ...c, createdAt: now() })));

await db.replaceAll('escrowTransactions', [
  { id: id('esc'), contractId: 'ct_1042', amount: 180, status: 'held', createdAt: now() },
  { id: id('esc'), contractId: 'ct_1039', amount: 140, status: 'released', createdAt: now() },
  { id: id('esc'), contractId: 'ct_1031', amount: 220, status: 'released', createdAt: now() },
]);

await db.replaceAll('payouts', [
  { id: 'po_330', providerId: 'u_marcus', date: '2026-07-10', amount: 530, method: 'Bank Transfer', status: 'completed' },
  { id: 'po_321', providerId: 'u_marcus', date: '2026-07-03', amount: 410, method: 'Bank Transfer', status: 'completed' },
  { id: 'po_312', providerId: 'u_marcus', date: '2026-06-26', amount: 295, method: 'Wallet', status: 'completed' },
]);

// ---- Disputes ---------------------------------------------------------------
await db.replaceAll('disputes', [
  { id: 'dp_118', contractId: 'ct_1024', reason: 'Incomplete work', amount: 640, status: 'open', parties: 'Sofia M. \u2194 Malik Owens', createdAt: now() },
  { id: 'dp_114', contractId: 'ct_1039', reason: 'Late arrival', amount: 75, status: 'in review', parties: 'Priya N. \u2194 Renee Park', createdAt: now() },
  { id: 'dp_109', contractId: 'ct_1031', reason: 'Damaged item during move', amount: 220, status: 'resolved', parties: 'Tom B. \u2194 Grant Lee', createdAt: now() },
]);

// ---- Verification queue ------------------------------------------------------
await db.replaceAll('verifications', [
  { id: id('ver'), userId: 'u_grace', docType: 'National ID', status: 'in review', createdAt: now() },
  { id: id('ver'), userId: 'u_emeka', docType: 'BVN + NIN', status: 'in review', createdAt: now() },
  { id: id('ver'), userId: 'u_chioma', docType: 'BVN + NIN', status: 'in review', createdAt: now() },
  { id: id('ver'), userId: 'u_ama', docType: 'National ID', status: 'in review', createdAt: now() },
  { id: id('ver'), userId: 'u_jordan', docType: 'State ID', status: 'approved', createdAt: now() },
  { id: id('ver'), userId: 'u_marcus', docType: 'State ID', status: 'approved', createdAt: now() },
]);

// ---- Notifications ------------------------------------------------------------
await db.replaceAll('notifications', [
  { id: id('ntf'), userId: 'u_jordan', icon: '✅', text: 'Your identity verification was approved.', time: '2 hours ago', read: false, createdAt: now() },
  { id: id('ntf'), userId: 'u_jordan', icon: '💰', text: 'Escrow released — $140 for Deep Clean job.', time: '1 day ago', read: false, createdAt: now() },
  { id: id('ntf'), userId: 'u_jordan', icon: '💬', text: 'New message from Marcus T.', time: '2 days ago', read: true, createdAt: now() },
  { id: id('ntf'), userId: 'u_marcus', icon: '🎯', text: 'You have 3 new AI job matches.', time: '1 hour ago', read: false, createdAt: now() },
]);

// ---- Jobs & matches (empty at boot — created live via the Post a Job flow) ---
await db.replaceAll('jobs', []);
await db.replaceAll('matches', []);
await db.replaceAll('messages', []);
await db.replaceAll('paymentMethods', []);
await db.replaceAll('passwordResets', []);
await db.replaceAll('phoneVerifications', []);
await db.replaceAll('reviews', [
  { id: id('rev'), providerId: 'u_marcus', authorName: 'Renee P.', stars: 5, text: 'Showed up on time, explained everything clearly, and the price matched the quote exactly.', createdAt: now() },
  { id: id('rev'), providerId: 'u_marcus', authorName: 'Malik O.', stars: 5, text: 'Excellent work — fast, clean, and professional. The escrow process made the whole thing feel safe.', createdAt: now() },
  { id: id('rev'), providerId: 'u_marcus', authorName: 'Priya S.', stars: 4, text: 'Good work overall, arrived a little later than scheduled but communicated well throughout.', createdAt: now() },
]);

console.log('✅ Seed complete.');
console.log(`   ${users.length} users created. Demo password for all accounts: "${DEMO_PASSWORD}"`);
console.log('   Super Admin:   superadmin@taskora.io  (sees & manages everything, creates location admins)');
console.log('   Atlanta Admin: amara@example.com   (US)');
console.log('   Lagos Admin:   ngozi@example.com    (Nigeria)');
console.log('   Accra Admin:   kwame@example.com    (Ghana)');
console.log('   Customer:      jordan@example.com   (Atlanta)');
console.log('   Provider:      marcus@example.com   (Atlanta)');

} // end seedDatabase

// Only seed automatically if the datastore is genuinely empty — this is what
// makes it safe to import from server.js on every boot: a fresh disk/database
// (first deploy) gets demo data, but one that already has real users/jobs/etc.
// on it is left completely untouched, redeploy after redeploy.
async function seedIfEmpty() {
  const existingUsers = await db.all('users');
  const hasData = existingUsers.length > 0;
  if (hasData) {
    console.log('ℹ️  Existing data found — skipping auto-seed (use `npm run seed` to force-reset).');
    return false;
  }
  console.log('ℹ️  No existing data found — seeding demo data for first boot...');
  await seedDatabase();
  return true;
}

// Run immediately (and unconditionally) when invoked directly via `npm run seed`.
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => { console.error('Seed failed:', err); process.exit(1); });
}

module.exports = { seedDatabase, seedIfEmpty };
