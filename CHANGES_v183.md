# Trothen v183: search everywhere, to best practice

v183 goes on top of v182.

## What you asked
"Add search to the marketplace and everywhere that needs it, best practice and international standards."

## What I built

### 1. One search engine for the whole app
A new file, `public/app/search-core.js`, is used both by the server and by the app. That way a search finds the same things wherever you type it. It works the way good shop and directory searches work (Amazon, Jumia, Google):
- **Capitals, accents and punctuation don't matter.** "SAMSUNG", "samsung" and "Samsung," are the same, and so are "café" and "cafe". A number and its unit can be written either way: "128gb" or "128 GB", "12mm" or "12 mm". Amounts can be written either way too: "1,500" or "1500".
- **Plurals and endings.** "phones" finds "phone", and "batteries" finds "battery".
- **Other names for the same thing.** For example:
  - fridge or refrigerator;
  - AC, aircon or air conditioner;
  - phone, mobile or smartphone;
  - rebar or iron rods;
  - sofa or couch;
  - flat or apartment;
  - keke or tricycle.

  The list is short and checked by hand (about 45 groups), so it never guesses wrongly.
- **Small typos.** "samsong" finds Samsung, "refrijerater" finds the refrigerator, and "plumbr" finds a plumber. One wrong letter is forgiven in a word of 4 to 7 letters, and two in a longer word. Words of 3 letters or fewer must be right, or be the start of a word ("tec" finds Tecno).
- **Every word must match.** If nothing has all your words, it says so plainly ("Nothing has all of your words. These match some of them.") and shows what matches most of them.
- **Best match first.** A word in the title counts more than one in the description, a correct word more than a typo, and the whole phrase together gets a bonus.
- **"Did you mean …?"** It corrects each word from the words the Market really has ("samsong refrijerator" → "samsung refrigerator"). It never suggests nonsense.
- **Fast.** It searches 3,000 items with typos in about 0.15 seconds, with no outside service: nothing is sent anywhere.

### 2. The Market search
- **Suggestions as you type:** goods, brands and categories. A matching category comes first; choosing it opens that category.
- **Your recent searches,** when you tap into the empty box. They're kept only on your device, with a Clear button.
- **Results follow your typing.** You don't have to press Search, though Enter and the Search button still work.
- **"Best match" is the new first order** when you search. Newest, price (both ways) and best-rated sellers are still there.
- **"More filters":** lowest and highest price (US$), condition (new, like new, good, fair), town or area (a typo is forgiven), and verified sellers only. "Clear filters" resets them all.
- **Each category shows how many results it has** for your words, for example "Phones & Tablets (2)".
- **The results say what you searched:** "2 results for 'phone'". The words found are highlighted on each card.
- **When nothing is found,** it says so, offers "Did you mean …?", and suggests what to try (check the spelling, use fewer words, clear the filters, try another category).
- **"Show more"** loads the next 40 instead of stopping at the first page.

**Accessibility (WCAG 2.2 and the W3C ARIA "combobox" pattern):**
- the box is announced as a search with suggestions;
- ↑ and ↓ move through the suggestions, Enter chooses one, and Escape closes them;
- a screen reader hears how many suggestions there are, and how many results;
- every filter has a label;
- everything you tap is at least 44 pixels;
- nothing is wider than a phone screen.

### 3. Rentals and finding pros
- **Rentals:** a typo in the area ("Sinkr") still finds Sinkor, and "flat" finds apartments. The best match comes first.
- **Finding a pro:** typos in the kind of work ("plumbr", "electrishan") and in the town ("Monrovai") still find the right pros. Everything that worked before still works.

### 4. A search box on every long list
Any list of 6 or more items on the customer, pro and Admin pages now gets a search box above it. That includes tables and card lists such as:
- **customers:** bookings, orders, receipts, quotes and trips;
- **pros:** job matches, contracts, payouts and goods;
- **the team:** Admin queues, logs and tables.

It filters as you type with the same engine (typos and other names included), and says "3 of 18 shown". A booking or receipt number, or an amount, finds its row. When nothing matches, it says so and suggests what to try. Escape clears it.

It is left off places where it would get in the way:
- menus, forms and Settings;
- chats;
- lists of fewer than 6 items;
- the Market and Rentals results, which have their own search;
- lists that already have a search box of their own, such as Customers & Providers and Customer Payments.

### 5. Spanish
Every new word on screen is in Spanish too: 37 entries.

## Tests
- **`t183` (new, 53 checks):**
  - the engine (typos, other names, plurals, accents, units, "Did you mean");
  - the Market on the server (best match, filters, counts per category, partial matches, suggestions);
  - Rentals and pros;
  - the Market screen on a phone (combobox, keyboard, recent searches, highlights, nothing-found help, filters);
  - list search (cards and tables, typos, numbers and amounts, "X of Y shown", Escape, no box on short lists or lists with their own search);
  - Spanish.
- Every earlier suite, on the file store and on Postgres.
- **One earlier test caught a real problem, now fixed.** A search box added above the Settings switches pushed the page down just after it had scrolled to the payout details. Settings and forms never get a list search now.

## What is business, not code
- **The list of "other names" is a starting point.** If buyers in Liberia use other words for things (local names for goods, foods or tools), send them to me and I'll add them. It's one line each.
- **Prices in the filters are in US dollars.** Most listings are priced in US dollars. If you want the filter in Liberian dollars for Liberia, say so, and I'll convert at the daily rate.

## Files
**New:**
- `public/app/search-core.js` (the search engine, for the server and the app)
- `public/app/search-ui.js` (the search box, suggestions, recent searches, and search on long lists)

**Changed:**
- `src/routes/market.routes.js` (Market search: best match, filters, counts, "Did you mean", and suggestions at `/api/market/autocomplete`)
- `src/routes/rentals.routes.js` (Rentals search)
- `src/routes/marketplace.routes.js` (finding pros: typos in the kind of work and the town)
- `public/app/market.js` (the Market search screen)
- `public/app/es-v152.js` (Spanish)
- `public/index.html` (the two new files, and new version numbers)

Nothing new to install on Render, and no database changes.
