// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 key: 'adm-callhealth', flow: 'callhealth', section: 'callhealth', area: 'Call health',
 title: 'Call health', tagline: 'Why in-app calls worked or not, and what to fix',
 scenes: [
  { kind: 'title', icon: 'call', title: 'Call **health**', sub: 'Why in-app calls worked or not, and what to fix.',
    beats: ['This video is for super admins. It explains Call health: how the calls people make inside Trothen are going, and what to fix when they fail.'] },
  { kind: 'list', h: 'What you **see**', items: [{ icon: 'call', t: 'The last 50 calls' }, { icon: 'doc', t: 'What happened, **in plain words**', sub: 'Talked, not answered, cut off…' }, { icon: 'chart', t: 'This week\'s totals' }],
    beats: ['What do you see?', 'The last 50 calls made in Trothen.', 'For each one, what happened, in plain words: they talked, nobody answered, or the call was cut off.', 'And this week\'s totals.'] },
  { kind: 'table', h: 'What the **results** mean', head: ['Result', 'What it means'], rows: [{ c: ['Talked', 'The call worked'] }, { c: ['Did not ring: Trothen was not open', 'The other person did not have Trothen open'] }, { c: ['Answered, but no sound', 'The connection failed: usually the network'] }, { c: ['Cut off', 'The call dropped part way'] }],
    beats: ['What do the results mean?', 'Talked: the call worked.', 'Did not ring, because Trothen was not open: the other person did not have the app open, so the phone could not ring.', 'Answered, but the sound never connected: usually the network blocked it.', 'Cut off: the call dropped part way, often a weak signal.'] },
  { kind: 'flow', h: 'When calls **fail**', nodes: [{ icon: 'eye', t: 'Look for a pattern', sub: 'one person, or everyone?' }, { icon: 'wrench', t: 'Read what to fix', sub: 'shown on the page', tone: 'gold' }, { icon: 'refresh', t: 'Check again', sub: 'after the fix' }], foot: 'Many failures for **everyone** at once usually means a set-up problem, not people.',
    beats: ['When calls fail.', 'Look for a pattern: is it one person, or everyone?', 'Read what to fix, shown on the page.', 'Then check again after the fix.', 'Many failures for everyone at once usually means a set-up problem with the call service, not people.'], footAt: 3 },
  { kind: 'end', title: 'Calls that **connect**', sub: 'Super admins only.', beats: ['Good calls help customers and pros agree, without sharing their phone numbers. Check this page now and then.'] },
 ],
};
