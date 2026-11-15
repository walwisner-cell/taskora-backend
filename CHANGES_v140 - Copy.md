# Trothen v140: safety and anti-fraud, Market phase 2, calls that don't hang, and ringtones

This one package includes everything since the version on your GitHub `main` before v128: v128 to v139, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
- Build everything left, with security and safety measures to reduce fraud, following international best practice.
- How can James send me his price?
- A call stuck on "Connecting…".
- Let me choose different ringtones and alert sounds.

## 1. Safety and anti-fraud
These follow the practices of the big marketplaces (eBay, Jumia, Jiji, OLX, Facebook Marketplace), the OWASP security guidance, and consumer rules such as the EU Digital Services Act.

- **Scam message warnings:**
  - **What's caught:** messages that mention the common scams:
    - paying outside Trothen;
    - Western Union or MoneyGram;
    - gift cards;
    - crypto;
    - "advance fee";
    - "overpayment";
    - "customs fee";
    - asking for a code sent to a phone.
  - **What the receiver sees:** a warning under the message: "Never pay outside Trothen, never pay with gift cards or crypto, and never share a code sent to your phone."
  - **For the sender:** nothing changes, and the message still goes, since people can mention these innocently.
  - **Repeated:** three in a day from one sender raises a fraud flag for the team.
- **Risky listings are checked before they go on sale** (as Jiji and OLX do). A personal listing is held for the team, with the reason shown, if:
  - it's priced far below what the same kind of item sells for in that country (under a quarter of the usual price);
  - it uses a photo another seller already uploaded. Every photo gets a fingerprint, because stolen photos are the classic fake-listing sign;
  - it's $500 or more from a seller with no completed sales;
  - a brand-new account (under a week old) has listed more than 5 items.
  
  The seller sees "Being checked". The team sees the listing under Stores & Skills → Market listings to check, with **Approve** / **Take it down**.
- **New-seller payout reserve** (as eBay and PayPal do): money from a personal sale by a seller with fewer than 3 completed sales becomes payable **3 days after the sale completes**. That gives a buyer time to report a fake or a swapped item. The seller sees the amount and the date.
- **24 hours after payout details change** (where the money goes), nothing is paid out, and the owner is told: "If this wasn't you, change your password now." Changing payout details is the first thing someone does after taking over an account. Setting them for the first time has no wait.
- **No buying from your own second account:** a purchase between two accounts with the same phone number is refused and flagged. That's how fake sales and fake ratings are made.
- **Business or private seller** shown on every item, as consumer rules ask. A private seller's page explains that shop consumer rights may not apply, but Trothen protection does. Buyers also see "New seller" and the number of completed sales.
- **More banned items** (the lists eBay, Jumia and Jiji use):
  - identity documents (passports, ID cards, birth certificates, voter cards);
  - card and account details;
  - stolen goods;
  - organs or human remains;
  - adult services;
  - hazardous materials (mercury, cyanide, asbestos, radioactive);
  - fixed-match and lottery gambling.
  
  A "passport holder" is still fine.
- **High-value checks:** a new account making a high-value Market purchase is screened the same way as bookings.
- **Browser security:**
  - a new Permissions-Policy header: microphone, camera and location are allowed only for Trothen itself, and payment, USB, Bluetooth and the motion sensors are switched off;
  - unchanged: the existing Content-Security-Policy, HSTS, no MIME sniffing and frame protection.
- **The fraud queue** (Admin → Fraud & Safety) names the new flags: Off-Platform Payment Request, Market Listing Held, Buying From Own Account. Medium flags never pause an account by themselves; a person decides.

## 2. Market phase 2
- **Materials for this job:**
  - the customer's job card has a **"Materials for this job"** button showing goods from nearby stores in the matching aisles (Plumbing → Plumbing Supplies, Building & Hardware, Tools; Painting → Paint & Finishes; and so on);
  - **the hired pro's own store comes first;**
  - **linked to the job:** what the customer buys from there is linked to the job, and the pro is told: "Jordan bought materials for 'Kitchen tap…': 1 × Kitchen tap from James's Hardware."
- **Trade prices for pros:** a store can set a lower price that only verified pros see and pay, like a trade counter.
  - **Setting it:** in Market → Sell → "Trade prices for pros", per item, and it must be below the shelf price.
  - **Who sees it:** pros see "Trade price for pros" in the Market and the store, and pay it.
  - **Who doesn't:** customers and people not signed in never see it.

## 3. "How can James send me his price?"
- **What James does:** opens **Job Matches** → your job, and presses **Send my price** in the price box, or **Accept the job at $X** if you gave a budget. You see it straight away in Responses to Your Job.
- **What was missing:** when you wrote to him, his notification just said "New message", and tapping it opened the general inbox, without the price box.
- **Now:** a customer's message about an open job tells the pro "…Open it to reply or send your price", and tapping it opens that job's chat **with the price box at the top**.

## 4. Calls stuck on "Connecting…"
**Why:** the call reached James (it rang and he answered), but the sound couldn't find a path between the two networks. That happens when one side uses a VPN, or strict office, school or hotel Wi-Fi. Your browser shows a VPN is on. Before, the call then sat on "Connecting…" for ever.

**What happens now:**
- **After 15 seconds:** "Still connecting…", and a fresh route is tried.
- **After 30 seconds:** the call ends with the likely reason: *"One of your networks is blocking direct calls, often a VPN or office, school or hotel Wi-Fi. Turn off a VPN, or switch between Wi-Fi and mobile data, and try again."* The caller is offered **Leave a voice message** or **Call again**, and the person called is told it couldn't connect.
- **For the team:** each call that couldn't connect records why, so you can see how often it happens.

**The real fix is a relay server (TURN).** It carries the call when two networks can't connect directly.
- **The easiest option now:** Metered's **Open Relay**, which is free for 20 GB a month. That's many hours of voice calls, and only calls that need the relay use it.
  1. Sign up at metered.ca/tools/openrelay.
  2. Copy your credentials link: `https://<yourapp>.metered.live/api/v1/turn/credentials?apiKey=<key>`.
  3. Add it on Render → Environment as **`TURN_API_URL`**.
  
  No code change is needed. Admin → Go-Live now shows whether a relay is set.
- **Paid plans:** if you outgrow it, Metered's paid plans start at $99 a month for 150 GB.
- **Right now:** try the call again with the VPN off.

## 5. Ringtones and alert sounds
- **Where:** Settings → Calls & Voice Messages → **Sounds**, with a ▶ Play button to hear each one.
- **Ringtone for calls:** Classic phone, Marimba, Chime, Pulse, Soft, Digital, or Silent (vibrate only).
- **Message and alert sound:** Triple chime, Ding, Pop, Two-note chime, Soft, or No sound.
- **Saved with the account,** so the choice follows the person to every device.
- **No sound files:** the sounds are made in the browser, so nothing extra downloads.

## What I tested
- **Safety and phase 2 (54 checks):**
  - the security headers;
  - scam warnings (none for ordinary messages, the right reasons named, a flag on the third, no automatic pause);
  - banned items, with a passport holder allowed;
  - the risk checks:
    - too cheap: held, hidden from buyers, flagged, and the seller can't release it;
    - a stolen photo;
    - $900 from a new seller;
    - the team approving;
  - the business, private and new-seller labels;
  - same-phone buying refused and flagged;
  - the new-seller reserve (nothing for 3 days, then payable);
  - the 24-hour payout wait after a change, with the notice, and no wait the first time;
  - trade prices (above shelf refused; seen only by verified pros; pros pay $48 for two, customers $60);
  - materials suggestions and the order linked to the job, with the pro told and nobody able to link someone else's job;
  - on screen: the chat warning (the receiver sees it, the sender doesn't), "Private seller", "Materials for this job", the trade price in the store, the trade-price editor, "Being checked", the admin queue, and the Fraud & Safety names.
- **Calls, sounds and the price notification (15 checks):**
  - a relay from `TURN_API_URL`;
  - sounds saved, loaded on sign-in and used for message alerts, with unknown ones refused;
  - the pro's notification opening the price box;
  - a call that can't connect (I blocked the connection on purpose): "Still connecting…" at 15 seconds, then the reason with Leave a voice message / Call again, the reason recorded, and the other side not left hanging.
- **Earlier tests, all still passing:**
  - Market (69), calls and voice (22 + 67);
  - data download (43);
  - permissions (95), all admin addresses, disguised addresses and the route audit;
  - instant updates;
  - commission, categories, accepting jobs, listed pros.

## Good to know
- **Scam warnings don't block:** a scammer can still write; the person receiving it is warned, and the team sees repeat senders. Blocking messages outright would also stop honest people.
- **Voice messages can't be scanned for scam words.** The report and block buttons cover them.
- **Held listings need someone to check them,** usually within a day. Regional admins are notified.
- **Legal (attorney):** the EU Digital Services Act and similar laws apply if Trothen serves those markets. The labels, reasons for take-downs and reporting are built the way they ask, but an attorney should confirm what each of your countries needs.

## Files
- **New:** `public/app/sounds.js`
- **Changed:**
  - `src/market.js`
  - `src/routes/market.routes.js`
  - `src/store.js`
  - `src/routes/store.routes.js`
  - `src/routes/orders.routes.js`
  - `src/routes/misc.routes.js`
  - `src/routes/auth.routes.js`
  - `src/routes/payments.routes.js`
  - `src/commission-statement.js`
  - `src/routes/calls.routes.js`
  - `src/go-live.js`
  - `server.js`
  - `public/app/calls.js`
  - `public/app/voice.js`
  - `public/app/chats.js`
  - `public/app/market.js`
  - `public/app/trothen.js`
  - `public/index.html`

**What's needed:** no new packages or database changes. One optional environment variable: `TURN_API_URL`.
