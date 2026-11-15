# Trothen v134: commission at accept time, escrow commission first, and categories by country

This one package includes everything since the version on your GitHub `main` before v128: v128 to v133, plus this. Deploy only this one. It works whether or not v128 is already live.

## 1. Pros see the commission before they accept, every time the price changes

**What I asked:** show the amount and the commission to the pro when they accept a job, for cash jobs and for jobs paid through Trothen, every time a new price is negotiated until they accept. Should the customer see it too?

**The answer on customers:** no. Customers see what they pay, the job price plus Trothen's service fee. A pro's commission is between the pro and Trothen. This is how most marketplaces handle it, and showing it to customers tends to start haggling ("you lose 13% anyway, so drop your price"). Every new breakdown also says "Customers do not see your commission".

**What changed:**
- **When a pro taps Accept or Confirm Booking,** a breakdown appears before anything happens. This applies in My Contracts ("Confirm Booking", "Accept $X" on a customer's offer) and in Job Matches ("Accept the job at $X").
  - **Jobs paid through Trothen:** the job price, store goods (no commission), Trothen's commission with the rate (and whether it comes from the plan, an organisation or a custom rate), any store fee, and **You receive**. It also explains that the customer's money is held until the job is done, and that the commission comes out first.
  - **Cash jobs:** the job price, Trothen's commission in tokens, and You receive (in cash, from the customer). It also shows the pro's token balance before and after accepting.
  - **Not enough tokens:** the pro is told plainly, the button becomes "Buy Tokens", and the job is not accepted. This matches the rule: on a cash job the pro must buy tokens to cover Trothen's commission.
  - **Cancel** leaves the booking unanswered.
- **On every booking or job the pro hasn't accepted yet,** a line shows the price on the table now and what they would receive. For example: "At $100.00: you receive $87.00 after 13% commission ($13.00)", or, for a cash job, "6.5 tokens. You have 5 tokens: buy 1.5 more to accept." It updates every time either side suggests a new price.
- **While a pro types a price** (suggesting a price, or sending or changing their price on a job), a live line under the box shows what they would receive.
- **The numbers match what is charged.** They come from the same rules payouts use. The test checks that accepting a cash job took exactly the tokens the breakdown showed.

## 2. Escrow: Trothen's commission comes out first

**What I asked:** with escrow, our commission should be taken out before the rest is paid to the pro, and on cash jobs the pro buys tokens to cover the commission.

**What changed:** this reverses part of v132. v132 had made tokens pay the escrow commission first, by default. Now:
- **Escrow jobs:** the commission is always taken out of the job money first, and the pro is paid the rest.
- **Cash jobs:** tokens cover the commission, as before.
- **The opt-in stays.** A pro can still tick "Commission on protected jobs, when I cash out" on their Tokens page, as before v132. Tell me if you want that option removed.

## 3. "Land Scaping": why it couldn't be found

**What was wrong:**
- **Your live site only has 4 active categories:** Plumbing, Pick & Drop, Desktop Publishing and Carpenter. The standard list of 60 was never added to it, so Landscaping wasn't in the Post a Job list.
- **Only exact spellings matched.** The job was posted under "Other" as "Land Scaping". The server matched pros only by exact spelling, so it was treated as a brand-new kind of work, and no pro was matched or told.
- **The job card showed a wrench icon,** because "Land Scaping" wasn't recognised. More broadly, 46 of the 60 category emoji have no line icon, so since v130 most job cards showed a blank or a generic wrench.

**What changed:**
- **Spelling differences no longer matter.** "Land Scaping", "land-scaping", "landscaper", "Plumber" and "Lawn care" are filed under the real category. This applies to jobs, pro sign-up and a pro changing their category in Settings. A genuinely new kind of work still goes to you for review.
- **The right icon for every category.** Each of the 60 categories now has its own fitting line icon in a standard colour. For example:
  - Plumbing: blue drop;
  - Electrical: amber bolt;
  - HVAC: snowflake;
  - Roofing: roof;
  - Locksmith: key;
  - Landscaping: green leaf;
  - Lawn Care: grass;
  - Hair Styling: scissors;
  - Nail Care: nail polish;
  - Towing: tow truck;
  - Elder Care: heart.

  Before, several categories shared one icon, and some were wrong: Nail Care, Auto Repair, Towing and Elder Care all showed the Carpentry icon, and Hair Styling showed the air-conditioning icon.
- **Names people type get the icon that fits.** "Land Scaping" gets the leaf, "Carpenter" the hammer and "Desktop Publishing" a newspaper.
- **A category with no fitting icon is left blank,** with no letters and no generic tool.
- **Where icons appear:** the same icons are used on the homepage cards and on job cards.

**What you need to do:** Admin → Categories & Countries → **Sync Latest Categories & Countries**. That adds the 60 standard categories to your live site. Your existing ones are not changed. The "Land Scaping" request already posted was matched when it was posted, so cancel it and post it again under Landscaping.

## 4. Categories by country: the design

**What I asked:** should the categories be the same everywhere, or specific to the country you signed up from? Use the best design and international standards.

**The design, as the large international marketplaces do it:**
- **One worldwide list.** The same kinds of work, names and translations everywhere, managed in one place, so reports and search work across countries.
- **Grouped:** Home repairs & maintenance, Cleaning, Outdoor & garden, Moving & delivery, Beauty & wellness, Lessons & tutoring, Events & media, Vehicles, Pets, Care, Business & tech.
- **Offered per country.** Every category is offered everywhere unless you switch it off for a country, for local law or licensing (for example legal or notary work). Customers only see what is offered in their country, and a job can't be posted in a category that is switched off there.
- **Supply shown honestly.** Next to each kind of work, the customer sees "3 near you", "5 in Liberia" or "no pros yet". If they choose one with no pros nearby, they're told before posting.
- **Search as you type.** "yard", "plumber" or "braids" find the right kind of work. If nothing matches, "Other" is chosen and they describe it.
- **Jobs stay in their own country.** Jobs are matched to pros in the job's own country, as before.

**What changed:**
- **Post a Job:** a search box above the category list, the categories grouped, the count next to each, a note under it, and "Showing the kinds of work offered in [country]".
- **Admin → Categories & Countries:** a new "Offered In" column ("All countries", or "All except Ghana") with a Change button for the super admin.

**Not changed yet (tell me if you want them):**
- The pro sign-up list and the homepage directory still show every category, not filtered by country.
- The category names in other languages come from the existing translations.

## What I tested
- **27 new checks for the accept breakdown:**
  - jobs paid through Trothen and cash jobs, with and without enough tokens;
  - organisation rate, free-commission credit and store goods;
  - the line following a new price;
  - the live line while typing;
  - Job Matches;
  - phone size and Spanish.
- **20 new checks for categories:**
  - "Land Scaping" saved as Landscaping and matched to the Landscaping pro;
  - a pro's "land-scaping" approved as Landscaping;
  - a category switched off in a country hidden and refused there but still offered elsewhere;
  - an unknown country refused;
  - the counts;
  - the Post a Job search and notes, laptop and phone;
  - the admin column;
  - the icon on the old "Land Scaping" card;
  - all 60 categories have distinct icons, and an unknown name is blank.
- **Escrow-first checks:** the whole commission comes out of the job money and tokens are left for cash jobs.
- **Earlier tests.** All still pass on a copy deployed from the zip.

## Files
- **New:**
  - `src/category-groups.js`
  - `public/app/acceptquote.js`
  - `public/app/categories.js`
- **Changed:**
  - `src/commission-statement.js`
  - `src/search-synonyms.js`
  - `src/tokens.js`
  - `src/routes/payments.routes.js`
  - `src/routes/marketplace.routes.js`
  - `src/routes/admin.routes.js`
  - `src/routes/auth.routes.js`
  - `src/routes/tokens.routes.js`
  - `public/app/commission.js`
  - `public/app/tokens.js`
  - `public/app/trothen.js`
  - `public/index.html`

No new packages, environment variables or database changes.
