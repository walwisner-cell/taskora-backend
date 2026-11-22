// v178: what each help video shows, step by step, on the real screens.
// Each step is done for real (tap, type, choose). If a screen changes, the
// check (film.js --check) says which video and step to update here.
//
// group:    'public' videos are in "Help videos" for everyone (public/help/);
//           'admin' videos are only in Admin → Help videos (help-admin/), never public.
// as:       the demo person signed in (none = a visitor).
// audience: (public) 'all' or 'provider' (pros only).
// section:  (admin) the Admin menu item the video is about; an admin sees it only if they can open that part.
// topic:    (public) the group it is listed under on the Help videos page.
// Videos for people are recorded on a phone and on a laptop; Admin videos on a computer (film.js).
// v179: longer and more detailed: what each screen is for, every box, what happens next, and the safety points.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

// a demo photo for the steps that add one (an ID card, a product)
async function demoPhoto(name, color, label) {
  const f = path.join(os.tmpdir(), `trothen-film-${name}.png`);
  if (!fs.existsSync(f)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520"><rect width="800" height="520" rx="30" fill="${color}"/><text x="400" y="290" font-family="Arial" font-size="60" font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`;
    await require('sharp')(Buffer.from(svg)).png().toFile(f);
  }
  return f;
}
// Opening a part of your dashboard: on a phone, the menu at the bottom (or More);
// on a laptop, the menu on the left. Each video for people is recorded both ways.
async function open(d, key, label) {
  if (d.desk) { await d.tap(`.dash-nav-item[onclick*="Section('${key}')"]`, `Click ${label} in the menu on the left.`); return; }
  const tab = d.page.locator(`button.mtab-item[onclick="mtabGo('${key}')"]`).first();
  if (await tab.isVisible().catch(() => false)) { await d.tap(tab, `Tap ${(await tab.innerText()).trim()} at the bottom of the screen.`); return; }
  await d.tap('button.mtab-item:has-text("More")', 'Tap More at the bottom of the screen. It lists every part of your account.');
  await d.tap(`button.mtab-row[onclick="mtabGo('${key}')"]`, `Tap ${label}.`);
}

module.exports = [
  // ── for everyone ────────────────────────────────────────────────────
  {
    key: 'accounts', group: 'public', topic: 'Getting started', as: null, title: 'Create your account', tagline: 'Sign up in a few minutes, as a customer or as a pro',
    async steps(d) {
      await d.say('In this video, you will create your Trothen account, step by step. It takes about three minutes, and it is free.', 3000);
      await d.say('You need your phone number and an email address that you can open, because we send you a code to finish.', 3000);
      await d.tap('button.nav-cta:has-text("Sign In")', 'Tap Sign In, at the top of the screen.');
      await d.tap('#tab-signup', 'You do not have an account yet, so tap Sign Up.');
      await d.show('.auth-role-opt:has-text("Provider")', 'First, choose how you will use Trothen. Choose Provider if you will offer your own work, like cleaning, repairs, or driving.', 3600);
      await d.tap('.auth-role-opt:has-text("Customer")', 'Choose Customer if you want to hire pros, book rides, or buy in the Market. In this video, we choose Customer.');
      await d.type('#auth-name', 'Jordan Diaz', 'Type your full name, the way it is written on your ID. Later, when you verify your identity, the names must match.');
      await d.choose('#auth-country', 'Liberia', 'Choose your country. Prices, phone numbers and counties then follow your country.');
      await d.choose('#auth-state', { index: 11 }, 'Choose your county.');
      await d.type('#auth-phone', '0777 123 456', 'Type your phone number. Pros and drivers never see it: calls and messages go through the app.');
      await d.type('#auth-city', 'Monrovia', 'Type your city or town, so we show you pros near you.');
      await d.type('#auth-email', 'jordan.diaz@example.com', 'Type your email address. Make sure it is one you can open now.');
      await d.type('#auth-password', 'Monrovia-2026!', 'Choose a password of at least eight characters. Use letters, numbers and a sign, and do not use it anywhere else.');
      await d.show('#auth-submit-btn', 'Tap Create Account.', 2400);
      await d.say('We then email you a six-digit code. Type the code in, and your account is ready.', 3200);
      await d.say('Did not get the code? Check your spam folder, wait a minute, then ask for a new code.', 3200);
      await d.say('Already have an account? Tap Sign In instead, and type your email and password. That is all.', 3200);
    },
  },
  {
    key: 'verification', group: 'public', topic: 'Getting started', as: 'u_chioma', title: 'Verify your identity', tagline: 'Send your ID once, so people know you are who you say',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will verify your identity. Everyone on Trothen does this once, so customers, pros and drivers know who they are dealing with.', 3600);
      await d.say('You need your ID card, passport or driver\'s licence, and a phone camera. Find a place with good light.', 3200);
      await d.tap('button:has-text("Verify Now")', 'On your home screen, tap Verify Now.');
      await d.choose('#verification-doc-type-select', { index: 0 }, 'Choose the kind of document you have: a national ID card, a passport, or a driver\'s licence.');
      await d.type('#verification-legal-name-input', 'Chioma Kollie', 'Type your name exactly as it is printed on the document, with the same spelling.');
      await d.files('#verification-doc-file-input', '#verification-doc-file-input', await demoPhoto('id-front', '#1F5FBF', 'ID card (front)'), 'Take a photo of the front of your document. Lay it flat, fill the photo with it, and make sure every word can be read.');
      await d.files('#verification-back-file-input', '#verification-back-file-input', await demoPhoto('id-back', '#5B6B80', 'ID card (back)'), 'Then take a photo of the back. A passport has no back, so you can leave this one out.');
      await d.files('#verification-selfie-file-input', '#verification-selfie-file-input', await demoPhoto('selfie', '#2E8C6F', 'Your face'), 'Then take a photo of your face. Look straight at the camera, with no hat and no sunglasses.');
      await d.say('Before you send them, check the photos. A blurred photo, or one with light shining on it, is the most common reason we ask again.', 3400);
      await d.show('#verification-submit-btn', 'When everything is clear, tap Submit for Review.', 2600);
      await d.say('A person on our team checks it, usually within 48 hours. We tell you by email, and on your home screen.', 3200);
      await d.say('Your photos are kept private. Only the team that checks them can see them, and they are never shown to other people.', 3400);
    },
  },
  {
    key: 'services', group: 'public', topic: 'Customers', as: 'u_jordan', title: 'Post a job', tagline: 'Tell pros what you need, and get a clear price',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will post a job, so that pros near you can offer to do it. There are four short steps.', 3200);
      await d.tap('button:has-text("Post a New Job")', 'On your home screen, tap Post a New Job.');
      await d.say('Step one: what you need.', 1800);
      await d.type('#pj-cat-q', 'clean', 'Type the kind of work, for example cleaning, plumbing, or braids. The list below gets shorter as you type.');
      await d.tap('button.pj-cat:has-text("Cleaning")', 'Tap the kind of work that fits best. If nothing fits, choose Something else at the bottom of the list.');
      await d.type('#pj-desc', 'Deep clean of a 2-bedroom apartment in Sinkor, kitchen and bathroom included.', 'Describe the job: what needs doing, where in the house, and how big it is. The more you say, the better the prices you get.');
      await d.show('label.upload-box', 'You can also add photos or a short video. Pros understand the job much faster when they can see it.', 3000);
      await d.tap('label.pj-opt:has-text("The pro brings the materials")', 'Say who brings the materials: you, the pro, or choose Not sure, and the pro can advise you.');
      await d.tap('button.confirm-btn:has-text("Next")', 'Tap Next.');
      await d.say('Step two: when and where.', 1800);
      await d.tap('label.pj-opt:has-text("As soon as possible")', 'Choose when you need it: as soon as possible, on a date, or flexible, to agree a time with the pro.');
      await d.tap('#pj-pin-btn', 'Tap Pin my current location if you are at the job now. If not, tap Choose on a map, and put the pin on the place.');
      await d.type('#pj-landmark', 'Blue gate behind the Total station', 'Add a landmark or directions, so the pro finds the place easily.');
      await d.tap('button.confirm-btn:has-text("Next")', 'Tap Next.');
      await d.say('Step three: the price.', 1800);
      await d.show('label.pj-opt:has-text("Pros send me their prices")', 'Choose how to price it. We recommend this one: pros who can do it send you their price, and you choose.', 3400);
      await d.show('label.pj-opt:has-text("My price is")', 'Or set your own price, in Liberian dollars or US dollars. The first pro to accept at your price gets the job.', 3400);
      await d.tap('label.pj-opt:has-text("Pros send me their prices")', 'In this video, we let the pros send their prices.');
      await d.show('label.pw-opt:has-text("Protected by Trothen")', 'Then choose how you will pay. With Protected by Trothen, your money is held safely, and the pro is paid only when you say the job is done.', 3800);
      await d.tap('label.pw-opt:has-text("Protected by Trothen")', 'We choose Protected by Trothen.');
      await d.tap('button.confirm-btn:has-text("Next")', 'Tap Next.');
      await d.say('Step four: check everything.', 1800);
      await d.show('a[onclick="pjGoTo(0)"]', 'Read your job once more. To change anything, tap Change next to it.', 3000);
      await d.show('#pj-post', 'When it is right, tap Post my job.', 2400);
      await d.say('Pros near you are told about it, and they answer with their prices. You can read each pro\'s reviews, then choose one.', 3600);
      await d.say('Never pay a pro outside Trothen. If you do, we cannot protect your money.', 3000);
    },
  },
  {
    key: 'payments', group: 'public', topic: 'Customers', as: 'u_jordan', title: 'Add Mobile Money', tagline: 'How you pay, and why your money is safe',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will add Mobile Money, so you can pay for jobs, rides and goods on Trothen.', 3200);
      await open(d, 'payments', 'Payments');
      await d.say('This is your Payments page. Your ways to pay are at the top, and everything you have paid is listed below.', 3200);
      await d.tap('button:has-text("Add Payment Method")', 'Tap Add Payment Method.');
      await d.tap('#pm-tab-mobile_money', 'Choose Mobile Money. If you would rather pay with a bank card, choose Card instead.');
      await d.type('#pm-mobile-money-number', '0886 123 456', 'Type your Mobile Money number: the phone number your wallet is on.');
      await d.choose('#pm-mm-network', { index: 2 }, 'Choose your network: Orange Money or MTN Mobile Money.');
      await d.show('#pm-mm-owner', 'Say whose number it is. You can pay from a family member\'s or your company\'s wallet, if they agree.', 3200);
      await d.show('#pm-mm-name', 'Check the name the wallet is registered in. It helps if a payment ever needs to be traced.', 3000);
      await d.show('button:has-text("Save Payment Method")', 'Tap Save Payment Method.', 2400);
      await d.say('When you pay, you get a message on your phone to approve the payment with your Mobile Money PIN. Trothen never asks for your PIN.', 3800);
      await d.say('Your money is then held by Trothen. The pro is paid only when you confirm the job is done. If there is a problem, tap Report a Problem, and we step in.', 4000);
      await d.show('button:has-text("Download PDF")', 'At any time, you can download all your payments as a PDF, for your records.', 3000);
    },
  },
  {
    key: 'rides', group: 'public', topic: 'Rides', as: 'u_jordan', title: 'Book a ride', tagline: 'A motorbike, keke, car or van, with the fare in L$ before you book',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will book a ride: a motorbike, a keke, a car or a van. You see the fare before you book.', 3200);
      await open(d, 'rides', 'Rides');
      await d.say('First, say where the driver should pick you up.', 2200);
      await d.tap('#ridefrom-pin-btn', 'Tap Use my location. Your phone asks if Trothen may see where you are: tap Allow.');
      await d.type('#ridefrom-name', 'Broad Street, by the Total station', 'Give the place a name or a landmark that drivers know.');
      await d.type('#ridefrom-note', 'Blue gate, I am wearing a red shirt', 'You can add a note for the driver, like the colour of the gate, or what you are wearing.');
      await d.show('button[onclick="ridesSavePlace(\'ridefrom\')"]', 'Tap Save this place if you often leave from here. Next time, it is one tap.', 3000);
      await d.say('Then, say where you are going.', 2000);
      await d.run(() => { JOB_PIN.rideto = { latitude: 6.2860, longitude: -10.7650, source: 'map' }; renderJobPin('rideto'); });
      await d.type('#rideto-name', 'Sinkor 12th Street', 'Search for the place, or tap Choose on a map and put the pin where you are going.');
      await d.show('#ride-pax', 'Choose how many people are riding. A motorbike carries one passenger.', 2800);
      await d.tap('button:has-text("Find drivers near me")', 'Tap Find drivers near me.');
      await d.show('.ride-choose', 'Each ride shows its fare in Liberian dollars, and how far away the driver is. The fare is fixed before you book.', 3800);
      await d.say('Choose one and confirm. The driver is told at once, and you see them coming on the map.', 3200);
      await d.say('You can call or text the driver in the app. Neither of you sees the other\'s phone number.', 3200);
      await d.say('When the driver arrives, check the plate number. Give your four-digit PIN only if the plate matches. The trip starts then.', 3800);
      await d.say('At the end, the fare is paid, and you can rate your driver. If anything went wrong, tap Report a Problem on the trip.', 3600);
    },
  },
  {
    key: 'market', group: 'public', topic: 'Market', as: 'u_jordan', title: 'Find and buy in the Market', tagline: 'Search, check the details and buy with protection',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will find something in the Market, check it carefully, and buy it safely.', 3000);
      await open(d, 'market', 'Market');
      await d.say('The Market has goods from stores on Trothen, and things people sell themselves.', 2800);
      await d.type('#mk-q', '128gb', 'Type what you are looking for. You can search for details too, for example 128 gigabytes, or a brand.');
      await d.tap('button.btn-sm-primary:has-text("Search")', 'Tap Search.');
      await d.say('Each card shows the price, the condition, and the main details. Compare a few before you choose.', 3000);
      await d.tap('.mk-card[data-id="good_phone"]', 'Tap a good to see everything about it.');
      await d.say('Look at all the photos. They should show the real item, not a picture from the internet.', 3000);
      await d.scrollTo('#gp-specs');
      await d.show('#gp-specs', 'Read the details: storage, memory, network, warranty, and more. Make sure it is what you need.', 3600);
      await d.say('Not sure about something? Message the seller before you buy. Never send money outside Trothen.', 3200);
      await d.tap('#gp-add', 'When you are happy, tap Add to cart.');
      await d.say('Then pay from your cart. Your payment is held by Trothen until you have the goods in your hands.', 3400);
      await d.say('If the goods do not arrive, or are not as described, tap Report a Problem on the order, and we help you get your money back.', 3800);
    },
  },
  {
    key: 'cart', group: 'public', topic: 'Market', as: 'u_jordan', title: 'Your cart and checkout', tagline: 'One cart for every store, with the total before you pay',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will use your cart: add goods, check them, and pay for them, with the delivery.', 3200);
      await open(d, 'market', 'Market');
      await d.tap('.mk-card[data-id="good_cement"] .mk-cart-btn', 'Tap Add to cart on any good. You can add goods from different stores to the same cart.');
      await open(d, 'cart', 'Cart');
      await d.show('#cart-section-body', 'Here is everything in your cart, grouped by store, with the price of each good.', 3200);
      await d.say('Change the quantity if you need more than one. Or tap Save for later, to keep a good without buying it now.', 3400);
      await d.say('At checkout, choose how to get your goods: collect them from the store, or have a driver bring them.', 3200);
      await d.say('If a driver brings them, you see the delivery price before you pay. For heavy goods, like cement, only a vehicle that can carry them is offered.', 3800);
      await d.say('You see the full total, with every fee, before you pay. Nothing is added afterwards.', 3000);
      await d.say('When the driver arrives, check the goods, then give them your code. Only then is the store paid.', 3200);
    },
  },
  {
    key: 'sell', group: 'public', topic: 'Market', as: 'u_jordan', title: 'Sell an item', tagline: 'Put something on sale in the Market, safely',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will sell something of your own in the Market, safely.', 2800);
      await open(d, 'market', 'Market');
      await d.tap('button[data-mtab="sell"]', 'Tap Sell, at the top of the Market.');
      await d.tap('button:has-text("Sell an item")', 'Tap Sell an item.');
      await d.type('#mkf-title', 'Bosch drill, 650 W, with case', 'Give it a clear title: what it is, the brand, and the most important detail.');
      await d.choose('#mkf-cat', 'Tools & Equipment', 'Choose the category. The details buyers look for in that category then appear below.');
      await d.choose('#mkf-cond', 'like_new', 'Choose the condition honestly: new, like new, good, or used. Buyers can return goods that are not as described.');
      await d.type('#mkf-price', '45', 'Type your price. Look at similar items in the Market first, to choose a fair price.');
      await d.say('Fill in the details below, like the brand and the power. Listings with details sell faster.', 3000);
      await d.tap('#mkf-owns', 'Confirm that the item is yours to sell. Selling stolen goods is against the law, and the account is closed.');
      await d.show('#mkf-save', 'Add clear photos of the real item, from a few sides. Then tap Put it on sale.', 3200);
      await d.say('Some listings are checked by our team before they appear. That keeps the Market safe for everyone.', 3200);
      await d.say('Buyers pay through Trothen, so you are always paid. Never accept money outside the app.', 3000);
    },
  },
  {
    key: 'messages', group: 'public', topic: 'Customers', as: 'u_jordan', title: 'Messages and calls', tagline: 'Talk to a pro, a seller or a driver without sharing your number',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will send a message, a voice message, and make a call, all inside Trothen.', 3000);
      await open(d, 'messages', 'Messages');
      await d.say('Each conversation is with one pro, seller or driver. The newest are at the top.', 2800);
      await d.tap('button.chat-item:has-text("Marcus")', 'Tap a conversation to open it.');
      await d.type('#msg-input', 'Hello, can you come tomorrow at 10:00 in the morning?', 'Type your message in the box at the bottom.');
      await d.tap('button[onclick="sendRealMessage()"]', 'Tap Send.');
      await d.show('#msg-mic', 'Rather talk? Hold the microphone to record a voice message, then let go to send it.', 3200);
      await d.show('button[onclick^="startCall"]', 'You can also call, or make a video call, from the top of the conversation.', 3000);
      await d.say('Nobody sees your phone number. Keep your talks in Trothen: if there is a disagreement later, we can help, because we can see what was agreed.', 3800);
      await d.say('If someone is rude, or asks you to pay outside Trothen, report them from the conversation.', 3000);
    },
  },
  {
    key: 'privacy', group: 'public', topic: 'Getting started', as: 'u_jordan', title: 'Your account, settings and data', tagline: 'Your details, password, sounds, your data, or closing your account',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('In this video, you will look after your account: your details, your password, and your data.', 3000);
      await open(d, 'settings', 'Settings');
      await d.show('#set-cust-name', 'At the top are your details: your name, email, phone and address. Change any of them, then tap Save Changes.', 3400);
      await d.show('#set-cust-country', 'Moving? Change your country, county and city here, so we show you pros near you.', 3000);
      await d.show('#cust-pw-current', 'To change your password, type your current password, then your new password twice.', 3000);
      await d.show('button:has-text("Sign out of all devices")', 'Lost your phone, or think someone knows your password? Tap Sign out of all devices. Then sign in again on your own phone.', 3800);
      await d.show('#cs-calls', 'Choose whether people can call you in the app, and at what times.', 2800);
      await d.show('#cs-ring', 'Choose your ringtone and your message sound. Tap Play to hear them.', 2800);
      await d.show('#my-data-download-btn', 'Tap Download a copy of my data to get everything Trothen holds about you, in one file.', 3200);
      await d.show('button:has-text("Close my account")', 'And if you ever want to leave, you can close your account here. Your personal data is then removed.', 3400);
    },
  },
  // ── for pros ────────────────────────────────────────────────────────
  {
    key: 'stores', group: 'public', topic: 'Pros', audience: 'provider', as: 'u_james', title: 'Add a good to your store', tagline: 'Photos, price, details and sizes, the way buyers want them',
    start: () => selectProviderSection('overview'),
    async steps(d) {
      await d.say('In this video, you will add a good to your store, with everything buyers want to know.', 3000);
      await open(d, 'store', 'My Store');
      await d.say('This is your store. Your goods are listed here, with their stock and their orders.', 2800);
      await d.tap('button:has-text("+ Add a good")', 'Tap Add a good.');
      await d.type('#gf-name', 'Tecno Spark 20, 256 GB, Blue', 'Give it a clear name: what it is, the model, and the colour. Buyers search for these words.');
      await d.choose('#gf-currency', 'LRD', 'Choose the currency: Liberian dollars or US dollars.');
      await d.type('#gf-price', '26000', 'Type your price.');
      await d.files('#gf-add-photo', '#gf-file', await demoPhoto('spark', '#2E8C6F', 'Tecno Spark 20'), 'Add photos of the real good: up to four, on a plain background, in good light.');
      await d.choose('#gf-mcat', 'Phones & Tablets', 'Choose the Market category. The details for that kind of good then appear.');
      await d.choose('#gf-spec-storage', '256 GB', 'Fill in the details buyers look for. For a phone: the storage,');
      await d.choose('#gf-spec-sim', 'Dual SIM', 'the SIM,');
      await d.choose('#gf-spec-locked', 'Unlocked (any network)', 'and whether it works on any network.');
      await d.say('For clothes and shoes, you can add sizes and a size chart. For building materials, the size, the length or the bag weight.', 3600);
      await d.say('Be accurate. If a good is not as described, the buyer can return it, and you pay for the return.', 3200);
      await d.show('#gf-save', 'When everything is right, tap Save.', 2400);
      await d.say('A store manager checks every new good before buyers can see it, usually within a day. You are told when it is approved.', 3600);
    },
  },
  {
    key: 'deliveries', group: 'public', topic: 'Pros', audience: 'provider', as: 'u_james', title: 'Deliver for stores and the Market', tagline: 'Your vehicle, your range, and fares in L$',
    start: () => selectProviderSection('overview'),
    async steps(d) {
      await d.say('In this video, you will set yourself up to deliver goods for stores and the Market, and earn from each trip.', 3200);
      await open(d, 'deliveries', 'Deliveries');
      await d.choose('#dr-vehicle', 'motorbike', 'Choose what you deliver with: a motorbike, a keke, a car, a van, or a truck.');
      await d.show('#deliveries-body', 'For a motorbike, keke, car or van, Trothen\'s fares in Liberian dollars are used. You see examples of what you earn for each trip.', 3800);
      await d.type('#dr-max', '12', 'Choose the longest trip you will take, in kilometres.');
      await d.say('You are only offered deliveries your vehicle can carry. Heavy goods, like cement, go to vans and trucks.', 3200);
      await d.tap('button[onclick="saveDriverRates()"]', 'Tap Save.');
      await d.say('When a delivery is offered, you see where to collect it, where it is going, and what you earn. Accept it, or let it go.', 3600);
      await d.say('At the store, enter the pickup code and take a photo of the goods. At the door, check the buyer\'s code, and take another photo.', 3800);
      await d.say('You are paid as soon as the buyer has the goods. The photos protect you if anyone says something went wrong.', 3400);
    },
  },
  {
    key: 'business', group: 'public', topic: 'Pros', audience: 'provider', as: 'u_james', title: 'Business tools', tagline: 'Expenses, quotes and invoices for your work',
    start: () => selectProviderSection('overview'),
    async steps(d) {
      await d.say('In this video, you will use the business tools, to keep your records and send quotes and invoices.', 3200);
      await open(d, 'business', 'Business Tools');
      await d.tap('button[onclick="loadBusiness(\'expenses\')"]', 'Tap Expenses.');
      await d.show('button:has-text("+ Add an expense")', 'Add each thing you spend for your work, like materials or fuel, with a photo of the receipt.', 3400);
      await d.say('At the end of the month, you see what you earned, what you spent, and what is left. It helps with your taxes too.', 3400);
      await d.tap('button[onclick="loadBusiness(\'quotes\')"]', 'Tap Quotes and estimates.');
      await d.say('Write a quote for a customer: each part of the work, and its price. The customer sees it in their account.', 3400);
      await d.say('When the customer agrees, turn the quote into an invoice with one tap. The customer pays it through Trothen.', 3400);
      await d.say('Every quote and invoice can be downloaded as a PDF, with your name on it.', 2800);
    },
  },
  // ── for the team only (Admin → Help videos) ──────────────────────────
  {
    key: 'goods', group: 'admin', section: 'stores', as: 'u_superadmin', title: 'Check a good before it goes on sale', tagline: 'Stores & Skills: read everything, then approve or turn it down',
    async steps(d) {
      await d.say('In this video, you will check a new store good before buyers can see it.', 2800);
      await d.tap('.dash-nav-item:has-text("Stores & Skills")', 'Open Stores and Skills, in the menu on the left.');
      await d.say('New goods waiting for a check are listed here, oldest first. Nobody can buy a good until it is approved.', 3200);
      await d.show('img[onclick*="store_u_james_spark"]', 'Look at each photo. Click a photo to see it bigger. It must show the real good, not a picture taken from the internet.', 3600);
      await d.show('.admin-specs', 'Read the details. Do they make sense for this good, and for this price? A very low price can mean stolen or fake goods.', 3800);
      await d.say('Check the name and the description for banned goods, and for phone numbers or links that would take buyers outside Trothen.', 3600);
      await d.show('button[onclick*="good_spark"][onclick*="reject"]', 'If something is wrong, click Turn down, and write the reason. The seller sees it, and can fix the good.', 3600);
      await d.tap('button[onclick*="good_spark"][onclick*="approve"]', 'If all is right, click Approve. The good is then on sale.');
      await d.show('#store-fee-input', 'Lower down are the store settings: the fee per purchase, who pays it, and the banned words.', 3200);
    },
  },
  {
    key: 'listings', group: 'admin', section: 'market', as: 'u_superadmin', title: 'Check a held Market listing', tagline: 'Market → To check: approve it, or take it down',
    async steps(d) {
      await d.say('In this video, you will check a Market listing that the safety checks held back.', 2800);
      await d.tap('.dash-nav-item:has-text("Market")', 'Open Market, in the menu on the left.');
      await d.tap('button:has-text("To check")', 'Click To check. Listings held by the safety checks wait here.');
      await d.show(':text("Bosch drill, 650 W")', 'Read why it was held, then the description, the details and the photos.', 3400);
      await d.say('Common reasons: a banned word, a price far below normal, a phone number in the text, or a seller who was reported before.', 3800);
      await d.show('button[onclick*="ml_drill"][onclick*="remove"]', 'If it breaks the rules, click Take it down. The seller is told why.', 3000);
      await d.show('button[onclick*="adminMarketStop"]', 'If a seller breaks the rules again and again, click Stop this seller.', 3000);
      await d.tap('button[onclick*="ml_drill"][onclick*="restore"]', 'If the listing is fine, click Approve. It then appears in the Market.');
      await d.show('button[onclick="adminMarketTab(\'stolen\')"]', 'Stolen items holds reports of stolen goods. Check them often.', 2800);
    },
  },
  {
    key: 'approvals', group: 'admin', section: 'approvals', as: 'u_superadmin', title: 'Approve new people', tagline: 'User Approvals: check each new sign-up',
    async steps(d) {
      await d.say('In this video, you will approve, or reject, people who have just signed up.', 2800);
      await d.tap('.dash-nav-item:has-text("User Approvals")', 'Open User Approvals, in the menu on the left.');
      await d.say('Each new person is listed with their name, their country, and whether they signed up as a customer or a pro.', 3200);
      await d.say('Check that the name looks real, the phone number matches the country, and the same person has not signed up before.', 3600);
      await d.show('button[onclick*="u_chioma"][onclick*="reject"]', 'If it looks false, click Reject. The person is told, and cannot use Trothen.', 3000);
      await d.show('button[onclick*="u_chioma"][onclick*="approve"]', 'If all is right, click Approve. The person can then use Trothen.', 3000);
      await d.say('Approving someone here does not check their ID. Their ID is checked in the Verification Queue.', 3000);
    },
  },
  {
    key: 'systemcheck', group: 'admin', section: 'systemcheck', as: 'u_superadmin', title: 'System Check', tagline: 'Green, orange or red for each part of Trothen',
    async steps(d) {
      await d.say('In this video, you will check that every part of Trothen is working.', 2600);
      await d.tap('.dash-nav-item:has-text("System Check")', 'Open System Check, in the menu on the left.');
      await d.tap('button:has-text("Check now")', 'Click Check now. It takes a few seconds.');
      await d.say('Each part shows green, orange or red. Green is working. Orange needs attention soon. Red is not working now.', 3600);
      await d.say('Under each orange or red part, you see the likely cause, and what to do about it.', 3000);
      await d.say('Check it every morning, and whenever someone says something does not work.', 2800);
      await d.show('button:has-text("Copy report")', 'Click Copy report, and send it to whoever fixes it. It has everything they need.', 3000);
    },
  },
  {
    key: 'fares', group: 'admin', section: 'rides', as: 'u_superadmin', title: 'Ride and delivery fares', tagline: 'Admin → Rides: the L$ fares and the ride rules',
    async steps(d) {
      await d.say('In this video, you will set the ride rules, and the fares in Liberian dollars, for rides and deliveries.', 3000);
      await d.tap('.dash-nav-item:has-text("Rides")', 'Open Rides, in the menu on the left.');
      await d.show('#rs-max', 'At the top are the ride rules: the longest ride, how far away drivers are shown, and how long a driver has to answer.', 3600);
      await d.show('#rs-fee', 'Then Trothen\'s fee on top of the fare, and the driver\'s commission.', 3000);
      await d.show('#rs-docs', 'Here are the papers a driver must upload, for each country and each vehicle.', 3000);
      await d.show('#rs-night', 'You can stop motorbike rides at night, between the hours you choose.', 2800);
      await d.show('#rf-country', 'Lower down are the fares. Choose the country.', 2600);
      await d.show('input.rf-in', 'Each vehicle has a starting price, a price per kilometre, and a minimum fare.', 3000);
      await d.show('#rf-fcur', 'Type today\'s fuel price. Fares move with it, once the change passes the limit you set.', 3200);
      await d.say('Riders always see the fare before they book. A change applies only to new rides.', 3000);
    },
  },
];
