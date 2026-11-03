// v135: categories grouped the way customers look for them, and where each
// is offered.
//
// One worldwide list of the kinds of work Trothen covers, managed in one
// place, with the same names and translations everywhere. Each country sees
// the categories offered there (a category is offered everywhere unless the
// super admin switches it off for a country: legal, licensing or local
// rules), with how many pros offer it near the customer. Jobs are always
// matched to pros in the job's own country. This is how the large
// international marketplaces handle it.
const GROUPS = [
  ['Home repairs & maintenance', /plumb|electric|hvac|air con|handyman|carpent|paint|roof|floor|locksmith|lock|appliance|pest|window install|mason|weld|contract|renovat|fence|interior/i],
  ['Cleaning', /clean|laundry|janitor/i],
  ['Outdoor & garden', /landscap|lawn|garden|tree|yard|pool/i],
  ['Moving & delivery', /mov|pick|drop|deliver|courier|furniture|junk|haul|towing/i],
  ['Beauty & wellness', /hair|makeup|nail|massage|beauty|spa|barber|fitness|yoga|trainer/i],
  ['Lessons & tutoring', /tutor|lesson|test prep|teach|class|coach/i],
  ['Events & media', /event|photo|video|dj|cater|music|wedding|party/i],
  ['Vehicles', /auto|car |car$|detail|mechanic|vehicle/i],
  ['Pets', /pet|dog|cat /i],
  ['Care', /baby|nanny|child|elder|senior|care/i],
  ['Business & tech', /it support|computer|web|design|graphic|account|bookkeep|legal|notary|publish|marketing|writing|translat|security/i],
];
const OTHER = 'Other services';
function groupFor(name) {
  const n = String(name || '');
  const hit = GROUPS.find(([, re]) => re.test(n));
  return hit ? hit[0] : OTHER;
}
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
// Is this category offered in this country? (Offered everywhere unless switched off there.)
function offeredIn(category, country) {
  if (!country) return true;
  return !(category.notOfferedIn || []).some(c => sameText(c, country));
}
module.exports = { GROUPS: GROUPS.map(g => g[0]).concat(OTHER), groupFor, offeredIn, sameText };
