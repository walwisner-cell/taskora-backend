// v178: what each help video shows, step by step, on the real screens.
// Each step is done for real (tap, type, choose). If a screen changes, the
// check (film.js --check) says which video and step to update here.
//
// group:    'public' videos are in "Help videos" for everyone (public/help/);
//           'admin' videos are only in Admin → Help videos (help-admin/), never public.
// as:       the demo person signed in (none = a visitor).
// audience: (public) 'all' or 'provider' (pros only).
// section:  (admin) the Admin menu item the video is about; an admin sees it only if they can open that part.
// device:   'computer' for Admin; phones otherwise.
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
const more = async (d, item, text) => { await d.tap('button.mtab-item:has-text("More")', 'Tap More at the bottom.'); await d.tap(`button.mtab-row:has-text("${item}")`, text || `Tap ${item}.`); };

module.exports = [
  // ── for everyone ────────────────────────────────────────────────────
  {
    key: 'accounts', group: 'public', as: null, title: 'Create your account', tagline: 'Sign up in a minute, as a customer or as a pro',
    async steps(d) {
      await d.say('How to create your Trothen account.');
      await d.tap('button.nav-cta:has-text("Sign In")', 'Tap Sign In at the top.');
      await d.tap('#tab-signup', 'Tap Sign Up.');
      await d.tap('.auth-role-opt:has-text("Customer")', 'Choose Customer to book pros. Choose Provider to offer your own work.');
      await d.type('#auth-name', 'Jordan Diaz', 'Type your full name.');
      await d.choose('#auth-country', 'Liberia', 'Choose your country.');
      await d.choose('#auth-state', { index: 11 }, 'Choose your county.');
      await d.type('#auth-phone', '0777 123 456', 'Type your phone number.');
      await d.type('#auth-city', 'Monrovia', 'Type your city or town.');
      await d.type('#auth-email', 'jordan.diaz@example.com', 'Type your email.');
      await d.type('#auth-password', 'Monrovia-2026!', 'Choose a password of at least 8 characters.');
      await d.show('#auth-submit-btn', 'Tap Create Account. We email you a code: type it in to finish.', 3200);
      await d.say('Already have an account? Tap Sign In instead.', 2400);
    },
  },
  {
    key: 'verification', group: 'public', as: 'u_chioma', title: 'Verify your identity', tagline: 'Send your ID once, so people know you are who you say',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to verify your identity. You need it before you book or sell.');
      await d.tap('button:has-text("Verify Now")', 'Tap Verify Now.');
      await d.choose('#verification-doc-type-select', { index: 0 }, 'Choose your document: a national ID, a passport or a driver\'s licence.');
      await d.type('#verification-legal-name-input', 'Chioma Kollie', 'Type your name exactly as it is printed on the document.');
      await d.files('#verification-doc-file-input', '#verification-doc-file-input', await demoPhoto('id-front', '#1F5FBF', 'ID card (front)'), 'Take a clear photo of the front of your ID.');
      await d.files('#verification-back-file-input', '#verification-back-file-input', await demoPhoto('id-back', '#5B6B80', 'ID card (back)'), 'Then the back, if it has one.');
      await d.files('#verification-selfie-file-input', '#verification-selfie-file-input', await demoPhoto('selfie', '#2E8C6F', 'Your face'), 'Then a photo of your face, in good light.');
      await d.show('#verification-submit-btn', 'Tap Submit for Review. We usually check it within 48 hours and tell you by email.', 3200);
    },
  },
  {
    key: 'services', group: 'public', as: 'u_jordan', title: 'Post a job', tagline: 'Tell pros what you need, and get a clear price',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to post a job, so pros near you can offer to do it.');
      await d.tap('button:has-text("Post a New Job")', 'Tap Post a New Job.');
      await d.type('#pj-cat-q', 'clean', 'Type what you need, for example "cleaning".');
      await d.tap('button.pj-cat:has-text("Cleaning")', 'Tap the kind of work.');
      await d.type('#pj-desc', 'Deep clean of a 2-bedroom apartment in Sinkor, kitchen and bathroom included.', 'Describe the job: what needs doing and where.');
      await d.tap('label.pj-opt:has-text("The pro brings the materials")', 'Say who brings the materials.');
      await d.tap('button.confirm-btn:has-text("Next")', 'Tap Next.');
      await d.show('#pj-progress', 'Then choose when, where and your price, in L$ or US$, in the next steps.', 3200);
      await d.say('Pros near you see it and reply. Your payment is held by Trothen until the job is done.', 3200);
    },
  },
  {
    key: 'payments', group: 'public', as: 'u_jordan', title: 'Add Mobile Money', tagline: 'How you pay, and why your money is safe',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to add Mobile Money to pay on Trothen.');
      await d.tap('button.mtab-item:has-text("Payments")', 'Tap Payments at the bottom.');
      await d.tap('button:has-text("Add Payment Method")', 'Tap Add Payment Method.');
      await d.tap('#pm-tab-mobile_money', 'Choose Mobile Money (or Card).');
      await d.type('#pm-mobile-money-number', '0886 123 456', 'Type your Mobile Money number.');
      await d.choose('#pm-mm-network', { index: 2 }, 'Choose your network: Orange Money or MTN.');
      await d.show('button:has-text("Save Payment Method")', 'Tap Save Payment Method.', 2400);
      await d.say('When you pay, Trothen holds the money. The pro is paid only when you confirm the job is done.', 3400);
    },
  },
  {
    key: 'rides', group: 'public', as: 'u_jordan', title: 'Book a ride', tagline: 'A motorbike, keke, car or van, with the fare in L$ before you book',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to book a ride on Trothen.');
      await more(d, 'Rides');
      await d.tap('#ridefrom-pin-btn', 'Tap "Use my location" so the driver knows where you are.');
      await d.type('#ridefrom-name', 'Broad Street, by the Total station', 'Add a landmark, so the driver finds you easily.');
      await d.run(() => { JOB_PIN.rideto = { latitude: 6.2860, longitude: -10.7650, source: 'map' }; renderJobPin('rideto'); });
      await d.type('#rideto-name', 'Sinkor 12th Street', 'Type where you are going.');
      await d.tap('button:has-text("Find drivers near me")', 'Tap "Find drivers near me".');
      await d.show('.ride-choose', 'Choose a ride. Each shows the fare in L$ and how far away the driver is.', 3400);
      await d.say('After you book, you see the driver coming on the map. Give your 4-digit PIN only when the plate matches.', 3600);
    },
  },
  {
    key: 'market', group: 'public', as: 'u_jordan', title: 'Find and buy in the Market', tagline: 'Search, check the details and buy with protection',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to find and buy something in the Market.');
      await more(d, 'Market');
      await d.type('#mk-q', '128gb', 'Search for what you want, for example "128gb".');
      await d.tap('button.btn-sm-primary:has-text("Search")', 'Tap Search.');
      await d.tap('.mk-card[data-id="good_phone"]', 'Tap a good to see it.');
      await d.scrollTo('#gp-specs');
      await d.show('#gp-specs', 'Check the details: storage, network, warranty and more.', 3000);
      await d.tap('#gp-add', 'Tap Add to cart.');
      await d.say('Your payment is held until you have the goods.', 2600);
    },
  },
  {
    key: 'cart', group: 'public', as: 'u_jordan', title: 'Your cart and checkout', tagline: 'One cart for every store, with the total before you pay',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to use your cart.');
      await more(d, 'Market');
      await d.tap('.mk-card[data-id="good_cement"] .mk-cart-btn', 'Tap Add to cart on a good.');
      await more(d, 'Cart', 'Open your cart: tap More, then Cart (or the cart at the top).');
      await d.show('#cart-section-body', 'Check the goods and the quantities. You can save one for later.', 3000);
      await d.say('At checkout, choose to collect it or a driver who can carry it. You see the total before you pay.', 3600);
    },
  },
  {
    key: 'sell', group: 'public', as: 'u_jordan', title: 'Sell an item', tagline: 'Put something on sale in the Market, safely',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to sell something in the Market.');
      await more(d, 'Market');
      await d.tap('button[data-mtab="sell"]', 'Tap Sell.');
      await d.tap('button:has-text("Sell an item")', 'Tap Sell an item.');
      await d.type('#mkf-title', 'Bosch drill, 650 W, with case', 'Give it a clear title.');
      await d.choose('#mkf-cat', 'Tools & Equipment', 'Choose the category. The details buyers look for appear.');
      await d.choose('#mkf-cond', 'like_new', 'Choose the condition.');
      await d.type('#mkf-price', '45', 'Type your price.');
      await d.tap('#mkf-owns', 'Confirm that it is yours to sell.');
      await d.show('#mkf-save', 'Add photos, then tap Put it on sale. Buyers pay through Trothen, so you are always paid.', 3400);
    },
  },
  {
    key: 'messages', group: 'public', as: 'u_jordan', title: 'Messages and calls', tagline: 'Talk to a pro, a seller or a driver without sharing your number',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to message or call someone on Trothen.');
      await d.tap('button.mtab-item:has-text("Messages")', 'Tap Messages at the bottom.');
      await d.tap('button.chat-item:has-text("Marcus")', 'Tap a conversation.');
      await d.type('#msg-input', 'Hello, can you come at 10am tomorrow?', 'Type your message.');
      await d.tap('button[onclick="sendRealMessage()"]', 'Tap Send.');
      await d.show('#msg-mic', 'Or tap the microphone to send a voice message.', 2600);
      await d.show('button[onclick^="startCall"]', 'Call or video call in the app. Nobody sees your phone number.', 3000);
    },
  },
  {
    key: 'privacy', group: 'public', as: 'u_jordan', title: 'Your data and your account', tagline: 'Download your data, sign out everywhere, or close your account',
    start: () => goToCustomerDashboard('overview'),
    async steps(d) {
      await d.say('How to look after your account and your data.');
      await more(d, 'Settings');
      await d.show('button:has-text("Sign out of all devices")', 'Lost your phone? Tap "Sign out of all devices".', 2800);
      await d.show('#my-data-download-btn', 'Download a copy of everything Trothen holds about you, in one file.', 3000);
      await d.show('button:has-text("Close my account")', 'You can also close your account here. Your data is then removed.', 3000);
    },
  },
  // ── for pros ────────────────────────────────────────────────────────
  {
    key: 'stores', group: 'public', audience: 'provider', as: 'u_james', title: 'Add a good to your store', tagline: 'Photos, price, details and sizes, the way buyers want them',
    start: () => selectProviderSection('overview'),
    async steps(d) {
      await d.say('How to add a good to your store.');
      await more(d, 'My Store');
      await d.tap('button:has-text("+ Add a good")', 'Tap + Add a good.');
      await d.type('#gf-name', 'Tecno Spark 20, 256 GB, Blue', 'Give it a clear name: what it is, the model, the colour.');
      await d.choose('#gf-currency', 'LRD', 'Choose L$ or US$.');
      await d.type('#gf-price', '26000', 'Type the price.');
      await d.files('#gf-add-photo', '#gf-file', await demoPhoto('spark', '#2E8C6F', 'Tecno Spark 20'), 'Take or choose a photo. Up to four.');
      await d.choose('#gf-mcat', 'Phones & Tablets', 'Choose the Market category.');
      await d.choose('#gf-spec-storage', '256 GB', 'Fill in the details buyers look for, like storage,');
      await d.choose('#gf-spec-sim', 'Dual SIM', 'the SIM,');
      await d.choose('#gf-spec-locked', 'Unlocked (any network)', 'and whether it is unlocked.');
      await d.show('#gf-save', 'Tap Save. A store manager checks it before buyers see it.', 3200);
    },
  },
  {
    key: 'deliveries', group: 'public', audience: 'provider', as: 'u_james', title: 'Deliver for stores and the Market', tagline: 'Your vehicle, your range, and fares in L$',
    start: () => selectProviderSection('overview'),
    async steps(d) {
      await d.say('How to get delivery jobs as a driver.');
      await more(d, 'Deliveries');
      await d.choose('#dr-vehicle', 'motorbike', 'Choose what you deliver with.');
      await d.show('#deliveries-body', 'For a motorbike, keke, car or van, Trothen\'s L$ fares are used, with examples.', 3400);
      await d.type('#dr-max', '12', 'Choose the longest trip you will take.');
      await d.tap('button[onclick="saveDriverRates()"]', 'Tap Save. You are offered deliveries your vehicle can carry.');
      await d.say('At the store and at the door, enter the code and take a photo. You are paid when the buyer has it.', 3400);
    },
  },
  {
    key: 'business', group: 'public', audience: 'provider', as: 'u_james', title: 'Business tools', tagline: 'Expenses, quotes and invoices for your work',
    start: () => selectProviderSection('overview'),
    async steps(d) {
      await d.say('How to keep your business records on Trothen.');
      await more(d, 'Business Tools');
      await d.tap('button[onclick="loadBusiness(\'expenses\')"]', 'Tap Expenses.');
      await d.show('button:has-text("+ Add an expense")', 'Add each expense with a photo of the receipt.', 2800);
      await d.tap('button[onclick="loadBusiness(\'quotes\')"]', 'Tap Quotes & estimates.');
      await d.say('Write a quote for a customer. When they agree, turn it into an invoice with one tap.', 3400);
    },
  },
  // ── for the team only (Admin → Help videos) ──────────────────────────
  {
    key: 'goods', group: 'admin', section: 'stores', device: 'computer', as: 'u_superadmin', title: 'Check a good before it goes on sale', tagline: 'Stores & Skills: read everything, then approve or turn it down',
    async steps(d) {
      await d.say('How to check a good before buyers can see it.');
      await d.tap('.dash-nav-item:has-text("Stores & Skills")', 'Open Stores & Skills.');
      await d.show('img[onclick*="store_u_james_spark"]', 'Look at the photos: they must show the real good.', 2800);
      await d.show('.admin-specs', 'Read the details. Do they make sense for this good and this price?', 3200);
      await d.tap('button[onclick*="good_spark"][onclick*="approve"]', 'If all is right, tap Approve. If not, Turn down with a reason.');
    },
  },
  {
    key: 'listings', group: 'admin', section: 'market', device: 'computer', as: 'u_superadmin', title: 'Check a held Market listing', tagline: 'Market → To check: approve it, or take it down',
    async steps(d) {
      await d.say('How to check a Market listing held by the safety checks.');
      await d.tap('.dash-nav-item:has-text("Market")', 'Open Market.');
      await d.tap('button:has-text("To check")', 'Tap To check.');
      await d.show(':text("Bosch drill, 650 W")', 'Read why it was held, the description and the details.', 3400);
      await d.tap('button[onclick*="ml_drill"][onclick*="restore"]', 'Tap Approve, or Take it down. A seller who breaks the rules can be stopped.');
    },
  },
  {
    key: 'approvals', group: 'admin', section: 'approvals', device: 'computer', as: 'u_superadmin', title: 'Approve new people', tagline: 'User Approvals: check each new sign-up',
    async steps(d) {
      await d.say('How to approve people who signed up.');
      await d.tap('.dash-nav-item:has-text("User Approvals")', 'Open User Approvals.');
      await d.show('button[onclick*="u_chioma"][onclick*="approve"]', 'Check the person, then Approve or Reject.', 3200);
    },
  },
  {
    key: 'systemcheck', group: 'admin', section: 'systemcheck', device: 'computer', as: 'u_superadmin', title: 'System Check', tagline: 'Green, orange or red for each part of Trothen',
    async steps(d) {
      await d.say('How to check that Trothen is working.');
      await d.tap('.dash-nav-item:has-text("System Check")', 'Open System Check.');
      await d.tap('button:has-text("Check now")', 'Tap Check now.');
      await d.say('Each part shows green, orange or red, with the likely cause and what to do.', 3400);
      await d.show('button:has-text("Copy report")', 'Tap Copy report to send it to whoever fixes it.', 2600);
    },
  },
  {
    key: 'fares', group: 'admin', section: 'rides', device: 'computer', as: 'u_superadmin', title: 'Ride and delivery fares', tagline: 'Admin → Rides: the L$ fares for each vehicle',
    async steps(d) {
      await d.say('How to set the L$ fares for rides and deliveries.');
      await d.tap('.dash-nav-item:has-text("Rides")', 'Open Rides.');
      await d.show('#rf-country', 'Choose the country. Each vehicle has a starting price, a price per km and a minimum.', 3600);
      await d.show('#rf-fcur', 'Type today\'s fuel price: fares move with it once the change passes your limit.', 3400);
    },
  },
];
