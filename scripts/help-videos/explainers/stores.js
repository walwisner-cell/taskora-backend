// Animated explainer: Add a good to your store.
module.exports = {
  key: 'stores', title: 'Add a good to your store',
  scenes: [
    { kind: 'title', icon: 'store', title: 'Add a good to your **store**', sub: 'Photos, price, details and sizes, the way buyers want them.', needTitle: 'Before you start', need: [{ icon: 'camera', t: 'Photos of the real good' }, { icon: 'tag', t: 'Its price and details' }],
      beats: ['This video shows how to add a good to your store on Trothen, with everything buyers want to know.', 'Have the good in front of you, with good light for the photos, and know its price and its details.'] },
    { kind: 'phone', n: '1', h: 'Open **My Store**', points: [{ b: 0, icon: 'store', t: 'Your goods, stock and orders' }, { b: 1, icon: 'plus', t: 'Tap **Add a good**' }, { b: 2, icon: 'doc', t: 'A clear **name**: what, model, colour' }],
      rows: [{ k: 'head', t: 'My Store' }, { k: 'card', icon: 'phone', t: 'Tecno Spark 10', sub: 'In stock: 4 · 2 orders' }, { k: 'button', t: '+ Add a good', b: 1, tap: 1 }, { k: 'field', label: 'Name', value: 'Tecno Spark 20, 256 GB, Blue', type: 2, b: 2 }],
      beats: ['Open My Store. On a phone, tap More at the bottom of the screen, then My Store. Your goods are listed here, with their stock and their orders.', 'Tap Add a good.', 'Give it a clear name: what it is, the model, and the colour. Buyers search for these words.'] },
    { kind: 'phone', n: '2', h: 'Price and **photos**', points: [{ b: 0, icon: 'money', t: 'Liberian dollars or US dollars' }, { b: 1, icon: 'photo', t: 'Up to **4 photos** of the real good' }, { b: 2, icon: 'eye', t: 'Plain background, good light' }],
      rows: [{ k: 'chips', items: ['L$', 'US$'], on: 0 }, { k: 'field', label: 'Price', value: 'L$ 26,000', type: 0 }, { k: 'photos', n: 3, b: 1 }, { k: 'note', icon: 'photo', t: 'Photos of the real good sell best.', b: 2 }],
      beats: ['Choose the currency, Liberian dollars or US dollars, and type your price.', 'Add photos of the real good, up to four.', 'Use a plain background, like a white wall or a table, and good daylight. Show the front, the back, and any marks.'] },
    { kind: 'phone', n: '3', h: 'The **details** buyers look for', points: [{ b: 0, icon: 'search', t: 'Choose the **Market category**' }, { b: 1, icon: 'phone', t: 'Phones: storage, SIM, network' }, { b: 2, icon: 'tag', t: 'Clothes: sizes. Cement: bag weight' }],
      rows: [{ k: 'field', label: 'Market category', value: 'Phones & Tablets' }, { k: 'field', label: 'Storage', value: '256 GB', b: 1 }, { k: 'field', label: 'SIM', value: 'Dual SIM', b: 1 }, { k: 'field', label: 'Network', value: 'Unlocked (any network)', b: 1 }],
      beats: ['Choose the Market category. The details for that kind of good then appear.', 'Fill in the details buyers look for. For a phone: the storage, the SIM, and whether it works on any network.', 'For clothes and shoes, you can add sizes and a size chart. For building materials, the size, the length, or the bag weight.'] },
    { kind: 'flow', h: 'Then it is **checked**', nodes: [{ icon: 'check', t: 'You tap Save', sub: 'when everything is right' }, { icon: 'eye', t: 'A store manager checks', sub: 'usually within a day', tone: 'gold' }, { icon: 'store', t: 'Buyers see it', sub: 'you are told' }], foot: 'Be accurate: faulty, wrong or not-as-described goods can always be **returned** within your return days.', footAt: 3,
      beats: ['When everything is right, tap Save.', 'A store manager checks every new good before buyers can see it, usually within a day.', 'You are told when it is approved, and buyers can see it in the Market.', 'Be accurate. Faulty, wrong or not-as-described goods can always be returned within your return days, and the buyer is refunded.'] },
    { kind: 'end', title: 'Your good is **on sale**', sub: 'Stuck? Tap Help videos, or ask us in the support chat.', beats: ['That is all. Keep your stock up to date, so buyers never order something you do not have.'] },
  ],
};
