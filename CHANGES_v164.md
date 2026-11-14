# Trothen v164: everything re-checked, Joseph's notes, and deliveries end to end

What Walter asked:
- "ok place re verify everything to make sure its working very well"
- With Joseph's notes: "can we fix this the best way possible … reverify everything done and should be best practice and international standards"
- About the empty cart: "is this okay here is this best practice or interernational standard"
- "reverify everything also with the deliveries and lets perfect it to work very well"

## 1. Re-checking what is live (v163)
- **The code matches what you were sent.** The repo is byte-for-byte the v163 zip.
- **Your live copy was rebuilt and started the way Render starts it** (production mode, real `npm ci`). It started cleanly, with an empty database and with existing data. The health check answered, and the security headers were there.
- **39 test suites passed** against that copy before I moved on to the v164 run, which covers everything again.

## 2. Problems I found and fixed
- **Two cart changes at the same moment could lose one.** For example, adding two goods with quick taps. Each person's cart changes now happen one after another. Eight goods added at once are all kept.
- **The 20-goods-per-store limit could be passed** by moving a "saved for later" good back into the cart. Now it can't.
- **A visitor's cart, joined to the account on sign-in, could carry odd amounts** (2.7, or −4). Amounts are now whole numbers of at least 1.
- **On sign-in, the cart loaded twice at the same time.** It now loads once.

## 3. Joseph's notes
### "Pinned location doesn't appear on the receipt"
Everywhere a place is written down, it now shows in full:
- the address people typed;
- the landmark they typed or picked from the list;
- the pin as a **Plus Code** (for example `6CRF858V+62`), with its coordinates;
- an **Open in Google Maps** link.

A Plus Code works in Google Maps, even offline, and can be read out over the phone. That matters where there is no street address.

Where it shows:
- **The "Booking request sent" screen.** This was the receipt that only said "Location pinned on the map".
- **The store receipt (PDF).** It shows where the goods went, or for a collected order, where to collect them.
- **The delivery receipt (PDF).** It shows where the goods were collected and where they were delivered, each with its Plus Code.
- **The booking invoice (PDF).** It shows where the work was done. For a ride, it shows the pick-up and the drop-off.
- **The courier's delivery card** (Collect from / Take to). It also shows each Plus Code now.

Privacy is unchanged. Only the customer, and whoever carries the goods there, see where they are going. A seller whose buyer collects the goods never sees the buyer's pin. (Tested.)

### "There is no Market features for administrator, no way to regulate the market"
There is now an **Admin → Market** section. It follows how eBay, Jumia and Facebook Marketplace run theirs, and the EU Digital Services Act's "notice and action" rules (articles 16, 17 and 23). It has these tabs:
- **At a glance.** What needs the team (listings held or reported, goods waiting, orders with a problem, returns, stolen-item reports), and the Market's numbers.
- **To check.** Listings held by the safety checks, and listings people reported. Approve one, or take it down; the seller always sees the reason.
- **Listings and Store goods.** Every item, searchable, filtered by status. Any item can be taken down.
- **Sellers.** Everyone who sells, with the most reported first. **Stop a seller** for 7, 30 or 90 days, or until lifted:
  - their listings come off sale and their store closes;
  - they can't list anything new, and they are told why;
  - orders already paid for carry on, so no buyer loses out;
  - **Allow selling again** puts it all back.
- **Orders.** Every store and Market order: in progress, with a problem, completed or cancelled.
- **Stolen items.** Reports, the listings that matched, and closing a report with a note.
- **Team activity.** Every action, with who did it and when.
- **Fees.** The Market fee settings, moved here from Stores & Skills.

An admin only sees sellers in their own area. Custom admins get a new "Market" permission: see; stop sellers; close stolen reports.

### "Please add bicycle to delivery"
- **Bicycle is now the second choice**, after motorbike, under "What I deliver with".
- **The ride-driver form now points couriers elsewhere.** It says that someone delivering by bicycle or on foot doesn't need it (no licence or number plate). They add "Pick & Drop" to their skills instead.

### "Pickup and drop and car should indicate between which distance they travel"
Every driver now has a **distance range**:
- Each vehicle has a most it can be set to: on foot 3 km, bicycle 10 km, keke 30 km, motorbike 50 km, car 200 km, van 300 km, truck 500 km. These follow Glovo, Uber Eats and Deliveroo, which keep bicycles to short trips.
- Each driver can narrow their own range, for example "from 2 km, up to 8 km", under Deliveries. Ride drivers who also deliver set it on their Rides page.
- **Buyers see it on each driver's card**, for example "Bicycle (up to 5 mi)".
- **A driver is only offered trips inside their range.** If nobody in range is free, the buyer is told: "No driver who goes this distance is available right now."
- **Picking someone out of range is refused before any money is taken.**
- Distances show in miles or kilometres, by country, as before.

### "One week free subscription, and start from 50 LD, 100"
How I read this (all of it can be changed in the admin pages):
- **Tokens in Liberia now start at L$50 and L$100.** These are new fixed-price packs, before Mini, Small, Medium and Large. That is how airtime and mobile money are sold: in small amounts.
- **Every newly approved driver gets one free week of the Driver Pass** (no commission on their rides).
  - They press **Start my free week** when they are ready to drive, so the week isn't used up before they start.
  - It can only be used once.
  - Admin → Rides sets how many days (0 turns it off).
- **The pros' monthly plan fee already starts free.** Nothing is charged while plan billing is off. Once it is on, a new pro pays nothing for their first 30 days, which is longer than a week, so I left it.

**Business step for you:** if the Liberia token packs were already edited in Admin → Tokens on the live site, your saved packs stay as they are. The L$50 and L$100 packs only appear on their own where the defaults are in use. Add them in Admin → Tokens → Liberia if needed (price L$50, 0.26 tokens; L$100, 0.52 tokens).

### Your screenshot: clothes under "Plumbing Supplies"
The Market put **every good in a store under the store's own aisles**. NAJ Fashion House has "Plumbing Supplies" among its aisles, so its dresses showed there. "Materials for this job" had the same fault: a plumbing job could have been offered clothes.

International marketplaces (Jumia, eBay, Amazon) put each item in its own category. Trothen now does the same:
- **Each good has its own Market category.** The seller chooses it on the good's form in My Store. The form suggests one from the good's name, for example "Choose for me from the name (Fashion & Clothing)".
- **Goods already on sale are sorted from their name, description and section,** so nobody has to do anything. "clothes", "dress" or "lappa" go under Fashion & Clothing; "PVC elbow", "pipe" or "tap" under Plumbing Supplies; "drill" or "gloves" under Tools & Equipment; and so on for every aisle. Only whole words count, so "brass" is not read as "bra".
- **A good whose name says nothing** (for example "Fitting 3") still shows in the store's own aisles, as before.
- **"Materials for this job" only offers goods in that job's aisles.** The hired pro's own store still shows everything.

Also on those cards:
- **Seller names start with capitals:** "Joseph K.", not "Joseph j.".
- **The star stays with its number** ("★ 2.0"), instead of the star ending one line and the number starting the next. Its colour is darker, so it is easier to read.

## 4. Your question about the empty cart
For a visitor who isn't signed in, it wasn't best practice:
- **It was a dead end.** Baymard Institute's checkout research says an empty cart must always offer a way on. For visitors there was no button at all.
- **It promised something untrue for a visitor.** It said goods stay "on any device you sign in on", but a visitor's cart is only on that device.

Now a visitor sees:
- an honest line: "Add goods from a pro's store and they wait here. Signed in, your cart follows you to any device";
- a **Browse pros and their stores** button;
- a **Sign in to see your cart** link.

A signed-in person still sees **Browse the Market**. Admin accounts are told carts are for customer and pro accounts. The cart icon is the same as the one in the top bar (not the orange emoji). Spanish is included.

## 5. Deliveries, end to end, on three phones
I added a new test that walks one delivery through, with real taps and each phone's own location:
1. **The buyer** adds a tap to the cart and checks out with "A pick-and-drop driver brings it". She presses **Use where I am now** (her pin shows as a Plus Code), chooses the bicycle courier, and pays.
2. **The courier** sees where to collect and where to deliver, both Plus Codes, and her own distance settings. She accepts.
3. **The seller** marks the order packed. They hand it over by typing the courier's pick-up code and taking a photo.
4. **The courier** records the drop-off with the buyer's code and a photo.
5. **The buyer** presses **I have my goods**. The order and the delivery complete, and the courier is paid.
6. **Both receipts** show the pick-up and the drop-off with their Plus Codes.

What this found, and I fixed:
- **Saving the courier's drop-off took 12 seconds.** It waited for a second location fix, though her phone was already following her position for live tracking. It now uses that position, and saves in a quarter of a second.
- **The delivery request said "by 5:38 PM UTC server time".** The time was already in the driver's own time zone, so the leftover "server time" is gone.
- **The "Install the Trothen app" card and a new notification could stack** at the bottom of the screen, covering the buyer's **I have my goods** button. Following Google's guidance for install prompts, the card now:
  - only shows at a calm moment: the home page, or the first page of a dashboard;
  - never shows during a task, or while a new notification is showing;
  - steps aside when someone moves on to a task.
- **Vehicle names now start with a capital** ("Bicycle", not "bicycle").
- **Admin → Market: pressing two tabs quickly could leave the first one on screen.** The final run on Postgres caught this: a slower answer for the first tab arrived last and painted over the second. The tabs now draw one after another, so the last tab pressed always stays. (Tested.)

## 6. What the tests check now
- **`t164` (78 checks):**
  - carts changed at the same moment;
  - the saved-for-later limit;
  - pins on receipts, and who sees them;
  - every Admin → Market action, and stopping and allowing a seller;
  - each good in its own Market category, "Materials for this job", and capitalised seller names;
  - distance ranges, and refusing an out-of-range driver;
  - the L$50 and L$100 packs, and the free week;
  - the visitor's empty cart;
  - Admin → Market on a laptop and a phone;
  - signing out and straight back in on the same page;
  - the install card's timing.
- **`tdelivery` (24 checks):** the delivery above.
- **Every earlier suite**, on the file store and on Postgres. Three older tests now look for the Market panels in Admin → Market instead of Stores & Skills.

## Files
- **New:**
  - `src/plus-code.js`
  - `src/routes/market-admin.routes.js`
  - `public/app/market-admin.js`
  - `CHANGES_v164.md`
- **Changed (server):**
  - `server.js`
  - `src/cart.js`
  - `src/store.js`
  - `src/store-orders.js`
  - `src/market.js`
  - `src/tokens.js`
  - `src/ride-pass.js`
  - `src/platform-settings.js`
  - `src/admin-permissions.js`
  - `src/pdf-report-builder.js`
  - `src/routes/orders.routes.js`
  - `src/routes/market.routes.js`
  - `src/routes/store.routes.js`
  - `src/routes/business.routes.js`
  - `src/routes/rides.routes.js`
  - `src/routes/tokens.routes.js`
- **Changed (page):**
  - `public/index.html`
  - `public/app/trothen.js`
  - `public/app/cart.js`
  - `public/app/market.js`
  - `public/app/store-plus.js`
  - `public/app/rides.js`
  - `public/app/permissions.js`
  - `public/app/es-v152.js`

No database changes and no new packages. The new settings (`ridePassFreeDays`) and the new user fields (`deliveryRange`, `marketBan`) start empty and fill in as they are used.
