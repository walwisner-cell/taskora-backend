# Trothen v176: sizes, size charts and descriptions, done properly

v176 goes on top of v175. This package includes v174 and v175, so it's the one to deploy.

## What you asked
"How do I include sizes and description, best practice and international standards?", with a screenshot of NAJ Fashion House's dresses, all named "clothes". Then: "Build what's not there, and it should be perfectly done."

## What was already there
- A description: one line, up to 400 characters.
- "Sizes or colours" (each with its own price and stock).
- Brand and condition.
- A buyer must choose a size before adding the good to the cart.

## What I added
1. **One-tap size sets.** In the form, under "Sizes or colours":
   - XS to XXL;
   - UK 6 to 20;
   - US 2 to 16;
   - EU 34 to 48;
   - shoes EU 36 to 46;
   - children 2 to 12 years.

   One tap fills them in. Sizes already typed are kept, and "Called" becomes "Size".
2. **A size chart.** It's under the sizes, with a row for each size.
   - The seller ticks the measurements that apply: bust, chest, waist, hips, length, shoulder, sleeve, inside leg, foot length (up to 6, named as in ISO 8559, the international standard for body measurements).
   - They type them in cm or inches; switching converts what was typed.
   - Trothen keeps them in centimetres.
   - Buyers see the chart in cm or inches with one tap, with their chosen size highlighted and the line "Measurements from the seller. Compare with a garment that fits you well."
   - Silly numbers (over 400 cm) and unknown measurements are refused.
3. **A real description.**
   - It's a box with several lines now, not one line, and holds up to 2,000 characters (it was 400). Line breaks are kept.
   - The box shows what to write: material (100% cotton), fit (true to size, loose, stretchy), measurements, care (hand wash cold), and what's included.
4. **A page for each good, as on Jumia or Amazon.** Tapping a good in the Market or in a store opens it. Before, the Market opened the whole store.
   - all its photos (tap a small one, or use the arrow keys on a computer, to switch);
   - the name, brand, condition and stars;
   - the price, with any sale;
   - the sizes as buttons, sold-out sizes crossed out, and "Only 5 left";
   - "Add to cart" (it asks for a size first if there are sizes);
   - the full description, the size chart, the delivery size and the return policy;
   - "Visit the store".

   It fits a phone, closes with × or Escape, and works with a screen reader (a proper dialog, sizes as a choice group, a real table). On the store page, each good shows the first 3 lines of its description and "More details" (or "Details and size chart").
5. **A tip for vague names.** When a seller types "clothes", "item", "dress", "goods" and so on, a tip appears under the name:
   > "Say what it is, so buyers can find it: the type, style, colour or material and who it's for. For example: "Women's red A-line midi dress" or "Floral maxi sundress, cotton"."

   It's a tip, not a block.
6. **My v174 mistake is fixed.** "Size for delivery" appeared twice in the form; now it's once, with the same wording as at checkout (Small: fits in a bag; Medium: fits on a motorbike; and so on).

All of it is in Spanish too. I also translated some older words in the form that had been missed ("Add a size or colour", "price", "stock").

## Tests
- `t176` (new), 30 checks:
  - the chart saved in cm with the seller's unit remembered;
  - the description keeping its lines;
  - silly measurements, unknown measurements and over-long descriptions refused;
  - buyers getting the chart;
  - one "Size for delivery";
  - the chart in the form converting between cm and inches;
  - the name tip;
  - "UK 6 to 20" filling in 8 sizes and keeping S, M and L, with the chart following;
  - saving it all;
  - on an iPhone: the good's page with 3 photos, sizes (sold-out M not choosable), the chart, a proper dialog;
  - Add to cart asking for a size, then putting size L in the cart;
  - Escape closing it;
  - tapping the dress in the Market opening its page;
  - Spanish.
- Every earlier suite, on the file store and on Postgres.

## Files
- `src/store.js`, `src/routes/store.routes.js` (the size chart; the longer description)
- `public/app/store-plus.js` (size sets, size chart, the good's page)
- `public/app/trothen.js` (description box, name tip, the duplicate field removed)
- `public/app/market.js` (the Market opens the good's page)
- `public/app/cart.js` (Add to cart with a size)
- `public/app/es-v152.js` (Spanish)
- `public/index.html`

No database changes and no new packages.

## What is yours to do (not code)
- **Tell NAJ Fashion House and your other sellers:**
  - rename each good (the tip will remind them);
  - add the sizes with one tap;
  - fill in the size chart;
  - write a description.
- **When the store managers review goods,** they can now ask for a clear name and a description before approving. That's a business rule you can set for your team.
- **The photos with another shop's watermark ("Candy#8871"):** ask the seller whether they have permission to use them. Big marketplaces remove listings with another seller's watermark. That's a business and legal call.
