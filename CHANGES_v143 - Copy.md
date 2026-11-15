# Trothen v143: the store, complete (returns, sizes, sales, discount codes, reviews, saved items, delivery by distance)

This one package includes everything since the version on your GitHub `main` before v128: v128 to v142, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
- Look at the store again: make sure everything is there with no gaps, following international best practice.
- How do we make sure people don't sell stolen items? Customer verification should be done.

## What was already there
- **Checks and rules:**
  - every store and good is checked by a manager first;
  - sellers agree to store rules;
  - banned items are refused;
  - each good needs at least one photo.
- **Stock and prices:**
  - stock is held at purchase;
  - the seller is warned when stock runs low;
  - the seller can record what a good cost them;
  - prices can be in US$ or local money;
  - stores can set trade prices for pros.
- **Collection and delivery:**
  - opening hours, a pickup place and a map pin;
  - three ways to get goods (collect, the seller brings them, a driver brings them), with photos and codes at hand-over and live tracking;
  - an order the seller doesn't pack in time is refunded automatically;
  - orders complete by themselves after hand-over.
- **Money:** Trothen holds the money until the buyer has the goods, with receipts and seller ratings.
- **Market:** goods show in the Market, with scam checks.

## What was missing, and is now added
### 1. Returns (Jumia, Amazon and the EU all have them)
- **A returns policy for every business store.** Every store takes back faulty, wrong, damaged or not-as-described goods for at least **7 days** after the order is complete. You can change this minimum in Admin → Stores & Skills.
- **What a store can add:**
  - a longer window, up to 30 days;
  - change-of-mind returns;
  - its own conditions (for example "unused, in the original packet");
  - who pays to send goods back.
- **Buyers see the policy** in the store, at checkout, and on their order.
- **How a return works:**
  1. The buyer presses **Return an item**, chooses what and how many, and says why.
  2. The seller accepts or declines within 3 days. No answer means the return is accepted.
  3. The buyer brings or sends the goods back and presses **I've sent it back**.
  4. The seller presses **I have it back**. The buyer is refunded what they paid for those goods (after any discount), and the goods go back on the shelf.
  5. If the seller declines, or doesn't confirm within 7 days of the goods being sent, the buyer can press **Ask Trothen to decide**. The team decides in Admin → Stores & Skills → **Store returns**, with a note both sides see.
- **Why a refund is always possible:** the seller's money for an order is paid after its return window ends, the way Jumia and Amazon do it. Market money shows it as held, with the date. Once a return is settled, the rest is paid.
- **Private sellers** in the Market have no returns, as is usual. Report a Problem still covers items that weren't as described.

### 2. Delivery priced by distance, in L$
- **The seller's own delivery:** a seller can charge **by distance**, at Trothen's motorbike fare for the country (Admin → Rides → Fares), instead of one flat US$ charge.
- **Pick & Drop drivers:** they're priced on the same fares for their vehicle, where the country has fares set.
- **Approved ride drivers now carry deliveries too.** No separate Pick & Drop application is needed, and Deliveries shows in their menu. They can switch this off on their Rides page.

### 3. Sizes and colours
- **Up to 20 options per good**, for example sizes M, L and XL. Each has its own price (or the good's price) and its own stock.
- **Buyers choose one before adding it** to their basket. A sold-out option can't be chosen.
- **Previously,** each size had to be a separate good, using up the 60-good limit.

### 4. Sales
A seller can put a good on sale (for example 20% off), with an optional end date. Buyers see "−20%", the new price and the old price crossed out. The sale ends by itself.

### 5. Discount codes
- **What a store can set:** up to 20 codes of its own (for example SAVE10), either a % or an amount off, with an optional minimum order, end date and number of uses.
- **Who pays for it:** each customer can use a code once. The discount comes off the seller's goods money, and Trothen's fee is worked out on what the customer actually pays.

### 6. Product reviews
- **Who can review:** only someone who bought the good, once per order, after the order is complete ("Verified purchase").
- **Where it shows:** stars show on the good in the store, with the reviews one tap away, and the seller is told.

### 7. Product details
- **New fields:** brand, condition (new, used or refurbished), a section of the store (the store groups its goods by section), size for delivery, and an expiry date for food and anything that goes off.
- **Checked like the rest:** a new brand, or new sizes or colours, is checked by a manager like a new name. This stops fake branded goods.

### 8. Saved goods
- **How:** buyers press ♡ to save a good, and see them all under **Saved**.
- **Back in stock:** if a saved good is sold out, they're told when it comes back.

### 9. Keeping stolen goods out of the Market
This follows eBay, Jiji, OLX and Facebook Marketplace, and the phone-theft registries used in Kenya, Nigeria and the UK (CheckMEND):

- **Everyone is ID-checked:** customers must verify their ID before they buy, book or post a job, and sellers before they list. Every sale is linked to a real, checked person, so a stolen item can be traced to whoever sold it.
- **The seller declares ownership:** every listing needs a tick for "I own this item and have the right to sell it. It is not stolen, borrowed, or still being paid for." It warns that selling stolen goods is a crime and that the team can help the police.
- **Numbers are needed:**
  - phones and tablets need their **IMEI** (dial *#06#);
  - computers need their **serial number**;
  - vehicles need their **chassis or engine number**;
  - parts and accessories are exempt when the seller ticks that box;
  - for appliances and tools (generators), a serial number is optional;
  - buyers see only the last 4 ("IMEI ending 5678"), with how to check it matches before paying.
- **Proof of ownership for $200 or more:** these items also need a photo of the receipt, the box showing the same number, or the registration papers. Only the team sees it; buyers see "Proof of ownership given".
- **"Register a stolen item"** (in the Market): anyone whose phone, laptop or motorbike was stolen enters its number. What happens:
  - a listing with that number, now or later, is held at once;
  - the team gets an urgent flag ("Stolen Item Listed") and the seller's account is paused;
  - the seller is only told the listing is "being checked", so they aren't tipped off;
  - the team can contact the owner and, if they wish, the police.
- **The same number listed by two different people** is held.
- **A private seller listing more than 3 phones, laptops or vehicles in 30 days** is held. This is the pattern of reselling stolen goods; registered stores aren't affected.
- **Numbers are stored as a fingerprint,** never in readable form, except the last 4.
- **Unchanged since v140:** words like "stolen" or "no papers" are banned, photos already used by another seller are caught, items priced far below the usual price are held, and buyers can report a listing.

### Also fixed
My Store told sellers "the customer pays Trothen a flat fee of $5". That was out of date since v139: Trothen keeps 8% of the goods money (at least $0.50), and the customer pays nothing extra. It now says so.

## What I tested (74 new checks)
- **Sizes, sales and codes:**
  - a good with sizes M and L (L at its own price), 20% off: $8, was $10;
  - shoppers see the sizes, the sale, a sold-out size and the returns policy in words;
  - a size must be chosen, and a sold-out size can't be bought;
  - SAVE10 on $16 comes to $14.40; a minimum order is enforced; one use per customer, and uses are counted;
  - the order holds the discounted amount, the size and the returns policy, and the size's stock goes down.
- **Saved and reviews:**
  - saved goods; back in stock tells the customer;
  - reviews: verified buyers only, once per order, only goods in the order, and stars show in the store.
- **Returns:**
  - not before the order is complete;
  - the money is held during the window;
  - returning 1 of 2 gloves after a 10% code refunds $7.20, and the size goes back in stock;
  - one return per order;
  - declining needs a reason;
  - the team refunds a declined faulty return in full;
  - a seller who doesn't answer in 3 days: the return is accepted.
- **Delivery:**
  - the seller's delivery charged by distance;
  - an approved ride driver is offered for deliveries, priced on the fare table, unless they switch it off.
- **Stolen goods (21 checks):**
  - the ownership tick is required, a phone needs its IMEI, an accessory doesn't, and $200+ needs proof;
  - buyers see IMEI ending 5678 but never the proof photo, and the number is stored as a fingerprint;
  - registering it stolen holds the live listing, raises an urgent flag and pauses the seller, who is only told "being checked";
  - the same number listed later by someone else is held, with both reasons shown to the team;
  - a 4th phone in 30 days from a private seller is held;
  - the owner sees what they registered and can mark it found;
  - on screen: the sell form asking for the IMEI and proof, the buyer's view, and registering a stolen item.
- **On screen:**
  - the store window: sale, stars, sizes, returns policy, discount codes;
  - the checkout with a code ($16 → $15) and the order paid;
  - the buyer's orders with returns and "Rate", and rating a good;
  - Saved;
  - My Store with returns, codes, a return to accept, and the right fee wording;
  - the good form adding size XL and a 30% sale;
  - Admin → Store returns;
  - a phone screen.
- **Earlier tests, all still passing:** listed in the deployment steps.

## Good to know
- **The 7-day hold:** sellers are paid 7 days after an order completes (or after their own longer window). That's the cost of guaranteed refunds. You can lower it, or set it to 0, in Admin → Stores & Skills.
- **Legal (attorney):** consumer return rights differ by country. Check the minimum window for each country you serve.
- **Legal (police):** decide with an attorney how Trothen answers police requests about a seller (what is shared, with what paperwork). The records are kept: ID, listings, sales and messages.
- **Business: sales tax.** Each seller is responsible for their own tax. An accountant should confirm whether Trothen must collect Liberia's goods and services tax on store sales.

## Files
- **New:**
  - `src/store-extras.js`
  - `src/stolen-goods.js`
  - `public/app/store-plus.js`
- **Changed:**
  - `src/store.js`
  - `src/store-orders.js`
  - `src/store-order-sweep.js`
  - `src/commission-statement.js`
  - `src/admin-permissions.js`
  - `src/routes/store.routes.js`
  - `src/routes/orders.routes.js`
  - `src/routes/market.routes.js`
  - `src/routes/rides.routes.js`
  - `public/app/trothen.js`
  - `public/app/rides.js`
  - `public/app/market.js`
  - `public/index.html`

**What's needed:** no new packages, database changes or settings.
