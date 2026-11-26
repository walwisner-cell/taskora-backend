// Animated explainer: Messages and calls.
module.exports = {
  key: 'messages', title: 'Messages and calls',
  scenes: [
    { kind: 'title', icon: 'chat', title: 'Messages and **calls**', sub: 'Talk to a pro, a seller or a host, inside Trothen.',
      beats: ['This video shows how to send a message, a voice message, and make a call, all inside Trothen.'] },
    { kind: 'phone', n: '1', h: 'Open **Messages**', points: [{ b: 0, icon: 'chat', t: 'At the bottom of the screen' }, { b: 1, icon: 'users', t: 'One conversation for each person' }, { b: 2, icon: 'eye', t: 'Tap one to open it' }],
      rows: [{ k: 'head', t: 'Messages' }, { k: 'card', icon: 'user', t: 'Marcus T.', sub: 'Plumbing · Yes, I can come tomorrow', on: true, b: 1, tap: 2 }, { k: 'card', icon: 'store', t: 'Builders Depot', sub: 'Your cement is on its way', b: 1 }, { k: 'card', icon: 'home', t: 'Musa K. (host)', sub: 'Welcome! The gate code is…', b: 1 }, { k: 'bar', on: 2, tap: 0 }],
      beats: ['Tap Messages, at the bottom of the screen.', 'Each conversation is with one person: a pro, a seller, a store, or a host. The newest are at the top.', 'Tap a conversation to open it.'] },
    { kind: 'phone', n: '2', h: 'Type, **talk**, or call', points: [{ b: 0, icon: 'chat', t: 'Type in the box, tap **Send**' }, { b: 1, icon: 'call', t: 'Hold the **microphone** for a voice message' }, { b: 2, icon: 'call', t: 'Call or video call from the top' }],
      rows: [{ k: 'head', t: 'Marcus T.' }, { k: 'note', icon: 'chat', t: 'Yes, I can come tomorrow.' }, { k: 'field', label: 'Your message', value: 'Can you come at 10:00 in the morning?', type: 0 }, { k: 'button', t: 'Send', tap: 0 }, { k: 'chips', items: ['🎤 Hold to talk', '📞 Call', '🎥 Video'], b: 1 }],
      beats: ['Type your message in the box at the bottom, and tap Send.', 'Would you rather talk? Hold the microphone button to record a voice message. Let go to send it.', 'You can also make a call, or a video call, from the top of the conversation. You can turn calls off, or choose your times, in Settings.'] },
    { kind: 'list', h: 'Why talk **in Trothen**', items: [{ icon: 'lock', t: 'Your number stays **private**', sub: 'Messages and calls go through the app.' }, { icon: 'doc', t: 'What was agreed is **written down**', sub: 'If there is a disagreement, our team can see it.' }, { icon: 'shield', t: 'Scam words are watched', sub: 'Messages asking to pay outside Trothen are flagged.' }],
      beats: ['Why should you keep your talks in Trothen?', 'Your phone number stays private. Messages and calls go through the app.', 'What you agreed is written down. If there is a disagreement later, the Trothen team can see what was agreed, and help.', 'And Trothen watches for scams. A message asking you to pay outside Trothen is flagged to our team.'] },
    { kind: 'warn', h: 'Someone **rude**, or a scam?', lines: [{ t: 'Someone asks you to pay **outside** Trothen.' }, { t: 'Someone is rude, or threatens you.' }, { ok: true, icon: 'flag', t: 'Tap **Report** in the conversation. Our team looks at it.' }],
      beats: ['What if something is wrong?', 'If someone asks you to pay outside Trothen, by phone, transfer or cash,', 'or if someone is rude, or threatens you,', 'tap Report in the conversation. The Trothen team looks at it, and can close their account.'] },
    { kind: 'end', title: 'Keep talking **in Trothen**', sub: 'Stuck? Tap Help videos, or ask us in the support chat.', beats: ['That is all. Keep your talks in Trothen, and you are protected.'] },
  ],
};
