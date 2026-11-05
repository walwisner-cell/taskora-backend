// v133: one rule for whether a pro is "listed": shown in search, counted on
// the homepage, featured, shown as a popular project and matched to jobs.
// A pro is listed once Trothen has verified their ID and they have a
// profile photo (the "Mandatory Profile Picture" rule).
//
// Before v133 search and job matching required the photo, but the category
// counts, Popular Projects and Featured pros did not. So the homepage could
// say "Landscaping · 1 pro · from $80" while clicking it found nobody.
//
// v139: a pro who only sells goods (proMode 'goods') is never listed as a
// service pro. Their store shows in the Market instead.
function isListedPro(u) {
  return !!(u && u.role === 'provider' && u.verified && u.profilePhotoUrl && u.proMode !== 'goods');
}
// Why a pro is not listed, in plain words (empty when they are).
function whyNotListed(u) {
  const out = [];
  if (!u || u.role !== 'provider') return out;
  if (!u.verified) out.push('ID not verified yet');
  if (!u.profilePhotoUrl) out.push('no profile photo');
  if (u.proMode === 'goods') out.push('sells goods only (shown in the Market, not in service search)');
  return out;
}
module.exports = { isListedPro, whyNotListed };
