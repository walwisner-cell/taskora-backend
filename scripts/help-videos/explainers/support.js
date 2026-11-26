// Animated explainer: getting help (everyone).
module.exports = {
  key: 'support', title: 'Get help', tagline: 'Help videos, the assistant, and our team', topic: 'Getting started', audience: 'all',
  scenes: [
    { kind: 'title', icon: 'chat', title: 'Get **help**', sub: 'Help videos, the assistant, and our team.',
      beats: ['Stuck, or something went wrong? This video shows every way to get help on Trothen.'] },
    { kind: 'list', h: 'Four ways to get **help**', items: [{ icon: 'eye', t: '**Help videos**', sub: 'Like this one, for each part of Trothen.' }, { icon: 'chat', t: 'The **Trothen Assistant**', sub: 'Answers questions at any time. It is a computer, not a person.' }, { icon: 'users', t: '**Our team**', sub: 'Chat, call or WhatsApp, from the support chat.' }, { icon: 'flag', t: '**Report a Problem**', sub: 'On a booking, an order or a trip.' }],
      beats: ['There are four ways to get help.', 'Help videos, like this one, for each part of Trothen. Find them in the menu, or tap Watch how it works where you are stuck.', 'The Trothen Assistant, in the support chat. It answers questions at any time of day. It is a computer, not a person.', 'Our team. From the support chat, tap Contact our team, to chat, call, or send a WhatsApp message.', 'And Report a Problem, on a booking, an order or a trip, when something has gone wrong with money or work.'] },
    { kind: 'phone', n: '1', h: 'Open the **support chat**', points: [{ b: 0, icon: 'chat', t: 'The chat button, bottom corner' }, { b: 1, icon: 'doc', t: 'Ask in your own words' }, { b: 2, icon: 'users', t: '**Contact our team instead**' }],
      rows: [{ k: 'head', t: 'Trothen Assistant' }, { k: 'note', icon: 'chat', t: 'AI · NOT A PERSON. Ask about escrow, verification, disputes and more.' }, { k: 'field', label: 'Your question', value: 'How do I get my money back?', type: 1, b: 1 }, { k: 'button', t: 'Contact our team instead', ghost: true, b: 2, tap: 2 }],
      beats: ['Tap the chat button in the corner of the screen.', 'Ask your question in your own words, for example: how do I get my money back?', 'If you would rather talk to a person, tap Contact our team instead.'] },
    { kind: 'warn', h: 'Watch out for **fakes**', lines: [{ t: 'Trothen staff **never** ask for your password, your PIN, or your sign-in code.' }, { t: 'Trothen never asks you to send money to a person\'s number.' }, { ok: true, icon: 'shield', t: 'Only trust help that comes **inside the Trothen app**, or from the numbers it shows.' }],
      beats: ['Watch out for fake helpers.', 'Trothen staff never ask for your password, your Mobile Money PIN, or your sign-in code.', 'Trothen never asks you to send money to a person\'s number.', 'Only trust help that comes inside the Trothen app, or from the numbers it shows you.'] },
    { kind: 'end', title: 'We are here to **help**', sub: 'Tap Help videos, or ask us in the support chat.', beats: ['That is all. Whatever happens, help is one tap away.'] },
  ],
};
