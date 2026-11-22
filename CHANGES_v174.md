# Trothen v174: delivery prices and sizes, done properly

v174 goes on top of v173, which is live.

## What you asked
You asked how deliveries work and what best practice is, with a screenshot of your Deliveries page. Then: "Can you fix all the gaps so we can deploy. Best practice and international standards."

## What was wrong on your screen
1. **"$50.00 flat" was your price as a pro, not a delivery price.** A driver who hadn't set delivery prices was offered at the listed price for their main work. For you, that meant $50 for any delivery.
2. **It was in US$ for a Liberian account.**
3. **It was also wrong.** For a car in Liberia, deliveries were already priced by Trothen's L$ fares (the ride fares), so the US$ boxes did nothing for a car. The page didn't say so.
4. **The longest trip defaulted to the vehicle's furthest, 124 miles for a car.** City delivery apps keep it to about 15–25 miles.
5. **Nothing stopped a fridge being sent with a bicycle.**

## How it works now (the same way Glovo, Bolt Send, Uber Connect and Jumia do it)
- **One price rule, in this order:**
  1. Where Trothen sets the fares for the country and vehicle (Liberia: motorbike, keke, car and van, in L$), deliveries use them, just like rides.
  2. Otherwise (a bicycle, a truck, someone on foot, or a country with no fares), the driver's own price: a starting price plus a price per mile or km.
  3. **A driver with neither is not offered at all.** Nobody is ever charged a pro's service price for a delivery.
- **In the country's own money:**
  - The Deliveries page shows the fares in L$, with examples ("1.9 mi: L$395 · 5 mi: L$795 · 9.3 mi: L$1,360").
  - A driver who sets their own price types it in L$. Trothen keeps the record in US$ at the day's rate, as it does for goods.
  - At checkout and in the Market, each driver's price shows as "L$795 · $4.18", marked "Trothen fare" where it is one.
  - The messages to the customer and the driver say "L$795 (US$4.18)".
- **A city range by default:**
  - on foot 3 km;
  - bicycle 8 km;
  - motorbike 25 km;
  - keke 20 km;
  - car 40 km (about 25 miles);
  - van 60 km;
  - truck 100 km.
  - The driver can still raise it up to the vehicle's maximum. Ranges a driver already saved are kept.
- **Sizes**, as courier services describe them. A seller sets the size on each good in their store, or on a Market listing:
  - **Small:** fits in a bag (phone, documents, food, clothes). Any vehicle.
  - **Medium:** fits on a motorbike (shoes in a box, a small appliance, a 25 kg bag). Motorbike and up.
  - **Large:** needs a keke or a car (a TV, a microwave, a chair).
  - **Bulky:** needs a van or a truck (a fridge, a bed, furniture, building materials).
  - An order is as big as its biggest good. At checkout only drivers whose vehicle can carry it are shown ("Size of these goods: Bulky. Only drivers whose vehicle can carry them are shown"), and the server refuses anything else.
  - Goods with no size given work as before (not checked). Ask your sellers to set it on their big items.
  - The driver sees the size on each delivery request.
- **Unchanged, and already best practice:**
  - payment held until the customer has the goods;
  - a code at pick-up and at drop-off, with photos;
  - live tracking;
  - the next driver asked automatically if one doesn't answer in 10 minutes;
  - the seller and the driver paid separately.

## Tests
- `t174` (new), 27 checks:
  - the L$ fares and examples;
  - a driver with no price not offered (no more $50);
  - a price typed in L$ saved correctly, and silly prices refused with the limits said in L$;
  - prices sent for a Trothen-fare vehicle ignored;
  - checkout in L$ with "Trothen fare";
  - the city range;
  - sizes: medium goods not offered to a bicycle, a fridge only to a truck, and the server refusing a fridge on a motorbike and a driver with no price;
  - a normal order going through;
  - the seller setting a size;
  - in the browser: your exact screen (a car in Liberia) showing L$ fares and 24.9 miles, switching to a bicycle to type L$ prices, and the size in "Edit this good".
- Every earlier suite, on the file store and on Postgres.

## Files
- `src/store.js` (sizes, city ranges)
- `src/store-orders.js` (the price rule, local money, sizes)
- `src/routes/orders.routes.js` (the driver's page, checkout, checks)
- `src/routes/market.routes.js` (sizes on listings, checks)
- `src/routes/store.routes.js` (size on goods)
- `public/app/trothen.js` (Deliveries page, checkout, good form)
- `public/app/market.js` (listing form, driver prices)
- `public/app/es-v152.js` (Spanish)
- `public/index.html`

No database changes and no new packages.

## What is yours to do (not code)
- **Check the L$ fares** in Admin → Rides → Fares with Joseph. Until you save your own, Liberia uses the starter fares (motorbike L$50 to start plus L$25 a km, and so on). Deliveries now use the same fares.
- **Drivers on a bicycle or a truck** must set their price on the Deliveries page to be offered deliveries. Tell them.
- **Ask your sellers** to set "Size, for delivery" on large and bulky goods.
- **Lost or damaged goods:** decide whether Trothen covers them and up to what value (a written policy, and possibly insurance). Today the dispute process decides each case.
