# Trothen v147: sign-in emails that work, Mobile Money done properly, payouts only when really sent, Joseph's list, Liberia ride places, and more

This one package includes everything since the version on your GitHub `main` before v128: v128 to v146, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked (and what Joseph asked)
- **The sign-in code error:** "We couldn't send your sign-in code to t•••@gmail.com".
- **Joseph's list:**
  - let the booking window turn sideways on the screen;
  - "good purchase is not working";
  - a delivery request a driver doesn't answer in time should go to another driver;
  - create a department manager.
- **Messages:** let messages that arrive in the background come to the front.
- **Calls:** customer and pro can call only once a booking is confirmed.
- **Rides in Liberia:** fix the locations properly, the way companies working in Africa do it.
- **Mobile Money:** where to add a Mobile Money number, ready to connect with the Mobile Money system; no PayPal in Liberia.
- **The money flow:** work out how customers pay, how money is released, and how Trothen earns its commission, for the pro too.
- **The store and the Market:** make them work perfectly.
- **Everything:** fix everything else, with no gaps.
- **Booking and rides end to end:** "is everything perfectly done… make sure it's working".
- **Mobile Money automation:** "how can the mobile money be automated".

## 1. Sign-in codes by email (the error in my screenshot)
- **Why it happened:** SendGrid ended its free plan in 2025. A free or trial account stops sending after 60 days. Trothen still had the SendGrid key, so it tried to send, SendGrid refused, and the message wrongly blamed the email address.
- **Why it matters:** every admin signs in with an emailed code, so when email stops, every admin is locked out.
- **Now Trothen can send through our own mailbox** (Namecheap Private Email, noreply@trothenpro.com). On Render, add:
  - `SMTP_HOST` = `mail.privateemail.com`
  - `SMTP_PORT` = `465`
  - `SMTP_USER` = `noreply@trothenpro.com`
  - `SMTP_PASS` = that mailbox's password

  With both the mailbox and SendGrid set, the mailbox goes first and SendGrid is the backup.
- **Honest messages:**
  - if the problem is the person's address, they're told to check it;
  - if it's Trothen's email service, they're told it isn't their address and to try later, and the super admins get a notice with the exact reason (at most once an hour).
- **Admin → Go-Live:**
  - "Email sending works" shows whether the last email went out, and if not, why, in plain words (for example "SendGrid refused Trothen's API key… the plan has ended");
  - "Send a test email" sends one and shows the result.

## 2. Joseph's list
- **The booking window turns sideways.** The installed app was locked upright (`"orientation": "portrait-primary"`). It now turns with the phone. I checked the booking window sideways on a phone: it scrolls, and the button stays in reach. Someone who installed the app before may need to reopen it once (Android updates the setting by itself within a day).
- **Buying goods:**
  - **The cause:** a good with a one-word name (Hammer, Rice, Generator) or a one-word store name couldn't be saved, with a misleading "2 to 80 characters" message. The name check was the one meant for descriptions, which needs two real words.
  - **Fixed:** names can be one word. Gibberish like "aaaa" is still refused.
  - **Also fixed:** a Liberian seller's new good was priced in US$ by default, so "1500" meant $1,500. Goods and Market listings now default to the local money (L$), with US$ one tap away. The checkout total shows "L$1,500 ≈ $7.89".
  - **Checked:** I went through the whole store on a phone: the seller adds a good, a manager approves it, the buyer finds it in the Market, pays, and both see the order with the right next steps.
- **A delivery the driver doesn't answer goes to the next driver** (the way Glovo, Bolt Food and Jumia work):
  - each driver now has **10 minutes** (was 30);
  - if they decline or don't answer, Trothen asks the next nearest available driver whose price is no higher than what the customer paid, up to 3 drivers;
  - the customer and the seller are told who was asked, with nothing for them to do;
  - if no driver fits, the customer is refunded and asked to choose, as before.
- **Team managers (department managers):**
  - **Who makes them:** a super admin can make someone the manager of their team (Customer Service, Verification, Disputes, Financial and so on), when creating them or later with "Make team manager".
  - **My Team page:** the manager sees each person on the team (what they cover, when they last signed in, how much they did this week), can add people to their own team, and can suspend or reactivate them (signed out at once).
  - **Limits:** a manager can't add people to other teams, can't make managers, and can't suspend a manager or themselves. Their own access to data stays exactly their team's.
  - **Two bugs fixed on the way:**
    - adding any team member (a Verification staffer, say) quietly made them the admin of their city, replacing the real city admin;
    - the "Limit this role to the area chosen" tick was ignored, so such a person could see every country.

## 3. Messages and calls
- **Messages come to the front:**
  - **The pop-up:** the corner pop-up already showed new messages, but only while Trothen was in front.
  - **In the background:** when Trothen is in the background (another tab, another app, the screen off), a new message, call, price or booking now shows as a phone or computer notification, like WhatsApp. The tab title shows the count, "(2) Trothen", and so does the app icon.
  - **No doubles:** with phone push set up (v146), the phone shows it even with Trothen closed. A notification is never shown twice, and none appears while Trothen is open in front, where the pop-up shows it instead.
  - **Asking permission:** Trothen now asks once, in plain words, to turn notifications on ("Don't miss messages and calls"), after sign-in. "Not now" isn't asked again for 14 days. Before, the switch was only deep in Settings, so almost nobody had it on.
- **Calls only once a booking is confirmed** (how Uber, Airbnb, Thumbtack and TaskRabbit do it):
  - **Confirmed** means the pro has accepted and, if paid through Trothen, the customer has paid;
  - **before that,** people talk in the chat; voice messages in the chat still work;
  - **after the job,** calls stay open for 7 days for follow-ups;
  - **the Trothen team** can always call;
  - **contact details:** the pro's phone and email in the customer's Payments list, and both parties' details on the booking agreement PDF, now show only once the booking is confirmed (before, they showed on any booking request).

## 4. Rides in Liberia: places people can find
Liberia has few street addresses, and the free map search Trothen used (OpenStreetMap) knows few Liberian landmarks. Ride apps in Africa (Bolt, Yango, inDrive) solve this with known pickup points, saved places and a note for the driver. Trothen now does the same:
- **Search a place by name.** "red" finds Red Light, and "Redlight" works too. Trothen's own list comes first, then the map search.
- **Saved places:** Home, Work and others (up to 10), plus the last places the rider used, each one tap.
- **A note for the driver** ("blue gate, I'm in a red shirt"). A phone number typed in the note is taken out: numbers are shared in the app once the ride is on.
- **Admin → Rides → Places,** the list per country:
  - **The starter list:** 57 well-known places for Liberia (Greater Monrovia communities and landmarks such as Red Light, ELWA Junction, Duala Market, JFK, RIA, and every county capital). They're added **without a pin**, because I won't guess positions. Someone on the team presses "Pin it" and places each one on the map once; only pinned places are offered. Where riders already pinned the place, "Pin it" starts there.
  - **Suggestions:** when 3 or more riders name the same place and pin it, it appears as "Suggested by riders", with the middle of their pins. "Check and add" puts it on the list.
  - **Adding places:** the team can add any place with "Add and pin it".
- **The map picker's search** also finds Trothen's places first, and still works when the map search is down.

## 5. Mobile Money, and no PayPal in Liberia
- **Customers: Payments → Add Payment Method:**
  - **Liberia and the rest of Africa:** Mobile Money first, then a card. No PayPal or Apple Pay; the server refuses them too.
  - **Mobile Money:** choose the network (Orange Money or MTN Mobile Money), type the number any usual way (0777 123 456, +231…), and the name it is registered in.
  - **Checks:** Trothen checks it's a Liberian mobile number and that it matches the network (077 is Orange; 088 and 055 are MTN). It keeps the number encrypted in the form MTN's system uses (231886123456), shows only the last 4 digits, and refuses duplicates.
  - **What the screen says:** whether that wallet pays straight in the app (MTN, once connected) or by payment code (any wallet, now).
- **Connected to MTN when ready:** every place that charges a wallet (bookings, extra-work requests, tokens, Driver Passes) now goes through one module. Only MTN wallets go to Lonestar Cell MTN's MoMo system, and only once its keys are set and `LCMMMI_INTEGRATION_ENABLED=true`. Before, any default Mobile Money number, Orange included, would have been sent to MTN's API.
- **Pros:** payout details are already Mobile Money or bank with no PayPal in Africa (v141, in this package).
- **Paying from an MTN wallet in the app now waits for the customer's PIN (a gap I found).**
  - **What was wrong:** once MTN is switched on, a booking paid from an MTN wallet was marked "held" the moment the prompt was sent, before the customer approved it. A declined prompt would still have looked paid, and the pro would have started work for nothing. It also charged only the job price, without the service fee.
  - **Now:** the booking (or ride) waits as "Approve the payment on your phone". The customer's screen shows the amount in LRD and the last 4 digits of the number. Trothen asks MTN every minute, and the screen checks every few seconds.
    - **Approved:** the money is held, the pro or driver is asked to confirm, and MTN's transaction ID is kept.
    - **Declined, failed or not approved within 30 minutes (10 for a ride):** the booking is cancelled, nothing is taken, and the customer is told plainly.
  - **MTN's callback** (`/api/webhooks/mtn-momo`) is never believed on its own: Trothen asks MTN directly.
  - **If a customer approves after the booking ended,** the money goes on the Refunds to send list.
- **Payouts sent through MTN** now use the number in the form MTN needs (231…). Before, a number typed as 0886… would have been refused by MTN.

## 6. Payouts are paid only when really sent
- **What was wrong:** a pro's payout turned to "paid" by itself 2 days after it was asked for, whether or not anyone sent the money.
- **Now, in Admin → Payments → Payouts being sent,** each payout has:
  - **Mark as sent,** with the transaction ID from the Mobile Money or bank receipt (required). The pro is told, with the reference, and it shows on their payout history;
  - **Send by MTN MoMo,** for a payout to an MTN wallet once MTN's payout system is connected. MTN's answer is checked every 5 minutes; the payout is marked paid with MTN's reference, or put back in the queue with the reason;
  - **Can't send,** with the reason. The pro is told what to fix, and the payout stays in the queue.
- **Before real payments:** while real payments are off, payouts still settle by themselves after 2 days, because no real money came in. Once "Real payments only" is on, only a real send counts.

## 7. Jobs no longer wait for ever for the customer
- **What was wrong:** a pro was paid only when the customer pressed Complete. A customer who never did left the pro's money held for ever.
- **Now:**
  - the pro presses **"I've finished the job"**;
  - the customer is asked to check the work and press Complete or Report a Problem;
  - if they do neither within **3 days**, the job completes by itself and the pro is paid (Airtasker, TaskRabbit and Upwork work the same way);
  - a reported problem stops it, and the team decides;
  - on a cash job, the commission stays at the booked price.

## 8. Security updates
`npm audit` found 4 known problems in packages, 2 of them high-severity, already in the live code:
- `body-parser`: a malformed request could tie up the server;
- `multer`: a file-upload denial of service;
- `ip-address` and `qs`: two moderate issues.

All are updated to fixed versions, each released at least two weeks ago. `npm audit` now shows 0. Email by mailbox adds one package, `nodemailer` 10.1.7, pinned exactly.

## How the money works
I also wrote **"Trothen: how the money works"**, a separate document for Joseph and me. It covers:
- how customers pay;
- when money is held and released;
- how Trothen earns on each kind of transaction, with a worked L$ example;
- the pro's side: payouts and tokens;
- what happens when something goes wrong;
- the steps to switch on real money.

## A booking and a ride, start to finish (62 more checks)
Tested on Liberian accounts against a pretend MTN system, with the phone screens:
- **Cash booking:**
  - booked; the pro's number is hidden until she confirms;
  - she accepts, and Trothen's commission comes from her tokens;
  - On my way, then Arrived, then "I've finished the job";
  - the customer confirms what she paid.
- **Protected booking:**
  - the money is held;
  - the pro accepts, works and finishes;
  - the customer completes with a $5 tip, and the money is released;
  - the pro asks for her payout: $30 less commission plus the tip, $31.10;
  - finance marks it sent with the transaction ID, and the pro is told.
- **Booking paid from an MTN wallet:**
  - MTN is asked to charge 231886123456 in LRD;
  - nothing is held and the pro isn't asked until the customer approves;
  - approved: the money is held and the pro is asked;
  - declined: the booking is cancelled;
  - a fake "paid" callback changes nothing.
- **Ride paid from an MTN wallet:**
  - the place search answers, and the driver is shown nearby with a fare;
  - the driver isn't disturbed until the rider approves the payment;
  - he accepts and sees the pickup note "By the blue gate";
  - he arrives; a wrong PIN doesn't start the trip, and the right one does;
  - he ends the trip, the rider confirms, and the fare is released to him.
- **Cash ride:** with cash switched on and a Driver Pass, start to finish.
- **Payout by MTN MoMo:**
  - "Send by MTN MoMo" asks MTN to pay 231886555999;
  - when MTN confirms, the payout is paid with MTN's reference.
- **On the phones:**
  - "Approve the payment on your phone", then "Payment approved";
  - the pro's "I've finished the job" button;
  - the customer's note that it completes by itself on a date.
- **"I've finished the job", to the usual standard for escrow platforms** (the pro says it's done, the customer confirms or reports a problem, and it releases by itself after a set time, as on Fiverr and Upwork):
  - the pro can only press it after Arrived, or from the booking day. Before, a pro could press it the moment they accepted, to start the 3-day clock on work not yet done;
  - the customer gets a reminder about a day before it completes by itself, telling them to press Report a Problem if anything is wrong;
  - an open problem report stops it completing by itself; the team decides;
  - tested: refused before arriving, the reminder, completing by itself after 3 days, and the pro being told.
- **Also fixed:** a booking that has a landmark but no map pin no longer says "Location required" in red. It says the pro has the landmark and offers to add a pin. It also stops asking once the pro says the job is finished.

## What I tested (90 new checks)
- **Email:**
  - sent through a mailbox;
  - an address that doesn't exist, a wrong mailbox password, and an unreachable mail server, each reported in the right plain words;
  - Go-Live's test email and help text.
- **Store and delivery:**
  - one-word good and store names;
  - a declined delivery goes to the next driver at no higher price, skipping a dearer one;
  - the customer is told who was asked;
  - when no one else fits, the customer is refunded and asked to choose.
- **Calls:**
  - chat only, so no call yet;
  - a booking waiting for the pro still can't call, and contact details stay hidden;
  - confirmed: they can call, both ways;
  - 2 days after the job, open; 8 days after, closed.
- **Mobile Money:**
  - Liberia's options;
  - PayPal and Apple Pay refused;
  - an Orange number saved as MTN is caught, and a bad number is refused with an example;
  - stored encrypted as 231886123456 and shown as •••• 3456;
  - duplicates refused;
  - only MTN goes through the API, and nothing is charged while it is off;
  - PayPal still works in the US.
- **Payouts:**
  - not marked paid by itself once real payments are on;
  - "Send by MTN MoMo" explains it isn't on yet;
  - "Mark as sent" needs the transaction ID;
  - "Can't send" tells the pro;
  - sent with the reference, and the pro sees it.
- **Team managers:**
  - created by a super admin, without replacing the city admin;
  - the manager adds to their own team, the area limit is kept, and they can't add to another team or make managers;
  - My Team lists the team;
  - a suspended member is shut out at once;
  - the manager can't suspend themselves.
- **Places:**
  - the starter list (57) without pins, never offered until pinned;
  - pinned Red Light found by "red" and "Redlight";
  - the map picker finds it first;
  - adding a place, but not twice;
  - Home saved and replaced;
  - a 3-rider suggestion with the middle of the pins;
  - a phone number taken out of the driver note.
- **On screen:**
  - Liberia's payment methods on a phone (Mobile Money first, no PayPal, Orange and MTN, how paying works);
  - a wallet saved and shown as •••• 9111;
  - a background message shown as a notification with "(1)" in the tab;
  - the "turn on notifications" request, with "Not now" respected;
  - the rider's Home button, searching "red", tapping Red Light, the note, Home as destination in one tap;
  - Admin → Rides → Places with suggestions;
  - Admin → Payments with Mark as sent and Can't send;
  - Go-Live's test email;
  - My Team.
- **Earlier tests:** all still pass (listed in the deployment steps).

## Good to know
- **Business: email.**
  - **Option 1:** set `SMTP_*` for the noreply@trothenpro.com mailbox (recommended; already paid for).
  - **Option 2:** upgrade SendGrid.

  Then use Go-Live → "Send a test email". Namecheap Private Email has its own daily sending limit; it's plenty for sign-in codes now. As Trothen grows, move bulk email (promotions) to a paid sending service.
- **Business: places.** Ask someone in Monrovia (Joseph's team) to pin the 57 starter places in Admin → Rides → Places, on the satellite view, about 30 minutes in all. Riders can search only pinned places.
- **Business: a decision for you.** Cash rides carry no per-ride commission: Trothen earns from cash drivers only through Driver Passes. Tell me if cash rides should take commission from tokens, like cash jobs.
- **Legal (attorney):** holding customers' money until a job is done may need a licence or a partner bank in Liberia. The money document lists this with the other steps.

## Files
- **New:**
  - `src/places.js`
  - `src/mobile-money.js`
  - `src/payout-sending.js`
  - `src/booking-contact.js`
  - `src/contact-scrub.js`
  - `public/app/paymethods.js`
  - `public/app/teams.js`
- **Changed:**
  - `src/delivery.js`
  - `src/go-live.js`
  - `src/notify.js`
  - `src/validators.js`
  - `src/store-orders.js`
  - `src/tokens.js`
  - `src/ride-pass.js`
  - `src/payout-settlement-scheduler.js`
  - `src/admin-permissions.js`
  - `src/routes/auth.routes.js`
  - `src/routes/admin.routes.js`
  - `src/routes/calls.routes.js`
  - `src/routes/marketplace.routes.js`
  - `src/routes/payments.routes.js`
  - `src/routes/rides.routes.js`
  - `src/routes/store.routes.js`
  - `src/routes/custpay.routes.js`
  - `src/customer-payments.js`
  - `server.js`
  - `package.json`
  - `package-lock.json`
  - `public/manifest.json`
  - `public/sw.js`
  - `public/app/trothen.js`
  - `public/app/rides.js`
  - `public/app/market.js`
  - `public/app/instant.js`
  - `public/app/payout-details.js`
  - `public/app/payways.js`
  - `public/app/pricing.js`
  - `public/app/where.js`
  - `public/index.html`

**What's needed:**
- **One new package,** nodemailer. Render installs it by itself from `package.json`; nothing to do.
- **Settings (recommended):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
- **Later, when MTN gives you the keys:**
  - the six `LCMMMI_COLLECTIONS_*` and `LCMMMI_DISBURSEMENT_*` keys;
  - `LCMMMI_BASE_URL` and `LCMMMI_TARGET_ENVIRONMENT`;
  - `LCMMMI_CALLBACK_URL` = `https://trothenpro.com/api/webhooks/mtn-momo`;
  - then `LCMMMI_INTEGRATION_ENABLED` = `true`.
- **Database changes:** none.
