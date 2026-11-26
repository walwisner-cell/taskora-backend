// Animated explainer: Your account, settings and data.
module.exports = {
  key: 'privacy', title: 'Your account, settings and data',
  scenes: [
    { kind: 'title', icon: 'settings', title: 'Your account, **settings** and data', sub: 'Your details, your password, calls and sounds, and your data.',
      beats: ['This video shows how to look after your account: your details, your password, calls and sounds, and your data. Everything is in Settings.'] },
    { kind: 'phone', n: '1', h: 'Your **details**', points: [{ b: 0, icon: 'settings', t: 'More, then **Settings**' }, { b: 1, icon: 'user', t: 'Name, email, phone, address' }, { b: 2, icon: 'globe', t: 'Moving? Change your country and city' }, { b: 3, icon: 'check', t: 'Tap **Save Changes**' }],
      rows: [{ k: 'head', t: 'Settings' }, { k: 'field', label: 'Name', value: 'Jordan Diaz', b: 1 }, { k: 'field', label: 'Phone', value: '0777 123 456', b: 1 }, { k: 'field', label: 'Country · City', value: 'Liberia · Monrovia', b: 2 }, { k: 'button', t: 'Save Changes', b: 3, tap: 3 }],
      beats: ['To open Settings on a phone, tap More at the bottom of the screen, then Settings.', 'At the top are your details: your name, email, phone number and address.', 'Moving? Change your country, county and city here, so Trothen shows you pros near you.', 'After any change, tap Save Changes.'] },
    { kind: 'phone', n: '2', h: 'Your **password**', points: [{ b: 0, icon: 'key', t: 'Current password, then the new one **twice**' }, { b: 1, icon: 'phone', t: 'Lost your phone?' }, { b: 2, icon: 'lock', t: 'Tap **Sign out of all devices**' }],
      rows: [{ k: 'field', label: 'Current password', value: '••••••••' }, { k: 'field', label: 'New password', value: '••••••••••' }, { k: 'field', label: 'New password again', value: '••••••••••' }, { k: 'button', t: 'Sign out of all devices', ghost: true, b: 2, tap: 2 }],
      beats: ['To change your password, type your current password, then your new password twice.', 'Lost your phone? Or do you think someone knows your password?', 'Tap Sign out of all devices. Everyone using your account is signed out. Then sign in again on your own phone, and change your password.'] },
    { kind: 'list', h: 'Calls and **sounds**', items: [{ icon: 'call', t: 'Who can **call** you, and when', sub: 'Turn calls off, or choose your hours.' }, { icon: 'bell', t: 'Your **ringtone** and message sound', sub: 'Tap Play to hear them.' }],
      beats: ['Below, choose how Trothen reaches you.', 'Choose whether people can call you in the app, and at what times. For example, not at night.', 'Choose your ringtone, and the sound for a new message. Tap Play to hear them.'] },
    { kind: 'list', h: 'Your **data** is yours', items: [{ icon: 'doc', t: '**Download a copy of my data**', sub: 'Everything Trothen holds about you, in one file.' }, { icon: 'x', tone: 'bad', t: '**Close my account**', sub: 'Your personal data is then removed.' }, { icon: 'receipt', t: 'Some records are kept', sub: 'Payments, for the time the law asks.' }],
      beats: ['Your data belongs to you.', 'Tap Download a copy of my data, to get everything Trothen holds about you, in one file.', 'And if you ever want to leave, tap Close my account. Your personal data is then removed.', 'Some records, like payments, are kept for the time the law asks.'] },
    { kind: 'end', title: 'Your account is **safe**', sub: 'Stuck? Tap Help videos, or ask us in the support chat.', beats: ['That is all. Check your settings now and then, and keep your password to yourself.'] },
  ],
};
