# Trothen v139: the Market (stores and people), pros as store owners, and a sign-up fix

This one package includes everything since the version on your GitHub `main` before v128: v128 to v138, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
Tie the store into the whole system so pros can be store owners, and add a marketplace. I chose: one Market for stores and personal listings, and for personal items, "Buy with Trothen protection" first with meeting in person also allowed. Everything else: best practice.

## An important fix first: pro sign-up was broken
While building this I found a bug **I introduced in v134**.
- **The bug:** a rename used the wrong name in the email sign-up for pros, so **every pro signing up by email got an error**. Google sign-up and customers were not affected.
- **Which packages have it:** v134, v135, v136, v137 and v138.
- **Is it live?** No. None of them is live yet, but please deploy v139, not one of those.
- **Fixed:** there's now a test that signs up a pro, so it can't slip again.

## 1. Pros as store owners
- **At sign-up**, a pro now chooses **"What will you do on Trothen?"**:
  - **Offer my services:** as before.
  - **Sell goods (a store):** no service category or skills needed.
  - **Both:** services and a store.
- **Changing it later:** Settings has the same choice under "What you do on Trothen".
- **A pro who only sells goods:**
  - is not shown in service search and isn't matched to jobs;
  - has a store that shows in the Market;
  - goes through the same ID check, store approval and goods approval as every store.

## 2. The Market
"Market" is now in the menu for customers and pros. It has three tabs.

**Browse**
- **What's in it:** goods from every live store in your country, plus items people are selling.
- **Finding things:** search, 20 categories (Building & Hardware, Plumbing Supplies, Electrical Supplies, Tools & Equipment, Phones & Tablets, Vehicles & Parts, Food & Groceries, Agriculture & Farm and others), "Everything / Stores / From people", and sort by newest, price or best-rated seller.
- **Store goods** open the store, with the same basket and checkout as before.
- **People's items** open their own page: photos, condition, description, the seller's first name and initial, "ID verified", seller rating, and where to collect.
- **No sign-in needed** to look around. Buying and selling need an account.

**Sell** (anyone with a verified ID, customer or pro)
- **Listing an item:** title, category, condition (new, like new, good, fair), price in US$ or local money, description, up to 6 photos, and where to collect it. A pin is optional.
- **How it can be bought (the seller ticks):**
  - through Trothen (recommended);
  - collected by a pick-and-drop driver;
  - meeting in person for cash.
- **Managing items:** edit, pause, mark sold, delete. Each listing runs 60 days and can be renewed. Up to 30 items at once.
- **Sold through Trothen:** each sale, with **"They have it"** to press once the buyer has the item.
- **Your Market money:** what's ready to cash out and what's still held. Customers cash out here (Mobile Money, bank or PayPal). Pros cash out with their usual earnings.
- **For pros with a store:** choose up to three Market categories for the store.

**My orders**
- **Every purchase,** from stores and people, with the existing buttons: "I have my goods", choose a driver, receipt, Report a Problem, Cancel.
- **New on each order:**
  - the date it completes by itself;
  - **"Rate the seller"** once it's complete.

## 3. Buying from a person
- **Buy with Trothen protection** (shown first):
  - the buyer pays the price plus a small **buyer protection fee** (5%, at least $0.50), and the **seller gets their full price**;
  - the money is held, and the item is reserved so nobody else can buy it;
  - the buyer collects it, or a driver brings it (the same drivers as store orders).
- **Message the seller:** opens a chat to meet in person and pay cash. Safety tips are shown: meet in public in daylight, check before you pay, never send money first.
- **Once there's an order,** buyer and seller can also call each other, even if both are customers.

## 4. Protections for every order (stores and people)
- **Completes by itself:**
  - when the seller marks it handed over (or the driver records the drop-off), the buyer has **3 days** (collected) or **7 days** (delivered) to report a problem;
  - they get a reminder the day before;
  - after that the order completes and the seller is paid.
- **Report a Problem** freezes the money for the Disputes team.
- **Seller ratings:** the buyer rates once per order. Seller ratings are kept apart from service ratings, so a pro's job rating isn't mixed with their shop rating.
- **Reports:**
  - anyone can report a listing;
  - **3 different people** reporting hides it until the team looks;
  - Admin → Stores & Skills shows reported listings with **Keep it on sale** / **Take it down**, and the seller is told the reason;
  - a new permission tick: Stores & Skills → "See Market listings" / "Take down or restore Market listings".
- **Banned goods** (weapons, drugs, medicines, alcohol, tobacco and the rest) are refused for personal listings too.
- **Only verified sellers,** and only their own uploaded photos.

## 5. How Trothen earns on goods (best practice)
- **Store goods: 8% of the goods total, at least $0.50, paid by the seller** when they're paid. This is a referral fee, like Jumia and Amazon charge. **The buyer pays the shelf price and nothing extra.**
  - This replaces the flat $5 fee the buyer used to pay.
  - The flat fee is still there as a choice in the settings.
- **Items from people:** a 5% buyer protection fee (at least $0.50). The seller pays nothing.
- **Meeting in person:** free.
- **All adjustable:** the super admin can change every number in **Admin → Stores & Skills → Market fees and timing** (percentages, minimums, days). Changes apply to new orders.

## What I tested
- **The Market (69 checks):**
  - a pro signing up with a service (the fixed bug), and a goods-only pro without a category;
  - goods-only pros kept out of service search;
  - store goods in the Market;
  - the 8% fee taken from the seller with nothing added for the buyer;
  - a pro buying from another pro's store, and nobody buying from their own store;
  - "handed over", the reminder, completing by itself after 3 days with the money released, and a reported problem stopping it;
  - seller ratings, once per order and kept apart;
  - personal listings:
    - selling needs an ID;
    - banned goods and other people's photos are refused;
    - buying with protection and a driver, with $2 protection on $40;
    - the money held and the item reserved, with a second buyer refused;
    - the driver request;
    - buyer and seller able to call;
    - "I have my goods", then sold;
    - a customer seller cashing out $40 with no commission;
  - cash-only items, 3 reports hiding a listing, and the team restoring or taking it down;
  - the fee settings, and the data download including listings;
  - on screen: Market in both menus, browse, the sell form with a photo, listing, the item page, checkout, My orders, "They have it", the countdown, "I have my goods", rating, the Settings choice, the sign-up choice on a phone, the Market on a phone, and the admin listings and fee settings.
- **Earlier tests, all still passing:**
  - data download (43);
  - calls and voice messages (67 + 22);
  - permissions (95), all admin addresses and disguised addresses, and the route audit;
  - instant updates;
  - commission (25 + 8), categories (22), accepting jobs (27), listed pros (16).

## Good to know
- **What needs a decision from the attorney and accountant:**
  - **Seller terms:** the Market adds sales between people. The store rules and terms cover stores, but not sales between two customers or used goods.
  - **Tax** on goods sold through Trothen in each country.
  - **Liability:** who is responsible if an item is lost in delivery.
- **Payments:** money is still simulated until Stripe or mobile money is connected, the same as everything else.
- **Prices:** a person's item can be priced in US$ or their local money. What's held is US$, converted at the rate when they buy, like store goods.
- **"Report a Problem"** is the returns route. There's no separate returns window after the buyer presses "I have my goods". That button means they're satisfied.
- **Not yet built (phase 2):**
  - "materials often needed" suggestions when a customer posts a job;
  - adding goods from other stores to a job booking;
  - trade prices for pros.

## Files
- **New:**
  - `src/market.js`: the rules, completing by itself, ratings.
  - `src/routes/market.routes.js`: browse, listings, buying, reports, admin.
  - `public/app/market.js`: the screens.
- **Changed:**
  - `src/store.js`: the fee model and settings.
  - `src/routes/store.routes.js`
  - `src/routes/orders.routes.js`: pros can buy, personal sellers, Market details on orders.
  - `src/store-orders.js`
  - `src/routes/marketplace.routes.js`
  - `src/routes/payments.routes.js`: customers can cash out Market sales.
  - `src/routes/auth.routes.js`: the sign-up fix, and services/goods/both.
  - `src/listing.js`
  - `src/routes/calls.routes.js`
  - `src/admin-permissions.js`
  - `src/account-privacy.js`
  - `server.js`
  - `public/app/trothen.js`
  - `public/app/polish.js`
  - `public/index.html`

**What's needed:** no new packages, environment variables or database changes. Listings and seller ratings are stored like everything else.
