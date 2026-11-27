// v185: the detailed Admin videos, part 2: every other part of Admin.
// Each is recorded on the real screens with demo cases (scripts/help-videos/demo.js),
// in chapters, and says the same things as its manual (help-admin/manuals/).
'use strict';
const open = (d, label) => d.tap(`.dash-nav-item:has-text("${label}")`, `Open ${label}, in the menu on the left.`);
const manual = (d) => d.show('[data-admin-manual]', 'Everything in this video is in the Manual, with more detail. Click Manual on this page to read it.', 3200);

module.exports = [
  {
    key: 'overview', group: 'admin', section: 'overview', as: 'u_superadmin', title: 'Your first day in Admin', tagline: 'Your account, finding your way, the Overview, and the daily routine',
    async steps(d) {
      await d.chapter('Welcome to Admin');
      await d.say('Admin is where the Trothen team keeps the platform safe, fair and working.', 3000);
      await d.say('Everything you see here is confidential: people\'s details, money, IDs and disputes. It never leaves Trothen.', 3600);
      await d.chapter('Your account');
      await d.say('Sign in with your own account, and never share it. Everything you do is recorded under your name.', 3400);
      await d.say('A six-digit code is needed every time you sign in. And Admin signs you out after five minutes with no activity.', 3600);
      await d.say('You see only the parts of Admin your job needs. If you need another part, ask a super admin.', 3200);
      await d.chapter('Finding your way');
      await d.show('#admin-nav', 'The menu on the left lists the parts of Admin you can open.', 3000);
      await d.show('[data-admin-help-chip]', 'Under each heading, Watch how it works plays a video on that page.', 3200);
      await d.show('[data-admin-manual]', 'And Manual opens the step-by-step guide for the page. It can be read here, but not downloaded, printed or copied.', 3800);
      await d.chapter('The Overview page');
      await d.show(':text("Pending Approvals")', 'The four numbers: users, sign-ups waiting, open disputes, and the value booked.', 3400);
      await d.show(':text("Open Disputes") >> nth=0', 'Open disputes hold real money. They come first.', 3000);
      await d.show('th:has-text("Covers")', 'Super admins see each city, its regional admin, and what they cover.', 3200);
      await d.chapter('Every day');
      await d.say('Open the Overview. Do the work of your role, oldest first. Check your notifications for anything urgent.', 3800);
      await d.say('Before you leave, make sure nothing urgent is half done, and sign out.', 3000);
      await manual(d);
    },
  },
  {
    key: 'people', group: 'admin', section: 'people', as: 'u_superadmin', title: 'Customers & Providers: look up and act on an account', tagline: 'Contact details, holds, suspensions, passwords, commission rates and VIP',
    async steps(d) {
      await d.chapter('What this page is for');
      await d.say('Customers and Providers is the directory of everyone on Trothen. Look someone up here before you decide anything about them.', 3800);
      await d.say('Everything here is personal. Look only at the people your work needs.', 3000);
      await open(d, 'Customers & Providers');
      await d.chapter('The directory');
      await d.show('th:has-text("Contact")', 'Emails are masked. The full details are shown only when you need them.', 3200);
      await d.show('th:has-text("Verified")', 'Verified means their ID has been approved.', 2800);
      await d.show('th:has-text("Status")', 'Status is Active, On hold, or Suspended.', 2800);
      await d.chapter('A person\'s details');
      await d.tap('#admin-people-table-wrap button:has-text("View") >> nth=0', 'Click View to open a person.');
      await d.show('button:has-text("Reveal Contact Info")', 'Reveal Contact Info shows the full email, phone and address. Every click is written in the Access Logs.', 3800);
      await d.show('button:has-text("Place on Hold")', 'A hold pauses new bookings and payouts, while you look into a real risk. Release it as soon as you have decided.', 4000);
      await d.show('button:has-text("Suspend Account")', 'Suspend stops the account altogether. If they have bookings in progress, every super admin is told.', 3800);
      await d.run(() => { const o = document.getElementById('person-detail-overlay'); if (o) o.remove(); });
      await d.chapter('Passwords, rates and VIP');
      await d.show('#admin-people-table-wrap button:has-text("Reset password") >> nth=0', 'Super admins can reset a password. First confirm it is really them, by calling the number on their account.', 3800);
      await d.say('The one-time password is shown once. Give it to them directly, never in a message others can read.', 3400);
      await d.say('A custom commission rate is proposed by an admin, and approved by a super admin. Nobody can set one alone.', 3600);
      await d.say('VIP can\'t be bought. Only a super admin grants it, to a customer.', 3000);
      await d.chapter('Accounts closed by their owners');
      await d.show(':text("Accounts closed by their owners")', 'People who closed their account are listed here. Reopen it, or erase their details for good.', 3600);
      await d.say('Before erasing, check there is no open dispute, no payout waiting, and nothing owed. Erasing can\'t be undone.', 3600);
      await manual(d);
    },
  },
  {
    key: 'goods', group: 'admin', section: 'stores', as: 'u_superadmin', title: 'Stores & Skills: check goods, stores, returns and licensed trades', tagline: 'Approve only what is genuine, legal, and shown in the photos',
    async steps(d) {
      await d.chapter('What this page is for');
      await d.say('Pros can open a store, and offer extra skills. Before customers see them, a person on the team checks them here.', 3600);
      await open(d, 'Stores & Skills');
      await d.chapter('Check a good');
      await d.show('img[onclick*="store_u_james_spark"]', 'Look at each photo. Click it to see it bigger. It must show the real good, not a picture from the internet.', 3800);
      await d.show('.admin-specs', 'Read the details. Do they make sense for this good, and this price? A price far below normal can mean stolen or fake goods.', 4000);
      await d.say('Check the name and description for banned goods, phone numbers, or links that take buyers outside Trothen.', 3600);
      await d.say('Never allowed: weapons, drugs, medicines, alcohol, tobacco, counterfeit goods, and protected wildlife.', 3600);
      await d.show('button[onclick*="good_spark"][onclick*="reject"]', 'If something is wrong, Turn down, with a reason the seller can act on.', 3200);
      await d.tap('button[onclick*="good_spark"][onclick*="approve"]', 'If all is right, click Approve. The good is then on sale.');
      await d.chapter('Stores, skills and returns');
      await d.show(':text("Stores waiting for approval")', 'A new store is hidden until approved. Approve it if its name and products are genuine and lawful.', 3600);
      await d.show(':text("Extra skills waiting to be checked")', 'Extra skills are licensed trades. Approve one only if you have seen a licence for that trade.', 3600);
      await d.show(':text("Store returns")', 'Returns the seller and buyer couldn\'t settle wait here. Refund the buyer, or refuse, with a note both sides see.', 3800);
      await d.chapter('Store settings');
      await d.show('#store-fee-input', 'Super admins set one flat fee per purchase with goods. There is no commission on goods.', 3400);
      await d.show('#store-banned-input', 'Extra banned words: a good with one of these is refused.', 3000);
      await d.show('#store-rules-input', 'The store rules every pro must agree to. Have a lawyer review them.', 3200);
      await manual(d);
    },
  },
  {
    key: 'listings', group: 'admin', section: 'market', as: 'u_superadmin', title: 'Market: held listings, places to stay, sellers and orders', tagline: 'Take down what breaks the rules, always say why, and stop sellers who keep breaking them',
    async steps(d) {
      await d.chapter('What the Market team does');
      await d.say('The Market is where people sell their own things, stores sell goods, and hosts offer places to stay.', 3400);
      await d.say('The team checks what the safety checks held back, approves places to stay, and stops sellers who keep breaking the rules.', 3800);
      await open(d, 'Market');
      await d.chapter('At a glance');
      await d.show(':text("Needs the team")', 'Needs the team shows what is waiting: held listings, store goods, orders with a problem, returns, and stolen-item reports.', 4000);
      await d.chapter('Check a held listing');
      await d.tap('button:has-text("To check")', 'Click To check.');
      await d.show(':text("Bosch drill, 650 W")', 'Read why it was held, then the description, the details and the photos.', 3400);
      await d.say('It is held for signs of a scam: a price far below normal, a photo another seller used, a high price from a new seller, or scam words.', 4200);
      await d.show('button[onclick*="ml_drill"][onclick*="remove"]', 'If it breaks the rules, take it down. Write why: the seller sees it, and can fix it.', 3400);
      await d.tap('button[onclick*="ml_drill"][onclick*="restore"]', 'If it is fine, click Approve. It then appears in the Market.');
      await d.chapter('Places to stay');
      await d.tap('button[onclick="adminMarketTab(\'rentals\')"]', 'Click Rentals.');
      await d.say('Check the photos match the description, the pin matches the address, the host declared they may rent it out, and their ID is checked.', 4400);
      await d.chapter('Sellers, orders and stolen items');
      await d.tap('button[onclick="adminMarketTab(\'sellers\')"]', 'Sellers shows the most-reported first.');
      await d.say('Stopping a seller takes their listings off sale and closes their store, for 7, 30 or 90 days, or until lifted. Orders already paid carry on.', 4400);
      await d.tap('button[onclick="adminMarketTab(\'orders\')"]', 'Orders: a problem on an order is decided in Disputes.');
      await d.tap('button[onclick="adminMarketTab(\'stolen\')"]', 'Stolen items: look for listings that match, take them down, and close the report saying what you found.');
      await d.tap('button[onclick="adminMarketTab(\'activity\')"]', 'Team activity records every action, who took it, and why.');
      await manual(d);
    },
  },
  {
    key: 'fares', group: 'admin', section: 'rides', as: 'u_superadmin', title: 'Rides: drivers, safety alerts, fares and rules', tagline: 'Approve drivers, act on alerts at once, and set fair fares',
    async steps(d) {
      await d.chapter('What Rides is for');
      await d.say('Trothen Rides lets customers book a motorbike, keke, car or van with a verified driver.', 3200);
      await d.say('No ride can happen until a person approves a driver. And a safety alert must never wait.', 3200);
      await open(d, 'Rides');
      await d.chapter('Countries and drivers');
      await d.show(':text("Rides by country")', 'Turn Rides on or off for each country. Turn one on only after checking its transport rules and setting its fares.', 4000);
      await d.show(':text("Driver applications")', 'Driver applications: open every paper. It must be real, readable, in the driver\'s name, and not expired.', 4000);
      await d.say('The vehicle photo must show the plate. For a motorbike, the helmet must be confirmed. Then approve, or reject with a reason.', 4000);
      await d.chapter('Safety alerts');
      await d.show(':text("Safety alerts")', 'An SOS, or a problem reported on a ride, appears here with where it happened. Act at once, contact the person, then mark it handled.', 4400);
      await d.chapter('Settings');
      await d.show('#rs-max', 'The ride rules: the longest ride, how far away drivers are shown, and how long a driver has to answer.', 3600);
      await d.show('#rs-fee', 'Trothen\'s fee on top of the fare, and the driver\'s commission.', 3000);
      await d.show('#rs-docs', 'The papers a driver must upload, for each country and vehicle.', 3000);
      await d.show('#rs-plans', 'Driver Pass prices. These are placeholders: set real ones before launch.', 3200);
      await d.chapter('Fares');
      await d.show('#rf-country', 'Fares are set per country, in its own money, from the road distance and time. No surge pricing.', 3600);
      await d.show('input.rf-in >> nth=0', 'Each vehicle has a starting fare, a price per kilometre and per minute, and a lowest fare.', 3400);
      await d.show('#rf-fcur', 'Type today\'s fuel price. Fares move only after the change passes the threshold.', 3400);
      await d.say('Riders always see the fare before they book. A change applies only to new rides.', 3000);
      await d.chapter('Places riders can search');
      await d.show('#plc-name', 'Riders can pick up at a known place, like ELWA Junction. Pin each place, and check the pin on the satellite view.', 3800);
      await manual(d);
    },
  },
  {
    key: 'scores', group: 'admin', section: 'providerscores', as: 'u_superadmin', title: 'Provider Scores: the Trothen Score', tagline: 'What the score measures, the weekly matches it gives, and calling a pro who needs help',
    async steps(d) {
      await d.chapter('What the score is');
      await d.say('Every pro has a Trothen Score from 0 to 99. It tells customers how far they can rely on the pro.', 3400);
      await d.say('Most points come from the work itself: jobs completed, customers who trust the pro, not cancelling, and arriving on time.', 4000);
      await d.say('A new pro is not punished for having no history. They show New on Trothen until they complete five jobs.', 3600);
      await open(d, 'Provider Scores');
      await d.chapter('Matches each week');
      await d.say('The score decides how many new job matches a pro gets each week: unlimited from 90, down to one at 20.', 3800);
      await d.say('Below 20, new matches pause automatically. This only limits new matches: bookings in progress carry on.', 3600);
      await d.show('th:has-text("Status")', 'Status says where each pro stands: good standing, fewer matches, or paused.', 3200);
      await d.chapter('Helping a pro with a low score');
      await d.tap('button:has-text("Breakdown") >> nth=0', 'Click Breakdown, to see the nine parts of a pro\'s score.');
      await d.say('From 40 or below, call the pro. Explain what pulls the score down, and what will raise it.', 3600);
      await d.run(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => { const c = m.querySelector('.modal-close'); if (c) c.click(); else m.remove(); }); });
      await d.say('Place on Hold is for a real risk, like safety or fraud. Not for a low score alone.', 3200);
      await d.chapter('The new-pro rule');
      await d.show('#new-pro-threshold-input', 'Jobs needed on Trothen before a real score shows. After changing it, click Recompute now.', 3400);
      await manual(d);
    },
  },
  {
    key: 'custpay', group: 'admin', section: 'custpay', as: 'u_superadmin', title: 'Customer Payments: confirm codes, send refunds', tagline: 'Confirm only what you can see on Trothen\'s statement, in full',
    async steps(d) {
      await d.chapter('What a payment code is');
      await d.say('A customer can pay for a protected booking by sending mobile money themselves, with a payment code in the reference.', 3800);
      await d.say('The booking waits until Finance sees the money arrive. Then it is held, and the pro is told to go ahead.', 3600);
      await open(d, 'Customer Payments');
      await d.chapter('Confirm a payment');
      await d.show(':text("TP4K8W2N")', 'This customer says they paid code T P 4 K 8 W 2 N. First, find it on Trothen\'s mobile money statement.', 3800);
      await d.type('#cpx-tx-TP4K8W2N', 'LM26112611029', 'Type Trothen\'s transaction ID, from the statement, not the one the customer typed.');
      await d.type('#cpx-amt-TP4K8W2N', '15200', 'Type the amount that really arrived.');
      await d.say('If less arrived than the booking needs, the system refuses it. Ask the customer to send the rest.', 3400);
      await d.tap('button[onclick*="custPayConfirm"][onclick*="TP4K8W2N"]', 'Click Confirm payment.');
      await d.tap('#confirm-dialog-confirm-btn', 'Confirm, only if you can see the money on Trothen\'s statement. The money is now held, and the pro is asked to confirm.');
      await d.chapter('Refunds to send');
      await d.show(':text("Refunds to send")', 'Refunds for customers who paid by code: send the money to the number they paid from, then mark it sent with the transaction ID.', 4000);
      await manual(d);
    },
  },
  {
    key: 'pricing', group: 'admin', section: 'pricing', as: 'u_superadmin', title: 'Plans & Pricing', tagline: 'Plan prices, memberships, local prices, exchange rates and billing',
    async steps(d) {
      await d.chapter('What this page sets');
      await d.say('Plans and Pricing sets what pros pay for their plan, what customers pay for a membership, local prices, and the exchange rates.', 4000);
      await d.say('A price change affects real people\'s money. Change prices only on a super admin\'s decision, and tell people first.', 3600);
      await open(d, 'Plans & Pricing');
      await d.chapter('Global prices');
      await d.show(':text("Global Base Price (USD)")', 'One price per plan, in US dollars. Every country without its own price follows it, at the exchange rate.', 3800);
      await d.show(':text("Customer Membership Pricing (USD)")', 'Membership prices for Plus, Pro and Elite. Free is always free, and VIP is by invitation only.', 3600);
      await d.chapter('A country\'s own price');
      await d.show('#new-override-country', 'A country can have its own local price, in its own money. A regional admin can set it for their own country only.', 4000);
      await d.chapter('Exchange rates');
      await d.show(':text("Exchange Rates")', 'Rates update daily. They are also used for job payments and payouts, so change one by hand only with Finance.', 3800);
      await d.chapter('Charging the plan fee');
      await d.show(':text("Charging the monthly plan fee")', 'The monthly fee is built, but off until real payments are live. Two locks must both be open before anything is charged.', 4000);
      await d.say('Pros are never charged on a card. Once a month they get an invoice, taken from their payouts, never more than half of one.', 4000);
      await manual(d);
    },
  },
  {
    key: 'advertising', group: 'admin', section: 'advertising', as: 'u_superadmin', title: 'Advertising inquiries', tagline: 'Reply to every business that wants to advertise',
    async steps(d) {
      await d.chapter('Where these come from');
      await d.say('Businesses that want to advertise on Trothen use the Advertise here form on the home page. Their requests arrive here.', 3800);
      await open(d, 'Advertising');
      await d.chapter('Working a request');
      await d.show(':text("Sinkor Hardware Centre")', 'Read the request: who they are, what they sell, where, and what kind of ad.', 3400);
      await d.say('Ads also come from pros, for their own work. Those need a content check before they go live.', 3200);
      await d.say('Check the ad is genuine, lawful and true, and that the link is safe. Trothen doesn\'t advertise what it doesn\'t allow in the Market.', 3800);
      await d.show('button[onclick*="openGoLiveForm"] >> nth=0', 'Approve opens a window: the price, the headline, and the line under it. Then it goes live on the home page, marked Sponsored.', 4000);
      await d.show('button[onclick*="declineAd"] >> nth=0', 'Turn down, with a reason. If a pro placed it, they see the reason and can change it.', 3400);
      await d.say('Reply within one working day. Don\'t promise prices or dates that haven\'t been agreed: pass them to your manager.', 3600);
      await d.show('button:has-text("Mark contacted")', 'For a business request: reply within one working day, then click Mark contacted.', 3200);
      await manual(d);
    },
  },
  {
    key: 'promotions', group: 'admin', section: 'promotions', as: 'u_superadmin', title: 'Promotions and announcements', tagline: 'Offers for customers and pros, and official messages to the team',
    async steps(d) {
      await d.chapter('Promotions');
      await d.say('A promotion is a message shown inside Trothen to customers, pros, or both. It can also be sent by email.', 3400);
      await d.say('Everything in it must be true, clear and fair, with the conditions and the end date.', 3200);
      await open(d, 'Promotions');
      await d.tap('button:has-text("+ New Promotion")', 'Click New Promotion.');
      await d.type('#promo-title', 'Refer a friend this month', 'A short, clear title.');
      await d.type('#promo-message', 'Invite a friend to Trothen before 31 December. When they complete their first booking, you both get 100 points.', 'The message: what the offer is, who it is for, and until when.');
      await d.show('#promo-audience', 'Choose who sees it: customers, pros, or both.', 2800);
      await d.show('#promo-region', 'Leave the region blank for everyone, or type a city. A regional admin\'s promotion always goes to their own area.', 3800);
      await d.show('#promo-send-email', 'Tick to email it too. People who switched Promotions off in their settings are not emailed: that is their choice.', 4000);
      await d.chapter('Announcements to the team');
      await d.tap('.dash-nav-item:has-text("Announcements")', 'Announcements are official messages from management to the Admin team. Open Announcements.');
      await d.show('#ann-title-input', 'Write what it is about, and in the body: what changes, from when, and what the team must do.', 3600);
      await d.show('#ann-priority-input', 'Choose the priority. Use Urgent only when it truly is.', 3000);
      await d.say('Every admin must read and acknowledge each announcement. Management can see who has.', 3200);
      await manual(d);
    },
  },
  {
    key: 'messages', group: 'admin', section: 'contact-submissions', sections: ['contact-submissions', 'careers'], as: 'u_superadmin', title: 'Contact messages and job applications', tagline: 'Every message gets a reply',
    async steps(d) {
      await d.chapter('Contact Us messages');
      await d.say('The Contact Us form on the website sends its messages here. Every message gets a reply, within one working day.', 3600);
      await open(d, 'Contact Us Messages');
      await d.show(':text("My pro has not confirmed my booking")', 'Read it. What does the person need, and which team answers it?', 3200);
      await d.say('A booking, payment or dispute goes to that team. Press and partnerships go to your manager. A safety concern goes to your manager at once.', 4400);
      await d.show('select[onchange*="updateContactSubmissionStatus"] >> nth=0', 'Set it to Read while you deal with it, and Resolved once it is answered.', 3200);
      await d.say('Never ask for a password, a card number or a PIN. Trothen never needs them.', 3000);
      await d.chapter('Job applications');
      await d.tap('.dash-nav-item:has-text("Job Applications")', 'Applications from the Careers page are in Job Applications, for the HR team.');
      await d.show(':text("Joseph Kpoto")', 'Read each application fully, and decide with the hiring manager.', 3000);
      await d.show('select[onchange*="updateCareersInquiryStatus"] >> nth=0', 'Set each one to Reviewed, Contacted, or Rejected as it moves on.', 3000);
      await d.say('Judge only on the skills the job needs. Never on religion, ethnicity, tribe, pregnancy, disability, or politics.', 3800);
      await d.say('Always tell the applicant the outcome, even when it is no.', 2800);
      await manual(d);
    },
  },
  {
    key: 'reports', group: 'admin', section: 'reports', sections: ['reports', 'referrals'], as: 'u_superadmin', title: 'Reports and referrals', tagline: 'Where demand is, where it is not met, and how the platform is doing',
    async steps(d) {
      await d.chapter('What Reports shows');
      await d.say('Reports shows how Trothen is doing: what customers book, where demand isn\'t met, and which pros perform best.', 3600);
      await d.say('While payments are in test mode, money figures are practice numbers.', 2800);
      await open(d, 'Reports');
      await d.chapter('Report Builder');
      await d.show('#rb-date-from', 'Build a report: choose the dates, a category, a city, a status, and a plan. Then click Run Report.', 3600);
      await d.chapter('Demand and performance');
      await d.show(':text("Customers Waiting With No Pro")', 'Customers Waiting With No Pro is where Trothen loses customers. Recruit pros there first.', 3800);
      await d.show(':text("Category Performance")', 'Category Performance: bookings, value, pros and ratings for each category.', 3200);
      await d.show(':text("Top Providers")', 'Top Providers, by completed jobs. Thank them, and use it for the monthly award.', 3200);
      await d.chapter('Referrals');
      await d.tap('.dash-nav-item:has-text("Referrals")', 'Referrals shows the people who invite others to Trothen.');
      await d.say('Thank top referrers. And watch for abuse: many sign-ups with no activity from one person can be fake accounts made for a reward.', 4200);
      await manual(d);
    },
  },
  {
    key: 'categories', group: 'admin', section: 'categories', as: 'u_superadmin', title: 'Categories & Countries', tagline: 'What can be booked, and where Trothen is live',
    async steps(d) {
      await d.chapter('What this page decides');
      await d.say('This page decides what can be booked on Trothen, and in which countries Trothen is live.', 3200);
      await open(d, 'Categories & Countries');
      await d.chapter('Service categories');
      await d.show('th:has-text("Customers Can Find")', 'Customers Can Find counts pros who are verified, have a profile photo, and are not on hold. Remind those with no photo.', 4000);
      await d.show('th:has-text("Response Window")', 'The response window: shorter for urgent trades, longer for planned work.', 3200);
      await d.show('button:has-text("+ Add Category")', 'Add a category with a clear name people search for, and an icon.', 3000);
      await d.say('To stop new bookings in a category, switch it off. Delete only a category nobody uses.', 3200);
      await d.chapter('Countries');
      await d.show(':text("Countries") >> nth=1', 'Making a country live opens Trothen there for real people.', 3000);
      await d.say('First check its currency and rate, how people pay there, rides if they will be on, and that someone on the team covers it.', 4000);
      await d.show('button:has-text("Sync Latest Categories")', 'Sync adds any missing standard categories and countries. It never removes anything.', 3200);
      await manual(d);
    },
  },
  {
    key: 'locations', group: 'admin', section: 'locations', sections: ['locations', 'accesslogs', 'myteam'], as: 'u_superadmin', title: 'Locations & Admins, and the Access Logs', tagline: 'The least access each job needs, and a record of who looked at what',
    async steps(d) {
      await d.chapter('The team\'s accounts');
      await d.say('Here a super admin creates the team\'s accounts: a regional admin for an area, or a team member with one job.', 3600);
      await d.say('Give each person only the access their job needs. And when someone leaves, suspend their account the same day.', 3600);
      await open(d, 'Locations & Admins');
      await d.chapter('Adding an admin');
      await d.tap('button:has-text("+ Add Admin")', 'Click Add Admin.');
      await d.show('#loc-admin-password', 'A new random starting password is made for each admin. Give it to them directly. They must choose their own at first sign-in.', 4200);
      await d.show('#loc-scope', 'Choose what they cover: the whole country is recommended, or one city.', 3200);
      await d.show('#loc-department', 'Choose the role: a regional admin, or a team such as Verification, Disputes, Finance, Customer Service, Legal, Sales or HR.', 4200);
      await d.say('For custom permissions, set each part of Admin to Off, View, Manage, or exactly the actions you tick.', 3600);
      await d.chapter('Managing accounts');
      await d.show(':text("Cities Under Your Oversight")', 'Each regional admin: make them country-wide, suspend them, or delete the location.', 3400);
      await d.show(':text("Functional Team Members")', 'Each team member, with suspend and reactivate.', 2800);
      await d.chapter('Access Logs');
      await d.tap('.dash-nav-item:has-text("Access Logs")', 'Access Logs record which admin viewed sensitive information, and when.');
      await d.say('Contact details, IDs, disputes, money and payouts: every look is recorded, with the admin, the time and the address.', 3800);
      await d.say('Check them weekly. If you find misuse, don\'t confront the person: tell a super admin.', 3200);
      await manual(d);
    },
  },
  {
    key: 'sales', group: 'admin', section: 'sales', sections: ['sales', 'organizations'], as: 'u_superadmin', title: 'Sales and organizations', tagline: 'Custom plans for businesses and institutions',
    async steps(d) {
      await d.chapter('Sales inquiries');
      await d.say('Businesses ask for a custom plan with Contact Sales. Their requests arrive here.', 3000);
      await open(d, 'Sales Inquiries');
      await d.show(':text("Mamba Point Hotels")', 'Read what they need: how many staff or members, which services, which cities. Reply within one working day.', 3800);
      await d.say('Agree the price and the commission rate with your manager first. Never promise a rate that isn\'t approved.', 3400);
      await d.show('button:has-text("Deal Notes") >> nth=0', 'Record what was agreed in Deal Notes. Once a price is recorded, Convert to Organization appears.', 3600);
      await d.chapter('Organizations');
      await d.tap('.dash-nav-item:has-text("Organizations")', 'An agreed deal becomes an organization.');
      await d.say('Each shows its account manager, the agreed price, its seats and its commission rate. Its members get that rate.', 3800);
      await manual(d);
    },
  },
  {
    key: 'golive', group: 'admin', section: 'golive', sections: ['golive', 'datacleanup'], as: 'u_superadmin', title: 'Go-Live and Data Cleanup', tagline: 'Every required item green before real customers',
    async steps(d) {
      await d.chapter('The readiness checklist');
      await d.say('Go-Live is the checklist, and three steps, to move Trothen from testing to real customers and real money.', 3600);
      await open(d, 'Go-Live');
      await d.show(':text("Readiness checklist")', 'Each item is checked live on the server. Every Required item must be green before real people use Trothen.', 3800);
      await d.say('Business steps, like the lawyer\'s review and connecting real payments, are for the owners, not the technical team.', 3800);
      await d.chapter('The three steps');
      await d.show('#golive-admin-email', 'Step one: create your own super admin. The demo one has a public password.', 3400);
      await d.show('button:has-text("Preview what will be removed")', 'Step two: preview, then remove all demo data.', 3000);
      await d.show('#golive-countries', 'Step three: the countries you really serve, one per line.', 3000);
      await d.chapter('Data Cleanup');
      await d.tap('.dash-nav-item:has-text("Data Cleanup")', 'Data Cleanup removes unused test accounts later.');
      await d.say('Accounts with any booking, payment or dispute are never removed. Always preview first, and take a backup.', 3600);
      await manual(d);
    },
  },
  {
    key: 'settings', group: 'admin', section: 'settings', as: 'u_superadmin', title: 'Settings: your account and the platform', tagline: 'Your security, and the settings every customer and pro sees',
    async steps(d) {
      await d.chapter('Your account');
      await open(d, 'Settings');
      await d.show(':text("Two-Factor Authentication") >> nth=0', 'A six-digit code is needed every time you sign in. For admins it can\'t be turned off.', 3400);
      await d.show('button:has-text("Sign out of all devices")', 'If you think someone else used your account, sign out of all devices, and change your password.', 3600);
      await d.chapter('Platform settings');
      await d.show('#booking-window-within24h', 'How long a pro has to accept a new booking, depending on how soon the job is.', 3200);
      await d.show('#support-whatsapp', 'The support WhatsApp, phone and email. Replace the placeholder numbers before launch.', 3400);
      await d.show('#idle-min-admin', 'How long a session stays open with no activity. Keep the recommended five minutes for admins.', 3400);
      await d.chapter('Terms, privacy and backups');
      await d.show('#settings-terms-customer', 'The Terms for customers, and for providers. Have a lawyer review them. When they change, everyone accepts again.', 4000);
      await d.show('button:has-text("Take a copy now")', 'A copy of the records is taken every night. Download one every week, and keep it somewhere else, safely.', 3800);
      await manual(d);
    },
  },
  {
    key: 'systemcheck', group: 'admin', section: 'systemcheck', as: 'u_superadmin', title: 'System Check', tagline: 'Green, orange or red for each part of Trothen',
    async steps(d) {
      await d.chapter('Running the check');
      await d.say('System Check tests every part of Trothen at once: the database, files, email, payments, calls and maps.', 3600);
      await open(d, 'System Check');
      await d.tap('button:has-text("Check now")', 'Click Check now. It takes a few seconds.');
      await d.say('Green is working. Orange needs attention soon. Red is not working now.', 3000);
      await d.say('Under each orange or red part are the likely cause, and what to do.', 3000);
      await d.chapter('Getting it fixed');
      await d.show('button:has-text("Copy report")', 'Click Copy report, and send it to whoever fixes it. It has everything they need.', 3400);
      await d.say('Run it every morning, after every update, and whenever someone says something doesn\'t work.', 3200);
      await manual(d);
    },
  },
  {
    key: 'callhealth', group: 'admin', section: 'callhealth', as: 'u_superadmin', title: 'Call health', tagline: 'Why calls worked or didn\'t, and what to fix',
    async steps(d) {
      await d.chapter('What it shows');
      await d.say('Customers and pros can call each other in Trothen without sharing numbers. Calls are never recorded.', 3400);
      await open(d, 'Call health');
      await d.show(':text("Set-up")', 'Set-up: calls need a relay server, or they fail on many mobile networks, and phone push, or they only ring while Trothen is open.', 4400);
      await d.show(':text("What to fix")', 'What to fix lists the most important fixes, with exactly what to set on the server.', 3400);
      await d.chapter('The last calls');
      await d.show(':text("The last 7 days")', 'How calls ended. Many answered calls with no sound means the relay server is missing.', 3600);
      await manual(d);
    },
  },
];
