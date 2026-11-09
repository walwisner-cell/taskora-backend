# Trothen v148: the Market pays first, cash rides, maps and GPS, System Check, "Get ready" checks

What Walter asked for:
- **Cash rides:** "the best option".
- **The Market:** "work on the market place as best practice and make sure it's working as international standard".
- **Maps:** "the GPS is not working correctly, the maps are not showing correctly like other apps do, and the navigation is not working well".
- **Devices:** "it should work perfectly on a computer or a tablet".
- **WhatsApp:** "how does this WhatsApp message work".
- **System Check:** "let the system alert you when there is an issue and tell you the possible cause… a system checker and a system validation before you can move to the next step".
- **User checks:** "do validations for provider and customer and any other user… before they do something. Let this be very intelligent".
- **Country:** "state which country an account is opened from so the user knows".
- **Skills:** "what if a person or company provides more than four skills… make this international standard".
- **Paying for someone:** "if a customer wants to pay by mobile money but has to use another person's account… where do the customer and pro set up their mobile money".

## 1. The Market: goods are paid for before the seller is told (the big gap)

**What was wrong.** A store order, or an item bought from a person in the Market, was marked "paid, money held" the moment it was placed. No money was ever asked for. This was true even with real payments switched on. Only bookings with a pro went through the payment code, the card page or MTN. If the Market had gone live like this:
- the seller would have packed, and handed over, goods nobody had paid for;
- Trothen's records would have shown money that never arrived.

**Now:** goods are paid exactly like a protected booking, which is how Jumia, Amazon and Etsy work: the buyer pays first and Trothen holds the money.
- **Waiting for payment.** The order shows "Waiting for your payment", with **Pay now** and **Cancel order**. Payment is by code to Trothen's MTN number, by card, or by an MTN prompt once that is connected.
- **Stock and listings are kept.** The stock is kept for the buyer while they pay. A Market item is marked reserved, so no one else can buy it at the same time.
- **The seller isn't told yet.** They don't see the order, and the driver isn't asked, until the money is confirmed. Then the seller gets "New store order… get it ready" and the buyer gets "We received your payment".
- **One payment covers the driver too.** Before, the buyer would have had to pay twice. The driver's share is held from the same payment, with the same reference.
- **Not paid in time:** the order is cancelled, the stock goes back on the shelf, and a Market item goes back on sale. The buyer is told, in words about an order, not a booking.
- **Nowhere to pay.** If real payments are on but no payment method is set up for the country, the order is refused plainly. It is never "paid" for free.
- **Refunds stay separate.** If only the delivery is cancelled, only the driver's part is refunded. Finance sees it on its own, with the order's payment reference.
- **Pros can buy too.** Pros buying goods can press "I have sent it" and check an MTN payment. Before, only customer accounts could.
- **The order card is right while unpaid.** It no longer says "Paid, being packed" or "Paid $25"; it says "Waiting for your payment" and "To pay". The payment box speaks of the seller, not a pro.
- **No arrival time for goods.** Store orders no longer ask you to "Agree Arrival Time"; that is for jobs.

**Sellers get things ready faster.** As on Jumia and Amazon:
- a seller now has **3 days** to get an order ready (it was 7);
- the seller is reminded after 1 day;
- the 3 days count from when the order was **paid**, not when it was placed.

## 2. Cash rides: the best option

This is the way Bolt, Uber, SafeBoda and inDrive do it in Africa.
- **Without a Driver Pass:** a driver can take cash rides as long as they have tokens. Trothen's ride commission (5%, the same as rides paid in the app) comes off their tokens when they accept the ride.
- **With a Driver Pass:** no commission per ride, as before.
- **Before,** cash rides were only for drivers with a pass, so Trothen earned nothing per ride and most drivers couldn't take cash at all.
- **Short of tokens:** a driver who can't cover the commission isn't offered for cash. They get a nudge to buy tokens or a pass.

## 3. Maps, GPS and navigation (every map in the app)

- **Maps fill their box.** Before, a map opened in a window, or on a phone turned sideways, was often grey or showed only one corner. Now every map redraws itself when its box changes size: a window opening, a phone or tablet turned, a computer window resized.
- **Satellite view on every map** (🛰️ / 🗺️ button). This matters most in Liberia, where few streets are drawn. It remembers your choice.
- **"My location" button:**
  - the blue dot with its accuracy circle, and the direction of travel when the phone knows it;
  - it waits a few seconds for a real GPS fix instead of taking the first rough guess;
  - if location is blocked, it says exactly how to allow it on an iPhone, an Android phone or a computer.
- **Live tracking:**
  - **Follows the trip until you move the map.** Before, it jumped back every 6 seconds, so you couldn't look around. Now a **Re-centre** button brings it back.
  - **Smoother.** The driver's marker glides instead of jumping, and the markers no longer flash every few seconds.
  - **Shows the way.** It draws the route: the driver to the pick-up, and the pick-up to the drop-off. The trip view for a pro going to a job does the same.
- **Navigate:** every "Directions" button now offers **Google Maps, Waze, and Apple Maps** (Apple Maps on iPhone, iPad and Mac). "Always use this app" skips the question next time.
- **GPS from drivers and pros:**
  - old positions the phone kept from earlier are ignored;
  - a rough network guess right after a good GPS fix is ignored, so the marker doesn't jump a kilometre away and back.
- **One map provider for every map,** set on the server: see "Settings" below. If the map pictures fail to load, the map switches to the backup by itself.

**About the map pictures (honest note).** OpenStreetMap's own servers are free, but their rules don't allow a busy app to rely on them, and they can slow down or block it. Before many people use Trothen, add a `MAPBOX_TOKEN`: Mapbox allows business use, and its free tier is generous. That switches every map, satellite included, to Mapbox with no code change.

## 4. Phone, tablet and computer

The maps, the "Pay to confirm your order" window and My Orders were checked at three sizes:
- a phone (390 wide);
- a tablet (820 wide), upright and sideways;
- a computer (1440 wide).

There is no sideways scrolling, the maps fill their boxes, and there are no page errors.

## 5. System Check: Trothen watches itself (Admin → System Check)

**How it runs.** Every 15 minutes, and whenever you press **Check now**, it looks at the running system. Each check shows green (working), orange (watch) or red (problem). Every orange or red one says the **likely cause** and **what to do**.

**What it checks:**
- **Emails are being sent.** It tells a wrong mailbox password apart from a used-up email plan.
- **Customer payments are confirmed quickly.** A customer who said "I have sent it" over 2 hours ago is flagged.
- **Refunds are sent.** Flagged when one has waited over a day.
- **Payouts are sent.** Flagged when one has waited over 3 days, or an MTN payout has had no answer for an hour.
- **MTN MoMo payments get answers.**
- **Customers can pay wherever "Real payments only" is on.**
- **Background tasks are running.** Unpaid bookings, MTN checks, payout checks, tokens, and jobs completing by themselves. If one stops, it is noticed.
- **No server errors.** It counts errors in the last hour and names the parts of the app failing.
- **Data is on a permanent disk.**
- **Calls connect.** It notices a high failure rate, or no relay set.
- **Ride countries are ready.** Fares set, and places pinned.
- **Maps are on a provider that allows a business app.**
- **The L$ exchange rate is up to date.**

**Alerts.** When a check turns red, the super admins are told at once, in their notifications, with the cause and what to do. For money problems the finance team is told too. While it lasts, the alert repeats every 6 hours, not every 15 minutes. When it is fixed, they are told "Fixed".

**Copy report.** It gives one text with everything, to paste to the developer, so a problem can be fixed without guessing.

**Safety gates: a step can't be taken before things are ready.**
- **"Real payments only"** can't be switched on until customers have a way to pay: Trothen's Mobile Money number for the country, or cards. Email must work too. It says exactly what is missing. A super admin can still choose "Switch on anyway", knowingly.
- **Switching rides on for a country** says what is still missing (fares, pinned places).

## 6. "Get ready": checks for every customer, pro, seller and driver

This works like the Uber, Bolt and Jumia onboarding checklists.

**On the Overview,** a **Get ready** card shows what is missing on the person's own account. For each item it says why it matters, with a button to the right place to fix it, and a progress bar ("9 of 12 done").
- **Everyone:** account active (or why it is on hold); latest Terms accepted; ID checked; phone number.
- **Pros:**
  - a profile photo;
  - their work category;
  - a trade licence in date, with a warning 30 days before it ends;
  - payout details;
  - no commission owed;
  - tokens for cash jobs.
- **Sellers:** the store approved and open; goods on sale.
- **Drivers:**
  - approved;
  - rides running in their country;
  - driving licence and insurance in date, with a warning 14 days before either ends;
  - able to take cash rides.
- **Customers in Liberia, once real payments are on:** a Mobile Money number saved, for quicker paying and refunds.

**Before the action itself,** the same checks run first:
- **Going online** (drivers). The phone is checked too: location allowed, and notifications on so ride requests are heard.
- **Accepting a job.**
- **Asking for a payout.**

A clear window says what to fix and where:
- **Something that stops it** (an expired document, no payout number, an account on hold) must be fixed first.
- **Something that will cause trouble** (no tokens for cash, notifications off) can be skipped with "Continue anyway".

Before, people found out halfway, from an error. The server still enforces its own rules either way.

## 7. WhatsApp on the tracking screen

The WhatsApp button opens a chat with the driver (or rider, customer, seller) in the person's own WhatsApp, using their phone number. It is only shown while the ride or delivery is open. Trothen doesn't see those chats; Trothen's own Messages does keep a record.

**Fixed:** WhatsApp needs the number with the country code (231 886…). A Liberian number saved the local way (0886…) opened a wrong chat. The country code is now added automatically.

**Later, a business decision:** Uber and Bolt hide real numbers behind a relay number. That needs a telephony provider (Twilio, Africa's Talking) and costs per minute.

## 8. Which country an account is in

Under the name in the side menu, and in the account menu at the top, it says **"📍 Account in Liberia · Monrovia"**. Hovering over it explains that prices, payment methods, pros and rules are for that country, and that moving an account to another country goes through support.

## 9. More skills: an international standard

Thumbtack and TaskRabbit let a pro list every service they offer; Upwork allows 15 skills.
- **A person:** a main skill plus **10** extra (it was 4).
- **A business or company** (a business name in Settings, or part of an organisation): **25**.
- Licensed trades are still checked by a manager before customers find the pro under them.
- The limit stops people ticking everything to appear in every search.

## 10. Mobile Money: paying for someone, and whose wallet a pro is paid into

**Customers** (Payments → Add Payment Method → Mobile Money):
- **"Whose number is it?"** *Mine*, or *Someone else's (family, a friend, my company)*, with who it is and their name on the wallet. It shows as "MTN Mobile Money · My brother •••• 7123".
- **Once MTN is connected,** the PIN prompt goes to that person's phone and they approve it.
- **Paying with a code:** the payment screen now says anyone can send it for the customer, using the code. Refunds go back to the number the money came from.

**Pros** (Settings → Payout details):
- Payouts should go to a wallet or bank account in the pro's own name or business name, the usual "know your customer" rule for paying out money.
- A different name is still allowed, but the pro sees a note, and finance sees "⚠️ The account is in the name …, not the pro (…). Check with the pro before sending" on that payout.

**Also:** the "Get ready" checks before accepting a job or asking for a payout now only stop you for what really blocks it. Things that just slow you down stay on the Overview card instead of popping up every time. Before going online, both still show.

## Settings (Render → Environment)
- **`MAPBOX_TOKEN`** (recommended before launch): free from mapbox.com → Account → Access tokens. Use a public token (starts `pk.`), and restrict it to trothenpro.com in the Mapbox settings.
- **`ROUTING_URL`** (optional): an OSRM routing service. With it, the route on the map follows the roads. Without it, a straight dashed line is drawn and distances are estimated, as before.

## What I tested
- **`t148`, the Market paying first and cash rides (38 checks):**
  - **Store order:** waits for payment; the seller doesn't see it; the stock is kept; the buyer says they've sent it; finance confirms; the seller is told; the order is packed and received; the money goes to the seller.
  - **Driver order:** one payment covers the pipe and the driver; the driver is asked only after payment; his fee is held from the same payment.
  - **Refunds:** a cancelled delivery is refunded on its own.
  - **Unpaid order:** it is cancelled and the stock goes back.
  - **Market item:** it is reserved while unpaid and back on sale if not paid; once paid, the seller is told it sold.
  - **No payment set up:** the order is refused.
  - **Cash rides:**
    - no tokens and no pass: refused;
    - with tokens: 5% taken on accepting;
    - with a pass: nothing taken.
- **`tmaps`, maps and the Market on a phone, a tablet and a computer (49 checks):**
  - the map fills its box, also turned sideways;
  - the Satellite and "my location" buttons work, and the blue dot shows;
  - the route and the markers are drawn;
  - moving the map shows Re-centre, which brings the trip back;
  - Navigate offers Google Maps and Waze;
  - the "Pay to confirm your order" window shows, and My Orders shows "Waiting for your payment" with Pay now and Cancel order;
  - nothing says "Paid", there is no sideways scrolling, and there are no page errors.
- **`tchecks`, System Check, the safety gate and "Get ready" (26 checks):**
  - **Get ready:**
    - no payout number blocks a payout request;
    - an expired licence blocks accepting jobs;
    - expired insurance blocks going online;
    - no tokens gives a warning for cash jobs;
    - an account on hold is told why;
    - a ready customer has nothing blocking.
  - **System Check:**
    - it finds payments waiting for finance, and email not connected, each with its cause and fix;
    - super admins are alerted once, not every 15 minutes, and told when it is fixed;
    - "Real payments only" is refused with the reasons, and changes nothing;
    - "Switch on anyway" still works for a super admin.
  - **On a phone and a computer:**
    - the "Get ready" card shows;
    - going online is stopped first with the reason, and the driver isn't put online;
    - the admin System Check page lists each check with its cause and what to do.
- **`tmore` (18 checks):**
  - skills: 10 for a person, 25 for a business, and 11 refused with the reason;
  - payouts: a wallet in another name is flagged, a business-name wallet is fine, and finance sees the check;
  - someone else's wallet: saved, and shown as theirs;
  - on a phone and a computer: the account's country shows in the side menu and the account menu, and the Mobile Money form asks whose number it is and explains it.
- **Everything earlier, run again:** all the earlier suites, plus the v147 walkthrough of a booking and a ride from start to finish.

## Files
- **New:**
  - `public/app/maps.js`
  - `public/app/checks.js`
  - `src/system-check.js`
  - `src/readiness.js`
  - `CHANGES_v148.md`
- **Changed:**
  - `src/customer-payments.js`
  - `src/routes/marketplace.routes.js`
  - `src/routes/orders.routes.js`
  - `src/routes/market.routes.js`
  - `src/routes/payments.routes.js`
  - `src/routes/custpay.routes.js`
  - `src/routes/rides.routes.js`
  - `src/tokens.js`
  - `src/store.js`
  - `src/store-order-sweep.js`
  - `src/road-route.js`
  - `src/routes/admin.routes.js`
  - `src/routes/auth.routes.js`
  - `src/routes/store.routes.js`
  - `src/payout-methods.js`
  - `src/routes/tokens.routes.js`
  - `server.js`
  - `public/app/payways.js`
  - `public/app/pricing.js`
  - `public/app/market.js`
  - `public/app/trothen.js`
  - `public/app/rides.js`
  - `public/app/where.js`
  - `public/app/arrival.js`
  - `public/app/tokens.js`
  - `public/app/paymethods.js`
  - `public/app/payout-details.js`
  - `public/index.html`
