// Animated explainer: receipts and records (everyone).
module.exports = {
  key: 'receipts', title: 'Receipts and records', tagline: 'A receipt for every payment, refund and payout', topic: 'Getting started', audience: 'all',
  scenes: [
    { kind: 'title', icon: 'receipt', title: 'Receipts and **records**', sub: 'A receipt for every payment, refund and payout.',
      beats: ['This video explains the receipts Trothen sends you, and where to find all your records.'] },
    { kind: 'list', h: 'A receipt for **every** money movement', items: [{ icon: 'wallet', t: 'Every **payment** you make', sub: 'a job, a ride, an order, a stay, extra work or a tip.' }, { icon: 'money', t: 'A **cash** job or ride', sub: 'when it is completed.' }, { icon: 'refresh', t: 'Every **refund**', sub: 'in full, or part of it.' }, { icon: 'coin', t: 'For pros: **tokens** and **payouts**', sub: 'with the commission and tips shown.' }],
      beats: ['Trothen sends a receipt for every money movement.', 'Every payment you make: a job, a ride, an order, a place to stay, extra work, or a tip.', 'A cash job or a cash ride, when it is completed.', 'Every refund, in full or in part.', 'And for pros: every token purchase, and every payout, showing the jobs, Trothen\'s commission, the tips, and what you received.'] },
    { kind: 'flow', h: 'How it **reaches you**', nodes: [{ icon: 'bolt', t: 'The moment it happens', sub: 'no waiting' }, { icon: 'doc', t: 'By **email**', sub: 'with the PDF attached', tone: 'gold' }, { icon: 'phone', t: 'Or by **text**', sub: 'if you have no email' }], foot: 'Receipts come even if you turned off update emails: a receipt is a **record**.', footAt: 3,
      beats: ['How does it reach you?', 'The moment the money moves.', 'By email, with a short summary, and the receipt as a PDF attached.', 'Or, if you have no email, a short text message with the amount and a link, where text messages are set up.', 'Receipts come even if you turned off update emails, because a receipt is a record, not a notification.'] },
    { kind: 'phone', n: '1', h: 'All your **receipts** in one place', points: [{ b: 0, icon: 'user', t: 'Account, then **Receipts**' }, { b: 1, icon: 'search', t: 'Every receipt, newest first' }, { b: 2, icon: 'doc', t: 'Download any one **again**' }],
      rows: [{ k: 'head', t: 'Receipts' }, { k: 'card', icon: 'wallet', t: 'Payment · Fix a leaking pipe', sub: '12 November', right: 'L$ 2,500', b: 1 }, { k: 'card', icon: 'refresh', t: 'Refund · Order #2041', sub: '9 November', right: 'L$ 900', b: 1 }, { k: 'button', t: 'Download PDF', ghost: true, b: 2, tap: 2 }],
      beats: ['All your receipts are kept in the app. Open your account menu, then Receipts.', 'Every receipt is listed, newest first.', 'Tap one to download it again, as a PDF.'] },
    { kind: 'list', h: 'What a receipt **shows**', items: [{ icon: 'calendar', t: 'The date, and a receipt number' }, { icon: 'receipt', t: 'What it was for, and every amount' }, { icon: 'map', t: 'For rides and deliveries: a small **map** of the place' }],
      beats: ['What does a receipt show?', 'The date, and a receipt number.', 'What it was for, and every amount: the price, any fees, and the total.', 'And for rides and deliveries, a small map with the exact place.'] },
    { kind: 'end', title: 'Keep your **records**', sub: 'Stuck? Tap Help videos, or ask us in the support chat.', beats: ['Keep your receipts for your records, and for your taxes. You can always download them again.'] },
  ],
};
