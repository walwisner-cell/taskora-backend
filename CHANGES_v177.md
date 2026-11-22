# Trothen v177: the right details for every kind of good

v177 goes on top of v176. This package includes v174, v175 and v176, so it's the one to deploy.

## What you asked
"How about for phones and electronics, building materials and many more?" After v176 gave clothes their sizes and size charts, you wanted every other kind of good to have proper details too.

## What was there before
Apart from clothes, a seller could give a name, a description, a brand, the condition and options ("sizes or colours"). A phone's storage, an appliance's voltage or a bag of cement's grade could only go in the description, where buyers couldn't compare or search them.

## What I added
1. **Details for each kind of good** ("item specifics", as on Amazon, eBay and Jumia; GS1, the global product data standard, groups them the same way). The form shows the details for the good's Market category:
   - **Phones & Tablets:** model, storage, RAM, colour, network (4G or 5G), SIM (single, dual, eSIM), locked or unlocked, battery health, screen size, operating system, warranty, what's in the box.
   - **Computers & Electronics:** type, model, processor, RAM, storage, screen, operating system, **voltage**, **plug type**, power (W), warranty.
   - **Appliances:** model, voltage, plug type, power, capacity, size, energy rating, warranty.
   - **Building & Hardware:** material, grade or standard (e.g. "Cement 42.5N"), **sold by the** (piece, bag, bundle, sheet, length, m², m³, ton, truck load…), pieces in each, size, thickness or gauge, length, weight, made in.
   - **Plumbing:** material (PVC, PPR, GI, copper…), diameter (½ inch to 6 inch, with mm), length, pressure rating, standard.
   - **Electrical:** voltage, current, power, cable size (0.75 to 50 mm²), cores, length, standard, water and dust rating (IP20 to IP68).
   - **Paint:** type, colour, volume, finish (matt to gloss), inside or outside, coverage, drying time.
   - **Vehicles & Parts:** make, model and year (or the ones it fits), part number, position on the vehicle, fuel, gearbox, mileage.
   - **Food:** net weight, ingredients, **allergens**, how to store it, suitable for (halal, vegetarian), made in.
   - **Tools, Furniture, Garden, Cleaning, Health & Beauty, Fashion, Baby & Kids, Sports, Books (author, ISBN), Farm (N-P-K, active ingredient, variety)** and **Other**, each with its own.

   Every detail is optional. Choices are picked from a list, so "128 GB" is always written the same way and buyers can compare. A count shows the seller how many they've filled in ("Details filled in: 10/12"). Sellers can also add **up to 5 details of their own** (e.g. "Charger: 25 W fast charger included").
2. **The details follow the category.** Changing the category changes the fields. Anything already typed stays on screen, so nothing is lost by mistake. With "Choose for me", the fields follow the name as the seller types it ("PVC pipe" shows the plumbing fields).
3. **Option sets that fit the good.** One tap fills in:
   - phone storage (64 to 512 GB);
   - computer storage or RAM;
   - pipe sizes (½ to 2 inch);
   - cable sizes (1.5 to 6 mm²);
   - paint tins (1, 4 and 20 litres);
   - rod diameters or nail lengths;
   - food pack sizes.

   The clothing sizes and the size chart from v176 now show only for clothes, children's goods and sports, so a phone doesn't get a size chart.
4. **Buyers see a "Details" table** on the good's page, above the description, and on a person's Market listing. Choices and units are shown in Spanish when Spanish is chosen; the seller's own words stay as they wrote them. The **Market card** shows the first three details under the name ("Galaxy A15 · 128 GB · 4 GB").
5. **Search finds the details.** "128gb", "128 GB", "dual sim" and "42.5N" all find the right goods, in stores and in people's listings.
6. **The same in the Market's "Sell an item" form.**
7. **Checks on the server:**
   - choices must be from the list;
   - numbers must be sensible (battery health 1 to 100%);
   - ISBNs must be real (the check digit is tested);
   - unknown details and over-long text are refused;
   - **no IMEI or serial numbers** in the details (they stay private in the ownership part of the form, as since v143);
   - banned words are checked in the details too.
8. **Store managers check changed details,** as they already did for a new name, brand or photos, because a detail like "Unlocked" or "1 year warranty" is a claim to the buyer.

All of it is in Spanish too.

## The full recheck you asked for ("make sure there are no gaps")
I re-ran every test from v128 to v177 on both the file store and Postgres, read every change from v174 to v177 line by line, and checked the modules against best practice. I found and fixed six gaps:

1. **Store managers couldn't see what they were approving.** A good sent back for review showed only its name, price, description and photos. Now Admin → Stores also shows the category, brand, condition, the sizes or colours, whether it has a size chart, and the full Details table.
2. **The same gap for Market listings held for a safety check:** the team now sees the description and the details.
3. **Deleting an account left a listing's details behind** (the title, description and photos were cleared, the new details were not). They are now cleared too.
4. **Google sign-in had no limit on tries.** It now has the same limit as normal sign-in (OWASP: every sign-in route is throttled).
5. **Mobile Money payment notices had no limit.** MTN doesn't sign them (Trothen asks MTN directly whether each payment is real), so anyone could have flooded that address to make Trothen call MTN again and again. They are now capped at 120 a minute.
6. **Fake discounts.** A seller could raise a price and start a "50% off" sale at the same moment, so the "was" price was never real. Now a sale can start only 30 days after a price rise, the rule of the EU Omnibus Directive (2019/2161) and the same idea as Amazon's and Jumia's reference prices. Lowering a price is always allowed, and the seller is told the date the sale can start.

Checked and already in order: security headers (HSTS and the rest), hashed passwords, limits on sign-in, sign-up and reset codes, signed Stripe and Persona notices, every admin action behind an admin sign-in, "Download a copy of my data" and account deletion covering goods and listings, prices in each country's money with ISO currency codes, phone numbers in the international (E.164) format, and the screen-reader and keyboard checks from v151.

## Tests
- `t177` (new), 51 checks (the 44 below, plus the managers' and the team's view of the details, and five checks on fake discounts):
  - every category has its details;
  - Trothen's category guess from a name;
  - a phone's details saved;
  - nine kinds of bad details refused (one not on the list, battery 150%, an unknown detail, an IMEI, a serial number, a wrong ISBN, 6 details of their own, one with no value, too long);
  - a refused change leaving the saved details untouched;
  - changed details going to the managers;
  - cement's details in order;
  - search for "128gb", "dual sim" and "42.5N";
  - a Market listing with details;
  - in the browser:
    - the phone's form filled in with the count;
    - the storage option set (and no clothing sizes or size chart);
    - adding a detail of their own and saving;
    - switching to Fashion (its fields, the sizes and the chart back);
    - a new good's fields following its name;
    - on an iPhone: the Details table, the Market card line, the listing's details, the sell form's cable sizes;
    - Spanish.
- Every earlier suite (including `t176`, 30 checks), on the file store and on Postgres.

## Files
- `src/specs.js` (new: the list of details and the checks)
- `src/routes/store.routes.js` (details on goods, the managers' check and view, no fake discounts)
- `src/routes/market.routes.js` (the list sent to the app, the category guess, details on listings, search, the team's view)
- `src/routes/auth.routes.js` (Google sign-in limit)
- `src/routes/custpay.routes.js` (Mobile Money notice limit)
- `src/account-privacy.js` (details cleared when an account is deleted)
- `public/app/trothen.js` (Admin → Stores shows the details)
- `public/app/specs.js` (new: the details in the forms and the buyer's table)
- `public/app/store-plus.js` (the good form, option sets, the good's page)
- `public/app/market.js` (the sell form, the listing, the Market card)
- `public/app/es-v152.js` (Spanish)
- `public/index.html`

No database changes and no new packages.

## What is yours to do (not code)
- **Tell your sellers.** Phones, electronics and building materials sell better with their details filled in. Ask them to edit each good and fill in the details. It takes a minute per good.
- **Store managers:** when a good comes back for review only because its details changed, check that they make sense (e.g. that a "used" phone with "Battery health 100%" is believable). You can set a rule for your team: for example, phones must have storage, network and locked/unlocked filled in before you approve them.
- **Claims are the seller's responsibility.** A warranty, "unlocked" or an allergen list is a promise from the seller to the buyer. If it's false, the buyer reports a problem and the dispute process decides. It's worth stating this in your seller terms. That's a legal call for you.
- **Sales and "was" prices:** tell your sellers about the 30-day rule before they meet it. Put it in your seller rules as well.
- **Backups and a second copy of the data** are a hosting decision (Render's disk snapshots or Postgres backups). Check they are on and that someone has tried a restore once.
- **Food sellers:** many countries (Liberia's food rules and the international Codex standard among them) require ingredients, allergens and a best-before date on packaged food. Trothen now has a place for all three. Whether to make them compulsory for food is a business and legal decision for you.
