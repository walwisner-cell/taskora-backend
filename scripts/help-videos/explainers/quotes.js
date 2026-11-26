// Animated explainer: quotes and invoices from a pro (customers).
module.exports = {
  key: 'quotes', title: 'Quotes and invoices from a pro', tagline: 'Read a price in writing, accept it, and book', topic: 'Customers', audience: 'all',
  scenes: [
    { kind: 'title', icon: 'doc', title: 'Quotes and **invoices** from a pro', sub: 'Read a price in writing, accept it, and book.',
      beats: ['Sometimes a pro sends you a written price before the work, or a bill after it. This video shows where to find them, and what they mean.'] },
    { kind: 'table', h: 'Three **kinds**', head: ['Kind', 'What it means'], rows: [{ c: ['Quote', 'A fixed price for the work, before it starts'] }, { c: ['Estimate', 'A likely price. It may change once the pro has seen the work'] }, { c: ['Invoice', 'A bill for work'] }],
      beats: ['There are three kinds.', 'A quote: a fixed price for the work, before it starts.', 'An estimate: a likely price. The final price may change once the pro has seen the work.', 'An invoice: a bill for work.'] },
    { kind: 'phone', n: '1', h: 'Open **Quotes & Invoices**', points: [{ b: 0, icon: 'doc', t: 'Everything your pros sent you' }, { b: 1, icon: 'eye', t: 'Each part, and its price' }, { b: 2, icon: 'check', t: '**Accept** or **Decline**' }],
      rows: [{ k: 'head', t: 'Quotes & Invoices' }, { k: 'card', icon: 'doc', t: 'Quote from Marcus T.', sub: 'Waiting for your answer', on: true }, { k: 'price', b: 1, lines: [['New sink pipe and fittings', 'L$ 1,800'], ['Labour', 'L$ 2,000']], total: ['Total', 'L$ 3,800'] }, { k: 'button', t: 'Accept', b: 2, tap: 2 }, { k: 'button', t: 'Decline', ghost: true, b: 2 }],
      beats: ['Open Quotes and Invoices. It lists everything your pros sent you, with what needs your answer at the top.', 'Tap one to read it: each part of the work, and its price.', 'Then tap Accept, or Decline. The pro is told either way.'] },
    { kind: 'flow', h: 'Accepting is **not paying**', nodes: [{ icon: 'check', t: 'You accept', sub: 'a yes, in writing' }, { icon: 'lock', t: 'The price is fixed', sub: 'the pro cannot change it', tone: 'gold' }, { icon: 'calendar', t: 'Tap **Book this pro**', sub: 'then pay, held by Trothen' }], foot: 'No money is taken when you accept. Only money paid through a **Trothen booking** is held and protected.', footAt: 3,
      beats: ['Accepting is not paying.', 'When you accept, you say yes to the price, in writing.', 'The price is then fixed. The pro can no longer change it.', 'To go ahead, tap Book this pro, and pay. Trothen holds the money until the work is done.', 'No money is taken when you accept. Only money paid through a Trothen booking is held and protected.'] },
    { kind: 'warn', h: 'An **invoice** for work outside Trothen', lines: [{ t: 'If an invoice is for work arranged **outside** a Trothen booking, Trothen does **not** hold or protect that payment.' }, { ok: true, icon: 'shield', t: 'To be protected, book the work **through Trothen**.' }],
      beats: ['One warning about invoices.', 'If an invoice is for work arranged outside a Trothen booking, Trothen does not hold or protect that payment. The app tells you so on the invoice.', 'To be protected, book the work through Trothen.'] },
    { kind: 'end', title: 'Prices in **writing**', sub: 'Download any quote or invoice as a PDF.', beats: ['Every quote and invoice can be downloaded as a PDF, for your records. That is all.'] },
  ],
};
